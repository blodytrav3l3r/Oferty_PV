/**
 * Testy auto-detekcji w public/js/import-export/toolbar.js (vm pattern,
 * wzorzec tests/frontend/ruryProductHelpers.test.ts):
 * - _detectFromNumber: moduł + typ z formatu numeru (OF/OS/ZR/ZS),
 * - _detectImportModule: moduł grupy XLSX z TR-* albo głosowania indeksów,
 * - _findAnyOffer/_findAnyOrder: wyszukiwanie bez wyboru modułu.
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';

type Toolbar = {
    _detectFromNumber: (n: string) => { module: string; entity: string } | null;
    _detectImportModule: (
        g: { rows?: Array<Record<string, string>> },
        sets: { rury: Set<string>; studnie: Set<string> } | null
    ) => string;
    _findAnyOffer: (n: string) => Array<{ offer: unknown; module: string }>;
    _findAnyOrder: (n: string) => Promise<Array<{ order: unknown; module: string }>>;
};

function loadToolbar(stubs: Record<string, unknown> = {}): Toolbar {
    const sandbox: Record<string, unknown> = {
        window: {},
        console,
        ...stubs
    };
    vm.createContext(sandbox);
    const file = path.join(process.cwd(), 'public/js/import-export/toolbar.js');
    vm.runInContext(fs.readFileSync(file, 'utf-8'), sandbox, { filename: 'toolbar.js' });
    const win = sandbox.window as { importExportToolbar: Toolbar; kartotekaUI?: unknown };
    if (stubs.kartotekaUI) win.kartotekaUI = stubs.kartotekaUI;
    return win.importExportToolbar;
}

describe('frontend vm: toolbar._detectFromNumber', () => {
    const tb = loadToolbar();

    it('OF/ → rury/oferta, OS/ → studnie/oferta', () => {
        expect(tb._detectFromNumber('OF/000001/XX/2026')).toEqual({
            module: 'rury',
            entity: 'offer'
        });
        expect(tb._detectFromNumber('OS/000002/YY/2026')).toEqual({
            module: 'studnie',
            entity: 'offer'
        });
    });

    it('/ZR/ → rury/zamówienie, /ZS/ → studnie/zamówienie', () => {
        expect(tb._detectFromNumber('XX/ZR/000001/2026')).toEqual({
            module: 'rury',
            entity: 'order'
        });
        expect(tb._detectFromNumber('YY/ZS/000003/2026')).toEqual({
            module: 'studnie',
            entity: 'order'
        });
    });

    it('case-insensitive, custom i puste → null (search-all)', () => {
        expect(tb._detectFromNumber('of/000001/xx/2026')).toEqual({
            module: 'rury',
            entity: 'offer'
        });
        expect(tb._detectFromNumber('OF-2026/001')).toBeNull();
        expect(tb._detectFromNumber('Faktura 123')).toBeNull();
        expect(tb._detectFromNumber('')).toBeNull();
    });
});

describe('frontend vm: toolbar._detectImportModule', () => {
    const tb = loadToolbar();
    const sets = {
        rury: new Set(['RTB-0-03-25-K00', 'TR-RURY']),
        studnie: new Set(['AVR-PR-06', 'TR-STUDNIE'])
    };

    it('wiersz TR-RURY / TR-STUDNIE rozstrzyga bez katalogu', () => {
        const rury = { rows: [{ INDEKS_CZESCI: 'TR-RURY' }, { INDEKS_CZESCI: 'XXX-1' }] };
        const stud = { rows: [{ INDEKS_CZESCI: 'TR-STUDNIE' }, { INDEKS_CZESCI: 'YYY-2' }] };
        expect(tb._detectImportModule(rury, null)).toBe('rury');
        expect(tb._detectImportModule(stud, null)).toBe('studnie');
    });

    it('głosowanie indeksów z katalogu', () => {
        const g = {
            rows: [{ INDEKS_CZESCI: 'AVR-PR-06' }, { INDEKS_CZESCI: 'AVR-PR-06' }]
        };
        expect(tb._detectImportModule(g, sets)).toBe('studnie');
    });

    it('remis, obce indeksy i pusto → unknown', () => {
        const tie = {
            rows: [{ INDEKS_CZESCI: 'RTB-0-03-25-K00' }, { INDEKS_CZESCI: 'AVR-PR-06' }]
        };
        expect(tb._detectImportModule(tie, sets)).toBe('unknown');
        expect(tb._detectImportModule({ rows: [{ INDEKS_CZESCI: 'OBCY-1' }] }, sets)).toBe(
            'unknown'
        );
        expect(tb._detectImportModule({ rows: [] }, sets)).toBe('unknown');
        expect(tb._detectImportModule({ rows: [{ INDEKS_CZESCI: 'OBCY-1' }] }, null)).toBe(
            'unknown'
        );
    });
});

describe('frontend vm: toolbar._findAnyOffer/_findAnyOrder', () => {
    const offers = [
        { offer_number: 'OF/000001/XX/2026', number: 'OF/000001/XX/2026', type: 'rury_oferta' },
        { offer_number: 'CUSTOM-1', number: 'CUSTOM-1', type: 'studnia_oferta' }
    ];
    const ordersMap = new Map([
        ['off1', [{ id: 'o1', orderNumber: 'XX/ZR/000001/2026', offerStudnieId: null }]]
    ]);
    const tb = loadToolbar({
        XlsxImportShared: { getLoadedOffers: () => offers },
        JsonOfferTransfer: {
            fetchOrderByNumber: async (module: string, n: string) =>
                module === 'studnie' && n === 'YY/ZS/000003/2026'
                    ? { id: 'o2', orderNumber: n }
                    : null
        },
        kartotekaUI: { ordersMap }
    });

    it('oferty: filtr po numerze + moduł z type', () => {
        const res = tb._findAnyOffer('OF/000001/XX/2026');
        expect(res).toHaveLength(1);
        expect(res[0].module).toBe('rury');
        expect(tb._findAnyOffer('BRAK')).toHaveLength(0);
    });

    it('zamówienia: cache + fallback API w brakującym module', async () => {
        const cached = await tb._findAnyOrder('XX/ZR/000001/2026');
        expect(cached).toHaveLength(1);
        expect(cached[0].module).toBe('rury');
        const viaApi = await tb._findAnyOrder('YY/ZS/000003/2026');
        expect(viaApi).toHaveLength(1);
        expect(viaApi[0].module).toBe('studnie');
        expect(await tb._findAnyOrder('NIE-MA')).toHaveLength(0);
    });
});
