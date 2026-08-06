import crypto from 'crypto';
import prisma from '../../prismaClient';
import { logger } from '../../utils/logger';
import { parseFeatureSnapshot } from './parseFeatureSnapshot';

export interface FeatureVector {
    dn: number;
    heightMm: number;
    warehouse: string;
    wellType: string;
    hasReduction: boolean;
    hasPsiaBuda: boolean;
    hasStyczna: boolean;
    ringCount: number;
    bottomType: string;
    topType: string;
    connectionCount: number;
    transitionsAboveDennica: number;
    totalPrice: number;
    totalWeight: number;
    ringVariety: number;
    season: string;
    kinetaType: string;
    dennicaHeight: number;
    label: 'ACCEPTED' | 'REJECTED' | 'MODIFIED';
    reward: number;
    decisionMs: number;
}

export interface TelemetryRecordWithDetails {
    id: string;
    dn?: string | null;
    warehouse?: string | null;
    wellType?: string | null;
    wellHeight?: number | null;
    ringCount?: number | null;
    wasAccepted?: boolean;
    wasRejected?: boolean;
    wasModified?: boolean;
    modificationCount?: number | null;
    totalPrice?: number;
    totalWeight?: number;
    allComponentIds?: string | null;
    appliedReductions?: string | null;
    appliedKonus?: string | null;
    appliedSeals?: string | null;
    createdAt?: string | null;
    userId?: string | null;
    solverSource?: string | null;
    rankingScore?: number | null;
    featureSnapshot?: string | null;
    kineta?: string | null;
    dennicaHeight?: number | null;
    computationMs?: number | null;
}

function shannonEntropy(items: string[]): number {
    if (items.length === 0) return 0;
    const counts = new Map<string, number>();
    for (const item of items) {
        counts.set(item, (counts.get(item) || 0) + 1);
    }
    let entropy = 0;
    const total = items.length;
    for (const count of counts.values()) {
        const p = count / total;
        entropy -= p * Math.log2(p);
    }
    const maxEntropy = Math.log2(counts.size);
    return maxEntropy > 0 ? entropy / maxEntropy : 0;
}

/**
 * Identyfikacja kregow po ID produktu. Backend w allComponentIds ma goly
 * string ID (bez componentType), wiec typ musi byc rozpoznany po wzorcu.
 * Wzorzec pokrywa aktualne dane (prisma/seed_studnie.json): krag/krag_ot
 * maja wylacznie prefiksy KDB- / KDZ-. Uwaga: K2KAN-* to przejscia, NIE kregi.
 */
function isRingProductId(id: string): boolean {
    return /^KDB-|^KDZ-/i.test(id);
}

/**
 * Identyfikacja dennicy po ID. Dennice: DDD-<dn>-<wysokosc> (cyfra po
 * drugim myslniku); styczne DDD-<dn>-STYCZNA maja po drugim myslniku
 * litery i sa wylaczone.
 */
function isDennicaProductId(id: string): boolean {
    return /^DDD-\d+-\d/.test(id);
}

/**
 * Normalizacja magazynu do kodu 'KLB'/'WL'. Telemetria wysyła pełną nazwę
 * ('Kluczbork'/'Włocławek'), trening i serve porównują kody — bez tej
 * normalizacji bity warehouse w oneHotEncode były zawsze 0/0 (train)
 * vs 1/0 (serve fallback 'KLB').
 */
function normalizeWarehouse(raw?: string | null): string {
    const v = (raw || '').toUpperCase();
    if (v.includes('WŁOCŁAWEK') || v.includes('WLOCLAWEK') || v === 'WL') return 'WL';
    return 'KLB';
}

function getSeason(dateStr?: string | null): string {
    if (!dateStr) return 'unknown';
    const date = new Date(dateStr);
    const month = date.getMonth() + 1;
    if (month >= 3 && month <= 5) return 'spring';
    if (month >= 6 && month <= 8) return 'summer';
    if (month >= 9 && month <= 11) return 'autumn';
    return 'winter';
}

function safeJsonParse(str: string | null | undefined): unknown[] {
    if (!str) return [];
    try {
        const parsed = JSON.parse(str);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function extractProductId(item: unknown): string {
    return typeof item === 'object' &&
        item !== null &&
        'productId' in item &&
        typeof (item as Record<string, unknown>).productId === 'string'
        ? ((item as Record<string, unknown>).productId as string)
        : '';
}

export class FeatureExtractor {
    async extractAndStore(): Promise<number> {
        const telemetryRecords = await prisma.ai_telemetry_logs.findMany({
            where: {
                dn: { not: null },
                wellType: { not: null },
                trainingEligible: true
            },
            orderBy: { createdAt: 'asc' },
            take: 500
        });

        const existingIds = await prisma.aiFeature.findMany({
            select: { telemetryId: true }
        });
        const existingSet = new Set(existingIds.map((r) => r.telemetryId).filter(Boolean));

        const newRecords = telemetryRecords.filter((r) => !existingSet.has(r.id));

        if (newRecords.length === 0) {
            logger.info('FeatureExtractor', 'Brak nowych rekordow do ekstrakcji');
            return 0;
        }

        const data = newRecords.map((record) => {
            const fv = this.extract(record);
            return {
                id: crypto.randomUUID(),
                telemetryId: record.id,
                dn: fv.dn,
                heightMm: fv.heightMm,
                warehouse: fv.warehouse,
                wellType: fv.wellType,
                hasReduction: fv.hasReduction,
                hasPsiaBuda: fv.hasPsiaBuda,
                hasStyczna: fv.hasStyczna,
                ringCount: fv.ringCount,
                bottomType: fv.bottomType,
                topType: fv.topType,
                connectionCount: fv.connectionCount,
                transitionsAboveDennica: fv.transitionsAboveDennica,
                totalPrice: fv.totalPrice,
                totalWeight: fv.totalWeight,
                ringVariety: fv.ringVariety,
                season: fv.season,
                kinetaType: fv.kinetaType,
                dennicaHeight: fv.dennicaHeight > 0 ? fv.dennicaHeight : null,
                label: fv.label,
                reward: fv.reward,
                decisionMs: fv.decisionMs > 0 ? fv.decisionMs : null,
                createdAt: record.createdAt || new Date().toISOString()
            };
        });

        await prisma.aiFeature.createMany({ data });
        logger.info(
            'FeatureExtractor',
            `Wyodrebniono ${data.length} feature vectors z ${telemetryRecords.length} rekordow`
        );
        return data.length;
    }

    extract(record: TelemetryRecordWithDetails): FeatureVector {
        const dn = parseInt(record.dn || '0', 10) || 0;
        const components = safeJsonParse(record.allComponentIds);
        const reductions = safeJsonParse(record.appliedReductions);
        const konusList = safeJsonParse(record.appliedKonus);
        const seals = safeJsonParse(record.appliedSeals);

        const componentIds = components.map(extractProductId).filter(Boolean);
        const reductionIds = reductions.map(extractProductId).filter(Boolean);
        const konusIds = konusList.map(extractProductId).filter(Boolean);
        const sealIds = seals.map(extractProductId).filter(Boolean);

        const allDistinct = [
            ...new Set([...componentIds, ...reductionIds, ...konusIds, ...sealIds])
        ];
        const ringCount = Math.max(
            componentIds.filter(isRingProductId).length,
            record.ringCount || 0
        );
        const connectionCount = sealIds.length;

        const transitionsAboveDennicaEstimate = Math.max(0, connectionCount - 1);

        const wellType = this.normalizeWellType(record.wellType || 'standard');
        const hasReduction = reductionIds.length > 0;
        const hasPsiaBuda = wellType === 'psia_buda';
        const hasStyczna = wellType === 'styczna' || wellType === 'styczna_1200';

        const snapshot = parseFeatureSnapshot(record.featureSnapshot);
        const totalPrice = snapshot.totalPrice || record.totalPrice || 0;
        const totalWeight = snapshot.totalWeight || record.totalWeight || 0;

        const ringIds = [...new Set(componentIds.filter(isRingProductId))];
        const ringVarietyValue = shannonEntropy(ringIds);

        let label: 'ACCEPTED' | 'REJECTED' | 'MODIFIED' = 'ACCEPTED';
        if (record.wasRejected) label = 'REJECTED';
        else if (record.wasModified && (record.modificationCount || 0) > 0) label = 'MODIFIED';

        let reward = 0.0;
        if (record.wasAccepted && !record.wasModified) reward = 1.0;
        else if (record.wasAccepted && (record.modificationCount || 0) < 2) reward = 0.2;
        else if (record.wasModified && (record.modificationCount || 0) >= 2) reward = -0.3;
        else if (record.solverSource === 'MANUAL') reward = -0.5;
        else if (record.wasRejected) reward = -1.0;

        const decisionMs = record.computationMs || 0;

        let topType = 'unknown';
        if (konusIds.length > 0) {
            topType = konusIds[0];
        }

        let bottomType = 'unknown';
        const dennPos = allDistinct.findIndex(isDennicaProductId);
        if (dennPos >= 0) bottomType = allDistinct[dennPos];

        // v6: kineta — surowa wartość z payloadu (frontend wysyła 'brak', 'beton',
        // 'preco', 'precotop', 'unolith'). oneHotEncode tłumaczy ją na bity —
        // 'brak'/nieznane = wszystkie bity 0 (spójnie z buildFeatureVector).
        let kinetaType = String(record.kineta || '').toLowerCase();
        if (kinetaType === 'precotop') kinetaType = 'preco';

        const dennicaHeight = record.dennicaHeight
            ? Math.round(record.dennicaHeight)
            : snapshot.dennicaHeight || 0;

        return {
            dn,
            heightMm: Math.round(record.wellHeight || 0),
            warehouse: normalizeWarehouse(record.warehouse),
            wellType,
            hasReduction,
            hasPsiaBuda,
            hasStyczna,
            ringCount,
            bottomType,
            topType,
            connectionCount,
            transitionsAboveDennica: transitionsAboveDennicaEstimate,
            totalPrice,
            totalWeight,
            ringVariety: parseFloat(ringVarietyValue.toFixed(4)),
            season: getSeason(record.createdAt),
            kinetaType,
            dennicaHeight,
            label,
            reward: parseFloat(reward.toFixed(4)),
            decisionMs
        };
    }

    private normalizeWellType(raw: string): string {
        const lower = raw.toLowerCase();
        if (lower.includes('psia') || lower === 'psia_buda') return 'psia_buda';
        if (lower.includes('stycz')) return 'styczna';
        if (lower === 'styczna_1200') return 'styczna_1200';
        return 'standard';
    }

    async getFeatureCount(): Promise<number> {
        return prisma.aiFeature.count();
    }
}

export const featureExtractor = new FeatureExtractor();
