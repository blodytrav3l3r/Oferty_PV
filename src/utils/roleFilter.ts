// Usunięto import Prisma
import { User } from '../helpers';

/**
 * Zwraca część klauzuli 'where' dla Prisma Client
 * w oparciu o poziom uprawnień podanego użytkownika.
 * - 'admin' widzi wszystkie dane
 * - 'pro' widzi dane swoje i swoich 'subUsers'
 * - domyślnie ('user') widzi wyłącznie własne wpisy
 */
export function buildRoleWhereClause(user: User) {
    // Uwaga: mimo sprecyzowanego typowania powyżej, większość wejść 'where' w Prisma
    // jest strukturalnie kompatybilna dla zunifikowanego sprawdzenia userId.
    if (user.role === 'admin') {
        return undefined; // Brak filtra = wszystkie rekordy
    }

    if (user.role === 'pro') {
        const allowedIds = [user.id, ...(user.subUsers || [])];
        return { userId: { in: allowedIds } };
    }

    return { userId: user.id };
}
