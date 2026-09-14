import request from 'supertest';
import express from 'express';
import {
    canWriteDoc,
    assertWriteAccess,
    resolveWriteUserId,
    resolveAssignUserId
} from '../src/utils/ownership';
import ruryCrud from '../src/routes/offers/ruryCrud';
import prisma from '../src/prismaClient';

// Auth jako user-B (zwykły user, bez podwładnych).
jest.mock('../src/middleware/auth', () => ({
    requireAuth: (req: any, _res: any, next: any) => {
        if (!req.user) {
            req.user = { id: 'user-B', role: 'user', subUsers: [] };
        }
        next();
    }
}));

jest.mock('../src/db', () => ({
    logAudit: jest.fn()
}));

jest.mock('../src/utils/logger', () => ({
    logger: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn()
    }
}));

jest.mock('../src/prismaClient', () => ({
    __esModule: true,
    default: {
        offers_rel: {
            findMany: jest.fn(),
            findUnique: jest.fn(),
            updateMany: jest.fn()
        },
        offer_items_rel: {
            findMany: jest.fn(),
            deleteMany: jest.fn(),
            createMany: jest.fn()
        },
        $transaction: jest.fn(),
        $queryRaw: jest.fn().mockResolvedValue([]),
        $queryRawUnsafe: jest.fn().mockResolvedValue([]),
        $executeRaw: jest.fn(),
        $executeRawUnsafe: jest.fn().mockResolvedValue(1)
    },
    Prisma: {}
}));

const userB = { id: 'user-B', role: 'user', subUsers: [] } as any;
const pro = { id: 'pro-1', role: 'pro', subUsers: ['user-A'] } as any;
const admin = { id: 'admin-1', role: 'admin', subUsers: [] } as any;

describe('P0.1 macierz uprawnień zapisu (unit)', () => {
    it('canWriteDoc: owner tak, obcy nie, null legacy nie, admin tak', () => {
        expect(canWriteDoc(userB, 'user-B')).toBe(true);
        expect(canWriteDoc(userB, 'user-A')).toBe(false);
        expect(canWriteDoc(userB, null)).toBe(false);
        expect(canWriteDoc(undefined, 'user-B')).toBe(false);
        expect(canWriteDoc(admin, 'user-A')).toBe(true);
        expect(canWriteDoc(pro, 'user-A')).toBe(true);
        expect(canWriteDoc(pro, 'user-B')).toBe(false);
    });

    it('assertWriteAccess jest aliasem canWriteDoc', () => {
        expect(assertWriteAccess(userB, 'user-B')).toBe(true);
        expect(assertWriteAccess(userB, 'user-A')).toBe(false);
    });

    it('resolveWriteUserId: create tylko self/sub/admin', () => {
        expect(resolveWriteUserId(userB, undefined)).toEqual({
            allowed: true,
            effectiveUserId: 'user-B'
        });
        expect(resolveWriteUserId(userB, 'user-A').allowed).toBe(false);
        expect(resolveWriteUserId(pro, 'user-A')).toEqual({
            allowed: true,
            effectiveUserId: 'user-A'
        });
        expect(resolveWriteUserId(pro, 'user-B').allowed).toBe(false);
        expect(resolveWriteUserId(admin, 'user-A')).toEqual({
            allowed: true,
            effectiveUserId: 'user-A'
        });
    });

    it('resolveAssignUserId: edycja cudzego -> denied; assign obcemu -> denied', () => {
        // edycja własnego bez zmiany opiekuna
        expect(resolveAssignUserId(userB, 'user-B', undefined)).toEqual({
            allowed: true,
            effectiveUserId: 'user-B'
        });
        // edycja cudzego
        expect(resolveAssignUserId(userB, 'user-A', undefined).allowed).toBe(false);
        // legitymowana zmiana opiekuna: pro oddaje podwładnemu
        expect(resolveAssignUserId(pro, 'pro-1', 'user-A')).toEqual({
            allowed: true,
            effectiveUserId: 'user-A'
        });
        // user-B nie podrzuci dokumentu obcemu user-C
        expect(resolveAssignUserId(userB, 'user-B', 'user-C').allowed).toBe(false);
        // admin może wszystko
        expect(resolveAssignUserId(admin, 'user-A', 'user-B')).toEqual({
            allowed: true,
            effectiveUserId: 'user-B'
        });
    });
});

describe('P0.1 PUT /api/offers/rury (route)', () => {
    let app: express.Application;

    beforeAll(() => {
        app = express();
        app.use(express.json());
        app.use('/api/offers/rury', ruryCrud);
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('403 przy próbie nadpisania cudzej oferty (user-B vs user-A)', async () => {
        (prisma.offers_rel.findMany as jest.Mock).mockResolvedValue([
            { id: 'doc-1', userId: 'user-A', version: 1 }
        ]);
        const res = await request(app)
            .put('/api/offers/rury')
            .send({ data: [{ id: 'doc-1', transportCost: 0, items: [] }] });
        expect(res.statusCode).toBe(403);
        expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('403 przy próbie przejęcia cudzej oferty przez userId w body', async () => {
        (prisma.offers_rel.findMany as jest.Mock).mockResolvedValue([
            { id: 'doc-1', userId: 'user-A', version: 1 }
        ]);
        const res = await request(app)
            .put('/api/offers/rury')
            .send({ data: [{ id: 'doc-1', userId: 'user-B', transportCost: 0, items: [] }] });
        expect(res.statusCode).toBe(403);
        expect(prisma.$transaction).not.toHaveBeenCalled();
    });
});
