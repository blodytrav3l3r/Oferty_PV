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
    snoozedUntil: string | null;
    doneAt: string | null;
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
            l."nextContactAt" AS "next", l."contactedAt" AS "last",
            cs."snoozedUntil" AS "snoozed", cs."doneAt" AS "done"
        FROM offers_rel o LEFT JOIN latest l
            ON l."offerKind" = 'rury' AND l."offerId" = o."id" AND l."rn" = 1
        LEFT JOIN care_states cs
            ON cs."offerKind" = 'rury' AND cs."offerId" = o."id"
        WHERE ${scopeRury}
        UNION ALL
        SELECT 'studnie' AS "offerKind", s."id" AS "offerId", l."outcome" AS "outcome",
            l."nextContactAt" AS "next", l."contactedAt" AS "last",
            cs."snoozedUntil" AS "snoozed", cs."doneAt" AS "done"
        FROM offers_studnie_rel s LEFT JOIN latest l
            ON l."offerKind" = 'studnie' AND l."offerId" = s."id" AND l."rn" = 1
        LEFT JOIN care_states cs
            ON cs."offerKind" = 'studnie' AND cs."offerId" = s."id"
        WHERE ${scopeStudnie}
    ), ranked AS (
        SELECT "offerKind", "offerId", "outcome", "next", "last", "snoozed", "done",
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
        SELECT "offerKind", "offerId", "outcome", "next", "last", "snoozed", "done", "bucketWeight" FROM ranked
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
                snoozed: string | null;
                done: string | null;
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
            bucketWeight: num(r.bucketWeight),
            snoozedUntil: r.snoozed,
            doneAt: r.done
        })),
        nextCursor,
        totalCount
    };
}

// ─── P1: stan pilnowania (snooze/done) + konfiguracja SLA ─────────────
// Stan bieżący w care_states, osobno od historii append-only.
// Raw SQL (nie prisma.care_states) — działa bez regen klienta/restartu.
// Snooze i done rozłączne: ustawienie jednego czyści drugie.

export type CareKind = 'rury' | 'studnie';

export interface CareState {
    offerKind: string;
    offerId: string;
    snoozedUntil: string | null;
    doneAt: string | null;
    updatedBy: string | null;
    updatedAt: string;
}

export interface SlaConfig {
    firstContactH: number;
    staleD: number;
    escalationH: number;
}

export const DEFAULT_SLA: SlaConfig = { firstContactH: 24, staleD: 7, escalationH: 72 };
export const MAX_SNOOZE_DAYS = 14;

type RawDb = QueryRawDb;

export async function getCareState(
    db: RawDb,
    offerKind: CareKind,
    offerId: string
): Promise<CareState | null> {
    const rows = await db.$queryRaw<CareState[]>(
        Prisma.sql`SELECT "offerKind", "offerId", "snoozedUntil", "doneAt", "updatedBy", "updatedAt" FROM "care_states" WHERE "offerKind" = ${offerKind} AND "offerId" = ${offerId}`
    );
    return rows[0] ?? null;
}

/** Upsert stanu: dokładnie jedno z snoozedUntil/doneAt (drugie NULL). */
export async function setCareState(
    db: RawDb,
    args: {
        offerKind: CareKind;
        offerId: string;
        snoozedUntil: string | null;
        doneAt: string | null;
        updatedBy: string;
        nowIso: string;
    }
): Promise<CareState> {
    const state: CareState = {
        offerKind: args.offerKind,
        offerId: args.offerId,
        snoozedUntil: args.snoozedUntil,
        doneAt: args.doneAt,
        updatedBy: args.updatedBy,
        updatedAt: args.nowIso
    };
    await db.$queryRaw(
        Prisma.sql`INSERT INTO "care_states" ("offerKind", "offerId", "snoozedUntil", "doneAt", "updatedBy", "updatedAt") VALUES (${state.offerKind}, ${state.offerId}, ${state.snoozedUntil}, ${state.doneAt}, ${state.updatedBy}, ${state.updatedAt}) ON CONFLICT ("offerKind", "offerId") DO UPDATE SET "snoozedUntil" = ${state.snoozedUntil}, "doneAt" = ${state.doneAt}, "updatedBy" = ${state.updatedBy}, "updatedAt" = ${state.updatedAt}`
    );
    return state;
}

export async function clearCareState(
    db: RawDb,
    offerKind: CareKind,
    offerId: string
): Promise<void> {
    await db.$queryRaw(
        Prisma.sql`DELETE FROM "care_states" WHERE "offerKind" = ${offerKind} AND "offerId" = ${offerId}`
    );
}

export async function getSlaConfig(db: RawDb): Promise<SlaConfig> {
    const rows = await db.$queryRaw<Array<SlaConfig>>(
        Prisma.sql`SELECT "firstContactH", "staleD", "escalationH" FROM "care_sla_config" WHERE "id" = 'global'`
    );
    const r = rows[0];
    if (!r) return { ...DEFAULT_SLA };
    return {
        firstContactH: Number(r.firstContactH) || DEFAULT_SLA.firstContactH,
        staleD: Number(r.staleD) || DEFAULT_SLA.staleD,
        escalationH: Number(r.escalationH) || DEFAULT_SLA.escalationH
    };
}

export async function setSlaConfig(
    db: RawDb,
    cfg: SlaConfig & { updatedBy: string; nowIso: string }
): Promise<SlaConfig> {
    await db.$queryRaw(
        Prisma.sql`INSERT INTO "care_sla_config" ("id", "firstContactH", "staleD", "escalationH", "updatedBy", "updatedAt") VALUES ('global', ${cfg.firstContactH}, ${cfg.staleD}, ${cfg.escalationH}, ${cfg.updatedBy}, ${cfg.nowIso}) ON CONFLICT ("id") DO UPDATE SET "firstContactH" = ${cfg.firstContactH}, "staleD" = ${cfg.staleD}, "escalationH" = ${cfg.escalationH}, "updatedBy" = ${cfg.updatedBy}, "updatedAt" = ${cfg.nowIso}`
    );
    return {
        firstContactH: cfg.firstContactH,
        staleD: cfg.staleD,
        escalationH: cfg.escalationH
    };
}

// ─── P2: centrum powiadomień (pochodna stanu, sync przy odczycie) ─────
// Typy: CALLBACK_DUE (termin dziś/przyszłość 24 h, OPEN), SLA_BREACH
// (zaległość ≥ staleD lub NO_CONTACT starszy niż firstContactH),
// ESCALATION (zaległość godzinowa ≥ escalationH). Pauza (snooze/done)
// i terminale nie generują. Sync = INSERT brakujących + auto-read
// nieaktualnych (terminal/done/pauza), wszystko w SQL bez N+1.

export type CareNotifType = 'CALLBACK_DUE' | 'SLA_BREACH' | 'ESCALATION';

export interface CareNotification {
    id: string;
    userId: string;
    offerKind: string;
    offerId: string;
    type: string;
    readAt: string | null;
    createdAt: string;
}

function notifBase(user: CareUser, scope: CareScope): { rury: Prisma.Sql; studnie: Prisma.Sql } {
    const ownerWhere = resolveOwnerWhere(user, scope);
    return {
        rury: ownerCond(user, 'o', 'offer', ownerWhere),
        studnie: ownerCond(user, 's', 'offer_studnie', ownerWhere)
    };
}

/** Kandydaci do powiadomień dla usera: widoczne oferty z typem naruszenia. */
function notifCandidates(
    user: CareUser,
    scope: CareScope,
    nowIso: string,
    sla: SlaConfig
): Prisma.Sql {
    const { rury, studnie } = notifBase(user, scope);
    const fuScope = followUpScope(rury, studnie);
    const dayAhead = new Date(Date.parse(nowIso) + 86400000).toISOString();
    const staleCut = new Date(Date.parse(nowIso) - sla.staleD * 86400000).toISOString();
    const escCut = new Date(Date.parse(nowIso) - sla.escalationH * 3600000).toISOString();
    const fcCut = new Date(Date.parse(nowIso) - sla.firstContactH * 3600000).toISOString();
    return Prisma.sql`WITH latest AS (
        SELECT f."offerKind", f."offerId", f."outcome", f."nextContactAt", f."contactedAt",
            ROW_NUMBER() OVER (PARTITION BY f."offerKind", f."offerId" ORDER BY f."contactedAt" DESC, f."createdAt" DESC, f."id" DESC) AS "rn"
        FROM offer_follow_ups f WHERE ${fuScope}
    ), base AS (
        SELECT 'rury' AS "offerKind", o."id" AS "offerId", o."userId" AS "ownerId",
            l."outcome" AS "outcome", l."nextContactAt" AS "next", o."createdAt" AS "born"
        FROM offers_rel o LEFT JOIN latest l
            ON l."offerKind" = 'rury' AND l."offerId" = o."id" AND l."rn" = 1
        LEFT JOIN care_states cs ON cs."offerKind" = 'rury' AND cs."offerId" = o."id"
        WHERE ${rury} AND cs."offerId" IS NULL
        UNION ALL
        SELECT 'studnie' AS "offerKind", s."id" AS "offerId", s."userId" AS "ownerId",
            l."outcome" AS "outcome", l."nextContactAt" AS "next", s."createdAt" AS "born"
        FROM offers_studnie_rel s LEFT JOIN latest l
            ON l."offerKind" = 'studnie' AND l."offerId" = s."id" AND l."rn" = 1
        LEFT JOIN care_states cs ON cs."offerKind" = 'studnie' AND cs."offerId" = s."id"
        WHERE ${studnie} AND cs."offerId" IS NULL
    )
    SELECT "offerKind", "offerId", "ownerId",
        CASE
            WHEN ("outcome" IS NULL AND "born" <= ${fcCut}) OR ("outcome" = 'OPEN' AND "next" IS NOT NULL AND "next" <= ${staleCut}) THEN 'SLA_BREACH'
            WHEN "outcome" = 'OPEN' AND "next" IS NOT NULL AND "next" <= ${escCut} THEN 'ESCALATION'
            WHEN "outcome" = 'OPEN' AND "next" IS NOT NULL AND "next" <= ${dayAhead} THEN 'CALLBACK_DUE'
            WHEN "outcome" IS NULL THEN 'CALLBACK_DUE'
            ELSE NULL
        END AS "ntype"
    FROM base`;
}

export interface CareSyncResult {
    inserted: number;
    resolved: number;
}

/** Sync skrzynki usera: wstaw brakujące + zamknij nieaktualne. Idempotentny. */
export async function syncCareNotifications(
    db: RawDb,
    user: CareUser,
    scope: CareScope,
    nowIso: string,
    sla: SlaConfig
): Promise<CareSyncResult> {
    const uid = user.id;
    const cand = notifCandidates(user, scope, nowIso, sla);
    const candSel = Prisma.sql`SELECT * FROM (${cand}) WHERE "ntype" IS NOT NULL`;
    const toInsert = (await db.$queryRaw<
        Array<{ offerKind: string; offerId: string; ownerId: string; ntype: string | null }>
    >(candSel)) as Array<{
        offerKind: string;
        offerId: string;
        ntype: string | null;
    }>;
    let inserted = 0;
    for (const c of toInsert) {
        if (!c.ntype) continue;
        const dup = (await db.$queryRaw<Array<{ c: number }>>(
            Prisma.sql`SELECT COUNT(*) AS "c" FROM "care_notifications" WHERE "userId" = ${uid} AND "offerKind" = ${c.offerKind} AND "offerId" = ${c.offerId} AND "type" = ${c.ntype} AND "readAt" IS NULL`
        )) as Array<{ c: number | bigint }>;
        if (num(dup[0]?.c) > 0) continue;
        const { randomUUID } = await import('node:crypto');
        await db.$queryRaw(
            Prisma.sql`INSERT INTO "care_notifications" ("id", "userId", "offerKind", "offerId", "type", "readAt", "createdAt") VALUES (${randomUUID()}, ${uid}, ${c.offerKind}, ${c.offerId}, ${c.ntype}, NULL, ${nowIso})`
        );
        inserted += 1;
    }
    // Auto-read: oferta zniknęła z kandydatów (terminal/pauza/poza scope).
    const liveSel = Prisma.sql`SELECT "offerKind", "offerId" FROM (${cand}) WHERE "ntype" IS NOT NULL`;
    const stillDue = (await db.$queryRaw<Array<{ offerKind: string; offerId: string }>>(
        liveSel
    )) as Array<{ offerKind: string; offerId: string }>;
    const open = await db.$queryRaw<Array<CareNotification>>(
        Prisma.sql`SELECT "id", "userId", "offerKind", "offerId", "type", "readAt", "createdAt" FROM "care_notifications" WHERE "userId" = ${uid} AND "readAt" IS NULL`
    );
    const live = new Set(stillDue.map((r) => `${r.offerKind}:${r.offerId}`));
    let resolved = 0;
    for (const n of open) {
        if (!live.has(`${n.offerKind}:${n.offerId}`)) {
            await db.$queryRaw(
                Prisma.sql`UPDATE "care_notifications" SET "readAt" = ${nowIso} WHERE "id" = ${n.id} AND "userId" = ${uid} AND "readAt" IS NULL`
            );
            resolved += 1;
        }
    }
    return { inserted, resolved };
}

export async function listCareNotifications(
    db: RawDb,
    userId: string,
    opts: { unreadOnly?: boolean; limit?: unknown }
): Promise<{ items: CareNotification[]; unreadCount: number }> {
    const limit = clampCareLimit(opts.limit);
    const items = (await db.$queryRaw<CareNotification[]>(
        opts.unreadOnly
            ? Prisma.sql`SELECT "id", "userId", "offerKind", "offerId", "type", "readAt", "createdAt" FROM "care_notifications" WHERE "userId" = ${userId} AND "readAt" IS NULL ORDER BY "createdAt" DESC LIMIT ${limit}`
            : Prisma.sql`SELECT "id", "userId", "offerKind", "offerId", "type", "readAt", "createdAt" FROM "care_notifications" WHERE "userId" = ${userId} ORDER BY "createdAt" DESC LIMIT ${limit}`
    )) as CareNotification[];
    const cnt = (await db.$queryRaw<Array<{ c: number | bigint }>>(
        Prisma.sql`SELECT COUNT(*) AS "c" FROM "care_notifications" WHERE "userId" = ${userId} AND "readAt" IS NULL`
    )) as Array<{ c: number | bigint }>;
    return { items, unreadCount: num(cnt[0]?.c) };
}

/** Odczyt własnego powiadomienia (guard owner w WHERE). Zwraca liczbę. */
export async function markCareNotificationRead(
    db: RawDb,
    userId: string,
    notifId: string,
    nowIso: string
): Promise<number> {
    const rows = (await db.$queryRaw<Array<{ c: number | bigint }>>(
        Prisma.sql`UPDATE "care_notifications" SET "readAt" = ${nowIso} WHERE "id" = ${notifId} AND "userId" = ${userId} AND "readAt" IS NULL RETURNING 1 AS "c"`
    )) as Array<{ c: number | bigint }>;
    return rows.length;
}
