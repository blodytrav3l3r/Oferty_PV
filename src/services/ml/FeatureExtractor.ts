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
    label: 'ACCEPTED' | 'REJECTED' | 'MODIFIED' | 'NO_FEEDBACK';
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
export function normalizeWarehouse(raw?: string | null): string {
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
    // allComponentIds/appliedSeals/appliedKonus przechowują albo gołe stringi
    // ID ("KDB-12-05-D"), albo obiekty z polem productId — obsłuż oba.
    if (typeof item === 'string') return item;
    return typeof item === 'object' &&
        item !== null &&
        'productId' in item &&
        typeof (item as Record<string, unknown>).productId === 'string'
        ? ((item as Record<string, unknown>).productId as string)
        : '';
}

export type FeatureLabel = 'ACCEPTED' | 'REJECTED' | 'MODIFIED' | 'NO_FEEDBACK';

/**
 * Wyprowadza etykietę treningową z flag feedbacku rekordu telemetrii.
 * Jedno źródło prawdy dla extract() i resyncLabels() — obie ścieżki muszą
 * produkować IDENTYCZNE etykiety, inaczej resync rozjeżdża się z ekstrakcją.
 *
 * Semantyka (G1/G2 z audytu):
 * - REJECTED  — jawny sygnał odrzucenia (recordAcceptance/reward REJECT).
 * - ACCEPTED  — jawna akceptacja (recordAcceptance/reward ACCEPT / acceptance-full).
 * - NO_FEEDBACK — brak jakiegokolwiek feedbacku ORAZ konfiguracja ręczna (MANUAL):
 *   user sam zbudował studnię bez sugestii AI, to nie jest ani plus, ani minus.
 * - MODIFIED  — sugestia AUTO/AI zmieniona przez użytkownika (reward MODIFY) —
 *   negatywny sygnał względem oryginalnej sugestii.
 *
 * WAS_ACCEPTED ma priorytet nad MANUAL: acceptance-full z wasAccepted=true to
 * potwierdzona finalna konfiguracja (pozytywna), nie NO_FEEDBACK.
 */
function deriveLabel(record: {
    wasAccepted?: boolean;
    wasRejected?: boolean;
    wasModified?: boolean;
    solverSource?: string | null;
}): FeatureLabel {
    if (record.wasRejected) return 'REJECTED';
    if (record.wasAccepted) return 'ACCEPTED';
    if (record.solverSource === 'MANUAL') return 'NO_FEEDBACK';
    if (record.wasModified) return 'MODIFIED';
    return 'NO_FEEDBACK';
}

function labelToReward(label: FeatureLabel): number {
    if (label === 'ACCEPTED') return 1.0;
    if (label === 'REJECTED') return -1.0;
    if (label === 'MODIFIED') return -0.3;
    return 0.0;
}

export class FeatureExtractor {
    async extractAndStore(): Promise<number> {
        const telemetryRecords = await prisma.ai_telemetry_logs.findMany({
            where: {
                dn: { not: null },
                wellType: { not: null },
                trainingEligible: true
            },
            orderBy: { createdAt: 'desc' },
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

        let label = deriveLabel(record);
        let reward = labelToReward(label);

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

    /**
     * Aktualizuje etykietę (oraz reward) wyekstrahowanych cech na podstawie
     * aktualnej flagi feedbacki z rekordu telemetrii. Wołane, gdy feedback
     * (accept/reject/modify) nadejdzie PO ekstrakcji — dotąd etykieta w
     * aiFeature zamrażała się na 'ACCEPTED' (brak klasy negatywnej).
     *
     * @param label 'ACCEPTED' | 'REJECTED' | 'MODIFIED' | 'NO_FEEDBACK'
     */
    async updateLabelByTelemetry(
        telemetryId: string | null | undefined,
        label: FeatureLabel
    ): Promise<void> {
        if (!telemetryId) return;
        const reward = labelToReward(label);
        await prisma.aiFeature.updateMany({
            where: { telemetryId },
            data: { label, reward }
        });
    }

    /**
     * Pełna re-synchronizacja etykiet cech z aktualnym stanem feedbacku
     * (wasRejected / wasModified / wasAccepted) w źródle telemetrii. Naprawia
     * historyczny problem: wszystkie wektory miały 'ACCEPTED', bo ekstrakcja
     * wyprzedzała akceptację/odrzucenie. Wołane przed każdym treningiem oraz przez
     * recordAcceptance. Nie tworzy nowych wierszy — tylko koryguje etykiety.
     */
    async resyncLabels(limit = 2000): Promise<number> {
        const records = await prisma.ai_telemetry_logs.findMany({
            where: { trainingEligible: true },
            orderBy: { createdAt: 'desc' },
            take: limit,
            select: {
                id: true,
                wasAccepted: true,
                wasRejected: true,
                wasModified: true,
                modificationCount: true,
                solverSource: true
            }
        });

        const labelByTelemetry = new Map<string, FeatureLabel>();
        for (const r of records) {
            labelByTelemetry.set(r.id, deriveLabel(r));
        }

        const existing = await prisma.aiFeature.findMany({
            where: { telemetryId: { in: records.map((r) => r.id) } },
            select: { id: true, telemetryId: true, label: true }
        });

        const updates: Array<{ id: string; label: FeatureLabel; reward: number }> = [];
        for (const f of existing) {
            const target = f.telemetryId ? labelByTelemetry.get(f.telemetryId) : undefined;
            if (target && target !== f.label) {
                updates.push({
                    id: f.id,
                    label: target,
                    reward: labelToReward(target)
                });
            }
        }

        let updated = 0;
        for (const u of updates) {
            await prisma.aiFeature.update({
                where: { id: u.id },
                data: { label: u.label, reward: u.reward }
            });
            updated++;
        }
        logger.info('FeatureExtractor', `ResyncLabels: zsynchronizowano ${updated} etykiet`);
        return updated;
    }

    /**
     * Re-ekstrakcja cech istniejących wierszy aiFeature. Historyczne wektory
     * zostały policzone przez starsze wersje ekstraktora (puste ringCount /
     * connectionCount / bottomType / dennicaHeight), a extractAndStore pomija
     * rekordy już istniejące. Wołane przed każdym treningiem.
     */
    async resyncFeatures(): Promise<number> {
        const features = await prisma.aiFeature.findMany({
            where: {
                OR: [
                    { ringCount: 0, connectionCount: 0 },
                    { bottomType: 'unknown' },
                    { dennicaHeight: null }
                ]
            },
            orderBy: { createdAt: 'desc' },
            take: 1000
        });
        const telemetryIds = features
            .map((f) => f.telemetryId)
            .filter((id): id is string => Boolean(id));
        if (telemetryIds.length === 0) return 0;

        const telemetry = await prisma.ai_telemetry_logs.findMany({
            where: { id: { in: telemetryIds } },
            select: {
                id: true,
                dn: true,
                warehouse: true,
                wellType: true,
                wellHeight: true,
                ringCount: true,
                wasAccepted: true,
                wasRejected: true,
                wasModified: true,
                modificationCount: true,
                allComponentIds: true,
                appliedReductions: true,
                appliedKonus: true,
                appliedSeals: true,
                createdAt: true,
                solverSource: true,
                featureSnapshot: true,
                kineta: true,
                dennicaHeight: true,
                computationMs: true
            }
        });
        const byId = new Map(telemetry.map((t) => [t.id, t]));

        let updated = 0;
        for (const f of features) {
            const t = f.telemetryId ? byId.get(f.telemetryId) : undefined;
            if (!t) continue;
            const fv = this.extract(t as TelemetryRecordWithDetails);
            // Selektywny UPDATE (K5): pomiń wiersze, których cechy się nie zmieniły
            // (np. legalnie 0 kręgów / 0 uszczelek) — bez tego resyncFeatures
            // przepisywał te same wartości co trening (N+1, niekończący się filtr).
            const same =
                f.dn === fv.dn &&
                f.heightMm === fv.heightMm &&
                f.warehouse === fv.warehouse &&
                f.wellType === fv.wellType &&
                f.hasReduction === fv.hasReduction &&
                f.hasPsiaBuda === fv.hasPsiaBuda &&
                f.hasStyczna === fv.hasStyczna &&
                f.ringCount === fv.ringCount &&
                f.bottomType === fv.bottomType &&
                f.topType === fv.topType &&
                f.connectionCount === fv.connectionCount &&
                f.transitionsAboveDennica === fv.transitionsAboveDennica &&
                f.totalPrice === fv.totalPrice &&
                f.totalWeight === fv.totalWeight &&
                f.ringVariety === fv.ringVariety &&
                f.season === fv.season &&
                (f.kinetaType ?? null) === fv.kinetaType &&
                (f.dennicaHeight ?? null) === (fv.dennicaHeight > 0 ? fv.dennicaHeight : null) &&
                f.label === fv.label &&
                f.reward === fv.reward;
            if (same) continue;
            await prisma.aiFeature.update({
                where: { id: f.id },
                data: {
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
                    reward: fv.reward
                }
            });
            updated++;
        }
        logger.info('FeatureExtractor', `ResyncFeatures: przeliczone cechy ${updated} wektorów`);
        return updated;
    }

    async getFeatureCount(): Promise<number> {
        return prisma.aiFeature.count();
    }
}

export const featureExtractor = new FeatureExtractor();
