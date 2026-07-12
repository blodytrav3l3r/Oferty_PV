import prisma from '../prismaClient';
import { logger } from '../utils/logger';
import { MAX_TRANSPORT_WEIGHT } from './pdf/pdfStyles';
import { UserContactInfo, RuryOfferData, StudnieOfferData } from './pdf/pdfHelpers';
import { generateRuryHTML } from './pdf/pdfRuryBuilder';
import { generateStudnieHTML, generatePDF } from './pdf/pdfStudnieBuilder';

/**
 * Generuje PDF oferty rur na podstawie danych z bazy.
 *
 * Pobiera ofertę z bazy danych, wczytuje dane JSON z oferty (offers_rel.data),
 * pobiera dane klienta, autora i opiekuna, następnie generuje HTML z szablonu
 * ofertaRury.html i renderuje go do PDF używając Puppeteer.
 *
 * @param offerId - ID oferty w bazie danych
 * @returns Buffer zawierający wygenerowany PDF
 * @throws Error gdy oferta nie zostanie znaleziona
 */
export async function generateOfferRuryPDF(offerId: string): Promise<Buffer> {
    const ctx = await buildRuryOfferContextFromOfferId(offerId);
    return generateRuryPDFFromContext(ctx);
}

/**
 * Buduje kontekst oferty rur (RuryOfferData) z ID oferty w bazie.
 * Wspólne dla endpointu /export-pdf oferty oraz wewnętrznych wywołań.
 */
export async function buildRuryOfferContextFromOfferId(offerId: string): Promise<RuryOfferData> {
    const offer = await prisma.offers_rel.findUnique({
        where: { id: offerId }
    });

    if (!offer) {
        throw new Error('Oferta nie znaleziona');
    }

    let offerData: Record<string, unknown> = {};
    try {
        if (offer.data) offerData = JSON.parse(offer.data) as Record<string, unknown>;
    } catch (e) {
        logger.warn('PdfRury', 'Nie udało się sparsować danych oferty', e);
    }

    const items = await prisma.offer_items_rel.findMany({
        where: { offerId }
    });

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

/**
 * Buduje kontekst ZAMÓWIENIA rur (RuryOfferData z documentType='order')
 * z ID zamówienia w bazie. Czyta z orders_rury_rel, z fallbackiem na
 * offers_rel dla items (gdy w order.data brak pełnych pozycji z cenami).
 */
export async function buildRuryOrderContextFromOrderId(orderId: string): Promise<RuryOfferData> {
    const order = await prisma.orders_rury_rel.findUnique({ where: { id: orderId } });
    if (!order) {
        throw new Error('Zamówienie rur nie znalezione');
    }

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

/**
 * Generuje PDF ZAMÓWIENIA rur (wariant oferty) na podstawie orderId.
 */
export async function generateRuryOrderPDF(orderId: string): Promise<Buffer> {
    const ctx = await buildRuryOrderContextFromOrderId(orderId);
    return generateRuryPDFFromContext(ctx);
}

/**
 * Generuje PDF oferty rur z gotowego kontekstu (RuryOfferData).
 * Używane zarówno przez /export-pdf oferty (po zbudowaniu kontekstu z DB),
 * jak i przez endpoint /export-offer-pdf zamówienia (po zbudowaniu z payloadu klienta).
 */
export async function generateRuryPDFFromContext(data: RuryOfferData): Promise<Buffer> {
    const html = await generateRuryHTML(data);
    return generatePDF(html);
}

/**
 * Generuje PDF oferty studni używając szablonu ofertaStudnie.html.
 *
 * Oferty studni przechowują dane w polu JSON `data`, w tym:
 * - `wellsExport` - studnie z obliczonymi cenami (priorytet)
 * - `wells` - surowe dane studni (fallback)
 * - `transportKm`, `transportRate`, `totalWeight` - dane transportu
 *
 * Funkcja grupuje studnie po średnicy DN, oblicza koszty transportu
 * i generuje kompletny dokument PDF z danymi klienta oraz opiekunów.
 *
 * @param offerId - ID oferty studni w bazie danych
 * @returns Buffer zawierający wygenerowany PDF
 * @throws Error gdy oferta nie zostanie znaleziona
 *
 * @example
 * ```ts
 * const pdfBuffer = await generateOfferStudniePDF('studnie-456');
 * res.setHeader('Content-Type', 'application/pdf');
 * res.send(pdfBuffer);
 * ```
 */
export async function generateOfferStudniePDF(offerId: string): Promise<Buffer> {
    const ctx = await buildStudnieOfferContextFromOfferId(offerId);
    return generateStudniePDFFromContext(ctx);
}

/**
 * Generuje PDF oferty studni z gotowego kontekstu (StudnieOfferData).
 * Używane zarówno przez /export-pdf oferty (po zbudowaniu kontekstu z DB),
 * jak i przez endpoint /export-offer-pdf zamówienia (po zbudowaniu z payloadu klienta).
 */
export async function generateStudniePDFFromContext(data: StudnieOfferData): Promise<Buffer> {
    const html = await generateStudnieHTML(data);
    return generatePDF(html);
}

/**
 * Buduje kontekst StudnieOfferData z oferty w bazie danych.
 * Wyodrębnione z generateOfferStudniePDF, żeby umożliwić
 * generowanie PDF/DOCX z już-zbudowanego kontekstu (np. z payloadu klienta).
 */
export async function buildStudnieOfferContextFromOfferId(
    offerId: string
): Promise<StudnieOfferData> {
    const offer = await prisma.offers_studnie_rel.findUnique({
        where: { id: offerId }
    });

    if (!offer) {
        throw new Error('Oferta studni nie znaleziona');
    }

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

    const itemsByDN: Record<string, Record<string, unknown>[]> = {};
    let grandTotal = 0;

    wells.forEach((w) => {
        const well = w as Record<string, unknown>;
        const dn = String(well.dn ?? 'Inne');
        const wellPrice = Number(well.totalPrice ?? well.price ?? 0);
        grandTotal += wellPrice;

        if (!itemsByDN[dn]) itemsByDN[dn] = [];
        itemsByDN[dn].push({
            productName: String(well.name ?? `Studnia DN${dn}`),
            quantity: 1,
            price: wellPrice,
            DN: dn,
            height: Number(well.height ?? 0),
            zwienczenie: String(well.zwienczenie ?? '\u2014'),
            transportCost: Number(well.transportCost ?? 0)
        });
    });

    const items: Record<string, unknown>[] = [];
    for (const [_dn, dnItems] of Object.entries(itemsByDN)) {
        items.push(...dnItems);
    }

    logger.debug('PdfStudnie', `Przygotowano ${items.length} items, grandTotal: ${grandTotal}`);

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

/**
 * Buduje kontekst StudnieOfferData dla ZAMÓWIENIA (documentType='order').
 * Czyta z orders_studnie_rel, z fallbackiem na offers_studnie_rel dla
 * kalkulacji cen (gdy w order.data brak wellsExport z obliczonymi cenami).
 */
export async function buildStudnieOrderContextFromOrderId(
    orderId: string
): Promise<StudnieOfferData> {
    const order = await prisma.orders_studnie_rel.findUnique({ where: { id: orderId } });
    if (!order) {
        throw new Error('Zamówienie studni nie znalezione');
    }

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
    wells.forEach((w) => {
        const well = w as Record<string, unknown>;
        const dn = String(well.dn ?? 'Inne');
        const wellPrice = Number(well.totalPrice ?? well.price ?? 0);
        if (!itemsByDN[dn]) itemsByDN[dn] = [];
        itemsByDN[dn].push({
            productName: String(well.name ?? `Studnia DN${dn}`),
            quantity: 1,
            price: wellPrice,
            DN: dn,
            height: Number(well.height ?? 0),
            zwienczenie: String(well.zwienczenie ?? '\u2014'),
            transportCost: Number(well.transportCost ?? 0)
        });
    });
    const items: Record<string, unknown>[] = Object.values(itemsByDN).flat();

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

/**
 * Generuje PDF ZAMÓWIENIA (wariant oferty) na podstawie orderId.
 * Thin wrapper: buduje kontekst z orders_studnie_rel, potem wywołuje
 * generateStudniePDFFromContext z documentType='order'.
 */
export async function generateStudnieOrderPDF(orderId: string): Promise<Buffer> {
    const ctx = await buildStudnieOrderContextFromOrderId(orderId);
    return generateStudniePDFFromContext(ctx);
}

export type { UserContactInfo, RuryOfferData, StudnieOfferData } from './pdf/pdfHelpers';

/**
 * Pobiera dane autora i opiekuna oferty z bazy users
 */
export async function lookupOfferUsers(
    offerData: Record<string, unknown>,
    offerUserId?: string | null
): Promise<{ authorUser: UserContactInfo | null; guardianUser: UserContactInfo | null }> {
    const formatUserName = (u: Record<string, unknown>): string =>
        u.firstName && u.lastName
            ? `${String(u.firstName)} ${String(u.lastName)}`
            : String(u.username);

    let guardianUser: UserContactInfo | null = null;
    let authorUser: UserContactInfo | null = null;

    const guardianId = typeof offerData.userId === 'string' ? offerData.userId : offerUserId;
    if (guardianId) {
        try {
            const u = await prisma.users.findUnique({ where: { id: guardianId } });
            if (u)
                guardianUser = {
                    name: formatUserName(u as Record<string, unknown>),
                    email: String(u.email ?? ''),
                    phone: String(u.phone ?? '')
                };
        } catch (e) {
            logger.warn('PdfUsers', 'Nie udało się wyszukać opiekuna (guardian)', e);
        }
    }

    const authorId =
        typeof offerData.createdByUserId === 'string' ? offerData.createdByUserId : undefined;
    if (authorId && authorId !== guardianId) {
        try {
            const u = await prisma.users.findUnique({ where: { id: authorId } });
            if (u)
                authorUser = {
                    name: formatUserName(u as Record<string, unknown>),
                    email: String(u.email ?? ''),
                    phone: String(u.phone ?? '')
                };
        } catch (e) {
            logger.warn('PdfUsers', 'Nie udało się wyszukać autora', e);
        }
    } else if (authorId && authorId === guardianId) {
        authorUser = null;
    }

    return { authorUser, guardianUser };
}
