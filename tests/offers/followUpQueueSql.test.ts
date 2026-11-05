/*
 * tests/offers/followUpQueueSql.test.ts
 * P0.2 SQL kolejki opieki: latest (tie-break id DESC), scope mine/team/all,
 * dedup (offerKind,offerId), ORDER BY bucketWeight/COALESCE(next)/kind/id,
 * cursor base64, limit clamp, max 2 SELECT.
 */
import type { Prisma } from '../../generated/prisma-postgres/client';
import prisma from '../../src/prismaClient';
import {
    buildCareEnrichQuery,
    buildCareQueueQueries,
    clampCareLimit,
    decodeCareCursor,
    encodeCareCursor,
    getCareQueue,
    type CareUser
} from '../../src/services/careService';

const NOW = '2026-10-10T00:00:00.000Z';
const PAST = '2026-10-09T10:00:00.000Z';
const FUTURE = '2026-10-11T10:00:00.000Z';

const testId = `care-queue-sql-${process.pid}-${Date.now()}`;
const ADMIN: CareUser = { id: `${testId}-admin`, role: 'admin', subUsers: [] };
const PRO: CareUser = { id: `${testId}-pro`, role: 'pro', subUsers: [`${testId}-u1`] };
const U1: CareUser = { id: `${testId}-u1`, role: 'user', subUsers: [] };
const U2: CareUser = { id: `${testId}-u2`, role: 'user', subUsers: [] };

interface TestDb {
    $queryRaw<T>(query: Prisma.Sql): Promise<T>;
    close(): Promise<void>;
}

async function freshDb(): Promise<TestDb> {
    await prisma.offers_rel.createMany({
        data: [
            { id: `${testId}-o1`, userId: U1.id, createdAt: '2026-10-01T00:00:00.000Z' },
            { id: `${testId}-o2`, userId: U1.id, createdAt: '2026-10-01T00:00:00.000Z' },
            { id: `${testId}-o4`, userId: U1.id, createdAt: '2026-10-01T00:00:00.000Z' },
            { id: `${testId}-o9`, userId: U2.id, createdAt: '2026-10-01T00:00:00.000Z' },
            { id: `${testId}-o5`, userId: PRO.id, createdAt: '2026-10-01T00:00:00.000Z' }
        ]
    });
    await prisma.offers_studnie_rel.create({
        data: { id: `${testId}-o3`, userId: U1.id, createdAt: '2026-10-01T00:00:00.000Z' }
    });
    await prisma.offer_follow_ups.createMany({
        data: (
            [
                [`f1`, 'rury', 'o1', 'OPEN', PAST, PAST],
                [`f2a`, 'rury', 'o2', 'OPEN', PAST, PAST],
                [`f2b`, 'rury', 'o2', 'OPEN', FUTURE, FUTURE],
                [`f2c`, 'rury', 'o2', 'OPEN', FUTURE, '2026-10-10T12:00:00.000Z'],
                [`aaa`, 'studnie', 'o3', 'OPEN', PAST, PAST],
                [`zzz`, 'studnie', 'o3', 'WON', PAST, PAST],
                [`f9`, 'rury', 'o9', 'OPEN', PAST, PAST],
                [`f5`, 'rury', 'o5', 'OPEN', PAST, PAST]
            ] as const
        ).map(([id, kind, offer, outcome, next, contacted]) => ({
            id: `${testId}-${id}`,
            offerKind: kind,
            offerId: `${testId}-${offer}`,
            createdByUserId: U1.id,
            outcome,
            nextContactAt: next,
            contactedAt: contacted,
            createdAt: contacted,
            channel: 'PHONE' as const,
            result: 'CONTACTED' as const
        }))
    });
    return {
        $queryRaw: <T>(query: Prisma.Sql) => prisma.$queryRaw<T>(query),
        close: async () => {
            await prisma.document_shares.deleteMany({ where: { id: { startsWith: testId } } });
            await prisma.care_states.deleteMany({ where: { offerId: { startsWith: testId } } });
            await prisma.offer_follow_ups.deleteMany({
                where: { offerId: { startsWith: testId } }
            });
            await prisma.offers_rel.deleteMany({ where: { id: { startsWith: testId } } });
            await prisma.offers_studnie_rel.deleteMany({ where: { id: { startsWith: testId } } });
        }
    };
}

async function rawAll(db: TestDb, q: Prisma.Sql): Promise<Record<string, unknown>[]> {
    return db.$queryRaw<Record<string, unknown>[]>(q);
}

async function dataIds(db: TestDb, user: CareUser, extra = {}): Promise<string[]> {
    const { data } = buildCareQueueQueries(user, { nowIso: NOW, ...extra });
    return (await rawAll(db, data)).map(
        (row) => `${row.offerKind}:${String(row.offerId).slice(testId.length + 1)}`
    );
}

describe('P0.2 care queue SQL', () => {
    it('latest: przy remisie czasów wygrywa wyższe id (o3 = WON, bucket 2)', async () => {
        const db = await freshDb();
        try {
            const { data } = buildCareQueueQueries(U1, { nowIso: NOW });
            const rows = await rawAll(db, data);
            const o3 = rows.find((row) => row.offerId === `${testId}-o3`) as Record<
                string,
                unknown
            >;
            expect(o3.outcome).toBe('WON');
            expect(Number(o3.bucketWeight)).toBe(2);
            await db.close();
        } catch (e) {
            try {
                await db.close();
            } catch {
                /* ignore */
            }
            throw e;
        }
    });

    it('dedup: o2 z 3 wpisami to 1 wiersz; COUNT DISTINCT = liczba ofert', async () => {
        const db = await freshDb();
        try {
            const fake = {
                $queryRaw: async <T>(...args: unknown[]): Promise<T> =>
                    (await rawAll(db, args[0] as Prisma.Sql)) as unknown as T
            };
            const res = await getCareQueue(fake, U1, { nowIso: NOW });
            expect(res.totalCount).toBe(4);
            expect(res.items).toHaveLength(4);
            expect(res.items.filter((i) => i.offerId === `${testId}-o2`)).toHaveLength(1);
            // latest o2 = f2c (najpozniejszy contactedAt) -> OPEN future -> bucket 1.
            expect(res.items.find((i) => i.offerId === `${testId}-o2`)?.bucketWeight).toBe(1);
            await db.close();
        } catch (e) {
            try {
                await db.close();
            } catch {
                /* ignore */
            }
            throw e;
        }
    });

    it('ORDER BY bucketWeight, COALESCE(next,9999), kind, id', async () => {
        const db = await freshDb();
        try {
            // u1: o1 bucket0 PAST, o4 bucket0 NULL(next->9999, ostatnie w buckecie),
            // o2 bucket1 FUTURE, o3 bucket2.
            expect(await dataIds(db, U1)).toEqual(['rury:o1', 'rury:o4', 'rury:o2', 'studnie:o3']);
            await db.close();
        } catch (e) {
            try {
                await db.close();
            } catch {
                /* ignore */
            }
            throw e;
        }
    });

    it('scope: mine/team/all + 403 dla all bez admin', async () => {
        const db = await freshDb();
        try {
            expect(await dataIds(db, U1)).toHaveLength(4);
            expect(await dataIds(db, U1)).not.toContain('rury:o9');
            // team pro1 = pro1 + u1 (bez u2).
            const team = await dataIds(db, PRO, { scope: 'team' });
            expect(team).toContain('rury:o5');
            expect(team).toContain('rury:o1');
            expect(team).not.toContain('rury:o9');
            // team dla user = 403.
            expect(() => buildCareQueueQueries(U2, { nowIso: NOW, scope: 'team' })).toThrow();
            // all admin = wszystko (4x u1 + o5 + o9).
            const { count } = buildCareQueueQueries(ADMIN, { nowIso: NOW, scope: 'all' });
            expect(Number((await rawAll(db, count))[0].c)).toBe(6);
            // all bez admin = 403.
            expect(() => buildCareQueueQueries(U1, { nowIso: NOW, scope: 'all' })).toThrow();
            await db.close();
        } catch (e) {
            try {
                await db.close();
            } catch {
                /* ignore */
            }
            throw e;
        }
    });

    it('share: udostępniona oferta u2 widoczna dla u1 (read-only)', async () => {
        const db = await freshDb();
        try {
            await prisma.document_shares.create({
                data: {
                    id: `${testId}-share`,
                    sharedWithUserId: U1.id,
                    documentType: 'offer',
                    documentId: `${testId}-o9`,
                    ownerId: U2.id,
                    createdAt: NOW,
                    createdBy: U2.id
                }
            });
            expect(await dataIds(db, U1)).toContain('rury:o9');
            await db.close();
        } catch (e) {
            try {
                await db.close();
            } catch {
                /* ignore */
            }
            throw e;
        }
    });

    it('hidePaused w SQL: pełna strona + zgodny count (fix paginacji)', async () => {
        const db = await freshDb();
        try {
            await prisma.care_states.create({
                data: {
                    offerKind: 'rury',
                    offerId: `${testId}-o1`,
                    snoozedUntil: '2026-10-12T00:00:00.000Z',
                    updatedBy: U1.id,
                    updatedAt: NOW
                }
            });
            const fake = {
                $queryRaw: async <T>(query: Prisma.Sql): Promise<T> => {
                    return (await rawAll(db, query)) as unknown as T;
                }
            };
            const res = await getCareQueue(fake, U1, { nowIso: NOW, limit: 10, hidePaused: true });
            expect(res.items.find((i) => i.offerId === `${testId}-o1`)).toBeUndefined();
            expect(res.totalCount).toBe(3);
            expect(res.items).toHaveLength(3);
            const all = await getCareQueue(fake, U1, { nowIso: NOW, limit: 10 });
            expect(all.totalCount).toBe(4);
            await db.close();
        } catch (e) {
            try {
                await db.close();
            } catch {
                /* ignore */
            }
            throw e;
        }
    });

    it('kontekst biznesowy: klient, wartość, telefon, notatka w wierszu', async () => {
        const db = await freshDb();
        try {
            await prisma.offers_rel.update({
                where: { id: `${testId}-o1` },
                data: {
                    clientName: 'Budimex',
                    data: JSON.stringify({ totalBrutto: 4440.3, clientPhone: '601000111' })
                }
            });
            await prisma.offer_follow_ups.update({
                where: { id: `${testId}-f1` },
                data: { note: 'Czeka na decyzję' }
            });
            const fake = {
                $queryRaw: async <T>(query: Prisma.Sql): Promise<T> => {
                    return (await rawAll(db, query)) as unknown as T;
                }
            };
            const res = await getCareQueue(fake, U1, { nowIso: NOW, limit: 10 });
            const o1 = res.items.find((i) => i.offerId === `${testId}-o1`);
            expect(o1?.clientName).toBe('Budimex');
            expect(o1?.value).toBeCloseTo(4440.3);
            expect(o1?.phone).toBe('601000111');
            expect(o1?.lastNote).toBe('Czeka na decyzję');
            await db.close();
        } catch (e) {
            try {
                await db.close();
            } catch {
                /* ignore */
            }
            throw e;
        }
    });

    it('born: kolejka niesie createdAt oferty (wiek NO_CONTACT)', async () => {
        const db = await freshDb();
        try {
            const fake = {
                $queryRaw: async <T>(query: Prisma.Sql): Promise<T> => {
                    return (await rawAll(db, query)) as unknown as T;
                }
            };
            const res = await getCareQueue(fake, U1, { nowIso: NOW, limit: 10 });
            const o4 = res.items.find((i) => i.offerId === `${testId}-o4`);
            expect(o4?.createdAt).toBe('2026-10-01T00:00:00.000Z');
            await db.close();
        } catch (e) {
            try {
                await db.close();
            } catch {
                /* ignore */
            }
            throw e;
        }
    });

    it('cursor: strony łącznie dają całość bez powtórzeń; limit clamp', async () => {
        const db = await freshDb();
        try {
            const p1 = buildCareQueueQueries(U1, { nowIso: NOW, limit: 2 });
            const rows1 = await rawAll(db, p1.data);
            expect(rows1).toHaveLength(3); // limit+1 = probka nastepnej strony
            const page1 = rows1.slice(0, 2);
            const last = page1[1] as Record<string, unknown>;
            const cursor = encodeCareCursor({
                w: Number(last.bucketWeight),
                n: last.next as string | null,
                k: last.offerKind as string,
                i: last.offerId as string
            });
            expect(decodeCareCursor(cursor)).toEqual({
                w: Number(last.bucketWeight),
                n: last.next,
                k: last.offerKind,
                i: last.offerId
            });
            expect(decodeCareCursor('!!!nie-base64!!!')).toBeNull();
            const p2 = buildCareQueueQueries(U1, { nowIso: NOW, limit: 2, cursor });
            const rows2 = await rawAll(db, p2.data);
            const label = (row: Record<string, unknown>) =>
                `${row.offerKind}:${String(row.offerId).slice(testId.length + 1)}`;
            const ids1 = page1.map(label);
            const ids2 = rows2.map(label);
            expect(new Set([...ids1, ...ids2]).size).toBe(4);
            expect(ids1.filter((x) => ids2.includes(x))).toHaveLength(0);
            expect([...ids1, ...ids2].sort()).toEqual(
                ['rury:o1', 'rury:o2', 'rury:o4', 'studnie:o3'].sort()
            );
            expect(clampCareLimit(200)).toBe(100);
            expect(clampCareLimit(undefined)).toBe(50);
            expect(clampCareLimit(0)).toBe(1);
            await db.close();
        } catch (e) {
            try {
                await db.close();
            } catch {
                /* ignore */
            }
            throw e;
        }
    });

    it('getCareQueue: strona + count równolegle, enrich tylko niepustej strony', async () => {
        let calls = 0;
        const seen: string[] = [];
        const db = await freshDb();
        try {
            const fake = {
                $queryRaw: async <T>(...args: unknown[]): Promise<T> => {
                    calls += 1;
                    const raw = args[0] as Prisma.Sql;
                    seen.push((raw as unknown as { sql: string }).sql.slice(0, 60));
                    return (await rawAll(db, raw)) as unknown as T;
                }
            };
            const res = await getCareQueue(fake, U1, { nowIso: NOW, limit: 2 });
            // data + count równolegle, potem enrich strony = 3.
            expect(calls).toBe(3);
            expect(res.items).toHaveLength(2);
            expect(res.totalCount).toBe(4);
            expect(typeof res.nextCursor).toBe('string');
            const tail = await getCareQueue(fake, U1, {
                nowIso: NOW,
                limit: 10
            });
            expect(tail.nextCursor).toBeNull();
            await db.close();
        } catch (e) {
            try {
                await db.close();
            } catch {
                /* ignore */
            }
            throw e;
        }
    });

    it('cursor !!!: INVALID_CURSOR 400 z code (luka #9, poziom serwisu)', async () => {
        const db = await freshDb();
        try {
            const fake = {
                $queryRaw: async <T>(...args: unknown[]): Promise<T> => {
                    return (await rawAll(db, args[0] as Prisma.Sql)) as unknown as T;
                }
            };
            let syncErr: unknown;
            try {
                buildCareQueueQueries(U1, { nowIso: NOW, cursor: '!!!' });
            } catch (e) {
                syncErr = e;
            }
            expect(syncErr).toMatchObject({ status: 400, code: 'INVALID_CURSOR' });
            await expect(
                getCareQueue(fake, U1, { nowIso: NOW, cursor: '!!!' })
            ).rejects.toMatchObject({ status: 400, code: 'INVALID_CURSOR' });
            await db.close();
        } catch (e) {
            try {
                await db.close();
            } catch {
                /* ignore */
            }
            throw e;
        }
    });
});

describe('P0.4 count bez CTE latest (KEEP-guard)', () => {
    function queueAdapter(db: TestDb) {
        return {
            $queryRaw: async <T>(query: Prisma.Sql): Promise<T> => {
                return (await rawAll(db, query)) as unknown as T;
            }
        };
    }

    it('count SQL nie tyka follow-upów (brak okna analitycznego)', () => {
        const { count } = buildCareQueueQueries(U1, { nowIso: NOW });
        const raw = count as unknown as { sql: string };
        expect(raw.sql).not.toContain('ROW_NUMBER');
        expect(raw.sql).not.toContain('offer_follow_ups');
        expect(raw.sql).not.toContain('WITH latest');
    });

    it('parzystość: count = liczba wierszy kolejki (mine/all/hidePaused)', async () => {
        const db = await freshDb();
        try {
            const f = queueAdapter(db);
            const mine = await getCareQueue(f, U1, { nowIso: NOW, scope: 'mine', limit: 50 });
            expect(mine.totalCount).toBe(4);
            const minePaused = await getCareQueue(f, U1, {
                nowIso: NOW,
                scope: 'mine',
                limit: 50,
                hidePaused: true
            });
            expect(minePaused.totalCount).toBe(4);
            const all = await getCareQueue(f, ADMIN, { nowIso: NOW, scope: 'all', limit: 50 });
            expect(all.totalCount).toBe(6);
        } finally {
            await db.close();
        }
    });

    it('hidePaused wycina spauzowane tak samo w data i count', async () => {
        const db = await freshDb();
        try {
            await prisma.care_states.create({
                data: {
                    offerKind: 'rury',
                    offerId: `${testId}-o1`,
                    snoozedUntil: '2026-12-31T00:00:00.000Z',
                    updatedAt: '2026-10-02T00:00:00.000Z'
                }
            });
            const f = queueAdapter(db);
            const q = await getCareQueue(f, U1, {
                nowIso: NOW,
                scope: 'mine',
                limit: 50,
                hidePaused: true
            });
            expect(q.totalCount).toBe(3);
            expect(q.items.some((r) => r.offerId === `${testId}-o1`)).toBe(false);
        } finally {
            await db.close();
        }
    });
    it('pusta strona: buildCareEnrichQuery([], []) to null (brak zapytania)', () => {
        expect(buildCareEnrichQuery([], [])).toBeNull();
        const one = buildCareEnrichQuery(['o1'], []);
        expect(one).not.toBeNull();
    });
});

describe('P0.2 KEEP-guard sortowania i cursora (assert, zero kodu)', () => {
    it('NULLS-last sentinelem: SQL ma COALESCE(next), parametry niosa 9999', () => {
        const { data } = buildCareQueueQueries(U1, { nowIso: NOW });
        const raw = data as unknown as { sql: string; values: unknown[] };
        expect(raw.sql).toContain('COALESCE');
        expect(raw.values).toContain('9999');
    });

    it('cursor tiebreak: ten sam bucket+termin -> kind/id, strony bez dubli', async () => {
        const db = await freshDb();
        try {
            // o0 = bliźniak o1: ten sam bucket 0 i termin PAST -> tiebreak po id.
            await prisma.offers_rel.create({
                data: {
                    id: `${testId}-o0`,
                    userId: U1.id,
                    createdAt: '2026-10-01T00:00:00.000Z'
                }
            });
            await prisma.offer_follow_ups.create({
                data: {
                    id: `${testId}-f0`,
                    offerKind: 'rury',
                    offerId: `${testId}-o0`,
                    createdByUserId: U1.id,
                    contactedAt: PAST,
                    createdAt: PAST,
                    outcome: 'OPEN',
                    nextContactAt: PAST,
                    channel: 'PHONE',
                    result: 'CONTACTED'
                }
            });
            expect((await dataIds(db, U1)).slice(0, 2)).toEqual(['rury:o0', 'rury:o1']);
            const p1 = buildCareQueueQueries(U1, { nowIso: NOW, limit: 1 });
            const first = (await rawAll(db, p1.data)).slice(0, 1)[0] as Record<string, unknown>;
            const cursor = encodeCareCursor({
                w: Number(first.bucketWeight),
                n: first.next as string | null,
                k: first.offerKind as string,
                i: first.offerId as string
            });
            const p2 = buildCareQueueQueries(U1, { nowIso: NOW, limit: 1, cursor });
            const second = (await rawAll(db, p2.data)).slice(0, 1)[0] as Record<string, unknown>;
            expect(`${second.offerKind}:${String(second.offerId).slice(testId.length + 1)}`).toBe(
                'rury:o1'
            );
            await db.close();
        } catch (e) {
            try {
                await db.close();
            } catch {
                /* ignore */
            }
            throw e;
        }
    });
});
