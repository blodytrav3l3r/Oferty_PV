import prisma from '../../prismaClient';

export const TRAINING_USERS_KEY = 'ai_training_user_ids';

/**
 * Allowlista użytkowników zasilających ML/KB.
 * - `null` (brak klucza lub uszkodzona wartość) = wszyscy (backward compat).
 * - `[]` (jawnie zapisana pusta lista) = nikt, model nie uczy się.
 */
export async function getTrainingUserIds(): Promise<string[] | null> {
    // Fail-open: błąd odczytu (DB niedostępna, brak tabeli w starym moku)
    // = brak konfiguracji = stare zachowanie (wszyscy). Telemetria/ML
    // nigdy nie mogą paść przez sam odczyt flagi.
    try {
        const row = await prisma.settings.findUnique({ where: { key: TRAINING_USERS_KEY } });
        if (!row?.value) return null;
        const parsed: unknown = JSON.parse(row.value);
        if (!Array.isArray(parsed)) return null;
        return parsed.filter((x): x is string => typeof x === 'string' && x.length > 0);
    } catch {
        return null;
    }
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
    allow: string[] | null
): boolean {
    if (allow === null) return true;
    if (!userId) return false;
    return allow.includes(userId);
}

/**
 * Filtruje wiersze AiFeature (bez kolumny userId, tylko telemetryId) do
 * podzbioru pochodzącego od dozwolonych użytkowników. Jeden join per batch,
 * bez arbitralnego limitu na lookup (ids z batcha kandydującego).
 */
export async function filterFeaturesByTrainingUsers<T extends { telemetryId?: string | null }>(
    features: T[]
): Promise<T[]> {
    const allow = await getTrainingUserIds();
    if (allow === null) return features;
    const ids = [...new Set(features.map((f) => f.telemetryId).filter((id): id is string => !!id))];
    if (ids.length === 0) return [];
    const owners = await prisma.ai_telemetry_logs.findMany({
        where: { id: { in: ids } },
        select: { id: true, userId: true }
    });
    const allowedIds = new Set(
        owners.filter((o) => isTelemetryAllowed(o.userId, allow)).map((o) => o.id)
    );
    return features.filter((f) => f.telemetryId && allowedIds.has(f.telemetryId));
}
