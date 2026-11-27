import { ML_CONSTANTS } from '../../config/mlConstants';
import { randomUUID } from 'node:crypto';

/**
 * Cache predykcji /ai/predict i /ai/predict/batch.
 *
 * Wyizolowany moduł (wcześniej prywatny Map w telemetryAiMl.ts), bo inwalidacja
 * musi być scentralizowana: cache trzyma wynik dla AKTYWNEGO modelu, a aktywny
 * model zmienia się wyłącznie przez ModelRegistry (saveModel/rollback/activate/
 * promote). Clear w tych metodach eliminuje ryzyko starych score'ów ≤15 min po
 * przełączeniu modelu (auto-rollback / auto-promote / ręczny trening).
 */

export interface CacheEntry {
    result: { score: number; version: string }[];
    timestamp: number;
}

const predictionCache = new Map<string, CacheEntry>();
const CACHE_TTL = ML_CONSTANTS.PREDICTION_CACHE_TTL_MS;
const CACHE_MAX_SIZE = 1000;
const PREDICTION_PROOF_TTL_MS = ML_CONSTANTS.PREDICTION_CACHE_TTL_MS;

export function setCache(key: string, entry: CacheEntry): void {
    if (predictionCache.size >= CACHE_MAX_SIZE) {
        const oldest = predictionCache.keys().next().value;
        if (oldest !== undefined) predictionCache.delete(oldest);
    }
    predictionCache.set(key, entry);
}

export function getCached(key: string): CacheEntry | undefined {
    const cached = predictionCache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) return cached;
    return undefined;
}

export function cacheKey(
    features: number[],
    wellType?: string,
    warehouse?: string,
    dn?: number
): string {
    const dnStr = dn !== undefined && dn !== null ? String(dn) : '';
    return `${features.join(',')}|${wellType || ''}|${warehouse || ''}|${dnStr}`;
}

export function clearPredictionCache(): void {
    predictionCache.clear();
    predictionProofs.clear();
}

export function predictionCacheSize(): number {
    return predictionCache.size;
}

/** One-time server proof linking a model score to its user, well and version. */
const predictionProofs = new Map<
    string,
    { userId: string; wellId: string; score: number; version: string; expiresAt: number }
>();

export function issuePredictionProof(
    userId: string,
    wellId: string,
    score: number,
    version: string
): string {
    const now = Date.now();
    for (const [token, proof] of predictionProofs) {
        if (proof.expiresAt <= now) predictionProofs.delete(token);
    }
    if (predictionProofs.size >= CACHE_MAX_SIZE) {
        const oldest = predictionProofs.keys().next().value;
        if (oldest !== undefined) predictionProofs.delete(oldest);
    }
    const token = randomUUID();
    predictionProofs.set(token, {
        userId,
        wellId,
        score,
        version,
        expiresAt: now + PREDICTION_PROOF_TTL_MS
    });
    return token;
}

export function consumePredictionProof(
    token: string,
    userId: string,
    wellId: string,
    score: number
): { score: number; version: string } | null {
    const proof = predictionProofs.get(token);
    predictionProofs.delete(token);
    if (!proof || proof.expiresAt <= Date.now()) return null;
    if (proof.userId !== userId || proof.wellId !== wellId) return null;
    if (Math.abs(proof.score - score) > 0.01) return null;
    return { score: proof.score, version: proof.version };
}
