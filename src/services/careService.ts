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
import { getFollowUpState, isEscalated } from '../utils/careStatus';
import { toNum, normalizedCreatedAtSql } from '../utils/searchUtils';
import { logger } from '../utils/logger';

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
    createdAt: string | null;
    number: string | null;
    clientName: string | null;
    value: number | null;
    phone: string | null;
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
    const scopeRury = ownerCond(user, 'o', 'offer', ownerWhere, opts.repOwner);
    const scopeStudnie = ownerCond(user, 's', 'offer_studnie', ownerWhere, opts.repOwner);
    const fuScope = followUpScope(scopeRury, scopeStudnie);
    const limit = clampCareLimit(opts.limit);
    const bornRury = bornRange('o', opts.from, opts.to);
    const bornStudnie = bornRange('s', opts.from, opts.to);
    const andBornRury = bornRury ? Prisma.sql` AND ${bornRury}` : Prisma.empty;
    const andBornStudnie = bornStudnie ? Prisma.sql` AND ${bornStudnie}` : Prisma.empty;

    // CTE latest: ta sama reguła co followUpStats.ts:52 / searchUtils.ts:241.
    const withSql = Prisma.sql`WITH latest AS (
        SELECT f."offerKind", f."offerId", f."outcome", f."nextContactAt", f."contactedAt", f."note",
            ROW_NUMBER() OVER (PARTITION BY f."offerKind", f."offerId" ORDER BY f."contactedAt" DESC, f."createdAt" DESC, f."id" DESC) AS "rn"
        FROM offer_follow_ups f WHERE ${fuScope}
    ), base AS (
        SELECT 'rury' AS "offerKind", o."id" AS "offerId", l."outcome" AS "outcome",
            l."nextContactAt" AS "next", l."contactedAt" AS "last", o."createdAt" AS "born",
            o."offer_number" AS "number", o."clientName" AS "client",
            CAST(json_extract(o."data", '$.totalBrutto') AS REAL) AS "value",
            json_extract(o."data", '$.clientPhone') AS "phone", l."note" AS "note",
            cs."snoozedUntil" AS "snoozed", cs."doneAt" AS "done",
            cs."updatedAt" AS "careUpdatedAt"
        FROM offers_rel o LEFT JOIN latest l
            ON l."offerKind" = 'rury' AND l."offerId" = o."id" AND l."rn" = 1
        LEFT JOIN care_states cs
            ON cs."offerKind" = 'rury' AND cs."offerId" = o."id"
        WHERE ${scopeRury}${andBornRury}
        UNION ALL
        SELECT 'studnie' AS "offerKind", s."id" AS "offerId", l."outcome" AS "outcome",
            l."nextContactAt" AS "next", l."contactedAt" AS "last", s."createdAt" AS "born",
            s."offer_number" AS "number", s."clientName" AS "client",
            -- Guard 0-kolumny (zapis studni bez totalPrice): niezerowa kolumna
            -- > blob.totalBrutto > suma wellsExport (jak search.ts d_wellsExportTotal).
            CAST(COALESCE(NULLIF(s."totalPrice", 0), json_extract(s."data", '$.totalBrutto'),
                (SELECT CAST(ROUND(COALESCE(SUM(value->>'totalPrice'), 0), 2) AS REAL)
                    FROM json_each(s."data", '$.wellsExport'))) AS REAL) AS "value",
            json_extract(s."data", '$.clientPhone') AS "phone", l."note" AS "note",
            cs."snoozedUntil" AS "snoozed", cs."doneAt" AS "done",
            cs."updatedAt" AS "careUpdatedAt"
        FROM offers_studnie_rel s LEFT JOIN latest l
            ON l."offerKind" = 'studnie' AND l."offerId" = s."id" AND l."rn" = 1
        LEFT JOIN care_states cs
            ON cs."offerKind" = 'studnie' AND cs."offerId" = s."id"
        WHERE ${scopeStudnie}${andBornStudnie}
    ), ranked AS (
        SELECT "offerKind", "offerId", "outcome", "next", "last", "born",
            "number", "client", "value", "phone", "note", "snoozed", "done", "careUpdatedAt",
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
            "number", "client", "value", "phone", "note",
            "snoozed", "done", "careUpdatedAt", "bucketWeight" FROM ranked
        WHERE ${cursorSql}${opts.hidePaused ? Prisma.sql` AND "done" IS NULL AND ("snoozed" IS NULL OR "snoozed" <= ${opts.nowIso})` : Prisma.empty}
        ORDER BY "bucketWeight" ASC, COALESCE("next", ${NULL_NEXT}) ASC, "offerKind" ASC, "offerId" ASC
        LIMIT ${limit + 1}`;
    const count = Prisma.sql`${withSql}
        SELECT COUNT(DISTINCT "offerKind" || ':' || "offerId") AS "c" FROM ranked${opts.hidePaused ? Prisma.sql` WHERE "done" IS NULL AND ("snoozed" IS NULL OR "snoozed" <= ${opts.nowIso})` : Prisma.empty}`;
    return { data, count };
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
    const fuScope = followUpScope(scopeRury, scopeStudnie);
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
    const withSql = Prisma.sql`WITH latest AS (
        SELECT f."offerKind", f."offerId", f."outcome", f."nextContactAt", f."contactedAt",
            ROW_NUMBER() OVER (PARTITION BY f."offerKind", f."offerId" ORDER BY f."contactedAt" DESC, f."createdAt" DESC, f."id" DESC) AS "rn"
        FROM offer_follow_ups f WHERE ${fuScope}
    ), base AS (
        SELECT 'rury' AS "offerKind", o."id" AS "offerId", l."outcome" AS "outcome",
            l."nextContactAt" AS "next", l."contactedAt" AS "last"
        FROM offers_rel o LEFT JOIN latest l
            ON l."offerKind" = 'rury' AND l."offerId" = o."id" AND l."rn" = 1
        LEFT JOIN care_states cs ON cs."offerKind" = 'rury' AND cs."offerId" = o."id"
        WHERE ${scopeRury}${pauseRury}${andBornRury}
        UNION ALL
        SELECT 'studnie' AS "offerKind", s."id" AS "offerId", l."outcome" AS "outcome",
            l."nextContactAt" AS "next", l."contactedAt" AS "last"
        FROM offers_studnie_rel s LEFT JOIN latest l
            ON l."offerKind" = 'studnie' AND l."offerId" = s."id" AND l."rn" = 1
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
                born: string | null;
                number: string | null;
                client: string | null;
                value: number | null;
                phone: string | null;
                note: string | null;
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
    return {
        items: items.map((r) => ({
            offerKind: r.offerKind,
            offerId: r.offerId,
            outcome: r.outcome,
            nextContactAt: r.next,
            lastContactAt: r.last,
            createdAt: r.born,
            number: r.number,
            clientName: r.client,
            value: typeof r.value === 'number' ? r.value : null,
            phone: r.phone,
            lastNote: r.note,
            bucketWeight: num(r.bucketWeight),
            snoozedUntil: r.snoozed,
            doneAt: r.done,
            careUpdatedAt: r.careUpdatedAt ?? null
        })),
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
    value: number | null;
    phone: string | null;
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
            value: r.value ?? null,
            phone: r.phone ?? null,
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

/** ETag panelu: 1 statement ze skrajnymi znacznikami (scope + user w haśle route).
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
        r.l ?? null
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

export async function setScopedSla(
    db: RawDb,
    cfg: SlaConfig & { scopeType: SlaScopeType; scopeId: string; updatedBy: string; nowIso: string }
): Promise<SlaConfig> {
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
    number: string | null;
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
        WHERE ${rury} AND (cs."offerId" IS NULL OR (cs."doneAt" IS NULL AND (cs."snoozedUntil" IS NULL OR cs."snoozedUntil" <= ${nowIso})))
        UNION ALL
        SELECT 'studnie' AS "offerKind", s."id" AS "offerId", s."userId" AS "ownerId",
            l."outcome" AS "outcome", l."nextContactAt" AS "next", s."createdAt" AS "born"
        FROM offers_studnie_rel s LEFT JOIN latest l
            ON l."offerKind" = 'studnie' AND l."offerId" = s."id" AND l."rn" = 1
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
    skipped?: 'rep-preview';
    /** F3: ile wierszy zdjela retencja w tym syncu (additive). */
    deleted?: number;
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
        COALESCE(o."offer_number", s."offer_number") AS "number"
        FROM "care_notifications" n
        LEFT JOIN offers_rel o ON n."offerKind" = 'rury' AND o."id" = n."offerId"
        LEFT JOIN offers_studnie_rel s ON n."offerKind" = 'studnie' AND s."id" = n."offerId"`;
    const items = (await db.$queryRaw<CareNotification[]>(
        opts.unreadOnly
            ? Prisma.sql`SELECT ${cols} WHERE n."userId" = ${userId} AND n."readAt" IS NULL ORDER BY n."createdAt" DESC LIMIT ${limit}`
            : Prisma.sql`SELECT ${cols} WHERE n."userId" = ${userId} ORDER BY n."createdAt" DESC LIMIT ${limit}`
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
