import { Packer } from 'docx';
import prisma from '../../../prismaClient';
import { lookupOfferUsers } from '../../pdfGenerator';
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
    const offer = await prisma.offers_rel.findUnique({ where: { id: offerId } });
    if (!offer) throw new Error('Oferta nie znaleziona');

    let offerData: Record<string, unknown> = {};
    try {
        if (offer.data) offerData = JSON.parse(offer.data) as Record<string, unknown>;
    } catch (e) {
        logger.warn('DocxRury', 'Nie udało się sparsować danych oferty', e);
    }

    // Pobierz elementy oferty (podstawowe dane)
    const items = await prisma.offer_items_rel.findMany({ where: { offerId } });

    // Użyj rozszerzonych danych z offerData.items jeśli dostępne
    const enhancedItems = (Array.isArray(offerData.items) ? offerData.items : items) as Record<string, unknown>[];

    const client = offer.clientId
        ? await prisma.clients_rel.findUnique({ where: { id: offer.clientId } })
        : null;

    const { authorUser, guardianUser } = await lookupOfferUsers(offerData, offer.userId);

    logger.info('DocxRury', `Generowanie DOCX dla oferty ${offerId}, pozycji: ${enhancedItems.length}`);

    const doc = buildRuryDocument(offer, offerData, client, enhancedItems, authorUser, guardianUser);
    return Packer.toBuffer(doc);
}
