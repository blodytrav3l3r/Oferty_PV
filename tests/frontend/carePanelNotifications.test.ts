import { load, okJson } from './helpers/carePanelHarness';

describe('carePanel — powiadomienia i kolejka', () => {
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
        expect(pills).toContain('RURY');
        // P4: SLA-box dla każdej roli (user edytuje własne progi).
        expect(els['care-sla-box'].hidden).toBe(false);
        expect(calls.filter((c) => c.includes('/api/care/')).length).toBeGreaterThanOrEqual(3);
    });

    test('grupowanie: SLA + termin kontaktu tej samej oferty = jedna karta, dwa pill', async () => {
        const calls: string[] = [];
        const { els, context } = load({
            calls,
            fetchMock: (url: string) => {
                if (url.endsWith('/api/care/notifications/read')) return okJson({ ok: true });
                return okJson({});
            }
        });
        (context as any).__careTest.renderNotifications(
            [
                {
                    id: 'n1',
                    offerKind: 'studnie',
                    offerId: 'o1',
                    type: 'SLA_BREACH',
                    number: 'OS/1',
                    readAt: null
                },
                {
                    id: 'n2',
                    offerKind: 'studnie',
                    offerId: 'o1',
                    type: 'CALLBACK_DUE',
                    number: 'OS/1',
                    readAt: null
                },
                {
                    id: 'n3',
                    offerKind: 'rury',
                    offerId: 'o2',
                    type: 'SLA_BREACH',
                    number: 'OF/2',
                    readAt: null
                }
            ],
            3,
            null,
            false
        );
        const list = els['care-notif-list'];
        const byClass = (cls: string): any[] => {
            const out: any[] = [];
            const walk = (n: any): void => {
                if (n.className && String(n.className).split(' ').includes(cls)) out.push(n);
                for (const c of n.children || []) walk(c);
            };
            walk(list);
            return out;
        };
        // 3 powiadomienia → 2 oferty; podsumowanie mówi wprost, ile ich jest.
        expect(byClass('care-notif-summary')[0].textContent).toBe('2 oferty · 3 alerty');
        expect(byClass('care-notif-grid')[0].children).toHaveLength(2);

        const pills: string[] = [];
        const collectPills = (n: any): void => {
            if (n.className && String(n.className).split(' ').includes('ops-pill') && n.textContent)
                pills.push(n.textContent);
            for (const c of n.children || []) collectPills(c);
        };
        collectPills(list);
        expect(pills).toContain('Przekroczony SLA');
        expect(pills).toContain('Termin kontaktu');

        // Odczyt grupy = jeden request zbiorczy z oboma id oferty.
        const read = byClass('care-icon-btn').find((b) => b.attrs && 'data-notif-read' in b.attrs);
        expect(read).not.toBeNull();
        for (const fn of read.handlers || []) await fn();
        const bulk = calls.filter((c) => c === 'POST /api/care/notifications/read');
        expect(bulk).toHaveLength(1);
        expect(
            calls.filter((c) => c.includes('/read') && !c.endsWith('/notifications/read'))
        ).toHaveLength(0);
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
            (n.textContent || '').includes('Oznacz jako zrobione')
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
                (n.textContent || '').includes('Oznacz jako zrobione')
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
});
