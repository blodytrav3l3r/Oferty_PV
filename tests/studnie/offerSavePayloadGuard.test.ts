// @ts-nocheck
import fs from 'fs';
import path from 'path';
import vm from 'vm';

/**
 * Regresja 413: zapis oferty studni leciał do serwera bez sprawdzenia rozmiaru,
 * więc przekroczenie limitu `express.json` (50 MB, `src/mountRoutes.ts`) kończyło
 * się suchym błędem po długim uploadzie. Teraz:
 * - klient mierzy payload i blokuje zapis z jawnym komunikatem,
 * - runtime-śmieci nie jadą do backendu,
 * - `wellsExport` nie dubluje `_elemId` (tożsamość PZ, nie treść oferty).
 */
function loadScript(relPath: string) {
    const code = fs.readFileSync(path.join(__dirname, '../../public/js', relPath), 'utf8');
    const context: any = { window: {}, console, Blob };
    context.window = context;
    vm.createContext(context);
    vm.runInContext(code, context);
    return context;
}

/** Wartość/uchwyt z zakresu skryptu (top-level `const`/`function`). */
function read(ctx: any, expr: string) {
    return vm.runInContext(expr, ctx);
}

describe('payload zapisu oferty studni — pomiar i budżet', () => {
    const ctx = loadScript('studnie/offerSave.js');

    test('limit klienta odpowiada limitowi parsera JSON na /api/offers-rury', () => {
        const limit = read(ctx, 'OFFER_SAVE_PAYLOAD_LIMIT_BYTES');
        const guard = read(ctx, 'OFFER_SAVE_PAYLOAD_GUARD_BYTES');
        expect(limit).toBe(50 * 1024 * 1024);
        expect(guard).toBeLessThan(limit);
        // Zapas ≥ 5% — inaczej narzut kodowania i wrapper zjadają margines.
        expect(guard).toBeLessThanOrEqual(limit * 0.95);
    });

    test('mierzy realny kształt żądania `{ data: [offerDoc] }` w bajtach', () => {
        const doc = { id: 'o1', wells: [{ id: 'w1', name: 'Studnia' }] };
        const measured = read(ctx, 'measureOfferSavePayload')(doc);
        const expected = Buffer.byteLength(JSON.stringify({ data: [doc] }), 'utf8');
        expect(measured).toBe(expected);
    });

    test('znaki spoza ASCII liczone po bajtach UTF-8 (nie po znakach)', () => {
        const measure = read(ctx, 'measureOfferSavePayload');
        const ascii = { name: 'aaa' };
        const polish = { name: 'ąćęłńóśźż' };
        expect(measure(polish)).toBeGreaterThan(measure(ascii));
        expect(measure(polish)).toBe(Buffer.byteLength(JSON.stringify({ data: [polish] }), 'utf8'));
    });

    test('guard blokuje ponad próg, przepuszcza zapas', () => {
        const tooLarge = read(ctx, 'isOfferSavePayloadTooLarge');
        const limit = read(ctx, 'OFFER_SAVE_PAYLOAD_LIMIT_BYTES');
        const guard = read(ctx, 'OFFER_SAVE_PAYLOAD_GUARD_BYTES');
        expect(tooLarge(guard)).toBe(false);
        expect(tooLarge(guard + 1)).toBe(true);
        expect(tooLarge(limit)).toBe(true);
        expect(tooLarge(limit + 1)).toBe(true);
        expect(tooLarge(0)).toBe(false);
    });

    test('realna oferta 2160 studni mieści się w budżecie (brak fałszywej blokady)', () => {
        // Kształt z bazy: ~2,5 KB/studnia w `wells` + ~1,6 KB w `wellsExport`.
        const wells = Array.from({ length: 2160 }, (_, i) => ({
            id: 'w' + i,
            name: 'Studnia DN' + (i % 24),
            config: Array.from({ length: 12 }, (_, j) => ({
                productId: 'KORP-' + j,
                quantity: 1,
                _xp: 100,
                _xd: 10
            }))
        }));
        const bytes = read(ctx, 'measureOfferSavePayload')({ id: 'big', wells });
        expect(bytes).toBeGreaterThan(1024 * 1024);
        expect(read(ctx, 'isOfferSavePayloadTooLarge')(bytes)).toBe(false);
    });
});

describe('stripWellRuntimeFields — śmieci runtime nie jadą do backendu', () => {
    const ctx = loadScript('studnie/offerSave.js');

    test('czyści snapshot configu solvera i pieczątkę hasha', () => {
        const wells = [
            {
                id: 'w1',
                name: 'Studnia 1',
                config: [{ productId: 'KORP-1', quantity: 1 }],
                _preAutoConfig: [{ productId: 'KORP-1', quantity: 1 }],
                _solverErrorsGen: 'abc123',
                _lastAutoConfig: [{ productId: 'OLD' }]
            }
        ];
        read(ctx, 'stripWellRuntimeFields')(wells);
        expect(wells[0]).not.toHaveProperty('_preAutoConfig');
        expect(wells[0]).not.toHaveProperty('_solverErrorsGen');
        expect(wells[0]).not.toHaveProperty('_lastAutoConfig');
    });

    test('nie rusza pól biznesowych studni ani configu', () => {
        const well = {
            id: 'w1',
            dn: '1000',
            rzednaDna: 1.5,
            config: [{ productId: 'KORP-1', quantity: 2 }],
            przejscia: [{ productId: 'PRZ-1', dn: 200 }]
        };
        read(ctx, 'stripWellRuntimeFields')([well]);
        expect(well).toEqual({
            id: 'w1',
            dn: '1000',
            rzednaDna: 1.5,
            config: [{ productId: 'KORP-1', quantity: 2 }],
            przejscia: [{ productId: 'PRZ-1', dn: 200 }]
        });
    });

    test('nie wywala się na wejściu nie-tablicy', () => {
        const strip = read(ctx, 'stripWellRuntimeFields');
        expect(() => strip(null)).not.toThrow();
        expect(() => strip(undefined)).not.toThrow();
    });
});

describe('wellsExport — bez _elemId (tożsamość PZ, nie treść oferty)', () => {
    const ctx = loadScript('studnie/pricingCalculator.js');

    test('kopiuje cenę i rabat, usuwa _elemId', () => {
        const copy = read(ctx, '_exportConfigItem')(
            { productId: 'KORP-1', quantity: 1, _elemId: 'uuid-1' },
            { _xp: 120, _xd: 10 }
        );
        expect(copy).toEqual({ productId: 'KORP-1', quantity: 1, _xp: 120, _xd: 10 });
        expect(copy).not.toHaveProperty('_elemId');
    });

    test('nie mutuje oryginalnej pozycji configu', () => {
        const item = { productId: 'KORP-1', quantity: 1, _elemId: 'uuid-1' };
        read(ctx, '_exportConfigItem')(item, { _xp: 1 });
        expect(item._elemId).toBe('uuid-1');
    });
});
