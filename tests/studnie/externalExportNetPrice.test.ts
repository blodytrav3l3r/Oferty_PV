// @ts-nocheck
/**
 * Eksport XLSX (zewn.) z kartoteki: CENA_JEDNOSTKOWA = cena KOŃCOWA po rabacie,
 * RABAT pusty (plik niesie już cenę netto, import bierze ją wprost).
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';

const ROOT = path.join(__dirname, '..', '..');
const JS_IE = path.join(ROOT, 'public', 'js', 'import-export');

function baseSandbox() {
    const sandbox = { window: {}, console, setTimeout: () => 0 };
    vm.createContext(sandbox);
    return sandbox;
}

function loadStudnieTemplate() {
    const sb = baseSandbox();
    for (const rel of ['shared/xlsxImportShared.js', 'studnie/externalExportTemplate.js']) {
        vm.runInContext(fs.readFileSync(path.join(JS_IE, rel), 'utf8'), sb, { filename: rel });
    }
    return sb.window.StudnieExternalExportTemplate;
}

function loadRuryTemplate() {
    const sb = baseSandbox();
    vm.runInContext(
        fs.readFileSync(path.join(JS_IE, 'rury', 'externalExportTemplate.js'), 'utf8'),
        sb,
        { filename: 'rury/externalExportTemplate.js' }
    );
    return sb.window.RuryExternalExportTemplate;
}

describe('studnie: eksport zewnętrzny = ceny po rabacie', () => {
    const T = loadStudnieTemplate();
    const catalog = [
        { id: 'DEN-1', componentType: 'dennica', price: 1000 },
        { id: 'KR-1', componentType: 'krag', price: 200 },
        { id: 'KIN-1', componentType: 'kineta', price: 300 }
    ];
    T._productMap = new Map(catalog.map((p) => [p.id, p]));

    const data = {
        wells: [
            {
                name: 'S1',
                dn: 1000,
                zwienczenie: 'Konus DN1000',
                rzednaWlazu: 3,
                rzednaDna: 0,
                magazyn: 'Kluczbork',
                config: [
                    // cennik 1000, rabat dennicowy 20% → 800
                    { productId: 'DEN-1', quantity: 1, _xp: 1000, _xd: 20 },
                    // cennik 200, rabat nadbudowy 25% → 150
                    { productId: 'KR-1', quantity: 2, _xp: 200, _xd: 25 },
                    // wiersz z narzutami: `_xp` już końcowa (bez `_xd`) → 870
                    { productId: 'KR-1', quantity: 1, _xp: 870 },
                    // kineta: tylko przez dennicę, nie ma własnego wiersza
                    { productId: 'KIN-1', quantity: 1, _xskip: true, _xp: 0 }
                ]
            }
        ]
    };
    const rows = T._wellRows(data, 'OS/1', null);

    test('trzy wiersze, kineta pominięta', () => {
        expect(rows).toHaveLength(3);
        expect(rows.map((r) => r.INDEKS_CZESCI)).toEqual(['DEN-1', 'KR-1', 'KR-1']);
    });

    test('CENA_JEDNOSTKOWA po rabacie, RABAT pusty', () => {
        expect(rows[0].CENA_JEDNOSTKOWA).toBe(800);
        expect(rows[1].CENA_JEDNOSTKOWA).toBe(150);
        expect(rows[2].CENA_JEDNOSTKOWA).toBe(870);
        for (const r of rows) expect(r.RABAT).toBe('');
    });

    test('ZAKONCZENIE i pozostałe kolumny bez zmian', () => {
        expect(rows[0].ZAKONCZENIE).toBe('Konus DN1000');
        expect(rows[0].NUMER_OFERTY).toBe('OS/1');
        expect(rows[0].SREDNICA).toBe('X1000');
        expect(rows[0].LP).toBe(1);
    });

    test('legacy bez `_xp`: cennik x (1 - rabat z oferty)', () => {
        const legacy = {
            wellDiscounts: { 1000: { dennica: 20, nadbudowa: 25 } },
            wells: [
                {
                    name: 'S2',
                    dn: 1000,
                    rzednaWlazu: 2,
                    rzednaDna: 0,
                    magazyn: 'Kluczbork',
                    config: [
                        { productId: 'DEN-1', quantity: 1 },
                        { productId: 'KR-1', quantity: 1 }
                    ]
                }
            ]
        };
        const out = T._wellRows(legacy, 'OS/2', null);
        expect(out.map((r) => r.CENA_JEDNOSTKOWA)).toEqual([800, 150]);
        for (const r of out) expect(r.RABAT).toBe('');
    });
});

describe('rury: eksport zewnętrzny = ceny po rabacie', () => {
    const T = loadRuryTemplate();

    test('oferta: unitPrice katalogowy x (1 - rabat%), RABAT pusty', () => {
        const rows = T._offerRows({ offer_number: 'OF/1' }, [
            { productId: 'RTB-1', quantity: 1, unitPrice: 460, discount: 20 },
            { productId: 'ZT-1', quantity: 3, unitPrice: 40, discount: 0 }
        ]);
        expect(rows.map((r) => r.CENA_JEDNOSTKOWA)).toEqual([368, 40]);
        for (const r of rows) expect(r.RABAT).toBe('');
    });

    test('zaokrąglenie do groszy (417,225 → 417,23)', () => {
        expect(T._netUnitPrice({ unitPrice: 556.3, discount: 25 })).toBe(417.23);
    });

    test('fallback na `price` gdy brak `unitPrice`', () => {
        expect(T._netUnitPrice({ price: 100, discount: 10 })).toBe(90);
    });
});
