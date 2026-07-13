import prisma from '../../prismaClient';
import { logger } from '../../utils/logger';
import { MAX_TRANSPORT_WEIGHT } from './pdfStyles';
import { lookupOfferUsers, StudnieOfferData } from './pdfHelpers';

export async function buildStudnieOfferContextFromOfferId(
    offerId: string
): Promise<StudnieOfferData> {
    const offer = await prisma.offers_studnie_rel.findUnique({ where: { id: offerId } });
    if (!offer) throw new Error('Oferta studni nie znaleziona');

    let offerData: Record<string, unknown> = {};
    try {
        if (offer.data) offerData = JSON.parse(offer.data) as Record<string, unknown>;
    } catch (e) {
        logger.warn('PdfStudnie', 'Nie udało się sparsować danych oferty', e);
    }

    let wells: unknown[] = [];
    if (offerData.wellsExport && Array.isArray(offerData.wellsExport)) {
        wells = offerData.wellsExport;
    } else if (offerData.wells && Array.isArray(offerData.wells)) {
        wells = offerData.wells;
    }

    const transportKm = Number(offerData.transportKm ?? 0);
    const transportRate = Number(offerData.transportRate ?? 0);
    const totalWeight = Number(offerData.totalWeight ?? 0);
    let totalTransportCost = 0;
    if (transportKm > 0 && transportRate > 0) {
        const totalTransports = Math.ceil(totalWeight / MAX_TRANSPORT_WEIGHT);
        totalTransportCost = totalTransports * transportKm * transportRate;
    }

    const itemsByDN: Record<string, Record<string, unknown>[]> = {};
    (wells as Record<string, unknown>[]).forEach((w) => {
        const dn = String(w.dn ?? 'Inne');
        const wellPrice = Number(w.totalPrice ?? w.price ?? 0);
        if (!itemsByDN[dn]) itemsByDN[dn] = [];
        itemsByDN[dn].push({
            productName: String(w.name ?? `Studnia DN${dn}`),
            quantity: 1,
            price: wellPrice,
            DN: dn,
            height: Number(w.height ?? 0),
            zwienczenie: String(w.zwienczenie ?? '\u2014'),
            transportCost: Number(w.transportCost ?? 0)
        });
    });

    const items = Object.values(itemsByDN).flat();

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
        items: items as StudnieOfferData['items'],
        transportCost: totalTransportCost,
        createdAt: String(offerData.date ?? offer.createdAt ?? new Date().toISOString()),
        validityDays: Number(offerData.validityDays ?? 30),
        notes: String(offerData.notes ?? ''),
        paymentTerms: String(offerData.paymentTerms ?? ''),
        validity: String(offerData.validity ?? ''),
        authorUser,
        guardianUser
    };
}

export async function buildStudnieOrderContextFromOrderId(
    orderId: string
): Promise<StudnieOfferData> {
    const order = await prisma.orders_studnie_rel.findUnique({ where: { id: orderId } });
    if (!order) throw new Error('Zamówienie studni nie znalezione');

    let orderData: Record<string, unknown> = {};
    try {
        if (order.data) orderData = JSON.parse(order.data) as Record<string, unknown>;
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
                const offerData = JSON.parse(offer.data) as Record<string, unknown>;
                if (Array.isArray(offerData.wellsExport)) wells = offerData.wellsExport;
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

    const itemsByDN: Record<string, Record<string, unknown>[]> = {};
    (wells as Record<string, unknown>[]).forEach((w) => {
        const dn = String(w.dn ?? 'Inne');
        const wellPrice = Number(w.totalPrice ?? w.price ?? 0);
        if (!itemsByDN[dn]) itemsByDN[dn] = [];
        itemsByDN[dn].push({
            productName: String(w.name ?? `Studnia DN${dn}`),
            quantity: 1,
            price: wellPrice,
            DN: dn,
            height: Number(w.height ?? 0),
            zwienczenie: String(w.zwienczenie ?? '\u2014'),
            transportCost: Number(w.transportCost ?? 0)
        });
    });
    const items = Object.values(itemsByDN).flat();

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
        items: items as StudnieOfferData['items'],
        transportCost: totalTransportCost,
        createdAt: String(orderData.date ?? order.createdAt ?? new Date().toISOString()),
        validityDays: 0,
        notes: String(orderData.notes ?? ''),
        paymentTerms: String(orderData.paymentTerms ?? ''),
        validity: '',
        authorUser,
        guardianUser
    };
}
