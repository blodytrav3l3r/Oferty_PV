import path from 'path';
import fs from 'fs';
import { escapeHtml } from './pdfHelpers';
import { logger } from '../../utils/logger';
import { TYPE_LABELS, TYPE_ORDER } from './pdfKartaBudowyFields';

export function loadAllProducts(): Map<
    string,
    { componentType: string; category: string; dn: number | string; height: number }
> {
    const products = new Map<
        string,
        { componentType: string; category: string; dn: number | string; height: number }
    >();
    try {
        const jsonPath = path.join(process.cwd(), 'data', 'seed_studnie.json');
        const raw = fs.readFileSync(jsonPath, 'utf-8');
        const items: any[] = JSON.parse(raw);
        for (const p of items) {
            products.set(p.id, {
                componentType: p.componentType || '',
                category: p.category || '',
                dn: p.dn || 0,
                height: p.height || 0
            });
        }
    } catch (e) {
        logger.warn('PdfKartaBudowy', 'Nie udało się załadować produktów', e);
    }
    return products;
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

export function buildPrzejsciaDetailsTable(pd: unknown[]): string {
    if (!Array.isArray(pd) || pd.length === 0) return '';
    const trs = pd
        .map((p, idx) => {
            const pp = p as Record<string, unknown>;
            return `<tr>
                <td>${idx + 1}</td>
                <td>${escapeHtml(pp.rodzaj ?? '\u2014')}</td>
                <td>${escapeHtml(pp.dnOd ?? '\u2014')}</td>
                <td>${escapeHtml(pp.dnDo ?? '\u2014')}</td>
                <td>${escapeHtml(pp.uwagi ?? '\u2014')}</td>
                <td>${escapeHtml(pp.czyPrzejscie ?? '\u2014')}</td>
            </tr>`;
        })
        .join('');

    return `
    <div class="section-header">Szczegóły przejść</div>
    <table class="przejscia-table">
        <thead>
            <tr>
                <th style="width: 8%;">Lp.</th>
                <th style="width: 28%;">Rodzaj przejścia</th>
                <th style="width: 14%;">DN OD</th>
                <th style="width: 14%;">DN DO</th>
                <th style="width: 26%;">Uwagi</th>
                <th style="width: 10%;">Czy przejście?</th>
            </tr>
        </thead>
        <tbody>${trs}</tbody>
    </table>`;
}

interface TransSummary {
    cat: string;
    dn: number | string;
    cntD: number;
    cntOT: number;
    cntTotal: number;
}

function analyzeTransitions(
    wells: any[],
    allProducts: Map<
        string,
        { componentType: string; category: string; dn: number | string; height: number }
    >
): Map<string, TransSummary> {
    const tCounts = new Map<string, TransSummary>();

    for (const w of wells) {
        const segments: { start: number; end: number; isDennica: boolean; isOT: boolean }[] = [];
        const cfg = (Array.isArray(w.config) ? w.config : []) as any[];
        const relevant = cfg.filter((item: any) => {
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

        const rzdDna = parseFloat(w.rzednaDna);
        if (isNaN(rzdDna)) continue;

        const pjs = (Array.isArray(w.przejscia) ? w.przejscia : []) as any[];
        for (const pj of pjs) {
            let prod = allProducts.get(pj.productId);
            if (!prod || prod.componentType !== 'przejscie') {
                prod = findPrzejscieByIdPrefix(allProducts, pj.productId);
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
    return tCounts;
}

export function buildRealTransitionsTable(
    wells: any[],
    allProducts: Map<
        string,
        { componentType: string; category: string; dn: number | string; height: number }
    >
): string {
    const tCounts = analyzeTransitions(wells, allProducts);
    if (tCounts.size === 0) return '';

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

    const rows = sorted
        .map(
            (row, idx) => `<tr>
        <td>${idx + 1}</td>
        <td style="text-align:left;">${row.cat}</td>
        <td>DN${row.dn}</td>
        <td>${row.cntD}</td>
        <td>${row.cntOT}</td>
        <td>${row.cntTotal}</td>
      </tr>`
        )
        .join('');

    return `
    <div class="page-break"></div>
    <div class="section-header">Rzeczywista ilość przejść w zamówieniu</div>
    <table class="przejscia-table">
      <thead>
        <tr>
          <th style="width:8%;">Lp.</th>
          <th style="width:30%;">Rodzaj przejścia</th>
          <th style="width:14%;">Średnica (DN)</th>
          <th style="width:16%;">Dennica</th>
          <th style="width:16%;">Kręgi wiercone</th>
          <th style="width:16%;">Suma</th>
        </tr>
      </thead>
      <tbody>${rows}
        <tr class="total-row">
          <td></td>
          <td style="text-align:center;font-weight:700;">Razem</td>
          <td></td>
          <td style="font-weight:700;">${gD}</td>
          <td style="font-weight:700;">${gOT}</td>
          <td style="font-weight:700;">${gTotal}</td>
        </tr>
      </tbody>
    </table>`;
}

export function buildElementCountTable(
    wells: any[],
    allProducts: Map<
        string,
        { componentType: string; category: string; dn: number | string; height: number }
    >
): string {
    const elemMap = new Map<string, { pid: string; type: string; desc: string; qty: number }>();

    for (const w of wells) {
        const cfg = (Array.isArray(w.config) ? w.config : []) as any[];
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
            const label = TYPE_LABELS[ct] || ct || '\u2014';
            const dnStr = prod?.dn ? `DN${prod.dn}` : '';
            const hStr = prod?.height ? `H=${prod.height}mm` : '';
            const desc =
                [dnStr, hStr].filter(Boolean).join(', ') || item.frozenName || item.productId;
            elemMap.set(key, {
                pid: item.productId,
                type: label,
                desc,
                qty: item.quantity || 1
            });
        }
    }

    if (elemMap.size === 0) return '';

    const sorted = [...elemMap.values()].sort((a, b) => {
        const aCt = allProducts.get(a.pid)?.componentType || '';
        const bCt = allProducts.get(b.pid)?.componentType || '';
        const r = TYPE_ORDER.indexOf(aCt) - TYPE_ORDER.indexOf(bCt);
        return r !== 0 ? r : a.pid.localeCompare(b.pid);
    });

    let totalQty = 0;
    for (const r of sorted) totalQty += r.qty;

    const rows = sorted
        .map(
            (row, idx) => `<tr>
        <td>${idx + 1}</td>
        <td style="text-align:left;">${row.pid}</td>
        <td style="text-align:left;">${row.type}</td>
        <td style="text-align:left;">${row.desc}</td>
        <td>${row.qty}</td>
      </tr>`
        )
        .join('');

    return `
    <div class="section-header">Ilość elementów w zamówieniu</div>
    <table class="przejscia-table">
      <thead>
        <tr>
          <th style="width:8%;">Lp.</th>
          <th style="width:22%;">Indeks</th>
          <th style="width:20%;">Typ elementu</th>
          <th style="width:30%;">Opis</th>
          <th style="width:20%;">Ilość</th>
        </tr>
      </thead>
      <tbody>${rows}
        <tr class="total-row">
          <td></td>
          <td></td>
          <td style="text-align:center;font-weight:700;">Razem</td>
          <td></td>
          <td style="font-weight:700;">${totalQty}</td>
        </tr>
      </tbody>
    </table>`;
}
