import fs from 'fs';
import os from 'os';
import path from 'path';
import { PrismaClient } from '../generated/prisma';
import { Prisma } from '../generated/prisma';
import {
    buildRoleWhereConditionWithShares,
    buildOrderListWhereWithOfferShare
} from '../src/utils/roleFilter';

// P0.4: EXISTS w buildRoleWhereConditionWithShares na PRAWDZIWYM SQLite.
// Historia: gołe "id" w podzapytaniu SQLite wiązał z document_shares.id (PK),
// nie z ofertą z zewnątrz → EXISTS zawsze false → odbiorca share nie widział
// dokumentu w Kartotece (/api/offers/search). Mocki prismy tego nie łapią.
describe('buildRoleWhereConditionWithShares — prawdziwy SQLite (scratch file)', () => {
    const dbFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'sok-share-')), 't.sqlite');
    const db = new PrismaClient({ datasourceUrl: `file:${dbFile}` });
    const OWNER = 'owner-a';
    const RECIPIENT = 'user-b';
    const STRANGER = 'user-c';
    const OFFER_ID = 'offer_studnie_case1';

    async function visibleIds(
        user: { role: 'user'; id: string; subUsers: string[] },
        docType: string
    ): Promise<string[]> {
        // alias 's' MUSI odpowiadać aliasowi w FROM (jak callery produkcyjne)
        const where = buildRoleWhereConditionWithShares(user, docType, 's');
        const rows = (await db.$queryRaw(
            Prisma.sql`SELECT s."id" AS id FROM offers_studnie_rel s ${where}`
        )) as { id: string }[];
        return rows.map((r) => r.id);
    }

    beforeAll(async () => {
        await db.$executeRaw`CREATE TABLE offers_studnie_rel ("id" TEXT PRIMARY KEY, "userId" TEXT)`;
        await db.$executeRaw`CREATE TABLE "document_shares" ("id" TEXT NOT NULL PRIMARY KEY, "documentType" TEXT NOT NULL, "documentId" TEXT NOT NULL, "ownerId" TEXT NOT NULL, "sharedWithUserId" TEXT NOT NULL, "permission" TEXT NOT NULL DEFAULT 'read', "createdAt" TEXT NOT NULL, "createdBy" TEXT NOT NULL)`;
        await db.$executeRaw`INSERT INTO offers_studnie_rel ("id", "userId") VALUES (${OFFER_ID}, ${OWNER})`;
        await db.$executeRaw`INSERT INTO "document_shares" ("id", "documentType", "documentId", "ownerId", "sharedWithUserId", "permission", "createdAt", "createdBy") VALUES ('share-1', 'offer_studnie', ${OFFER_ID}, ${OWNER}, ${RECIPIENT}, 'read', '2026-10-07', ${OWNER})`;
    });

    afterAll(async () => {
        await db.$disconnect();
        fs.rmSync(path.dirname(dbFile), { recursive: true, force: true });
    });

    it('odbiorca share widzi ofertę (RED przed fixem: pusta lista)', async () => {
        const ids = await visibleIds(
            { role: 'user', id: RECIPIENT, subUsers: [] },
            'offer_studnie'
        );
        expect(ids).toContain(OFFER_ID);
    });

    it('obcy bez share nie widzi (brak wycieku)', async () => {
        const ids = await visibleIds({ role: 'user', id: STRANGER, subUsers: [] }, 'offer_studnie');
        expect(ids).not.toContain(OFFER_ID);
    });

    it('właściciel widzi bez share (regresja)', async () => {
        const ids = await visibleIds({ role: 'user', id: OWNER, subUsers: [] }, 'offer_studnie');
        expect(ids).toContain(OFFER_ID);
    });

    it('zły documentType nie przyznaje dostępu', async () => {
        const ids = await visibleIds({ role: 'user', id: RECIPIENT, subUsers: [] }, 'offer');
        expect(ids).not.toContain(OFFER_ID);
    });
});

type LiteUser = { role: 'user'; id: string; subUsers: string[] };

// P0.5: dziedziczenie odczytu zamówień po ofercie-rodzicu (prawdziwy SQLite).
describe('buildOrderListWhereWithOfferShare — prawdziwy SQLite (scratch file)', () => {
    const dbFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'sok-share-')), 't.sqlite');
    const db = new PrismaClient({ datasourceUrl: `file:${dbFile}` });
    const OWNER = 'owner-a';
    const RECIPIENT = 'user-b';
    const STRANGER = 'user-c';
    const OFFER_ID = 'offer_studnie_case1';
    const ORDER_ID = 'order_studnie_case1';
    const ORPHAN_ID = 'order_studnie_orphan';

    async function visibleOrderIds(user: LiteUser): Promise<string[]> {
        const where = buildOrderListWhereWithOfferShare(user, 'order_studnie', {
            alias: 'o',
            fkCol: '"offerStudnieId"',
            offerDocType: 'offer_studnie'
        });
        const rows = (await db.$queryRaw(
            Prisma.sql`SELECT o."id" AS id FROM orders_studnie_rel o ${where}`
        )) as { id: string }[];
        return rows.map((r) => r.id);
    }

    beforeAll(async () => {
        await db.$executeRaw`CREATE TABLE orders_studnie_rel ("id" TEXT PRIMARY KEY, "userId" TEXT, "offerStudnieId" TEXT)`;
        await db.$executeRaw`CREATE TABLE "document_shares" ("id" TEXT NOT NULL PRIMARY KEY, "documentType" TEXT NOT NULL, "documentId" TEXT NOT NULL, "ownerId" TEXT NOT NULL, "sharedWithUserId" TEXT NOT NULL, "permission" TEXT NOT NULL DEFAULT 'read', "createdAt" TEXT NOT NULL, "createdBy" TEXT NOT NULL)`;
        await db.$executeRaw`INSERT INTO orders_studnie_rel ("id", "userId", "offerStudnieId") VALUES (${ORDER_ID}, ${OWNER}, ${OFFER_ID})`;
        await db.$executeRaw`INSERT INTO orders_studnie_rel ("id", "userId", "offerStudnieId") VALUES (${ORPHAN_ID}, ${OWNER}, NULL)`;
        // tylko share OFERTY — brak wiersza order_studnie
        await db.$executeRaw`INSERT INTO "document_shares" ("id", "documentType", "documentId", "ownerId", "sharedWithUserId", "permission", "createdAt", "createdBy") VALUES ('share-1', 'offer_studnie', ${OFFER_ID}, ${OWNER}, ${RECIPIENT}, 'read', '2026-10-07', ${OWNER})`;
    });

    afterAll(async () => {
        await db.$disconnect();
        fs.rmSync(path.dirname(dbFile), { recursive: true, force: true });
    });

    it('share oferty ⇒ zamówienie widoczne bez jawnego share zamówienia', async () => {
        const ids = await visibleOrderIds({ role: 'user', id: RECIPIENT, subUsers: [] });
        expect(ids).toContain(ORDER_ID);
    });

    it('obcy bez niczego nie widzi (brak wycieku)', async () => {
        const ids = await visibleOrderIds({ role: 'user', id: STRANGER, subUsers: [] });
        expect(ids).not.toContain(ORDER_ID);
    });

    it('sierota bez FK niewidoczna dla odbiorcy share innej oferty', async () => {
        const ids = await visibleOrderIds({ role: 'user', id: RECIPIENT, subUsers: [] });
        expect(ids).not.toContain(ORPHAN_ID);
    });

    it('właściciel widzi wszystko bez share (regresja)', async () => {
        const ids = await visibleOrderIds({ role: 'user', id: OWNER, subUsers: [] });
        expect(ids).toEqual(expect.arrayContaining([ORDER_ID, ORPHAN_ID]));
    });
});
