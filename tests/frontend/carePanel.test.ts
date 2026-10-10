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
        const mkEl = (id: string) => {
            const self: any = {
                id,
                textContent: '',
                innerHTML: '',
                value: '',
                hidden: true,
                style: {},
                dataset: {},
                className: '',
                classList: { add() {}, remove() {}, toggle() {} },
                setAttribute(name: string, value: string) {
                    if (name.startsWith('data-')) {
                        const key = name
                            .slice(5)
                            .replace(/-([a-z])/g, (_m, c: string) => c.toUpperCase());
                        self.dataset[key] = value;
                    }
                },
                appendChild(c: any) {
                    self.children = [...(self.children || []), c];
                    return c;
                },
                append(...cs: any[]) {
                    self.children = [...(self.children || []), ...cs];
                },
                addEventListener(_t: string, fn: any) {
                    self.handlers = [...(self.handlers || []), fn];
                },
                querySelector: (sel: string): any => {
                    for (const c of self.children || []) {
                        if (
                            sel === '[data-care-actions]' &&
                            c.dataset &&
                            'careActions' in c.dataset
                        )
                            return c;
                        const hit = c.querySelector ? c.querySelector(sel) : null;
                        if (hit) return hit;
                    }
                    return null;
                }
            };
            return self;
        };
        const el = (id: string) => (els[id] = els[id] || mkEl(id));
        // Kontenery istniejące w index.html.
        for (const id of [
            'followup-panel',
            'care-badge',
            'care-notif-list',
            'care-notif-clear',
            'care-buckets',
            'care-buckets-total',
            'care-buckets-top',
            'care-buckets-share',
            'care-queue-list',
            'care-sync-text',
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
                querySelectorAll: () => [],
                createElement: (tag: string) => {
                    const e: any = mkEl('dyn-' + tag);
                    e.tag = tag;
                    return e;
                },
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
                    return okJson({
                        noContact: 1,
                        due: 2,
                        openOk: 1,
                        won: 0,
                        lost: 1,
                        abandoned: 2
                    });
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
                                paused: false,
                                clientName: 'Budimex',
                                value: 4440.3,
                                phone: '601000111',
                                lastNote: 'Czeka',
                                nextContactAt: '2026-10-09T10:00:00.000Z'
                            }
                        ]
                    });
                return okJson({});
            }
        });
        await context.__careTest.loadCarePanel();
        expect(els['fu-stat-needs'].textContent).toBe('3');
        expect(els['fu-stat-lost'].textContent).toBe('3');
        expect(els['care-badge'].textContent).toBe('2');
        expect(els['care-sync-text'].textContent).toContain('Ostatnia synchronizacja:');
        expect(els['care-buckets-total'].textContent).toBe('Razem: 7');
        const cards = els['care-notif-list'].children;
        expect(cards).toHaveLength(2);
        expect(cards[0].className).toContain('care-notif-card');
        expect(cards[0].className).toContain('err');
        expect(cards[1].className).toContain('warn');
        const rows = els['care-queue-list'].children;
        expect(rows).toHaveLength(1);
        expect(rows[0].className).toContain('care-queue-cards');
        const texts: string[] = [];
        const walk = (n: any): void => {
            if (n.textContent) texts.push(n.textContent);
            for (const c of n.children || []) walk(c);
        };
        walk(rows[0]);
        expect(texts.join(' ')).toContain('Budimex');
        expect(texts.join(' ')).toContain('4440.30 PLN');
        expect(texts.join(' ')).toContain('Eskalacja');
        expect(texts.join(' ')).toContain('Czeka');
        expect(els['care-sla-box'].hidden).toBe(true);
        expect(calls.filter((c) => c.includes('/api/care/')).length).toBeGreaterThanOrEqual(3);
    });

    test('NO_CONTACT: jeden pill zamiast sprzecznych + klient w notyfikacji', async () => {
        const { els, context } = load({
            fetchMock: (url: string) => {
                if (url.includes('/api/care/notifications'))
                    return okJson({
                        items: [
                            {
                                id: 'n1',
                                offerKind: 'studnie',
                                offerId: 'x1',
                                type: 'CALLBACK_DUE',
                                clientName: 'Op olkan',
                                number: 'ST-7'
                            }
                        ],
                        unreadCount: 1
                    });
                if (url.includes('/api/care/queue'))
                    return okJson({
                        items: [
                            {
                                offerKind: 'rury',
                                offerId: 'o9',
                                status: 'NO_CONTACT',
                                overdueDays: 9,
                                escalated: false,
                                paused: false,
                                clientName: 'Budimex',
                                value: null,
                                phone: null,
                                lastNote: null,
                                nextContactAt: null
                            }
                        ]
                    });
                return okJson({ noContact: 1, due: 0, openOk: 0, won: 0, lost: 0 });
            }
        });
        await context.__careTest.loadCarePanel();
        const texts: string[] = [];
        const walk = (n: any): void => {
            if (n.textContent) texts.push(n.textContent);
            for (const c of n.children || []) walk(c);
        };
        walk(els['care-queue-list']);
        const joined = texts.join(' ');
        expect(joined).toContain('Brak pierwszego kontaktu');
        expect(joined).toContain('9d bez kontaktu');
        expect(joined).not.toContain('Bez terminu');
        expect(joined).not.toContain('po terminie');
        walk(els['care-notif-list']);
        const nj = texts.join(' ');
        expect(nj).toContain('Op olkan');
        expect(nj).toContain('ST-7');
        expect(nj).not.toContain('STUDNIE_OFFER');
    });

    test('snooze +3d z undo (reopen)', async () => {
        const calls: string[] = [];
        const { els, context } = load({
            calls,
            fetchMock: (url: string, _init?: any) => {
                if (url.includes('/snooze') || url.includes('/reopen')) return okJson({ ok: true });
                if (url.includes('/api/care/queue'))
                    return okJson({
                        items: [
                            {
                                offerKind: 'rury',
                                offerId: 'o1',
                                status: 'DUE',
                                overdueDays: 1,
                                escalated: false,
                                paused: false
                            }
                        ]
                    });
                return okJson({ noContact: 0, due: 1, openOk: 0, won: 0, lost: 0 });
            }
        });
        await context.__careTest.loadCarePanel();
        const row = els['care-queue-list'].children[0];
        const findBtn = (root: any, label: string): any => {
            for (const c of root.children || []) {
                if (c.textContent === label) return c;
                const hit = findBtn(c, label);
                if (hit) return hit;
            }
            return null;
        };
        const snooze = findBtn(row, 'Odłóż +3d');
        expect(snooze).not.toBeNull();
        for (const fn of snooze.handlers || []) await fn();
        expect(calls.some((c) => c.includes('/api/care/rury/o1/snooze'))).toBe(true);
        expect(findBtn(row, 'Cofnij')).not.toBeNull();
        const undo = findBtn(row, 'Cofnij');
        for (const fn of undo.handlers || []) await fn();
        expect(calls.some((c) => c.includes('/api/care/rury/o1/reopen'))).toBe(true);
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

    test('mark-read POST po kliku w kartę', async () => {
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
        const findRead = (root: any): any => {
            for (const c of root.children || []) {
                if (c.tag === 'button' && (c.textContent || '').includes('Oznacz jako')) return c;
                const hit = findRead(c);
                if (hit) return hit;
            }
            return null;
        };
        const read = findRead(els['care-notif-list']);
        expect(read).not.toBeNull();
        for (const fn of read.handlers || []) await fn();
        expect(calls.some((c) => c.includes('/api/care/notifications/n9/read'))).toBe(true);
    });

    test('Wyczyść oznacza wszystkie jako przeczytane', async () => {
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
        const clear = els['care-notif-clear'];
        expect(clear).toBeDefined();
        for (const fn of clear.handlers || []) await fn();
        expect(
            calls.filter((c) => c.includes('/api/care/notifications/n9/read')).length
        ).toBeGreaterThanOrEqual(1);
    });
});
