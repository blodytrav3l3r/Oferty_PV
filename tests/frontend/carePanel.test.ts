import fs from 'fs';
import path from 'path';
import vm from 'vm';

// P2: panel opieki (ESM) — badge, centrum z typami, kolejka z eskalacjami,
// słupki pilności, SLA-box tylko dla admina. Import ESM podmieniany na stub
// (harness vm nie ładuje modułów): import { escapeHtml } -> lokalna funkcja.
describe('carePanel', () => {
    const load = (opts: {
        fetchMock: (url: string, _init?: any) => any;
        role?: string;
        calls?: string[];
    }) => {
        const file = path.join(__dirname, '../../public/js/care/carePanel.js');
        let code = fs.readFileSync(file, 'utf8');
        code = code.replace(
            "import { escapeHtml } from '../shared/escapeHtml.js';",
            'const escapeHtml = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");'
        );
        // Harness vm = classic script: rozbrojenie składni ESM.
        code = code.replace(/^export\s+/gm, '');
        const els: Record<string, any> = {};
        const mkEl = (id: string) => ({
            id,
            textContent: '',
            innerHTML: '',
            value: '',
            hidden: true,
            style: {},
            dataset: {},
            className: '',
            classList: { add() {}, remove() {}, toggle() {} },
            setAttribute() {},
            appendChild(c: any) {
                (this as any).children = [...((this as any).children || []), c];
                return c;
            },
            append(...cs: any[]) {
                (this as any).children = [...((this as any).children || []), ...cs];
            },
            addEventListener(_t: string, fn: any) {
                ((this as any).handlers = (this as any).handlers || []).push(fn);
            },
            querySelector: () => null
        });
        const el = (id: string) => (els[id] = els[id] || mkEl(id));
        // Kontenery istniejące w index.html.
        for (const id of [
            'followup-panel',
            'care-badge',
            'care-notif-list',
            'care-buckets',
            'care-queue-list',
            'care-sla-box',
            'care-sla-first',
            'care-sla-stale',
            'care-sla-esc',
            'care-sla-save',
            'fu-stat-needs',
            'fu-stat-progress',
            'fu-stat-won',
            'fu-stat-lost'
        ])
            el(id);
        const listeners: Record<string, any[]> = {};
        const context: any = {
            console,
            setTimeout: (_fn: any) => 0 as unknown as NodeJS.Timeout,
            clearTimeout: () => {},
            setInterval: () => 0,
            clearInterval: () => {},
            fetch: async (url: string, init?: any) => {
                opts.calls?.push(`${init?.method || 'GET'} ${url}`);
                return opts.fetchMock(url, init);
            },
            document: {
                getElementById: (id: string) => els[id] || null,
                createElement: (tag: string) => ({ ...mkEl('dyn-' + tag), tag }),
                addEventListener: (t: string, fn: any) => {
                    listeners[t] = [...(listeners[t] || []), fn];
                },
                hidden: false
            },
            window: { currentUser: { role: opts.role ?? 'user' } }
        };
        context.window.window = context.window;
        vm.createContext(context);
        vm.runInContext(code + '\nthis.__careTest = { loadCarePanel };', context);
        return { els, listeners, context };
    };
    const okJson = (body: any) => ({ ok: true, json: async () => body });

    test('liczniki + badge + centrum z klasami typów + kolejka z eskalacją', async () => {
        const calls: string[] = [];
        const { els, context } = load({
            calls,
            fetchMock: (url: string) => {
                if (url.includes('/api/care/summary'))
                    return okJson({ noContact: 1, due: 2, openOk: 1, won: 0, lost: 0 });
                if (url.includes('/api/care/notifications'))
                    return okJson({
                        items: [
                            { id: 'n1', offerKind: 'rury', offerId: 'o1', type: 'ESCALATION' },
                            { id: 'n2', offerKind: 'rury', offerId: 'o2', type: 'CALLBACK_DUE' }
                        ],
                        unreadCount: 2
                    });
                if (url.includes('/api/care/queue'))
                    return okJson({
                        items: [
                            {
                                offerKind: 'rury',
                                offerId: 'o1',
                                status: 'DUE',
                                overdueDays: 5,
                                escalated: true,
                                paused: false
                            }
                        ]
                    });
                return okJson({});
            }
        });
        await context.__careTest.loadCarePanel();
        expect(els['fu-stat-needs'].textContent).toBe('3');
        expect(els['care-badge'].textContent).toBe('2');
        const chips = els['care-notif-list'].children;
        expect(chips).toHaveLength(2);
        expect(chips[0].className).toContain('ops-err');
        expect(chips[1].className).toContain('ops-warn');
        const rows = els['care-queue-list'].children;
        expect(rows).toHaveLength(1);
        expect(rows[0].children.map((c: any) => c.textContent || c.className)).toContain(
            'Eskalacja'
        );
        expect(els['care-sla-box'].hidden).toBe(true);
        expect(calls.filter((c) => c.includes('/api/care/')).length).toBeGreaterThanOrEqual(3);
    });

    test('SLA-box widoczny tylko dla admina + zapis PUT', async () => {
        let putBody: any = null;
        const { els, context } = load({
            role: 'admin',
            fetchMock: (url: string, init?: any) => {
                if (url.includes('/api/care/sla') && (init?.method || 'GET') === 'GET')
                    return okJson({ sla: { firstContactH: 24, staleD: 7, escalationH: 72 } });
                if (url.includes('/api/care/sla')) {
                    putBody = JSON.parse(init.body);
                    return okJson({ ok: true });
                }
                return okJson({ noContact: 0, due: 0, openOk: 0, won: 0, lost: 0 });
            }
        });
        await context.__careTest.loadCarePanel();
        expect(els['care-sla-box'].hidden).toBe(false);
        const save = els['care-sla-save'];
        for (const fn of save.handlers || []) await fn();
        expect(putBody).toEqual({ firstContactH: 24, staleD: 7, escalationH: 72 });
    });

    test('mark-read POST po kliku w chip', async () => {
        const calls: string[] = [];
        const { els, context } = load({
            calls,
            fetchMock: (url: string, _init?: any) => {
                if (url.includes('/notifications/') && url.includes('/read'))
                    return okJson({ ok: true });
                if (url.includes('/api/care/notifications'))
                    return okJson({
                        items: [{ id: 'n9', offerKind: 'rury', offerId: 'o9', type: 'SLA_BREACH' }],
                        unreadCount: 1
                    });
                return okJson({ noContact: 0, due: 0, openOk: 0, won: 0, lost: 0, items: [] });
            }
        });
        await context.__careTest.loadCarePanel();
        const chip = els['care-notif-list'].children[0];
        for (const fn of chip.handlers || []) await fn();
        expect(calls.some((c) => c.includes('/api/care/notifications/n9/read'))).toBe(true);
    });
});
