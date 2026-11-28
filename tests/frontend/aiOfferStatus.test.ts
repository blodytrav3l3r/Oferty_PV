import { describe, expect, it } from '@jest/globals';
import { buildAiOfferWellStatuses } from '../../src/services/telemetry/aiOfferStatus';

describe('buildAiOfferWellStatuses', () => {
    it('marks only allowlisted, training-eligible labeled samples as ready', () => {
        const result = buildAiOfferWellStatuses(
            ['ready', 'waiting', 'excluded', 'empty'],
            [
                { id: 't-ready', wellId: 'ready', userId: 'allowed', trainingEligible: true },
                { id: 't-wait', wellId: 'waiting', userId: 'allowed', trainingEligible: true },
                { id: 't-excluded', wellId: 'excluded', userId: 'other', trainingEligible: true }
            ],
            [
                { telemetryId: 't-ready', label: 'MODIFIED' },
                { telemetryId: 't-wait', label: 'NO_FEEDBACK' }
            ],
            ['allowed']
        );

        expect(result).toEqual({
            wells: [
                { wellId: 'ready', status: 'READY' },
                { wellId: 'waiting', status: 'WAITING_FEEDBACK' },
                { wellId: 'excluded', status: 'EXCLUDED' },
                { wellId: 'empty', status: 'NO_DATA' }
            ],
            counts: { ready: 1, waiting: 1, collecting: 0, excluded: 1, noData: 1 }
        });
    });

    it('distinguishes telemetry that has not been extracted into a feature yet', () => {
        const result = buildAiOfferWellStatuses(
            ['collecting'],
            [{ id: 't-new', wellId: 'collecting', userId: 'allowed', trainingEligible: true }],
            [],
            ['allowed']
        );

        expect(result.wells).toEqual([{ wellId: 'collecting', status: 'COLLECTING' }]);
        expect(result.counts.collecting).toBe(1);
    });
});
