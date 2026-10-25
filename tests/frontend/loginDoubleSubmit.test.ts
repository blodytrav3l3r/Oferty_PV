import fs from 'fs';
import path from 'path';
import vm from 'vm';

/**
 * Regresja: podwójne kliknięcie „Zaloguj się" wysyłało dwa POST /api/auth/login.
 * Backend tworzy sesję na każde logowanie, więc drugi request zostawiał
 * osierocony wiersz sesji liczony w panelu admina („Aktywne sesje").
 * Kontrakt: jeden login naraz, flaga zwalniana po zakończeniu.
 */

const ROOT = path.join(__dirname, '..', '..');
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf-8');

function loadDashboard() {
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
        fetch: jest.fn(),
        escapeHtml: (s: unknown) => String(s ?? ''),
        escapeHtmlAttr: (s: unknown) => String(s ?? ''),
        logger: { info() {}, warn() {}, error() {} },
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
        appConfirm: jest.fn(async () => true)
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
    // Pola logowania istnieją w index.html — harness tworzy je z góry,
    // bo dashboard.js sięga po nie dopiero w doLogin().
    ['login-username', 'login-password', 'login-error'].forEach(el);
    vm.runInContext(read('public/js/shared/dashboard.js'), context);
    return { context, els };
}

function failedLogin(error = 'Błędny login lub hasło') {
    return { ok: false, status: 401, json: async () => ({ error }) };
}

describe('pulpit: podwójne logowanie', () => {
    it('dwa równoległe doLogin() → jeden request', async () => {
        const { context, els } = loadDashboard();
        els['login-username'].value = 'admin';
        els['login-password'].value = 'tajne';

        let resolveFetch: any;
        const pending = new Promise((r) => {
            resolveFetch = r;
        });
        context.fetch.mockReturnValueOnce(pending);

        const first = context.window.doLogin();
        const second = context.window.doLogin();

        expect(context.fetch).toHaveBeenCalledTimes(1);

        resolveFetch(failedLogin());
        await first;
        await second;
        expect(els['login-error'].textContent).toBe('Błędny login lub hasło');
    });

    it('flaga zwalniana po zakończeniu — kolejne logowanie idzie do API', async () => {
        const { context, els } = loadDashboard();
        els['login-username'].value = 'admin';
        els['login-password'].value = 'tajne';

        context.fetch.mockResolvedValue(failedLogin());

        await context.window.doLogin();
        await context.window.doLogin();

        expect(context.fetch).toHaveBeenCalledTimes(2);
    });

    it('puste pola nie ustawiają flagi — kolejna próba wysyła request', async () => {
        const { context, els } = loadDashboard();
        els['login-username'].value = '';
        els['login-password'].value = '';

        await context.window.doLogin();
        expect(context.fetch).not.toHaveBeenCalled();
        expect(els['login-error'].textContent).toBe('Podaj login i hasło');

        els['login-username'].value = 'admin';
        els['login-password'].value = 'tajne';
        context.fetch.mockResolvedValue(failedLogin());
        await context.window.doLogin();

        expect(context.fetch).toHaveBeenCalledTimes(1);
    });
});
