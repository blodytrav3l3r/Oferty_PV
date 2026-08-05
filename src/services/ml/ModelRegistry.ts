import crypto from 'crypto';
import prisma from '../../prismaClient';
import { logger } from '../../utils/logger';
import type { AcceptanceModel } from './AcceptanceModel';

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
        const version = `v1.0.0-${now.toISOString().slice(0, 10).replace(/-/g, '')}`;

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
        const record = await prisma.aiModel.findFirst({ where: { active: true } });
        if (!record) return null;
        return this.recordToModel(record);
    }

    async getBestAuc(): Promise<number> {
        const records = await prisma.aiModel.findMany();
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

    async getModelByVersion(version: string): Promise<StoredModel | null> {
        const record = await prisma.aiModel.findUnique({ where: { version } });
        if (!record) return null;
        return this.recordToModel(record);
    }

    async listModels(limit = 20): Promise<StoredModel[]> {
        const records = await prisma.aiModel.findMany({
            orderBy: { createdAt: 'desc' },
            take: limit
        });
        return records.map((r) => this.recordToModel(r));
    }

    async rollbackToPrevious(): Promise<StoredModel | null> {
        const active = await prisma.aiModel.findFirst({ where: { active: true } });
        const previous = await prisma.aiModel.findFirst({
            where: { active: false },
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

        const active = await prisma.aiModel.findFirst({ where: { active: true } });
        if (active) {
            await prisma.aiModel.update({ where: { id: active.id }, data: { active: false } });
        }
        await prisma.aiModel.update({ where: { id: target.id }, data: { active: true } });
        logger.info('ModelRegistry', `Ręcznie wybrano model ${target.version}`);
        return this.recordToModel(target);
    }

    async promoteBestModel(): Promise<StoredModel | null> {
        const records = await prisma.aiModel.findMany();
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
            createdAt: record.createdAt
        };
    }
}

export const modelRegistry = new ModelRegistry();
