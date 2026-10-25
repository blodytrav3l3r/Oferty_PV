import { load, okJson } from './helpers/carePanelHarness';

describe('carePanel — akcje: snooze, SLA, mark-read, postCare', () => {
    test('snooze presety z undo (reopen)', async () => {
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
        const snooze = findBtn(row, '+3d');
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
                if (c.tag === 'button' && c.attrs && 'data-notif-read' in c.attrs) return c;
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
                if (c.tag === 'button' && c.attrs && 'data-notif-read' in c.attrs) return c;
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
            (n.textContent || '').includes('Oznacz jako zrobione')
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
            (n.textContent || '').includes('Oznacz jako zrobione')
        );
        expect(items).toHaveLength(1);
        for (const fn of items[0].handlers || []) await fn();
        expect(calls.some((c) => c.includes('/api/care/rury/o1/done'))).toBe(true);
        expect(calls.filter((c) => c.includes('/api/care/panel')).length).toBe(before);
    });
});
