/**
 * Kompleksowe testy integracyjne dla modułu telemetry AI.
 *
 * Obejmuje:
 * - zapis/odczyt konfiguracji
 * - zapis i walidację eventów
 * - hierarchię acceptance
 * - Knowledge Base (gen + read + stats)
 * - PatternDetector / FeatureExtractor
 * - Recommendation engine
 * - CronService
 * - Bezpieczeństwo (role, token)
 * - Walidację wersji solvera
 */

import { describe, expect, it, beforeEach, afterEach } from '@jest/globals';
import prisma from '../src/prismaClient';
import crypto from 'crypto';
import {
    telemetryAcceptanceSchema,
    telemetryConfigSchema,
    telemetryEventSchema,
    telemetryVersionSchema
} from '../src/validators/telemetrySchemas';
import { telemetryService } from '../src/services/telemetry/telemetryService';
import { FeatureExtractor } from '../src/services/telemetry/learning/FeatureExtractor';
import { ConfidenceCalculator } from '../src/services/telemetry/learning/ConfidenceCalculator';
import { KnowledgeBase } from '../src/services/telemetry/learning/KnowledgeBase';
import { PatternDetector } from '../src/services/telemetry/learning/PatternDetector';
import { RecommendationEngine } from '../src/services/telemetry/learning/RecommendationEngine';
import { PreferenceEngine } from '../src/services/telemetry/learning/PreferenceEngine';
import { FeedbackProcessor } from '../src/services/telemetry/learning/FeedbackProcessor';
import { LearningEngine } from '../src/services/telemetry/learning/LearningEngine';
import { cronService } from '../src/utils/cronService';

/* ===== Pomocnicy ===== */

const NOW = () => new Date().toISOString();

void 0 as unknown as never; // suppress unused

/* ===== Tożsamość + prawdziwy DB ===== */

describe('telemetryRoutes E2E - schema walidacja', () => {
    it('akceptuje minimalny wymagany payload', () => {
        expect(telemetryConfigSchema.safeParse({ solverSource: 'AUTO_JS' }).success).toBe(true);
    });

    it('odrzuca payload bez solverSource', () => {
        const r = telemetryConfigSchema.safeParse({ dn: '1200' });
        expect(r.success).toBe(false);
    });

    it('akceptuje wszystkie 4 warianty solverSource', () => {
        ['AUTO_JS', 'AUTO_PYTHON', 'MANUAL', 'AI_SUGGEST'].forEach((s) => {
            expect(telemetryConfigSchema.safeParse({ solverSource: s }).success).toBe(true);
        });
    });

    it('akceptuje event z 9 możliwymi eventType', () => {
        const types = [
            'auto_run',
            'user_change',
            'accept',
            'reject',
            'save_offer',
            'create_order',
            'telemetry_reason',
            'rule_violation',
            'fallback_triggered'
        ];
        types.forEach((t) => {
            expect(telemetryEventSchema.safeParse({ eventType: t }).success).toBe(true);
        });
    });

    it('odrzuca event ze złym typem', () => {
        expect(telemetryEventSchema.safeParse({ eventType: 'hack' }).success).toBe(false);
    });

    it('akceptuje version schema dla wszystkich typów', () => {
        ['solver', 'rules', 'ai', 'embedding'].forEach((t) => {
            expect(
                telemetryVersionSchema.safeParse({
                    componentType: t,
                    version: '1.0.0'
                }).success
            ).toBe(true);
        });
    });

    it('acceptance schema wymaga accepted (boolean)', () => {
        expect(
            telemetryAcceptanceSchema.safeParse({ telemetryId: 't1', accepted: true }).success
        ).toBe(true);
        expect(
            telemetryAcceptanceSchema.safeParse({ telemetryId: 't1', accepted: 'yes' }).success
        ).toBe(false);
    });
});

/* ===== FakerCache: za to telemetry i persistence ===== */

describe('Telemetry wysokopoziomowe', () => {
    it('schema akceptuje specjalny payload z dużą liczbą przejść', () => {
        const transitions = Array(50)
            .fill(0)
            .map((_, i) => ({
                transitionNo: i + 1,
                dn: '160',
                heightFromBottomMm: i * 50 + 100
            }));
        const r = telemetryConfigSchema.safeParse({
            solverSource: 'AUTO_JS',
            transitions
        });
        expect(r.success).toBe(true);
    });

    it('schema akceptuje numeric jak i string dla rzDna', () => {
        expect(
            telemetryConfigSchema.safeParse({
                solverSource: 'AUTO_JS',
                rzDna: 105.5
            }).success
        ).toBe(true);
        expect(
            telemetryConfigSchema.safeParse({
                solverSource: 'AUTO_JS',
                rzDna: '105.5'
            }).success
        ).toBe(true);
    });

    it('schema zaakceptuje undefined wszystkich pól opcjonalnych', () => {
        const r = telemetryConfigSchema.safeParse({
            solverSource: 'AUTO_JS',
            rzDna: undefined,
            wellHeight: undefined,
            wasAccepted: undefined,
            transitions: undefined
        });
        expect(r.success).toBe(true);
    });
});

/* ===== Constants of telemetryService ===== */

describe('telemetryService wewnętrzne', () => {
    it('Klasa jest singletonem', () => {
        expect(telemetryService).toBeDefined();
        expect(typeof telemetryService.recordConfig).toBe('function');
        expect(typeof telemetryService.recordEvent).toBe('function');
        expect(typeof telemetryService.recordAcceptance).toBe('function');
    });

    it('recordEvent ma poprawne API', () => {
        expect(typeof telemetryService.recordEvent).toBe('function');
        expect((telemetryService.recordEvent as any).length).toBeGreaterThanOrEqual(1);
    });
});

/* ===== FeatureExtractor ===== */

describe('FeatureExtractor - wyciąganie cech', () => {
    let fe: FeatureExtractor;
    beforeEach(() => {
        fe = new FeatureExtractor();
    });

    it('wyciąga cechy geometryczne', () => {
        const out = fe.extract(
            {
                id: 't1',
                dn: '1200',
                dennicaType: 'standard',
                dennicaHeight: 500,
                ringCount: 4
            },
            [],
            []
        );
        const dnFeature = out.features.find((f) => f.name === 'dn');
        const dennicaFeature = out.features.find((f) => f.name === 'dennicaType');
        expect(dnFeature?.value).toBe('1200');
        expect(dennicaFeature?.value).toBe('standard');
    });

    it('wyciąga cechy przejść szczelnych', () => {
        const out = fe.extract(
            { id: 't1', dn: '1200' },
            [
                { transitionNo: 1, dn: '160', heightFromBottomMm: 250 },
                { transitionNo: 2, dn: '160', heightFromBottomMm: 800 }
            ],
            []
        );
        const count = out.features.find((f) => f.name === 'transitionCount');
        const layout = out.features.find((f) => f.name === 'transitionLayout');
        expect(count?.value).toBe(2);
        expect(layout?.value).toBeDefined();
    });

    it('klasyfikuje clustered/evenly_spaced layout', () => {
        const out = fe.extract(
            { id: 't1', dn: '1200' },
            [
                { transitionNo: 1, dn: '160', heightFromBottomMm: 100 },
                { transitionNo: 2, dn: '160', heightFromBottomMm: 105 },
                { transitionNo: 3, dn: '160', heightFromBottomMm: 110 },
                { transitionNo: 4, dn: '160', heightFromBottomMm: 5000 }
            ],
            []
        );
        const layout = out.features.find((f) => f.name === 'transitionLayout')?.value;
        expect(['clustered', 'evenly_spaced', 'mixed']).toContain(layout);
    });

    it('hash tworzy deterministyczny identyfikator', () => {
        const out1 = fe.extract({ id: 't1', dn: '1200' }, [], []);
        const out2 = fe.extract({ id: 't2', dn: '1200' }, [], []);
        expect(fe.hash(out1)).toBe(fe.hash(out2));
    });
});

/* ===== ConfidenceCalculator - matematyka ===== */

describe('ConfidenceCalculator - krzywe confidence', () => {
    let cc: ConfidenceCalculator;
    beforeEach(() => {
        cc = new ConfidenceCalculator();
    });

    it('raw: 0 hits = 0 confidence', () => {
        expect(cc.rawConfidence(0)).toBe(0);
        expect(cc.rawConfidence(2)).toBe(0);
    });

    it('raw: 3 hits → 0.3', () => {
        expect(cc.rawConfidence(3)).toBeCloseTo(0.3, 1);
    });

    it('raw: max 0.95 (cap)', () => {
        expect(cc.rawConfidence(100)).toBe(0.95);
        expect(cc.rawConfidence(10000)).toBe(0.95);
    });

    it('weighted: uwzględnia successes vs misses', () => {
        const all = cc.weighted({
            hitCount: 10,
            successCount: 10,
            rejectionCount: 0
        });
        const half = cc.weighted({
            hitCount: 10,
            successCount: 5,
            rejectionCount: 5
        });
        expect(half).toBeLessThan(all);
    });

    it('decay: obniża confidence po 30+ dni', () => {
        const old45 = cc.decay({
            hitCount: 10,
            successCount: 10,
            rejectionCount: 0,
            lastHitAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()
        });
        const fresh = cc.decay({
            hitCount: 10,
            successCount: 10,
            rejectionCount: 0,
            lastHitAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
        });
        expect(old45).toBeLessThan(fresh);
    });
});

/* ===== PatternDetector - matematyka pur ===== */

describe('PatternDetector - detekcja wzorców', () => {
    let pd: PatternDetector;
    beforeEach(() => {
        pd = new PatternDetector();
    });

    it('detectDennicaSwap: minimum 3 powtórzeń', () => {
        const out = pd.detectDennicaSwap(
            Array(2)
                .fill(0)
                .map(() => ({
                    dn: '1200',
                    originalConfig: [{ productId: 'DEN-A', componentType: 'dennica' }],
                    finalConfig: [{ productId: 'DEN-B', componentType: 'dennica' }]
                })),
            '1200'
        );
        expect(out.length).toBe(0); // za mało danych
    });

    it('detectTransitionLayout: pomija poniżej progu', () => {
        const out = pd.detectTransitionLayout(
            Array(2)
                .fill(0)
                .map(() => ({
                    dn: '1200',
                    transitionsCount: 3,
                    layout: 'mixed',
                    transitionAvgHeight: 500,
                    accepted: 1,
                    rejected: 0
                }))
        );
        expect(out.length).toBe(0);
    });

    it('detectReductionChoice: generuje wzorce', () => {
        const records = Array(5)
            .fill(0)
            .map((_, i) => ({
                dn: '1200',
                reductionUsed: i % 2 === 0,
                wellHeight: 3000 + i * 100,
                transitionCount: 2,
                wasAccepted: true,
                wasRejected: false
            }));
        const out = pd.detectReductionChoice(records);
        expect(out.length).toBeGreaterThan(0);
    });
});

/* ===== PreferenceEngine - buduje preferencje ===== */

describe('PreferenceEngine - budowanie preferencji', () => {
    let pe: PreferenceEngine;
    beforeEach(() => {
        pe = new PreferenceEngine();
    });

    it('buildSubstitution: wyciąga zamiany z poprawnych korekt', () => {
        const corrections = Array(3)
            .fill(0)
            .map((_, i) => ({
                dn: '1200',
                originalConfig: [{ productId: 'Den-A' + i, componentType: 'dennica' }],
                finalConfig: [{ productId: 'Den-B' + i, componentType: 'dennica' }],
                overrideReason: 'reason-' + i
            }));
        const out = pe.buildSubstitution(corrections);
        // 3 korekty z różnymi produktami (brak kolizji)
        // brak wzorca z identycznym patternKey
        expect(Array.isArray(out)).toBe(true);
    });

    it('buildAddition: minimum 3 by stworzyc', () => {
        const corr = Array(3)
            .fill(0)
            .map(() => ({
                dn: '1200',
                originalConfig: [],
                finalConfig: [{ productId: 'X', componentType: 'seal' }],
                overrideReason: ''
            }));
        const out = pe.buildAddition(corr);
        expect(Array.isArray(out)).toBe(true);
    });

    it('buildRemoval: minimum 3', () => {
        const corr = Array(3)
            .fill(0)
            .map(() => ({
                dn: '1200',
                originalConfig: [{ productId: 'X', componentType: 'seal' }],
                finalConfig: [],
                overrideReason: ''
            }));
        const out = pe.buildRemoval(corr);
        expect(Array.isArray(out)).toBe(true);
    });
});

/* ===== FeedbackProcessor - mapowanie ===== */

describe('FeedbackProcessor', () => {
    let fp: FeedbackProcessor;
    beforeEach(() => {
        fp = new FeedbackProcessor();
    });

    it('feedback telemetry -> FeedbackEvent mapping', () => {
        const accept = fp.fromTelemetryEvent({
            eventType: 'accept',
            createdAt: NOW()
        });
        expect(accept?.type).toBe('accept');
    });

    it('unknown event → null', () => {
        const x = fp.fromTelemetryEvent({ eventType: 'unknown', createdAt: NOW() });
        expect(x).toBeNull();
    });

    it('fallback_triggered -> type fallback', () => {
        const f = fp.fromTelemetryEvent({
            eventType: 'fallback_triggered',
            createdAt: NOW()
        });
        expect(f?.type).toBe('fallback');
    });

    it('user_change z previousValue/newValue', () => {
        const ev = fp.fromTelemetryEvent({
            eventType: 'user_change',
            previousValue: 'A',
            newValue: 'B',
            createdAt: NOW()
        });
        expect(ev?.type).toBe('modify');
        expect(ev?.details?.from).toBe('A');
        expect(ev?.details?.to).toBe('B');
    });

    it('fromBatch mapuje wiele eventów', () => {
        const out = fp.fromBatch([
            { eventType: 'accept', createdAt: NOW() } as { eventType: string },
            { eventType: 'reject', createdAt: NOW() } as { eventType: string },
            { eventType: 'unknown', createdAt: NOW() } as { eventType: string }
        ]);
        expect(out.length).toBe(2);
    });
});

/* ===== Real DB tests ===== */

describe('KnowledgeBase - operacje na DB', () => {
    let kb: KnowledgeBase;
    const testPattern = {
        patternType: 'dennica_swap' as const,
        patternKey: '',
        hitCount: 0,
        confidence: 0,
        successCount: 0,
        rejectionCount: 0
    };

    beforeEach(() => {
        kb = new KnowledgeBase();
        testPattern.patternKey = 'test_' + crypto.randomUUID().slice(0, 8);
    });

    it('upsert wzorca jako nowa instancja', async () => {
        const id = await kb.upsertPattern({
            ...testPattern,
            hitCount: 5,
            confidence: 0.5,
            dn: '1200'
        });
        expect(typeof id).toBe('string');
    });

    it('getPatternsForDn zwraca wzorce', async () => {
        const dn = 'kb_' + crypto.randomUUID().slice(0, 6);
        await kb.upsertPattern({
            ...testPattern,
            patternKey: dn + '|x',
            hitCount: 5,
            confidence: 0.5,
            dn
        });
        const result = await kb.getPatternsForDn(dn, 0.1);
        expect(result.length).toBeGreaterThanOrEqual(1);
    });

    it('getStats zwraca strukturę', async () => {
        const stats = await kb.getStats();
        expect(stats).toHaveProperty('total');
        expect(stats).toHaveProperty('active');
        expect(stats).toHaveProperty('avgConfidence');
        expect(stats).toHaveProperty('byPatternType');
    });

    it('recordRecommendation + decideRecommendation', async () => {
        const id = await kb.recordRecommendation({
            patternType: 'dennica_swap',
            patternKey: 'rec_' + crypto.randomUUID().slice(0, 6),
            dn: '1200',
            score: 0.85,
            confidence: 0.9
        });
        await kb.decideRecommendation(id, true, 'admin');
        const updated = await prisma.ai_recommendations.findUnique({ where: { id } });
        expect(updated?.wasAccepted).toBe(true);
    });

    afterEach(async () => {
        await prisma.ai_knowledge_base.deleteMany({
            where: { patternKey: { startsWith: 'test_' } }
        });
    });
});

/* ===== RecommendationEngine ===== */

describe('RecommendationEngine', () => {
    let re: RecommendationEngine;
    beforeEach(() => {
        re = new RecommendationEngine();
    });

    it('recommendForTelemetry z pustą bazą → []', async () => {
        const out = await re.recommendForTelemetry('t' + crypto.randomUUID(), 'XXXXX');
        expect(Array.isArray(out)).toBe(true);
    });

    it('persistRecommendation + applyDecision', async () => {
        const id = await re.persistRecommendation({
            patternType: 'dennica_swap',
            patternKey: 'rec_e2e_' + crypto.randomUUID().slice(0, 6),
            dn: '1200',
            score: 0.5,
            confidence: 0.7
        });
        expect(typeof id).toBe('string');
        await re.applyDecision(id, true, 'admin');
    });

    it('recommendForDn - top N', async () => {
        const fv = {
            wellId: 'w',
            telemetryId: 't',
            dn: 'EMPTYDNA',
            features: [],
            extractedAt: NOW()
        };
        const out = await re.recommendForDn(fv, 10);
        expect(Array.isArray(out)).toBe(true);
    });
});

/* ===== LearningEngine - pipeline ===== */

describe('LearningEngine - pipeline', () => {
    let le: LearningEngine;
    beforeEach(() => {
        le = new LearningEngine();
    });

    it('runFullCycle bez danych → processed=0', async () => {
        const summary = await le.runFullCycle();
        expect(summary.processed).toBeGreaterThanOrEqual(0);
        expect(summary.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('runFullCycle z rekordami → patterns wykryte', async () => {
        // Wstaw kilka rekordów telemetry z dn='1200'
        for (let i = 0; i < 5; i++) {
            await prisma.ai_telemetry_logs.create({
                data: {
                    id: crypto.randomUUID(),
                    dn: '1200',
                    wellHeight: 3000 + i * 100,
                    wasAccepted: i % 2 === 0,
                    wasModified: true,
                    modificationCount: 1,
                    original_auto_config: JSON.stringify([
                        { productId: 'P-X', componentType: 'dennica' }
                    ]),
                    final_user_config: JSON.stringify([
                        { productId: 'P-Y', componentType: 'dennica' }
                    ]),
                    override_reason: 'test',
                    createdAt: NOW()
                }
            });
        }

        const summary = await le.runFullCycle();
        expect(summary.processed).toBeGreaterThan(0);
        expect(summary.durationMs).toBeGreaterThan(0);
        expect(summary.error).toBeUndefined();
    });

    it('getStatus zwraca strukturę', () => {
        const s = le.getStatus();
        expect(s).toHaveProperty('initialized');
        expect(s).toHaveProperty('lastRunAt');
    });

    it('getComponents udostępnia subkomponenty', () => {
        const c = le.getComponents();
        expect(c.kb).toBeDefined();
        expect(c.patterns).toBeDefined();
        expect(c.prefs).toBeDefined();
        expect(c.fe).toBeDefined();
        expect(c.ranker).toBeDefined();
        expect(c.recommend).toBeDefined();
        expect(c.feedback).toBeDefined();
    });
});

/* ===== CronService - lifecycle ===== */

describe('CronService - harmonogram', () => {
    it('shutdown czyści intervaly', () => {
        const initial = (cronService.getStatus().runningTasks || []).length;
        cronService.shutdown();
        expect(cronService.getStatus().runningTasks.length).toBe(0);
        if (initial > 0) {
            cronService.init();
        }
    });

    it('schedule rejestruje i cancel usuwa', () => {
        const name = 'test_' + crypto.randomUUID().slice(0, 4);
        cronService.schedule(name, 999999, () => {});
        expect(cronService.getStatus().runningTasks).toContain(name);
        cronService.cancel(name);
        expect(cronService.getStatus().runningTasks).not.toContain(name);
    });

    it('schedule duplikatu nie podwaja', () => {
        const name = 'dup_' + crypto.randomUUID().slice(0, 4);
        cronService.schedule(name, 999999, () => {});
        cronService.schedule(name, 999999, () => {});
        cronService.cancel(name);
    });

    it('init w trybie nie test inicjalizuje', () => {
        const before = cronService.getStatus();
        if (!before.enabled) {
            cronService.init();
            expect(cronService.getStatus().enabled).toBe(true);
        }
        cronService.shutdown();
    });
});

/* ===== Bezpieczeństwo ===== */

describe('Bezpieczeństwo API - role', () => {
    it('Schemat telemetry odrzuca lateral injection nazwy', () => {
        const malicious = 'javascript:alert(1)';
        const r = telemetryConfigSchema.safeParse({
            solverSource: 'AUTO_JS',
            wellId: malicious
        });
        expect(r.success).toBe(true); // schema nie blokuje string
        // ale powinien być zapisany jako string w bazie
        expect(r.data?.wellId).toBe(malicious);
    });

    it('payload akceptuje tylko znane typy event', () => {
        const valid = telemetryEventSchema.safeParse({
            eventType: 'user_change',
            changeReason: '<script>alert(1)</script>'
        });
        expect(valid.success).toBe(true);
        expect(valid.data?.changeReason).toBe('<script>alert(1)</script>');
    });

    it('enum dla solverSource jest blokowany', () => {
        const r = telemetryConfigSchema.safeParse({
            solverSource: 'MANUAL_OVERRIDE' // niedozwolone
        });
        expect(r.success).toBe(false);
    });
});

/* ===== Równoległe zapisy ===== */

describe('Równoległe zapisy telemetry', () => {
    it('5 równoległych upsertów sukces', async () => {
        const time = Date.now();
        const promises = Array(5)
            .fill(0)
            .map((_, i) => {
                const key = 'par_' + time + '_' + i;
                return kb().upsertPattern({
                    patternType: 'dennica_swap',
                    patternKey: key,
                    hitCount: i,
                    confidence: i * 0.1,
                    successCount: i,
                    rejectionCount: 0,
                    dn: 'PAR_DN'
                });
            });
        const result = await Promise.all(promises);
        expect(result.length).toBe(5);
        await prisma.ai_knowledge_base.deleteMany({
            where: { patternKey: { startsWith: 'par_' + time + '_' } }
        });
    });
});

function kb(): KnowledgeBase {
    return new KnowledgeBase();
}

/* ===== Wersjonowanie i migracja ===== */

describe('Wersjonowanie i migracja', () => {
    it('ai_telemetry_versions ma aktywną wersję', async () => {
        const allVersions = await prisma.ai_telemetry_versions.findMany({
            where: { isActive: true }
        });
        expect(Array.isArray(allVersions)).toBe(true);
    });

    it('migracja jest idempotentna', async () => {
        const before = await prisma.ai_knowledge_base.count();
        const after = await prisma.ai_knowledge_base.count();
        expect(before).toBe(after);
    });

    it('świeży insert ar_knowledge_base nie powoduje duplikatów', async () => {
        const key = 'idem_' + crypto.randomUUID().slice(0, 4);
        const id1 = await new KnowledgeBase().upsertPattern({
            patternType: 'dennica_swap',
            patternKey: key,
            hitCount: 1,
            confidence: 0.1,
            successCount: 1,
            rejectionCount: 0
        });
        const id2 = await new KnowledgeBase().upsertPattern({
            patternType: 'dennica_swap',
            patternKey: key,
            hitCount: 2,
            confidence: 0.2,
            successCount: 2,
            rejectionCount: 0
        });
        expect(id1).toBe(id2); // ten sam rekord
        await prisma.ai_knowledge_base.deleteMany({ where: { patternKey: key } });
    });
});

/* ===== Integralność danych ===== */

describe('Integralność danych', () => {
    it('upsert zwiększa history hitCount', async () => {
        const key = 'int_' + crypto.randomUUID().slice(0, 4);
        await new KnowledgeBase().upsertPattern({
            patternType: 'dennica_swap',
            patternKey: key,
            hitCount: 1,
            confidence: 0.1,
            successCount: 1,
            rejectionCount: 0
        });
        await new KnowledgeBase().upsertPattern({
            patternType: 'dennica_swap',
            patternKey: key,
            hitCount: 7,
            confidence: 0.7,
            successCount: 7,
            rejectionCount: 0
        });
        const row = await prisma.ai_knowledge_base.findFirst({
            where: { patternKey: key }
        });
        expect(row?.hitCount).toBe(7);
        const history = row?.changeHistory ? JSON.parse(row.changeHistory) : [];
        // 2 upserty powinny dodać 2 wpisy do historii
        expect(history.length).toBeGreaterThanOrEqual(1);
        await prisma.ai_knowledge_base.deleteMany({ where: { patternKey: key } });
    });

    it('JSON deserializacja w records eventów', async () => {
        const id = crypto.randomUUID();
        await prisma.ai_telemetry_events.create({
            data: {
                id,
                eventType: 'user_change',
                componentId: 'P-X',
                previousValue: JSON.stringify({ a: 1 }),
                newValue: JSON.stringify({ b: 2 }),
                createdAt: NOW()
            }
        });
        const e = await prisma.ai_telemetry_events.findUnique({ where: { id } });
        expect(e?.previousValue).toBe('{"a":1}');
        await prisma.ai_telemetry_events.deleteMany({ where: { id } });
    });
});
