import {
    Paragraph,
    TextRun,
    Table,
    TableRow,
    WidthType,
    AlignmentType,
    BorderStyle,
    IRunOptions
} from 'docx';
import { DOCX_COLORS } from '../colors';
import {
    FONT,
    COLOR_GRAY_HEADER,
    COLOR_WHITE,
    NO_BORDERS,
    SZ_TITLE,
    SZ_BODY,
    SZ_TABLE_BODY,
    SZ_GRAND_TOTAL
} from '../constants';
import { fmtCurrency, textCell } from '../helpers';

interface TextRunWithBreak extends IRunOptions {
    break?: number;
}

export function buildTitleParagraph(
    offerNumber: string,
    documentType: 'offer' | 'order' = 'offer'
): Paragraph {
    const titleText =
        documentType === 'order' ? `ZAMÓWIENIE ${offerNumber}` : `OFERTA HANDLOWA ${offerNumber}`;
    return new Paragraph({
        children: [
            new TextRun({
                text: titleText,
                bold: true,
                size: SZ_TITLE,
                font: FONT,
                color: DOCX_COLORS.titleText
            })
        ],
        alignment: AlignmentType.CENTER,
        spacing: { before: 80, after: 40 }
    });
}

export function buildDateParagraphs(
    offerDate: string,
    validity: string,
    documentType: 'offer' | 'order' = 'offer'
): Paragraph[] {
    const paragraphs: Paragraph[] = [
        new Paragraph({
            children: [
                new TextRun({
                    text: 'Data przygotowania oferty: ',
                    bold: true,
                    size: SZ_BODY,
                    font: FONT,
                    color: DOCX_COLORS.labelText
                }),
                new TextRun({ text: offerDate, size: SZ_BODY, font: FONT })
            ],
            alignment: AlignmentType.RIGHT,
            spacing: { after: 0 }
        })
    ];
    if (documentType === 'offer') {
        paragraphs.push(
            new Paragraph({
                children: [
                    new TextRun({
                        text: 'Data ważności oferty: ',
                        bold: true,
                        size: SZ_BODY,
                        font: FONT,
                        color: DOCX_COLORS.labelText
                    }),
                    new TextRun({ text: validity, size: SZ_BODY, font: FONT })
                ],
                alignment: AlignmentType.RIGHT,
                spacing: { after: 60 },
                border: { bottom: { style: BorderStyle.SINGLE, size: 3, color: COLOR_GRAY_HEADER } }
            })
        );
    }
    return paragraphs;
}

export function buildNotesParagraph(notes: string): Paragraph {
    const lines = notes.split('\n');
    const children: TextRun[] = [];
    lines.forEach((line, idx) => {
        if (idx > 0) children.push(new TextRun({ text: '', break: 1 } as TextRunWithBreak));
        children.push(new TextRun({ text: line, size: SZ_TABLE_BODY, font: FONT }));
    });
    return new Paragraph({ children, spacing: { before: 120, after: 60 } });
}

export function buildPaymentTermsParagraph(paymentTerms: string): Paragraph {
    const lines = paymentTerms.split('\n');
    const children: TextRun[] = [
        new TextRun({ text: 'Warunki płatności: ', bold: true, size: SZ_TABLE_BODY, font: FONT })
    ];
    lines.forEach((line, idx) => {
        if (idx > 0) children.push(new TextRun({ text: '', break: 1 } as TextRunWithBreak));
        children.push(new TextRun({ text: line, size: SZ_TABLE_BODY, font: FONT }));
    });
    return new Paragraph({ children, spacing: { before: 60, after: 20 } });
}

export function buildSummarySection(grandTotal: number): (Paragraph | Table)[] {
    const row = new TableRow({
        children: [
            textCell('SUMA NETTO', {
                bold: true,
                size: SZ_GRAND_TOTAL,
                alignment: AlignmentType.CENTER,
                fill: COLOR_GRAY_HEADER,
                color: COLOR_WHITE,
                borders: NO_BORDERS,
                width: 60
            }),
            textCell(`${fmtCurrency(grandTotal)} PLN`, {
                bold: true,
                size: SZ_GRAND_TOTAL,
                alignment: AlignmentType.CENTER,
                fill: COLOR_GRAY_HEADER,
                color: COLOR_WHITE,
                borders: NO_BORDERS,
                width: 40
            })
        ]
    });
    return [new Table({ rows: [row], width: { size: 100, type: WidthType.PERCENTAGE } })];
}
