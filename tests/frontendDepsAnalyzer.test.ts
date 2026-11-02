import { execFileSync } from 'child_process';
import { join } from 'path';

/**
 * P1.1 — testy analizatora zależności frontendu na kontrolowanych fixture'ach.
 * Zero zależności od kodu produkcyjnego: `--root tests/fixtures/frontend-deps`.
 */

interface Edge {
    name: string;
    userFile: string;
    userLine: number;
    defFile: string;
    defKind: string;
    confidence: string;
}

interface Hazard {
    name: string;
    risk: string;
    referenceCount: number;
    definitions: Array<{ file: string; line: number }>;
}

interface Report {
    schemaVersion: number;
    pages: Array<{
        page: string;
        scripts: Record<string, number>;
        files: number;
        globalNames: number;
        edges: Edge[];
        undefinedReferences: Array<{ name: string; file: string; line: number }>;
        hazards: Hazard[];
        unanalyzed: Array<{ type: string; file: string; line: number }>;
    }>;
}

const script = join(__dirname, '..', 'scripts', 'frontend-deps-analyze.mjs');
const fixtureRoot = join(__dirname, 'fixtures', 'frontend-deps');

function runReport(): { report: Report; raw: string } {
    const raw = execFileSync(
        'node',
        [script, '--json', '--root', fixtureRoot, '--pages', 'public/page.html'],
        { encoding: 'utf8' }
    );
    return { report: JSON.parse(raw) as Report, raw };
}

describe('scripts/frontend-deps-analyze.mjs — P1.1', () => {
    const { report, raw } = runReport();
    const page = report.pages[0];
    const edge = (name: string): Edge | undefined => page.edges.find((e) => e.name === name);

    test('schema i strona', () => {
        expect(report.schemaVersion).toBe(1);
        expect(report.pages).toHaveLength(1);
        expect(page.page).toBe('public/page.html');
    });

    test('klasyfikacja typów skryptów', () => {
        expect(page.scripts['classic-defer']).toBe(4);
        expect(page.scripts['classic-blocking']).toBe(1);
        expect(page.scripts.module).toBe(1);
        expect(page.scripts.inline).toBe(1);
        expect(page.scripts['classic-async']).toBe(0);
    });

    test('hoisting: lokalne deklaracje po użyciu nie są błędem', () => {
        const names = page.undefinedReferences.map((u) => u.name);
        expect(names).not.toContain('late');
        expect(names).not.toContain('helperFn');
        expect(edge('late')).toBeUndefined();
    });

    test('global leksykalny i window.* z klasyka', () => {
        expect(edge('classicFn')).toMatchObject({
            defFile: 'public/js/a.js',
            defKind: 'lexical',
            confidence: 'CONFIRMED'
        });
        expect(edge('windowGlobal')).toMatchObject({
            defFile: 'public/js/a.js',
            defKind: 'window'
        });
    });

    test('IIFE: zagnieżdżone window.* jest wykrywane', () => {
        expect(edge('iifeBridge')).toMatchObject({
            defFile: 'public/js/a.js',
            defKind: 'window'
        });
    });

    test('moduł ESM może definiować mostek window.*', () => {
        expect(edge('moduleBridge')).toMatchObject({
            defFile: 'public/js/mod.js',
            defKind: 'window-module'
        });
    });

    test('inline script jest analizowany jako pseudo-plik', () => {
        expect(edge('inlineBridge')?.defFile).toContain('#inline');
        expect(edge('inlineGlobal')?.defKind).toBe('lexical');
    });

    test('naruszenie kolejności ładowania = SUSPECTED', () => {
        expect(edge('topLevelCall')).toMatchObject({
            defFile: 'public/js/later.js',
            confidence: 'SUSPECTED'
        });
    });

    test('implicit global = HAZARD, nie undefined', () => {
        const hazard = page.hazards.find((h) => h.name === 'sloppyGlobal');
        expect(hazard).toBeDefined();
        expect(hazard?.definitions[0].file).toBe('public/js/consumer.js');
        expect(hazard?.referenceCount).toBeGreaterThan(0);
        expect(page.undefinedReferences.map((u) => u.name)).not.toContain('sloppyGlobal');
    });

    test('niezdefiniowana referencja jest raportowana', () => {
        expect(page.undefinedReferences.map((u) => u.name)).toContain('notDefinedAnywhere');
    });

    test('dynamiczna injekcja i cykl ESM = UNANALYZED', () => {
        const types = page.unanalyzed.map((u) => u.type);
        expect(types).toContain('dynamic-script-injection');
        expect(types).toContain('esm-import-cycle');
    });

    test('raport jest deterministyczny', () => {
        const second = execFileSync(
            'node',
            [script, '--json', '--root', fixtureRoot, '--pages', 'public/page.html'],
            { encoding: 'utf8' }
        );
        expect(second).toBe(raw);
    });

    test('P1.2: gate frontend-deps-check.mjs blokuje nowe krawedzie (exit 0 dla HEAD)', () => {
        const checkScript = join(__dirname, '..', 'scripts', 'frontend-deps-check.mjs');
        // Wywolanie check powinno przejsc dla biezacego stanu repozytorium (exit 0)
        const checkOut = execFileSync('node', [checkScript], { encoding: 'utf8' });
        expect(checkOut).toContain('Frontend Dependencies & Excel Boundary Guard');
        expect(checkOut).toContain('OK');
    });

    test('P2: kontrakt Excel Boundary wykrywa nieautoryzowane odwolania do wnetrza klastra', () => {
        const contractPath = join(__dirname, '..', 'docs', 'contracts', 'excel-boundary.json');
        const contract = JSON.parse(
            execFileSync(
                'node',
                [
                    '-e',
                    `console.log(require('fs').readFileSync('${contractPath.replace(/\\/g, '\\\\')}', 'utf8'))`
                ],
                { encoding: 'utf8' }
            )
        );
        expect(contract.publicFacade).toHaveProperty('excelSwitchTab');
        expect(contract.publicFacade).toHaveProperty('emitExcelMutated');
        expect(contract.publicFacade).toHaveProperty('excelRefreshActiveTable');
        expect(contract.publicFacade).toHaveProperty('markExcelListStale');
        expect(contract.publicFacade).toHaveProperty('excelClearResolutionCache');
        expect(contract.publicFacade).toHaveProperty('excelSyncWellComponents');
        expect(contract.publicFacade).toHaveProperty('isExcelDirty');
        expect(Object.keys(contract.legacyAllowlist)).toHaveLength(0);
    });
});
