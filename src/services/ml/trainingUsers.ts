import prisma from '../../prismaClient';
import { Prisma, type AiFeature } from '../../../generated/prisma-postgres/client';
import { logger } from '../../utils/logger';

export const TRAINING_USERS_KEY = 'ai_training_user_ids';

export type TrainingUsersStatus = 'UNCONFIGURED' | 'CONFIGURED' | 'INVALID' | 'UNAVAILABLE';

export interface TrainingUsersConfig {
    status: TrainingUsersStatus;
    userIds: string[];
    legacyMigrated: boolean;
}

export function parseTrainingUserIds(value: unknown): string[] | null {
    if (typeof value !== 'string') return null;
    let parsed: unknown;
    try {
        parsed = JSON.parse(value);
    } catch {
        return null;
    }
    if (
        !Array.isArray(parsed) ||
        parsed.some((id) => typeof id !== 'string' || id.trim().length === 0)
    ) {
        return null;
    }
    return [...new Set(parsed)];
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
    const userIds = parseTrainingUserIds(row.value);
    if (!userIds) {
        return { status: 'INVALID', userIds: [], legacyMigrated: false };
    }
    try {
        const effectiveUserIds = await filterExistingTrainingUserIds(userIds);
        return { status: 'CONFIGURED', userIds: effectiveUserIds, legacyMigrated };
    } catch {
        logger.warn('ML', 'Nie można sprawdzić kont allowlisty — trening zablokowany');
        return { status: 'UNAVAILABLE', userIds: [], legacyMigrated: false };
    }
}

export async function getTrainingUserIds(): Promise<string[]> {
    const config = await getTrainingUsersConfig();
    return config.status === 'CONFIGURED' ? config.userIds : [];
}

type TrainingUserLookup = Pick<typeof prisma.users, 'findMany'>;

export async function filterExistingTrainingUserIds(
    userIds: readonly string[],
    users: TrainingUserLookup = prisma.users
): Promise<string[]> {
    if (userIds.length === 0) return [];
    const existingUsers = await users.findMany({
        where: { id: { in: [...userIds] } },
        select: { id: true }
    });
    const existingIds = new Set(existingUsers.map(({ id }) => id));
    return userIds.filter((userId) => existingIds.has(userId));
}

export async function lockTrainingUserScope(
    value: string | null | undefined,
    transaction: Pick<typeof prisma, '$queryRaw'>
): Promise<string[] | null> {
    const configuredIds = parseTrainingUserIds(value);
    if (!configuredIds) return null;
    if (configuredIds.length === 0) return [];
    const rows = await transaction.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        SELECT "id" FROM "users"
        WHERE "id" IN (${Prisma.join(configuredIds)})
        FOR KEY SHARE
    `);
    const existingIds = new Set(rows.map(({ id }) => id));
    return configuredIds.filter((userId) => existingIds.has(userId));
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

export function hasSameTrainingUsers(left: readonly string[], right: readonly string[]): boolean {
    const sortedLeft = [...left].sort();
    const sortedRight = [...right].sort();
    return (
        sortedLeft.length === sortedRight.length &&
        sortedLeft.every((userId, index) => userId === sortedRight[index])
    );
}

/**
 * Filtruje wiersze AiFeature do rekordów kwalifikujących się do przyszłego
 * treningu: istniejąca telemetria, owner z allowlisty i trainingEligible=true.
 * Jeden join per batch, bez arbitralnego limitu na lookup.
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
        select: { id: true, userId: true, trainingEligible: true }
    });
    const allowedIds = new Set(
        owners
            .filter((o) => o.trainingEligible === true && isTelemetryAllowed(o.userId, allowlist))
            .map((o) => o.id)
    );
    return features.filter((f) => f.telemetryId && allowedIds.has(f.telemetryId));
}

/**
 * Zwraca najnowsze oznaczone próbki z dokładnie tej samej allowlisty,
 * stosując kwalifikację właściciela w bazie przed limitem okna.
 */
export async function findEligibleLabeledFeatures(
    since: string,
    allow: readonly string[],
    limit: number
): Promise<AiFeature[]> {
    const userIds = [...new Set(allow)];
    if (userIds.length === 0 || !Number.isSafeInteger(limit) || limit < 1) return [];

    return prisma.$queryRaw<AiFeature[]>`
        SELECT feature.*
        FROM "AiFeature" AS feature
        INNER JOIN "ai_telemetry_logs" AS telemetry
            ON telemetry."id" = feature."telemetryId"
        WHERE feature."label" <> 'NO_FEEDBACK'
            AND feature."createdAt" > ${since}
            AND telemetry."trainingEligible" = TRUE
            AND telemetry."userId" IN (${Prisma.join(userIds)})
        ORDER BY feature."createdAt" DESC, feature."id" DESC
        LIMIT ${limit}
    `;
}

/**
 * SSoT definicji „kwalifikujących się" danych treningowych (bramka F1):
 * AiFeature.createdAt > since + owner allowlisty + trainingEligible. Ten sam predykat dla
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
