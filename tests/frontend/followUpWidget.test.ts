import fs from 'fs';
import path from 'path';
import vm from 'vm';

// P2: widget "Opieka nad ofertami" na pulpicie — liczniki z search totalCount,
// top-5 z sort=followup, escape nazw klientów.
describe('dashboard loadFollowUpWidget', () => {
    let context: any;

    const load = (
        fetchMock: any,
        noPanel = false,
        range: string | null = null,
        custom: { from: string; to: string } | null = null
    ) => {
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
            localStorage: {
                getItem: (k: string) =>
                    k === 'sok-care-range'
                        ? range
                        : k === 'sok-care-from'
                          ? custom?.from
                          : k === 'sok-care-to'
                            ? custom?.to
                            : null,
                setItem() {}
            },
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

    test('tylko KPI (liczniki pisze carePanel, top-5 w kolejce opieki)', async () => {
        const calls: string[] = [];
        const els = load(async (url: string) => {
            calls.push(url);
            if (url.includes('followups/stats')) {
                return {
                    ok: true,
                    json: async () => ({
                        stats: { conversion: 0.295, lostValue: 12345.678, avgFirstContactH: 30.5 }
                    })
                };
            }
            return { ok: true, json: async () => ({ totalCount: 0 }) };
        });

        await context.loadFollowUpWidget();
        // Liczników dashboard NIE rusza (brak elementów w els) — SSoT to carePanel.
        expect(els['fu-stat-needs']).toBeUndefined();
        expect(els['fu-stat-progress']).toBeUndefined();
        expect(els['fu-stat-won']).toBeUndefined();
        expect(els['fu-stat-lost']).toBeUndefined();
        expect(calls.filter((u) => u.includes('limit=1'))).toHaveLength(0);
        expect(calls.some((u) => u.includes('sort=followup'))).toBe(false);
        expect(els['fu-kpi-conversion'].textContent).toBe('29.5 %');
        expect(els['fu-kpi-lost'].textContent).toBe('12345.68 PLN');
        expect(els['fu-kpi-first'].textContent).toBe('30.5 h');
    });

    test('4 kafelki warto\u015bci + zakres presetu w URL', async () => {
        const calls: string[] = [];
        const els = load(
            async (url: string) => {
                calls.push(url);
                if (url.includes('followups/stats')) {
                    return {
                        ok: true,
                        json: async () => ({
                            stats: {
                                wonValue: 1000.5,
                                openValue: 200,
                                totalValue: 5000.75,
                                ordersValue: 300.25
                            }
                        })
                    };
                }
                return { ok: true, json: async () => ({}) };
            },
            false,
            '30d'
        );
        await context.loadFollowUpWidget();
        expect(els['fu-kpi-won-value'].textContent).toBe('1000.50 PLN');
        expect(els['fu-kpi-open-value'].textContent).toBe('200.00 PLN');
        expect(els['fu-kpi-total-value'].textContent).toBe('5000.75 PLN');
        expect(els['fu-kpi-orders-value'].textContent).toBe('300.25 PLN');
        const statsCalls = calls.filter((u: string) => u.includes('followups/stats'));
        expect(statsCalls).toHaveLength(1);
        expect(statsCalls[0]).toContain('from=');
        expect(statsCalls[0]).toContain('to=');
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

    test('KPI używa tych samych pełnych lokalnych dni dla zakresu od–do', async () => {
        const calls: string[] = [];
        load(
            async (url: string) => {
                calls.push(url);
                return { ok: true, json: async () => ({ stats: {} }) };
            },
            false,
            'custom',
            { from: '2026-10-01', to: '2026-10-31' }
        );

        await context.loadFollowUpWidget();

        const statsUrl = new URL(
            calls.find((call) => call.includes('followups/stats'))!,
            'http://test'
        );
        const from = new Date(statsUrl.searchParams.get('from')!);
        const to = new Date(statsUrl.searchParams.get('to')!);
        expect([from.getFullYear(), from.getMonth(), from.getDate(), from.getHours()]).toEqual([
            2026, 9, 1, 0
        ]);
        expect([
            to.getFullYear(),
            to.getMonth(),
            to.getDate(),
            to.getHours(),
            to.getMinutes()
        ]).toEqual([2026, 9, 31, 23, 59]);
    });

    test('starsza odpowiedź KPI nie nadpisuje nowszego zakresu', async () => {
        const pending: Array<(response: unknown) => void> = [];
        const els = load(() => new Promise((resolve) => pending.push(resolve)));

        const firstLoad = context.loadFollowUpWidget();
        const secondLoad = context.loadFollowUpWidget();
        expect(pending).toHaveLength(2);
        pending[1]({ ok: true, json: async () => ({ stats: { wonValue: 20 } }) });
        await secondLoad;
        expect(els['fu-kpi-won-value'].textContent).toBe('20.00 PLN');

        pending[0]({ ok: true, json: async () => ({ stats: { wonValue: 10 } }) });
        await firstLoad;
        expect(els['fu-kpi-won-value'].textContent).toBe('20.00 PLN');
    });
});
