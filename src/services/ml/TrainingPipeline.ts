import prisma from '../../prismaClient';
import { logger } from '../../utils/logger';
import { AcceptanceModel } from './AcceptanceModel';
import { modelRegistry, type ModelMetrics } from './ModelRegistry';
import { featureExtractor } from './FeatureExtractor';
import { ML_CONFIG } from './trainingConfig';
import { FEATURE_NAMES } from '../../config/mlConstants';

function applyForgetting(exampleAgeDays: number): number {
    const lambda = 0.01;
    return Math.exp(-lambda * exampleAgeDays);
}

function seasonToNum(s: string): number {
    const lower = (s || 'unknown').toLowerCase();
    if (lower === 'spring') return 0;
    if (lower === 'summer') return 1;
    if (lower === 'autumn') return 2;
    if (lower === 'winter') return 3;
    return 0;
}

function oneHotEncode(raw: Record<string, unknown>): number[] {
    const warehouse = ((raw.warehouse as string) || 'KLB').toUpperCase();
    const wellType = ((raw.wellType as string) || 'standard').toLowerCase();
    const dn = Number(raw.dn) || 0;
    const ringCount = Number(raw.ringCount) || 0;

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
    return vec;
}

function normalize(vec: number[], mins: number[], maxs: number[]): number[] {
    return vec.map((v, i) => {
        const range = maxs[i] - mins[i];
        if (range === 0) return 0;
        return (v - mins[i]) / range;
    });
}

function computeRocAuc(scores: number[], labels: number[]): number {
    const n = scores.length;
    if (n < 2) return 0.5;
    const pairs = scores.map((s, i) => ({ score: s, label: labels[i] }));
    pairs.sort((a, b) => b.score - a.score);
    let pos = 0;
    let neg = 0;
    for (const p of pairs) {
        if (p.label === 1) pos++;
        else neg++;
    }
    if (pos === 0 || neg === 0) return 0.5;
    let rankSum = 0;
    for (let i = 0; i < n; i++) {
        if (pairs[i].label === 1) rankSum += i + 1;
    }
    const auc = (rankSum - (pos * (pos + 1)) / 2) / (pos * neg);
    return parseFloat(auc.toFixed(4));
}

export class TrainingPipeline {
    private running = false;
    private mutex: Promise<void> | null = null;
    private lastFeatureCount: number = 0;

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
        try {
            await featureExtractor.extractAndStore();

            const features = await prisma.aiFeature.findMany({
                orderBy: { createdAt: 'asc' },
                take: 2000
            });

            if (features.length < ML_CONFIG.minFeatureCountForTraining) {
                logger.info(
                    'TrainingPipeline',
                    `Za mało danych: ${features.length} < ${ML_CONFIG.minFeatureCountForTraining}`
                );
                return { trained: false, reason: `insufficient_data:${features.length}` };
            }

            const newCount = features.length - this.lastFeatureCount;
            if (!force && newCount < ML_CONFIG.minNewRecordsForTraining) {
                logger.info(
                    'TrainingPipeline',
                    `Za mało nowych danych: ${newCount} < ${ML_CONFIG.minNewRecordsForTraining}`
                );
                return { trained: false, reason: `insufficient_new_data:${newCount}` };
            }
            this.lastFeatureCount = features.length;

            const { normalized, mins, maxs, dim } = await this.loadAndNormalizeFeatures(features);

            const splitIdx = Math.floor(normalized.length * 0.8);
            const trainSet = normalized.slice(0, splitIdx);
            const valSet = normalized.slice(splitIdx);

            const model = new AcceptanceModel(dim);
            model.train(
                trainSet.map((ex) => ({ features: ex.vec, label: ex.label, weight: ex.weight })),
                0.01,
                5000
            );

            const metrics = this.evaluateModel(model, valSet, trainSet.length);

            const existingActive = await modelRegistry.getActiveModel();
            let shouldDeploy = true;
            if (existingActive && !force) {
                const oldAuc = existingActive.metrics.rocAuc;
                shouldDeploy = metrics.rocAuc > oldAuc + 0.05;
                if (!shouldDeploy) {
                    logger.info(
                        'TrainingPipeline',
                        `Nowy model AUC=${metrics.rocAuc} nie przekracza starego ${oldAuc}+0.05`
                    );
                }
            }

            if (shouldDeploy || force) {
                const version = await modelRegistry.saveModel(
                    model,
                    metrics,
                    FEATURE_NAMES,
                    mins,
                    maxs,
                    shouldDeploy
                );
                logger.info(
                    'TrainingPipeline',
                    `Wytrenowano i wdrożono ${version} (auc=${metrics.rocAuc})`
                );
                return { trained: true, version, metrics };
            }

            return { trained: false, reason: `auc_insufficient:${metrics.rocAuc.toFixed(4)}` };
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            logger.error('TrainingPipeline', `Błąd treningu: ${msg}`);
            return { trained: false, reason: `error:${msg}` };
        } finally {
            this.running = false;
            release();
        }
    }

    private async loadAndNormalizeFeatures(
        features: Awaited<ReturnType<typeof prisma.aiFeature.findMany>>
    ): Promise<{
        normalized: Array<{ vec: number[]; label: number; weight: number }>;
        mins: number[];
        maxs: number[];
        dim: number;
    }> {
        const examples = features.map((f) => {
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
                topType: f.topType
            };
            const createdAt = new Date(f.createdAt);
            const ageDays = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
            return { vec: oneHotEncode(raw), label: f.label === 'ACCEPTED' ? 1 : 0, ageDays };
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
            weight: applyForgetting(ex.ageDays)
        }));

        return { normalized, mins, maxs, dim };
    }

    private evaluateModel(
        model: AcceptanceModel,
        valSet: Array<{ vec: number[]; label: number; weight: number }>,
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

        return {
            accuracy: parseFloat(accuracy.toFixed(4)),
            precision: parseFloat(precision.toFixed(4)),
            recall: parseFloat(recall.toFixed(4)),
            f1: parseFloat(f1.toFixed(4)),
            rocAuc,
            trainSize,
            valSize: valSet.length
        };
    }

    getStatus(): { running: boolean } {
        return { running: this.running };
    }
}

export const trainingPipeline = new TrainingPipeline();
