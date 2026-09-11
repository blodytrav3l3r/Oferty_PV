/**
 * Allowlista użytkowników treningowych AI/ML (settings.ai_training_user_ids).
 *
 * Invariant P0: żaden rekord spoza allowlisty nie wchodzi do ekstrakcji,
 * treningu, resyncu ani LearningEngine.
 */

import { describe, expect, it, jest, beforeEach } from '@jest/globals';

/* ===== FAKE DB (honoruje klauzule where jak prawdziwa baza) ===== */

type Row = Record<string, any>;

const store = {
    settings: new Map<string, string>(),
    telemetry: [] as Row[],
    features: [] as Row[],
    kb: [] as Row[]
};

function matches(value: any, cond: any): boolean {
    if (cond === null || cond === undefined) return value === cond;
    if (typeof cond !== 'object') return value === cond;
    if ('not' in cond) return value !== (cond as any).not;
    if ('in' in cond) return ((cond as any).in as any[]).includes(value);
    if ('gt' in cond) return value > (cond as any).gt;
    if ('lt' in cond) return value < (cond as any).lt;
    if ('gte' in cond) return value >= (cond as any).gte;
    return value === cond;
}

function matchTelemetry(rec: Row, where: any): boolean {
    if (!where) return true;
    for (const [k, v] of Object.entries(where)) {
        if (k === 'OR') {
            if (!(v as any[]).some((c) => matchTelemetry(rec, c))) return false;
            continue;
        }
        if (!matches(rec[k], v)) return false;
    }
    return true;
}

function applySelect(rec: Row, select: any): Row {
    if (!select) return rec;
    const out: Row = {};
    for (const k of Object.keys(select)) out[k] = rec[k];
    return out;
}

function sortDesc(rows: Row[]): Row[] {
    return [...rows].sort((a, b) => {
        const ca = a.createdAt || '';
        const cb = b.createdAt || '';
        if (ca !== cb) return cb < ca ? -1 : 1;
        return b.id < a.id ? -1 : 1;
    });
}

const mockTelemetryFindMany = jest.fn<any>(async (args: any = {}) => {
    let rows = store.telemetry.filter((r) => matchTelemetry(r, args.where));
    rows = sortDesc(rows);
    if (args.take) rows = rows.slice(0, args.take);
    return rows.map((r) => applySelect(r, args.select));
});

const mockFeatureFindMany = jest.fn<any>(async (args: any = {}) => {
    let rows = [...store.features];
    const w = args.where || {};
    if (w.telemetryId?.in) rows = rows.filter((f) => w.telemetryId.in.includes(f.telemetryId));
    if (w.OR)
        rows = rows.filter((f) =>
            (w.OR as any[]).some((c) => {
                if (c.ringCount === 0 && c.connectionCount === 0)
                    return f.ringCount === 0 && f.connectionCount === 0;
                if (c.bottomType) return f.bottomType === c.bottomType;
                if ('dennicaHeight' in c) return f.dennicaHeight === null;
                return false;
            })
        );
    if (w.createdAt?.gt) rows = rows.filter((f) => (f.createdAt || '') > w.createdAt.gt);
    rows = sortDesc(rows);
    if (args.take) rows = rows.slice(0, args.take);
    return rows.map((f) => applySelect(f, args.select));
});

const fakePrisma: any = {
    settings: {
        findUnique: jest.fn<any>(async ({ where }: any) =>
            store.settings.has(where.key)
                ? { key: where.key, value: store.settings.get(where.key) }
                : null
        ),
        upsert: jest.fn<any>(async ({ where, update, create }: any) => {
            const v = store.settings.has(where.key) ? update.value : create.value;
            store.settings.set(where.key, v);
            return { key: where.key, value: v };
        })
    },
    ai_telemetry_logs: {
        findMany: (...a: any[]) => mockTelemetryFindMany(...a),
        findFirst: jest.fn<any>(async (args: any = {}) => {
            const rows = await mockTelemetryFindMany({ ...args, take: 1 });
            return rows[0] || null;
        }),
        count: jest.fn<any>(async (args: any = {}) => {
            if (!args.where) return store.telemetry.length;
            return store.telemetry.filter((r) => matchTelemetry(r, args.where)).length;
        }),
        updateMany: jest.fn<any>(async () => ({ count: 0 }))
    },
    aiFeature: {
        findMany: (...a: any[]) => mockFeatureFindMany(...a),
        createMany: jest.fn<any>(async ({ data }: any) => {
            store.features.push(...data);
            return { count: data.length };
        }),
        update: jest.fn<any>(async ({ where, data }: any) => {
            const f = store.features.find((x) => x.id === where.id);
            if (f) Object.assign(f, data);
            return f;
        }),
        count: jest.fn<any>(async (args: any = {}) => {
            if (!args.where) return store.features.length;
            return store.features.length;
        })
    },
    ai_transition_snapshots: { findMany: jest.fn<any>(async () => []) },
    ai_knowledge_base: {
        findFirst: jest.fn<any>(
            async ({ where }: any = {}) =>
                store.kb.find(
                    (k) =>
                        (!where?.patternKey || k.patternKey === where.patternKey) &&
                        (!where?.status?.not || k.status !== where.status.not)
                ) || null
        ),
        update: jest.fn<any>(async ({ where, data }: any) => {
            const k = store.kb.find((x) => x.id === where.id);
            if (k) Object.assign(k, data);
            return k;
        }),
        create: jest.fn<any>(async ({ data }: any) => {
            store.kb.push(data);
            return data;
        }),
        updateMany: jest.fn<any>(async () => ({ count: 0 }))
    },
    $transaction: jest.fn<any>(async (fn: any) => fn(fakePrisma))
};

jest.mock('../../src/prismaClient', () => ({ __esModule: true, default: fakePrisma }));

jest.mock('../../src/utils/logger', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
}));

function telemetryFixture(id: string, userId: string | null, dn: string, extra: Row = {}): Row {
    return {
        id,
        userId,
        dn,
        warehouse: 'KLB',
        wellType: 'standard',
        wellHeight: 3000,
        ringCount: 0,
        wasAccepted: true,
        wasRejected: false,
        wasModified: true,
        modificationCount: 1,
        solverSource: 'MANUAL',
        parentConfigId: null,
        trainingEligible: true,
        createdAt: `2026-09-1${id.slice(-1)}T10:00:00.000Z`,
        allComponentIds: '[]',
        appliedReductions: '[]',
        appliedKonus: '[]',
        appliedSeals: '[]',
        featureSnapshot: JSON.stringify({ totalPrice: 100, totalWeight: 200 }),
        original_auto_config: JSON.stringify([{ productId: 'krag-a', componentType: 'krag' }]),
        final_user_config: JSON.stringify([
            { productId: 'krag-a', componentType: 'krag' },
            { productId: 'red-a', componentType: 'redukcja' }
        ]),
        kineta: 'brak',
        dennicaHeight: null,
        computationMs: 50,
        ...extra
    };
}

beforeEach(() => {
    store.settings.clear();
    store.telemetry = [];
    store.features = [];
    store.kb = [];
    jest.clearAllMocks();
});

describe('getTrainingUserIds', () => {
    it('brak klucza = null (wszyscy, backward compat)', async () => {
        const { getTrainingUserIds } = await import('../../src/services/ml/trainingUsers');
        expect(await getTrainingUserIds()).toBeNull();
    });

    it('jawnie pusta lista = [] (nikt)', async () => {
        store.settings.set('ai_training_user_ids', '[]');
        const { getTrainingUserIds } = await import('../../src/services/ml/trainingUsers');
        expect(await getTrainingUserIds()).toEqual([]);
    });

    it('uszkodzona wartość = null (bezpieczny fallback)', async () => {
        store.settings.set('ai_training_user_ids', 'nie-json');
        const { getTrainingUserIds } = await import('../../src/services/ml/trainingUsers');
        expect(await getTrainingUserIds()).toBeNull();
    });
});

describe('extractAndStore z allowlistą', () => {
    it('["A"]: ekstrahuje tylko rekordy A (B pominięte)', async () => {
        store.settings.set('ai_training_user_ids', JSON.stringify(['A']));
        store.telemetry = [
            telemetryFixture('tel-a1', 'A', '1000'),
            telemetryFixture('tel-b1', 'B', '1000')
        ];
        const { featureExtractor } = await import('../../src/services/ml/FeatureExtractor');
        const n = await featureExtractor.extractAndStore();
        expect(n).toBe(1);
        expect(store.features).toHaveLength(1);
        expect(store.features[0].telemetryId).toBe('tel-a1');
        const where = (mockTelemetryFindMany.mock.calls[0][0] as any).where;
        expect(where.userId).toEqual({ in: ['A'] });
    });

    it('[]: nikt nie trafia do ekstrakcji', async () => {
        store.settings.set('ai_training_user_ids', '[]');
        store.telemetry = [telemetryFixture('tel-a1', 'A', '1000')];
        const { featureExtractor } = await import('../../src/services/ml/FeatureExtractor');
        expect(await featureExtractor.extractAndStore()).toBe(0);
        expect(store.features).toHaveLength(0);
    });

    it('brak klucza: wszyscy trafiają (backward compat, brak filtra userId)', async () => {
        store.telemetry = [
            telemetryFixture('tel-a1', 'A', '1000'),
            telemetryFixture('tel-b1', 'B', '1000')
        ];
        const { featureExtractor } = await import('../../src/services/ml/FeatureExtractor');
        expect(await featureExtractor.extractAndStore()).toBe(2);
        const where = (mockTelemetryFindMany.mock.calls[0][0] as any).where;
        expect(where.userId).toBeUndefined();
    });
});

describe('resync z allowlistą (P0)', () => {
    it('resyncLabels: etykieta B nietknięta mimo feedbacku', async () => {
        store.settings.set('ai_training_user_ids', JSON.stringify(['A']));
        store.telemetry = [
            telemetryFixture('tel-a1', 'A', '1000', { wasAccepted: true }),
            telemetryFixture('tel-b1', 'B', '1000', { wasAccepted: true })
        ];
        store.features = [
            { id: 'f-a', telemetryId: 'tel-a1', label: 'NO_FEEDBACK', reward: 0 },
            { id: 'f-b', telemetryId: 'tel-b1', label: 'NO_FEEDBACK', reward: 0 }
        ];
        const { featureExtractor } = await import('../../src/services/ml/FeatureExtractor');
        await featureExtractor.resyncLabels();
        expect(store.features.find((f) => f.id === 'f-a')!.label).toBe('ACCEPTED');
        expect(store.features.find((f) => f.id === 'f-b')!.label).toBe('NO_FEEDBACK');
    });

    it('resyncFeatures: wektor B nieprzeliczony', async () => {
        store.settings.set('ai_training_user_ids', JSON.stringify(['A']));
        const withDennica = { allComponentIds: JSON.stringify([{ productId: 'DDD-1000-250' }]) };
        store.telemetry = [
            telemetryFixture('tel-a1', 'A', '1000', withDennica),
            telemetryFixture('tel-b1', 'B', '1000', withDennica)
        ];
        store.features = [
            { id: 'f-a', telemetryId: 'tel-a1', bottomType: 'unknown' },
            { id: 'f-b', telemetryId: 'tel-b1', bottomType: 'unknown' }
        ];
        const { featureExtractor } = await import('../../src/services/ml/FeatureExtractor');
        const n = await featureExtractor.resyncFeatures();
        expect(n).toBe(1);
        expect(store.features.find((f) => f.id === 'f-a')!.bottomType).not.toBe('unknown');
        expect(store.features.find((f) => f.id === 'f-b')!.bottomType).toBe('unknown');
    });
});

describe('filterFeaturesByTrainingUsers (join AiFeature→telemetry)', () => {
    it('zostawia tylko A; null-allow = wszystko', async () => {
        const { filterFeaturesByTrainingUsers } =
            await import('../../src/services/ml/trainingUsers');
        store.telemetry = [
            telemetryFixture('tel-a1', 'A', '1000'),
            telemetryFixture('tel-b1', 'B', '1000')
        ];
        const feats = [{ telemetryId: 'tel-a1' }, { telemetryId: 'tel-b1' }];
        store.settings.set('ai_training_user_ids', JSON.stringify(['A']));
        expect(await filterFeaturesByTrainingUsers(feats)).toEqual([{ telemetryId: 'tel-a1' }]);
        store.settings.clear();
        expect(await filterFeaturesByTrainingUsers(feats)).toEqual(feats);
    });
});

describe('LearningEngine E2E: historyczne KB od B + allowlista [A]', () => {
    it('runFullCycle nie tworzy wzorców z danych B', async () => {
        store.settings.set('ai_training_user_ids', JSON.stringify(['A']));
        // A: 3 rekordy DN=1000 z redukcją → kubełek 1000|with (próg 3).
        // B: 3 rekordy DN=2000 z redukcją → kubełek 2000|with (musiałby się pojawić przy wycieku).
        store.telemetry = [
            telemetryFixture('tel-a1', 'A', '1000'),
            telemetryFixture('tel-a2', 'A', '1000'),
            telemetryFixture('tel-a3', 'A', '1000'),
            telemetryFixture('tel-b1', 'B', '2000'),
            telemetryFixture('tel-b2', 'B', '2000'),
            telemetryFixture('tel-b3', 'B', '2000')
        ];
        // Historyczny wzorzec B sprzed konfiguracji allowlisty.
        store.kb = [
            {
                id: 'kb-old-b',
                patternKey: '2000|with',
                patternType: 'reduction_choice',
                dn: '2000',
                hitCount: 5,
                confidence: 0.8,
                successCount: 5,
                rejectionCount: 0,
                status: 'active'
            }
        ];
        const { LearningEngine } =
            await import('../../src/services/telemetry/learning/LearningEngine');
        const summary = await new LearningEngine().runFullCycle();
        expect(summary.processed).toBe(3);
        // Historyczny wzorzec B zostaje (uczciwe ograniczenie bez proweniencji),
        // ale runFullCycle nie może go zaktualizować danymi B ani utworzyć
        // nowych wzorców z DN=2000.
        const oldB = store.kb.find((k) => k.id === 'kb-old-b')!;
        expect(oldB.hitCount).toBe(5);
        const fresh = store.kb.filter((k) => k.id !== 'kb-old-b');
        expect(fresh.length).toBeGreaterThan(0);
        expect(new Set(fresh.map((k) => k.dn))).toEqual(new Set(['1000']));
        expect(summary.patternsDetected).toBeGreaterThan(0);
        expect(summary.error).toBeUndefined();
    });
});
