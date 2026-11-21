// @ts-nocheck -- vm sandbox for vanilla frontend scripts
import fs from 'fs';
import path from 'path';
import vm from 'vm';

const HELPERS = path.join(process.cwd(), 'public/js/studnie/orderZleceniaHelpers.js');
const CARD_HELPERS = path.join(process.cwd(), 'public/js/spa/zleceniaHelpers.js');

function loadCoatingResolver() {
    const context: any = { window: {} };
    vm.createContext(context);
    vm.runInContext(fs.readFileSync(HELPERS, 'utf8'), context);
    return context.window.getProductionOrderCoatingSnapshot;
}

const wellConfigMap = [
    { index: 0, start: 0, end: 800, componentType: 'dennica' },
    { index: 1, start: 800, end: 1700, componentType: 'dennica' },
    { index: 2, start: 1700, end: 2700, componentType: 'krag' },
    { index: 3, start: 0, end: 0, componentType: 'kineta' }
];

describe('powłoka przypisana do elementu zlecenia produkcyjnego', () => {
    test('DN ślepej kinety pochodzi z przejścia standardowego albo własnego', () => {
        const context: any = { window: {} };
        vm.createContext(context);
        vm.runInContext(fs.readFileSync(HELPERS, 'utf8'), context);
        const getDiameter = context.window.getProductionTransitionDiameter;

        expect(
            getDiameter({ productId: 'pipe-200', dn: 1200 }, (id: string) =>
                id === 'pipe-200' ? { dn: 200 } : null
            )
        ).toBe('200');
        expect(getDiameter({ isCustom: true, dn: 250 }, () => null)).toBe('250');
        expect(getDiameter({ productId: 'missing', dn: null }, () => null)).toBe('');
    });

    test('malowanie kinety trafia tylko do dolnej dennicy, także przy osobnym produkcie kinety', () => {
        const resolve = loadCoatingResolver();
        const well = { malowanieW: 'kineta', powlokaNameW: 'Bergolin' };

        const bottomDennica = resolve(well, { componentType: 'dennica' }, 0, wellConfigMap);
        const upperDennica = resolve(well, { componentType: 'dennica' }, 1, wellConfigMap);
        const ring = resolve(well, { componentType: 'krag', area: 2 }, 2, wellConfigMap);

        expect(bottomDennica).toMatchObject({ malowanieW: 'kineta', powlokaNameW: 'Bergolin' });
        expect(bottomDennica.uwagi).toContain('Malowanie wew. Kineta Bergolin');
        expect(upperDennica).toMatchObject({ malowanieW: 'brak', powlokaNameW: '' });
        expect(upperDennica.uwagi).toEqual([]);
        expect(ring.malowanieW).toBe('brak');
    });

    test('kineta_dennica rozdziela zakres kinety i ścian dennicy', () => {
        const resolve = loadCoatingResolver();
        const well = { malowanieW: 'kineta_dennica', powlokaNameW: 'Bergolin' };

        const bottomDennica = resolve(well, { componentType: 'dennica' }, 0, wellConfigMap);
        const upperDennica = resolve(well, { componentType: 'dennica' }, 1, wellConfigMap);
        const ring = resolve(well, { componentType: 'krag', area: 2 }, 2, wellConfigMap);

        expect(bottomDennica.malowanieW).toBe('kineta_dennica');
        expect(bottomDennica.uwagi).toEqual(['Malowanie wew. Kineta+denn. Bergolin']);
        expect(upperDennica.malowanieW).toBe('dennica');
        expect(ring.malowanieW).toBe('brak');
    });

    test('całość i powłoka zewnętrzna trafiają tylko na elementy z powierzchnią', () => {
        const resolve = loadCoatingResolver();
        const well = {
            malowanieW: 'cale',
            powlokaNameW: 'Epoxy',
            malowanieZ: 'zewnatrz',
            powlokaNameZ: 'Bitum'
        };

        const ring = resolve(
            well,
            { componentType: 'krag', area: 2, areaExt: 3 },
            2,
            wellConfigMap
        );
        const seal = resolve(
            well,
            { componentType: 'uszczelka', area: 0, areaExt: 0 },
            4,
            wellConfigMap
        );

        expect(ring).toMatchObject({
            malowanieW: 'cale',
            powlokaNameW: 'Epoxy',
            malowanieZ: 'zewnatrz',
            powlokaNameZ: 'Bitum'
        });
        expect(seal).toMatchObject({
            malowanieW: 'brak',
            powlokaNameW: '',
            malowanieZ: 'brak',
            powlokaNameZ: ''
        });
        expect(seal.uwagi).toEqual([]);
    });

    test('wydruk kartoteki opisuje zakres ścian dennicy', () => {
        const context: any = { window: {} };
        vm.createContext(context);
        vm.runInContext(fs.readFileSync(CARD_HELPERS, 'utf8'), context);

        expect(context.getPowloka({ malowanieW: 'dennica', powlokaNameW: 'Bergolin' })).toBe(
            'Wew: Dennica (Bergolin)'
        );
    });
});
