import fs from 'fs';
import path from 'path';
import { logger } from '../../utils/logger';
import { DOCX_COLORS } from '../docx/colors';
import { escapeHtml } from './helpers';
import { buildContactSectionHTML } from './offerUsers';
import type { RuryOfferData } from './types';

export async function generateRuryHTML(data: RuryOfferData): Promise<string> {
    const formatDate = (dateStr: string) => {
        if (!dateStr) return new Date().toLocaleDateString('pl-PL');
        const normalized = /^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? dateStr + 'T00:00:00' : dateStr;
        try {
            return new Date(normalized).toLocaleDateString('pl-PL');
        } catch {
            return dateStr;
        }
    };

    const formatCurrency = (val: number) => {
        return val.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    const fmtIntLocal = (val: number) => {
        return val.toLocaleString('pl-PL', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    };

    const validityString = data.validity || `${data.validityDays} dni`;
    const isOrder = data.documentType === 'order';
    const docNumber = isOrder && data.orderNumber ? data.orderNumber : data.offerNumber;
    const titleText = isOrder ? `ZAMÓWIENIE ${docNumber}` : `OFERTA HANDLOWA ${docNumber}`;
    const validitySection = isOrder
        ? ''
        : `<div><strong>Data ważności oferty:</strong> ${validityString}</div>`;

    const templatePath = path.join(process.cwd(), 'public', 'templates', 'ofertaRury.html');
    const template = fs.readFileSync(templatePath, 'utf-8');

    const naglowekPath = path.join(process.cwd(), 'public', 'images', 'letterhead-header.png');
    const stopkaPath = path.join(process.cwd(), 'public', 'images', 'letterhead-footer.png');
    let naglowekBase64 = '';
    let stopkaBase64 = '';
    try {
        const buf = fs.readFileSync(naglowekPath);
        naglowekBase64 = `data:image/png;base64,${buf.toString('base64')}`;
    } catch (e) {
        logger.warn('PdfAssets', 'Brak letterhead-header.png', e);
    }
    try {
        const buf = fs.readFileSync(stopkaPath);
        stopkaBase64 = `data:image/png;base64,${buf.toString('base64')}`;
    } catch (e) {
        logger.warn('PdfAssets', 'Brak letterhead-footer.png', e);
    }

    const daneKlienta = `
    <div><strong>${escapeHtml(data.clientName)}</strong></div>
    ${data.clientAddress ? `<div>${escapeHtml(data.clientAddress)}</div>` : ''}
    ${data.clientNip ? `<div>NIP: ${escapeHtml(data.clientNip)}</div>` : ''}
    ${data.clientPhone ? `<div>Kontakt: ${escapeHtml(data.clientPhone)}</div>` : ''}
  `.trim();

    const daneInwestycji = `
    ${data.investName ? `<div><strong>Budowa:</strong> ${escapeHtml(data.investName)}</div>` : '<div>\u2014</div>'}
    ${data.investAddress ? `<div>Adres: ${escapeHtml(data.investAddress)}</div>` : ''}
    ${data.investContractor ? `<div>Wykonawca: ${escapeHtml(data.investContractor)}</div>` : ''}
  `.trim();

    const CATEGORY_ORDER = [
        'Rury Betonowe',
        'Żelbetowe KL. A (II)',
        'Żelbetowe KL. S (I)',
        'Duże Żelbetowe II',
        'Rury Jajowe Betonowe',
        'Rury Jajowe Żelbetowe',
        'Akcesoria PEHD',
        'Uszczelki',
        'Zabezpieczenie transportu'
    ];

    const getProductCategory = (item: Record<string, unknown>): string => {
        return String(item.category ?? 'Inne');
    };
    const getProductDiameter = (item: Record<string, unknown>): number => {
        const id = String(item.productId ?? '');
        const parts = id.split('-');
        if (parts.length >= 3) {
            const code = parseInt(parts[2]);
            if (!isNaN(code) && code > 0) return code * 100;
        }
        return 99999;
    };
    const isBosy = (item: Record<string, unknown>): boolean => {
        const name = String(item.name ?? '').toLowerCase();
        const id = String(item.productId ?? '');
        return name.includes('bosy') || id.endsWith('-B00');
    };

    const items = data.items as Record<string, unknown>[];
    const groupedByCat: Record<string, Record<string, Record<string, unknown>[]>> = {};
    for (const item of items) {
        const cat = getProductCategory(item);
        if (!groupedByCat[cat]) groupedByCat[cat] = {};
        const diam = getProductDiameter(item);
        const diamKey = diam < 99999 ? `DN ${diam}` : 'Inne';
        if (!groupedByCat[cat][diamKey]) groupedByCat[cat][diamKey] = [];
        groupedByCat[cat][diamKey].push(item);
    }

    let tabelaPozycji = '';
    let grandTotalNet = 0;
    let globalLp = 1;
    const sortedCats = Object.keys(groupedByCat).sort((a, b) => {
        const ia = CATEGORY_ORDER.indexOf(a);
        const ib = CATEGORY_ORDER.indexOf(b);
        return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    });
    for (const cat of sortedCats) {
        const diamGroups = groupedByCat[cat];
        let catTotal = 0;

        const sortedDiams = Object.keys(diamGroups).sort((a, b) => {
            const da = parseInt(a.replace('DN ', '')) || 99999;
            const db = parseInt(b.replace('DN ', '')) || 99999;
            return da - db;
        });

        tabelaPozycji += `<div class="cat-section">
        <div class="cat-header">${cat}</div>
        <table class="offer-table">
          <thead>
            <tr>
              <th style="width:5%;">Lp.</th>
              <th>Nazwa / Indeks</th>
              <th style="width:10%;">Dł. [m]</th>
              <th style="width:10%;">Ilość [szt.]</th>
              <th style="width:11%;">Cena jedn.</th>
              <th class="nowrap">Suma netto [PLN]</th>
            </tr>
          </thead>
          <tbody>`;

        for (const diamKey of sortedDiams) {
            const itemsInDiam = [...diamGroups[diamKey]].sort((a, b) => {
                const aBB = isBosy(a);
                const bBB = isBosy(b);
                if (aBB !== bBB) return aBB ? -1 : 1;
                return Number(a.lengthM ?? 0) - Number(b.lengthM ?? 0);
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
                const displayMeters = hasLength
                    ? meters > 0
                        ? meters
                        : (lengthM / 1000) * quantity
                    : 0;
                const pehdType = String(item.pehdType ?? '');
                const pehdCost = Number(item.pehdCostPerUnit ?? 0);
                const surcharge = Number(item.surcharge ?? 0);
                const itemPrice = unitPrice * (1 - discount / 100) + pehdCost + surcharge;
                const netto = itemPrice * quantity;

                catTotal += netto;
                grandTotalNet += netto;

                let displayName = name;
                if (pehdType === 'PEHD-3MM') displayName += ' PEHD 3mm';
                if (pehdType === 'PEHD-4MM') displayName += ' PEHD 4mm';

                tabelaPozycji += `<tr>
              <td class="text-center">${globalLp}</td>
              <td>${displayName}<br><span style="font-size:6.5pt;color:#${DOCX_COLORS.headerText};">${productId}</span></td>
              <td class="text-center">${hasLength ? displayMeters.toFixed(2) : '\u2014'}</td>
              <td class="text-center">${fmtIntLocal(quantity)}</td>
              <td class="text-right">${formatCurrency(unitPrice)}</td>
              <td class="text-right bold nowrap">${formatCurrency(netto)}</td>
            </tr>`;
                globalLp++;
            }
        }

        tabelaPozycji += `<tr class="cat-summary-row">
          <td colspan="4"></td>
          <td class="text-right">Suma:</td>
          <td class="text-center bold">${formatCurrency(catTotal)} PLN</td>
        </tr>`;

        tabelaPozycji += '</tbody></table></div>';
    }

    const podsumowanie = `<div class="summary-section">
    <table class="summary-table">
      <tr class="grand-total">
        <td class="text-center" style="width:60%;">SUMA NETTO</td>
        <td class="text-center" style="width:40%;">${formatCurrency(grandTotalNet)} PLN</td>
      </tr>
    </table>
  </div>`;

    let sekcjaUwagi = '';
    if (data.notes) {
        sekcjaUwagi += `<div class="notes-section"><div class="note-box">${escapeHtml(data.notes).replace(/\n/g, '<br>')}</div></div>`;
    }
    if (data.paymentTerms) {
        sekcjaUwagi += `<div class="conditions" style="margin-top:10px;"><div><strong>Warunki płatności:</strong> ${escapeHtml(data.paymentTerms).replace(/\n/g, '<br>')}</div></div>`;
    }

    const warunkiStatyczne = buildRuryStaticTermsHTML();

    const daneKontaktowe = buildContactSectionHTML(
        data.authorUser || null,
        data.guardianUser || null
    );

    let html = template;
    html = html.replace(/\{\{TYTUL_DOKUMENTU\}\}/g, escapeHtml(titleText));
    html = html.replace(/\{\{VALIDITY_SECTION\}\}/g, validitySection);
    html = html.replace(/\{\{NR_OFERTY\}\}/g, docNumber);
    html = html.replace(/\{\{DATA_OFERTY\}\}/g, formatDate(data.createdAt));
    html = html.replace(/\{\{DATA_WAZNOSCI\}\}/g, validityString);
    html = html.replace(/\{\{DANE_KLIENTA\}\}/g, daneKlienta);
    html = html.replace(/\{\{DANE_INWESTYCJI\}\}/g, daneInwestycji);
    html = html.replace(/\{\{TABELA_POZYCJI\}\}/g, tabelaPozycji);
    html = html.replace(/\{\{TABELA_TRANSPORTU\}\}/g, '');
    html = html.replace(/\{\{PODSUMOWANIE\}\}/g, podsumowanie);
    html = html.replace(/\{\{SEKCJA_UWAGI\}\}/g, sekcjaUwagi);
    html = html.replace(/\{\{WARUNKI_STATYCZNE\}\}/g, warunkiStatyczne);
    html = html.replace(/\{\{DANE_KONTAKTOWE\}\}/g, daneKontaktowe);
    html = html.replace(/\{\{BASE_URL\}\}\/images\/letterhead-header\.png/g, naglowekBase64);
    html = html.replace(/\{\{BASE_URL\}\}\/images\/letterhead-footer\.png/g, stopkaBase64);
    html = html.replace(/\{\{BASE_URL\}\}/g, '');

    return html;
}

function buildRuryStaticTermsHTML(): string {
    return `
    <span style="font-size:9pt;font-weight:700;color:#${DOCX_COLORS.headerText};margin-bottom:5px;display:block;">Informacje dodatkowe i ogólne warunki:</span>

    <p>Transport rur w średnicach DN 300 – DN 2200 odbywa się na jednorazowych podkładach drewnianych jako „Zabezpieczenie transportu". Koszt podkładów zostanie zafakturowany na fakturze VAT wg poniższego zestawienia (wartości w tabeli podają cenę Zabezpieczenia transportu do jednej sztuki rury).</p>

    <table style="width:100%;border-collapse:collapse;margin:8px 0;font-size:7.5pt;">
      <thead>
        <tr style="background:#${DOCX_COLORS.headerBg};">
          <th style="border:0.5pt solid #${DOCX_COLORS.tableBorder};padding:4px;">Zabezpieczenie transportu wg średnicy rur</th>
          <th style="border:0.5pt solid #${DOCX_COLORS.tableBorder};padding:4px;">Cena netto [PLN]</th>
          <th style="border:0.5pt solid #${DOCX_COLORS.tableBorder};padding:4px;">Zabezpieczenie transportu wg średnicy rur</th>
          <th style="border:0.5pt solid #${DOCX_COLORS.tableBorder};padding:4px;">Cena netto [PLN]</th>
        </tr>
      </thead>
      <tbody>
        <tr><td style="border:0.5pt solid #${DOCX_COLORS.tableBorder};padding:3px;">Zabezpieczenie transportu DN 300</td><td style="border:0.5pt solid #${DOCX_COLORS.tableBorder};padding:3px;text-align:center;">13,00</td><td style="border:0.5pt solid #${DOCX_COLORS.tableBorder};padding:3px;">Zabezpieczenie transportu DN 1400</td><td style="border:0.5pt solid #${DOCX_COLORS.tableBorder};padding:3px;text-align:center;">90,00</td></tr>
        <tr><td style="border:0.5pt solid #${DOCX_COLORS.tableBorder};padding:3px;">Zabezpieczenie transportu DN 400</td><td style="border:0.5pt solid #${DOCX_COLORS.tableBorder};padding:3px;text-align:center;">13,00</td><td style="border:0.5pt solid #${DOCX_COLORS.tableBorder};padding:3px;">Zabezpieczenie transportu DN 1500</td><td style="border:0.5pt solid #${DOCX_COLORS.tableBorder};padding:3px;text-align:center;">90,00</td></tr>
        <tr><td style="border:0.5pt solid #${DOCX_COLORS.tableBorder};padding:3px;">Zabezpieczenie transportu DN 500</td><td style="border:0.5pt solid #${DOCX_COLORS.tableBorder};padding:3px;text-align:center;">14,00</td><td style="border:0.5pt solid #${DOCX_COLORS.tableBorder};padding:3px;">Zabezpieczenie transportu DN 1600</td><td style="border:0.5pt solid #${DOCX_COLORS.tableBorder};padding:3px;text-align:center;">90,00</td></tr>
        <tr><td style="border:0.5pt solid #${DOCX_COLORS.tableBorder};padding:3px;">Zabezpieczenie transportu DN 600</td><td style="border:0.5pt solid #${DOCX_COLORS.tableBorder};padding:3px;text-align:center;">20,00</td><td style="border:0.5pt solid #${DOCX_COLORS.tableBorder};padding:3px;">Zabezpieczenie transportu DN 1800</td><td style="border:0.5pt solid #${DOCX_COLORS.tableBorder};padding:3px;text-align:center;">230,00</td></tr>
        <tr><td style="border:0.5pt solid #${DOCX_COLORS.tableBorder};padding:3px;">Zabezpieczenie transportu DN 800</td><td style="border:0.5pt solid #${DOCX_COLORS.tableBorder};padding:3px;text-align:center;">20,00</td><td style="border:0.5pt solid #${DOCX_COLORS.tableBorder};padding:3px;">Zabezpieczenie transportu DN 2000</td><td style="border:0.5pt solid #${DOCX_COLORS.tableBorder};padding:3px;text-align:center;">310,00</td></tr>
        <tr><td style="border:0.5pt solid #${DOCX_COLORS.tableBorder};padding:3px;">Zabezpieczenie transportu DN 1000</td><td style="border:0.5pt solid #${DOCX_COLORS.tableBorder};padding:3px;text-align:center;">40,00</td><td style="border:0.5pt solid #${DOCX_COLORS.tableBorder};padding:3px;">Zabezpieczenie transportu DN 2200</td><td style="border:0.5pt solid #${DOCX_COLORS.tableBorder};padding:3px;text-align:center;">310,00</td></tr>
        <tr><td style="border:0.5pt solid #${DOCX_COLORS.tableBorder};padding:3px;">Zabezpieczenie transportu DN 1200</td><td style="border:0.5pt solid #${DOCX_COLORS.tableBorder};padding:3px;text-align:center;">50,00</td><td style="border:0.5pt solid #${DOCX_COLORS.tableBorder};padding:3px;">Zabezpieczenie transportu WPUST ULICZNY</td><td style="border:0.5pt solid #${DOCX_COLORS.tableBorder};padding:3px;text-align:center;">14,00</td></tr>
      </tbody>
    </table>

    <p>Dla rur powyżej średnicy DN1200 oferujemy kotwy montażowe 45 PLN/szt. w rurze są montowane dwie kotwy.<br />Sprzęgi uniwersalne mogą być przez nas dostarczane za kaucją 2300 PLN/szt., na wyraźne zamówienie. Po zwrocie w stanie nieuszkodzonym zostanie z kaucji potrącone 40% jako koszty własne P.V. Prefabet S.A. i amortyzacja.</p>

    <p>Do montażu rur i studni P.V. Prefabet Kluczbork S.A. oferuje środek poślizgowy w wiaderkach 5kg w cenie 225 PLN.<br />Dedykowany środek poślizgowy ułatwia montaż, nie wpływa negatywnie na uszczelki przez co gwarantujemy szczelność naszych wyrobów. W celu prawidłowego montażu rur i studni do każdego transportu studni i co do drugiego transportu rur należy uwzględnić 5kg środka poślizgowego. Koszt środka poślizgowego stanowi osobną pozycję na fakturze. Zastosowanie innych środków o nieznanym składzie chemicznym może negatywnie wpłynąć na szczelność połączeń, a tym samym wyklucza odpowiedzialność gwarancyjną Producenta.</p>

    <p style="margin-top:10px;"><strong>Termin realizacji zamówienia:</strong> I partia towaru według indywidualnych ustaleń z doradcą techniczno-handlowym. Zamówienie należy złożyć w formie pisemnej z wszystkimi istotnymi parametrami potrzebnymi do zrealizowania zamówienia.</p>

    <p style="margin-top:5px;">Odstąpienie od złożonego zamówienia powoduje konieczność zapłaty 100% wartości wyprodukowanego towaru oraz pokrycie kosztów przygotowania produkcji.</p>

    <p style="margin-top:10px;">Ceny podane w ofercie uwzględniają rabat obowiązujący przy terminowym uregulowaniu należności oraz przy zamówieniu całości asortymentu objętego ofertą.</p>

    <p style="margin-top:10px;">Po otrzymaniu zamówienia na kwotę wyższą niż 50 tys. PLN netto P.V. Prefabet Kluczbork S.A. przedstawi umowę określającą warunki dostaw, która zostanie podpisana przed rozpoczęciem dostaw.<br />P.V. Prefabet Kluczbork S.A. ubezpiecza wszystkie transakcje z odroczonym terminem płatności, w związku z tym sprzedaż na przelew może nastąpić po weryfikacji przez firmę ubezpieczeniową i ubezpieczeniu transakcji. Procedura ubezpieczenia trwa do 10 dni roboczych, a wszelkie formalności i koszty leżą po stronie P.V. Prefabet Kluczbork S.A.</p>

    <p style="margin-top:10px;">Wszelkie spory mogące wyniknąć w związku z realizacją zamówienia, Strony poddają pod rozstrzygnięcie sądu powszechnego właściwego dla siedziby Dostawcy.</p>

    <p style="margin-top:10px;">Niewymienione elementy dodatkowe (elementy do wbudowania, powłoki itp.) nie są częścią tej oferty.<br />Wszelkie zmiany ilościowe bądź jakościowe w zamówieniu korygowane będą poprzez wystawienie kolejnej oferty cenowej lub ustaleniach między stronami.<br />Cena loco budowa przy zamówieniu na całość zadania i dostawie pełnych transportów 24-tonowych. W przypadku niepełnych dostaw zostanie doliczony dodatkowy koszt transportu.</p>

    <p style="margin-top:10px;">Drogi dojazdowe do miejsca budowy muszą być przejezdne dla pojazdów ciężkich (ładowność 24 tony). Zleceniodawca jest odpowiedzialny za zapewnienie odpowiedniego dojazdu i miejsca rozładunku na budowie. Rozładunek oraz wynajęcie dźwigu na miejscu budowy leży po stronie zamawiającego.<br />Oferta standardowa obejmuje jedno miejsce rozładunku. W przypadku, gdy miejsc rozładunku jest więcej - za każde dodatkowe miejsce rozładunku klient płaci 500 PLN.<br />Standardowy czas rozładunku wyrobów wynosi maksymalnie do 1,5 godz. Za każdą następną rozpoczętą godzinę klient zapłaci 200 PLN netto. Czas liczony jest od momentu zgłoszenia przez kierowcę osobie upoważnionej gotowości do rozładunku.</p>

    <p style="margin-top:10px;">W przypadku wzrostu cen materiałów wsadowych (cement, kruszywa, usługi transportowe itp.) powyżej 3 % zastrzegamy sobie prawo zmiany cen.</p>

    <p style="margin-top:10px;">Na oferowane prefabrykaty betonowe i żelbetowe udzielamy 36 miesięcy gwarancji licząc od daty podpisania dokumentu WZ pod warunkiem montażu ze sztuką budowlaną i zgodnie z dokumentacją techniczną producenta (instrukcje montażu wyrobów do pobrania na stronie <a href="http://www.pv-prefabet.com.pl" style="color:#${DOCX_COLORS.titleText};text-decoration:none;">www.pv-prefabet.com.pl</a>).<br />W zamówieniach prosimy powoływać się na nr niniejszej oferty.</p>

    <p style="margin-top:10px;">Parametry techniczne oferowanych wyrobów, według odpowiednich deklaracji dostępnych na <a href="https://www.pv-prefabet.com.pl" style="color:#${DOCX_COLORS.titleText};text-decoration:none;">https://www.pv-prefabet.com.pl</a> lub po przesłaniu przez odpowiedni dział P.V. Prefabet Kluczbork S.A.</p>

    <p style="margin-top:10px;">Obligatoryjnym załącznikiem do niniejszej oferty są Ogólne Warunki Sprzedaży dostępne na stronie internetowej <a href="http://www.pv-prefabet.com.pl" style="color:#${DOCX_COLORS.titleText};text-decoration:none;">www.pv-prefabet.com.pl</a> oraz Polityka Prywatności dostępna na stronie internetowej <a href="http://www.pv-prefabet.com.pl/rodo-dane" style="color:#${DOCX_COLORS.titleText};text-decoration:none;">www.pv-prefabet.com.pl/rodo-dane</a></p>

    <p style="margin-top:15px;font-weight:bold;font-size:8.5pt;">Dziękujemy Państwu za zainteresowanie ofertą naszej firmy i mamy nadzieję na dalszą owocną współpracę.</p>
  `.trim();
}

export { buildRuryStaticTermsHTML };
