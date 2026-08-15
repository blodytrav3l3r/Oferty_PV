import crypto from 'crypto';
import prisma from '../../prismaClient';
import { logger } from '../../utils/logger';
import type { AcceptanceModel } from './AcceptanceModel';
import { FEATURE_NAMES, ML_CONSTANTS } from '../../config/mlConstants';
import { ML_CONFIG } from './trainingConfig';
import { clearPredictionCache } from './predictionCache';
import type { ConfusionMatrix } from './metrics';
import { AiModelState, assertValidAiModelState, type AiModelStateValue } from './aiModelState';

export interface ModelMetrics {
    accuracy: number;
    precision: number;
    recall: number;
    f1: number;
    rocAuc: number;
    trainSize: number;
    valSize: number;
    testRocAuc?: number;
    // ETAP 4: metryki uzupełniające — null gdy matematycznie nieokreślone.
    // Opcjonalne dla backward-compat ze starymi zapisami (starsze modele nie mają ich w JSON).
    prAuc?: number | null;
    logLoss?: number | null;
    brierScore?: number | null;
    ece?: number | null;
    confusion?: ConfusionMatrix | null;
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
    state?: string | null;
    seed?: number | null;
    featureDistributions?: string | null;
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
    state?: string | null;
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
        notes?: string,
        state?: AiModelStateValue,
        featureDistributions?: string | null
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
                        data: { active: false, state: AiModelState.ROLLED_BACK }
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
                    state:
                        state || (shouldActivate ? AiModelState.APPROVED : AiModelState.CANDIDATE),
                    featureDistributions: featureDistributions ?? null,
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

    /**
     * Aktualny model produkcyjny (ETAP 5): aktywny model bieżącej wersji cech.
     * Legacy active=true bez state = PRODUCTION (resolveLegacyState). To punkt
     * odniesienia guardrailu deploy — porównanie z nim, nie z historycznym best.
     */
    async getProductionModel(): Promise<StoredModel | null> {
        return this.getActiveModel();
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
                trainingRows: r.trainingRows,
                state: r.state
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
            // Transakcja: dezaktywacja+aktywacja atomowo — bez niej dwa równoległe
            // rollbacki (SelfEvaluation flapping) mogły dać 2 aktywne modele.
            await prisma.$transaction(async (tx) => {
                await tx.aiModel.update({
                    where: { id: active.id },
                    data: { active: false, state: AiModelState.ROLLED_BACK }
                });
                await tx.aiModel.update({
                    where: { id: previous.id },
                    data: { active: true, state: AiModelState.PRODUCTION }
                });
            });
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

        // Transakcja jak w saveModel — dezaktywacja+aktywacja atomowo.
        await prisma.$transaction(async (tx) => {
            const active = await tx.aiModel.findFirst({ where: { active: true } });
            if (active) {
                await tx.aiModel.update({
                    where: { id: active.id },
                    data: { active: false, state: AiModelState.ROLLED_BACK }
                });
            }
            await tx.aiModel.update({
                where: { id: target.id },
                data: { active: true, state: AiModelState.PRODUCTION }
            });
        });
        logger.info('ModelRegistry', `Ręcznie wybrano model ${target.version}`);
        clearPredictionCache();
        return this.recordToModel(target);
    }

    /**
     * Promote (ETAP 7A): APPROVED → PRODUCTION z atomową wymianą. Globalny
     * invariant — nigdy więcej niż jeden PRODUCTION / jeden active:
     * BEGIN: stary PRODUCTION → ROLLED_BACK (active=false),
     *        kandydat → PRODUCTION (active=true), pozostałe active → false. COMMIT.
     * Jedyna droga dojścia do PRODUCTION dla modeli spoza auto-deploy.
     */
    async promoteModel(id: string): Promise<StoredModel | null> {
        const target = await prisma.aiModel.findUnique({ where: { id } });
        if (!target) return null;
        const state = assertValidAiModelState(target.state) || AiModelState.CANDIDATE;
        if (state === AiModelState.REJECTED) {
            throw new Error(
                'Model REJECTED nie może być promowany — najpierw ręczny approve (POST /ai/models/:id/approve)'
            );
        }
        if (state === AiModelState.PRODUCTION) {
            return this.recordToModel(target);
        }
        if (target.featureVersion !== ML_CONSTANTS.FEATURE_VERSION) {
            throw new Error(
                `Nie można promować modelu spoza bieżącej wersji cech (${target.featureVersion ?? 'stara'} != ${ML_CONSTANTS.FEATURE_VERSION})`
            );
        }

        await prisma.$transaction(async (tx) => {
            const active = await tx.aiModel.findFirst({ where: { active: true } });
            if (active) {
                await tx.aiModel.update({
                    where: { id: active.id },
                    data: { active: false, state: AiModelState.ROLLED_BACK }
                });
            }
            await tx.aiModel.update({
                where: { id: target.id },
                data: { active: true, state: AiModelState.PRODUCTION }
            });
            // Synchronizacja: żaden inny model nie może zostać aktywny
            // (invariant COUNT(active=true) <= 1).
            await tx.aiModel.updateMany({
                where: { active: true, id: { not: target.id } },
                data: { active: false }
            });
        });
        logger.info('ModelRegistry', `Promowano model ${target.version} do PRODUCTION`);
        clearPredictionCache();
        return this.recordToModel(target);
    }

    /**
     * Ręczny override (ETAP 7A): REJECTED → APPROVED — jawna operacja admina.
     * Ślad w AiModel.notes (admin action + timestamp); audit log robi route.
     */
    async approveModel(id: string, adminUser: string): Promise<StoredModel | null> {
        const target = await prisma.aiModel.findUnique({ where: { id } });
        if (!target) return null;
        if (target.state !== AiModelState.REJECTED) {
            throw new Error(
                `Override tylko dla modeli REJECTED (obecny stan: ${target.state ?? 'null'})`
            );
        }
        const note = `[approve by ${adminUser} @ ${new Date().toISOString()}] manual override REJECTED → APPROVED`;
        const notes = target.notes ? `${target.notes}\n${note}` : note;
        await prisma.aiModel.update({
            where: { id },
            data: { state: AiModelState.APPROVED, notes }
        });
        logger.info('ModelRegistry', `Ręczny approve modelu ${target.version} (${adminUser})`);
        return this.recordToModel({ ...target, state: AiModelState.APPROVED, notes });
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
            // N4: getRocAuc zwraca -1 dla braku metryk (model nie trenowany).
            // Takie modele NIE mogą być promowane — wcześniej starter (auc=-1)
            // mógł zostać "najlepszym" i zdegradować wytrenowany model.
            if (auc > bestAuc) {
                bestAuc = auc;
                best = r;
            }
        }
        if (bestAuc < 0) {
            logger.warn('ModelRegistry', 'Brak modelu z metrykami AUC>=0 — promocja pominięta');
            return null;
        }
        const active = await prisma.aiModel.findFirst({ where: { active: true } });
        if (active && active.id === best.id) {
            return this.recordToModel(active);
        }
        // Transakcja — atomowa zamiana aktywnego modelu na najlepszy.
        await prisma.$transaction(async (tx) => {
            if (active) {
                await tx.aiModel.update({
                    where: { id: active.id },
                    data: { active: false, state: AiModelState.ROLLED_BACK }
                });
            }
            await tx.aiModel.update({
                where: { id: best.id },
                data: { active: true, state: AiModelState.PRODUCTION }
            });
        });
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
     * Zapewnia istnienie aktywnego modelu ML (samoleczenie przy starcie serwera/diagnostyce).
     * Jeśli brak aktywnego modelu dla bieżącej wersji cech, promuje najlepszy istniejący lub
     * automatycznie tworzy domyślny model startowy v0.1.0-starter.
     */
    async ensureStarterModelExists(): Promise<StoredModel> {
        const active = await this.getActiveModel();
        if (active) return active;

        const countCurrentVersion = await prisma.aiModel.count({
            where: { featureVersion: ML_CONSTANTS.FEATURE_VERSION }
        });

        if (countCurrentVersion > 0) {
            const promoted = await this.promoteBestModel();
            if (promoted) return promoted;
        }

        const zeros = FEATURE_NAMES.map(() => 0);
        const ones = FEATURE_NAMES.map(() => 1);
        const starter = await prisma.aiModel.create({
            data: {
                // N3: UUID zamiast 'starter_' + Date.now() — dwa równoległe starty
                // serwera w tym samym ms dawały kolizję @id (P2002 → crash startu).
                id: crypto.randomUUID(),
                version: 'v0.1.0-starter',
                weights: JSON.stringify(zeros),
                bias: 0,
                metrics: JSON.stringify({
                    accuracy: 0.5,
                    precision: 0.5,
                    recall: 0.5,
                    f1: 0.5,
                    rocAuc: 0.5,
                    trainSize: 0,
                    valSize: 0
                }),
                features: JSON.stringify(FEATURE_NAMES),
                featureMins: JSON.stringify(zeros),
                featureMaxs: JSON.stringify(ones),
                trainingRows: 0,
                active: true,
                state: AiModelState.PRODUCTION,
                featureVersion: ML_CONSTANTS.FEATURE_VERSION,
                notes: 'Model startowy — domyślne wagi (neutralne). Inicjalizacja automatyczna.',
                createdAt: new Date().toISOString()
            }
        });
        logger.info(
            'ModelRegistry',
            `Utworzono i aktywowano domyślny model startowy ML (${starter.version})`
        );
        return this.recordToModel(starter);
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
            featureVersion: record.featureVersion,
            state: record.state,
            seed: record.seed,
            featureDistributions: record.featureDistributions
        };
    }
}

export const modelRegistry = new ModelRegistry();
