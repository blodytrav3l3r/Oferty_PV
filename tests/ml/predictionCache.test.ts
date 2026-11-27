import { afterEach, describe, expect, it, jest } from '@jest/globals';
import {
    clearPredictionCache,
    consumePredictionProof,
    issuePredictionProof
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
});
