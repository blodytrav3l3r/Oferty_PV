import fs from 'fs';
import path from 'path';
import vm from 'vm';

/**
 * Kafelki cenników na pulpicie admina + deep-link do panelu wersji.
 * Hydratacja: jedno GET /summary, textContent, fail-soft bez toastu.
 */

const ROOT = path.join(__dirname, '..', '..');
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf-8');

const flush = async (n = 20) => {
    for (let i = 0; i < n; i++) await new Promise((r) => setTimeout(r, 0));
};

function loadDashboard(fetchImpl: any) {
    const els: Record<string, any> = {};
    const el = (id: string) =>
        (els[id] = els[id] || {
            textContent: '',
            innerHTML: '',
            value: '',
            dataset: {},
            classList: { add() {}, remove() {}, toggle() {} },
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
        location: { href: '' }
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

const summaryPayload = {
    generatedAt: '2026-10-20T08:00:00.000Z',
    types: {
        rury: {
            active: {
                id: 'r1',
                version: 'v12-20261001',
                seq: 12,
                effectiveFrom: '2026-10-01T00:00:00.000Z',
                status: 'ACTIVE'
            },
            nextScheduled: {
                id: 'r2',
                version: 'v13-20261115',
                seq: 13,
                effectiveFrom: '2026-11-15T00:00:00.000Z',
                status: 'SCHEDULED'
            }
        },
        studnie: { active: null, nextScheduled: null },
        preco: {
            active: {
                id: 'p1',
                version: 'v3-20260910',
                seq: 3,
                effectiveFrom: '2026-09-10T00:00:00.000Z',
                status: 'ACTIVE'
            },
            nextScheduled: null
        }
    }
};

describe('pulpit admina: kafelki cenników', () => {
    const html = read('public/index.html');
    const admin = html.slice(
        html.indexOf('id="admin-panel"'),
        html.indexOf('User Management Widget')
    );

    it('3 kafelki tylko w #admin-panel, jako linki z deep-linkiem', () => {
        expect(admin).toContain('id="pricelist-tiles"');
        expect(admin).toContain('app.html#/rury?tab=pricelist&amp;panel=versions');
        expect(admin).toContain('app.html#/studnie?tab=pricelist&amp;panel=versions');
        expect(admin).toContain(
            'app.html#/studnie?tab=pricelist&amp;panel=versions&amp;pvtype=preco'
        );
        expect(admin).toContain('aria-live="polite"');
        expect(admin).toContain('pv-tile-preco-next');
    });

    it('hydratacja: jedno /summary i textContent (bez innerHTML)', async () => {
        const calls: string[] = [];
        const { context, els } = loadDashboard(async (url: string) => {
            calls.push(String(url));
            if (String(url).includes('/summary')) {
                return { ok: true, json: async () => summaryPayload };
            }
            return { ok: true, json: async () => ({}) };
        });
        await context.showLoggedIn({ role: 'admin', username: 'a', firstName: 'A' });
        await flush();

        expect(calls.filter((u) => u.includes('/api/pricelist-versions/summary'))).toHaveLength(1);
        expect(els['pv-tile-rury-version'].textContent).toBe('v12-20261001');
        expect(els['pv-tile-rury-date'].textContent).toContain('od ');
        expect(els['pv-tile-rury-next'].textContent).toContain('Do wdrożenia: v13-20261115');
        expect(els['pv-tile-studnie-version'].textContent).toBe('—');
        expect(els['pv-tile-studnie-next'].textContent).toBe('Brak do wdrożenia');
        expect(els['pv-tile-preco-version'].textContent).toBe('v3-20260910');
    });

    it('fail-soft: błąd /summary zostawia placeholdery, bez toastu', async () => {
        const { context, els } = loadDashboard(async (url: string) => {
            if (String(url).includes('/summary')) return { ok: false, json: async () => ({}) };
            return { ok: true, json: async () => ({}) };
        });
        for (const type of ['rury', 'studnie', 'preco']) {
            context.document.getElementById('pv-tile-' + type + '-version').textContent = '—';
        }
        await context.showLoggedIn({ role: 'admin', username: 'a' });
        await flush();
        expect(els['pv-tile-rury-version'].textContent).toBe('—');
        expect(context.showToast).not.toHaveBeenCalled();
    });
});

describe('SPA: deep-link do panelu wersji', () => {
    const router = read('public/js/spa/router.js');
    const rury = read('public/js/rury/pricelistUi.js');
    const studnie = read('public/js/studnie/pricelistManager.js');

    it('parametry panelu nie trafiają do src/logical key', () => {
        expect(router).toContain(
            "_TRANSIENT_PARAMS = new Set(['panel', 'pvtype', 'version', 'against'])"
        );
        expect(router).toContain('if (_TRANSIENT_PARAMS.has(k)) return;');
        expect(router).toContain("if (k === 'v' || _TRANSIENT_PARAMS.has(k)) return;");
    });

    it('brudna oferta: confirm przed otwarciem panelu', () => {
        expect(router).toContain("params.panel === 'versions' &&");
        expect(router).toContain("window.location.hash = _lastCleanHash || '#/' + currentModule");
    });

    it('otwiera panel per modul i typ, potem preview z allowlistą', () => {
        expect(router).toContain("module === 'rury' ? 'rury'");
        expect(router).toContain("params.pvtype === 'preco' ? 'preco' : 'studnie'");
        expect(router).toContain('openRuryVersionsPanel()');
        expect(router).toContain('openStudnieVersionsPanel(panelType)');
        expect(router).toContain('pv.openFromDeepLink(');
        expect(router).toContain('/^[A-Za-z0-9_-]{1,64}$/');
    });

    it('wrapper paneli zwraca promise (sekwencja panel → preview)', () => {
        expect(rury).toContain('return window.pricelistVersions.openVersionsPanel(');
        expect(studnie).toContain('return window.pricelistVersions.openVersionsPanel(type, {');
    });

    it('nowy iframe (about:blank) nie jest uznawany za gotowy', () => {
        expect(router).toContain("location.href === 'about:blank'");
        expect(router).toContain('readyState === ');
    });

    it('timeout load nie kończy się cichym brakiem panelu (retry + toast)', () => {
        expect(router).toContain('waitForFunction(iframeWin, opener)');
        expect(router).toContain('Nie udało się otworzyć panelu wersji cennika');
        expect(router).toContain('openPreview(attempt + 1)');
    });
});

describe('S3: hub cenników — deep-link do historii', () => {
    const hub = read('public/js/cennikiHub.js');
    const html = read('public/cenniki.html');

    it('czyta hash rodzica i obsługuje #/cenniki/historia', () => {
        expect(hub).toContain('window.parent.location.hash');
        expect(hub).toContain('/\\/historia(?:[/?]|$)/.test(hash)');
        expect(hub).toContain("params.tab = 'historia'");
    });

    it('typ + version/id + against trafiają do preview/diff z allowlistą', () => {
        expect(hub).toContain('params.version || params.id');
        expect(hub).toContain("['rury', 'studnie', 'preco'].includes(params.type)");
        expect(hub).toContain('/^[A-Za-z0-9_-]{1,64}$/.test(id)');
        expect(hub).toContain('api.openDiff(id, params.against, type)');
        expect(hub).toContain('api.openPreview(id, type)');
        expect(hub).toContain('applyDeepLink(attempt + 1)');
    });

    it('historia: kafelki wersji domyślnie, tabela tylko jako wariant gęsty', () => {
        // Widok domyślny: kafelki wersji (kafelek = wersja).
        expect(hub).toContain('cenniki-tile--version');
        expect(hub).toContain('renderHistoryTiles');
        expect(html).toContain('cenniki-tiles--versions');
        expect(html).toMatch(/id="cenniki-history-body"[\s\S]{0,200}role="group"/);
        // Tabela 9 kolumn (z Notą i Kontrolą) zostaje jako wariant gęsty (> 20 wersji).
        expect(html).toContain('<th>Nota</th>');
        expect(html).toContain('<th>Kontrola</th>');
        expect(hub).toContain('colspan="9"');
        expect(hub).toContain('cenniki-note');
        expect(hub).toContain('const HISTORY_TABLE_THRESHOLD = 20;');
    });
});

describe('M2: panel cenników — admin-only + kafelki', () => {
    const hub = read('public/js/cennikiHub.js');
    const html = read('public/cenniki.html');
    const css = read('public/css/cenniki.css');
    const router = read('public/js/spa/router.js');
    const appHtml = read('public/app.html');

    it('router odcina moduł cenniki dla nie-admina (BE i tak wymaga admina)', () => {
        expect(router).toContain("module === 'cenniki'");
        expect(router).toContain("window.currentUser.role !== 'admin'");
        expect(router).toContain("window.location.hash = '#/rury'");
    });

    it('kafelek nav „Cenniki" ukryty dla nie-admina', () => {
        expect(appHtml).toContain('id="spa-app-cenniki"');
        expect(router).toContain('spa-app-cenniki');
        expect(router).toContain("cennikiTile.classList.add('hidden')");
    });

    it('przegląd zbudowany z kafelków: oś → 4 kafelki stanów', () => {
        expect(html).toContain('cenniki-tiles--axes');
        expect(hub).toContain('cenniki-tile--axis');
        expect(hub).toContain('cenniki-tile--active');
        expect(hub).toContain('cenniki-tile--scheduled');
        expect(hub).toContain('cenniki-tile--draft');
        expect(hub).toContain('cenniki-tile--archived');
        expect(css).toContain('.cenniki-tiles {');
        expect(css).toContain('.cenniki-tile {');
    });

    it('komunikat: bufor (szkic) nie zmienia ofert', () => {
        expect(html).toContain('cenniki-banner');
        expect(html).toContain('Bufor (szkic) nie zmienia ofert');
    });

    it('nowe klasy CSS na tokenach S.O.K. (zero własnych hexów)', () => {
        const start = css.indexOf('.cenniki-tiles {');
        const end = css.indexOf('.cenniki-toolbar {');
        expect(start).toBeGreaterThan(-1);
        const block = css.slice(start, end);
        expect(block).not.toMatch(/#[0-9a-fA-F]{3,8}/);
        expect(block).toContain('var(--tile-gap-md)');
    });
});
