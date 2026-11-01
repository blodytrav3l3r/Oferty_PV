/**
 * Etykieta opraw — auto-dopasowanie fontu numeru studni i numeru zlecenia.
 *
 * Skrypt inline w szablonie jest blokowany przez CSP (nonce rodzica ≠ nonce
 * odpowiedzi szablonu), dlatego dopasowanie fontu robi silentPrint w kontekście
 * dokumentu wydruku. Regresja: powrót do inline <script> = tekst niewidoczny
 * lub ucięty.
 */

import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.join(__dirname, '..', '..');
const TEMPLATE = fs.readFileSync(path.join(ROOT, 'public', 'templates', 'etykieta.html'), 'utf-8');
const FORMATTERS = fs.readFileSync(
    path.join(ROOT, 'public', 'js', 'shared', 'formatters.js'),
    'utf-8'
);

describe('etykieta: auto-fit numerów', () => {
    it('komórki numerów mają .fit-text z limitem fontu', () => {
        expect(TEMPLATE).toContain('class="fit-text" id="snr-box" data-fit-max="100"');
        expect(TEMPLATE).toContain('class="fit-text" id="order-box" data-fit-max="150"');
    });

    it('szablon nie ma inline <script> (CSP blokuje w iframe wydruku)', () => {
        const inline = [...TEMPLATE.matchAll(/<script(?![^>]*\bsrc\b)[^>]*>/gi)];
        expect(inline).toEqual([]);
    });

    it('silentPrint dopasowuje font przed print()', () => {
        const fn = FORMATTERS.slice(FORMATTERS.indexOf('function silentPrint'));
        const fitIdx = fn.indexOf('fitPrintedText(doc)');
        const printIdx = fn.indexOf('contentWindow.print()');
        expect(fitIdx).toBeGreaterThan(-1);
        expect(printIdx).toBeGreaterThan(fitIdx);
        expect(FORMATTERS).toContain('window.fitPrintedText = fitPrintedText;');
    });
});
