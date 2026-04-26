/**
 * StudnieDocx — Główny eksport (barrel)
 *
 * Publiczne API do generowania dokumentów DOCX dla ofert studni.
 */

import { Packer } from 'docx';
import prisma from '../../../prismaClient';
import { lookupOfferUsers } from '../../pdfGenerator';
import { buildStudnieDocument } from './builder';
import { logger } from '../../../utils/logger';

/**
 * Generuje bufor DOCX dla oferty studni na podstawie ID
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
