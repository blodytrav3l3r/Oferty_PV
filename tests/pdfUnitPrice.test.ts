import { computeUnitPriceNetto } from '../src/services/pdf/helpers';

// SSoT ceny jednostkowej netto na wydruku (ruryHtml.ts). Kontrakt:
// unitPrice * (1 - discount/100) + pehd + surcharge + transport/jedn.
describe('computeUnitPriceNetto (SSoT ceny PDF)', () => {
    it('bez rabatu i dopłat zwraca cenę bazową', () => {
        expect(computeUnitPriceNetto({ unitPrice: 100 })).toBe(100);
    });

    it('nalicza rabat procentowy', () => {
        expect(computeUnitPriceNetto({ unitPrice: 200, discountPct: 25 })).toBe(150);
    });

    it('dodaje PEHD, dopłatę i transport jednostkowy PO rabacie', () => {
        expect(
            computeUnitPriceNetto({
                unitPrice: 200,
                discountPct: 10,
                pehdCostPerUnit: 15,
                surcharge: 5,
                transportPerUnit: 2.5
            })
        ).toBeCloseTo(202.5, 10);
    });

    it('rabat 100% zeruje tylko cenę bazową (dopłaty zostają)', () => {
        expect(
            computeUnitPriceNetto({ unitPrice: 500, discountPct: 100, pehdCostPerUnit: 12 })
        ).toBe(12);
    });

    it('braki/NaN traktuje jak 0 (odporne na dziurawe dane)', () => {
        expect(computeUnitPriceNetto({ unitPrice: Number.NaN, discountPct: Number.NaN })).toBe(0);
        expect(computeUnitPriceNetto({ unitPrice: 50, discountPct: undefined })).toBe(50);
    });
});
