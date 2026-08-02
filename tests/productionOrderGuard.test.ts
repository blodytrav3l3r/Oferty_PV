import {
    countProductionOrdersForOrder,
    hasProductionOrdersForOffer
} from '../src/utils/productionOrderGuard';
import prisma from '../src/prismaClient';

jest.mock('../src/prismaClient', () => ({
    __esModule: true,
    default: {
        $queryRaw: jest.fn()
    }
}));

describe('productionOrderGuard', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('countProductionOrdersForOrder', () => {
        it('zwraca liczbę PZ gdy $queryRaw zwraca wiersz z cnt > 0', async () => {
            (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ cnt: 2 }]);
            await expect(countProductionOrdersForOrder('order-1', 'offer-1')).resolves.toBe(2);
        });

        it('zwraca 0 gdy $queryRaw zwraca cnt = 0', async () => {
            (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ cnt: 0 }]);
            await expect(countProductionOrdersForOrder('order-1', 'offer-1')).resolves.toBe(0);
        });

        it('zwraca 0 gdy $queryRaw zwraca pustą tablicę', async () => {
            (prisma.$queryRaw as jest.Mock).mockResolvedValue([]);
            await expect(countProductionOrdersForOrder('order-1')).resolves.toBe(0);
        });

        it('jest odporne na undefined zwracane przez $queryRaw', async () => {
            (prisma.$queryRaw as jest.Mock).mockResolvedValue(undefined);
            await expect(countProductionOrdersForOrder('order-1')).resolves.toBe(0);
        });

        it('obsługuje cnt jako bigint', async () => {
            (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ cnt: BigInt(3) }]);
            await expect(countProductionOrdersForOrder('order-1')).resolves.toBe(3);
        });
    });

    describe('hasProductionOrdersForOffer', () => {
        it('zwraca true gdy istnieje PZ dla oferty', async () => {
            (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ cnt: 1 }]);
            await expect(hasProductionOrdersForOffer('offer-1')).resolves.toBe(true);
        });

        it('zwraca false gdy brak PZ dla oferty', async () => {
            (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ cnt: 0 }]);
            await expect(hasProductionOrdersForOffer('offer-1')).resolves.toBe(false);
        });

        it('jest odporne na undefined zwracane przez $queryRaw', async () => {
            (prisma.$queryRaw as jest.Mock).mockResolvedValue(undefined);
            await expect(hasProductionOrdersForOffer('offer-1')).resolves.toBe(false);
        });
    });
});
