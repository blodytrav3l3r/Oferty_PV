/**
 * Rozliczenie transportu rur na backendzie (PDF/DOCX) — lustro frontendu
 * (`calculateTransportDistribution` w `public/js/rury/transport.js`).
 *
 * - `transportSeparate = true` → koszt jako osobny wiersz TR-RURY.
 * - `transportSeparate = false` → koszt wliczony w pozycje, proporcjonalnie
 *   do wagi (pozycje `autoAdded` pomijane, jak na frontendzie).
 */

const MAX_TRANSPORT_WEIGHT = 24000;

/** Flaga osobnej pozycji transportu (DB trzyma boolean | 1 | '1'). */
export function isRuryTransportSeparateFlag(value: unknown): boolean {
    return value === true || value === 1 || value === '1';
}

/**
 * Dzieli całkowity koszt transportu na pozycje proporcjonalnie do wagi.
 * Zwraca tablicę udziałów równoległą do `items` (suma udziałów = total).
 * Same zera gdy brak kosztu albo brak wagi do podziału.
 */
export function distributeRuryTransportCost(
    items: Array<Record<string, unknown>>,
    transportTotal: number
): number[] {
    const total = Number(transportTotal) || 0;
    const shares = items.map(() => 0);
    if (!(total > 0)) return shares;
    let totalWeight = 0;
    const weights = items.map((it) => {
        if (it.autoAdded) return 0;
        const w = Number(it.weight ?? 0);
        const q = Number(it.quantity ?? 0);
        const tw = w > 0 && q > 0 ? w * q : 0;
        totalWeight += tw;
        return tw;
    });
    if (!(totalWeight > 0)) return shares;
    return weights.map((tw) => (tw / totalWeight) * total);
}

/**
 * Całkowity koszt transportu z zapisanych pól oferty/zamówienia, z fallbackiem
 * wagowym (zamówienia nie trzymają licznika) — ten sam wzór co
 * `resolveRuryTransport` w DOCX i kontekst PDF.
 */
export function resolveRuryTransportTotal(
    offerData: Record<string, unknown>,
    items: Array<Record<string, unknown>>
): number {
    const stored = Number(offerData.transportCost ?? 0);
    if (stored > 0) return stored;
    const perTrip = Number(offerData.transportCostPerTrip ?? 0);
    if (!(perTrip > 0)) return 0;
    let weight = 0;
    for (const it of items) {
        if (it.autoAdded) continue;
        const w = Number(it.weight ?? 0);
        const q = Number(it.quantity ?? 0);
        if (w > 0 && q > 0) weight += w * q;
    }
    if (!(weight > 0)) return 0;
    const mode = String(offerData.transportMode ?? 'full');
    const trips =
        mode === 'fractional'
            ? weight / MAX_TRANSPORT_WEIGHT
            : Math.ceil(weight / MAX_TRANSPORT_WEIGHT);
    return trips * perTrip;
}
