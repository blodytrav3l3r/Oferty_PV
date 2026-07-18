import { generatePDF } from './pdf/pdfEngine';
import { generateRuryHTML } from './pdf/ruryHtml';
import { generateStudnieHTML } from './pdf/studnieHtml';
import {
    buildRuryOfferContextFromOfferId,
    buildRuryOrderContextFromOrderId,
    buildStudnieOfferContextFromOfferId,
    buildStudnieOrderContextFromOrderId
} from './pdf/context';
import type { UserContactInfo, RuryOfferData, StudnieOfferData } from './pdf/types';

// Re-export dla zachowania zgodności z importami w docx/ i routes/
export type { UserContactInfo, RuryOfferData, StudnieOfferData };
export {
    buildRuryOfferContextFromOfferId,
    buildRuryOrderContextFromOrderId,
    buildStudnieOfferContextFromOfferId,
    buildStudnieOrderContextFromOrderId
};
export { lookupOfferUsers } from './pdf/offerUsers';
export { generateKartaBudowyPDF, generateKartaBudowyRuryPDF } from './pdf/kartaBudowy';

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

export async function generateStudniePDFFromContext(data: StudnieOfferData): Promise<Buffer> {
    const html = await generateStudnieHTML(data);
    return generatePDF(html);
}

export async function generateStudnieOrderPDF(orderId: string): Promise<Buffer> {
    const ctx = await buildStudnieOrderContextFromOrderId(orderId);
    return generateStudniePDFFromContext(ctx);
}
