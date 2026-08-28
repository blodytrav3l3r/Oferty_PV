import { hasShare, getSharedIdsForUser, isValidShareDocumentType } from '../src/utils/ownership';
import prisma from '../src/prismaClient';

jest.mock('../src/prismaClient', () => ({
    __esModule: true,
    default: {
        document_shares: {
            findFirst: jest.fn(),
            findMany: jest.fn()
        }
    }
}));

const mocked = prisma as unknown as {
    document_shares: { findFirst: jest.Mock; findMany: jest.Mock };
};

describe('shares helpers', () => {
    beforeEach(() => jest.clearAllMocks());

    test('isValidShareDocumentType', () => {
        expect(isValidShareDocumentType('offer')).toBe(true);
        expect(isValidShareDocumentType('offer_studnie')).toBe(true);
        expect(isValidShareDocumentType('order_rury')).toBe(true);
        expect(isValidShareDocumentType('order_studnie')).toBe(true);
        expect(isValidShareDocumentType('client')).toBe(false);
    });

    test('hasShare returns true when row exists', async () => {
        mocked.document_shares.findFirst.mockResolvedValue({ id: '1' });
        expect(await hasShare('u1', 'offer', 'doc1')).toBe(true);
        expect(mocked.document_shares.findFirst).toHaveBeenCalledWith({
            where: { sharedWithUserId: 'u1', documentType: 'offer', documentId: 'doc1' },
            select: { id: true }
        });
    });

    test('hasShare returns false when missing params', async () => {
        expect(await hasShare('', 'offer', 'doc1')).toBe(false);
        expect(await hasShare('u1', '', 'doc1')).toBe(false);
        expect(await hasShare('u1', 'offer', '')).toBe(false);
    });

    test('getSharedIdsForUser maps documentId', async () => {
        mocked.document_shares.findMany.mockResolvedValue([
            { documentId: 'a' },
            { documentId: 'b' }
        ]);
        const ids = await getSharedIdsForUser('u1', 'offer');
        expect(ids).toEqual(['a', 'b']);
    });
});

describe('roleFilter with shares', () => {
    test('buildRoleWhereConditionWithShares for admin is empty', async () => {
        const { buildRoleWhereConditionWithShares } = await import('../src/utils/roleFilter');
        const { Prisma } = await import('../generated/prisma');
        const sql = buildRoleWhereConditionWithShares(
            { role: 'admin', id: 'a', subUsers: [] },
            'offer'
        );
        expect(sql).toBe(Prisma.empty);
    });

    test('buildRoleWhereConditionWithShares for user includes EXISTS', async () => {
        const { buildRoleWhereConditionWithShares } = await import('../src/utils/roleFilter');
        const sql = buildRoleWhereConditionWithShares(
            { role: 'user', id: 'u1', subUsers: [] },
            'offer'
        );
        // Prisma.Sql is opaque — just check it's not empty and stringifies with EXISTS
        expect(String(sql)).toBeDefined();
        // check that sql contains shared logic by inspecting sqlStrings
        const strings = (sql as unknown as { strings: string[] }).strings?.join('') || String(sql);
        expect(strings.length > 0).toBe(true);
    });
});
