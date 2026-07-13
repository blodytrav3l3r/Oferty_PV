import { modelRegistry } from './ml/ModelRegistry';

interface CacheEntry {
    result: { score: number; version: string }[];
    timestamp: number;
}

const predictionCache = new Map<string, CacheEntry>();
const CACHE_TTL = 15 * 60 * 1000;

function cacheKey(features: number[], wellType?: string, warehouse?: string, dn?: number): string {
    return `${features.join(',')}|${wellType || ''}|${warehouse || ''}|${dn || ''}`;
}

export function checkPredictionCache(
    features: number[],
    wellType?: string,
    warehouse?: string,
    dn?: number
): { result: { score: number; version: string }[] } | null {
    const key = cacheKey(features, wellType, warehouse, dn);
    const cached = predictionCache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached;
    }
    return null;
}

export function setPredictionCache(
    features: number[],
    result: { score: number; version: string }[],
    wellType?: string,
    warehouse?: string,
    dn?: number
) {
    const key = cacheKey(features, wellType, warehouse, dn);
    predictionCache.set(key, { result, timestamp: Date.now() });
}

export function getCacheSize(): number {
    return predictionCache.size;
}

interface PredictionError {
    error: string;
    [key: string]: unknown;
}

export async function runPrediction(
    features: number[],
    featureVersion?: string
): Promise<{ score: number; version: string; featureVersion: string } | PredictionError> {
    const activeModel = await modelRegistry.getActiveModel();
    if (!activeModel) {
        return { error: 'No active model' };
    }

    const expectedDim = activeModel.featureMins.length;
    if (features.length !== expectedDim) {
        return {
            error: 'FEATURE_COUNT_MISMATCH',
            expectedFeatureCount: expectedDim,
            receivedFeatureCount: features.length
        };
    }

    const { AcceptanceModel } = await import('./ml/AcceptanceModel');
    const model = new AcceptanceModel(
        activeModel.weights.length,
        activeModel.weights,
        activeModel.bias
    );

    const normalizedFeatures = features.map((v, i) => {
        const range = activeModel.featureMaxs[i] - activeModel.featureMins[i];
        return range === 0 ? 0 : (v - activeModel.featureMins[i]) / range;
    });

    const score = model.predict(normalizedFeatures);
    return {
        score: parseFloat(score.toFixed(4)),
        version: activeModel.version,
        featureVersion: featureVersion || 'unknown'
    };
}

export async function runBatchPrediction(
    candidates: Array<{ id: number; features: number[] }>,
    featureVersion?: string
): Promise<{ id: number; score: number; version: string; featureVersion: string }[]> {
    const activeModel = await modelRegistry.getActiveModel();
    if (!activeModel) return [];

    const { AcceptanceModel } = await import('./ml/AcceptanceModel');
    const model = new AcceptanceModel(
        activeModel.weights.length,
        activeModel.weights,
        activeModel.bias
    );

    return candidates.map((c) => {
        const normalizedFeatures = c.features.map((v, i) => {
            const range = activeModel.featureMaxs[i] - activeModel.featureMins[i];
            return range === 0 ? 0 : (v - activeModel.featureMins[i]) / range;
        });
        const score = model.predict(normalizedFeatures);
        return {
            id: c.id,
            score: parseFloat(score.toFixed(4)),
            version: activeModel.version,
            featureVersion: featureVersion || 'unknown'
        };
    });
}
