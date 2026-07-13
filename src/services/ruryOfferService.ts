import prisma from '../prismaClient';
import { OfferMapped } from '../types/models';

export const ALLOWED_SORT_COLS: Record<string, string> = {
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
    offer_number: 'offer_number'
};
export const ALLOWED_SORT_DIRS: Record<string, 'asc' | 'desc'> = {
    asc: 'asc',
    desc: 'desc'
};

export function parseOfferDate(raw: unknown): string {
    if (typeof raw === 'number') return new Date(raw).toISOString();
    if (raw instanceof Date) return raw.toISOString();
    if (typeof raw === 'string') {
        if (/^\d{13}$/.test(raw)) return new Date(Number(raw)).toISOString();
        return raw;
    }
    return new Date().toISOString();
}

export async function mapOffersWithItems(
    offers: Array<Record<string, unknown>>
): Promise<OfferMapped[]> {
    const offerIds = offers.map((o) => o.id as string);
    const allItemsRaw = await prisma.offer_items_rel.findMany({
        where: { offerId: { in: offerIds } }
    });
    const itemsByOffer = new Map<string, typeof allItemsRaw>();
    for (const item of allItemsRaw) {
        if (!item.offerId) continue;
        const arr = itemsByOffer.get(item.offerId) || [];
        arr.push(item);
        itemsByOffer.set(item.offerId, arr);
    }

    const mapped: OfferMapped[] = [];
    for (const offer of offers) {
        const itemsRaw = itemsByOffer.get(offer.id as string) || [];
        const items = itemsRaw.map((i) => ({
            id: i.id,
            productId: i.productId,
            quantity: i.quantity,
            discount: i.discount,
            price: i.price,
            unitPrice: i.price ?? 0
        }));

        let ruryHistory: unknown[] = [];
        try {
            ruryHistory = JSON.parse(String(offer.history || '[]'));
        } catch {
            ruryHistory = [];
        }
        let rurySpread: Record<string, unknown> = {};
        if (offer.data) {
            try {
                rurySpread = JSON.parse(String(offer.data));
            } catch {
                rurySpread = {};
            }
        }

        mapped.push({
            id: offer.id as string,
            type: 'offer',
            userId: offer.userId as string | null,
            title: `Oferta ${offer.offer_number || offer.id}`,
            price: items.reduce((sum, i) => sum + (i.price ?? 0) * (i.quantity ?? 0), 0),
            status: offer.state === 'final' ? 'active' : 'draft',
            createdAt: (offer.createdAt as string) || null,
            updatedAt: (offer.updatedAt as string) || (offer.createdAt as string) || null,
            lastEditedBy: offer.userId as string | null,
            ...rurySpread,
            items,
            transportCost: (offer.transportCost as number) || 0,
            history: ruryHistory
        });
    }
    return mapped;
}

export async function createOfferItems(
    offerId: string,
    items: Array<{
        id?: string;
        productId: string;
        quantity: number;
        discount: number;
        price: number;
        unitPrice?: number;
    }>,
    uuidv4: () => string
) {
    for (const item of items) {
        const itemId = item.id || uuidv4();
        const itemPrice = item.unitPrice !== undefined ? item.unitPrice : item.price || 0;
        await prisma.offer_items_rel.create({
            data: {
                id: itemId,
                offerId,
                productId: item.productId,
                quantity: item.quantity || 0,
                discount: item.discount || 0,
                price: itemPrice
            }
        });
    }
}
