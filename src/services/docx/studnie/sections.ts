/**
 * StudnieDocx — Sekcje dokumentu
 *
 * Buduje poszczególne sekcje DOCX: tytuł, daty, informacje o kliencie/inwestycji,
 * uwagi, warunki płatności oraz sekcje kontaktowe.
 */

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

// Helper type for TextRun with break property (docx types may not include it)
interface TextRunWithBreak extends IRunOptions {
    break?: number;
}
import {
    FONT,
    COLOR_GRAY_HEADER,
    COLOR_WHITE,
    COLOR_LABEL,
    COLOR_BG_NOTE,
    COLOR_NOTE_BORDER,
    NO_BORDERS,
    CELL_BORDERS,
    SZ_TITLE,
    SZ_BODY,
    SZ_TABLE_BODY,
    SZ_INFO_BOX,
    SZ_INFO_LABEL,
    SZ_DN_HEADER,
    SZ_GRAND_TOTAL,
    SZ_SUMMARY
} from '../constants';
import { fmtCurrency, textCell } from '../helpers';

// ─── Tytuł (Title) ──────────────────────────────────────────────────

export function buildTitleParagraph(offerNumber: string): Paragraph {
    return new Paragraph({
        children: [
            new TextRun({
                text: `OFERTA HANDLOWA ${offerNumber}`,
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

// ─── Daty (Dates) ───────────────────────────────────────────────────

export function buildDateParagraphs(offerDate: string, validity: string): Paragraph[] {
    return [
        new Paragraph({
            children: [
                new TextRun({
                    text: 'Data przygotowania oferty: ',
                    bold: true,
                    size: SZ_BODY,
                    font: FONT,
                    color: '333333'
                }),
                new TextRun({ text: offerDate, size: SZ_BODY, font: FONT })
            ],
            alignment: AlignmentType.RIGHT,
            spacing: { after: 0 }
        }),
        new Paragraph({
            children: [
                new TextRun({
                    text: 'Data ważności oferty: ',
                    bold: true,
                    size: SZ_BODY,
                    font: FONT,
                    color: '333333'
                }),
                new TextRun({ text: validity, size: SZ_BODY, font: FONT })
            ],
            alignment: AlignmentType.RIGHT,
            spacing: { after: 60 },
            border: { bottom: { style: BorderStyle.SINGLE, size: 3, color: COLOR_GRAY_HEADER } }
        })
    ];
}

// ─── Uwagi (Notes) ──────────────────────────────────────────────────

export function buildNotesParagraph(notes: string): Paragraph {
    return new Paragraph({
        children: [
            new TextRun({ text: 'Uwagi: ', bold: true, size: SZ_TABLE_BODY, font: FONT }),
            new TextRun({ text: notes, size: SZ_TABLE_BODY, font: FONT })
        ],
        spacing: { before: 120, after: 60 },
        shading: { type: ShadingType.SOLID, color: COLOR_BG_NOTE, fill: COLOR_BG_NOTE },
        border: { left: { style: BorderStyle.SINGLE, size: 6, color: COLOR_NOTE_BORDER } }
    });
}

// ─── Warunki płatności (Payment Terms) ──────────────────────────────

export function buildPaymentTermsParagraph(paymentTerms: string): Paragraph {
    return new Paragraph({
        children: [
            new TextRun({
                text: 'Warunki płatności: ',
                bold: true,
                size: SZ_TABLE_BODY,
                font: FONT
            }),
            new TextRun({ text: paymentTerms, size: SZ_TABLE_BODY, font: FONT })
        ],
        spacing: { before: 60, after: 20 }
    });
}

// ─── Siatka informacji o kliencie i inwestycji ──────────────────────

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
            shading: { type: ShadingType.SOLID, color: 'FFFFFF', fill: 'FFFFFF' }
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
        runs.push(
            new TextRun({ text: `NIP: ${nip}`, size: SZ_INFO_BOX, font: FONT, color: '000000' })
        );
    }
    if (contact) {
        runs.push(new TextRun({ break: 1 } as TextRunWithBreak));
        runs.push(
            new TextRun({
                text: `Kontakt: ${contact}`,
                size: SZ_INFO_BOX,
                font: FONT,
                color: '000000'
            })
        );
    }
    return runs;
}

function buildInvestRuns(
    investName: string,
    investAddress: string,
    investContractor: string
): TextRun[] {
    const runs: TextRun[] = [];
    if (investName) {
        runs.push(
            new TextRun({
                text: 'Budowa: ',
                bold: true,
                size: SZ_INFO_BOX,
                font: FONT,
                color: '000000'
            })
        );
        runs.push(
            new TextRun({ text: investName, size: SZ_INFO_BOX, font: FONT, color: '000000' })
        );
    } else {
        runs.push(new TextRun({ text: '\u2014', size: SZ_INFO_BOX, font: FONT, color: '000000' }));
    }
    if (investAddress) {
        runs.push(new TextRun({ break: 1 } as TextRunWithBreak));
        runs.push(
            new TextRun({
                text: 'Adres: ',
                bold: true,
                size: SZ_INFO_BOX,
                font: FONT,
                color: '000000'
            })
        );
        runs.push(
            new TextRun({ text: investAddress, size: SZ_INFO_BOX, font: FONT, color: '000000' })
        );
    }
    if (investContractor) {
        runs.push(new TextRun({ break: 1 } as TextRunWithBreak));
        runs.push(
            new TextRun({
                text: 'Wykonawca: ',
                bold: true,
                size: SZ_INFO_BOX,
                font: FONT,
                color: '000000'
            })
        );
        runs.push(
            new TextRun({ text: investContractor, size: SZ_INFO_BOX, font: FONT, color: '000000' })
        );
    }
    return runs;
}

// ─── Sekcja podsumowania (Summary Section) ──────────────────────────

export interface DnSummary {
    label: string;
    count: number;
    totalPrice: number;
}

export function buildSummarySection(
    summaries: DnSummary[],
    grandTotal: number
): (Paragraph | Table)[] {
    const result: (Paragraph | Table)[] = [];

    result.push(
        new Paragraph({
            children: [
                new TextRun({
                    text: 'Podsumowanie oferty',
                    bold: true,
                    size: SZ_DN_HEADER,
                    font: FONT,
                    color: COLOR_GRAY_HEADER
                })
            ],
            spacing: { before: 160, after: 60 },
            border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: COLOR_GRAY_HEADER } }
        })
    );

    const rows: TableRow[] = summaries.map(
        (s) =>
            new TableRow({
                children: [
                    textCell(s.label, { size: SZ_SUMMARY, alignment: AlignmentType.CENTER }),
                    textCell(`${s.count} szt.`, {
                        size: SZ_SUMMARY,
                        alignment: AlignmentType.CENTER
                    }),
                    textCell(`${fmtCurrency(s.totalPrice)} PLN`, {
                        bold: true,
                        size: SZ_SUMMARY,
                        alignment: AlignmentType.CENTER
                    })
                ]
            })
    );

    const totalCount = summaries.reduce((s, x) => s + x.count, 0);
    rows.push(
        new TableRow({
            children: [
                textCell('RAZEM NETTO', {
                    bold: true,
                    size: SZ_GRAND_TOTAL,
                    alignment: AlignmentType.CENTER,
                    fill: COLOR_GRAY_HEADER,
                    color: COLOR_WHITE,
                    borders: NO_BORDERS
                }),
                textCell(`${totalCount} szt.`, {
                    bold: true,
                    size: SZ_GRAND_TOTAL,
                    alignment: AlignmentType.CENTER,
                    fill: COLOR_GRAY_HEADER,
                    color: COLOR_WHITE,
                    borders: NO_BORDERS
                }),
                textCell(`${fmtCurrency(grandTotal)} PLN`, {
                    bold: true,
                    size: SZ_GRAND_TOTAL,
                    alignment: AlignmentType.CENTER,
                    fill: COLOR_GRAY_HEADER,
                    color: COLOR_WHITE,
                    borders: NO_BORDERS
                })
            ]
        })
    );

    result.push(new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } }));

    return result;
}

// ─── Sekcja kontaktowa (Contact Section) ────────────────────────────

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
            new TextRun({
                text: `${title}:`,
                bold: true,
                size: SZ_TABLE_BODY,
                font: FONT,
                color: COLOR_GRAY_HEADER
            }),
            new TextRun({ break: 1 } as TextRunWithBreak),
            new TextRun({ text: u.name, bold: true, size: SZ_TABLE_BODY, font: FONT })
        ];
        if (u.email) {
            runs.push(new TextRun({ break: 1 } as TextRunWithBreak));
            runs.push(new TextRun({ text: `Email: ${u.email}`, size: SZ_TABLE_BODY, font: FONT }));
        }
        if (u.phone) {
            runs.push(new TextRun({ break: 1 } as TextRunWithBreak));
            runs.push(
                new TextRun({ text: `Telefon: ${u.phone}`, size: SZ_TABLE_BODY, font: FONT })
            );
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
