import request from 'supertest';
import express from 'express';
import router from '../src/routes/orders/studnieOrders.crud';
import prisma from '../src/prismaClient';

const mockUser: any = { id: 'u1', role: 'user', subUsers: [] };

jest.mock('../src/middleware/auth', () => ({
    requireAuth: (req: any, _res: any, next: any) => {
        req.user = { ...mockUser };
        next();
    }
}));

jest.mock('../src/middleware/rateLimiters', () => ({
    WRITE_LIMITER: (_req: any, _res: any, next: any) => next()
}));

jest.mock('../src/utils/logger', () => ({
    logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() }
}));

jest.mock('../src/services/auditService', () => ({
    logAudit: jest.fn().mockResolvedValue(undefined)
}));

jest.mock('../src/utils/docLocks', () => ({
    assertDocLockForWrite: jest.fn().mockResolvedValue(undefined),
    mapDocLockConflict: jest.fn().mockReturnValue(false)
}));

jest.mock('../src/utils/searchCache', () => ({
    searchCache: { invalidateAll: jest.fn() }
}));

const updateMock = jest.fn();
const updateManyMock = jest.fn();

jest.mock('../src/prismaClient', () => ({
    __esModule: true,
    default: {
        orders_studnie_rel: {
            findUnique: jest.fn(),
            update: (...args: unknown[]) => updateMock(...args),
            updateMany: (...args: unknown[]) => updateManyMock(...args)
        }
    }
}));

function createApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/orders-studnie', router);
    return app;
}

const OWNED = {
    id: 'ord-1',
    userId: 'u1',
    offerStudnieId: 'off-1',
    status: 'new',
    data: JSON.stringify({ wells: [] }),
    version: 1
};

beforeEach(() => {
    jest.clearAllMocks();
    mockUser.id = 'u1';
    mockUser.role = 'user';
    mockUser.subUsers = [];
    (prisma.orders_studnie_rel.findUnique as jest.Mock).mockResolvedValue({ ...OWNED });
    updateMock.mockResolvedValue({ ...OWNED });
    updateManyMock.mockResolvedValue({ count: 1 });
});

describe('A3: PATCH zamówienia studni — obce klucze nie trafiają do kolumn', () => {
    it('wrogie klucze (isAdmin/role) nie nadpisują kolumn ani nie wychodzą z bloba', async () => {
        const res = await request(createApp())
            .patch('/api/orders-studnie/ord-1')
            .send({ status: 'accepted', isAdmin: true, role: 'admin', offerStudnieId: 'evil' });
        expect(res.statusCode).toBe(200);
        expect(updateMock).toHaveBeenCalledTimes(1);
        const written = updateMock.mock.calls[0][0].data as Record<string, unknown>;
        // kolumny wyłącznie jawnie mapowane
        expect(Object.keys(written).sort()).toEqual(['data', 'status', 'userId', 'version']);
        expect(written.userId).toBe('u1');
        expect(written.status).toBe('accepted');
        // denylist usunięty z bloba
        const blob = JSON.parse(written.data as string) as Record<string, unknown>;
        for (const k of [
            'id',
            'type',
            'userId',
            'offerStudnieId',
            'status',
            'createdAt',
            'version',
            'baseUpdatedAt'
        ]) {
            expect(blob).not.toHaveProperty(k);
        }
        // obce klucze inertne w blobie (passthrough celowy — forward-compat frontendu)
        expect(blob).toHaveProperty('isAdmin', true);
        expect(blob).toHaveProperty('role', 'admin');
    });

    it('legalne pola forward-compat (_elemId) surviving w blobie (passthrough nie ruszone)', async () => {
        const res = await request(createApp())
            .patch('/api/orders-studnie/ord-1')
            .send({ _elemId: 'e1', customNote: 'x' });
        expect(res.statusCode).toBe(200);
        const written = updateMock.mock.calls[0][0].data as Record<string, unknown>;
        const blob = JSON.parse(written.data as string) as Record<string, unknown>;
        expect(blob).toHaveProperty('_elemId', 'e1');
        expect(blob).toHaveProperty('customNote', 'x');
    });

    it('przejęcie cudzego userId odrzucone 403', async () => {
        const res = await request(createApp())
            .patch('/api/orders-studnie/ord-1')
            .send({ userId: 'victim' });
        expect(res.statusCode).toBe(403);
        expect(updateMock).not.toHaveBeenCalled();
    });
});
