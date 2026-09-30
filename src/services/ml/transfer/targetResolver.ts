import prisma from '../../../prismaClient';
import { logger } from '../../../utils/logger';
import { getVersion } from '../../../version';
import { FEATURE_NAMES, ML_CONSTANTS } from '../../../config/mlConstants';
import { SOKML_AI_SCHEMA_VERSION } from './transferConstants';
import type { CompatTarget } from './compatibility';

/**
 * P1.2 — SSoT celu kompatybilności (TOCTOU-safe).
 *
 * Dry-run i import MUSZĄ używać tego samego resolvera aktualnego targetu.
 * Wcześniej dry-run brał świeży baseline (resolveTargetDataset), a import
 * sztywne null — re-compat przy imporcie nie widział zmiany datasetu celu.
 */

/** Cel kompatybilności bieżącej instancji (solver/rules: brak baseline → null). */
export function buildImportTarget(datasetFingerprint: string | null): CompatTarget {
    return {
        sokVersion: getVersion().version,
        aiSchemaVersion: SOKML_AI_SCHEMA_VERSION,
        featureVersion: ML_CONSTANTS.FEATURE_VERSION,
        featureCount: ML_CONSTANTS.FEATURE_COUNT,
        featureNames: [...FEATURE_NAMES],
        solverVersion: null,
        rulesVersion: null,
        datasetFingerprint
    };
}

/** Aktualny baseline datasetu celu: fingerprint najnowszego runu treningowego. */
export async function resolveTargetDataset(): Promise<string | null> {
    return prisma.aiTrainingRun
        .findFirst({ orderBy: { startedAt: 'desc' } })
        .then((run) => run?.datasetFingerprint ?? null)
        .catch((e: unknown) => {
            logger.warn('TransferTarget', `Brak baseline datasetu: ${String(e)}`);
            return null;
        });
}

/** Pełny aktualny target — jedyne wejście checkCompatibility dla dry-run i importu. */
export async function resolveCurrentImportTarget(): Promise<CompatTarget> {
    return buildImportTarget(await resolveTargetDataset());
}
