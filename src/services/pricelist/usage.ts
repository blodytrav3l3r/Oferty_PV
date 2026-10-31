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
 *
 * Ręczne ustawienie (settings `pricelist_active_override_<typ>`) ma
 * pierwszeństwo — ale tylko dla bieżącego czasu (bez `at`), żeby historyczne
 * rozstrzygnięcia (pieczątki, PRECO w wersjach studni) zostały czysto czasowe.
 */
export async function resolveActive(
    typeInput: unknown,
    at?: string
): Promise<PricelistVersion | null> {
    const type = requireType(typeInput);
    const atIso = at === undefined ? new Date().toISOString() : toUtcIso(at, 'at');
    if (at === undefined) {
        const pinned = await readActiveOverride(type);
        if (pinned) {
            const picked = await prisma.pricelistVersion.findFirst({
                where: {
                    id: pinned,
                    type,
                    status: { in: [...RESOLVABLE_STATUSES] },
                    effectiveFrom: { lte: atIso }
                }
            });
            if (picked) return picked;
        }
    }
    return prisma.pricelistVersion.findFirst({
        where: {
            type,
            status: { in: [...RESOLVABLE_STATUSES] },
            effectiveFrom: { lte: atIso }
        },
        orderBy: [{ effectiveFrom: 'desc' }, { seq: 'desc' }]
    });
}

/** Klucz ustawienia z ręcznie wybranym cennikiem obowiązującym dla osi. */
export function activeOverrideKey(type: PricelistType): string {
    return 'pricelist_active_override_' + type;
}

/** Id wersji wskazanej ręcznie jako obowiązująca (null = brak). */
export async function readActiveOverride(type: PricelistType): Promise<string | null> {
    const row = await prisma.settings.findUnique({ where: { key: activeOverrideKey(type) } });
    const value = row?.value;
    return typeof value === 'string' && value.length > 0 ? value : null;
}

/** Mapa ręcznych wyborów dla wszystkich osi (dla GET / listy wersji). */
export async function readActiveOverrides(): Promise<Record<PricelistType, string | null>> {
    const rows = await prisma.settings.findMany({
        where: { key: { in: PRICELIST_TYPES.map(activeOverrideKey) } }
    });
    const out = {} as Record<PricelistType, string | null>;
    for (const type of PRICELIST_TYPES) out[type] = null;
    for (const row of rows) {
        const type = PRICELIST_TYPES.find((t) => activeOverrideKey(t) === row.key);
        if (type && typeof row.value === 'string' && row.value.length > 0) out[type] = row.value;
    }
    return out;
}

/** Minimalna referencja wersji w `/summary` (bez sha/createdBy/note). */
export interface VersionSummaryRef {
    id: string;
    version: string;
    seq: number;
    effectiveFrom: string;
    status: string;
    state: PricelistState;
    /** Ostatnia zmiana wersji (szkic: zapis, zatwierdzona: publikacja). ISO UTC. */
    updatedAt: string | null;
    /** Hash wierszy — klient odsyła go w `If-Match` przy zapisie szkicu. */
    sha256: string;
}

export interface VersionsSummaryType {
    active: VersionSummaryRef | null;
    nextScheduled: VersionSummaryRef | null;
    /** Najnowszy szkic (DRAFT) typu — null gdy brak. Info dla paska stanu w edytorze. */
    draft: VersionSummaryRef | null;
    draftCount: number;
    approvedCount: number;
    /** Wersje wypchnięte z osi (ARCHIVED = zatwierdzone z datą ≤ teraz minus obowiązująca). */
    archivedCount: number;
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
    status: true,
    updatedAt: true,
    sha256: true
} as const;

function toSummaryRef(
    version: Pick<
        PricelistVersion,
        'id' | 'version' | 'seq' | 'effectiveFrom' | 'status' | 'updatedAt' | 'sha256'
    >
): VersionSummaryRef {
    return {
        id: version.id,
        version: version.version,
        seq: version.seq,
        effectiveFrom: version.effectiveFrom,
        status: version.status,
        state: deriveState(version.status, version.effectiveFrom),
        updatedAt: version.updatedAt ?? null,
        sha256: version.sha256
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

/** Najnowszy szkic (DRAFT) typu — 1 zapytanie (createdAt DESC). */
async function latestDraftFor(type: PricelistType): Promise<VersionSummaryRef | null> {
    const version = await prisma.pricelistVersion.findFirst({
        where: { type, status: 'DRAFT' },
        orderBy: [{ createdAt: 'desc' }, { seq: 'desc' }],
        select: SUMMARY_REF_SELECT
    });
    return version ? toSummaryRef(version) : null;
}

/**
 * Liczba wersji archiwalnych typu: zatwierdzone z datą mniejszą niż najnowsza
 * zatwierdzona (ta sama reguła co `deriveState` → ARCHIVED). Wersje o tej samej
 * dacie co obowiązująca NIE są archiwalne (kolizja dat = obie obowiązujące).
 */
function countArchived(pastDates: string[], maxPast: string): number {
    if (!maxPast) return 0;
    return pastDates.filter((date) => date < maxPast).length;
}

/**
 * Skrót stanu 3 cenników: aktywna (resolveActive) + najbliższa przyszła
 * APPROVED + liczniki. 6 zapytań resolverów + 1 odczyt do liczników.
 *
 * `active` bez `at` — ręczny wybór admina (override) musi być widoczny w UI,
 * bo to on realnie liczy nowe oferty. `generatedAt` służy tylko osi czasu.
 */
export async function getVersionsSummary(): Promise<VersionsSummary> {
    const generatedAt = new Date().toISOString();
    const [entries, counterRows] = await Promise.all([
        Promise.all(
            PRICELIST_TYPES.map(async (type) => {
                const [active, nextScheduled, draft] = await Promise.all([
                    resolveActive(type),
                    nextScheduledFor(type, generatedAt),
                    latestDraftFor(type)
                ]);
                return [type, { active, nextScheduled, draft }] as const;
            })
        ),
        prisma.pricelistVersion.findMany({
            select: { type: true, status: true, effectiveFrom: true }
        })
    ]);

    const counts = new Map<
        string,
        {
            draft: number;
            approved: number;
            pastDates: string[];
            dates: Set<string>;
            dup: Set<string>;
        }
    >();
    for (const row of counterRows) {
        const bucket = counts.get(row.type) ?? {
            draft: 0,
            approved: 0,
            pastDates: [],
            dates: new Set<string>(),
            dup: new Set<string>()
        };
        if (row.status === 'DRAFT') {
            bucket.draft += 1;
        } else if (row.status === 'APPROVED') {
            bucket.approved += 1;
            // Zatwierdzona z datą ≤ teraz: obowiązująca albo archiwalna.
            if (row.effectiveFrom <= generatedAt) bucket.pastDates.push(row.effectiveFrom);
            if (bucket.dates.has(row.effectiveFrom)) bucket.dup.add(row.effectiveFrom);
            else bucket.dates.add(row.effectiveFrom);
        }
        counts.set(row.type, bucket);
    }

    return {
        generatedAt,
        types: Object.fromEntries(
            entries.map(([type, { active, nextScheduled, draft }]) => {
                const bucket = counts.get(type);
                return [
                    type,
                    {
                        active: active ? toSummaryRef(active) : null,
                        nextScheduled,
                        draft: draft ? toSummaryRef(draft) : null,
                        draftCount: bucket?.draft ?? 0,
                        approvedCount: bucket?.approved ?? 0,
                        // Archiwalne = zatwierdzone starsze od najnowszej zatwierdzonej
                        // (jak deriveState). Nie zależy od pinu — pin zmienia tylko `active`.
                        archivedCount: countArchived(
                            bucket?.pastDates ?? [],
                            (bucket?.pastDates ?? []).reduce((a, b) => (a > b ? a : b), '')
                        ),
                        collisionCount: bucket?.dup.size ?? 0
                    }
                ];
            })
        ) as VersionsSummary['types']
    };
}

/**
 * Null-safe freeze z rozróżnieniem przyczyny: brak ACTIVE (oferta nie ma z czego
 * wycenić → 409) vs błąd odczytu (przejściowy → 503). Wcześniejszy
 * `resolveVersionIdSafe` zwracał null w obu przypadkach, więc nowa oferta bez
 * cennika zapisywała się z `pricelistVersionId = null`.
 */
export interface ActiveStamp {
    id: string | null;
    /** true = odczyt cennika padł (błąd DB), nie mylić z brakiem wersji. */
    failed: boolean;
}

export async function resolveActiveForStamp(typeInput: unknown): Promise<ActiveStamp> {
    try {
        const active = await resolveActive(typeInput);
        return { id: active?.id ?? null, failed: false };
    } catch (e) {
        logger.error('Pricelist', 'resolveActiveForStamp: błąd odczytu aktywnej wersji', String(e));
        return { id: null, failed: true };
    }
}

/**
 * Null-safe freeze: id aktywnej wersji w chwili utworzenia oferty.
 * Null gdy brak wersji (legacy) albo błąd odczytu. Do zapisu ofert używaj
 * `resolveActiveForStamp` — tam brak wersji i błąd muszą być rozróżnione.
 */
export async function resolveVersionIdSafe(typeInput: unknown): Promise<string | null> {
    return (await resolveActiveForStamp(typeInput)).id;
}

/**
 * Numer cennika, którego dotyczy eksport z edytora: bieżący szkic (to on jest
 * zapisywany), a bez szkicu — wersja obowiązująca. Null = brak jakiejkolwiek
 * wersji (eksport dostaje wtedy nazwę ogólną).
 */
export async function currentPricelistLabel(typeInput: unknown): Promise<string | null> {
    const type = requireType(typeInput);
    const draft = await latestDraftFor(type);
    if (draft) return draft.version;
    const active = await resolveActive(type);
    return active?.version ?? null;
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
    return pricingFromVersion(type, active);
}

/** Wiersze dowolnej wersji w formacie LEGACY (draft do edytora, active do ofert). */
export async function pricingFromVersion(
    typeInput: unknown,
    version: Pick<PricelistVersion, 'id'>
): Promise<ActivePricing> {
    const type: PricelistType = requireType(typeInput);
    const { sections } = await getVersionExport(version.id);
    if (type === 'rury') {
        const rows = [...(sections.rury ?? [])].sort(
            (a, b) => cmpText(a.category, b.category) || cmpText(a.id, b.id)
        );
        return { data: rows, fallback: false, versionId: version.id };
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
        return { data: rows, fallback: false, versionId: version.id };
    }
    const entry = buildPrecoEntryFromSections(sections);
    return {
        data: Object.keys(entry).length > 0 ? [entry] : [{}],
        fallback: false,
        versionId: version.id
    };
}
