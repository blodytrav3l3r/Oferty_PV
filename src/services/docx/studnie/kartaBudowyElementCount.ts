import { Paragraph, Table, TableRow } from 'docx';
import { textCell } from '../helpers';
import { COLOR_GRAY_HEADER, COLOR_WHITE, SZ_TABLE_BODY, SZ_TABLE_HEADER } from '../constants';
import { sectionRow, SPACER } from './kartaBudowyHelpers';

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

export function buildElementCountTable(
    orderData: Record<string, unknown>,
    products: Map<
        string,
        { componentType: string; category: string; dn: number | string; height: number }
    >
): (Paragraph | Table)[] {
    const children: (Paragraph | Table)[] = [];
    const wsz = (Array.isArray(orderData.wells) ? orderData.wells : []) as any[];
    const elemMap = new Map<string, { pid: string; type: string; desc: string; qty: number }>();

    for (const w of wsz) {
        const cfg = (Array.isArray(w.config) ? w.config : []) as any[];
        for (const item of cfg) {
            const prod = products.get(item.productId);
            const ct = prod?.componentType || '';
            if (ct === 'wlaz' || ct === 'kineta') continue;
            const key = item.productId;
            const ex = elemMap.get(key);
            if (ex) {
                ex.qty += item.quantity || 1;
                continue;
            }
            const label = TYPE_LABELS[ct] || ct || '\u2014';
            const dnStr = prod?.dn ? `DN${prod.dn}` : '';
            const hStr = prod?.height ? `H=${prod.height}mm` : '';
            const desc =
                [dnStr, hStr].filter(Boolean).join(', ') || item.frozenName || item.productId;
            elemMap.set(key, { pid: item.productId, type: label, desc, qty: item.quantity || 1 });
        }
    }

    if (elemMap.size > 0) {
        const sorted = [...elemMap.values()].sort((a, b) => {
            const aCt = products.get(a.pid)?.componentType || '';
            const bCt = products.get(b.pid)?.componentType || '';
            const r = TYPE_ORDER.indexOf(aCt) - TYPE_ORDER.indexOf(bCt);
            return r !== 0 ? r : a.pid.localeCompare(b.pid);
        });
        let totalQty = 0;
        for (const r of sorted) totalQty += r.qty;

        children.push(SPACER);
        children.push(
            new Table({
                width: { size: 100, type: 'PERCENTAGE' as any },
                rows: [
                    sectionRow('Ilość elementów w zamówieniu', 5),
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
                            textCell('Indeks', {
                                width: 22,
                                size: SZ_TABLE_HEADER,
                                alignment: 'CENTER' as any,
                                bold: true,
                                fill: COLOR_GRAY_HEADER,
                                color: COLOR_WHITE
                            }),
                            textCell('Typ elementu', {
                                width: 20,
                                size: SZ_TABLE_HEADER,
                                alignment: 'CENTER' as any,
                                bold: true,
                                fill: COLOR_GRAY_HEADER,
                                color: COLOR_WHITE
                            }),
                            textCell('Opis', {
                                width: 30,
                                size: SZ_TABLE_HEADER,
                                alignment: 'CENTER' as any,
                                bold: true,
                                fill: COLOR_GRAY_HEADER,
                                color: COLOR_WHITE
                            }),
                            textCell('Ilość', {
                                width: 20,
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
                                    textCell(row.pid, { width: 22, size: SZ_TABLE_BODY }),
                                    textCell(row.type, { width: 20, size: SZ_TABLE_BODY }),
                                    textCell(row.desc, { width: 30, size: SZ_TABLE_BODY }),
                                    textCell(String(row.qty), {
                                        width: 20,
                                        size: SZ_TABLE_BODY,
                                        alignment: 'CENTER' as any
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
                                alignment: 'CENTER' as any
                            }),
                            textCell('', { width: 30, size: SZ_TABLE_BODY }),
                            textCell(String(totalQty), {
                                width: 20,
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
