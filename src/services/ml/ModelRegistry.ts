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

    async getModelCount(): Promise<number> {
        return prisma.aiModel.count();
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
