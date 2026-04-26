import puppeteer from 'puppeteer';
import prisma from '../prismaClient';
import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger';

function fmtInt(val: number): string {
    return val.toLocaleString('pl-PL', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

/**
 * Generuje PDF oferty rur
 */
export async function generateOfferRuryPDF(offerId: string): Promise<Buffer> {
    const offer = await prisma.offers_rel.findUnique({
        where: { id: offerId }
    });

    if (!offer) {
        throw new Error('Oferta nie znaleziona');
    }

    const items = await prisma.offer_items_rel.findMany({
        where: { offerId }
    });

    const client = offer.clientId
        ? await prisma.clients_rel.findUnique({ where: { id: offer.clientId } })
        : null;

    const html = generateOfferHTML({
        offerNumber: offer.offer_number || 'N/A',
        clientName: client?.name || 'Klient niezidentyfikowany',
        clientNip: client?.nip || '',
        clientAddress: client?.address || '',
        items,
        transportCost: offer.transportCost || 0,
        createdAt: offer.createdAt?.toISOString() || new Date().toISOString(),
        type: 'rury'
    });

    return generatePDF(html);
}

/**
 * Generuje PDF oferty studni używając szablonu oferta_studnie.html
 * UWAGA: Oferty studni mają wells z cenami w polu JSON `data` (wellsExport)!
 */
export async function generateOfferStudniePDF(offerId: string): Promise<Buffer> {
    const offer = await prisma.offers_studnie_rel.findUnique({
        where: { id: offerId }
    });

    if (!offer) {
        throw new Error('Oferta studni nie znaleziona');
    }

    // Parsowanie danych oferty
    let offerData: Record<string, unknown> = {};
    try {
        if (offer.data) offerData = JSON.parse(offer.data) as Record<string, unknown>;
    } catch (e) {
        logger.warn('PdfStudnie', 'Nie udało się sparsować danych oferty', e);
    }

    // wellsExport zawiera studnie z obliczonymi cenami (zapisane przez interfejs użytkownika)
    let wells: unknown[] = [];
    if (offerData.wellsExport && Array.isArray(offerData.wellsExport)) {
        wells = offerData.wellsExport;
    } else if (offerData.wells && Array.isArray(offerData.wells)) {
        // Opcja zapasowa: użyj surowych danych studni (bez cen)
        wells = offerData.wells;
    }

    logger.info('PdfStudnie', `Generowanie PDF dla oferty ${offerId}`);
    logger.debug('PdfStudnie', `Znaleziono ${wells.length} studni w offer.data`);
    logger.debug('PdfStudnie', `Offer data keys: ${Object.keys(offerData).join(', ')}`);
    if (wells.length > 0) {
        logger.debug('PdfStudnie', 'Przykładowa studnia', wells[0]);
    }

    // Oblicz transport z danych oferty (offer.data)
    const transportKm = Number(offerData.transportKm ?? 0);
    const transportRate = Number(offerData.transportRate ?? 0);
    const totalWeight = Number(offerData.totalWeight ?? 0);
    let totalTransportCost = 0;
    if (transportKm > 0 && transportRate > 0) {
        const totalTransports = Math.ceil(totalWeight / 24000);
        totalTransportCost = totalTransports * transportKm * transportRate;
    }

    // Przygotuj elementy (items) dla szablonu - grupowanie po średnicy DN
    const itemsByDN: Record<string, Record<string, unknown>[]> = {};
    let grandTotal = 0;

    wells.forEach((w) => {
        const well = w as Record<string, unknown>;
        const dn = String(well.dn ?? 'Inne');
        const wellPrice = Number(well.totalPrice ?? well.price ?? 0);
        grandTotal += wellPrice;

        if (!itemsByDN[dn]) itemsByDN[dn] = [];
        itemsByDN[dn].push({
            productName: String(well.name ?? `Studnia DN${dn}`),
            quantity: 1,
            price: wellPrice,
            DN: dn,
            height: Number(well.height ?? 0),
            zwienczenie: String(well.zwienczenie ?? '—'),
            transportCost: Number(well.transportCost ?? 0)
        });
    });

    // Spłaszcz elementy (items) dla szablonu
    const items: Record<string, unknown>[] = [];
    for (const [_dn, dnItems] of Object.entries(itemsByDN)) {
        items.push(...dnItems);
    }

    logger.debug('PdfStudnie', `Przygotowano ${items.length} items, grandTotal: ${grandTotal}`);

    const client = offer.clientId
        ? await prisma.clients_rel.findUnique({ where: { id: offer.clientId } })
        : null;

    // Pobierz dane autora i opiekuna handlowego z bazy danych (users)
    const { authorUser, guardianUser } = await lookupOfferUsers(offerData, offer.userId);

    const html = await generateStudnieHTML({
        offerNumber: offer.offer_number || 'N/A',
        clientName: String(client?.name ?? offerData.clientName ?? 'Klient niezidentyfikowany'),
        clientNip: String(client?.nip ?? offerData.clientNip ?? ''),
        clientAddress: String(client?.address ?? offerData.clientAddress ?? ''),
        clientPhone:
            String(offerData.clientContact ??
            client?.contact ??
            client?.phone ??
            offerData.clientPhone ??
            ''),
        investName: String(offerData.investName ?? offerData.budowa ?? ''),
        investAddress: String(offerData.investAddress ?? ''),
        items,
        transportCost: totalTransportCost,
        createdAt: String(offerData.date ?? offer.createdAt ?? new Date().toISOString()),
        validityDays: Number(offerData.validityDays ?? 30),
        notes: String(offerData.notes ?? ''),
        paymentTerms: String(offerData.paymentTerms ?? ''),
        validity: String(offerData.validity ?? ''),
        authorUser,
        guardianUser
    });

    return generatePDF(html);
}

interface OfferData {
    offerNumber: string;
    clientName: string;
    clientNip: string;
    clientAddress: string;
    items: Array<{
        productId?: string | null;
        quantity?: number | null;
        discount?: number | null;
        price?: number | null;
        dodatkowe_info?: string | null;
    }>;
    transportCost: number;
    createdAt: string;
    type: 'rury' | 'studnie';
}

function generateOfferHTML(data: OfferData): string {
    const totalNet = data.items.reduce((sum, item) => {
        return sum + (item.price || 0) * (item.quantity || 1);
    }, 0);

    const totalWithTransport = totalNet + data.transportCost;

    const formatDate = (dateStr: string) => {
        try {
            return new Date(dateStr).toLocaleDateString('pl-PL');
        } catch {
            return dateStr;
        }
    };

    const formatCurrency = (val: number) => {
        return (
            val.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) +
            ' zł'
        );
    };

    const itemsRows = data.items
        .map(
            (item, idx) => `
    <tr>
      <td>${idx + 1}</td>
      <td>${item.productId || 'Produkt'}</td>
      <td class="text-center">${item.quantity || 1}</td>
      <td class="text-right">${item.discount ? item.discount + '%' : '-'}</td>
      <td class="text-right">${formatCurrency(item.price || 0)}</td>
      <td class="text-right">${formatCurrency((item.price || 0) * (item.quantity || 1))}</td>
    </tr>
  `
        )
        .join('');

    return `
<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8">
  <title>Oferta ${data.type === 'rury' ? 'Rury' : 'Studnie'} - ${data.offerNumber}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    body {
      font-family: Arial, sans-serif;
      font-size: 10pt;
      color: #000;
      line-height: 1.4;
      padding: 20mm 15mm;
    }
    
    .header {
      text-align: center;
      border-bottom: 3px solid #333;
      padding-bottom: 15px;
      margin-bottom: 20px;
    }
    
    .header h1 {
      font-size: 22pt;
      font-weight: 700;
      color: #333;
      margin-bottom: 5px;
    }
    
    .header .subtitle {
      font-size: 10pt;
      color: #666;
    }
    
    .offer-meta {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 15px;
      margin-bottom: 20px;
    }
    
    .meta-box {
      background: #f8f8f8;
      border: 1px solid #ddd;
      border-radius: 6px;
      padding: 12px;
    }
    
    .meta-box h3 {
      font-size: 8pt;
      text-transform: uppercase;
      color: #666;
      margin-bottom: 6px;
      letter-spacing: 0.5px;
    }
    
    .meta-box p {
      font-size: 10pt;
      color: #000;
      margin: 2px 0;
    }
    
    .meta-box strong {
      font-weight: 700;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 15px;
      font-size: 9pt;
    }
    
    thead th {
      background: #f0f0f0;
      padding: 8px 6px;
      text-align: left;
      font-weight: 700;
      border-bottom: 2px solid #333;
      font-size: 8pt;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    
    tbody td {
      padding: 6px;
      border-bottom: 1px solid #eee;
    }
    
    tbody tr:nth-child(even) {
      background: #fafafa;
    }
    
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    
    .summary {
      margin-top: 15px;
      padding: 12px;
      background: #f8f8f8;
      border: 1px solid #ddd;
      border-radius: 6px;
    }
    
    .summary-row {
      display: flex;
      justify-content: space-between;
      padding: 4px 0;
    }
    
    .summary-row.total {
      font-size: 12pt;
      font-weight: 700;
      border-top: 2px solid #333;
      padding-top: 8px;
      margin-top: 8px;
    }
    
    .footer {
      margin-top: 30px;
      padding-top: 15px;
      border-top: 1px solid #ccc;
      text-align: center;
      font-size: 8pt;
      color: #666;
    }
    
    @page {
      size: A4;
      margin: 10mm;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>WITROS</h1>
    <div class="subtitle">Oferta handlowa - ${data.type === 'rury' ? 'Rury betonowe' : 'Studnie żelbetowe'}</div>
  </div>
  
  <div class="offer-meta">
    <div class="meta-box">
      <h3>Dane oferty</h3>
      <p><strong>Nr oferty:</strong> ${data.offerNumber}</p>
      <p><strong>Data:</strong> ${formatDate(data.createdAt)}</p>
    </div>
    <div class="meta-box">
      <h3>Dane klienta</h3>
      <p><strong>${data.clientName}</strong></p>
      ${data.clientNip ? `<p>NIP: ${data.clientNip}</p>` : ''}
      ${data.clientAddress ? `<p>${data.clientAddress}</p>` : ''}
    </div>
  </div>
  
  <table>
    <thead>
      <tr>
        <th style="width: 5%;">Lp.</th>
        <th style="width: 35%;">Produkt</th>
        <th style="width: 10%;" class="text-center">Ilość</th>
        <th style="width: 12%;" class="text-right">Rabat</th>
        <th style="width: 18%;" class="text-right">Cena jedn.</th>
        <th style="width: 20%;" class="text-right">Wartość</th>
      </tr>
    </thead>
    <tbody>
      ${itemsRows}
    </tbody>
  </table>
  
  <div class="summary">
    <div class="summary-row">
      <span>Suma netto:</span>
      <span>${formatCurrency(totalNet)}</span>
    </div>
    ${
        data.transportCost > 0
            ? `
    <div class="summary-row">
      <span>Koszt transportu:</span>
      <span>${formatCurrency(data.transportCost)}</span>
    </div>
    `
            : ''
    }
    <div class="summary-row total">
      <span>RAZEM:</span>
      <span>${formatCurrency(totalWithTransport)}</span>
    </div>
  </div>
  
  <div class="footer">
    <p>Oferta ważna przez 30 dni od daty wystawienia | WITROS - Generator Ofert</p>
  </div>
</body>
</html>
  `;
}

export interface UserContactInfo {
    name: string;
    email: string;
    phone: string;
}

export interface StudnieOfferData {
    offerNumber: string;
    clientName: string;
    clientNip: string;
    clientAddress: string;
    clientPhone: string;
    investName: string;
    investAddress: string;
    items: Array<{
        productId?: string | null;
        productName?: string | null;
        quantity?: number | null;
        discount?: number | null;
        price?: number | null;
        dodatkowe_info?: string | null;
        DN?: string | null;
        height?: number;
        zwienczenie?: string;
    }>;
    transportCost: number;
    createdAt: string;
    validityDays: number;
    notes: string;
    paymentTerms?: string;
    validity?: string;
    authorUser?: UserContactInfo | null;
    guardianUser?: UserContactInfo | null;
}

/**
 * Pobiera dane autora i opiekuna oferty z bazy users
 */
export async function lookupOfferUsers(
    offerData: Record<string, unknown>,
    offerUserId?: string | null
): Promise<{ authorUser: UserContactInfo | null; guardianUser: UserContactInfo | null }> {
    const formatUserName = (u: Record<string, unknown>): string =>
        u.firstName && u.lastName ? `${String(u.firstName)} ${String(u.lastName)}` : String(u.username);

    let guardianUser: UserContactInfo | null = null;
    let authorUser: UserContactInfo | null = null;

    // Opiekun handlowy: userId z oferty
    const guardianId = (offerData.userId as string | undefined) || offerUserId;
    if (guardianId) {
        try {
            const u = await prisma.users.findUnique({ where: { id: guardianId } });
            if (u)
                guardianUser = {
                    name: formatUserName(u as Record<string, unknown>),
                    email: String(u.email ?? ''),
                    phone: String(u.phone ?? '')
                };
        } catch (e) {
            logger.warn('PdfUsers', 'Nie udało się wyszukać opiekuna (guardian)', e);
        }
    }

    // Autor oferty: createdByUserId
    const authorId = offerData.createdByUserId as string | undefined;
    if (authorId && authorId !== guardianId) {
        try {
            const u = await prisma.users.findUnique({ where: { id: authorId } });
            if (u)
                authorUser = {
                    name: formatUserName(u as Record<string, unknown>),
                    email: String(u.email ?? ''),
                    phone: String(u.phone ?? '')
                };
        } catch (e) {
            logger.warn('PdfUsers', 'Nie udało się wyszukać autora', e);
        }
    } else if (authorId && authorId === guardianId) {
        // Jeżeli autor = opiekun, nie duplikuj
        authorUser = null;
    }

    return { authorUser, guardianUser };
}

/**
 * Buduje sekcję kontaktową HTML z danymi autora i opiekuna.
 * Identyczna struktura jak w frontend offerPrintManager.js → renderUser().
 */
export function buildContactSectionHTML(
    authorUser: UserContactInfo | null,
    guardianUser: UserContactInfo | null
): string {
    const renderUser = (title: string, u: UserContactInfo): string => {
        let ht = '<td style="vertical-align:top; width:50%; padding:4px 8px;">';
        ht += `<strong style="color:#999;">${title}:</strong><br>`;
        ht += `<strong>${u.name}</strong><br>`;
        if (u.email)
            ht += `Email: <a href="mailto:${u.email}" style="color:#333;text-decoration:none;">${u.email}</a><br>`;
        if (u.phone) ht += `Telefon: ${u.phone}`;
        ht += '</td>';
        return ht;
    };

    let html =
        '<div style="margin-top:20px; padding-top:10px; border-top:1.5px solid #999; font-size:9pt;">';

    if (!guardianUser && !authorUser) {
        html += '<p>W razie pytań prosimy o kontakt z opiekunem oferty.</p>';
    } else {
        html += '<table style="width:100%; border:none;"><tr>';
        if (authorUser) {
            html += renderUser('Ofertę przygotował(-a)', authorUser);
        }
        if (guardianUser) {
            html += renderUser('Opiekun handlowy (kontakt)', guardianUser);
        }
        html += '</tr></table>';
    }

    html += '</div>';
    return html;
}

export async function generateStudnieHTML(data: StudnieOfferData): Promise<string> {
    const formatDate = (dateStr: string) => {
        try {
            return new Date(dateStr).toLocaleDateString('pl-PL');
        } catch {
            return dateStr;
        }
    };

    const formatCurrency = (val: number) => {
        return val.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    const validityString = data.validity || '30 dni';

    // Załaduj szablon
    const templatePath = path.join(process.cwd(), 'public', 'templates', 'oferta_studnie.html');
    const template = fs.readFileSync(templatePath, 'utf-8');

    // Załaduj obrazy nagłówka i stopki jako URI danych base64
    const naglowekPath = path.join(process.cwd(), '1 Pliki przykładowe', 'naglowek.png');
    const stopkaPath = path.join(process.cwd(), '1 Pliki przykładowe', 'stopka.png');
    let naglowekBase64 = '';
    let stopkaBase64 = '';
    try {
        const naglowekBuf = fs.readFileSync(naglowekPath);
        naglowekBase64 = `data:image/png;base64,${naglowekBuf.toString('base64')}`;
    } catch (e) {
        logger.warn('PdfAssets', 'Nie udało się załadować naglowek.png', e);
    }
    try {
        const stopkaBuf = fs.readFileSync(stopkaPath);
        stopkaBase64 = `data:image/png;base64,${stopkaBuf.toString('base64')}`;
    } catch (e) {
        logger.warn('PdfAssets', 'Nie udało się załadować stopka.png', e);
    }

    // Budowanie danych klienta
    const daneKlienta = `
    <div><strong>${data.clientName}</strong></div>
    ${data.clientAddress ? `<div>${data.clientAddress}</div>` : ''}
    ${data.clientNip ? `<div>NIP: ${data.clientNip}</div>` : ''}
    ${data.clientPhone ? `<div>Kontakt: ${data.clientPhone}</div>` : ''}
  `.trim();

    // Budowanie danych inwestycji
    const daneInwestycji = `
    ${data.investName ? `<div><strong>Budowa:</strong> ${data.investName}</div>` : '<div>—</div>'}
    ${data.investAddress ? `<div>Adres: ${data.investAddress}</div>` : ''}
  `.trim();

    // Grupowanie elementów według średnicy DN
    const itemsByDN: Record<string, typeof data.items> = {};
    for (const item of data.items) {
        const dn = item.DN || item.dodatkowe_info || 'Inne';
        if (!itemsByDN[dn]) itemsByDN[dn] = [];
        itemsByDN[dn].push(item);
    }

    // Buduj tabele dla każdej średnicy DN - zgodnie z formatem buildDiameterTableHtml z frontendu
    let tabeleDN = '';
    let grandTotal = 0;
    let globalLp = 1;
    const dnOrder = ['1000', '1200', '1500', '2000', '2500', 'styczna', 'Inne'];

    for (const dn of dnOrder) {
        if (!itemsByDN[dn]) continue;
        const dnItems = itemsByDN[dn];
        const dnLabel = dn === 'styczna' ? 'Studnie styczne' : `Studnie DN${dn}`;

        const dnTotal = dnItems.reduce((sum, item) => {
            return sum + (item.price || 0);
        }, 0);
        grandTotal += dnTotal;

        const rows = dnItems
            .map((item, idx) => {
                const price = item.price || 0;
                const wellName = item.productName || '—';
                const dnDisplay = dn === 'styczna' ? 'Styczna' : `DN${dn}`;
                const height = item.height || 0;
                const zwienczenie = item.zwienczenie || '—';

                return `
        <tr>
          <td class="text-center">${globalLp + idx}</td>
          <td class="text-center bold">${wellName}</td>
          <td class="text-center">${dnDisplay}</td>
          <td class="text-center">${fmtInt(height)}</td>
          <td class="zwienczenie-cell text-center">${zwienczenie}</td>
          <td class="text-center bold">${formatCurrency(price)}</td>
        </tr>
      `;
            })
            .join('');

        tabeleDN += `
      <div class="dn-section">
        <div class="dn-header">${dnLabel}</div>
        <table class="offer-table">
          <thead>
            <tr>
              <th style="width:5%;">Lp.</th>
              <th style="width:30%;">Nr studni</th>
              <th style="width:10%;">Średnica</th>
              <th style="width:8%;">H [mm]</th>
              <th style="width:32%;">Zwieńczenie</th>
              <th style="width:15%;">Cena netto [PLN]</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
            <tr class="dn-summary-row">
              <td colspan="4"></td>
              <td class="text-right">Razem ${dnLabel} (${dnItems.length} szt.):</td>
              <td class="text-center">${formatCurrency(dnTotal)} PLN</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;
        globalLp += dnItems.length;
    }

    const summariesForTotal: Array<{ label: string; count: number; totalPrice: number }> = [];
    for (const dn of dnOrder) {
        if (itemsByDN[dn]) {
            const label = dn === 'styczna' ? 'Studnie styczne' : `Studnie DN${dn}`;
            const total = itemsByDN[dn].reduce(
                (sum, it) => sum + (Number((it as Record<string, unknown>).price ?? 0)),
                0
            );
            summariesForTotal.push({ label, count: itemsByDN[dn].length, totalPrice: total });
        }
    }

    // Budowanie podsumowania - zgodne z formatem frontend offerPrintManager.js → buildOfferSummaryHtml()

    let summaryRows = '';
    for (const s of summariesForTotal) {
        summaryRows += `<tr>
      <td class="text-center">${s.label}</td>
      <td class="text-center">${s.count} szt.</td>
      <td class="text-center bold">${formatCurrency(s.totalPrice)} PLN</td>
    </tr>`;
    }
    summaryRows += `<tr class="grand-total">
    <td class="text-center">RAZEM NETTO</td>
    <td class="text-center">${summariesForTotal.reduce((s, x) => s + x.count, 0)} szt.</td>
    <td class="text-center">${formatCurrency(grandTotal)} PLN</td>
  </tr>`;

    const podsumowanie = `
    <div class="summary-section">
      <h3>Podsumowanie oferty</h3>
      <table class="summary-table">
        ${summaryRows}
      </table>
    </div>
  `;

    // Budowanie sekcji uwag
    const sekcjaUwagi = data.notes
        ? `
    <div class="notes-section">
      <div class="note-box"><strong>Uwagi:</strong> ${data.notes}</div>
    </div>
  `
        : '';

    // Budowanie sekcji danych kontaktowych — autor + opiekun
    const daneKontaktowe = buildContactSectionHTML(
        data.authorUser || null,
        data.guardianUser || null
    );

    // Zastąp symbole zastępcze (placeholders) - użyj obrazów base64 dla nagłówka/stopki
    let html = template;
    html = html.replace(/\{\{NR_OFERTY\}\}/g, data.offerNumber);
    html = html.replace(/\{\{DATA_OFERTY\}\}/g, formatDate(data.createdAt));
    html = html.replace(/\{\{DATA_WAZNOSCI\}\}/g, validityString);
    html = html.replace(/\{\{DANE_KLIENTA\}\}/g, daneKlienta);
    html = html.replace(/\{\{DANE_INWESTYCJI\}\}/g, daneInwestycji);
    html = html.replace(/\{\{TABELE_DN\}\}/g, tabeleDN);
    html = html.replace(/\{\{PODSUMOWANIE\}\}/g, podsumowanie);
    html = html.replace(/\{\{SEKCJA_UWAGI\}\}/g, sekcjaUwagi);
    html = html.replace(/\{\{DANE_KONTAKTOWE\}\}/g, daneKontaktowe);
    // Zastąp {{BASE_URL}} rzeczywistymi obrazami base64
    html = html.replace(/\{\{BASE_URL\}\}\/templates\/naglowek\.png/g, naglowekBase64);
    html = html.replace(/\{\{BASE_URL\}\}\/templates\/stopka\.png/g, stopkaBase64);
    // Fallback: usuń pozostałe symbole zastępcze {{BASE_URL}}
    html = html.replace(/\{\{BASE_URL\}\}/g, '');

    return html;
}

async function generatePDF(html: string): Promise<Buffer> {
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'networkidle0' });

        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: {
                top: '10mm',
                right: '15mm',
                bottom: '10mm',
                left: '15mm'
            }
        });

        return Buffer.from(pdfBuffer);
    } finally {
        await browser.close();
    }
}
