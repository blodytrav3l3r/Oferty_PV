import { Prisma } from '../generated/prisma-postgres/client';
import prisma from '../src/prismaClient';
import {
    buildRoleWhereConditionWithShares,
    buildOrderListWhereWithOfferShare
} from '../src/utils/roleFilter';

const suffix = `${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
const OWNER = `owner_${suffix}`;
const RECIPIENT = `recipient_${suffix}`;
const STRANGER = `stranger_${suffix}`;
const OFFER_ID = `offer_studnie_${suffix}`;
const ORDER_ID = `order_studnie_${suffix}`;
const ORPHAN_ID = `order_studnie_orphan_${suffix}`;
const SHARE_ID = `share_${suffix}`;
const ORDER_SHARE_ID = `share_order_${suffix}`;

type LiteUser = { role: 'user'; id: string; subUsers: string[] };

describe('buildRoleWhereConditionWithShares — rzeczywiste zapytanie PostgreSQL', () => {
    async function visibleOfferIds(user: LiteUser, docType: string): Promise<string[]> {
        const where = buildRoleWhereConditionWithShares(user, docType, 's');
        const rows = (await prisma.$queryRaw(
            Prisma.sql`SELECT s."id" AS id FROM "offers_studnie_rel" s ${where}`
        )) as { id: string }[];
        return rows.map((row) => row.id);
    }

    beforeAll(async () => {
        await prisma.offers_studnie_rel.create({ data: { id: OFFER_ID, userId: OWNER } });
        await prisma.document_shares.create({
            data: {
                id: SHARE_ID,
                documentType: 'offer_studnie',
                documentId: OFFER_ID,
                ownerId: OWNER,
                sharedWithUserId: RECIPIENT,
                permission: 'read',
                createdAt: new Date().toISOString(),
                createdBy: OWNER
            }
        });
    });

    afterAll(async () => {
        await prisma.document_shares.deleteMany({ where: { id: SHARE_ID } });
        await prisma.offers_studnie_rel.deleteMany({ where: { id: OFFER_ID } });
    });

    it('odbiorca share widzi ofertę', async () => {
        const ids = await visibleOfferIds(
            { role: 'user', id: RECIPIENT, subUsers: [] },
            'offer_studnie'
        );
        expect(ids).toContain(OFFER_ID);
    });

    it('obcy bez share nie widzi (brak wycieku)', async () => {
        const ids = await visibleOfferIds(
            { role: 'user', id: STRANGER, subUsers: [] },
            'offer_studnie'
        );
        expect(ids).not.toContain(OFFER_ID);
    });

    it('właściciel widzi bez share', async () => {
        const ids = await visibleOfferIds(
            { role: 'user', id: OWNER, subUsers: [] },
            'offer_studnie'
        );
        expect(ids).toContain(OFFER_ID);
    });

    it('zły documentType nie przyznaje dostępu', async () => {
        const ids = await visibleOfferIds({ role: 'user', id: RECIPIENT, subUsers: [] }, 'offer');
        expect(ids).not.toContain(OFFER_ID);
    });
});

describe('buildOrderListWhereWithOfferShare — rzeczywiste zapytanie PostgreSQL', () => {
    async function visibleOrderIds(user: LiteUser): Promise<string[]> {
        const where = buildOrderListWhereWithOfferShare(user, 'order_studnie', {
            alias: 'o',
            fkCol: '"offerStudnieId"',
            offerDocType: 'offer_studnie'
        });
        const rows = (await prisma.$queryRaw(
            Prisma.sql`SELECT o."id" AS id FROM "orders_studnie_rel" o ${where}`
        )) as { id: string }[];
        return rows.map((row) => row.id);
    }

    beforeAll(async () => {
        await prisma.document_shares.create({
            data: {
                id: ORDER_SHARE_ID,
                documentType: 'offer_studnie',
                documentId: OFFER_ID,
                ownerId: OWNER,
                sharedWithUserId: RECIPIENT,
                permission: 'read',
                createdAt: new Date().toISOString(),
                createdBy: OWNER
            }
        });
        await prisma.orders_studnie_rel.createMany({
            data: [
                { id: ORDER_ID, userId: OWNER, offerStudnieId: OFFER_ID },
                { id: ORPHAN_ID, userId: OWNER, offerStudnieId: null }
            ]
        });
    });

    afterAll(async () => {
        await prisma.document_shares.deleteMany({ where: { id: ORDER_SHARE_ID } });
        await prisma.orders_studnie_rel.deleteMany({
            where: { id: { in: [ORDER_ID, ORPHAN_ID] } }
        });
        await prisma.$disconnect();
    });

    it('share oferty ⇒ zamówienie widoczne bez jawnego share zamówienia', async () => {
        const ids = await visibleOrderIds({ role: 'user', id: RECIPIENT, subUsers: [] });
        expect(ids).toContain(ORDER_ID);
    });

    it('obcy bez niczego nie widzi (brak wycieku)', async () => {
        const ids = await visibleOrderIds({ role: 'user', id: STRANGER, subUsers: [] });
        expect(ids).not.toContain(ORDER_ID);
    });

    it('sierota bez oferty rodzica niewidoczna dla odbiorcy share innej oferty', async () => {
        const ids = await visibleOrderIds({ role: 'user', id: RECIPIENT, subUsers: [] });
        expect(ids).not.toContain(ORPHAN_ID);
    });

    it('właściciel widzi wszystko bez share', async () => {
        const ids = await visibleOrderIds({ role: 'user', id: OWNER, subUsers: [] });
        expect(ids).toContain(ORDER_ID);
        expect(ids).toContain(ORPHAN_ID);
    });
});
