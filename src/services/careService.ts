/**
 * careService — P0.2 SQL kolejki opieki (read-only, zero migracji, zero POST).
 *
 * Jeden CTE `latest` (ROW_NUMBER PARTITION BY offerKind,offerId — ta sama
 * reguła co followUpStats.ts:52 i searchUtils.ts:241, pliki nietknięte),
 * scope mine/team/all w SQL PRZED agregacją via EXISTS (reguła przynależności
 * z buildRoleWhereClause, bez mnożenia wierszy JOINem), dedup kluczem
 * (offerKind,offerId), deterministyczna paginacja cursorem (nie OFFSET).
 * getCareQueue wykonuje max 2 SELECT (data + COUNT DISTINCT).
 */
import { Prisma } from '../../generated/prisma';
import type { User } from '../helpers';
import { buildRoleWhereClause } from '../utils/roleFilter';
import { toNum } from '../utils/searchUtils';

export type CareScope = 'mine' | 'team' | 'all';

export const CARE_DEFAULT_LIMIT = 50;
export const CARE_MAX_LIMIT = 100;

/** Sentinel dla braku terminu — sortuje ostatnie (ISO-UTC zawsze < '9999'). */
const NULL_NEXT = '9999';

export type CareUser = Pick<User, 'id' | 'role' | 'subUsers'>;

export interface CareQueueItem {
    offerKind: string;
    offerId: string;
    outcome: string | null;
    nextContactAt: string | null;
    lastContactAt: string | null;
    bucketWeight: number;
}

export interface CareQueueResult {
    items: CareQueueItem[];
    nextCursor: string | null;
    totalCount: number;
}

export interface CareQueueOptions {
    scope?: CareScope;
    /** ISO-8601 UTC "teraz" — parametr, nie NOW() w SQL (stabilne w requeście). */
    nowIso: string;
    cursor?: string | null;
    limit?: unknown;
}

interface CareCursor {
    w: number;
    n: string | null;
    k: string;
    i: string;
}

export function encodeCareCursor(c: CareCursor): string {
    return Buffer.from(JSON.stringify([c.w, c.n, c.k, c.i]), 'utf8').toString('base64url');
}

export function decodeCareCursor(raw: string): CareCursor | null {
    try {
        const a = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as unknown[];
        if (!Array.isArray(a) || a.length !== 4) return null;
        const [w, n, k, i] = a;
        if (typeof w !== 'number') return null;
        if (typeof n !== 'string' && n !== null) return null;
        if (typeof k !== 'string' || typeof i !== 'string') return null;
        return { w, n, k, i };
    } catch {
        return null;
    }
}

export function clampCareLimit(v: unknown): number {
    const n = typeof v === 'string' ? Number(v) : typeof v === 'number' ? v : NaN;
    if (!Number.isFinite(n)) return CARE_DEFAULT_LIMIT;
    return Math.min(CARE_MAX_LIMIT, Math.max(1, Math.floor(n)));
}

function forbidden(msg: string): Error {
    const e = new Error(msg) as Error & { status: number };
    e.status = 403;
    return e;
}

/**
 * Przynależność ofert via buildRoleWhereClause (SSoT reguły ról).
 * mine = tylko własne; team = własne + subUsers (pro/admin, inaczej 403);
 * all = wszystko, tylko admin (inaczej 403, nie silent downgrade).
 */
function resolveOwnerWhere(user: CareUser, scope: CareScope): Record<string, unknown> | undefined {
    if (scope === 'all') {
        if (user.role !== 'admin') throw forbidden('scope=all tylko dla admin');
        return undefined;
    }
    if (scope === 'team') {
        if (user.role !== 'pro' && user.role !== 'admin')
            throw forbidden('scope=team tylko dla pro/admin');
        return buildRoleWhereClause({
            id: user.id,
            role: 'pro',
            subUsers: user.subUsers
        } as unknown as User);
    }
    return buildRoleWhereClause({ id: user.id, role: 'user', subUsers: [] } as unknown as User);
}

/** Tłumaczy where z buildRoleWhereClause na warunek SQL dla aliasu tabeli ofert.
 * Zawiera shares via EXISTS (jak buildRoleWhereConditionWithShares) — nie JOIN. */
function ownerCond(
    user: CareUser,
    alias: 'o' | 's',
    docType: 'offer' | 'offer_studnie',
    where: Record<string, unknown> | undefined
): Prisma.Sql {
    const col = Prisma.raw(`"${alias}"."userId"`);
    const idCol = Prisma.raw(`"${alias}"."id"`);
    const shareCond = Prisma.sql`EXISTS (SELECT 1 FROM "document_shares" ds WHERE ds."sharedWithUserId" = ${user.id} AND ds."documentType" = ${docType} AND ds."documentId" = ${idCol})`;
    if (!where) return Prisma.sql`1=1`;
    const uid = (where as { userId?: unknown }).userId;
    if (typeof uid === 'string') return Prisma.sql`(${col} = ${uid} OR ${shareCond})`;
    if (uid !== null && typeof uid === 'object' && Array.isArray((uid as { in?: unknown }).in)) {
        const ids = ((uid as { in: unknown[] }).in as unknown[]).filter(
            (v): v is string => typeof v === 'string' && v !== ''
        );
        if (ids.length === 0) return Prisma.sql`${shareCond}`;
        return Prisma.sql`(${col} IN (${Prisma.join(ids)}) OR ${shareCond})`;
    }
    return Prisma.sql`${shareCond}`;
}

/** Scope follow-upów via EXISTS (nie JOIN — nie mnoży wierszy). */
function followUpScope(scopeRury: Prisma.Sql, scopeStudnie: Prisma.Sql): Prisma.Sql {
    return Prisma.sql`((f."offerKind" = 'rury' AND EXISTS (SELECT 1 FROM offers_rel o WHERE o."id" = f."offerId" AND ${scopeRury})) OR (f."offerKind" = 'studnie' AND EXISTS (SELECT 1 FROM offers_studnie_rel s WHERE s."id" = f."offerId" AND ${scopeStudnie})))`;
}

const BUCKET_CASE = (nowIso: string): Prisma.Sql =>
    Prisma.sql`CASE WHEN "outcome" IS NULL OR ("outcome" = 'OPEN' AND ("next" IS NULL OR "next" <= ${nowIso})) THEN 0 WHEN "outcome" = 'OPEN' THEN 1 ELSE 2 END`;

export function buildCareQueueQueries(
    user: CareUser,
    opts: CareQueueOptions
): { data: Prisma.Sql; count: Prisma.Sql } {
    const scope = opts.scope ?? 'mine';
    const ownerWhere = resolveOwnerWhere(user, scope);
    const scopeRury = ownerCond(user, 'o', 'offer', ownerWhere);
    const scopeStudnie = ownerCond(user, 's', 'offer_studnie', ownerWhere);
    const fuScope = followUpScope(scopeRury, scopeStudnie);
    const limit = clampCareLimit(opts.limit);

    // CTE latest: ta sama reguła co followUpStats.ts:52 / searchUtils.ts:241.
    const withSql = Prisma.sql`WITH latest AS (
        SELECT f."offerKind", f."offerId", f."outcome", f."nextContactAt", f."contactedAt",
            ROW_NUMBER() OVER (PARTITION BY f."offerKind", f."offerId" ORDER BY f."contactedAt" DESC, f."createdAt" DESC, f."id" DESC) AS "rn"
        FROM offer_follow_ups f WHERE ${fuScope}
    ), base AS (
        SELECT 'rury' AS "offerKind", o."id" AS "offerId", l."outcome" AS "outcome",
            l."nextContactAt" AS "next", l."contactedAt" AS "last"
        FROM offers_rel o LEFT JOIN latest l
            ON l."offerKind" = 'rury' AND l."offerId" = o."id" AND l."rn" = 1
        WHERE ${scopeRury}
        UNION ALL
        SELECT 'studnie' AS "offerKind", s."id" AS "offerId", l."outcome" AS "outcome",
            l."nextContactAt" AS "next", l."contactedAt" AS "last"
        FROM offers_studnie_rel s LEFT JOIN latest l
            ON l."offerKind" = 'studnie' AND l."offerId" = s."id" AND l."rn" = 1
        WHERE ${scopeStudnie}
    ), ranked AS (
        SELECT "offerKind", "offerId", "outcome", "next", "last",
            ${BUCKET_CASE(opts.nowIso)} AS "bucketWeight"
        FROM base
    )`;

    let cursorSql: Prisma.Sql = Prisma.sql`1=1`;
    const cursor =
        typeof opts.cursor === 'string' && opts.cursor !== ''
            ? decodeCareCursor(opts.cursor)
            : null;
    if (cursor) {
        const cn = cursor.n ?? NULL_NEXT;
        cursorSql = Prisma.sql`(("bucketWeight" > ${cursor.w}) OR ("bucketWeight" = ${cursor.w} AND ((COALESCE("next", ${NULL_NEXT}) > ${cn}) OR (COALESCE("next", ${NULL_NEXT}) = ${cn} AND (("offerKind" > ${cursor.k}) OR ("offerKind" = ${cursor.k} AND "offerId" > ${cursor.i}))))))`;
    }

    const data = Prisma.sql`${withSql}
        SELECT "offerKind", "offerId", "outcome", "next", "last", "bucketWeight" FROM ranked
        WHERE ${cursorSql}
        ORDER BY "bucketWeight" ASC, COALESCE("next", ${NULL_NEXT}) ASC, "offerKind" ASC, "offerId" ASC
        LIMIT ${limit + 1}`;
    const count = Prisma.sql`${withSql}
        SELECT COUNT(DISTINCT "offerKind" || ':' || "offerId") AS "c" FROM ranked`;
    return { data, count };
}

/** Podsumowanie opieki: 1 SELECT GROUP BY (ten sam WHERE co kolejka). */
export interface CareSummary {
    noContact: number;
    due: number;
    openOk: number;
    won: number;
    lost: number;
    totalCount: number;
}

export async function getCareSummary(
    db: QueryRawDb,
    user: CareUser,
    scope: CareScope,
    nowIso: string
): Promise<CareSummary> {
    const ownerWhere = resolveOwnerWhere(user, scope);
    const scopeRury = ownerCond(user, 'o', 'offer', ownerWhere);
    const scopeStudnie = ownerCond(user, 's', 'offer_studnie', ownerWhere);
    const fuScope = followUpScope(scopeRury, scopeStudnie);
    const withSql = Prisma.sql`WITH latest AS (
        SELECT f."offerKind", f."offerId", f."outcome", f."nextContactAt", f."contactedAt",
            ROW_NUMBER() OVER (PARTITION BY f."offerKind", f."offerId" ORDER BY f."contactedAt" DESC, f."createdAt" DESC, f."id" DESC) AS "rn"
        FROM offer_follow_ups f WHERE ${fuScope}
    ), base AS (
        SELECT 'rury' AS "offerKind", o."id" AS "offerId", l."outcome" AS "outcome",
            l."nextContactAt" AS "next", l."contactedAt" AS "last"
        FROM offers_rel o LEFT JOIN latest l
            ON l."offerKind" = 'rury' AND l."offerId" = o."id" AND l."rn" = 1
        WHERE ${scopeRury}
        UNION ALL
        SELECT 'studnie' AS "offerKind", s."id" AS "offerId", l."outcome" AS "outcome",
            l."nextContactAt" AS "next", l."contactedAt" AS "last"
        FROM offers_studnie_rel s LEFT JOIN latest l
            ON l."offerKind" = 'studnie' AND l."offerId" = s."id" AND l."rn" = 1
        WHERE ${scopeStudnie}
    )`;
    const rows = await db.$queryRaw<
        Array<{ k: string; c: number | bigint }>
    >`${withSql} SELECT CASE WHEN "outcome" IS NULL THEN 'noContact' WHEN "outcome" = 'WON' THEN 'won' WHEN "outcome" IN ('LOST_COMPETITION','LOST_OTHER') THEN 'lost' WHEN "outcome" = 'ABANDONED' THEN 'lost' WHEN "outcome" = 'OPEN' AND ("next" IS NULL OR "next" <= ${nowIso}) THEN 'due' ELSE 'openOk' END AS "k", COUNT(*) AS "c" FROM base GROUP BY "k"`;
    const m = new Map(rows.map((r) => [r.k, num(r.c)]));
    const noContact = m.get('noContact') ?? 0;
    const due = m.get('due') ?? 0;
    const openOk = m.get('openOk') ?? 0;
    const won = m.get('won') ?? 0;
    const lost = m.get('lost') ?? 0;
    return { noContact, due, openOk, won, lost, totalCount: noContact + due + openOk + won + lost };
}

export interface QueryRawDb {
    // biome-ignore lint/suspicious/noExplicitAny: minimal $queryRaw structural (Sql | template tag)
    $queryRaw: <T>(...args: any[]) => Promise<T>;
}

const num = (v: unknown): number => toNum(v as number | bigint | string | null | undefined) ?? 0;

/** Kolejka opieki: max 2 SELECT (data + COUNT DISTINCT). Scope 403 rzuca przed SQL. */
export async function getCareQueue(
    db: QueryRawDb,
    user: CareUser,
    opts: CareQueueOptions
): Promise<CareQueueResult> {
    const { data, count } = buildCareQueueQueries(user, opts);
    const limit = clampCareLimit(opts.limit);
    const [dataRows, countRows] = await Promise.all([
        db.$queryRaw<
            Array<{
                offerKind: string;
                offerId: string;
                outcome: string | null;
                next: string | null;
                last: string | null;
                bucketWeight: number | bigint;
            }>
        >(data),
        db.$queryRaw<Array<{ c: number | bigint }>>(count)
    ]);
    const totalCount = num(countRows[0]?.c);
    let nextCursor: string | null = null;
    let items = dataRows;
    if (items.length > limit) {
        items = items.slice(0, limit);
        const lastItem = items[items.length - 1];
        nextCursor = encodeCareCursor({
            w: num(lastItem.bucketWeight),
            n: lastItem.next,
            k: lastItem.offerKind,
            i: lastItem.offerId
        });
    }
    return {
        items: items.map((r) => ({
            offerKind: r.offerKind,
            offerId: r.offerId,
            outcome: r.outcome,
            nextContactAt: r.next,
            lastContactAt: r.last,
            bucketWeight: num(r.bucketWeight)
        })),
        nextCursor,
        totalCount
    };
}
