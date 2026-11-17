/**
 * Zakres numerów zleceń produkcyjnych przypisany do użytkownika (opiekuna).
 *
 * Zakres jest stały co roku — numer prefiksuje litera roku z ustawień Pulpitu.
 * Zakresy różnych użytkowników nie mogą się nakładać: inaczej dwie osoby
 * wygenerowałyby ten sam numer w tym samym roku.
 */
import prisma from '../prismaClient';

export interface ProductionRangeInput {
    from?: number | null;
    to?: number | null;
}

/** Użytkownicy, których zakres nachodzi na podany przedział (poza `userId`). */
export async function findProductionRangeConflicts(
    userId: string,
    from: number,
    to: number
): Promise<string[]> {
    const conflicts = await prisma.users.findMany({
        where: {
            id: { not: userId },
            productionRangeFrom: { not: null, lte: to },
            productionRangeTo: { not: null, gte: from }
        },
        select: { username: true }
    });
    return conflicts.map((user) => user.username);
}

/** Spójny komunikat 400 dla nakładających się zakresów. */
export function rangeOverlapResponse(usernames: string[]) {
    return {
        error: `Zakres numerów nachodzi na użytkownika: ${usernames.join(', ')}`,
        code: 'RANGE_OVERLAP'
    };
}
