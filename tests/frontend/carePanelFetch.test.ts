import { load, okJson } from './helpers/carePanelHarness';

describe('carePanel — panel fetch, ETag, błędy, polling, zakresy', () => {
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

    test('500 z API pokazuje błąd zamiast pustego panelu', async () => {
        const { els, context } = load({
            fetchMock: (url: string) => {
                if (url.includes('/api/care/')) return { ok: false, status: 500 };
                return okJson({});
            }
        });
        await context.__careTest.loadCarePanel();
        const panel = els['followup-panel'];
        const hasBanner = (panel.children || []).some(
            (c: any) => c.dataset && c.dataset.careError === '1'
        );
        expect(hasBanner).toBe(true);
    });

    test('/panel 5xx: log raz i cooldown, dane dalej z legacy', async () => {
        const calls: string[] = [];
        const warn = jest.fn();
        const { els, context } = load({
            calls,
            fetchMock: (url: string) => {
                if (url.includes('/api/care/panel')) return { ok: false, status: 500 };
                if (url.includes('/api/care/summary'))
                    return okJson({ noContact: 0, due: 1, openOk: 0, won: 0, lost: 0 });
                if (url.includes('/api/care/queue')) return okJson({ items: [] });
                return okJson({ items: [], unreadCount: 0 });
            }
        });
        context.logger = { warn };
        await context.__careTest.loadCarePanel();
        expect(warn).toHaveBeenCalledTimes(1);
        expect(String(warn.mock.calls[0][1])).toContain('500');
        const panelCalls = () => calls.filter((c) => c.includes('/api/care/panel')).length;
        expect(panelCalls()).toBe(1);

        // Kolejny tick w oknie cooldownu: zero strzałów w /panel, dane z legacy.
        await context.__careTest.loadCarePanel();
        expect(panelCalls()).toBe(1);
        expect(warn).toHaveBeenCalledTimes(1);
        const panel = els['followup-panel'];
        expect(
            (panel.children || []).some((c: any) => c.dataset && c.dataset.careError === '1')
        ).toBe(false);
    });

    test('401 woła modal sesji (raz), nie udaje pustego panelu', async () => {
        const notify = jest.fn();
        const { els, context } = load({
            fetchMock: (url: string) => {
                if (url.includes('/api/care/')) return { ok: false, status: 401 };
                return okJson({});
            }
        });
        context.window.sessionIdle = { notifyUnauthorized: notify };
        await context.__careTest.loadCarePanel();
        expect(notify).toHaveBeenCalledTimes(1);
        expect(notify.mock.calls[0][0]).toEqual({ status: 401 });
        const panel = els['followup-panel'];
        expect(
            (panel.children || []).some((c: any) => c.dataset && c.dataset.careError === '1')
        ).toBe(false);
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
        const labels: string[] = [];
        const walkA = (n: any): void => {
            if (n.attrs && n.attrs['aria-label']) labels.push(String(n.attrs['aria-label']));
            for (const c of n.children || []) walkA(c);
        };
        walk(els['care-notif-list']);
        walkA(els['care-notif-list']);
        const joined = texts.join(' ');
        expect(joined).toContain('moja skrzynka');
        expect(labels.some((l) => l.includes('Oznacz jako przeczytane'))).toBe(true);
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
});
