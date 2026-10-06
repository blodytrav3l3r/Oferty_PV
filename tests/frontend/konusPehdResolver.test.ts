// @ts-nocheck -- vm sandbox, celowy brak typow dla public/js
import fs from 'fs';
import path from 'path';
import vm from 'vm';

/**
 * Regresja: Anuluj/X w popupie "Niezgodność technologiczna: Konus + PEHD"
 * cofa Wkładkę PEHD (Zwieńcz.) na 'brak', gdy Konus zostaje.
 * Po wyborze płyty (resolve) wkładka zostaje.
 */
function readJs(rel: string): string {
    return fs.readFileSync(path.join(__dirname, '../../public/js', rel), 'utf8');
}

const KONUS = { id: 'KON-1000', componentType: 'konus', dn: 1000 };
const PLYTA = { id: 'PLY-1000', componentType: 'plyta_din', dn: 1000 };

function loadResolver(wells: any[]) {
    const sandbox: any = { window: {}, console };
    vm.createContext(sandbox);
    let summaryCalls = 0;
    sandbox.wells = wells;
    sandbox.studnieProducts = [KONUS, PLYTA];
    sandbox.getStudnieProductById = (id: string) => [KONUS, PLYTA].find((p) => p.id === id);
    sandbox.document = { getElementById: () => null };
    sandbox.renderWellParams = () => {};
    sandbox.updateParamTilesUI = () => {};
    sandbox.updateSummary = () => {
        summaryCalls++;
    };
    vm.runInContext(readJs('studnie/popupsKonusPehd.js'), sandbox, {
        filename: 'popupsKonusPehd.js'
    });
    return { sandbox, getSummaryCalls: () => summaryCalls };
}

function konusWell() {
    return {
        name: 's1',
        dn: 1000,
        wkladkaZwienczenie: '3mm',
        config: [{ productId: 'KON-1000', quantity: 1 }],
        przejscia: []
    };
}

describe('konusPehdResolver: Anuluj cofa wkladke na brak', () => {
    it('cancel przy Konusie → wkladka brak + odswiezony kafelek', () => {
        const wells = [konusWell()];
        const { sandbox, getSummaryCalls } = loadResolver(wells);
        // Modal otwarty (jak z updateWellParam), potem Anuluj/X.
        sandbox.window._konusResolverWellIndex = 0;
        sandbox.window._konusResolved = false;
        sandbox.closeKonusResolver();
        expect(wells[0].wkladkaZwienczenie).toBe('brak');
        expect(getSummaryCalls()).toBe(1);
    });

    it('Konus w zakonczeniu (nie w config) → tez cofa', () => {
        const well = konusWell();
        well.config = [];
        well.zakonczenie = 'KON-1000';
        const wells = [well];
        const { sandbox } = loadResolver(wells);
        sandbox.window._konusResolverWellIndex = 0;
        sandbox.window._konusResolved = false;
        sandbox.closeKonusResolver();
        expect(wells[0].wkladkaZwienczenie).toBe('brak');
    });

    it('po resolve (flaga) → brak cofniecia, wkladka zostaje', () => {
        const wells = [konusWell()];
        const { sandbox, getSummaryCalls } = loadResolver(wells);
        sandbox.window._konusResolverWellIndex = 0;
        sandbox.window._konusResolved = true;
        sandbox.closeKonusResolver();
        expect(wells[0].wkladkaZwienczenie).toBe('3mm');
        expect(getSummaryCalls()).toBe(0);
    });

    it('bez Konusa → no-op (nie dotyka legalnej wkladki)', () => {
        const well = konusWell();
        well.config = [];
        const wells = [well];
        const { sandbox, getSummaryCalls } = loadResolver(wells);
        sandbox.window._konusResolverWellIndex = 0;
        sandbox.window._konusResolved = false;
        sandbox.closeKonusResolver();
        expect(wells[0].wkladkaZwienczenie).toBe('3mm');
        expect(getSummaryCalls()).toBe(0);
    });
});
