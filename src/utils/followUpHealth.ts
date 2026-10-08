/**
 * Opieka nad ofertą — jedna funkcja domenowa zdrowia follow-up.
 * Używają jej API (P0.4), Kartoteka i Pulpit (P1/P2) — progi w jednym miejscu.
 *
 * Semantyka (lustro warunków SQL w buildFollowUpConditions):
 *   closed   — outcome terminalny (WON / LOST_* / ABANDONED)
 *   overdue  — OPEN/brak wyniku i nextContactAt minął
 *   due      — OPEN/brak wyniku i brak zaplanowanego kontaktu
 *   scheduled — OPEN i nextContactAt w przyszłości
 *
 * Porównanie leksykograficzne działa dla ISO-8601 UTC (P0.3 normalizuje
 * contactedAt/nextContactAt do UTC przy zapisie).
 */
export type FollowUpHealth = 'due' | 'scheduled' | 'overdue' | 'closed';

export function calculateFollowUpHealth(
    outcome: string | null | undefined,
    nextContactAt: string | null | undefined,
    nowIso: string = new Date().toISOString()
): FollowUpHealth {
    if (outcome && outcome !== 'OPEN') return 'closed';
    if (!nextContactAt) return 'due';
    return nextContactAt <= nowIso ? 'overdue' : 'scheduled';
}
