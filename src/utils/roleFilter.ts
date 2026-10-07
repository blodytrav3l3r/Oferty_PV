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
    // P0.4: wewnętrzna tabela MUSI mieć alias (ds) — gołe "id" w podzapytaniu
    // SQLite wiązałoby z document_shares.id (PK), nie z ofertą z zewnątrz,
    // i EXISTS był zawsze false (odbiorca share nigdy nie widział dokumentu).
    const shareCond = Prisma.sql`EXISTS (SELECT 1 FROM "document_shares" ds WHERE ds."sharedWithUserId" = ${user.id} AND ds."documentType" = ${documentType} AND ds."documentId" = ${Prisma.raw(idCol)})`;
    if (user.role === 'pro') {
        const allowedIds = [user.id, ...(user.subUsers || [])].filter(isValidId);
        if (allowedIds.length === 0) return Prisma.sql`WHERE ${shareCond}`;
        return Prisma.sql`WHERE (${Prisma.raw(userIdCol)} IN (${Prisma.join(allowedIds)}) OR ${shareCond})`;
    }
    return Prisma.sql`WHERE (${Prisma.raw(userIdCol)} = ${user.id} OR ${shareCond})`;
}

type ShareDocType = 'offer' | 'offer_studnie' | 'order_rury' | 'order_studnie';

/**
 * Lista zamówień z dziedziczeniem odczytu po ofercie-rodzicu (P0.5):
 * zamówienie widoczne gdy własne LUB jawnie udostępnione LUB udostępniona
 * jego oferta (porównanie ds."documentId" z kolumną FK — bez JOINa, indeks
 * idx_shares_doctype_docid). FK NULL (legacy) → brak dopasowania, bez wycieku.
 * Zapis (PATCH/DELETE/locks) dziedziczenia NIE ma — tylko odczyt list.
 */
export function buildOrderListWhereWithOfferShare(
    user: Pick<User, 'role' | 'id' | 'subUsers'>,
    orderDocType: string,
    opts: { alias: string; fkCol: string; offerDocType: string }
): Prisma.Sql {
    if (user.role === 'admin') return Prisma.empty;
    const { alias, fkCol, offerDocType } = opts;
    const a = `"${alias}"`;
    const ownCond =
        user.role === 'pro'
            ? (() => {
                  const allowedIds = [user.id, ...(user.subUsers || [])].filter(isValidId);
                  if (allowedIds.length === 0) return null;
                  return Prisma.sql`${Prisma.raw(`${a}."userId"`)} IN (${Prisma.join(allowedIds)})`;
              })()
            : Prisma.sql`${Prisma.raw(`${a}."userId"`)} = ${user.id}`;
    const orderShareCond = Prisma.sql`EXISTS (SELECT 1 FROM "document_shares" ds WHERE ds."sharedWithUserId" = ${user.id} AND ds."documentType" = ${orderDocType} AND ds."documentId" = ${Prisma.raw(`${a}."id"`)})`;
    const offerShareCond = Prisma.sql`EXISTS (SELECT 1 FROM "document_shares" ds WHERE ds."sharedWithUserId" = ${user.id} AND ds."documentType" = ${offerDocType} AND ds."documentId" = ${Prisma.raw(`${a}.${fkCol}`)})`;
    if (ownCond === null) {
        return Prisma.sql`WHERE (${orderShareCond} OR ${offerShareCond})`;
    }
    return Prisma.sql`WHERE (${ownCond} OR ${orderShareCond} OR ${offerShareCond})`;
}
