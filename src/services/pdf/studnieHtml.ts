import fs from 'fs';
import path from 'path';
import type { StudnieOfferData } from './types';
import { fmtInt, escapeHtml, formatDatePL } from './helpers';
import { buildContactSectionHTML } from './offerUsers';
import { PRINT_TOKENS_CSS } from './printTokens';
import { loadLetterheadBase64 } from './letterhead';

/**
 * Buduje sekcję treści oferty studni (tabele per DN + podsumowanie).
 * Współdzielona przez generateStudnieHTML oraz wydruk łączny (rury + studnie).
 */
export function buildStudnieSectionHTML(data: StudnieOfferData): {
    tables: string;
    summary: string;
    grandTotal: number;
} {
    const formatCurrency = (val: number) => {
        return val.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

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
                const wellName = item.productName || '—';
                const dnDisplay = dn === 'styczna' ? 'Styczna' : `DN${dn}`;
                const height = item.height || 0;
                const zwienczenie = item.zwienczenie || '—';

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

    return { tables: tabeleDN, summary: podsumowanie, grandTotal };
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
    const template = fs
        .readFileSync(templatePath, 'utf-8')
        .replace(/\{\{PRINT_TOKENS\}\}/g, PRINT_TOKENS_CSS);

    const letterhead = loadLetterheadBase64();
    const naglowekBase64 = letterhead.header;
    const stopkaBase64 = letterhead.footer;

    const daneKlienta = `
    <div><strong>${escapeHtml(data.clientName)}</strong></div>
    ${data.clientAddress ? `<div>${escapeHtml(data.clientAddress)}</div>` : ''}
    ${data.clientNip ? `<div>NIP: ${escapeHtml(data.clientNip)}</div>` : ''}
    ${data.clientNumber ? `<div>Nr klienta: ${escapeHtml(data.clientNumber)}</div>` : ''}
    ${data.clientPhone ? `<div>Kontakt: ${escapeHtml(data.clientPhone)}</div>` : ''}
  `.trim();

    const daneInwestycji = `
    ${data.investName ? `<div><strong>Budowa:</strong> ${escapeHtml(data.investName)}</div>` : '<div>—</div>'}
    ${data.investAddress ? `<div>Adres: ${escapeHtml(data.investAddress)}</div>` : ''}
  `.trim();

    const { tables, summary } = buildStudnieSectionHTML(data);

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
    html = html.replace(/\{\{DATA_OFERTY\}\}/g, formatDatePL(data.createdAt));
    html = html.replace(/\{\{DATA_WAZNOSCI\}\}/g, validityString);
    html = html.replace(/\{\{DANE_KLIENTA\}\}/g, daneKlienta);
    html = html.replace(/\{\{DANE_INWESTYCJI\}\}/g, daneInwestycji);
    html = html.replace(/\{\{TABELE_DN\}\}/g, tables);
    html = html.replace(/\{\{TABELA_RUR\}\}/g, '');
    html = html.replace(/\{\{PODSUMOWANIE\}\}/g, summary);
    html = html.replace(/\{\{SEKCJA_UWAGI\}\}/g, sekcjaUwagi);
    html = html.replace(/\{\{DANE_KONTAKTOWE\}\}/g, daneKontaktowe);
    html = html.replace(/\{\{BASE_URL\}\}\/images\/letterhead-header\.png/g, naglowekBase64);
    html = html.replace(/\{\{BASE_URL\}\}\/images\/letterhead-footer\.png/g, stopkaBase64);
    html = html.replace(/\{\{BASE_URL\}\}/g, '');

    return html;
}
