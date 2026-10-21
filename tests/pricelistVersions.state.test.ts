import { deriveState } from '../src/services/pricelist/validation';

describe('deriveState (S1a)', () => {
    const now = new Date('2026-10-20T12:00:00.000Z');

    test('statusy bez APPROVED przechodzą 1:1', () => {
        for (const status of [
            'DRAFT',
            'SCHEDULED',
            'ACTIVE',
            'ARCHIVED',
            'BACKDATE_REQUESTED',
            'BACKDATE'
        ]) {
            expect(deriveState(status, '2020-01-01T00:00:00.000Z', now)).toBe(status);
        }
    });

    test('APPROVED przyszły = SCHEDULED, przeszły = ACTIVE (forward-compatible S2)', () => {
        expect(deriveState('APPROVED', '2027-01-01T00:00:00.000Z', now)).toBe('SCHEDULED');
        expect(deriveState('APPROVED', '2025-01-01T00:00:00.000Z', now)).toBe('ACTIVE');
    });
});
