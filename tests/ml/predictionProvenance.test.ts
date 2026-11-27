import { describe, expect, it } from '@jest/globals';
import {
    addVerifiedPredictionProvenance,
    parseVerifiedPredictionProvenance
} from '../../src/services/ml/predictionProvenance';

describe('prediction provenance in reward snapshots', () => {
    it('zapisuje tylko serwerowy proof i usuwa próbę podszycia się klienta', () => {
        const snapshot = addVerifiedPredictionProvenance(
            {
                dn: '1000',
                _sokAiPredictionProof: { version: 'client-model', score: 0.01 }
            },
            { score: 0.82, modelVersion: 'model-v3', verifiedAt: '2026-11-27T12:00:00.000Z' },
            'reward-7'
        );

        expect(snapshot).toEqual({
            dn: '1000',
            _sokAiPredictionProof: {
                schemaVersion: 1,
                rewardId: 'reward-7',
                score: 0.82,
                modelVersion: 'model-v3',
                verifiedAt: '2026-11-27T12:00:00.000Z'
            }
        });
        expect(parseVerifiedPredictionProvenance(JSON.stringify(snapshot), 'reward-7')).toEqual({
            score: 0.82,
            modelVersion: 'model-v3'
        });
        expect(
            parseVerifiedPredictionProvenance(JSON.stringify(snapshot), 'legacy-reward')
        ).toBeNull();
    });

    it('odrzuca snapshot bez proofu lub z niepoprawnym proofem', () => {
        expect(parseVerifiedPredictionProvenance('{"dn":"1000"}', 'reward-1')).toBeNull();
        expect(
            parseVerifiedPredictionProvenance(
                '{"_sokAiPredictionProof":{"schemaVersion":1,"rewardId":"reward-1","score":3,"modelVersion":"v1"}}',
                'reward-1'
            )
        ).toBeNull();
        expect(
            parseVerifiedPredictionProvenance(
                '{"_sokAiPredictionProof":{"schemaVersion":1,"rewardId":"forged","score":0.8,"modelVersion":"v1"}}',
                'reward-1'
            )
        ).toBeNull();
        expect(parseVerifiedPredictionProvenance('nie-json', 'reward-1')).toBeNull();
    });
});
