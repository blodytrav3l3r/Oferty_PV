import fs from 'fs';
import path from 'path';
import vm from 'vm';

/**
 * Panel admina: kafle sesji + badge w wierszu + wymuszone wylogowanie.
 * Harness vm (bez DOM): sprawdzamy render (textContent/innerHTML), kontrakt
 * data-csp (CSP-E) i zachowanie przy błędzie/podwójnym kliknięciu.
 */

const ROOT = path.join(__dirname, '..', '..');
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf-8');

const flush = async (n = 30) => {
    for (let i = 0; i < n; i++) await new Promise((r) => setTimeout(r, 0));
};

const esc = (s: unknown) =>
    String(s ?? '').replace(
        /[&<>"']/g,
        (c) =>
            ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string
    );

function loadDashboard(fetchImpl: any, confirmResult = true) {
    const els: Record<string, any> = {};
    const el = (id: string) =>
        (els[id] = els[id] || {
            textContent: '',
            innerHTML: '',
            value: '',
            dataset: {},
            classList: {
                _set: new Set<string>(),
                add(c: string) {
                    this._set.add(c);
                },
                remove(c: string) {
                    this._set.delete(c);
                },
                toggle() {}
            },
            addEventListener() {},
            setAttribute() {},
            querySelector: () => el('child'),
            getAttribute() {
                return null;
            }
        });
    const context: any = {
        console,
        setTimeout: (fn: any) => {
            if (typeof fn === 'function') fn();
            return 0;
        },
        clearTimeout() {},
        setInterval: () => 0,
        clearInterval() {},
        CustomEvent: class {
            constructor(
                public type: string,
                public opts?: any
            ) {}
        },
        fetch: jest.fn(fetchImpl),
        escapeHtml: esc,
        escapeHtmlAttr: esc,
        logger: { info() {}, warn: jest.fn(), error: jest.fn() },
        showToast: jest.fn(),
        sessionStorage: { getItem: () => null, setItem() {} },
        localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
        window: null as any,
        document: null as any
    };
    context.window = {
        addEventListener() {},
        headerUser: null,
        location: { href: '' },
        appConfirm: jest.fn(async () => confirmResult),
        showToast: context.showToast
    };
    context.document = {
        addEventListener() {},
        getElementById: (id: string) => el(id),
        querySelector: () => el('query'),
        querySelectorAll: () => [],
        documentElement: { classList: { remove() {}, add() {} } },
        dispatchEvent: () => true,
        createElement: () => el('created')
    };
    vm.createContext(context);
    vm.runInContext(read('public/js/shared/dashboard.js'), context);
    return { context, els };
}

const adminUser = {
    id: 'a',
    username: 'admin',
    role: 'admin',
    firstName: 'Admin',
    lastName: 'Szef'
};
const victimUser = {
    id: 'v',
    username: 'vict',
    role: 'user',
    firstName: 'Wiktor',
    lastName: 'Nowak',
    email: 'v@e.pl'
};

function usersPayload() {
    return { data: [adminUser, victimUser] };
}

function sessionsPayload(now = Date.now()) {
    return {
        ok: true,
        data: [
            { userId: 'v', sessionCount: 2, lastActivityAt: now - 2 * 60 * 1000 - 500 },
            { userId: 'a', sessionCount: 1, lastActivityAt: now - 60 * 1000 }
        ],
        summary: {
            activeUsers: 2,
            activeSessions: 3,
            lastActivityAt: now - 60 * 1000,
            generatedAt: now
        }
    };
}

function okJson(payload: any) {
    return { ok: true, status: 200, json: async () => payload };
}

describe('pulpit admina: sesje', () => {
    const html = read('public/index.html');
    const adminPanel = html.slice(
        html.indexOf('id="admin-panel"'),
        html.indexOf('id="users-tiles"')
    );

    it('kafle sesji w #admin-panel, aria-live, bez nowych klas CSS', () => {
        expect(adminPanel).toContain('id="session-tiles"');
        expect(adminPanel).toContain('aria-live="polite"');
        expect(adminPanel).toContain('session-tile-users');
        expect(adminPanel).toContain('session-tile-count');
        expect(adminPanel).toContain('session-tile-last');
    });

    it('hydratacja: kafle pokazują liczby i czas (textContent)', async () => {
        const now = Date.now();
        const { context, els } = loadDashboard(async (url: string) => {
            const u = String(url);
            if (u.includes('/api/admin/sessions')) return okJson(sessionsPayload(now));
            if (u.includes('/api/users')) return okJson(usersPayload());
            return okJson({});
        });

        await context.showLoggedIn(adminUser);
        await flush();

        expect(els['session-tile-users'].textContent).toBe('2 / 2');
        expect(els['session-tile-users-meta'].textContent).toBe('kont');
        expect(els['session-tile-count'].textContent).toBe('3');
        expect(els['session-tile-last'].textContent).toBe('1 min temu');
    });

    it('fail-soft: błąd /sessions → placeholdery + warn, bez toastu i bez badge', async () => {
        const { context, els } = loadDashboard(async (url: string) => {
            const u = String(url);
            if (u.includes('/api/admin/sessions'))
                return { ok: false, status: 500, json: async () => ({}) };
            if (u.includes('/api/users')) return okJson(usersPayload());
            return okJson({});
        });

        await context.showLoggedIn(adminUser);
        await flush();

        expect(els['session-tile-users'].textContent).toBe('—');
        expect(els['session-tile-users-meta'].textContent).toBe('brak danych o sesjach');
        expect(els['session-tile-count'].textContent).toBe('—');
        expect(context.showToast).not.toHaveBeenCalled();
        expect(context.logger.warn).toHaveBeenCalled();
        expect(els['users-tiles'].innerHTML).not.toContain('sesje ·');
        // Awaria odczytu nie może kłamać „brak sesji" ani odbierać akcji.
        expect(els['users-tiles'].innerHTML).toContain('Sesje: brak danych');
        expect(els['users-tiles'].innerHTML).toContain('data-csp="revokeUserSessions"');
    });

    it('kafel: badge sesji tylko dla usera z sesjami, brak przycisku dla siebie', async () => {
        const { context, els } = loadDashboard(async (url: string) => {
            const u = String(url);
            if (u.includes('/api/admin/sessions')) return okJson(sessionsPayload());
            if (u.includes('/api/users')) return okJson(usersPayload());
            return okJson({});
        });

        await context.showLoggedIn(adminUser);
        await flush();

        const rows = els['users-tiles'].innerHTML;
        expect(rows).toContain('2 sesje ·');
        expect(rows).toContain('1 sesja ·');
        expect(rows).toContain('data-csp="revokeUserSessions"');
        // Admin nie dostaje przycisku na własnym kaflu: 2 użytkownicy → 1 przycisk.
        expect(rows.match(/data-csp="revokeUserSessions"/g) || []).toHaveLength(1);
        expect(rows).toContain('&quot;v&quot;');
    });

    it('revoke: DELETE, toast z liczbą, odświeżenie kafli', async () => {
        const calls: string[] = [];
        const { context } = loadDashboard(async (url: string, init?: any) => {
            const u = String(url);
            calls.push((init && init.method ? init.method : 'GET') + ' ' + u);
            if (init && init.method === 'DELETE') return okJson({ ok: true, revoked: 2 });
            if (u.includes('/api/admin/sessions')) return okJson(sessionsPayload());
            if (u.includes('/api/users')) return okJson(usersPayload());
            return okJson({});
        });

        await context.showLoggedIn(adminUser);
        await flush();
        calls.length = 0;

        await context.revokeUserSessions('v');
        await flush();

        expect(calls.filter((c) => c.startsWith('DELETE /api/admin/sessions/v'))).toHaveLength(1);
        expect(context.window.appConfirm).toHaveBeenCalled();
        expect(context.showToast).toHaveBeenCalledWith('Wylogowano: 2 sesje', 'info');
        // Odświeżenie po sukcesie: ponowne GET sesji.
        expect(calls.filter((c) => c === 'GET /api/admin/sessions')).toHaveLength(1);
    });

    it('revoke: błąd backendu → toast error, bez fałszywego odświeżenia', async () => {
        const calls: string[] = [];
        const { context } = loadDashboard(async (url: string, init?: any) => {
            const u = String(url);
            calls.push((init && init.method ? init.method : 'GET') + ' ' + u);
            if (init && init.method === 'DELETE')
                return {
                    ok: false,
                    status: 403,
                    json: async () => ({ error: 'Brak uprawnień administratora' })
                };
            if (u.includes('/api/admin/sessions')) return okJson(sessionsPayload());
            if (u.includes('/api/users')) return okJson(usersPayload());
            return okJson({});
        });

        await context.showLoggedIn(adminUser);
        await flush();
        calls.length = 0;

        await context.revokeUserSessions('v');
        await flush();

        expect(context.showToast).toHaveBeenCalledWith('Brak uprawnień administratora', 'error');
        expect(calls.filter((c) => c === 'GET /api/admin/sessions')).toHaveLength(0);
    });

    it('revoke: podwójny klik = jedno żądanie', async () => {
        let deleteCalls = 0;
        let release: (v: any) => void = () => {};
        const gate = new Promise((r) => {
            release = r;
        });
        const { context } = loadDashboard(async (url: string, init?: any) => {
            const u = String(url);
            if (init && init.method === 'DELETE') {
                deleteCalls++;
                await gate;
                return okJson({ ok: true, revoked: 1 });
            }
            if (u.includes('/api/admin/sessions')) return okJson(sessionsPayload());
            if (u.includes('/api/users')) return okJson(usersPayload());
            return okJson({});
        });

        await context.showLoggedIn(adminUser);
        await flush();

        const first = context.revokeUserSessions('v');
        const second = context.revokeUserSessions('v');
        await flush(5);
        release({});
        await Promise.all([first, second]);

        expect(deleteCalls).toBe(1);
    });

    it('revoke: anulowanie potwierdzenia nie wysyła żądania', async () => {
        const calls: string[] = [];
        const { context } = loadDashboard(async (url: string, init?: any) => {
            const u = String(url);
            calls.push((init && init.method ? init.method : 'GET') + ' ' + u);
            if (u.includes('/api/admin/sessions')) return okJson(sessionsPayload());
            if (u.includes('/api/users')) return okJson(usersPayload());
            return okJson({});
        }, false);

        await context.showLoggedIn(adminUser);
        await flush();
        calls.length = 0;

        await context.revokeUserSessions('v');
        expect(calls.filter((c) => c.startsWith('DELETE'))).toHaveLength(0);
    });

    it('kafle: inicjały, rola, login, kontakt i numery w jednym kafelku', async () => {
        const { context, els } = loadDashboard(async (url: string) => {
            const u = String(url);
            if (u.includes('/api/admin/sessions')) return okJson(sessionsPayload());
            if (u.includes('/api/users')) return okJson(usersPayload());
            return okJson({});
        });

        await context.showLoggedIn(adminUser);
        await flush();

        const html = els['users-tiles'].innerHTML;
        expect(html.match(/class="admin-user-tile"/g) || []).toHaveLength(2);
        expect(html).toContain('role="listitem"');
        expect(html).toContain('>AS<'); // Admin Szef
        expect(html).toContain('>WN<'); // Wiktor Nowak
        expect(html).toContain('role-admin');
        expect(html).toContain('role-user');
        expect(html).toContain('@admin');
        expect(html).toContain('@vict');
        expect(html).toContain('v@e.pl');
        expect(html).toContain('Nr zam.');
        expect(html).toContain('Nr zlec.');
        expect(els['admin-empty-state'].classList._set.has('hidden')).toBe(true);
    });

    it('kafle: kolejność edytuj → usuń → status → wyloguj, akcje niedostępne wyblakłe', async () => {
        const { context, els } = loadDashboard(async (url: string) => {
            const u = String(url);
            if (u.includes('/api/admin/sessions')) return okJson(sessionsPayload());
            if (u.includes('/api/users')) return okJson(usersPayload());
            return okJson({});
        });

        await context.showLoggedIn(adminUser);
        await flush();

        const html = els['users-tiles'].innerHTML;
        const tiles = html.split('class="admin-user-tile"').slice(1);
        const [adminTile, victimTile] = tiles;

        // Kolejność w obrębie kafla: edit, delete, pill sesji, wylogowanie.
        const order = ['edit-btn', 'delete-btn', 'admin-user-session', 'revoke-btn'];
        const positions = order.map((cls) => victimTile.indexOf(cls));
        expect(positions.every((p) => p > -1)).toBe(true);
        expect([...positions].sort((a, b) => a - b)).toEqual(positions);

        // Cudze konto: wszystkie trzy akcje klikalne (data-csp) + ikona power.
        expect(victimTile).toContain('data-csp="startEditUser"');
        expect(victimTile).toContain('data-csp="deleteUser"');
        expect(victimTile).toContain('data-csp="revokeUserSessions"');
        expect(victimTile).toContain('data-lucide="power"');

        // Własne konto: wylogowanie widoczne, ale disabled i bez data-csp.
        expect(adminTile).toContain('data-lucide="power"');
        expect(adminTile).toContain('disabled aria-disabled="true"');
        expect(adminTile).not.toContain('data-csp="revokeUserSessions"');
        // Konto systemowe admin: usuwanie też widoczne, ale disabled.
        expect(adminTile).toContain('data-lucide="trash-2"');
        expect(adminTile).not.toContain('data-csp="deleteUser"');
    });

    it('kafle: puste konto → chowamy kafle i pokazujemy empty state', async () => {
        const { context, els } = loadDashboard(async (url: string) => {
            const u = String(url);
            if (u.includes('/api/admin/sessions')) return okJson(sessionsPayload());
            if (u.includes('/api/users')) return okJson({ data: [] });
            return okJson({});
        });

        await context.showLoggedIn(adminUser);
        await flush();

        expect(els['users-tiles'].innerHTML).toBe('');
        expect(els['admin-empty-state'].classList._set.has('hidden')).toBe(false);
    });

    it('kafle: dane użytkownika escapowane (XSS w nazwie i mailu)', async () => {
        const evil = {
            ...victimUser,
            firstName: '<img src=x onerror=alert(1)>',
            lastName: '',
            email: '"><script>alert(1)</script>'
        };
        const { context, els } = loadDashboard(async (url: string) => {
            const u = String(url);
            if (u.includes('/api/admin/sessions')) return okJson(sessionsPayload());
            if (u.includes('/api/users')) return okJson({ data: [evil] });
            return okJson({});
        });

        await context.showLoggedIn(adminUser);
        await flush();

        const html = els['users-tiles'].innerHTML;
        expect(html).not.toContain('<img');
        expect(html).not.toContain('<script');
        expect(html).toContain('&lt;img');
    });
});
