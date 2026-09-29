/**
 * auditAtomicity — audyt biznesowy atomowy z transakcją.
 * 1. logAudit z tx: zapis idzie przez tx → rollback biznesu cofa też audit
 *    (koniec phantom audit). Globalny prisma NIETYkany.
 * 2. Błąd audytu w tx nie rzuca (warn-only): biznes commitje, rośnie metryka.
 * 3. POST /api/shares/revoke: delete + audit + odczyt w jednej tx.
 */
import request from 'supertest';
import express from 'express';

import { logAudit, AuditDb } from '../../src/services/auditService';
import { getMetricsSnapshot, resetMetrics } from '../../src/utils/metrics';

jest.mock('../../src/prismaClient', () => ({
    __esModule: true,
    default: {
        $executeRaw: jest.fn(),
        $queryRaw: jest.fn()
    }
}));

jest.mock('../../src/utils/logger', () => ({
    logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() }
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const prismaMock = require('../../src/prismaClient').default;

/** Fałszywy klient tx: zbiera wpisy, commit = przepisz do committed. */
function makeFakeTx(committed: string[]) {
    const staged: string[] = [];
    const db = {
        $queryRaw: jest.fn(async () => []),
        $executeRaw: jest.fn(async (...args: unknown[]) => {
            staged.push(String(args.find((a) => typeof a === 'string')));
            return 1;
        })
    } as unknown as AuditDb;
    return {
        staged,
        db,
        commit() {
            committed.push(...staged);
        }
        // rollback = brak commit() → staged przepada
    };
}

beforeEach(() => {
    jest.clearAllMocks();
    resetMetrics();
});

describe('audit w tx: rollback cofa też audit', () => {
    it('create przez tx trafia tylko do tx (globalny prisma nietknięty)', async () => {
        const committed: string[] = [];
        const tx = makeFakeTx(committed);
        await logAudit('offer', 'o1', 'u1', 'create', { a: 1 }, null, tx.db);
        expect(tx.db.$executeRaw).toHaveBeenCalledTimes(1);
        expect(prismaMock.$executeRaw).not.toHaveBeenCalled();
        expect(committed).toHaveLength(0); // jeszcze bez commit
        tx.commit();
        expect(committed).toHaveLength(1);
    });

    it('rollback = brak audytu biznesowego (staged przepada)', async () => {
        const committed: string[] = [];
        const tx = makeFakeTx(committed);
        await logAudit('production_order', 'pz1', 'u1', 'delete', null, { n: 'PZ/1' }, tx.db);
        expect(tx.staged).toHaveLength(1);
        // symulacja rollback: tx rzuca PO audycie → staged odrzucone, brak commit
        expect(committed).toHaveLength(0);
    });

    it('update (debounce SELECT) też idzie przez tx', async () => {
        const committed: string[] = [];
        const tx = makeFakeTx(committed);
        await logAudit('order', 'z1', 'u1', 'update', { s: 'new' }, { s: 'old' }, tx.db);
        expect(tx.db.$queryRaw).toHaveBeenCalledTimes(1);
        expect(tx.db.$executeRaw).toHaveBeenCalledTimes(1);
        expect(prismaMock.$queryRaw).not.toHaveBeenCalled();
        expect(prismaMock.$executeRaw).not.toHaveBeenCalled();
    });

    it('błąd audytu w tx nie rzuca — biznes nie cofa się przez audit', async () => {
        const failingTx = {
            $queryRaw: jest.fn(async () => []),
            $executeRaw: jest.fn(async () => {
                throw new Error('SQLITE_BUSY');
            })
        } as unknown as AuditDb;
        await expect(
            logAudit('offer', 'o1', 'u1', 'create', { a: 1 }, null, failingTx)
        ).resolves.toBeUndefined();
        expect(getMetricsSnapshot().audit.failures).toBe(1);
    });
});

describe('POST /api/shares/revoke atomowe', () => {
    type ShareRow = {
        id: string;
        documentType: string;
        documentId: string;
        sharedWithUserId: string;
    };
    const DOC = { documentType: 'offer', documentId: 'doc1' };
    const store: { shares: ShareRow[] } = { shares: [] };
    const txCalls: { deleted: unknown[]; read: unknown[]; txSeen: unknown[] } = {
        deleted: [],
        read: [],
        txSeen: []
    };

    function matches(row: ShareRow, where: any): boolean {
        return Object.entries(where).every(([k, v]: [string, any]) => {
            if (v && typeof v === 'object' && 'in' in v) return v.in.includes((row as any)[k]);
            return (row as any)[k] === v;
        });
    }

    const txShares = {
        deleteMany: jest.fn(async ({ where }: any) => {
            txCalls.deleted.push(where);
            const before = store.shares.length;
            store.shares = store.shares.filter((r) => !matches(r, where));
            return { count: before - store.shares.length };
        }),
        findMany: jest.fn(async ({ where }: any) => {
            txCalls.read.push(where);
            return store.shares.filter((r) => matches(r, where)).map((r) => ({ ...r }));
        })
    };
    const auditCalls: unknown[][] = [];

    let app: express.Express;

    beforeEach(() => {
        store.shares = [
            { id: 's1', ...DOC, sharedWithUserId: 'u2' },
            { id: 's2', ...DOC, sharedWithUserId: 'u3' }
        ];
        txCalls.deleted = [];
        txCalls.read = [];
        txCalls.txSeen = [];
        auditCalls.length = 0;
        jest.clearAllMocks();

        jest.resetModules();
        jest.doMock('../../src/prismaClient', () => ({
            __esModule: true,
            default: {
                offers_rel: { findUnique: jest.fn(async () => ({ userId: 'u1' })) },
                offers_studnie_rel: { findUnique: jest.fn(async () => null) },
                orders_rury_rel: { findUnique: jest.fn(async () => null) },
                orders_studnie_rel: { findUnique: jest.fn(async () => null) },
                users: { findMany: jest.fn(async () => [{ id: 'u2', role: 'user' }]) },
                document_shares: {
                    deleteMany: jest.fn(() => {
                        throw new Error('poza tx — zakazane');
                    }),
                    findMany: jest.fn(() => {
                        throw new Error('poza tx — zakazane');
                    })
                },
                $transaction: jest.fn(async (fn: any) => {
                    const tx = { document_shares: txShares };
                    txCalls.txSeen.push(tx);
                    return fn(tx);
                })
            }
        }));
        jest.doMock('../../src/services/auditService', () => ({
            logAudit: jest.fn(async (...args: unknown[]) => {
                auditCalls.push(args);
            })
        }));
        jest.doMock('../../src/middleware/auth', () => ({
            requireAuth: (req: any, _res: any, next: any) => {
                req.user = { id: 'u1', role: 'admin', subUsers: [] };
                next();
            }
        }));
        jest.doMock('../../src/middleware/rateLimiters', () => ({
            WRITE_LIMITER: (_req: any, _res: any, next: any) => next()
        }));
        jest.doMock('../../src/validators/authSchema', () => ({
            validateData: () => (_req: any, _res: any, next: any) => next()
        }));
        jest.doMock('../../src/utils/logger', () => ({
            logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() }
        }));

        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const router = require('../../src/routes/shares').default;
        app = express();
        app.use(express.json());
        app.use('/api/shares', router);
    });

    afterEach(() => {
        jest.dontMock('../../src/prismaClient');
        jest.dontMock('../../src/services/auditService');
        jest.dontMock('../../src/middleware/auth');
        jest.dontMock('../../src/middleware/rateLimiters');
        jest.dontMock('../../src/validators/authSchema');
        jest.dontMock('../../src/utils/logger');
    });

    it('delete + odczyt w jednej tx, odpowiedź po kasowaniu', async () => {
        const res = await request(app)
            .post('/api/shares/revoke')
            .send({ ...DOC, userIds: ['u2'] });
        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);
        // odczyt w tx widzi stan PO delete
        expect(res.body.data).toHaveLength(1);
        expect(res.body.data[0].sharedWithUserId).toBe('u3');
        expect(txCalls.deleted).toHaveLength(1);
        expect(txCalls.read).toHaveLength(1);
        // audit revoke_batch też w tej samej tx
        expect(auditCalls).toHaveLength(1);
        expect(auditCalls[0][3]).toBe('revoke_batch');
        expect(auditCalls[0][6]).toBe(txCalls.txSeen[0]);
    });
});
