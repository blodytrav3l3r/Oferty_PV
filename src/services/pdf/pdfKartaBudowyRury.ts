import path from 'path';
import fs from 'fs';
import prisma from '../../prismaClient';
import { logger } from '../../utils/logger';
import { escapeHtml, generatePDF } from './pdfHelpers';

export async function generateKartaBudowyRuryPDF(orderId: string): Promise<Buffer> {
    const order = await prisma.orders_rury_rel.findUnique({
        where: { id: orderId }
    });

    if (!order) {
        throw new Error('Zamówienie rur nie znalezione');
    }

    let orderData: Record<string, unknown> = {};
    if (order.data) {
        try {
            orderData = JSON.parse(order.data) as Record<string, unknown>;
        } catch (e) {
            logger.warn('PdfKartaBudowyRury', 'Nie udało się sparsować danych zamówienia', e);
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
            .map((p: any, idx: number) => {
                return `<tr>
                <td>${idx + 1}</td>
                <td>${escapeHtml(p.rodzaj ?? '\u2014')}</td>
                <td>${escapeHtml(p.dnOd ?? '\u2014')}</td>
                <td>${escapeHtml(p.dnDo ?? '\u2014')}</td>
                <td>${escapeHtml(p.uwagi ?? '\u2014')}</td>
                <td>${escapeHtml(p.czyPrzejscie ?? '\u2014')}</td>
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

    html = html.replace(/\{\{RZECZYWISTA_ILOSC_PRZEJSC\}\}/g, '');
    html = html.replace(/\{\{ILOSC_ELEMENTOW_ZAMOWIENIA\}\}/g, '');

    html = html.replace(/\{\{BASE_URL\}\}/g, '');

    return generatePDF(html);
}
