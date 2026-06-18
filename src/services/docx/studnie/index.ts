/**
 * StudnieDocx — Główny eksport (barrel)
 *
 * Publiczne API do generowania dokumentów DOCX dla ofert studni.
 */

import { Packer } from 'docx';
import prisma from '../../../prismaClient';
import {
    lookupOfferUsers,
    buildStudnieOfferContextFromOfferId,
    buildStudnieOrderContextFromOrderId
} from '../../pdfGenerator';
import type { UserContactInfo } from '../../pdfGenerator';
import { buildStudnieDocument } from './builder';
import { logger } from '../../../utils/logger';

/**
 * Generuje dokument DOCX dla oferty studni.
 *
 * Pobiera ofertę studni z bazy, parsuje dane JSON zawierające studnie (wellsExport),
 * przygotowuje dane klienta oraz informacje o autorze i opiekunie handlowym,
 * następnie buduje kompletny dokument Word z tabelami studni i podsumowaniem.
 *
 * @param offerId - ID oferty studni w bazie danych
 * @returns Buffer zawierający wygenerowany dokument DOCX
 * @throws Error gdy oferta nie zostanie znaleziona
 *
 * @example
 * ```ts
 * const docxBuffer = await generateOfferStudnieDOCX('studnie-456');
 * res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
 * res.setHeader('Content-Disposition', 'attachment; filename="oferta.docx"');
 * res.send(docxBuffer);
 * ```
 */
export async function generateOfferStudnieDOCX(offerId: string): Promise<Buffer> {
    const offer = await prisma.offers_studnie_rel.findUnique({ where: { id: offerId } });
    if (!offer) throw new Error('Oferta studni nie znaleziona');

    let offerData: Record<string, unknown> = {};
    try {
        if (offer.data) offerData = JSON.parse(offer.data) as Record<string, unknown>;
    } catch (e) {
        logger.warn('DocxStudnie', 'Nie udało się sparsować danych oferty', e);
    }

    let wells: unknown[] = [];
    if (offerData.wellsExport && Array.isArray(offerData.wellsExport)) {
        wells = offerData.wellsExport;
    } else if (offerData.wells && Array.isArray(offerData.wells)) {
        wells = offerData.wells;
    }

    logger.info('DocxStudnie', `Generowanie DOCX dla oferty ${offerId}, studni: ${wells.length}`);

    const client = offer.clientId
        ? await prisma.clients_rel.findUnique({ where: { id: offer.clientId } })
        : null;
    const { authorUser, guardianUser } = await lookupOfferUsers(offerData, offer.userId);
    const doc = buildStudnieDocument(offer, offerData, client, wells, authorUser, guardianUser);
    return Packer.toBuffer(doc);
}

/**
 * Generuje dokument DOCX dla zamówienia studni w trybie "oferty bieżącej".
 * Używa tego samego szablonu co generateOfferStudnieDOCX, ale z danymi przesłanymi
 * przez klienta (aktualny stan edycji zamówienia z kroku 5).
 *
 * @param ctx - Kontekst oferty (offerData + wells + metadane) zbudowany z bieżącego stanu zamówienia
 * @returns Buffer zawierający wygenerowany dokument DOCX
 */
export async function generateStudnieDOCXFromContext(ctx: {
    offerNumber: string;
    offerData: Record<string, unknown>;
    wells: Array<Record<string, unknown>>;
    authorUser: UserContactInfo | null;
    guardianUser: UserContactInfo | null;
    documentType?: 'offer' | 'order';
}): Promise<Buffer> {
    const documentType: 'offer' | 'order' = ctx.documentType ?? 'offer';
    logger.info(
        'DocxStudnie',
        `Generowanie DOCX (${documentType} context) dla ${ctx.offerNumber}, studni: ${ctx.wells.length}`
    );

    const doc = buildStudnieDocument(
        { offer_number: ctx.offerNumber },
        ctx.offerData,
        null,
        ctx.wells,
        ctx.authorUser,
        ctx.guardianUser,
        documentType
    );
    return Packer.toBuffer(doc);
}

/**
 * Generuje dokument DOCX dla ZAMÓWIENIA studni (wariant oferty).
 * Buduje kontekst z orders_studnie_rel (z fallbackiem na offers_studnie_rel
 * dla kalkulacji cen) i renderuje przez buildStudnieDocument z documentType='order'.
 */
export async function generateStudnieOrderDOCX(orderId: string): Promise<Buffer> {
    logger.info('DocxStudnie', `Generowanie DOCX dla zamówienia ${orderId}`);

    const ctx = await buildStudnieOrderContextFromOrderId(orderId);

    // Znajdź client record (potrzebny do buildStudnieDocument)
    const order = await prisma.orders_studnie_rel.findUnique({ where: { id: orderId } });
    let orderData: Record<string, unknown> = {};
    try {
        if (order?.data) orderData = JSON.parse(order.data) as Record<string, unknown>;
    } catch (e) {
        logger.warn('DocxStudnie', 'Błąd parsowania order.data (order DOCX)', e);
    }
    const client = orderData.clientId
        ? await prisma.clients_rel.findUnique({ where: { id: String(orderData.clientId) } })
        : null;

    const doc = buildStudnieDocument(
        { offer_number: ctx.offerNumber, createdAt: order?.createdAt },
        {
            date: ctx.createdAt,
            clientName: ctx.clientName,
            clientNip: ctx.clientNip,
            clientAddress: ctx.clientAddress,
            clientContact: ctx.clientPhone,
            investName: ctx.investName,
            investAddress: ctx.investAddress,
            notes: ctx.notes,
            paymentTerms: ctx.paymentTerms,
            orderNumber: ctx.orderNumber,
            productionOrderNumber: ctx.productionOrderNumber
        },
        client,
        ctx.items,
        ctx.authorUser ?? null,
        ctx.guardianUser ?? null,
        'order'
    );
    return Packer.toBuffer(doc);
}

// Re-export helpera do budowania kontekstu z DB (dla spójności API z rury)
export { buildStudnieOfferContextFromOfferId, buildStudnieOrderContextFromOrderId };
