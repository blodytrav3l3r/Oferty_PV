// Removed Prisma import
import { User } from '../helpers';

/**
 * Zwraca część klauzuli 'where' dla Prisma Client
 * w oparciu o poziom uprawnień podanego użytkownika.
 * - 'admin' widzi wszystkie dane
 * - 'pro' widzi dane swoje i swoich 'subUsers'
 * - domyślnie ('user') widzi wyłącznie własne wpisy
 */
export function buildRoleWhereClause(user: User) {
    // Note: while specifically typed above to avoid "any", most Prisma where inputs 
    // are structurally compatible here for the unified userId check.
    if (user.role === 'admin') {
        return undefined; // No filter = all records
    }
    
    if (user.role === 'pro') {
        const allowedIds = [user.id, ...(user.subUsers || [])];
        return { userId: { in: allowedIds } };
    }
    
    return { userId: user.id };
}
