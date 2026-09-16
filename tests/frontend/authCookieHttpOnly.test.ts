// @ts-nocheck -- vm sandbox, celowy brak typow dla public/js
import fs from 'fs';
import path from 'path';
import vm from 'vm';

/**
 * Test regresyjny wariantu A (httpOnly-first, P1.4c/d):
 * login → me → 401 bez sesji → logout na mocku fetch/cookie.
 * Frontend NIGDY nie zapisuje ani nie wysyła surowego tokenu —
 * sesję niesie wyłącznie cookie httpOnly (credentials).
 */
function readJs(rel: string): string {
    return fs.readFileSync(path.join(__dirname, '../../public/js', rel), 'utf8');
}

function memStorage() {
    const m = new Map<string, string>();
    return {
        getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
        setItem: (k: string, v: string) => void m.set(k, String(v)),
        removeItem: (k: string) => void m.delete(k),
        _size: () => m.size
    };
}

function baseSandbox() {
    const localStorage = memStorage();
    const sessionStorage = memStorage();
    const sandbox: any = {
        localStorage,
        sessionStorage,
        document: {
            readyState: 'complete',
            addEventListener: () => undefined,
            getElementById: () => null
        },
        window: {
            addEventListener: () => undefined,
            location: { href: '' }
        },
        logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
        setInterval: () => 0,
        setTimeout,
        clearTimeout,
        AbortController,
        console,
        JSON,
        Promise,
        Map
    };
    sandbox.window.window = sandbox.window;
    // fetchJson sprawdza window.fetch — delegacja do wymiennego sandbox.fetch.
    sandbox.window.fetch = (u: string, o: any) => sandbox.fetch(u, o);
    sandbox.fetch = () => {
        throw new Error('fetch niezmockowany');
    };
    vm.createContext(sandbox);
    return { sandbox, localStorage, sessionStorage };
}

function loadAuth(sandbox: any) {
    vm.runInContext(readJs('shared/auth.js'), sandbox);
}

function loadFetchJson(sandbox: any) {
    // Plik jest modułem ESM — do vm wycinamy słowo kluczowe export.
    const code = readJs('shared/fetchJson.js').replace(
        'export async function fetchJson',
        'async function fetchJson'
    );
    vm.runInContext(code + '\nthis.fetchJsonFn = fetchJson;', sandbox);
    return sandbox.fetchJsonFn;
}

describe('wariant A: httpOnly-first (P1.4c/d)', () => {
    it('brak zapisów/odczytów localStorage.authToken w plikach auth (dozwolone tylko removeItem)', () => {
        const files = [
            'shared/auth.js',
            'shared/dashboard.js',
            'shared/StorageService.js',
            'shared/shareService.js',
            'shared/fetchJson.js'
        ];
        for (const f of files) {
            const src = readJs(f);
            expect(src).not.toMatch(/setItem\s*\(\s*['"]authToken['"]/);
            expect(src).not.toMatch(/getItem\s*\(\s*['"]authToken['"]/);
            expect(src).not.toMatch(/document\.cookie\.match/);
        }
    });

    it('getAuthToken()=null, authHeaders() bez X-Auth-Token, setAuthToken() nic nie zapisuje', () => {
        const { sandbox, localStorage } = baseSandbox();
        loadAuth(sandbox);
        expect(vm.runInContext('getAuthToken()', sandbox)).toBeNull();
        expect(vm.runInContext('authHeaders()', sandbox)).toEqual({
            'Content-Type': 'application/json'
        });
        vm.runInContext("setAuthToken('sekret')", sandbox);
        expect(localStorage.getItem('authToken')).toBeNull();
        expect(localStorage._size()).toBe(0);
    });

    it('fetchJson wymusza credentials i odcina X-Auth-Token callera', async () => {
        const { sandbox } = baseSandbox();
        loadAuth(sandbox);
        const captured: any = {};
        sandbox.fetch = (url: string, opts: any) => {
            captured.url = url;
            captured.opts = opts;
            return Promise.resolve({
                ok: true,
                status: 200,
                json: () => Promise.resolve({ user: { id: 'u1' } })
            });
        };
        const fetchJson = loadFetchJson(sandbox);

        await fetchJson('/api/auth/me', {});
        expect(captured.opts.credentials).toBe('same-origin');
        expect(captured.opts.headers).not.toHaveProperty('X-Auth-Token');

        // Ręczny X-Auth-Token od niemigrowanego callera jest odcinany.
        await fetchJson('/api/x', { headers: { 'X-Auth-Token': 'stary' } });
        expect(captured.opts.headers).not.toHaveProperty('X-Auth-Token');

        // Jawne include callera ma pierwszeństwo (np. logout).
        await fetchJson('/api/auth/logout', { method: 'POST', credentials: 'include' });
        expect(captured.opts.credentials).toBe('include');
    });

    it('mapuje 401/403 bez sięgania po token', async () => {
        const { sandbox } = baseSandbox();
        loadAuth(sandbox);
        sandbox.fetch = () => Promise.resolve({ ok: false, status: 401 });
        const fetchJson = loadFetchJson(sandbox);
        await expect(fetchJson('/api/auth/me', {})).resolves.toEqual({
            error: 'unauthorized'
        });
        sandbox.fetch = () => Promise.resolve({ ok: false, status: 403 });
        await expect(fetchJson('/api/x', {})).resolves.toEqual({ error: 'forbidden' });
    });

    it('łańcuch login → me → 401 bez sesji → logout (mock cookie)', async () => {
        const { sandbox, localStorage } = baseSandbox();
        loadAuth(sandbox);
        // Serwerowy jar cookie (httpOnly — niewidoczny dla kodu pod testem).
        let jar: string | null = null;
        sandbox.fetch = (url: string, opts: any) => {
            const withCookie = opts && opts.credentials && jar;
            if (url === '/api/auth/login' && opts.method === 'POST') {
                jar = 'sesja-abc';
                // Backend wciąż zwraca token w JSON (shim) — frontend ignoruje.
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: () => Promise.resolve({ token: 'sekret', user: { id: 'u1' } })
                });
            }
            if (url === '/api/auth/me') {
                if (withCookie)
                    return Promise.resolve({
                        ok: true,
                        status: 200,
                        json: () => Promise.resolve({ user: { id: 'u1' } })
                    });
                return Promise.resolve({ ok: false, status: 401 });
            }
            if (url === '/api/auth/logout' && opts.method === 'POST') {
                if (!withCookie) return Promise.resolve({ ok: false, status: 401 });
                jar = null;
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: () => Promise.resolve({ ok: true })
                });
            }
            return Promise.resolve({ ok: false, status: 404 });
        };
        const fetchJson = loadFetchJson(sandbox);

        // 1. login stawia sesję (cookie), JSON z tokenem ignorowany
        const login = await sandbox.fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin'
        });
        expect(login.ok).toBe(true);
        expect(localStorage.getItem('authToken')).toBeNull();

        // 2. me działa na samym cookie
        await expect(fetchJson('/api/auth/me', {})).resolves.toEqual({
            user: { id: 'u1' }
        });

        // 3. logout z credentials:include czyści sesję serwerową
        const logout = await sandbox.fetch('/api/auth/logout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include'
        });
        expect(logout.ok).toBe(true);

        // 4. po wygaśnięciu me daje 401
        await expect(fetchJson('/api/auth/me', {})).resolves.toEqual({
            error: 'unauthorized'
        });
    });

    it('appLogout: credentials include, sprzątanie migracyjne, redirect', async () => {
        const { sandbox, localStorage, sessionStorage } = baseSandbox();
        const seen: any = {};
        sandbox.fetch = (url: string, opts: any) => {
            seen.url = url;
            seen.opts = opts;
            return Promise.resolve({
                ok: true,
                status: 200,
                json: () => Promise.resolve({ ok: true })
            });
        };
        loadAuth(sandbox);
        localStorage.setItem('authToken', 'pozostałość-po-migracji');
        sessionStorage.setItem('user', '{"id":"u1"}');
        await vm.runInContext('appLogout()', sandbox);
        expect(seen.url).toBe('/api/auth/logout');
        expect(seen.opts.credentials).toBe('include');
        expect(localStorage.getItem('authToken')).toBeNull();
        expect(sessionStorage.getItem('user')).toBeNull();
        expect(sandbox.window.location.href).toBe('index.html');
    });
});
