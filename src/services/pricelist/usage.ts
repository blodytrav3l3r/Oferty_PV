/**
 * pricelist/usage — użycie wersji przez oferty/zamówienia, resolveActive
 * + freeze ofert (null-safe) + centralny resolver cen ACTIVE w kształcie
 * LEGACY. Kod przeniesiony 1:1 z pricelistVersionService.ts (F3/Paczka 1).
 */

import prisma from '../../prismaClient';
import { logger } from '../../utils/logger';
import type { PricelistVersion } from '../../../generated/prisma';
import {
    PRICELIST_TYPES,
    RESOLVABLE_STATUSES,
    deriveState,
    requireType,
    toUtcIso
} from './validation';
import type { PricelistState, PricelistType, Tx } from './validation';
import { getVersionExport, pickPrecoVersionFromTimeline } from './export';
import { buildPrecoEntryFromSections, cmpText, studnieVersionRowToLegacy } from './liveProjection';

export interface VersionUsage {
    offers: number;
    orders: number;
    total: number;
}

interface UsageCounter {
    count(args: { where: { pricelistVersionId: string } }): Promise<number>;
}

export interface UsageClient {
    offers_rel: UsageCounter;
    offers_studnie_rel: UsageCounter;
    orders_rury_rel: UsageCounter;
    orders_studnie_rel: UsageCounter;
}

interface UsageGroupRow {
    pricelistVersionId: string | null;
    _count: { _all: number };
}

interface UsageGroupBy {
    groupBy(args: {
        by: ['pricelistVersionId'];
        where: { pricelistVersionId: { in: string[] } };
        _count: { _all: true };
    }): Promise<UsageGroupRow[]>;
}

export interface UsageBatchClient {
    offers_rel: UsageGroupBy;
    offers_studnie_rel: UsageGroupBy;
    orders_rury_rel: UsageGroupBy;
    orders_studnie_rel: UsageGroupBy;
}

/** Ile ofert/zamówień trzyma pieczątkę danej wersji (4× count po pricelistVersionId). */
export async function countUsage(client: UsageClient, id: string): Promise<VersionUsage> {
    const where = { where: { pricelistVersionId: id } };
    const [o1, o2, r1, r2] = await Promise.all([
        client.offers_rel.count(where),
        client.offers_studnie_rel.count(where),
        client.orders_rury_rel.count(where),
        client.orders_studnie_rel.count(where)
    ]);
    const offers = o1 + o2;
    const orders = r1 + r2;
    return { offers, orders, total: offers + orders };
}

/** Użycie wersji przez oferty/zamówienia (publiczne — pod GET / usedBy). */
export async function countVersionUsage(id: string): Promise<VersionUsage> {
    return countUsage(prisma as unknown as UsageClient, id);
}

/**
 * F1: użycie wielu wersji w 4 zapytaniach (groupBy), nie 4×N.
 * Zwraca mapę id → liczby; brak wiersza = zera.
 */
export async function countUsageBatch(
    client: UsageBatchClient,
    ids: string[]
): Promise<Map<string, VersionUsage>> {
    const result = new Map<string, VersionUsage>();
    const unique = [...new Set(ids.filter(Boolean))];
    if (unique.length === 0) return result;
    const where = { pricelistVersionId: { in: unique } };
    const args: Parameters<UsageGroupBy['groupBy']>[0] = {
        by: ['pricelistVersionId'],
        where,
        _count: { _all: true }
    };
    const [o1, o2, r1, r2] = await Promise.all([
        client.offers_rel.groupBy(args),
        client.offers_studnie_rel.groupBy(args),
        client.orders_rury_rel.groupBy(args),
        client.orders_studnie_rel.groupBy(args)
    ]);
    const add = (rows: UsageGroupRow[], key: 'offers' | 'orders') => {
        for (const row of rows) {
            if (!row.pricelistVersionId) continue;
            const entry = result.get(row.pricelistVersionId) ?? { offers: 0, orders: 0, total: 0 };
            entry[key] += row._count._all;
            entry.total = entry.offers + entry.orders;
            result.set(row.pricelistVersionId, entry);
        }
    };
    add(o1, 'offers');
    add(o2, 'offers');
    add(r1, 'orders');
    add(r2, 'orders');
    return result;
}

/** Batch użycia przez prisma (publiczne — pod GET / usedBy). */
export async function countVersionUsageBatch(ids: string[]): Promise<Map<string, VersionUsage>> {
    return countUsageBatch(prisma as unknown as UsageBatchClient, ids);
}

export interface PrecoReferenceInfo {
    count: number;
    labels: string[];
}

type PrecoReferencesClient = {
    pricelistVersion: Pick<Tx['pricelistVersion'], 'findMany'>;
};

/**
 * Mapuje id PRECO → liczba wersji studni, które ją wybierają (D1), plus max
 * 3 labelki do komunikatu. Jedna para zapytań zamiast N+1 — używane przez
 * GET / i guard DELETE.
 */
export async function getPrecoReferences(
    client: PrecoReferencesClient = prisma
): Promise<Map<string, PrecoReferenceInfo>> {
    const [studnieVersions, precoVersions] = await Promise.all([
        client.pricelistVersion.findMany({
            where: { type: 'studnie' },
            select: { id: true, version: true, seq: true, status: true, effectiveFrom: true }
        }),
        client.pricelistVersion.findMany({
            where: { type: 'preco' },
            select: { id: true, version: true, seq: true, status: true, effectiveFrom: true }
        })
    ]);
    const references = new Map<string, PrecoReferenceInfo>();
    for (const studnie of studnieVersions) {
        const picked = pickPrecoVersionFromTimeline(studnie, precoVersions);
        if (!picked) continue;
        const entry = references.get(picked.id) ?? { count: 0, labels: [] };
        entry.count += 1;
        if (entry.labels.length < 3) entry.labels.push(studnie.version);
        references.set(picked.id, entry);
    }
    return references;
}

/**
 * Deterministyczne resolveActive: najnowsza APPROVED z effectiveFrom <= at,
 * sort effectiveFrom DESC, seq DESC, LIMIT 1. Dokładnie 1 wersja albo null.
 */
export async function resolveActive(
    typeInput: unknown,
    at?: string
): Promise<PricelistVersion | null> {
    const type = requireType(typeInput);
    const atIso = at === undefined ? new Date().toISOString() : toUtcIso(at, 'at');
    return prisma.pricelistVersion.findFirst({
        where: {
            type,
            status: { in: [...RESOLVABLE_STATUSES] },
            effectiveFrom: { lte: atIso }
        },
        orderBy: [{ effectiveFrom: 'desc' }, { seq: 'desc' }]
    });
}

/** Minimalna referencja wersji w `/summary` (bez sha/createdBy/note). */
export interface VersionSummaryRef {
    id: string;
    version: string;
    seq: number;
    effectiveFrom: string;
    status: string;
    state: PricelistState;
}

export interface VersionsSummaryType {
    active: VersionSummaryRef | null;
    nextScheduled: VersionSummaryRef | null;
    draftCount: number;
    approvedCount: number;
    collisionCount: number;
}

export interface VersionsSummary {
    generatedAt: string;
    types: Record<PricelistType, VersionsSummaryType>;
}

const SUMMARY_REF_SELECT = {
    id: true,
    version: true,
    seq: true,
    effectiveFrom: true,
    status: true
} as const;

function toSummaryRef(
    version: Pick<PricelistVersion, 'id' | 'version' | 'seq' | 'effectiveFrom' | 'status'>
): VersionSummaryRef {
    return {
        id: version.id,
        version: version.version,
        seq: version.seq,
        effectiveFrom: version.effectiveFrom,
        status: version.status,
        state: deriveState(version.status, version.effectiveFrom)
    };
}

/** Najwcześniejsza przyszła APPROVED (effectiveFrom ASC, seq ASC) — 1 zapytanie. */
async function nextScheduledFor(
    type: PricelistType,
    now: string
): Promise<VersionSummaryRef | null> {
    const version = await prisma.pricelistVersion.findFirst({
        where: { type, status: 'APPROVED', effectiveFrom: { gt: now } },
        orderBy: [{ effectiveFrom: 'asc' }, { seq: 'asc' }],
        select: SUMMARY_REF_SELECT
    });
    return version ? toSummaryRef(version) : null;
}

/**
 * Skrót stanu 3 cenników: aktywna (resolveActive) + najbliższa przyszła
 * APPROVED + liczniki. 6 zapytań resolverów + 1 odczyt do liczników.
 */
export async function getVersionsSummary(): Promise<VersionsSummary> {
    const generatedAt = new Date().toISOString();
    const [entries, counterRows] = await Promise.all([
        Promise.all(
            PRICELIST_TYPES.map(async (type) => {
                const [active, nextScheduled] = await Promise.all([
                    resolveActive(type, generatedAt),
                    nextScheduledFor(type, generatedAt)
                ]);
                return [type, { active, nextScheduled }] as const;
            })
        ),
        prisma.pricelistVersion.findMany({
            select: { type: true, status: true, effectiveFrom: true }
        })
    ]);

    const counts = new Map<
        string,
        { draft: number; approved: number; dates: Set<string>; dup: Set<string> }
    >();
    for (const row of counterRows) {
        const bucket = counts.get(row.type) ?? {
            draft: 0,
            approved: 0,
            dates: new Set<string>(),
            dup: new Set<string>()
        };
        if (row.status === 'DRAFT') {
            bucket.draft += 1;
        } else if (row.status === 'APPROVED') {
            bucket.approved += 1;
            if (bucket.dates.has(row.effectiveFrom)) bucket.dup.add(row.effectiveFrom);
            else bucket.dates.add(row.effectiveFrom);
        }
        counts.set(row.type, bucket);
    }

    return {
        generatedAt,
        types: Object.fromEntries(
            entries.map(([type, { active, nextScheduled }]) => {
                const bucket = counts.get(type);
                return [
                    type,
                    {
                        active: active ? toSummaryRef(active) : null,
                        nextScheduled,
                        draftCount: bucket?.draft ?? 0,
                        approvedCount: bucket?.approved ?? 0,
                        collisionCount: bucket?.dup.size ?? 0
                    }
                ];
            })
        ) as VersionsSummary['types']
    };
}

/**
 * Null-safe freeze: id aktywnej wersji w chwili utworzenia oferty.
 * Null gdy brak wersji (legacy) albo błąd odczytu — oferta i tak powstaje,
 * snapshot cen w JSON jest źródłem prawdy (Expand & Contract).
 */
export async function resolveVersionIdSafe(typeInput: unknown): Promise<string | null> {
    try {
        const active = await resolveActive(typeInput);
        return active?.id ?? null;
    } catch (e) {
        // Null = brak pieczątki (oferta i tak powstaje). Log, żeby błąd odczytu
        // wersji nie zniknął całkowicie — bez tego freeze psułby się niemo.
        logger.warn(
            'Pricelist',
            'resolveVersionIdSafe: błąd odczytu aktywnej wersji — brak pieczątki',
            String(e)
        );
        return null;
    }
}

export interface ActivePricing {
    /** Zawartość pola `data` w response (rury/studnie: wiersze; preco: [entry]). */
    data: unknown;
    /** true = brak ACTIVE, trasa czyta LIVE + stawia X-Pricelist-Fallback: live. */
    fallback: boolean;
    versionId: string | null;
}

/**
 * Ceny z wersji ACTIVE w kształcie LEGACY. Brak ACTIVE → fallback (data null,
 * trasa czyta LIVE jak dziś). Jedyny switch per-type w paczce.
 */
export async function resolveActivePricing(typeInput: unknown): Promise<ActivePricing> {
    const type: PricelistType = requireType(typeInput);
    const active = await resolveActive(type);
    if (!active) return { data: null, fallback: true, versionId: null };
    const { sections } = await getVersionExport(active.id);
    if (type === 'rury') {
        const rows = [...(sections.rury ?? [])].sort(
            (a, b) => cmpText(a.category, b.category) || cmpText(a.id, b.id)
        );
        return { data: rows, fallback: false, versionId: active.id };
    }
    if (type === 'studnie') {
        const rows = [...(sections.studnie ?? [])]
            .sort(
                (a, b) =>
                    cmpText(a.category, b.category) ||
                    cmpText(a.componentType, b.componentType) ||
                    cmpText(a.id, b.id)
            )
            .map(studnieVersionRowToLegacy);
        return { data: rows, fallback: false, versionId: active.id };
    }
    const entry = buildPrecoEntryFromSections(sections);
    return {
        data: Object.keys(entry).length > 0 ? [entry] : [{}],
        fallback: false,
        versionId: active.id
    };
}
