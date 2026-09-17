/**
 * Rury PDF/DOCX: wiersz "Transport bez rozładunku" tylko przy osobnej pozycji.
 * Przy cenie wliczonej koszt dzielony wagowo na pozycje (lustro frontendu),
 * RAZEM bez zmian. Fallback (brak wagi) pokazuje wiersz, żeby koszt nie zniknął.
 */
import { buildRurySectionHTML } from '../src/services/pdf/ruryHtml';
import type { RuryOfferData } from '../src/services/pdf/types';
import {
    distributeRuryTransportCost,
    isRuryTransportSeparateFlag,
    resolveRuryTransportTotal
} from '../src/services/ruryTransport';
import { buildItemsTable, resolveRuryTransport } from '../src/services/docx/rury/tables';

function ruryItem(over: Record<string, unknown> = {}) {
    return {
        productId: 'RTB-0-03-25-K00',
        name: 'Rura betonowa DN300',
        category: 'Rury Betonowe',
        unitPrice: 100,
        quantity: 2,
        discount: 0,
        lengthM: 2500,
        weight: 500,
        ...over
    };
}

function ruryData(over: Partial<RuryOfferData> = {}): RuryOfferData {
    return {
        offerNumber: 'OR/1',
        clientName: 'Klient',
        clientNip: '',
        clientAddress: '',
        clientPhone: '',
        investName: '',
        investAddress: '',
        investContractor: '',
        items: [ruryItem(), ruryItem({ productId: 'RTB-0-04-25-K00', weight: 1000 })],
        transportSeparate: false,
        transportMode: 'full',
        transportKm: 100,
        transportRate: 10,
        transportCount: 1,
        transportCostPerTrip: 1000,
        transportCost: 1000,
        createdAt: new Date().toISOString(),
        validityDays: 30,
        notes: '',
        ...over
    };
}

/** Głębokie szukanie tekstu w obiektach docx (z ochroną przed cyklami). */
function deepContainsText(root: unknown, text: string): boolean {
    const seen = new Set<object>();
    const stack: unknown[] = [root];
    while (stack.length > 0) {
        const cur = stack.pop();
        if (typeof cur === 'string') {
            if (cur.includes(text)) return true;
        } else if (cur && typeof cur === 'object') {
            if (seen.has(cur)) continue;
            seen.add(cur);
            if (Array.isArray(cur)) {
                stack.push(...cur);
            } else {
                stack.push(...Object.values(cur));
            }
        }
    }
    return false;
}

describe('ruryTransport helper', () => {
    it('flaga osobnej pozycji: true/1/"1", reszta falsy', () => {
        expect(isRuryTransportSeparateFlag(true)).toBe(true);
        expect(isRuryTransportSeparateFlag(1)).toBe(true);
        expect(isRuryTransportSeparateFlag('1')).toBe(true);
        expect(isRuryTransportSeparateFlag(false)).toBe(false);
        expect(isRuryTransportSeparateFlag(0)).toBe(false);
        expect(isRuryTransportSeparateFlag(undefined)).toBe(false);
        expect(isRuryTransportSeparateFlag('0')).toBe(false);
    });

    it('dzieli proporcjonalnie do wagi, suma udziałów = total', () => {
        const items = [ruryItem(), ruryItem({ weight: 1000 })];
        const shares = distributeRuryTransportCost(items, 1000);
        // wagi całkowite: 500*2=1000 i 1000*2=2000 → 1/3 i 2/3
        expect(shares[0]).toBeCloseTo(333.33, 1);
        expect(shares[1]).toBeCloseTo(666.67, 1);
        expect(shares[0] + shares[1]).toBeCloseTo(1000, 6);
    });

    it('pomija autoAdded, zero wagi → same zera', () => {
        expect(distributeRuryTransportCost([ruryItem({ autoAdded: true })], 1000)).toEqual([0]);
        expect(distributeRuryTransportCost([ruryItem({ weight: 0 })], 1000)).toEqual([0]);
        expect(distributeRuryTransportCost([ruryItem()], 0)).toEqual([0]);
    });

    it('resolveRuryTransportTotal: zapisany koszt, fallback wagowy', () => {
        const items = [ruryItem()];
        expect(
            resolveRuryTransportTotal({ transportCost: 1000, transportCostPerTrip: 1000 }, items)
        ).toBe(1000);
        // brak zapisanego: 1000 kg → ceil(1000/24000)=1 kurs × 100 = 100
        expect(
            resolveRuryTransportTotal({ transportCostPerTrip: 100, transportMode: 'full' }, items)
        ).toBe(100);
        expect(resolveRuryTransportTotal({}, items)).toBe(0);
    });
});

describe('rury PDF: wiersz transportu', () => {
    const baseNetto = 100 * 2 + 100 * 2; // 400

    it('cena wliczona: brak wiersza, RAZEM zawiera transport', () => {
        const section = buildRurySectionHTML(ruryData({ transportSeparate: false }));
        expect(section.tables + section.summary).not.toContain('Transport bez rozładunku');
        expect(section.grandTotal).toBeCloseTo(baseNetto + 1000, 2);
    });

    it('osobna pozycja: wiersz widoczny, RAZEM to samo', () => {
        const section = buildRurySectionHTML(ruryData({ transportSeparate: true }));
        expect(section.tables + section.summary).toContain('Transport bez rozładunku');
        expect(section.grandTotal).toBeCloseTo(baseNetto + 1000, 2);
    });

    it('cena wliczona bez wagi: fallback pokazuje wiersz (koszt nie znika)', () => {
        const data = ruryData({ transportSeparate: false });
        data.items = [ruryItem({ weight: 0 }), ruryItem({ weight: 0 })];
        const section = buildRurySectionHTML(data);
        expect(section.tables + section.summary).toContain('Transport bez rozładunku');
        expect(section.grandTotal).toBeCloseTo(baseNetto + 1000, 2);
    });
});

describe('rury DOCX: wiersz transportu', () => {
    const items = () => [ruryItem(), ruryItem({ productId: 'RTB-0-04-25-K00', weight: 1000 })];
    const baseNetto = 400;
    const offerData = () => ({
        transportSeparate: false as unknown,
        transportCost: 1000,
        transportCount: 1,
        transportCostPerTrip: 1000,
        transportMode: 'full'
    });

    it('resolveRuryTransport: zero przy cenie wliczonej', () => {
        expect(resolveRuryTransport(offerData(), items())).toEqual({ total: 0, trips: 0 });
        expect(resolveRuryTransport({ ...offerData(), transportSeparate: true }, items())).toEqual({
            total: 1000,
            trips: 1
        });
    });

    it('cena wliczona: brak wiersza, grandTotal zawiera transport', () => {
        const od = offerData();
        const { paragraphs, grandTotal } = buildItemsTable(
            items(),
            resolveRuryTransport(od, items()),
            {
                separate: false,
                distributeTotal: resolveRuryTransportTotal(od, items())
            }
        );
        expect(deepContainsText(paragraphs, 'Transport bez rozładunku')).toBe(false);
        expect(grandTotal).toBeCloseTo(baseNetto + 1000, 2);
    });

    it('osobna pozycja: wiersz widoczny, grandTotal to samo', () => {
        const od = { ...offerData(), transportSeparate: true as unknown };
        const { paragraphs, grandTotal } = buildItemsTable(
            items(),
            resolveRuryTransport(od, items()),
            {
                separate: true,
                distributeTotal: resolveRuryTransportTotal(od, items())
            }
        );
        expect(deepContainsText(paragraphs, 'Transport bez rozładunku')).toBe(true);
        expect(grandTotal).toBeCloseTo(baseNetto + 1000, 2);
    });
});
