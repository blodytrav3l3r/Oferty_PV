import { Router, type Request, type Response } from 'express';
import { modelRegistry } from '../services/ml/ModelRegistry';
import { trainingPipeline } from '../services/ml/TrainingPipeline';
import { selfEvaluation } from '../services/ml/SelfEvaluation';
import { rewardCalculator } from '../services/ml/RewardCalculator';
import { featureExtractor } from '../services/ml/FeatureExtractor';
import { recommendationEngine } from '../services/telemetry/learning';
import { AcceptanceModel } from '../services/ml/AcceptanceModel';
import { ML_CONFIG } from '../services/ml/trainingConfig';
import { logger } from '../utils/logger';
import { READ_LIMITER, WRITE_LIMITER } from '../middleware/rateLimiters';
import { requireAuth, requireAdmin, AuthenticatedRequest } from '../middleware/auth';
import { logAudit } from '../services/auditService';
import { z } from 'zod';
import prisma from '../prismaClient';
import { FEATURE_NAMES, ML_CONSTANTS } from '../config/mlConstants';
import {
    cacheKey,
    setCache,
    getCached,
    clearPredictionCache,
    predictionCacheSize,
    setWellScore,
    getWellScore
} from '../services/ml/predictionCache';

const router = Router();

/**
 * #2 audyt MLOps: generyczny komunikat 500, pełny szczegół błędu tylko w logu —
 * nie wycieka wewnętrzny błąd Prisma/DB do klienta (baza błędów, escape privacy).
 */
function sendInternalError(res: Response, scope: string, e: unknown): void {
    const msg = e instanceof Error ? e.message : String(e);
    logger.error(scope, `Blad wewnetrzny: ${msg}`);
    res.status(500).json({ error: 'Wewnetrzny blad serwera' });
}

/* ===== BATCH PREDICT ===== */

const batchCandidateSchema = z.object({
    id: z.number(),
    features: z.array(z.number()).length(ML_CONSTANTS.FEATURE_COUNT),
    wellType: z.string().optional(),
    warehouse: z.string().optional(),
    dn: z.number().optional(),
    wellId: z.string().optional()
});

const batchPredictSchema = z.object({
    candidates: z.array(batchCandidateSchema).min(1).max(10),
    featureVersion: z.string().optional()
});

// P1: wellId wymagany — nagroda tylko dla studni, która przeszła przez telemetrię;
// scoreBefore/scoreAfter ograniczone do [0,1] (wynik modelu) — blokada reward farmingu.
const rewardSchema = z.object({
    action: z.enum(['ACCEPT', 'REJECT', 'MODIFY', 'ADJUST', 'SWAP']),
    wellId: z.string().min(1),
    dn: z.number().optional(),
    scoreBefore: z.number().min(0).max(1).optional(),
    scoreAfter: z.number().min(0).max(1).optional(),
    wasAiRanked: z.boolean().optional(),
    configSnapshot: z.record(z.string(), z.unknown()).optional(),
    // Łańcuch sugestia→decyzja: ID rekordu sugestii AUTO (frontend przechwytuje
    // je z odpowiedzi /ai/config). MODIFY/REJECT etykietują SUGESTIĘ, nie finalny config.
    parentConfigId: z.string().optional()
});

// P4: Indeksy cech do detekcji driftu wyznaczane z FEATURE_NAMES zamiast sztywnych 12/13 —// zmiana kolejności cech w mlConstants nie zepsuje obliczeń. Brak cechy w FEATURE_NAMES
// (idx === -1) wyklucza ją z pomiaru driftu.
const PRICE_FEATURE_IDX = FEATURE_NAMES.indexOf('totalPrice');
const WEIGHT_FEATURE_IDX = FEATURE_NAMES.indexOf('totalWeight');
const DRIFT_FEATURES: Array<{ key: string; idx: number }> = [];
if (PRICE_FEATURE_IDX !== -1) DRIFT_FEATURES.push({ key: 'totalPrice', idx: PRICE_FEATURE_IDX });
if (WEIGHT_FEATURE_IDX !== -1) DRIFT_FEATURES.push({ key: 'totalWeight', idx: WEIGHT_FEATURE_IDX });

function normalizeFeatures(features: number[], mins: number[], maxs: number[]): number[] {
    return features.map((v, i) => {
        const range = maxs[i] - mins[i];
        return range === 0 ? 0 : (v - mins[i]) / range;
    });
}

/* ===== BATCH PREDICT (dla rankCandidates) ===== */

router.post(
    '/ai/predict/batch',
    requireAuth,
    WRITE_LIMITER,
    async (req: Request, res: Response) => {
        try {
            const parsed = batchPredictSchema.safeParse(req.body);
            if (!parsed.success) {
                res.status(400).json({ error: 'Invalid input', details: parsed.error.issues });
                return;
            }

            const { candidates, featureVersion } = parsed.data;

            // P5: analogicznie jak w /ai/predict — odrzuć requesty ze starą wersją cech
            if (featureVersion !== undefined && featureVersion !== ML_CONSTANTS.FEATURE_VERSION) {
                res.status(400).json({ error: 'FEATURE_VERSION_MISMATCH' });
                return;
            }

            const activeModel = await modelRegistry.getActiveModel();
            if (!activeModel) {
                res.status(503).json({ error: 'No active model', scores: [] });
                return;
            }

            const expectedDim = activeModel.featureMins.length;
            for (const c of candidates) {
                if (c.features.length !== expectedDim) {
                    res.status(400).json({
                        error: 'FEATURE_COUNT_MISMATCH',
                        candidateId: c.id,
                        expectedFeatureCount: expectedDim,
                        receivedFeatureCount: c.features.length,
                        expectedFeatureVersion: activeModel.version
                    });
                    return;
                }
            }

            const model = new AcceptanceModel(
                activeModel.weights.length,
                activeModel.weights,
                activeModel.bias
            );

            const scores = candidates.map((c) => {
                const key = cacheKey(c.features, c.wellType, c.warehouse, c.dn);
                const cached = getCached(key);
                if (cached) {
                    // Zapamiętaj serwerowy score dla wellId — reward nie ufa klienckiemu
                    // scoreBefore (poisoning sliding AUC przez sfałszowany payload).
                    if (c.wellId) setWellScore(c.wellId, cached.result[0].score);
                    return {
                        id: c.id,
                        score: cached.result[0].score,
                        version: cached.result[0].version,
                        featureVersion: featureVersion || 'unknown',
                        cached: true
                    };
                }
                const score = model.predict(
                    normalizeFeatures(c.features, activeModel.featureMins, activeModel.featureMaxs)
                );
                if (c.wellId) setWellScore(c.wellId, parseFloat(score.toFixed(4)));
                const result = {
                    id: c.id,
                    score: parseFloat(score.toFixed(4)),
                    version: activeModel.version,
                    featureVersion: featureVersion || 'unknown'
                };
                setCache(key, {
                    result: [{ score: result.score, version: result.version }],
                    timestamp: Date.now()
                });
                return result;
            });

            res.json({ scores });
            // Fire-and-forget — nie blokuje odpowiedzi; pomija, gdy trwa trening
            if (!trainingPipeline.getStatus().running) {
                selfEvaluation.checkAndRollbackIfNeeded().catch((e) => {
                    logger.error(
                        'AiPredictBatchRoute',
                        `Sliding AUC check failed: ${e instanceof Error ? e.message : String(e)}`
                    );
                });
            }
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            logger.error('AiPredictBatchRoute', `Blad predykcji batch: ${msg}`);
            res.status(500).json({ error: 'Batch prediction failed' });
        }
    }
);

router.post(
    '/ai/reward',
    requireAuth,
    WRITE_LIMITER,
    async (req: AuthenticatedRequest, res: Response) => {
        try {
            const parsed = rewardSchema.safeParse(req.body);
            if (!parsed.success) {
                res.status(400).json({
                    error: 'Invalid reward payload',
                    details: parsed.error.issues
                });
                return;
            }

            const data = parsed.data;

            // P1: blokada reward farmingu — nagroda tylko dla studni, która faktycznie
            // wygenerowała telemetrię konfiguracji (przeszła przez solver/akceptację).
            // Fire-and-forget z frontendu nie sprawdza odpowiedzi, więc 400 nie psuje UX;
            // zysk: wysyłka dowolnego wellId/wasAiRanked nie zawyża totalReward ani sliding AUC.
            const telemetryWell = await prisma.ai_telemetry_logs.findFirst({
                where: { wellId: data.wellId },
                select: { id: true }
            });
            if (!telemetryWell) {
                res.status(400).json({ error: 'WELL_NOT_FOUND' });
                return;
            }

            // P2: dedup reward per (wellId, action) — unikalny indeks
            // uq_reward_well_action + P2002 w RewardCalculator.processAction
            // (atomowo; wcześniej findFirst→create był podatny na TOCTOU —
            // dwa równoległe requesty mogły zapisać duplikat i zawyżyć sliding AUC).
            const applied = await rewardCalculator.processAction({
                userId: req.user?.id || 'unknown',
                action: data.action,
                wellId: data.wellId,
                dn: data.dn,
                scoreBefore: data.scoreBefore,
                scoreAfter: data.scoreAfter,
                wasAiRanked: data.wasAiRanked,
                configSnapshot: data.configSnapshot as Record<string, unknown> | undefined
            });
            if (!applied.applied) {
                res.json({ status: 'ok', duplicate: true });
                return;
            }

            // Feedback MODIFY/REJECT to sygnał negatywny dla treningu ML. Oznacz
            // rekord SUGESTII (features = sugestia) i zsynchronizuj etykietę
            // w aiFeature — inaczej klasa negatywna nigdy nie trafi do modelu.
            // WAŻNE: nie etykietuj "najnowszego rekordu studni" — to zwykle finalny
            // config (OFFER_SAVE/MANUAL), co tworzyło data leakage (baza błędów ML).
            // Cel ustalany: 1) parentConfigId z frontendu (z guardem wellId),
            // 2) fallback: najwcześniejsza sugestia AUTO dla studni.
            if (data.action === 'MODIFY' || data.action === 'REJECT') {
                const flags =
                    data.action === 'MODIFY' ? { wasModified: true } : { wasRejected: true };
                const label = data.action === 'MODIFY' ? 'MODIFIED' : 'REJECTED';

                let targetId: string | null = null;
                if (data.parentConfigId) {
                    const parent = await prisma.ai_telemetry_logs.findFirst({
                        where: { id: data.parentConfigId, wellId: data.wellId },
                        select: { id: true }
                    });
                    if (parent) targetId = parent.id;
                }
                if (!targetId) {
                    // Fallback: najwcześniejsza sugestia AUTO dla studni (asc) —
                    // komentarz poprzednio mówił "najwcześniejsza", a orderBy desc
                    // wybierał najnowszą (złe etykiety przy wielu sugestiach).
                    const suggestion = await prisma.ai_telemetry_logs.findFirst({
                        where: {
                            wellId: data.wellId,
                            solverSource: { in: ['AUTO_JS', 'AI_SUGGEST'] }
                        },
                        orderBy: { createdAt: 'asc' },
                        select: { id: true }
                    });
                    if (suggestion) targetId = suggestion.id;
                }
                if (targetId) {
                    await prisma.ai_telemetry_logs.update({
                        where: { id: targetId },
                        data: flags
                    });
                    await featureExtractor.updateLabelByTelemetry(targetId, label);
                }
            }

            // Rejestruj wynik predykcji dla sliding AUC. Nie ufamy klienckiemu
            // scoreBefore — atak: 6×ACCEPT score≈0 + 5×REJECT score≈1 → AUC≈0 →
            // auto-rollback. Użyj serwerowego score z predict/batch (wellId→score);
            // brak zapisu = studnia nie przeszła przez AI (brak wpisu w oknie).
            if (data.wasAiRanked && data.scoreBefore !== undefined) {
                const serverScore = getWellScore(data.wellId);
                if (serverScore !== undefined && Math.abs(serverScore - data.scoreBefore) <= 0.01) {
                    selfEvaluation.recordPredictionResult(
                        data.action === 'ACCEPT' ? 1 : 0,
                        serverScore
                    );
                }
            }

            res.json({ status: 'ok' });
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            logger.error('AiRewardRoute', `Blad nagrody: ${msg}`);
            res.status(500).json({ error: 'Reward failed' });
        }
    }
);

/* ===== STUDNIE DOBRANE PRZEZ AI (well selections) ===== */

router.get(
    '/ai/well-selections',
    requireAuth,
    requireAdmin,
    READ_LIMITER,
    async (_req: Request, res: Response) => {
        try {
            // Indeks idx_logs_source_well (solverSource, wellId) — filtr po solverSource.
            const logs = await prisma.ai_telemetry_logs.findMany({
                where: { solverSource: 'AI_SUGGEST' },
                select: {
                    wellId: true,
                    dn: true,
                    warehouse: true,
                    aiVersion: true,
                    createdAt: true
                },
                orderBy: { createdAt: 'desc' }
            });

            // Agregacja w pamieci — dane sa male (brak groupBy w Prisma/SQLite dla tego modelu).
            const byWell = new Map<
                string,
                {
                    wellId: string;
                    dn: string | null;
                    warehouse: string | null;
                    modelVersion: string | null;
                    count: number;
                    lastSeenAt: string | null;
                }
            >();

            for (const log of logs) {
                if (!log.wellId) continue;
                const existing = byWell.get(log.wellId);
                if (!existing) {
                    byWell.set(log.wellId, {
                        wellId: log.wellId,
                        dn: log.dn ?? null,
                        warehouse: log.warehouse ?? null,
                        modelVersion: log.aiVersion ?? null,
                        count: 1,
                        lastSeenAt: log.createdAt ?? null
                    });
                } else {
                    existing.count += 1;
                    if (
                        log.createdAt &&
                        (!existing.lastSeenAt ||
                            Date.parse(log.createdAt) > Date.parse(existing.lastSeenAt))
                    ) {
                        existing.lastSeenAt = log.createdAt;
                    }
                }
            }

            const items = Array.from(byWell.values()).sort((a, b) => {
                const ta = a.lastSeenAt ? Date.parse(a.lastSeenAt) : 0;
                const tb = b.lastSeenAt ? Date.parse(b.lastSeenAt) : 0;
                return tb - ta;
            });

            res.json({
                totalWells: items.length,
                totalSelections: items.reduce((sum, w) => sum + w.count, 0),
                items
            });
        } catch (e) {
            sendInternalError(res, 'AiWellSelections', e);
        }
    }
);

/* ===== FEATURE FLAG: AI influence level ===== */

router.get('/ai/settings', requireAuth, READ_LIMITER, async (_req: Request, res: Response) => {
    try {
        const setting = await prisma.settings.findUnique({
            where: { key: 'wells_ai_influence' }
        });
        res.json({
            key: 'wells_ai_influence',
            value: setting?.value || '0',
            description: 'Poziom wplywu AI na dobor elementow studni (0-100, 0=shadow)'
        });
    } catch (e) {
        sendInternalError(res, 'AiMlRoute', e);
    }
});

router.post(
    '/ai/settings',
    requireAuth,
    requireAdmin,
    WRITE_LIMITER,
    async (req, res: Response) => {
        const authReq = req as AuthenticatedRequest;
        try {
            const aiSettingsSchema = z.object({
                value: z.coerce.number().int().min(0).max(100)
            });
            const parsed = aiSettingsSchema.safeParse(req.body);
            if (!parsed.success) {
                res.status(400).json({
                    error: 'Wartosc musi byc liczba 0-100',
                    details: parsed.error.issues
                });
                return;
            }
            const pct = parsed.data.value;
            await prisma.settings.upsert({
                where: { key: 'wells_ai_influence' },
                update: { value: String(pct) },
                create: { key: 'wells_ai_influence', value: String(pct) }
            });
            await logAudit('settings', 'update', authReq.user?.id || '', 'wells_ai_influence', {
                newValue: pct
            });
            res.json({ key: 'wells_ai_influence', value: String(pct) });
        } catch (e) {
            sendInternalError(res, 'AiMlRoute', e);
        }
    }
);

router.get('/ai/ml-status', requireAuth, READ_LIMITER, async (_req: Request, res: Response) => {
    try {
        const activeModel = await modelRegistry.getActiveModel();
        const modelCount = await modelRegistry.getModelCount();
        const featureCount = await featureExtractor.getFeatureCount();
        const featureLabels = await prisma.aiFeature.groupBy({
            by: ['label'],
            _count: { _all: true }
        });
        const labelCounts: Record<string, number> = {};
        for (const row of featureLabels) {
            labelCounts[row.label] = row._count._all;
        }
        const labeledCount = featureCount - (labelCounts['NO_FEEDBACK'] ?? 0);
        const pipelineStatus = trainingPipeline.getStatus();
        const rewardLogs = await prisma.aiRewardLog.count();
        const aiInfluence = await prisma.settings.findUnique({
            where: { key: 'wells_ai_influence' }
        });

        const activeMetrics = (activeModel?.metrics || {}) as {
            rocAuc?: number | null;
            prAuc?: number | null;
            f1?: number | null;
            logLoss?: number | null;
            ece?: number | null;
        };

        // Baseline accuracy (plan 2.2): max(positiveRate, 1-positiveRate) z
        // ostatniego udanego treningu (AiTrainingRun.baselineAccuracy) — porównanie
        // model vs baseline majority-class, nie AUC vs 0.5.
        const lastSuccessRun = await prisma.aiTrainingRun.findFirst({
            where: { status: 'SUCCESS', baselineAccuracy: { not: null } },
            orderBy: { startedAt: 'desc' }
        });
        const baselineAccuracy = lastSuccessRun?.baselineAccuracy ?? null;

        res.json({
            mlOnline: !!activeModel,
            modelVersion: activeModel?.version || null,
            activeModelAuc: activeModel?.metrics?.rocAuc ?? null,
            baselineAccuracy,
            activeModelMetrics: {
                rocAuc: activeMetrics.rocAuc ?? null,
                prAuc: activeMetrics.prAuc ?? null,
                f1: activeMetrics.f1 ?? null,
                logLoss: activeMetrics.logLoss ?? null,
                ece: activeMetrics.ece ?? null
            },
            activeModelState: activeModel?.state || null,
            activeModelCreatedAt: activeModel?.createdAt || null,
            modelFeatureCount: activeModel?.featureMins?.length || ML_CONSTANTS.FEATURE_COUNT,
            featureVersion: ML_CONSTANTS.FEATURE_VERSION,
            rankingVersion: ML_CONSTANTS.RANKING_VERSION,
            modelCount,
            featureCount,
            labeledCount,
            labelCounts: {
                accepted:
                    (labelCounts['ACCEPTED'] ?? 0) +
                    (labelCounts['ACCEPTED_AFTER_MODIFICATION'] ?? 0),
                rejected: labelCounts['REJECTED'] ?? 0,
                modified: labelCounts['MODIFIED'] ?? 0,
                noFeedback: labelCounts['NO_FEEDBACK'] ?? 0
            },
            trainingRunning: pipelineStatus.running,
            totalRewards: rewardLogs,
            cacheSize: predictionCacheSize(),
            aiInfluencePct: parseInt(aiInfluence?.value || '0', 10),
            retention: {
                keepLast: ML_CONFIG.retention.keepLast,
                keepBest: ML_CONFIG.retention.keepBest
            }
        });
    } catch (e) {
        sendInternalError(res, 'AiMlRoute', e);
    }
});

// Sugestie z bazy wiedzy (Learning Engine) dla danego DN studni.
// Czysto suggestywne — użytkownik decyduje (Zastosuj/Odrzuć).
router.get('/ai/kb-suggestions', requireAuth, READ_LIMITER, async (req: Request, res: Response) => {
    try {
        const dn = (req.query.dn as string) || 'all_dn';
        const suggestions = await recommendationEngine.recommendForDn(
            {
                wellId: 'kb-suggestions',
                telemetryId: 'kb-suggestions',
                dn,
                features: [],
                extractedAt: new Date().toISOString()
            },
            5
        );
        res.json({
            suggestions: suggestions.map(function (r) {
                return {
                    patternKey: r.pattern.patternKey,
                    patternType: r.pattern.patternType,
                    description: r.pattern.description || '',
                    confidence: r.pattern.confidence,
                    hitCount: r.pattern.hitCount,
                    score: r.score,
                    recommendation: r.pattern.recommendation || {}
                };
            })
        });
    } catch (e) {
        sendInternalError(res, 'AiMlRoute', e);
    }
});

router.get(
    '/ai/health',
    requireAuth,
    requireAdmin,
    READ_LIMITER,
    async (_req: Request, res: Response) => {
        try {
            const telemetryCount = await prisma.ai_telemetry_logs.count();
            const featureCount = await featureExtractor.getFeatureCount();
            const activeModel = await modelRegistry.getActiveModel();
            const modelCount = await modelRegistry.getModelCount();
            const pipelineStatus = trainingPipeline.getStatus();
            const rewardLogs = await prisma.aiRewardLog.count();

            const lastModel = await prisma.aiModel.findFirst({
                orderBy: { createdAt: 'desc' }
            });

            const withSnapshot = await prisma.ai_telemetry_logs.count({
                where: { NOT: { featureSnapshot: '{}' } }
            });
            const withSolverSource = await prisma.ai_telemetry_logs.count({
                where: { NOT: { solverSource: null } }
            });
            const withWellType = await prisma.ai_telemetry_logs.count({
                where: { NOT: { wellType: null } }
            });
            const withManualOverride = await prisma.ai_telemetry_logs.count({
                where: { manualOverrideFlag: true }
            });

            let driftPct = null;
            if (activeModel?.featureMins?.length && activeModel?.featureMaxs?.length) {
                try {
                    const recentLogs = await prisma.ai_telemetry_logs.findMany({
                        where: { NOT: { featureSnapshot: '{}' } },
                        orderBy: { createdAt: 'desc' },
                        take: 50
                    });
                    const mins = activeModel.featureMins;
                    const maxs = activeModel.featureMaxs;
                    let totalChecks = 0;
                    let outOfRange = 0;
                    for (const log of recentLogs) {
                        let snap: Record<string, unknown>;
                        if (!log.featureSnapshot) continue;
                        try {
                            snap = JSON.parse(log.featureSnapshot);
                        } catch {
                            continue;
                        }
                        // P4: indeksy cech z DRIFT_FEATURES (wyznaczane z FEATURE_NAMES na starcie modułu)
                        for (const { key, idx } of DRIFT_FEATURES) {
                            const val = Number(snap[key]);
                            if (isNaN(val)) continue;
                            totalChecks++;
                            if (val < mins[idx] || val > maxs[idx]) outOfRange++;
                        }
                    }
                    driftPct = totalChecks > 0 ? Math.round((outOfRange / totalChecks) * 100) : 0;
                } catch {
                    driftPct = null;
                }
            }

            res.json({
                mlOnline: !!activeModel,
                telemetryCount,
                featureCount,
                modelCount,
                modelVersion: activeModel?.version || null,
                modelAccuracy: activeModel?.metrics?.accuracy ?? null,
                lastTrainingAt: lastModel?.createdAt || null,
                trainingRunning: pipelineStatus.running,
                totalRewards: rewardLogs,
                driftPct,
                dataQuality: {
                    totalLogs: telemetryCount,
                    withFeatureSnapshotPct:
                        telemetryCount > 0 ? Math.round((withSnapshot / telemetryCount) * 100) : 0,
                    withSolverSourcePct:
                        telemetryCount > 0
                            ? Math.round((withSolverSource / telemetryCount) * 100)
                            : 0,
                    withWellTypePct:
                        telemetryCount > 0 ? Math.round((withWellType / telemetryCount) * 100) : 0,
                    manualOverrideCount: withManualOverride
                }
            });
        } catch (e) {
            sendInternalError(res, 'AiMlRoute', e);
        }
    }
);

router.get(
    '/ai/models',
    requireAuth,
    requireAdmin,
    READ_LIMITER,
    async (_req: Request, res: Response) => {
        try {
            const models = await modelRegistry.listModels(50);
            res.json({ models });
        } catch (e) {
            sendInternalError(res, 'AiMlRoute', e);
        }
    }
);

router.delete(
    '/ai/models/:id',
    requireAuth,
    requireAdmin,
    WRITE_LIMITER,
    async (req, res: Response) => {
        const authReq = req as AuthenticatedRequest;
        try {
            const deleted = await modelRegistry.deleteModel(req.params.id);
            if (!deleted) {
                res.status(404).json({ error: 'Model nie istnieje' });
                return;
            }
            await logAudit('ai_model', 'delete', authReq.user?.id || '', deleted.id, {
                version: deleted.version
            });
            res.json({ deleted: true, model: deleted });
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            if (msg.includes('aktywnego modelu')) {
                res.status(400).json({ error: msg });
                return;
            }
            sendInternalError(res, 'AiMlRoute', e);
        }
    }
);

router.post(
    '/ai/models/:id/activate',
    requireAuth,
    requireAdmin,
    WRITE_LIMITER,
    async (req, res: Response) => {
        const authReq = req as AuthenticatedRequest;
        try {
            const model = await modelRegistry.activateModel(req.params.id);
            if (!model) {
                res.status(404).json({ error: 'Model nie istnieje' });
                return;
            }
            clearPredictionCache();
            await logAudit('ai_model', 'activate', authReq.user?.id || '', model.id, {
                version: model.version
            });
            res.json({ activated: true, model });
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            if (msg.includes('wersji cech')) {
                res.status(400).json({ error: msg });
                return;
            }
            sendInternalError(res, 'AiMlRoute', e);
        }
    }
);

// Monitoring driftu (ETAP 6): feature (PSI vs baseline z TRAIN), prediction,
// label (positiveRate). Metryka admina — dostęp tylko dla admina.
router.get(
    '/ai/drift',
    requireAuth,
    requireAdmin,
    READ_LIMITER,
    async (_req: Request, res: Response) => {
        try {
            const { buildDriftReport } = await import('../services/ml/driftService');
            res.json(await buildDriftReport());
        } catch (e) {
            sendInternalError(res, 'AiMlRoute', e);
        }
    }
);

// ETAP 7A: promote (APPROVED/CANDIDATE → PRODUCTION, atomowa wymiana) —
// ręczna droga dojścia do PRODUCTION dla modeli spoza auto-deploy.
router.post(
    '/ai/models/:id/promote',
    requireAuth,
    requireAdmin,
    WRITE_LIMITER,
    async (req, res: Response) => {
        const authReq = req as AuthenticatedRequest;
        try {
            const model = await modelRegistry.promoteModel(req.params.id);
            if (!model) {
                res.status(404).json({ error: 'Model nie istnieje' });
                return;
            }
            clearPredictionCache();
            await logAudit('ai_model', 'promote', authReq.user?.id || '', model.id, {
                version: model.version
            });
            res.json({ promoted: true, model });
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            res.status(400).json({ error: msg });
        }
    }
);

// ETAP 7A: ręczny override REJECTED → APPROVED (jawna operacja admina, audytowalna).
router.post(
    '/ai/models/:id/approve',
    requireAuth,
    requireAdmin,
    WRITE_LIMITER,
    async (req, res: Response) => {
        const authReq = req as AuthenticatedRequest;
        try {
            const adminUser = authReq.user?.id || 'unknown';
            const model = await modelRegistry.approveModel(req.params.id, adminUser);
            if (!model) {
                res.status(404).json({ error: 'Model nie istnieje' });
                return;
            }
            await logAudit('ai_model', 'approve', adminUser, model.id, {
                version: model.version
            });
            res.json({ approved: true, model });
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            res.status(400).json({ error: msg });
        }
    }
);

router.post('/ai/train', requireAuth, requireAdmin, WRITE_LIMITER, async (req, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    try {
        // ETAP 8 (3.4): min-interval między treningami — admin nie może
        // uruchomić serii treningów w kilka sekund.
        const lastRun = await prisma.aiTrainingRun.findFirst({
            orderBy: { startedAt: 'desc' }
        });
        if (lastRun) {
            const elapsed = Date.now() - new Date(lastRun.startedAt).getTime();
            if (elapsed < ML_CONFIG.trainMinIntervalMs) {
                res.status(429).json({
                    error: 'Zbyt częste treningi — odczekaj przed kolejnym uruchomieniem',
                    retryAfterMs: ML_CONFIG.trainMinIntervalMs - elapsed
                });
                return;
            }
        }
        const result = await trainingPipeline.run(true);
        clearPredictionCache();
        await logAudit('ai_model', 'train', authReq.user?.id || '', 'trigger', {
            trained: result?.trained ?? false
        });
        res.json(result);
    } catch (e) {
        sendInternalError(res, 'AiMlRoute', e);
    }
});

// P3: wagi modelu to metryka admina (dashboard AI) — dostęp tylko dla admina
router.get(
    '/ai/feature-importance',
    requireAuth,
    requireAdmin,
    READ_LIMITER,
    async (_req: Request, res: Response) => {
        try {
            const activeModel = await modelRegistry.getActiveModel();
            if (!activeModel) {
                res.status(503).json({ error: 'No active model' });
                return;
            }
            const importances = modelRegistry.computeFeatureImportance(activeModel);
            res.json({
                modelVersion: activeModel.version,
                features: importances
            });
        } catch (e) {
            sendInternalError(res, 'AiMlRoute', e);
        }
    }
);

router.get(
    '/ai/feature-schema',
    requireAuth,
    READ_LIMITER,
    async (_req: Request, res: Response) => {
        res.json({
            version: ML_CONSTANTS.FEATURE_VERSION,
            count: ML_CONSTANTS.FEATURE_COUNT,
            names: FEATURE_NAMES
        });
    }
);

router.post(
    '/ai/rollback',
    requireAuth,
    requireAdmin,
    WRITE_LIMITER,
    async (req, res: Response) => {
        const authReq = req as AuthenticatedRequest;
        try {
            const previous = await modelRegistry.rollbackToPrevious();
            clearPredictionCache();
            await logAudit('ai_model', 'rollback', authReq.user?.id || '', 'trigger', {
                rolledBack: !!previous,
                modelId: previous?.id || null
            });
            res.json({ rolledBack: !!previous, model: previous });
        } catch (e) {
            sendInternalError(res, 'AiMlRoute', e);
        }
    }
);

// ETAP 8: historia treningów ML (tabela AiTrainingRun) — ostatnie 20.
router.get(
    '/ai/training/runs',
    requireAuth,
    requireAdmin,
    READ_LIMITER,
    async (_req: Request, res: Response) => {
        try {
            const runs = await prisma.aiTrainingRun.findMany({
                orderBy: { startedAt: 'desc' },
                take: 20
            });
            res.json({ runs });
        } catch (e) {
            sendInternalError(res, 'AiMlRoute', e);
        }
    }
);

router.get(
    '/ai/training/runs/:id',
    requireAuth,
    requireAdmin,
    READ_LIMITER,
    async (req: Request, res: Response) => {
        try {
            const run = await prisma.aiTrainingRun.findUnique({
                where: { id: req.params.id }
            });
            if (!run) {
                res.status(404).json({ error: 'Run nie istnieje' });
                return;
            }
            res.json({ run });
        } catch (e) {
            sendInternalError(res, 'AiMlRoute', e);
        }
    }
);

// ETAP 8: szczegóły modelu — pełny rekord z bazy (wagi, metryki, stan).
router.get(
    '/ai/models/:id',
    requireAuth,
    requireAdmin,
    READ_LIMITER,
    async (req: Request, res: Response) => {
        try {
            const record = await prisma.aiModel.findUnique({ where: { id: req.params.id } });
            if (!record) {
                res.status(404).json({ error: 'Model nie istnieje' });
                return;
            }
            res.json({ model: record });
        } catch (e) {
            sendInternalError(res, 'AiMlRoute', e);
        }
    }
);

// ETAP 8: statystyki predykcji produkcyjnych (aiRewardLog) — liczba decyzji,
// rozkład score i akcji; wspiera sekcję shadow w dashboardzie.
router.get(
    '/ai/predictions/stats',
    requireAuth,
    requireAdmin,
    READ_LIMITER,
    async (_req: Request, res: Response) => {
        try {
            const total = await prisma.aiRewardLog.count();
            const byAction = await prisma.aiRewardLog.groupBy({
                by: ['action'],
                _count: { _all: true }
            });
            const actions: Record<string, number> = {};
            for (const row of byAction) {
                actions[row.action] = row._count._all;
            }
            const recent = await prisma.aiRewardLog.findMany({
                where: { scoreBefore: { not: null } },
                orderBy: { createdAt: 'desc' },
                take: 100
            });
            const scores = recent
                .map((r) => r.scoreBefore)
                .filter((s): s is number => typeof s === 'number');
            res.json({
                total,
                actions,
                recentScores: scores,
                recentCount: scores.length
            });
        } catch (e) {
            sendInternalError(res, 'AiMlRoute', e);
        }
    }
);

export default router;
