import { ML_CONSTANTS } from '../../config/mlConstants';

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
    wellScores.clear();
}

export function predictionCacheSize(): number {
    return predictionCache.size;
}

/**
 * Ostatni score predykcji per wellId (z /ai/predict/batch).
 *
 * Serwerowa weryfikacja scoreBefore w /ai/reward: sliding AUC nie może ufać
 * klienckiemu score (poisoning przez sfałszowany payload). Frontend wysyła
 * wellId w candidate, serwer zapamiętuje zwrócony score — reward używa
 * serwerowego score, nie deklarowanego przez klienta.
 */
const wellScores = new Map<string, { score: number; timestamp: number }>();
const WELL_SCORE_TTL_MS = 15 * 60 * 1000;

export function setWellScore(wellId: string, score: number): void {
    if (wellScores.size >= CACHE_MAX_SIZE) {
        const oldest = wellScores.keys().next().value;
        if (oldest !== undefined) wellScores.delete(oldest);
    }
    wellScores.set(wellId, { score, timestamp: Date.now() });
}

export function getWellScore(wellId: string): number | undefined {
    const entry = wellScores.get(wellId);
    if (entry && Date.now() - entry.timestamp < WELL_SCORE_TTL_MS) return entry.score;
    return undefined;
}
