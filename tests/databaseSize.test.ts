import prisma from '../src/prismaClient';
import { getDatabaseSize } from '../src/services/databaseSize';

jest.mock('../src/prismaClient', () => ({
    __esModule: true,
    default: { $transaction: jest.fn() }
}));

test('ponawia niedostępny pomiar dopiero po wygaśnięciu próbki i współdzieli zapytanie', async () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(100_000);
    const transaction = jest.mocked(prisma.$transaction);
    transaction.mockRejectedValueOnce(new Error('pomiar niedostępny'));
    transaction.mockResolvedValueOnce([{ bytes: 1048576n }]);
    try {
        const unavailable = { dbBytes: null, dbSizeStatus: 'unavailable' };
        expect(await Promise.all([getDatabaseSize(), getDatabaseSize()])).toEqual([
            unavailable,
            unavailable
        ]);
        expect(await getDatabaseSize()).toEqual(unavailable);
        expect(transaction).toHaveBeenCalledTimes(1);

        now.mockReturnValue(160_001);
        expect(await getDatabaseSize()).toEqual({ dbBytes: 1048576, dbSizeStatus: 'ok' });
        expect(transaction).toHaveBeenCalledTimes(2);
    } finally {
        now.mockRestore();
    }
});
