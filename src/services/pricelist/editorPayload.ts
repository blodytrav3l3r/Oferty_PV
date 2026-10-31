/**
 * Payload `GET /` edytora cennika: DRAFT → ACTIVE → seed fabryczny.
 *
 * `pricing.data === null` (fallback) znaczy „żadnej wersji nie ma", więc edytor
 * startuje z plików `data/seed_*.json`. `fromSeed` tłumaczy seed na kształt
 * odpowiedzi trasy (studnie: legacy, PRECO: `[nested]`).
 */
import type { ActivePricing } from './usage';

export function pickEditorData(pricing: ActivePricing, fromSeed: () => unknown): unknown {
    return pricing.fallback ? fromSeed() : pricing.data;
}
