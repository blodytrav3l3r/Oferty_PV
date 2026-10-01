/**
 * P2 — historia transferów w warstwie service (mock prisma, bez DB).
 * Route'y tylko delegują; kontrakt: limit 100 malejąco, detail/null.
 */
import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import {
    listTransferHistory,
    getTransferDetail
} from '../../src/services/ml/transfer/transferHistory';

const mockFindMany = jest.fn<any>();
const mockFindUnique = jest.fn<any>();
jest.mock('../../src/prismaClient', () => ({
    __esModule: true,
    default: {
        aiTransfer: {
            findMany: (...args: unknown[]) => (mockFindMany as any)(...args),
            findUnique: (...args: unknown[]) => (mockFindUnique as any)(...args)
        }
    }
}));

describe('P2 transferHistory service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('lista: orderBy createdAt desc, take 100', async () => {
        (mockFindMany as any).mockResolvedValue([{ transferId: 'trf_1' }]);
        const rows = await listTransferHistory();
        expect(mockFindMany).toHaveBeenCalledWith({
            orderBy: { createdAt: 'desc' },
            take: 100
        });
        expect(rows).toEqual([{ transferId: 'trf_1' }]);
    });

    it('detal: findUnique po transferId, null gdy brak', async () => {
        (mockFindUnique as any).mockResolvedValue(null);
        await expect(getTransferDetail('trf_x')).resolves.toBeNull();
        expect(mockFindUnique).toHaveBeenCalledWith({ where: { transferId: 'trf_x' } });
    });
});
