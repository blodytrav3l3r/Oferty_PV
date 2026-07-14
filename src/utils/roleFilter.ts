import { User } from '../helpers';
import { isValidId } from '../helpers';
import { Prisma } from '../../generated/prisma';

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

/**
 * Buduje fragment klauzuli WHERE dla raw SQL queries (z prefiksem "WHERE"
 * lub pusty string) respektujący rolę użytkownika.
 *
 * Używane w miejscach, gdzie potrzebna jest konwersja dat w tym samym
 * query (timestamp ms → ISO datetime), czego Prisma Client nie wspiera
 * natywnie dla SQLite.
 *
 * Bezpieczeństwo: każde ID jest walidowane isValidId() i escapowane
 * przez podwójny apostrof (SQL standard).
 */
export function buildRoleWhereSql(user: Pick<User, 'role' | 'id' | 'subUsers'>): string {
    if (user.role === 'admin') return '';
    if (user.role === 'pro') {
        const allowedIds = [user.id, ...(user.subUsers || [])]
            .filter(isValidId)
            .map((id) => `'${id.replace(/'/g, "''")}'`)
            .join(',');
        return `WHERE "userId" IN (${allowedIds})`;
    }
    const safeId = isValidId(user.id) ? user.id.replace(/'/g, "''") : '__invalid__';
    return `WHERE "userId" = '${safeId}'`;
}

/**
 * Bezpieczna (parametryzowana) wersja buildRoleWhereSql — zwraca Prisma.Sql
 * do użycia z prisma.$queryRaw (tagged template) zamiast $queryRawUnsafe.
 * Wartości są przekazywane jako parametry, co eliminuje ryzyko SQL Injection.
 */
export function buildRoleWhereCondition(user: Pick<User, 'role' | 'id' | 'subUsers'>): Prisma.Sql {
    if (user.role === 'admin') return Prisma.empty;
    if (user.role === 'pro') {
        const allowedIds = [user.id, ...(user.subUsers || [])].filter(isValidId);
        if (allowedIds.length === 0) return Prisma.sql`WHERE 1=0`;
        return Prisma.sql`WHERE "userId" IN (${Prisma.join(allowedIds)})`;
    }
    return Prisma.sql`WHERE "userId" = ${user.id}`;
}
