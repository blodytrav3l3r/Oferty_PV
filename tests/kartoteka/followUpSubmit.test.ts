import fs from 'fs';
import path from 'path';
import vm from 'vm';

// P4.1: guard double-submit — dwa szybkie submity przy wiszącym fetchu = 1 POST.
describe('kartotekaFollowUp submitFollowUp — guard', () => {
    let mixin: any;
    let fetchCalls: number;
    let fetchBodies: string[];
    let resolvers: Array<(v: unknown) => void>;

    const load = () => {
        const file = path.join(__dirname, '../../public/js/kartoteka/kartotekaFollowUp.js');
        let code = fs.readFileSync(file, 'utf8');
        // Plik ESM: importy wytnij (stub poniżej), `export default` na przypisanie.
        code = code
            .replace(/^import[\s\S]*?from\s+['"][^'"]+['"];?\s*$/gm, '')
            .replace(/export default \{/, 'module.exports = {');
        const esc = (s: unknown) => String(s ?? '');
        fetchCalls = 0;
        fetchBodies = [];
        resolvers = [];
        const vals: Record<string, string> = {
            '#fu-channel': 'PHONE',
            '#fu-result': 'CONTACTED',
            '#fu-contacted-at': '2026-10-08T09:55',
            '#fu-duration': '',
            '#fu-note': '',
            '#fu-next': '',
            '#fu-outcome': 'OPEN',
            '#fu-lose-reason': '',
            '#fu-competitor': ''
        };
        const context: any = {
            console,
            legacyToContacts: () => [],
            normalizeContacts: (r: any) => (Array.isArray(r) ? r : []),
            renderEditor: () => {},
            collectContacts: () => [],
            bindEditor: () => {},
            module: { exports: {} },
            fetch: (_url: string, opts: { body?: string }) => {
                fetchCalls++;
                if (opts?.body) fetchBodies.push(opts.body);
                return new Promise((resolve) => {
                    resolvers.push(resolve);
                });
            },
            authHeaders: () => ({ 'Content-Type': 'application/json' }),
            logger: { info() {}, warn() {}, error() {} },
            window: {
                escapeHtml: esc,
                showToast() {},
                closeModal() {},
                offerTypeForApi: () => 'rury',
                lucide: null
            }
        };
        context.window.window = context.window;
        vm.createContext(context);
        vm.runInContext(code, context);
        mixin = context.module.exports;
        const errBox = { hidden: true, textContent: '' };
        const submitBtn = { disabled: false };
        const overlay = {
            querySelector: (sel: string) => {
                if (sel === '#fu-error') return errBox;
                if (sel === '#fu-contact-form button[type="submit"]') return submitBtn;
                if (sel === '#fu-reopen') return null;
                return { value: vals[sel] ?? '' };
            }
        };
        return { overlay, errBox, submitBtn };
    };

    test('drugi submit w locie jest ignorowany (1 POST)', async () => {
        const { overlay, submitBtn } = load();
        // Jak Object.assign na prototypie: wszystkie metody mixinu na this.
        const ctx = Object.assign({ _fuSubmitting: false, loadLocalOffers: async () => {} }, mixin);
        const p1 = mixin.submitFollowUp.call(ctx, 'o-1', 'rury', overlay);
        expect(submitBtn.disabled).toBe(true);
        const p2 = mixin.submitFollowUp.call(ctx, 'o-1', 'rury', overlay);
        await p2;
        expect(fetchCalls).toBe(1);
        // Dokończ pierwszy: guard wraca, przycisk odblokowany.
        resolvers.forEach((r) => r({ ok: true, json: async () => ({}) }));
        await p1;
        expect(submitBtn.disabled).toBe(false);
        expect((ctx as { _fuSubmitting: boolean })._fuSubmitting).toBe(false);
    });

    test('P4.3: termin nastepnego kontaktu trzyma dzien lokalny (nie cofa do UTC)', async () => {
        const { overlay } = load();
        const ctx = Object.assign({ _fuSubmitting: false, loadLocalOffers: async () => {} }, mixin);
        // Ustaw datę następnego kontaktu przez stub overlay.
        const withNext = {
            querySelector: (sel: string) =>
                sel === '#fu-next' ? { value: '2026-10-10' } : overlay.querySelector(sel)
        };
        const p = mixin.submitFollowUp.call(ctx, 'o-1', 'rury', withNext);
        resolvers.forEach((r) => r({ ok: true, json: async () => ({}) }));
        await p;
        expect(fetchBodies).toHaveLength(1);
        const next = JSON.parse(fetchBodies[0]).nextContactAt as string;
        const back = new Date(next);
        const day =
            back.getFullYear() +
            '-' +
            String(back.getMonth() + 1).padStart(2, '0') +
            '-' +
            String(back.getDate()).padStart(2, '0');
        // Dzień po konwersji local→UTC→local ten sam, niezależnie od strefy.
        expect(day).toBe('2026-10-10');
    });

    test('po zakonczeniu kolejny submit przechodzi (2 POST)', async () => {
        const { overlay } = load();
        const ctx = Object.assign({ _fuSubmitting: false, loadLocalOffers: async () => {} }, mixin);
        const p1 = mixin.submitFollowUp.call(ctx, 'o-1', 'rury', overlay);
        resolvers.forEach((r) => r({ ok: true, json: async () => ({}) }));
        await p1;
        const p2 = mixin.submitFollowUp.call(ctx, 'o-1', 'rury', overlay);
        resolvers.forEach((r) => r({ ok: true, json: async () => ({}) }));
        await p2;
        expect(fetchCalls).toBe(2);
    });
});
