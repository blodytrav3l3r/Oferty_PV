import request from 'supertest';
import express from 'express';
import ruryOrdersRouter from '../../src/routes/orders/ruryOrders.crud';
import studnieOrdersRouter from '../../src/routes/orders/studnieOrders.crud';
import prisma from '../../src/prismaClient';

type Domain = 'rury' | 'studnie';
type TestUser = { id: string; role: 'user'; subUsers: string[] };

let mockUser: TestUser = { id: 'link-owner', role: 'user', subUsers: [] };
const suffix = `${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
const createdOrders: Record<Domain, string[]> = { rury: [], studnie: [] };
const createdOffers: Record<Domain, string[]> = { rury: [], studnie: [] };
const createdShareIds: string[] = [];

jest.mock('../../src/middleware/auth', () => ({
    requireAuth: (req: any, _res: any, next: any) => {
        req.user = { ...mockUser };
        next();
    }
}));

jest.mock('../../src/services/auditService', () => ({ logAudit: jest.fn() }));

function createApp(domain: Domain): express.Application {
    const app = express();
    app.use(express.json());
    app.use(
        domain === 'rury' ? '/api/orders-rury' : '/api/orders-studnie',
        domain === 'rury' ? ruryOrdersRouter : studnieOrdersRouter
    );
    return app;
}

function offerId(domain: Domain, key: string): string {
    return `offer_link_${domain}_${key}_${suffix}`;
}

function orderId(domain: Domain, key: string): string {
    return `order_link_${domain}_${key}_${suffix}`;
}

async function createOffer(domain: Domain, id: string, ownerId: string): Promise<void> {
    if (domain === 'rury') {
        await prisma.offers_rel.create({ data: { id, userId: ownerId } });
    } else {
        await prisma.offers_studnie_rel.create({ data: { id, userId: ownerId } });
    }
    createdOffers[domain].push(id);
}

async function grantOfferShare(
    domain: Domain,
    id: string,
    ownerId: string,
    recipientId: string
): Promise<void> {
    const shareId = `share_${id}_${recipientId}`;
    await prisma.document_shares.create({
        data: {
            id: shareId,
            documentType: domain === 'rury' ? 'offer' : 'offer_studnie',
            documentId: id,
            ownerId,
            sharedWithUserId: recipientId,
            permission: 'read',
            createdAt: new Date().toISOString(),
            createdBy: ownerId
        }
    });
    createdShareIds.push(shareId);
}

async function saveOrder(
    domain: Domain,
    id: string,
    relatedOfferId: string
): Promise<request.Response> {
    const item =
        domain === 'rury'
            ? { id, offerId: relatedOfferId, status: 'new' }
            : { id, offerStudnieId: relatedOfferId, status: 'new', wells: [] };
    return request(createApp(domain))
        .put(domain === 'rury' ? '/api/orders-rury' : '/api/orders-studnie')
        .send({ data: [item] });
}

async function readOrders(domain: Domain): Promise<request.Response> {
    return request(createApp(domain)).get(
        domain === 'rury' ? '/api/orders-rury' : '/api/orders-studnie'
    );
}

describe.each<Domain>(['rury', 'studnie'])('API link ofert — %s — PostgreSQL', (domain) => {
    beforeEach(() => {
        mockUser = { id: 'link-owner', role: 'user', subUsers: [] };
    });

    test('pozwala połączyć ofertę własną', async () => {
        const id = offerId(domain, 'own');
        const linkedOrderId = orderId(domain, 'own');
        await createOffer(domain, id, mockUser.id);

        const response = await saveOrder(domain, linkedOrderId, id);

        expect(response.status).toBe(200);
        createdOrders[domain].push(linkedOrderId);
    });

    test('pozwala połączyć ofertę udostępnioną, a odbiorca share widzi zamówienie', async () => {
        const ownerId = 'link-offer-owner';
        const recipientId = 'link-recipient';
        const viewerId = 'link-viewer';
        const id = offerId(domain, 'shared');
        const linkedOrderId = orderId(domain, 'shared');
        await createOffer(domain, id, ownerId);
        await grantOfferShare(domain, id, ownerId, recipientId);
        await grantOfferShare(domain, id, ownerId, viewerId);
        mockUser = { id: recipientId, role: 'user', subUsers: [] };

        const response = await saveOrder(domain, linkedOrderId, id);
        expect(response.status).toBe(200);

        mockUser = { id: viewerId, role: 'user', subUsers: [] };
        const listResponse = await readOrders(domain);
        expect(listResponse.status).toBe(200);
        expect(listResponse.body.data.map((order: { id: string }) => order.id)).toContain(
            linkedOrderId
        );
        createdOrders[domain].push(linkedOrderId);
    });

    test('odrzuca ofertę obcą bez share oraz nieistniejącą, a brak oferty pozostaje dozwolony', async () => {
        const foreignId = offerId(domain, 'foreign');
        await createOffer(domain, foreignId, 'link-foreign-owner');

        const foreignResponse = await saveOrder(domain, orderId(domain, 'foreign'), foreignId);
        expect(foreignResponse.status).toBe(403);

        const missingResponse = await saveOrder(
            domain,
            orderId(domain, 'missing'),
            offerId(domain, 'missing')
        );
        expect(missingResponse.status).toBe(404);
        expect(missingResponse.body.code).toBe('OFFER_NOT_FOUND');

        const unlinkedOrderId = orderId(domain, 'unlinked');
        const unlinkedResponse = await saveOrder(domain, unlinkedOrderId, '');
        expect(unlinkedResponse.status).toBe(200);
        createdOrders[domain].push(unlinkedOrderId);
    });

    test('odrzuca zmianę istniejącego powiązania na cudzą ofertę', async () => {
        const ownOfferId = offerId(domain, 'change-own');
        const foreignOfferId = offerId(domain, 'change-foreign');
        const linkedOrderId = orderId(domain, 'change');
        await createOffer(domain, ownOfferId, mockUser.id);
        await createOffer(domain, foreignOfferId, 'link-other-owner');
        const created = await saveOrder(domain, linkedOrderId, ownOfferId);
        expect(created.status).toBe(200);
        createdOrders[domain].push(linkedOrderId);

        const changed = await saveOrder(domain, linkedOrderId, foreignOfferId);
        expect(changed.status).toBe(403);
    });
});

afterAll(async () => {
    await prisma.document_shares.deleteMany({ where: { id: { in: createdShareIds } } });
    await prisma.orders_rury_rel.deleteMany({ where: { id: { in: createdOrders.rury } } });
    await prisma.orders_studnie_rel.deleteMany({ where: { id: { in: createdOrders.studnie } } });
    await prisma.offers_rel.deleteMany({ where: { id: { in: createdOffers.rury } } });
    await prisma.offers_studnie_rel.deleteMany({ where: { id: { in: createdOffers.studnie } } });
    await prisma.$disconnect();
});
