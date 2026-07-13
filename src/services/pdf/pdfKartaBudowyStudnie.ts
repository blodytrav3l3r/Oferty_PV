import path from 'path';
import fs from 'fs';
import prisma from '../../prismaClient';
import { logger } from '../../utils/logger';
import { escapeHtml, generatePDF } from './pdfHelpers';

export async function generateKartaBudowyPDF(orderId: string): Promise<Buffer> {
    const order = await prisma.orders_studnie_rel.findUnique({
        where: { id: orderId }
    });

    if (!order) {
        throw new Error('Zamówienie studni nie znaleziona');
    }

    let orderData: Record<string, unknown> = {};
    if (order.data) {
        try {
            orderData = JSON.parse(order.data) as Record<string, unknown>;
        } catch (e) {
            logger.warn('PdfKartaBudowy', 'Nie udało się sparsować danych zamówienia', e);
        }
    }

    const kb = (orderData.kartaBudowy as Record<string, unknown>) || {};

    const templatePath = path.join(process.cwd(), 'public', 'templates', 'kartaBudowy.html');
    let html = fs.readFileSync(templatePath, 'utf-8');

    const nrZamowienia = String(
        orderData.orderNumber || orderData.id || String(order.id).substring(0, 8)
    );
    const nrOferty = String(
        orderData.offerNumber ||
            orderData.number ||
            (Array.isArray(kb.offerNumbers) ? kb.offerNumbers.join(', ') : '\u2014')
    );

    html = html.replace(/\{\{NR_ZAMOWIENIA\}\}/g, nrZamowienia);
    html = html.replace(/\{\{OFFER_NUMBERS\}\}/g, nrOferty);
    html = html.replace(/\{\{DATA_ZAMOWIENIA\}\}/g, escapeHtml(kb.dataZamowienia ?? '\u2014'));
    html = html.replace(/\{\{OSOBA_KONTAKT\}\}/g, escapeHtml(kb.osobaKontakt ?? '\u2014'));
    html = html.replace(/\{\{ADRES_WYSYLKI\}\}/g, escapeHtml(kb.adresWysylki ?? '\u2014'));
    html = html.replace(/\{\{EMAIL_FAKTURA\}\}/g, escapeHtml(kb.emailFaktura ?? '\u2014'));
    html = html.replace(/\{\{EMAIL_EFAKTURA\}\}/g, escapeHtml(kb.emailEfaktura ?? '\u2014'));

    html = html.replace(/\{\{WARUNKI_PLATNOSCI\}\}/g, escapeHtml(kb.warunkiPlatnosci ?? '\u2014'));
    html = html.replace(/\{\{ILOSC_DNI\}\}/g, escapeHtml(kb.iloscDni ?? '\u2014'));
    html = html.replace(/\{\{RODZAJ_TRANSPORTU\}\}/g, escapeHtml(kb.rodzajTransportu ?? '\u2014'));
    html = html.replace(
        /\{\{WYLICZONY_TRANSPORT\}\}/g,
        escapeHtml(kb.wyliczonyTransport ?? '\u2014')
    );
    html = html.replace(
        /\{\{ZABEZPIECZENIE_TRANSPORTU\}\}/g,
        escapeHtml(kb.zabezpieczenieTransportu ?? '\u2014')
    );
    html = html.replace(/\{\{UBEZPIECZENIE\}\}/g, escapeHtml(kb.ubezpieczenie ?? '\u2014'));

    html = html.replace(/\{\{RODZAJ_STUDNI\}\}/g, escapeHtml(kb.rodzajStudni ?? '\u2014'));
    html = html.replace(
        /\{\{WLASCIWOSCI_BETONU\}\}/g,
        escapeHtml(kb.wlasciwosciBetonu ?? '\u2014')
    );
    html = html.replace(
        /\{\{POZOSTALE_WLASCIWOSCI\}\}/g,
        escapeHtml(kb.pozostaleWlasciwosci ?? '\u2014')
    );
    html = html.replace(/\{\{RODZAJ_STOPNI\}\}/g, escapeHtml(kb.rodzajStopni ?? '\u2014'));
    html = html.replace(
        /\{\{RODZAJ_STOPNI_INNE\}\}/g,
        kb.rodzajStopniInne ? `(${escapeHtml(kb.rodzajStopniInne)})` : ''
    );
    html = html.replace(/\{\{USZCZELKA_STUDNI\}\}/g, escapeHtml(kb.uszczelkaStudni ?? '\u2014'));
    html = html.replace(
        /\{\{USZCZELKA_INNE\}\}/g,
        kb.uszczelkaStudniInne ? `(${escapeHtml(kb.uszczelkaStudniInne)})` : ''
    );

    html = html.replace(/\{\{KINETA\}\}/g, escapeHtml(kb.kineta ?? '\u2014'));
    html = html.replace(
        /\{\{KINETA_INNE\}\}/g,
        kb.kinetaInne ? `(${escapeHtml(kb.kinetaInne)})` : ''
    );
    html = html.replace(/\{\{REDUKCJA_KINETY\}\}/g, escapeHtml(kb.redukcjaKinety ?? '\u2014'));
    html = html.replace(/\{\{USYTUOWANIE\}\}/g, escapeHtml(kb.usytuowanie ?? '\u2014'));
    html = html.replace(
        /\{\{WYSOKOSC_SPOCZNIKA\}\}/g,
        escapeHtml(kb.wysokoscSpocznika ?? '\u2014')
    );
    html = html.replace(/\{\{SLEPA_KINETA\}\}/g, escapeHtml(kb.slepaKineta ?? '\u2014'));
    html = html.replace(
        /\{\{SLEPA_KINETA_UWAGI\}\}/g,
        kb.slepaKinetaUwagi ? `(${escapeHtml(kb.slepaKinetaUwagi)})` : ''
    );
    html = html.replace(/\{\{KASKADA\}\}/g, escapeHtml(kb.kaskada ?? '\u2014'));
    html = html.replace(
        /\{\{KASKADA_UWAGI\}\}/g,
        kb.kaskadaUwagi ? `(${escapeHtml(kb.kaskadaUwagi)})` : ''
    );

    html = html.replace(
        /\{\{PRZEJSCIA_SZCZELNE\}\}/g,
        escapeHtml(kb.przejsciaSzczelne ?? '\u2014')
    );
    html = html.replace(
        /\{\{PRZEJSCIA_TULEJOWE\}\}/g,
        escapeHtml(kb.przejsciaTulejowe ?? '\u2014')
    );
    html = html.replace(
        /\{\{PRZEJSCIA_ZAMOWIONE\}\}/g,
        escapeHtml(kb.przejsciaZamowione ?? '\u2014')
    );

    html = html.replace(
        /\{\{UWAGI_OGOLNE\}\}/g,
        escapeHtml(kb.uwagiOgolne ?? '\u2014').replace(/\n/g, '<br>')
    );

    let tabelaPrzejsciaHTML = '';
    const pd = kb.przejsciaDetails;
    if (Array.isArray(pd) && pd.length > 0) {
        let trs = pd
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

        tabelaPrzejsciaHTML = `
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
    html = html.replace(/\{\{TABELA_PRZEJSCIA\}\}/g, tabelaPrzejsciaHTML);

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
        logger.warn('PdfKartaBudowy', 'Nie udało się załadować produktów', e);
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

    const wsz = (Array.isArray(orderData.wells) ? orderData.wells : []) as any[];

    interface TransSummary {
        cat: string;
        dn: number | string;
        cntD: number;
        cntOT: number;
        cntTotal: number;
    }
    const tCounts = new Map<string, TransSummary>();

    for (const w of wsz) {
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
                prod = _findPrzejscieByIdPrefix(allProducts, pj.productId);
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

    let realTransHTML = '';
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
        realTransHTML = `
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
    html = html.replace(/\{\{RZECZYWISTA_ILOSC_PRZEJSC\}\}/g, realTransHTML);

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
            elemMap.set(key, { pid: item.productId, type: label, desc, qty: item.quantity || 1 });
        }
    }

    let elemHTML = '';
    if (elemMap.size > 0) {
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
        elemHTML = `
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
    html = html.replace(/\{\{ILOSC_ELEMENTOW_ZAMOWIENIA\}\}/g, elemHTML);

    html = html.replace(/\{\{BASE_URL\}\}/g, '');

    return generatePDF(html);
}
