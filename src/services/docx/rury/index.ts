import { Packer } from 'docx';
import prisma from '../../../prismaClient';
import { buildRuryOfferContextFromOfferId } from '../../pdfGenerator';
import type { UserContactInfo } from '../../pdfGenerator';
import { buildRuryDocument } from './builder';
import { logger } from '../../../utils/logger';

/**
 * Generuje dokument DOCX dla oferty rur.
 *
 * Pobiera ofertę rur z bazy, parsuje dane JSON z offers_rel.data,
 * przygotowuje dane klienta oraz informacje o autorze i opiekunie handlowym,
 * następnie buduje kompletny dokument Word z tabelami pozycji i podsumowaniem.
 *
 * @param offerId - ID oferty rur w bazie danych
 * @returns Buffer zawierający wygenerowany dokument DOCX
 * @throws Error gdy oferta nie zostanie znaleziona
 */
export async function generateOfferRuryDOCX(offerId: string): Promise<Buffer> {
    const ctx = await buildRuryOfferContextFromOfferId(offerId);

    const offer = await prisma.offers_rel.findUnique({ where: { id: offerId } });
    if (!offer) throw new Error('Oferta nie znaleziona');

    let offerData: Record<string, unknown> = {};
    try {
        if (offer.data) offerData = JSON.parse(offer.data) as Record<string, unknown>;
    } catch (e) {
        logger.warn('DocxRury', 'Nie udało się sparsować danych oferty', e);
    }

    const client = offer.clientId
        ? await prisma.clients_rel.findUnique({ where: { id: offer.clientId } })
        : null;

    logger.info('DocxRury', `Generowanie DOCX dla oferty ${offerId}, pozycji: ${ctx.items.length}`);

    const doc = buildRuryDocument(
        { offer_number: ctx.offerNumber },
        offerData,
        client,
        ctx.items,
        ctx.authorUser ?? null,
        ctx.guardianUser ?? null
    );
    return Packer.toBuffer(doc);
}

/**
 * Generuje dokument DOCX dla zamówienia rur w trybie "oferty bieżącej".
 * Używa tego samego szablonu co generateOfferRuryDOCX, ale z danymi przesłanymi
 * przez klienta (aktualny stan edycji z orderCurrentItems).
 *
 * @param ctx - Kontekst oferty (items + metadane) zbudowany z bieżącego stanu zamówienia
 * @returns Buffer zawierający wygenerowany dokument DOCX
 */
export async function generateRuryDOCXFromContext(ctx: {
    offerNumber: string;
    offerData: Record<string, unknown>;
    items: Array<Record<string, unknown>>;
    authorUser: UserContactInfo | null;
    guardianUser: UserContactInfo | null;
}): Promise<Buffer> {
    logger.info('DocxRury', `Generowanie DOCX (order context) dla zamówienia ${ctx.offerNumber}, pozycji: ${ctx.items.length}`);

    const doc = buildRuryDocument(
        { offer_number: ctx.offerNumber },
        ctx.offerData,
        null,
        ctx.items,
        ctx.authorUser,
        ctx.guardianUser
    );
    return Packer.toBuffer(doc);
}
