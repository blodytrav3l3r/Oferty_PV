import { describe, expect, it, jest, beforeEach } from '@jest/globals';

const mockFindMany = jest.fn<any>();
const mockFindUnique = jest.fn<any>();
const mockCreateKb = jest.fn<any>();
const mockFindFirstKb = jest.fn<any>();
const mockUpsertSettings = jest.fn<any>();

jest.mock('../../src/prismaClient', () => {
    const mockAiKnowledgeBase = {
        findFirst: (...args: any[]) => mockFindFirstKb(...args),
        create: (...args: any[]) => mockCreateKb(...args),
        update: jest.fn<any>(),
        count: jest.fn<any>().mockResolvedValue(0)
    };

    return {
        __esModule: true,
        default: {
            ai_telemetry_logs: { findMany: (...args: any[]) => mockFindMany(...args) },
            ai_transition_snapshots: { findMany: jest.fn<any>().mockResolvedValue([]) },
            settings: {
                findUnique: (...args: any[]) => mockFindUnique(...args),
                upsert: (...args: any[]) => mockUpsertSettings(...args)
            },
            ai_knowledge_base: mockAiKnowledgeBase,
            $transaction: jest.fn<any>((fn: (tx: any) => Promise<any>) =>
                fn({
                    ai_knowledge_base: mockAiKnowledgeBase
                })
            )
        }
    };
});

jest.mock('../../src/utils/logger', () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
    }
}));

function makeRecord(dn: string, overrides: Record<string, unknown> = {}) {
    return {
        id: 'test-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
        dn,
        warehouse: 'KLB',
        wellType: 'standard',
        wellHeight: 3000,
        ringCount: 3,
        wasAccepted: true,
        wasRejected: false,
        wasModified: true,
        modificationCount: 1,
        totalPrice: 2500,
        totalWeight: 5000,
        allComponentIds: JSON.stringify([
            { productId: 'KDB-' + dn + '-1000' },
            { productId: 'KDB-' + dn + '-1000' },
            { productId: 'DDD-' + dn + '-500' }
        ]),
        appliedReductions: null,
        appliedKonus: JSON.stringify([{ productId: 'KNS-' + dn + '-500' }]),
        appliedSeals: JSON.stringify([{ productId: 'USZ-' + dn }]),
        createdAt: new Date().toISOString(),
        solverSource: 'AUTO_JS',
        trainingEligible: true,
        original_auto_config: JSON.stringify([
            { componentType: 'krag', productId: 'KDB-' + dn + '-1000', quantity: 2 },
            { componentType: 'dennica', productId: 'DDD-' + dn + '-500', quantity: 1 }
        ]),
        final_user_config: JSON.stringify([
            { componentType: 'krag', productId: 'KDB-' + dn + '-1000', quantity: 3 },
            { componentType: 'dennica', productId: 'DDD-' + dn + '-500', quantity: 1 },
            { componentType: 'krag redukcyjny', productId: 'KRC-' + dn + '-800', quantity: 1 }
        ]),
        override_reason: 'potrzebna wieksza wysokosc',
        ...overrides
    };
}

describe('LearningEngine', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockFindUnique.mockResolvedValue(null);
        mockFindMany.mockResolvedValue([]);
        mockFindFirstKb.mockResolvedValue(null);
        mockCreateKb.mockResolvedValue({ id: 'kb-id' });
        mockUpsertSettings.mockResolvedValue({
            key: 'learning_last_run',
            value: new Date().toISOString()
        });
    });

    it('runFullCycle wykrywa wzorce dla 3 rekordow z tym samym DN', async () => {
        const records = [makeRecord('1000'), makeRecord('1000'), makeRecord('1000')];
        mockFindMany.mockResolvedValue(records);

        const mod = await import('../../src/services/telemetry/learning/LearningEngine');
        const engine = new mod.LearningEngine();
        const result = await engine.runFullCycle();

        expect(result.processed).toBe(3);
        expect(result.patternsDetected).toBeGreaterThan(0);
        expect(result.durationMs).toBeGreaterThan(0);
    });

    it('runFullCycle zwraca 0 gdy brak rekordow', async () => {
        mockFindMany.mockResolvedValue([]);

        const mod = await import('../../src/services/telemetry/learning/LearningEngine');
        const engine = new mod.LearningEngine();
        const result = await engine.runFullCycle();

        expect(result.processed).toBe(0);
        expect(result.patternsDetected).toBe(0);
    });

    it('runFullCycle nie rzuca bledu dla niepoprawnego JSON', async () => {
        const records = [
            makeRecord('1000', {
                original_auto_config: 'not-valid-json',
                final_user_config: 'also-not-valid'
            })
        ];
        mockFindMany.mockResolvedValue(records);

        const mod = await import('../../src/services/telemetry/learning/LearningEngine');
        const engine = new mod.LearningEngine();
        const result = await engine.runFullCycle();

        expect(result.processed).toBe(1);
        expect(result.error).toBeUndefined();
    });

    it('runFullCycle ignoruje niezmodyfikowane rekordy', async () => {
        const records = [makeRecord('1000', { wasModified: false })];
        mockFindMany.mockResolvedValue(records);

        const mod = await import('../../src/services/telemetry/learning/LearningEngine');
        const engine = new mod.LearningEngine();
        const result = await engine.runFullCycle();

        expect(result.processed).toBe(1);
        expect(result.error).toBeUndefined();
        expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('runFullCycle nie startuje ponownie jesli juz dziala', async () => {
        const records = [makeRecord('1000'), makeRecord('1000')];
        mockFindMany.mockResolvedValue(records);

        const mod = await import('../../src/services/telemetry/learning/LearningEngine');
        const engine = new mod.LearningEngine();

        const first = engine.runFullCycle();
        const second = await engine.runFullCycle();
        const firstResult = await first;

        expect(second.processed).toBe(0);
        expect(second.patternsDetected).toBe(0);
        expect(firstResult.processed).toBeGreaterThan(0);
    });

    it('runFullCycle persists patterns do KnowledgeBase', async () => {
        const records = [makeRecord('1000'), makeRecord('1000'), makeRecord('1000')];
        mockFindMany.mockResolvedValue(records);

        const mod = await import('../../src/services/telemetry/learning/LearningEngine');
        const engine = new mod.LearningEngine();
        const result = await engine.runFullCycle();

        expect(result.persistedToKb).toBeGreaterThan(0);
    });
});
