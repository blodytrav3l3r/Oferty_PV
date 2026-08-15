/**
 * Metryki uzupełniające modeli ML (ETAP 4 planu MLOps).
 *
 * Zasada: metryka matematycznie nieokreślona (0/0, brak klasy dodatniej itd.)
 * zwraca null — NIGDY NaN/Infinity (psułyby JSON i porównania).
 */

export interface ConfusionMatrix {
    tp: number;
    fp: number;
    fn: number;
    tn: number;
}

export interface ExtendedMetrics {
    prAuc: number | null;
    logLoss: number | null;
    brierScore: number | null;
    ece: number | null;
    confusion: ConfusionMatrix | null;
}

/**
 * PR-AUC przez trapezoidalną aproksymację krzywej precision-recall.
 * Krzywa startuje z punktu (recall=0, precision=1) — bez niego trapez
 * pomija pierwszy segment (perfect separator dawałby -0.5 zamiast 1).
 * Gdy brak pozytywów (tp+fn=0) — AUC nieokreślone → null.
 */
export function computePrAuc(predictions: number[], labels: number[]): number | null {
    const positives = labels.reduce((acc, l) => acc + (l === 1 ? 1 : 0), 0);
    if (positives === 0 || labels.length === 0) return null;

    const pairs = predictions.map((p, i) => ({ p, l: labels[i] })).sort((a, b) => b.p - a.p);

    let tp = 0;
    let fp = 0;
    let prevP = -1;
    const points: Array<{ r: number; pr: number }> = [];
    for (const { p, l } of pairs) {
        if (l === 1) tp++;
        else fp++;
        if (p !== prevP) {
            points.push({ r: tp / positives, pr: tp / (tp + fp || 1) });
            prevP = p;
        }
    }

    // Trapez między kolejnymi punktami krzywej, startując z (0, 1).
    let auc = 0;
    let prevR = 0;
    let prevPr = 1;
    for (const pt of points) {
        auc += ((pt.r - prevR) * (prevPr + pt.pr)) / 2;
        prevR = pt.r;
        prevPr = pt.pr;
    }
    return auc;
}

/**
 * Log-loss (cross-entropy). Predykcje przycinane do [eps, 1-eps] — log(0) = -Inf.
 * Wymaga pełnego zbioru etykiet (binary). Nieskończony wynik → null.
 */
export function computeLogLoss(predictions: number[], labels: number[]): number | null {
    if (predictions.length === 0 || predictions.length !== labels.length) return null;
    const eps = 1e-9;
    let sum = 0;
    for (let i = 0; i < predictions.length; i++) {
        const p = Math.min(Math.max(predictions[i], eps), 1 - eps);
        sum += labels[i] * Math.log(p) + (1 - labels[i]) * Math.log(1 - p);
    }
    const ll = -sum / predictions.length;
    return Number.isFinite(ll) ? ll : null;
}

/**
 * Brier score (średni błąd kwadratowy predykcji vs etykieta) — [0,1], mniej = lepiej.
 */
export function computeBrier(predictions: number[], labels: number[]): number | null {
    if (predictions.length === 0 || predictions.length !== labels.length) return null;
    let sum = 0;
    for (let i = 0; i < predictions.length; i++) {
        const d = predictions[i] - labels[i];
        sum += d * d;
    }
    return sum / predictions.length;
}

/**
 * Expected Calibration Error — średnie |acc(bin) - conf(bin)| ważone rozmiarem binu.
 * 10 binów. Gdy wszystkie predykcje w jednym binie — ECE = |acc - conf| tego binu.
 */
export function computeEce(predictions: number[], labels: number[], bins = 10): number | null {
    if (predictions.length === 0 || predictions.length !== labels.length) return null;
    const binEdges = Array.from({ length: bins + 1 }, (_, i) => i / bins);
    let total = 0;
    for (let b = 0; b < bins; b++) {
        const lo = binEdges[b];
        const hi = binEdges[b + 1];
        let conf = 0;
        let acc = 0;
        let count = 0;
        for (let i = 0; i < predictions.length; i++) {
            const p = predictions[i];
            const inBin = b === bins - 1 ? p >= lo && p <= hi : p >= lo && p < hi;
            if (inBin) {
                conf += p;
                acc += labels[i];
                count++;
            }
        }
        if (count > 0) {
            total += (count / predictions.length) * Math.abs(acc / count - conf / count);
        }
    }
    return total;
}

/**
 * Macierz pomyłek dla progu 0.5.
 */
export function computeConfusion(predictions: number[], labels: number[]): ConfusionMatrix | null {
    if (predictions.length === 0 || predictions.length !== labels.length) return null;
    let tp = 0,
        fp = 0,
        fn = 0,
        tn = 0;
    for (let i = 0; i < predictions.length; i++) {
        const predBin = predictions[i] >= 0.5 ? 1 : 0;
        if (predBin === 1 && labels[i] === 1) tp++;
        else if (predBin === 1 && labels[i] === 0) fp++;
        else if (predBin === 0 && labels[i] === 1) fn++;
        else tn++;
    }
    return { tp, fp, fn, tn };
}
