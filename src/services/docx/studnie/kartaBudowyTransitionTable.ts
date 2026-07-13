import { Paragraph, Table, TableRow } from 'docx';
import { textCell } from '../helpers';
import { COLOR_GRAY_HEADER, COLOR_WHITE, SZ_TABLE_BODY, SZ_TABLE_HEADER } from '../constants';
import { sectionRow, SPACER } from './kartaBudowyHelpers';

interface TransSummary {
    cat: string;
    dn: number | string;
    cntD: number;
    cntOT: number;
    cntTotal: number;
}

function findPrzejscieByIdPrefix(
    products: Map<
        string,
        { componentType: string; category: string; dn: number | string; height: number }
    >,
    productId: string
): { componentType: string; category: string; dn: number | string; height: number } | undefined {
    for (const [id, p] of products) {
        if (id.startsWith(productId) && p.componentType === 'przejscie') return p;
    }
    return undefined;
}

export function buildRealTransitionsTable(
    orderData: Record<string, unknown>,
    products: Map<
        string,
        { componentType: string; category: string; dn: number | string; height: number }
    >
): (Paragraph | Table)[] {
    const children: (Paragraph | Table)[] = [];
    const wsz = (Array.isArray(orderData.wells) ? orderData.wells : []) as any[];
    const tCounts = new Map<string, TransSummary>();

    for (const w of wsz) {
        const segments: { start: number; end: number; isDennica: boolean; isOT: boolean }[] = [];
        const cfg = (Array.isArray(w.config) ? w.config : []) as any[];
        const relevant = cfg.filter((item: any) => {
            const prod = products.get(item.productId);
            return (
                prod &&
                (prod.componentType === 'dennica' ||
                    prod.componentType === 'krag' ||
                    prod.componentType === 'krag_ot')
            );
        });
        let y = 0;
        for (const item of [...relevant].reverse()) {
            const prod = products.get(item.productId);
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

        const rzdDna = parseFloat(w.rzednaDna);
        if (isNaN(rzdDna)) continue;

        const pjs = (Array.isArray(w.przejscia) ? w.przejscia : []) as any[];
        for (const pj of pjs) {
            let prod = products.get(pj.productId);
            if (!prod || prod.componentType !== 'przejscie') {
                prod = findPrzejscieByIdPrefix(products, pj.productId);
                if (!prod) continue;
            }

            const rzdPj = parseFloat(pj.rzednaWlaczenia);
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
                width: { size: 100, type: 'PERCENTAGE' as any },
                rows: [
                    sectionRow('Rzeczywista ilość przejść w zamówieniu', 6),
                    new TableRow({
                        children: [
                            textCell('Lp.', {
                                width: 8,
                                size: SZ_TABLE_HEADER,
                                alignment: 'CENTER' as any,
                                bold: true,
                                fill: COLOR_GRAY_HEADER,
                                color: COLOR_WHITE
                            }),
                            textCell('Rodzaj przejścia', {
                                width: 30,
                                size: SZ_TABLE_HEADER,
                                alignment: 'CENTER' as any,
                                bold: true,
                                fill: COLOR_GRAY_HEADER,
                                color: COLOR_WHITE
                            }),
                            textCell('Średnica (DN)', {
                                width: 14,
                                size: SZ_TABLE_HEADER,
                                alignment: 'CENTER' as any,
                                bold: true,
                                fill: COLOR_GRAY_HEADER,
                                color: COLOR_WHITE
                            }),
                            textCell('Ilość', {
                                width: 16,
                                size: SZ_TABLE_HEADER,
                                alignment: 'CENTER' as any,
                                bold: true,
                                fill: COLOR_GRAY_HEADER,
                                color: COLOR_WHITE
                            }),
                            textCell('Kręgi wiercone', {
                                width: 16,
                                size: SZ_TABLE_HEADER,
                                alignment: 'CENTER' as any,
                                bold: true,
                                fill: COLOR_GRAY_HEADER,
                                color: COLOR_WHITE
                            }),
                            textCell('Suma', {
                                width: 16,
                                size: SZ_TABLE_HEADER,
                                alignment: 'CENTER' as any,
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
                                        alignment: 'CENTER' as any
                                    }),
                                    textCell(row.cat, { width: 30, size: SZ_TABLE_BODY }),
                                    textCell(typeof row.dn === 'string' ? row.dn : `DN${row.dn}`, {
                                        width: 14,
                                        size: SZ_TABLE_BODY,
                                        alignment: 'CENTER' as any
                                    }),
                                    textCell(String(row.cntD), {
                                        width: 16,
                                        size: SZ_TABLE_BODY,
                                        alignment: 'CENTER' as any
                                    }),
                                    textCell(String(row.cntOT), {
                                        width: 16,
                                        size: SZ_TABLE_BODY,
                                        alignment: 'CENTER' as any
                                    }),
                                    textCell(String(row.cntTotal), {
                                        width: 16,
                                        size: SZ_TABLE_BODY,
                                        alignment: 'CENTER' as any
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
                                alignment: 'CENTER' as any
                            }),
                            textCell('', { width: 14, size: SZ_TABLE_BODY }),
                            textCell(String(gD), {
                                width: 16,
                                size: SZ_TABLE_BODY,
                                bold: true,
                                alignment: 'CENTER' as any
                            }),
                            textCell(String(gOT), {
                                width: 16,
                                size: SZ_TABLE_BODY,
                                bold: true,
                                alignment: 'CENTER' as any
                            }),
                            textCell(String(gTotal), {
                                width: 16,
                                size: SZ_TABLE_BODY,
                                bold: true,
                                alignment: 'CENTER' as any
                            })
                        ]
                    })
                ]
            })
        );
    }

    return children;
}
