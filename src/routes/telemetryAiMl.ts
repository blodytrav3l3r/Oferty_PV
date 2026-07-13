import { Router, type Request, type Response } from 'express';
import { modelRegistry } from '../services/ml/ModelRegistry';
import { trainingPipeline } from '../services/ml/TrainingPipeline';
import { rewardCalculator } from '../services/ml/RewardCalculator';
import { featureExtractor } from '../services/ml/FeatureExtractor';
import { logger } from '../utils/logger';
import { WRITE_LIMITER } from '../middleware/rateLimiters';
import { requireAuth, requireAdmin, AuthenticatedRequest } from '../middleware/auth';
import { logAudit } from '../services/auditService';
import prisma from '../prismaClient';
import { predictSchema, batchPredictSchema, rewardSchema } from '../services/telemetryAiSchemas';
import {
    checkPredictionCache,
    setPredictionCache,
    getCacheSize,
    runPrediction,
    runBatchPrediction
} from '../services/telemetryAiPrediction';

const router = Router();

router.post(
    '/telemetry/ai/predict',
    requireAuth,
    WRITE_LIMITER,
    async (req: Request, res: Response) => {
        try {
            const parsed = predictSchema.safeParse(req.body);
            if (!parsed.success) {
                res.status(400).json({ error: 'Invalid input', details: parsed.error.issues });
                return;
            }

            const { features, wellType, warehouse, dn, featureVersion } = parsed.data;
            const cached = checkPredictionCache(features, wellType, warehouse, dn);
            if (cached) {
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
            setPredictionCache(features, scoreResult, wellType, warehouse, dn);

            res.json({ scores: scoreResult, cached: false });
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            logger.error('AiPredictRoute', `Blad predykcji: ${msg}`);
            res.status(500).json({ error: 'Prediction failed' });
        }
    }
);

router.post(
    '/telemetry/ai/predict/batch',
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

            const scores = await runBatchPrediction(candidates, featureVersion);

            res.json({ scores });
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            logger.error('AiPredictBatchRoute', `Blad predykcji batch: ${msg}`);
            res.status(500).json({ error: 'Batch prediction failed' });
        }
    }
);

router.post(
    '/telemetry/ai/reward',
    requireAuth,
    WRITE_LIMITER,
    async (req: Request, res: Response) => {
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
            await rewardCalculator.processAction({
                userId: (req as any).user?.id || 'unknown',
                action: data.action,
                wellId: data.wellId,
                dn: data.dn,
                scoreBefore: data.scoreBefore,
                scoreAfter: data.scoreAfter,
                wasAiRanked: data.wasAiRanked,
                configSnapshot: data.configSnapshot as Record<string, unknown> | undefined
            });

            res.json({ status: 'ok' });
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            logger.error('AiRewardRoute', `Blad nagrody: ${msg}`);
            res.status(500).json({ error: 'Reward failed' });
        }
    }
);

router.get('/telemetry/ai/settings', requireAuth, async (_req: Request, res: Response) => {
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

router.post('/telemetry/ai/settings', requireAuth, requireAdmin, async (req, res: Response) => {
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
});

router.get('/telemetry/ai/ml-status', requireAuth, async (_req: Request, res: Response) => {
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
            modelFeatureCount: activeModel?.featureMins.length || 16,
            modelCount,
            featureCount,
            trainingRunning: pipelineStatus.running,
            totalRewards: rewardLogs,
            cacheSize: getCacheSize(),
            aiInfluencePct: parseInt(aiInfluence?.value || '0', 10)
        });
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        res.status(500).json({ error: msg });
    }
});

router.get('/telemetry/ai/health', requireAuth, async (_req: Request, res: Response) => {
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

router.get('/telemetry/ai/models', requireAuth, async (_req: Request, res: Response) => {
    try {
        const models = await modelRegistry.listModels(50);
        res.json({ models });
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        res.status(500).json({ error: msg });
    }
});

router.post('/telemetry/ai/train', requireAuth, requireAdmin, async (req, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const result = await trainingPipeline.run(true);
        await logAudit('ai_model', 'train', authReq.user?.id || '', 'trigger', {
            trained: result?.trained ?? false
        });
        res.json(result);
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        res.status(500).json({ error: msg });
    }
});

router.post('/telemetry/ai/rollback', requireAuth, requireAdmin, async (req, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const previous = await modelRegistry.rollbackToPrevious();
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
