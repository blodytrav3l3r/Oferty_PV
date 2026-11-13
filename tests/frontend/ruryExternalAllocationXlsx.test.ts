// @ts-nocheck -- vm sandbox, celowy brak typow dla public/js
import fs from 'fs';
import path from 'path';
import vm from 'vm';

const ROOT = path.join(__dirname, '..', '..');

function loadRuryXlsx() {
    const sandbox = { window: {} };
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    for (const file of [
        'public/js/import-export/shared/xlsxImportShared.js',
        'public/js/import-export/rury/externalExportTemplate.js',
        'public/js/import-export/rury/externalImport.js',
        'public/js/rury/offerExportsHelpers.js'
    ]) {
        vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), sandbox, {
            filename: file
        });
    }
    return sandbox;
}

describe('Rury XLSX transport allocation', () => {
    test('dzieli widoczne wiersze w groszach i odtwarza logiczną pozycję z UID', () => {
        const sandbox = loadRuryXlsx();
        const offer = {
            id: 'offer-1',
            offer_number: 'OF/1',
            transportAllocation: {
                version: 1,
                items: [
                    {
                        itemUid: 'item-1',
                        totalCents: 100,
                        segments: [
                            { quantity: 2, transportCentsPerUnit: 33 },
                            { quantity: 1, transportCentsPerUnit: 34 }
                        ]
                    }
                ]
            }
        };
        const source = {
            uid: 'item-1',
            productId: 'ABC-1',
            quantity: 3,
            unitPrice: 10,
            discount: 0
        };
        const exported = sandbox.RuryExternalExportTemplate._offerRows(offer, [source]);

        expect(exported.rows.map((row) => [row.ILOSC, row.CENA_JEDNOSTKOWA])).toEqual([
            [2, 10.33],
            [1, 10.34]
        ]);
        expect(exported.metadataRows).toHaveLength(2);
        expect(exported.metadataRows.map((row) => row.ROW_LP)).toEqual([1, 2]);

        const built = sandbox.RuryExternalImport._buildItems(exported.rows, {
            version: 1,
            items: [
                {
                    itemUid: 'item-1',
                    totalCents: 100,
                    sourceItem: source,
                    rowLps: ['1', '2'],
                    rowDetails: exported.metadataRows.map((entry: any) => ({
                        rowLp: String(entry.ROW_LP),
                        segment: entry.SEGMENT_JSON ? JSON.parse(entry.SEGMENT_JSON) : null,
                        lineCents: entry.LINE_CENTS,
                        rowSnapshot: JSON.parse(entry.ROW_JSON)
                    })),
                    segments: [
                        { quantity: 2, transportCentsPerUnit: 33 },
                        { quantity: 1, transportCentsPerUnit: 34 }
                    ]
                }
            ]
        });
        expect(built.items).toEqual([source]);
        expect(built.transportAllocation).toEqual({
            version: 1,
            items: [
                {
                    itemUid: 'item-1',
                    totalCents: 100,
                    segments: [
                        { quantity: 2, transportCentsPerUnit: 33 },
                        { quantity: 1, transportCentsPerUnit: 34 }
                    ]
                }
            ]
        });
    });

    test('wewnętrzny XLSX eksportuje segmenty jako osobne wiersze i zachowuje dokładną sumę', () => {
        const sandbox = loadRuryXlsx();
        const offer = {
            number: 'OF/SEG',
            items: [
                {
                    uid: 'item-1',
                    productId: 'ABC-1',
                    name: 'Produkt',
                    quantity: 3,
                    unitPrice: 10,
                    discount: 0
                }
            ]
        };
        const allocation = {
            version: 1,
            items: [
                {
                    itemUid: 'item-1',
                    totalCents: 100,
                    segments: [
                        { quantity: 2, transportCentsPerUnit: 33 },
                        { quantity: 1, transportCentsPerUnit: 34 }
                    ]
                }
            ]
        };
        const built = sandbox.buildOfferXlsxRows(offer, allocation, 1, 1);
        const presentation = sandbox.getOfferTransportPresentation(offer.items[0], allocation);
        const itemRows = built.itemRowMap[0].map((index: number) => built.rows[index]);

        expect(itemRows.map((row: unknown[]) => [row[5], row[9], row[10]])).toEqual([
            [2, 0.33, 20.66],
            [1, 0.34, 10.34]
        ]);
        const totalRow = built.rows.find((row: unknown[]) => row[8] === 'RAZEM Netto:');
        expect(totalRow?.[10]).toBe(31);
        expect(presentation.rows.map((row: any) => [row.quantity, row.unitPriceCents])).toEqual([
            [2, 1033],
            [1, 1034]
        ]);
        const meta = sandbox.buildOfferXlsxMetaRows(
            { ...offer, transportAllocation: allocation },
            built.itemRowMap
        );
        expect(meta).toContainEqual(['itemRowMap', JSON.stringify(built.itemRowMap)]);

        const fractional = sandbox.buildOfferXlsxRows(
            {
                number: 'OF/FRACTION',
                items: [{ ...offer.items[0], uid: 'fractional-1', quantity: 0.5 }]
            },
            { version: 1, items: [{ itemUid: 'fractional-1', totalCents: 1 }] },
            1,
            0.5
        );
        const adjustmentRow = fractional.rows.find((row: unknown[]) => row[1] === 'TR-RURY');
        const fractionalTotal = fractional.rows.find((row: unknown[]) => row[8] === 'RAZEM Netto:');
        expect(adjustmentRow?.[10]).toBe(0.01);
        expect(fractionalTotal?.[10]).toBe(5.01);
    });

    test('ułamek ma jawny wiersz korekty, a stary XLSX nie scala wierszy', () => {
        const sandbox = loadRuryXlsx();
        const source = {
            uid: 'fractional-1',
            productId: 'ABC-2',
            quantity: 0.5,
            unitPrice: 10
        };
        const exported = sandbox.RuryExternalExportTemplate._offerRows(
            {
                offer_number: 'OF/2',
                transportAllocation: {
                    version: 1,
                    items: [{ itemUid: 'fractional-1', totalCents: 1 }]
                }
            },
            [source]
        );
        expect(
            exported.rows.map((row) => [row.INDEKS_CZESCI, row.ILOSC, row.CENA_JEDNOSTKOWA])
        ).toEqual([
            ['ABC-2', 0.5, 10],
            ['TR-RURY', 1, 0.01]
        ]);
        expect(exported.metadataRows.map((row) => row.LINE_CENTS)).toEqual([0, 1]);
        const fractionalImport = sandbox.RuryExternalImport._buildItems(exported.rows, {
            version: 1,
            items: [
                {
                    itemUid: 'fractional-1',
                    totalCents: 1,
                    sourceItem: source,
                    segments: [],
                    lineCents: 1,
                    rowLps: ['1', '2'],
                    rowDetails: [
                        {
                            rowLp: '1',
                            segment: null,
                            lineCents: 0,
                            rowSnapshot: JSON.parse(
                                exported.metadataRows.find((entry: any) => entry.ROW_LP === 1)
                                    .ROW_JSON
                            )
                        },
                        {
                            rowLp: '2',
                            segment: null,
                            lineCents: 1,
                            rowSnapshot: JSON.parse(
                                exported.metadataRows.find((entry: any) => entry.ROW_LP === 2)
                                    .ROW_JSON
                            )
                        }
                    ]
                }
            ]
        });
        expect(fractionalImport.invalid).toBe(false);
        expect(fractionalImport.items).toEqual([source]);

        const oldRows = [
            { INDEKS_CZESCI: 'ABC-3', ILOSC: '1', CENA_JEDNOSTKOWA: '10', LP: '1' },
            { INDEKS_CZESCI: 'ABC-3', ILOSC: '1', CENA_JEDNOSTKOWA: '10', LP: '2' }
        ];
        const imported = sandbox.RuryExternalImport._buildItems(oldRows);
        expect(imported.items).toHaveLength(2);
    });

    test.each([
        ['ILOSC', '8'],
        ['CENA_JEDNOSTKOWA', '99.99'],
        ['RABAT', '10'],
        ['RABAT', 'abc'],
        ['NR_STUDNI', 'PEHD-4MM'],
        ['NUMER_OFERTY', 'OF/CHANGED']
    ])('zgłasza konflikt, gdy widoczny XLSX zmienia %s', (column, changedValue) => {
        const sandbox = loadRuryXlsx();
        const source = {
            uid: 'item-1',
            productId: 'ABC-1',
            quantity: 3,
            unitPrice: 10,
            discount: 0
        };
        const exported = sandbox.RuryExternalExportTemplate._offerRows(
            {
                offer_number: 'OF/EDIT',
                transportAllocation: {
                    version: 1,
                    items: [
                        {
                            itemUid: 'item-1',
                            totalCents: 100,
                            segments: [
                                { quantity: 2, transportCentsPerUnit: 33 },
                                { quantity: 1, transportCentsPerUnit: 34 }
                            ]
                        }
                    ]
                }
            },
            [source]
        );
        const row = exported.rows[0];
        row[column] = changedValue;
        const metadata = {
            version: 1,
            offerNumber: 'OF/EDIT',
            items: [
                {
                    itemUid: 'item-1',
                    totalCents: 100,
                    sourceItem: source,
                    rowLps: ['1', '2'],
                    segments: [
                        { quantity: 2, transportCentsPerUnit: 33 },
                        { quantity: 1, transportCentsPerUnit: 34 }
                    ],
                    rowLps: exported.metadataRows.map((entry: any) => String(entry.ROW_LP)),
                    rowDetails: exported.metadataRows.map((entry: any) => ({
                        rowLp: String(entry.ROW_LP),
                        segment: entry.SEGMENT_JSON ? JSON.parse(entry.SEGMENT_JSON) : null,
                        lineCents: entry.LINE_CENTS,
                        rowSnapshot: JSON.parse(entry.ROW_JSON)
                    }))
                }
            ]
        };
        const built = sandbox.RuryExternalImport._buildItems(exported.rows, metadata);

        expect(built.invalid).toBe(true);
        expect(built.items).toHaveLength(0);
        expect(built.errors).toContainEqual(
            expect.objectContaining({ reason: 'wiersz-niezgodny-z-metadanymi' })
        );
    });
});
