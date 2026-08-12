import fs from 'fs';
import path from 'path';
import vm from 'vm';

/**
 * Test regresyjny (B1): buildOriginalConfigFromWell zwraca oryginalny config
 * auto-doboru TYLKO gdy różni się od bieżącego (korekta użytkownika).
 *
 * Tło: telemetryBridge ustawiał originalConfig = finalConfig, więc
 * LearningEngine.buildCorrections nie widział żadnej różnicy — wzorce
 * substitution/addition/removal były martwe. Snapshot `well._lastAutoConfig`
 * ustawia solverAutoSelect.js; korekta (configSource MANUAL*) tworzy rozjazd.
 */
describe('telemetryBridge.buildOriginalConfigFromWell (B1)', () => {
    const readFile = (rel: string) =>
        fs.readFileSync(path.join(__dirname, '../../public/js', rel), 'utf8');

    function loadModule() {
        const code = readFile('studnie/telemetryBridge.js');
        const sandbox: any = {
            fetch: () => Promise.resolve({ ok: true, status: 200 }),
            window: {
                fetch: () => Promise.resolve({ ok: true, status: 200 }),
                location: { hostname: 'localhost' }
            },
            console: { warn: jest.fn(), error: jest.fn(), log: jest.fn() },
            setTimeout: () => 0,
            clearTimeout: () => undefined,
            AbortController,
            JSON,
            Promise
        };
        vm.createContext(sandbox);
        vm.runInContext(code, sandbox);
        return sandbox;
    }

    const basicSnapshot = (items: Array<{ productId: string; quantity: number }>) =>
        JSON.stringify(items);

    it('zwraca oryginał gdy _lastAutoConfig różni się od bieżącego configu (korekta użytkownika)', () => {
        const sandbox = loadModule();
        const well = {
            config: [
                { productId: 'KDB-1000-500', quantity: 2 },
                { productId: 'KDZ-1000-500', quantity: 2 }
            ],
            _lastAutoConfig: basicSnapshot([{ productId: 'KDB-1000-500', quantity: 3 }])
        };

        const result = sandbox.window.buildOriginalConfigFromWell(well);

        expect(result).toEqual([{ productId: 'KDB-1000-500', quantity: 3 }]);
    });

    it('zwraca undefined gdy config bez zmian (auto i final identyczne)', () => {
        const sandbox = loadModule();
        const well = {
            config: [{ productId: 'KDB-1000-500', quantity: 3 }],
            _lastAutoConfig: basicSnapshot([{ productId: 'KDB-1000-500', quantity: 3 }])
        };

        const result = sandbox.window.buildOriginalConfigFromWell(well);

        expect(result).toBeUndefined();
    });

    it('zwraca undefined gdy brak _lastAutoConfig', () => {
        const sandbox = loadModule();
        const well = { config: [{ productId: 'KDB-1000-500', quantity: 3 }] };

        const result = sandbox.window.buildOriginalConfigFromWell(well);

        expect(result).toBeUndefined();
    });

    it('zwraca undefined gdy brak well', () => {
        const sandbox = loadModule();

        expect(sandbox.window.buildOriginalConfigFromWell(null)).toBeUndefined();
        expect(sandbox.window.buildOriginalConfigFromWell(undefined)).toBeUndefined();
    });

    it('odporny na niepoprawny JSON snapshotu (zwraca undefined, nie rzuca)', () => {
        const sandbox = loadModule();
        const well = {
            config: [{ productId: 'KDB-1000-500', quantity: 3 }],
            _lastAutoConfig: '{not valid json'
        };

        expect(() => sandbox.window.buildOriginalConfigFromWell(well)).not.toThrow();
        expect(sandbox.window.buildOriginalConfigFromWell(well)).toBeUndefined();
    });

    it('kolejność elementów w configu nie tworzy fałszywej korekty (sortowanie nieistotne)', () => {
        const sandbox = loadModule();
        const well = {
            config: [
                { productId: 'KDZ-1000-500', quantity: 2 },
                { productId: 'KDB-1000-500', quantity: 3 }
            ],
            _lastAutoConfig: basicSnapshot([
                { productId: 'KDB-1000-500', quantity: 3 },
                { productId: 'KDZ-1000-500', quantity: 2 }
            ])
        };

        const result = sandbox.window.buildOriginalConfigFromWell(well);

        expect(result).toBeUndefined();
    });
});
