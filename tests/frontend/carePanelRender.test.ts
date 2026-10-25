import { load, okJson } from './helpers/carePanelHarness';

describe('carePanel — render, a11y, kafelki, search', () => {
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

    test('Wyczyść wszystko to kafelek (nie tekst): id, klasa, ikona, [hidden]', async () => {
        const fs = await import('node:fs');
        const path = await import('node:path');
        const html = fs.readFileSync(
            path.join(__dirname, '..', '..', 'public', 'index.html'),
            'utf8'
        );
        const m = html.match(/<button[^>]*id="care-notif-clear"[^>]*>([\s\S]*?)<\/button>/);
        if (!m) throw new Error('brak #care-notif-clear w index.html');
        expect(m[0]).toContain('admin-stat-card');
        expect(m[0]).toContain('aria-label="Wyczyść wszystko"');
        expect(m[1]).toContain('data-lucide="check-check"');
        const css = fs.readFileSync(
            path.join(__dirname, '..', '..', 'public', 'css', 'index.css'),
            'utf8'
        );
        // display:flex kafelka przykryłby [hidden] (podgląd cudzej skrzynki).
        expect(css).toContain('.care-notif-clear-tile[hidden]');
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
        const snooze = findBtn(row, '+3d');
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
            (n.textContent || '').includes('Oznacz jako zrobione')
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

    test('kafelek 3-liniowy: L1 numer+status/rodzaj, L2 klient+obiekt+cena, L3 kontakt', async () => {
        const packet = {
            ok: true,
            etag: '"e3line"',
            summary: {
                noContact: 1,
                due: 0,
                openOk: 0,
                won: 0,
                lost: 0,
                abandoned: 0,
                totalCount: 1
            },
            queue: {
                items: [
                    {
                        offerKind: 'studnie',
                        offerId: 's1',
                        status: 'NO_CONTACT',
                        overdueDays: 17,
                        escalated: false,
                        paused: false,
                        number: 'OS/000001/SA/2026',
                        clientNumber: 'K-7',
                        clientName: 'Budimex S.A.',
                        ownerName: 'Adam Klos',
                        authorName: 'Ewa Nowak',
                        value: 18469.68,
                        investName: 'Opole',
                        investAddress: 'Konopnickiej 6b/9',
                        contactPerson: 'kamil kopiec',
                        phone: '795620027',
                        email: 'phenx@o2.pl',
                        nextContactAt: null,
                        lastContactAt: null,
                        lastNote: null
                    }
                ],
                nextCursor: null,
                totalCount: 1
            },
            notifications: { items: [], unreadCount: 0, hasOverflow: false },
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
        const card = els['care-queue-list'].children[0].children[0];
        expect(card.className).toContain('is-studnie');
        const byClass = (root: any, cls: string): any[] => {
            const out: any[] = [];
            const walk2 = (n: any): void => {
                if (n.className && String(n.className).split(' ').includes(cls)) out.push(n);
                for (const c of n.children || []) walk2(c);
            };
            walk2(root);
            return out;
        };
        // L1: numer bold + status + rodzaj dużymi literami.
        const l1 = byClass(card, 'care-queue-l1');
        expect(l1).toHaveLength(1);
        expect(byClass(l1[0], 'care-queue-no')[0].textContent).toContain('OS/000001/SA/2026');
        const pills = byClass(l1[0], 'ops-pill').map((p: any) => p.textContent);
        expect(pills).toContain('Nowy kontakt');
        expect(pills).toContain('STUDNIE');
        // L2: nr klienta + nazwa + obiekt, wartość z prawej.
        const l2 = byClass(card, 'care-queue-l2');
        expect(l2).toHaveLength(1);
        expect(byClass(l2[0], 'care-queue-client-no')[0].textContent).toContain('K-7');
        expect(byClass(l2[0], 'care-queue-name')[0].textContent).toContain('Budimex S.A.');
        expect(byClass(l2[0], 'care-queue-obj')[0].textContent).toContain('Opole');
        expect(byClass(l2[0], 'care-queue-price')[0].textContent).toContain('PLN');
        // L3: kontakt.
        expect(byClass(card, 'care-queue-contact')).toHaveLength(1);
        // Staff nad przyciskami: opiekun + autor (różni).
        const staff = byClass(card, 'care-queue-staff');
        expect(staff).toHaveLength(1);
        expect(staff[0].textContent).toContain('Opiekun: Adam Klos');
        expect(staff[0].textContent).toContain('Przygotował: Ewa Nowak');
    });

    test('kolejka: autor = opiekun ukryty, sam opiekun bez autora', async () => {
        const mkPacket = (ownerName: string | null, authorName: string | null) => ({
            ok: true,
            etag: '"estaff"',
            summary: {
                noContact: 0,
                due: 0,
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
                        escalated: false,
                        paused: false,
                        number: 'OF/1',
                        clientName: 'Budimex',
                        ownerName,
                        authorName,
                        value: 100,
                        nextContactAt: null,
                        lastContactAt: null,
                        lastNote: null
                    }
                ],
                nextCursor: null,
                totalCount: 1
            },
            notifications: { items: [], unreadCount: 0, hasOverflow: false },
            sla: { firstContactH: 24, staleD: 7, escalationH: 72 }
        });
        const byClass = (root: any, cls: string): any[] => {
            const out: any[] = [];
            const walk2 = (n: any): void => {
                if (n.className && String(n.className).split(' ').includes(cls)) out.push(n);
                for (const c of n.children || []) walk2(c);
            };
            walk2(root);
            return out;
        };
        // Ten sam człowiek: tylko opiekun.
        const same = load({
            fetchMock: (url: string) => {
                if (url.includes('/api/care/panel'))
                    return {
                        ok: true,
                        status: 200,
                        json: async () => mkPacket('Adam Klos', 'Adam Klos')
                    };
                return okJson({ noContact: 0, due: 0, openOk: 0, won: 0, lost: 0 });
            }
        });
        await same.context.__careTest.loadCarePanel();
        const cardSame = same.els['care-queue-list'].children[0].children[0];
        const staffSame = byClass(cardSame, 'care-queue-staff');
        expect(staffSame).toHaveLength(1);
        expect(staffSame[0].textContent).toContain('Opiekun: Adam Klos');
        expect(staffSame[0].textContent).not.toContain('Przygotował');
        // Brak obu: brak linii.
        const none = load({
            fetchMock: (url: string) => {
                if (url.includes('/api/care/panel'))
                    return {
                        ok: true,
                        status: 200,
                        json: async () => mkPacket(null, null)
                    };
                return okJson({ noContact: 0, due: 0, openOk: 0, won: 0, lost: 0 });
            }
        });
        await none.context.__careTest.loadCarePanel();
        const cardNone = none.els['care-queue-list'].children[0].children[0];
        expect(byClass(cardNone, 'care-queue-staff')).toHaveLength(0);
    });

    test('centrum: L1 numer+cena+rodzaj+typ, L2 klient+obiekt+delay, L4 zgłoszono+ikony', async () => {
        const item = {
            id: 'n1',
            offerKind: 'studnie',
            offerId: 's1',
            type: 'CALLBACK_DUE',
            readAt: null,
            createdAt: new Date(Date.now() - (23 * 60 + 28) * 60000).toISOString(),
            clientName: 'Budimex S.A.',
            clientNumber: 'K-7',
            number: 'OS/000011/SA/2026',
            ownerName: 'Adam Klos',
            value: 18469.68,
            investName: 'Opole',
            investAddress: 'Konopnickiej 6b/9',
            contactPerson: 'kamil kopiec',
            phone: '795620027',
            email: 'phenx@o2.pl'
        };
        const packet = {
            ok: true,
            etag: '"enotif"',
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
            notifications: { items: [item], unreadCount: 1, hasOverflow: false },
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
        const card = els['care-notif-list'].children[0].children[0];
        const byClass = (root: any, cls: string): any[] => {
            const out: any[] = [];
            const walk2 = (n: any): void => {
                if (n.className && String(n.className).split(' ').includes(cls)) out.push(n);
                for (const c of n.children || []) walk2(c);
            };
            walk2(root);
            return out;
        };
        const texts = (root: any): string => {
            const out: string[] = [];
            const walk2 = (n: any): void => {
                if (n.textContent) out.push(n.textContent);
                for (const c of n.children || []) walk2(c);
            };
            walk2(root);
            return out.join(' ');
        };
        // L1: numer bold + cena + RURY/STUDNIE + typ.
        const l1 = byClass(card, 'care-notif-l1');
        expect(l1).toHaveLength(1);
        expect(texts(l1[0])).toContain('OS/000011/SA/2026');
        expect(texts(l1[0])).toContain('PLN');
        expect(texts(l1[0])).toContain('STUDNIE');
        expect(texts(l1[0])).toContain('Termin kontaktu');
        // L2: nr klienta + nazwa + obiekt, delay w h/m z prawej.
        const l2 = byClass(card, 'care-notif-l2');
        expect(l2).toHaveLength(1);
        expect(texts(l2[0])).toContain('K-7');
        expect(texts(l2[0])).toContain('Budimex S.A.');
        expect(texts(l2[0])).toContain('Opole');
        expect(texts(l2[0])).toMatch(/Opóźnienie: 23h 28m/);
        // L3 kontakt + L4 zgłoszono z opiekunem i ikoną odczytu (bez ikony cofnij).
        expect(byClass(card, 'care-notif-contact')).toHaveLength(1);
        expect(texts(card)).toContain('Zgłoszono:');
        const owner = byClass(card, 'care-notif-owner');
        expect(owner).toHaveLength(1);
        expect(owner[0].textContent).toContain('Adam Klos');
        expect(texts(card)).toContain('phenx@o2.pl');
        const btns = byClass(card, 'care-icon-btn');
        expect(btns).toHaveLength(2);
        const read = btns.find((b: any) => 'data-notif-read' in (b.attrs || {}));
        const find = btns.find((b: any) => 'data-notif-find' in (b.attrs || {}));
        expect(read).toBeTruthy();
        expect(String(read.attrs['aria-label'])).toContain('Oznacz jako przeczytane');
        expect(find).toBeTruthy();
        expect(String(find.attrs['aria-label'])).toContain('Znajdź w kolejce');
    });

    test('centrum: read zostawia kartę ze stanem + ikona cofnij woła /unread', async () => {
        const calls: string[] = [];
        const item = {
            id: 'n2',
            offerKind: 'rury',
            offerId: 'o2',
            type: 'ESCALATION',
            readAt: null,
            createdAt: '2026-10-10T12:00:00.000Z',
            clientName: 'Budimex',
            number: 'OF/2',
            value: 100
        };
        const packet = {
            ok: true,
            etag: '"eread"',
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
            notifications: { items: [item], unreadCount: 1, hasOverflow: false },
            sla: { firstContactH: 24, staleD: 7, escalationH: 72 }
        };
        const { els, context } = load({
            calls,
            fetchMock: (url: string) => {
                if (url.includes('/unread')) return okJson({ ok: true });
                if (url.includes('/notifications/') && url.includes('/read'))
                    return okJson({ ok: true });
                if (url.includes('/api/care/panel'))
                    return { ok: true, status: 200, json: async () => packet };
                return okJson({ noContact: 0, due: 0, openOk: 0, won: 0, lost: 0 });
            }
        });
        await context.__careTest.loadCarePanel();
        const findBtn = (root: any, attr: string): any => {
            for (const c of root.children || []) {
                if (c.tag === 'button' && c.attrs && attr in c.attrs) return c;
                const hit = findBtn(c, attr);
                if (hit) return hit;
            }
            return null;
        };
        const read = findBtn(els['care-notif-list'], 'data-notif-read');
        expect(read).not.toBeNull();
        for (const fn of read.handlers || []) await fn();
        expect(calls.some((c) => c.includes('/api/care/notifications/n2/read'))).toBe(true);
        // Karta zostaje ze stanem przeczytane + ikona cofnij (bez pełnego refetchu).
        expect(calls.some((c) => c.includes('/api/care/panel') && calls.indexOf(c) > 0)).toBe(
            false
        );
        const card = els['care-notif-list'].children[0].children[0];
        expect(String(card.className)).toContain('is-read');
        const undo = findBtn(els['care-notif-list'], 'data-notif-unread');
        expect(undo).not.toBeNull();
        for (const fn of undo.handlers || []) await fn();
        expect(calls.some((c) => c.includes('/api/care/notifications/n2/unread'))).toBe(true);
        expect(String(els['care-notif-count'].textContent)).toContain('1 alert');
    });

    test('kontakt z kafelka otwiera modal opieki w miejscu (bez nawigacji)', async () => {
        const calls: string[] = [];
        const opened: any[] = [];
        const packet = (etag: string) => ({
            ok: true,
            etag,
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
                        offerKind: 'studnie',
                        offerId: 's9',
                        status: 'NO_CONTACT',
                        overdueDays: 3,
                        escalated: false,
                        paused: false,
                        number: 'OS/9/SA/2026',
                        clientName: 'Budimex',
                        value: 100,
                        nextContactAt: null,
                        lastContactAt: null,
                        lastNote: null
                    }
                ],
                nextCursor: null,
                totalCount: 1
            },
            notifications: { items: [], unreadCount: 0, hasOverflow: false },
            sla: { firstContactH: 24, staleD: 7, escalationH: 72 }
        });
        const { els, context } = load({
            calls,
            fuStub: {
                renderFollowUpTimeline: () => '',
                openFollowUpModal: async function (id: string, type: string, opts: any) {
                    opened.push({ id, type, title: opts?.title, opts, self: this });
                }
            },
            fetchMock: (url: string) => {
                if (url.includes('/api/care/panel'))
                    return {
                        ok: true,
                        status: 200,
                        json: async () => packet('"e" + calls.length')
                    };
                return okJson({ noContact: 0, due: 0, openOk: 0, won: 0, lost: 0 });
            }
        });
        context.window.location = { href: 'index.html' };
        await context.__careTest.loadCarePanel();
        const findOpen = (root: any): any => {
            for (const c of root.children || []) {
                if (c.tag === 'button' && c.attrs && 'data-care-contact-open' in c.attrs) return c;
                const hit = findOpen(c);
                if (hit) return hit;
            }
            return null;
        };
        const btn = findOpen(els['care-queue-list']);
        expect(btn).not.toBeNull();
        expect(btn.tag).toBe('button');
        for (const fn of btn.handlers || []) await fn();
        expect(opened).toHaveLength(1);
        expect(opened[0].id).toBe('s9');
        expect(opened[0].type).toBe('studnia_oferta');
        expect(opened[0].title).toBe('OS/9/SA/2026');
        expect(typeof opened[0].opts?.onSaved).toBe('function');
        expect(context.window.location.href).toBe('index.html');
        // Regresja martwego klika: kontekst modala dziedziczy metody mixina
        // (renderFollowUpTimeline wołany przez this.*), odświeża kolejkę.
        // onSaved/loadLocalOffers zwracają promisa loada — await czeka pełny
        // łańcuch (fetch + render), więc kolejny refresh nie wpada w guard.
        expect(typeof opened[0].self?.renderFollowUpTimeline).toBe('function');
        const staffBefore = calls.filter((c) => c.includes('/api/care/panel')).length;
        await opened[0].self?.loadLocalOffers();
        expect(calls.filter((c) => c.includes('/api/care/panel')).length).toBeGreaterThan(
            staffBefore
        );
        // Zapis w modalu odświeża kolejkę (onSaved → ponowny fetch panelu).
        const panelBefore = calls.filter((c) => c.includes('/api/care/panel')).length;
        await opened[0].opts.onSaved();
        expect(calls.filter((c) => c.includes('/api/care/panel')).length).toBeGreaterThan(
            panelBefore
        );
    });

    test('snooze: presety +6d/+9d niosą właściwy until, custom 1–28, śmieci bez fetcha', async () => {
        const calls: string[] = [];
        const posts: Array<{ url: string; body: string }> = [];
        const packet = (paused: boolean) => ({
            ok: true,
            etag: '"esnz"',
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
                        overdueDays: 1,
                        escalated: false,
                        paused,
                        clientName: 'A',
                        value: null,
                        phone: null,
                        lastNote: null,
                        nextContactAt: null,
                        lastContactAt: null
                    }
                ],
                nextCursor: null,
                totalCount: 1
            },
            notifications: { items: [], unreadCount: 0, hasOverflow: false },
            sla: { firstContactH: 24, staleD: 7, escalationH: 72 }
        });
        const { els, context } = load({
            calls,
            fetchMock: (url: string, init?: any) => {
                if (url.includes('/snooze') && (init?.method || 'GET') === 'POST') {
                    posts.push({ url, body: String(init?.body ?? '') });
                    return okJson({ ok: true, state: { updatedAt: '2026-10-13T00:00:00.000Z' } });
                }
                if (url.includes('/api/care/panel'))
                    return { ok: true, status: 200, json: async () => packet(false) };
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
        const findInput = (root: any): any => {
            for (const c of root.children || []) {
                if (c.tag === 'input') return c;
                const hit = findInput(c);
                if (hit) return hit;
            }
            return null;
        };
        const daysOf = (body: string) =>
            (Date.parse(JSON.parse(body).snoozedUntil) - Date.now()) / 86400000;
        // Po udanym snooze akcje podmieniają się na undo — świeży wiersz.
        const freshRow = async () => {
            await context.__careTest.loadCarePanel();
            return els['care-queue-list'].children[0];
        };
        // +6d i +9d: until ≈ 6 i 9 dni.
        for (const fn of findBtn(row, '+6d').handlers || []) await fn();
        const row9 = await freshRow();
        for (const fn of findBtn(row9, '+9d').handlers || []) await fn();
        expect(posts).toHaveLength(2);
        expect(daysOf(posts[0].body)).toBeGreaterThan(5.9);
        expect(daysOf(posts[0].body)).toBeLessThan(6.1);
        expect(daysOf(posts[1].body)).toBeGreaterThan(8.9);
        expect(daysOf(posts[1].body)).toBeLessThan(9.1);
        // Custom OK: 12d przechodzi, śmieci nie fetchują.
        const row12 = await freshRow();
        const input = findInput(row12);
        expect(input).not.toBeNull();
        input.value = '12';
        for (const fn of findBtn(row12, 'OK').handlers || []) await fn();
        expect(posts).toHaveLength(3);
        expect(daysOf(posts[2].body)).toBeGreaterThan(11.9);
        expect(daysOf(posts[2].body)).toBeLessThan(12.1);
        const rowBad = await freshRow();
        const badInput = findInput(rowBad);
        const before = posts.length;
        badInput.value = '99';
        for (const fn of findBtn(rowBad, 'OK').handlers || []) await fn();
        badInput.value = 'abc';
        for (const fn of badInput.handlers || []) await fn({ key: 'Enter', preventDefault() {} });
        expect(posts).toHaveLength(before);
    });

    test('snooze: pauza blokuje presety i custom', async () => {
        const { els, context } = load({
            fetchMock: (url: string) => {
                if (url.includes('/api/care/panel'))
                    return {
                        ok: true,
                        status: 200,
                        json: async () => ({
                            ok: true,
                            etag: '"epaused"',
                            summary: {
                                noContact: 0,
                                due: 0,
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
                                        escalated: false,
                                        paused: true,
                                        clientName: 'A',
                                        value: null,
                                        phone: null,
                                        lastNote: null,
                                        nextContactAt: null,
                                        lastContactAt: null
                                    }
                                ],
                                nextCursor: null,
                                totalCount: 1
                            },
                            notifications: { items: [], unreadCount: 0, hasOverflow: false },
                            sla: { firstContactH: 24, staleD: 7, escalationH: 72 }
                        })
                    };
                return okJson({ noContact: 0, due: 0, openOk: 0, won: 0, lost: 0 });
            }
        });
        await context.__careTest.loadCarePanel();
        const card = els['care-queue-list'].children[0].children[0];
        const walk = (root: any, out: any[] = []): any[] => {
            for (const c of root.children || []) {
                if ((c.tag === 'button' || c.tag === 'input') && c.disabled) out.push(c);
                walk(c, out);
            }
            return out;
        };
        const disabledCount = walk(card).length;
        expect(disabledCount).toBeGreaterThanOrEqual(5);
        // Kontakt celowo aktywny także przy pauzie.
        const findBtn = (root: any, label: string): any => {
            for (const c of root.children || []) {
                if (c.textContent === label) return c;
                const hit = findBtn(c, label);
                if (hit) return hit;
            }
            return null;
        };
        expect(findBtn(card, 'Kontakt').disabled).toBe(false);
    });

    test('search kolejki: normalize + match po kliencie/obiekcie/telefonie', async () => {
        const { context } = load({ fetchMock: () => okJson({}) });
        const t = context.__careTest;
        expect(t.normalizeCareSearch('ŁÓDŹ  Test')).toBe('lodz test');
        expect(t.setQueueSearch('x'.repeat(200)).length).toBe(100);
        t.setQueueSearch('budimex');
        expect(t.matchCareSearch({ clientName: 'Budimex', phone: null })).toBe(true);
        expect(t.matchCareSearch({ clientName: 'Inny', phone: null })).toBe(false);
        t.setQueueSearch('lodz');
        expect(t.matchCareSearch({ investName: 'Łódź Centrum' })).toBe(true);
        t.setQueueSearch('+48 601 000 111');
        expect(t.matchCareSearch({ clientName: 'X', phone: '+48 601-000-111' })).toBe(true);
        expect(t.matchCareSearch({ clientName: 'X', phone: '602000000' })).toBe(false);
        t.setQueueSearch('');
        expect(t.matchCareSearch({ clientName: 'Cokolwiek' })).toBe(true);
    });

    test('search filtruje karty kolejki + miss tekst ze statusem', async () => {
        const { els, context } = load({
            fetchMock: (url: string) => {
                if (url.includes('/api/care/panel'))
                    return okJson({
                        ok: true,
                        summary: {
                            noContact: 0,
                            due: 2,
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
                                    phone: '601000111',
                                    lastNote: null,
                                    nextContactAt: null,
                                    lastContactAt: null
                                },
                                {
                                    offerKind: 'studnie',
                                    offerId: 'o2',
                                    status: 'DUE',
                                    overdueDays: 0,
                                    escalated: false,
                                    paused: false,
                                    clientName: 'Łódź Bud',
                                    number: 'OF/2',
                                    value: 200,
                                    phone: null,
                                    lastNote: null,
                                    nextContactAt: null,
                                    lastContactAt: null
                                }
                            ],
                            nextCursor: null,
                            totalCount: 2
                        },
                        notifications: { items: [], unreadCount: 0, hasOverflow: false },
                        sla: { firstContactH: 24, staleD: 7, escalationH: 72 }
                    });
                return okJson({ noContact: 0, due: 0, openOk: 0, won: 0, lost: 0 });
            }
        });
        const countCards = (root: any): number => {
            let n = 0;
            const walk = (x: any): void => {
                if (x.className && String(x.className).split(' ').includes('care-queue-card'))
                    n += 1;
                for (const c of x.children || []) walk(c);
            };
            walk(root);
            return n;
        };
        const texts = (root: any): string => {
            const out: string[] = [];
            const walk = (x: any): void => {
                if (x.textContent) out.push(String(x.textContent));
                for (const c of x.children || []) walk(c);
            };
            walk(root);
            return out.join(' | ');
        };
        await context.__careTest.loadCarePanel();
        expect(countCards(els['care-queue-list'])).toBe(2);
        context.__careTest.setQueueSearch('budimex');
        await context.__careTest.loadCarePanel();
        expect(countCards(els['care-queue-list'])).toBe(1);
        context.__careTest.setQueueSearch('nieistniejefraza');
        await context.__careTest.loadCarePanel();
        expect(countCards(els['care-queue-list'])).toBe(0);
        expect(texts(els['care-queue-list'])).toContain('Brak wyników dla frazy');
    });

    test('centrum: kafelek ma Znajdź w kolejce + miss zwraca false', async () => {
        const { els, context } = load({
            fetchMock: (url: string) => {
                if (url.includes('/api/care/panel'))
                    return okJson({
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
                                    overdueDays: 1,
                                    escalated: false,
                                    paused: false,
                                    clientName: 'Budimex',
                                    number: 'OF/1',
                                    value: 100,
                                    phone: null,
                                    lastNote: null,
                                    nextContactAt: null,
                                    lastContactAt: null
                                }
                            ],
                            nextCursor: null,
                            totalCount: 1
                        },
                        notifications: {
                            items: [
                                {
                                    id: 'n1',
                                    offerKind: 'rury',
                                    offerId: 'o9',
                                    type: 'ESCALATION',
                                    clientName: 'Spoza',
                                    number: 'OF/9'
                                }
                            ],
                            unreadCount: 1,
                            hasOverflow: false
                        },
                        sla: { firstContactH: 24, staleD: 7, escalationH: 72 }
                    });
                return okJson({ noContact: 0, due: 0, openOk: 0, won: 0, lost: 0 });
            }
        });
        await context.__careTest.loadCarePanel();
        const findAttr = (root: any): any[] => {
            const out: any[] = [];
            const walk = (x: any): void => {
                if (x.attrs && 'data-notif-find' in x.attrs) out.push(x);
                for (const c of x.children || []) walk(c);
            };
            walk(root);
            return out;
        };
        expect(findAttr(els['care-notif-list']).length).toBe(1);
        // Oferta spoza cache (o9): miss -> false, filtr schodzi do all.
        expect(context.__careTest.findOfferInQueue('rury', 'o9', 'OF/9')).toBe(false);
    });
});
