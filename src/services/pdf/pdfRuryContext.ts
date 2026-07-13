import prisma from '../../prismaClient';
import { logger } from '../../utils/logger';
import { lookupOfferUsers, RuryOfferData } from './pdfHelpers';

export async function buildRuryOfferContextFromOfferId(offerId: string): Promise<RuryOfferData> {
    const offer = await prisma.offers_rel.findUnique({ where: { id: offerId } });
    if (!offer) throw new Error('Oferta nie znaleziona');

    let offerData: Record<string, unknown> = {};
    try {
        if (offer.data) offerData = JSON.parse(offer.data) as Record<string, unknown>;
    } catch (e) {
        logger.warn('PdfRury', 'Nie udało się sparsować danych oferty', e);
    }

    const items = await prisma.offer_items_rel.findMany({ where: { offerId } });
    const enhancedItems = (Array.isArray(offerData.items) ? offerData.items : items) as Record<
        string,
        unknown
    >[];

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
        items: enhancedItems,
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
    if (!order) throw new Error('Zamówienie rur nie znalezione');

    let orderData: Record<string, unknown> = {};
    try {
        if (order.data) orderData = JSON.parse(order.data) as Record<string, unknown>;
    } catch (e) {
        logger.warn('PdfRury', 'Błąd parsowania order.data', e);
    }

    let items: Record<string, unknown>[] = [];
    if (Array.isArray(orderData.items)) {
        items = orderData.items as Record<string, unknown>[];
    } else if (order.offerId) {
        const offerItems = await prisma.offer_items_rel.findMany({
            where: { offerId: order.offerId }
        });
        items = offerItems as Record<string, unknown>[];
        if (!Array.isArray(orderData.items) && orderData.wells) {
            items = orderData.wells as Record<string, unknown>[];
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
