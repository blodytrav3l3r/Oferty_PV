import { afterEach, describe, expect, it } from '@jest/globals';
import crypto from 'node:crypto';
import prisma from '../../src/prismaClient';
import { FEATURE_NAMES, ML_CONSTANTS } from '../../src/config/mlConstants';
import { AcceptanceModel } from '../../src/services/ml/AcceptanceModel';
import { ModelRegistry } from '../../src/services/ml/ModelRegistry';

let runIdForCleanup: string | null = null;
let modelIdsForCleanup: string[] = [];

afterEach(async () => {
    if (runIdForCleanup) {
        await prisma.aiTrainingRun.deleteMany({ where: { id: runIdForCleanup } });
        runIdForCleanup = null;
    }
    if (modelIdsForCleanup.length > 0) {
        await prisma.aiModel.deleteMany({ where: { id: { in: modelIdsForCleanup } } });
        modelIdsForCleanup = [];
    }
});

describe('ModelRegistry training result transaction PostgreSQL', () => {
    it('zapisuje model i terminalny run razem, a błąd runu cofa zmianę aktywnego modelu', async () => {
        const registry = new ModelRegistry();
        const runId = crypto.randomUUID();
        runIdForCleanup = runId;
        await prisma.aiTrainingRun.create({
            data: {
                id: runId,
                startedAt: new Date().toISOString(),
                status: 'RUNNING',
                datasetSize: 0,
                trainSize: 0,
                validationSize: 0,
                testSize: 0,
                featureVersion: ML_CONSTANTS.FEATURE_VERSION,
                seed: 42,
                deployed: false
            }
        });

        const model = new AcceptanceModel(FEATURE_NAMES.length);
        const metrics = {
            accuracy: 0.8,
            precision: 0.8,
            recall: 0.8,
            f1: 0.8,
            rocAuc: 0.8,
            trainSize: 10,
            valSize: 2
        };
        const lineageSnapshot = JSON.stringify({ lineageSchemaVersion: 2, modelVersion: null });
        const version = await registry.saveModel(
            model,
            metrics,
            FEATURE_NAMES,
            FEATURE_NAMES.map(() => 0),
            FEATURE_NAMES.map(() => 1),
            true,
            undefined,
            'PRODUCTION',
            null,
            undefined,
            {
                id: runId,
                data: {
                    status: 'SUCCESS',
                    finishedAt: new Date().toISOString(),
                    datasetSize: 12,
                    trainSize: 10,
                    validationSize: 2,
                    testSize: 0,
                    deployed: true,
                    error: null
                }
            },
            null,
            lineageSnapshot
        );
        const modelRecord = await prisma.aiModel.findUnique({ where: { version } });
        modelIdsForCleanup = [modelRecord!.id];
        await expect(
            prisma.aiTrainingRun.findUnique({ where: { id: runId } })
        ).resolves.toMatchObject({
            status: 'SUCCESS',
            candidateModelVersion: version,
            deployed: true
        });
        expect(JSON.parse(modelRecord!.lineageSnapshot!)).toMatchObject({ modelVersion: version });
        const persistedRun = await prisma.aiTrainingRun.findUnique({ where: { id: runId } });
        expect(JSON.parse(persistedRun!.lineageSnapshot!)).toMatchObject({ modelVersion: version });

        const countBefore = await prisma.aiModel.count();
        await expect(
            registry.saveModel(
                model,
                metrics,
                FEATURE_NAMES,
                FEATURE_NAMES.map(() => 0),
                FEATURE_NAMES.map(() => 1),
                true,
                undefined,
                'PRODUCTION',
                null,
                undefined,
                undefined,
                null
            )
        ).rejects.toThrow('production_model_changed_during_training');
        expect(await prisma.aiModel.count()).toBe(countBefore);

        await expect(
            registry.saveModel(
                model,
                metrics,
                FEATURE_NAMES,
                FEATURE_NAMES.map(() => 0),
                FEATURE_NAMES.map(() => 1),
                true,
                undefined,
                'PRODUCTION',
                null,
                undefined,
                {
                    id: crypto.randomUUID(),
                    data: {
                        status: 'SUCCESS',
                        finishedAt: new Date().toISOString(),
                        deployed: true
                    }
                },
                version
            )
        ).rejects.toThrow();
        expect(await prisma.aiModel.count()).toBe(countBefore);
        await expect(prisma.aiModel.findUnique({ where: { version } })).resolves.toMatchObject({
            active: true,
            state: 'PRODUCTION'
        });
    });

    it('serializuje równoległą promocję i pozostawia dokładnie jeden aktywny model', async () => {
        const registry = new ModelRegistry();
        const ids = [crypto.randomUUID(), crypto.randomUUID()];
        modelIdsForCleanup = ids;
        const makeCandidate = (id: string, version: string) => ({
            id,
            version,
            weights: JSON.stringify(FEATURE_NAMES.map(() => 0)),
            bias: 0,
            metrics: JSON.stringify({ rocAuc: 0.8 }),
            features: JSON.stringify(FEATURE_NAMES),
            featureMins: JSON.stringify(FEATURE_NAMES.map(() => 0)),
            featureMaxs: JSON.stringify(FEATURE_NAMES.map(() => 1)),
            trainingRows: 10,
            featureVersion: ML_CONSTANTS.FEATURE_VERSION,
            state: 'APPROVED',
            active: false,
            createdAt: new Date().toISOString()
        });
        await prisma.aiModel.create({ data: makeCandidate(ids[0], `candidate-${ids[0]}`) });
        await prisma.aiModel.create({ data: makeCandidate(ids[1], `candidate-${ids[1]}`) });

        await Promise.all(ids.map((id) => registry.promoteModel(id)));

        await expect(prisma.aiModel.count({ where: { active: true } })).resolves.toBe(1);
        const records = await prisma.aiModel.findMany({ where: { id: { in: ids } } });
        expect(records.filter((record) => record.active)).toHaveLength(1);
        expect(records.filter((record) => record.state === 'PRODUCTION')).toHaveLength(1);
    });

    it('serializuje rollback równoległy z promocją kandydata', async () => {
        const registry = new ModelRegistry();
        const ids = [crypto.randomUUID(), crypto.randomUUID()];
        modelIdsForCleanup = ids;
        const sharedModelData = {
            weights: JSON.stringify(FEATURE_NAMES.map(() => 0)),
            bias: 0,
            metrics: JSON.stringify({ rocAuc: 0.8 }),
            features: JSON.stringify(FEATURE_NAMES),
            featureMins: JSON.stringify(FEATURE_NAMES.map(() => 0)),
            featureMaxs: JSON.stringify(FEATURE_NAMES.map(() => 1)),
            trainingRows: 10,
            featureVersion: ML_CONSTANTS.FEATURE_VERSION,
            createdAt: new Date().toISOString()
        };
        await prisma.aiModel.create({
            data: {
                ...sharedModelData,
                id: ids[0],
                version: `production-${ids[0]}`,
                state: 'PRODUCTION',
                active: true
            }
        });
        await prisma.aiModel.create({
            data: {
                ...sharedModelData,
                id: ids[1],
                version: `candidate-${ids[1]}`,
                state: 'APPROVED',
                active: false
            }
        });

        await Promise.all([registry.promoteModel(ids[1]), registry.rollbackToPrevious()]);

        await expect(prisma.aiModel.count({ where: { active: true } })).resolves.toBe(1);
        await expect(prisma.aiModel.count({ where: { state: 'PRODUCTION' } })).resolves.toBe(1);
    });
});
