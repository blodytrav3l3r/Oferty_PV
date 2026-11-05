import prisma from '../../src/prismaClient';
import { getDraft } from '../../src/services/drafts/draftService';

jest.mock('../../src/prismaClient', () => ({
    __esModule: true,
    default: { drafts: { findUnique: jest.fn(), deleteMany: jest.fn() } }
}));

test('rereads an expired draft when a concurrent save wins the conditional delete', async () => {
    const old = {
        kind: 'offer_studnie',
        docId: 'doc-1',
        baseVersion: 1,
        version: 2,
        bytes: 2,
        payload: '{}',
        updatedAt: '2026-01-01T00:00:00.000Z',
        expiresAt: '2026-01-02T00:00:00.000Z'
    };
    const fresh = {
        ...old,
        version: 3,
        payload: '{"saved":true}',
        updatedAt: '2026-01-03T00:00:00.000Z',
        expiresAt: '2026-01-04T00:00:00.000Z'
    };
    (prisma.drafts.findUnique as jest.Mock).mockResolvedValueOnce(old).mockResolvedValueOnce(fresh);
    (prisma.drafts.deleteMany as jest.Mock).mockResolvedValueOnce({ count: 0 });

    const result = await getDraft('owner', 'offer_studnie', 'doc-1', Date.parse(fresh.updatedAt));

    expect(result).toMatchObject({ version: 3, payload: { saved: true } });
    expect(prisma.drafts.deleteMany).toHaveBeenCalledWith({
        where: {
            userId: 'owner',
            kind: 'offer_studnie',
            docId: 'doc-1',
            version: old.version,
            payload: old.payload,
            updatedAt: old.updatedAt,
            expiresAt: old.expiresAt
        }
    });
});
