/**
 * S5: cel zapisu cennika. `live` = stare tabele LIVE (rollback), `draft` =
 * najnowszy DRAFT danego typu (domyślnie po S5).
 */
import prisma from '../../prismaClient';
import { logger } from '../../utils/logger';
import { createDraft, updateDraft } from './lifecycle';
import { pricingFromVersion, resolveActivePricing } from './usage';
import { requireType } from './validation';
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

let warnedLive = false;

export function getPricelistWriteTarget(): PricelistWriteTarget {
    // S5: domyślnie draft; rollback bez zmiany kodu = PRICELIST_WRITE_TARGET=live.
    if (process.env.PRICELIST_WRITE_TARGET !== 'live') return 'draft';
    // Rollback: zapis wraca do tabel LIVE, ale oferty dalej czytają wersje ACTIVE.
    if (!warnedLive) {
        warnedLive = true;
        logger.warn(
            'pricelist',
            'PRICELIST_WRITE_TARGET=live — zapis trafia do tabel LIVE, oferty czytają ACTIVE (split-brain)'
        );
    }
    return 'live';
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
export async function saveRowsToDraft(
    typeInput: unknown,
    rows: unknown,
    userId?: string,
    expectedSha?: string
) {
    const type = requireType(typeInput);
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
