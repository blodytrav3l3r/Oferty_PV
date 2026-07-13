import {
    buildRuryOfferContextFromOfferId,
    buildRuryOrderContextFromOrderId
} from './pdf/pdfRuryContext';
import {
    buildStudnieOfferContextFromOfferId,
    buildStudnieOrderContextFromOrderId
} from './pdf/pdfStudnieContext';
import { generateRuryHTML } from './pdf/pdfRuryBuilder';
import { generateStudnieHTML } from './pdf/pdfStudnieOffer';
import { generatePDF, RuryOfferData, StudnieOfferData } from './pdf/pdfHelpers';

export { buildRuryOfferContextFromOfferId, buildRuryOrderContextFromOrderId };
export { buildStudnieOfferContextFromOfferId, buildStudnieOrderContextFromOrderId };

export async function generateOfferRuryPDF(offerId: string): Promise<Buffer> {
    const ctx = await buildRuryOfferContextFromOfferId(offerId);
    return generateRuryPDFFromContext(ctx);
}

export async function generateRuryOrderPDF(orderId: string): Promise<Buffer> {
    const ctx = await buildRuryOrderContextFromOrderId(orderId);
    return generateRuryPDFFromContext(ctx);
}

export async function generateRuryPDFFromContext(data: RuryOfferData): Promise<Buffer> {
    const html = await generateRuryHTML(data);
    return generatePDF(html);
}

export async function generateOfferStudniePDF(offerId: string): Promise<Buffer> {
    const ctx = await buildStudnieOfferContextFromOfferId(offerId);
    return generateStudniePDFFromContext(ctx);
}

export async function generateStudnieOrderPDF(orderId: string): Promise<Buffer> {
    const ctx = await buildStudnieOrderContextFromOrderId(orderId);
    return generateStudniePDFFromContext(ctx);
}

export async function generateStudniePDFFromContext(data: StudnieOfferData): Promise<Buffer> {
    const html = await generateStudnieHTML(data);
    return generatePDF(html);
}

export type { UserContactInfo, RuryOfferData, StudnieOfferData } from './pdf/pdfHelpers';
export { lookupOfferUsers } from './pdf/pdfHelpers';
