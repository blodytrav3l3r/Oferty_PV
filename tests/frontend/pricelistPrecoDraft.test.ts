// @ts-nocheck
/* precoNestedToFlat: semantyka 1:1 z flattenAndSave (src/routes/precoPricingV2.ts).
 * Import PRECO z pliku XLSX zapisuje te same wiersze, więc konwersja musi się zgadzać.
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';

const ROOT = path.join(__dirname, '..', '..');
const readPub = (rel) => fs.readFileSync(path.join(ROOT, 'public', 'js', rel), 'utf8');

function loadShared() {
    const sandbox = { window: {}, console };
    vm.createContext(sandbox);
    vm.runInContext(readPub('shared/pricelistXlsx.js'), sandbox, { filename: 'pricelistXlsx.js' });
    return sandbox.window.pricelistXlsx;
}
describe('precoNestedToFlat: semantyka 1:1 z flattenAndSave', () => {
    function nestedFixture() {
        return {
            1000: {
                kinety: [
                    { dn: 160, prosta: 500, dodWlot: 50 },
                    { dn: 200, prosta: 600, dodWlot: 60, order: 7 }
                ],
                spadekKineta: [{ min: 0, max: 10, grupy: { 160: 100 } }],
                spadekMufa: [],
                uniesienie: [],
                redukcja: [],
                skrzynkaWlazowa: 200,
                cenaPelnaWysMB: 300,
                cenaDnoOsadnika: 400
            },
            1200: {
                kinety: [],
                spadekKineta: [],
                spadekMufa: [],
                uniesienie: [],
                redukcja: [{ min: 5, max: 15, grupy: { 200: 150 }, order: 3 }],
                skrzynkaWlazowa: 0,
                cenaPelnaWysMB: 0,
                cenaDnoOsadnika: 0
            }
        };
    }

    test('deep-equal: id/order/grupy-string/Number DN, liczniki globalne', () => {
        const PX = loadShared();
        const input = nestedFixture();
        const before = JSON.stringify(input);
        const flat = PX.precoNestedToFlat(input);

        expect(flat.konfig).toEqual([
            {
                id: 'preco_konfig_1000',
                key: '1000',
                value: JSON.stringify({
                    spadekKineta: [{ min: 0, max: 10, grupy: { 160: 100 } }],
                    spadekMufa: [],
                    uniesienie: [],
                    redukcja: [],
                    skrzynkaWlazowa: 200,
                    cenaPelnaWysMB: 300,
                    cenaDnoOsadnika: 400
                })
            },
            {
                id: 'preco_konfig_1200',
                key: '1200',
                value: JSON.stringify({
                    spadekKineta: [],
                    spadekMufa: [],
                    uniesienie: [],
                    redukcja: [{ min: 5, max: 15, grupy: { 200: 150 }, order: 3 }],
                    skrzynkaWlazowa: 0,
                    cenaPelnaWysMB: 0,
                    cenaDnoOsadnika: 0
                })
            }
        ]);
        expect(flat.kinety).toEqual([
            { id: 'preco_kinety_1000_0', order: 0, dn: 160, wellDn: 1000, height: 500, cena: 50 },
            { id: 'preco_kinety_1000_1', order: 7, dn: 200, wellDn: 1000, height: 600, cena: 60 }
        ]);
        expect(flat.zakresy).toEqual([
            {
                id: 'preco_zakres_spadekKineta_0',
                order: 0,
                label: 'spadekKineta',
                min: 0,
                max: 10,
                grupy: JSON.stringify({ 160: 100 }),
                wellDn: 1000
            },
            {
                id: 'preco_zakres_redukcja_1',
                order: 3,
                label: 'redukcja',
                min: 5,
                max: 15,
                grupy: JSON.stringify({ 200: 150 }),
                wellDn: 1200
            }
        ]);
        expect(typeof flat.zakresy[0].grupy).toBe('string');
        expect(JSON.stringify(input)).toBe(before);
    });

    test('nie-numeryczne klucze pomijane, pusto → puste tablice', () => {
        const PX = loadShared();
        expect(PX.precoNestedToFlat({})).toEqual({ konfig: [], kinety: [], zakresy: [] });
        expect(PX.precoNestedToFlat(undefined)).toEqual({ konfig: [], kinety: [], zakresy: [] });
        const flat = PX.precoNestedToFlat({
            foo: { kinety: [{ dn: 1, prosta: 1, dodWlot: 1 }] }
        });
        expect(flat).toEqual({ konfig: [], kinety: [], zakresy: [] });
    });
});
