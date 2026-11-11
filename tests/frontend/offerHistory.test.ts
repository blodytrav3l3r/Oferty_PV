import {
    createDom,
    escapeHtml,
    escapeHtmlAttr,
    loadStudnieScript,
    makeEl
} from './helpers/studnieHarness';

interface Options {
    logs?: any[];
    total?: number;
    fetchImpl?: (url: string) => Promise<any>;
    confirmResult?: boolean;
    currentWell?: any;
}

function setup(options: Options = {}) {
    const dom = createDom();
    const calls: string[] = [];
    const toasts: Array<{ msg: string; type?: string }> = [];
    const closeModal = jest.fn();
    const trapFocus = jest.fn();
    const loadSavedOfferStudnie = jest.fn();
    const loadOrderSnapshot = jest.fn();
    const applyPreviewLockUI = jest.fn();
    const appConfirm = jest.fn(async () => options.confirmResult !== false);
    const logger = { error: jest.fn() };
    const fetchMock = jest.fn(async (url: string) => {
        calls.push(url);
        if (options.fetchImpl) return options.fetchImpl(url);
        return {
            ok: true,
            json: async () => ({ data: options.logs ?? [], total: options.total ?? 0 })
        };
    });

    const { context, exposed } = loadStudnieScript({
        file: 'public/js/studnie/offerHistory.js',
        dom,
        globals: {
            fmt: (value: unknown) => Number(value).toFixed(2),
            escapeHtml,
            escapeHtmlAttr,
            logger,
            fetch: fetchMock,
            authHeaders: () => ({ Authorization: 'Bearer test' }),
            showToast: (msg: string, type?: string) => toasts.push({ msg, type }),
            appConfirm,
            closeModal,
            trapFocus,
            loadSavedOfferStudnie
        },
        expose: '{ renderAuditLogEntry, showOfferHistoryStudnie, loadMoreAuditLogs, viewHistorySnapshot, restoreHistorySnapshot }'
    });
    context.window.loadOrderSnapshot = loadOrderSnapshot;
    context.window.applyPreviewLockUI = applyPreviewLockUI;
    return {
        dom,
        context,
        exposed,
        calls,
        toasts,
        closeModal,
        trapFocus,
        loadSavedOfferStudnie,
        loadOrderSnapshot,
        applyPreviewLockUI,
        appConfirm,
        logger,
        fetchMock
    };
}

const LOG = {
    id: 'log-1',
    action: 'create',
    createdAt: '2026-01-02T10:00:00.000Z',
    userName: 'Jan Kowalski',
    newData: { totalBrutto: 1234.5, wells: [{ id: 'w1' }, { id: 'w2' }] },
    oldData: {}
};

describe('offerHistory — renderAuditLogEntry', () => {
    it('wpis create: badge, kwota, liczba studni i przycisk przywracania', () => {
        const { exposed } = setup();

        const html = exposed.renderAuditLogEntry(LOG);

        expect(html).toContain('UTWORZONO');
        expect(html).toContain('1234.50 PLN');
        expect(html).toContain('2 studni');
        expect(html).toContain('action-create');
        expect(html).toContain('restoreHistorySnapshot');
        expect(html).toContain('viewHistorySnapshot');
    });

    it('wpis delete: cena z oldData i brak przycisku przywracania', () => {
        const { exposed } = setup();

        const html = exposed.renderAuditLogEntry({
            ...LOG,
            action: 'delete',
            newData: {},
            oldData: { totalBrutto: 900 }
        });

        expect(html).toContain('USUNIĘTO');
        expect(html).toContain('wcześniej:');
        expect(html).toContain('900.00');
        expect(html).not.toContain('restoreHistorySnapshot');
        expect(html).toContain('action-delete');
    });

    it('wpis diff: klucze cen formatowane jako PLN, pozostałe jako JSON', () => {
        const { exposed } = setup();

        const html = exposed.renderAuditLogEntry({
            ...LOG,
            action: 'update',
            oldData: { totalBrutto: 100, wells: ['a'] },
            newData: { _diffMode: true, totalBrutto: 150, wells: ['a', 'b'] }
        });

        expect(html).toContain('EDYCJA (DIFF)');
        expect(html).toContain('100.00 PLN');
        expect(html).toContain('150.00 PLN');
        expect(html).toContain('["a","b"]');
        expect(html).not.toContain('restoreHistorySnapshot');
        expect(html).toContain('action-diff');
    });

    it('diff obsługuje brak starej wartości jako (brak)', () => {
        const { exposed } = setup();

        const html = exposed.renderAuditLogEntry({
            ...LOG,
            action: 'update',
            oldData: {},
            newData: { _diffMode: true, opis: 'nowy' }
        });

        expect(html).toContain('(brak)');
        expect(html).toContain('"nowy"');
    });

    it('update z ceną: pokazuje starą cenę przekreśloną i nową', () => {
        const { exposed } = setup();

        const html = exposed.renderAuditLogEntry({
            ...LOG,
            action: 'update',
            oldData: { totalBrutto: 100 },
            newData: { totalBrutto: 200, wells: [] }
        });

        expect(html).toContain('ZAPIS / AKTUALIZACJA');
        expect(html).toContain('text-decoration:line-through');
        expect(html).toContain('100.00');
        expect(html).toContain('200.00');
        // pusta tablica wells jest prawdziwa → "0 studni"
        expect(html).toContain('0 studni');
    });

    it('update bez zmiany ceny pokazuje jedną kwotę', () => {
        const { exposed } = setup();

        const html = exposed.renderAuditLogEntry({
            ...LOG,
            action: 'update',
            oldData: { totalBrutto: 100 },
            newData: { totalBrutto: 100 }
        });

        expect(html).not.toContain('line-through');
        expect(html).toContain('100.00');
    });

    it('escapuje nazwę autora (XSS)', () => {
        const { exposed } = setup();

        const html = exposed.renderAuditLogEntry({
            ...LOG,
            userName: '<img src=x onerror=alert(1)>'
        });

        expect(html).not.toContain('<img src=x');
        expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    });
});

describe('offerHistory — showOfferHistoryStudnie', () => {
    it('brak wpisów: toast info, bez modala', async () => {
        const { exposed, dom, toasts } = setup({ logs: [], total: 0 });

        await exposed.showOfferHistoryStudnie('offer-1');

        expect(toasts).toEqual([{ msg: 'Brak historii dla tego elementu', type: 'info' }]);
        expect(dom.body.children).toHaveLength(0);
    });

    it('buduje modal z wpisami, licznikiem i przyciskiem doładowania', async () => {
        const { exposed, dom, calls, trapFocus, context } = setup({
            logs: [LOG],
            total: 5
        });

        await exposed.showOfferHistoryStudnie('offer-1');

        expect(calls[0]).toBe('/api/audit/studnia_oferta/offer-1?limit=20&offset=0');
        const overlay = dom.body.children[0];
        expect(overlay.id).toBe('offer-history-modal');
        expect(overlay.attrs.role).toBe('dialog');
        expect(overlay.attrs['aria-modal']).toBe('true');
        expect(overlay.innerHTML).toContain('Oś Czasu Zmian (5 wpisów)');
        expect(overlay.innerHTML).toContain('Załaduj starsze zmiany (4 pozostało)');
        expect(overlay.classList.contains('active')).toBe(true);
        expect(trapFocus).toHaveBeenCalledWith(overlay);
        expect(context.window.currentAuditLogs).toHaveLength(1);
        expect(context.window.currentAuditOffset).toBe(1);
    });

    it('ostatnia strona historii nie ma przycisku doładowania', async () => {
        const { exposed, dom } = setup({ logs: [LOG], total: 1 });

        await exposed.showOfferHistoryStudnie('offer-1');

        expect(dom.body.children[0].innerHTML).not.toContain('Załaduj starsze zmiany');
    });

    it('błąd fetch: toast error i wpis w loggerze', async () => {
        const { exposed, toasts, logger } = setup({
            fetchImpl: async () => {
                throw new Error('sieć');
            }
        });

        await exposed.showOfferHistoryStudnie('offer-1');

        expect(toasts).toEqual([{ msg: 'Błąd pobierania historii', type: 'error' }]);
        expect(logger.error).toHaveBeenCalledWith(
            'offerManager',
            'Błąd pobierania historii:',
            expect.anything()
        );
    });
});

describe('offerHistory — loadMoreAuditLogs', () => {
    it('dokłada starsze wpisy i aktualizuje licznik/offset', async () => {
        const { exposed, context, dom } = setup({ logs: [LOG], total: 3 });
        const existing = dom.register('audit-logs-container');
        const wrap = dom.register('audit-load-more-wrap');
        context.window.currentAuditOffset = 1;
        context.window.currentAuditLogs = [LOG];

        await exposed.loadMoreAuditLogs('studnia_oferta', 'offer-1', 20);

        expect(existing.innerHTML).toContain('UTWORZONO');
        expect(existing.innerHTML).toContain('Załaduj starsze zmiany (1 pozostało)');
        expect(wrap.removed).toBe(true);
        expect(context.window.currentAuditOffset).toBe(2);
        expect(context.window.currentAuditLogs).toHaveLength(2);
    });

    it('puste doładowanie kończy pracę bez zmian DOM', async () => {
        const { exposed, context, dom } = setup({ logs: [], total: 0 });
        const container = dom.register('audit-logs-container');
        context.window.currentAuditOffset = 5;

        await exposed.loadMoreAuditLogs('studnia_oferta', 'offer-1', 20);

        expect(container.innerHTML).toBe('');
        expect(context.window.currentAuditOffset).toBe(5);
    });

    it('błąd sieci jest logowany bez rzucania', async () => {
        const { exposed, logger } = setup({
            fetchImpl: async () => {
                throw new Error('offline');
            }
        });

        await expect(
            exposed.loadMoreAuditLogs('studnia_oferta', 'o1', 20)
        ).resolves.toBeUndefined();
        expect(logger.error).toHaveBeenCalledWith(
            'offerManager',
            'Błąd ładowania kolejnych logów:',
            expect.anything()
        );
    });
});

describe('offerHistory — viewHistorySnapshot', () => {
    it('brak wpisu w pamięci: nic nie robi', async () => {
        const { exposed, fetchMock } = setup();

        await exposed.viewHistorySnapshot('brak');

        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('order: ładuje snapshot zamówienia w trybie read-only', async () => {
        const { exposed, context, loadOrderSnapshot, loadSavedOfferStudnie, closeModal, toasts } =
            setup({
                fetchImpl: async () => ({
                    ok: true,
                    json: async () => ({ data: { totalBrutto: 10 } })
                })
            });
        context.window.currentAuditLogs = [{ id: 'l1', entityType: 'order', entityId: 'ord-1' }];

        await exposed.viewHistorySnapshot('l1');

        expect(loadOrderSnapshot).toHaveBeenCalledWith({ totalBrutto: 10 }, 'ord-1');
        expect(loadSavedOfferStudnie).not.toHaveBeenCalled();
        expect(closeModal).toHaveBeenCalled();
        expect(toasts[0].msg).toContain('ZAMÓWIENIA w trybie READ-ONLY');
    });

    it('oferta: wczytuje dane i uruchamia blokadę podglądu', async () => {
        const { exposed, context, loadSavedOfferStudnie, applyPreviewLockUI } = setup({
            fetchImpl: async () => ({ ok: true, json: async () => ({ data: { wells: [] } }) })
        });
        context.window.currentAuditLogs = [
            { id: 'l1', entityType: 'studnia_oferta', entityId: 'o1' }
        ];

        await exposed.viewHistorySnapshot('l1');

        expect(loadSavedOfferStudnie).toHaveBeenCalledWith({ wells: [] });
        expect(applyPreviewLockUI).toHaveBeenCalled();
    });

    it('błąd serwera: toast z treścią błędu', async () => {
        const { exposed, context, toasts, logger } = setup({
            fetchImpl: async () => ({
                ok: false,
                json: async () => ({ error: 'Nie ma takiego wpisu' })
            })
        });
        context.window.currentAuditLogs = [{ id: 'l1', entityType: 'order', entityId: 'ord-1' }];

        await exposed.viewHistorySnapshot('l1');

        expect(toasts[0]).toEqual({ msg: 'Błąd podglądu: Nie ma takiego wpisu', type: 'error' });
        expect(logger.error).toHaveBeenCalledWith(
            'offerManager',
            'Błąd podglądu:',
            expect.anything()
        );
    });
});

describe('offerHistory — restoreHistorySnapshot', () => {
    it('brak wpisu lub danych: nic nie robi', async () => {
        const { exposed, context, appConfirm } = setup();
        context.window.currentAuditLogs = [{ id: 'l1', newData: null }];

        await exposed.restoreHistorySnapshot('l1');
        await exposed.restoreHistorySnapshot('brak');

        expect(appConfirm).not.toHaveBeenCalled();
    });

    it('anulowanie potwierdzenia nie zmienia danych', async () => {
        const { exposed, context, loadOrderSnapshot } = setup({ confirmResult: false });
        context.window.currentAuditLogs = [
            { id: 'l1', entityType: 'order', entityId: 'ord-1', newData: { a: 1 } }
        ];

        await exposed.restoreHistorySnapshot('l1');

        expect(loadOrderSnapshot).not.toHaveBeenCalled();
    });

    it('order: przywraca dane, wyłącza podgląd i czyści blokadę UI', async () => {
        const { exposed, context, dom, loadOrderSnapshot, closeModal, toasts } = setup();
        const banner = dom.register('preview-lock-banner');
        const zone = makeEl('drop-zone');
        dom.setQueryAll('.drop-zone, #svg-trash, #studnie-product-list, .actions-bar', [zone]);
        context.window.currentAuditLogs = [
            { id: 'l1', entityType: 'order', entityId: 'ord-1', newData: { a: 1 } }
        ];

        await exposed.restoreHistorySnapshot('l1');

        expect(loadOrderSnapshot).toHaveBeenCalledWith({ a: 1 }, 'ord-1');
        expect(context.window.isPreviewMode).toBe(false);
        expect(banner.removed).toBe(true);
        expect(zone.style.pointerEvents).toBe('');
        expect(zone.style.opacity).toBe('1');
        expect(closeModal).toHaveBeenCalled();
        expect(toasts[0].type).toBe('success');
    });

    it('oferta: przywraca dane bez dotykania trybu podglądu zamówienia', async () => {
        const { exposed, context, loadSavedOfferStudnie, loadOrderSnapshot } = setup();
        context.window.currentAuditLogs = [
            { id: 'l1', entityType: 'studnia_oferta', entityId: 'o1', newData: { wells: [] } }
        ];

        await exposed.restoreHistorySnapshot('l1');

        expect(loadSavedOfferStudnie).toHaveBeenCalledWith({ wells: [] });
        expect(loadOrderSnapshot).not.toHaveBeenCalled();
    });
});
