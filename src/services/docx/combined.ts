/**
 * CombinedDocx — Wydruk łączny oferty studni + rur (jeden spójny dokument).
 *
 * Składa POJEDYNCZY dokument (1 sekcja) ze wspólnym tytułem
 * "OFERTA HANDLOWA {nr studni} + {nr rur}", danymi klienta/inwestycji raz,
 * sekcją studni (tabele + podsumowanie), sekcją rur (tabele + podsumowanie),
 * zbiorczym RAZEM NETTO oraz warunkami płatności / statycznymi warunkami
 * handlowymi / danymi kontaktowymi występującymi tylko raz.
 */

import { AlignmentType, Document, Packer, Paragraph, Table, TableRow, WidthType } from 'docx';
import { buildImageHeader, buildImageFooter } from './headerFooter';
import { fmtDate, fmtCurrency, textCell } from './helpers';
import { COLOR_GRAY_HEADER, COLOR_WHITE, NO_BORDERS, SZ_GRAND_TOTAL } from './constants';
import {
    buildTitleParagraph,
    buildDateParagraphs,
    buildClientInvestTable,
    buildNotesParagraph,
    buildPaymentTermsParagraph,
    buildSummarySection as buildStudnieSummarySection,
    buildContactSection
} from './studnie/sections';
import { buildStaticTerms } from './studnie/content';
import { buildWellTables } from './studnie/tables';
import { buildItemsTable } from './rury/tables';
import { buildSummarySection as buildRurySummarySection } from './rury/sections';
import { loadRuryOfferData } from './rury';
import { loadStudnieOfferData } from './studnie';

export async function buildCombinedDocument(
    offerRuryId: string,
    offerStudnieId: string
): Promise<Document> {
    const [rury, studnie] = await Promise.all([
        loadRuryOfferData(offerRuryId),
        loadStudnieOfferData(offerStudnieId)
    ]);

    const ruryCtx = rury.ctx;
    const studnieOffer = studnie.offer;
    const studnieData = studnie.offerData;
    const studnieClient = studnie.client;

    const combinedNumber = `${String(studnieOffer.offer_number ?? 'N/A')} + ${ruryCtx.offerNumber}`;
    const offerDate = fmtDate(
        String(studnieData.date ?? studnieOffer.createdAt ?? new Date().toISOString())
    );
    const validity = String(studnieData.validity ?? '30 dni');

    const clientName = String(
        studnieClient?.name ?? studnieData.clientName ?? 'Klient niezidentyfikowany'
    );
    const clientNip = String(studnieClient?.nip ?? studnieData.clientNip ?? '');
    const clientAddress = String(studnieClient?.address ?? studnieData.clientAddress ?? '');
    const clientContact = String(
        studnieData.clientContact ?? studnieClient?.contact ?? studnieClient?.phone ?? ''
    );
    const investName = String(studnieData.investName ?? '');
    const investAddress = String(studnieData.investAddress ?? '');
    const investContractor = String(studnieData.investContractor ?? '');
    const studnieNotes = String(studnieData.notes ?? '');
    const ruryNotes = String(rury.offerData.notes ?? '');
    const paymentTerms = String(
        studnieData.paymentTerms ??
            ruryCtx.paymentTerms ??
            'Do uzgodnienia lub według indywidualnych warunków handlowych.'
    );

    const {
        paragraphs: dnParagraphs,
        summaries,
        grandTotal: studnieTotal
    } = buildWellTables(studnie.wells);
    const { paragraphs: ruryParagraphs, grandTotal: ruryTotal } = buildItemsTable(
        ruryCtx.items as Record<string, unknown>[]
    );

    const children: (Paragraph | Table)[] = [];

    // 1. Wspólny tytuł (oba numery ofert)
    children.push(buildTitleParagraph(combinedNumber, 'offer'));

    // 2. Daty
    children.push(...buildDateParagraphs(offerDate, validity, 'offer'));

    // 3. Info grid: Klient + Inwestycja (raz)
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

    // 4. Tabele studni (kolejno wg DN, bez nagłówka)
    children.push(...dnParagraphs);

    // 5. Podsumowanie cen studni
    children.push(...buildStudnieSummarySection(summaries, studnieTotal));

    // 6. Uwagi do oferty studni (pełne, z franco — jak w polu "Uwagi do oferty")
    if (studnieNotes) {
        children.push(buildNotesParagraph(studnieNotes));
    }

    // 7. Tabele rur
    children.push(...ruryParagraphs);

    // 8. Podsumowanie cen rur
    children.push(...buildRurySummarySection(ruryTotal));

    // 8a. Uwagi do oferty rur (pełne, z franco — jak w polu "Uwagi do oferty")
    if (ruryNotes) {
        children.push(buildNotesParagraph(ruryNotes));
    }

    // 9. Zbiorcze RAZEM NETTO (studnie + rury)
    children.push(buildCombinedTotalTable(studnieTotal + ruryTotal));

    // 10. Warunki płatności (pod podsumowaniem, bez pogrubienia)
    children.push(buildPaymentTermsParagraph(paymentTerms));

    // 11. Statyczne warunki handlowe (raz)
    children.push(...buildStaticTerms());

    // 12. Dane kontaktowe (raz)
    children.push(...buildContactSection(studnie.authorUser ?? null, studnie.guardianUser ?? null));

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

function buildCombinedTotalTable(total: number): Table {
    return new Table({
        rows: [
            new TableRow({
                children: [
                    textCell('RAZEM NETTO (studnie + rury)', {
                        bold: true,
                        size: SZ_GRAND_TOTAL,
                        alignment: AlignmentType.CENTER,
                        fill: COLOR_GRAY_HEADER,
                        color: COLOR_WHITE,
                        borders: NO_BORDERS,
                        width: 60
                    }),
                    textCell(`${fmtCurrency(total)} PLN`, {
                        bold: true,
                        size: SZ_GRAND_TOTAL,
                        alignment: AlignmentType.CENTER,
                        fill: COLOR_GRAY_HEADER,
                        color: COLOR_WHITE,
                        borders: NO_BORDERS,
                        width: 40
                    })
                ]
            })
        ],
        width: { size: 100, type: WidthType.PERCENTAGE }
    });
}

export async function generateCombinedOfferDOCX(
    offerRuryId: string,
    offerStudnieId: string
): Promise<Buffer> {
    return Packer.toBuffer(await buildCombinedDocument(offerRuryId, offerStudnieId));
}
