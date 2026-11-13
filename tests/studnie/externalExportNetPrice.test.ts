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
        { id: 'KIN-1', componentType: 'kineta', price: 300 },
        { id: 'WLAZ-1', componentType: 'wlaz', price: 130 }
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
                    // właz nie trafia do pliku (nie jest pozycją handlową)
                    { productId: 'WLAZ-1', quantity: 1, _xp: 130, _xd: 25 },
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

    test('właz nie jest eksportowany', () => {
        expect(rows.some((r) => r.INDEKS_CZESCI === 'WLAZ-1')).toBe(false);
    });

    test('właz po samym ID (WLAZ-110/WLAZ-150) — także bez katalogu', () => {
        const noCatalog = { ...T, _productMap: null };
        const out = noCatalog._wellRows(
            {
                wells: [
                    {
                        name: 'S1',
                        dn: 1000,
                        zwienczenie: 'Konus DN1000',
                        rzednaWlazu: 3,
                        rzednaDna: 0,
                        magazyn: 'Kluczbork',
                        config: [
                            { productId: 'WLAZ-150', quantity: 1 },
                            { productId: 'WLAZ-110', quantity: 1 },
                            { productId: 'KR-1', quantity: 1, frozenPrice: 150 }
                        ]
                    }
                ]
            },
            'OS/1',
            null
        );
        expect(out.map((r) => r.INDEKS_CZESCI)).toEqual(['KR-1']);
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

    test('transport „w cenie elementów” trafia do dennicy jak w kalkulacji', () => {
        const withTransport = {
            ...data,
            wells: [{ ...data.wells[0], transportCost: 500 }]
        };
        const out = T._wellRows(withTransport, 'OS/1', null);
        const sum = out.reduce((s, r) => s + r.CENA_JEDNOSTKOWA * (Number(r.ILOSC) || 0), 0);
        const base = rows.reduce((s, r) => s + r.CENA_JEDNOSTKOWA * (Number(r.ILOSC) || 0), 0);
        expect(Math.round(sum * 100) / 100).toBe(Math.round((base + 500) * 100) / 100);
        expect(out[0].CENA_JEDNOSTKOWA).toBe(1300);
        expect(out[1].CENA_JEDNOSTKOWA).toBe(150);
        expect(out[2].CENA_JEDNOSTKOWA).toBe(870);
        for (const r of out) expect(r.RABAT).toBe('');
    });

    test('transport rozdziela grosze na jednostki dennicy bez zmiany sumy', () => {
        const withTransport = {
            wells: [
                {
                    ...data.wells[0],
                    transportCost: 100,
                    config: [{ productId: 'DEN-1', quantity: 3, _xp: 1000, _xd: 20 }]
                }
            ]
        };
        const out = T._wellRows(withTransport, 'OS/1', null);
        expect(out.map((row) => row.ILOSC)).toEqual([2, 1]);
        expect(out.map((row) => row.CENA_JEDNOSTKOWA)).toEqual([833.33, 833.34]);
        expect(out.reduce((sum, row) => sum + row.ILOSC * row.CENA_JEDNOSTKOWA, 0)).toBe(2500);
    });

    test('brak dennicy: osobny transport przypisany do właściwej studni', () => {
        const noDennica = {
            transportSeparate: false,
            wells: [
                { ...data.wells[0], transportCost: 200 },
                {
                    ...data.wells[0],
                    name: 'S2',
                    transportCost: 500,
                    config: [{ productId: 'KR-1', quantity: 2, _xp: 200, _xd: 25 }]
                }
            ]
        };
        const out = T._wellRows(noDennica, 'OS/1', null);
        const transport = out.find((row) => row.INDEKS_CZESCI === 'TR-STUDNIE');

        expect(out).toHaveLength(5);
        expect(
            out.find((row) => row.NR_STUDNI === 'S1' && row.INDEKS_CZESCI === 'DEN-1')
                .CENA_JEDNOSTKOWA
        ).toBe(1000);
        expect(transport).toMatchObject({
            NR_STUDNI: 'S2',
            INDEKS_CZESCI: 'TR-STUDNIE',
            ILOSC: 1,
            CENA_JEDNOSTKOWA: 500
        });
    });

    test('transport osobno: bez rozdziału (wiersz TR-STUDNIE poza _wellRows)', () => {
        const separate = {
            ...data,
            transportSeparate: true,
            wells: [{ ...data.wells[0], transportCost: 500 }]
        };
        const out = T._wellRows(separate, 'OS/1', null);
        expect(out[0].CENA_JEDNOSTKOWA).toBe(800);
        expect(out[2].CENA_JEDNOSTKOWA).toBe(870);
    });

    test('globalny transport zaimportowany ponownie używa kosztu z oferty', () => {
        const transportRow = T._transportRow(
            { transportSeparate: true, transportCost: 500, wells: [] },
            'OS/1',
            1
        );
        expect(transportRow).toMatchObject({
            INDEKS_CZESCI: 'TR-STUDNIE',
            NR_STUDNI: '',
            ILOSC: 1,
            CENA_JEDNOSTKOWA: 500
        });
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

    test('zamówienie (frozenPrice): kineta i przejścia doliczone do dennicy', () => {
        // Wartości z realnej oferty OS/000001/SA/2026 (wellsExport bez `_xp`).
        const order = {
            wells: [
                {
                    name: 's1',
                    dn: 1200,
                    zwienczenie: 'Konus DN1200',
                    rzednaWlazu: 3,
                    rzednaDna: 0,
                    magazyn: 'Kluczbork',
                    config: [
                        { productId: 'WLAZ-1', quantity: 1, frozenPrice: 0, frozenPriceBase: 0 },
                        {
                            productId: 'DEN-1',
                            quantity: 1,
                            frozenPrice: 840,
                            frozenPriceBase: 1050
                        },
                        { productId: 'KR-1', quantity: 2, frozenPrice: 150, frozenPriceBase: 200 },
                        { productId: 'KIN-1', quantity: 1, frozenPrice: 272, frozenPriceBase: 340 }
                    ],
                    przejscia: [
                        { productId: 'PVC-400', frozenPrice: 264, frozenPriceBase: 330 },
                        { productId: 'PVC-400', frozenPrice: 264, frozenPriceBase: 330 }
                    ]
                }
            ]
        };
        const out = T._wellRows(order, 'OS/3', null);
        // Kineta nie ma wiersza; dennica = 840 + 272 (kineta) + 528 (2 przejścia).
        expect(out.map((r) => r.INDEKS_CZESCI)).toEqual(['DEN-1', 'KR-1']);
        expect(out[0].CENA_JEDNOSTKOWA).toBe(1640);
        expect(out[1].CENA_JEDNOSTKOWA).toBe(150);
        const sum = out.reduce((s, r) => s + r.CENA_JEDNOSTKOWA * (Number(r.ILOSC) || 0), 0);
        // 840 + 2*150 + 272 + 528 = 1940 — cena studni z configu i przejść.
        expect(Math.round(sum * 100) / 100).toBe(1940);
    });
});

describe('rury: eksport zewnętrzny = ceny po rabacie', () => {
    const T = loadRuryTemplate();

    test('oferta: unitPrice katalogowy x (1 - rabat%), RABAT pusty', () => {
        const { rows } = T._offerRows({ offer_number: 'OF/1' }, [
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

test('eksport rur zaokrągla cenę pozycji i stawkę transportu handlowo do groszy', () => {
    const template = loadRuryTemplate();
    const { rows } = template._offerRows(
        { transportSeparate: true, transportCount: 1, transportCostPerTrip: 10.075 },
        [{ productId: 'R1', unitPrice: 1.005, quantity: 1 }]
    );
    expect(rows.map((row) => row.CENA_JEDNOSTKOWA)).toEqual([1.01, 10.08]);
});

test('eksport i import rur zachowuje 100 zł transportu dla trzech kursów', async () => {
    const template = loadRuryTemplate();
    const { rows } = template._offerRows(
        {
            transportSeparate: true,
            transportCount: 3,
            transportCost: 100,
            transportCostPerTrip: 100 / 3
        },
        [{ productId: 'R1', unitPrice: 50, quantity: 1 }]
    );
    const transport = rows.filter((row) => row.INDEKS_CZESCI === 'TR-RURY');
    expect(transport.map((row) => [row.ILOSC, row.CENA_JEDNOSTKOWA])).toEqual([
        [2, 33.33],
        [1, 33.34]
    ]);
    const sandbox = baseSandbox();
    for (const rel of ['shared/xlsxImportShared.js', 'rury/externalImport.js']) {
        vm.runInContext(fs.readFileSync(path.join(JS_IE, rel), 'utf8'), sandbox);
        if (sandbox.window.XlsxImportShared)
            sandbox.XlsxImportShared = sandbox.window.XlsxImportShared;
    }
    const imported = sandbox.window.RuryExternalImport._buildItems(rows);
    expect(imported.errors).toHaveLength(0);
    expect(imported.transportCost).toBe(100);
    expect(imported.transportCount).toBe(3);
    let payload;
    sandbox.XlsxImportShared.getLoadedOffers = () => [];
    sandbox.fetch = async (url, options) => {
        if (url === '/api/offers-rury') payload = JSON.parse(options.body).data[0];
        return { ok: true, json: async () => ({ results: [{ id: 'offer-1' }] }) };
    };
    const result = await sandbox.window.RuryExternalImport.import({ number: 'OF/1', rows });
    expect(result.success).toBe(true);
    expect(payload.transportCost).toBe(100);
    expect(payload.transportCount).toBe(3);
    expect(payload.externalTransportCost).toBe(100);
});

test('eksport zachowuje ułamkowy kurs, gdy cena jednostkowa daje dokładną sumę', () => {
    const { rows } = loadRuryTemplate()._offerRows(
        { transportSeparate: true, transportCount: 0.5, transportCost: 100 },
        [{ productId: 'R1', unitPrice: 50, quantity: 1 }]
    );
    const transport = rows.find((row) => row.INDEKS_CZESCI === 'TR-RURY');
    expect(transport.ILOSC).toBe(0.5);
    expect(transport.CENA_JEDNOSTKOWA).toBe(200);
});

test('eksport zamówienia rur zachowuje sumę transportu po podziale groszy', async () => {
    const sandbox = baseSandbox();
    let exportedRows;
    sandbox.XlsxImportShared = {
        generateExternalXlsx: async (_type, rows) => {
            exportedRows = rows;
            return {};
        }
    };
    sandbox.XLSX = { writeFile: () => {} };
    vm.runInContext(
        fs.readFileSync(path.join(JS_IE, 'rury/externalExportTemplate.js'), 'utf8'),
        sandbox
    );
    await sandbox.window.RuryExternalExportTemplate.generateAndDownloadOrder({
        orderNumber: 'ZR1',
        transportSeparate: true,
        transportCount: 3,
        transportCost: 100,
        transportCostPerTrip: 100 / 3,
        items: [{ productId: 'R1', quantity: 1, price: 50 }]
    });
    const transport = exportedRows.filter((row) => row.INDEKS_CZESCI === 'TR-RURY');
    expect(transport.map((row) => [row.ILOSC, row.CENA_JEDNOSTKOWA])).toEqual([
        [2, 33.33],
        [1, 33.34]
    ]);
});

test('eksport studni zaokrągla cenę pozycji handlowo do groszy', () => {
    const template = loadStudnieTemplate();
    const rows = template._wellRows(
        { wells: [{ name: 'S1', config: [{ productId: 'KR-1', quantity: 1, _xp: 10.075 }] }] },
        'OS/1',
        null
    );
    expect(rows[0].CENA_JEDNOSTKOWA).toBe(10.08);
});

test('eksport studni zapisuje stawkę transportu z dokładnością do groszy', () => {
    const template = loadStudnieTemplate();
    const row = template._transportRow(
        { transportSeparate: true, transportCost: 10.08, transportKm: 1, transportRate: 10.075 },
        'OS/1',
        1
    );
    expect(row.CENA_JEDNOSTKOWA).toBe(10.08);
    expect(row.ILOSC).toBe(1);
});
