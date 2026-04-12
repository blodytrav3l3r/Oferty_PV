/**
 * StudnieDocx — Budowniczy dokumentów (Document Builder)
 *
 * Składa kompletny obiekt Document DOCX z poszczególnych sekcji.
 */

import { Document, Paragraph, Table } from 'docx';
import { UserContactInfo } from '../../pdfGenerator';
import { fmtDate } from '../helpers';
import { buildImageHeader, buildImageFooter } from '../headerFooter';
import {
    buildTitleParagraph,
    buildDateParagraphs,
    buildClientInvestTable,
    buildNotesParagraph,
    buildPaymentTermsParagraph,
    buildSummarySection,
    buildContactSection
} from './sections';
import { buildWellTables } from './tables';
import { buildStaticTerms } from './content';

/**
 * Buduje kompletny obiekt Document oferty studni na podstawie sparsowanych danych
 */
export function buildStudnieDocument(
    offer: any,
    offerData: any,
    client: any,
    wells: any[],
    authorUser: UserContactInfo | null,
    guardianUser: UserContactInfo | null
): Document {
    const offerNumber = offer.offer_number || 'N/A';
    const offerDate = fmtDate(offerData.date || offer.createdAt || new Date().toISOString());
    const validity = offerData.validity || '30 dni';

    const clientName = client?.name || offerData.clientName || 'Klient niezidentyfikowany';
    const clientNip = client?.nip || offerData.clientNip || '';
    const clientAddress = client?.address || offerData.clientAddress || '';
    const clientContact = offerData.clientContact || client?.contact || client?.phone || '';
    const investName = offerData.investName || '';
    const investAddress = offerData.investAddress || '';
    const investContractor = offerData.investContractor || '';
    const notes = offerData.notes || '';
    const paymentTerms =
        offerData.paymentTerms || 'Do uzgodnienia lub według indywidualnych warunków handlowych.';

    const children: (Paragraph | Table)[] = [];

    // 1. Tytuł
    children.push(buildTitleParagraph(offerNumber));

    // 2. Daty
    children.push(...buildDateParagraphs(offerDate, validity));

    // 3. Info grid: Klient + Inwestycja
    children.push(
        buildClientInvestTable(
            clientName,
            clientNip,
            clientAddress,
            clientContact,
            investName,
            investAddress,
            investContractor
        )
    );

    // 4. Tabele studni per DN
    const { paragraphs: dnParagraphs, summaries, grandTotal } = buildWellTables(wells);
    children.push(...dnParagraphs);

    // 5. Podsumowanie
    children.push(...buildSummarySection(summaries, grandTotal));

    // 6. Uwagi
    if (notes) {
        children.push(buildNotesParagraph(notes));
    }

    // 7. Warunki płatności
    children.push(buildPaymentTermsParagraph(paymentTerms));

    // 8. Statyczne warunki handlowe
    children.push(...buildStaticTerms());

    // 9. Dane kontaktowe
    children.push(...buildContactSection(authorUser, guardianUser));

    return new Document({
        sections: [
            {
                properties: {
                    page: {
                        margin: {
                            top: 60,
                            bottom: 280,
                            right: 570,
                            left: 570,
                            header: 60,
                            footer: 280
                        }
                    }
                },
                headers: { default: buildImageHeader() },
                footers: { default: buildImageFooter() },
                children
            }
        ]
    });
}
