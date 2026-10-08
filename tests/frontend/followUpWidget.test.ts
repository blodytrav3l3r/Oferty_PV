import fs from 'fs';
import path from 'path';
import vm from 'vm';

// P2: widget "Opieka nad ofertami" na pulpicie — liczniki z search totalCount,
// top-5 z sort=followup, escape nazw klientów.
describe('dashboard loadFollowUpWidget', () => {
    let context: any;

    const load = (fetchMock: any, noPanel = false) => {
        const file = path.join(__dirname, '../../public/js/shared/dashboard.js');
        const code = fs.readFileSync(file, 'utf8');
        // Kontrakt window.escapeHtml (shared/ui.js) — encje jak w produkcji.
        const esc = (s: unknown) =>
            String(s ?? '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;');
        const els: Record<string, any> = {};
        const el = (id: string) =>
            (els[id] = els[id] || {
                textContent: '',
                innerHTML: '',
                classList: { add() {}, remove() {} }
            });
        context = {
            console,
            setTimeout: () => 0,
            clearTimeout: () => {},
            setInterval: () => 0,
            clearInterval: () => {},
            CustomEvent: class {
                constructor(
                    public type: string,
                    public opts?: any
                ) {}
            },
            fetch: fetchMock,
            escapeHtml: esc,
            logger: { info() {}, warn() {}, error() {} },
            sessionStorage: { getItem: () => null, setItem() {} },
            localStorage: { getItem: () => null, setItem() {} },
            window: null as any,
            document: null as any
        };
        context.window = {
            addEventListener() {},
            headerUser: null,
            location: { href: '' }
        };
        context.document = {
            addEventListener() {},
            getElementById: (id: string) =>
                noPanel && id === 'followup-panel' ? undefined : el(id),
            querySelector: () => null,
            querySelectorAll: () => [],
            documentElement: { classList: { remove() {}, add() {} } },
            dispatchEvent: () => true,
            createElement: () => ({})
        };
        vm.createContext(context);
        vm.runInContext(code, context);
        return els;
    };

    test('liczniki z totalCount + top-5 z escapem', async () => {
        const calls: string[] = [];
        const els = load(async (url: string) => {
            calls.push(url);
            if (url.includes('sort=followup')) {
                return {
                    ok: true,
                    json: async () => ({
                        data: [
                            {
                                clientName: '<b>ACME</b>',
                                data: { clientName: '<b>ACME</b>', totalBrutto: 100.5 },
                                followup: { nextContactAt: '2026-10-01T09:00:00.000Z' }
                            }
                        ]
                    })
                };
            }
            const totals: Record<string, number> = {
                needs_contact: 3,
                in_progress: 5,
                won: 7,
                lost: 2
            };
            const st = new URL(
                'http://x/' + url.replace('/api/offers/search?', '?')
            ).searchParams.get('followupStatus');
            return { ok: true, json: async () => ({ totalCount: totals[st || ''] ?? 0 }) };
        });

        await context.loadFollowUpWidget();
        expect(els['fu-stat-needs'].textContent).toBe('3');
        expect(els['fu-stat-progress'].textContent).toBe('5');
        expect(els['fu-stat-won'].textContent).toBe('7');
        expect(els['fu-stat-lost'].textContent).toBe('2');
        expect(calls.filter((u) => u.includes('limit=1'))).toHaveLength(4);
        expect(calls.some((u) => u.includes('sort=followup'))).toBe(true);
        const top = els['followup-top-list'].innerHTML as string;
        expect(top).toContain('&lt;b&gt;ACME&lt;/b&gt;');
        expect(top).not.toContain('<b>ACME</b>');
        expect(top).toContain('app.html#/kartoteka');
    });

    test('brak panelu: cichy return bez fetcha', async () => {
        let fetched = 0;
        load(async () => {
            fetched++;
            return { ok: false };
        }, true);
        await context.loadFollowUpWidget();
        expect(fetched).toBe(0);
    });
});
