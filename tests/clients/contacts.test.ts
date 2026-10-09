import request from 'supertest';
import express from 'express';
import contactsRouter from '../../src/routes/clients/contacts';
import clientsRouter from '../../src/routes/clients';
import prisma from '../../src/prismaClient';
import { ensureClientContactsTable } from '../../src/initDatabase';
import { createIsolatedProject } from '../migrations/helpers';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const mockUser: any = { id: 'user-id', role: 'user', subUsers: [] };

jest.mock('../../src/middleware/auth', () => ({
    requireAuth: (req: any, _res: any, next: any) => {
        req.user = { ...mockUser };
        next();
    }
}));

jest.mock('../../src/middleware/rateLimiters', () => ({
    WRITE_LIMITER: (_req: any, _res: any, next: any) => next(),
    EXPORT_LIMITER: (_req: any, _res: any, next: any) => next(),
    LOGIN_LIMITER: (_req: any, _res: any, next: any) => next(),
    Cennik_LIMITER: (_req: any, _res: any, next: any) => next()
}));

jest.mock('../../src/utils/logger', () => ({
    logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() }
}));

jest.mock('../../src/utils/searchCache', () => ({
    searchCache: { get: jest.fn(), set: jest.fn(), invalidateAll: jest.fn() }
}));

jest.mock('../../src/prismaClient', () => ({
    __esModule: true,
    default: {
        clients_rel: {
            findUnique: jest.fn(),
            findMany: jest.fn(),
            update: jest.fn(),
            updateMany: jest.fn(),
            deleteMany: jest.fn()
        },
        client_contacts_rel: {
            findMany: jest.fn(),
            create: jest.fn(),
            createMany: jest.fn(),
            update: jest.fn(),
            updateMany: jest.fn(),
            deleteMany: jest.fn()
        },
        offers_rel: { updateMany: jest.fn() },
        offers_studnie_rel: { updateMany: jest.fn() },
        audit_logs: { create: jest.fn() },
        $transaction: jest.fn(),
        $queryRaw: jest.fn(),
        $queryRawUnsafe: jest.fn(),
        $executeRaw: jest.fn(),
        $executeRawUnsafe: jest.fn()
    }
}));

import { searchCache } from '../../src/utils/searchCache';

function createContactsApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/clients', contactsRouter);
    return app;
}

function createClientsApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/clients', clientsRouter);
    return app;
}

const CLIENT = {
    id: 'c-1',
    userId: 'user-id',
    name: 'Budimex',
    nip: '',
    address: '',
    email: 'firma@budimex.pl',
    phone: '61-000-00-00',
    contact: 'Jan Kowalski',
    clientNumber: '',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z'
};

const EXISTING = [
    {
        id: 'k-1',
        clientId: 'c-1',
        name: 'Jan Kowalski',
        phone: '600000000',
        email: 'jan@firma.pl',
        position: '',
        isPrimary: 1,
        createdByUserId: 'user-id',
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z'
    },
    {
        id: 'k-2',
        clientId: 'c-1',
        name: 'Anna Nowak',
        phone: null,
        email: null,
        position: 'Księgowość',
        isPrimary: 0,
        createdByUserId: 'user-id',
        createdAt: '2026-09-02T00:00:00.000Z',
        updatedAt: '2026-09-02T00:00:00.000Z'
    }
];

function mockPrisma() {
    return prisma as unknown as Record<string, any>;
}

beforeEach(() => {
    jest.resetAllMocks();
    mockUser.id = 'user-id';
    mockUser.role = 'user';
    mockUser.subUsers = [];
    const m = mockPrisma();
    m.$transaction.mockImplementation((cb: (tx: unknown) => unknown) => {
        const prismaMock = jest.requireMock('../../src/prismaClient').default;
        return cb(prismaMock);
    });
    m.clients_rel.findUnique.mockResolvedValue({ ...CLIENT });
    m.clients_rel.update.mockResolvedValue({ ...CLIENT });
    m.client_contacts_rel.findMany.mockResolvedValue(EXISTING.map((c) => ({ ...c })));
    m.client_contacts_rel.create.mockImplementation((args: any) => Promise.resolve(args.data));
    m.client_contacts_rel.update.mockImplementation((args: any) =>
        Promise.resolve({ id: args.where.id, ...args.data })
    );
    m.client_contacts_rel.deleteMany.mockResolvedValue({ count: 0 });
    m.client_contacts_rel.createMany.mockResolvedValue({ count: 0 });
    m.audit_logs.create.mockResolvedValue({});
    m.$queryRaw.mockResolvedValue([]);
    m.$queryRawUnsafe.mockResolvedValue([]);
    m.$executeRaw.mockResolvedValue(0);
});

describe('Katalog kontaktów — GET /:clientId/contacts', () => {
    it('zwraca listę wg isPrimary desc, createdAt + 404 gdy brak klienta', async () => {
        const app = createContactsApp();
        const res = await request(app).get('/api/clients/c-1/contacts');
        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);
        expect(Array.isArray(res.body.items)).toBe(true);
        const m = mockPrisma();
        expect(m.client_contacts_rel.findMany).toHaveBeenCalledWith({
            where: { clientId: 'c-1' },
            orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }]
        });
        m.clients_rel.findUnique.mockResolvedValueOnce(null);
        const missing = await request(app).get('/api/clients/nie-ma/contacts');
        expect(missing.status).toBe(404);
        expect(missing.body.code).toBe('NOT_FOUND');
    });
});

describe('Katalog kontaktów — PUT /:clientId/contacts/sync', () => {
    it('diff w 1 tx: update + insert + delete + mirror primary + audyt', async () => {
        const app = createContactsApp();
        const res = await request(app)
            .put('/api/clients/c-1/contacts/sync')
            .send({
                contacts: [
                    { id: 'k-1', name: 'Jan Kowalski', phone: '600111111', email: 'jan@firma.pl' },
                    { name: 'Ewa Nowa', phone: '602000000', isPrimary: true }
                ]
            });
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ ok: true, clientId: 'c-1', count: 2 });
        const m = mockPrisma();
        expect(m.$transaction).toHaveBeenCalledTimes(1);
        expect(m.client_contacts_rel.deleteMany).toHaveBeenCalledWith({
            where: { id: { in: ['k-2'] } }
        });
        expect(m.client_contacts_rel.update).toHaveBeenCalledWith({
            where: { id: 'k-1' },
            data: expect.objectContaining({
                name: 'Jan Kowalski',
                phone: '600111111',
                isPrimary: 0
            })
        });
        expect(m.client_contacts_rel.create).toHaveBeenCalledTimes(1);
        const created = m.client_contacts_rel.create.mock.calls[0][0].data;
        expect(created.clientId).toBe('c-1');
        expect(created.name).toBe('Ewa Nowa');
        expect(created.isPrimary).toBe(1);
        expect(typeof created.id).toBe('string');
        // Mirror: primary (nowy) → clients_rel.
        expect(m.clients_rel.update).toHaveBeenCalledWith({
            where: { id: 'c-1' },
            data: expect.objectContaining({
                contact: 'Ewa Nowa',
                phone: '602000000'
            })
        });
        expect(m.audit_logs.create).toHaveBeenCalledTimes(1);
        expect(m.audit_logs.create.mock.calls[0][0].data).toMatchObject({
            entityType: 'client_contact',
            entityId: 'c-1',
            action: 'sync'
        });
        expect(searchCache.invalidateAll).toHaveBeenCalledTimes(1);
    });

    it('puste wiersze wypadają; wiersz z telefonem bez nazwy → 400', async () => {
        const app = createContactsApp();
        const res = await request(app)
            .put('/api/clients/c-1/contacts/sync')
            .send({
                contacts: [
                    { id: 'k-1', name: 'Jan Kowalski' },
                    { name: '', phone: '', email: '' },
                    { id: 'k-2', name: 'Anna Nowak' }
                ]
            });
        expect(res.status).toBe(200);
        expect(res.body.count).toBe(2);
        const bad = await request(app)
            .put('/api/clients/c-1/contacts/sync')
            .send({
                contacts: [{ phone: '600000000' }]
            });
        expect(bad.status).toBe(400);
    });

    it('walidacja: >10 → 400, zły e-mail → 400', async () => {
        const app = createContactsApp();
        const tooMany = await request(app)
            .put('/api/clients/c-1/contacts/sync')
            .send({ contacts: Array.from({ length: 11 }, (_, i) => ({ name: `O${i}` })) });
        expect(tooMany.status).toBe(400);
        const badMail = await request(app)
            .put('/api/clients/c-1/contacts/sync')
            .send({
                contacts: [{ name: 'Jan', email: 'nie-email' }]
            });
        expect(badMail.status).toBe(400);
    });

    it('IDOR: id z klienta B → 404; brak klienta → 404', async () => {
        const app = createContactsApp();
        const idor = await request(app)
            .put('/api/clients/c-1/contacts/sync')
            .send({
                contacts: [{ id: 'k-obce', name: 'Obcy' }]
            });
        expect(idor.status).toBe(404);
        expect(idor.body.code).toBe('NOT_FOUND');
        const m = mockPrisma();
        m.clients_rel.findUnique.mockResolvedValueOnce(null);
        const missing = await request(app)
            .put('/api/clients/nie-ma/contacts/sync')
            .send({
                contacts: [{ name: 'Jan' }]
            });
        expect(missing.status).toBe(404);
    });

    it('uprawnienia: obcy → 403, bezpański → 403, bezpański + admin → 200', async () => {
        const app = createContactsApp();
        const m = mockPrisma();
        m.clients_rel.findUnique.mockResolvedValue({ ...CLIENT, userId: 'obcy' });
        expect(
            (await request(app).put('/api/clients/c-1/contacts/sync').send({ contacts: [] })).status
        ).toBe(403);
        m.clients_rel.findUnique.mockResolvedValue({ ...CLIENT, userId: null });
        expect(
            (await request(app).put('/api/clients/c-1/contacts/sync').send({ contacts: [] })).status
        ).toBe(403);
        mockUser.role = 'admin';
        const ok = await request(app).put('/api/clients/c-1/contacts/sync').send({ contacts: [] });
        expect(ok.status).toBe(200);
    });

    it('konflikt clientUpdatedAt → 409 z updatedAt; zgodny → 200', async () => {
        const app = createContactsApp();
        const conflict = await request(app).put('/api/clients/c-1/contacts/sync').send({
            contacts: [],
            clientUpdatedAt: '2000-01-01T00:00:00.000Z'
        });
        expect(conflict.status).toBe(409);
        expect(conflict.body.code).toBe('CONFLICT');
        expect(conflict.body.updatedAt).toBe('2026-10-01T00:00:00.000Z');
        const ok = await request(app).put('/api/clients/c-1/contacts/sync').send({
            contacts: [],
            clientUpdatedAt: '2026-10-01T00:00:00.000Z'
        });
        expect(ok.status).toBe(200);
        expect(ok.body.updatedAt).toBeDefined();
    });

    it('atomowość: błąd audytu → 500 bez invalidateAll (1 tx albo nic)', async () => {
        const app = createContactsApp();
        const m = mockPrisma();
        m.audit_logs.create.mockRejectedValueOnce(new Error('boom'));
        const res = await request(app)
            .put('/api/clients/c-1/contacts/sync')
            .send({
                contacts: [{ name: 'Jan' }]
            });
        expect(res.status).toBe(500);
        expect(m.$transaction).toHaveBeenCalledTimes(1);
        expect(searchCache.invalidateAll).not.toHaveBeenCalled();
    });

    it('dwa isPrimary → dokładnie jeden wiersz z isPrimary=1', async () => {
        const app = createContactsApp();
        const res = await request(app)
            .put('/api/clients/c-1/contacts/sync')
            .send({
                contacts: [
                    { id: 'k-1', name: 'Jan Kowalski', isPrimary: true },
                    { id: 'k-2', name: 'Anna Nowak', isPrimary: true }
                ]
            });
        expect(res.status).toBe(200);
        const m = mockPrisma();
        const flags = m.client_contacts_rel.update.mock.calls.map(
            (call: any) => call[0].data.isPrimary
        );
        expect(flags.filter((f: number) => f === 1)).toHaveLength(1);
    });

    it('pusty sync czyści mirror clients_rel', async () => {
        const app = createContactsApp();
        const res = await request(app).put('/api/clients/c-1/contacts/sync').send({ contacts: [] });
        expect(res.status).toBe(200);
        const m = mockPrisma();
        expect(m.client_contacts_rel.deleteMany).toHaveBeenCalledWith({
            where: { id: { in: ['k-1', 'k-2'] } }
        });
        expect(m.clients_rel.update).toHaveBeenCalledWith({
            where: { id: 'c-1' },
            data: expect.objectContaining({ contact: '', phone: '', email: '' })
        });
    });
});

describe('Katalog kontaktów — primary-współbieżność (≤1 główny)', () => {
    it('dwa równoległe sync z różnym primary → na końcu ≤1 główny', async () => {
        const store: any[] = [
            {
                id: 'k-1',
                clientId: 'c-1',
                name: 'Jan',
                phone: null,
                email: null,
                position: '',
                isPrimary: 1
            },
            {
                id: 'k-2',
                clientId: 'c-1',
                name: 'Anna',
                phone: null,
                email: null,
                position: '',
                isPrimary: 0
            }
        ];
        const m = mockPrisma();
        m.client_contacts_rel.findMany.mockImplementation(() =>
            Promise.resolve(store.filter((c) => c.clientId === 'c-1').map((c) => ({ ...c })))
        );
        m.client_contacts_rel.update.mockImplementation((args: any) => {
            const row = store.find((c) => c.id === args.where.id);
            if (row) Object.assign(row, args.data);
            return Promise.resolve(row ? { ...row } : null);
        });
        const app = createContactsApp();
        const [r1, r2] = await Promise.all([
            request(app)
                .put('/api/clients/c-1/contacts/sync')
                .send({
                    contacts: [
                        { id: 'k-1', name: 'Jan', isPrimary: true },
                        { id: 'k-2', name: 'Anna' }
                    ]
                }),
            request(app)
                .put('/api/clients/c-1/contacts/sync')
                .send({
                    contacts: [
                        { id: 'k-1', name: 'Jan' },
                        { id: 'k-2', name: 'Anna', isPrimary: true }
                    ]
                })
        ]);
        expect(r1.status).toBe(200);
        expect(r2.status).toBe(200);
        expect(store.filter((c) => c.isPrimary === 1)).toHaveLength(1);
    });
});

describe('Katalog kontaktów — cascade przy usuwaniu klienta', () => {
    it('PUT /api/clients usuwa kontakty w tej samej tx co klienta', async () => {
        const app = createClientsApp();
        const m = mockPrisma();
        m.$queryRaw.mockResolvedValue([
            { id: 'c-keep', userId: 'user-id' },
            { id: 'c-del', userId: 'user-id' }
        ]);
        const res = await request(app)
            .put('/api/clients')
            .send({ data: [{ id: 'c-keep', name: 'Zostaje' }] });
        expect(res.status).toBe(200);
        expect(m.$transaction).toHaveBeenCalledTimes(1);
        expect(m.client_contacts_rel.deleteMany).toHaveBeenCalledWith({
            where: { clientId: { in: ['c-del'] } }
        });
        expect(m.clients_rel.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ['c-del'] } } });
    });
});

describe('Katalog kontaktów — auto-heal legacy-DB', () => {
    it('tworzy tabelę + backfill tylko niepustych (isPrimary=1)', async () => {
        const m = mockPrisma();
        m.$queryRaw.mockResolvedValue([
            { id: 'c-full', userId: 'u-1', contact: 'Jan', phone: '600', email: '' },
            { id: 'c-empty', userId: 'u-1', contact: '', phone: null, email: null }
        ]);
        await ensureClientContactsTable();
        expect(m.$executeRaw).toHaveBeenCalledTimes(2);
        expect(m.client_contacts_rel.createMany).toHaveBeenCalledTimes(1);
        const rows = m.client_contacts_rel.createMany.mock.calls[0][0].data;
        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({
            clientId: 'c-full',
            name: 'Jan',
            phone: '600',
            isPrimary: 1,
            createdByUserId: 'u-1'
        });
        expect(typeof rows[0].id).toBe('string');
    });

    it('błąd DDL nie wywala startu (warn-only)', async () => {
        const m = mockPrisma();
        m.$executeRaw.mockRejectedValueOnce(new Error('locked'));
        await expect(ensureClientContactsTable()).resolves.toBeUndefined();
    });
});

describe('Katalog kontaktów — migracja (realna persystencja)', () => {
    it('deploy tworzy tabelę z kolumnami i indeksem', () => {
        const dir = path.join(__dirname, '..', '..', 'prisma', 'migrations');
        const names = fs
            .readdirSync(dir, { withFileTypes: true })
            .filter((d) => d.isDirectory())
            .map((d) => d.name)
            .filter((n) => fs.existsSync(path.join(dir, n, 'migration.sql')))
            .sort();
        expect(names).toContain('20261009000001_client_contacts');
        const project = createIsolatedProject('client-contacts', names);
        try {
            const out = project.runPrisma(['migrate', 'deploy']);
            expect(out).toContain('All migrations have been successfully applied');
            const db = new DatabaseSync(project.dbPath);
            const cols = db
                .prepare(`SELECT name FROM pragma_table_info('client_contacts_rel') ORDER BY cid`)
                .all() as Array<{ name: string }>;
            expect(cols.map((c) => c.name)).toEqual([
                'id',
                'clientId',
                'name',
                'phone',
                'email',
                'position',
                'isPrimary',
                'createdByUserId',
                'createdAt',
                'updatedAt'
            ]);
            const idx = db
                .prepare(`SELECT name FROM pragma_index_list('client_contacts_rel') ORDER BY name`)
                .all() as Array<{ name: string }>;
            expect(idx.map((i) => i.name)).toContain('idx_client_contacts_client');
            db.close();
        } finally {
            project.cleanup();
        }
    }, 120000);
});
