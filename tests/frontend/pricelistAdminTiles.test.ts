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
        expect(els['pv-tile-rury-next'].textContent).toContain('Zaplanowana: v13-20261115');
        expect(els['pv-tile-studnie-version'].textContent).toBe('—');
        expect(els['pv-tile-studnie-next'].textContent).toBe('Brak zaplanowanej');
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
        expect(context.showToast).toBeUndefined();
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
        expect(router).toContain('params.panel &&');
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
});
