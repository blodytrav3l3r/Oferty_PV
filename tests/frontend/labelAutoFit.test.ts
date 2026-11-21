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
import vm from 'vm';

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

    it('silentPrint ustawia tytuł głównej strony dla proponowanej nazwy PDF', () => {
        const fn = FORMATTERS.slice(FORMATTERS.indexOf('function silentPrint'));
        expect(fn).toContain('function silentPrint(htmlString, printTitle)');
        expect(fn).toContain('document.title = printTitle');
        expect(fn).toContain("addEventListener('afterprint', restoreTitle");
        expect(fn).toContain('restoreTitle();');
    });

    it('ustawia tytuł rodzica przed uruchomieniem print i przywraca go po nim', () => {
        let printTitle = '';
        let iframeTitle = '';
        let afterPrint: (() => void) | undefined;
        const printDocument: any = {
            open() {},
            write() {},
            close() {},
            querySelectorAll: () => []
        };
        const iframe: any = {
            style: { cssText: '' },
            contentWindow: {
                document: printDocument,
                focus() {},
                print() {
                    printTitle = document.title;
                    iframeTitle = printDocument.title;
                },
                addEventListener(_name: string, callback: () => void) {
                    afterPrint = callback;
                }
            }
        };
        const document: any = {
            title: 'Aplikacja',
            body: {
                appendChild() {},
                contains: () => true,
                removeChild() {}
            },
            createElement: () => iframe
        };
        const context: any = {
            document,
            window: {},
            setTimeout: (callback: () => void) => callback(),
            logger: { error() {} }
        };
        vm.runInNewContext(FORMATTERS, context);

        context.window.silentPrint('<html></html>', 'N0001326 s2');
        iframe.onload();

        expect(printTitle).toBe('N0001326 s2');
        expect(iframeTitle).toBe('N0001326 s2');
        expect(document.title).toBe('Aplikacja');
        expect(afterPrint).toEqual(expect.any(Function));
    });
});
