import { roundMoney } from '../utils/money';

const MAX_TRANSPORT_WEIGHT = 24000;

export interface RuryTransportAllocationSegment {
    quantity: number;
    transportCentsPerUnit: number;
}

export interface RuryTransportAllocationItem {
    itemUid: string;
    totalCents: number;
    segments?: RuryTransportAllocationSegment[];
}

export interface RuryTransportAllocation {
    version: 1;
    items: RuryTransportAllocationItem[];
}

export interface RuryTransportProjectionItem extends RuryTransportAllocationItem {
    index: number;
}

/** Flaga osobnej pozycji transportu (DB trzyma boolean | 1 | '1'). */
export function isRuryTransportSeparateFlag(value: unknown): boolean {
    return value === true || value === 1 || value === '1';
}

function toCents(amount: unknown): number {
    return Math.max(0, Math.round(roundMoney(amount) * 100));
}

function getWeight(item: Record<string, unknown>): number {
    if (item.autoAdded) return 0;
    const weight = Number(item.weight ?? 0);
    const quantity = Number(item.quantity ?? 0);
    return Number.isFinite(weight) && Number.isFinite(quantity) && weight > 0 && quantity > 0
        ? weight * quantity
        : 0;
}

function getQuantityWeight(item: Record<string, unknown>): number {
    if (item.autoAdded) return 0;
    const quantity = Number(item.quantity ?? 0);
    return Number.isFinite(quantity) && quantity > 0 ? quantity : 0;
}

function buildSegments(
    totalCents: number,
    quantity: number
): RuryTransportAllocationSegment[] | undefined {
    if (!Number.isInteger(quantity) || quantity <= 0) return undefined;
    const floorCents = Math.floor(totalCents / quantity);
    const remainder = totalCents % quantity;
    if (remainder === 0) return [{ quantity, transportCentsPerUnit: floorCents }];
    return [
        { quantity: quantity - remainder, transportCentsPerUnit: floorCents },
        { quantity: remainder, transportCentsPerUnit: floorCents + 1 }
    ];
}

function validStoredAllocation(
    allocation: unknown,
    items: Array<Record<string, unknown>>,
    totalCents: number
): RuryTransportProjectionItem[] | null {
    if (!allocation || typeof allocation !== 'object') return null;
    const candidate = allocation as Partial<RuryTransportAllocation>;
    if (candidate.version !== 1 || !Array.isArray(candidate.items)) return null;
    const sourceByUid = new Map<string, number>();
    items.forEach((item, index) => {
        if (typeof item.uid === 'string' && item.uid) sourceByUid.set(item.uid, index);
    });
    if (
        sourceByUid.size !== items.filter((item) => typeof item.uid === 'string' && item.uid).length
    )
        return null;
    const seen = new Set<string>();
    const projected: RuryTransportProjectionItem[] = [];
    let allocatedCents = 0;
    for (const entry of candidate.items) {
        if (!entry || typeof entry.itemUid !== 'string' || !sourceByUid.has(entry.itemUid))
            return null;
        const index = sourceByUid.get(entry.itemUid)!;
        const quantity = Number(items[index].quantity ?? 1);
        if (
            seen.has(entry.itemUid) ||
            !Number.isInteger(entry.totalCents) ||
            entry.totalCents < 0 ||
            !Number.isFinite(quantity) ||
            quantity <= 0
        )
            return null;
        seen.add(entry.itemUid);
        if (Number.isInteger(quantity)) {
            if (
                !Array.isArray(entry.segments) ||
                entry.segments.length === 0 ||
                entry.segments.length > 2
            )
                return null;
            if (
                entry.segments.some(
                    (segment) =>
                        !segment ||
                        typeof segment !== 'object' ||
                        Array.isArray(segment) ||
                        !Number.isInteger(segment.quantity) ||
                        segment.quantity <= 0 ||
                        !Number.isInteger(segment.transportCentsPerUnit) ||
                        segment.transportCentsPerUnit < 0
                )
            )
                return null;
            const segmentQuantity = entry.segments.reduce(
                (sum, segment) => sum + segment.quantity,
                0
            );
            const segmentCents = entry.segments.reduce(
                (sum, segment) => sum + segment.quantity * segment.transportCentsPerUnit,
                0
            );
            if (segmentQuantity !== quantity || segmentCents !== entry.totalCents) return null;
        } else if (entry.segments !== undefined) {
            return null;
        }
        allocatedCents += entry.totalCents;
        projected.push({ ...entry, index });
    }
    return allocatedCents === totalCents ? projected : null;
}

/** Returns total cents only when a saved allocation is internally consistent for the source items. */
export function getValidRuryTransportAllocationTotalCents(
    items: Array<Record<string, unknown>>,
    allocation: unknown
): number | null {
    if (items.some((item) => !item || typeof item !== 'object' || Array.isArray(item))) return null;
    if (!allocation || typeof allocation !== 'object') return null;
    const candidate = allocation as Partial<RuryTransportAllocation>;
    if (
        candidate.version !== 1 ||
        !Array.isArray(candidate.items) ||
        candidate.items.some(
            (entry) =>
                !entry ||
                typeof entry.itemUid !== 'string' ||
                !Number.isInteger(entry.totalCents) ||
                entry.totalCents < 0
        )
    ) {
        return null;
    }
    const totalCents = candidate.items.reduce((sum, entry) => sum + entry.totalCents, 0);
    return validStoredAllocation(allocation, items, totalCents) ? totalCents : null;
}

/**
 * Czysta projekcja alokacji transportu. Najpierw respektuje poprawną alokację
 * zapisaną po UID; dla historycznych dokumentów dzieli koszt metodą największej
 * reszty i nie zmienia wejściowych danych.
 */
export function projectRuryTransportAllocation(
    items: Array<Record<string, unknown>>,
    transportTotal: number,
    storedAllocation?: unknown
): RuryTransportProjectionItem[] {
    const totalCents = toCents(transportTotal);
    const stored = validStoredAllocation(storedAllocation, items, totalCents);
    if (stored) return stored;
    let weights = items.map(getWeight);
    let totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    if (totalCents <= 0) return [];
    if (totalWeight <= 0) {
        weights = items.map(getQuantityWeight);
        totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    }
    if (totalWeight <= 0) return [];
    const raw = weights.map((weight) => (weight / totalWeight) * totalCents);
    const cents = raw.map(Math.floor);
    let remainder = totalCents - cents.reduce((sum, value) => sum + value, 0);
    const tieBreak = items.map((item, index) => ({
        index,
        uid: typeof item.uid === 'string' ? item.uid : ''
    }));
    const ranked = raw
        .map((value, index) => ({ fraction: value - Math.floor(value), ...tieBreak[index] }))
        .filter((entry) => weights[entry.index] > 0)
        .sort((a, b) => {
            const uidOrder = a.uid < b.uid ? -1 : a.uid > b.uid ? 1 : 0;
            return b.fraction - a.fraction || uidOrder || a.index - b.index;
        });
    for (let i = 0; i < remainder; i++) cents[ranked[i % ranked.length].index]++;
    return cents.flatMap((allocatedCents, index) => {
        if (allocatedCents <= 0 || weights[index] <= 0) return [];
        const uid = typeof items[index].uid === 'string' ? String(items[index].uid) : '';
        return [
            {
                itemUid: uid,
                index,
                totalCents: allocatedCents,
                ...(buildSegments(allocatedCents, Number(items[index].quantity ?? 1))
                    ? {
                          segments: buildSegments(
                              allocatedCents,
                              Number(items[index].quantity ?? 1)
                          )
                      }
                    : {})
            }
        ];
    });
}

/** Zgodność dla istniejących konsumentów: udziały w PLN, już wyrównane do grosza. */
export function distributeRuryTransportCost(
    items: Array<Record<string, unknown>>,
    transportTotal: number
): number[] {
    const shares = items.map(() => 0);
    for (const allocation of projectRuryTransportAllocation(items, transportTotal)) {
        shares[allocation.index] = allocation.totalCents / 100;
    }
    return shares;
}

/** Całkowity koszt zapisany w ofercie/zamówieniu, z fallbackiem wagowym. */
export function resolveRuryTransportTotal(
    offerData: Record<string, unknown>,
    items: Array<Record<string, unknown>>
): number {
    const stored = Number(offerData.transportCost ?? 0);
    if (stored > 0) return roundMoney(stored);
    const allocationCents = getValidRuryTransportAllocationTotalCents(
        items,
        offerData.transportAllocation
    );
    if (allocationCents !== null) return allocationCents / 100;
    const perTrip = Number(offerData.transportCostPerTrip ?? 0);
    if (!(perTrip > 0)) return 0;
    const weight = items.reduce((sum, item) => sum + getWeight(item), 0);
    if (!(weight > 0)) return 0;
    const mode = String(offerData.transportMode ?? 'full');
    const trips =
        mode === 'fractional'
            ? weight / MAX_TRANSPORT_WEIGHT
            : Math.ceil(weight / MAX_TRANSPORT_WEIGHT);
    return roundMoney(trips * perTrip);
}
