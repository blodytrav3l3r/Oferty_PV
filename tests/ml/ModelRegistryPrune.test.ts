/**
 * Testy regresyjne retencji rejestru modeli ML (ModelRegistry.pruneOldModels).
 * Oparte na mockach prismaClient — bez prawdziwej bazy danych.
 * Polityka retencji: ML_CONFIG.retention = { keepLast: 10, keepBest: 3 }.
 */

import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { ML_CONSTANTS } from '../../src/config/mlConstants';

const mockFindMany = jest.fn<any>();
const mockDeleteMany = jest.fn<any>();

jest.mock('../../src/prismaClient', () => {
    const prisma = {
        aiModel: {
            findMany: (...args: any[]) => mockFindMany(...args),
            deleteMany: (...args: any[]) => mockDeleteMany(...args)
        },
        $transaction: jest.fn(async (cb: (tx: any) => Promise<any>) => cb(prisma))
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

interface PruneRecord {
    id: string;
    version: string;
    active: boolean;
    metrics: string;
    features?: string;
    featureVersion: string | null;
    createdAt: string;
}

const CURRENT_FV = ML_CONSTANTS.FEATURE_VERSION;

function makeRecord(overrides: Partial<PruneRecord>): PruneRecord {
    return {
        id: 'm-1',
        version: 'v1.0.0-m-1',
        active: false,
        metrics: JSON.stringify({ rocAuc: 0.5 }),
        featureVersion: CURRENT_FV,
        createdAt: isoDate(0),
        ...overrides
    };
}

function isoDate(offsetDays: number): string {
    return new Date(Date.UTC(2020, 0, 1 + offsetDays)).toISOString();
}

function deletedIdsFromCalls(): string[] {
    const firstCall = mockDeleteMany.mock.calls[0] as unknown as any[];
    return firstCall[0].where.id.in as string[];
}

describe('ModelRegistry.pruneOldModels', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // deleteMany musi zwracać { count: N } — liczba usuniętych = liczba przekazanych id
        mockDeleteMany.mockImplementation(async (args: any) => ({
            count: args.where.id.in.length
        }));
    });

    it('chroni aktywny model mimo niskiego AUC i starej daty', async () => {
        const { modelRegistry } = await import('../../src/services/ml/ModelRegistry');
        const activeId = 'm-active';
        const records = [
            makeRecord({
                id: activeId,
                active: true,
                metrics: JSON.stringify({ rocAuc: 0.3 }),
                createdAt: isoDate(0)
            }),
            ...Array.from({ length: 14 }, (_, i) =>
                makeRecord({
                    id: 'm-' + (i + 1),
                    metrics: JSON.stringify({ rocAuc: 0.5 }),
                    createdAt: isoDate(i + 1)
                })
            )
        ];
        mockFindMany.mockResolvedValue(records);

        const result = await modelRegistry.pruneOldModels();

        expect(result.deletedCount).toBe(1);
        const deletedIds = deletedIdsFromCalls();
        expect(deletedIds).toHaveLength(1);
        expect(deletedIds).not.toContain(activeId);
    });

    it('chroni top-keepBest najlepszych wg AUC (nieaktywne, stare)', async () => {
        const { modelRegistry } = await import('../../src/services/ml/ModelRegistry');
        const bestIds = ['m-best-1', 'm-best-2', 'm-best-3'];
        const records = [
            makeRecord({
                id: bestIds[0],
                metrics: JSON.stringify({ rocAuc: 0.9 }),
                createdAt: isoDate(0)
            }),
            makeRecord({
                id: bestIds[1],
                metrics: JSON.stringify({ rocAuc: 0.85 }),
                createdAt: isoDate(1)
            }),
            makeRecord({
                id: bestIds[2],
                metrics: JSON.stringify({ rocAuc: 0.8 }),
                createdAt: isoDate(2)
            }),
            ...Array.from({ length: 13 }, (_, i) =>
                makeRecord({
                    id: 'm-low-' + i,
                    metrics: JSON.stringify({ rocAuc: 0.5 }),
                    createdAt: isoDate(i + 10)
                })
            )
        ];
        mockFindMany.mockResolvedValue(records);

        const result = await modelRegistry.pruneOldModels();

        // keepLast=10 trzyma 10 najnowszych (slabe), keepBest=3 trzyma 3 najlepsze — usuwane 3 najstarsze slabe
        expect(result.deletedCount).toBe(3);
        const deletedIds = deletedIdsFromCalls();
        expect(deletedIds).toHaveLength(3);
        for (const id of bestIds) {
            expect(deletedIds).not.toContain(id);
        }
    });

    it('chroni ostatnie keepLast wg createdAt mimo słabego AUC', async () => {
        const { modelRegistry } = await import('../../src/services/ml/ModelRegistry');
        const records = Array.from({ length: 14 }, (_, i) =>
            makeRecord({
                id: 'm-' + i,
                metrics: JSON.stringify({ rocAuc: 0.3 }),
                createdAt: isoDate(i)
            })
        );
        mockFindMany.mockResolvedValue(records);

        const result = await modelRegistry.pruneOldModels();

        // 14 modeli, wszystkie słabe (AUC 0.3): keepBest trzyma 3, keepLast 10 najnowszych
        // — usuwany jest tylko 1 (indeks 3 w stabilnym sortowaniu, pomijany przez oba zbiory)
        expect(result.deletedCount).toBe(1);
        const deletedIds = deletedIdsFromCalls();
        expect(deletedIds).toEqual(['m-3']);
        expect(deletedIds).not.toContain('m-13');
    });

    it('usuwa modele spoza bieżącej featureVersion', async () => {
        const { modelRegistry } = await import('../../src/services/ml/ModelRegistry');
        const oldFvIds = ['m-oldfv-1', 'm-oldfv-2'];
        const records = [
            ...Array.from({ length: 14 }, (_, i) =>
                makeRecord({
                    id: 'm-cur-' + i,
                    metrics: JSON.stringify({ rocAuc: 0.5 }),
                    createdAt: isoDate(i)
                })
            ),
            ...oldFvIds.map((id, i) =>
                makeRecord({
                    id,
                    metrics: JSON.stringify({ rocAuc: 0.9 }),
                    featureVersion: 'v5',
                    createdAt: isoDate(100 + i)
                })
            )
        ];
        mockFindMany.mockResolvedValue(records);

        const result = await modelRegistry.pruneOldModels();

        // 14 bieżących: 13 chronionych (keepBest+keepLast), 1 usuwany; 2 stare wersje zawsze usuwane
        expect(result.deletedCount).toBe(3);
        const deletedIds = deletedIdsFromCalls();
        expect(deletedIds).toHaveLength(3);
        for (const id of oldFvIds) {
            expect(deletedIds).toContain(id);
        }
    });

    it('traktuje poprawny JSON bez pola rocAuc jak -1 (nie chroni jako "best")', async () => {
        const { modelRegistry } = await import('../../src/services/ml/ModelRegistry');
        const missingRocId = 'm-missing-roc';
        const records = [
            makeRecord({
                id: 'm-best-1',
                metrics: JSON.stringify({ rocAuc: 0.9 }),
                createdAt: isoDate(0)
            }),
            makeRecord({
                id: 'm-best-2',
                metrics: JSON.stringify({ rocAuc: 0.85 }),
                createdAt: isoDate(1)
            }),
            makeRecord({
                id: 'm-best-3',
                metrics: JSON.stringify({ rocAuc: 0.8 }),
                createdAt: isoDate(2)
            }),
            makeRecord({
                id: missingRocId,
                metrics: JSON.stringify({ accuracy: 0.9 }),
                createdAt: isoDate(3)
            }),
            ...Array.from({ length: 11 }, (_, i) =>
                makeRecord({
                    id: 'm-low-' + i,
                    metrics: JSON.stringify({ rocAuc: 0.5 }),
                    createdAt: isoDate(i + 4)
                })
            )
        ];
        mockFindMany.mockResolvedValue(records);

        const result = await modelRegistry.pruneOldModels();

        // keepBest (3) to tylko rekordy z realnym rocAuc; rekord bez rocAuc (=> -1) i najstarszy
        // "low" nie wchodzą ani do keepBest, ani do keepLast (10 najnowszych) — usuwane 2
        expect(result.deletedCount).toBe(2);
        const deletedIds = deletedIdsFromCalls();
        expect(deletedIds).toContain(missingRocId);
        expect(deletedIds).not.toContain('m-best-1');
    });

    it('edge: < keepBest rekordów — deleteMany nie wywołany, zwraca 0', async () => {
        const { modelRegistry } = await import('../../src/services/ml/ModelRegistry');
        mockFindMany.mockResolvedValue([
            makeRecord({ id: 'm-1', createdAt: isoDate(0) }),
            makeRecord({ id: 'm-2', createdAt: isoDate(1) })
        ]);

        const result = await modelRegistry.pruneOldModels();

        expect(mockDeleteMany).not.toHaveBeenCalled();
        expect(result).toEqual({ deletedCount: 0, deletedVersions: [] });
    });

    it('usuwa tylko nadmiarowe rekordy (15 modeli, 14 chronionych -> zwraca 1)', async () => {
        const { modelRegistry } = await import('../../src/services/ml/ModelRegistry');
        const records = [
            makeRecord({
                id: 'm-active',
                active: true,
                metrics: JSON.stringify({ rocAuc: 0.2 }),
                createdAt: isoDate(-365)
            }),
            makeRecord({
                id: 'm-best-1',
                metrics: JSON.stringify({ rocAuc: 0.9 }),
                createdAt: isoDate(0)
            }),
            makeRecord({
                id: 'm-best-2',
                metrics: JSON.stringify({ rocAuc: 0.85 }),
                createdAt: isoDate(1)
            }),
            makeRecord({
                id: 'm-best-3',
                metrics: JSON.stringify({ rocAuc: 0.8 }),
                createdAt: isoDate(2)
            }),
            ...Array.from({ length: 11 }, (_, i) =>
                makeRecord({
                    id: 'm-low-' + i,
                    metrics: JSON.stringify({ rocAuc: 0.5 }),
                    createdAt: isoDate(i + 10)
                })
            )
        ];
        mockFindMany.mockResolvedValue(records);

        const result = await modelRegistry.pruneOldModels();

        // aktywny (1) + keepBest (3) + keepLast (10) = 14 chronionych, 1 usuwany
        expect(result.deletedCount).toBe(1);
        const deletedIds = deletedIdsFromCalls();
        expect(deletedIds).toHaveLength(1);
        expect(deletedIds).not.toContain('m-active');
    });

    it('listModels nie rzuca przy uszkodzonym JSON i loguje warn (A-16)', async () => {
        const { logger } = await import('../../src/utils/logger');
        const { modelRegistry } = await import('../../src/services/ml/ModelRegistry');
        mockFindMany.mockResolvedValue([
            makeRecord({
                id: 'm-bad',
                metrics: '{uszkodzony json',
                features: 'tez nie json'
            })
        ]);
        (logger.warn as jest.Mock).mockClear();

        const list = await modelRegistry.listModels(1);

        expect(list).toHaveLength(1);
        expect(list[0].id).toBe('m-bad');
        expect(list[0].metrics).toBeNull();
        expect(list[0].features).toEqual([]);
        expect(logger.warn).toHaveBeenCalled();
    });
});
