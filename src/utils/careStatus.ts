/**
 * Opieka P0 - czysty kontrakt statusu follow-up.
 * SSoT: docs/plans/opieka-monitoring-przypomnienia-p0.md sekcja 3.
 *
 * latest = wiersz wybrany ORDER BY contactedAt DESC, createdAt DESC, id DESC
 * (jak followUpColumnsSql w searchUtils.ts i CTE w followUpStats.ts).
 * Daty: String ISO UTC; granica minelo/nie-minelo leksykograficznie
 * (jak followUpHealth), overdueDays = floor((now - due) / 86400).
 */
export type FollowUpStatus = 'NO_CONTACT' | 'OPEN_OK' | 'DUE' | 'WON' | 'LOST' | 'ABANDONED';
export type SlaBucket =
    'OK' | 'DUE_TODAY' | 'OVERDUE_D1' | 'OVERDUE_D3' | 'OVERDUE_D7' | 'OVERDUE_D14';

export interface LatestFu {
    outcome: string | null;
    nextContactAt: string | null;
}

export interface FollowUpState {
    status: FollowUpStatus;
    slaBucket: SlaBucket;
    overdueDays: number;
    slaDueAt: string | null;
}

const DAY_MS = 86400000;

/** Terminal -> status albo null (= sciezka OPEN; nie chowamy nieznanego w zamkniety). */
function mapTerminal(outcome: string): FollowUpStatus | null {
    if (outcome === 'WON') return 'WON';
    if (outcome === 'ABANDONED') return 'ABANDONED';
    if (outcome === 'LOST_COMPETITION' || outcome === 'LOST_OTHER') return 'LOST';
    return null;
}

function sameUtcDay(aIso: string, bIso: string): boolean {
    return aIso.slice(0, 10) === bIso.slice(0, 10);
}

function bucketForOverdueDays(days: number): SlaBucket {
    if (days <= 0) return 'DUE_TODAY';
    if (days <= 2) return 'OVERDUE_D1';
    if (days <= 6) return 'OVERDUE_D3';
    if (days <= 13) return 'OVERDUE_D7';
    return 'OVERDUE_D14';
}

function overdueDaysBetween(dueIso: string, nowIso: string): number {
    const days = Math.floor((Date.parse(nowIso) - Date.parse(dueIso)) / DAY_MS);
    return Number.isNaN(days) ? 0 : Math.max(0, days);
}

function isNoNext(next: string | null): boolean {
    return next === null || Number.isNaN(Date.parse(next));
}

export function getStatus(latest: LatestFu | null, nowIso: string): FollowUpStatus {
    if (latest === null) return 'NO_CONTACT';
    const terminal = mapTerminal(latest.outcome ?? 'OPEN');
    if (terminal !== null) return terminal;
    const next = latest.nextContactAt;
    if (isNoNext(next)) return 'DUE';
    return (next as string) > nowIso ? 'OPEN_OK' : 'DUE';
}

export function getSla(latest: LatestFu | null, offerCreatedAt: string, nowIso: string): SlaBucket {
    return getFollowUpState(latest, offerCreatedAt, nowIso).slaBucket;
}

export function getFollowUpState(
    latest: LatestFu | null,
    offerCreatedAt: string,
    nowIso: string
): FollowUpState {
    if (latest === null) {
        const overdueDays = overdueDaysBetween(offerCreatedAt, nowIso);
        return {
            status: 'NO_CONTACT',
            slaBucket: bucketForOverdueDays(overdueDays),
            overdueDays,
            slaDueAt: offerCreatedAt
        };
    }
    const terminal = mapTerminal(latest.outcome ?? 'OPEN');
    if (terminal !== null) {
        return { status: terminal, slaBucket: 'OK', overdueDays: 0, slaDueAt: null };
    }
    const next = latest.nextContactAt;
    if (isNoNext(next)) {
        return { status: 'DUE', slaBucket: 'DUE_TODAY', overdueDays: 0, slaDueAt: null };
    }
    const due = next as string;
    if (due > nowIso) {
        return {
            status: 'OPEN_OK',
            slaBucket: sameUtcDay(due, nowIso) ? 'DUE_TODAY' : 'OK',
            overdueDays: 0,
            slaDueAt: due
        };
    }
    const overdueDays = overdueDaysBetween(due, nowIso);
    return {
        status: 'DUE',
        slaBucket: bucketForOverdueDays(overdueDays),
        overdueDays,
        slaDueAt: due
    };
}
