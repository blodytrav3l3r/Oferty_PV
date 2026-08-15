/**
 * Testy state machine (ETAP 7A): promote (APPROVED→PRODUCTION z atomową
 * wymianą + invariant max 1 PRODUCTION), approve (REJECTED→APPROVED z śladem
 * w notes), rollback (state ROLLED_BACK). Oparte na mockach prismaClient.
 */

import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { ML_CONSTANTS } from '../../src/config/mlConstants';

const mockFindUnique = jest.fn<any>();
const mockFindFirst = jest.fn<any>();
const mockUpdate = jest.fn<any>();
const mockUpdateMany = jest.fn<any>();

interface MockTx {
    aiModel: {
        findFirst: typeof mockFindFirst;
        update: typeof mockUpdate;
        updateMany: typeof mockUpdateMany;
    };
}

const tx = {
    aiModel: {
        findFirst: (...args: any[]) => mockFindFirst(...args),
        update: (...args: any[]) => mockUpdate(...args),
        updateMany: (...args: any[]) => mockUpdateMany(...args)
    }
} as MockTx;

jest.mock('../../src/prismaClient', () => {
    const prisma = {
        aiModel: {
            findUnique: (...args: any[]) => mockFindUnique(...args),
            findFirst: (...args: any[]) => mockFindFirst(...args),
            update: (...args: any[]) => mockUpdate(...args),
            updateMany: (...args: any[]) => mockUpdateMany(...args)
        },
        $transaction: jest.fn(async (cb: (t: any) => Promise<any>) => cb(tx))
    };
    return { __esModule: true, default: prisma };
});

jest.mock('../../src/utils/logger', () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
    }
}));

jest.mock('../../src/services/ml/predictionCache', () => ({
    clearPredictionCache: jest.fn()
}));

import { modelRegistry } from '../../src/services/ml/ModelRegistry';
import { AiModelState } from '../../src/services/ml/aiModelState';

const FV = ML_CONSTANTS.FEATURE_VERSION;

function makeRecord(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        id: 'm-1',
        version: 'v1.0.0-m-1',
        weights: '[0,0]',
        bias: 0,
        metrics: JSON.stringify({ rocAuc: 0.8, accuracy: 0.8 }),
        features: '[]',
        featureMins: '[0]',
        featureMaxs: '[1]',
        trainingRows: 100,
        featureVersion: FV,
        state: AiModelState.APPROVED,
        seed: 42,
        featureDistributions: null,
        active: false,
        notes: null,
        createdAt: new Date().toISOString(),
        ...overrides
    };
}

beforeEach(() => {
    mockFindUnique.mockReset();
    mockFindFirst.mockReset();
    mockUpdate.mockReset();
    mockUpdateMany.mockReset();
});

describe('promoteModel', () => {
    it('APPROVED → PRODUCTION, stary PRODUCTION → ROLLED_BACK (atomowa wymiana)', async () => {
        mockFindUnique.mockResolvedValueOnce(makeRecord({ id: 'cand', version: 'v1.1.0-x' }));
        mockFindFirst.mockResolvedValueOnce(
            makeRecord({
                id: 'prod',
                version: 'v1.0.0-p',
                active: true,
                state: AiModelState.PRODUCTION
            })
        );

        const promoted = await modelRegistry.promoteModel('cand');

        expect(promoted).not.toBeNull();
        expect(mockUpdate).toHaveBeenCalledTimes(2);
        const firstUpdate = mockUpdate.mock.calls[0] as unknown as any[];
        expect(firstUpdate[0].data.state).toBe(AiModelState.ROLLED_BACK);
        expect(firstUpdate[0].data.active).toBe(false);
        const secondUpdate = mockUpdate.mock.calls[1] as unknown as any[];
        expect(secondUpdate[0].data.state).toBe(AiModelState.PRODUCTION);
        expect(secondUpdate[0].data.active).toBe(true);
        // invariant: pozostałe aktywne → false
        expect(mockUpdateMany).toHaveBeenCalledWith(
            expect.objectContaining({ data: { active: false } })
        );
    });

    it('REJECTED nie może być promowany — rzuca błąd', async () => {
        mockFindUnique.mockResolvedValueOnce(
            makeRecord({ state: AiModelState.REJECTED, active: false })
        );
        await expect(modelRegistry.promoteModel('m-1')).rejects.toThrow('REJECTED');
        expect(mockUpdate).not.toHaveBeenCalled();
    });

    it('nieistniejący model → null', async () => {
        mockFindUnique.mockResolvedValueOnce(null);
        expect(await modelRegistry.promoteModel('nope')).toBeNull();
    });

    it('model spoza bieżącej wersji cech nie może być promowany', async () => {
        mockFindUnique.mockResolvedValueOnce(
            makeRecord({ featureVersion: 'v6', state: AiModelState.APPROVED })
        );
        await expect(modelRegistry.promoteModel('m-1')).rejects.toThrow('wersji cech');
    });

    it('już PRODUCTION → idempotentnie zwraca model bez zmian', async () => {
        mockFindUnique.mockResolvedValueOnce(
            makeRecord({ state: AiModelState.PRODUCTION, active: true })
        );
        const result = await modelRegistry.promoteModel('m-1');
        expect(result?.state).toBe(AiModelState.PRODUCTION);
        expect(mockUpdate).not.toHaveBeenCalled();
    });
});

describe('approveModel', () => {
    it('REJECTED → APPROVED z śladem admina w notes', async () => {
        mockFindUnique.mockResolvedValueOnce(
            makeRecord({ state: AiModelState.REJECTED, notes: 'REJECTED przez guardrail: x' })
        );
        mockUpdate.mockResolvedValueOnce(
            makeRecord({ state: AiModelState.APPROVED, notes: 'note' })
        );

        const approved = await modelRegistry.approveModel('m-1', 'admin-1');

        expect(approved).not.toBeNull();
        expect(approved!.state).toBe(AiModelState.APPROVED);
        const updateCall = mockUpdate.mock.calls[0] as unknown as any[];
        expect(updateCall[0].data.state).toBe(AiModelState.APPROVED);
        expect(updateCall[0].data.notes).toContain('admin-1');
        expect(updateCall[0].data.notes).toContain('REJECTED \u2192 APPROVED');
    });

    it('model spoza REJECTED nie może być approved — błąd', async () => {
        mockFindUnique.mockResolvedValueOnce(makeRecord({ state: AiModelState.CANDIDATE }));
        await expect(modelRegistry.approveModel('m-1', 'admin-1')).rejects.toThrow('REJECTED');
    });

    it('nieistniejący model → null', async () => {
        mockFindUnique.mockResolvedValueOnce(null);
        expect(await modelRegistry.approveModel('nope', 'admin-1')).toBeNull();
    });
});

describe('rollbackToPrevious', () => {
    it('aktywny → ROLLED_BACK, poprzedni → PRODUCTION', async () => {
        mockFindFirst
            .mockResolvedValueOnce(
                makeRecord({
                    id: 'prod',
                    version: 'v1.1.0',
                    active: true,
                    state: AiModelState.PRODUCTION
                })
            )
            .mockResolvedValueOnce(
                makeRecord({
                    id: 'prev',
                    version: 'v1.0.0',
                    active: false,
                    state: AiModelState.ROLLED_BACK
                })
            );

        const result = await modelRegistry.rollbackToPrevious();

        expect(result).not.toBeNull();
        expect(mockUpdate).toHaveBeenCalledTimes(2);
        const calls = mockUpdate.mock.calls as unknown as any[][];
        expect(calls[0][0].data.state).toBe(AiModelState.ROLLED_BACK);
        expect(calls[1][0].data.state).toBe(AiModelState.PRODUCTION);
        expect(calls[1][0].data.active).toBe(true);
    });

    it('brak poprzedniego modelu → null', async () => {
        mockFindFirst
            .mockResolvedValueOnce(makeRecord({ active: true, state: AiModelState.PRODUCTION }))
            .mockResolvedValueOnce(null);
        expect(await modelRegistry.rollbackToPrevious()).toBeNull();
        expect(mockUpdate).not.toHaveBeenCalled();
    });
});
