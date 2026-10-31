/**
 * Etap 1 konsolidacji: LIVE jest zamrożone (tylko odczyt), każdy zapis idzie do
 * wersji. Typ `live` zostaje do etapu 2 (usunięcie tabel LIVE), ale żadna ścieżka
 * go już nie zwraca.
 */
import prisma from '../../prismaClient';
import { createDraft, replaceVersionRows, updateDraft } from './lifecycle';
import { pricingFromVersion, resolveActivePricing } from './usage';
import { requireType } from './validation';
import { PricelistVersionError } from './validation';
import type { ActivePricing } from './usage';
import type { PricelistType } from './validation';

export type PricelistWriteTarget = 'live' | 'draft';

/**
 * `If-Match: "<sha256>"` → sha256 szkicu. Brak nagłówka / `*` = brak kontroli
 * (kompatybilność ze starymi klientami). Słabe walidatory (`W/"…"`) odrzucamy
 * jak mocne — i tak porównujemy dokładny hash.
 */
export function parseIfMatch(header: unknown): string | undefined {
    if (typeof header !== 'string') return undefined;
    const value = header.trim().replace(/^W\//, '').replace(/^"|"$/g, '');
    return value.length > 0 && value !== '*' ? value : undefined;
}

/**
 * `X-Pricelist-Version-Id: <id>` → jawna edycja opublikowanej wersji.
 * Brak nagłówka = null (zwykły zapis szkicu/LIVE). Zły format → 400.
 */
export function parseVersionIdHeader(header: unknown): string | null {
    if (header === undefined || header === null) return null;
    const value = typeof header === 'string' ? header.trim() : '';
    if (value.length === 0) return null;
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(value)) {
        throw new PricelistVersionError(400, 'INVALID_ID', 'Nieprawidłowy identyfikator wersji');
    }
    return value;
}

/**
 * Zapis do LIVE jest wyłączony na stałe (etap 1). Zmienna
 * `PRICELIST_WRITE_TARGET` została usunięta — nie ma trybu, w którym aplikacja
 * pisze do tabel LIVE; zostaje tylko CLI importu ze snapshotu.
 */
export function getPricelistWriteTarget(): PricelistWriteTarget {
    return 'draft';
}

/** Najnowszy DRAFT typu albo null (jeden DRAFT na typ — indeks częściowy). */
export async function findLatestDraft(typeInput: unknown) {
    const type = requireType(typeInput);
    return prisma.pricelistVersion.findFirst({
        where: { type, status: 'DRAFT' },
        // Tie-breaker: dwa szkice z tej samej milisekundy nie mogą wybrać losowo.
        orderBy: [{ createdAt: 'desc' }, { seq: 'desc' }]
    });
}

/** Zapis wierszy do draftu: wznów istniejący DRAFT albo utwórz nowy. */
/**
 * Zapis wierszy z edytora: `versionId` = jawna edycja opublikowanej wersji
 * (w miejscu, z ostrzeżeniem), brak = dotychczasowy szkic typu.
 */
export async function saveRowsToDraft(
    typeInput: unknown,
    rows: unknown,
    userId?: string,
    expectedSha?: string,
    versionId?: string
) {
    const type = requireType(typeInput);
    if (versionId) return replaceVersionRows(versionId, rows, { userId, expectedSha });
    const draft = await findLatestDraft(type);
    if (draft) return updateDraft(draft.id, rows, undefined, { userId, expectedSha });
    return createDraft(type, rows, { createdBy: userId });
}

/**
 * Wiersze dla edytora admina: DRAFT -> ACTIVE -> null (trasa czyta LIVE).
 * `fallback` = brak jakiejkolwiek wersji (zachowanie jak resolveActivePricing).
 */
export async function getEditorPricing(typeInput: unknown): Promise<ActivePricing> {
    const type: PricelistType = requireType(typeInput);
    const draft = await findLatestDraft(type);
    if (draft) return pricingFromVersion(type, draft);
    return resolveActivePricing(type);
}
