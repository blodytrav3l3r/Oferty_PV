import prisma from '../../src/prismaClient';
import {
    allocateNextOfferNumber,
    getCurrentOfferNumberYear,
    isSameGeneratedOfferRetry
} from '../../src/services/offers/offerNumbering';

const PREFIX = 't-offer-number-';
const YEAR = 2126;

async function cleanup() {
    await prisma.offers_rel.deleteMany({ where: { id: { startsWith: PREFIX } } });
    await prisma.offers_studnie_rel.deleteMany({ where: { id: { startsWith: PREFIX } } });
}

describe('alokacja numerów ofert po stronie bazy', () => {
    test('stosuje polski rok kalendarzowy przy granicy roku UTC', () => {
        expect(getCurrentOfferNumberYear(new Date('2026-12-31T23:30:00.000Z'))).toBe(2027);
    });

    test('rozpoznaje retry create bez akceptowania zmienionej treści', () => {
        const number = 'OF/000001/ASM/2026';
        const existing = JSON.stringify({ number, clientName: 'Budimex', createdAt: 'a' });
        expect(
            isSameGeneratedOfferRetry(
                existing,
                {
                    number: 'OF/000001/ASM/2026',
                    generateOfferNumber: true,
                    version: 1,
                    pricelistVersionId: 'active-v2',
                    clientName: 'Budimex',
                    updatedAt: 'b'
                },
                number
            )
        ).toBe(true);
        expect(
            isSameGeneratedOfferRetry(
                existing,
                { number: 'OF/000001/ASM/2026', generateOfferNumber: true, clientName: 'Inny' },
                number
            )
        ).toBe(false);
    });

    beforeEach(cleanup);
    afterAll(async () => {
        await cleanup();
        await prisma.$disconnect();
    });

    test('liczy niezależnie per jednostka i resetuje sekwencję w nowym roku', async () => {
        await prisma.offers_rel.createMany({
            data: [
                { id: `${PREFIX}asm-2026-7`, offer_number: 'OF/000007/ASM/2126' },
                { id: `${PREFIX}wl-2026-3`, offer_number: 'OF/000003/WL/2126' },
                { id: `${PREFIX}asm-2025-9`, offer_number: 'OF/000009/ASM/2125' }
            ]
        });

        const nextAsm = await prisma.$transaction((tx) =>
            allocateNextOfferNumber(tx, 'rury', 'ASM_KLUCZBORK', YEAR)
        );
        const nextWl = await prisma.$transaction((tx) =>
            allocateNextOfferNumber(tx, 'rury', 'WL_WLOCLAWEK', YEAR)
        );
        const nextYear = await prisma.$transaction((tx) =>
            allocateNextOfferNumber(tx, 'rury', 'ASM_KLUCZBORK', YEAR + 1)
        );

        expect(nextAsm).toBe('OF/000008/ASM/2126');
        expect(nextWl).toBe('OF/000004/WL/2126');
        expect(nextYear).toBe('OF/000001/ASM/2127');
    });

    test('serializuje równoległe przydziały tej samej jednostki i roku', async () => {
        const allocateAndSave = (id: string) =>
            prisma.$transaction(async (tx) => {
                const number = await allocateNextOfferNumber(tx, 'studnie', 'WL_WLOCLAWEK', YEAR);
                await tx.offers_studnie_rel.create({
                    data: { id: `${PREFIX}${id}`, offer_number: number }
                });
                return number;
            });

        const allocated = await Promise.all([
            allocateAndSave('parallel-a'),
            allocateAndSave('parallel-b')
        ]);

        expect(allocated.sort()).toEqual(['OS/000001/WL/2126', 'OS/000002/WL/2126']);
    });
});
