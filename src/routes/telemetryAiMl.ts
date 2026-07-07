import { Router, type Request, type Response } from 'express';
import { modelRegistry } from '../services/ml/ModelRegistry';
import { trainingPipeline } from '../services/ml/TrainingPipeline';
import { rewardCalculator } from '../services/ml/RewardCalculator';
import { featureExtractor } from '../services/ml/FeatureExtractor';
import { logger } from '../utils/logger';
import { WRITE_LIMITER } from '../middleware/rateLimiters';
import { requireAuth } from '../middleware/auth';
import { z } from 'zod';
import prisma from '../prismaClient';

const router = Router();

const predictSchema = z.object({
    features: z.array(z.number()).min(1).max(100),
    wellType: z.string().optional(),
    warehouse: z.string().optional(),
    dn: z.number().optional()
});

const rewardSchema = z.object({
    action: z.enum(['ACCEPT', 'REJECT', 'MODIFY', 'ADJUST', 'SWAP']),
    wellId: z.string().optional(),
    dn: z.number().optional(),
    scoreBefore: z.number().optional(),
    scoreAfter: z.number().optional(),
    wasAiRanked: z.boolean().optional(),
    configSnapshot: z.record(z.string(), z.unknown()).optional()
});

interface CacheEntry {
    result: { score: number; version: string }[];
    timestamp: number;
}

const predictionCache = new Map<string, CacheEntry>();
const CACHE_TTL = 15 * 60 * 1000;

function cacheKey(features: number[], wellType?: string, warehouse?: string, dn?: number): string {
    return `${features.join(',')}|${wellType || ''}|${warehouse || ''}|${dn || ''}`;
}

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

            const { features, wellType, warehouse, dn } = parsed.data;
            const key = cacheKey(features, wellType, warehouse, dn);
            const cached = predictionCache.get(key);
            if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
                res.json({ scores: cached.result, cached: true });
                return;
            }

            const activeModel = await modelRegistry.getActiveModel();
            if (!activeModel) {
                res.status(503).json({ error: 'No active model', scores: [] });
                return;
            }

            const { AcceptanceModel } = await import('../services/ml/AcceptanceModel');
            const model = new AcceptanceModel(
                activeModel.weights.length,
                activeModel.weights,
                activeModel.bias
            );

            const featureDim = activeModel.featureMins.length;
            const paddedFeatures = features.slice(0, featureDim);
            while (paddedFeatures.length < featureDim) paddedFeatures.push(0);

            const normalizedFeatures = paddedFeatures.map((v, i) => {
                const range = activeModel.featureMaxs[i] - activeModel.featureMins[i];
                return range === 0 ? 0 : (v - activeModel.featureMins[i]) / range;
            });

            const score = model.predict(normalizedFeatures);
            const result = [{ score: parseFloat(score.toFixed(4)), version: activeModel.version }];
            predictionCache.set(key, { result, timestamp: Date.now() });

            res.json({ scores: result, cached: false });
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            logger.error('AiPredictRoute', `Blad predykcji: ${msg}`);
            res.status(500).json({ error: 'Prediction failed' });
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

router.get('/telemetry/ai/ml-status', requireAuth, async (_req: Request, res: Response) => {
    try {
        const activeModel = await modelRegistry.getActiveModel();
        const modelCount = await modelRegistry.getModelCount();
        const featureCount = await featureExtractor.getFeatureCount();
        const pipelineStatus = trainingPipeline.getStatus();
        const rewardLogs = await prisma.aiRewardLog.count();

        res.json({
            mlOnline: !!activeModel,
            modelVersion: activeModel?.version || null,
            modelCount,
            featureCount,
            trainingRunning: pipelineStatus.running,
            totalRewards: rewardLogs,
            cacheSize: predictionCache.size
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

router.post('/telemetry/ai/train', requireAuth, async (_req: Request, res: Response) => {
    try {
        const result = await trainingPipeline.run(true);
        res.json(result);
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        res.status(500).json({ error: msg });
    }
});

router.post('/telemetry/ai/rollback', requireAuth, async (_req: Request, res: Response) => {
    try {
        const previous = await modelRegistry.rollbackToPrevious();
        res.json({ rolledBack: !!previous, model: previous });
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        res.status(500).json({ error: msg });
    }
});

export default router;
