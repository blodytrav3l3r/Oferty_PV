/**
 * S5: cel zapisu cennika. `live` = stare tabele LIVE (rollback), `draft` =
 * najnowszy DRAFT danego typu (domyślnie po S5).
 */
import prisma from '../../prismaClient';
import { createDraft, updateDraft } from './lifecycle';
import { pricingFromVersion, resolveActivePricing } from './usage';
import { requireType } from './validation';
import type { ActivePricing } from './usage';
import type { PricelistType } from './validation';

export type PricelistWriteTarget = 'live' | 'draft';

export function getPricelistWriteTarget(): PricelistWriteTarget {
    // S5: domyślnie draft; rollback bez zmiany kodu = PRICELIST_WRITE_TARGET=live.
    return process.env.PRICELIST_WRITE_TARGET === 'live' ? 'live' : 'draft';
}

/** Najnowszy DRAFT typu albo null (jeden DRAFT na typ w praktyce). */
export async function findLatestDraft(typeInput: unknown) {
    const type = requireType(typeInput);
    return prisma.pricelistVersion.findFirst({
        where: { type, status: 'DRAFT' },
        orderBy: { createdAt: 'desc' }
    });
}

/** Zapis wierszy do draftu: wznów istniejący DRAFT albo utwórz nowy. */
export async function saveRowsToDraft(typeInput: unknown, rows: unknown, userId?: string) {
    const type = requireType(typeInput);
    const draft = await findLatestDraft(type);
    if (draft) return updateDraft(draft.id, rows, undefined, { userId });
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
