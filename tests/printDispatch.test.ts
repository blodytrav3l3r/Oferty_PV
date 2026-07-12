/**
 * Regression tests for "Wydruk Dokumentów" dispatch in kartoteka.
 *
 * Background: kartoteka.html used to load only studnie/offerPrintManager.js,
 * causing rury offers to:
 *   1. Show a studnie-styled print modal (no "Karta Budowy" rury section)
 *   2. Export to /api/offers-studnie/{ruryId}/export-pdf (404/500)
 *
 * Fix:
 *   - kartoteka.html loads rury/offerPrintManager.js too
 *   - pvSalesUi.js dispatches by data-offer-type → showUniversalPrintModalRury
 *   - export errors include server response text for better diagnostics
 */

import * as fs from 'fs';
import * as path from 'path';
import * as vm from 'vm';

const PUBLIC = path.join(__dirname, '..', 'public');
const KARTOTEKA_HTML = path.join(PUBLIC, 'kartoteka.html');
const STUDNIE_PM_CORE = path.join(
    PUBLIC,
    'js',
    'studnie',
    'offerPrintManager',
    'offerPrintManagerCore.js'
);
const STUDNIE_PM_ACTIONS = path.join(
    PUBLIC,
    'js',
    'studnie',
    'offerPrintManager',
    'offerPrintManagerActions.js'
);
const RURY_PM = path.join(PUBLIC, 'js', 'rury', 'offerPrintManager.js');
const PV_SALES_UI = path.join(PUBLIC, 'js', 'sales', 'pvSalesUi.js');
const PV_SALES_ORDERS = path.join(PUBLIC, 'js', 'sales', 'pvSalesOrders.js');

function readFile(p: string): string {
    return fs.readFileSync(p, 'utf-8');
}

function readCombined(...paths: string[]): string {
    return paths.map((p) => fs.readFileSync(p, 'utf-8')).join('\n');
}

describe('Print dispatch — regression (kartoteka rury offers)', () => {
    describe('Static: kartoteka.html loads rury print manager', () => {
        let html: string;
        beforeAll(() => {
            html = readFile(KARTOTEKA_HTML);
        });

        it('ładuje js/studnie/offerPrintManager.js (legacy)', () => {
            expect(html).toMatch(/js\/studnie\/offerPrintManager\.js/);
        });

        it('ładuje js/rury/offerPrintManager.js (fix #1: rury modal dostępny)', () => {
            expect(html).toMatch(/js\/rury\/offerPrintManager\.js/);
        });

        it('ładuje rury/offerPrintManager.js PRZED pvSalesUi.js (kolejność wykonania)', () => {
            const ruryIdx = html.search(/js\/rury\/offerPrintManager\.js/);
            const pvIdx = html.search(/js\/sales\/pvSalesUi\.js/);
            expect(ruryIdx).toBeGreaterThan(-1);
            expect(pvIdx).toBeGreaterThan(-1);
            expect(ruryIdx).toBeLessThan(pvIdx);
        });
    });

    describe('Static: pvSalesUi.js + pvSalesOrders.js dispatch on offerType', () => {
        let src: string;
        beforeAll(() => {
            src = readCombined(PV_SALES_UI, PV_SALES_ORDERS);
        });

        it('dispatchuje rura_oferta → showUniversalPrintModalRury (fix #1)', () => {
            const pattern =
                /isRuryOfferFromTypeOrId[\s\S]{0,500}showUniversalPrintModalRury\s*\(\s*offerId/;
            expect(src).toMatch(pattern);
        });

        it('.btn-karta-budowy ma data-offer-type (dispatch Karta Budowy)', () => {
            const pattern =
                /class="action-btn success btn-karta-budowy"[\s\S]{0,200}data-offer-type/;
            expect(src).toMatch(pattern);
        });

        it('.btn-print-order (modal) ma data-offer-type (dispatch Karta)', () => {
            const pattern =
                /class="btn btn-sm btn-secondary btn-print-order"[\s\S]{0,250}data-offer-type/;
            expect(src).toMatch(pattern);
        });

        it('modal .btn-print-order handler dispatchuje przez openPrintModal', () => {
            const pattern =
                /overlay\.querySelectorAll\(['"]\.btn-print-order['"]\)[\s\S]{0,800}openPrintModal\s*\(/;
            expect(src).toMatch(pattern);
        });
    });

    describe('Static: error messages include server response (Variant C)', () => {
        it('studnie/offerPrintManager.js — exportOfferDirect_action ma res.text() w error', () => {
            const src = readFile(STUDNIE_PM_ACTIONS);
            // Funkcja ma save-before-export (saveOfferStudnie), więc rozszerzamy limit do 3000 znaków
            const pattern =
                /window\.exportOfferDirect_action\s*=\s*async function[\s\S]{0,3000}res\.text\(\)[\s\S]{0,200}errText/;
            expect(src).toMatch(pattern);
        });

        it('studnie/offerPrintManager.js — exportKartaDirect_action ma res.text() w error', () => {
            const src = readFile(STUDNIE_PM_ACTIONS);
            const pattern =
                /window\.exportKartaDirect_action\s*=\s*async function[\s\S]{0,2000}res\.text\(\)[\s\S]{0,200}errText/;
            expect(src).toMatch(pattern);
        });

        it('rury/offerPrintManager.js — exportOfferDirectRury_action ma res.text() w error', () => {
            const src = readFile(RURY_PM);
            const pattern =
                /async function exportOfferDirectRury_action[\s\S]{0,3000}res\.text\(\)[\s\S]{0,200}errText/;
            expect(src).toMatch(pattern);
        });
    });

    describe('Static: rury modal exposes window.showUniversalPrintModalRury', () => {
        it('rury/offerPrintManager.js — window.showUniversalPrintModalRury jest zdefiniowane', () => {
            const src = readFile(RURY_PM);
            expect(src).toMatch(
                /window\.showUniversalPrintModalRury\s*=\s*showUniversalPrintModalRury/
            );
        });

        it('rury/offerPrintManager.js — exportKartaDirectRury_action używa /api/orders-rury/ (nie studnie)', () => {
            const src = readFile(RURY_PM);
            const pattern =
                /async function exportKartaDirectRury_action[\s\S]{0,800}\/api\/orders-rury\//;
            expect(src).toMatch(pattern);
        });
    });

    describe('Static: brak kolizji nazw funkcji (studnie vs rury)', () => {
        it('rury/offerPrintManager.js NIE eksportuje window.exportOfferDirect_action (kolizja z studnie)', () => {
            const src = readFile(RURY_PM);
            // Sprawdza czy NIE MA deklaracji window.exportOfferDirect_action = ...
            // Pozwala na substring (np. "Rury" wewnątrz), ale NIE na `window.exportOfferDirect_action =`
            expect(src).not.toMatch(/window\.exportOfferDirect_action\s*=/);
        });

        it('rury/offerPrintManager.js NIE eksportuje window.exportKartaDirect_action (kolizja z studnie)', () => {
            const src = readFile(RURY_PM);
            expect(src).not.toMatch(/window\.exportKartaDirect_action\s*=/);
        });

        it('rury/offerPrintManager.js EKSPORTUJE window.exportOfferDirectRury_action (nowa nazwa)', () => {
            const src = readFile(RURY_PM);
            expect(src).toMatch(
                /window\.exportOfferDirectRury_action\s*=\s*exportOfferDirectRury_action/
            );
        });

        it('rury/offerPrintManager.js EKSPORTUJE window.exportKartaDirectRury_action (nowa nazwa)', () => {
            const src = readFile(RURY_PM);
            expect(src).toMatch(
                /window\.exportKartaDirectRury_action\s*=\s*exportKartaDirectRury_action/
            );
        });

        it('rury/offerCrud.js data-action używa exportKartaRury', () => {
            const src = readFile(path.join(PUBLIC, 'js', 'rury', 'offerCrud', 'offerCrudLoad.js'));
            expect(src).toMatch(/data-action="exportKartaRury"/);
        });
    });

    describe('Static: pvSalesUi.js dispatch obsługuje legacy "offer" + inferencję po ID', () => {
        let src: string;
        beforeAll(() => {
            src = readCombined(PV_SALES_UI, PV_SALES_ORDERS);
        });

        it('dispatch inferuje rury z offerType === "rura_oferta" + legacy "offer" + ID prefix', () => {
            // Helper isRuryOfferFromTypeOrId obejmuje 3 warunki: 'rura_oferta' | 'offer' | /^offer_rury_/
            expect(src).toMatch(/function isRuryOfferFromTypeOrId\s*\(/);
            expect(src).toMatch(/['"]rura_oferta['"]/);
            expect(src).toMatch(/['"]offer['"]/);
            expect(src).toMatch(/\^offer_rury_/);
        });

        it('jest WSPÓLNA funkcja openPrintModal(offerId, orderId, offerType, relatedOrders)', () => {
            // Unifikacja: wszystkie 4 ścieżki (Wydruk + Karta budowy × rury + studnie)
            // idą przez jedną funkcję. 4. arg relatedOrders (z ordersMap) dodany dla kartoteki.
            expect(src).toMatch(
                /function openPrintModal\s*\(\s*offerId\s*,\s*orderId\s*,\s*offerType\s*,\s*relatedOrders\s*\)/
            );
            expect(src).toMatch(
                /openPrintModal\s*\(\s*printOfferId\s*,\s*printOrderId\s*,\s*printOfferType\s*,\s*printRelatedOrders\s*\)/
            );
        });

        it('główny wiersz i popup UŻYWAJĄ openPrintModal (nie inline logic)', () => {
            // Dispatch czyta printRelatedOrders z this.ordersMap, więc odległość do openPrintModal wzrosła do ~500
            const mainRow =
                /title\.includes\(['"]karta budowy['"]\)[\s\S]{0,800}openPrintModal\s*\(/;
            // Popup btn-print-order handler jest w showOfferOrdersPopup (overlay)
            const popup =
                /overlay\.querySelectorAll\(['"]\.btn-print-order['"]\)[\s\S]{0,800}openPrintModal\s*\(/;
            expect(src).toMatch(mainRow);
            expect(src).toMatch(popup);
        });

        it('dispatch NIE wywołuje już window.exportKartaDirectRury_action bezpośrednio (usunięty bypass)', () => {
            // Po refaktorze wszystkie ścieżki idą przez openPrintModal → uniwersalny modal
            expect(src).not.toMatch(/window\.exportKartaDirectRury_action\s*\(/);
        });

        it('dispatch NIE wywołuje już inline isRuryOffer (zastąpione przez openPrintModal)', () => {
            // Wcześniej było "isRuryOffer = offerType === ..." — teraz jest w openPrintModal
            expect(src).not.toMatch(/isRuryOffer\s*=\s*offerType\s*===\s*['"]rura_oferta['"]/);
        });

        it('przycisk "Wydruk" MA data-offer-id + data-offer-type (unifikacja atrybutów)', () => {
            // Oba przyciski (Wydruk + Karta budowy) muszą mieć te same atrybuty
            // Używamy [\\s\\S] z odwróconym kierunkiem bo atrybuty są PRZED title
            const wydrukBlock = /class="action-btn secondary"[\s\S]{0,400}title="Wydruk"/;
            const match = src.match(wydrukBlock);
            expect(match).not.toBeNull();
            expect(match![0]).toMatch(/data-offer-id=/);
            expect(match![0]).toMatch(/data-offer-type=/);
        });

        it('przycisk "Karta budowy" MA data-id + data-type (unifikacja atrybutów)', () => {
            const kartaBlock = /btn-karta-budowy[\s\S]{0,500}title="Karta budowy/;
            const match = src.match(kartaBlock);
            expect(match).not.toBeNull();
            expect(match![0]).toMatch(/data-id=/);
            expect(match![0]).toMatch(/data-type=/);
        });
    });

    describe('Static: openPrintModal przekazuje relatedOrders z ordersMap (kartoteka fix)', () => {
        let src: string;
        beforeAll(() => {
            src = readCombined(PV_SALES_UI, PV_SALES_ORDERS);
        });

        it('openPrintModal akceptuje 4. param relatedOrders', () => {
            expect(src).toMatch(
                /function openPrintModal\s*\(\s*offerId\s*,\s*orderId\s*,\s*offerType\s*,\s*relatedOrders\s*\)/
            );
        });

        it('openPrintModal przekazuje relatedOrders do showUniversalPrintModalRury', () => {
            expect(src).toMatch(
                /showUniversalPrintModalRury\s*\(\s*offerId\s*,\s*safeOrderId\s*,\s*safeRelatedOrders\s*\)/
            );
        });

        it('openPrintModal przekazuje relatedOrders do showUniversalPrintModal', () => {
            expect(src).toMatch(
                /showUniversalPrintModal\s*\(\s*offerId\s*,\s*safeOrderId\s*,\s*safeRelatedOrders\s*\)/
            );
        });

        it('dispatch czyta relatedOrders z this.ordersMap (kartoteka)', () => {
            // Wydruk/Karta budowy dispatch musi czytać z this.ordersMap
            expect(src).toMatch(/this\.ordersMap\.get\(\s*this\.normalizeId\(\s*printOfferId\s*\)/);
        });

        it('popup .btn-print-order listener czyta relatedOrders z this.ordersMap', () => {
            // W showOfferOrdersPopup listenerze btn-print-order musi czytać z this.ordersMap
            expect(src).toMatch(/this\.ordersMap\.get\(\s*this\.normalizeId\(\s*offerId\s*\)/);
        });
    });

    describe('Static: showUniversalPrintModalRury akceptuje relatedOrders (rury modal fix)', () => {
        let src: string;
        beforeAll(() => {
            src = readFile(RURY_PM);
        });

        it('showUniversalPrintModalRury ma sygnaturę (offerId, orderId, relatedOrders)', () => {
            expect(src).toMatch(
                /function showUniversalPrintModalRury\s*\(\s*offerId\s*,\s*orderId\s*,\s*relatedOrders\s*\)/
            );
        });

        it('rury modal preferuje przekazany relatedOrders nad getOrdersForOffer', () => {
            // Kolejność: Array.isArray(relatedOrders) > getOrdersForOffer > ordersRury
            expect(src).toMatch(/Array\.isArray\(\s*relatedOrders\s*\)/);
        });

        it('rury modal UŻYWA relatedOrders do budowy ordersSection i kartaSection', () => {
            // Sprawdź czy oba sekcje korzystają z przekazanych orders (nie relatedOrders?)
            expect(src).toMatch(/ordersSection:\s*orders\.length\s*>\s*0/);
            expect(src).toMatch(/kartaSection:\s*orders\.length\s*>\s*0/);
        });
    });

    describe('Static: showUniversalPrintModal (studnie) akceptuje relatedOrders (legacy fetch usunięty)', () => {
        let src: string;
        beforeAll(() => {
            src = readFile(STUDNIE_PM_ACTIONS);
        });

        it('showUniversalPrintModal ma sygnaturę (offerId, orderId, relatedOrders)', () => {
            // Uwzględnia JSDoc type cast: window.showUniversalPrintModal = /** @type {...} */ (function(...) {
            expect(src).toMatch(
                /window\.showUniversalPrintModal\s*=\s*(?:\/\*\*[\s\S]*?\*\/\s*)?(?:function\s*)?\(?\s*function\s*\(\s*offerId\s*,\s*orderId\s*,\s*relatedOrders\s*\)/
            );
        });

        it('studnie modal preferuje przekazany relatedOrders', () => {
            expect(src).toMatch(/Array\.isArray\(\s*relatedOrders\s*\)/);
        });

        it('studnie modal USUNIĘTO legacy fetch fallback /api/orders-studnie', () => {
            // Po refaktorze: brak fetch /api/orders-studnie/${...} w showUniversalPrintModal
            expect(src).not.toMatch(/fetch\([`'"]\/api\/orders-studnie\/\$\{finalOrderId\}/);
        });

        it('studnie modal USUNIĘTO martwe _modalRelatedOrders global', () => {
            // Stary mechanizm asynchronicznego renderOrdersSection — usunięty
            expect(src).not.toMatch(/window\._modalRelatedOrders/);
        });

        it('studnie modal USUNIĘTO martwe window.renderOrdersSection (legacy)', () => {
            // Cała funkcja window.renderOrdersSection była wstrzykiwaczem inline-stylowanego HTML
            expect(src).not.toMatch(/window\.renderOrdersSection\s*=\s*function/);
        });

        it('studnie modal UŻYWA relatedOrders do budowy ordersSection i kartaSection', () => {
            expect(src).toMatch(/ordersSection:\s*orders\.length\s*>\s*0/);
            expect(src).toMatch(/kartaSection:\s*orders\.length\s*>\s*0/);
        });
    });

    describe('Static: martwy kod usunięty (openExportPopupUnified + handleExportClick)', () => {
        it('pvSalesUi.js NIE zawiera już openExportPopupUnified', () => {
            const src = readFile(PV_SALES_UI);
            expect(src).not.toMatch(/openExportPopupUnified/);
        });

        it('pvSalesUi.js NIE zawiera już handleExportClick', () => {
            const src = readFile(PV_SALES_UI);
            expect(src).not.toMatch(/handleExportClick/);
        });
    });

    describe('Behavioral: exportOfferDirect_action URL routing (vm + fetch mock)', () => {
        interface FetchCall {
            url: string;
            method: string;
        }

        function loadInVm(
            file: string | string[],
            fetchMock: (url: string) => Promise<{
                ok: boolean;
                status: number;
                blob: () => Promise<Blob>;
                text: () => Promise<string>;
            }>
        ): { fetchCalls: FetchCall[]; window: Record<string, unknown> } {
            const fetchCalls: FetchCall[] = [];
            const mockFetch = (url: string, init?: { method?: string }) => {
                fetchCalls.push({ url, method: init?.method || 'GET' });
                return fetchMock(url);
            };

            const sandbox: Record<string, unknown> = {
                window: {},
                document: {
                    getElementById: () => null,
                    createElement: () => ({
                        href: '',
                        download: '',
                        click: () => {}
                    }),
                    body: { appendChild: () => {}, removeChild: () => {} }
                },
                logger: { error: () => {}, warn: () => {}, info: () => {} },
                URL: { createObjectURL: () => 'blob:mock', revokeObjectURL: () => {} },
                fetch: mockFetch,
                console,
                showToast: () => {},
                closeModal: () => {},
                authHeaders: () => ({}),
                lucide: { createIcons: () => {} }
            };
            sandbox.window = sandbox;
            sandbox.globalThis = sandbox;

            const context = vm.createContext(sandbox);
            const files = Array.isArray(file) ? file : [file];
            const code = files.map((f) => readFile(f)).join('\n');
            vm.runInContext(code, context, { filename: files.join('+') });

            return { fetchCalls, window: sandbox.window as Record<string, unknown> };
        }

        function okResponse(): Promise<{
            ok: boolean;
            status: number;
            blob: () => Promise<Blob>;
            text: () => Promise<string>;
        }> {
            return Promise.resolve({
                ok: true,
                status: 200,
                blob: () => Promise.resolve(new Blob(['mock'])),
                text: () => Promise.resolve('')
            });
        }

        it('STUDNIE: exportOfferDirect_action wywołuje /api/offers-studnie/{id}/export-pdf', async () => {
            const { fetchCalls, window } = loadInVm([STUDNIE_PM_CORE, STUDNIE_PM_ACTIONS], () =>
                okResponse()
            );
            const fn = window.exportOfferDirect_action as (
                id: string,
                fmt: 'pdf' | 'docx'
            ) => Promise<void>;
            expect(fn).toBeDefined();

            await fn('stud_abc', 'pdf');

            expect(fetchCalls).toHaveLength(1);
            expect(fetchCalls[0].url).toBe('/api/offers-studnie/stud_abc/export-pdf');
        });

        it('STUDNIE: exportOfferDirect_action docx → /api/offers-studnie/{id}/export-docx', async () => {
            const { fetchCalls, window } = loadInVm([STUDNIE_PM_CORE, STUDNIE_PM_ACTIONS], () =>
                okResponse()
            );
            const fn = window.exportOfferDirect_action as (
                id: string,
                fmt: string
            ) => Promise<void>;
            await fn('stud_xyz', 'docx');

            expect(fetchCalls[0].url).toBe('/api/offers-studnie/stud_xyz/export-docx');
        });

        it('RURY: exportOfferDirectRury_action wywołuje /api/offers-rury/{id}/export-pdf', async () => {
            const { fetchCalls, window } = loadInVm(RURY_PM, () => okResponse());
            const fn = window.exportOfferDirectRury_action as (
                id: string,
                fmt: string
            ) => Promise<void>;
            expect(fn).toBeDefined();

            await fn('rura_abc', 'pdf');

            expect(fetchCalls).toHaveLength(1);
            expect(fetchCalls[0].url).toBe('/api/offers-rury/rura_abc/export-pdf');
        });

        it('RURY: exportKartaDirectRury_action → /api/orders-rury/{id}/export-karta-pdf', async () => {
            const { fetchCalls, window } = loadInVm(RURY_PM, () => okResponse());
            const fn = window.exportKartaDirectRury_action as (
                id: string,
                fmt: string
            ) => Promise<void>;
            expect(fn).toBeDefined();

            await fn('rura_order_1', 'pdf');

            expect(fetchCalls).toHaveLength(1);
            expect(fetchCalls[0].url).toBe('/api/orders-rury/rura_order_1/export-karta-pdf');
        });
    });

    describe('Behavioral: error messages expose server text (Variant C)', () => {
        function makeFailingFetch(
            status: number,
            textBody: string
        ): (url: string) => Promise<{
            ok: boolean;
            status: number;
            blob: () => Promise<Blob>;
            text: () => Promise<string>;
        }> {
            return () =>
                Promise.resolve({
                    ok: false,
                    status,
                    blob: () => Promise.reject(new Error('no blob')),
                    text: () => Promise.resolve(textBody)
                });
        }

        it('STUDNIE error toast zawiera status HTTP i treść odpowiedzi (nie generic msg)', async () => {
            const toastMessages: { msg: string; type: string }[] = [];
            const sandbox: Record<string, unknown> = {
                window: {},
                logger: { error: () => {}, warn: () => {}, info: () => {} },
                document: {
                    getElementById: () => null,
                    createElement: () => ({ href: '', download: '', click: () => {} }),
                    body: { appendChild: () => {}, removeChild: () => {} }
                },
                URL: { createObjectURL: () => 'blob:mock', revokeObjectURL: () => {} },
                fetch: makeFailingFetch(500, 'Oferta studni nie znaleziona'),
                console,
                showToast: (msg: string, type: string) => {
                    toastMessages.push({ msg, type });
                },
                closeModal: () => {},
                authHeaders: () => ({}),
                // Ustawiamy editingOfferIdStudnie na inny id, żeby pominąć blok save-before-export
                editingOfferIdStudnie: 'OTHER_ID',
                lucide: { createIcons: () => {} }
            };
            sandbox.window = sandbox;
            sandbox.globalThis = sandbox;
            const context = vm.createContext(sandbox);
            vm.runInContext(
                readFile(STUDNIE_PM_CORE) + '\n' + readFile(STUDNIE_PM_ACTIONS),
                context,
                { filename: STUDNIE_PM_CORE + '+' + STUDNIE_PM_ACTIONS }
            );

            const fn = (sandbox.window as Record<string, unknown>).exportOfferDirect_action as (
                id: string,
                fmt: string
            ) => Promise<void>;
            await fn('stud_id_1', 'pdf');
            // Czekamy na .catch promise chain (fire-and-forget)
            await new Promise((r) => setImmediate(r));
            await new Promise((r) => setTimeout(r, 50));

            const errorToasts = toastMessages.filter((t) => t.type === 'error');
            expect(errorToasts).toHaveLength(1);
            // Wariant C: error musi zawierać status 500 i/lub treść "Oferta studni nie znaleziona"
            expect(errorToasts[0].msg).toMatch(/500/);
            expect(errorToasts[0].msg).toMatch(/Oferta studni nie znaleziona|statusText/);
        });

        it('RURY error toast zawiera status HTTP i treść odpowiedzi', async () => {
            const toastMessages: { msg: string; type: string }[] = [];
            const sandbox: Record<string, unknown> = {
                window: {},
                document: {
                    getElementById: () => null,
                    createElement: () => ({ href: '', download: '', click: () => {} }),
                    body: { appendChild: () => {}, removeChild: () => {} }
                },
                logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
                URL: { createObjectURL: () => 'blob:mock', revokeObjectURL: () => {} },
                fetch: makeFailingFetch(404, 'Oferta rur nie znaleziona w bazie'),
                console,
                showToast: (msg: string, type: string) => {
                    toastMessages.push({ msg, type });
                },
                closeModal: () => {},
                authHeaders: () => ({}),
                lucide: { createIcons: () => {} }
            };
            sandbox.window = sandbox;
            sandbox.globalThis = sandbox;
            const context = vm.createContext(sandbox);
            vm.runInContext(readFile(RURY_PM), context, { filename: RURY_PM });

            const fn = (sandbox.window as Record<string, unknown>).exportOfferDirectRury_action as (
                id: string,
                fmt: string
            ) => Promise<void>;
            await fn('rura_id_999', 'pdf');

            const errorToasts = toastMessages.filter((t) => t.type === 'error');
            expect(errorToasts).toHaveLength(1);
            expect(errorToasts[0].msg).toMatch(/404/);
            expect(errorToasts[0].msg).toMatch(/Oferta rur nie znaleziona w bazie|statusText/);
        });
    });
});
