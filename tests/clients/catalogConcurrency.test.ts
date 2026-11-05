import express from 'express';
import request from 'supertest';
import clientRoutes from '../../src/routes/clients';
import prisma from '../../src/prismaClient';

jest.mock('../../src/middleware/auth', () => ({
    requireAuth: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
        Object.assign(req, { user: { id: req.header('x-test-admin'), role: 'admin' } });
        next();
    }
}));

const app = express();
app.use(express.json());
app.use('/api/clients', clientRoutes);
const endpoint = '/api/clients';
const clientId = 'catalog-cas-new-client';
const contactId = 'catalog-cas-new-contact';
const offerId = 'catalog-cas-linked-offer';
const racingClientId = 'catalog-cas-racing-client';

const catalog = (admin: string) => request(app).get(endpoint).set('x-test-admin', admin);

afterEach(async () => {
    await prisma.offers_rel.deleteMany({ where: { id: offerId } });
    await prisma.client_contacts_rel.deleteMany({ where: { id: contactId } });
    await prisma.clients_rel.deleteMany({ where: { id: { in: [clientId, racingClientId] } } });
});

afterAll(() => prisma.$disconnect());

test('a stale administrator cannot delete another session’s new client, contacts or offer link', async () => {
    const stale = await catalog('first-admin');
    const current = await catalog('second-admin');
    expect(stale.status).toBe(200);
    expect(current.body.catalogRevision).toBe(stale.body.catalogRevision);

    const added = await request(app)
        .put(endpoint)
        .set('x-test-admin', 'second-admin')
        .send({
            data: [...current.body.data, { id: clientId, name: 'Nowy klient' }],
            catalogRevision: current.body.catalogRevision
        });
    expect(added.status).toBe(200);
    expect(added.body.catalogRevision).not.toBe(stale.body.catalogRevision);
    await prisma.client_contacts_rel.create({
        data: { id: contactId, clientId, name: 'Nowy kontakt' }
    });
    await prisma.offers_rel.create({ data: { id: offerId, clientId } });

    const rejected = await request(app)
        .put(endpoint)
        .set('x-test-admin', 'first-admin')
        .send({ data: stale.body.data, catalogRevision: stale.body.catalogRevision });

    expect(rejected.status).toBe(409);
    expect(rejected.body.code).toBe('CLIENT_CATALOG_CONFLICT');
    expect(await prisma.clients_rel.count({ where: { id: clientId } })).toBe(1);
    expect(await prisma.client_contacts_rel.count({ where: { id: contactId, clientId } })).toBe(1);
    expect(await prisma.offers_rel.findUnique({ where: { id: offerId } })).toMatchObject({
        clientId
    });
});

test('a full catalog mutation without a revision is rejected', async () => {
    const response = await request(app)
        .put(endpoint)
        .set('x-test-admin', 'first-admin')
        .send({ data: [{ id: clientId, name: 'Przestarzały klient' }] });

    expect(response.status).toBe(409);
    expect(response.body.code).toBe('CLIENT_CATALOG_CONFLICT');
    expect(await prisma.clients_rel.count({ where: { id: clientId } })).toBe(0);
});

test('two PostgreSQL transactions using the same revision cannot both commit', async () => {
    const snapshot = await catalog('first-admin');
    const write = (admin: string, id: string) =>
        request(app)
            .put(endpoint)
            .set('x-test-admin', admin)
            .send({
                data: [...snapshot.body.data, { id, name: id }],
                catalogRevision: snapshot.body.catalogRevision
            });

    const outcomes = await Promise.all([
        write('first-admin', clientId),
        write('second-admin', racingClientId)
    ]);

    expect(outcomes.map(({ status }) => status).sort()).toEqual([200, 409]);
    expect(
        await prisma.clients_rel.count({ where: { id: { in: [clientId, racingClientId] } } })
    ).toBe(1);
});
