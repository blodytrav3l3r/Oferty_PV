/**
 * pricelist/usage — użycie wersji przez oferty/zamówienia, resolveActive
 * + freeze ofert (null-safe) + centralny resolver cen ACTIVE w kształcie
 * LEGACY. Kod przeniesiony 1:1 z pricelistVersionService.ts (F3/Paczka 1).
 */

import prisma from '../../prismaClient';
import { logger } from '../../utils/logger';
import type { PricelistVersion } from '../../../generated/prisma';
import { RESOLVABLE_STATUSES, requireType, toUtcIso } from './validation';
import type { PricelistType, Tx } from './validation';
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
 * Deterministyczne resolveActive: kandydaci ACTIVE/BACKDATE z
 * effectiveFrom <= at, sort effectiveFrom DESC, seq DESC, LIMIT 1.
 * Dokładnie 1 wersja albo null dla każdego at.
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
