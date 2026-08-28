import { User } from '../helpers';
import { isValidId } from '../helpers';
import { Prisma } from '../../generated/prisma';
import { getSharedIdsForUser } from './ownership';

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
 * Bezpieczna (parametryzowana) wersja buildRoleWhereSql — zwraca Prisma.Sql
 * do użycia z prisma.$queryRaw (tagged template) zamiast $queryRawUnsafe.
 * Wartości są przekazywane jako parametry, co eliminuje ryzyko SQL Injection.
 */
export function buildRoleWhereCondition(
    user: Pick<User, 'role' | 'id' | 'subUsers'>,
    table?: string
): Prisma.Sql {
    if (user.role === 'admin') return Prisma.empty;
    // ponytail: kwalifikuj kolumnę gdy JOIN wprowadza drugie "userId" (production_orders_rel + orders_studnie_rel) — inaczej SQLite: ambiguous column name
    const col = table ? Prisma.raw(`"${table}"."userId"`) : Prisma.raw('"userId"');
    if (user.role === 'pro') {
        const allowedIds = [user.id, ...(user.subUsers || [])].filter(isValidId);
        if (allowedIds.length === 0) return Prisma.sql`WHERE 1=0`;
        return Prisma.sql`WHERE ${col} IN (${Prisma.join(allowedIds)})`;
    }
    return Prisma.sql`WHERE ${col} = ${user.id}`;
}

export async function buildRoleWhereClauseWithShares(
    user: User,
    documentType: ShareDocType
): Promise<Record<string, unknown> | undefined> {
    if (user.role === 'admin') return undefined;
    const base = buildRoleWhereClause(user) as Record<string, unknown> | undefined;
    const sharedIds = await getSharedIdsForUser(user.id, documentType);
    if (sharedIds.length === 0) return base;
    if (!base) return { id: { in: sharedIds } } as unknown as Record<string, unknown>;
    return { OR: [base, { id: { in: sharedIds } }] } as unknown as Record<string, unknown>;
}

export function buildRoleWhereConditionWithShares(
    user: Pick<User, 'role' | 'id' | 'subUsers'>,
    documentType: string,
    table?: string
): Prisma.Sql {
    if (user.role === 'admin') return Prisma.empty;
    const tbl = table ? `"${table}"` : '';
    const idCol = tbl ? `${tbl}."id"` : '"id"';
    const userIdCol = tbl ? `${tbl}."userId"` : '"userId"';
    const shareCond = Prisma.sql`EXISTS (SELECT 1 FROM "document_shares" WHERE "sharedWithUserId" = ${user.id} AND "documentType" = ${documentType} AND "documentId" = ${Prisma.raw(idCol)})`;
    if (user.role === 'pro') {
        const allowedIds = [user.id, ...(user.subUsers || [])].filter(isValidId);
        if (allowedIds.length === 0) return Prisma.sql`WHERE ${shareCond}`;
        return Prisma.sql`WHERE (${Prisma.raw(userIdCol)} IN (${Prisma.join(allowedIds)}) OR ${shareCond})`;
    }
    return Prisma.sql`WHERE (${Prisma.raw(userIdCol)} = ${user.id} OR ${shareCond})`;
}

type ShareDocType = 'offer' | 'offer_studnie' | 'order_rury' | 'order_studnie';
