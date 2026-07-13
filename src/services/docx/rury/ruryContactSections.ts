import {
    Paragraph,
    TextRun,
    Table,
    TableRow,
    TableCell,
    WidthType,
    ShadingType,
    BorderStyle,
    IRunOptions
} from 'docx';
import { UserContactInfo } from '../../pdfGenerator';
import { DOCX_COLORS } from '../colors';
import {
    FONT,
    COLOR_GRAY_HEADER,
    COLOR_LABEL,
    NO_BORDERS,
    CELL_BORDERS,
    SZ_INFO_BOX,
    SZ_INFO_LABEL,
    SZ_TABLE_BODY
} from '../constants';

interface TextRunWithBreak extends IRunOptions {
    break?: number;
}

function buildClientRuns(name: string, address: string, nip: string, contact: string): TextRun[] {
    const runs: TextRun[] = [
        new TextRun({
            text: name,
            bold: true,
            size: SZ_INFO_BOX,
            font: FONT,
            color: DOCX_COLORS.titleText
        })
    ];
    if (address) {
        runs.push(new TextRun({ break: 1 } as TextRunWithBreak));
        runs.push(
            new TextRun({
                text: address,
                size: SZ_INFO_BOX,
                font: FONT,
                color: DOCX_COLORS.titleText
            })
        );
    }
    if (nip) {
        runs.push(new TextRun({ break: 1 } as TextRunWithBreak));
        runs.push(
            new TextRun({
                text: `NIP: ${nip}`,
                size: SZ_INFO_BOX,
                font: FONT,
                color: DOCX_COLORS.titleText
            })
        );
    }
    if (contact) {
        runs.push(new TextRun({ break: 1 } as TextRunWithBreak));
        runs.push(
            new TextRun({
                text: `Kontakt: ${contact}`,
                size: SZ_INFO_BOX,
                font: FONT,
                color: DOCX_COLORS.titleText
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
                color: DOCX_COLORS.titleText
            })
        );
        runs.push(
            new TextRun({
                text: investName,
                size: SZ_INFO_BOX,
                font: FONT,
                color: DOCX_COLORS.titleText
            })
        );
    } else {
        runs.push(
            new TextRun({
                text: '\u2014',
                size: SZ_INFO_BOX,
                font: FONT,
                color: DOCX_COLORS.titleText
            })
        );
    }
    if (investAddress) {
        runs.push(new TextRun({ break: 1 } as TextRunWithBreak));
        runs.push(
            new TextRun({
                text: 'Adres: ',
                bold: true,
                size: SZ_INFO_BOX,
                font: FONT,
                color: DOCX_COLORS.titleText
            })
        );
        runs.push(
            new TextRun({
                text: investAddress,
                size: SZ_INFO_BOX,
                font: FONT,
                color: DOCX_COLORS.titleText
            })
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
                color: DOCX_COLORS.titleText
            })
        );
        runs.push(
            new TextRun({
                text: investContractor,
                size: SZ_INFO_BOX,
                font: FONT,
                color: DOCX_COLORS.titleText
            })
        );
    }
    return runs;
}

function buildUserCell(title: string, u: UserContactInfo): TableCell {
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
        runs.push(
            new TextRun({
                text: `Email: ${u.email}`,
                size: SZ_TABLE_BODY,
                font: FONT,
                color: DOCX_COLORS.linkUnderline,
                underline: { type: 'single', color: DOCX_COLORS.linkUnderline }
            })
        );
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
            shading: {
                type: ShadingType.SOLID,
                color: DOCX_COLORS.infoBg,
                fill: DOCX_COLORS.infoBg
            }
        });
    };

    return new Table({
        rows: [
            new TableRow({
                children: [
                    buildCell('DANE KLIENTA', buildClientRuns(name, address, nip, contact)),
                    buildCell(
                        'DANE INWESTYCJI',
                        buildInvestRuns(investName, investAddress, investContractor)
                    )
                ]
            })
        ],
        width: { size: 100, type: WidthType.PERCENTAGE }
    });
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
