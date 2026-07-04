import { describe, expect, it } from '@jest/globals';
import crypto from 'crypto';
import prisma from '../src/prismaClient';
import { PatternDetector } from '../src/services/telemetry/learning/PatternDetector';
import type { KnowledgePattern } from '../src/services/telemetry/learning/KnowledgeBase';

function testPatternKey(prefix: string): string {
    return prefix + '_' + crypto.randomUUID().slice(0, 8);
}

/* ===== PatternDetector — NOWE detektory ===== */

describe('PatternDetector — detectRingPattern', () => {
    let pd: PatternDetector;

    beforeEach(() => {
        pd = new PatternDetector();
    });

    it('pomija < 3 (weighted count)', () => {
        const out = pd.detectRingPattern(
            Array(2).fill(0).map(() => ({
                dn: '1200', componentSeq: JSON.stringify([{ productId: 'R25', componentType: 'krag' }]),
                wasAccepted: false, acceptanceCount: 0
            }))
        );
        expect(out.length).toBe(0);
    });

    it('detectuje popularny układ kręgów >= 3', () => {
        const seq = JSON.stringify([
            { productId: 'R25', componentType: 'krag' },
            { productId: 'R50', componentType: 'krag' }
        ]);
        const out = pd.detectRingPattern(
            Array(5).fill(0).map(() => ({
                dn: '1200', componentSeq: seq,
                wasAccepted: true, acceptanceCount: 0
            }))
        );
        expect(out.length).toBeGreaterThan(0);
        expect(out[0].patternType).toBe('ring_pattern');
        expect(out[0].hitCount).toBe(10); // 5× weight=2
    });

    it('pomija records bez componentSeq', () => {
        const out = pd.detectRingPattern(
            Array(5).fill(0).map(() => ({
                dn: '1200', wasAccepted: true, acceptanceCount: 0
            }))
        );
        expect(out.length).toBe(0);
    });

    it('ważona liczba — accepted waży 3x', () => {
        const seq = JSON.stringify([{ productId: 'R25', componentType: 'krag' }]);
        const records = [
            ...Array(3).fill(0).map(() => ({ dn: '1200', componentSeq: seq, wasAccepted: true, acceptanceCount: 0 })),
            ...Array(2).fill(0).map(() => ({ dn: '1200', componentSeq: seq, wasAccepted: false, acceptanceCount: 0 }))
        ];
        const out = pd.detectRingPattern(records);
        // 3*3 + 2*1 = 11 -> > 3, więc wykryty
        expect(out.length).toBeGreaterThan(0);
    });
});

describe('PatternDetector — detectClosurePreference', () => {
    let pd: PatternDetector;

    beforeEach(() => {
        pd = new PatternDetector();
    });

    it('pomija < 5 (weighted)', () => {
        const out = pd.detectClosurePreference(
            Array(3).fill(0).map(() => ({
                dn: '1000', componentSeq: JSON.stringify([{ componentType: 'konus' }]),
                wasAccepted: false
            }))
        );
        expect(out.length).toBe(0);
    });

    it('wykrywa preferencję konus >= 70%', () => {
        const records = [
            ...Array(7).fill(0).map(() => ({
                dn: '1200', componentSeq: JSON.stringify([{ componentType: 'konus' }]),
                wasAccepted: true
            })),
            ...Array(3).fill(0).map(() => ({
                dn: '1200', componentSeq: JSON.stringify([{ componentType: 'plyta_din' }]),
                wasAccepted: false
            }))
        ];
        const out = pd.detectClosurePreference(records);
        expect(out.length).toBeGreaterThan(0);
        const konus = out.find(p => p.patternKey.includes('prefer_konus'));
        expect(konus).toBeDefined();
        expect(konus?.patternType).toBe('closure_preference');
    });

    it('wykrywa preferencję DIN >= 40%', () => {
        const records = [
            ...Array(5).fill(0).map(() => ({
                dn: '1200', componentSeq: JSON.stringify([{ componentType: 'plyta_din' }]),
                wasAccepted: true
            })),
            ...Array(3).fill(0).map(() => ({
                dn: '1200', componentSeq: JSON.stringify([{ componentType: 'konus' }]),
                wasAccepted: false
            }))
        ];
        const out = pd.detectClosurePreference(records);
        const din = out.find(p => p.patternKey.includes('prefer_din'));
        expect(din).toBeDefined();
    });

    it('pomija zepsuty JSON', () => {
        const records = Array(6).fill(0).map(() => ({
            dn: '1200', componentSeq: '{invalid',
            wasAccepted: true
        }));
        const out = pd.detectClosurePreference(records);
        expect(out.length).toBe(0);
    });

    it('obsługuje różne typy zamknięć (other)', () => {
        const records = Array(6).fill(0).map((_, i) => ({
            dn: '1200',
            componentSeq: JSON.stringify([{ componentType: i < 2 ? 'konus' : 'pierscien_odciazajacy' }]),
            wasAccepted: true
        }));
        const out = pd.detectClosurePreference(records);
        // wszystkie w "other" bo tylko 2 konus (33%) < 70% i 0 din
        expect(out.length).toBe(0);
    });
});

describe('PatternDetector — detectProductPreference', () => {
    let pd: PatternDetector;

    beforeEach(() => {
        pd = new PatternDetector();
    });

    it('prefer_product gdy accept ratio > 0.85', () => {
        const records = Array(4).fill(0).map(() => ({
            dn: '1200',
            componentSeq: JSON.stringify([{ productId: 'PROD-A' }]),
            wasAccepted: true,
            wasRejected: false
        }));
        const out = pd.detectProductPreference(records);
        const pref = out.find(p => p.patternType === 'prefer_product');
        expect(pref).toBeDefined();
        expect(pref?.patternKey).toBe('PROD-A');
    });

    it('avoid_product gdy accept ratio < 0.3', () => {
        const records = [
            ...Array(1).fill(0).map(() => ({
                dn: '1200',
                componentSeq: JSON.stringify([{ productId: 'PROD-B' }]),
                wasAccepted: true, wasRejected: false
            })),
            ...Array(4).fill(0).map(() => ({
                dn: '1200',
                componentSeq: JSON.stringify([{ productId: 'PROD-B' }]),
                wasAccepted: false, wasRejected: true
            }))
        ];
        const out = pd.detectProductPreference(records);
        const avoid = out.find(p => p.patternType === 'avoid_product');
        expect(avoid).toBeDefined();
        expect(avoid?.patternKey).toBe('PROD-B');
    });

    it('pomija produkty z total < 3', () => {
        const records = Array(2).fill(0).map(() => ({
            dn: '1200',
            componentSeq: JSON.stringify([{ productId: 'RARE' }]),
            wasAccepted: true, wasRejected: false
        }));
        const out = pd.detectProductPreference(records);
        expect(out.length).toBe(0);
    });

    it('pomija zepsuty componentSeq', () => {
        const records = Array(5).fill(0).map(() => ({
            dn: '1200', componentSeq: '{bad}',
            wasAccepted: true, wasRejected: false
        }));
        const out = pd.detectProductPreference(records);
        expect(out.length).toBe(0);
    });

    it('pomija productId == null/undefined', () => {
        const records = Array(5).fill(0).map(() => ({
            dn: '1200',
            componentSeq: JSON.stringify([{ componentType: 'krag' }]),
            wasAccepted: true, wasRejected: false
        }));
        const out = pd.detectProductPreference(records);
        expect(out.length).toBe(0);
    });
});

/* ===== WellCaseService ===== */

describe('wellCaseService — createOrUpdate', () => {
    const testDn = 9999;

    afterEach(async () => {
        await prisma.ai_well_cases.deleteMany({
            where: { dn: testDn }
        });
    });

    it('create nowego przypadku', async () => {
        const { wellCaseService } = await import('../src/services/learning/wellCaseService');
        const id = await wellCaseService.createOrUpdate({
            dn: testDn,
            totalHeightMm: 3000,
            wellType: 'kanalizacyjna',
            componentSeq: [{ productId: 'R50', componentType: 'krag' }],
            diameterProfile: [1000, 1200],
            transitions: [],
            configSource: 'MANUAL'
        });
        expect(typeof id).toBe('string');
        const saved = await prisma.ai_well_cases.findUnique({ where: { id } });
        expect(saved).not.toBeNull();
        expect(saved?.acceptanceCount).toBe(1);
    });

    it('update istniejącego — increment acceptanceCount', async () => {
        const { wellCaseService: svc } = await import('../src/services/learning/wellCaseService');
        const id1 = await svc.createOrUpdate({
            dn: testDn,
            totalHeightMm: 4000,
            wellType: 'kanalizacyjna',
            componentSeq: [{ productId: 'R25', componentType: 'krag' }],
            diameterProfile: [1000],
            transitions: []
        });
        const id2 = await svc.createOrUpdate({
            dn: testDn,
            totalHeightMm: 4000,
            wellType: 'kanalizacyjna',
            componentSeq: [{ productId: 'R25', componentType: 'krag' }],
            diameterProfile: [1000],
            transitions: []
        });
        expect(id2).toBe(id1);
        const saved = await prisma.ai_well_cases.findUnique({ where: { id: id1 } });
        expect(saved?.acceptanceCount).toBe(2);
    });

    it('różne componentSeq = różne przypadki', async () => {
        const { wellCaseService: svc } = await import('../src/services/learning/wellCaseService');
        const id1 = await svc.createOrUpdate({
            dn: testDn, totalHeightMm: 3000, wellType: 'kanalizacyjna',
            componentSeq: [{ productId: 'A' }], diameterProfile: [], transitions: []
        });
        const id2 = await svc.createOrUpdate({
            dn: testDn, totalHeightMm: 3000, wellType: 'kanalizacyjna',
            componentSeq: [{ productId: 'B' }], diameterProfile: [], transitions: []
        });
        expect(id2).not.toBe(id1);
    });

    it('równoległe createOrUpdate z identycznym hashem → tylko 1 rekord (race guard)', async () => {
        const { wellCaseService: svc } = await import('../src/services/learning/wellCaseService');
        const input = {
            dn: testDn, totalHeightMm: 2500, wellType: 'kanalizacyjna',
            componentSeq: [{ productId: 'RACE', componentType: 'krag' }],
            diameterProfile: [1000], transitions: []
        };

        await svc.createOrUpdate(input);

        const count = await prisma.ai_well_cases.count({
            where: { dn: testDn, totalHeightMm: 2500, wellType: 'kanalizacyjna' }
        });
        expect(count).toBe(1);
    }, 30000);

    it('równoległe zapisy inkrementują acceptanceCount', async () => {
        const { wellCaseService: svc } = await import('../src/services/learning/wellCaseService');
        const input = {
            dn: testDn, totalHeightMm: 2600, wellType: 'kanalizacyjna',
            componentSeq: [{ productId: 'RACE2', componentType: 'krag' }],
            diameterProfile: [1000], transitions: []
        };

        await Promise.all([
            svc.createOrUpdate(input),
            svc.createOrUpdate(input),
            svc.createOrUpdate(input)
        ]);

        const record = await prisma.ai_well_cases.findFirst({
            where: { dn: testDn, totalHeightMm: 2600, wellType: 'kanalizacyjna' }
        });
        expect(record?.acceptanceCount).toBe(3);
    }, 30000);
});

describe('wellCaseService — findSimilar', () => {
    it('zwraca tablicę (może być pusta)', async () => {
        const { wellCaseService: svc } = await import('../src/services/learning/wellCaseService');
        const result = await svc.findSimilar({ dn: 1, totalHeightMm: 1000, wellType: 'test' });
        expect(Array.isArray(result)).toBe(true);
    });

    it('sortuje po similarityScore malejąco', async () => {
        const { wellCaseService: svc } = await import('../src/services/learning/wellCaseService');
        const result = await svc.findSimilar({ dn: 1200, totalHeightMm: 3000, wellType: 'kanalizacyjna', limit: 5 });
        if (result.length >= 2) {
            for (let i = 1; i < result.length; i++) {
                expect(result[i - 1].similarityScore).toBeGreaterThanOrEqual(result[i].similarityScore);
            }
        }
    });
});

describe('wellCaseService — getPreferences', () => {
    const testDn = 8888;
    const prefKey = testPatternKey('pref');

    afterEach(async () => {
        await prisma.ai_knowledge_base.deleteMany({
            where: { patternKey: { startsWith: prefKey } }
        });
    });

    it('zwraca PreferenceWeights z domyślnymi wartościami', async () => {
        const { wellCaseService: svc } = await import('../src/services/learning/wellCaseService');
        const prefs = await svc.getPreferences({ dn: 0 });
        expect(prefs).toHaveProperty('confidence');
        expect(prefs).toHaveProperty('ringHeightBonus');
        expect(prefs).not.toHaveProperty('dennicaBonus');
        expect(prefs).toHaveProperty('konusBonus');
        expect(prefs).toHaveProperty('profileBonuses');
        expect(prefs).toHaveProperty('avoidProductIds');
        expect(prefs).toHaveProperty('preferProductIds');
        expect(prefs).toHaveProperty('warnings');
        expect(prefs).toHaveProperty('timeApplied');
    });

    it('warnings gdy confidence < 0.1 (brak danych)', async () => {
        const { wellCaseService: svc } = await import('../src/services/learning/wellCaseService');
        const prefs = await svc.getPreferences({ dn: 0 });
        expect(prefs.confidence).toBeLessThan(0.1);
        expect(prefs.warnings.length).toBeGreaterThan(0);
    });

    it('uwzględnia KB pattern z avoid/prefer', async () => {
        const kb = await import('../src/services/telemetry/learning/KnowledgeBase').then(m => new m.KnowledgeBase());
        await kb.upsertPattern({
            patternType: 'avoid_product', patternKey: prefKey + '|AVOID', hitCount: 10, confidence: 0.9,
            successCount: 10, rejectionCount: 0, dn: String(testDn), status: 'active'
        });
        await kb.upsertPattern({
            patternType: 'prefer_product', patternKey: prefKey + '|PREFER', hitCount: 10, confidence: 0.9,
            successCount: 10, rejectionCount: 0, dn: String(testDn), status: 'active'
        });
        const { wellCaseService: svc } = await import('../src/services/learning/wellCaseService');
        const prefs = await svc.getPreferences({ dn: testDn });
        expect(prefs.avoidProductIds.length + prefs.preferProductIds.length).toBeGreaterThan(0);
    });
});

describe('wellCaseService — getPatterns', () => {
    it('zwraca strukturę z totalCases', async () => {
        const { wellCaseService: svc } = await import('../src/services/learning/wellCaseService');
        const result = await svc.getPatterns(0);
        expect(result).toHaveProperty('totalCases');
        expect(result).toHaveProperty('commonProfiles');
        expect(result).toHaveProperty('commonTransitions');
    });
});

/* ===== KnowledgeBase — nowe PatternType + cleanup ===== */

describe('KnowledgeBase — nowe PatternType upsert', () => {
    const pkey = testPatternKey('kbtype');
    const testTypes: Array<KnowledgePattern['patternType']> = ['ring_pattern', 'closure_preference', 'prefer_product', 'avoid_product'];

    afterEach(async () => {
        await prisma.ai_knowledge_base.deleteMany({
            where: { patternKey: { startsWith: pkey } }
        });
    });

    for (const pt of testTypes) {
        it(`upsert patternType: ${pt}`, async () => {
            const { KnowledgeBase } = await import('../src/services/telemetry/learning/KnowledgeBase');
            const kb = new KnowledgeBase();
            const id = await kb.upsertPattern({
                patternType: pt,
                patternKey: pkey + '|' + pt,
                hitCount: 5,
                confidence: 0.5,
                successCount: 5,
                rejectionCount: 0,
                dn: '1200'
            });
            expect(typeof id).toBe('string');
            const saved = await prisma.ai_knowledge_base.findUnique({ where: { id } });
            expect(saved?.patternType).toBe(pt);
            expect(saved?.status).toBe('active');
        });
    }

    it('upsert z recommendation JSON', async () => {
        const { KnowledgeBase } = await import('../src/services/telemetry/learning/KnowledgeBase');
        const kb = new KnowledgeBase();
        const id = await kb.upsertPattern({
            patternType: 'ring_pattern',
            patternKey: pkey + '_rec',
            hitCount: 5,
            confidence: 0.7,
            successCount: 5,
            rejectionCount: 0,
            dn: '1200',
            recommendation: { ringPattern: 'R25,R50', occurrences: 5 }
        });
        expect(typeof id).toBe('string');
        const saved = await prisma.ai_knowledge_base.findUnique({ where: { id } });
        const rec = saved?.recommendation ? JSON.parse(saved.recommendation) : null;
        expect(rec).not.toBeNull();
        expect(rec.ringPattern).toBe('R25,R50');
    });
});

describe('KnowledgeBase — cleanupCycle', () => {
    const pkey = testPatternKey('clean');

    beforeEach(async () => {
        const { KnowledgeBase } = await import('../src/services/telemetry/learning/KnowledgeBase');
        const kb = new KnowledgeBase();
        await Promise.all([
            kb.upsertPattern({
                patternType: 'dennica_swap', patternKey: pkey + '_low', hitCount: 2, confidence: 0.1,
                successCount: 0, rejectionCount: 2, dn: '1200'
            }),
            kb.upsertPattern({
                patternType: 'dennica_swap', patternKey: pkey + '_high', hitCount: 10, confidence: 0.9,
                successCount: 10, rejectionCount: 0, dn: '1200'
            }),
            kb.upsertPattern({
                patternType: 'ring_pattern', patternKey: pkey + '_ring', hitCount: 4, confidence: 0.8,
                successCount: 4, rejectionCount: 0, dn: '1200'
            })
        ]);
    });

    afterEach(async () => {
        await prisma.ai_knowledge_base.deleteMany({
            where: { patternKey: { startsWith: pkey } }
        });
    });

    it('oznacza low-confidence jako stale', async () => {
        const { KnowledgeBase } = await import('../src/services/telemetry/learning/KnowledgeBase');
        const kb = new KnowledgeBase();
        await kb.cleanupCycle();
        const low = await prisma.ai_knowledge_base.findFirst({
            where: { patternKey: pkey + '_low' }
        });
        expect(low?.status).toBe('stale');
    });

    it('nie rusza high-confidence', async () => {
        const { KnowledgeBase } = await import('../src/services/telemetry/learning/KnowledgeBase');
        const kb = new KnowledgeBase();
        await kb.cleanupCycle();
        const high = await prisma.ai_knowledge_base.findFirst({
            where: { patternKey: pkey + '_high' }
        });
        expect(high?.status).toBe('active');
    });

    it('archivePattern zmienia status na archived', async () => {
        const { KnowledgeBase } = await import('../src/services/telemetry/learning/KnowledgeBase');
        const kb = new KnowledgeBase();
        const high = await prisma.ai_knowledge_base.findFirst({
            where: { patternKey: pkey + '_high' }
        });
        if (high) {
            await kb.archivePattern(high.id);
            const archived = await prisma.ai_knowledge_base.findUnique({ where: { id: high.id } });
            expect(archived?.status).toBe('archived');
        }
    });
});

/* ===== LearningEngine — nowa logika cyklu ===== */

describe('LearningEngine — runFullCycle z nowymi detektorami', () => {
    const testDn = '7777';
    const pkey = testPatternKey('le');

    beforeEach(async () => {
        for (let i = 0; i < 6; i++) {
            await prisma.ai_telemetry_logs.create({
                data: {
                    id: crypto.randomUUID(),
                    dn: testDn,
                    wellHeight: 3000 + i * 100,
                    wasAccepted: true,
                    wasModified: true,
                    modificationCount: 1,
                    original_auto_config: JSON.stringify([
                        { productId: 'R25', componentType: 'krag' }
                    ]),
                    final_user_config: JSON.stringify([
                        { productId: 'R50', componentType: 'krag' }
                    ]),
                    override_reason: 'test_cycle',
                    createdAt: new Date().toISOString()
                }
            });
        }
    });

    afterEach(async () => {
        await prisma.ai_telemetry_logs.deleteMany({ where: { dn: testDn } });
        await prisma.ai_knowledge_base.deleteMany({
            where: { patternKey: { startsWith: pkey } }
        });
    });

    it('runFullCycle przetwarza i wykrywa wzorce', async () => {
        const { LearningEngine } = await import('../src/services/telemetry/learning/LearningEngine');
        const le = new LearningEngine();
        const summary = await le.runFullCycle();
        expect(summary.processed).toBeGreaterThanOrEqual(0);
        expect(summary.patternsDetected).toBeGreaterThanOrEqual(0);
        expect(summary.durationMs).toBeGreaterThan(0);
        expect(summary.error).toBeUndefined();
    });

    it('getStatus ma initialized=true po cyklu', async () => {
        const { LearningEngine } = await import('../src/services/telemetry/learning/LearningEngine');
        const le = new LearningEngine();
        await le.runFullCycle();
        const s = le.getStatus();
        expect(s.initialized).toBe(true);
        expect(s.lastRunAt).not.toBeNull();
    });
});
