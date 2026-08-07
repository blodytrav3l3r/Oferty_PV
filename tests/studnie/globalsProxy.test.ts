import fs from 'fs';
import path from 'path';
import vm from 'vm';

/**
 * Test regresyjny proxy window.studnieProducts (public/js/studnie/globals.js).
 * telemetryBridge.js i mlDualRanking.js czytają produkty przez window.studnieProducts,
 * ale lista żyje w zmiennej modułowej `let studnieProducts`. Bez proxy window było
 * zawsze [] → totalPrice/totalWeight/ringCount w featureSnapshot = 0 (martwe cechy ML).
 */
describe('window.studnieProducts proxy (globals.js)', () => {
    function loadSandbox(): any {
        const sandbox = {
            window: {},
            console,
            Date,
            Object,
            Array,
            JSON,
            Math,
            Set,
            Map
        };
        vm.createContext(sandbox);
        const code = fs.readFileSync(
            path.join(__dirname, '../../public/js/studnie/globals.js'),
            'utf8'
        );
        vm.runInContext(code, sandbox);
        return sandbox;
    }

    it('getter zwraca aktualna wartosc zmiennej modulowej po push()', () => {
        const sandbox = loadSandbox();
        vm.runInContext('studnieProducts.push({id:"KDB-1",price:100})', sandbox);
        expect(sandbox.window.studnieProducts).toEqual([{ id: 'KDB-1', price: 100 }]);
    });

    it('getter zwraca aktualna wartosc po pelnej wymianie tablicy (appStudnie.js)', () => {
        const sandbox = loadSandbox();
        vm.runInContext('studnieProducts = [{id:"X",price:5}]', sandbox);
        expect(sandbox.window.studnieProducts).toEqual([{ id: 'X', price: 5 }]);
    });

    it('setter zapisuje do zmiennej modulowej (externalExportTemplate.js)', () => {
        const sandbox = loadSandbox();
        sandbox.window.studnieProducts = [{ id: 'SET', price: 1 }];
        expect(vm.runInContext('studnieProducts', sandbox)).toEqual([{ id: 'SET', price: 1 }]);
    });

    it('poczatkowa wartosc to pusta tablica (brak falszywych cen)', () => {
        const sandbox = loadSandbox();
        expect(sandbox.window.studnieProducts).toEqual([]);
    });
});
