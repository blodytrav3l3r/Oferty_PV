// @ts-nocheck -- vm sandbox, celowy brak typow dla public/js
import fs from 'fs';
import path from 'path';
import vm from 'vm';

/**
 * Regresja: quick-edit po re-sorcie well.przejscia (renderWellPrzejscia
 * mutuje kolejność przy każdym renderze). Indeks policzony przed zapisem
 * wskazuje zły wiersz → brak inputa (2. klik) albo zapis w złe przejście.
 * resolvePrzejscieIndex po stabilnym data-prz-id jest odporny na re-sort.
 */
function readJs(rel: string): string {
    return fs.readFileSync(path.join(__dirname, '../../public/js', rel), 'utf8');
}

function loadRenderer(extra: object = {}) {
    const sandbox: any = {
        console,
        FLOW_TYPES: { WYLOT: 'WYLOT', WLOT: 'WLOT' },
        escapeHtml: (s: any) => String(s === null || s === undefined ? '' : s),
        window: {},
        ...extra
    };
    vm.createContext(sandbox);
    vm.runInContext(readJs('studnie/transitionRenderer.js'), sandbox, {
        filename: 'transitionRenderer.js'
    });
    return sandbox;
}

const elStub = (przId: string | null) => ({
    getAttribute: (name: string) => (name === 'data-prz-id' ? przId : null)
});

describe('resolvePrzejscieIndex — odporność na re-sort (P0)', () => {
    it('trafia wiersz po id mimo nieaktualnego fallbacku', () => {
        const sb = loadRenderer();
        // Kolejność po re-sorcie: B, A (fallback 0 wskazuje już zły wiersz).
        const well = { przejscia: [{ id: 'pz-B' }, { id: 'pz-A' }] };
        expect(sb.resolvePrzejscieIndex(well, elStub('pz-A'), 0)).toBe(1);
        expect(sb.resolvePrzejscieIndex(well, elStub('pz-B'), 1)).toBe(0);
    });

    it('fallback działa bez id (legacy)', () => {
        const sb = loadRenderer();
        const well = { przejscia: [{}, {}] };
        expect(sb.resolvePrzejscieIndex(well, elStub(null), 1)).toBe(1);
    });

    it('nieznane id → fallback (brak cichego -1)', () => {
        const sb = loadRenderer();
        const well = { przejscia: [{ id: 'pz-A' }] };
        expect(sb.resolvePrzejscieIndex(well, elStub('pz-X'), 0)).toBe(0);
    });
});
