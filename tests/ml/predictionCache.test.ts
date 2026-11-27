import { afterEach, describe, expect, it, jest } from '@jest/globals';
import {
    clearPredictionCache,
    claimPredictionProof,
    commitPredictionProof,
    consumePredictionProof,
    isPredictionProofClaimed,
    issuePredictionProof,
    releasePredictionProof
} from '../../src/services/ml/predictionCache';

describe('prediction proof', () => {
    afterEach(() => {
        jest.useRealTimers();
        clearPredictionCache();
    });

    it('is bound to user, well and score and can be consumed only once', () => {
        const token = issuePredictionProof('user-a', 'well-a', 0.72, 'model-v2');

        expect(consumePredictionProof(token, 'user-b', 'well-a', 0.72)).toBeNull();
        expect(consumePredictionProof(token, 'user-a', 'well-a', 0.72)).toBeNull();

        const validToken = issuePredictionProof('user-a', 'well-a', 0.72, 'model-v2');
        expect(consumePredictionProof(validToken, 'user-a', 'well-b', 0.72)).toBeNull();
        expect(consumePredictionProof(validToken, 'user-a', 'well-a', 0.72)).toBeNull();

        const replayToken = issuePredictionProof('user-a', 'well-a', 0.72, 'model-v2');
        expect(consumePredictionProof(replayToken, 'user-a', 'well-a', 0.9)).toBeNull();
        expect(consumePredictionProof(replayToken, 'user-a', 'well-a', 0.72)).toBeNull();

        const singleUseToken = issuePredictionProof('user-a', 'well-a', 0.72, 'model-v2');
        expect(consumePredictionProof(singleUseToken, 'user-a', 'well-a', 0.72)).toEqual({
            score: 0.72,
            version: 'model-v2'
        });
        expect(consumePredictionProof(singleUseToken, 'user-a', 'well-a', 0.72)).toBeNull();
    });

    it('expires a proof after the prediction TTL', () => {
        jest.useFakeTimers();
        const token = issuePredictionProof('user-a', 'well-a', 0.72, 'model-v2');

        jest.advanceTimersByTime(15 * 60 * 1000 + 1);

        expect(consumePredictionProof(token, 'user-a', 'well-a', 0.72)).toBeNull();
    });

    it('reserves one proof at a time and releases it when persistence fails', () => {
        const token = issuePredictionProof('user-a', 'well-a', 0.72, 'model-v2');
        const firstClaim = claimPredictionProof(token, 'user-a', 'well-a', 0.72);

        expect(firstClaim).toEqual({
            score: 0.72,
            version: 'model-v2',
            claimId: expect.any(String)
        });
        expect(claimPredictionProof(token, 'user-a', 'well-a', 0.72)).toBeNull();
        expect(isPredictionProofClaimed(token)).toBe(true);
        expect(releasePredictionProof('wrong-token', firstClaim!.claimId)).toBe(false);
        expect(releasePredictionProof(token, firstClaim!.claimId)).toBe(true);

        const retryClaim = claimPredictionProof(token, 'user-a', 'well-a', 0.72);
        expect(retryClaim).not.toBeNull();
        expect(commitPredictionProof(token, retryClaim!.claimId)).toBe(true);
        expect(claimPredictionProof(token, 'user-a', 'well-a', 0.72)).toBeNull();
    });
});
