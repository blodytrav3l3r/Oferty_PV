/**
 * combinedExport.ts
 *
 * Publiczne API "wydruku łącznego" oferty STUDNI + RUR do jednego spójnego pliku
 * PDF lub DOCX/Word. Implementacje znajdują się w pdf/combinedHtml.ts oraz
 * docx/combined.ts (oba budują JEDEN dokument ze wspólnym tytułem i warunkami
 * występującymi tylko raz).
 */

export { generateCombinedOfferPDF, generateCombinedHTML } from './pdf/combinedHtml';
export { generateCombinedOfferDOCX, buildCombinedDocument } from './docx/combined';
