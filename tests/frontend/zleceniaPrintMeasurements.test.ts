import fs from 'fs';
import path from 'path';
import vm from 'vm';

const HELPERS = path.join(process.cwd(), 'public/js/spa/zleceniaHelpers.js');

function loadPrintHelpers() {
    const window: Record<string, unknown> = {};
    const context = { window, ensureDisplayIndices() {} };
    vm.createContext(context);
    vm.runInContext(fs.readFileSync(HELPERS, 'utf8'), context);
    return window;
}

function buildRowsFromSavedOrder(order: Record<string, unknown>) {
    const window = loadPrintHelpers();
    const buildRows = window.buildPrzejsciaRowsFromPO as (
        value: Record<string, unknown>
    ) => Array<{ uwagi: string }>;
    return buildRows(order);
}

describe('wydruk zlecenia — wysokość przejścia', () => {
    test('pokazuje wysokość od dołu elementu, nie rzędną od dna całej studni', () => {
        const rows = buildRowsFromSavedOrder({
            rzednaDna: 152,
            przejscia: [
                {
                    angle: 90,
                    rzednaWlaczenia: 152,
                    heightFromElementMm: 0
                }
            ]
        });

        expect(rows[0].uwagi).toBe('+ 0 mm');
    });

    test('stare zlecenie bez migawki lokalnej wysokości nie pokazuje rzędnej absolutnej', () => {
        const rows = buildRowsFromSavedOrder({
            przejscia: [{ angle: 0, rzednaWlaczenia: 152 }]
        });

        expect(rows[0].uwagi).toBe('—');

        const svg = (
            loadPrintHelpers().generateSvgFromPO as (value: Record<string, unknown>) => string
        )({
            przejscia: [{ angle: 0, flowType: 'wylot', rzednaWlaczenia: 152 }]
        });
        expect(svg).not.toContain('152000mm');
    });
});
