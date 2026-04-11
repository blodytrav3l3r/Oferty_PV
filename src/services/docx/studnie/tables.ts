/**
 * StudnieDocx — Well Tables per DN
 *
 * Builds per-DN well tables with headers, data rows, and subtotals.
 */

import {
    Paragraph,
    TextRun,
    Table,
    TableRow,
    WidthType,
    AlignmentType,
    BorderStyle
} from 'docx';
import {
    FONT,
    COLOR_GRAY_HEADER,
    COLOR_WHITE,
    COLOR_BG_SUMMARY,
    SZ_TABLE_BODY,
    SZ_TABLE_HEADER,
    SZ_DN_HEADER,
    SZ_ZWIENCZENIE
} from '../constants';
import { fmtCurrency, fmtInt, textCell } from '../helpers';
import { DnSummary } from './sections';

// ─── Main Table Builder ─────────────────────────────────────────────

export function buildWellTables(wells: any[]): {
    paragraphs: (Paragraph | Table)[];
    summaries: DnSummary[];
    grandTotal: number;
} {
    const dnOrder = ['1000', '1200', '1500', '2000', '2500', 'styczna', 'Inne'];
    const itemsByDN = groupWellsByDn(wells);
    let grandTotal = 0;

    wells.forEach((well: any) => {
        grandTotal += well.totalPrice || well.price || 0;
    });

    const paragraphs: (Paragraph | Table)[] = [];
    const summaries: DnSummary[] = [];
    let globalLp = 1;

    const thStyle = {
        bold: true,
        size: SZ_TABLE_HEADER,
        fill: COLOR_GRAY_HEADER,
        color: COLOR_WHITE,
        alignment: AlignmentType.CENTER
    };

    for (const dn of dnOrder) {
        if (!itemsByDN[dn]) continue;
        const dnItems = itemsByDN[dn];
        const dnLabel = dn === 'styczna' ? 'Studnie styczne' : `Studnie DN${dn}`;
        const dnTotal = dnItems.reduce((sum: number, item: any) => sum + (item.price || 0), 0);
        summaries.push({ label: dnLabel, count: dnItems.length, totalPrice: dnTotal });

        paragraphs.push(buildDnHeaderParagraph(dnLabel));

        const rows: TableRow[] = [];
        rows.push(buildDnTableHeaderRow(thStyle));
        rows.push(...buildDnDataRows(dnItems, dn, globalLp));
        rows.push(buildDnSummaryRow(dnLabel, dnItems.length, dnTotal));

        paragraphs.push(new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } }));
        globalLp += dnItems.length;
    }

    return { paragraphs, summaries, grandTotal };
}

// ─── Helpers ────────────────────────────────────────────────────────

function groupWellsByDn(wells: any[]): Record<string, any[]> {
    const itemsByDN: Record<string, any[]> = {};

    wells.forEach((well: any) => {
        const dn = String(well.dn || 'Inne');
        const wellPrice = well.totalPrice || well.price || 0;
        const cleanZwienczenie = (well.zwienczenie || '\u2014')
            .replace(/\s*\(?[hH]\s*=?\s*\d+([.,]\d+)?\s*(mm|cm|m)?\)?\s*/gi, ' ')
            .replace(/\s*(bez\s+stopni|z\s+drabinką|drabinka|ze\s+stopniami|-B|-D|-N)/gi, '')
            .replace(/\s+/g, ' ').trim();

        if (!itemsByDN[dn]) itemsByDN[dn] = [];
        itemsByDN[dn].push({
            name: well.name || `Studnia DN${dn}`,
            price: wellPrice,
            dn,
            height: well.height || 0,
            zwienczenie: cleanZwienczenie || '\u2014'
        });
    });

    return itemsByDN;
}

function buildDnHeaderParagraph(dnLabel: string): Paragraph {
    return new Paragraph({
        children: [
            new TextRun({
                text: dnLabel,
                bold: true,
                size: SZ_DN_HEADER,
                font: FONT,
                color: COLOR_GRAY_HEADER
            })
        ],
        spacing: { before: 140, after: 60 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: COLOR_GRAY_HEADER } }
    });
}

function buildDnTableHeaderRow(thStyle: any): TableRow {
    return new TableRow({
        tableHeader: true,
        children: [
            textCell('Lp.', { ...thStyle, width: 5 }),
            textCell('Nr studni', { ...thStyle, width: 30 }),
            textCell('Średnica', { ...thStyle, width: 10 }),
            textCell('H [mm]', { ...thStyle, width: 8 }),
            textCell('Zwieńczenie', { ...thStyle, width: 32 }),
            textCell('Cena netto [PLN]', { ...thStyle, width: 15 })
        ]
    });
}

function buildDnDataRows(dnItems: any[], dn: string, globalLp: number): TableRow[] {
    return dnItems.map((item: any, idx: number) => {
        const dnDisplay = dn === 'styczna' ? 'Styczna' : `DN${dn}`;
        const rowFill = idx % 2 === 1 ? 'FAFAFA' : undefined;

        return new TableRow({
            children: [
                textCell(String(globalLp + idx), {
                    size: SZ_TABLE_BODY,
                    alignment: AlignmentType.CENTER,
                    fill: rowFill
                }),
                textCell(item.name, {
                    bold: true,
                    size: SZ_TABLE_BODY,
                    alignment: AlignmentType.CENTER,
                    fill: rowFill
                }),
                textCell(dnDisplay, {
                    size: SZ_TABLE_BODY,
                    alignment: AlignmentType.CENTER,
                    fill: rowFill
                }),
                textCell(fmtInt(item.height), {
                    size: SZ_TABLE_BODY,
                    alignment: AlignmentType.CENTER,
                    fill: rowFill
                }),
                textCell(item.zwienczenie, {
                    size: SZ_ZWIENCZENIE,
                    alignment: AlignmentType.CENTER,
                    fill: rowFill
                }),
                textCell(fmtCurrency(item.price), {
                    bold: true,
                    size: SZ_TABLE_BODY,
                    alignment: AlignmentType.CENTER,
                    fill: rowFill
                })
            ]
        });
    });
}

function buildDnSummaryRow(dnLabel: string, count: number, dnTotal: number): TableRow {
    return new TableRow({
        children: [
            textCell('', { columnSpan: 4, fill: COLOR_BG_SUMMARY, size: SZ_TABLE_BODY }),
            textCell(`Razem ${dnLabel} (${count} szt.):`, {
                bold: true,
                size: SZ_TABLE_BODY,
                alignment: AlignmentType.RIGHT,
                fill: COLOR_BG_SUMMARY
            }),
            textCell(`${fmtCurrency(dnTotal)} PLN`, {
                bold: true,
                size: SZ_TABLE_BODY,
                alignment: AlignmentType.CENTER,
                fill: COLOR_BG_SUMMARY
            })
        ]
    });
}
