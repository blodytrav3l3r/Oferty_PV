import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.join(__dirname, '..', '..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');

describe('kontrakt iframe same-origin', () => {
    const getFunctionSource = (source: string, functionName: string, nextAnchor: string) => {
        const start = source.indexOf(`function ${functionName}`);
        const end = source.indexOf(nextAnchor, start + 1);
        expect(start).toBeGreaterThanOrEqual(0);
        expect(end).toBeGreaterThan(start);
        return source.slice(start, end);
    };

    const dirtyApi = [
        '__sokIsDirty',
        '__sokDescribeDirty',
        '__sokSaveDirty',
        '__sokCanSave',
        '__sokKindLabel',
        '__sokDirtyWindow',
        '__sokCountDrafts',
        '__sokAbandonLocal',
        '__sokAbandonCurrent',
        '__sokGoLogin',
        '__sokNavigateShell'
    ];

    it('deklaruje każde API niezapisanych zmian w typach i publikuje je w sokDirty', () => {
        const types = read('public/js/types.d.ts');
        const dirty = read('public/js/shared/sokDirty.js');

        dirtyApi.forEach((name) => {
            expect(types).toContain(name);
            expect(dirty).toContain(`window.${name} =`);
        });
    });

    it('opisuje API powłoki i nie twierdzi, że cała komunikacja biegnie przez __sok*', () => {
        const types = read('public/js/types.d.ts');
        const router = read('public/js/spa/router.js');
        const adr = read('docs/adr/ADR-014-iframe-boundary.md');

        expect(types).toContain('interface SpaRouterApi');
        expect(types).toContain('SpaRouter?: SpaRouterApi');
        expect(router).toContain('window.SpaRouter = api;');
        expect(adr).toContain('window.SpaRouter');
        expect(adr).toContain('CennikHost.activate');
        expect(adr).not.toContain('Cały ruch parent↔iframe wyłącznie');
    });

    it('dokumentuje mostki modułów używane przez odświeżanie powłoki', () => {
        const router = read('public/js/spa/router.js');
        const adr = read('docs/adr/ADR-014-iframe-boundary.md');
        const moduleBridge = getFunctionSource(router, 'getModuleBridge', 'function showSection');
        const refreshModule = getFunctionSource(
            router,
            'refreshModule',
            'async function refreshProductionOrders'
        );
        const refreshProductionOrders = getFunctionSource(
            router,
            'refreshProductionOrders',
            'document.addEventListener'
        );
        const bridges = [
            'AppZlecenia.loadOrders',
            'AppKartoteka.loadOffers',
            'kartotekaUI.loadLocalOffers',
            'loadProductionOrders',
            'auditPzElementKeyMismatch',
            'renderZleceniaList',
            'renderZleceniaWellConfig',
            'refreshAll'
        ];

        bridges.forEach((bridge) => {
            const [owner, method] = bridge.includes('.') ? bridge.split('.') : ['', bridge];
            expect(router).toContain(method);
            expect(adr).toContain(bridge);
            if (owner) expect(adr).toContain(owner);
        });

        expect(moduleBridge).toContain("win.AppZlecenia, 'loadOrders'");
        expect(moduleBridge).toContain("win.AppKartoteka, 'loadOffers'");
        expect(moduleBridge).toContain("win.kartotekaUI, 'loadLocalOffers'");
        expect(moduleBridge).toContain('win.loadProductionOrders(false, true)');
        expect(moduleBridge).toContain("call(win, 'auditPzElementKeyMismatch')");
        expect(moduleBridge).toContain("call(win, 'renderZleceniaList')");
        expect(moduleBridge).toContain("call(win, 'renderZleceniaWellConfig')");
        expect(moduleBridge).toContain("call(win, 'refreshAll')");
        expect(refreshModule).toContain('getModuleBridge(module)');
        expect(refreshModule).not.toContain('AppZlecenia');
        expect(refreshModule).not.toContain('AppKartoteka');
        expect(refreshProductionOrders).toContain("getModuleBridge('studnie')");
        expect(refreshProductionOrders).not.toContain('win.loadProductionOrders');
    });

    it('motyw jest wysyłany wyłącznie do odbiorców z własnego originu', () => {
        const theme = read('public/js/shared/theme.js');
        expect(theme).toContain('window.parent.postMessage(msg, window.location.origin)');
        expect(theme).toContain('frame.contentWindow.postMessage(msg, window.location.origin)');
        expect(theme).not.toMatch(/postMessage\(msg,\s*['"]\*['"]\)/);
    });
});
