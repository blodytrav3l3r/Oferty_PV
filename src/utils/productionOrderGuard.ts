/**
 * ProductionOrderGuard — blokady usuwania powiązanych zleceń produkcyjnych (PZ).
 *
 * PZ (production_orders_rel) nie mają relacji Prisma — klucze są logiczne:
 *  - PZ przypisane do zamówienia studni: orderId (indeks) + legacy (pusty orderId) po data.offerId
 *  - PZ przypisane do oferty studni: przez zamówienia oferty (offerStudnieId) + legacy po data.offerId
 */
import prisma from '../prismaClient';

type CountRow = Array<{ cnt: number | bigint }>;

// PZ przypisane do zamówienia studni: bezpośrednio po orderId (indeks) + legacy PZ (pusty orderId) po data.offerId
export async function countProductionOrdersForOrder(
    orderId: string,
    offerId?: string
): Promise<number> {
    const rows = await prisma.$queryRaw<CountRow>`
        SELECT COUNT(*) as cnt FROM production_orders_rel
        WHERE "orderId" = ${orderId}
           OR (${offerId || ''} <> ''
               AND ("orderId" IS NULL OR "orderId" = '')
               AND json_extract(data, '$.offerId') = ${offerId || ''})`;
    return Number(rows?.[0]?.cnt ?? 0);
}

// PZ dla oferty studni: przez zamówienia oferty (offerStudnieId) + legacy PZ po data.offerId
export async function hasProductionOrdersForOffer(offerId: string): Promise<boolean> {
    const rows = await prisma.$queryRaw<CountRow>`
        SELECT COUNT(*) as cnt
        FROM production_orders_rel po
        WHERE po."orderId" IN (SELECT o.id FROM orders_studnie_rel o WHERE o."offerStudnieId" = ${offerId})
           OR json_extract(po.data, '$.offerId') = ${offerId}`;
    return Number(rows?.[0]?.cnt ?? 0) > 0;
}
