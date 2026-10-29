// @ts-check
/**
 * Tryb wirtualizacji Excel musi być odczytywalny jednoznacznie.
 * `_excelVirtualIsEnabled()` to tylko bramka env (kill-switch), nie stan patcha —
 * dlatego `_excelVirtualMode` ustawiany jest dopiero po podmianie rendera.
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';

const SRC = fs.readFileSync(
    path.join(__dirname, '../../public/js/studnie/excelVirtual.js'),
    'utf8'
);

interface BootOpts {
    killSwitch?: boolean;
    withRenderer?: boolean;
}

function boot(opts: BootOpts = {}) {
    const { killSwitch = false, withRenderer = true } = opts;
    const renderer = function (dn: string) {
        return 'legacy:' + dn;
    };
    const context: any = {
        wells: [],
        studnieProducts: [],
        _excelActiveTab: '1000',
        _excelMaxTransitions: { '1000': 1 },
        _excelRowSelectStates: {},
        _excelColWidths: {},
        _excelHiddenColumnIds: [],
        _excelSelectedCells: [],
        _excelSelectedCols: [],
        DN_COLORS: {},
        LAYERS_EXCEL: { STICKY_COLUMN: 5 },
        KINETA_OPTIONS: [],
        console,
        setTimeout,
        clearTimeout,
        document: {
            getElementById: () => null,
            addEventListener: () => {},
            querySelector: () => null,
            querySelectorAll: () => [],
            createElement: () => ({})
        },
        localStorage: {
            getItem: (key: string) => (killSwitch && key === 'sok_excel_virtual' ? '0' : null)
        },
        location: { search: killSwitch ? '?virtual=0' : '' }
    };
    context.window = context;
    if (withRenderer) context._excelRenderTable = renderer;
    vm.createContext(context);
    vm.runInContext(SRC, context);
    return { context, renderer };
}

describe('excelVirtual — jednoznaczny tryb (_excelVirtualMode)', () => {
    test('domyślnie: patch wirtualny aktywny, renderer podmieniony', () => {
        const { context, renderer } = boot();
        expect(context._excelVirtualIsEnabled()).toBe(true);
        expect(context._excelVirtualSettingEnabled()).toBe(true);
        expect(context._excelVirtualMode).toBe('virtual');
        expect(context._excelRenderTable).not.toBe(renderer);
        // marker patcha: wrapper rozwiązuje scroll przed header-only renderem
        expect(String(context._excelRenderTable)).toContain('_savedTop');
    });

    test('kill-switch (localStorage / ?virtual=0): legacy, renderer nietknięty', () => {
        const { context, renderer } = boot({ killSwitch: true });
        expect(context._excelVirtualIsEnabled()).toBe(false);
        expect(context._excelVirtualSettingEnabled()).toBe(false);
        expect(context._excelVirtualMode).toBe('legacy');
        expect(context._excelRenderTable).toBe(renderer);
    });

    test('brak rendera do podmiany: legacy, bez wyjątku', () => {
        const { context } = boot({ withRenderer: false });
        expect(context._excelVirtualMode).toBe('legacy');
        expect(context._excelRenderTable).toBeUndefined();
    });
});

const TABS_SRC = fs.readFileSync(
    path.join(__dirname, '../../public/js/studnie/excelTabs.js'),
    'utf8'
);

describe('wskaźnik UI trybu wirtualizacji', () => {
    function bootBadge(mode: 'virtual' | 'legacy', settingOn: boolean) {
        const badge: any = { textContent: '', title: '', dataset: {} };
        const count: any = { textContent: '' };
        const context: any = {
            wells: [{}, {}],
            _excelVirtualMode: mode,
            _excelVirtualSettingEnabled: () => settingOn,
            escapeHtmlAttr: (s: string) => s,
            document: {
                hidden: false,
                addEventListener: () => {},
                getElementById: (id: string) => {
                    if (id === 'excel-virtual-mode') return badge;
                    if (id === 'excel-well-count') return count;
                    return null;
                }
            }
        };
        context.window = Object.assign(context, { addEventListener: () => {} });
        vm.createContext(context);
        vm.runInContext(TABS_SRC, context);
        return { context, badge, count };
    }

    test('virtual + kill-switch zgodny → „Wirtualizacja: ON”, bez adnotacji', () => {
        const { context, badge, count } = bootBadge('virtual', true);
        context._excelUpdateWellCount(); // ten sam hook co render/otwarcie tabeli
        expect(count.textContent).toBe('2 studni');
        expect(badge.textContent).toBe('Wirtualizacja: ON');
        expect(badge.dataset.mode).toBe('virtual');
        expect(badge.dataset.pending).toBe('0');
        expect(badge.title).toContain('?virtual=0');
    });

    test('legacy + kill-switch zgodny → „Wirtualizacja: OFF”', () => {
        const { context, badge } = bootBadge('legacy', false);
        context._excelUpdateWellCount();
        expect(badge.textContent).toBe('Wirtualizacja: OFF');
        expect(badge.dataset.mode).toBe('legacy');
        expect(badge.dataset.pending).toBe('0');
    });

    test('kill-switch zmieniony po starcie → adnotacja „(po przeładowaniu)”', () => {
        const { context, badge } = bootBadge('virtual', false);
        context._excelUpdateWellCount();
        expect(badge.textContent).toBe('Wirtualizacja: ON (po przeładowaniu)');
        expect(badge.dataset.pending).toBe('1');
        expect(badge.title).toContain('przeładowaniu');
    });
});
