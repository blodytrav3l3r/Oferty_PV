import { Router, type Request, type Response } from 'express';
import { modelRegistry } from '../services/ml/ModelRegistry';
import { trainingPipeline } from '../services/ml/TrainingPipeline';
import { selfEvaluation } from '../services/ml/SelfEvaluation';
import { rewardCalculator } from '../services/ml/RewardCalculator';
import { featureExtractor } from '../services/ml/FeatureExtractor';
import { AcceptanceModel } from '../services/ml/AcceptanceModel';
import { ML_CONFIG } from '../services/ml/trainingConfig';
import { logger } from '../utils/logger';
import { READ_LIMITER, WRITE_LIMITER } from '../middleware/rateLimiters';
import { requireAuth, requireAdmin, AuthenticatedRequest } from '../middleware/auth';
import { logAudit } from '../services/auditService';
import { z } from 'zod';
import prisma from '../prismaClient';
import { FEATURE_NAMES, ML_CONSTANTS } from '../config/mlConstants';

const router = Router();

const predictSchema = z.object({
    features: z.array(z.number()).length(ML_CONSTANTS.FEATURE_COUNT),
    wellType: z.string().optional(),
    warehouse: z.string().optional(),
    dn: z.number().optional(),
    featureVersion: z.string().optional()
});

/* ===== BATCH PREDICT ===== */

const batchCandidateSchema = z.object({
    id: z.number(),
    features: z.array(z.number()).length(ML_CONSTANTS.FEATURE_COUNT),
    wellType: z.string().optional(),
    warehouse: z.string().optional(),
    dn: z.number().optional()
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
    configSnapshot: z.record(z.string(), z.unknown()).optional()
});

interface CacheEntry {
    result: { score: number; version: string }[];
    timestamp: number;
}

const predictionCache = new Map<string, CacheEntry>();
const CACHE_TTL = ML_CONSTANTS.PREDICTION_CACHE_TTL_MS;
const CACHE_MAX_SIZE = 1000;

function setCache(key: string, entry: CacheEntry): void {
    if (predictionCache.size >= CACHE_MAX_SIZE) {
        const oldest = predictionCache.keys().next().value;
        if (oldest !== undefined) predictionCache.delete(oldest);
    }
    predictionCache.set(key, entry);
}

function cacheKey(features: number[], wellType?: string, warehouse?: string, dn?: number): string {
    const dnStr = dn !== undefined && dn !== null ? String(dn) : '';
    return `${features.join(',')}|${wellType || ''}|${warehouse || ''}|${dnStr}`;
}

// P4: Indeksy cech do detekcji driftu wyznaczane z FEATURE_NAMES zamiast sztywnych 12/13 —
// zmiana kolejności cech w mlConstants nie zepsuje obliczeń. Brak cechy w FEATURE_NAMES
// (idx === -1) wyklucza ją z pomiaru driftu.
const PRICE_FEATURE_IDX = FEATURE_NAMES.indexOf('totalPrice');
const WEIGHT_FEATURE_IDX = FEATURE_NAMES.indexOf('totalWeight');
const DRIFT_FEATURES: Array<{ key: string; idx: number }> = [];
if (PRICE_FEATURE_IDX !== -1) DRIFT_FEATURES.push({ key: 'totalPrice', idx: PRICE_FEATURE_IDX });
if (WEIGHT_FEATURE_IDX !== -1) DRIFT_FEATURES.push({ key: 'totalWeight', idx: WEIGHT_FEATURE_IDX });

async function runPrediction(
    features: number[],
    featureVersion?: string
): Promise<{ score: number; version: string; featureVersion: string } | { error: string }> {
    const activeModel = await modelRegistry.getActiveModel();
    if (!activeModel) {
        return { error: 'No active model' };
    }

    const expectedDim = activeModel.featureMins.length;
    if (features.length !== expectedDim) {
        return { error: 'FEATURE_COUNT_MISMATCH' };
    }

    const model = new AcceptanceModel(
        activeModel.weights.length,
        activeModel.weights,
        activeModel.bias
    );

    const score = model.predict(
        normalizeFeatures(features, activeModel.featureMins, activeModel.featureMaxs)
    );
    return {
        score: parseFloat(score.toFixed(4)),
        version: activeModel.version,
        featureVersion: featureVersion || 'unknown'
    };
}

function normalizeFeatures(features: number[], mins: number[], maxs: number[]): number[] {
    return features.map((v, i) => {
        const range = maxs[i] - mins[i];
        return range === 0 ? 0 : (v - mins[i]) / range;
    });
}

router.post('/ai/predict', requireAuth, WRITE_LIMITER, async (req: Request, res: Response) => {
    try {
        const parsed = predictSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ error: 'Invalid input', details: parsed.error.issues });
            return;
        }

        const { features, wellType, warehouse, dn, featureVersion } = parsed.data;

        // P5: featureVersion z requestu nie jest tylko echem — niezgodna wersja cech
        // oznacza stare/niewspierane cechy po stronie klienta (featury wyliczane inaczej).
        if (featureVersion !== undefined && featureVersion !== ML_CONSTANTS.FEATURE_VERSION) {
            res.status(400).json({ error: 'FEATURE_VERSION_MISMATCH' });
            return;
        }
        const key = cacheKey(features, wellType, warehouse, dn);
        const cached = predictionCache.get(key);
        if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
            res.json({ scores: cached.result, cached: true });
            return;
        }

        const result = await runPrediction(features, featureVersion);
        if ('error' in result) {
            if (result.error === 'No active model') {
                res.status(503).json({ error: 'No active model', scores: [] });
            } else {
                res.status(400).json(result);
            }
            return;
        }

        const scoreResult = [result];
        setCache(key, { result: scoreResult, timestamp: Date.now() });

        res.json({ scores: scoreResult, cached: false });
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        logger.error('AiPredictRoute', `Blad predykcji: ${msg}`);
        res.status(500).json({ error: 'Prediction failed' });
    }
});

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
                const cached = predictionCache.get(key);
                if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
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

            // P2: dedup reward per (wellId, action) — blokada poisoningu sliding AUC.
            // Wielokrotne wysyłanie (label=1, score=0) dla tej samej studni wypychało
            // window ku AUC<0.65 i wywoływało auto-rollback (SelfEvaluation). Pierwszy
            // sygnał dla pary jest rejestrowany, kolejne ignorowane (idempotentnie).
            const existingReward = await prisma.aiRewardLog.findFirst({
                where: { wellId: data.wellId, action: data.action },
                select: { id: true }
            });
            if (existingReward) {
                res.json({ status: 'ok', duplicate: true });
                return;
            }

            await rewardCalculator.processAction({
                userId: req.user?.id || 'unknown',
                action: data.action,
                wellId: data.wellId,
                dn: data.dn,
                scoreBefore: data.scoreBefore,
                scoreAfter: data.scoreAfter,
                wasAiRanked: data.wasAiRanked,
                configSnapshot: data.configSnapshot as Record<string, unknown> | undefined
            });

            // Rejestruj wynik predykcji dla sliding AUC
            if (data.wasAiRanked && data.scoreBefore !== undefined) {
                selfEvaluation.recordPredictionResult(
                    data.action === 'ACCEPT' ? 1 : 0,
                    data.scoreBefore
                );
            }

            res.json({ status: 'ok' });
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            logger.error('AiRewardRoute', `Blad nagrody: ${msg}`);
            res.status(500).json({ error: 'Reward failed' });
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
        const msg = e instanceof Error ? e.message : String(e);
        res.status(500).json({ error: msg });
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
            const { value } = req.body;
            const pct = parseInt(value, 10);
            if (isNaN(pct) || pct < 0 || pct > 100) {
                res.status(400).json({ error: 'Wartosc musi byc liczba 0-100' });
                return;
            }
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
            const msg = e instanceof Error ? e.message : String(e);
            res.status(500).json({ error: msg });
        }
    }
);

router.get('/ai/ml-status', requireAuth, READ_LIMITER, async (_req: Request, res: Response) => {
    try {
        const activeModel = await modelRegistry.getActiveModel();
        const modelCount = await modelRegistry.getModelCount();
        const featureCount = await featureExtractor.getFeatureCount();
        const pipelineStatus = trainingPipeline.getStatus();
        const rewardLogs = await prisma.aiRewardLog.count();
        const aiInfluence = await prisma.settings.findUnique({
            where: { key: 'wells_ai_influence' }
        });

        res.json({
            mlOnline: !!activeModel,
            modelVersion: activeModel?.version || null,
            activeModelAuc: activeModel?.metrics?.rocAuc ?? null,
            activeModelCreatedAt: activeModel?.createdAt || null,
            modelFeatureCount: activeModel?.featureMins.length || ML_CONSTANTS.FEATURE_COUNT,
            featureVersion: ML_CONSTANTS.FEATURE_VERSION,
            rankingVersion: ML_CONSTANTS.RANKING_VERSION,
            modelCount,
            featureCount,
            trainingRunning: pipelineStatus.running,
            totalRewards: rewardLogs,
            cacheSize: predictionCache.size,
            aiInfluencePct: parseInt(aiInfluence?.value || '0', 10),
            retention: {
                keepLast: ML_CONFIG.retention.keepLast,
                keepBest: ML_CONFIG.retention.keepBest
            }
        });
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        res.status(500).json({ error: msg });
    }
});

router.get('/ai/health', requireAuth, READ_LIMITER, async (_req: Request, res: Response) => {
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
                    telemetryCount > 0 ? Math.round((withSolverSource / telemetryCount) * 100) : 0,
                withWellTypePct:
                    telemetryCount > 0 ? Math.round((withWellType / telemetryCount) * 100) : 0,
                manualOverrideCount: withManualOverride
            }
        });
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        res.status(500).json({ error: msg });
    }
});

router.get('/ai/models', requireAuth, requireAdmin, async (_req: Request, res: Response) => {
    try {
        const models = await modelRegistry.listModels(50);
        res.json({ models });
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        res.status(500).json({ error: msg });
    }
});

router.delete('/ai/models/:id', requireAuth, requireAdmin, async (req, res: Response) => {
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
        res.status(500).json({ error: msg });
    }
});

router.post('/ai/models/:id/activate', requireAuth, requireAdmin, async (req, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const model = await modelRegistry.activateModel(req.params.id);
        if (!model) {
            res.status(404).json({ error: 'Model nie istnieje' });
            return;
        }
        predictionCache.clear();
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
        res.status(500).json({ error: msg });
    }
});

router.post('/ai/train', requireAuth, requireAdmin, async (req, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const result = await trainingPipeline.run(true);
        predictionCache.clear();
        await logAudit('ai_model', 'train', authReq.user?.id || '', 'trigger', {
            trained: result?.trained ?? false
        });
        res.json(result);
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        res.status(500).json({ error: msg });
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
            const msg = e instanceof Error ? e.message : String(e);
            res.status(500).json({ error: msg });
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

router.post('/ai/rollback', requireAuth, requireAdmin, async (req, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const previous = await modelRegistry.rollbackToPrevious();
        predictionCache.clear();
        await logAudit('ai_model', 'rollback', authReq.user?.id || '', 'trigger', {
            rolledBack: !!previous,
            modelId: previous?.id || null
        });
        res.json({ rolledBack: !!previous, model: previous });
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        res.status(500).json({ error: msg });
    }
});

export default router;
