import fs from 'fs';
import path from 'path';
import vm from 'vm';

// Handoff kokpit -> Kartoteka: parametr ?kontakt= w hash (fallback:
// sessionStorage 'care-open-followup'). Otwierany przez openFollowUpModal,
// jednorazowo (guard przed dublem, świeżość 5 min).
describe('kartotekaInit care handoff', () => {
    const load = (opts: { stored?: string | null; hash?: string; ui?: any }) => {
        const file = path.join(__dirname, '../../public/js/kartoteka/kartotekaInit.js');
        const code = fs.readFileSync(file, 'utf8');
        let removed: string[] = [];
        const listeners: Record<string, any[]> = {};
        const context: any = {
            console,
            setTimeout: (_fn: any) => 0 as unknown as NodeJS.Timeout,
            clearTimeout: () => {},
            URLSearchParams,
            localStorage: { getItem: () => null, setItem() {} },
            sessionStorage: {
                store: {} as Record<string, string>,
                getItem(k: string) {
                    if (k === 'care-open-followup') return opts.stored ?? null;
                    return this.store[k] ?? null;
                },
                setItem(k: string, v: string) {
                    this.store[k] = String(v);
                },
                removeItem: (k: string) => {
                    removed.push(k);
                }
            },
            fetch: async () => ({ ok: false, json: async () => ({}) }),
            window: {
                addEventListener() {},
                location: { href: '', hash: opts.hash ?? '' },
                kartotekaUI: opts.ui,
                headerUser: null,
                importExportToolbar: null
            },
            document: {
                addEventListener: (t: string, fn: any) => {
                    listeners[t] = [...(listeners[t] || []), fn];
                },
                getElementById: () => null,
                querySelectorAll: () => [],
                documentElement: { classList: { remove() {}, add() {} } }
            }
        };
        vm.createContext(context);
        vm.runInContext(code, context);
        return { listeners, removed, context };
    };

    test('parametr ?kontakt= w hash otwiera modal (fallback bez storage)', async () => {
        const opened: any[] = [];
        const { listeners } = load({
            stored: null,
            hash: '#/kartoteka?kontakt=rury%3Ao9',
            ui: {
                openFollowUpModal: async (id: string, type: string) => void opened.push([id, type])
            }
        });
        for (const fn of listeners['DOMContentLoaded'] || []) await fn();
        await new Promise((r) => setTimeout(r, 50));
        expect(opened).toEqual([['o9', 'oferta']]);
    });

    test('świeży wpis w storage otwiera modal i czyści storage', async () => {
        const opened: any[] = [];
        const { listeners, removed } = load({
            stored: JSON.stringify({ id: 'o1', displayType: 'studnia_oferta', at: Date.now() }),
            ui: {
                openFollowUpModal: async (id: string, type: string) => void opened.push([id, type])
            }
        });
        for (const fn of listeners['DOMContentLoaded'] || []) await fn();
        // Poczekaj na polling (tick 100ms).
        await new Promise((r) => setTimeout(r, 50));
        expect(opened).toEqual([['o1', 'studnia_oferta']]);
        expect(removed).toContain('care-open-followup');
    });

    test('brak wpisu / stary wpis: brak modala', async () => {
        const opened: any[] = [];
        const a = load({
            stored: null,
            ui: { openFollowUpModal: async (...args: any[]) => void opened.push(args) }
        });
        for (const fn of a.listeners['DOMContentLoaded'] || []) await fn();
        const b = load({
            stored: JSON.stringify({
                id: 'o1',
                displayType: 'oferta',
                at: Date.now() - 10 * 60 * 1000
            }),
            ui: { openFollowUpModal: async (...args: any[]) => void opened.push(args) }
        });
        for (const fn of b.listeners['DOMContentLoaded'] || []) await fn();
        await new Promise((r) => setTimeout(r, 50));
        expect(opened).toEqual([]);
    });
});
