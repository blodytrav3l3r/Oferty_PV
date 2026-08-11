import fs from 'fs';
import path from 'path';
import type { RuryOfferData, StudnieOfferData } from './types';
import { escapeHtml, formatDatePL } from './helpers';
import { buildContactSectionHTML } from './offerUsers';
import { PRINT_TOKENS_CSS } from './printTokens';
import { loadLetterheadBase64 } from './letterhead';
import { resolvePublicDir } from '../../utils/paths';
import { buildRurySectionHTML } from './ruryHtml';
import { buildStudnieSectionHTML } from './studnieHtml';
import { generatePDF } from './pdfEngine';
import { buildRuryOfferContextFromOfferId, buildStudnieOfferContextFromOfferId } from './context';

/**
 * Generuje JEDEN spójny dokument HTML wydruku łącznego (studnie + rury):
 * wspólny tytuł "OFERTA HANDLOWA {nr studni} + {nr rur}", dane klienta/inwestycji
 * raz, sekcja studni -> sekcja rur, podsumowanie zbiorcze oraz warunki płatności
 * i statyczne warunki handlowe występujące tylko raz.
 *
 * Baza: szablon ofertaStudnie.html (zawiera komplet statycznych warunków oraz
 * CSS sekcji rur w slocie {{TABELA_RUR}}).
 */
export async function generateCombinedHTML(
    studnieData: StudnieOfferData,
    ruryData: RuryOfferData
): Promise<string> {
    const formatCurrency = (val: number) => {
        return val.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    const studnieSection = buildStudnieSectionHTML(studnieData);
    const rurySection = buildRurySectionHTML(ruryData);

    const validityString = studnieData.validity || `${studnieData.validityDays} dni`;
    const isOrder = studnieData.documentType === 'order';
    const combinedNumber = `${studnieData.offerNumber} + ${ruryData.offerNumber}`;
    const titleText = isOrder
        ? `ZAMÓWIENIE ${combinedNumber}`
        : `OFERTA HANDLOWA ${combinedNumber}`;
    const validitySection = isOrder
        ? ''
        : `<div><strong>Data ważności oferty:</strong> ${validityString}</div>`;

    const templatePath = path.join(resolvePublicDir(), 'templates', 'ofertaStudnie.html');
    let template: string;
    try {
        template = fs
            .readFileSync(templatePath, 'utf-8')
            .replace(/\{\{PRINT_TOKENS\}\}/g, PRINT_TOKENS_CSS);
    } catch (e) {
        throw new Error(
            'Nie mozna wczytac szablonu PDF (' +
                templatePath +
                '): ' +
                (e instanceof Error ? e.message : String(e))
        );
    }

    const { header: naglowekBase64, footer: stopkaBase64 } = loadLetterheadBase64();

    const daneKlienta = `
    <div><strong>${escapeHtml(studnieData.clientName)}</strong></div>
    ${studnieData.clientAddress ? `<div>${escapeHtml(studnieData.clientAddress)}</div>` : ''}
    ${studnieData.clientNip ? `<div>NIP: ${escapeHtml(studnieData.clientNip)}</div>` : ''}
    ${studnieData.clientNumber ? `<div>Nr klienta: ${escapeHtml(studnieData.clientNumber)}</div>` : ''}
    ${studnieData.clientPhone ? `<div>Kontakt: ${escapeHtml(studnieData.clientPhone)}</div>` : ''}
  `.trim();

    const daneInwestycji = `
    ${studnieData.investName ? `<div><strong>Budowa:</strong> ${escapeHtml(studnieData.investName)}</div>` : '<div>\u2014</div>'}
    ${studnieData.investAddress ? `<div>Adres: ${escapeHtml(studnieData.investAddress)}</div>` : ''}
    ${studnieData.investContractor ? `<div>Wykonawca: ${escapeHtml(studnieData.investContractor)}</div>` : ''}
  `.trim();

    const studnieNotes = studnieData.notes || '';
    const ruryNotes = ruryData.notes || '';
    const paymentTerms = studnieData.paymentTerms || ruryData.paymentTerms || '';

    const sekcjaUwagiStudni = studnieNotes
        ? `
    <div class="notes-section">
      <div class="note-box">${escapeHtml(studnieNotes).replace(/\n/g, '<br>')}</div>
    </div>
    `
        : '';
    const sekcjaUwagiRur = ruryNotes
        ? `
    <div class="notes-section">
      <div class="note-box">${escapeHtml(ruryNotes).replace(/\n/g, '<br>')}</div>
    </div>
    `
        : '';
    let warunkiPlatnosci = '';
    if (paymentTerms) {
        warunkiPlatnosci += `
    <div class="conditions" style="margin-top: 10px;">
      <div><strong>Warunki płatności:</strong> ${escapeHtml(paymentTerms).replace(/\n/g, '<br>')}</div>
    </div>
    `;
    }

    const combinedTotal = studnieSection.grandTotal + rurySection.grandTotal;

    const podsumowanieLaczne = `
    <div class="summary-section" style="margin-top:0;">
      <table class="summary-table">
        <tr class="grand-total">
          <td class="text-center" style="width:60%;">RAZEM NETTO (studnie + rury)</td>
          <td class="text-center" style="width:40%;">${formatCurrency(combinedTotal)} PLN</td>
        </tr>
      </table>
    </div>
  `;

    const daneKontaktowe = buildContactSectionHTML(
        studnieData.authorUser || null,
        studnieData.guardianUser || null
    );

    let html = template;
    html = html.replace(/\{\{TYTUL_DOKUMENTU\}\}/g, escapeHtml(titleText));
    html = html.replace(/\{\{VALIDITY_SECTION\}\}/g, validitySection);
    html = html.replace(/\{\{NR_OFERTY\}\}/g, combinedNumber);
    html = html.replace(/\{\{DATA_OFERTY\}\}/g, formatDatePL(studnieData.createdAt));
    html = html.replace(/\{\{DATA_WAZNOSCI\}\}/g, validityString);
    html = html.replace(/\{\{DANE_KLIENTA\}\}/g, daneKlienta);
    html = html.replace(/\{\{DANE_INWESTYCJI\}\}/g, daneInwestycji);
    // TABELE_DN: same tabele studni (kolejno wg DN, bez nagłówka)
    html = html.replace(/\{\{TABELE_DN\}\}/g, studnieSection.tables);
    // TABELA_RUR: podsumowanie studni -> uwagi studni -> tabele rur -> podsumowanie rur -> uwagi rur -> suma łączna -> warunki płatności
    html = html.replace(
        /\{\{TABELA_RUR\}\}/g,
        [
            studnieSection.summary,
            sekcjaUwagiStudni,
            rurySection.tables,
            rurySection.summary,
            sekcjaUwagiRur,
            podsumowanieLaczne,
            warunkiPlatnosci
        ].join('\n')
    );
    html = html.replace(/\{\{PODSUMOWANIE\}\}/g, '');
    html = html.replace(/\{\{SEKCJA_UWAGI\}\}/g, '');
    html = html.replace(/\{\{DANE_KONTAKTOWE\}\}/g, daneKontaktowe);
    html = html.replace(/\{\{BASE_URL\}\}\/images\/letterhead-header\.png/g, naglowekBase64);
    html = html.replace(/\{\{BASE_URL\}\}\/images\/letterhead-footer\.png/g, stopkaBase64);
    html = html.replace(/\{\{BASE_URL\}\}/g, '');

    return html;
}

/**
 * Generuje jeden plik PDF zawierający ofertę studni i ofertę rur
 * (jeden spójny dokument ze wspólnym tytułem i warunkami występującymi raz).
 */
export async function generateCombinedOfferPDF(
    offerRuryId: string,
    offerStudnieId: string
): Promise<Buffer> {
    const [ruryCtx, studnieCtx] = await Promise.all([
        buildRuryOfferContextFromOfferId(offerRuryId),
        buildStudnieOfferContextFromOfferId(offerStudnieId)
    ]);
    const html = await generateCombinedHTML(studnieCtx, ruryCtx);
    return generatePDF(html);
}
