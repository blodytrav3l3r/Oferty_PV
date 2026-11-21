import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.join(__dirname, '..', '..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');

describe('kontrakt iframe same-origin', () => {
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

    it('motyw jest wysyłany wyłącznie do odbiorców z własnego originu', () => {
        const theme = read('public/js/shared/theme.js');
        expect(theme).toContain('window.parent.postMessage(msg, window.location.origin)');
        expect(theme).toContain('frame.contentWindow.postMessage(msg, window.location.origin)');
        expect(theme).not.toMatch(/postMessage\(msg,\s*['"]\*['"]\)/);
    });
});
