import { Router, type Request, type Response } from 'express';
import { modelRegistry, type StoredModel } from '../services/ml/ModelRegistry';
import { trainingPipeline } from '../services/ml/TrainingPipeline';
import { selfEvaluation } from '../services/ml/SelfEvaluation';
import { rewardCalculator } from '../services/ml/RewardCalculator';
import { featureExtractor } from '../services/ml/FeatureExtractor';
import { AcceptanceModel } from '../services/ml/AcceptanceModel';
import { ML_CONFIG } from '../services/ml/trainingConfig';
import { logger } from '../utils/logger';
import { READ_LIMITER, TELEMETRY_WRITE_LIMITER, WRITE_LIMITER } from '../middleware/rateLimiters';
import { requireAuth, requireAdmin, AuthenticatedRequest } from '../middleware/auth';
import { canWriteDoc } from '../utils/ownership';
import { requireAiMlEnabled, isAiMlEnabled } from '../middleware/aiMlGuard';
import { logAudit } from '../services/auditService';
import {
    getWellSelections,
    getPredictionStats,
    getTrainingRuns,
    getTrainingRunById
} from '../services/telemetry/aiReadModel';
import { z } from 'zod';
import prisma from '../prismaClient';
import { FEATURE_NAMES, ML_CONSTANTS } from '../config/mlConstants';
import { fallbackOutcomeReasonSchema } from '../validators/telemetrySchemas';
import { performance } from 'node:perf_hooks';
import {
    recordAiInference,
    recordAiPredictionOutcome,
    recordAiRewardOutcome
} from '../utils/metrics';
import {
    cacheKey,
    setCache,
    getCached,
    clearPredictionCache,
    predictionCacheSize,
    issuePredictionProof,
    claimPredictionProof,
    commitPredictionProof,
    isPredictionProofClaimed,
    releasePredictionProof
} from '../services/ml/predictionCache';
import { getTrainingUserIds } from '../services/ml/trainingUsers';
import type { VerifiedPrediction } from '../services/ml/predictionProvenance';
import { parseTrainingGroupDiagnosticsFromSnapshot } from '../services/ml/trainingGroupDiagnostics';

const router = Router();
type FallbackOutcomeReason = z.infer<typeof fallbackOutcomeReasonSchema>;
const COMPATIBILITY_SAMPLE_LIMIT = 500;
const ONLINE_AUC_ERROR_LOG_INTERVAL_MS = 5 * 60 * 1000;
let lastOnlineAucErrorLogAt: number | null = null;
let lastRewardAucErrorLogAt: number | null = null;

class PredictionProofInProgressError extends Error {
    constructor() {
        super('Prediction proof is being processed');
        this.name = 'PredictionProofInProgressError';
    }
}

function logRewardAucDiagnosticFailure(error: unknown): void {
    const now = Date.now();
    if (
        lastRewardAucErrorLogAt !== null &&
        now - lastRewardAucErrorLogAt < ONLINE_AUC_ERROR_LOG_INTERVAL_MS
    ) {
        return;
    }
    lastRewardAucErrorLogAt = now;
    const errorName = error instanceof Error ? error.name : 'UnknownError';
    logger.error('AiRewardRoute', `Online AUC feedback diagnostic failed (${errorName})`);
}

function logOnlineAucDiagnosticFailure(error: unknown): void {
    const now = Date.now();
    if (
        lastOnlineAucErrorLogAt !== null &&
        now - lastOnlineAucErrorLogAt < ONLINE_AUC_ERROR_LOG_INTERVAL_MS
    ) {
        return;
    }
    lastOnlineAucErrorLogAt = now;
    const errorName = error instanceof Error ? error.name : 'UnknownError';
    logger.error(
        'AiPredictBatchRoute',
        `Online AUC diagnostic failed (${errorName}); prediction response was already returned`
    );
}

type CompatibilityOutcome = 'compatible' | 'warning' | 'blocked' | 'unknown';

function countCompatibilityOutcomes(
    rows: Array<{ newData: string | null }> | null
): { total: number; truncated: boolean; byStatus: Record<CompatibilityOutcome, number> } | null {
    if (!rows) return null;

    const sampledRows = rows.slice(0, COMPATIBILITY_SAMPLE_LIMIT);
    const byStatus: Record<CompatibilityOutcome, number> = {
        compatible: 0,
        warning: 0,
        blocked: 0,
        unknown: 0
    };

    for (const row of sampledRows) {
        let status: unknown;
        try {
            status = row.newData ? JSON.parse(row.newData).result : null;
        } catch {
            status = null;
        }
        if (status === 'compatible' || status === 'warning' || status === 'blocked') {
            byStatus[status] += 1;
        } else {
            byStatus.unknown += 1;
        }
    }

    return {
        total: sampledRows.length,
        truncated: rows.length > COMPATIBILITY_SAMPLE_LIMIT,
        byStatus
    };
}

function countFallbackOutcomes(
    rows: Array<{ changeReason: string | null; _count: { _all: number } }> | null
): { total: number; byReason: Record<FallbackOutcomeReason, number> } | null {
    if (!rows) return null;

    const byReason: Record<FallbackOutcomeReason, number> = {
        timeout: 0,
        http_error: 0,
        empty_response: 0,
        partial_response: 0,
        network_error: 0,
        unspecified: 0
    };

    for (const row of rows) {
        const reason = row.changeReason ?? 'unspecified';
        if (reason && Object.prototype.hasOwnProperty.call(byReason, reason)) {
            byReason[reason as FallbackOutcomeReason] += row._count._all;
        } else {
            byReason.unspecified += row._count._all;
        }
    }

    return { total: Object.values(byReason).reduce((total, count) => total + count, 0), byReason };
}

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
    features: z.array(z.number().finite()).length(ML_CONSTANTS.FEATURE_COUNT),
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
export const rewardSchema = z.object({
    action: z.enum(['ACCEPT', 'REJECT', 'MODIFY', 'ADJUST', 'SWAP']),
    wellId: z.string().min(1),
    dn: z.number().finite().optional(),
    scoreBefore: z.number().min(0).max(1).finite().optional(),
    scoreAfter: z.number().min(0).max(1).finite().optional(),
    wasAiRanked: z.boolean().optional(),
    predictionToken: z.string().uuid().optional(),
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
    TELEMETRY_WRITE_LIMITER,
    requireAiMlEnabled,
    async (req: Request, res: Response) => {
        try {
            const parsed = batchPredictSchema.safeParse(req.body);
            if (!parsed.success) {
                recordAiPredictionOutcome('validation_rejected');
                res.status(400).json({ error: 'Invalid input', details: parsed.error.issues });
                return;
            }

            const { candidates, featureVersion } = parsed.data;

            // P5: analogicznie jak w /ai/predict — odrzuć requesty ze starą wersją cech
            if (featureVersion !== undefined && featureVersion !== ML_CONSTANTS.FEATURE_VERSION) {
                recordAiPredictionOutcome('validation_rejected');
                res.status(400).json({ error: 'FEATURE_VERSION_MISMATCH' });
                return;
            }

            const activeModel = await modelRegistry.getActiveModel();
            if (!activeModel) {
                recordAiPredictionOutcome('model_unavailable');
                res.status(503).json({ error: 'No active model', scores: [] });
                return;
            }

            const expectedDim = activeModel.featureMins.length;
            for (const c of candidates) {
                if (c.features.length !== expectedDim) {
                    recordAiPredictionOutcome('validation_rejected');
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

            // Faza 1 (bez efektów ubocznych): odczyt cache albo predykcja.
            // Non-finite score (NaN/Inf z modelu) → 422 ZANIM cokolwiek
            // trafi do predictionCache / rankingu.
            const resolved: Array<{
                c: (typeof candidates)[number];
                key: string;
                score: number;
                version: string;
                cached: boolean;
            }> = [];
            for (const c of candidates) {
                const key = cacheKey(c.features, c.wellType, c.warehouse, c.dn);
                const cached = getCached(key);
                const cachedScore = cached?.result[0]?.score;
                if (cached && typeof cachedScore === 'number' && Number.isFinite(cachedScore)) {
                    resolved.push({
                        c,
                        key,
                        score: cachedScore,
                        version: cached.result[0].version,
                        cached: true
                    });
                    continue;
                }
                const normalizedFeatures = normalizeFeatures(
                    c.features,
                    activeModel.featureMins,
                    activeModel.featureMaxs
                );
                const inferenceStartedAt = performance.now();
                let score: number;
                try {
                    score = model.predict(normalizedFeatures);
                } finally {
                    recordAiInference(performance.now() - inferenceStartedAt);
                }
                if (!Number.isFinite(score)) {
                    recordAiPredictionOutcome('invalid_score');
                    res.status(422).json({ error: 'NON_FINITE_SCORE', candidateId: c.id });
                    return;
                }
                resolved.push({
                    c,
                    key,
                    score: parseFloat(score.toFixed(4)),
                    version: activeModel.version,
                    cached: false
                });
            }

            // Faza 2: wszystkie score'y skończone — dopiero tu zapisy
            // (serwerowy cache predykcji i ranking).
            const scores = resolved.map((r) => {
                const userId = (req as AuthenticatedRequest).user?.id;
                const predictionToken =
                    userId && r.c.wellId
                        ? issuePredictionProof(userId, r.c.wellId, r.score, r.version)
                        : undefined;
                if (!r.cached) {
                    setCache(r.key, {
                        result: [{ score: r.score, version: r.version }],
                        timestamp: Date.now()
                    });
                }
                return {
                    id: r.c.id,
                    score: r.score,
                    version: r.version,
                    featureVersion: featureVersion || 'unknown',
                    ...(predictionToken ? { predictionToken } : {}),
                    ...(r.cached ? { cached: true } : {})
                };
            });

            recordAiPredictionOutcome('success');
            res.json({ scores });
            // Wyłącznie obserwacja. Wynik AUC nie może zmienić aktywnego modelu.
            // Fire-and-forget — predykcja pozostaje poprawna także przy błędzie diagnostyki.
            if (!trainingPipeline.getStatus().running) {
                void Promise.resolve()
                    .then(() => selfEvaluation.evaluateOnlineAuc())
                    .catch(logOnlineAucDiagnosticFailure);
            }
        } catch (e) {
            recordAiPredictionOutcome('server_error');
            const msg = e instanceof Error ? e.message : String(e);
            logger.error('AiPredictBatchRoute', `Blad predykcji batch: ${msg}`);
            res.status(500).json({ error: 'Batch prediction failed' });
        }
    }
);

router.post(
    '/ai/reward',
    requireAuth,
    TELEMETRY_WRITE_LIMITER,
    requireAiMlEnabled,
    async (req: AuthenticatedRequest, res: Response) => {
        try {
            const parsed = rewardSchema.safeParse(req.body);
            if (!parsed.success) {
                recordAiRewardOutcome('invalid');
                res.status(400).json({
                    error: 'Invalid reward payload',
                    details: parsed.error.issues
                });
                return;
            }

            const result = await processRewardItem(parsed.data, req.user);
            if (result.status === 'invalid') {
                recordAiRewardOutcome('invalid');
                res.status(400).json({
                    error: 'Invalid reward payload',
                    details: result.details
                });
                return;
            }
            if (result.status === 'well-not-found') {
                recordAiRewardOutcome('not_found');
                res.status(404).json({ error: 'WELL_NOT_FOUND' });
                return;
            }
            if (result.status === 'forbidden') {
                recordAiRewardOutcome('forbidden');
                res.status(403).json({ error: 'FORBIDDEN' });
                return;
            }
            if (result.status === 'duplicate') {
                recordAiRewardOutcome('duplicate');
                res.json({ status: 'ok', duplicate: true });
                return;
            }

            recordAiRewardOutcome('applied');
            res.json({ status: 'ok' });
        } catch (e) {
            recordAiRewardOutcome('request_error');
            const msg = e instanceof Error ? e.message : String(e);
            logger.error('AiRewardRoute', `Blad nagrody: ${msg}`);
            res.status(500).json({ error: 'Reward failed' });
        }
    }
);

/* ===== REWARD BATCH (bulk ORDER_CONFIRM/OFFER_SAVE — O(N/500) requestów) ===== */

const REWARD_BATCH_CAP = 500;

const rewardBatchSchema = z.object({
    items: z.array(rewardSchema).min(1).max(REWARD_BATCH_CAP)
});

type RewardItemInput = z.infer<typeof rewardSchema>;

/**
 * Best-effort processing pojedynczego rewardu — współdzielony przez
 * single i batch. Nigdy nie rzuca dla błędów per-item (tylko failed całego
 * processingu leci wyjątkiem do 500).
 */
async function processRewardItem(
    data: RewardItemInput,
    user: AuthenticatedRequest['user']
): Promise<
    | { status: 'invalid'; details: unknown }
    | { status: 'well-not-found' }
    | { status: 'forbidden' }
    | { status: 'duplicate' }
    | { status: 'applied' }
> {
    // P1 anti-farming: nagroda tylko dla studni z wierszem telemetry.
    // P1.1: i tylko dla własnej studni (wiersz cudzego właściciela → FORBIDDEN).
    const telemetryWell = await prisma.ai_telemetry_logs.findFirst({
        where: { wellId: data.wellId },
        select: { id: true, userId: true, offerId: true, trainingEligible: true }
    });
    if (!telemetryWell) {
        return { status: 'well-not-found' };
    }
    if (telemetryWell.userId && !canWriteDoc(user, telemetryWell.userId)) {
        return { status: 'forbidden' };
    }
    if (!telemetryWell.userId && telemetryWell.offerId) {
        const [rury, studnie] = await Promise.all([
            prisma.offers_rel.findUnique({
                where: { id: telemetryWell.offerId },
                select: { userId: true }
            }),
            prisma.offers_studnie_rel.findUnique({
                where: { id: telemetryWell.offerId },
                select: { userId: true }
            })
        ]);
        const owner = rury?.userId ?? studnie?.userId ?? null;
        if ((rury || studnie) && !canWriteDoc(user, owner)) {
            return { status: 'forbidden' };
        }
    }

    const result = await applyRewardItem(data, user, undefined, undefined, telemetryWell);
    if (result.status === 'applied' && result.trustedPrediction) {
        recordTrustedPredictionResult(data, result.trustedPrediction);
    }
    return { status: result.status };
}

/**
 * Wyznacza sugestię etykietowaną przez MODIFY/REJECT — DOKŁADNIE ten rekord,
 * który `updateLabelByTelemetry` później zmodyfikuje (invariant testowany).
 */
async function resolveRewardTarget(
    data: RewardItemInput
): Promise<{ id: string; userId: string | null; offerId: string | null } | null> {
    if (data.parentConfigId) {
        const parent = await prisma.ai_telemetry_logs.findFirst({
            where: { id: data.parentConfigId, wellId: data.wellId },
            select: { id: true, userId: true, offerId: true }
        });
        if (parent) return parent;
    }
    const suggestion = await prisma.ai_telemetry_logs.findFirst({
        where: {
            wellId: data.wellId,
            solverSource: { in: ['AUTO_JS', 'AI_SUGGEST'] }
        },
        orderBy: { createdAt: 'asc' },
        select: { id: true, userId: true, offerId: true }
    });
    return suggestion;
}

/**
 * Właściwe zapisanie nagrody — caller gwarantuje istnienie wiersza telemetry
 * (single: processRewardItem, batch: zbiorczy findMany IN).
 *
 * @param preTarget wstępnie wyznaczony target etykietowania (batch prefetch).
 *   `undefined` = wyznacz leniwie przez resolveRewardTarget (ścieżka single).
 *   Ten sam obiekt służy gate'owi REJECT i etykietowaniu — invariant:
 *   owner sprawdzany = owner rekordu modyfikowanego (bez podwójnego odczytu).
 */
type RewardTarget = { id: string; userId: string | null; offerId: string | null } | null;
type RewardTelemetryOwner = { userId: string | null; trainingEligible: boolean };

async function canWriteRewardTarget(
    user: AuthenticatedRequest['user'],
    target: RewardTarget,
    knownOfferOwners?: ReadonlyMap<string, string | null>
): Promise<boolean> {
    if (!target) return true;
    if (target.userId) return canWriteDoc(user, target.userId);
    if (!target.offerId) return user?.role === 'admin';
    if (knownOfferOwners) {
        if (!knownOfferOwners.has(target.offerId)) return user?.role === 'admin';
        return canWriteDoc(user, knownOfferOwners.get(target.offerId));
    }

    const [rury, studnie] = await Promise.all([
        prisma.offers_rel.findUnique({
            where: { id: target.offerId },
            select: { userId: true }
        }),
        prisma.offers_studnie_rel.findUnique({
            where: { id: target.offerId },
            select: { userId: true }
        })
    ]);
    const offer = rury ?? studnie;
    return offer ? canWriteDoc(user, offer.userId) : user?.role === 'admin';
}

async function resolveTrustedPrediction(
    data: RewardItemInput,
    user: AuthenticatedRequest['user'],
    owner: RewardTelemetryOwner | undefined,
    trainingAllowlist?: readonly string[]
): Promise<{ prediction: VerifiedPrediction; claimId: string; token: string } | null> {
    if (
        !user?.id ||
        !data.predictionToken ||
        !data.wasAiRanked ||
        data.scoreBefore === undefined ||
        !owner?.userId ||
        owner.trainingEligible !== true ||
        owner.userId !== user.id
    ) {
        return null;
    }
    let allowlist = trainingAllowlist;
    if (!allowlist) {
        try {
            allowlist = await getTrainingUserIds();
        } catch (error: unknown) {
            logRewardAucDiagnosticFailure(error);
            return null;
        }
    }
    if (!allowlist.includes(owner.userId)) return null;
    if (data.action !== 'ACCEPT' && data.action !== 'REJECT' && data.action !== 'MODIFY')
        return null;

    const claim = claimPredictionProof(
        data.predictionToken,
        user.id,
        data.wellId,
        data.scoreBefore
    );
    if (!claim) {
        if (isPredictionProofClaimed(data.predictionToken)) {
            throw new PredictionProofInProgressError();
        }
        return null;
    }
    return {
        prediction: {
            score: claim.score,
            modelVersion: claim.version,
            verifiedAt: new Date().toISOString()
        },
        claimId: claim.claimId,
        token: data.predictionToken
    };
}

function recordTrustedPredictionResult(
    data: RewardItemInput,
    prediction: VerifiedPrediction
): void {
    try {
        selfEvaluation.recordPredictionResult(
            data.action === 'ACCEPT' ? 1 : 0,
            prediction.score,
            prediction.modelVersion
        );
    } catch (error: unknown) {
        logRewardAucDiagnosticFailure(error);
    }
}

async function applyRewardItem(
    data: RewardItemInput,
    user: AuthenticatedRequest['user'],
    preTarget?: RewardTarget,
    knownOfferOwners?: ReadonlyMap<string, string | null>,
    owner?: RewardTelemetryOwner,
    trainingAllowlist?: readonly string[]
): Promise<
    | { status: 'duplicate' }
    | { status: 'applied'; trustedPrediction: VerifiedPrediction | null }
    | { status: 'forbidden' }
> {
    // P1 reward ownership: silny negatyw (REJECT, −1.0) i korekta etykiety
    // (MODIFY) tylko z prawem zapisu do właściciela ETYKIETOWANEJ sugestii.
    // Gate PRZED jakimkolwiek zapisem (także przed aiRewardLog).
    // ACCEPT/ADJUST/SWAP nie mutują cudzego wiersza (wpis z własnym userId),
    // ale processRewardItem i tak wymaga własności studni (P1.1).
    // P2 dedup: unikalny indeks uq_reward_well_action + P2002 (atomowo) —
    // zapis celowo per-item (wspólny tx dla batcha zmieniłby semantykę:
    // drugi duplikat w batchu wycofałby cały tx zamiast statusu 'duplicate').
    let target: RewardTarget | undefined = preTarget;
    if (data.action === 'REJECT' || data.action === 'MODIFY') {
        if (target === undefined) target = await resolveRewardTarget(data);
        if (!(await canWriteRewardTarget(user, target, knownOfferOwners))) {
            return { status: 'forbidden' };
        }
    }

    const predictionClaim = await resolveTrustedPrediction(data, user, owner, trainingAllowlist);
    const trustedPrediction = predictionClaim?.prediction ?? null;
    const targetId = target?.id ?? null;
    const flags = data.action === 'MODIFY' ? { wasModified: true } : { wasRejected: true };
    const label = data.action === 'MODIFY' ? 'MODIFIED' : 'REJECTED';
    let shouldConsumeProof = false;
    try {
        const applied = await rewardCalculator.processAction(
            {
                userId: user?.id || 'unknown',
                action: data.action,
                wellId: data.wellId,
                dn: data.dn,
                scoreBefore: trustedPrediction?.score ?? data.scoreBefore,
                scoreAfter: data.scoreAfter,
                wasAiRanked: data.wasAiRanked,
                configSnapshot: data.configSnapshot as Record<string, unknown> | undefined,
                verifiedPrediction: trustedPrediction ?? undefined
            },
            async (tx) => {
                if (!targetId || (data.action !== 'MODIFY' && data.action !== 'REJECT')) return;
                await tx.ai_telemetry_logs.update({ where: { id: targetId }, data: flags });
                await featureExtractor.updateLabelByTelemetry(targetId, label, tx);
            }
        );
        shouldConsumeProof = true;
        if (!applied.applied) return { status: 'duplicate' };
        return { status: 'applied', trustedPrediction };
    } finally {
        if (predictionClaim) {
            if (shouldConsumeProof) {
                commitPredictionProof(predictionClaim.token, predictionClaim.claimId);
            } else {
                releasePredictionProof(predictionClaim.token, predictionClaim.claimId);
            }
        }
    }
}

router.post(
    '/ai/reward-batch',
    requireAuth,
    TELEMETRY_WRITE_LIMITER,
    requireAiMlEnabled,
    async (req: AuthenticatedRequest, res: Response) => {
        try {
            const parsed = rewardBatchSchema.safeParse(req.body);
            if (!parsed.success) {
                recordAiRewardOutcome('invalid');
                res.status(400).json({
                    error: 'Invalid reward batch (1-500 items)',
                    details: parsed.error.issues
                });
                return;
            }

            const items = parsed.data.items;
            const user = req.user;

            // Jeden lookup telemetry dla całego batcha zamiast N findFirst.
            // D-011: te same pola własności co single (processRewardItem) —
            // batch ACCEPT/ADJUST/SWAP omijał well-gate (label poisoning).
            const wellIds = [...new Set(items.map((i) => i.wellId))];
            const rows = await prisma.ai_telemetry_logs.findMany({
                where: { wellId: { in: wellIds } },
                select: { wellId: true, userId: true, offerId: true, trainingEligible: true }
            });
            const rowByWell = new Map(
                rows
                    .filter((r) => r.wellId)
                    .map((r) => [
                        r.wellId as string,
                        {
                            userId: r.userId ?? null,
                            offerId: r.offerId ?? null,
                            trainingEligible: r.trainingEligible === true
                        }
                    ])
            );
            const withTelemetry = new Set(rowByWell.keys());

            // D-011: wiersze bez userId, ale z offerId (legacy) — właściciel
            // z oferty, jednym findMany IN per typ (jak assertOfferReadable).
            const offerIds = [
                ...new Set(
                    [...rowByWell.values()].map((r) => r.offerId).filter((o): o is string => !!o)
                )
            ];
            const offerOwner = new Map<string, string | null>();
            if (offerIds.length > 0) {
                const [rury, studnie] = await Promise.all([
                    prisma.offers_rel.findMany({
                        where: { id: { in: offerIds } },
                        select: { id: true, userId: true }
                    }),
                    prisma.offers_studnie_rel.findMany({
                        where: { id: { in: offerIds } },
                        select: { id: true, userId: true }
                    })
                ]);
                for (const o of rury) offerOwner.set(o.id, o.userId ?? null);
                for (const o of studnie) {
                    if (!offerOwner.has(o.id)) offerOwner.set(o.id, o.userId ?? null);
                }
            }

            // Prefetch targetów etykietowania (MODIFY/REJECT): 2× findMany IN
            // zamiast do 2× findFirst per item (parent + pierwsza sugestia AUTO).
            // Logika wyboru identyczna jak resolveRewardTarget: parentConfigId
            // należący do tej studni wygrywa, inaczej pierwsza sugestia AUTO.
            const needsTarget = items.some((i) => i.action === 'MODIFY' || i.action === 'REJECT');
            const targetByIndex = new Map<number, RewardTarget>();
            if (needsTarget) {
                const parentIds = [
                    ...new Set(
                        items.filter((i) => i.parentConfigId).map((i) => i.parentConfigId as string)
                    )
                ];
                const parentsById = new Map<
                    string,
                    {
                        id: string;
                        wellId: string | null;
                        userId: string | null;
                        offerId: string | null;
                    }
                >();
                if (parentIds.length > 0) {
                    const parentRows = await prisma.ai_telemetry_logs.findMany({
                        where: { id: { in: parentIds } },
                        select: { id: true, wellId: true, userId: true, offerId: true }
                    });
                    for (const p of parentRows) parentsById.set(p.id, p);
                }
                const suggestionRows = await prisma.ai_telemetry_logs.findMany({
                    where: {
                        wellId: { in: wellIds },
                        solverSource: { in: ['AUTO_JS', 'AI_SUGGEST'] }
                    },
                    orderBy: { createdAt: 'asc' },
                    select: { id: true, wellId: true, userId: true, offerId: true }
                });
                const firstSuggestionByWell = new Map<
                    string,
                    { id: string; userId: string | null; offerId: string | null }
                >();
                for (const s of suggestionRows) {
                    if (!s.wellId || firstSuggestionByWell.has(s.wellId)) continue;
                    firstSuggestionByWell.set(s.wellId, {
                        id: s.id,
                        userId: s.userId,
                        offerId: s.offerId
                    });
                }
                items.forEach((item, idx) => {
                    if (item.action !== 'MODIFY' && item.action !== 'REJECT') return;
                    const parent = item.parentConfigId
                        ? parentsById.get(item.parentConfigId)
                        : undefined;
                    if (parent && parent.wellId === item.wellId) {
                        targetByIndex.set(idx, {
                            id: parent.id,
                            userId: parent.userId,
                            offerId: parent.offerId
                        });
                    } else {
                        targetByIndex.set(idx, firstSuggestionByWell.get(item.wellId) ?? null);
                    }
                });

                const targetOfferIds = [
                    ...new Set(
                        [...targetByIndex.values()]
                            .map((target) => target?.offerId)
                            .filter((offerId): offerId is string => Boolean(offerId))
                    )
                ];
                const missingOfferIds = targetOfferIds.filter((id) => !offerOwner.has(id));
                if (missingOfferIds.length > 0) {
                    const [rury, studnie] = await Promise.all([
                        prisma.offers_rel.findMany({
                            where: { id: { in: missingOfferIds } },
                            select: { id: true, userId: true }
                        }),
                        prisma.offers_studnie_rel.findMany({
                            where: { id: { in: missingOfferIds } },
                            select: { id: true, userId: true }
                        })
                    ]);
                    for (const offer of rury) offerOwner.set(offer.id, offer.userId ?? null);
                    for (const offer of studnie) {
                        if (!offerOwner.has(offer.id))
                            offerOwner.set(offer.id, offer.userId ?? null);
                    }
                }
            }

            const hasTrustedFeedbackCandidate = Boolean(
                user?.id &&
                items.some((item) => {
                    const owner = rowByWell.get(item.wellId);
                    return (
                        Boolean(item.predictionToken) &&
                        item.wasAiRanked === true &&
                        item.scoreBefore !== undefined &&
                        (item.action === 'ACCEPT' ||
                            item.action === 'REJECT' ||
                            item.action === 'MODIFY') &&
                        owner?.trainingEligible === true &&
                        owner.userId === user.id
                    );
                })
            );
            let trainingAllowlist: readonly string[] = [];
            if (hasTrustedFeedbackCandidate) {
                try {
                    trainingAllowlist = await getTrainingUserIds();
                } catch (error: unknown) {
                    logRewardAucDiagnosticFailure(error);
                }
            }

            const applied: string[] = [];
            const duplicates: string[] = [];
            const rejected: Array<{ wellId: string; reason: string }> = [];

            for (let idx = 0; idx < items.length; idx++) {
                const item = items[idx];
                try {
                    if (!withTelemetry.has(item.wellId)) {
                        recordAiRewardOutcome('not_found');
                        rejected.push({ wellId: item.wellId, reason: 'WELL_NOT_FOUND' });
                        continue;
                    }
                    // D-011: well-gate jak w single (processRewardItem) —
                    // cudza studnia → FORBIDDEN przed jakimkolwiek zapisem.
                    const wellRow = rowByWell.get(item.wellId);
                    if (wellRow?.userId && !canWriteDoc(user, wellRow.userId)) {
                        recordAiRewardOutcome('forbidden');
                        rejected.push({ wellId: item.wellId, reason: 'FORBIDDEN' });
                        continue;
                    }
                    if (!wellRow?.userId && wellRow?.offerId) {
                        const owner = offerOwner.has(wellRow.offerId)
                            ? (offerOwner.get(wellRow.offerId) ?? null)
                            : null;
                        // Nieznane offerId (draft) → pass, jak assertOfferReadable.
                        if (offerOwner.has(wellRow.offerId) && !canWriteDoc(user, owner)) {
                            recordAiRewardOutcome('forbidden');
                            rejected.push({ wellId: item.wellId, reason: 'FORBIDDEN' });
                            continue;
                        }
                    }
                    const result = await applyRewardItem(
                        item,
                        user,
                        targetByIndex.get(idx),
                        offerOwner,
                        wellRow,
                        trainingAllowlist
                    );
                    if (result.status === 'applied') {
                        if (result.trustedPrediction) {
                            recordTrustedPredictionResult(item, result.trustedPrediction);
                        }
                        recordAiRewardOutcome('applied');
                        applied.push(item.wellId);
                    } else if (result.status === 'forbidden') {
                        recordAiRewardOutcome('forbidden');
                        rejected.push({ wellId: item.wellId, reason: 'FORBIDDEN' });
                    } else {
                        recordAiRewardOutcome('duplicate');
                        duplicates.push(item.wellId);
                    }
                } catch (e: unknown) {
                    recordAiRewardOutcome('item_error');
                    // P1.7 observability: odpowiedź bez zmian (reason ERROR),
                    // diagnostyka bez identyfikatora oferty ani payloadu.
                    const errName = e instanceof Error ? e.name : 'Error';
                    const errCode =
                        typeof e === 'object' && e !== null && 'code' in e
                            ? String((e as { code: unknown }).code)
                            : 'unknown';
                    logger.error('AiRewardBatchRoute', `Reward item failed ${errName}:${errCode}`);
                    rejected.push({ wellId: item.wellId, reason: 'ERROR' });
                }
            }

            res.json({ applied, duplicates, rejected });
        } catch (e) {
            recordAiRewardOutcome('request_error');
            const msg = e instanceof Error ? e.message : String(e);
            logger.error('AiRewardBatchRoute', `Blad nagrod batch: ${msg}`);
            res.status(500).json({ error: 'Reward batch failed' });
        }
    }
);

/* ===== STUDNIE DOBRANE PRZEZ AI (well selections) ===== */
// P1.5 KONTRAKT: jawny read-only exception spod kill-switcha. Agregacja
// diagnostyczna bez mutacji — dostępna także przy AI OFF (dashboard sam jest
// blokowany bramką UI). Operacje wykonawcze (predict/train/reward/transfer)
// ZAWSZE za requireAiMlEnabled. Zmiana tego wyjątku = świadoma decyzja
// kontraktowa + aktualizacja telemetryAiMlDisabled.test.ts.

router.get(
    '/ai/well-selections',
    requireAuth,
    requireAdmin,
    READ_LIMITER,
    async (_req: Request, res: Response) => {
        try {
            res.json(await getWellSelections());
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
            description: 'Poziom wplywu AI na dobor elementow studni (0-100, 0=shadow)',
            aiMlEnabled: await isAiMlEnabled()
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

/* ===== ALLOWLISTA UŻYTKOWNIKÓW TRENINGOWYCH ===== */

router.get('/ai/training-users', requireAuth, requireAdmin, READ_LIMITER, async (_req, res) => {
    try {
        const { getTrainingUsersConfig } = await import('../services/ml/trainingUsers');
        const config = await getTrainingUsersConfig();
        res.json({
            status: config.status,
            configured: config.status === 'CONFIGURED',
            userIds: config.userIds,
            legacyMigrated: config.legacyMigrated
        });
    } catch (e) {
        sendInternalError(res, 'AiMlRoute', e);
    }
});

router.put(
    '/ai/training-users',
    requireAuth,
    requireAdmin,
    WRITE_LIMITER,
    requireAiMlEnabled,
    async (req, res: Response) => {
        const authReq = req as AuthenticatedRequest;
        try {
            const { TRAINING_USERS_KEY } = await import('../services/ml/trainingUsers');
            const schema = z.object({ userIds: z.array(z.string().min(1).max(128)).max(10000) });
            const parsed = schema.safeParse(req.body);
            if (!parsed.success) {
                res.status(400).json({
                    error: 'userIds musi być tablicą identyfikatorów użytkowników',
                    details: parsed.error.issues
                });
                return;
            }
            const userIds = [...new Set(parsed.data.userIds)];
            await prisma.settings.upsert({
                where: { key: TRAINING_USERS_KEY },
                update: { value: JSON.stringify(userIds) },
                create: { key: TRAINING_USERS_KEY, value: JSON.stringify(userIds) }
            });
            await prisma.settings.upsert({
                where: { key: `${TRAINING_USERS_KEY}_migrated` },
                update: { value: '0' },
                create: { key: `${TRAINING_USERS_KEY}_migrated`, value: '0' }
            });
            await logAudit('settings', 'update', authReq.user?.id || '', TRAINING_USERS_KEY, {
                count: userIds.length
            });
            res.json({ status: 'CONFIGURED', configured: true, userIds, legacyMigrated: false });
        } catch (e) {
            sendInternalError(res, 'AiMlRoute', e);
        }
    }
);

async function getMlSummary(activeModel: StoredModel | null) {
    const [aiMlEnabled, influence] = await Promise.all([
        isAiMlEnabled(),
        prisma.settings.findUnique({ where: { key: 'wells_ai_influence' } })
    ]);
    return {
        mlOnline: !!activeModel,
        modelTrained: (activeModel?.trainingRows ?? 0) > 0,
        modelVersion: activeModel?.version ?? null,
        activeModelCreatedAt: activeModel?.createdAt ?? null,
        featureVersion: ML_CONSTANTS.FEATURE_VERSION,
        rankingVersion: ML_CONSTANTS.RANKING_VERSION,
        aiMlEnabled,
        aiInfluencePct: parseInt(influence?.value || '0', 10)
    };
}

router.get('/ai/ml-summary', requireAuth, READ_LIMITER, async (_req, res) => {
    try {
        res.json(await getMlSummary(await modelRegistry.getActiveModel()));
    } catch (e) {
        sendInternalError(res, 'AiMlRoute', e);
    }
});

router.get('/ai/ml-status', requireAuth, requireAdmin, READ_LIMITER, async (_req, res) => {
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
        const summary = await getMlSummary(activeModel);

        const activeMetrics = summary.modelTrained ? activeModel?.metrics : null;

        const lastSuccessRun = activeModel
            ? await prisma.aiTrainingRun.findFirst({
                  where: { status: 'SUCCESS', candidateModelVersion: activeModel.version },
                  orderBy: { startedAt: 'desc' }
              })
            : null;
        const rollbackTarget = activeModel
            ? await prisma.aiModel.findFirst({
                  where: { active: false, featureVersion: ML_CONSTANTS.FEATURE_VERSION },
                  orderBy: { createdAt: 'desc' },
                  select: { version: true }
              })
            : null;
        const baselineAccuracy = lastSuccessRun?.baselineAccuracy ?? null;

        res.json({
            ...summary,
            activeModelAuc: activeMetrics?.rocAuc ?? null,
            baselineAccuracy,
            // P3.3: lineage minimum — wiersze treningowe, seed i ostatni run
            // (bez zmiany schematu; dataset fingerprint dopiero z migracją).
            trainingRows: activeModel?.trainingRows ?? null,
            trainingSeed: activeModel?.seed ?? null,
            lastTrainingRun: lastSuccessRun
                ? { id: lastSuccessRun.id, startedAt: lastSuccessRun.startedAt }
                : null,
            lastTrainingSnapshot: lastSuccessRun
                ? {
                      datasetSize: lastSuccessRun.datasetSize,
                      trainSize: lastSuccessRun.trainSize,
                      validationSize: lastSuccessRun.validationSize,
                      testSize: lastSuccessRun.testSize,
                      candidateModelVersion: lastSuccessRun.candidateModelVersion,
                      groupOverlapDiagnostics: parseTrainingGroupDiagnosticsFromSnapshot(
                          lastSuccessRun.lineageSnapshot
                      )
                  }
                : null,
            rollbackTargetVersion: rollbackTarget?.version ?? null,
            // P5.2: lineage treningu — fingerprint datasetu + wersja kandydata
            // (kolumny AiTrainingRun, bez zmiany schematu).
            lastDatasetFingerprint: lastSuccessRun?.datasetFingerprint ?? null,
            lastCandidateVersion: lastSuccessRun?.candidateModelVersion ?? null,
            activeModelMetrics: {
                rocAuc: activeMetrics?.rocAuc ?? null,
                testRocAuc: activeMetrics?.testRocAuc ?? null,
                prAuc: activeMetrics?.prAuc ?? null,
                f1: activeMetrics?.f1 ?? null,
                logLoss: activeMetrics?.logLoss ?? null,
                ece: activeMetrics?.ece ?? null
            },
            activeModelState: activeModel?.state || null,
            modelFeatureCount: activeModel?.featureMins?.length || ML_CONSTANTS.FEATURE_COUNT,
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
            // F3: strukturalny status bramki (SSoT z TrainingPipeline) +
            // ostatnia rzeczywista próba. Frontend tylko prezentuje.
            trainingGate: await trainingPipeline.gateStatus(),
            totalRewards: rewardLogs,
            cacheSize: predictionCacheSize(),
            retention: {
                keepLast: ML_CONFIG.retention.keepLast,
                keepBest: ML_CONFIG.retention.keepBest
            }
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
            const modelTrained = (activeModel?.trainingRows ?? 0) > 0;
            const modelCount = await modelRegistry.getModelCount();
            const pipelineStatus = trainingPipeline.getStatus();
            const rewardLogs = await prisma.aiRewardLog.count();

            const freshnessSince = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
            const [lastTelemetry, lastFeature, fallbackGroups, compatibilityRows] =
                await Promise.all([
                    prisma.ai_telemetry_logs.findFirst({
                        where: { createdAt: { not: null } },
                        orderBy: { createdAt: 'desc' },
                        select: { createdAt: true }
                    }),
                    prisma.aiFeature.findFirst({
                        orderBy: { createdAt: 'desc' },
                        select: { createdAt: true }
                    }),
                    prisma.ai_telemetry_events
                        .groupBy({
                            by: ['changeReason'],
                            where: {
                                eventType: 'fallback_triggered',
                                createdAt: { gte: freshnessSince },
                                OR: [
                                    {
                                        changeReason: {
                                            in: [...fallbackOutcomeReasonSchema.options]
                                        }
                                    },
                                    { changeReason: null }
                                ]
                            },
                            _count: { _all: true }
                        })
                        .catch(() => {
                            logger.warn('AiMlStatus', 'Nie udało się odczytać agregatu fallbacków');
                            return null;
                        }),
                    prisma.audit_logs
                        .findMany({
                            where: {
                                entityType: 'ai_transfer',
                                action: 'TRANSFER_DRY_RUN',
                                createdAt: { gte: freshnessSince }
                            },
                            orderBy: { createdAt: 'desc' },
                            take: COMPATIBILITY_SAMPLE_LIMIT + 1,
                            select: { newData: true }
                        })
                        .catch(() => {
                            logger.warn(
                                'AiMlStatus',
                                'Nie udało się odczytać agregatu kompatybilności'
                            );
                            return null;
                        })
                ]);

            const lastRun = await prisma.aiTrainingRun.findFirst({
                where: { status: 'SUCCESS', finishedAt: { not: null } },
                orderBy: { finishedAt: 'desc' },
                select: { finishedAt: true }
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
            if (
                modelTrained &&
                activeModel?.featureMins?.length &&
                activeModel?.featureMaxs?.length
            ) {
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
                            if (snap[key] == null || !Number.isFinite(val)) continue;
                            totalChecks++;
                            if (val < mins[idx] || val > maxs[idx]) outOfRange++;
                        }
                    }
                    driftPct =
                        totalChecks > 0 ? Math.round((outOfRange / totalChecks) * 100) : null;
                } catch (driftErr) {
                    const driftMsg =
                        driftErr instanceof Error ? driftErr.message : String(driftErr);
                    logger.warn('AiMlStatus', `Błąd obliczania driftPct: ${driftMsg}`);
                    driftPct = null;
                }
            }

            res.json({
                mlOnline: !!activeModel,
                modelTrained,
                aiMlEnabled: await isAiMlEnabled(),
                telemetryCount,
                featureCount,
                modelCount,
                modelVersion: activeModel?.version || null,
                modelAccuracy:
                    modelTrained && Number.isFinite(activeModel?.metrics?.accuracy)
                        ? (activeModel?.metrics?.accuracy ?? null)
                        : null,
                lastTrainingAt: lastRun?.finishedAt ?? null,
                trainingRunning: pipelineStatus.running,
                totalRewards: rewardLogs,
                driftPct,
                dataFreshness: {
                    lastTelemetryAt: lastTelemetry?.createdAt ?? null,
                    lastFeatureAt: lastFeature?.createdAt ?? null
                },
                fallbacks24h: countFallbackOutcomes(fallbackGroups),
                compatibility24h: countCompatibilityOutcomes(compatibilityRows),
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
    requireAiMlEnabled,
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
    requireAiMlEnabled,
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
            if (msg.includes('wersji cech') || msg.includes('Model REJECTED')) {
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
    requireAiMlEnabled,
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
    requireAiMlEnabled,
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

router.post(
    '/ai/train',
    requireAuth,
    requireAdmin,
    WRITE_LIMITER,
    requireAiMlEnabled,
    async (req, res: Response) => {
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
            await logAudit('ai_model', 'train', authReq.user?.id || '', 'trigger', {
                trained: result?.trained ?? false
            });
            res.json(result);
        } catch (e) {
            sendInternalError(res, 'AiMlRoute', e);
        }
    }
);

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
            if ((activeModel.trainingRows ?? 0) <= 0) {
                res.status(503).json({ error: 'model_untrained' });
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
    requireAiMlEnabled,
    async (req, res: Response) => {
        const authReq = req as AuthenticatedRequest;
        try {
            const rollbackInput = z
                .object({
                    expectedActiveVersion: z.string().min(1).max(128).optional(),
                    expectedPreviousVersion: z.string().min(1).max(128).optional()
                })
                .strict()
                .safeParse(req.body ?? {});
            if (!rollbackInput.success) {
                res.status(400).json({ error: 'Invalid rollback target' });
                return;
            }
            const { expectedActiveVersion, expectedPreviousVersion } = rollbackInput.data;
            const previous = await modelRegistry.rollbackToPrevious(
                expectedActiveVersion,
                expectedPreviousVersion
            );
            if (
                (expectedActiveVersion !== undefined || expectedPreviousVersion !== undefined) &&
                !previous
            ) {
                res.status(409).json({ error: 'ROLLBACK_TARGET_CHANGED', rolledBack: false });
                return;
            }
            clearPredictionCache();
            await logAudit('ai_model', 'rollback', authReq.user?.id || '', 'trigger', {
                rolledBack: !!previous,
                modelId: previous?.id || null,
                expectedActiveVersion: expectedActiveVersion ?? null,
                expectedPreviousVersion: expectedPreviousVersion ?? null
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
            const runs = await getTrainingRuns(20);
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
            const run = await getTrainingRunById(req.params.id);
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
            res.json(await getPredictionStats());
        } catch (e) {
            sendInternalError(res, 'AiMlRoute', e);
        }
    }
);

export default router;
