/**
 * Pieczątka cennika dla nowo tworzonych zamówień.
 *
 * Zamówienie dziedziczy pieczęć powiązanej oferty (ceny, które widział klient),
 * a bez oferty — aktualnie obowiązujący cennik (`resolveActive`, pin admina).
 * Wartość z body jest ignorowana, więc klient nie wstrzyknie dowolnej wersji.
 */

import prisma from '../prismaClient';
import { resolveVersionIdSafe } from '../services/pricelist/usage';
import { logger } from './logger';

export type OrderStampType = 'rury' | 'studnie';

export interface OrderStamps {
    /** Pieczątka oferty: id → wersja (null = oferta legacy, bez wersji). */
    byOffer: Map<string, string | null>;
    /** Fallback dla zamówień bez powiązanej oferty (albo oferta usunięta). */
    fallback: string | null;
}

/** Jedno zapytanie na batch + jeden odczyt aktywnej wersji — bez N+1. */
export async function loadOrderStamps(
    type: OrderStampType,
    offerIds: string[]
): Promise<OrderStamps> {
    const unique = [...new Set(offerIds.filter((id) => id !== ''))];
    const byOffer = new Map<string, string | null>();
    if (unique.length > 0) {
        const where = { id: { in: unique } };
        const select = { id: true, pricelistVersionId: true };
        try {
            const rows =
                type === 'rury'
                    ? await prisma.offers_rel.findMany({ where, select })
                    : await prisma.offers_studnie_rel.findMany({ where, select });
            for (const row of rows) byOffer.set(row.id, row.pricelistVersionId ?? null);
        } catch (e) {
            // Pieczątka to metadana — brak odczytu nie może blokować zapisu zamówienia.
            logger.warn(
                'Orders',
                'loadOrderStamps: błąd odczytu pieczątki oferty — fallback na aktywny cennik',
                String(e)
            );
        }
    }
    return { byOffer, fallback: await resolveVersionIdSafe(type) };
}

/** Pieczątka dla jednego zamówienia: oferta (jeśli znana), inaczej aktywny cennik. */
export function stampForOrder(stamps: OrderStamps, offerId: string): string | null {
    if (offerId) {
        const fromOffer = stamps.byOffer.get(offerId);
        if (fromOffer !== undefined) return fromOffer;
    }
    return stamps.fallback;
}
