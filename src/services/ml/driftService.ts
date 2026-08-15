/**
 * Monitoring driftu (ETAP 6 planu MLOps).
 *
 * - Feature drift: PSI każdej cechy vs baseline z AiModel.featureDistributions
 *   (histogramy z TRAIN przy treningu). Wszystkie 29 cech — żadna nie wypada
 *   z monitoringu przy zmianie top-features.
 * - Prediction drift: PSI rozkładu score produkcyjnych (aiRewardLog.scoreBefore)
 *   między bieżącym a historycznym oknem.
 * - Label drift: positiveRate bieżący (aiFeature) vs positiveRate z ostatniego
 *   udanego treningu (AiTrainingRun).
 */

import prisma from '../../prismaClient';
import { logger } from '../../utils/logger';
import {
    computePsi,
    parseFeatureDistributions,
    type FeatureDistribution
} from './featureDistributions';
import { AcceptanceModel } from './AcceptanceModel';
import { computeRocAuc, oneHotEncode } from './TrainingPipeline';
import { ML_CONSTANTS } from '../../config/mlConstants';
import type { StoredModel } from './ModelRegistry';

export interface FeatureDriftEntry {
    feature: string;
    psi: number | null;
}

export interface DriftReport {
    feature: FeatureDriftEntry[];
    prediction: { psi: number | null; baselineSamples: number; currentSamples: number };
    label: {
        currentPositiveRate: number | null;
        trainingPositiveRate: number | null;
        delta: number | null;
    };
    shadow: {
        candidateVersion: string | null;
        productionVersion: string | null;
        shadowAuc: number | null;
        productionAuc: number | null;
        samples: number;
    };
    generatedAt: string;
}

const WINDOW = 500; // rekordów do bieżącego okna driftu

/**
 * Feature drift: PSI każdej cechy z baseline między rozkładem treningowym
 * a bieżącym (ostatnie N rekordów aiFeature). Bieżące wartości normalizowane
 * przez featureMins/featureMaxs modelu — ten sam wymiar co wektory treningowe.
 */
export async function computeFeatureDrift(
    production: StoredModel | null
): Promise<FeatureDriftEntry[]> {
    if (!production) return [];
    const baseline = parseFeatureDistributions(production.featureDistributions ?? null);
    if (!baseline) return [];

    const features = await prisma.aiFeature.findMany({
        where: { label: { not: 'NO_FEEDBACK' } },
        orderBy: { createdAt: 'desc' },
        take: WINDOW
    });

    const entries: FeatureDriftEntry[] = [];
    for (const name of Object.keys(baseline.features)) {
        const dist = baseline.features[name];
        const idx = production.features.indexOf(name);
        if (idx < 0) continue;
        const min = production.featureMins[idx] ?? 0;
        const max = production.featureMaxs[idx] ?? 1;
        const range = max - min || 1;
        const currentValues: number[] = [];
        for (const f of features) {
            const raw = rawFeatureValue(f, name);
            if (raw == null) continue;
            currentValues.push((raw - min) / range);
        }
        const psi = computePsi(dist, currentValues);
        entries.push({ feature: name, psi });
    }
    entries.sort((a, b) => (b.psi ?? -1) - (a.psi ?? -1));
    return entries;
}

/**
 * Prediction drift: PSI rozkładu score produkcyjnych (aiRewardLog.scoreBefore,
 * serwerowe score) między bieżącym oknem a wcześniejszym.
 */
export async function computePredictionDrift(): Promise<{
    psi: number | null;
    baselineSamples: number;
    currentSamples: number;
}> {
    const recent = await prisma.aiRewardLog.findMany({
        where: { scoreBefore: { not: null } },
        orderBy: { createdAt: 'desc' },
        take: WINDOW * 2
    });
    const scores = recent
        .map((r) => r.scoreBefore)
        .filter((s): s is number => typeof s === 'number');
    if (scores.length < 2 * 10) {
        return { psi: null, baselineSamples: scores.length, currentSamples: 0 };
    }
    // Dzielimy dostępne próbki na pół (current = nowsze, baseline = starsze) —
    // przy małej liczbie próbek okno nie może być szersze niż połowa danych.
    const half = Math.floor(scores.length / 2);
    const current = scores.slice(0, half);
    const baseline = scores.slice(half);
    // Score ograniczone do [0,1] (walidacja schematu) — fixed bins 0..1 zamiast
    // samo-dobieranych: degenerat baseline (wszystkie score równe) nie może dać
    // fałszywego PSI=0 przy przesunięciu rozkładu.
    const baselineHist = fixedScoreHistogram(baseline, 10);
    const psi = computePsi(baselineHist, current);
    return { psi, baselineSamples: baseline.length, currentSamples: current.length };
}

function fixedScoreHistogram(values: number[], binCount: number): FeatureDistribution {
    const bins = Array.from({ length: binCount + 1 }, (_, i) => i / binCount);
    const counts = new Array(binCount).fill(0);
    for (const v of values) {
        if (!Number.isFinite(v)) continue;
        let idx = Math.floor(v * binCount);
        if (idx >= binCount) idx = binCount - 1;
        if (idx < 0) idx = 0;
        counts[idx]++;
    }
    return { bins, counts };
}

/**
 * Label drift: positiveRate bieżący (ostatnie N etykiet) vs positiveRate
 * z ostatniego udanego treningu (AiTrainingRun.status = SUCCESS).
 */
export async function computeLabelDrift(): Promise<{
    currentPositiveRate: number | null;
    trainingPositiveRate: number | null;
    delta: number | null;
}> {
    const features = await prisma.aiFeature.findMany({
        where: { label: { not: 'NO_FEEDBACK' } },
        orderBy: { createdAt: 'desc' },
        take: WINDOW
    });
    let currentPositiveRate: number | null = null;
    if (features.length > 0) {
        const positives = features.filter(
            (f) => f.label === 'ACCEPTED' || f.label === 'ACCEPTED_AFTER_MODIFICATION'
        ).length;
        currentPositiveRate = positives / features.length;
    }

    const lastRun = await prisma.aiTrainingRun.findFirst({
        where: { status: 'SUCCESS' },
        orderBy: { startedAt: 'desc' }
    });
    const trainingPositiveRate = lastRun?.positiveRate ?? null;
    const delta =
        currentPositiveRate != null && trainingPositiveRate != null
            ? currentPositiveRate - trainingPositiveRate
            : null;
    return { currentPositiveRate, trainingPositiveRate, delta };
}

/**
 * Shadow stats (ETAP 7B): ostatni nieaktywny kandydat (APPROVED) liczony na
 * tych samych danych produkcyjnych co model produkcyjny — shadowAuc pokazuje,
 * jak kandydat zachowywałby się w produkcji bez wpływu na ranking.
 * Minimalna wersja wg planu (wells_ai_influence=0 działa jako shadow;
 * pełny tracker YAGNI — dopiero gdy pojawią się dane).
 */
export async function computeShadowStats(production: StoredModel | null): Promise<{
    candidateVersion: string | null;
    productionVersion: string | null;
    shadowAuc: number | null;
    productionAuc: number | null;
    samples: number;
}> {
    const base = {
        candidateVersion: null,
        productionVersion: production?.version ?? null,
        shadowAuc: null,
        productionAuc: null,
        samples: 0
    };
    if (!production) return base;

    const candidate = await prisma.aiModel.findFirst({
        where: {
            active: false,
            state: 'APPROVED',
            featureVersion: ML_CONSTANTS.FEATURE_VERSION
        },
        orderBy: { createdAt: 'desc' }
    });
    if (!candidate) return { ...base, productionVersion: production.version };

    const features = await prisma.aiFeature.findMany({
        where: { label: { not: 'NO_FEEDBACK' } },
        orderBy: { createdAt: 'desc' },
        take: WINDOW
    });
    if (features.length < 10) return { ...base, productionVersion: production.version };

    // Wektor cech dla obu modeli (one-hot — ten sam wymiar co trening).
    const labels: number[] = [];
    const prodVecs: number[][] = [];
    const candVecs: number[][] = [];
    for (const f of features) {
        const vec = buildFeatureVector(f);
        if (!vec) continue;
        labels.push(f.label === 'ACCEPTED' || f.label === 'ACCEPTED_AFTER_MODIFICATION' ? 1 : 0);
        prodVecs.push(normalizeVec(vec, production.featureMins, production.featureMaxs));
        candVecs.push(
            normalizeVec(
                vec,
                JSON.parse(candidate.featureMins as string) as number[],
                JSON.parse(candidate.featureMaxs as string) as number[]
            )
        );
    }
    if (labels.length < 10) return { ...base, productionVersion: production.version };

    const prodModel = new AcceptanceModel(
        production.weights.length,
        production.weights,
        production.bias
    );
    const candModel = new AcceptanceModel(
        JSON.parse(candidate.weights as string).length,
        JSON.parse(candidate.weights as string) as number[],
        candidate.bias
    );
    const productionAuc = computeRocAuc(
        prodVecs.map((v) => prodModel.predict(v)),
        labels
    );
    const shadowAuc = computeRocAuc(
        candVecs.map((v) => candModel.predict(v)),
        labels
    );
    return {
        candidateVersion: candidate.version,
        productionVersion: production.version,
        shadowAuc,
        productionAuc,
        samples: labels.length
    };
}

/**
 * Pełny raport driftu dla /ai/drift.
 */
export async function buildDriftReport(): Promise<DriftReport> {
    try {
        const { modelRegistry } = await import('./ModelRegistry');
        const production = await modelRegistry.getProductionModel();
        const [feature, prediction, label, shadow] = await Promise.all([
            computeFeatureDrift(production),
            computePredictionDrift(),
            computeLabelDrift(),
            computeShadowStats(production)
        ]);
        return { feature, prediction, label, shadow, generatedAt: new Date().toISOString() };
    } catch (e) {
        logger.error(
            'DriftService',
            `Błąd budowy raportu driftu: ${e instanceof Error ? e.message : String(e)}`
        );
        return {
            feature: [],
            prediction: { psi: null, baselineSamples: 0, currentSamples: 0 },
            label: { currentPositiveRate: null, trainingPositiveRate: null, delta: null },
            shadow: {
                candidateVersion: null,
                productionVersion: null,
                shadowAuc: null,
                productionAuc: null,
                samples: 0
            },
            generatedAt: new Date().toISOString()
        };
    }
}

/** Jedna cecha FEATURE_NAMES → wartość z rekordu aiFeature (ten sam wymiar co wektor). */
function rawFeatureValue(
    f: Awaited<ReturnType<typeof prisma.aiFeature.findMany>>[number],
    name: string
): number | null {
    const kineta = String(f.kinetaType ?? '').toLowerCase();
    switch (name) {
        case 'dn':
            return f.dn;
        case 'heightMm':
            return f.heightMm;
        case 'warehouse_KLB':
            return f.warehouse === 'KLB' ? 1 : 0;
        case 'warehouse_WL':
            return f.warehouse === 'WL' ? 1 : 0;
        case 'wellType_standard':
            return f.wellType === 'standard' ? 1 : 0;
        case 'wellType_psia_buda':
            return f.wellType === 'psia_buda' ? 1 : 0;
        case 'wellType_styczna':
            return f.wellType === 'styczna' || f.wellType === 'styczna_1200' ? 1 : 0;
        case 'hasReduction':
            return f.hasReduction ? 1 : 0;
        case 'hasPsiaBuda':
            return f.hasPsiaBuda ? 1 : 0;
        case 'ringCount':
            return f.ringCount;
        case 'connectionCount':
            return f.connectionCount;
        case 'transitionsAboveDennica':
            return f.transitionsAboveDennica;
        case 'totalPrice':
            return f.totalPrice;
        case 'totalWeight':
            return f.totalWeight;
        case 'ringVariety':
            return f.ringVariety;
        case 'season_num':
            return seasonToNum(f.season);
        case 'hasKnownBottom':
            return f.bottomType && String(f.bottomType) !== 'unknown' ? 1 : 0;
        case 'hasKnownTop':
            return f.topType && String(f.topType) !== 'unknown' ? 1 : 0;
        case 'dn_x_ringCount':
            return f.dn * f.ringCount;
        case 'isKLBstandard':
            return f.warehouse === 'KLB' && f.wellType === 'standard' ? 1 : 0;
        case 'kineta_preco':
            return kineta === 'preco' || kineta === 'precotop' ? 1 : 0;
        case 'kineta_unolith':
            return kineta === 'unolith' ? 1 : 0;
        case 'kineta_standard':
            return kineta === 'beton' || kineta === '' ? 1 : 0;
        case 'dennicaHeight':
            return f.dennicaHeight ?? null;
        case 'transitionCount':
        case 'maxTransitionDnMm':
        case 'minTransitionHeightMm':
        case 'maxTransitionHeightMm':
        case 'avgTransitionHeightMm':
            // Agregaty przejść żyją w ai_transition_snapshots (join po telemetryId) —
            // aiFeature nie ma tych kolumn; PSI dla nich pomijane.
            return null;
        default:
            return null;
    }
}

function seasonToNum(s: string): number {
    const lower = (s || 'unknown').toLowerCase();
    if (lower === 'spring') return 0;
    if (lower === 'summer') return 1;
    if (lower === 'autumn') return 2;
    if (lower === 'winter') return 3;
    return 0;
}

/** Pełny wektor cech z rekordu aiFeature (one-hot — identyczny wymiar co trening). */
function buildFeatureVector(
    f: Awaited<ReturnType<typeof prisma.aiFeature.findMany>>[number]
): number[] | null {
    // Agregaty przejść (transition*) wymagają joina z ai_transition_snapshots —
    // aiFeature ich nie ma; wektor z zerami daje zaniżony wymiar względem treningu
    // tylko dla studni z przejściami (rzadki przypadek) — shadow jest przybliżeniem.
    return oneHotEncode({
        dn: f.dn,
        heightMm: f.heightMm,
        warehouse: f.warehouse,
        wellType: f.wellType,
        hasReduction: f.hasReduction,
        hasPsiaBuda: f.hasPsiaBuda,
        hasStyczna: f.hasStyczna,
        ringCount: f.ringCount,
        connectionCount: f.connectionCount,
        transitionsAboveDennica: f.transitionsAboveDennica,
        totalPrice: f.totalPrice,
        totalWeight: f.totalWeight,
        ringVariety: f.ringVariety,
        season: f.season,
        bottomType: f.bottomType,
        topType: f.topType,
        kinetaType: f.kinetaType,
        dennicaHeight: f.dennicaHeight,
        transitionCount: 0,
        maxTransitionDnMm: 0,
        minTransitionHeightMm: 0,
        maxTransitionHeightMm: 0,
        avgTransitionHeightMm: 0
    });
}

function normalizeVec(vec: number[], mins: number[], maxs: number[]): number[] {
    return vec.map((v, i) => {
        const range = (maxs[i] ?? 1) - (mins[i] ?? 0);
        return range === 0 ? 0 : (v - (mins[i] ?? 0)) / range;
    });
}
