export const VERIFIED_PREDICTION_KEY = '_sokAiPredictionProof';

export interface VerifiedPrediction {
    score: number;
    modelVersion: string;
    verifiedAt: string;
}

export function addVerifiedPredictionProvenance(
    snapshot: Record<string, unknown> | undefined,
    prediction: VerifiedPrediction | null,
    rewardId: string
): Record<string, unknown> {
    const clientSnapshot = Object.fromEntries(
        Object.entries(snapshot ?? {}).filter(([key]) => key !== VERIFIED_PREDICTION_KEY)
    );
    if (!prediction) return clientSnapshot;

    return {
        ...clientSnapshot,
        [VERIFIED_PREDICTION_KEY]: {
            schemaVersion: 1,
            rewardId,
            score: prediction.score,
            modelVersion: prediction.modelVersion,
            verifiedAt: prediction.verifiedAt
        }
    };
}

export function parseVerifiedPredictionProvenance(
    serializedSnapshot: string | null | undefined,
    rewardId: string
): Pick<VerifiedPrediction, 'score' | 'modelVersion'> | null {
    if (!serializedSnapshot) return null;

    try {
        const snapshot: unknown = JSON.parse(serializedSnapshot);
        if (!isRecord(snapshot)) return null;
        const proof = snapshot[VERIFIED_PREDICTION_KEY];
        if (!isRecord(proof) || proof.schemaVersion !== 1 || proof.rewardId !== rewardId) {
            return null;
        }
        if (
            typeof proof.score !== 'number' ||
            !Number.isFinite(proof.score) ||
            proof.score < 0 ||
            proof.score > 1 ||
            typeof proof.modelVersion !== 'string' ||
            proof.modelVersion.length === 0
        ) {
            return null;
        }
        return { score: proof.score, modelVersion: proof.modelVersion };
    } catch {
        return null;
    }
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
