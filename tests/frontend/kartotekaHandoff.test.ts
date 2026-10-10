import fs from 'fs';
import path from 'path';
import vm from 'vm';

// Handoff kokpit -> Kartoteka: sessionStorage 'care-open-followup'
// otwierany przez openFollowUpModal, wpis czyszczony (jednorazowy).
describe('kartotekaInit care handoff', () => {
    const load = (stored: string | null, ui: any) => {
        const file = path.join(__dirname, '../../public/js/kartoteka/kartotekaInit.js');
        const code = fs.readFileSync(file, 'utf8');
        let removed: string[] = [];
        const listeners: Record<string, any[]> = {};
        const context: any = {
            console,
            setTimeout: (_fn: any) => 0 as unknown as NodeJS.Timeout,
            clearTimeout: () => {},
            localStorage: { getItem: () => null, setItem() {} },
            sessionStorage: {
                getItem: () => stored,
                setItem() {},
                removeItem: (k: string) => {
                    removed.push(k);
                }
            },
            fetch: async () => ({ ok: false, json: async () => ({}) }),
            window: {
                addEventListener() {},
                location: { href: '' },
                kartotekaUI: ui,
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

    test('świeży wpis otwiera modal i czyści storage', async () => {
        const opened: any[] = [];
        const { listeners, removed } = load(
            JSON.stringify({ id: 'o1', displayType: 'studnia_oferta', at: Date.now() }),
            { openFollowUpModal: async (id: string, type: string) => void opened.push([id, type]) }
        );
        for (const fn of listeners['DOMContentLoaded'] || []) await fn();
        // Poczekaj na polling (tick 100ms).
        await new Promise((r) => setTimeout(r, 50));
        expect(opened).toEqual([['o1', 'studnia_oferta']]);
        expect(removed).toContain('care-open-followup');
    });

    test('brak wpisu / stary wpis: brak modala', async () => {
        const opened: any[] = [];
        const a = load(null, {
            openFollowUpModal: async (...args: any[]) => void opened.push(args)
        });
        for (const fn of a.listeners['DOMContentLoaded'] || []) await fn();
        const b = load(
            JSON.stringify({ id: 'o1', displayType: 'oferta', at: Date.now() - 10 * 60 * 1000 }),
            { openFollowUpModal: async (...args: any[]) => void opened.push(args) }
        );
        for (const fn of b.listeners['DOMContentLoaded'] || []) await fn();
        await new Promise((r) => setTimeout(r, 50));
        expect(opened).toEqual([]);
    });
});
