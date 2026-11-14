import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

/**
 * Pulpit jako moduł SPA (#/pulpit → index.html?host=pulpit).
 * Kontrakt: query modułu jest scalane (nie dokleja drugiego `?`), kafel i CSS
 * istnieją, a serwer oznacza tryb osadzony bez nowego inline scriptu.
 */

const ROOT = path.join(__dirname, '..', '..');
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf-8');

function loadSrcHelpers() {
    const src = read('public/js/spa/router.js');
    const start = src.indexOf('function _moduleSrcParts');
    const end = src.indexOf('function _getSpaLogicalSrc');
    if (start === -1 || end <= start) throw new Error('brak helperów src w router.js');

    const context: any = {
        URLSearchParams,
        _TRANSIENT_PARAMS: new Set(['panel', 'pvtype', 'version', 'against']),
        MODULES: {
            rury: { src: 'rury.html' },
            pulpit: { src: 'index.html?host=pulpit' }
        }
    };
    vm.createContext(context);
    vm.runInContext(
        src.slice(start, end) + '\n;({ _moduleSrcParts, _buildModuleSrc, _logicalSrcKey });',
        context
    );
    return context;
}

function loadRouterInitHarness(meProbe: jest.Mock) {
    const src = read('public/js/spa/router.js');
    const listeners: Record<string, () => unknown> = {};
    let retryHandler: (() => unknown) | null = null;
    const retryButton = {
        addEventListener: jest.fn((_event: string, handler: () => unknown) => {
            retryHandler = handler;
        })
    };
    const spaMain = {
        innerHTML: '',
        focus: jest.fn(),
        querySelector: jest.fn((selector: string) =>
            selector === '[data-auth-retry]' ? retryButton : null
        )
    };
    const document = {
        addEventListener: jest.fn((event: string, handler: () => unknown) => {
            listeners[event] = handler;
        }),
        getElementById: jest.fn((id: string) => (id === 'spa-main' ? spaMain : null)),
        querySelectorAll: jest.fn(() => []),
        body: { classList: { add: jest.fn(), remove: jest.fn(), toggle: jest.fn() } }
    };
    const window: any = {
        location: { hash: '#/rury', href: '' },
        meProbe,
        navigateToLogin: jest.fn(),
        addEventListener: jest.fn(),
        clearTimeout: jest.fn(),
        setTimeout: jest.fn(),
        showToast: jest.fn()
    };
    const context: any = { window, document, URLSearchParams, logger: { warn: jest.fn() } };
    vm.createContext(context);
    vm.runInContext(src, context);

    return {
        init: () => listeners.DOMContentLoaded(),
        navigateToLogin: window.navigateToLogin as jest.Mock,
        spaMain,
        retryButton,
        getRetryHandler: () => retryHandler
    };
}

describe('router: scalanie query modułu', () => {
    it('pulpit zachowuje własny parametr host i dokłada cache-bust', () => {
        const ctx = loadSrcHelpers();
        expect(ctx._buildModuleSrc('pulpit', {})).toBe('index.html?host=pulpit&v=2.0');
    });

    it('parametry trasy nie nadpisują host i nie tworzą drugiego `?`', () => {
        const ctx = loadSrcHelpers();
        const url = ctx._buildModuleSrc('pulpit', { tab: 'x', panel: 'ignored' });
        expect(url).toBe('index.html?host=pulpit&tab=x&v=2.0');
        expect(url.split('?')).toHaveLength(2);
        // Trasa `#/pulpit?host=x` nie może wyłączyć trybu osadzonego.
        expect(ctx._buildModuleSrc('pulpit', { host: 'x' })).toBe('index.html?host=pulpit&v=2.0');
        expect(ctx._logicalSrcKey('pulpit', { host: 'x' })).toBe('index.html?host=pulpit');
    });

    it('moduły bez query zachowują dotychczasowy URL', () => {
        const ctx = loadSrcHelpers();
        expect(ctx._buildModuleSrc('rury', {})).toBe('rury.html?v=2.0');
        expect(ctx._logicalSrcKey('pulpit', {})).toBe('index.html?host=pulpit');
        expect(ctx._logicalSrcKey('rury', { tab: 'a' })).toBe('rury.html?tab=a');
    });
});

describe('pulpit: rejestracja i nawigacja', () => {
    it('router zna moduł pulpit i jego kafel', () => {
        const src = read('public/js/spa/router.js');
        expect(src).toMatch(/pulpit:\s*\{\s*\/\/[^]*?src:\s*'index\.html\?host=pulpit'/);
        expect(src).toMatch(/pulpit:\s*'spa-app-pulpit'/);
    });

    it('kafel w app.html prowadzi trasą SPA, nie pełnym przeładowaniem', () => {
        const html = read('public/app.html');
        expect(html).toMatch(/<a href="#\/pulpit" class="nav-tile" id="spa-app-pulpit"/);
        expect(html).not.toMatch(/<a href="index\.html" class="nav-tile"/);
    });

    it('CSS chowa elementy strony wejścia w trybie osadzonym', () => {
        const css = read('public/css/index.css');
        expect(css).toContain("html[data-embedded='pulpit'] #dash-header");
        expect(css).toContain("html[data-embedded='pulpit'] #page-loader");
        expect(css).toContain("html[data-embedded='pulpit'] #login-section");
        expect(css).toContain("html[data-embedded='pulpit'] .index-logo");
    });

    it('dashboard zna tryb osadzony: login/redirect/nawigacja trasami shella', () => {
        const src = read('public/js/shared/dashboard.js');
        expect(src).toContain("getAttribute('data-embedded') === 'pulpit'");
        expect(src).toContain("get('host') === 'pulpit'");
        expect(src).toContain('probeEmbeddedSession');
        expect(src).toContain('__sokNavigateShell');
        expect(src).toContain('window.parent.location.hash = hash');
        expect(src).toContain("window.location.replace('app.html#/pulpit')");
    });

    it('wolne /me i błąd 5xx nie wyrzucają usera z shella', () => {
        const src = read('public/js/shared/dashboard.js');
        // Timer w trybie osadzonym tylko zdejmuje auth-pending.
        const timerStart = src.indexOf('const authTimer');
        const embeddedStart = src.indexOf('if (embedded) {');
        expect(timerStart).toBeGreaterThan(-1);
        expect(embeddedStart).toBeGreaterThan(timerStart);
        const timerBlock = src.slice(timerStart, embeddedStart);
        expect(timerBlock).not.toContain('redirectToLogin');
        // Brak sesji rozpoznaje wyłącznie 401/403; inne błędy kończą się pustą ramką.
        expect(src).toContain('res.status === 401 || res.status === 403');
        expect(src).toMatch(/else if \(probe\.expired\) \{\s*finish\(redirectToLogin\)/);
    });

    it('kontrakt __sok* obsługuje wejście do logowania i trasę shella', () => {
        const sok = read('public/js/shared/sokDirty.js');
        expect(sok).toMatch(/function __sokGoLogin\(\)[\s\S]*?window\.top\.location\.href/);
        expect(sok).toMatch(
            /function __sokNavigateShell\(hash\)[\s\S]*?window\.parent\.location\.hash = hash/
        );
        expect(sok).toContain('window.__sokGoLogin = __sokGoLogin');
        expect(sok).toContain('window.__sokNavigateShell = __sokNavigateShell');
        // Ramka pulpitu musi mieć kontrakt: index.html ładuje sokDirty.js.
        expect(read('public/index.html')).toContain('js/shared/sokDirty.js');
    });

    it('logout i wygaśnięcie sesji nawigują okno najwyższe', () => {
        const auth = read('public/js/shared/auth.js');
        expect(auth).toMatch(/function navigateToLogin\(\)[\s\S]*?window\.top\.location\.href/);
        const idle = read('public/js/shared/sessionIdle.js');
        expect(idle).toContain('window.navigateToLogin');
        expect(idle).toContain('function goLoginPage()');
    });
});

describe('router: stan sesji podczas startu', () => {
    it('401 przekierowuje do logowania', async () => {
        const meProbe = jest.fn().mockResolvedValue({ status: 401, ok: false, user: null });
        const harness = loadRouterInitHarness(meProbe);

        await harness.init();

        expect(meProbe).toHaveBeenCalledTimes(1);
        expect(harness.navigateToLogin).toHaveBeenCalledTimes(1);
        expect(harness.spaMain.innerHTML).toBe('');
    });

    it('odpowiedź 200 bez użytkownika przekierowuje do logowania', async () => {
        const meProbe = jest.fn().mockResolvedValue({ status: 200, ok: true, user: null });
        const harness = loadRouterInitHarness(meProbe);

        await harness.init();

        expect(harness.navigateToLogin).toHaveBeenCalledTimes(1);
        expect(harness.spaMain.innerHTML).toBe('');
    });

    it('503 pokazuje stan błędu i ponawia probe po kliknięciu', async () => {
        const meProbe = jest
            .fn()
            .mockResolvedValueOnce({ status: 503, ok: false, user: null })
            .mockResolvedValueOnce({ status: 401, ok: false, user: null });
        const harness = loadRouterInitHarness(meProbe);

        await harness.init();

        expect(harness.navigateToLogin).not.toHaveBeenCalled();
        expect(harness.spaMain.innerHTML).toContain('Nie można połączyć się z serwerem');
        expect(harness.retryButton.addEventListener).toHaveBeenCalledWith(
            'click',
            expect.any(Function)
        );

        await harness.getRetryHandler()?.();

        expect(meProbe).toHaveBeenCalledTimes(2);
        expect(harness.navigateToLogin).toHaveBeenCalledTimes(1);
    });

    it('błąd sieci pokazuje stan ponowienia zamiast przekierowania', async () => {
        const meProbe = jest.fn().mockRejectedValue(new Error('network unavailable'));
        const harness = loadRouterInitHarness(meProbe);

        await harness.init();

        expect(harness.navigateToLogin).not.toHaveBeenCalled();
        expect(harness.spaMain.innerHTML).toContain('Nie można połączyć się z serwerem');
        expect(harness.retryButton.addEventListener).toHaveBeenCalledWith(
            'click',
            expect.any(Function)
        );
    });
});

describe('serwer: znacznik trybu osadzonego', () => {
    function loadMarker() {
        const src = read('src/app.ts');
        const start = src.indexOf('function injectEmbeddedMarker');
        const end = src.indexOf('app.use((req, res, next) => {', start);
        if (start === -1 || end <= start) throw new Error('brak injectEmbeddedMarker');
        const context: any = {};
        vm.createContext(context);
        // Wycinek to TypeScript — vm przyjmuje tylko JS, więc zdejmujemy adnotacje.
        const js = src.slice(start, end).replace(/:\s*string/g, '');
        vm.runInContext(js + '\n;({ injectEmbeddedMarker });', context);
        return context.injectEmbeddedMarker as (html: string) => string;
    }

    it('znacznik ląduje na <html>, reszta dokumentu bez zmian', () => {
        const mark = loadMarker();
        const html = '<!doctype html>\n<html lang="pl">\n<head></head>\n</html>';
        expect(mark(html)).toBe(
            '<!doctype html>\n<html lang="pl" data-embedded="pulpit">\n<head></head>\n</html>'
        );
    });

    it('znacznik tylko dla index.html i host=pulpit', () => {
        const src = read('src/app.ts');
        expect(src).toMatch(/rel === 'index\.html' && host === 'pulpit'/);
        // `?host=pulpit&host=x` daje tablicę — bez normalizacji marker by zniknął.
        expect(src).toContain('Array.isArray(req.query.host)');
    });
});
