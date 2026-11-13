/**
 * Rury PDF/DOCX: wiersz "Transport bez rozładunku" tylko przy osobnej pozycji.
 * Przy cenie wliczonej koszt dzielony na pozycje (lustro frontendu),
 * RAZEM bez zmian. Brak wag korzysta z ilości, tak jak DOCX.
 */
import { buildRurySectionHTML } from '../src/services/pdf/ruryHtml';
import type { RuryOfferData } from '../src/services/pdf/types';
import {
    distributeRuryTransportCost,
    getValidRuryTransportAllocationTotalCents,
    isRuryTransportSeparateFlag,
    projectRuryTransportAllocation,
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

    it('pomija autoAdded, a przy braku wag fizycznych alokuje proporcjonalnie do ilości', () => {
        expect(distributeRuryTransportCost([ruryItem({ autoAdded: true })], 1000)).toEqual([0]);
        expect(
            distributeRuryTransportCost(
                [
                    ruryItem({ uid: 'one', weight: 0, quantity: 1 }),
                    ruryItem({ uid: 'two', weight: 0, quantity: 2 })
                ],
                0.03
            )
        ).toEqual([0.01, 0.02]);
        expect(
            distributeRuryTransportCost(
                [
                    ruryItem({ uid: 'zero-weight', weight: 0 }),
                    ruryItem({ uid: 'weighted', weight: 100 })
                ],
                1
            )
        ).toEqual([0, 1]);
        expect(distributeRuryTransportCost([ruryItem()], 0)).toEqual([0]);
    });

    it('alokuje grosze między sztuki i nie gubi reszty', () => {
        const item = ruryItem({ uid: 'tube-a', quantity: 3, weight: 100 });
        const allocation = projectRuryTransportAllocation([item], 1)[0];
        expect(allocation.totalCents).toBe(100);
        expect(allocation.segments).toEqual([
            { quantity: 2, transportCentsPerUnit: 33 },
            { quantity: 1, transportCentsPerUnit: 34 }
        ]);
    });

    it('remisy rozstrzyga stabilnie po UID, a potem zachowuje oryginalny indeks', () => {
        const items = [
            ruryItem({ uid: 'b', quantity: 1, weight: 1 }),
            ruryItem({ uid: 'a', quantity: 1, weight: 1 })
        ];
        const allocation = projectRuryTransportAllocation(items, 0.01);
        expect(allocation).toEqual([
            {
                itemUid: 'a',
                index: 1,
                totalCents: 1,
                segments: [{ quantity: 1, transportCentsPerUnit: 1 }]
            }
        ]);
    });

    it('dla ilości ułamkowej zachowuje dokładną kwotę bez segmentów', () => {
        const allocation = projectRuryTransportAllocation(
            [ruryItem({ uid: 'fractional', quantity: 1.5, weight: 100 })],
            1
        )[0];
        expect(allocation).toEqual({ itemUid: 'fractional', index: 0, totalCents: 100 });
    });

    it('używa poprawnej zapisanej alokacji po UID bez mutowania dokumentu', () => {
        const item = ruryItem({ uid: 'stored', quantity: 3, weight: 100 });
        const allocation = {
            version: 1 as const,
            items: [
                {
                    itemUid: 'stored',
                    totalCents: 100,
                    segments: [
                        { quantity: 2, transportCentsPerUnit: 33 },
                        { quantity: 1, transportCentsPerUnit: 34 }
                    ]
                }
            ]
        };
        const before = JSON.stringify({ item, allocation });
        expect(projectRuryTransportAllocation([item], 1, allocation)[0].totalCents).toBe(100);
        expect(JSON.stringify({ item, allocation })).toBe(before);
    });

    it('odrzuca segmenty uszkodzone i ilości źródłowe niefinitywne bez wyjątku', () => {
        const item = ruryItem({ uid: 'corrupt-segment', quantity: 3, weight: 100 });
        const corruptAllocation = {
            version: 1,
            items: [{ itemUid: 'corrupt-segment', totalCents: 100, segments: [null] }]
        };
        expect(getValidRuryTransportAllocationTotalCents([item], corruptAllocation)).toBeNull();
        expect(projectRuryTransportAllocation([item], 1, corruptAllocation)[0].totalCents).toBe(
            100
        );
        const tooManySegments = {
            version: 1,
            items: [
                {
                    itemUid: 'corrupt-segment',
                    totalCents: 100,
                    segments: [
                        { quantity: 1, transportCentsPerUnit: 32 },
                        { quantity: 1, transportCentsPerUnit: 33 },
                        { quantity: 1, transportCentsPerUnit: 35 }
                    ]
                }
            ]
        };
        expect(getValidRuryTransportAllocationTotalCents([item], tooManySegments)).toBeNull();

        const invalidQuantityItem = ruryItem({
            uid: 'invalid-quantity',
            quantity: Number.NaN,
            weight: 100
        });
        const fractionalAllocation = {
            version: 1,
            items: [{ itemUid: 'invalid-quantity', totalCents: 100 }]
        };
        expect(
            getValidRuryTransportAllocationTotalCents([invalidQuantityItem], fractionalAllocation)
        ).toBeNull();
    });

    it('respektuje koszt alokacji częściowego zamówienia zamiast pełnego kursu', () => {
        const partialItems = [ruryItem({ uid: 'partial', quantity: 1, weight: 500 })];
        const partialOrder = {
            transportCostPerTrip: 1000,
            transportMode: 'full',
            transportAllocation: {
                version: 1 as const,
                items: [
                    {
                        itemUid: 'partial',
                        totalCents: 34,
                        segments: [{ quantity: 1, transportCentsPerUnit: 34 }]
                    }
                ]
            }
        };
        expect(resolveRuryTransportTotal(partialOrder, partialItems)).toBe(0.34);
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

    it('cena wliczona bez wagi: fallback dzieli koszt po ilości', () => {
        const data = ruryData({ transportSeparate: false });
        data.items = [ruryItem({ weight: 0 }), ruryItem({ weight: 0 })];
        const section = buildRurySectionHTML(data);
        expect(section.tables + section.summary).not.toContain('Transport bez rozładunku');
        expect(section.grandTotal).toBeCloseTo(baseNetto + 1000, 2);
    });

    it('cena wliczona bez wagi zachowuje poprawną zapisaną alokację', () => {
        const section = buildRurySectionHTML(
            ruryData({
                items: [ruryItem({ uid: 'saved-allocation', weight: 0 })],
                transportCost: 1,
                transportAllocation: {
                    version: 1,
                    items: [
                        {
                            itemUid: 'saved-allocation',
                            totalCents: 100,
                            segments: [{ quantity: 2, transportCentsPerUnit: 50 }]
                        }
                    ]
                }
            })
        );
        expect(section.tables + section.summary).not.toContain('Transport bez rozładunku');
        expect(section.tables).toContain('0,50');
        expect(section.grandTotal).toBe(201);
    });

    it('cena wliczona: prezentuje podział grosza na segmenty bez straty sumy', () => {
        const section = buildRurySectionHTML(
            ruryData({
                items: [ruryItem({ uid: 'one-product', quantity: 3, weight: 100 })],
                transportCost: 1
            })
        );
        expect(section.grandTotal).toBe(301);
        expect(section.tables).toContain('0,33');
        expect(section.tables).toContain('0,34');
        expect(section.tables).toContain('<td class="text-center">2</td>');
        expect(section.tables).toContain('<td class="text-center">1</td>');
    });

    it('ilość ułamkowa pokazuje przypisany transport jako podwiersz', () => {
        const section = buildRurySectionHTML(
            ruryData({
                items: [ruryItem({ uid: 'fractional', quantity: 1.5, weight: 100 })],
                transportCost: 1
            })
        );
        expect(section.tables).toContain('Transport wliczony: 1,00 PLN');
        expect(section.grandTotal).toBe(151);
    });

    it('PDF zamówienia używa częściowej zapisanej alokacji', () => {
        const section = buildRurySectionHTML(
            ruryData({
                documentType: 'order',
                items: [ruryItem({ uid: 'partial-pdf', quantity: 1, weight: 500 })],
                transportCostPerTrip: 1000,
                transportCost: 0.34,
                transportAllocation: {
                    version: 1,
                    items: [
                        {
                            itemUid: 'partial-pdf',
                            totalCents: 34,
                            segments: [{ quantity: 1, transportCentsPerUnit: 34 }]
                        }
                    ]
                }
            })
        );
        expect(section.grandTotal).toBe(100.34);
        expect(section.tables).toContain('100,34');
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

    it('segmentuje transport co do grosza, zachowując łączną kwotę w tabeli DOCX', () => {
        const items = [ruryItem({ uid: 'docx-segment', quantity: 3, weight: 100 })];
        const result = buildItemsTable(
            items,
            { total: 0, trips: 0 },
            {
                separate: false,
                distributeTotal: 1
            }
        );
        expect(result.grandTotal).toBe(301);
        expect(deepContainsText(result.paragraphs, '0,34')).toBe(true);
    });

    it('ilość ułamkowa pokazuje przypisany transport jako podwiersz DOCX', () => {
        const items = [ruryItem({ uid: 'docx-fractional', quantity: 1.5, weight: 100 })];
        const result = buildItemsTable(
            items,
            { total: 0, trips: 0 },
            {
                separate: false,
                distributeTotal: 1
            }
        );
        expect(result.grandTotal).toBe(151);
        expect(deepContainsText(result.paragraphs, 'Transport wliczony: 1,00 PLN')).toBe(true);
    });

    it('DOCX zamówienia używa częściowej zapisanej alokacji', () => {
        const items = [ruryItem({ uid: 'partial-docx', quantity: 1, weight: 500 })];
        const transportAllocation = {
            version: 1 as const,
            items: [
                {
                    itemUid: 'partial-docx',
                    totalCents: 34,
                    segments: [{ quantity: 1, transportCentsPerUnit: 34 }]
                }
            ]
        };
        const orderData = {
            transportCost: 0.34,
            transportCostPerTrip: 1000,
            transportMode: 'full',
            transportAllocation
        };
        const transportTotal = resolveRuryTransportTotal(orderData, items);
        const result = buildItemsTable(
            items,
            { total: 0, trips: 0 },
            {
                separate: false,
                distributeTotal: transportTotal,
                allocation: transportAllocation
            }
        );
        expect(transportTotal).toBe(0.34);
        expect(result.grandTotal).toBe(100.34);
        expect(deepContainsText(result.paragraphs, '100,34')).toBe(true);
    });

    it('DOCX odrzuca uszkodzoną alokację i używa zapisanego kosztu', () => {
        const items = [ruryItem({ uid: 'bad-allocation-docx', quantity: 1, weight: 500 })];
        const transportTotal = resolveRuryTransportTotal(
            { transportCost: 0.34, transportAllocation: {} },
            items
        );
        const result = buildItemsTable(
            items,
            { total: 0, trips: 0 },
            {
                separate: false,
                distributeTotal: transportTotal,
                allocation: {}
            }
        );
        expect(transportTotal).toBe(0.34);
        expect(result.grandTotal).toBe(100.34);
        expect(deepContainsText(result.paragraphs, '100,34')).toBe(true);
    });
});
