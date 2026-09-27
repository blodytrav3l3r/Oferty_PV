/**
 * Etap A (test A4): shape eksportu wersji == shape eksportu LIVE.
 * Unit na poziomie projectVersionToLiveShape (mock sections) + stałe kolumn.
 * Bez porównywania danych biznesowych — tylko arkusze/kolumny/kolejność.
 *
 * SSoT kształtu (przepisane 1:1 z FE):
 * - RURY: public/js/rury/pricelistUi.js:336 RURY_EXPORT_COLUMNS
 * - STUDNIE: public/js/studnie/pricelistState.js:42 EXPORT_COLUMNS
 * - arkusze/sort/sanitize: liveStudnieSheetName w src/services/pricelistVersionService.ts
 *   (eksport studni buduje serwer, Etap C — brak getSheetName w FE)
 * - PRECO: public/js/studnie/pricelistImportExport.js:78-147
 */

const versions: Array<{ id: string; type: string; seq: number; version: string; status: string }> =
    [];
const itemsRury: Array<Record<string, unknown>> = [];
const itemsStudnie: Array<Record<string, unknown>> = [];
const itemsKonfig: Array<Record<string, unknown>> = [];
const itemsKinety: Array<Record<string, unknown>> = [];
const itemsZakresy: Array<Record<string, unknown>> = [];

jest.mock('../src/prismaClient', () => ({
    __esModule: true,
    default: {
        pricelistVersion: {
            findUnique: jest.fn(async ({ where }: { where: { id: string } }) => {
                return versions.find((v) => v.id === where.id) ?? null;
            }),
            findFirst: jest.fn(async ({ where }: { where: { type?: string; seq?: number } }) => {
                return (
                    versions.find(
                        (v) =>
                            (where.type === undefined || v.type === where.type) &&
                            (where.seq === undefined || v.seq === where.seq)
                    ) ?? null
                );
            })
        },
        pricelistItemRury: {
            findMany: jest.fn(async ({ where }: { where: { versionId: string } }) => {
                return itemsRury.filter((r) => r.versionId === where.versionId);
            })
        },
        pricelistItemStudnie: {
            findMany: jest.fn(async ({ where }: { where: { versionId: string } }) => {
                return itemsStudnie.filter((r) => r.versionId === where.versionId);
            })
        },
        pricelistItemPrecoKonfig: {
            findMany: jest.fn(async ({ where }: { where: { versionId: string } }) => {
                return itemsKonfig.filter((r) => r.versionId === where.versionId);
            })
        },
        pricelistItemPrecoKinety: {
            findMany: jest.fn(async ({ where }: { where: { versionId: string } }) => {
                return itemsKinety.filter((r) => r.versionId === where.versionId);
            })
        },
        pricelistItemPrecoZakresy: {
            findMany: jest.fn(async ({ where }: { where: { versionId: string } }) => {
                return itemsZakresy.filter((r) => r.versionId === where.versionId);
            })
        }
    }
}));

import {
    PRECO_DODATKI_LIVE_COLUMNS,
    PRECO_KINETY_LIVE_COLUMNS,
    PRECO_ZAKRESY_LIVE_COLUMNS,
    RURY_LIVE_COLUMNS,
    RURY_LIVE_SHEET,
    STUDNIE_LIVE_COLUMNS,
    getVersionExportSheets,
    liveSanitizeSheetName,
    liveStudnieSheetName,
    projectVersionToLiveShape
} from '../src/services/pricelistVersionService';
import { versionExportFilename } from '../src/utils/exportFilenames';

// Oczekiwane nagłówki 1:1 z FE (RURY_EXPORT_COLUMNS z pricelistUi.js:336).
const EXPECTED_RURY_HEADERS = [
    'Indeks',
    'Nazwa produktu',
    'Cena PLN (netto)',
    'Kategoria',
    'Waga (kg)',
    'Szt./transport',
    'Powierzchnia (m2)'
];

// Oczekiwane nagłówki 1:1 z FE (EXPORT_COLUMNS z pricelistState.js:42).
const EXPECTED_STUDNIE_HEADERS = [
    'Indeks',
    'Nazwa',
    'Kategoria',
    'Typ komponentu',
    'DN',
    'Wysokość mm',
    'Waga kg',
    'Pow. wewn. m²',
    'Pow. zewn. m²',
    'Ilość/transport',
    'Cena PLN',
    'Dopłata PEHD',
    'Malow. wewn.',
    'Malow. zewn.',
    'Dopłata Żelbet',
    'Drab. Nierdzewna',
    'Mag WL',
    'Mag KLB',
    'Forma std. WL',
    'Forma std. KLB',
    'Zapas dół mm',
    'Zapas góra mm',
    'Zapas dół min mm',
    'Zapas góra min mm',
    'Wys. spocznika',
    'Hmin 1 mm',
    'Hmax 1 mm',
    'Cena 1 PLN',
    'Hmin 2 mm',
    'Hmax 2 mm',
    'Cena 2 PLN',
    'Hmin 3 mm',
    'Hmax 3 mm',
    'Cena 3 PLN'
];

describe('Etap A: projectVersionToLiveShape — RURY', () => {
    it('stałe kolumn == nagłówki LIVE 1:1 (nazwy + kolejność)', () => {
        expect(RURY_LIVE_COLUMNS.map((c) => c.header)).toEqual(EXPECTED_RURY_HEADERS);
        expect(RURY_LIVE_COLUMNS.map((c) => c.key)).toEqual([
            'id',
            'name',
            'price',
            'category',
            'weight',
            'transport',
            'area'
        ]);
    });

    it('1 arkusz Cennik Rury, kolumny LIVE, wartości ?? ""', () => {
        const out = projectVersionToLiveShape('rury', {
            rury: [
                {
                    id: 'R1',
                    name: 'Rura A',
                    price: 10,
                    category: 'K1',
                    weight: null,
                    transport: 5,
                    area: undefined
                }
            ]
        });
        expect(Object.keys(out)).toEqual([RURY_LIVE_SHEET]);
        expect(Object.keys(out[RURY_LIVE_SHEET][0])).toEqual(EXPECTED_RURY_HEADERS);
        expect(out[RURY_LIVE_SHEET][0]).toEqual({
            Indeks: 'R1',
            'Nazwa produktu': 'Rura A',
            'Cena PLN (netto)': 10,
            Kategoria: 'K1',
            'Waga (kg)': '',
            'Szt./transport': 5,
            'Powierzchnia (m2)': ''
        });
    });

    it('pusta sekcja → brak arkuszy', () => {
        expect(projectVersionToLiveShape('rury', { rury: [] })).toEqual({});
        expect(projectVersionToLiveShape('rury', {})).toEqual({});
    });
});

describe('Etap A: projectVersionToLiveShape — STUDNIE', () => {
    it('stałe kolumn == nagłówki LIVE 1:1 (34 kolumny, nazwy + kolejność)', () => {
        expect(STUDNIE_LIVE_COLUMNS.map((c) => c.header)).toEqual(EXPECTED_STUDNIE_HEADERS);
        expect(STUDNIE_LIVE_COLUMNS).toHaveLength(34);
    });

    it('getSheetName 1:1 z LIVE (Akcesoria/Przejścia/Styczna/Kinety/Dennicy/DN/Inne)', () => {
        expect(liveStudnieSheetName({ category: 'Akcesoria studni' })).toBe('Akcesoria');
        expect(liveStudnieSheetName({ componentType: 'wlaz' })).toBe('Akcesoria');
        expect(liveStudnieSheetName({ category: 'Przejścia szczelne' })).toBe('Przejścia');
        expect(liveStudnieSheetName({ componentType: 'przejscie' })).toBe('Przejścia');
        expect(liveStudnieSheetName({ componentType: 'styczna' })).toBe('Styczna');
        expect(liveStudnieSheetName({ componentType: ' Styczna ' })).toBe('Styczna');
        expect(liveStudnieSheetName({ componentType: 'STYCZNA' })).toBe('Styczna');
        // Styczna wygrywa z DN (seed: dn numeryczne, np. '1000').
        expect(
            liveStudnieSheetName({
                category: 'Studnie styczne',
                componentType: 'styczna',
                dn: '1000'
            })
        ).toBe('Styczna');
        expect(liveStudnieSheetName({ category: 'Kinety XYZ' })).toBe('Kinety');
        expect(liveStudnieSheetName({ componentType: 'kineta' })).toBe('Kinety');
        expect(liveStudnieSheetName({ category: 'Dennice', componentType: 'x' })).toBe('Dennicy');
        expect(liveStudnieSheetName({ componentType: 'dennica' })).toBe('Dennicy');
        expect(liveStudnieSheetName({ dn: '1000' })).toBe('DN1000');
        expect(liveStudnieSheetName({})).toBe('Inne');
    });

    it('sanitize nazwy arkusza (jak LIVE)', () => {
        expect(liveSanitizeSheetName('A/B:C*D?E[F]G')).toBe('A_B_C_D_E_F_G');
        expect(liveSanitizeSheetName('x'.repeat(40))).toHaveLength(31);
    });

    it('arkusze w kolejności pierwszego wystąpienia, sort tylko Przejścia, ?? ""', () => {
        const out = projectVersionToLiveShape('studnie', {
            studnie: [
                { id: 'K1', category: 'Kinety A', componentType: 'kineta', dn: '1000' },
                { id: 'P2', category: 'Przejścia B', componentType: 'przejscie', dn: '200' },
                { id: 'P1', category: 'Przejścia A', componentType: 'przejscie', dn: '100' },
                { id: 'A1', category: 'Akcesoria studni', componentType: 'x' },
                { id: 'D1', dn: '1500' }
            ]
        });
        expect(Object.keys(out)).toEqual(['Kinety', 'Przejścia', 'Akcesoria', 'DN1500']);
        expect(out['Przejścia'].map((r) => r['Indeks'])).toEqual(['P1', 'P2']);
        for (const rows of Object.values(out)) {
            for (const row of rows) {
                expect(Object.keys(row)).toEqual(EXPECTED_STUDNIE_HEADERS);
            }
        }
        expect(out['Akcesoria'][0]['DN']).toBe('');
    });

    it('styczna ląduje w arkuszu Styczna, nie w DN/Inne (bez sortowania)', () => {
        const out = projectVersionToLiveShape('studnie', {
            studnie: [
                {
                    id: 'DDD-10-STYCZNA',
                    category: 'Studnie styczne',
                    componentType: 'styczna',
                    dn: '1000'
                },
                {
                    id: 'DDD-12-STYCZNA+KOREK',
                    category: 'Studnie styczne',
                    componentType: 'styczna',
                    dn: '1200'
                },
                { id: 'K-1000', category: 'Kręgi', componentType: 'krag', dn: '1000' }
            ]
        });
        expect(Object.keys(out)).toEqual(['Styczna', 'DN1000']);
        expect(out['Styczna'].map((r) => r['Indeks'])).toEqual([
            'DDD-10-STYCZNA',
            'DDD-12-STYCZNA+KOREK'
        ]);
        expect(Object.keys(out['Styczna'][0])).toEqual(EXPECTED_STUDNIE_HEADERS);
    });

    it('pusta sekcja → brak arkuszy', () => {
        expect(projectVersionToLiveShape('studnie', { studnie: [] })).toEqual({});
    });
});

describe('Etap A: projectVersionToLiveShape — PRECO', () => {
    it('stałe kolumn == nagłówki LIVE 1:1', () => {
        expect([...PRECO_KINETY_LIVE_COLUMNS]).toEqual([
            'DN Studni',
            'DN Rury',
            'Cena prosta (PLN)',
            'Dod. wlot (PLN)'
        ]);
        expect([...PRECO_ZAKRESY_LIVE_COLUMNS]).toEqual([
            'Typ',
            'DN Studni',
            'Min',
            'Max',
            'Grupa DN',
            'Cena (PLN)'
        ]);
        expect([...PRECO_DODATKI_LIVE_COLUMNS]).toEqual([
            'DN Studni',
            'Skrzynka włazowa',
            'Cena dna osadnika',
            'Cena pełna wys MB'
        ]);
    });

    it('kinety: kolejność z DB (order), mapowanie mechaniczne', () => {
        const out = projectVersionToLiveShape('preco', {
            kinety: [
                { id: 'k2', order: 2, dn: 200, wellDn: 1000, height: 300, cena: 40 },
                { id: 'k1', order: 1, dn: 160, wellDn: 1000, height: 250, cena: 30 }
            ]
        });
        expect(Object.keys(out)).toEqual(['PRECO_Kinety']);
        expect(out['PRECO_Kinety']).toEqual([
            { 'DN Studni': 1000, 'DN Rury': 160, 'Cena prosta (PLN)': 250, 'Dod. wlot (PLN)': 30 },
            { 'DN Studni': 1000, 'DN Rury': 200, 'Cena prosta (PLN)': 300, 'Dod. wlot (PLN)': 40 }
        ]);
    });

    it('zakresy: jeden wiersz per klucz grupy (grupy = JSON-string)', () => {
        const out = projectVersionToLiveShape('preco', {
            konfig: [],
            kinety: [],
            zakresy: [
                {
                    id: 'z1',
                    order: 1,
                    label: 'spadekKineta',
                    min: 0,
                    max: 100,
                    grupy: JSON.stringify({ '110-160': 50, '200-250': 70 }),
                    wellDn: 1200
                }
            ]
        });
        expect(out['PRECO_Zakresy']).toEqual([
            {
                Typ: 'spadekKineta',
                'DN Studni': 1200,
                Min: 0,
                Max: 100,
                'Grupa DN': '110-160',
                'Cena (PLN)': 50
            },
            {
                Typ: 'spadekKineta',
                'DN Studni': 1200,
                Min: 0,
                Max: 100,
                'Grupa DN': '200-250',
                'Cena (PLN)': 70
            }
        ]);
        expect(Object.keys(out['PRECO_Zakresy'][0])).toEqual([
            'Typ',
            'DN Studni',
            'Min',
            'Max',
            'Grupa DN',
            'Cena (PLN)'
        ]);
    });

    it('konfig: wiersz dodatków z JSON value, braki → 0 (jak LIVE || 0)', () => {
        const out = projectVersionToLiveShape('preco', {
            konfig: [
                {
                    id: 'c1',
                    key: '1000',
                    value: JSON.stringify({
                        skrzynkaWlazowa: 11,
                        cenaPelnaWysMB: 22,
                        cenaDnoOsadnika: 33
                    })
                },
                { id: 'c2', key: '800', value: JSON.stringify({}) }
            ],
            kinety: [],
            zakresy: []
        });
        expect(out['PRECO_Dodatki']).toEqual([
            {
                'DN Studni': 800,
                'Skrzynka włazowa': 0,
                'Cena dna osadnika': 0,
                'Cena pełna wys MB': 0
            },
            {
                'DN Studni': 1000,
                'Skrzynka włazowa': 11,
                'Cena dna osadnika': 33,
                'Cena pełna wys MB': 22
            }
        ]);
    });

    it('puste sekcje → pominięte arkusze; kolejność arkuszy jak LIVE', () => {
        const out = projectVersionToLiveShape('preco', {
            konfig: [{ id: 'c1', key: '1000', value: '{}' }],
            kinety: [],
            zakresy: []
        });
        expect(Object.keys(out)).toEqual(['PRECO_Dodatki']);
        expect(projectVersionToLiveShape('preco', { konfig: [], kinety: [], zakresy: [] })).toEqual(
            {}
        );
    });
});

describe('Eksport wersji studni dokleja PRECO same-seq (jak LIVE F1)', () => {
    beforeEach(() => {
        versions.length = 0;
        itemsRury.length = 0;
        itemsStudnie.length = 0;
        itemsKonfig.length = 0;
        itemsKinety.length = 0;
        itemsZakresy.length = 0;
        versions.push(
            { id: 's1', type: 'studnie', seq: 5, version: 'v5', status: 'ACTIVE' },
            // Status dowolny (snapshot) — DRAFT też doklejane, liczy się seq.
            { id: 'p5', type: 'preco', seq: 5, version: 'v5', status: 'DRAFT' },
            { id: 'p9', type: 'preco', seq: 9, version: 'v9', status: 'ACTIVE' },
            { id: 'r5', type: 'rury', seq: 5, version: 'v5', status: 'ACTIVE' }
        );
        itemsStudnie.push({
            id: 's1:K1',
            versionId: 's1',
            name: 'Krąg',
            category: 'Kręgi',
            componentType: 'krag',
            dn: '1000'
        });
        itemsKinety.push({
            id: 'p5:k1',
            versionId: 'p5',
            order: 0,
            dn: 160,
            wellDn: 1000,
            height: 500,
            cena: 11
        });
        itemsKinety.push({
            id: 'p9:k9',
            versionId: 'p9',
            order: 0,
            dn: 200,
            wellDn: 1000,
            height: 600,
            cena: 13
        });
        itemsRury.push({ id: 'r5:R1', versionId: 'r5', name: 'Rura', price: 10 });
    });

    it('preco same-seq doklejone w kolejności po studni', async () => {
        const { sheets } = await getVersionExportSheets('s1');
        expect(Object.keys(sheets)).toEqual(['DN1000', 'PRECO_Kinety']);
        expect(sheets['PRECO_Kinety']).toEqual([
            {
                'DN Studni': 1000,
                'DN Rury': 160,
                'Cena prosta (PLN)': 500,
                'Dod. wlot (PLN)': 11
            }
        ]);
    });

    it('brak preco same-seq → tylko studnie (bez błędu)', async () => {
        versions.splice(
            versions.findIndex((v) => v.id === 'p5'),
            1
        );
        const { sheets } = await getVersionExportSheets('s1');
        expect(Object.keys(sheets)).toEqual(['DN1000']);
    });

    it('inny seq ignorowany (p9 nie doklejane do s1)', async () => {
        versions.splice(
            versions.findIndex((v) => v.id === 'p5'),
            1
        );
        const { sheets } = await getVersionExportSheets('s1');
        expect(sheets['PRECO_Kinety']).toBeUndefined();
        expect(Object.keys(sheets)).toEqual(['DN1000']);
    });

    it('rury bez zmian (preco same-seq nie doklejane)', async () => {
        const { sheets } = await getVersionExportSheets('r5');
        expect(Object.keys(sheets)).toEqual(['Cennik Rury']);
    });
});

describe('Nazwa pliku eksportu wersji (konwencja LIVE)', () => {
    it('3 typy → Cennik_{Type}_{version}_Export.xlsx', () => {
        expect(versionExportFilename('rury', 'v1')).toBe('Cennik_Rury_v1_Export.xlsx');
        expect(versionExportFilename('studnie', 'v2')).toBe('Cennik_Studnie_v2_Export.xlsx');
        expect(versionExportFilename('preco', 'v3')).toBe('Cennik_Preco_v3_Export.xlsx');
    });

    it('version z myślnikami przechodzi bez zmian', () => {
        expect(versionExportFilename('studnie', 'v1-20260927')).toBe(
            'Cennik_Studnie_v1-20260927_Export.xlsx'
        );
    });

    it('nieznany typ przechodzi jak jest', () => {
        expect(versionExportFilename('xyz', 'v1')).toBe('Cennik_xyz_v1_Export.xlsx');
    });
});
