import { mapWellsToItems } from '../src/services/pdf/helpers';
import { buildStudnieSectionHTML } from '../src/services/pdf/studnieHtml';
import { buildWellTables, groupWellsByDn } from '../src/services/docx/studnie/tables';
import type { StudnieOfferData } from '../src/services/pdf/types';

jest.mock('../src/prismaClient', () => ({ prisma: {} }));

describe('rozliczenie groszy w eksporcie studni', () => {
    it.each([false, true])(
        'zachowuje kwotę oferty w PDF i DOCX, transport osobno: %s',
        (separate) => {
            const wells = Array.from({ length: 3 }, (_, index) => ({
                name: `S${index + 1}`,
                dn: '1000',
                price: 1,
                transportCost: 0.01 / 3,
                totalPrice: 1 + 0.01 / 3
            }));
            const snapshot = structuredClone(wells);
            const pdf = mapWellsToItems(wells, separate);
            const section = buildStudnieSectionHTML({
                items: pdf.items,
                transportSeparate: separate
            } as StudnieOfferData);
            const docx = buildWellTables(wells, separate);

            expect(section.grandTotal).toBe(3.01);
            expect(docx.grandTotal + docx.transportTotal).toBeCloseTo(3.01, 8);
            const docxPrices = groupWellsByDn(wells, separate)['1000'].map((item) =>
                Number(item.price)
            );
            expect(docxPrices.every((price) => Number(price.toFixed(2)) === price)).toBe(true);
            expect(
                docxPrices.reduce((sum, price) => sum + price, 0) + docx.transportTotal
            ).toBeCloseTo(3.01, 8);
            expect(
                docx.summaries.reduce((sum, row) => sum + row.totalPrice, 0) + docx.transportTotal
            ).toBeCloseTo(3.01, 8);
            expect(wells).toEqual(snapshot);
        }
    );

    it.each([false, true])(
        'uzgadnia kwoty z ułamkowymi cenami studni, transport osobno: %s',
        (separate) => {
            const wells = Array.from({ length: 3 }, () => ({
                dn: '1000',
                price: 1.004,
                transportCost: 0.01 / 3,
                totalPrice: 1.004 + 0.01 / 3
            }));
            const pdf = mapWellsToItems(wells, separate);
            const section = buildStudnieSectionHTML({
                items: pdf.items,
                transportSeparate: separate
            } as StudnieOfferData);
            const docx = buildWellTables(wells, separate);
            expect(section.grandTotal).toBe(3.01);
            expect(docx.grandTotal + docx.transportTotal).toBeCloseTo(3.01, 8);
            expect(
                docx.summaries.reduce((sum, row) => sum + row.totalPrice, 0) + docx.transportTotal
            ).toBeCloseTo(3.01, 8);
        }
    );

    it('zaokrągla każdą historyczną cenę niezależnie, gdy brak transportu', () => {
        const wells = Array.from({ length: 3 }, () => ({
            dn: '1000',
            price: 1.004,
            totalPrice: 1.004,
            transportCost: 0
        }));

        expect(mapWellsToItems(wells).items.map((item) => item.price)).toEqual([1, 1, 1]);
        expect(groupWellsByDn(wells)['1000'].map((item) => item.price)).toEqual([1, 1, 1]);
    });

    it.each([false, true])('nie zmienia zamrożonego udziału, transport osobno: %s', (separate) => {
        const wells = [
            { dn: '1000', price: 1, totalPrice: 1.02, transportCost: 0.02, transportFrozen: true },
            { dn: '1000', price: 1, totalPrice: 1.0025, transportCost: 0.0025 },
            { dn: '1000', price: 1, totalPrice: 1.0025, transportCost: 0.0025 }
        ];
        const pdf = mapWellsToItems(wells, separate, 3.03);
        const docx = groupWellsByDn(wells, separate, 3.03)['1000'];
        expect(separate ? pdf.items[0].transportCost : pdf.items[0].price).toBe(
            separate ? 0.02 : 1.02
        );
        expect(docx[0].price).toBe(separate ? 1 : 1.02);
        const section = buildStudnieSectionHTML({
            items: pdf.items,
            transportSeparate: separate
        } as StudnieOfferData);
        expect(section.grandTotal).toBe(3.03);
    });

    it.each([false, true])(
        'wykorzystuje zapisaną kwotę przy ułamkowym koszcie transportu: %s',
        (separate) => {
            const wells = Array.from({ length: 3 }, () => ({
                dn: '1000',
                price: 1,
                transportCost: 0.105 / 3,
                totalPrice: 1 + 0.105 / 3
            }));
            const pdf = mapWellsToItems(wells, separate, 3.11);
            const section = buildStudnieSectionHTML({
                items: pdf.items,
                transportSeparate: separate
            } as StudnieOfferData);
            const docx = buildWellTables(wells, separate, 3.11);
            expect(section.grandTotal).toBe(3.11);
            expect(docx.grandTotal + docx.transportTotal).toBeCloseTo(3.11, 8);
        }
    );
});
