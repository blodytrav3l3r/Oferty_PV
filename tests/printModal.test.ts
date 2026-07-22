import fs from 'fs';
import path from 'path';
import vm from 'vm';

/**
 * Testy pomocniczego modala wydruku (public/js/shared/printModal.js).
 * Używa vm sandbox do załadowania pliku JS bez globalnego side-effectu.
 */

function loadPrintModalInSandbox() {
    const filePath = path.join(__dirname, '..', 'public', 'js', 'shared', 'printModal.js');
    const source = fs.readFileSync(filePath, 'utf8');

    const calls: Array<{ action: string; id: string; format: string }> = [];
    const showToastCalls: Array<{ msg: string; type: string }> = [];
    const createIconsCalls: string[] = [];
    const registeredListeners: Array<(ev: any) => void> = [];

    const bodyEl: any = {
        insertedHtml: '',
        insertAdjacentHTML(_pos: string, html: string) {
            this.insertedHtml = html;
        }
    };

    const documentMock: any = {
        _listeners: [] as Array<(...args: any[]) => void>,
        _elements: {} as Record<string, any>,
        getElementById(id: string) {
            return this._elements[id] || null;
        },
        addEventListener(event: string, listener: any) {
            if (event === 'click') registeredListeners.push(listener);
        },
        body: bodyEl
    };

    function escapeHtml(str: unknown): string {
        if (str == null) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    const sandbox: any = {
        console,
        document: documentMock,
        window: {} as any,
        setTimeout: (cb: () => void) => cb(),
        setImmediate: (cb: () => void) => cb()
    };
    sandbox.window = sandbox;
    sandbox.window.escapeHtml = escapeHtml;
    sandbox.window.lucide = {
        createIcons: (opts?: any) => createIconsCalls.push(JSON.stringify(opts))
    };
    sandbox.window.showToast = (msg: string, type: string) => showToastCalls.push({ msg, type });
    sandbox.window.__testCallRegistry = calls;
    sandbox.window.__testClick = (action: string, id: string, format: string) => {
        calls.push({ action, id, format });
    };
    sandbox.window.__testAction1 = (id: string, format: string) =>
        calls.push({ action: 'action1', id, format });
    sandbox.window.__testAction2 = (id: string, format: string) =>
        calls.push({ action: 'action2', id, format });
    sandbox.window.__testAction3 = (id: string, format: string) =>
        calls.push({ action: 'action3', id, format });
    sandbox.window.__testAction4 = (id: string, format: string) =>
        calls.push({ action: 'action4', id, format });

    vm.createContext(sandbox);
    vm.runInContext(source, sandbox, { filename: 'printModal.js' });

    return {
        sandbox,
        documentMock,
        bodyEl,
        calls,
        showToastCalls,
        createIconsCalls,
        registeredListeners
    };
}

describe('printModal helper (public/js/shared/printModal.js)', () => {
    describe('Sekcje OFERTA i OFERTA (bieżący stan)', () => {
        it('renderuje sekcję OFERTA z przyciskami PDF/Word', () => {
            const { sandbox, bodyEl } = loadPrintModalInSandbox();
            sandbox.window.showUniversalPrintModal({
                modalTitle: 'Test',
                offerSection: {
                    id: 'off-1',
                    actionPdf: '__testAction1',
                    actionDocx: '__testAction1',
                    title: 'Oferta',
                    description: 'Opis'
                }
            });
            expect(bodyEl.insertedHtml).toMatch(/upm-section/);
            expect(bodyEl.insertedHtml).toMatch(/Oferta/);
            expect(bodyEl.insertedHtml).toMatch(/data-action="__testAction1"/);
            expect(bodyEl.insertedHtml).toMatch(/data-id="off-1"/);
            expect(bodyEl.insertedHtml).toMatch(/data-format="pdf"/);
            expect(bodyEl.insertedHtml).toMatch(/data-format="docx"/);
        });

        it('renderuje sekcję "bieżący stan" z badge POST/tekstem', () => {
            const { sandbox, bodyEl } = loadPrintModalInSandbox();
            sandbox.window.showUniversalPrintModal({
                orderCurrentSection: {
                    id: 'ord-1',
                    actionPdf: '__testAction2',
                    actionDocx: '__testAction2',
                    title: 'Oferta (bieżący stan)',
                    badge: 'POST'
                }
            });
            expect(bodyEl.insertedHtml).toMatch(/upm-badge/);
            expect(bodyEl.insertedHtml).toMatch(/POST/);
            expect(bodyEl.insertedHtml).toMatch(/data-action="__testAction2"/);
        });

        it('pomija sekcję OFERTA gdy brak id', () => {
            const { sandbox, bodyEl } = loadPrintModalInSandbox();
            sandbox.window.showUniversalPrintModal({
                offerSection: null
            });
            expect(bodyEl.insertedHtml).toBe('');
        });
    });

    describe('Sekcja ZAMÓWIENIA (lista per related order)', () => {
        it('renderuje listę zamówień z przyciskami PDF/Word per row', () => {
            const { sandbox, bodyEl } = loadPrintModalInSandbox();
            sandbox.window.showUniversalPrintModal({
                ordersSection: {
                    orders: [
                        { id: 'ord-1', orderNumber: 'ZAM-001' },
                        { id: 'ord-2', orderNumber: 'ZAM-002' }
                    ],
                    actionPdf: '__testAction3',
                    actionDocx: '__testAction3'
                }
            });
            expect(bodyEl.insertedHtml).toMatch(/upm-orders-list/);
            expect(bodyEl.insertedHtml).toMatch(/data-id="ord-1"/);
            expect(bodyEl.insertedHtml).toMatch(/data-id="ord-2"/);
            expect(bodyEl.insertedHtml).toMatch(/ZAM-001/);
            expect(bodyEl.insertedHtml).toMatch(/ZAM-002/);
            expect(bodyEl.insertedHtml).toMatch(/upm-row/);
        });

        it('renderuje status badge w wierszu zamówienia', () => {
            const { sandbox, bodyEl } = loadPrintModalInSandbox();
            sandbox.window.showUniversalPrintModal({
                ordersSection: {
                    orders: [{ id: 'ord-1', orderNumber: 'ZAM-001', status: 'ordered' }],
                    actionPdf: '__testAction3',
                    actionDocx: '__testAction3'
                }
            });
            expect(bodyEl.insertedHtml).toMatch(/upm-status-ordered/);
        });

        it('pomija sekcję gdy orders.length === 0', () => {
            const { sandbox, bodyEl } = loadPrintModalInSandbox();
            sandbox.window.showUniversalPrintModal({
                ordersSection: { orders: [], actionPdf: 'x', actionDocx: 'y' }
            });
            expect(bodyEl.insertedHtml).toBe('');
        });
    });

    describe('Sekcja KARTY BUDOWY', () => {
        it('renderuje listę kart z upm-title-karta', () => {
            const { sandbox, bodyEl } = loadPrintModalInSandbox();
            sandbox.window.showUniversalPrintModal({
                kartaSection: {
                    orders: [{ id: 'ord-1', orderNumber: 'ZAM-001' }],
                    actionPdf: '__testAction4',
                    actionDocx: '__testAction4'
                }
            });
            expect(bodyEl.insertedHtml).toMatch(/upm-title-karta/);
            expect(bodyEl.insertedHtml).toMatch(/data-action="__testAction4"/);
            expect(bodyEl.insertedHtml).toMatch(/KB: ZAM-001/);
        });
    });

    describe('Dispatcher (event delegation)', () => {
        it('dispatcher wywołuje window[action](id, format) po click na btn w modalu', () => {
            const { sandbox, documentMock, registeredListeners, calls } = loadPrintModalInSandbox();
            sandbox.window.showUniversalPrintModal({
                offerSection: {
                    id: 'off-1',
                    actionPdf: '__testAction1',
                    actionDocx: '__testAction1'
                }
            });

            const modalEl: any = { id: 'universal-print-modal', contains: () => true };
            documentMock._elements['universal-print-modal'] = modalEl;

            const btn: any = {
                getAttribute: (n: string) =>
                    n === 'data-action' ? '__testAction1' : n === 'data-id' ? 'off-1' : 'pdf'
            };

            const clickHandler = registeredListeners[0];
            const clickEvent: any = {
                target: {
                    closest: (sel: string) => {
                        if (sel === '[data-action]') return btn;
                        return null;
                    }
                }
            };

            clickHandler(clickEvent);
            expect(calls).toContainEqual({ action: 'action1', id: 'off-1', format: 'pdf' });
        });

        it('dispatcher ignoruje clicki poza modalem (np. globalne)', () => {
            const { sandbox, documentMock, registeredListeners, calls } = loadPrintModalInSandbox();
            sandbox.window.showUniversalPrintModal({});

            const btn = {
                getAttribute: (n: string) =>
                    n === 'data-action' ? '__testAction1' : n === 'data-id' ? 'off-1' : 'pdf'
            };
            documentMock._elements['universal-print-modal'] = null;

            const clickHandler = registeredListeners[0];
            clickHandler({
                target: { closest: () => btn }
            } as any);
            expect(calls).toEqual([]);
        });

        it('dispatcher NIE loguje bledu dla __upm_close (handled by dedykowany listener)', () => {
            const { sandbox, documentMock, registeredListeners, calls } = loadPrintModalInSandbox();
            sandbox.window.showUniversalPrintModal({
                offerSection: {
                    id: 'off-1',
                    actionPdf: '__testAction1',
                    actionDocx: '__testAction1'
                }
            });

            const modalEl: any = { id: 'universal-print-modal', contains: () => true };
            documentMock._elements['universal-print-modal'] = modalEl;

            const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

            const btn: any = {
                getAttribute: (n: string) =>
                    n === 'data-action' ? '__upm_close' : n === 'data-id' ? '' : ''
            };

            const clickHandler = registeredListeners[0];
            clickHandler({
                target: { closest: (sel: string) => (sel === '[data-action]' ? btn : null) }
            } as any);

            expect(errorSpy).not.toHaveBeenCalledWith(
                'printModal: brak globalnej funkcji',
                '__upm_close'
            );
            expect(calls).toEqual([]);

            errorSpy.mockRestore();
        });
    });

    describe('Pusty stan i toast', () => {
        it('wyświetla toast gdy brak jakiejkolwiek sekcji', () => {
            const { sandbox, showToastCalls } = loadPrintModalInSandbox();
            sandbox.window.showUniversalPrintModal({});
            expect(showToastCalls).toContainEqual({
                msg: 'Brak aktywnego dokumentu do wydruku',
                type: 'error'
            });
        });

        it('renderuje 4 sekcje gdy wszystkie podane', () => {
            const { sandbox, bodyEl } = loadPrintModalInSandbox();
            sandbox.window.showUniversalPrintModal({
                offerSection: { id: 'o', actionPdf: 'a', actionDocx: 'a' },
                orderCurrentSection: { id: 'c', actionPdf: 'b', actionDocx: 'b' },
                ordersSection: { orders: [{ id: 'o1' }], actionPdf: 'c', actionDocx: 'c' },
                kartaSection: { orders: [{ id: 'o1' }], actionPdf: 'd', actionDocx: 'd' }
            });
            const matches = bodyEl.insertedHtml.match(/data-section="/g) || [];
            expect(matches.length).toBe(4);
        });
    });

    describe('XSS / escape', () => {
        it('escapeHtml neutralizuje tytuły z HTML', () => {
            const { sandbox, bodyEl } = loadPrintModalInSandbox();
            sandbox.window.showUniversalPrintModal({
                offerSection: {
                    id: 'off-1',
                    actionPdf: 'a',
                    actionDocx: 'a',
                    title: '<script>alert(1)</script>',
                    description: 'A&B'
                }
            });
            expect(bodyEl.insertedHtml).not.toMatch(/<script>alert/);
            expect(bodyEl.insertedHtml).toMatch(/&lt;script&gt;/);
            expect(bodyEl.insertedHtml).toMatch(/A&amp;B/);
        });
    });
});
