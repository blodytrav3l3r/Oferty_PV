import {
    getFollowUpState,
    getSla,
    getStatus,
    FollowUpState,
    LatestFu
} from '../../src/utils/careStatus';

const NOW = '2026-10-10T12:00:00.000Z';
const CREATED = '2026-10-01T08:00:00.000Z';
const open = (nextContactAt: string | null): LatestFu => ({ outcome: 'OPEN', nextContactAt });

interface TruthRow {
    name: string;
    latest: LatestFu | null;
    createdAt: string;
    expected: FollowUpState;
}

const TRUTH: TruthRow[] = [
    {
        name: 'NO_CONTACT swiezy',
        latest: null,
        createdAt: '2026-10-10T09:00:00.000Z',
        expected: {
            status: 'NO_CONTACT',
            slaBucket: 'DUE_TODAY',
            overdueDays: 0,
            slaDueAt: '2026-10-10T09:00:00.000Z'
        }
    },
    {
        name: 'OPEN brak terminu',
        latest: open(null),
        createdAt: CREATED,
        expected: { status: 'DUE', slaBucket: 'DUE_TODAY', overdueDays: 0, slaDueAt: null }
    },
    {
        name: 'OPEN termin pozniej inna doba',
        latest: open('2026-10-15T09:00:00.000Z'),
        createdAt: CREATED,
        expected: {
            status: 'OPEN_OK',
            slaBucket: 'OK',
            overdueDays: 0,
            slaDueAt: '2026-10-15T09:00:00.000Z'
        }
    },
    {
        name: 'OPEN termin pozniej ta sama doba',
        latest: open('2026-10-10T18:00:00.000Z'),
        createdAt: CREATED,
        expected: {
            status: 'OPEN_OK',
            slaBucket: 'DUE_TODAY',
            overdueDays: 0,
            slaDueAt: '2026-10-10T18:00:00.000Z'
        }
    },
    {
        name: 'OPEN termin miniony 0d',
        latest: open('2026-10-10T09:00:00.000Z'),
        createdAt: CREATED,
        expected: {
            status: 'DUE',
            slaBucket: 'DUE_TODAY',
            overdueDays: 0,
            slaDueAt: '2026-10-10T09:00:00.000Z'
        }
    },
    {
        name: 'OPEN D1',
        latest: open('2026-10-09T12:00:00.000Z'),
        createdAt: CREATED,
        expected: {
            status: 'DUE',
            slaBucket: 'OVERDUE_D1',
            overdueDays: 1,
            slaDueAt: '2026-10-09T12:00:00.000Z'
        }
    },
    {
        name: 'OPEN D3',
        latest: open('2026-10-07T12:00:00.000Z'),
        createdAt: CREATED,
        expected: {
            status: 'DUE',
            slaBucket: 'OVERDUE_D3',
            overdueDays: 3,
            slaDueAt: '2026-10-07T12:00:00.000Z'
        }
    },
    {
        name: 'OPEN D7',
        latest: open('2026-10-03T12:00:00.000Z'),
        createdAt: CREATED,
        expected: {
            status: 'DUE',
            slaBucket: 'OVERDUE_D7',
            overdueDays: 7,
            slaDueAt: '2026-10-03T12:00:00.000Z'
        }
    },
    {
        name: 'OPEN D14',
        latest: open('2026-09-26T12:00:00.000Z'),
        createdAt: CREATED,
        expected: {
            status: 'DUE',
            slaBucket: 'OVERDUE_D14',
            overdueDays: 14,
            slaDueAt: '2026-09-26T12:00:00.000Z'
        }
    },
    {
        name: 'WON terminal',
        latest: { outcome: 'WON', nextContactAt: null },
        createdAt: CREATED,
        expected: { status: 'WON', slaBucket: 'OK', overdueDays: 0, slaDueAt: null }
    }
];

describe('P0.1 getFollowUpState - tabela prawdy (10 wierszy)', () => {
    it.each(TRUTH)('$name', (row) => {
        expect(getFollowUpState(row.latest, row.createdAt, NOW)).toEqual(row.expected);
    });
});

describe('P0.1 terminale LOST/ABANDONED + NO_CONTACT zalegly', () => {
    it('LOST_COMPETITION/LOST_OTHER -> LOST/OK/0', () => {
        for (const outcome of ['LOST_COMPETITION', 'LOST_OTHER']) {
            expect(
                getFollowUpState(
                    { outcome, nextContactAt: '2026-10-01T00:00:00.000Z' },
                    CREATED,
                    NOW
                )
            ).toEqual({ status: 'LOST', slaBucket: 'OK', overdueDays: 0, slaDueAt: null });
        }
    });

    it('ABANDONED -> ABANDONED/OK/0', () => {
        expect(
            getFollowUpState({ outcome: 'ABANDONED', nextContactAt: null }, CREATED, NOW)
        ).toEqual({ status: 'ABANDONED', slaBucket: 'OK', overdueDays: 0, slaDueAt: null });
    });

    it('NO_CONTACT zalegly: status nie eskaluje, bucket z createdAt', () => {
        expect(getFollowUpState(null, '2026-10-05T12:00:00.000Z', NOW)).toEqual({
            status: 'NO_CONTACT',
            slaBucket: 'OVERDUE_D3',
            overdueDays: 5,
            slaDueAt: '2026-10-05T12:00:00.000Z'
        });
    });

    it('outcome NULL wiersza = semantyka OPEN', () => {
        expect(getStatus({ outcome: null, nextContactAt: null }, NOW)).toBe('DUE');
    });
});

describe('P0.1 getStatus/getSla + granice bucketow', () => {
    it('granice: 2->D1, 6->D3, 13->D7', () => {
        expect(getSla(open('2026-10-08T12:00:00.000Z'), CREATED, NOW)).toBe('OVERDUE_D1');
        expect(getSla(open('2026-10-04T12:00:00.000Z'), CREATED, NOW)).toBe('OVERDUE_D3');
        expect(getSla(open('2026-09-27T12:00:00.000Z'), CREATED, NOW)).toBe('OVERDUE_D7');
    });

    it('getStatus: null->NO_CONTACT, OPEN+future->OPEN_OK, WON->WON', () => {
        expect(getStatus(null, NOW)).toBe('NO_CONTACT');
        expect(getStatus(open('2026-10-15T09:00:00.000Z'), NOW)).toBe('OPEN_OK');
        expect(getStatus({ outcome: 'WON', nextContactAt: null }, NOW)).toBe('WON');
    });
});
