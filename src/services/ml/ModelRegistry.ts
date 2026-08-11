import crypto from 'crypto';
import prisma from '../../prismaClient';
import { logger } from '../../utils/logger';
import type { AcceptanceModel } from './AcceptanceModel';
import { ML_CONSTANTS } from '../../config/mlConstants';
import { ML_CONFIG } from './trainingConfig';
import { clearPredictionCache } from './predictionCache';

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

/**
 * Okrojona reprezentacja modelu dla listy (GET /ai/models).
 * Pomija ciężkie pola (weights, bias, featureMins, featureMaxs),
 * których dashboard nie używa. `features` pozostaje tablicą —
 * frontend czyta z niej wyłącznie `.length`.
 */
export interface ModelListItem {
    id: string;
    version: string;
    active: boolean;
    createdAt: string;
    featureVersion: string | null;
    metrics: ModelMetrics | null;
    features: string[];
    trainingRows: number;
}

// Wyciąga rocAUC z zapisanych metryk; uszkodzony JSON lub brak pola rocAuc traktujemy jak -1.
// Używany przez getBestAuc, promoteBestModel i pruneOldModels.
function getRocAuc(metricsJson: string): number {
    try {
        const rocAuc = (JSON.parse(metricsJson) as ModelMetrics).rocAuc;
        return typeof rocAuc === 'number' ? rocAuc : -1;
    } catch {
        return -1;
    }
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

        // Transakcja gwarantuje atomowość: dezaktywacja starych + utworzenie nowego
        // — zapobiega race condition z dwoma aktywnymi modelami jednocześnie.
        await prisma.$transaction(async (tx) => {
            if (shouldActivate) {
                const existing = await tx.aiModel.findFirst({ where: { active: true } });
                if (existing) {
                    await tx.aiModel.update({
                        where: { id: existing.id },
                        data: { active: false }
                    });
                    logger.info(
                        'ModelRegistry',
                        `Dezaktywowano poprzedni model ${existing.version}`
                    );
                }
            }

            await tx.aiModel.create({
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
        });

        // Retencja: po zapisie nowego modelu przycinamy stary rejestr (metoda nigdy nie rzuca)
        await this.pruneOldModels();

        // Aktywny model się zmienił → predykcje w cache są nieaktualne.
        if (shouldActivate) clearPredictionCache();

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
            const auc = getRocAuc(r.metrics);
            if (auc > best) best = auc;
        }
        return best;
    }

    async listModels(limit = 20): Promise<ModelListItem[]> {
        const records = await prisma.aiModel.findMany({
            orderBy: { createdAt: 'desc' },
            take: limit
        });
        return records.map((r) => {
            let metrics: ModelMetrics | null = null;
            try {
                metrics = JSON.parse(r.metrics) as ModelMetrics;
            } catch {
                // pomijamy uszkodzone metryki
            }
            let features: string[] = [];
            try {
                features = JSON.parse(r.features) as string[];
            } catch {
                // pomijamy uszkodzoną listę cech
            }
            return {
                id: r.id,
                version: r.version,
                active: r.active,
                createdAt: r.createdAt,
                featureVersion: r.featureVersion,
                metrics,
                features,
                trainingRows: r.trainingRows
            };
        });
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
            clearPredictionCache();
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
        clearPredictionCache();
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
            const auc = getRocAuc(r.metrics);
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
        clearPredictionCache();
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

    /**
     * Przycina rejestr modeli ML do polityki retencji z ML_CONFIG:
     * - wszystkie modele aktywne (active: true) — nigdy nie usuwane,
     * - top-keepBest najlepszych wg rocAUC bieżącej wersji cech,
     * - ostatnie keepLast wg createdAt bieżącej wersji cech (zapas dla rollbacku).
     * Metoda NIGDY nie rzuca — błąd jest logowany i zwracany jest {0, []}.
     */
    async pruneOldModels(): Promise<{ deletedCount: number; deletedVersions: string[] }> {
        try {
            return await prisma.$transaction(async (tx) => {
                // Select bez ciężkich pól (weights, bias, features, featureMins, featureMaxs)
                const records = await tx.aiModel.findMany({
                    select: {
                        id: true,
                        version: true,
                        active: true,
                        metrics: true,
                        featureVersion: true,
                        createdAt: true
                    }
                });

                const keep = new Set<string>();

                // 1. Wszystkie aktywne modele — pas bezpieczeństwa przed usunięciem aktywnego modelu
                for (const r of records) {
                    if (r.active) keep.add(r.id);
                }

                // Polityka retencji dotyczy wyłącznie bieżącej wersji cech — stare wersje
                // (inna liczba cech) nie nadają się ani do rollbacku, ani do promote.
                const current = records.filter(
                    (r) => r.featureVersion === ML_CONSTANTS.FEATURE_VERSION
                );

                // 2. Najlepsze wg rocAUC (sort na kopii — nie mutujemy tablicy Prisma)
                const byAuc = [...current].sort(
                    (a, b) => getRocAuc(b.metrics) - getRocAuc(a.metrics)
                );
                for (const r of byAuc.slice(0, ML_CONFIG.retention.keepBest)) keep.add(r.id);

                // 3. Najnowsze wg createdAt (zapas dla rollbackToPrevious)
                const byDate = [...current].sort((a, b) =>
                    a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0
                );
                for (const r of byDate.slice(0, ML_CONFIG.retention.keepLast)) keep.add(r.id);

                const candidates = records.filter((r) => !keep.has(r.id));
                const deletedVersions: string[] = [];
                let deletedCount = 0;

                // Usuwanie partiami po 500 — guard active:false to pas bezpieczeństwa
                // (kandydaci z definicji nie są aktywni, ale deleteMany nie dotknie aktywnego)
                for (let i = 0; i < candidates.length; i += 500) {
                    const chunk = candidates.slice(i, i + 500);
                    const result = await tx.aiModel.deleteMany({
                        where: { id: { in: chunk.map((c) => c.id) }, active: false }
                    });
                    deletedCount += result.count;
                    deletedVersions.push(...chunk.map((c) => c.version));
                }

                if (deletedCount > 0) {
                    logger.info(
                        'ModelRegistry',
                        `Przycięto rejestr modeli: usunięto ${deletedCount} (${deletedVersions.join(', ')})`
                    );
                }
                return { deletedCount, deletedVersions };
            });
        } catch (e) {
            logger.error(
                'ModelRegistry',
                'Błąd przycinania rejestru modeli:',
                e instanceof Error ? e.message : e
            );
            return { deletedCount: 0, deletedVersions: [] };
        }
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
        const parseJsonArray = <T>(val: string | null | undefined): T[] => {
            if (!val) return [];
            try {
                const parsed = JSON.parse(val);
                return Array.isArray(parsed) ? (parsed as T[]) : [];
            } catch {
                return [];
            }
        };
        const parseJsonObject = <T>(val: string | null | undefined): T | null => {
            if (!val) return null;
            try {
                return JSON.parse(val) as T;
            } catch {
                return null;
            }
        };
        return {
            id: record.id,
            version: record.version,
            weights: parseJsonArray<number>(record.weights),
            bias: record.bias,
            metrics: (parseJsonObject<ModelMetrics>(record.metrics) || {
                accuracy: 0,
                precision: 0,
                recall: 0,
                f1: 0,
                rocAuc: 0,
                trainSize: 0,
                valSize: 0
            }) as ModelMetrics,
            features: parseJsonArray<string>(record.features),
            featureMins: parseJsonArray<number>(record.featureMins),
            featureMaxs: parseJsonArray<number>(record.featureMaxs),
            trainingRows: record.trainingRows,
            active: record.active,
            createdAt: record.createdAt,
            featureVersion: record.featureVersion
        };
    }
}

export const modelRegistry = new ModelRegistry();
