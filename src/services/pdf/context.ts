import prisma from '../../prismaClient';
import { logger } from '../../utils/logger';
import { mapWellsToItems } from './helpers';
import { lookupOfferUsers } from './offerUsers';
import type { RuryOfferData, StudnieOfferData } from './types';
import type {
    RuryOfferDataBlob,
    StudnieOfferDataBlob,
    RuryOrderDataBlob,
    StudnieOrderDataBlob
} from '../../types/offerData';

const MAX_TRANSPORT_WEIGHT = 24000;

/**
 * Uzupełnia pozycje rur o kategorię produktu (pobierana z ProductsRury),
 * jeśli pozycja jej nie ma — frontend nie zapisuje `category` w items.
 */
async function enrichRuryItemsWithCategories(items: unknown[]): Promise<unknown[]> {
    const missingCategories = items.filter((it) => {
        const item = it as Record<string, unknown>;
        return !item.category && item.productId;
    });
    if (missingCategories.length === 0) return items;

    const productIds = missingCategories.map((it) =>
        String((it as { productId?: string }).productId)
    );
    const products = await prisma.productsRury.findMany({
        where: { id: { in: productIds } },
        select: { id: true, category: true }
    });
    const categoryById = new Map(products.map((p) => [p.id, p.category]));

    return items.map((it) => {
        const item = it as Record<string, unknown>;
        if (item.category) return item;
        const category = item.productId ? categoryById.get(String(item.productId)) : undefined;
        return category ? { ...item, category } : item;
    });
}

export async function buildRuryOfferContextFromOfferId(offerId: string): Promise<RuryOfferData> {
    const offer = await prisma.offers_rel.findUnique({
        where: { id: offerId }
    });

    if (!offer) {
        throw new Error('Oferta nie znaleziona');
    }

    let offerData: RuryOfferDataBlob = {};
    try {
        if (offer.data) offerData = JSON.parse(offer.data) as RuryOfferDataBlob;
    } catch (e) {
        logger.warn('PdfRury', 'Nie udało się sparsować danych oferty', e);
    }

    const items = await prisma.offer_items_rel.findMany({
        where: { offerId }
    });

    const enhancedItems: unknown[] = Array.isArray(offerData.items) ? offerData.items : items;
    const withCategories = await enrichRuryItemsWithCategories(enhancedItems);

    const client = offer.clientId
        ? await prisma.clients_rel.findUnique({ where: { id: offer.clientId } })
        : null;

    const { authorUser, guardianUser } = await lookupOfferUsers(offerData, offer.userId);

    return {
        offerNumber: offer.offer_number || 'N/A',
        clientName: String(client?.name ?? offerData.clientName ?? 'Klient niezidentyfikowany'),
        clientNip: String(client?.nip ?? offerData.clientNip ?? ''),
        clientAddress: String(client?.address ?? offerData.clientAddress ?? ''),
        clientPhone: String(offerData.clientContact ?? client?.contact ?? client?.phone ?? ''),
        investName: String(offerData.investName ?? ''),
        investAddress: String(offerData.investAddress ?? ''),
        investContractor: String(offerData.investContractor ?? ''),
        items: withCategories,
        createdAt: String(offerData.date ?? offer.createdAt ?? new Date().toISOString()),
        validityDays: Number(offerData.validityDays ?? 30),
        notes: String(offerData.notes ?? ''),
        paymentTerms: String(offerData.paymentTerms ?? ''),
        validity: String(offerData.validity ?? ''),
        authorUser,
        guardianUser
    };
}

export async function buildRuryOrderContextFromOrderId(orderId: string): Promise<RuryOfferData> {
    const order = await prisma.orders_rury_rel.findUnique({ where: { id: orderId } });
    if (!order) {
        throw new Error('Zamówienie rur nie znalezione');
    }

    let orderData: RuryOrderDataBlob = {};
    try {
        if (order.data) orderData = JSON.parse(order.data) as RuryOrderDataBlob;
    } catch (e) {
        logger.warn('PdfRury', 'Błąd parsowania order.data', e);
    }

    let items: unknown[] = [];
    if (Array.isArray(orderData.items)) {
        items = orderData.items;
    } else if (order.offerId) {
        const offerItems = await prisma.offer_items_rel.findMany({
            where: { offerId: order.offerId }
        });
        items = offerItems;
        if (!Array.isArray(orderData.items) && orderData.wells) {
            items = orderData.wells as unknown[];
        }
    }

    const client = orderData.clientId
        ? await prisma.clients_rel.findUnique({ where: { id: String(orderData.clientId) } })
        : null;

    const { authorUser, guardianUser } = await lookupOfferUsers(orderData, order.userId);

    const orderNumber = String(orderData.orderNumber ?? orderId.substring(0, 8));
    return {
        documentType: 'order',
        offerNumber: orderNumber,
        orderNumber,
        productionOrderNumber: String(orderData.productionOrderNumber ?? ''),
        orderStatus: String(orderData.status ?? 'confirmed'),
        clientName: String(client?.name ?? orderData.clientName ?? 'Klient niezidentyfikowany'),
        clientNip: String(client?.nip ?? orderData.clientNip ?? ''),
        clientAddress: String(client?.address ?? orderData.clientAddress ?? ''),
        clientPhone: String(
            orderData.clientContact ??
                client?.contact ??
                client?.phone ??
                orderData.clientPhone ??
                ''
        ),
        investName: String(orderData.investName ?? orderData.budowa ?? ''),
        investAddress: String(orderData.investAddress ?? ''),
        investContractor: String(orderData.investContractor ?? ''),
        items,
        createdAt: String(orderData.date ?? order.createdAt ?? new Date().toISOString()),
        validityDays: 0,
        notes: String(orderData.notes ?? ''),
        paymentTerms: String(orderData.paymentTerms ?? ''),
        validity: '',
        authorUser,
        guardianUser
    };
}

export async function buildStudnieOfferContextFromOfferId(
    offerId: string
): Promise<StudnieOfferData> {
    const offer = await prisma.offers_studnie_rel.findUnique({
        where: { id: offerId }
    });

    if (!offer) {
        throw new Error('Oferta studni nie znaleziona');
    }

    let offerData: StudnieOfferDataBlob = {};
    try {
        if (offer.data) offerData = JSON.parse(offer.data) as StudnieOfferDataBlob;
    } catch (e) {
        logger.warn('PdfStudnie', 'Nie udało się sparsować danych oferty', e);
    }

    let wells: unknown[] = [];
    if (Array.isArray(offerData.wellsExport)) {
        wells = offerData.wellsExport;
    } else if (Array.isArray(offerData.wells)) {
        wells = offerData.wells;
    }

    logger.info('PdfStudnie', `Generowanie PDF dla oferty ${offerId}`);
    logger.debug('PdfStudnie', `Znaleziono ${wells.length} studni w offer.data`);
    logger.debug('PdfStudnie', `Offer data keys: ${Object.keys(offerData).join(', ')}`);
    if (wells.length > 0) {
        logger.debug('PdfStudnie', 'Przykładowa studnia', wells[0]);
    }

    const transportKm = Number(offerData.transportKm ?? 0);
    const transportRate = Number(offerData.transportRate ?? 0);
    const totalWeight = Number(offerData.totalWeight ?? 0);
    let totalTransportCost = 0;
    if (transportKm > 0 && transportRate > 0) {
        const totalTransports = Math.ceil(totalWeight / MAX_TRANSPORT_WEIGHT);
        totalTransportCost = totalTransports * transportKm * transportRate;
    }

    const { items, grandTotal } = mapWellsToItems(wells);

    logger.debug('PdfStudnie', `Przygotowano ${items.length} items, grandTotal: ${grandTotal}`);

    const wellUwagi = (wells as Array<Record<string, unknown>>)
        .filter((w) => w.uwagi && String(w.uwagi).trim())
        .map((w) => ({
            name: String(w.name ?? '—'),
            dn: String(w.dn ?? ''),
            uwagi: String(w.uwagi)
        }));

    const client = offer.clientId
        ? await prisma.clients_rel.findUnique({ where: { id: offer.clientId } })
        : null;

    const { authorUser, guardianUser } = await lookupOfferUsers(offerData, offer.userId);

    return {
        offerNumber: offer.offer_number || 'N/A',
        clientName: String(client?.name ?? offerData.clientName ?? 'Klient niezidentyfikowany'),
        clientNip: String(client?.nip ?? offerData.clientNip ?? ''),
        clientAddress: String(client?.address ?? offerData.clientAddress ?? ''),
        clientPhone: String(
            offerData.clientContact ??
                client?.contact ??
                client?.phone ??
                offerData.clientPhone ??
                ''
        ),
        investName: String(offerData.investName ?? offerData.budowa ?? ''),
        investAddress: String(offerData.investAddress ?? ''),
        investContractor: String(offerData.investContractor ?? ''),
        items: items as StudnieOfferData['items'],
        transportCost: totalTransportCost,
        createdAt: String(offerData.date ?? offer.createdAt ?? new Date().toISOString()),
        validityDays: Number(offerData.validityDays ?? 30),
        notes: String(offerData.notes ?? ''),
        paymentTerms: String(offerData.paymentTerms ?? ''),
        validity: String(offerData.validity ?? ''),
        wellUwagi,
        authorUser,
        guardianUser
    };
}

export async function buildStudnieOrderContextFromOrderId(
    orderId: string
): Promise<StudnieOfferData> {
    const order = await prisma.orders_studnie_rel.findUnique({ where: { id: orderId } });
    if (!order) {
        throw new Error('Zamówienie studni nie znalezione');
    }

    let orderData: StudnieOrderDataBlob = {};
    try {
        if (order.data) orderData = JSON.parse(order.data) as StudnieOrderDataBlob;
    } catch (e) {
        logger.warn('PdfStudnie', 'Błąd parsowania order.data', e);
    }

    let wells: unknown[] = [];
    if (Array.isArray(orderData.wellsExport)) {
        wells = orderData.wellsExport;
    } else if (order.offerStudnieId) {
        const offer = await prisma.offers_studnie_rel.findUnique({
            where: { id: order.offerStudnieId }
        });
        if (offer?.data) {
            try {
                const parsed = JSON.parse(offer.data) as StudnieOfferDataBlob;
                if (Array.isArray(parsed.wellsExport)) wells = parsed.wellsExport;
            } catch (e) {
                logger.warn('PdfStudnie', 'Błąd parsowania offer.data (fallback)', e);
            }
        }
    }

    const transportKm = Number(orderData.transportKm ?? 0);
    const transportRate = Number(orderData.transportRate ?? 0);
    const totalWeight = Number(orderData.totalWeight ?? 0);
    const totalTransportCost =
        transportKm > 0 && transportRate > 0
            ? Math.ceil(totalWeight / MAX_TRANSPORT_WEIGHT) * transportKm * transportRate
            : 0;

    const { items } = mapWellsToItems(wells);
    const wellUwagi = (wells as Array<Record<string, unknown>>)
        .filter((w) => w.uwagi && String(w.uwagi).trim())
        .map((w) => ({
            name: String(w.name ?? '—'),
            dn: String(w.dn ?? ''),
            uwagi: String(w.uwagi)
        }));

    const client = orderData.clientId
        ? await prisma.clients_rel.findUnique({ where: { id: String(orderData.clientId) } })
        : null;

    const { authorUser, guardianUser } = await lookupOfferUsers(orderData, order.userId);

    const orderNumber = String(orderData.orderNumber ?? orderId.substring(0, 8));
    return {
        documentType: 'order',
        offerNumber: orderNumber,
        orderNumber,
        productionOrderNumber: String(orderData.productionOrderNumber ?? ''),
        orderStatus: String(orderData.status ?? 'confirmed'),
        clientName: String(client?.name ?? orderData.clientName ?? 'Klient niezidentyfikowany'),
        clientNip: String(client?.nip ?? orderData.clientNip ?? ''),
        clientAddress: String(client?.address ?? orderData.clientAddress ?? ''),
        clientPhone: String(
            orderData.clientContact ??
                client?.contact ??
                client?.phone ??
                orderData.clientPhone ??
                ''
        ),
        investName: String(orderData.investName ?? orderData.budowa ?? ''),
        investAddress: String(orderData.investAddress ?? ''),
        investContractor: String(orderData.investContractor ?? ''),
        items: items as StudnieOfferData['items'],
        transportCost: totalTransportCost,
        createdAt: String(orderData.date ?? order.createdAt ?? new Date().toISOString()),
        validityDays: 0,
        notes: String(orderData.notes ?? ''),
        paymentTerms: String(orderData.paymentTerms ?? ''),
        validity: '',
        wellUwagi,
        authorUser,
        guardianUser
    };
}
