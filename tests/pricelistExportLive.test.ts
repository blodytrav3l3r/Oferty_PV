/**
 * Etap C: eksport XLSX cenników LIVE i DEFAULT z serwera.
 * Poziom serwisu (mock sections, bez DB): shape live == shape version
 * (arkusze/kolumny/kolejność), source live|default, zły source → 422.
 *
 * SSoT kształtu (jak Etap A):
 * - RURY: public/js/rury/pricelistUi.js:336 RURY_EXPORT_COLUMNS
 * - STUDNIE: public/js/studnie/pricelistState.js:42 EXPORT_COLUMNS
 * - PRECO zagnieżdżone: public/js/studnie/pricelistImportExport.js:78-147
 */

jest.mock('../src/prismaClient', () => ({
    __esModule: true,
    default: {}
}));

import {
    PricelistVersionError,
    liveSheetsToXlsxSheets,
    projectPrecoNestedToSheets,
    projectVersionToLiveShape,
    requireExportSource
} from '../src/services/pricelistVersionService';
import { formatPrecoResponse } from '../src/routes/precoPricingV2';

const RURY_ROW = {
    id: 'R1',
    name: 'Rura X',
    price: 10,
    category: 'Rury',
    weight: 2,
    transport: 5,
    area: 1.5
};

const STUDNIE_LEGACY_ROWS = [
    {
        id: 'S1',
        name: 'Kręg',
        category: 'Studnie DN1000',
        componentType: 'krag',
        dn: 1000,
        height: 500,
        magazynWL: 1,
        magazynKLB: 0,
        formaStandardowa: 1,
        formaStandardowaKLB: 1,
        price: 100
    },
    {
        id: 'S2',
        name: 'Przejście',
        category: 'Przejścia szczelne',
        componentType: 'przejscie',
        dn: 200,
        price: 50
    }
];

describe('Etap C: requireExportSource', () => {
    it('live|default przechodzi', () => {
        expect(requireExportSource('live')).toBe('live');
        expect(requireExportSource('default')).toBe('default');
    });

    it.each([['LIVE'], [''], [undefined], [null], ['wersja']])(
        'zły source %p → 422 INVALID_SOURCE',
        (source) => {
            let err: unknown = null;
            try {
                requireExportSource(source);
            } catch (e) {
                err = e;
            }
            expect(err).toBeInstanceOf(PricelistVersionError);
            expect((err as PricelistVersionError).statusCode).toBe(422);
            expect((err as PricelistVersionError).code).toBe('INVALID_SOURCE');
        }
    );
});

describe('Etap C: rury live == version (arkusze/kolumny/kolejność)', () => {
    it('1 arkusz Cennik Rury, nagłówki 1:1 z FE, wartości bez normalizacji', () => {
        const live = projectVersionToLiveShape('rury', {
            rury: [{ ...RURY_ROW, weight: null }]
        });
        expect(Object.keys(live)).toEqual(['Cennik Rury']);
        expect(Object.keys(live['Cennik Rury'][0])).toEqual([
            'Indeks',
            'Nazwa produktu',
            'Cena PLN (netto)',
            'Kategoria',
            'Waga (kg)',
            'Szt./transport',
            'Powierzchnia (m2)'
        ]);
        // `?? ''` jak FE — null → '', brak normalizacji wartości.
        expect(live['Cennik Rury'][0]['Waga (kg)']).toBe('');
        expect(live['Cennik Rury'][0]['Cena PLN (netto)']).toBe(10);
    });
});

describe('Etap C: studnie live == version (arkusze/kolumny/kolejność)', () => {
    it('grupowanie/sanitize jak FE, legacy 1/0 i dn liczbowe nietknięte', () => {
        const live = projectVersionToLiveShape('studnie', { studnie: STUDNIE_LEGACY_ROWS });
        expect(Object.keys(live)).toEqual(['DN1000', 'Przejścia']);
        expect(Object.keys(live['DN1000'][0])).toHaveLength(34);
        expect(live['DN1000'][0]['Mag WL']).toBe(1);
        expect(live['DN1000'][0]['Mag KLB']).toBe(0);
        expect(live['DN1000'][0]['DN']).toBe(1000);
    });

    it('ten sam zestaw produktów w shape legacy i canonical → te same arkusze/kolumny', () => {
        const legacy = projectVersionToLiveShape('studnie', { studnie: STUDNIE_LEGACY_ROWS });
        const canonical = projectVersionToLiveShape('studnie', {
            studnie: STUDNIE_LEGACY_ROWS.map((p) => ({
                ...p,
                dn: String(p.dn),
                magazynWL: p.magazynWL === 1,
                magazynKLB: p.magazynKLB === 1,
                formaStandardowa: true,
                formaStandardowaKLB: true
            }))
        });
        expect(Object.keys(canonical)).toEqual(Object.keys(legacy));
        for (const sheet of Object.keys(legacy)) {
            expect(Object.keys(canonical[sheet][0])).toEqual(Object.keys(legacy[sheet][0]));
        }
    });
});

describe('Etap C: preco nested == preco flat (3 arkusze 1:1 z FE)', () => {
    const flat = {
        konfig: [
            {
                id: 'k1',
                key: '1000',
                value: '{"skrzynkaWlazowa":5,"cenaDnoOsadnika":7,"cenaPelnaWysMB":9}'
            }
        ],
        kinety: [
            { id: 'kk1', order: 0, dn: 160, wellDn: 1000, height: 500, cena: 11 },
            { id: 'kk2', order: 1, dn: 200, wellDn: 1000, height: 600, cena: 13 }
        ],
        zakresy: [
            {
                id: 'z1',
                order: 0,
                label: 'spadekKineta',
                min: 100,
                max: 200,
                grupy: '{"160":21}',
                wellDn: 1000
            }
        ]
    };
    const nested = {
        '1000': {
            skrzynkaWlazowa: 5,
            cenaDnoOsadnika: 7,
            cenaPelnaWysMB: 9,
            kinety: [
                { dn: 160, prosta: 500, dodWlot: 11, order: 0 },
                { dn: 200, prosta: 600, dodWlot: 13, order: 1 }
            ],
            spadekKineta: [{ order: 0, min: 100, max: 200, grupy: { '160': 21 } }]
        }
    };

    it('projectPrecoNestedToSheets deep-equals projectVersionToLiveShape(preco, flat)', () => {
        expect(projectPrecoNestedToSheets(nested)).toEqual(
            projectVersionToLiveShape('preco', flat)
        );
    });

    it('puste entry → brak arkuszy (jak FE)', () => {
        expect(projectPrecoNestedToSheets({})).toEqual({});
        expect(projectPrecoNestedToSheets(null)).toEqual({});
    });
});

describe('Etap C: liveSheetsToXlsxSheets', () => {
    it('nagłówki z pierwszego wiersza, undefined → null', () => {
        const sheets = liveSheetsToXlsxSheets({ Ark: [{ a: 1, b: undefined }] }, 'Fallback');
        expect(sheets).toEqual([{ name: 'Ark', headers: ['a', 'b'], rows: [[1, null]] }]);
    });

    it('pusto → 1 pusty arkusz fallback', () => {
        expect(liveSheetsToXlsxSheets({}, 'Cennik')).toEqual([
            { name: 'Cennik', headers: ['id'], rows: [] }
        ]);
    });
});

describe('F1: eksport studni dokleja PRECO z tego samego źródła', () => {
    const PRECO_ENTRY = {
        '1000': {
            skrzynkaWlazowa: 5,
            cenaDnoOsadnika: 7,
            cenaPelnaWysMB: 9,
            kinety: [{ dn: 160, prosta: 500, dodWlot: 11, order: 0 }],
            spadekKineta: [{ order: 0, min: 100, max: 200, grupy: { '160': 21 } }]
        }
    };

    // Składanie jak handler GET /api/products-studnie/export.xlsx:
    // najpierw arkusze studni, potem PRECO_Kinety/Zakresy/Dodatki.
    function buildStudnieExport(
        studnieRows: Array<Record<string, unknown>>,
        precoEntry: Record<string, unknown>
    ) {
        const live = projectVersionToLiveShape('studnie', { studnie: studnieRows });
        return { ...live, ...projectPrecoNestedToSheets(precoEntry) };
    }

    it('arkusze studni + PRECO w kolejności jak stary eksport FE', () => {
        const merged = buildStudnieExport(STUDNIE_LEGACY_ROWS, PRECO_ENTRY);
        expect(Object.keys(merged)).toEqual([
            'DN1000',
            'Przejścia',
            'PRECO_Kinety',
            'PRECO_Zakresy',
            'PRECO_Dodatki'
        ]);
    });

    it('kształt arkuszy PRECO 1:1 z kontraktem A3 (nagłówki jak FE)', () => {
        const merged = buildStudnieExport(STUDNIE_LEGACY_ROWS, PRECO_ENTRY);
        expect(Object.keys(merged['PRECO_Kinety'][0])).toEqual([
            'DN Studni',
            'DN Rury',
            'Cena prosta (PLN)',
            'Dod. wlot (PLN)'
        ]);
        expect(Object.keys(merged['PRECO_Zakresy'][0])).toEqual([
            'Typ',
            'DN Studni',
            'Min',
            'Max',
            'Grupa DN',
            'Cena (PLN)'
        ]);
        expect(Object.keys(merged['PRECO_Dodatki'][0])).toEqual([
            'DN Studni',
            'Skrzynka włazowa',
            'Cena dna osadnika',
            'Cena pełna wys MB'
        ]);
        expect(merged['PRECO_Kinety'][0]).toEqual({
            'DN Studni': 1000,
            'DN Rury': 160,
            'Cena prosta (PLN)': 500,
            'Dod. wlot (PLN)': 11
        });
    });

    it('puste PRECO pomijane — tylko arkusze studni', () => {
        expect(Object.keys(buildStudnieExport(STUDNIE_LEGACY_ROWS, {}))).toEqual([
            'DN1000',
            'Przejścia'
        ]);
    });

    it('formatPrecoResponse czyta z podanych tabel (live albo *Default)', async () => {
        const table = (rows: Array<Record<string, unknown>>) => ({
            findMany: jest.fn().mockResolvedValue(rows)
        });
        const konfig = table([{ key: '1000', value: '{"skrzynkaWlazowa":5}' }]);
        const kinety = table([{ dn: 160, wellDn: 1000, height: 500, cena: 11, order: 0 }]);
        const zakresy = table([]);
        const result = await formatPrecoResponse(konfig, kinety, zakresy);
        expect(konfig.findMany).toHaveBeenCalled();
        expect(kinety.findMany).toHaveBeenCalled();
        expect(zakresy.findMany).toHaveBeenCalled();
        expect(result.data[0]).toEqual({
            '1000': {
                skrzynkaWlazowa: 5,
                kinety: [{ dn: 160, prosta: 500, dodWlot: 11, order: 0 }],
                spadekKineta: [],
                spadekMufa: [],
                uniesienie: [],
                redukcja: []
            }
        });
    });
});
