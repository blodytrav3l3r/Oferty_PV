import prisma from '../../prismaClient';
import { logger } from '../../utils/logger';

export const TRAINING_USERS_KEY = 'ai_training_user_ids';

export type TrainingUsersStatus = 'UNCONFIGURED' | 'CONFIGURED' | 'INVALID' | 'UNAVAILABLE';

export interface TrainingUsersConfig {
    status: TrainingUsersStatus;
    userIds: string[];
    legacyMigrated: boolean;
}

/**
 * Allowlista użytkowników zasilających ML/KB.
 * Brak konfiguracji, wartość błędna i błąd bazy nie dopuszczają treningu.
 */
export async function getTrainingUsersConfig(): Promise<TrainingUsersConfig> {
    let row: Awaited<ReturnType<typeof prisma.settings.findUnique>>;
    let migratedRow: Awaited<ReturnType<typeof prisma.settings.findUnique>>;
    try {
        [row, migratedRow] = await Promise.all([
            prisma.settings.findUnique({ where: { key: TRAINING_USERS_KEY } }),
            prisma.settings.findUnique({ where: { key: `${TRAINING_USERS_KEY}_migrated` } })
        ]);
    } catch {
        logger.warn('ML', 'Nie można odczytać allowlisty treningowej — trening zablokowany');
        return { status: 'UNAVAILABLE', userIds: [], legacyMigrated: false };
    }

    const legacyMigrated = migratedRow?.value === '1';
    if (!row) return { status: 'UNCONFIGURED', userIds: [], legacyMigrated: false };
    if (typeof row.value !== 'string') {
        return { status: 'INVALID', userIds: [], legacyMigrated: false };
    }
    let parsed: unknown;
    try {
        parsed = JSON.parse(row.value);
    } catch {
        return { status: 'INVALID', userIds: [], legacyMigrated: false };
    }
    if (
        !Array.isArray(parsed) ||
        parsed.some((id) => typeof id !== 'string' || id.trim().length === 0)
    ) {
        return { status: 'INVALID', userIds: [], legacyMigrated: false };
    }
    return { status: 'CONFIGURED', userIds: [...new Set(parsed)], legacyMigrated };
}

export async function getTrainingUserIds(): Promise<string[]> {
    return (await getTrainingUsersConfig()).userIds;
}

/**
 * Twardy invariant allowlisty (strict): przy ustawionej allowliście dozwolone
 * są wyłącznie rekordy przypisane do wybranych użytkowników. Rekordy bez
 * autora (userId null — stare/systemowe) są wtedy wykluczane: allowlista
 * znaczy "tylko ci użytkownicy", a nieznany autor to nie wybrany użytkownik.
 * Spójne z filtrem `userId in` w zapytaniach (null nigdy nie pasuje do `in`).
 */
export function isTelemetryAllowed(
    userId: string | null | undefined,
    allow: readonly string[]
): boolean {
    if (!userId) return false;
    return allow.includes(userId);
}

/**
 * Filtruje wiersze AiFeature (bez kolumny userId, tylko telemetryId) do
 * podzbioru pochodzącego od dozwolonych użytkowników. Jeden join per batch,
 * bez arbitralnego limitu na lookup (ids z batcha kandydującego).
 */
export async function filterFeaturesByTrainingUsers<T extends { telemetryId?: string | null }>(
    features: T[],
    allow?: readonly string[]
): Promise<T[]> {
    const allowlist = allow !== undefined ? allow : await getTrainingUserIds();
    if (allowlist.length === 0) return [];
    const ids = [...new Set(features.map((f) => f.telemetryId).filter((id): id is string => !!id))];
    if (ids.length === 0) return [];
    const owners = await prisma.ai_telemetry_logs.findMany({
        where: { id: { in: ids } },
        select: { id: true, userId: true }
    });
    const allowedIds = new Set(
        owners.filter((o) => isTelemetryAllowed(o.userId, allowlist)).map((o) => o.id)
    );
    return features.filter((f) => f.telemetryId && allowedIds.has(f.telemetryId));
}

/**
 * SSoT definicji „kwalifikujących się" danych treningowych (bramka F1):
 * AiFeature.createdAt > since + filtr allowlisty. Ten sam predykat dla
 * shouldTrain() i TrainingPipeline.run() — gate i pipeline nigdy się nie rozjadą.
 * Semantyka labeli bez zmian: NO_FEEDBACK odpada dopiero w loadAndNormalizeFeatures().
 */
export async function countEligibleNewFeatures(since: string | null): Promise<number> {
    const allow = await getTrainingUserIds();
    if (allow.length === 0) return 0;
    const where = since ? { createdAt: { gt: since } } : {};
    const rows = await prisma.aiFeature.findMany({ where, select: { telemetryId: true } });
    return (await filterFeaturesByTrainingUsers(rows, allow)).length;
}
