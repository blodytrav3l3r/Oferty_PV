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
        expect(fn).toContain("addEventListener('afterprint', cleanup");
        expect(fn).toContain('restoreTitle();');
    });

    const createPrintContext = (print: () => void = () => {}) => {
        const timers = new Map<number, { callback: () => void; delay: number }>();
        let nextTimer = 0;
        let removed = false;
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
                    print();
                },
                addEventListener(_name: string, callback: () => void) {
                    afterPrint = callback;
                },
                removeEventListener() {}
            }
        };
        const document: any = {
            title: 'Aplikacja',
            body: {
                appendChild() {},
                contains: () => !removed,
                removeChild() {
                    removed = true;
                }
            },
            createElement: () => iframe
        };
        const context: any = {
            document,
            window: {},
            setTimeout: (callback: () => void, delay = 0) => {
                const id = ++nextTimer;
                timers.set(id, { callback, delay });
                return id;
            },
            clearTimeout: (id: number) => timers.delete(id),
            logger: { error() {} }
        };
        vm.runInNewContext(FORMATTERS, context);
        return {
            context,
            document,
            iframe,
            timers,
            get removed() {
                return removed;
            },
            get printTitle() {
                return printTitle;
            },
            get iframeTitle() {
                return iframeTitle;
            },
            get afterPrint() {
                return afterPrint;
            },
            runTimers(maxDelay = Number.POSITIVE_INFINITY) {
                [...timers.entries()].forEach(([id, timer]) => {
                    if (timer.delay > maxDelay) return;
                    timers.delete(id);
                    timer.callback();
                });
            }
        };
    };

    it('drukuje z nazwą pliku i sprząta iframe po afterprint', () => {
        const test = createPrintContext();
        test.context.window.silentPrint('<html></html>', 'N0001326 s2');
        test.iframe.onload();
        test.runTimers(500);

        expect(test.printTitle).toBe('N0001326 s2');
        expect(test.iframeTitle).toBe('N0001326 s2');
        expect(test.document.title).toBe('Aplikacja');
        expect(test.removed).toBe(false);
        test.afterPrint?.();
        expect(test.removed).toBe(true);
    });

    it('timeout ładowania usuwa iframe i przywraca tytuł bez wywołania print', () => {
        const test = createPrintContext();
        test.context.window.silentPrint('<html></html>', 'N0001326 s2');
        test.runTimers(60000);

        expect(test.removed).toBe(true);
        expect(test.document.title).toBe('Aplikacja');
        expect(test.printTitle).toBe('');
    });

    it('błąd ładowania iframe usuwa go od razu', () => {
        const test = createPrintContext();
        test.context.window.silentPrint('<html></html>', 'N0001326 s2');
        test.iframe.onerror();

        expect(test.removed).toBe(true);
        expect(test.document.title).toBe('Aplikacja');
    });

    it('błąd print() przywraca tytuł i usuwa iframe', () => {
        const test = createPrintContext(() => {
            throw new Error('print failed');
        });
        test.context.window.silentPrint('<html></html>', 'N0001326 s2');
        test.iframe.onload();
        test.runTimers(500);

        expect(test.document.title).toBe('Aplikacja');
        expect(test.removed).toBe(true);
    });
});
