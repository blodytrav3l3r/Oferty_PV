// @ts-nocheck -- vm sandbox, celowy brak typow dla public/js
import fs from 'fs';
import path from 'path';
import vm from 'vm';

/** A1: klasyfikacja błędów zapisu + A3: jednorazowy toast offline. */
function readJs(rel: string): string {
    return fs.readFileSync(path.join(__dirname, '../../public/js', rel), 'utf8');
}

function loadUi(navigatorOnLine = true) {
    const sandbox: any = {
        console,
        navigator: { onLine: navigatorOnLine },
        window: {} as any,
        lockService: undefined,
        logger: { info: () => {}, warn: () => {}, error: () => {} }
    };
    sandbox.window = sandbox;
    sandbox.window.lockService = undefined;
    vm.createContext(sandbox);
    // ui.js ma więcej zależności — wycinamy do testowanego fragmentu przez
    // bezpośrednie wczytanie tylko gdy brak twardych zależności load-time.
    // saveErrorKind/saveOfflineMessage nie zależą od DOM przy definicji.
    try {
        vm.runInContext(readJs('shared/ui.js'), sandbox, { filename: 'ui.js' });
    } catch (_e) {
        // fallback: zrekonstruuj helpery z pliku (wyodrębnij funkcje)
        const src = readJs('shared/ui.js');
        const start = src.indexOf('function saveErrorKind');
        const nextDoc = src.indexOf('Pobiera listę użytkowników', start > 0 ? start : 0);
        const end = nextDoc > 0 ? src.lastIndexOf('/**', nextDoc) : src.length;
        vm.runInContext(src.slice(start > 0 ? start : 0, end > 0 ? end : src.length), sandbox, {
            filename: 'ui-saveErrorKind.js'
        });
    }
    return sandbox;
}

describe('A1 saveErrorKind', () => {
    it('TypeError → network, AbortError → network, nie offline', () => {
        const s = loadUi(true);
        // Błąd tworzony W sandboxie (instanceof nie działa między realmami vm).
        const terr = vm.runInContext('new TypeError("fetch failed")', s);
        expect(s.window.saveErrorKind(terr)).toBe('network');
        const abort = new Error('aborted');
        abort.name = 'AbortError';
        expect(s.window.saveErrorKind(abort)).toBe('network');
    });

    it('navigator.onLine === false → offline', () => {
        const s = loadUi(false);
        expect(s.window.saveErrorKind(new TypeError('x'))).toBe('offline');
        expect(s.window.saveErrorKind({ status: 500 })).toBe('offline');
    });

    it('409 → conflict, HTTP → server, puste → unknown', () => {
        const s = loadUi(true);
        expect(s.window.saveErrorKind({ status: 409 })).toBe('conflict');
        expect(s.window.saveErrorKind({ code: 'VERSION_CONFLICT' })).toBe('conflict');
        expect(s.window.saveErrorKind({ status: 500 })).toBe('server');
        expect(s.window.saveErrorKind(null)).toBe('unknown');
        expect(s.window.saveErrorKind('tekst')).toBe('unknown');
    });

    it('saveOfflineMessage tylko dla offline/network', () => {
        const s = loadUi(true);
        expect(s.window.saveOfflineMessage('offline')).toContain('drafcie');
        expect(s.window.saveOfflineMessage('network')).toContain('drafcie');
        expect(s.window.saveOfflineMessage('server')).toBeNull();
        expect(s.window.saveOfflineMessage('conflict')).toBeNull();
    });
});

describe('A3 jednorazowy toast offline', () => {
    function loadAuth() {
        type AnyFn = (...args: any[]) => any;
        const listeners: Record<string, AnyFn[]> = { online: [], offline: [] };
        const toasts: any[] = [];
        const sandbox: any = {
            console,
            showToast: (msg: string, type: string) => void toasts.push({ msg, type }),
            fetch: async () => ({ ok: true, status: 200 }),
            setTimeout: (_fn: AnyFn) => 0,
            clearTimeout: () => {},
            setInterval: () => 0,
            logger: { info: () => {}, warn: () => {}, error: () => {} },
            document: {
                readyState: 'loading',
                getElementById: () => null,
                addEventListener: (evt: string, fn: AnyFn) => {
                    if (evt === 'DOMContentLoaded') fn();
                }
            },
            window: {} as any
        };
        sandbox.window = sandbox;
        sandbox.window.addEventListener = (evt: string, fn: AnyFn) => {
            (listeners[evt] = listeners[evt] || []).push(fn);
        };
        vm.createContext(sandbox);
        vm.runInContext(readJs('shared/auth.js'), sandbox, { filename: 'auth.js' });
        return { sandbox, listeners, toasts };
    }

    it('offline → toast raz; powtórka bez online → cisza; online → offline → znowu', () => {
        const { listeners, toasts } = loadAuth();
        const fire = (evt: string) => listeners[evt].forEach((fn) => fn());
        fire('offline');
        expect(toasts.length).toBe(1);
        fire('offline');
        expect(toasts.length).toBe(1);
        fire('online');
        fire('offline');
        expect(toasts.length).toBe(2);
        expect(toasts[0].msg).toContain('offline');
    });
});
