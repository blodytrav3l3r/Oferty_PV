import {
    Paragraph,
    TextRun,
    Table,
    TableRow,
    TableCell,
    WidthType,
    AlignmentType,
    BorderStyle,
    ShadingType
} from 'docx';
import { DOCX_COLORS } from '../colors';
import {
    FONT,
    COLOR_GRAY_HEADER,
    COLOR_WHITE,
    COLOR_BG_SUMMARY,
    CELL_BORDERS
} from '../constants';

const SZ_RURY_DH = 20;   // 10pt
const SZ_RURY_TH = 14;   // 7pt
const SZ_RURY_TB = 16;   // 8pt
const SZ_RURY_PID = 14;  // 7pt
import { fmtCurrency, fmtInt, textCell } from '../helpers';

const CATEGORY_ORDER = [
    'Rury Betonowe', 'Żelbetowe KL. A (II)', 'Żelbetowe KL. S (I)',
    'Duże Żelbetowe II', 'Rury Jajowe Betonowe', 'Rury Jajowe Żelbetowe',
    'Akcesoria PEHD', 'Uszczelki', 'Zabezpieczenie transportu'
];

function getDiameter(id: string): number {
    const parts = id.split('-');
    if (parts.length >= 3) {
        const code = parseInt(parts[2]);
        if (!isNaN(code) && code > 0) return code * 100;
    }
    return 99999;
}

function isBosy(item: Record<string, unknown>): boolean {
    const name = String(item.name ?? '').toLowerCase();
    const id = String(item.productId ?? '');
    return name.includes('bosy') || id.endsWith('-B00');
}

function getCategory(item: Record<string, unknown>): string {
    return String(item.category ?? 'Inne');
}

export function buildItemsTable(items: Record<string, unknown>[]): {
    paragraphs: (Paragraph | Table)[];
    grandTotal: number;
} {
    const paragraphs: (Paragraph | Table)[] = [];
    let grandTotal = 0;
    let globalLp = 1;

    // Group by category → diameter
    const groupedByCat: Record<string, Record<string, Record<string, unknown>[]>> = {};
    for (const item of items) {
        const cat = getCategory(item);
        if (!groupedByCat[cat]) groupedByCat[cat] = {};
        const diam = getDiameter(String(item.productId ?? ''));
        const diamKey = diam < 99999 ? `DN ${diam}` : 'Inne';
        if (!groupedByCat[cat][diamKey]) groupedByCat[cat][diamKey] = [];
        groupedByCat[cat][diamKey].push(item);
    }

    const sortedCats = Object.keys(groupedByCat).sort((a, b) => {
        const ia = CATEGORY_ORDER.indexOf(a);
        const ib = CATEGORY_ORDER.indexOf(b);
        return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    });

    const thStyle = {
        bold: true,
        size: SZ_RURY_TH,
        fill: COLOR_GRAY_HEADER,
        color: COLOR_WHITE,
        alignment: AlignmentType.CENTER
    };

    for (const cat of sortedCats) {
        const diamGroups = groupedByCat[cat];
        let catTotal = 0;

        const sortedDiams = Object.keys(diamGroups).sort((a, b) => {
            const da = parseInt(a.replace('DN ', '')) || 99999;
            const db = parseInt(b.replace('DN ', '')) || 99999;
            return da - db;
        });

        paragraphs.push(
            new Paragraph({
                children: [
                    new TextRun({ text: cat, bold: true, size: SZ_RURY_DH, font: FONT, color: COLOR_GRAY_HEADER })
                ],
                spacing: { before: 120, after: 40 },
                border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: COLOR_GRAY_HEADER } }
            })
        );

        const rows: TableRow[] = [];
        rows.push(
            new TableRow({
                tableHeader: true,
                children: [
                    textCell('Lp.', { ...thStyle, width: 5 }),
                    textCell('Nazwa / Indeks', { ...thStyle, width: 52 }),
                    textCell('Dł. [m]', { ...thStyle, width: 10 }),
                    textCell('Ilość [szt.]', { ...thStyle, width: 10 }),
                    textCell('Cena jedn.', { ...thStyle, width: 11 }),
                    textCell('Suma netto [PLN]', { ...thStyle, width: 12 }),
                ]
            })
        );

        for (const diamKey of sortedDiams) {
            const itemsInDiam = diamGroups[diamKey];
            itemsInDiam.sort((a, b) => {
                const aBB = isBosy(a);
                const bBB = isBosy(b);
                if (aBB !== bBB) return aBB ? -1 : 1;
                return (Number(a.lengthM ?? 0)) - (Number(b.lengthM ?? 0));
            });

            for (const item of itemsInDiam) {
                const name = String(item.name ?? '');
                const productId = String(item.productId ?? '');
                const unitPrice = Number(item.unitPrice ?? item.price ?? 0);
                const quantity = Number(item.quantity ?? 1);
                const discount = Number(item.discount ?? 0);
                const lengthM = Number(item.lengthM ?? 0);
                const meters = Number(item.meters ?? 0);
                const hasLength = lengthM > 0;
                const displayMeters = hasLength ? (meters > 0 ? meters : (lengthM / 1000) * quantity) : 0;
                const pehdType = String(item.pehdType ?? '');
                const pehdCost = Number(item.pehdCostPerUnit ?? 0);
                const surcharge = Number(item.surcharge ?? 0);
                const itemPrice = unitPrice * (1 - discount / 100) + pehdCost + surcharge;
                const netto = itemPrice * quantity;
                const rowFill = (globalLp % 2 !== 0) ? undefined : DOCX_COLORS.rowAlt;

                catTotal += netto;
                grandTotal += netto;

                const nameRuns: TextRun[] = [
                    new TextRun({ text: name, size: SZ_RURY_TB, font: FONT, color: DOCX_COLORS.titleText })
                ];
                if (pehdType === 'PEHD-3MM') nameRuns.push(new TextRun({ text: ' PEHD 3mm', size: SZ_RURY_TB, font: FONT, color: DOCX_COLORS.titleText }));
                if (pehdType === 'PEHD-4MM') nameRuns.push(new TextRun({ text: ' PEHD 4mm', size: SZ_RURY_TB, font: FONT, color: DOCX_COLORS.titleText }));

                rows.push(
                    new TableRow({
                        children: [
                            textCell(String(globalLp), { size: SZ_RURY_TB, alignment: AlignmentType.CENTER, fill: rowFill }),
                            new TableCell({
                                children: [
                                    new Paragraph({ children: nameRuns, spacing: { before: 15, after: 0 } }),
                                    new Paragraph({ children: [new TextRun({ text: productId, size: SZ_RURY_PID, font: FONT, color: DOCX_COLORS.headerText })], spacing: { before: 0, after: 15 } })
                                ],
                                shading: rowFill ? { type: ShadingType.SOLID, color: rowFill, fill: rowFill } : undefined,
                                borders: CELL_BORDERS
                            }),
                            textCell(hasLength ? displayMeters.toFixed(2) : '\u2014', { size: SZ_RURY_TB, alignment: AlignmentType.CENTER, fill: rowFill }),
                            textCell(fmtInt(quantity), { size: SZ_RURY_TB, alignment: AlignmentType.CENTER, fill: rowFill }),
                            textCell(fmtCurrency(unitPrice), { size: SZ_RURY_TB, alignment: AlignmentType.RIGHT, fill: rowFill }),
                            textCell(fmtCurrency(netto), { bold: true, size: SZ_RURY_TB, alignment: AlignmentType.RIGHT, fill: rowFill }),
                        ]
                    })
                );
                globalLp++;
            }
        }

        rows.push(
            new TableRow({
                children: [
                    textCell('', { columnSpan: 4, fill: COLOR_BG_SUMMARY, size: SZ_RURY_TB }),
                    textCell('Suma:', {
                        bold: true,
                        size: SZ_RURY_TB,
                        alignment: AlignmentType.RIGHT,
                        fill: COLOR_BG_SUMMARY
                    }),
                    textCell(`${fmtCurrency(catTotal)} PLN`, {
                        bold: true,
                        size: SZ_RURY_TB,
                        alignment: AlignmentType.CENTER,
                        fill: COLOR_BG_SUMMARY
                    })
                ]
            })
        );

        paragraphs.push(new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } }));
    }

    return { paragraphs, grandTotal };
}
