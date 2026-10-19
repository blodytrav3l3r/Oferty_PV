/**
 * careService — P0.2 SQL kolejki opieki (read-only, zero POST) + P1
 * materializacja latest (tabela latest_followup, triggery trg_fu_latest_*).
 *
 * Latest z tabeli (ta sama reguła co CTE ROW_NUMBER: contactedAt DESC,
 * createdAt DESC, id DESC — parzystość: careLatestParity.test.ts);
 * followUpStats.ts i searchUtils.ts liczą latest po staremu (osobny kontrakt).
 * Scope mine/team/all w SQL PRZED agregacją via EXISTS (reguła przynależności
 * z buildRoleWhereClause, bez mnożenia wierszy JOINem), dedup kluczem
 * (offerKind,offerId), deterministyczna paginacja cursorem (nie OFFSET).
 * getCareQueue wykonuje max 2 SELECT (data + COUNT).
 */
import { Prisma } from '../../generated/prisma';
import type { User } from '../helpers';
import { buildRoleWhereClause } from '../utils/roleFilter';
import { getFollowUpState, isEscalated } from '../utils/careStatus';
import { toNum, normalizedCreatedAtSql } from '../utils/searchUtils';
import { logger } from '../utils/logger';

export type CareScope = 'mine' | 'team' | 'all';

export const CARE_DEFAULT_LIMIT = 50;
export const CARE_MAX_LIMIT = 100;

/** Cap licznika nieprzeczytanych (R2A): badge ma już `99+`, a pełny COUNT
 * na dużej skrzynce to full scan za każdym pollingiem. Licznik capped na
 * CAP+1 (101 rozróżnia 100 od "więcej"), semantyka reszty bez zmian. */
export const CARE_UNREAD_CAP = 100;

/** Sentinel dla braku terminu — sortuje ostatnie (ISO-UTC zawsze < '9999'). */
const NULL_NEXT = '9999';

export type CareUser = Pick<User, 'id' | 'role' | 'subUsers'>;

export interface CareQueueItem {
    offerKind: string;
    offerId: string;
    outcome: string | null;
    nextContactAt: string | null;
    lastContactAt: string | null;
    createdAt: string | null;
    number: string | null;
    clientName: string | null;
    clientNumber: string | null;
    ownerName: string | null;
    authorName: string | null;
    value: number | null;
    phone: string | null;
    investName: string | null;
    investAddress: string | null;
    contactPerson: string | null;
    email: string | null;
    lastNote: string | null;
    bucketWeight: number;
    snoozedUntil: string | null;
    doneAt: string | null;
    /** updatedAt wiersza care_states (null = brak stanu) — opt-lock zapisów. */
    careUpdatedAt: string | null;
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
    /** P2-fix: filtr w SQL (przed paginacją), nie po — strona pełna, count zgodny. */
    hidePaused?: boolean;
    /** Zakres po dacie utworzenia oferty (ISO-8601, walidowane w route). */
    from?: string;
    to?: string;
    /** Zawężenie do 1 handlowca (repId po resolveRepOwner, AND wewnątrz scope). */
    repOwner?: string | null;
}

/** Zakres born (o./s.createdAt) doklejany AND do scope WHERE — nigdy go nie luzuje. */
function bornRange(alias: 'o' | 's', from?: string, to?: string): Prisma.Sql | null {
    if (!from && !to) return null;
    const norm = normalizedCreatedAtSql(`${alias}."createdAt"`);
    const parts: Prisma.Sql[] = [];
    if (from) parts.push(Prisma.sql`${norm} >= ${from}`);
    if (to) parts.push(Prisma.sql`${norm} <= ${to}`);
    return parts.length === 2 ? Prisma.sql`(${parts[0]} AND ${parts[1]})` : parts[0];
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

function invalidCursor(msg: string): Error {
    const e = new Error(msg) as Error & { status: number; code: string };
    e.status = 400;
    e.code = 'INVALID_CURSOR';
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

/**
 * Walidacja wyboru handlowca (kafelki REP). Zwraca efektywne owner-id albo
 * null (brak zawężenia). Fail-closed 403 — nigdy silent downgrade:
 * user tylko siebie, pro siebie + subUsers, admin każdego.
 */
export function resolveRepOwner(user: CareUser, repId: string | undefined | null): string | null {
    if (!repId) return null;
    if (repId === user.id) return user.id;
    if (user.role === 'admin') return repId;
    if (user.role === 'pro' && (user.subUsers || []).includes(repId)) return repId;
    throw forbidden('repId spoza dozwolonego zakresu');
}

/** Tłumaczy where z buildRoleWhereClause na warunek SQL dla aliasu tabeli ofert.
 * Zawiera shares via EXISTS (jak buildRoleWhereConditionWithShares) — nie JOIN.
 * narrowOwner (repId po walidacji resolveRepOwner) dokłada AND na właściciela
 * wewnątrz scope — nigdy zamiast scope (brak poszerzania uprawnień). */
function ownerCond(
    user: CareUser,
    alias: 'o' | 's',
    docType: 'offer' | 'offer_studnie',
    where: Record<string, unknown> | undefined,
    narrowOwner?: string | null
): Prisma.Sql {
    const col = Prisma.raw(`"${alias}"."userId"`);
    const idCol = Prisma.raw(`"${alias}"."id"`);
    const shareCond = Prisma.sql`EXISTS (SELECT 1 FROM "document_shares" ds WHERE ds."sharedWithUserId" = ${user.id} AND ds."documentType" = ${docType} AND ds."documentId" = ${idCol})`;
    if (!where) {
        // scope=all (tylko admin): repId zawęża do ofert handlowca, nigdy 1=1.
        if (narrowOwner) return Prisma.sql`${col} = ${narrowOwner}`;
        return Prisma.sql`1=1`;
    }
    const uid = (where as { userId?: unknown }).userId;
    if (typeof uid === 'string')
        return narrowOwner
            ? Prisma.sql`(${col} = ${uid} OR ${shareCond}) AND ${col} = ${narrowOwner}`
            : Prisma.sql`(${col} = ${uid} OR ${shareCond})`;
    if (uid !== null && typeof uid === 'object' && Array.isArray((uid as { in?: unknown }).in)) {
        const ids = ((uid as { in: unknown[] }).in as unknown[]).filter(
            (v): v is string => typeof v === 'string' && v !== ''
        );
        if (ids.length === 0) return Prisma.sql`${shareCond}`;
        return narrowOwner
            ? Prisma.sql`(${col} IN (${Prisma.join(ids)}) OR ${shareCond}) AND ${col} = ${narrowOwner}`
            : Prisma.sql`(${col} IN (${Prisma.join(ids)}) OR ${shareCond})`;
    }
    if (narrowOwner) return Prisma.sql`(${shareCond}) AND ${col} = ${narrowOwner}`;
    return Prisma.sql`${shareCond}`;
}

const BUCKET_CASE = (nowIso: string): Prisma.Sql =>
    Prisma.sql`CASE WHEN "outcome" IS NULL OR ("outcome" = 'OPEN' AND ("next" IS NULL OR "next" <= ${nowIso})) THEN 0 WHEN "outcome" = 'OPEN' THEN 1 ELSE 2 END`;

export function buildCareQueueQueries(
    user: CareUser,
    opts: CareQueueOptions
): { data: Prisma.Sql; count: Prisma.Sql } {
    const scope = opts.scope ?? 'mine';
    const ownerWhere = resolveOwnerWhere(user, scope);
    const scopeRury = ownerCond(user, 'o', 'offer', ownerWhere, opts.repOwner);
    const scopeStudnie = ownerCond(user, 's', 'offer_studnie', ownerWhere, opts.repOwner);
    const limit = clampCareLimit(opts.limit);
    const bornRury = bornRange('o', opts.from, opts.to);
    const bornStudnie = bornRange('s', opts.from, opts.to);
    const andBornRury = bornRury ? Prisma.sql` AND ${bornRury}` : Prisma.empty;
    const andBornStudnie = bornStudnie ? Prisma.sql` AND ${bornStudnie}` : Prisma.empty;

    // P1: latest z tabeli latest_followup (triggery trg_fu_latest_*),
    // nie CTE ROW_NUMBER — ta sama reguła (contactedAt DESC, createdAt DESC,
    // id DESC), parzystość pilnuje tests/offers/careLatestParity.test.ts.
    // followUpStats.ts i searchUtils.ts liczą latest po staremu (osobny kontrakt).
    // P2.2: baza niesie tylko skalary sortowania/filtra; drogie kolumny
    // (json_extract, users, note) dokłada faza 2 dla ≤51 wierszy strony
    // (buildCareEnrichQuery niżej) — ta sama treść, inny moment.
    const withSql = Prisma.sql`WITH base AS (
        SELECT 'rury' AS "offerKind", o."id" AS "offerId", lf."outcome" AS "outcome",
            lf."nextContactAt" AS "next", lf."contactedAt" AS "last", o."createdAt" AS "born",
            cs."snoozedUntil" AS "snoozed", cs."doneAt" AS "done",
            cs."updatedAt" AS "careUpdatedAt"
        FROM offers_rel o LEFT JOIN latest_followup lf
            ON lf."offerKind" = 'rury' AND lf."offerId" = o."id"
        LEFT JOIN care_states cs
            ON cs."offerKind" = 'rury' AND cs."offerId" = o."id"
        WHERE ${scopeRury}${andBornRury}
        UNION ALL
        SELECT 'studnie' AS "offerKind", s."id" AS "offerId", lf."outcome" AS "outcome",
            lf."nextContactAt" AS "next", lf."contactedAt" AS "last", s."createdAt" AS "born",
            cs."snoozedUntil" AS "snoozed", cs."doneAt" AS "done",
            cs."updatedAt" AS "careUpdatedAt"
        FROM offers_studnie_rel s LEFT JOIN latest_followup lf
            ON lf."offerKind" = 'studnie' AND lf."offerId" = s."id"
        LEFT JOIN care_states cs
            ON cs."offerKind" = 'studnie' AND cs."offerId" = s."id"
        WHERE ${scopeStudnie}${andBornStudnie}
    ), ranked AS (
        SELECT "offerKind", "offerId", "outcome", "next", "last", "born",
            "snoozed", "done", "careUpdatedAt",
            ${BUCKET_CASE(opts.nowIso)} AS "bucketWeight"
        FROM base
    )`;

    let cursorSql: Prisma.Sql = Prisma.sql`1=1`;
    const rawCursor = typeof opts.cursor === 'string' ? opts.cursor : null;
    let cursor: CareCursor | null = null;
    if (rawCursor !== null && rawCursor !== '') {
        const decoded = decodeCareCursor(rawCursor);
        if (!decoded) throw invalidCursor('Nieprawidłowy cursor');
        cursor = decoded;
    }
    if (cursor) {
        const cn = cursor.n ?? NULL_NEXT;
        cursorSql = Prisma.sql`(("bucketWeight" > ${cursor.w}) OR ("bucketWeight" = ${cursor.w} AND ((COALESCE("next", ${NULL_NEXT}) > ${cn}) OR (COALESCE("next", ${NULL_NEXT}) = ${cn} AND (("offerKind" > ${cursor.k}) OR ("offerKind" = ${cursor.k} AND "offerId" > ${cursor.i}))))))`;
    }

    const data = Prisma.sql`${withSql}
        SELECT "offerKind", "offerId", "outcome", "next", "last", "born",
            "snoozed", "done", "careUpdatedAt", "bucketWeight" FROM ranked
        WHERE ${cursorSql}${opts.hidePaused ? Prisma.sql` AND "done" IS NULL AND ("snoozed" IS NULL OR "snoozed" <= ${opts.nowIso})` : Prisma.empty}
        ORDER BY "bucketWeight" ASC, COALESCE("next", ${NULL_NEXT}) ASC, "offerKind" ASC, "offerId" ASC
        LIMIT ${limit + 1}`;
    // P0.4: count bez CTE latest — liczba wierszy nie zależy od follow-upów
    // (LEFT JOIN) ani od users (LEFT JOIN), więc liczymy tylko oferty +
    // care_states (ten sam predykat pauzy). Dokładny totalCount bez zmiany
    // kontraktu; sortowanie okna zostaje tylko w zapytaniu danych.
    const pauseRury = opts.hidePaused
        ? Prisma.sql` AND (cs."doneAt" IS NULL AND (cs."snoozedUntil" IS NULL OR cs."snoozedUntil" <= ${opts.nowIso}))`
        : Prisma.empty;
    const pauseStudnie = opts.hidePaused
        ? Prisma.sql` AND (cs."doneAt" IS NULL AND (cs."snoozedUntil" IS NULL OR cs."snoozedUntil" <= ${opts.nowIso}))`
        : Prisma.empty;
    const count = Prisma.sql`SELECT
        (SELECT COUNT(*) FROM offers_rel o
            LEFT JOIN care_states cs ON cs."offerKind" = 'rury' AND cs."offerId" = o."id"
            WHERE ${scopeRury}${andBornRury}${pauseRury})
        + (SELECT COUNT(*) FROM offers_studnie_rel s
            LEFT JOIN care_states cs ON cs."offerKind" = 'studnie' AND cs."offerId" = s."id"
            WHERE ${scopeStudnie}${andBornStudnie}${pauseStudnie}) AS "c"`;
    return { data, count };
}

/** Wiersz wzbogacenia strony (faza 2): pełne kolumny dla 1 oferty. */
export interface CareEnrichRow {
    offerKind: string;
    offerId: string;
    number: string | null;
    client: string | null;
    clientNumber: string | null;
    owner: string | null;
    author: string | null;
    value: number | null;
    phone: string | null;
    note: string | null;
    invest: string | null;
    address: string | null;
    contact: string | null;
    email: string | null;
}

/**
 * P2.2, faza 2: drogie kolumny prezentacyjne TYLKO dla par (kind,id) ze
 * strony (≤51). Wyrażenia 1:1 z dawnym base CTE (guard 0-kolumny studni
 * i fallbacki blobów bez zmian) — ta sama treść, inny moment. Pusta
 * lista z obu stron → null (brak zapytania). Kolejność wyników dowolna
 * (merge po kluczu w getCareQueue zachowuje kolejność strony).
 */
export function buildCareEnrichQuery(ruryIds: string[], studnieIds: string[]): Prisma.Sql | null {
    const parts: Prisma.Sql[] = [];
    if (ruryIds.length > 0) {
        parts.push(Prisma.sql`SELECT 'rury' AS "offerKind", o."id" AS "offerId",
            o."offer_number" AS "number", o."clientName" AS "client",
            o."clientNumber" AS "clientNumber",
            COALESCE(NULLIF(TRIM(COALESCE(ou."firstName", '') || ' ' || COALESCE(ou."lastName", '')), ''), ou."username") AS "owner",
            json_extract(o."data", '$.createdByUserName') AS "author",
            CAST(json_extract(o."data", '$.totalBrutto') AS REAL) AS "value",
            COALESCE(json_extract(o."data", '$.clientPhone'), json_extract(o."data", '$.clientContacts[0].phone')) AS "phone",
            lf."note" AS "note",
            COALESCE(NULLIF(o."investName", ''), json_extract(o."data", '$.investName'), json_extract(o."data", '$.budowa')) AS "invest",
            json_extract(o."data", '$.investAddress') AS "address",
            COALESCE(json_extract(o."data", '$.contactPerson'), json_extract(o."data", '$.clientContacts[0].name')) AS "contact",
            COALESCE(json_extract(o."data", '$.clientEmail'), json_extract(o."data", '$.clientContacts[0].email')) AS "email"
        FROM offers_rel o LEFT JOIN latest_followup lf
            ON lf."offerKind" = 'rury' AND lf."offerId" = o."id"
        LEFT JOIN users ou ON ou."id" = o."userId"
        WHERE o."id" IN (${Prisma.join(ruryIds)})`);
    }
    if (studnieIds.length > 0) {
        parts.push(Prisma.sql`SELECT 'studnie' AS "offerKind", s."id" AS "offerId",
            s."offer_number" AS "number", s."clientName" AS "client",
            s."clientNumber" AS "clientNumber",
            COALESCE(NULLIF(TRIM(COALESCE(su."firstName", '') || ' ' || COALESCE(su."lastName", '')), ''), su."username") AS "owner",
            json_extract(s."data", '$.createdByUserName') AS "author",
            -- Guard 0-kolumny (zapis studni bez totalPrice): niezerowa kolumna
            -- > blob.totalBrutto > suma wellsExport (jak search.ts d_wellsExportTotal).
            CAST(COALESCE(NULLIF(s."totalPrice", 0), json_extract(s."data", '$.totalBrutto'),
                (SELECT CAST(ROUND(COALESCE(SUM(value->>'totalPrice'), 0), 2) AS REAL)
                    FROM json_each(s."data", '$.wellsExport'))) AS REAL) AS "value",
            COALESCE(json_extract(s."data", '$.clientPhone'), json_extract(s."data", '$.clientContacts[0].phone')) AS "phone",
            lf."note" AS "note",
            COALESCE(NULLIF(s."investName", ''), json_extract(s."data", '$.investName'), json_extract(s."data", '$.budowa')) AS "invest",
            json_extract(s."data", '$.investAddress') AS "address",
            COALESCE(json_extract(s."data", '$.contactPerson'), json_extract(s."data", '$.clientContacts[0].name')) AS "contact",
            COALESCE(json_extract(s."data", '$.clientEmail'), json_extract(s."data", '$.clientContacts[0].email')) AS "email"
        FROM offers_studnie_rel s LEFT JOIN latest_followup lf
            ON lf."offerKind" = 'studnie' AND lf."offerId" = s."id"
        LEFT JOIN users su ON su."id" = s."userId"
        WHERE s."id" IN (${Prisma.join(studnieIds)})`);
    }
    if (parts.length === 0) return null;
    if (parts.length === 1) return parts[0];
    return Prisma.sql`${parts[0]} UNION ALL ${parts[1]}`;
}

/** Podsumowanie opieki: 1 SELECT GROUP BY (ten sam WHERE co kolejka). */
export interface CareSummary {
    noContact: number;
    due: number;
    openOk: number;
    won: number;
    lost: number;
    abandoned: number;
    totalCount: number;
}

export async function getCareSummary(
    db: QueryRawDb,
    user: CareUser,
    scope: CareScope,
    nowIso: string,
    opts?: { from?: string; to?: string; repOwner?: string | null; hidePaused?: boolean }
): Promise<CareSummary> {
    const ownerWhere = resolveOwnerWhere(user, scope);
    const scopeRury = ownerCond(user, 'o', 'offer', ownerWhere, opts?.repOwner);
    const scopeStudnie = ownerCond(user, 's', 'offer_studnie', ownerWhere, opts?.repOwner);
    const bornRury = bornRange('o', opts?.from, opts?.to);
    const bornStudnie = bornRange('s', opts?.from, opts?.to);
    const andBornRury = bornRury ? Prisma.sql` AND ${bornRury}` : Prisma.empty;
    const andBornStudnie = bornStudnie ? Prisma.sql` AND ${bornStudnie}` : Prisma.empty;
    // Jeden flag hidePaused jak kolejka (default false = pauza widoczna).
    // Wcześniej summary zawsze cicho wycinało pauzę — liczniki ≠ kolejka.
    const pauseRury = opts?.hidePaused
        ? Prisma.sql` AND (cs."offerId" IS NULL OR (cs."doneAt" IS NULL AND (cs."snoozedUntil" IS NULL OR cs."snoozedUntil" <= ${nowIso})))`
        : Prisma.empty;
    const pauseStudnie = opts?.hidePaused
        ? Prisma.sql` AND (cs."offerId" IS NULL OR (cs."doneAt" IS NULL AND (cs."snoozedUntil" IS NULL OR cs."snoozedUntil" <= ${nowIso})))`
        : Prisma.empty;
    // P1: latest z tabeli latest_followup (jak kolejka wyżej).
    const withSql = Prisma.sql`WITH base AS (
        SELECT 'rury' AS "offerKind", o."id" AS "offerId", lf."outcome" AS "outcome",
            lf."nextContactAt" AS "next", lf."contactedAt" AS "last"
        FROM offers_rel o LEFT JOIN latest_followup lf
            ON lf."offerKind" = 'rury' AND lf."offerId" = o."id"
        LEFT JOIN care_states cs ON cs."offerKind" = 'rury' AND cs."offerId" = o."id"
        WHERE ${scopeRury}${pauseRury}${andBornRury}
        UNION ALL
        SELECT 'studnie' AS "offerKind", s."id" AS "offerId", lf."outcome" AS "outcome",
            lf."nextContactAt" AS "next", lf."contactedAt" AS "last"
        FROM offers_studnie_rel s LEFT JOIN latest_followup lf
            ON lf."offerKind" = 'studnie' AND lf."offerId" = s."id"
        LEFT JOIN care_states cs ON cs."offerKind" = 'studnie' AND cs."offerId" = s."id"
        WHERE ${scopeStudnie}${pauseStudnie}${andBornStudnie}
    )`;
    const rows = await db.$queryRaw<
        Array<{ k: string; c: number | bigint }>
    >`${withSql} SELECT CASE WHEN "outcome" IS NULL THEN 'noContact' WHEN "outcome" = 'WON' THEN 'won' WHEN "outcome" IN ('LOST_COMPETITION','LOST_OTHER') THEN 'lost' WHEN "outcome" = 'ABANDONED' THEN 'abandoned' WHEN "outcome" = 'OPEN' AND ("next" IS NULL OR "next" <= ${nowIso}) THEN 'due' ELSE 'openOk' END AS "k", COUNT(*) AS "c" FROM base GROUP BY "k"`;
    const m = new Map(rows.map((r) => [r.k, num(r.c)]));
    const noContact = m.get('noContact') ?? 0;
    const due = m.get('due') ?? 0;
    const openOk = m.get('openOk') ?? 0;
    const won = m.get('won') ?? 0;
    const lost = m.get('lost') ?? 0;
    const abandoned = m.get('abandoned') ?? 0;
    return {
        noContact,
        due,
        openOk,
        won,
        lost,
        abandoned,
        totalCount: noContact + due + openOk + won + lost + abandoned
    };
}

export interface QueryRawDb {
    // biome-ignore lint/suspicious/noExplicitAny: minimal $queryRaw structural (Sql | template tag)
    $queryRaw: <T>(...args: any[]) => Promise<T>;
    // biome-ignore lint/suspicious/noExplicitAny: $executeRaw jak w Prisma (liczba wierszy)
    $executeRaw?: (...args: any[]) => Promise<number>;
}

const num = (v: unknown): number => toNum(v as number | bigint | string | null | undefined) ?? 0;

/** Kolejka opieki: strona (skalary) + COUNT równolegle, potem enrich strony.
 * Scope 403 rzuca przed SQL. Kolejność i cursor z fazy 1 (bez zmian). */
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
                born: string | null;
                snoozed: string | null;
                done: string | null;
                careUpdatedAt: string | null;
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
    // P2.2, faza 2: wzbogacenie TYLKO wierszy strony (≤limit). Merge po
    // kluczu zachowuje kolejność fazy 1; brak wiersza (wyścig z DELETE
    // oferty) = same nulle, znika przy następnym odświeżeniu.
    const enrichByKey = new Map<string, CareEnrichRow>();
    if (items.length > 0) {
        const ruryIds = items.filter((r) => r.offerKind === 'rury').map((r) => r.offerId);
        const studnieIds = items.filter((r) => r.offerKind === 'studnie').map((r) => r.offerId);
        const enrichQuery = buildCareEnrichQuery(ruryIds, studnieIds);
        if (enrichQuery) {
            const enrichRows = await db.$queryRaw<CareEnrichRow[]>(enrichQuery);
            for (const e of enrichRows) {
                enrichByKey.set(`${e.offerKind}:${e.offerId}`, e);
            }
        }
    }
    const emptyEnrich: CareEnrichRow = {
        offerKind: '',
        offerId: '',
        number: null,
        client: null,
        clientNumber: null,
        owner: null,
        author: null,
        value: null,
        phone: null,
        note: null,
        invest: null,
        address: null,
        contact: null,
        email: null
    };
    return {
        items: items.map((r) => {
            const e = enrichByKey.get(`${r.offerKind}:${r.offerId}`) ?? emptyEnrich;
            return {
                offerKind: r.offerKind,
                offerId: r.offerId,
                outcome: r.outcome,
                nextContactAt: r.next,
                lastContactAt: r.last,
                createdAt: r.born,
                number: e.number,
                clientName: e.client,
                clientNumber:
                    typeof e.clientNumber === 'string' && e.clientNumber.trim() !== ''
                        ? e.clientNumber
                        : null,
                ownerName: typeof e.owner === 'string' && e.owner.trim() !== '' ? e.owner : null,
                authorName:
                    typeof e.author === 'string' && e.author.trim() !== '' ? e.author : null,
                value: typeof e.value === 'number' ? e.value : null,
                phone: e.phone,
                investName: typeof e.invest === 'string' ? e.invest : null,
                investAddress: typeof e.address === 'string' ? e.address : null,
                contactPerson: typeof e.contact === 'string' ? e.contact : null,
                email: typeof e.email === 'string' ? e.email : null,
                lastNote: e.note,
                bucketWeight: num(r.bucketWeight),
                snoozedUntil: r.snoozed,
                doneAt: r.done,
                careUpdatedAt: r.careUpdatedAt ?? null
            };
        }),
        nextCursor,
        totalCount
    };
}

export interface CareQueueViewItem {
    offerKind: string;
    offerId: string;
    outcome: string | null;
    nextContactAt: string | null;
    lastContactAt: string | null;
    number: string | null;
    clientName: string | null;
    clientNumber: string | null;
    ownerName: string | null;
    authorName: string | null;
    value: number | null;
    phone: string | null;
    investName: string | null;
    investAddress: string | null;
    contactPerson: string | null;
    email: string | null;
    lastNote: string | null;
    status: string;
    slaBucket: string;
    overdueDays: number;
    snoozedUntil: string | null;
    doneAt: string | null;
    paused: boolean;
    escalated: boolean;
    /** updatedAt wiersza care_states (null = brak stanu) — opt-lock zapisów. */
    careUpdatedAt: string | null;
}

/** Mapowanie wierszy kolejki na widok (status/SLA/pauza/eskalacja) — SSoT dla /queue i /panel. */
export function buildCareQueueView(
    items: CareQueueResult['items'],
    sla: SlaConfig,
    nowIso: string
): CareQueueViewItem[] {
    return items.map((r) => {
        // Brak jakiegokolwiek wpisu = latest null = NO_CONTACT z wiekiem
        // od utworzenia oferty (kontrakt careStatus, nie puste '').
        const latest =
            r.outcome === null && r.nextContactAt === null && r.lastContactAt === null
                ? null
                : { outcome: r.outcome, nextContactAt: r.nextContactAt };
        const state = getFollowUpState(latest, r.createdAt ?? '', nowIso);
        const snoozedUntil = r.snoozedUntil ?? null;
        const doneAt = r.doneAt ?? null;
        const paused = (snoozedUntil !== null && snoozedUntil > nowIso) || doneAt !== null;
        return {
            offerKind: r.offerKind,
            offerId: r.offerId,
            outcome: r.outcome,
            nextContactAt: r.nextContactAt,
            lastContactAt: r.lastContactAt,
            number: r.number ?? null,
            clientName: r.clientName ?? null,
            clientNumber: r.clientNumber ?? null,
            ownerName: r.ownerName ?? null,
            authorName: r.authorName ?? null,
            value: r.value ?? null,
            phone: r.phone ?? null,
            investName: r.investName ?? null,
            investAddress: r.investAddress ?? null,
            contactPerson: r.contactPerson ?? null,
            email: r.email ?? null,
            lastNote: r.lastNote ?? null,
            status: state.status,
            slaBucket: state.slaBucket,
            overdueDays: state.overdueDays,
            snoozedUntil,
            doneAt,
            paused,
            escalated: isEscalated(state, nowIso, sla.escalationH, snoozedUntil, doneAt),
            careUpdatedAt: r.careUpdatedAt ?? null
        };
    });
}

/** ETag panelu: znaczniki a-m, glowny SELECT + guarded m (scope + user w haśle route).
 * Nadmiarowy (globalne maksy) — fałszywy 200 nieszkodliwy, brakujący 304 nie istnieje.
 * j/k: MAX(updatedAt) ofert — każda edycja (w tym zmiana opiekuna) unieważnia 304.
 * l: COUNT shares — nadanie/odebranie udostępnienia unieważnia 304
 * (udziałowiec widzi nowy wiersz w kolejce). */
export async function getCareEtagInput(
    db: QueryRawDb,
    userId: string
): Promise<Array<string | null>> {
    const rows = (await db.$queryRaw<Array<Record<string, string | null>>>(
        Prisma.sql`SELECT
            (SELECT MAX("contactedAt") FROM "offer_follow_ups") AS "a",
            (SELECT MAX("createdAt") FROM "offer_follow_ups") AS "b",
            (SELECT MAX("updatedAt") FROM "care_states") AS "c",
            (SELECT MAX("createdAt") FROM "care_notifications" WHERE "userId" = ${userId}) AS "d",
            (SELECT MAX("readAt") FROM "care_notifications" WHERE "userId" = ${userId}) AS "e",
            (SELECT MAX("createdAt") FROM "offers_rel") AS "f",
            (SELECT MAX("createdAt") FROM "offers_studnie_rel") AS "g",
            (SELECT "updatedAt" FROM "care_sla_config" WHERE "id" = 'global') AS "h",
            (SELECT MAX("updatedAt") FROM "care_sla_scopes") AS "i",
            (SELECT MAX("updatedAt") FROM "offers_rel") AS "j",
            (SELECT MAX("updatedAt") FROM "offers_studnie_rel") AS "k",
            -- COUNT jako TEXT: sterownik zwraca BigInt/number, a JSON.stringify
            -- w haśle ETag (care.ts) rzuca na BigInt — TEXT zawsze string.
            -- Para COUNT + MAX(rowid): sam COUNT aliasuje swap grant+revoke
            -- (netto 0 → fałszywy 304); rowid rośnie z każdym INSERTem.
            (SELECT CAST(COUNT(*) AS TEXT) || '|' || COALESCE(CAST(MAX(rowid) AS TEXT), '0') FROM "document_shares") AS "l"`
    )) as Array<Record<string, string | null>>;
    const r = rows[0] ?? {};
    // R3: marker m = MAX(updatedAt) follow-upow - edycja wpisu w miejscu
    // (PUT bez zmiany contactedAt/createdAt) uniewaznia 304. Osobny SELECT
    // z try/catch: legacy DB i stare fixtury bez kolumny daja m=null
    // zamiast wywalac caly ETag (kontrakt best-effort z care.ts).
    let m: string | null = null;
    try {
        const mRows = await db.$queryRaw<Array<{ m: string | null }>>(
            Prisma.sql`SELECT MAX("updatedAt") AS "m" FROM "offer_follow_ups"`
        );
        m = mRows[0]?.m ?? null;
    } catch {
        m = null;
    }
    return [
        r.a ?? null,
        r.b ?? null,
        r.c ?? null,
        r.d ?? null,
        r.e ?? null,
        r.f ?? null,
        r.g ?? null,
        r.h ?? null,
        r.i ?? null,
        r.j ?? null,
        r.k ?? null,
        r.l ?? null,
        m
    ];
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

/** F8: wartość pola SLA z DB musi być dodatnią liczbą (jak w slaSchema PUT).
 * Uszkodzony wiersz = throw (widoczny 500), nie ciche maskowanie defaultem. */
function strictSlaField(v: unknown, name: string): number {
    const n = Number(v);
    if (!Number.isFinite(n) || n < 1) {
        throw Object.assign(new Error(`Nieprawidłowa konfiguracja SLA: ${name}`), {
            status: 500,
            code: 'INVALID_SLA_CONFIG'
        });
    }
    return n;
}
export const MAX_SNOOZE_DAYS = 28;

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

/** Upsert stanu: dokładnie jedno z snoozedUntil/doneAt (drugie NULL).
 * Z expectedUpdatedAt: optimistic concurrency — brak dopasowania to 409
 * (osobny błąd ze status, mapowany przez route). Bez niego: blind upsert. */
export async function setCareState(
    db: RawDb,
    args: {
        offerKind: CareKind;
        offerId: string;
        snoozedUntil: string | null;
        doneAt: string | null;
        updatedBy: string;
        nowIso: string;
        expectedUpdatedAt?: string | null;
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
    if (args.expectedUpdatedAt !== undefined && args.expectedUpdatedAt !== null) {
        const exec = db.$executeRaw?.bind(db);
        if (!exec) {
            throw Object.assign(new Error('Brak obsługi concurrency'), { status: 500 });
        }
        const n = await exec(
            Prisma.sql`UPDATE "care_states" SET "snoozedUntil" = ${state.snoozedUntil}, "doneAt" = ${state.doneAt}, "updatedBy" = ${state.updatedBy}, "updatedAt" = ${state.updatedAt} WHERE "offerKind" = ${state.offerKind} AND "offerId" = ${state.offerId} AND "updatedAt" = ${args.expectedUpdatedAt}`
        );
        if (n === 0) {
            const cur = await getCareState(db, args.offerKind, args.offerId);
            // Brak wiersza + podany expected = ktoś w międzyczasie wznowił
            // (reopen kasuje wiersz). Cichy insert wskrzesiłby stan i
            // nadpisał cudzą decyzję — fail-closed 409 jak przy konflikcie.
            throw Object.assign(
                new Error(
                    cur
                        ? 'Stan zmieniony przez kogoś innego'
                        : 'Stan wygasł — odśwież i spróbuj ponownie'
                ),
                {
                    status: 409,
                    code: 'CARE_STATE_CONFLICT'
                }
            );
        } else {
            return state;
        }
    }
    await db.$queryRaw(
        Prisma.sql`INSERT INTO "care_states" ("offerKind", "offerId", "snoozedUntil", "doneAt", "updatedBy", "updatedAt") VALUES (${state.offerKind}, ${state.offerId}, ${state.snoozedUntil}, ${state.doneAt}, ${state.updatedBy}, ${state.updatedAt}) ON CONFLICT ("offerKind", "offerId") DO UPDATE SET "snoozedUntil" = ${state.snoozedUntil}, "doneAt" = ${state.doneAt}, "updatedBy" = ${state.updatedBy}, "updatedAt" = ${state.updatedAt}`
    );
    return state;
}

export async function clearCareState(
    db: RawDb,
    offerKind: CareKind,
    offerId: string,
    expectedUpdatedAt?: string | null
): Promise<void> {
    if (expectedUpdatedAt !== undefined && expectedUpdatedAt !== null) {
        const exec = db.$executeRaw?.bind(db);
        if (!exec) {
            throw Object.assign(new Error('Brak obsługi concurrency'), { status: 500 });
        }
        const n = await exec(
            Prisma.sql`DELETE FROM "care_states" WHERE "offerKind" = ${offerKind} AND "offerId" = ${offerId} AND "updatedAt" = ${expectedUpdatedAt}`
        );
        if (n === 0) {
            throw Object.assign(new Error('Stan zmieniony przez kogoś innego'), {
                status: 409,
                code: 'CARE_STATE_CONFLICT'
            });
        }
        return;
    }
    await db.$queryRaw(
        Prisma.sql`DELETE FROM "care_states" WHERE "offerKind" = ${offerKind} AND "offerId" = ${offerId}`
    );
}

export async function getSlaConfig(db: RawDb): Promise<SlaConfig> {
    const rows = await db.$queryRaw<Array<SlaConfig>>(
        Prisma.sql`SELECT "firstContactH", "staleD", "escalationH" FROM "care_sla_config" WHERE "id" = 'global'`
    );
    const r = rows[0];
    // F8: brak wiersza = default 24/7/72 (pusta/legacy DB działa).
    // Uszkodzony wiersz = głośny błąd, nie ciche maskowanie defaultem.
    if (!r) {
        logger.warn('Care', 'Brak wiersza SLA (default 24/7/72)');
        return { ...DEFAULT_SLA };
    }
    return {
        firstContactH: strictSlaField(r.firstContactH, 'firstContactH'),
        staleD: strictSlaField(r.staleD, 'staleD'),
        escalationH: strictSlaField(r.escalationH, 'escalationH')
    };
}

export async function setSlaConfig(
    db: RawDb,
    cfg: SlaConfig & { updatedBy: string; nowIso: string; expectedUpdatedAt?: string | null }
): Promise<SlaConfig> {
    // Opt-lock jak w setCareState: z expectedUpdatedAt tylko warunkowy UPDATE.
    // Brak wiersza + podany expected = ktoś w międzyczasie usunął (fail-closed 409).
    if (cfg.expectedUpdatedAt !== undefined && cfg.expectedUpdatedAt !== null) {
        const exec = db.$executeRaw?.bind(db);
        if (!exec) {
            throw Object.assign(new Error('Brak obsługi concurrency'), { status: 500 });
        }
        const n = await exec(
            Prisma.sql`UPDATE "care_sla_config" SET "firstContactH" = ${cfg.firstContactH}, "staleD" = ${cfg.staleD}, "escalationH" = ${cfg.escalationH}, "updatedBy" = ${cfg.updatedBy}, "updatedAt" = ${cfg.nowIso} WHERE "id" = 'global' AND "updatedAt" = ${cfg.expectedUpdatedAt}`
        );
        if (n === 0) {
            throw Object.assign(new Error('Progi zmienione przez kogoś innego'), {
                status: 409,
                code: 'CARE_STATE_CONFLICT'
            });
        }
        return {
            firstContactH: cfg.firstContactH,
            staleD: cfg.staleD,
            escalationH: cfg.escalationH
        };
    }
    await db.$queryRaw(
        Prisma.sql`INSERT INTO "care_sla_config" ("id", "firstContactH", "staleD", "escalationH", "updatedBy", "updatedAt") VALUES ('global', ${cfg.firstContactH}, ${cfg.staleD}, ${cfg.escalationH}, ${cfg.updatedBy}, ${cfg.nowIso}) ON CONFLICT ("id") DO UPDATE SET "firstContactH" = ${cfg.firstContactH}, "staleD" = ${cfg.staleD}, "escalationH" = ${cfg.escalationH}, "updatedBy" = ${cfg.updatedBy}, "updatedAt" = ${cfg.nowIso}`
    );
    return {
        firstContactH: cfg.firstContactH,
        staleD: cfg.staleD,
        escalationH: cfg.escalationH
    };
}

// ─── P4: progi per zespół / per user (ADR-016, fallback do globalnych) ───

export type SlaScopeType = 'team' | 'user';
export type SlaSource = 'global' | SlaScopeType;

export interface EffectiveSla extends SlaConfig {
    source: SlaSource;
}

async function getScopedSlaRow(
    db: RawDb,
    scopeType: SlaScopeType,
    scopeId: string
): Promise<SlaConfig | null> {
    const rows = await db.$queryRaw<Array<SlaConfig>>(
        Prisma.sql`SELECT "firstContactH", "staleD", "escalationH" FROM "care_sla_scopes" WHERE "scopeType" = ${scopeType} AND "scopeId" = ${scopeId}`
    );
    const r = rows[0];
    if (!r) return null;
    return {
        firstContactH: strictSlaField(r.firstContactH, 'firstContactH'),
        staleD: strictSlaField(r.staleD, 'staleD'),
        escalationH: strictSlaField(r.escalationH, 'escalationH')
    };
}

/** Efektywny próg w scope requeścia: team/user z fallbackiem do global. */
export async function getEffectiveSla(
    db: RawDb,
    user: CareUser,
    scope: CareScope
): Promise<EffectiveSla> {
    if (scope === 'team' && (user.role === 'pro' || user.role === 'admin')) {
        const row = await getScopedSlaRow(db, 'team', user.id);
        if (row) return { ...row, source: 'team' };
    }
    if (scope === 'mine') {
        const row = await getScopedSlaRow(db, 'user', user.id);
        if (row) return { ...row, source: 'user' };
    }
    return { ...(await getSlaConfig(db)), source: 'global' };
}

/** Znacznik wersji wiersza progu do opt-lock PUT (null = brak wiersza). */
export async function getSlaUpdatedAt(
    db: RawDb,
    user: CareUser,
    scope: CareScope
): Promise<string | null> {
    if (scope === 'team' && (user.role === 'pro' || user.role === 'admin')) {
        const rows = await db.$queryRaw<Array<{ updatedAt: string }>>(
            Prisma.sql`SELECT "updatedAt" FROM "care_sla_scopes" WHERE "scopeType" = 'team' AND "scopeId" = ${user.id}`
        );
        if (rows[0]) return rows[0].updatedAt;
    }
    if (scope === 'mine') {
        const rows = await db.$queryRaw<Array<{ updatedAt: string }>>(
            Prisma.sql`SELECT "updatedAt" FROM "care_sla_scopes" WHERE "scopeType" = 'user' AND "scopeId" = ${user.id}`
        );
        if (rows[0]) return rows[0].updatedAt;
    }
    const rows = await db.$queryRaw<Array<{ updatedAt: string }>>(
        Prisma.sql`SELECT "updatedAt" FROM "care_sla_config" WHERE "id" = 'global'`
    );
    return rows[0]?.updatedAt ?? null;
}

export async function setScopedSla(
    db: RawDb,
    cfg: SlaConfig & {
        scopeType: SlaScopeType;
        scopeId: string;
        updatedBy: string;
        nowIso: string;
        expectedUpdatedAt?: string | null;
    }
): Promise<SlaConfig> {
    // Opt-lock jak wyżej; blind upsert tylko bez expected (pierwszy zapis).
    if (cfg.expectedUpdatedAt !== undefined && cfg.expectedUpdatedAt !== null) {
        const exec = db.$executeRaw?.bind(db);
        if (!exec) {
            throw Object.assign(new Error('Brak obsługi concurrency'), { status: 500 });
        }
        const n = await exec(
            Prisma.sql`UPDATE "care_sla_scopes" SET "firstContactH" = ${cfg.firstContactH}, "staleD" = ${cfg.staleD}, "escalationH" = ${cfg.escalationH}, "updatedBy" = ${cfg.updatedBy}, "updatedAt" = ${cfg.nowIso} WHERE "scopeType" = ${cfg.scopeType} AND "scopeId" = ${cfg.scopeId} AND "updatedAt" = ${cfg.expectedUpdatedAt}`
        );
        if (n === 0) {
            throw Object.assign(new Error('Progi zmienione przez kogoś innego'), {
                status: 409,
                code: 'CARE_STATE_CONFLICT'
            });
        }
        return {
            firstContactH: cfg.firstContactH,
            staleD: cfg.staleD,
            escalationH: cfg.escalationH
        };
    }
    await db.$queryRaw(
        Prisma.sql`INSERT INTO "care_sla_scopes" ("scopeType", "scopeId", "firstContactH", "staleD", "escalationH", "updatedBy", "updatedAt") VALUES (${cfg.scopeType}, ${cfg.scopeId}, ${cfg.firstContactH}, ${cfg.staleD}, ${cfg.escalationH}, ${cfg.updatedBy}, ${cfg.nowIso}) ON CONFLICT ("scopeType", "scopeId") DO UPDATE SET "firstContactH" = ${cfg.firstContactH}, "staleD" = ${cfg.staleD}, "escalationH" = ${cfg.escalationH}, "updatedBy" = ${cfg.updatedBy}, "updatedAt" = ${cfg.nowIso}`
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
    clientName: string | null;
    clientNumber: string | null;
    number: string | null;
    ownerName: string | null;
    value: number | null;
    investName: string | null;
    investAddress: string | null;
    contactPerson: string | null;
    phone: string | null;
    email: string | null;
}

function notifBase(
    user: CareUser,
    scope: CareScope,
    repOwner?: string | null
): { rury: Prisma.Sql; studnie: Prisma.Sql } {
    const ownerWhere = resolveOwnerWhere(user, scope);
    return {
        rury: ownerCond(user, 'o', 'offer', ownerWhere, repOwner),
        studnie: ownerCond(user, 's', 'offer_studnie', ownerWhere, repOwner)
    };
}

/** Kandydaci do powiadomień dla usera: widoczne oferty z typem naruszenia. */
function notifCandidates(
    user: CareUser,
    scope: CareScope,
    nowIso: string,
    sla: SlaConfig,
    repOwner?: string | null
): Prisma.Sql {
    const { rury, studnie } = notifBase(user, scope, repOwner);
    const dayAhead = new Date(Date.parse(nowIso) + 86400000).toISOString();
    const staleCut = new Date(Date.parse(nowIso) - sla.staleD * 86400000).toISOString();
    const escCut = new Date(Date.parse(nowIso) - sla.escalationH * 3600000).toISOString();
    const fcCut = new Date(Date.parse(nowIso) - sla.firstContactH * 3600000).toISOString();
    // P1: latest z tabeli latest_followup (jak kolejka/summary wyżej).
    return Prisma.sql`WITH base AS (
        SELECT 'rury' AS "offerKind", o."id" AS "offerId", o."userId" AS "ownerId",
            lf."outcome" AS "outcome", lf."nextContactAt" AS "next", o."createdAt" AS "born"
        FROM offers_rel o LEFT JOIN latest_followup lf
            ON lf."offerKind" = 'rury' AND lf."offerId" = o."id"
        LEFT JOIN care_states cs ON cs."offerKind" = 'rury' AND cs."offerId" = o."id"
        WHERE ${rury} AND (cs."offerId" IS NULL OR (cs."doneAt" IS NULL AND (cs."snoozedUntil" IS NULL OR cs."snoozedUntil" <= ${nowIso})))
        UNION ALL
        SELECT 'studnie' AS "offerKind", s."id" AS "offerId", s."userId" AS "ownerId",
            lf."outcome" AS "outcome", lf."nextContactAt" AS "next", s."createdAt" AS "born"
        FROM offers_studnie_rel s LEFT JOIN latest_followup lf
            ON lf."offerKind" = 'studnie' AND lf."offerId" = s."id"
        LEFT JOIN care_states cs ON cs."offerKind" = 'studnie' AND cs."offerId" = s."id"
        WHERE ${studnie} AND (cs."offerId" IS NULL OR (cs."doneAt" IS NULL AND (cs."snoozedUntil" IS NULL OR cs."snoozedUntil" <= ${nowIso})))
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
    skipped?: 'rep-preview' | 'throttled';
    /** F3: ile wierszy zdjela retencja w tym syncu (additive). */
    deleted?: number;
}

/**
 * P0.3: throttle syncu per skrzynka (in-request, zgodnie z ADR-015 —
 * placement sync-przed-listą bez zmian, tylko skip świeżo po udanym syncu).
 * Okno 60 s = polling FE; restart procesu gubi znacznik = pełny sync
 * (bezpieczne). Fail nie stempluje (retry dozwolony); współbieżne żądania
 * serializują się (drugi po udanym pierwszym dostaje skip).
 * rep-preview omija throttle (zero side-effectów tak czy owak).
 */
// E2E (izolowany serwer :3198/:3199) ustawia 0 -> każdy GET /care/notifications
// synchronizuje, więc asserty na unreadCount nie zależą od czasu od poprzedniego
// syncu (carePanelR2R3 (g) czytał 1-3 zamiast >=25, gdy test wpadł w 60 s okno).
const rawThrottle = process.env.CARE_SYNC_THROTTLE_MS;
export const CARE_SYNC_THROTTLE_MS =
    rawThrottle !== undefined && Number.isFinite(Number(rawThrottle)) && Number(rawThrottle) >= 0
        ? Number(rawThrottle)
        : 60_000;
const syncInflight = new Map<string, Promise<CareSyncResult>>();
const syncLastOk = new Map<string, number>();

/** Reset stanu throttle (tylko testy — izolacja między przypadkami). */
export function resetCareSyncThrottleForTests(): void {
    syncInflight.clear();
    syncLastOk.clear();
}

/** INSERT brakujących powiadomień (SSoT — jeden SQL na oba warianty).
 * Z `forCount` dokleja RETURNING (realna liczba wstawek). */
function insertMissingSql(
    uid: string,
    nowIso: string,
    cand: Prisma.Sql,
    forCount: boolean
): Prisma.Sql {
    const returning = forCount ? Prisma.sql` RETURNING "id"` : Prisma.empty;
    return Prisma.sql`INSERT OR IGNORE INTO "care_notifications" ("id", "userId", "offerKind", "offerId", "type", "readAt", "createdAt")
SELECT lower(hex(randomblob(16))), ${uid}, c."offerKind", c."offerId", c."ntype", NULL, ${nowIso}
FROM (${cand}) AS c
WHERE c."ntype" IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM "care_notifications" n WHERE n."userId" = ${uid} AND n."offerKind" = c."offerKind" AND n."offerId" = c."offerId" AND n."type" = c."ntype" AND n."readAt" IS NULL)${returning}`;
}

/** UPDATE zliczany: RETURNING, potem $executeRaw (changes), potem 0.
 * Ten sam wzorzec co deleteCounted (drivery bez RETURNING). */
async function updateCounted(
    db: RawDb,
    sqlReturning: Prisma.Sql,
    sqlPlain: Prisma.Sql
): Promise<number> {
    try {
        const rows = (await db.$queryRaw<Array<{ id: string }>>(sqlReturning)) as unknown;
        if (Array.isArray(rows)) return rows.length;
    } catch (e) {
        // Statement padł w całości (nie "wykonany bez zwrotki") — fallback.
        logger.debug('Care', 'Sync auto-read bez RETURNING, fallback changes', String(e));
    }
    const exec = db.$executeRaw?.bind(db);
    if (exec) {
        try {
            return await exec(sqlPlain);
        } catch (e) {
            logger.debug('Care', 'Sync auto-read fallback nieudany', String(e));
            return 0;
        }
    }
    return 0;
}

/** DELETE zliczany: RETURNING, potem $executeRaw (changes), potem 0.
 * Hoist na scope modułu — jedna definicja na wszystkie synci. */
async function deleteCounted(
    db: RawDb,
    sqlReturning: Prisma.Sql,
    sqlPlain: Prisma.Sql
): Promise<number> {
    try {
        const rows = (await db.$queryRaw<Array<{ id: string }>>(sqlReturning)) as unknown;
        if (Array.isArray(rows)) return rows.length;
    } catch (e) {
        // Driver bez RETURNING -> fallback $executeRaw (changes) ponizej.
        logger.debug('Care', 'Sync DELETE bez RETURNING, fallback changes', String(e));
    }
    const exec = db.$executeRaw?.bind(db);
    if (exec) {
        try {
            return await exec(sqlPlain);
        } catch (e) {
            logger.debug('Care', 'Sync DELETE fallback nieudany', String(e));
            return 0;
        }
    }
    return 0;
}

/** Sync skrzynki usera: wstaw brakujące + zamknij nieaktualne. Idempotentny.
 * Set-based: stała liczba statementów niezależna od liczby kandydatów
 * (P1 planu poprawy; baseline N+1: ~2 stmt/ofertę w careSyncLoad.test.ts).
 * Wyścig dwóch synców rozstrzyga uq_carenotif_unread_per_offer + OR IGNORE
 * (jak terminale w followUps) — przegrany wstawia 0, nie rzuca. */
export async function syncCareNotifications(
    db: RawDb,
    user: CareUser,
    scope: CareScope,
    nowIso: string,
    sla: SlaConfig,
    opts?: { repOwner?: string | null }
): Promise<CareSyncResult> {
    // Podgląd repa: zero efektów ubocznych, zero interakcji z throttlem.
    if (opts?.repOwner) return runSyncCareNotifications(db, user, scope, nowIso, sla, opts);
    const uid = user.id;
    const prev = syncInflight.get(uid);
    if (prev) {
        try {
            await prev;
        } catch {
            // Poprzedni padł bez stempla — próbujemy sami poniżej.
        }
    }
    const last = syncLastOk.get(uid);
    if (last !== undefined && Date.now() - last < CARE_SYNC_THROTTLE_MS) {
        return { inserted: 0, resolved: 0, deleted: 0, skipped: 'throttled' };
    }
    const p = runSyncCareNotifications(db, user, scope, nowIso, sla, opts).then((r) => {
        if (r.skipped !== 'rep-preview') syncLastOk.set(uid, Date.now());
        return r;
    });
    syncInflight.set(uid, p);
    try {
        return await p;
    } finally {
        if (syncInflight.get(uid) === p) syncInflight.delete(uid);
    }
}

async function runSyncCareNotifications(
    db: RawDb,
    user: CareUser,
    scope: CareScope,
    nowIso: string,
    sla: SlaConfig,
    opts?: { repOwner?: string | null }
): Promise<CareSyncResult> {
    // Sync (zapisy) zawsze do własnej skrzynki (self-only); odczyt listy
    // (`listCareNotifications`) per mailbox `repOwner ?? self` (podgląd repa
    // read-only, route). Martwy mailboxUserId usunięty (confused-deputy).
    const uid = user.id;
    // A+C: podgląd repa = zero efektów ubocznych w DB. Sync z repOwner
    // dopisywał kandydatów o ofertach repa do skrzynki viewera (i kasował
    // retencją) — filtrowany sync nie persistuje; sprząta pełny sync bez filtra.
    if (opts?.repOwner) return { inserted: 0, resolved: 0, deleted: 0, skipped: 'rep-preview' };
    const cand = notifCandidates(user, scope, nowIso, sla, opts?.repOwner);
    // 1: wstaw brakujace (deduplikacja w SQL, nie petla w JS).
    // F2: inserted liczony realnie z RETURNING, nie COUNT createdAt=nowIso
    // (falsz przy wyscigu z tym samym nowIso: oba syncy liczylyby wszystkie wiersze).
    let inserted = 0;
    let insertCounted = false;
    try {
        const insRows = (await db.$queryRaw<Array<{ id: string }>>(
            insertMissingSql(uid, nowIso, cand, true)
        )) as Array<{ id: string }>;
        if (Array.isArray(insRows)) {
            inserted = insRows.length;
            insertCounted = true;
        }
    } catch (e) {
        // Driver bez RETURNING -> fallback ponizej (statement padl w calosci, nic nie wstawiono).
        logger.debug('Care', 'Sync INSERT bez RETURNING, fallback COUNT', String(e));
    }
    if (!insertCounted) {
        // Fallback: changes() z $executeRaw liczy realne wstawienia (bez wyścigu
        // same-nowIso jak COUNT); COUNT tylko gdy driver nie wspiera execute.
        const execIns = db.$executeRaw?.bind(db);
        if (execIns) {
            try {
                inserted = await execIns(insertMissingSql(uid, nowIso, cand, false));
                insertCounted = true;
            } catch (e) {
                logger.debug('Care', 'Sync INSERT fallback nieudany', String(e));
            }
        }
    }
    if (!insertCounted) {
        const insCnt = (await db.$queryRaw<Array<{ c: number | bigint }>>(
            Prisma.sql`SELECT COUNT(*) AS "c" FROM "care_notifications" WHERE "userId" = ${uid} AND "createdAt" = ${nowIso} AND "readAt" IS NULL`
        )) as Array<{ c: number | bigint }>;
        inserted = num(insCnt[0]?.c);
    }
    // 2: auto-read jednym UPDATE (oferta zniknęła z kandydatów:
    // terminal/pauza/poza scope) — liczba zamkniętych zliczana jak reszta
    // syncu (RETURNING, potem changes, potem 0). Z repOwner funkcja wraca
    // wcześniej (patrz początek) — sprzątanie robi pełny sync bez filtra,
    // więc ten blok zawsze działa bez filtra.
    const resolved = await updateCounted(
        db,
        Prisma.sql`UPDATE "care_notifications" SET "readAt" = ${nowIso} WHERE "userId" = ${uid} AND "readAt" IS NULL
            AND ("offerKind", "offerId") NOT IN (SELECT "offerKind", "offerId" FROM (${cand}) WHERE "ntype" IS NOT NULL)
            RETURNING "id"`,
        Prisma.sql`UPDATE "care_notifications" SET "readAt" = ${nowIso} WHERE "userId" = ${uid} AND "readAt" IS NULL
            AND ("offerKind", "offerId") NOT IN (SELECT "offerKind", "offerId" FROM (${cand}) WHERE "ntype" IS NOT NULL)`
    );
    // Retencja leniwa (brak workera w S.O.K.): przeczytane >90d precz,
    // skrzynka maks. 500 wierszy (najświeższe). Bounded inbox.
    const cutoff = new Date(Date.parse(nowIso) - 90 * 86400000).toISOString();
    const delOld = await deleteCounted(
        db,
        Prisma.sql`DELETE FROM "care_notifications" WHERE "userId" = ${uid} AND "readAt" IS NOT NULL AND "readAt" <= ${cutoff} RETURNING "id"`,
        Prisma.sql`DELETE FROM "care_notifications" WHERE "userId" = ${uid} AND "readAt" IS NOT NULL AND "readAt" <= ${cutoff}`
    );
    const delCap = await deleteCounted(
        db,
        Prisma.sql`DELETE FROM "care_notifications" WHERE "userId" = ${uid} AND "readAt" IS NOT NULL AND "id" NOT IN (SELECT "id" FROM "care_notifications" WHERE "userId" = ${uid} ORDER BY "createdAt" DESC LIMIT 500) RETURNING "id"`,
        Prisma.sql`DELETE FROM "care_notifications" WHERE "userId" = ${uid} AND "readAt" IS NOT NULL AND "id" NOT IN (SELECT "id" FROM "care_notifications" WHERE "userId" = ${uid} ORDER BY "createdAt" DESC LIMIT 500)`
    );
    return { inserted, resolved, deleted: delOld + delCap };
}

export async function listCareNotifications(
    db: RawDb,
    userId: string,
    opts: { unreadOnly?: boolean; limit?: unknown }
): Promise<{ items: CareNotification[]; unreadCount: number }> {
    const limit = clampCareLimit(opts.limit);
    // Wzbogacenie o klienta/numer (JOIN warunkowy kind) — żadnych surowych ID w UI.
    const cols = Prisma.sql`n."id", n."userId", n."offerKind", n."offerId", n."type", n."readAt", n."createdAt",
        COALESCE(o."clientName", s."clientName") AS "clientName",
        COALESCE(NULLIF(o."clientNumber", ''), NULLIF(s."clientNumber", '')) AS "clientNumber",
        COALESCE(o."offer_number", s."offer_number") AS "number",
        COALESCE(NULLIF(TRIM(COALESCE(ou."firstName", '') || ' ' || COALESCE(ou."lastName", '')), ''), ou."username", NULLIF(TRIM(COALESCE(su."firstName", '') || ' ' || COALESCE(su."lastName", '')), ''), su."username") AS "ownerName",
        COALESCE(CAST(json_extract(o."data", '$.totalBrutto') AS REAL),
            CAST(COALESCE(NULLIF(s."totalPrice", 0), json_extract(s."data", '$.totalBrutto'),
                (SELECT CAST(ROUND(COALESCE(SUM(value->>'totalPrice'), 0), 2) AS REAL)
                    FROM json_each(s."data", '$.wellsExport'))) AS REAL)) AS "value",
        COALESCE(NULLIF(o."investName", ''), NULLIF(s."investName", ''), json_extract(o."data", '$.investName'), json_extract(s."data", '$.investName'), json_extract(o."data", '$.budowa'), json_extract(s."data", '$.budowa')) AS "investName",
        COALESCE(json_extract(o."data", '$.investAddress'), json_extract(s."data", '$.investAddress')) AS "investAddress",
        COALESCE(json_extract(o."data", '$.contactPerson'), json_extract(s."data", '$.contactPerson'), json_extract(o."data", '$.clientContacts[0].name'), json_extract(s."data", '$.clientContacts[0].name')) AS "contactPerson",
        COALESCE(json_extract(o."data", '$.clientPhone'), json_extract(s."data", '$.clientPhone'), json_extract(o."data", '$.clientContacts[0].phone'), json_extract(s."data", '$.clientContacts[0].phone')) AS "phone",
        COALESCE(json_extract(o."data", '$.clientEmail'), json_extract(s."data", '$.clientEmail'), json_extract(o."data", '$.clientContacts[0].email'), json_extract(s."data", '$.clientContacts[0].email')) AS "email"
        FROM "care_notifications" n
        LEFT JOIN offers_rel o ON n."offerKind" = 'rury' AND o."id" = n."offerId"
        LEFT JOIN offers_studnie_rel s ON n."offerKind" = 'studnie' AND s."id" = n."offerId"
        LEFT JOIN users ou ON o."userId" = ou."id"
        LEFT JOIN users su ON s."userId" = su."id"`;
    const items = (await db.$queryRaw<CareNotification[]>(
        opts.unreadOnly
            ? Prisma.sql`SELECT ${cols} WHERE n."userId" = ${userId} AND n."readAt" IS NULL ORDER BY n."createdAt" DESC LIMIT ${limit}`
            : Prisma.sql`SELECT ${cols} WHERE n."userId" = ${userId} ORDER BY n."createdAt" DESC LIMIT ${limit}`
    )) as CareNotification[];
    const cnt = (await db.$queryRaw<Array<{ c: number | bigint }>>(
        Prisma.sql`SELECT COUNT(*) AS "c" FROM (SELECT 1 FROM "care_notifications" WHERE "userId" = ${userId} AND "readAt" IS NULL LIMIT ${CARE_UNREAD_CAP + 1})`
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

/** Cofnięcie odczytu własnego powiadomienia (guard owner w WHERE). Zwraca liczbę. */
export async function markCareNotificationUnread(
    db: RawDb,
    userId: string,
    notifId: string
): Promise<number> {
    const rows = (await db.$queryRaw<Array<{ c: number | bigint }>>(
        Prisma.sql`UPDATE "care_notifications" SET "readAt" = NULL WHERE "id" = ${notifId} AND "userId" = ${userId} AND "readAt" IS NOT NULL RETURNING 1 AS "c"`
    )) as Array<{ c: number | bigint }>;
    return rows.length;
}

/** Zbiorczy odczyt własnych powiadomień (1 UPDATE; „Wyczyść wszystko" w 1 requeście). */
export async function markCareNotificationsRead(
    db: RawDb,
    userId: string,
    notifIds: string[],
    nowIso: string
): Promise<number> {
    if (notifIds.length === 0) return 0;
    const rows = (await db.$queryRaw<Array<{ c: number | bigint }>>(
        Prisma.sql`UPDATE "care_notifications" SET "readAt" = ${nowIso} WHERE "userId" = ${userId} AND "readAt" IS NULL AND "id" IN (${Prisma.join(notifIds)}) RETURNING 1 AS "c"`
    )) as Array<{ c: number | bigint }>;
    return rows.length;
}
