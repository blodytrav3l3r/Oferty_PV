import { Paragraph, TextRun, Table, TableRow, TableCell, WidthType, ShadingType } from 'docx';
import { textCell } from '../helpers';
import { DOCX_COLORS } from '../colors';
import {
    FONT,
    COLOR_GRAY_HEADER,
    COLOR_WHITE,
    COLOR_LABEL,
    SZ_TABLE_BODY,
    SZ_TABLE_HEADER,
    BORDER_NONE,
    NO_BORDERS,
    type CellBorders
} from '../constants';

export const INFO_BOTTOM: CellBorders = {
    top: BORDER_NONE,
    bottom: { style: 'dotted' as any, size: 2, color: COLOR_GRAY_HEADER },
    left: BORDER_NONE,
    right: BORDER_NONE
};

export const EVEN_ROW_FILL = DOCX_COLORS.rowAlt;
export const SPACER = new Paragraph({ spacing: { before: 240 }, children: [] });

export function sectionRow(text: string, span: number = 2): TableRow {
    return new TableRow({
        children: [
            new TableCell({
                columnSpan: span,
                width: { size: 100, type: WidthType.PERCENTAGE },
                borders: NO_BORDERS,
                shading: {
                    type: ShadingType.SOLID,
                    color: COLOR_GRAY_HEADER,
                    fill: COLOR_GRAY_HEADER
                },
                children: [
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: text.toUpperCase(),
                                bold: true,
                                size: SZ_TABLE_BODY,
                                font: FONT,
                                color: COLOR_WHITE
                            })
                        ],
                        spacing: { before: 30, after: 30 }
                    })
                ]
            })
        ]
    });
}

export function infoRow(label: string, value: string, labelWidth: number = 45): TableRow {
    return new TableRow({
        children: [
            textCell(label, {
                bold: true,
                width: labelWidth,
                color: COLOR_LABEL,
                size: SZ_TABLE_BODY,
                borders: INFO_BOTTOM
            }),
            textCell(value, { width: 100 - labelWidth, size: SZ_TABLE_BODY, borders: INFO_BOTTOM })
        ]
    });
}

export function infoSection(heading: string, rows: TableRow[]): (Table | Paragraph)[] {
    return [
        new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            columnWidths: [4500, 5500],
            rows: [sectionRow(heading), ...rows]
        }),
        SPACER
    ];
}

export const TBL_COLS = [
    { text: 'Lp.', width: 8 },
    { text: 'Rodzaj przejścia', width: 28 },
    { text: 'DN OD', width: 14 },
    { text: 'DN DO', width: 14 },
    { text: 'Uwagi', width: 26 },
    { text: 'Czy przejście?', width: 10 }
];

export function transitionHeaderRow(): TableRow {
    return new TableRow({
        children: TBL_COLS.map((c) =>
            textCell(c.text, {
                width: c.width,
                size: SZ_TABLE_HEADER,
                alignment: 'CENTER' as any,
                bold: true,
                fill: COLOR_GRAY_HEADER,
                color: COLOR_WHITE
            })
        )
    });
}

export function transitionDataRow(p: Record<string, unknown>, idx: number): TableRow {
    const vals = [
        String(idx + 1),
        String(p.rodzaj || '—'),
        String(p.dnOd || '—'),
        String(p.dnDo || '—'),
        String(p.uwagi || '—'),
        String(p.czyPrzejscie || '—')
    ];
    return new TableRow({
        children: vals.map((v, ci) =>
            textCell(v, {
                width: TBL_COLS[ci].width,
                size: SZ_TABLE_BODY,
                alignment: 'CENTER' as any,
                fill: idx % 2 === 1 ? EVEN_ROW_FILL : undefined
            })
        )
    });
}
