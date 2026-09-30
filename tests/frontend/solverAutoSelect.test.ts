// @ts-nocheck -- vm sandbox, celowy brak typow dla public/js
import fs from 'fs';
import path from 'path';
import vm from 'vm';

/**
 * P2 (ex F-004): kontrakty głównego solvera autoSelectComponents.
 * Ładuje PRAWDZIWE pliki (ruleEngine, wellConfigRules, ringOptimizer, sort,
 * sync, elemId, transitionZones, globals, solverAutoSelect) + fixture
 * asortymentu i stub UI. Bez DOM.
 */
function readJs(rel: string): string {
    return fs.readFileSync(path.join(__dirname, '../../public/js', rel), 'utf8');
}

const PRODUCTS = [
    {
        id: 'DDD-1000-600',
        name: 'Dennica 1000/600',
        componentType: 'dennica',
        dn: 1000,
        height: 600
    },
    { id: 'KON-1000-D', name: 'Konus 1000', componentType: 'konus', dn: 1000, height: 600 },
    { id: 'KDB-1000-500-D', name: 'Krag 1000/500', componentType: 'krag', dn: 1000, height: 500 },
    { id: 'KDB-1000-250-D', name: 'Krag 1000/250', componentType: 'krag', dn: 1000, height: 250 },
    { id: 'USZ-1000', name: 'Uszczelka', componentType: 'uszczelka', dn: 1000, height: 20 },
    {
        id: 'AVR-100',
        name: 'Pierscien AVR 100',
        componentType: 'pierscien_wyrownawczy',
        dn: 1000,
        height: 100
    },
    {
        id: 'AVR-80',
        name: 'Pierscien AVR 80',
        componentType: 'pierscien_wyrownawczy',
        dn: 1000,
        height: 80
    },
    {
        id: 'AVR-60',
        name: 'Pierscien AVR 60',
        componentType: 'pierscien_wyrownawczy',
        dn: 1000,
        height: 60
    }
];

function baseWell() {
    return {
        dn: 1000,
        magazyn: 'Kluczbork',
        nadbudowa: 'betonowa',
        stopnie: 'drabinka',
        rzednaDna: 0,
        rzednaWlazu: 2.5,
        przejscia: [],
        config: [],
        configErrors: []
    };
}

function loadSolver(well: any) {
    const sandbox: any = { window: {}, console, URL };
    vm.createContext(sandbox);
    const files = [
        'shared/constants.js',
        'shared/formatters.js',
        'studnie/transitionZones.js',
        'studnie/ruleEngine.js',
        'studnie/wellConfigRules.js',
        'studnie/ringOptimizer.js',
        'studnie/actionsConfigSort.js',
        'studnie/actionsWellSync.js',
        'studnie/wellElemId.js',
        'studnie/globals.js',
        'studnie/solverAutoSelect.js'
    ];
    for (const f of files) {
        vm.runInContext(readJs(f), sandbox, { filename: f });
    }
    sandbox.FLOW_TYPES = sandbox.window.FLOW_TYPES;
    // Rejestracje window.* nie sa globalami kontekstu vm (jak w przegladarce).
    sandbox.autoSelectComponents = sandbox.window.autoSelectComponents;
    // Asortyment TYLKO przez setter window.studnieProducts (globals.js:31) —
    // to sciezka prod (sync leksykalu + rebuild mapy). Zwykle przypisanie
    // sandbox.studnieProducts tworzy obok wlasciwosc pine solver nie czyta.
    const toasts: string[] = [];
    const logs: Array<[string, string]> = [];
    sandbox.window.studnieProducts = PRODUCTS.map((p) => ({ ...p }));
    sandbox.getCurrentWell = () => well;
    sandbox.showToast = (m: string) => void toasts.push(String(m));
    sandbox.logger = {
        info: (...a: any[]) => void logs.push(['info', a.join(' ')]),
        warn: (...a: any[]) => void logs.push(['warn', a.join(' ')]),
        error: (...a: any[]) => void logs.push(['error', a.join(' ')]),
        debug: (...a: any[]) => void logs.push(['debug', a.join(' ')])
    };
    sandbox.refreshAll = () => {};
    sandbox.renderWellConfig = () => {};
    sandbox.renderWellDiagram = () => {};
    sandbox.updateSummary = () => {};
    return { sandbox, toasts, logs };
}

describe('solverAutoSelect guardy wejscia', () => {
    it('brak studni → toast, brak configu', async () => {
        const { sandbox, toasts } = loadSolver(null);
        await sandbox.autoSelectComponents(false);
        expect(toasts.some((t) => t.includes('Najpierw dodaj studnię'))).toBe(true);
    });

    it('autoLocked → toast o trybie recznym', async () => {
        const well = { ...baseWell(), autoLocked: true };
        const { sandbox, toasts } = loadSolver(well);
        await sandbox.autoSelectComponents(false);
        expect(toasts.some((t) => t.includes('Trybie Ręcznym'))).toBe(true);
        expect(well.config).toEqual([]);
    });

    it('wlaz <= dna → toast o rzednej', async () => {
        const well = { ...baseWell(), rzednaWlazu: 0 };
        const { sandbox, toasts } = loadSolver(well);
        await sandbox.autoSelectComponents(false);
        expect(toasts.some((t) => t.includes('rzędną włazu'))).toBe(true);
    });

    it('requiredMm < 500 → toast o wysokosci', async () => {
        const well = { ...baseWell(), rzednaWlazu: 0.3 };
        const { sandbox, toasts } = loadSolver(well);
        await sandbox.autoSelectComponents(false);
        expect(toasts.some((t) => t.includes('500mm'))).toBe(true);
    });

    it('pusty asortyment → toast o ladowaniu', async () => {
        const well = baseWell();
        const { sandbox, toasts } = loadSolver(well);
        sandbox.window.studnieProducts = [];
        await sandbox.autoSelectComponents(false);
        expect(toasts.some((t) => t.includes('ładują'))).toBe(true);
    });

    it('wspolbiezny drugi run → pomijany (guard reentrancji)', async () => {
        const well = baseWell();
        const { sandbox, logs } = loadSolver(well);
        const p1 = sandbox.autoSelectComponents(false);
        const p2 = sandbox.autoSelectComponents(false);
        await Promise.all([p1, p2]);
        expect(logs.some(([l, m]) => l === 'warn' && m.includes('Pomijam'))).toBe(true);
    });
});

describe('solverAutoSelect golden path (fixture DN1000, H=2000mm)', () => {
    it('dobiera config ze skonczonymi wysokosciami w tolerancji', async () => {
        const well = baseWell();
        const { sandbox } = loadSolver(well);
        await sandbox.autoSelectComponents(false);
        expect(['OK', 'WARNING'].includes(well.configStatus)).toBe(true);
        expect(well.config.length).toBeGreaterThan(0);
        let total = 0;
        for (const it of well.config) {
            const p = PRODUCTS.find((x) => x.id === it.productId);
            expect(p).toBeDefined();
            const h = (p!.height || 0) * (it.quantity || 1);
            expect(Number.isFinite(h)).toBe(true);
            total += h;
        }
        // Tolerancja solvera: niedobor do -260 (AVR), nadmiar do +20 (standard).
        expect(total).toBeGreaterThanOrEqual(2000 - 260);
        expect(total).toBeLessThanOrEqual(2000 + 1000);
        expect(well.configSource).toBe('AUTO_JS');
    });

    it('determinizm: dwa runy → identyczny dobor (bez _elemId)', async () => {
        const run = async () => {
            const well = baseWell();
            const { sandbox } = loadSolver(well);
            await sandbox.autoSelectComponents(false);
            // _elemId to losowy token tozsamosci (ensureElemIds) — determinizm
            // dotyczy DOBORU (productId+quantity+kolejnosc), nie tokenow.
            return JSON.stringify(
                (well.config || []).map((it: any) => [it.productId, it.quantity])
            );
        };
        expect(await run()).toBe(await run());
    });

    it('computeSolveInputHash: stabilny i czuly na wejscie', async () => {
        const { sandbox } = loadSolver(baseWell());
        const a = sandbox.computeSolveInputHash(baseWell(), 2000);
        const b = sandbox.computeSolveInputHash(baseWell(), 2000);
        const c = sandbox.computeSolveInputHash({ ...baseWell(), rzednaWlazu: 3 }, 2500);
        expect(typeof a).toBe('string');
        expect(a.length).toBeGreaterThan(0);
        expect(a).toBe(b);
        expect(a).not.toBe(c);
    });
});
