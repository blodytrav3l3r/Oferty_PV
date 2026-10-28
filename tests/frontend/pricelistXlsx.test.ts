// @ts-nocheck
/* =============================================================
   Etap B konsolidacji: wspólny parser XLSX cenników
   (public/js/shared/pricelistXlsx.js) w izolacji vm — bez DOM.
   ============================================================= */
import fs from 'fs';
import path from 'path';
import vm from 'vm';

const ROOT = path.join(__dirname, '..', '..');

function loadPX() {
    const code = fs.readFileSync(
        path.join(ROOT, 'public', 'js', 'shared', 'pricelistXlsx.js'),
        'utf8'
    );
    const sandbox = { window: {} };
    vm.createContext(sandbox);
    vm.runInContext(code, sandbox, { filename: 'pricelistXlsx.js' });
    return { PX: sandbox.window.pricelistXlsx, keys: Object.keys(sandbox.window) };
}

// Fake SheetJS: arkusze to gotowe tablice wierszy (sheet_to_json = identyczność).
function fakeXlsx() {
    return { utils: { sheet_to_json: (ws) => ws } };
}

function workbook(sheets) {
    return { SheetNames: Object.keys(sheets), Sheets: sheets };
}

// Lustro map produkcyjnych (pricelistUi.js:336, pricelistState.js:42).
const RURY_MAP = {
    Indeks: 'id',
    'Nazwa produktu': 'name',
    'Cena PLN (netto)': 'price',
    Kategoria: 'category',
    'Waga (kg)': 'weight',
    'Szt./transport': 'transport',
    'Powierzchnia (m2)': 'area'
};
const STUDNIE_MAP = {
    Indeks: 'id',
    Nazwa: 'name',
    Kategoria: 'category',
    'Typ komponentu': 'componentType',
    DN: 'dn',
    'Cena PLN': 'price',
    'Mag WL': 'magazynWL',
    'Forma std. WL': 'formaStandardowa',
    'Forma std.': 'formaStandardowa'
};
const RURY_NUMERICS = ['price', 'weight', 'transport', 'area'];

describe('pricelistXlsx: rejestracja (Etap B)', () => {
    test('jeden namespace, pięć czystych funkcji, zero DOM', () => {
        const { PX, keys } = loadPX();
        expect(keys).toEqual(['pricelistXlsx']);
        for (const fn of [
            'parseWorkbookToJson',
            'mapHeaders',
            'coerceNumerics',
            'validateProductIdName',
            'normalizeRows'
        ]) {
            expect(typeof PX[fn]).toBe('function');
        }
    });
});

describe('pricelistXlsx: parseWorkbookToJson', () => {
    test('rury: tylko pierwszy arkusz, PRECO ignorowane bez flagi', () => {
        const { PX } = loadPX();
        const wb = workbook({
            'Cennik Rury': [{ Indeks: 'R1', 'Nazwa produktu': 'Rura' }],
            Druga: [{ Indeks: 'R2', 'Nazwa produktu': 'Inna' }]
        });
        const out = PX.parseWorkbookToJson(fakeXlsx(), wb, { firstSheetOnly: true });
        expect(out.rows).toHaveLength(1);
        expect(out.rows[0].Indeks).toBe('R1');
        expect(out.precoDataMap).toEqual({});
    });

    test('arkusz techniczny `_Cennik` pomijany (numer cennika nie jest produktem)', () => {
        const { PX } = loadPX();
        const wb = workbook({
            'Cennik Rury': [{ Indeks: 'R1', 'Nazwa produktu': 'Rura' }],
            _Cennik: [{ Pole: 'Numer cennika', Wartość: 'Rv1-20260927' }],
            Druga: [{ Indeks: 'R2', 'Nazwa produktu': 'Inna' }]
        });
        const ruryOut = PX.parseWorkbookToJson(fakeXlsx(), wb, { firstSheetOnly: true });
        expect(ruryOut.rows.map((r) => r.Indeks)).toEqual(['R1']);

        const studnieOut = PX.parseWorkbookToJson(fakeXlsx(), wb, { includePreco: true });
        expect(studnieOut.rows.map((r) => r.Indeks).sort()).toEqual(['R1', 'R2']);
    });

    test('studnie: DN* łączone, PRECO_* w precoDataMap', () => {
        const { PX } = loadPX();
        const wb = workbook({
            DN1000: [{ Indeks: 'S1', Nazwa: 'Krąg' }],
            DN1200: [{ Indeks: 'S2', Nazwa: 'Krąg 1200' }],
            PRECO_Kinety: [
                {
                    'DN Studni': 1000,
                    'DN Rury': 160,
                    'Cena prosta (PLN)': 500,
                    'Dod. wlot (PLN)': 50
                }
            ],
            PRECO_Zakresy: [
                {
                    Typ: 'spadekKineta',
                    'DN Studni': 1000,
                    Min: 0,
                    Max: 100,
                    'Grupa DN': '160',
                    'Cena (PLN)': 10
                },
                {
                    Typ: 'spadekKineta',
                    'DN Studni': 1000,
                    Min: 0,
                    Max: 100,
                    'Grupa DN': '200',
                    'Cena (PLN)': 20
                }
            ],
            PRECO_Dodatki: [
                {
                    'DN Studni': 1000,
                    'Skrzynka włazowa': 100,
                    'Cena dna osadnika': 200,
                    'Cena pełna wys MB': 300
                }
            ]
        });
        const out = PX.parseWorkbookToJson(fakeXlsx(), wb, { includePreco: true });
        expect(out.rows.map((r) => r.Indeks).sort()).toEqual(['S1', 'S2']);
        const preco = out.precoDataMap[1000];
        expect(preco.kinety).toEqual([{ dn: 160, prosta: 500, dodWlot: 50 }]);
        expect(preco.spadekKineta).toEqual([{ min: 0, max: 100, grupy: { 160: 10, 200: 20 } }]);
        expect(preco.skrzynkaWlazowa).toBe(100);
        expect(preco.cenaDnoOsadnika).toBe(200);
        expect(preco.cenaPelnaWysMB).toBe(300);
    });

    test('studnie: PRECO_* z tekstowymi komórkami Excela (stringi) → liczby', () => {
        const { PX } = loadPX();
        const wb = workbook({
            PRECO_Kinety: [
                {
                    'DN Studni': '1000',
                    'DN Rury': '160',
                    'Cena prosta (PLN)': '500,00',
                    'Dod. wlot (PLN)': '50'
                },
                {
                    'DN Studni': '1000',
                    'DN Rury': '',
                    'Cena prosta (PLN)': '',
                    'Dod. wlot (PLN)': '—'
                }
            ],
            PRECO_Zakresy: [
                {
                    Typ: 'spadekKineta',
                    'DN Studni': '1000',
                    Min: '0',
                    Max: '100',
                    'Grupa DN': '160',
                    'Cena (PLN)': '10,5'
                }
            ],
            PRECO_Dodatki: [
                {
                    'DN Studni': '1000',
                    'Skrzynka włazowa': '100',
                    'Cena dna osadnika': '200',
                    'Cena pełna wys MB': '300'
                }
            ]
        });
        const out = PX.parseWorkbookToJson(fakeXlsx(), wb, { includePreco: true });
        const preco = out.precoDataMap[1000];
        expect(preco.kinety).toEqual([
            { dn: 160, prosta: 500, dodWlot: 50 },
            // D-FIX-2: puste/placeholder → null (jawny 422 z BE), nigdy ciche 0.
            { dn: null, prosta: null, dodWlot: null }
        ]);
        expect(preco.spadekKineta).toEqual([{ min: 0, max: 100, grupy: { 160: 10.5 } }]);
        expect(preco.skrzynkaWlazowa).toBe(100);
        expect(preco.cenaDnoOsadnika).toBe(200);
        expect(preco.cenaPelnaWysMB).toBe(300);
        // Koniec łańcucha: flat gotowy pod strict zod draftu (liczby, nie stringi).
        const flat = PX.precoNestedToFlat(out.precoDataMap);
        expect(typeof flat.kinety[0].dn).toBe('number');
        expect(typeof flat.kinety[0].height).toBe('number');
        expect(typeof flat.kinety[0].cena).toBe('number');
        expect(typeof flat.zakresy[0].min).toBe('number');
        expect(typeof flat.zakresy[0].max).toBe('number');
    });

    test('studnie: arkusz Styczna łączony jak reszta (nie PRECO_*)', () => {
        const { PX } = loadPX();
        const wb = workbook({
            DN1000: [{ Indeks: 'S1', Nazwa: 'Krąg' }],
            Styczna: [
                {
                    Indeks: 'DDD-10-STYCZNA',
                    Nazwa: 'Studnia styczna DN1000',
                    'Typ komponentu': 'styczna'
                }
            ]
        });
        const out = PX.parseWorkbookToJson(fakeXlsx(), wb, { includePreco: true });
        expect(out.rows.map((r) => r.Indeks).sort()).toEqual(['DDD-10-STYCZNA', 'S1']);
        expect(out.precoDataMap).toEqual({});
    });

    test('puste arkusze pomijane, nieznany PRECO_Zakresy Typ nie wywala', () => {
        const { PX } = loadPX();
        const wb = workbook({
            Pusty: [],
            PRECO_Zakresy: [
                {
                    Typ: 'nieistniejacy',
                    'DN Studni': 1000,
                    Min: 0,
                    Max: 1,
                    'Grupa DN': 'x',
                    'Cena (PLN)': 1
                },
                {
                    Typ: 'redukcja',
                    'DN Studni': '',
                    Min: 0,
                    Max: 1,
                    'Grupa DN': 'x',
                    'Cena (PLN)': 1
                }
            ]
        });
        const out = PX.parseWorkbookToJson(fakeXlsx(), wb, { includePreco: true });
        expect(out.rows).toEqual([]);
        // 1:1 ze starym importem: nieznany Typ zakłada kubeł DN, ale nic do niego nie dokłada;
        // pusty 'DN Studni' pomijany.
        expect(Object.keys(out.precoDataMap)).toEqual(['1000']);
        expect(out.precoDataMap[1000].kinety).toEqual([]);
        expect(out.precoDataMap[1000].redukcja).toEqual([]);
    });
});

describe('pricelistXlsx: mapHeaders / coerceNumerics / validateProductIdName', () => {
    test('stary nagłówek Forma std. mapuje do formaStandardowa', () => {
        const { PX } = loadPX();
        expect(PX.mapHeaders({ 'Forma std.': 1 }, STUDNIE_MAP)).toEqual({
            formaStandardowa: 1
        });
        expect(PX.mapHeaders({ Nieznana: 'x' }, STUDNIE_MAP)).toEqual({ Nieznana: 'x' });
        expect(PX.mapHeaders({ a: 1 }, {})).toEqual({ a: 1 });
    });

    test('liczby: spacje/przecinek, myślniki i puste na null lub default', () => {
        const { PX } = loadPX();
        const p = PX.coerceNumerics(
            { price: '1 234,5', weight: '-', transport: '—', area: '', dn: 1000 },
            RURY_NUMERICS
        );
        expect(p).toEqual({ price: 1234.5, weight: null, transport: null, area: null, dn: 1000 });
        const s = PX.coerceNumerics({ magazynWL: '', price: 'abc' }, ['magazynWL', 'price'], {
            magazynWL: 1
        });
        expect(s).toEqual({ magazynWL: 1, price: null });
    });

    test('walidacja trimuje id/name', () => {
        const { PX } = loadPX();
        const ok = { id: '  R1 ', name: ' Rura ' };
        expect(PX.validateProductIdName(ok)).toBe(true);
        expect(ok).toEqual({ id: 'R1', name: 'Rura' });
        expect(PX.validateProductIdName({ id: '', name: 'x' })).toBe(false);
        expect(PX.validateProductIdName({ name: 'x' })).toBe(false);
    });
});

describe('pricelistXlsx: normalizeRows (rury end-to-end)', () => {
    test('mapowanie PL nagłówków, dedup, brak id, kategoria Inne', () => {
        const { PX } = loadPX();
        const skips = [];
        const out = PX.normalizeRows(
            [
                {
                    Indeks: 'R1',
                    'Nazwa produktu': 'Rura A',
                    'Cena PLN (netto)': '100,5',
                    Kategoria: ''
                },
                { Indeks: 'R1', 'Nazwa produktu': 'Duplikat', 'Cena PLN (netto)': 1 },
                { Indeks: '', 'Nazwa produktu': 'Bez indeksu' },
                { Indeks: 'R2', 'Nazwa produktu': 'Rura B', 'Waga (kg)': '2,5' }
            ],
            {
                headerToKey: RURY_MAP,
                numericFields: RURY_NUMERICS,
                preValidate: (p) => {
                    p.category = String(p.category || '').trim() || 'Inne';
                },
                onSkip: (index, reason) => skips.push([index, reason])
            }
        );
        expect(out).toHaveLength(2);
        expect(out[0]).toMatchObject({ id: 'R1', name: 'Rura A', price: 100.5, category: 'Inne' });
        expect(out[1]).toMatchObject({ id: 'R2', weight: 2.5 });
        expect(skips).toEqual([
            [1, 'duplicate-id'],
            [2, 'missing-id-or-name']
        ]);
    });
});

describe('pricelistXlsx: kontrakt z callerami (Etap B)', () => {
    test('wrappery wołają shared, globalne nazwy import/export nietknięte', () => {
        const rury = fs.readFileSync(
            path.join(ROOT, 'public', 'js', 'rury', 'pricelistUi.js'),
            'utf8'
        );
        const studnie = fs.readFileSync(
            path.join(ROOT, 'public', 'js', 'studnie', 'pricelistImportExport.js'),
            'utf8'
        );
        for (const [src, name] of [
            [rury, 'rury'],
            [studnie, 'studnie']
        ]) {
            expect(`${name}: ${src}`).toContain('pricelistXlsx.parseWorkbookToJson');
            expect(`${name}: ${src}`).toContain('pricelistXlsx.normalizeRows');
        }
        expect(rury).toContain('window.importRuryFromExcel = importRuryFromExcel');
        expect(rury).toContain('window.exportRuryToExcel = exportRuryToExcel');
        expect(studnie).toContain('window.importStudnieFromExcel = importStudnieFromExcel');
        expect(studnie).toContain('window.exportStudnieToExcel = exportStudnieToExcel');
    });

    test('legacy Forma std. w pricelistState.js nietknięte', () => {
        const state = fs.readFileSync(
            path.join(ROOT, 'public', 'js', 'studnie', 'pricelistState.js'),
            'utf8'
        );
        expect(state).toContain("HEADER_TO_KEY['Forma std.'] = 'formaStandardowa'");
    });

    test('shared wpięty przed konsumentami w HTML', () => {
        for (const [html, consumer] of [
            ['rury.html', 'js/rury/pricelistUi.js'],
            ['studnie.html', 'js/studnie/pricelistImportExport.js']
        ]) {
            const content = fs.readFileSync(path.join(ROOT, 'public', html), 'utf8');
            const sharedPos = content.indexOf('js/shared/pricelistXlsx.js');
            const consumerPos = content.indexOf(consumer);
            expect(sharedPos).toBeGreaterThan(-1);
            expect(consumerPos).toBeGreaterThan(-1);
            expect(sharedPos).toBeLessThan(consumerPos);
        }
    });
});

describe('pricelistXlsx: błędy per-komórka (S3)', () => {
    const headerToKey = {
        Indeks: 'id',
        'Nazwa produktu': 'name',
        'Cena PLN (netto)': 'price'
    };

    test('normalizeRows raportuje wiersz/kolumnę/powód, nie tylko skip', () => {
        const { PX } = loadPX();
        const issues = [];
        PX.normalizeRows(
            [
                { Indeks: 'R1', 'Nazwa produktu': 'A', 'Cena PLN (netto)': 'abc' },
                { Indeks: 'R2', 'Nazwa produktu': '', 'Cena PLN (netto)': 10 },
                { Indeks: 'R3', 'Nazwa produktu': 'C', 'Cena PLN (netto)': 10 },
                { Indeks: 'R3', 'Nazwa produktu': 'D', 'Cena PLN (netto)': 10 }
            ],
            {
                headerToKey,
                numericFields: ['price'],
                onIssue: (index, field, reason) =>
                    issues.push(PX.importIssue(index, field, reason, headerToKey))
            }
        );
        expect(issues).toEqual([
            { row: 2, column: 'Cena PLN (netto)', field: 'price', message: 'Nieprawidłowa liczba' },
            { row: 3, column: 'Nazwa produktu', field: 'name', message: 'Brak nazwy' },
            { row: 5, column: 'Indeks', field: 'id', message: 'Zduplikowany indeks' }
        ]);
    });

    test('importIssue: nagłówek XLSX + offset 2, fallback na pole', () => {
        const { PX } = loadPX();
        expect(PX.importIssue(0, 'id', 'missing-id', headerToKey)).toEqual({
            row: 2,
            column: 'Indeks',
            field: 'id',
            message: 'Brak indeksu'
        });
        expect(PX.importIssue(4, 'nieznane', 'custom', {})).toMatchObject({
            row: 6,
            column: 'nieznane',
            message: 'custom'
        });
    });

    test('issuesFromDetails: 422 details → lista dla modala, odporne na śmieci', () => {
        const { PX } = loadPX();
        expect(
            PX.issuesFromDetails([{ row: 7, column: 'Indeks', message: 'Brak indeksu' }, null])
        ).toEqual([
            { row: 7, column: 'Indeks', message: 'Brak indeksu' },
            { row: undefined, column: undefined, message: undefined }
        ]);
        expect(PX.issuesFromDetails(undefined)).toEqual([]);
    });

    test('openImportErrorsModal: cap 100, escape HTML, zamknięcie', () => {
        const code = fs.readFileSync(
            path.join(ROOT, 'public', 'js', 'shared', 'pricelistXlsx.js'),
            'utf8'
        );
        const handlers = {};
        const sandbox = {
            window: {
                showModal: jest.fn(),
                closeModal: jest.fn()
            },
            document: {
                getElementById: (id) => ({
                    addEventListener: (ev, fn) => (handlers[id] = fn)
                })
            }
        };
        vm.createContext(sandbox);
        vm.runInContext(code, sandbox, { filename: 'pricelistXlsx.js' });
        const issues = Array.from({ length: 101 }, (_, i) => ({
            row: i + 2,
            column: '<b>Indeks</b>',
            message: 'Brak indeksu'
        }));
        const onClose = jest.fn();
        sandbox.window.pricelistXlsx.openImportErrorsModal({ issues, onClose });

        const opts = sandbox.window.showModal.mock.calls[0][0];
        const html = opts.html;
        expect(opts.id).toBe('px-import-errors-modal');
        expect(html).toContain('&lt;b&gt;Indeks&lt;/b&gt;');
        expect(html).toContain('Pokazano 100 z 101');
        handlers['px-import-errors-close']();
        expect(onClose).toHaveBeenCalledTimes(1);
        expect(sandbox.window.closeModal).toHaveBeenCalledWith('px-import-errors-modal');
    });
});
