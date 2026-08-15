/**
 * Baseline rozkładów cech (histogramy z TRAIN) dla monitoringu driftu.
 * Przechowywane w AiModel.featureDistributions jako wersjonowany JSON.
 *
 * Format:
 * {
 *   "version": 1,
 *   "features": {
 *     "<feature>": { "bins": [0, 1, 2], "counts": [12, 34, 5] }
 *   }
 * }
 *
 * Parser z guardem `version`: znana wersja → parsuje, nieznana → ignoruje
 * (nie rzuca wyjątku tylko dlatego, że format jest nieznany).
 */

export interface FeatureDistribution {
    bins: number[];
    counts: number[];
}

export interface FeatureDistributions {
    version: number;
    features: Record<string, FeatureDistribution>;
}

export const FEATURE_DISTRIBUTIONS_VERSION = 1;

const BINS_DEFAULT = 10;

/**
 * Liczy histogram (fixed bins) dla jednej cechy. Wartości NaN/Infinity trafiają
 * do osobnej kategorii — sposób jawnie reprezentowany w metryce (lastBin = "invalid").
 */
export function buildHistogram(values: number[], binCount = BINS_DEFAULT): FeatureDistribution {
    const finite = values.filter((v) => Number.isFinite(v));
    const invalidCount = values.length - finite.length;
    if (finite.length === 0) {
        return { bins: [0, 1], counts: [0, invalidCount] };
    }
    let min = Infinity;
    let max = -Infinity;
    for (const v of finite) {
        if (v < min) min = v;
        if (v > max) max = v;
    }
    const bins: number[] = [];
    const counts: number[] = [];
    if (max === min) {
        // Degenerat: jedna wartość — jeden bin + kategoria invalid.
        bins.push(min);
        counts.push(finite.length);
    } else {
        for (let i = 0; i < binCount; i++) {
            bins.push(min + ((max - min) * i) / binCount);
        }
        bins.push(max);
        for (let i = 0; i < binCount; i++) {
            counts.push(0);
        }
        for (const v of finite) {
            let idx = Math.floor(((v - min) / (max - min)) * binCount);
            if (idx >= binCount) idx = binCount - 1;
            if (idx < 0) idx = 0;
            counts[idx]++;
        }
    }
    if (invalidCount > 0) {
        counts.push(invalidCount);
    }
    return { bins, counts };
}

/**
 * Buduje pełny obiekt featureDistributions z wektorów TRAIN (wymiar = FEATURE_NAMES.length).
 */
export function buildFeatureDistributions(
    featureNames: string[],
    trainVectors: number[][]
): FeatureDistributions {
    const features: Record<string, FeatureDistribution> = {};
    featureNames.forEach((name, i) => {
        features[name] = buildHistogram(trainVectors.map((vec) => vec[i]));
    });
    return { version: FEATURE_DISTRIBUTIONS_VERSION, features };
}

export function isFeatureDistributions(value: unknown): value is FeatureDistributions {
    if (typeof value !== 'object' || value === null) return false;
    const v = value as Record<string, unknown>;
    return typeof v.version === 'number' && typeof v.features === 'object' && v.features !== null;
}

/**
 * Parsuje JSON z bazy. Nieznana wersja → null (ignoruj, nie rzucaj).
 */
export function parseFeatureDistributions(
    raw: string | null | undefined
): FeatureDistributions | null {
    if (!raw) return null;
    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        return null;
    }
    if (!isFeatureDistributions(parsed)) return null;
    if (parsed.version !== FEATURE_DISTRIBUTIONS_VERSION) return null;
    return parsed;
}

/**
 * PSI (Population Stability Index) między baseline a bieżącym rozkładem.
 * Bins muszą być spójne (ten sam podział co w baseline). Wartości spoza
 * zakresu baseline trafiają do pierwszego/ostatniego bina.
 * Zwraca null, gdy baseline jest pusty lub brak danych.
 */
export function computePsi(baseline: FeatureDistribution, currentValues: number[]): number | null {
    if (!baseline.counts.length) return null;
    const baselineTotal = baseline.counts.reduce((a, b) => a + b, 0);
    if (baselineTotal === 0) return null;

    // Wartości skończone rozkładamy na biny baseline; NaN/Inf do ostatniej kategorii.
    const current = new Array(baseline.counts.length).fill(0);
    const lastIdx = baseline.counts.length - 1;
    let currentTotal = 0;
    for (const v of currentValues) {
        if (!Number.isFinite(v)) {
            current[lastIdx]++;
            currentTotal++;
            continue;
        }
        const bins = baseline.bins;
        const min = bins[0];
        const max = bins[bins.length - 1];
        let idx: number;
        if (bins.length === 1) {
            idx = 0;
        } else if (v <= min) {
            idx = 0;
        } else if (v >= max) {
            idx = bins.length - 2;
        } else {
            idx = Math.floor(((v - min) / (max - min)) * (bins.length - 1));
            if (idx >= bins.length - 1) idx = bins.length - 2;
            if (idx < 0) idx = 0;
        }
        current[idx]++;
        currentTotal++;
    }
    if (currentTotal === 0) return null;

    let psi = 0;
    for (let i = 0; i < baseline.counts.length; i++) {
        const expected = baseline.counts[i] / baselineTotal;
        const actual = current[i] / currentTotal;
        if (expected === 0 && actual === 0) continue;
        if (expected === 0) {
            // Nieoczekiwana wartość tam, gdzie baseline niczego nie miał — silny sygnał.
            psi += 1;
            continue;
        }
        if (actual === 0) continue;
        psi += (actual - expected) * Math.log(actual / expected);
    }
    return Math.abs(psi);
}
