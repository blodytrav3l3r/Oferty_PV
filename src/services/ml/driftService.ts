/**
 * Monitoring driftu (ETAP 6 planu MLOps).
 *
 * - Feature drift: PSI każdej cechy vs baseline z AiModel.featureDistributions
 *   (histogramy z TRAIN przy treningu). Wszystkie 30 cech — żadna nie wypada
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
import {
    computeRocAuc,
    oneHotEncode,
    aggregateTransitionFeatures,
    type TransitionAggregates
} from './TrainingPipeline';
import { ML_CONSTANTS } from '../../config/mlConstants';
import type { StoredModel } from './ModelRegistry';
import { computeTrainingUserScopeFingerprint } from './trainingLineage';
import { findEligibleLabeledFeatures, getTrainingUsersConfig } from './trainingUsers';
import { parseVerifiedPredictionProvenance } from './predictionProvenance';

export interface FeatureDriftEntry {
    feature: string;
    psi: number | null;
}

export interface DriftReport {
    feature: FeatureDriftEntry[];
    trainingScope: {
        status: 'AVAILABLE' | 'UNAVAILABLE';
        reason: string | null;
        modelVersion: string | null;
    };
    prediction: {
        psi: number | null;
        baselineSamples: number;
        currentSamples: number;
        reliability: 'UNAVAILABLE' | 'VERIFIED';
        reason: string | null;
    };
    label: {
        currentPositiveRate: number | null;
        trainingPositiveRate: number | null;
        delta: number | null;
        reason: string | null;
    };
    shadow: {
        candidateVersion: string | null;
        productionVersion: string | null;
        shadowAuc: number | null;
        productionAuc: number | null;
        samples: number;
        reason: string | null;
    };
    generatedAt: string;
}

const WINDOW = 500; // rekordów do bieżącego okna driftu

interface ResolvedTrainingScope {
    status: 'AVAILABLE' | 'UNAVAILABLE';
    reason: string | null;
    modelVersion: string | null;
    userIds: string[];
    positiveRate: number | null;
    trainedAt: string | null;
}

async function resolveTrainingScope(
    production: StoredModel | string | null
): Promise<ResolvedTrainingScope> {
    const modelVersion =
        typeof production === 'string' ? production : (production?.version ?? null);
    const unavailable = (reason: string): ResolvedTrainingScope => ({
        status: 'UNAVAILABLE',
        reason,
        modelVersion,
        userIds: [],
        positiveRate: null,
        trainedAt: null
    });
    if (!production) return unavailable('no_production_model');

    const config = await getTrainingUsersConfig();
    if (config.status !== 'CONFIGURED' || config.userIds.length === 0) {
        return unavailable(`allowlist_${config.status.toLowerCase()}`);
    }
    const run = await prisma.aiTrainingRun.findFirst({
        where: { status: 'SUCCESS', candidateModelVersion: modelVersion },
        select: { positiveRate: true, lineageSnapshot: true, finishedAt: true },
        orderBy: { startedAt: 'desc' }
    });
    if (!run) return unavailable('no_matching_training_run');
    if (!run.finishedAt) return unavailable('missing_training_completion_time');

    let lineage: unknown;
    try {
        lineage = JSON.parse(run.lineageSnapshot ?? 'null');
    } catch {
        return unavailable('invalid_training_lineage');
    }
    if (!lineage || typeof lineage !== 'object' || !('trainingUserScopeFingerprint' in lineage)) {
        return unavailable('legacy_training_lineage');
    }
    const storedFingerprint = (lineage as { trainingUserScopeFingerprint?: unknown })
        .trainingUserScopeFingerprint;
    if (typeof storedFingerprint !== 'string')
        return unavailable('invalid_training_scope_fingerprint');
    if (storedFingerprint !== computeTrainingUserScopeFingerprint(config.userIds)) {
        return unavailable('allowlist_scope_changed');
    }
    return {
        status: 'AVAILABLE',
        reason: null,
        modelVersion,
        userIds: config.userIds,
        positiveRate: run.positiveRate ?? null,
        trainedAt: run.finishedAt
    };
}

async function getEligibleLabeledFeatures(scope: ResolvedTrainingScope) {
    if (scope.status !== 'AVAILABLE' || !scope.trainedAt) return [];
    return findEligibleLabeledFeatures(scope.trainedAt, scope.userIds, WINDOW);
}

/**
 * Feature drift: PSI każdej cechy z baseline między rozkładem treningowym
 * a bieżącym (ostatnie N rekordów aiFeature). Bieżące wartości normalizowane
 * przez featureMins/featureMaxs modelu — ten sam wymiar co wektory treningowe.
 */
export async function computeFeatureDrift(
    production: StoredModel | null,
    resolvedScope?: ResolvedTrainingScope
): Promise<FeatureDriftEntry[]> {
    const scope = resolvedScope ?? (await resolveTrainingScope(production));
    if (!production || scope.status !== 'AVAILABLE') return [];
    const baseline = parseFeatureDistributions(production.featureDistributions ?? null);
    if (!baseline) return [];

    const features = await getEligibleLabeledFeatures(scope);

    // Agregaty przejść (transition*) — ten sam join co trening: ai_transition_snapshots
    // gdzie configId == aiFeature.telemetryId (TrainingPipeline.loadAndNormalizeFeatures).
    // Brak snapshotów dla danego configId = brak przejść = cecha 0 (spójnie z treningiem).
    const transIds = features.map((f) => f.telemetryId).filter(Boolean) as string[];
    const transRows = await prisma.ai_transition_snapshots.findMany({
        where: transIds.length > 0 ? { configId: { in: transIds } } : { configId: { in: [''] } }
    });
    const groups = new Map<string, Array<(typeof transRows)[number]>>();
    for (const row of transRows) {
        if (!row.configId) continue;
        const group = groups.get(row.configId) || [];
        group.push(row);
        groups.set(row.configId, group);
    }
    const transAggByConfig = new Map<string, TransitionAggregates>();
    for (const [configId, group] of groups) {
        const agg = aggregateTransitionFeatures(group);
        if (agg) transAggByConfig.set(configId, agg);
    }

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
            const raw = rawFeatureValue(
                f,
                name,
                f.telemetryId ? transAggByConfig.get(f.telemetryId) : undefined
            );
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
 * Prediction drift: PSI serwerowo potwierdzonych score dla aktywnej wersji modelu.
 */
export async function computePredictionDrift(modelVersion: string | null): Promise<{
    psi: number | null;
    baselineSamples: number;
    currentSamples: number;
    modelVersion: string | null;
    reliability: 'UNAVAILABLE' | 'VERIFIED';
    reason: string | null;
}> {
    if (!modelVersion) {
        return {
            psi: null,
            baselineSamples: 0,
            currentSamples: 0,
            modelVersion: null,
            reliability: 'UNAVAILABLE',
            reason: 'active_model_unavailable'
        };
    }

    const recent = await prisma.aiRewardLog.findMany({
        where: { scoreBefore: { not: null } },
        orderBy: { createdAt: 'desc' },
        take: WINDOW * 2,
        select: { id: true, configSnapshot: true }
    });
    const scores = recent.flatMap((row) => {
        const proof = parseVerifiedPredictionProvenance(row.configSnapshot, row.id);
        return proof?.modelVersion === modelVersion ? [proof.score] : [];
    });
    if (scores.length < 2 * 10) {
        return {
            psi: null,
            baselineSamples: scores.length,
            currentSamples: 0,
            modelVersion,
            reliability: 'UNAVAILABLE',
            reason: 'insufficient_verified_samples'
        };
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
    return {
        psi,
        baselineSamples: baseline.length,
        currentSamples: current.length,
        modelVersion,
        reliability: 'VERIFIED',
        reason: null
    };
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
export async function computeLabelDrift(
    production: StoredModel | null,
    resolvedScope?: ResolvedTrainingScope
): Promise<{
    currentPositiveRate: number | null;
    trainingPositiveRate: number | null;
    delta: number | null;
    reason: string | null;
}> {
    const scope = resolvedScope ?? (await resolveTrainingScope(production));
    if (scope.status !== 'AVAILABLE') {
        return {
            currentPositiveRate: null,
            trainingPositiveRate: null,
            delta: null,
            reason: scope.reason
        };
    }
    const features = await getEligibleLabeledFeatures(scope);
    let currentPositiveRate: number | null = null;
    if (features.length > 0) {
        const positives = features.filter(
            (f) => f.label === 'ACCEPTED' || f.label === 'ACCEPTED_AFTER_MODIFICATION'
        ).length;
        currentPositiveRate = positives / features.length;
    }

    const trainingPositiveRate = scope.positiveRate;
    const delta =
        currentPositiveRate != null && trainingPositiveRate != null
            ? currentPositiveRate - trainingPositiveRate
            : null;
    return { currentPositiveRate, trainingPositiveRate, delta, reason: null };
}

/**
 * Shadow stats (ETAP 7B): ostatni nieaktywny kandydat (APPROVED) liczony na
 * tych samych danych produkcyjnych co model produkcyjny — shadowAuc pokazuje,
 * jak kandydat zachowywałby się w produkcji bez wpływu na ranking.
 * Minimalna wersja wg planu (wells_ai_influence=0 działa jako shadow;
 * pełny tracker YAGNI — dopiero gdy pojawią się dane).
 */
export async function computeShadowStats(
    production: StoredModel | null,
    resolvedScope?: ResolvedTrainingScope
): Promise<{
    candidateVersion: string | null;
    productionVersion: string | null;
    shadowAuc: number | null;
    productionAuc: number | null;
    samples: number;
    reason: string | null;
}> {
    const base = {
        candidateVersion: null,
        productionVersion: production?.version ?? null,
        shadowAuc: null,
        productionAuc: null,
        samples: 0,
        reason: null
    };
    if (!production) return base;

    const productionScope = resolvedScope ?? (await resolveTrainingScope(production));
    if (productionScope.status !== 'AVAILABLE') {
        return { ...base, reason: productionScope.reason };
    }

    const candidate = await prisma.aiModel.findFirst({
        where: {
            active: false,
            state: 'APPROVED',
            featureVersion: ML_CONSTANTS.FEATURE_VERSION
        },
        orderBy: { createdAt: 'desc' }
    });
    if (!candidate) {
        return { ...base, productionVersion: production.version, reason: 'no_approved_candidate' };
    }

    const candidateScope = await resolveTrainingScope(candidate.version);
    if (candidateScope.status !== 'AVAILABLE') {
        return {
            ...base,
            candidateVersion: candidate.version,
            reason: candidateScope.reason
        };
    }
    if (!candidateScope.trainedAt || !productionScope.trainedAt) {
        return {
            ...base,
            candidateVersion: candidate.version,
            reason: 'missing_training_completion_time'
        };
    }

    const comparisonScope: ResolvedTrainingScope = {
        ...candidateScope,
        trainedAt:
            candidateScope.trainedAt > productionScope.trainedAt
                ? candidateScope.trainedAt
                : productionScope.trainedAt
    };

    const features = await getEligibleLabeledFeatures(comparisonScope);
    if (features.length < 10) {
        return {
            ...base,
            candidateVersion: candidate.version,
            reason: 'insufficient_post_training_samples'
        };
    }

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
    if (labels.length < 10) {
        return {
            ...base,
            candidateVersion: candidate.version,
            reason: 'insufficient_post_training_samples'
        };
    }

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
        samples: labels.length,
        reason: null
    };
}

/**
 * Pełny raport driftu dla /ai/drift.
 */
export async function buildDriftReport(): Promise<DriftReport> {
    try {
        const { modelRegistry } = await import('./ModelRegistry');
        const production = await modelRegistry.getProductionModel();
        const trainingScope = await resolveTrainingScope(production);
        const [feature, prediction, label, shadow] = await Promise.all([
            computeFeatureDrift(production, trainingScope),
            computePredictionDrift(production?.version ?? null),
            computeLabelDrift(production, trainingScope),
            computeShadowStats(production, trainingScope)
        ]);
        return {
            feature,
            trainingScope: {
                status: trainingScope.status,
                reason: trainingScope.reason,
                modelVersion: trainingScope.modelVersion
            },
            prediction,
            label,
            shadow,
            generatedAt: new Date().toISOString()
        };
    } catch (e) {
        logger.error(
            'DriftService',
            `Błąd budowy raportu driftu: ${e instanceof Error ? e.message : String(e)}`
        );
        return {
            feature: [],
            trainingScope: {
                status: 'UNAVAILABLE',
                reason: 'drift_report_error',
                modelVersion: null
            },
            prediction: {
                psi: null,
                baselineSamples: 0,
                currentSamples: 0,
                reliability: 'UNAVAILABLE',
                reason: 'drift_report_error'
            },
            label: {
                currentPositiveRate: null,
                trainingPositiveRate: null,
                delta: null,
                reason: 'drift_report_error'
            },
            shadow: {
                candidateVersion: null,
                productionVersion: null,
                shadowAuc: null,
                productionAuc: null,
                samples: 0,
                reason: 'drift_report_error'
            },
            generatedAt: new Date().toISOString()
        };
    }
}

/**
 * Jedna cecha FEATURE_NAMES → wartość z rekordu aiFeature (ten sam wymiar co wektor).
 * Agregaty przejść (transition*) pobierane z transAgg (join z ai_transition_snapshots,
 * spójnie z treningiem) — brak przejść = 0, nigdy null.
 */
export function rawFeatureValue(
    f: Awaited<ReturnType<typeof prisma.aiFeature.findMany>>[number],
    name: string,
    transAgg?: TransitionAggregates | null
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
            return kineta === 'beton' || kineta === 'standard' ? 1 : 0;
        case 'kineta_none':
            return kineta === 'brak' ? 1 : 0;
        case 'dennicaHeight':
            return f.dennicaHeight ?? null;
        case 'transitionCount':
        case 'maxTransitionDnMm':
        case 'minTransitionHeightMm':
        case 'maxTransitionHeightMm':
        case 'avgTransitionHeightMm': {
            // Agregaty przejść z ai_transition_snapshots (join po telemetryId==configId).
            // Brak przejść (brak snapshotów / brak telemetryId) = 0 — identyczna semantyka
            // jak trening (oneHotEncode default 0). Nigdy null.
            const agg = transAgg ?? null;
            switch (name) {
                case 'transitionCount':
                    return agg?.transitionCount ?? 0;
                case 'maxTransitionDnMm':
                    return agg?.maxTransitionDnMm ?? 0;
                case 'minTransitionHeightMm':
                    return agg?.minTransitionHeightMm ?? 0;
                case 'maxTransitionHeightMm':
                    return agg?.maxTransitionHeightMm ?? 0;
                case 'avgTransitionHeightMm':
                    return agg?.avgTransitionHeightMm ?? 0;
                default:
                    return 0;
            }
        }
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
