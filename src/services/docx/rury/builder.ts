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
import { buildItemsTable } from './tables';
import { buildStaticTerms } from './content';

export function buildRuryDocument(
    offer: Record<string, unknown>,
    offerData: Record<string, unknown>,
    client: Record<string, unknown> | null,
    items: Record<string, unknown>[],
    authorUser: UserContactInfo | null,
    guardianUser: UserContactInfo | null,
    documentType: 'offer' | 'order' = 'offer'
): Document {
    const isOrder = documentType === 'order';
    const offerNumber = isOrder && offerData.orderNumber
        ? String(offerData.orderNumber)
        : String(offer.offer_number ?? 'N/A');
    const offerDate = fmtDate(String(offerData.date ?? offer.createdAt ?? new Date().toISOString()));
    const validity = String(offerData.validity ?? '30 dni');

    const clientName = String(client?.name ?? offerData.clientName ?? 'Klient niezidentyfikowany');
    const clientNip = String(client?.nip ?? offerData.clientNip ?? '');
    const clientAddress = String(client?.address ?? offerData.clientAddress ?? '');
    const clientContact = String(offerData.clientContact ?? client?.contact ?? client?.phone ?? '');
    const investName = String(offerData.investName ?? '');
    const investAddress = String(offerData.investAddress ?? '');
    const investContractor = String(offerData.investContractor ?? '');
    const notes = String(offerData.notes ?? '');
    const paymentTerms = String(offerData.paymentTerms ?? '');

    const children: (Paragraph | Table)[] = [];

    // 1. Tytuł
    children.push(buildTitleParagraph(offerNumber, documentType));

    // 2. Daty
    children.push(...buildDateParagraphs(offerDate, validity, documentType));

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

    // Spacer między infobox a tabelami pozycji
    children.push(new Paragraph({ children: [], spacing: { before: 60, after: 60 } }));

    // 4. Tabele pozycji per kategoria
    const { paragraphs: catParagraphs, grandTotal } = buildItemsTable(items);
    children.push(...catParagraphs);

    // Spacer między tabelami pozycji a podsumowaniem
    children.push(new Paragraph({ children: [], spacing: { before: 60, after: 60 } }));

    // 5. Podsumowanie
    children.push(...buildSummarySection(grandTotal));

    // 6. Uwagi
    if (notes) {
        children.push(buildNotesParagraph(notes));
    }

    // 7. Warunki płatności
    if (paymentTerms) {
        children.push(buildPaymentTermsParagraph(paymentTerms));
    }

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
