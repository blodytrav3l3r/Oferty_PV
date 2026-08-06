import crypto from 'crypto';
import prisma from '../../prismaClient';
import { logger } from '../../utils/logger';
import type { AcceptanceModel } from './AcceptanceModel';
import { ML_CONSTANTS } from '../../config/mlConstants';

export interface ModelMetrics {
    accuracy: number;
    precision: number;
    recall: number;
    f1: number;
    rocAuc: number;
    trainSize: number;
    valSize: number;
}

export interface StoredModel {
    id: string;
    version: string;
    weights: number[];
    bias: number;
    metrics: ModelMetrics;
    features: string[];
    featureMins: number[];
    featureMaxs: number[];
    trainingRows: number;
    active: boolean;
    createdAt: string;
    featureVersion: string | null;
}

export class ModelRegistry {
    async saveModel(
        model: AcceptanceModel,
        metrics: ModelMetrics,
        features: string[],
        featureMins: number[],
        featureMaxs: number[],
        shouldActivate: boolean,
        notes?: string
    ): Promise<string> {
        const now = new Date();
        // wersja musi być unikalna (kolumna @unique) — suffix zapobiega
        // kolizji przy dwóch treningach tego samego dnia
        const version = `v1.0.0-${now.toISOString().slice(0, 10).replace(/-/g, '')}-${crypto
            .randomUUID()
            .slice(0, 8)}`;

        const id = crypto.randomUUID();
        await prisma.aiModel.create({
            data: {
                id,
                version,
                weights: JSON.stringify(model.getWeights()),
                bias: model.getBias(),
                metrics: JSON.stringify(metrics),
                features: JSON.stringify(features),
                featureMins: JSON.stringify(featureMins),
                featureMaxs: JSON.stringify(featureMaxs),
                trainingRows: metrics.trainSize,
                active: shouldActivate,
                notes: notes || null,
                featureVersion: ML_CONSTANTS.FEATURE_VERSION,
                createdAt: now.toISOString()
            }
        });

        if (shouldActivate) {
            const existing = await prisma.aiModel.findFirst({ where: { active: true } });
            if (existing) {
                await prisma.aiModel.update({
                    where: { id: existing.id },
                    data: { active: false }
                });
                logger.info('ModelRegistry', `Dezaktywowano poprzedni model ${existing.version}`);
            }
        }

        logger.info(
            'ModelRegistry',
            `Zapisano model ${version} (active=${shouldActivate}, auc=${metrics.rocAuc.toFixed(4)})`
        );
        return version;
    }

    async getActiveModel(): Promise<StoredModel | null> {
        // Prefer aktywny model bieżącej wersji cech — model starszej wersji
        // (inna liczba cech) dałby FEATURE_COUNT_MISMATCH na predict.
        const record = await prisma.aiModel.findFirst({
            where: { active: true, featureVersion: ML_CONSTANTS.FEATURE_VERSION }
        });
        if (record) return this.recordToModel(record);
        // Fallback: jeśli brak modelu w bieżącej wersji, nie zwracaj modelu
        // starszej wersji — frontend obsłuży 503 (technical fallback) zamiast 400.
        return null;
    }

    async getBestAuc(): Promise<number> {
        const records = await prisma.aiModel.findMany({
            where: { featureVersion: ML_CONSTANTS.FEATURE_VERSION }
        });
        let best = -1;
        for (const r of records) {
            try {
                const metrics = JSON.parse(r.metrics) as ModelMetrics;
                if (metrics.rocAuc > best) best = metrics.rocAuc;
            } catch {
                // pomijamy uszkodzone metryki
            }
        }
        return best;
    }

    async listModels(limit = 20): Promise<StoredModel[]> {
        const records = await prisma.aiModel.findMany({
            orderBy: { createdAt: 'desc' },
            take: limit
        });
        return records.map((r) => this.recordToModel(r));
    }

    async rollbackToPrevious(): Promise<StoredModel | null> {
        const active = await prisma.aiModel.findFirst({
            where: { active: true, featureVersion: ML_CONSTANTS.FEATURE_VERSION }
        });
        const previous = await prisma.aiModel.findFirst({
            where: { active: false, featureVersion: ML_CONSTANTS.FEATURE_VERSION },
            orderBy: { createdAt: 'desc' }
        });
        if (active && previous) {
            await prisma.aiModel.update({ where: { id: active.id }, data: { active: false } });
            await prisma.aiModel.update({ where: { id: previous.id }, data: { active: true } });
            logger.info('ModelRegistry', `Rollback do modelu ${previous.version}`);
            return this.recordToModel(previous);
        }
        if (active && !previous) {
            logger.warn('ModelRegistry', 'Brak poprzedniego modelu — rollback niemozliwy');
            return null;
        }
        return null;
    }

    async activateModel(id: string): Promise<StoredModel | null> {
        const target = await prisma.aiModel.findUnique({ where: { id } });
        if (!target) return null;
        if (target.active) return this.recordToModel(target);

        // Model spoza bieżącej wersji cech nie może być aktywny — inna liczba
        // cech dałaby FEATURE_COUNT_MISMATCH na predict (a getActiveModel i tak
        // go nie zwróci, więc status "active" byłby mylący).
        if (target.featureVersion !== ML_CONSTANTS.FEATURE_VERSION) {
            logger.warn(
                'ModelRegistry',
                `Odrzucono aktywację modelu ${target.version} (featureVersion=${target.featureVersion ?? 'null'} != ${ML_CONSTANTS.FEATURE_VERSION})`
            );
            throw new Error(
                `Nie można aktywować modelu spoza bieżącej wersji cech (${target.featureVersion ?? 'stara'} != ${ML_CONSTANTS.FEATURE_VERSION})`
            );
        }

        const active = await prisma.aiModel.findFirst({ where: { active: true } });
        if (active) {
            await prisma.aiModel.update({ where: { id: active.id }, data: { active: false } });
        }
        await prisma.aiModel.update({ where: { id: target.id }, data: { active: true } });
        logger.info('ModelRegistry', `Ręcznie wybrano model ${target.version}`);
        return this.recordToModel(target);
    }

    async promoteBestModel(): Promise<StoredModel | null> {
        const records = await prisma.aiModel.findMany({
            where: { featureVersion: ML_CONSTANTS.FEATURE_VERSION }
        });
        if (records.length === 0) return null;
        let best = records[0];
        let bestAuc = -1;
        for (const r of records) {
            let auc = -1;
            try {
                const metrics = JSON.parse(r.metrics) as ModelMetrics;
                auc = metrics.rocAuc;
            } catch {
                // pomijamy uszkodzone metryki
            }
            if (auc > bestAuc) {
                bestAuc = auc;
                best = r;
            }
        }
        const active = await prisma.aiModel.findFirst({ where: { active: true } });
        if (active && active.id === best.id) {
            return this.recordToModel(active);
        }
        if (active) {
            await prisma.aiModel.update({ where: { id: active.id }, data: { active: false } });
        }
        await prisma.aiModel.update({ where: { id: best.id }, data: { active: true } });
        logger.info('ModelRegistry', `Promowano najlepszy model ${best.version} (auc=${bestAuc})`);
        return this.recordToModel(best);
    }

    async deleteModel(id: string): Promise<StoredModel | null> {
        const record = await prisma.aiModel.findUnique({ where: { id } });
        if (!record) return null;
        if (record.active) {
            throw new Error('Nie można usunąć aktywnego modelu');
        }
        await prisma.aiModel.delete({ where: { id } });
        logger.info('ModelRegistry', `Usunięto model ${record.version}`);
        return this.recordToModel(record);
    }

    async getModelCount(): Promise<number> {
        return prisma.aiModel.count();
    }

    computeFeatureImportance(
        activeModel: StoredModel
    ): Array<{ featureName: string; importance: number }> {
        const importances = activeModel.weights.map((w, i) => {
            const range = activeModel.featureMaxs[i] - activeModel.featureMins[i];
            return {
                featureName: activeModel.features[i] || `feature_${i}`,
                importance: Math.abs(w) * (Number.isFinite(range) ? range : 0)
            };
        });
        importances.sort((a, b) => b.importance - a.importance);
        return importances;
    }

    private recordToModel(
        record: NonNullable<Awaited<ReturnType<typeof prisma.aiModel.findFirst>>>
    ): StoredModel {
        return {
            id: record.id,
            version: record.version,
            weights: JSON.parse(record.weights) as number[],
            bias: record.bias,
            metrics: JSON.parse(record.metrics) as ModelMetrics,
            features: JSON.parse(record.features) as string[],
            featureMins: JSON.parse(record.featureMins) as number[],
            featureMaxs: JSON.parse(record.featureMaxs) as number[],
            trainingRows: record.trainingRows,
            active: record.active,
            createdAt: record.createdAt,
            featureVersion: record.featureVersion
        };
    }
}

export const modelRegistry = new ModelRegistry();
