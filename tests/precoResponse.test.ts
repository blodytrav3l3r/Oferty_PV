/**
 * formatPrecoResponse — unit kształtu nested preco (pokrycie ogona precoPricingV2).
 * Tabele jako mocki; bez DB i HTTP.
 */
import { formatPrecoResponse } from '../src/routes/precoPricingV2';

function tables(konfig: any[] = [], kinety: any[] = [], zakresy: any[] = []) {
    return {
        konfigTable: { findMany: jest.fn(async () => konfig) },
        kinetyTable: { findMany: jest.fn(async () => kinety) },
        zakresyTable: { findMany: jest.fn(async () => zakresy) }
    };
}

describe('formatPrecoResponse', () => {
    it('puste tabele → { data: [{}] }', async () => {
        const t = tables();
        const r = await formatPrecoResponse(t.konfigTable, t.kinetyTable, t.zakresyTable);
        expect(r).toEqual({ data: [{}] });
    });

    it('konfig + kinety + zakresy → wpis per DN z kinety i labelami', async () => {
        const t = tables(
            [{ key: '1000', value: JSON.stringify({ skrzynkaWlazowa: 5 }) }],
            [{ wellDn: 1000, dn: 110, height: 1, cena: 7, order: 0 }],
            [
                {
                    label: 'spadekKineta',
                    wellDn: 1000,
                    order: 0,
                    min: 0,
                    max: 1,
                    grupy: '[{"a":1}]'
                }
            ]
        );
        const r = await formatPrecoResponse(t.konfigTable, t.kinetyTable, t.zakresyTable);
        const entry = (r.data[0] as Record<string, any>)['1000'];
        expect(entry.skrzynkaWlazowa).toBe(5);
        expect(entry.kinety).toEqual([{ dn: 110, prosta: 1, dodWlot: 7, order: 0 }]);
        expect(entry.spadekKineta).toEqual([{ order: 0, min: 0, max: 1, grupy: [{ a: 1 }] }]);
        expect(entry.spadekMufa).toEqual([]);
    });

    it('kinety obcego DN nie mieszają się do wpisu', async () => {
        const t = tables(
            [{ key: '1000', value: JSON.stringify({}) }],
            [{ wellDn: 2000, dn: 160, height: 2, cena: 9, order: 0 }]
        );
        const r = await formatPrecoResponse(t.konfigTable, t.kinetyTable, t.zakresyTable);
        expect((r.data[0] as Record<string, any>)['1000'].kinety).toEqual([]);
    });
});
