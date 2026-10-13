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
        timers?: number[];
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
                innerHTML: '',
                value: '',
                hidden: true,
                disabled: false,
                style: {},
                dataset: {},
                attrs: {} as Record<string, string>,
                className: '',
                classList: { add() {}, remove() {}, toggle() {} },
                setAttribute(name: string, value: string) {
                    self.attrs[name] = String(value);
                    if (name.startsWith('data-')) {
                        const key = name
                            .slice(5)
                            .replace(/-([a-z])/g, (_m, c: string) => c.toUpperCase());
                        self.dataset[key] = value;
                    }
                },
                getAttribute(name: string) {
                    return self.attrs[name] ?? null;
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
                remove() {
                    self.removed = true;
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
                },
                querySelectorAll: (sel: string): any[] => {
                    const out: any[] = [];
                    const walkQ = (n: any): void => {
                        for (const c of n.children || []) {
                            if (sel === 'button' && c.tag === 'button') out.push(c);
                            walkQ(c);
                        }
                    };
                    walkQ(self);
                    return out;
                },
                contains: (_other: any) => false
            };
            // Jak prawdziwy DOM: textContent='' czyści dzieci.
            let text = '';
            Object.defineProperty(self, 'textContent', {
                get: () => text,
                set: (v: string) => {
                    text = String(v ?? '');
                    if (text === '') self.children = [];
                }
            });
            return self;
        };
        const el = (id: string) => (els[id] = els[id] || mkEl(id));
        // Kontenery istniejące w index.html.
        for (const id of [
            'followup-panel',
            'care-rep',
            'care-notif-count',
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
            'fu-stat-lost',
            'fu-kpi-won-value',
            'fu-kpi-open-value',
            'fu-kpi-total-value',
            'fu-kpi-orders-value'
        ])
            el(id);
        const listeners: Record<string, any[]> = {};
        const context: any = {
            console,
            setTimeout: (..._a: any[]) => {
                opts.timers?.push(1);
                return 0 as unknown as NodeJS.Timeout;
            },
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
                createTextNode: (t: string) => {
                    const e: any = mkEl('dyn-text');
                    e.tag = '#text';
                    e.textContent = String(t ?? '');
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
        vm.runInContext(
            code +
                '\nthis.__careTest = { loadCarePanel, careOpenContact, setQueueSort, setQueueView, setQueueRange };',
            context
        );
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
        expect(els['care-notif-count'].textContent).toBe('2 alerty');
        expect(els['care-sync-text'].textContent).toContain('Ostatnia synchronizacja:');
        expect(els['care-buckets-total'].textContent).toBe('Razem: 7');
        const topTexts: string[] = [];
        const walkTop = (n: any): void => {
            if (n.textContent) topTexts.push(n.textContent);
            for (const c of n.children || []) walkTop(c);
        };
        walkTop(els['care-buckets-top']);
        expect(topTexts.join(' ')).toContain('Najwyższy priorytet: Do kontaktu');
        const findClass = (root: any, cls: string): any[] => {
            const out: any[] = [];
            const walk2 = (n: any): void => {
                if (n.className && String(n.className).split(' ').includes(cls)) out.push(n);
                for (const c of n.children || []) walk2(c);
            };
            walk2(root);
            return out;
        };
        // Wykres wierszowy: 5 wierszy (zera przygaszone klasą is-zero).
        expect(findClass(els['care-buckets'], 'care-chart')).toHaveLength(1);
        expect(findClass(els['care-buckets'], 'care-chart-row')).toHaveLength(5);
        expect(findClass(els['care-buckets'], 'care-chart-fill')).toHaveLength(5);
        expect(findClass(els['care-buckets'], 'care-chart-dot')).toHaveLength(5);
        // Pasek proporcji całości (flex:N, tylko niezerowe).
        const bars = findClass(els['care-buckets'], 'care-bar');
        expect(bars).toHaveLength(1);
        const grid = els['care-notif-list'].children;
        expect(grid).toHaveLength(1);
        expect(grid[0].className).toContain('care-notif-grid');
        const cards = grid[0].children;
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
        expect(texts.join(' ')).toContain('440,30');
        expect(texts.join(' ')).toContain('PLN');
        expect(texts.join(' ')).toContain('Eskalacja');
        expect(texts.join(' ')).toContain('Czeka');
        // Pill rodzaju + numer oferty w nagłówku karty.
        const pills: string[] = [];
        const collectPills = (n: any): void => {
            if (n.className && String(n.className).split(' ').includes('ops-pill') && n.textContent)
                pills.push(n.textContent);
            for (const c of n.children || []) collectPills(c);
        };
        collectPills(rows[0]);
        expect(pills).toContain('rury');
        // P4: SLA-box dla każdej roli (user edytuje własne progi).
        expect(els['care-sla-box'].hidden).toBe(false);
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

    test('filtry z licznikami + ost. kontakt + Kontakt zapisuje handoff', async () => {
        const store: Record<string, string> = {};
        const { els, context } = load({
            fetchMock: (url: string) => {
                if (url.includes('/api/care/queue'))
                    return okJson({
                        items: [
                            {
                                offerKind: 'rury',
                                offerId: 'o1',
                                status: 'DUE',
                                overdueDays: 2,
                                escalated: false,
                                paused: false,
                                slaBucket: 'OVERDUE_D1',
                                clientName: 'A',
                                value: null,
                                phone: null,
                                lastNote: null,
                                lastContactAt: '2026-10-08T10:00:00.000Z',
                                nextContactAt: '2026-10-09T10:00:00.000Z'
                            }
                        ]
                    });
                return okJson({ noContact: 0, due: 1, openOk: 0, won: 0, lost: 0 });
            }
        });
        context.sessionStorage = {
            getItem: (k: string) => store[k] ?? null,
            setItem: (k: string, v: string) => {
                store[k] = String(v);
            },
            removeItem: (k: string) => {
                delete store[k];
            }
        };
        context.window.location = { href: '' };
        await context.__careTest.loadCarePanel();
        // Wiersz pokazuje ost. kontakt.
        const texts: string[] = [];
        const walk = (n: any): void => {
            if (n.textContent) texts.push(n.textContent);
            for (const c of n.children || []) walk(c);
        };
        walk(els['care-queue-list']);
        expect(texts.join(' ')).toContain('ost. kontakt:');
        // careOpenContact zapisuje handoff (Konsument: kartotekaInit).
        await context.__careTest.careOpenContact('studnie', 's1');
        expect(JSON.parse(store['care-open-followup'])).toEqual(
            expect.objectContaining({ id: 's1', displayType: 'studnia_oferta' })
        );
        expect(context.window.location.href).toBe('app.html#/kartoteka?kontakt=studnie%3As1');
    });

    test('jeden pill statusu: pauza wygrywa z eskalacją', async () => {
        const { els, context } = load({
            fetchMock: (url: string) => {
                if (url.includes('/api/care/queue'))
                    return okJson({
                        items: [
                            {
                                offerKind: 'rury',
                                offerId: 'o1',
                                status: 'DUE',
                                overdueDays: 9,
                                escalated: true,
                                paused: true,
                                doneAt: null,
                                snoozedUntil: '2026-10-20T00:00:00.000Z'
                            }
                        ]
                    });
                return okJson({ noContact: 0, due: 0, openOk: 0, won: 0, lost: 0 });
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
        expect(joined).toContain('Odłożone');
        expect(joined).not.toContain('Eskalacja');
        expect(joined).not.toContain('po terminie');
    });

    test('menu ⋮: otwiera, Done woła API, Escape zamyka', async () => {
        const calls: string[] = [];
        const { els, context, listeners } = load({
            calls,
            fetchMock: (url: string, _init?: any) => {
                if (url.includes('/api/care/queue'))
                    return okJson({
                        items: [
                            {
                                offerKind: 'rury',
                                offerId: 'o1',
                                status: 'DUE',
                                overdueDays: 2,
                                escalated: false,
                                paused: false
                            }
                        ]
                    });
                return okJson({ noContact: 0, due: 1, openOk: 0, won: 0, lost: 0 });
            }
        });
        await context.__careTest.loadCarePanel();
        const findAll = (root: any, pred: (n: any) => boolean, out: any[] = []): any[] => {
            for (const c of root.children || []) {
                if (c.removed) continue;
                if (pred(c)) out.push(c);
                findAll(c, pred, out);
            }
            return out;
        };
        const menus = findAll(
            els['care-queue-list'],
            (n) => n.textContent === '⋮' && (n.handlers || []).length > 0
        );
        expect(menus).toHaveLength(1);
        for (const fn of menus[0].handlers || []) await fn();
        const items = findAll(els['care-queue-list'], (n) =>
            (n.textContent || '').includes('Oznacz jako done')
        );
        expect(items).toHaveLength(1);
        for (const fn of items[0].handlers || []) await fn();
        expect(calls.some((c) => c.includes('/api/care/rury/o1/done'))).toBe(true);
        // Escape zamyka otwarte menu.
        await context.__careTest.loadCarePanel();
        const menus2 = findAll(
            els['care-queue-list'],
            (n) => n.textContent === '⋮' && (n.handlers || []).length > 0
        );
        for (const fn of menus2[0].handlers || []) await fn();
        for (const fn of listeners['keydown'] || []) await fn({ key: 'Escape' });
        expect(
            findAll(els['care-queue-list'], (n) =>
                (n.textContent || '').includes('Oznacz jako done')
            )
        ).toHaveLength(0);
    });

    test('licznik zadań w nagłówku + box info w karcie', async () => {
        const { els, context } = load({
            fetchMock: (url: string) => {
                if (url.includes('/api/care/summary'))
                    return okJson({
                        noContact: 2,
                        due: 3,
                        openOk: 0,
                        won: 0,
                        lost: 0,
                        totalCount: 5
                    });
                if (url.includes('/api/care/queue'))
                    return okJson({
                        items: [
                            {
                                offerKind: 'rury',
                                offerId: 'o1',
                                status: 'DUE',
                                overdueDays: 1,
                                escalated: false,
                                paused: false,
                                lastNote: 'Notka'
                            }
                        ]
                    });
                return okJson({ items: [], unreadCount: 0 });
            }
        });
        // Nagłówek sekcji wymaga kontenera licznika.
        els['care-task-count'] = {
            textContent: '',
            children: [],
            dataset: {},
            classList: { add() {}, remove() {}, toggle() {} },
            setAttribute() {},
            appendChild(c: any) {
                return c;
            },
            append() {},
            addEventListener() {},
            querySelector: () => null
        };
        await context.__careTest.loadCarePanel();
        expect(els['care-task-count'].textContent).toBe('5 zadań');
        const findClass = (root: any, cls: string): any[] => {
            const out: any[] = [];
            const walk2 = (n: any): void => {
                if (n.className && String(n.className).split(' ').includes(cls)) out.push(n);
                for (const c of n.children || []) walk2(c);
            };
            walk2(root);
            return out;
        };
        expect(findClass(els['care-queue-list'], 'care-queue-info')).toHaveLength(1);
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

    test('SLA-box admina + zapis PUT globalny', async () => {
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

    test('SLA PUT niesie expectedUpdatedAt, 409 odświeża wartości', async () => {
        let putBody: any = null;
        let gets = 0;
        const { els, context } = load({
            role: 'admin',
            fetchMock: (url: string, init?: any) => {
                if (url.includes('/api/care/sla') && (init?.method || 'GET') === 'GET') {
                    gets += 1;
                    return okJson({
                        sla: { firstContactH: 24, staleD: 7, escalationH: 72 },
                        slaUpdatedAt: '2026-10-12T10:00:00.000Z'
                    });
                }
                if (url.includes('/api/care/sla')) {
                    putBody = JSON.parse(init.body);
                    return { ok: false, status: 409, json: async () => ({ ok: false }) };
                }
                return okJson({ noContact: 0, due: 0, openOk: 0, won: 0, lost: 0 });
            }
        });
        await context.__careTest.loadCarePanel();
        const save = els['care-sla-save'];
        for (const fn of save.handlers || []) await fn();
        expect(putBody).toEqual({
            firstContactH: 24,
            staleD: 7,
            escalationH: 72,
            expectedUpdatedAt: '2026-10-12T10:00:00.000Z'
        });
        expect(String(save.textContent)).toContain('Konflikt');
        expect(gets).toBeGreaterThanOrEqual(2);
    });

    test('SLA: śmieci nie lecą PUT (walidacja klienta)', async () => {
        let puts = 0;
        const { els, context } = load({
            role: 'admin',
            fetchMock: (url: string, init?: any) => {
                if (url.includes('/api/care/sla') && (init?.method || 'GET') === 'GET')
                    return okJson({ sla: { firstContactH: 24, staleD: 7, escalationH: 72 } });
                if (url.includes('/api/care/sla')) {
                    puts += 1;
                    return okJson({ ok: true });
                }
                return okJson({ noContact: 0, due: 0, openOk: 0, won: 0, lost: 0 });
            }
        });
        await context.__careTest.loadCarePanel();
        els['care-sla-first'].value = 'abc';
        const save = els['care-sla-save'];
        for (const fn of save.handlers || []) await fn();
        expect(puts).toBe(0);
        expect(String(save.textContent)).toContain('Nieprawidłowe');
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

    test('Wyczyść: jeden bulk POST zamiast N pojedynczych', async () => {
        const calls: string[] = [];
        const posts: Array<{ url: string; body: string }> = [];
        const { els, context } = load({
            calls,
            fetchMock: (url: string, init?: any) => {
                if (url.endsWith('/api/care/notifications/read')) {
                    posts.push({ url, body: String(init?.body ?? '') });
                    return okJson({ ok: true, read: 1 });
                }
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
        expect(posts).toHaveLength(1);
        expect(JSON.parse(posts[0].body)).toEqual({ ids: ['n9'] });
        expect(calls.some((c) => c.includes('/api/care/notifications/n9/read'))).toBe(false);
    });

    test('Wyczyść fallback: bulk fail → pojedyncze odczyty', async () => {
        const calls: string[] = [];
        const { els, context } = load({
            calls,
            fetchMock: (url: string, _init?: any) => {
                if (url.endsWith('/api/care/notifications/read'))
                    return { ok: false, json: async () => ({}) };
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
        for (const fn of clear.handlers || []) await fn();
        expect(
            calls.filter((c) => c.includes('/api/care/notifications/n9/read')).length
        ).toBeGreaterThanOrEqual(1);
    });

    test('mark-read fail: brak udawanego przeładowania', async () => {
        const calls: string[] = [];
        const { els, context } = load({
            calls,
            fetchMock: (url: string, _init?: any) => {
                if (url.includes('/notifications/') && url.includes('/read'))
                    return { ok: false, json: async () => ({}) };
                if (url.includes('/api/care/notifications'))
                    return okJson({
                        items: [{ id: 'n9', offerKind: 'rury', offerId: 'o9', type: 'SLA_BREACH' }],
                        unreadCount: 1
                    });
                return okJson({ noContact: 0, due: 0, openOk: 0, won: 0, lost: 0, items: [] });
            }
        });
        await context.__careTest.loadCarePanel();
        const before = calls.filter((c) => c.includes('/api/care/panel')).length;
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
        expect(calls.filter((c) => c.includes('/api/care/panel')).length).toBe(before);
    });

    test('Wyczyść total fail: brak udawanego przeładowania', async () => {
        const calls: string[] = [];
        const { els, context } = load({
            calls,
            fetchMock: (url: string, _init?: any) => {
                if (url.includes('/read')) return { ok: false, json: async () => ({}) };
                if (url.includes('/api/care/notifications'))
                    return okJson({
                        items: [{ id: 'n9', offerKind: 'rury', offerId: 'o9', type: 'SLA_BREACH' }],
                        unreadCount: 1
                    });
                return okJson({ noContact: 0, due: 0, openOk: 0, won: 0, lost: 0, items: [] });
            }
        });
        await context.__careTest.loadCarePanel();
        const before = calls.filter((c) => c.includes('/api/care/panel')).length;
        const clear = els['care-notif-clear'];
        for (const fn of clear.handlers || []) await fn();
        expect(calls.filter((c) => c.includes('/api/care/panel')).length).toBe(before);
    });

    test('postCare niesie expectedUpdatedAt (opt-lock)', async () => {
        const posts: Array<{ url: string; body: string }> = [];
        const { els, context } = load({
            fetchMock: (url: string, init?: any) => {
                if (url.includes('/api/care/rury/o1/done')) {
                    posts.push({ url, body: String(init?.body ?? '') });
                    return okJson({ ok: true, state: null });
                }
                if (url.includes('/api/care/queue'))
                    return okJson({
                        items: [
                            {
                                offerKind: 'rury',
                                offerId: 'o1',
                                status: 'DUE',
                                overdueDays: 2,
                                escalated: false,
                                paused: false,
                                careUpdatedAt: '2026-10-09T00:00:00.000Z'
                            }
                        ]
                    });
                return okJson({ noContact: 0, due: 1, openOk: 0, won: 0, lost: 0 });
            }
        });
        await context.__careTest.loadCarePanel();
        const findAll = (root: any, pred: (n: any) => boolean, out: any[] = []): any[] => {
            for (const c of root.children || []) {
                if (c.removed) continue;
                if (pred(c)) out.push(c);
                findAll(c, pred, out);
            }
            return out;
        };
        const menus = findAll(
            els['care-queue-list'],
            (n) => n.textContent === '⋮' && (n.handlers || []).length > 0
        );
        expect(menus).toHaveLength(1);
        for (const fn of menus[0].handlers || []) await fn();
        const items = findAll(els['care-queue-list'], (n) =>
            (n.textContent || '').includes('Oznacz jako done')
        );
        expect(items).toHaveLength(1);
        for (const fn of items[0].handlers || []) await fn();
        expect(posts).toHaveLength(1);
        expect(JSON.parse(posts[0].body)).toEqual({
            expectedUpdatedAt: '2026-10-09T00:00:00.000Z'
        });
    });

    test('postCare fail: brak udawanego przeładowania', async () => {
        const calls: string[] = [];
        const { els, context } = load({
            calls,
            fetchMock: (url: string, _init?: any) => {
                if (url.includes('/api/care/rury/o1/done'))
                    return { ok: false, json: async () => ({}) };
                if (url.includes('/api/care/queue'))
                    return okJson({
                        items: [
                            {
                                offerKind: 'rury',
                                offerId: 'o1',
                                status: 'DUE',
                                overdueDays: 2,
                                escalated: false,
                                paused: false
                            }
                        ]
                    });
                return okJson({ noContact: 0, due: 1, openOk: 0, won: 0, lost: 0 });
            }
        });
        await context.__careTest.loadCarePanel();
        const before = calls.filter((c) => c.includes('/api/care/panel')).length;
        const findAll = (root: any, pred: (n: any) => boolean, out: any[] = []): any[] => {
            for (const c of root.children || []) {
                if (c.removed) continue;
                if (pred(c)) out.push(c);
                findAll(c, pred, out);
            }
            return out;
        };
        const menus = findAll(
            els['care-queue-list'],
            (n) => n.textContent === '⋮' && (n.handlers || []).length > 0
        );
        expect(menus).toHaveLength(1);
        for (const fn of menus[0].handlers || []) await fn();
        const items = findAll(els['care-queue-list'], (n) =>
            (n.textContent || '').includes('Oznacz jako done')
        );
        expect(items).toHaveLength(1);
        for (const fn of items[0].handlers || []) await fn();
        expect(calls.some((c) => c.includes('/api/care/rury/o1/done'))).toBe(true);
        expect(calls.filter((c) => c.includes('/api/care/panel')).length).toBe(before);
    });

    test('panel: pakiet w 1 requescie, 304 bez renderu', async () => {
        const calls: string[] = [];
        const seenHeaders: Array<unknown> = [];
        const packet = {
            ok: true,
            etag: '"etag-1"',
            summary: {
                noContact: 1,
                due: 1,
                openOk: 0,
                won: 0,
                lost: 0,
                abandoned: 0,
                totalCount: 2
            },
            queue: { items: [], nextCursor: null, totalCount: 2 },
            notifications: { items: [], unreadCount: 0, sync: { inserted: 0, resolved: 0 } },
            sla: { firstContactH: 24, staleD: 7, escalationH: 72 }
        };
        const { els, context } = load({
            calls,
            fetchMock: (url: string, init?: any) => {
                if (url.includes('/api/care/panel')) {
                    seenHeaders.push(init?.headers);
                    if (init?.headers?.['If-None-Match'] === '"etag-1"')
                        return { ok: false, status: 304, json: async () => ({}) };
                    return { ok: true, status: 200, json: async () => packet };
                }
                return okJson({ noContact: 0, due: 0, openOk: 0, won: 0, lost: 0 });
            }
        });
        els['care-task-count'] = {
            textContent: '',
            children: [],
            dataset: {},
            classList: { add() {}, remove() {}, toggle() {} },
            setAttribute() {},
            appendChild(c: any) {
                return c;
            },
            append() {},
            addEventListener() {},
            querySelector: () => null
        };
        const first = await context.__careTest.loadCarePanel();
        expect(first).toBe(true);
        expect(els['care-task-count'].textContent).toBe('2 zadań');
        expect(els['care-buckets-total'].textContent).toBe('Razem: 2');
        const second = await context.__careTest.loadCarePanel();
        expect(second).toBe(false);
        expect(seenHeaders).toHaveLength(2);
        expect(seenHeaders[1]).toEqual({ 'If-None-Match': '"etag-1"' });
        expect(calls.filter((c) => c.includes('/api/care/panel'))).toHaveLength(2);
        expect(calls.some((c) => c.includes('/api/care/summary'))).toBe(false);
    });

    test('sort: wartość malejąco, klient A-Z', async () => {
        const packet = (items: any[]) => ({
            ok: true,
            etag: '"e1"',
            summary: {
                noContact: 0,
                due: 2,
                openOk: 0,
                won: 0,
                lost: 0,
                abandoned: 0,
                totalCount: 2
            },
            queue: { items, nextCursor: null, totalCount: 2 },
            notifications: { items: [], unreadCount: 0 },
            sla: { firstContactH: 24, staleD: 7, escalationH: 72 }
        });
        const mkItem = (offerId: string, clientName: string, value: number) => ({
            offerKind: 'rury',
            offerId,
            status: 'DUE',
            overdueDays: 0,
            clientName,
            value
        });
        const namesOf = (root: any): string[] => {
            const out: string[] = [];
            const walk2 = (n: any): void => {
                if (
                    n.className &&
                    String(n.className).split(' ').includes('care-queue-name') &&
                    n.textContent
                )
                    out.push(n.textContent);
                for (const c of n.children || []) walk2(c);
            };
            walk2(root);
            return out;
        };
        const mkLoad = () =>
            load({
                fetchMock: (url: string) => {
                    if (url.includes('/api/care/panel'))
                        return {
                            ok: true,
                            status: 200,
                            json: async () =>
                                packet([mkItem('o1', 'Zetka', 100), mkItem('o2', 'Ala', 5000)])
                        };
                    return okJson({ noContact: 0, due: 0, openOk: 0, won: 0, lost: 0 });
                }
            });
        const t1 = mkLoad();
        t1.context.__careTest.setQueueSort('value');
        await t1.context.__careTest.loadCarePanel();
        expect(namesOf(t1.els['care-queue-list'])).toEqual(['Ala', 'Zetka']);
        const t2 = mkLoad();
        t2.context.__careTest.setQueueSort('client');
        await t2.context.__careTest.loadCarePanel();
        expect(namesOf(t2.els['care-queue-list'])).toEqual(['Ala', 'Zetka']);
        const t3 = mkLoad();
        t3.context.__careTest.setQueueSort('sla');
        await t3.context.__careTest.loadCarePanel();
        expect(namesOf(t3.els['care-queue-list'])).toEqual(['Zetka', 'Ala']);
    });

    test('SLA zakresy: admin ma 3 opcje, zapis niesie scopeType', async () => {
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
        const children: any[] = [];
        els['care-sla-scope'] = {
            textContent: '',
            value: 'team',
            children,
            dataset: {},
            classList: { add() {}, remove() {}, toggle() {} },
            setAttribute() {},
            appendChild(c: any) {
                children.push(c);
                return c;
            },
            append(...cs: any[]) {
                children.push(...cs);
            },
            addEventListener() {},
            querySelector: () => null
        };
        await context.__careTest.loadCarePanel();
        expect(children).toHaveLength(3);
        const save = els['care-sla-save'];
        for (const fn of save.handlers || []) await fn();
        expect(putBody).toEqual(expect.objectContaining({ firstContactH: 24, scopeType: 'team' }));
    });

    test('cena: grupowanie pl-PL + 2 miejsca po przecinku', async () => {
        const { els, context } = load({
            fetchMock: (url: string) => {
                if (url.includes('/api/care/panel'))
                    return {
                        ok: true,
                        status: 200,
                        json: async () => ({
                            ok: true,
                            summary: {
                                noContact: 0,
                                due: 1,
                                openOk: 0,
                                won: 0,
                                lost: 0,
                                abandoned: 0,
                                totalCount: 1
                            },
                            queue: {
                                items: [
                                    {
                                        offerKind: 'rury',
                                        offerId: 'o1',
                                        status: 'DUE',
                                        overdueDays: 0,
                                        clientName: 'A',
                                        value: 1234567.895
                                    }
                                ],
                                nextCursor: null,
                                totalCount: 1
                            },
                            notifications: { items: [], unreadCount: 0 },
                            sla: { firstContactH: 24, staleD: 7, escalationH: 72 }
                        })
                    };
                return okJson({ noContact: 0, due: 0, openOk: 0, won: 0, lost: 0 });
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
        // Grupowanie spacją (nbsp) + przecinek dziesiętny, PLN osobno.
        expect(joined).toMatch(/1.234.567,90/);
        expect(joined).toContain('PLN');
    });

    test('preset zakresu: from/to w URL panelu, All bez parametr\u00f3w', async () => {
        const calls: string[] = [];
        const packet = {
            ok: true,
            etag: '"e7"',
            summary: {
                noContact: 0,
                due: 1,
                openOk: 0,
                won: 0,
                lost: 0,
                abandoned: 0,
                totalCount: 1
            },
            queue: { items: [], nextCursor: null, totalCount: 1 },
            notifications: { items: [], unreadCount: 0, sync: { inserted: 0, resolved: 0 } },
            sla: { firstContactH: 24, staleD: 7, escalationH: 72 }
        };
        const { context } = load({
            calls,
            fetchMock: (url: string) => {
                if (url.includes('/api/care/panel'))
                    return { ok: true, status: 200, json: async () => packet };
                return okJson({ noContact: 0, due: 1, openOk: 0, won: 0, lost: 0 });
            }
        });
        expect(context.__careTest.setQueueRange('7d')).toBe('7d');
        expect(context.__careTest.setQueueRange('xx')).toBe('all');
        context.__careTest.setQueueRange('30d');
        await context.__careTest.loadCarePanel();
        const panelCalls = calls.filter((c) => c.includes('/api/care/panel'));
        expect(panelCalls).toHaveLength(1);
        expect(panelCalls[0]).toContain('from=');
        expect(panelCalls[0]).toContain('to=');
        context.__careTest.setQueueRange('all');
        await context.__careTest.loadCarePanel();
        const panelCalls2 = calls.filter((c) => c.includes('/api/care/panel'));
        expect(panelCalls2).toHaveLength(2);
        expect(panelCalls2[1]).not.toContain('from=');
    });

    test('ETag osobny na zakres: zmiana presetu nie wysy\u0142a cudzego If-None-Match', async () => {
        const calls: string[] = [];
        const seenHeaders: Array<unknown> = [];
        const { context } = load({
            calls,
            fetchMock: (url: string, init?: any) => {
                if (url.includes('/api/care/panel')) {
                    seenHeaders.push(init?.headers);
                    if (init?.headers?.['If-None-Match'] === '"e7"')
                        return { ok: false, status: 304, json: async () => ({}) };
                    return {
                        ok: true,
                        status: 200,
                        json: async () => ({
                            ok: true,
                            etag: '"e7"',
                            summary: {
                                noContact: 0,
                                due: 1,
                                openOk: 0,
                                won: 0,
                                lost: 0,
                                abandoned: 0,
                                totalCount: 1
                            },
                            queue: { items: [], nextCursor: null, totalCount: 1 },
                            notifications: { items: [], unreadCount: 0 },
                            sla: { firstContactH: 24, staleD: 7, escalationH: 72 }
                        })
                    };
                }
                return okJson({ noContact: 0, due: 1, openOk: 0, won: 0, lost: 0 });
            }
        });
        context.__careTest.setQueueRange('7d');
        await context.__careTest.loadCarePanel();
        await context.__careTest.loadCarePanel();
        expect(seenHeaders[1]).toEqual({ 'If-None-Match': '"e7"' });
        context.__careTest.setQueueRange('90d');
        await context.__careTest.loadCarePanel();
        expect(seenHeaders[2]).toEqual({});
        expect(calls.filter((c) => c.includes('/api/care/panel'))).toHaveLength(3);
    });

    test('legacy fallback niesie from/to w summary i queue (nie w notif)', async () => {
        const calls: string[] = [];
        const { context } = load({
            calls,
            fetchMock: (url: string) => {
                if (url.includes('/api/care/panel')) return { ok: false, status: 500 };
                if (url.includes('/api/care/summary'))
                    return okJson({ noContact: 0, due: 1, openOk: 0, won: 0, lost: 0 });
                if (url.includes('/api/care/queue')) return okJson({ items: [] });
                return okJson({ items: [], unreadCount: 0 });
            }
        });
        context.__careTest.setQueueRange('30d');
        await context.__careTest.loadCarePanel();
        const summary = calls.filter((c) => c.includes('/api/care/summary'));
        const queue = calls.filter((c) => c.includes('/api/care/queue'));
        const notif = calls.filter((c) => c.includes('/api/care/notifications'));
        expect(summary).toHaveLength(1);
        expect(queue).toHaveLength(1);
        expect(notif).toHaveLength(1);
        for (const u of [...summary, ...queue]) {
            expect(u).toContain('from=');
            expect(u).toContain('to=');
        }
        // Skrzynka powiadomień = stan bieżący, bez filtra dat.
        for (const u of [...notif]) {
            expect(u).not.toContain('from=');
        }
    });

    test('widok grid/list + dopaginowanie cursorem', async () => {
        const mkItem = (offerId: string, clientName: string) => ({
            offerKind: 'rury',
            offerId,
            status: 'DUE',
            overdueDays: 0,
            clientName,
            value: 10
        });
        const { els, context } = load({
            fetchMock: (url: string) => {
                if (url.includes('/api/care/panel'))
                    return {
                        ok: true,
                        status: 200,
                        json: async () => ({
                            ok: true,
                            etag: '"e2"',
                            summary: {
                                noContact: 0,
                                due: 1,
                                openOk: 0,
                                won: 0,
                                lost: 0,
                                abandoned: 0,
                                totalCount: 3
                            },
                            queue: { items: [mkItem('o1', 'A1')], nextCursor: 'c1', totalCount: 3 },
                            notifications: { items: [], unreadCount: 0 },
                            sla: { firstContactH: 24, staleD: 7, escalationH: 72 }
                        })
                    };
                if (url.includes('/api/care/queue') && url.includes('cursor=c1'))
                    return okJson({
                        items: [mkItem('o2', 'A2')],
                        nextCursor: null,
                        totalCount: 3
                    });
                return okJson({ noContact: 0, due: 0, openOk: 0, won: 0, lost: 0 });
            }
        });
        context.__careTest.setQueueView('grid');
        await context.__careTest.loadCarePanel();
        const findClass = (root: any, cls: string): any[] => {
            const out: any[] = [];
            const walk2 = (n: any): void => {
                if (n.className && String(n.className).split(' ').includes(cls)) out.push(n);
                for (const c of n.children || []) walk2(c);
            };
            walk2(root);
            return out;
        };
        expect(findClass(els['care-queue-list'], 'is-grid')).toHaveLength(1);
        const findMore = (root: any): any => {
            for (const c of root.children || []) {
                if ((c.textContent || '').startsWith('Pokaż więcej')) return c;
                const hit = findMore(c);
                if (hit) return hit;
            }
            return null;
        };
        const more = findMore(els['care-queue-list']);
        expect(more).not.toBeNull();
        for (const fn of more.handlers || []) await fn();
        const texts: string[] = [];
        const walk = (n: any): void => {
            if (n.textContent) texts.push(n.textContent);
            for (const c of n.children || []) walk(c);
        };
        walk(els['care-queue-list']);
        expect(texts.join(' ')).toContain('A1');
        expect(texts.join(' ')).toContain('A2');
        expect(findMore(els['care-queue-list'])).toBeNull();
    });

    test('martwy polling: start nawet po nieudanym pierwszym loadzie', async () => {
        const timers: number[] = [];
        const { listeners } = load({
            timers,
            fetchMock: () => {
                throw new Error('sieć padła');
            }
        });
        for (const fn of listeners['DOMContentLoaded'] || []) fn();
        for (let i = 0; i < 10; i++) await new Promise((r) => setTimeout(r, 0));
        expect(timers.length).toBeGreaterThanOrEqual(1);
    });

    test('sok:user-ready doczytuje select handlowca (wyscig sesji)', async () => {
        const calls: string[] = [];
        const { context, listeners } = load({
            calls,
            fetchMock: (url: string) => {
                if (url.includes('/api/users-for-assignment'))
                    return okJson({
                        data: [{ id: 'h1', username: 'handlowiec', role: 'user' }]
                    });
                if (url.includes('/api/care/panel'))
                    return {
                        ok: true,
                        status: 200,
                        json: async () => ({
                            ok: true,
                            summary: {
                                noContact: 0,
                                due: 0,
                                openOk: 0,
                                won: 0,
                                lost: 0,
                                abandoned: 0,
                                totalCount: 0
                            },
                            queue: { items: [], nextCursor: null, totalCount: 0 },
                            notifications: { items: [], unreadCount: 0 },
                            sla: { firstContactH: 24, staleD: 7, escalationH: 72 }
                        })
                    };
                return okJson({ noContact: 0, due: 0, openOk: 0, won: 0, lost: 0 });
            }
        });
        // Start z pusta rola (init przed /api/auth/me): brak strzalu po handlowcow.
        await context.__careTest.loadCarePanel();
        expect(calls.filter((c) => c.includes('/api/users-for-assignment'))).toHaveLength(0);
        // Rola wpada pozniej (dashboard.js: sok:user-ready) — select dociagany.
        context.window.currentUser = { role: 'admin', id: 'a1' };
        for (const fn of listeners['sok:user-ready'] || []) fn();
        for (let i = 0; i < 10; i++) await new Promise((r) => setTimeout(r, 0));
        expect(
            calls.filter((c) => c.includes('/api/users-for-assignment')).length
        ).toBeGreaterThanOrEqual(1);
    });

    test('visibilitychange: powrót na kartę odświeża panel', async () => {
        const calls: string[] = [];
        const { context, listeners } = load({
            calls,
            fetchMock: (url: string) => {
                if (url.includes('/api/care/notifications'))
                    return okJson({ items: [], unreadCount: 0 });
                if (url.includes('/api/care/queue')) return okJson({ items: [] });
                return okJson({ noContact: 0, due: 0, openOk: 0, won: 0, lost: 0 });
            }
        });
        await context.__careTest.loadCarePanel();
        const before = calls.filter((c) => c.includes('/api/care/summary')).length;
        expect(before).toBeGreaterThanOrEqual(1);
        for (const fn of listeners['visibilitychange'] || []) fn();
        for (let i = 0; i < 10; i++) await new Promise((r) => setTimeout(r, 0));
        expect(calls.filter((c) => c.includes('/api/care/summary')).length).toBeGreaterThan(before);
    });

    test('wybór cudzego repa poszerza zakres (mine + rep = pusto)', async () => {
        const calls: string[] = [];
        const { els, context } = load({
            role: 'admin',
            calls,
            fetchMock: (url: string) => {
                if (url.includes('/api/users-for-assignment'))
                    return okJson({
                        data: [{ id: 'h1', username: 'adam', role: 'user' }]
                    });
                if (url.includes('/api/care/panel')) {
                    const foreign = url.includes('repId=h1');
                    return {
                        ok: true,
                        status: 200,
                        json: async () => ({
                            ok: true,
                            summary: {
                                noContact: 0,
                                due: 0,
                                openOk: 0,
                                won: 0,
                                lost: 0,
                                abandoned: 0,
                                totalCount: 0
                            },
                            queue: { items: [], nextCursor: null, totalCount: 0 },
                            notifications: {
                                items: foreign
                                    ? [
                                          {
                                              id: 'n1',
                                              offerKind: 'rury',
                                              offerId: 'o1',
                                              type: 'SLA_BREACH',
                                              clientName: 'Budimex'
                                          }
                                      ]
                                    : [],
                                unreadCount: foreign ? 1 : 0,
                                mailboxUserId: foreign ? 'h1' : 'a1'
                            },
                            sla: { firstContactH: 24, staleD: 7, escalationH: 72 }
                        })
                    };
                }
                return okJson({ noContact: 0, due: 0, openOk: 0, won: 0, lost: 0 });
            }
        });
        context.window.currentUser = { role: 'admin', id: 'a1' };
        await context.__careTest.loadCarePanel();
        for (let i = 0; i < 10; i++) await new Promise((r) => setTimeout(r, 0));
        const sel = els['care-rep'];
        // Pierwszy fetch: scope=mine bez repa.
        expect(calls.some((c) => c.includes('/api/care/panel?scope=mine'))).toBe(true);
        // Wybór cudzego handlowca: zakres sam przechodzi na all.
        sel.value = 'h1';
        for (const fn of sel.handlers || []) await fn();
        for (let i = 0; i < 10; i++) await new Promise((r) => setTimeout(r, 0));
        expect(calls.some((c) => c.includes('/api/care/panel?scope=all&repId=h1'))).toBe(true);
        // Centrum prze-renderowane: banner cudzej skrzynki (read-only, bez akcji zapisu).
        const notifList = els['care-notif-list'];
        const banner = (notifList.children || []).find(
            (c: any) => c.className === 'care-notif-preview'
        );
        expect(banner).toBeDefined();
        expect(String(banner.textContent)).toContain('h1');
        expect(String(banner.textContent)).toContain('Skrzynka:');
        expect(String(banner.textContent)).toContain('read-only');
        const texts: string[] = [];
        const walk = (n: any): void => {
            if (n.textContent) texts.push(n.textContent);
            for (const c of n.children || []) walk(c);
        };
        walk(notifList);
        const joined = texts.join(' ');
        expect(joined).toContain('Budimex');
        expect(joined).not.toContain('Oznacz jako przeczytane');
        expect(els['care-notif-clear'].hidden).toBe(true);
    });

    test('podgląd własnej skrzynki (rep = self): akcje zapisu widoczne', async () => {
        const { els, context } = load({
            role: 'admin',
            fetchMock: (url: string) => {
                if (url.includes('/api/users-for-assignment'))
                    return okJson({
                        data: [
                            { id: 'a1', username: 'szef', role: 'admin' },
                            { id: 'h1', username: 'adam', role: 'user' }
                        ]
                    });
                if (url.includes('/api/care/panel'))
                    return {
                        ok: true,
                        status: 200,
                        json: async () => ({
                            ok: true,
                            summary: {
                                noContact: 0,
                                due: 0,
                                openOk: 0,
                                won: 0,
                                lost: 0,
                                abandoned: 0,
                                totalCount: 0
                            },
                            queue: { items: [], nextCursor: null, totalCount: 0 },
                            notifications: {
                                items: [
                                    {
                                        id: 'n1',
                                        offerKind: 'rury',
                                        offerId: 'o1',
                                        type: 'SLA_BREACH'
                                    }
                                ],
                                unreadCount: 1,
                                mailboxUserId: 'a1'
                            },
                            sla: { firstContactH: 24, staleD: 7, escalationH: 72 }
                        })
                    };
                return okJson({ noContact: 0, due: 0, openOk: 0, won: 0, lost: 0 });
            }
        });
        context.window.currentUser = { role: 'admin', id: 'a1' };
        await context.__careTest.loadCarePanel();
        for (let i = 0; i < 10; i++) await new Promise((r) => setTimeout(r, 0));
        const sel = els['care-rep'];
        sel.value = 'a1';
        for (const fn of sel.handlers || []) await fn();
        for (let i = 0; i < 10; i++) await new Promise((r) => setTimeout(r, 0));
        const texts: string[] = [];
        const walk = (n: any): void => {
            if (n.textContent) texts.push(n.textContent);
            for (const c of n.children || []) walk(c);
        };
        walk(els['care-notif-list']);
        const joined = texts.join(' ');
        expect(joined).toContain('moja skrzynka');
        expect(joined).toContain('Oznacz jako przeczytane');
        expect(els['care-notif-clear'].hidden).toBe(false);
    });

    test('podgląd repa bez alertów: pusty stan z nazwą skrzynki', async () => {
        const { els, context } = load({
            role: 'admin',
            fetchMock: (url: string) => {
                if (url.includes('/api/users-for-assignment'))
                    return okJson({
                        data: [{ id: 'h1', username: 'adam', role: 'user' }]
                    });
                if (url.includes('/api/care/panel')) {
                    const foreign = url.includes('repId=h1');
                    return {
                        ok: true,
                        status: 200,
                        json: async () => ({
                            ok: true,
                            summary: {
                                noContact: 0,
                                due: 0,
                                openOk: 0,
                                won: 0,
                                lost: 0,
                                abandoned: 0,
                                totalCount: 0
                            },
                            queue: { items: [], nextCursor: null, totalCount: 0 },
                            notifications: {
                                items: [],
                                unreadCount: 0,
                                mailboxUserId: foreign ? 'h1' : 'a1'
                            },
                            sla: { firstContactH: 24, staleD: 7, escalationH: 72 }
                        })
                    };
                }
                return okJson({ noContact: 0, due: 0, openOk: 0, won: 0, lost: 0 });
            }
        });
        context.window.currentUser = { role: 'admin', id: 'a1' };
        await context.__careTest.loadCarePanel();
        for (let i = 0; i < 10; i++) await new Promise((r) => setTimeout(r, 0));
        const sel = els['care-rep'];
        sel.value = 'h1';
        for (const fn of sel.handlers || []) await fn();
        for (let i = 0; i < 10; i++) await new Promise((r) => setTimeout(r, 0));
        const texts: string[] = [];
        const walk = (n: any): void => {
            if (n.textContent) texts.push(n.textContent);
            for (const c of n.children || []) walk(c);
        };
        walk(els['care-notif-list']);
        const joined = texts.join(' ');
        expect(joined).toContain('Brak powiadomień (skrzynka:');
        expect(joined).not.toContain('Brak Twoich powiadomień');
    });

    test('bez repa: pusty stan bez wzmianki o podglądzie', async () => {
        const { els, context } = load({
            fetchMock: (url: string) => {
                if (url.includes('/api/care/panel'))
                    return {
                        ok: true,
                        status: 200,
                        json: async () => ({
                            ok: true,
                            summary: {
                                noContact: 0,
                                due: 0,
                                openOk: 0,
                                won: 0,
                                lost: 0,
                                abandoned: 0,
                                totalCount: 0
                            },
                            queue: { items: [], nextCursor: null, totalCount: 0 },
                            notifications: { items: [], unreadCount: 0 },
                            sla: { firstContactH: 24, staleD: 7, escalationH: 72 }
                        })
                    };
                return okJson({ noContact: 0, due: 0, openOk: 0, won: 0, lost: 0 });
            }
        });
        await context.__careTest.loadCarePanel();
        const texts: string[] = [];
        const walk = (n: any): void => {
            if (n.textContent) texts.push(n.textContent);
            for (const c of n.children || []) walk(c);
        };
        walk(els['care-notif-list']);
        const joined = texts.join(' ');
        expect(joined).toContain('Brak nowych powiadomień.');
        expect(joined).not.toContain('moja skrzynka');
    });

    test('loading: aria-busy + status w trakcie fetch, znika po renderze', async () => {
        let resolvePanel: ((v: any) => void) | null = null;
        const gate = new Promise((r) => {
            resolvePanel = r;
        });
        const packet = {
            ok: true,
            etag: '"eload"',
            summary: {
                noContact: 0,
                due: 1,
                openOk: 0,
                won: 0,
                lost: 0,
                abandoned: 0,
                totalCount: 1
            },
            queue: { items: [], nextCursor: null, totalCount: 1 },
            notifications: { items: [], unreadCount: 0 },
            sla: { firstContactH: 24, staleD: 7, escalationH: 72 }
        };
        const { els, context } = load({
            fetchMock: (url: string) => {
                if (url.includes('/api/care/panel')) return gate;
                return okJson({ noContact: 0, due: 0, openOk: 0, won: 0, lost: 0 });
            }
        });
        // Harness mkEl gubi atrybuty aria-* (setAttribute trzyma tylko data-*),
        // więc status wykrywamy po [data-care-loading], nie po aria-busy.
        const findLoading = (root: any): any[] => {
            const out: any[] = [];
            const walk2 = (n: any): void => {
                if (n.dataset && 'careLoading' in n.dataset && !n.removed) out.push(n);
                for (const c of n.children || []) walk2(c);
            };
            walk2(root);
            return out;
        };
        const pending = context.__careTest.loadCarePanel();
        for (let i = 0; i < 10; i++) await new Promise((r) => setTimeout(r, 0));
        const during = findLoading(els['followup-panel']);
        expect(during.length).toBeGreaterThanOrEqual(1);
        expect(String(during[0].textContent)).toContain('Odświeżanie opieki');
        resolvePanel!({ ok: true, status: 200, json: async () => packet });
        await pending;
        for (let i = 0; i < 10; i++) await new Promise((r) => setTimeout(r, 0));
        expect(findLoading(els['followup-panel'])).toHaveLength(0);
    });

    test('badge powiadomień ogłasza zmiany (aria-live polite)', async () => {
        // Atrybut statycznie w index.html (nie z JS — harness vm nie widzi
        // prawdziwego DOM, więc asercja czyta plik, nie mock elementu).
        const fs = await import('node:fs');
        const path = await import('node:path');
        const html = fs.readFileSync(
            path.join(__dirname, '..', '..', 'public', 'index.html'),
            'utf8'
        );
        const m = html.match(/<span[^>]*id="care-notif-count"[^>]*>/);
        if (!m) throw new Error('brak #care-notif-count w index.html');
        expect(m[0]).toContain('aria-live="polite"');
    });

    test('double-submit: snooze i done raz na lot + powrót przycisku', async () => {
        let snoozeRes: ((v: any) => void) | null = null;
        let doneRes: ((v: any) => void) | null = null;
        const snoozeGate = new Promise((r) => {
            snoozeRes = r;
        });
        const doneGate = new Promise((r) => {
            doneRes = r;
        });
        const calls: string[] = [];
        const { els, context } = load({
            calls,
            fetchMock: (url: string) => {
                if (url.includes('/snooze')) return snoozeGate;
                if (url.includes('/api/care/rury/o1/done')) return doneGate;
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
        // Snooze: drugi klik w locie nie fetchuje, przycisk wraca po finally.
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
        const p1 = (snooze.handlers || [])[0]();
        for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0));
        expect(snooze.disabled).toBe(true);
        const p2 = (snooze.handlers || [])[0]();
        for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0));
        expect(calls.filter((c) => c.includes('/snooze'))).toHaveLength(1);
        snoozeRes!(okJson({ ok: true }));
        await p1;
        await p2;
        expect(snooze.disabled).toBe(false);
        // Done z menu: świeży wiersz (snooze podmienia akcje na undo).
        await context.__careTest.loadCarePanel();
        for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0));
        // Done z menu: drugi klik w locie nie fetchuje.
        const findAll = (root: any, pred: (n: any) => boolean, out: any[] = []): any[] => {
            for (const c of root.children || []) {
                if (c.removed) continue;
                if (pred(c)) out.push(c);
                findAll(c, pred, out);
            }
            return out;
        };
        const menus = findAll(
            els['care-queue-list'],
            (n) => n.textContent === '⋮' && (n.handlers || []).length > 0
        );
        for (const fn of menus[0].handlers || []) await fn();
        const items = findAll(els['care-queue-list'], (n) =>
            (n.textContent || '').includes('Oznacz jako done')
        );
        const d1 = (items[0].handlers || [])[0]();
        for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0));
        expect(items[0].disabled).toBe(true);
        const d2 = (items[0].handlers || [])[0]();
        for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0));
        expect(calls.filter((c) => c.includes('/api/care/rury/o1/done'))).toHaveLength(1);
        doneRes!(okJson({ ok: true }));
        await d1;
        await d2;
        expect(items[0].disabled).toBe(false);
    });

    test('badge 99+ i stopka przepełnienia (+N więcej)', async () => {
        const packet = {
            ok: true,
            etag: '"e99"',
            summary: {
                noContact: 0,
                due: 1,
                openOk: 0,
                won: 0,
                lost: 0,
                abandoned: 0,
                totalCount: 1
            },
            queue: { items: [], nextCursor: null, totalCount: 1 },
            notifications: {
                items: [{ id: 'n1', offerKind: 'rury', offerId: 'o1', type: 'SLA_BREACH' }],
                unreadCount: 150,
                hasOverflow: true
            },
            sla: { firstContactH: 24, staleD: 7, escalationH: 72 }
        };
        const { els, context } = load({
            fetchMock: (url: string) => {
                if (url.includes('/api/care/panel'))
                    return { ok: true, status: 200, json: async () => packet };
                return okJson({ noContact: 0, due: 0, openOk: 0, won: 0, lost: 0 });
            }
        });
        await context.__careTest.loadCarePanel();
        // Cap tylko prezentacja: badge stoi na 99+.
        expect(els['care-notif-count'].textContent).toBe('99+');
        const texts: string[] = [];
        const walk = (n: any): void => {
            if (n.textContent) texts.push(n.textContent);
            for (const c of n.children || []) walk(c);
        };
        walk(els['care-notif-list']);
        expect(texts.join(' ')).toContain('+149 więcej');
    });

    test('bez przepełnienia: zwykły badge i brak stopki', async () => {
        const packet = {
            ok: true,
            etag: '"e100"',
            summary: {
                noContact: 0,
                due: 1,
                openOk: 0,
                won: 0,
                lost: 0,
                abandoned: 0,
                totalCount: 1
            },
            queue: { items: [], nextCursor: null, totalCount: 1 },
            notifications: {
                items: [{ id: 'n1', offerKind: 'rury', offerId: 'o1', type: 'SLA_BREACH' }],
                unreadCount: 1,
                hasOverflow: false
            },
            sla: { firstContactH: 24, staleD: 7, escalationH: 72 }
        };
        const { els, context } = load({
            fetchMock: (url: string) => {
                if (url.includes('/api/care/panel'))
                    return { ok: true, status: 200, json: async () => packet };
                return okJson({ noContact: 0, due: 0, openOk: 0, won: 0, lost: 0 });
            }
        });
        await context.__careTest.loadCarePanel();
        expect(els['care-notif-count'].textContent).toBe('1 alert');
        const texts: string[] = [];
        const walk = (n: any): void => {
            if (n.textContent) texts.push(n.textContent);
            for (const c of n.children || []) walk(c);
        };
        walk(els['care-notif-list']);
        expect(texts.join(' ')).not.toContain('więtcej');
    });

    test('meta kart: obiekt+kontakt z tel:/mailto:, braki i śmieci bez linków', async () => {
        const packet = {
            ok: true,
            etag: '"emeta"',
            summary: {
                noContact: 0,
                due: 1,
                openOk: 0,
                won: 0,
                lost: 0,
                abandoned: 0,
                totalCount: 2
            },
            queue: {
                items: [
                    {
                        offerKind: 'rury',
                        offerId: 'o1',
                        status: 'DUE',
                        overdueDays: 0,
                        escalated: false,
                        paused: false,
                        clientName: 'Budimex',
                        number: 'OF/1',
                        value: 100,
                        investName: 'Obiekt Testowy',
                        investAddress: 'ul. Testowa 1',
                        contactPerson: 'Jan Kowalski',
                        phone: '601 000 111',
                        email: 'jan@example.com',
                        nextContactAt: null,
                        lastContactAt: null,
                        lastNote: null
                    },
                    {
                        offerKind: 'studnie',
                        offerId: 'o2',
                        status: 'NO_CONTACT',
                        overdueDays: 0,
                        escalated: false,
                        paused: false,
                        clientName: 'K2',
                        number: null,
                        value: null,
                        investName: null,
                        investAddress: null,
                        contactPerson: null,
                        phone: null,
                        email: null,
                        nextContactAt: null,
                        lastContactAt: null,
                        lastNote: null
                    }
                ],
                nextCursor: null,
                totalCount: 2
            },
            notifications: {
                items: [
                    {
                        id: 'n1',
                        offerKind: 'rury',
                        offerId: 'o1',
                        type: 'CALLBACK_DUE',
                        clientName: 'Budimex',
                        number: 'OF/1',
                        createdAt: '2026-10-10T12:00:00.000Z',
                        investName: 'Obiekt Testowy',
                        investAddress: null,
                        contactPerson: '"><img src=x onerror=1>',
                        phone: 'javascript:alert(1)',
                        email: 'nie-mail'
                    }
                ],
                unreadCount: 1,
                hasOverflow: false
            },
            sla: { firstContactH: 24, staleD: 7, escalationH: 72 }
        };
        const { els, context } = load({
            fetchMock: (url: string) => {
                if (url.includes('/api/care/panel'))
                    return { ok: true, status: 200, json: async () => packet };
                return okJson({ noContact: 0, due: 0, openOk: 0, won: 0, lost: 0 });
            }
        });
        await context.__careTest.loadCarePanel();
        const byAttr = (root: any, name: string): any[] => {
            const out: any[] = [];
            const walk2 = (n: any): void => {
                if (n.attrs && name in n.attrs) out.push(n);
                for (const c of n.children || []) walk2(c);
            };
            walk2(root);
            return out;
        };
        const byTag = (root: any, tag: string): any[] => {
            const out: any[] = [];
            const walk2 = (n: any): void => {
                if (n.tag === tag) out.push(n);
                for (const c of n.children || []) walk2(c);
            };
            walk2(root);
            return out;
        };
        // Kolejka: karta o1 z metą, karta o2 bez.
        const qcards = els['care-queue-list'].children[0].children;
        expect(qcards).toHaveLength(2);
        const objs = byAttr(qcards[0], 'data-care-object');
        expect(objs).toHaveLength(1);
        expect(objs[0].textContent).toContain('Obiekt Testowy');
        expect(objs[0].textContent).toContain('ul. Testowa 1');
        const contacts = byAttr(qcards[0], 'data-care-contact');
        expect(contacts).toHaveLength(1);
        const ctexts: string[] = [];
        const walkC = (n: any): void => {
            if (n.textContent) ctexts.push(n.textContent);
            for (const c of n.children || []) walkC(c);
        };
        walkC(contacts[0]);
        expect(ctexts.join(' ')).toContain('Jan Kowalski');
        const links = byTag(qcards[0], 'a').map((a: any) => a.href);
        expect(links).toContain('tel:601000111');
        expect(links).toContain('mailto:jan@example.com');
        expect(byAttr(qcards[1], 'data-care-object')).toHaveLength(0);
        expect(byAttr(qcards[1], 'data-care-contact')).toHaveLength(0);
        // Powiadomienie: XSS jako martwy tekst, tel:/mailto: bez linków.
        const ncard = els['care-notif-list'].children[0].children[0];
        expect(byTag(ncard, 'img')).toHaveLength(0);
        const ntexts: string[] = [];
        const walkN = (n: any): void => {
            if (n.textContent) ntexts.push(n.textContent);
            for (const c of n.children || []) walkN(c);
        };
        walkN(ncard);
        expect(ntexts.join(' ')).toContain('<img src=x onerror=1>');
        const nhrefs = byTag(ncard, 'a').map((a: any) => String(a.href || ''));
        expect(nhrefs.filter((h: string) => h.startsWith('tel:'))).toHaveLength(0);
        expect(nhrefs.filter((h: string) => h.startsWith('mailto:'))).toHaveLength(0);
        expect(ntexts.join(' ')).toContain('javascript:alert(1)');
    });
});
