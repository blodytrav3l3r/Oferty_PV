import {
    Packer,
    Document,
    Paragraph,
    TextRun,
    Table,
    TableRow,
    TableCell,
    WidthType,
    AlignmentType,
    ShadingType,
    BorderStyle
} from 'docx';
import { logger } from '../../../utils/logger';
import path from 'path';
import fs from 'fs';
import prisma from '../../../prismaClient';
import type { KartaBudowyMeta, KartaBudowyOrderData } from '../../../types/kartaBudowy';
import { textCell } from '../helpers';
import { DOCX_COLORS } from '../colors';
import {
    FONT,
    COLOR_BODY,
    COLOR_GRAY_HEADER,
    COLOR_WHITE,
    COLOR_LABEL,
    SZ_TABLE_BODY,
    SZ_TABLE_HEADER,
    BORDER_DOTTED,
    BORDER_NONE,
    NO_BORDERS,
    CELL_BORDERS,
    type CellBorders
} from '../constants';

// ─── Border composites ───────────────────────────────────────

const INFO_BOTTOM: CellBorders = {
    top: BORDER_NONE,
    bottom: BORDER_DOTTED,
    left: BORDER_NONE,
    right: BORDER_NONE
};

const EVEN_ROW_FILL = DOCX_COLORS.rowAlt;
const SPACER = new Paragraph({ spacing: { before: 240 }, children: [] });

// ─── Section header row (merged cell, gray bg, white uppercase) ─

function sectionRow(text: string, span: number = 2): TableRow {
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

// ─── Info row (label | value with dotted bottom border) ──────

function infoRow(label: string, value: string, labelWidth: number = 45): TableRow {
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

// ─── Info grid section (merged header row + 2-col table) ─────

function infoSection(heading: string, rows: TableRow[]): (Table | Paragraph)[] {
    return [
        new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            columnWidths: [4500, 5500],
            rows: [sectionRow(heading), ...rows]
        }),
        SPACER
    ];
}

// ─── Transition table helpers ────────────────────────────────

const TBL_COLS = [
    { text: 'Lp.', width: 8 },
    { text: 'Rodzaj przejścia', width: 28 },
    { text: 'DN OD', width: 14 },
    { text: 'DN DO', width: 14 },
    { text: 'Uwagi', width: 26 },
    { text: 'Czy przejście?', width: 10 }
];

function transitionHeaderRow(): TableRow {
    return new TableRow({
        children: TBL_COLS.map((c) =>
            textCell(c.text, {
                width: c.width,
                size: SZ_TABLE_HEADER,
                alignment: AlignmentType.CENTER,
                bold: true,
                fill: COLOR_GRAY_HEADER,
                color: COLOR_WHITE
            })
        )
    });
}

function transitionDataRow(p: Record<string, unknown>, idx: number): TableRow {
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
                alignment: AlignmentType.CENTER,
                fill: idx % 2 === 1 ? EVEN_ROW_FILL : undefined
            })
        )
    });
}

// ─── Main export ─────────────────────────────────────────────

export async function generateKartaBudowyDOCX(orderId: string): Promise<Buffer> {
    const order = await prisma.orders_studnie_rel.findUnique({ where: { id: orderId } });

    if (!order) {
        throw new Error('Zamówienie studni nie znaleziona');
    }

    let orderData: KartaBudowyOrderData = {};
    if (order.data) {
        try {
            orderData = JSON.parse(order.data) as KartaBudowyOrderData;
        } catch (e) {
            logger.warn('DocxKartaBudowy', 'Nie udało się sparsować danych zamówienia', e);
        }
    }

    const kb: KartaBudowyMeta = orderData.kartaBudowy || {};

    const nrZamowienia = String(
        orderData.orderNumber || orderData.productionOrderNumber || String(order.id).substring(0, 8)
    );
    const nrOferty = String(
        orderData.offerNumber ||
            orderData.number ||
            (Array.isArray(kb.offerNumbers) ? kb.offerNumbers.join(', ') : '—')
    );

    const children: (Paragraph | Table)[] = [];

    // 0. Tytuł dokumentu (raz, na pierwszej stronie)
    children.push(
        new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 0 },
            border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: COLOR_GRAY_HEADER } },
            children: [
                new TextRun({
                    text: 'KARTA BUDOWY',
                    bold: true,
                    size: 28,
                    font: FONT,
                    color: COLOR_BODY
                })
            ]
        })
    );
    children.push(
        new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 60, after: 200 },
            children: [
                new TextRun({
                    text: `Nr zamówienia: ${nrZamowienia}`,
                    bold: true,
                    size: 20,
                    font: FONT,
                    color: COLOR_LABEL
                })
            ]
        })
    );

    // 1. Podstawowe Informacje
    children.push(
        ...infoSection('Podstawowe Informacje', [
            infoRow('Nr powiązanej oferty', nrOferty),
            infoRow('Data zamówienia', String(kb.dataZamowienia || '—')),
            infoRow('Osoba kontaktowa', String(kb.osobaKontakt || '—')),
            infoRow('Adres wysyłki', String(kb.adresWysylki || '—')),
            infoRow('E-mail (Faktura)', String(kb.emailFaktura || '—')),
            infoRow('E-mail (e-Faktura)', String(kb.emailEfaktura || '—'))
        ])
    );

    // 2. Logistyka i Płatności
    children.push(
        ...infoSection('Logistyka i Płatności', [
            infoRow('Warunki płatności', String(kb.warunkiPlatnosci || '—')),
            infoRow('Ilość dni', String(kb.iloscDni || '—')),
            infoRow('Rodzaj transportu', String(kb.rodzajTransportu || '—')),
            infoRow('Koszt transportu', String(kb.wyliczonyTransport || '—')),
            infoRow('Zabezpieczenie transportu', String(kb.zabezpieczenieTransportu || '—')),
            infoRow('Ubezpieczenie', String(kb.ubezpieczenie || '—'))
        ])
    );

    // 3. Studnia i Beton
    children.push(
        ...infoSection('Studnia i Beton', [
            infoRow('Rodzaj studni', String(kb.rodzajStudni || '—')),
            infoRow('Właściwości betonu', String(kb.wlasciwosciBetonu || '—')),
            infoRow('Pozostałe właściwości', String(kb.pozostaleWlasciwosci || '—')),
            infoRow(
                'Rodzaj stopni',
                String(kb.rodzajStopni || '—') +
                    (kb.rodzajStopniInne ? ` (${kb.rodzajStopniInne})` : '')
            ),
            infoRow(
                'Uszczelka studni',
                String(kb.uszczelkaStudni || '—') +
                    (kb.uszczelkaStudniInne ? ` (${kb.uszczelkaStudniInne})` : '')
            )
        ])
    );

    // 4. Kineta i Spocznik
    children.push(
        ...infoSection('Kineta i Spocznik', [
            infoRow(
                'Kineta',
                String(kb.kineta || '—') + (kb.kinetaInne ? ` (${kb.kinetaInne})` : '')
            ),
            infoRow('Redukcja kinety', String(kb.redukcjaKinety || '—')),
            infoRow('Usytuowanie', String(kb.usytuowanie || '—')),
            infoRow('Wysokość spocznika', String(kb.wysokoscSpocznika || '—')),
            infoRow(
                'Ślepa kineta',
                String(kb.slepaKineta || '—') +
                    (kb.slepaKinetaUwagi ? ` (${kb.slepaKinetaUwagi})` : '')
            ),
            infoRow(
                'Kaskada',
                String(kb.kaskada || '—') + (kb.kaskadaUwagi ? ` (${kb.kaskadaUwagi})` : '')
            )
        ])
    );

    // 5. Przejścia
    children.push(
        ...infoSection('Przejścia', [
            infoRow('Przejścia szczelne', String(kb.przejsciaSzczelne || '—')),
            infoRow('Przejścia tulejowe', String(kb.przejsciaTulejowe || '—')),
            infoRow('Przejścia zamówione w', String(kb.przejsciaZamowione || '—'))
        ])
    );

    // 6. Transition table (conditional)
    if (Array.isArray(kb.przejsciaDetails) && kb.przejsciaDetails.length > 0) {
        children.push(
            new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                rows: [
                    sectionRow('Szczegóły przejść', 6),
                    transitionHeaderRow(),
                    ...kb.przejsciaDetails.map((p: any, idx: number) => transitionDataRow(p, idx))
                ]
            })
        );
        children.push(SPACER);
    }

    // 7. Uwagi ogólne
    const uwagiText = String(kb.uwagiOgolne || '—');
    const uwagiLines = uwagiText.split('\n');
    const uwagiRuns = uwagiLines.flatMap((line, i) => [
        ...(i > 0 ? [new TextRun({ break: 1 })] : []),
        new TextRun({ text: line, size: SZ_TABLE_BODY, font: FONT, color: COLOR_BODY })
    ]);

    children.push(
        new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
                sectionRow('Uwagi ogólne', 1),
                new TableRow({
                    children: [
                        new TableCell({
                            borders: CELL_BORDERS,
                            shading: {
                                type: ShadingType.SOLID,
                                color: DOCX_COLORS.infoBg,
                                fill: DOCX_COLORS.infoBg
                            },
                            children: [
                                new Paragraph({
                                    spacing: { before: 60, after: 60 },
                                    children: uwagiRuns
                                })
                            ]
                        })
                    ]
                })
            ]
        })
    );

    // 8. Rzeczywista ilość przejść (z wells[], nie z kartaBudowy snapshota)
    const allProducts = new Map<
        string,
        { componentType: string; category: string; dn: number | string; height: number }
    >();
    try {
        const jsonPath = path.join(process.cwd(), 'data', 'seed_studnie.json');
        const raw = fs.readFileSync(jsonPath, 'utf-8');
        const products: any[] = JSON.parse(raw);
        for (const p of products) {
            allProducts.set(p.id, {
                componentType: p.componentType || '',
                category: p.category || '',
                dn: p.dn || 0,
                height: p.height || 0
            });
        }
    } catch (e) {
        logger.warn('DocxKartaBudowy', 'Nie udało się załadować produktów', e);
    }

    function _findPrzejscieByIdPrefix(
        products: Map<
            string,
            { componentType: string; category: string; dn: number | string; height: number }
        >,
        productId: string
    ):
        | { componentType: string; category: string; dn: number | string; height: number }
        | undefined {
        for (const [id, p] of products) {
            if (id.startsWith(productId) && p.componentType === 'przejscie') return p;
        }
        return undefined;
    }

    const wsz = orderData.wells || [];

    interface TransSummary {
        cat: string;
        dn: number | string;
        cntD: number;
        cntOT: number;
        cntTotal: number;
    }
    const tCounts = new Map<string, TransSummary>();

    for (const w of wsz) {
        // Build well segments bottom-up from config (dennica + krag + krag_ot only)
        const segments: { start: number; end: number; isDennica: boolean; isOT: boolean }[] = [];
        const cfg = w.config || [];
        const relevant = cfg.filter((item) => {
            const prod = allProducts.get(item.productId);
            return (
                prod &&
                (prod.componentType === 'dennica' ||
                    prod.componentType === 'krag' ||
                    prod.componentType === 'krag_ot')
            );
        });
        let y = 0;
        for (const item of [...relevant].reverse()) {
            const prod = allProducts.get(item.productId);
            if (!prod || !prod.height) continue;
            const h = prod.height * (item.quantity || 1);
            segments.push({
                start: y,
                end: y + h,
                isDennica: prod.componentType === 'dennica',
                isOT: prod.componentType === 'krag_ot'
            });
            y += h;
        }

        const rzdDna = parseFloat(w.rzednaDna ?? '');
        if (isNaN(rzdDna)) continue;

        const pjs = w.przejscia || [];
        for (const pj of pjs) {
            let prod = allProducts.get(pj.productId);
            if (!prod || prod.componentType !== 'przejscie') {
                prod = _findPrzejscieByIdPrefix(allProducts, pj.productId);
                if (!prod) continue;
            }

            const rzdPj = parseFloat(pj.rzednaWlaczenia ?? '');
            if (isNaN(rzdPj)) continue;
            const mmFromBottom = (rzdPj - rzdDna) * 1000;

            let inD = false,
                inOT = false;
            for (const seg of segments) {
                if (mmFromBottom >= seg.start && mmFromBottom < seg.end) {
                    if (seg.isDennica) inD = true;
                    else if (seg.isOT) inOT = true;
                    break;
                }
            }

            const cat = prod.category || 'Nieznany';
            const dn = prod.dn || 0;
            const key = `${cat}_${dn}`;
            let ex = tCounts.get(key);
            if (!ex) {
                ex = { cat, dn, cntD: 0, cntOT: 0, cntTotal: 0 };
                tCounts.set(key, ex);
            }
            ex.cntTotal++;
            if (inD) ex.cntD++;
            if (inOT) ex.cntOT++;
        }
    }

    if (tCounts.size > 0) {
        const sorted = [...tCounts.values()].sort((a, b) => {
            if (a.cat !== b.cat) return a.cat.localeCompare(b.cat);
            const dnA = typeof a.dn === 'string' ? parseFloat(a.dn.split('/')[0]) || 0 : a.dn;
            const dnB = typeof b.dn === 'string' ? parseFloat(b.dn.split('/')[0]) || 0 : b.dn;
            return dnA - dnB;
        });
        let gD = 0,
            gOT = 0,
            gTotal = 0;
        for (const r of sorted) {
            gD += r.cntD;
            gOT += r.cntOT;
            gTotal += r.cntTotal;
        }

        children.push(new Paragraph({ pageBreakBefore: true, children: [] }));
        children.push(SPACER);
        children.push(
            new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                rows: [
                    sectionRow('Rzeczywista ilość przejść w zamówieniu', 6),
                    new TableRow({
                        children: [
                            textCell('Lp.', {
                                width: 8,
                                size: SZ_TABLE_HEADER,
                                alignment: AlignmentType.CENTER,
                                bold: true,
                                fill: COLOR_GRAY_HEADER,
                                color: COLOR_WHITE
                            }),
                            textCell('Rodzaj przejścia', {
                                width: 30,
                                size: SZ_TABLE_HEADER,
                                alignment: AlignmentType.CENTER,
                                bold: true,
                                fill: COLOR_GRAY_HEADER,
                                color: COLOR_WHITE
                            }),
                            textCell('Średnica (DN)', {
                                width: 14,
                                size: SZ_TABLE_HEADER,
                                alignment: AlignmentType.CENTER,
                                bold: true,
                                fill: COLOR_GRAY_HEADER,
                                color: COLOR_WHITE
                            }),
                            textCell('Ilość', {
                                width: 16,
                                size: SZ_TABLE_HEADER,
                                alignment: AlignmentType.CENTER,
                                bold: true,
                                fill: COLOR_GRAY_HEADER,
                                color: COLOR_WHITE
                            }),
                            textCell('Kręgi wiercone', {
                                width: 16,
                                size: SZ_TABLE_HEADER,
                                alignment: AlignmentType.CENTER,
                                bold: true,
                                fill: COLOR_GRAY_HEADER,
                                color: COLOR_WHITE
                            }),
                            textCell('Suma', {
                                width: 16,
                                size: SZ_TABLE_HEADER,
                                alignment: AlignmentType.CENTER,
                                bold: true,
                                fill: COLOR_GRAY_HEADER,
                                color: COLOR_WHITE
                            })
                        ]
                    }),
                    ...sorted.map(
                        (row, idx) =>
                            new TableRow({
                                children: [
                                    textCell(String(idx + 1), {
                                        width: 8,
                                        size: SZ_TABLE_BODY,
                                        alignment: AlignmentType.CENTER
                                    }),
                                    textCell(row.cat, { width: 30, size: SZ_TABLE_BODY }),
                                    textCell(typeof row.dn === 'string' ? row.dn : `DN${row.dn}`, {
                                        width: 14,
                                        size: SZ_TABLE_BODY,
                                        alignment: AlignmentType.CENTER
                                    }),
                                    textCell(String(row.cntD), {
                                        width: 16,
                                        size: SZ_TABLE_BODY,
                                        alignment: AlignmentType.CENTER
                                    }),
                                    textCell(String(row.cntOT), {
                                        width: 16,
                                        size: SZ_TABLE_BODY,
                                        alignment: AlignmentType.CENTER
                                    }),
                                    textCell(String(row.cntTotal), {
                                        width: 16,
                                        size: SZ_TABLE_BODY,
                                        alignment: AlignmentType.CENTER
                                    })
                                ]
                            })
                    ),
                    new TableRow({
                        children: [
                            textCell('', { width: 8, size: SZ_TABLE_BODY }),
                            textCell('Razem', {
                                width: 30,
                                size: SZ_TABLE_BODY,
                                bold: true,
                                alignment: AlignmentType.CENTER
                            }),
                            textCell('', { width: 14, size: SZ_TABLE_BODY }),
                            textCell(String(gD), {
                                width: 16,
                                size: SZ_TABLE_BODY,
                                bold: true,
                                alignment: AlignmentType.CENTER
                            }),
                            textCell(String(gOT), {
                                width: 16,
                                size: SZ_TABLE_BODY,
                                bold: true,
                                alignment: AlignmentType.CENTER
                            }),
                            textCell(String(gTotal), {
                                width: 16,
                                size: SZ_TABLE_BODY,
                                bold: true,
                                alignment: AlignmentType.CENTER
                            })
                        ]
                    })
                ]
            })
        );
    }

    // 9. Ilość elementów w zamówieniu
    const TYPE_LABELS: Record<string, string> = {
        dennica: 'Dennica',
        krag: 'Krąg',
        krag_ot: 'Krąg wiercony',
        konus: 'Konus',
        plyta_din: 'Płyta DIN',
        plyta_redukcyjna: 'Płyta redukcyjna',
        avr: 'AVR',
        styczna: 'Studnia styczna',
        uszczelka: 'Uszczelka',
        pierscien_odciazajacy: 'Pierścień odciążający',
        plyta_zamykajaca: 'Płyta zamykająca',
        plyta_najazdowa: 'Płyta najazdowa'
    };
    const TYPE_ORDER = [
        'dennica',
        'krag',
        'krag_ot',
        'konus',
        'plyta_din',
        'plyta_redukcyjna',
        'avr',
        'styczna',
        'uszczelka',
        'pierscien_odciazajacy',
        'plyta_zamykajaca',
        'plyta_najazdowa'
    ];

    const elemMap = new Map<string, { pid: string; type: string; desc: string; qty: number }>();
    for (const w of wsz) {
        const cfg = w.config || [];
        for (const item of cfg) {
            const prod = allProducts.get(item.productId);
            const ct = prod?.componentType || '';
            if (ct === 'wlaz' || ct === 'kineta') continue;
            const key = item.productId;
            const ex = elemMap.get(key);
            if (ex) {
                ex.qty += item.quantity || 1;
                continue;
            }
            const label = TYPE_LABELS[ct] || ct || '—';
            const dnStr = prod?.dn ? `DN${prod.dn}` : '';
            const hStr = prod?.height ? `H=${prod.height}mm` : '';
            const desc =
                [dnStr, hStr].filter(Boolean).join(', ') || item.frozenName || item.productId;
            elemMap.set(key, { pid: item.productId, type: label, desc, qty: item.quantity || 1 });
        }
    }

    if (elemMap.size > 0) {
        const sorted = [...elemMap.values()].sort((a, b) => {
            const aCt = allProducts.get(a.pid)?.componentType || '';
            const bCt = allProducts.get(b.pid)?.componentType || '';
            const r = TYPE_ORDER.indexOf(aCt) - TYPE_ORDER.indexOf(bCt);
            return r !== 0 ? r : a.pid.localeCompare(b.pid);
        });
        let totalQty = 0;
        for (const r of sorted) totalQty += r.qty;

        children.push(SPACER);
        children.push(
            new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                rows: [
                    sectionRow('Ilość elementów w zamówieniu', 5),
                    new TableRow({
                        children: [
                            textCell('Lp.', {
                                width: 8,
                                size: SZ_TABLE_HEADER,
                                alignment: AlignmentType.CENTER,
                                bold: true,
                                fill: COLOR_GRAY_HEADER,
                                color: COLOR_WHITE
                            }),
                            textCell('Indeks', {
                                width: 22,
                                size: SZ_TABLE_HEADER,
                                alignment: AlignmentType.CENTER,
                                bold: true,
                                fill: COLOR_GRAY_HEADER,
                                color: COLOR_WHITE
                            }),
                            textCell('Typ elementu', {
                                width: 20,
                                size: SZ_TABLE_HEADER,
                                alignment: AlignmentType.CENTER,
                                bold: true,
                                fill: COLOR_GRAY_HEADER,
                                color: COLOR_WHITE
                            }),
                            textCell('Opis', {
                                width: 30,
                                size: SZ_TABLE_HEADER,
                                alignment: AlignmentType.CENTER,
                                bold: true,
                                fill: COLOR_GRAY_HEADER,
                                color: COLOR_WHITE
                            }),
                            textCell('Ilość', {
                                width: 20,
                                size: SZ_TABLE_HEADER,
                                alignment: AlignmentType.CENTER,
                                bold: true,
                                fill: COLOR_GRAY_HEADER,
                                color: COLOR_WHITE
                            })
                        ]
                    }),
                    ...sorted.map(
                        (row, idx) =>
                            new TableRow({
                                children: [
                                    textCell(String(idx + 1), {
                                        width: 8,
                                        size: SZ_TABLE_BODY,
                                        alignment: AlignmentType.CENTER
                                    }),
                                    textCell(row.pid, { width: 22, size: SZ_TABLE_BODY }),
                                    textCell(row.type, { width: 20, size: SZ_TABLE_BODY }),
                                    textCell(row.desc, { width: 30, size: SZ_TABLE_BODY }),
                                    textCell(String(row.qty), {
                                        width: 20,
                                        size: SZ_TABLE_BODY,
                                        alignment: AlignmentType.CENTER
                                    })
                                ]
                            })
                    ),
                    new TableRow({
                        children: [
                            textCell('', { width: 8, size: SZ_TABLE_BODY }),
                            textCell('', { width: 22, size: SZ_TABLE_BODY }),
                            textCell('Razem', {
                                width: 20,
                                size: SZ_TABLE_BODY,
                                bold: true,
                                alignment: AlignmentType.CENTER
                            }),
                            textCell('', { width: 30, size: SZ_TABLE_BODY }),
                            textCell(String(totalQty), {
                                width: 20,
                                size: SZ_TABLE_BODY,
                                bold: true,
                                alignment: AlignmentType.CENTER
                            })
                        ]
                    })
                ]
            })
        );
    }

    const doc = new Document({
        sections: [
            {
                properties: {},
                children
            }
        ]
    });

    return Packer.toBuffer(doc);
}
