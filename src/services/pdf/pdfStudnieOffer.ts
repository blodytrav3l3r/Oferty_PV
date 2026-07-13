import path from 'path';
import fs from 'fs';
import { logger } from '../../utils/logger';
import { DOCX_COLORS } from '../docx/colors';
import {
    escapeHtml,
    formatCurrency,
    fmtInt,
    formatDate,
    StudnieOfferData,
    UserContactInfo
} from './pdfHelpers';

export function buildContactSectionHTML(
    authorUser: UserContactInfo | null,
    guardianUser: UserContactInfo | null
): string {
    const renderUser = (title: string, u: UserContactInfo): string => {
        let ht = '<td style="vertical-align:top; width:50%; padding:4px 8px;">';
        ht += `<strong style="color:#${DOCX_COLORS.headerText};">${title}:</strong><br>`;
        ht += `<strong>${u.name}</strong><br>`;
        if (u.email)
            ht += `Email: <a href="mailto:${u.email}" style="color:#${DOCX_COLORS.labelText};text-decoration:none;">${u.email}</a><br>`;
        if (u.phone) ht += `Telefon: ${u.phone}`;
        ht += '</td>';
        return ht;
    };

    let html =
        '<div style="margin-top:20px; padding-top:10px; border-top:1.5px solid #${DOCX_COLORS.headerText}; font-size:9pt;">';

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
    const validityString = data.validity || '30 dni';
    const isOrder = data.documentType === 'order';
    const docNumber = isOrder && data.orderNumber ? data.orderNumber : data.offerNumber;
    const titleText = isOrder ? `ZAMÓWIENIE ${docNumber}` : `OFERTA HANDLOWA ${docNumber}`;
    const validitySection = isOrder
        ? ''
        : `<div><strong>Data ważności oferty:</strong> ${validityString}</div>`;

    const templatePath = path.join(process.cwd(), 'public', 'templates', 'ofertaStudnie.html');
    const template = fs.readFileSync(templatePath, 'utf-8');

    const naglowekPath = path.join(process.cwd(), 'public', 'images', 'letterhead-header.png');
    const stopkaPath = path.join(process.cwd(), 'public', 'images', 'letterhead-footer.png');
    let naglowekBase64 = '';
    let stopkaBase64 = '';
    try {
        const naglowekBuf = fs.readFileSync(naglowekPath);
        naglowekBase64 = `data:image/png;base64,${naglowekBuf.toString('base64')}`;
    } catch (e) {
        logger.warn('PdfAssets', 'Nie udało się załadować letterhead-header.png', e);
    }
    try {
        const stopkaBuf = fs.readFileSync(stopkaPath);
        stopkaBase64 = `data:image/png;base64,${stopkaBuf.toString('base64')}`;
    } catch (e) {
        logger.warn('PdfAssets', 'Nie udało się załadować letterhead-footer.png', e);
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
  `.trim();

    const itemsByDN: Record<string, typeof data.items> = {};
    for (const item of data.items) {
        const dn = item.DN || item.dodatkowe_info || 'Inne';
        if (!itemsByDN[dn]) itemsByDN[dn] = [];
        itemsByDN[dn].push(item);
    }

    let tabeleDN = '';
    let grandTotal = 0;
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
                const wellName = item.productName || '\u2014';
                const dnDisplay = dn === 'styczna' ? 'Styczna' : `DN${dn}`;
                const height = item.height || 0;
                const zwienczenie = item.zwienczenie || '\u2014';

                return `
        <tr>
          <td class="text-center">${idx + 1}</td>
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
    }

    const summariesForTotal: Array<{ label: string; count: number; totalPrice: number }> = [];
    for (const dn of dnOrder) {
        if (itemsByDN[dn]) {
            const label = dn === 'styczna' ? 'Studnie styczne' : `Studnie DN${dn}`;
            const total = itemsByDN[dn].reduce(
                (sum, it) => sum + Number((it as Record<string, unknown>).price ?? 0),
                0
            );
            summariesForTotal.push({ label, count: itemsByDN[dn].length, totalPrice: total });
        }
    }

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

    let sekcjaUwagi = '';
    if (data.notes) {
        sekcjaUwagi += `
    <div class="notes-section">
      <div class="note-box">${escapeHtml(data.notes).replace(/\n/g, '<br>')}</div>
    </div>
    `;
    }
    if (data.paymentTerms) {
        sekcjaUwagi += `
    <div class="conditions" style="margin-top: 10px;">
      <div><strong>Warunki płatności:</strong> ${escapeHtml(data.paymentTerms).replace(/\n/g, '<br>')}</div>
    </div>
    `;
    }

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
    html = html.replace(/\{\{TABELE_DN\}\}/g, tabeleDN);
    html = html.replace(/\{\{PODSUMOWANIE\}\}/g, podsumowanie);
    html = html.replace(/\{\{SEKCJA_UWAGI\}\}/g, sekcjaUwagi);
    html = html.replace(/\{\{DANE_KONTAKTOWE\}\}/g, daneKontaktowe);
    html = html.replace(/\{\{BASE_URL\}\}\/images\/letterhead-header\.png/g, naglowekBase64);
    html = html.replace(/\{\{BASE_URL\}\}\/images\/letterhead-footer\.png/g, stopkaBase64);

    html = html.replace(/\{\{BASE_URL\}\}/g, '');

    return html;
}
