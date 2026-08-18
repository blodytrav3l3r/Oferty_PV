/**
 * Testy jednostkowe seedExporter (budowanie JSON seed + zapis plików).
 *
 * Weryfikują zgodność formatu z scripts/export-settings-to-seed.mjs:
 * - pricelist: JSON.stringify(..., null, 4) + końcowy newline,
 * - preco: [byDn], kinety spłaszczone (prosta=height, dodWlot=cena, order),
 *   kolejność kluczy config -> kinety -> tablice zakresów.
 */

import fs from 'fs';
import { buildPricelistJson, buildPrecoJson, writeSeedFiles } from '../src/services/seedExporter';

describe('seedExporter.buildPricelistJson', () => {
    it('formatuje 4 spacjami (tabWidth jak .prettierrc)', () => {
        const json = buildPricelistJson([{ id: 'r1', price: 100 }]);
        expect(json).toBe('[\n    {\n        "id": "r1",\n        "price": 100\n    }\n]');
    });
});

describe('seedExporter.buildPrecoJson', () => {
    it('spłaszcza kinety (prosta=height, dodWlot=cena) i bierze zakresy z tabeli', () => {
        const konfig = [
            {
                id: 'preco_konfig_1000',
                key: '1000',
                value: JSON.stringify({
                    skrzynkaWlazowa: 400,
                    // zakresy w value są ignorowane — źródłem prawdy jest tabela
                    spadekKineta: [{ min: 999, max: 999, grupy: {} }]
                })
            }
        ];
        const kinety = [{ id: 'k1', order: 1, dn: 150, wellDn: 1000, height: 920, cena: 300 }];
        const zakresy = [
            {
                id: 'z1',
                order: 1,
                label: 'spadekKineta',
                min: 2,
                max: 5,
                grupy: JSON.stringify({ '150-300': 250 }),
                wellDn: 1000
            }
        ];
        const json = buildPrecoJson(konfig, kinety, zakresy);
        const parsed = JSON.parse(json);
        expect(Array.isArray(parsed)).toBe(true);
        expect(parsed).toHaveLength(1);
        const byDn = parsed[0];
        expect(byDn['1000'].skrzynkaWlazowa).toBe(400);
        expect(byDn['1000'].kinety).toEqual([{ dn: 150, prosta: 920, dodWlot: 300, order: 1 }]);
        expect(byDn['1000'].spadekKineta).toEqual([
            { order: 1, min: 2, max: 5, grupy: { '150-300': 250 } }
        ]);
    });

    it('sortuje kinety i zakresy po order', () => {
        const konfig = [{ id: 'c', key: '1000', value: '{}' }];
        const kinety = [
            { id: 'k2', order: 2, dn: 200, wellDn: 1000, height: 990, cena: 300 },
            { id: 'k1', order: 1, dn: 150, wellDn: 1000, height: 920, cena: 300 }
        ];
        const zakresy = [
            {
                id: 'z2',
                order: 2,
                label: 'redukcja',
                min: 10,
                max: 20,
                grupy: '{}',
                wellDn: 1000
            },
            {
                id: 'z1',
                order: 1,
                label: 'redukcja',
                min: 1,
                max: 5,
                grupy: '{}',
                wellDn: 1000
            }
        ];
        const parsed = JSON.parse(buildPrecoJson(konfig, kinety, zakresy));
        expect(parsed[0]['1000'].kinety.map((k: { order: number }) => k.order)).toEqual([1, 2]);
        expect(parsed[0]['1000'].redukcja.map((z: { order: number }) => z.order)).toEqual([1, 2]);
    });
});

describe('seedExporter.writeSeedFiles', () => {
    let writeSpy: jest.SpyInstance;
    let renameSpy: jest.SpyInstance;

    beforeEach(() => {
        writeSpy = jest.spyOn(fs, 'writeFileSync').mockImplementation(() => undefined);
        renameSpy = jest.spyOn(fs, 'renameSync').mockImplementation(() => undefined);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('zapisuje trzy pliki seed z końcowym newline (tmp -> rename)', () => {
        writeSeedFiles({
            rury: [{ id: 'r1', price: 100 }],
            studnie: [{ id: 's1', price: 200 }],
            konfig: [{ id: 'c1', key: '1000', value: '{}' }],
            kinety: [{ id: 'k1', order: 1, dn: 150, wellDn: 1000, height: 920, cena: 300 }]
        });

        expect(writeSpy).toHaveBeenCalledTimes(3);
        expect(renameSpy).toHaveBeenCalledTimes(3);

        const [path1, content1] = writeSpy.mock.calls[0] as [string, string];
        expect(path1).toContain('data');
        expect(path1).toContain('seed_rury.json.tmp');
        expect(content1).toMatch(/\n$/);
        expect(JSON.parse(content1)).toEqual([{ id: 'r1', price: 100 }]);

        const [, content3] = writeSpy.mock.calls[2] as [string, string];
        expect(JSON.parse(content3)[0]['1000'].kinety).toEqual([
            { dn: 150, prosta: 920, dodWlot: 300, order: 1 }
        ]);
    });

    it('rzuca błąd przy braku uprawnień zapisu (propagacja do callera)', () => {
        writeSpy.mockImplementationOnce(() => {
            throw new Error('EACCES');
        });
        expect(() =>
            writeSeedFiles({
                rury: [{ id: 'r1', price: 100 }],
                studnie: [],
                konfig: [],
                kinety: []
            })
        ).toThrow('EACCES');
    });
});
