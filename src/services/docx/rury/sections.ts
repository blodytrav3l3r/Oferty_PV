import {
    Paragraph,
    TextRun,
    Table,
    TableRow,
    TableCell,
    WidthType,
    AlignmentType,
    BorderStyle,
    ShadingType,
    IRunOptions
} from 'docx';
import { UserContactInfo } from '../../pdfGenerator';
interface TextRunWithBreak extends IRunOptions {
    break?: number;
}
import {
    FONT,
    COLOR_GRAY_HEADER,
    COLOR_WHITE,
    COLOR_LABEL,
    NO_BORDERS,
    CELL_BORDERS,
    SZ_TITLE,
    SZ_BODY,
    SZ_TABLE_BODY,
    SZ_INFO_BOX,
    SZ_INFO_LABEL,
    SZ_GRAND_TOTAL
} from '../constants';
import { fmtCurrency, textCell } from '../helpers';

export function buildTitleParagraph(offerNumber: string, documentType: 'offer' | 'order' = 'offer'): Paragraph {
    const titleText = documentType === 'order'
        ? `ZAMÓWIENIE ${offerNumber}`
        : `OFERTA HANDLOWA ${offerNumber}`;
    return new Paragraph({
        children: [
            new TextRun({
                text: titleText,
                bold: true,
                size: SZ_TITLE,
                font: FONT,
                color: '000000'
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
                new TextRun({ text: 'Data przygotowania oferty: ', bold: true, size: SZ_BODY, font: FONT, color: '333333' }),
                new TextRun({ text: offerDate, size: SZ_BODY, font: FONT })
            ],
            alignment: AlignmentType.RIGHT,
            spacing: { after: documentType === 'order' ? 60 : 0 },
            border: documentType === 'order'
                ? { bottom: { style: BorderStyle.SINGLE, size: 3, color: COLOR_GRAY_HEADER } }
                : undefined
        })
    ];
    if (documentType === 'offer') {
        paragraphs.push(
            new Paragraph({
                children: [
                    new TextRun({ text: 'Data ważności oferty: ', bold: true, size: SZ_BODY, font: FONT, color: '333333' }),
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

export function buildClientInvestTable(
    name: string,
    nip: string,
    address: string,
    contact: string,
    investName: string,
    investAddress: string,
    investContractor: string
): Table {
    const buildCell = (label: string, lines: TextRun[]): TableCell => {
        const runs: TextRun[] = [
            new TextRun({ text: label, size: SZ_INFO_LABEL, font: FONT, color: COLOR_LABEL }),
            new TextRun({ break: 1 } as TextRunWithBreak),
            ...lines
        ];
        return new TableCell({
            children: [new Paragraph({ children: runs, spacing: { before: 80, after: 80 } })],
            width: { size: 50, type: WidthType.PERCENTAGE },
            borders: CELL_BORDERS,
            shading: { type: ShadingType.SOLID, color: 'F9F9F9', fill: 'F9F9F9' }
        });
    };

    const clientRuns = buildClientRuns(name, address, nip, contact);
    const investRuns = buildInvestRuns(investName, investAddress, investContractor);

    return new Table({
        rows: [
            new TableRow({
                children: [
                    buildCell('DANE KLIENTA', clientRuns),
                    buildCell('DANE INWESTYCJI', investRuns)
                ]
            })
        ],
        width: { size: 100, type: WidthType.PERCENTAGE }
    });
}

function buildClientRuns(name: string, address: string, nip: string, contact: string): TextRun[] {
    const runs: TextRun[] = [
        new TextRun({ text: name, bold: true, size: SZ_INFO_BOX, font: FONT, color: '000000' })
    ];
    if (address) {
        runs.push(new TextRun({ break: 1 } as TextRunWithBreak));
        runs.push(new TextRun({ text: address, size: SZ_INFO_BOX, font: FONT, color: '000000' }));
    }
    if (nip) {
        runs.push(new TextRun({ break: 1 } as TextRunWithBreak));
        runs.push(new TextRun({ text: `NIP: ${nip}`, size: SZ_INFO_BOX, font: FONT, color: '000000' }));
    }
    if (contact) {
        runs.push(new TextRun({ break: 1 } as TextRunWithBreak));
        runs.push(new TextRun({ text: `Kontakt: ${contact}`, size: SZ_INFO_BOX, font: FONT, color: '000000' }));
    }
    return runs;
}

function buildInvestRuns(investName: string, investAddress: string, investContractor: string): TextRun[] {
    const runs: TextRun[] = [];
    if (investName) {
        runs.push(new TextRun({ text: 'Budowa: ', bold: true, size: SZ_INFO_BOX, font: FONT, color: '000000' }));
        runs.push(new TextRun({ text: investName, size: SZ_INFO_BOX, font: FONT, color: '000000' }));
    } else {
        runs.push(new TextRun({ text: '\u2014', size: SZ_INFO_BOX, font: FONT, color: '000000' }));
    }
    if (investAddress) {
        runs.push(new TextRun({ break: 1 } as TextRunWithBreak));
        runs.push(new TextRun({ text: 'Adres: ', bold: true, size: SZ_INFO_BOX, font: FONT, color: '000000' }));
        runs.push(new TextRun({ text: investAddress, size: SZ_INFO_BOX, font: FONT, color: '000000' }));
    }
    if (investContractor) {
        runs.push(new TextRun({ break: 1 } as TextRunWithBreak));
        runs.push(new TextRun({ text: 'Wykonawca: ', bold: true, size: SZ_INFO_BOX, font: FONT, color: '000000' }));
        runs.push(new TextRun({ text: investContractor, size: SZ_INFO_BOX, font: FONT, color: '000000' }));
    }
    return runs;
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

export function buildContactSection(
    authorUser: UserContactInfo | null,
    guardianUser: UserContactInfo | null
): (Paragraph | Table)[] {
    const result: (Paragraph | Table)[] = [];

    result.push(
        new Paragraph({
            children: [],
            spacing: { before: 200 },
            border: { top: { style: BorderStyle.SINGLE, size: 2, color: COLOR_GRAY_HEADER } }
        })
    );

    if (!guardianUser && !authorUser) {
        result.push(
            new Paragraph({
                children: [
                    new TextRun({
                        text: 'W razie pytań prosimy o kontakt z opiekunem oferty.',
                        size: SZ_TABLE_BODY,
                        font: FONT
                    })
                ],
                spacing: { before: 40 }
            })
        );
        return result;
    }

    const buildUserCell = (title: string, u: UserContactInfo): TableCell => {
        const runs: TextRun[] = [
            new TextRun({ text: `${title}:`, bold: true, size: SZ_TABLE_BODY, font: FONT, color: COLOR_GRAY_HEADER }),
            new TextRun({ break: 1 } as TextRunWithBreak),
            new TextRun({ text: u.name, bold: true, size: SZ_TABLE_BODY, font: FONT })
        ];
        if (u.email) {
            runs.push(new TextRun({ break: 1 } as TextRunWithBreak));
            runs.push(new TextRun({ text: `Email: ${u.email}`, size: SZ_TABLE_BODY, font: FONT, color: '0000FF', underline: { type: 'single', color: '0000FF' } }));
        }
        if (u.phone) {
            runs.push(new TextRun({ break: 1 } as TextRunWithBreak));
            runs.push(new TextRun({ text: `Telefon: ${u.phone}`, size: SZ_TABLE_BODY, font: FONT }));
        }
        return new TableCell({
            children: [new Paragraph({ children: runs, spacing: { before: 40, after: 40 } })],
            width: { size: 50, type: WidthType.PERCENTAGE },
            borders: NO_BORDERS
        });
    };

    const cells: TableCell[] = [];
    if (authorUser) cells.push(buildUserCell('Ofertę przygotował(-a)', authorUser));
    if (guardianUser) cells.push(buildUserCell('Opiekun handlowy (kontakt)', guardianUser));
    if (cells.length === 1) {
        cells.push(
            new TableCell({
                children: [new Paragraph({ children: [] })],
                width: { size: 50, type: WidthType.PERCENTAGE },
                borders: NO_BORDERS
            })
        );
    }

    result.push(
        new Table({
            rows: [new TableRow({ children: cells })],
            width: { size: 100, type: WidthType.PERCENTAGE }
        })
    );

    return result;
}
