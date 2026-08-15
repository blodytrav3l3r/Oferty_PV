import prisma from '../../prismaClient';
import crypto from 'crypto';
import { logger } from '../../utils/logger';
import {
    AcceptanceModel,
    TrainingDivergenceError,
    TrainingNumericalError,
    TrainingTimeoutError
} from './AcceptanceModel';
import { modelRegistry, type ModelMetrics, type StoredModel } from './ModelRegistry';
import { AiModelState } from './aiModelState';
import {
    featureExtractor,
    normalizeWarehouse,
    labelToTrainingWeight,
    type FeatureLabel
} from './FeatureExtractor';
import { ML_CONFIG } from './trainingConfig';
import { FEATURE_NAMES, ML_CONSTANTS } from '../../config/mlConstants';
import {
    computeBrier,
    computeConfusion,
    computeEce,
    computeLogLoss,
    computePrAuc
} from './metrics';
import { buildFeatureDistributions } from './featureDistributions';

// Semantyka statusów treningu (plan MLOps):
// RUNNING | SUCCESS | SKIPPED | FAILED_NUMERICAL | FAILED_VALIDATION | FAILED_TIMEOUT | FAILED_ERROR
// - SKIPPED: normalny wynik (za mało danych/klas/testu) — to NIE jest błąd.
// - FAILED_VALIDATION: trening się udał, model POWSTAŁ, ale nie przeszedł guardraili deploy.
// - FAILED_TIMEOUT: cooperative cancellation (deadline sprawdzany co epokę).
export const TRAINING_STATUS = {
    RUNNING: 'RUNNING',
    SUCCESS: 'SUCCESS',
    SKIPPED: 'SKIPPED',
    FAILED_NUMERICAL: 'FAILED_NUMERICAL',
    FAILED_VALIDATION: 'FAILED_VALIDATION',
    FAILED_TIMEOUT: 'FAILED_TIMEOUT',
    FAILED_ERROR: 'FAILED_ERROR'
} as const;

export const SEED = 42;

/**
 * Fingerprint datasetu treningowego: SHA-256 nad SORTOWANYMI rekordami.
 * Sortowanie przed hashowaniem — ten sam dataset daje ten sam fingerprint
 * niezależnie od kolejności zwróconej przez DB.
 */
export function computeDatasetFingerprint(
    records: Array<{ id: string; timestamp: string; label: string }>,
    featureVersion: string
): string {
    const lines = records.map((r) => `${r.id}|${r.timestamp}|${r.label}|${featureVersion}`).sort();
    return crypto.createHash('sha256').update(lines.join('\n'), 'utf8').digest('hex');
}

function applyForgetting(exampleAgeDays: number): number {
    const lambda = 0.01;
    return Math.exp(-lambda * exampleAgeDays);
}

export function seasonToNum(s: string): number {
    const lower = (s || 'unknown').toLowerCase();
    if (lower === 'spring') return 0;
    if (lower === 'summer') return 1;
    if (lower === 'autumn') return 2;
    if (lower === 'winter') return 3;
    return 0;
}

// Agregaty przejść szczelnych (średnica + podniesienie od dna). Używane przy
// treningu (joiny z ai_transition_snapshots) i w mlDualRanking.buildFeatureVector
// (serve) — muszą liczyć identycznie (test parytetu cech weryfikuje zgodność).
export interface TransitionAggregates {
    transitionCount: number;
    maxTransitionDnMm: number;
    minTransitionHeightMm: number;
    maxTransitionHeightMm: number;
    avgTransitionHeightMm: number;
}

export function aggregateTransitionFeatures(
    snaps: Array<{ dn?: string | number | null; heightFromBottomMm?: number | null }>
): TransitionAggregates | null {
    if (!snaps || snaps.length === 0) return null;
    const heights: number[] = [];
    let maxDn = 0;
    for (const s of snaps) {
        const dn = s.dn != null ? parseInt(String(s.dn), 10) : NaN;
        if (Number.isFinite(dn) && dn > 0) maxDn = Math.max(maxDn, dn);
        const h = s.heightFromBottomMm ?? NaN;
        if (Number.isFinite(h)) heights.push(h);
    }
    const min = heights.length > 0 ? Math.round(Math.min(...heights)) : 0;
    const max = heights.length > 0 ? Math.round(Math.max(...heights)) : 0;
    const avg =
        heights.length > 0 ? Math.round(heights.reduce((a, b) => a + b, 0) / heights.length) : 0;
    return {
        transitionCount: snaps.length,
        maxTransitionDnMm: maxDn,
        minTransitionHeightMm: min,
        maxTransitionHeightMm: max,
        avgTransitionHeightMm: avg
    };
}

// Eksportowany dla testu parytetu cech train/serve (tests/ml/featureParity.test.ts).
export function oneHotEncode(raw: Record<string, unknown>): number[] {
    const warehouse = normalizeWarehouse(raw.warehouse as string);
    const wellType = ((raw.wellType as string) || 'standard').toLowerCase();
    const dn = Number(raw.dn) || 0;
    const ringCount = Number(raw.ringCount) || 0;

    // v6: kineta — one-hot (preco/precotop→preco, unolith, reszta→standard).
    // Spójne z buildFeatureVector (mlDualRanking.js): 'brak'/nieznane → wszystkie 0.
    const kineta = String(raw.kinetaType ?? raw.kineta ?? '').toLowerCase();

    const vec: number[] = [];
    vec.push(dn);
    vec.push(Number(raw.heightMm) || 0);
    vec.push(warehouse === 'KLB' ? 1 : 0);
    vec.push(warehouse === 'WL' ? 1 : 0);
    vec.push(wellType === 'standard' ? 1 : 0);
    vec.push(wellType === 'psia_buda' ? 1 : 0);
    vec.push(wellType === 'styczna' || wellType === 'styczna_1200' ? 1 : 0);
    vec.push(raw.hasReduction ? 1 : 0);
    vec.push(raw.hasPsiaBuda ? 1 : 0);
    vec.push(ringCount);
    vec.push(Number(raw.connectionCount) || 0);
    vec.push(Number(raw.transitionsAboveDennica) || 0);
    vec.push(Number(raw.totalPrice) || 0);
    vec.push(Number(raw.totalWeight) || 0);
    vec.push(Number(raw.ringVariety) || 0);
    vec.push(seasonToNum(raw.season as string));
    vec.push(raw.bottomType && String(raw.bottomType) !== 'unknown' ? 1 : 0);
    vec.push(raw.topType && String(raw.topType) !== 'unknown' ? 1 : 0);
    vec.push(dn * ringCount);
    vec.push(warehouse === 'KLB' && wellType === 'standard' ? 1 : 0);
    vec.push(kineta === 'preco' || kineta === 'precotop' ? 1 : 0);
    vec.push(kineta === 'unolith' ? 1 : 0);
    vec.push(kineta === 'beton' || kineta === '' ? 1 : 0);
    vec.push(Number(raw.dennicaHeight) || 0);
    vec.push(Number(raw.transitionCount) || 0);
    vec.push(Number(raw.maxTransitionDnMm) || 0);
    vec.push(Number(raw.minTransitionHeightMm) || 0);
    vec.push(Number(raw.maxTransitionHeightMm) || 0);
    vec.push(Number(raw.avgTransitionHeightMm) || 0);
    return vec;
}

function normalize(vec: number[], mins: number[], maxs: number[]): number[] {
    return vec.map((v, i) => {
        const range = maxs[i] - mins[i];
        if (range === 0) return 0;
        return (v - mins[i]) / range;
    });
}

export function computeRocAuc(scores: number[], labels: number[]): number {
    const n = scores.length;
    if (n < 2) return 0.5;
    const pairs = scores.map((s, i) => ({ score: s, label: labels[i] }));
    let pos = 0;
    let neg = 0;
    for (const p of pairs) {
        if (p.label === 1) pos++;
        else neg++;
    }
    if (pos === 0 || neg === 0) return 0.5;
    // Sortowanie rosnące: najniższy score = ranga 1, najwyższy = ranga n.
    // Równe wartości dostają ŚREDNIĄ rangę grupy (Mann-Whitney z tie-correction) —
    // bez tego saturowany sigmoid (identyczne predykcje) daje zdegenerowany AUC
    // zależny od kolejności rekordów i fałszywy auto-rollback.
    pairs.sort((a, b) => a.score - b.score);
    let rankSum = 0;
    let i = 0;
    while (i < n) {
        let j = i;
        while (j + 1 < n && pairs[j + 1].score === pairs[i].score) {
            j++;
        }
        const avgRank = (i + 1 + j + 1) / 2;
        for (let k = i; k <= j; k++) {
            if (pairs[k].label === 1) rankSum += avgRank;
        }
        i = j + 1;
    }
    const auc = (rankSum - (pos * (pos + 1)) / 2) / (pos * neg);
    return parseFloat(auc.toFixed(4));
}

export class TrainingPipeline {
    private running = false;
    private mutex: Promise<void> | null = null;
    private lastTrainedAt: string | null = null;

    private async acquire(): Promise<() => void> {
        let release: () => void;
        const prev = this.mutex;
        this.mutex = new Promise<void>((resolve) => {
            release = resolve;
        });
        const timer = setTimeout(() => {
            logger.error('TrainingPipeline', 'Mutex timeout 5min — wymuszam zwolnienie');
            release!();
        }, 300_000);
        await prev;
        clearTimeout(timer);
        return release!;
    }

    async run(
        force = false
    ): Promise<{ trained: boolean; version?: string; metrics?: ModelMetrics; reason?: string }> {
        if (this.running && !force) {
            return { trained: false, reason: 'already_running' };
        }
        const release = await this.acquire();
        this.running = true;

        // Run audit — jeden wiersz AiTrainingRun na każdy przebieg (też SKIPPED).
        const runId = crypto.randomUUID();
        const startedAt = new Date().toISOString();
        let datasetSize = 0;
        let trainSize = 0;
        let valSize = 0;
        let testSize = 0;
        let candidateModelVersion: string | null = null;
        let comparedAgainstVersion: string | null = null;
        let metricsJson: string | null = null;
        let baselineAccuracy: number | null = null;
        let positiveRate: number | null = null;
        let deployed = false;
        let deploymentReason: string | null = null;
        let errorMsg: string | null = null;
        let fingerprint: string | null = null;
        let datasetStartAt: string | null = null;
        let datasetEndAt: string | null = null;
        let status: string = TRAINING_STATUS.RUNNING;

        const finish = async (
            s: string,
            reason?: string
        ): Promise<{ trained: boolean; reason: string }> => {
            status = s;
            if (reason) errorMsg = reason;
            try {
                await prisma.aiTrainingRun.update({
                    where: { id: runId },
                    data: {
                        status,
                        finishedAt: new Date().toISOString(),
                        datasetSize,
                        trainSize,
                        validationSize: valSize,
                        testSize,
                        candidateModelVersion,
                        comparedAgainstVersion,
                        datasetStartAt,
                        datasetEndAt,
                        datasetFingerprint: fingerprint,
                        metrics: metricsJson,
                        baselineAccuracy,
                        positiveRate,
                        deployed,
                        deploymentReason,
                        error: errorMsg
                    }
                });
            } catch (e) {
                logger.error(
                    'TrainingPipeline',
                    `Błąd zapisu AiTrainingRun ${runId}: ${e instanceof Error ? e.message : String(e)}`
                );
            }
            return { trained: false, reason: errorMsg || s };
        };

        try {
            await prisma.aiTrainingRun.create({
                data: {
                    id: runId,
                    startedAt,
                    status,
                    datasetSize: 0,
                    trainSize: 0,
                    validationSize: 0,
                    testSize: 0,
                    featureVersion: ML_CONSTANTS.FEATURE_VERSION,
                    seed: SEED,
                    deployed: false
                }
            });

            await featureExtractor.extractAndStore();
            // Feedback (accept/reject/modify) często nadchodzi PO ekstrakcji cech.
            // Re-synchronizuj etykiety, żeby trening miał klasę negatywną (bez niej
            // model jest zdegenerowany — stała predykcja ~1.0 dla wszystkich kandydatów).
            await featureExtractor.resyncLabels();
            // Historyczne wektory policzone przez stare wersje ekstraktora mają puste
            // cechy (ringCount/connectionCount/bottomType) — przelicz je w miejscu.
            await featureExtractor.resyncFeatures();

            // Okno treningowe: najnowsze TRAINING_BATCH_SIZE wektorów (sliding window).
            // Kolejność desc + reverse, by split train/val pozostał chronologiczny
            // (train = starsze z okna, val = najnowsze z okna).
            const features = await prisma.aiFeature.findMany({
                orderBy: { createdAt: 'desc' },
                take: ML_CONSTANTS.TRAINING_BATCH_SIZE
            });
            features.reverse();

            if (features.length < ML_CONFIG.minFeatureCountForTraining) {
                logger.info(
                    'TrainingPipeline',
                    `Za mało danych: ${features.length} < ${ML_CONFIG.minFeatureCountForTraining}`
                );
                return finish(TRAINING_STATUS.SKIPPED, `insufficient_data:${features.length}`);
            }

            const latestAt = features.length > 0 ? features[features.length - 1].createdAt : null;
            const newCount = this.lastTrainedAt
                ? await prisma.aiFeature.count({
                      where: { createdAt: { gt: this.lastTrainedAt } }
                  })
                : features.length;
            if (!force && newCount < ML_CONFIG.minNewRecordsForTraining) {
                logger.info(
                    'TrainingPipeline',
                    `Za mało nowych danych: ${newCount} < ${ML_CONFIG.minNewRecordsForTraining}`
                );
                return finish(TRAINING_STATUS.SKIPPED, `insufficient_new_data:${newCount}`);
            }

            const { normalized, mins, maxs, dim, records } =
                await this.loadAndNormalizeFeatures(features);

            // ===== Split 70/15/15 chronologiczny =====
            // TRAIN (najstarsze) → VALIDATION → TEST (najnowsze).
            const n = normalized.length;
            const trainIdx = Math.floor(n * 0.7);
            const valIdx = Math.floor(n * 0.85);
            const trainSet = normalized.slice(0, trainIdx);
            const valSet = normalized.slice(trainIdx, valIdx);
            const testSet = normalized.slice(valIdx);

            // Guardy minimalnych rozmiarów — niespełnienie → SKIPPED (nie błąd).
            trainSize = trainSet.length;
            valSize = valSet.length;
            testSize = testSet.length;
            datasetSize = n;

            const testPositive = testSet.filter((ex) => ex.label === 1).length;
            const testNegative = testSet.length - testPositive;
            const guardFail =
                n < ML_CONFIG.minDatasetForSplit ||
                trainSize < ML_CONFIG.minTrain ||
                valSize < ML_CONFIG.minVal ||
                testSize < ML_CONFIG.minTest ||
                testPositive < ML_CONFIG.minTestPositive ||
                testNegative < ML_CONFIG.minTestNegative;
            if (guardFail) {
                logger.info(
                    'TrainingPipeline',
                    `Guard rozmiaru nie przeszedł (n=${n}, train=${trainSize}, val=${valSize}, test=${testSize}, testPos=${testPositive}, testNeg=${testNegative}) — SKIPPED`
                );
                return finish(
                    TRAINING_STATUS.SKIPPED,
                    `split_guard:dataset=${n},train=${trainSize},val=${valSize},test=${testSize},testPos=${testPositive},testNeg=${testNegative}`
                );
            }

            // Fingerprint datasetu (z rekordów po filtrze NO_FEEDBACK) + zakres czasowy.
            if (records.length > 0) {
                fingerprint = computeDatasetFingerprint(
                    records.map((r) => ({ id: r.id, timestamp: r.createdAt, label: r.label })),
                    ML_CONSTANTS.FEATURE_VERSION
                );
                datasetStartAt = records[0].createdAt;
                datasetEndAt = records[records.length - 1].createdAt;
            }

            // Guarda balansu klas: model trenowany na jednej klasie (np. same
            // ACCEPTED) daje zdegenerowane predykcje ~1.0 i AUC=0.5 — nie ma
            // sensu go trenować ani tym bardziej wdrażać (gate bestAuc<0 był
            // otwarty i pierwszy taki model deployował się automatycznie).
            const trainClasses = new Set(trainSet.map((ex) => ex.label));
            const valClasses = new Set(valSet.map((ex) => ex.label));
            if (trainClasses.size < 2 || valClasses.size < 2) {
                logger.info(
                    'TrainingPipeline',
                    `Brak balansu klas (train=${trainClasses.size}, val=${valClasses.size}) — pomijam trening`
                );
                return finish(
                    TRAINING_STATUS.SKIPPED,
                    `insufficient_label_diversity:train=${trainClasses.size},val=${valClasses.size}`
                );
            }

            const model = new AcceptanceModel(dim);
            model.train(
                trainSet.map((ex) => ({ features: ex.vec, label: ex.label, weight: ex.weight })),
                0.01,
                5000,
                0.01,
                {
                    // Timeout: cooperative cancellation — deadline sprawdzany co epokę
                    deadline: Date.now() + ML_CONFIG.maxTrainingDurationMs,
                    divergenceThreshold: ML_CONFIG.divergenceThreshold,
                    divergenceEpochs: ML_CONFIG.divergenceEpochs
                }
            );

            // TEST — wyłącznie końcowa, niezależna ocena. NIE wpływa na tuning,
            // thresholdy, wybór modelu ani decyzję o treningu/deploy.
            const metrics = this.evaluateModel(model, valSet, testSet, trainSet.length);

            // Baseline: accuracy klasyfikatora majority-class (ETAP 5).
            // positiveRate = częstotliwość klasy pozytywnej w TRAIN (osobno
            // przydatna w label drift). Porównanie model vs baseline w dashboardzie.
            const trainPositives = trainSet.filter((ex) => ex.label === 1).length;
            const positiveRateValue = trainPositives / trainSet.length;
            baselineAccuracy = Math.max(positiveRateValue, 1 - positiveRateValue);
            positiveRate = positiveRateValue;

            // Guardrail deploy (ETAP 5): porównanie z aktualnym PRODUCTION,
            // NIE z historycznym best. Pierwszy model (brak PRODUCTION) → tylko
            // absolutne progi; kolejne → absolutne + relatywne (brak regresji).
            const productionModel = await modelRegistry.getProductionModel();
            comparedAgainstVersion = productionModel?.version ?? null;
            const isFirstModel = productionModel == null;

            const gate = this.evaluateDeployGuard(metrics, productionModel, isFirstModel);
            if (!gate.ok) {
                logger.info(
                    'TrainingPipeline',
                    `Kandydat nie przeszedł guardrailu deploy (${gate.reason}) — FAILED_VALIDATION, REJECTED`
                );
                // Model POWSTAŁ (trening się udał) — zapisujemy go jako REJECTED,
                // żeby miał ślad w rejestrze i nie wpływał na ranking (active=false).
                const rejectedVersion = await modelRegistry.saveModel(
                    model,
                    metrics,
                    FEATURE_NAMES,
                    mins,
                    maxs,
                    false,
                    `REJECTED przez guardrail: ${gate.reason}`,
                    AiModelState.REJECTED,
                    this.buildFeatureDistributionsJson(trainSet)
                );
                candidateModelVersion = rejectedVersion;
                deployed = false;
                deploymentReason = gate.reason;
                return finish(TRAINING_STATUS.FAILED_VALIDATION, `${gate.code}:${gate.reason}`);
            }

            const version = await modelRegistry.saveModel(
                model,
                metrics,
                FEATURE_NAMES,
                mins,
                maxs,
                true,
                undefined,
                AiModelState.PRODUCTION,
                this.buildFeatureDistributionsJson(trainSet)
            );
            candidateModelVersion = version;
            deployed = true;
            deploymentReason = gate.reason;
            this.lastTrainedAt = latestAt;
            logger.info(
                'TrainingPipeline',
                `Wytrenowano i wdrożono ${version} (auc=${metrics.rocAuc})`
            );
            return finish(TRAINING_STATUS.SUCCESS, undefined).then(() => ({
                trained: true,
                version,
                metrics
            }));
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            // Guardraile numeryczne (ETAP 3) — specyficzne statusy zamiast FAILED_ERROR.
            let status: string = TRAINING_STATUS.FAILED_ERROR;
            if (e instanceof TrainingNumericalError) status = TRAINING_STATUS.FAILED_NUMERICAL;
            else if (e instanceof TrainingTimeoutError) status = TRAINING_STATUS.FAILED_TIMEOUT;
            else if (e instanceof TrainingDivergenceError)
                status = TRAINING_STATUS.FAILED_VALIDATION;
            logger.error('TrainingPipeline', `${status}: ${msg}`);
            await finish(status, `${status.toLowerCase()}:${msg}`);
            return { trained: false, reason: `${status.toLowerCase()}:${msg}` };
        } finally {
            this.running = false;
            release();
        }
    }

    /**
     * Guardrail deploy (ETAP 5). Zasada braku regresji: NIE wdrażaj, jeśli
     * dowolna krytyczna metryka istotnie się pogorszyła, nawet gdy ROC-AUC wzrósł.
     *
     * Pierwszy model (brak PRODUCTION): absolutne progi (minAuc/minPrAuc/maxLogLoss/maxEce).
     * Kolejne: absolutne + relatywne vs aktualny PRODUCTION:
     *   rocAuc >= production.rocAuc + deployAucImprovement
     *   logLoss <= production.logLoss + maxLogLossRegression
     *   ece     <= production.ece     + maxEceRegression
     */
    private evaluateDeployGuard(
        metrics: ModelMetrics,
        production: StoredModel | null,
        isFirstModel: boolean
    ): { ok: boolean; reason: string; code: string } {
        const abs =
            metrics.rocAuc >= ML_CONFIG.minAuc &&
            (metrics.prAuc ?? -1) >= ML_CONFIG.minPrAuc &&
            (metrics.logLoss ?? Infinity) <= ML_CONFIG.maxLogLoss &&
            (metrics.ece ?? Infinity) <= ML_CONFIG.maxEce;
        if (!abs) {
            const reason = `auc=${metrics.rocAuc.toFixed(4)},prAuc=${metrics.prAuc ?? 'null'},logLoss=${metrics.logLoss ?? 'null'},ece=${metrics.ece ?? 'null'} (wymagane minAuc=${ML_CONFIG.minAuc},minPrAuc=${ML_CONFIG.minPrAuc},maxLogLoss=${ML_CONFIG.maxLogLoss},maxEce=${ML_CONFIG.maxEce})`;
            return { ok: false, reason, code: 'deploy_abs_insufficient' };
        }
        if (isFirstModel) return { ok: true, reason: 'first_model_abs_progi', code: 'ok' };
        if (production == null) {
            return {
                ok: false,
                reason: 'brak produkcji mimo isFirstModel=false',
                code: 'no_production'
            };
        }

        const relAuc = metrics.rocAuc >= production.metrics.rocAuc + ML_CONFIG.deployAucImprovement;
        const relLogLoss =
            production.metrics.logLoss == null ||
            (metrics.logLoss ?? Infinity) <=
                production.metrics.logLoss + ML_CONFIG.maxLogLossRegression;
        const relEce =
            production.metrics.ece == null ||
            (metrics.ece ?? Infinity) <= production.metrics.ece + ML_CONFIG.maxEceRegression;
        if (!relAuc || !relLogLoss || !relEce) {
            const reason = `vs PRODUCTION ${production.version}: auc=${metrics.rocAuc.toFixed(4)} (wym. >=${(production.metrics.rocAuc + ML_CONFIG.deployAucImprovement).toFixed(4)}), logLoss=${metrics.logLoss ?? 'null'} (wym. <=${production.metrics.logLoss == null ? 'n/d' : (production.metrics.logLoss + ML_CONFIG.maxLogLossRegression).toFixed(4)}), ece=${metrics.ece ?? 'null'} (wym. <=${production.metrics.ece == null ? 'n/d' : (production.metrics.ece + ML_CONFIG.maxEceRegression).toFixed(4)})`;
            return { ok: false, reason, code: 'deploy_rel_regression' };
        }
        return { ok: true, reason: 'guardrail_ok_vs_production', code: 'ok' };
    }

    /**
     * Baseline driftu cech: histogramy liczone WYŁĄCZNIE z TRAIN (nigdy
     * validation/test) — baseline nie może być skażony danymi spoza treningu.
     */
    private buildFeatureDistributionsJson(
        trainSet: Array<{ vec: number[]; label: number; weight: number }>
    ): string | null {
        try {
            const dist = buildFeatureDistributions(
                FEATURE_NAMES,
                trainSet.map((ex) => ex.vec)
            );
            return JSON.stringify(dist);
        } catch (e) {
            logger.error(
                'TrainingPipeline',
                `Błąd budowy featureDistributions: ${e instanceof Error ? e.message : String(e)}`
            );
            return null;
        }
    }

    private async loadAndNormalizeFeatures(
        features: Awaited<ReturnType<typeof prisma.aiFeature.findMany>>
    ): Promise<{
        normalized: Array<{ vec: number[]; label: number; weight: number }>;
        mins: number[];
        maxs: number[];
        dim: number;
        records: Array<{ id: string; createdAt: string; label: string }>;
    }> {
        // Cechy przejść: agregaty z ai_transition_snapshots (configId == telemetryId).
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
        const examples = features
            // NO_FEEDBACK (brak jakiegokolwiek sygnału użytkownika) nie niesie
            // informacji — wrzucenie go do klasy negatywnej zanieczyściłoby model.
            .filter((f) => f.label !== 'NO_FEEDBACK')
            .map((f) => {
                const raw: Record<string, unknown> = {
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
                    dennicaHeight: f.dennicaHeight
                };
                const agg = f.telemetryId ? transAggByConfig.get(f.telemetryId) : undefined;
                if (agg) Object.assign(raw, agg);
                const createdAt = new Date(f.createdAt);
                const ageDays = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
                return {
                    vec: oneHotEncode(raw),
                    label:
                        f.label === 'ACCEPTED' || f.label === 'ACCEPTED_AFTER_MODIFICATION' ? 1 : 0,
                    ageDays,
                    featureLabel: f.label
                };
            });

        const dim = FEATURE_NAMES.length;
        const mins = new Array(dim).fill(Infinity);
        const maxs = new Array(dim).fill(-Infinity);
        for (const ex of examples) {
            for (let i = 0; i < dim; i++) {
                if (ex.vec[i] < mins[i]) mins[i] = ex.vec[i];
                if (ex.vec[i] > maxs[i]) maxs[i] = ex.vec[i];
            }
        }
        for (let i = 0; i < dim; i++) {
            if (!isFinite(mins[i])) mins[i] = 0;
            if (!isFinite(maxs[i])) maxs[i] = 1;
        }

        const normalized = examples.map((ex) => ({
            vec: normalize(ex.vec, mins, maxs),
            label: ex.label,
            weight:
                applyForgetting(ex.ageDays) * labelToTrainingWeight(ex.featureLabel as FeatureLabel)
        }));

        const records = features
            .filter((f) => f.label !== 'NO_FEEDBACK')
            .map((f) => ({ id: f.id, createdAt: f.createdAt, label: f.label }));

        return { normalized, mins, maxs, dim, records };
    }

    private evaluateModel(
        model: AcceptanceModel,
        valSet: Array<{ vec: number[]; label: number; weight: number }>,
        testSet: Array<{ vec: number[]; label: number; weight: number }>,
        trainSize: number
    ): ModelMetrics {
        const valPredictions = valSet.map((ex) => model.predict(ex.vec));
        const valLabels = valSet.map((ex) => ex.label);

        let tp = 0,
            fp = 0,
            fn = 0,
            tn = 0;
        for (let i = 0; i < valLabels.length; i++) {
            const predBin = valPredictions[i] >= 0.5 ? 1 : 0;
            if (predBin === 1 && valLabels[i] === 1) tp++;
            else if (predBin === 1 && valLabels[i] === 0) fp++;
            else if (predBin === 0 && valLabels[i] === 1) fn++;
            else tn++;
        }
        const accuracy = (tp + tn) / (tp + fp + fn + tn || 1);
        const precision = tp / (tp + fp || 1);
        const recall = tp / (tp + fn || 1);
        const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
        const rocAuc = computeRocAuc(valPredictions, valLabels);

        // TEST: wyłącznie końcowa, niezależna ocena (testRocAuc).
        const testPredictions = testSet.map((ex) => model.predict(ex.vec));
        const testLabels = testSet.map((ex) => ex.label);
        const testRocAuc = computeRocAuc(testPredictions, testLabels);

        // ETAP 4: metryki uzupełniające na zbiorze walidacyjnym.
        // Matematycznie nieokreślone → null (nigdy NaN/Inf).
        const prAuc = computePrAuc(valPredictions, valLabels);
        const logLoss = computeLogLoss(valPredictions, valLabels);
        const brierScore = computeBrier(valPredictions, valLabels);
        const ece = computeEce(valPredictions, valLabels);
        const confusion = computeConfusion(valPredictions, valLabels);

        return {
            accuracy: parseFloat(accuracy.toFixed(4)),
            precision: parseFloat(precision.toFixed(4)),
            recall: parseFloat(recall.toFixed(4)),
            f1: parseFloat(f1.toFixed(4)),
            rocAuc,
            testRocAuc,
            prAuc,
            logLoss,
            brierScore,
            ece,
            confusion,
            trainSize,
            valSize: valSet.length
        };
    }

    getStatus(): { running: boolean } {
        return { running: this.running };
    }
}

export const trainingPipeline = new TrainingPipeline();
