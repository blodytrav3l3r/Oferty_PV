import { User } from '../helpers';

/**
 * Sprawdza czy user może odczytać dokument (owner / pro parent / admin).
 * Zwraca true jeśli ma dostęp, false w przeciwnym razie.
 */
export function canReadDoc(user: User | undefined, docUserId: string | null | undefined): boolean {
    if (!user || !docUserId) return false;
    if (user.role === 'admin') return true;
    if (docUserId === user.id) return true;
    if (user.role === 'pro' && (user.subUsers || []).includes(docUserId)) return true;
    return false;
}

/**
 * Sprawdza czy user może zapisać dokument (tworzyć / aktualizować).
 * Reguły:
 *  - admin: zawsze
 *  - owner (docUserId === user.id): tak
 *  - pro parent (docUserId in subUsers): tak
 *  - user impersonation via body (docUserId !== user.id i nie pro-parent): NIE
 */
export function canWriteDoc(user: User | undefined, docUserId: string | null | undefined): boolean {
    if (!user) return false;
    if (user.role === 'admin') return true;
    if (!docUserId) return true;
    if (docUserId === user.id) return true;
    if (user.role === 'pro' && (user.subUsers || []).includes(docUserId)) return true;
    return false;
}

/**
 * Wyciąga userId z dokumentu (z różnych miejsc) i weryfikuje prawo zapisu.
 * Dla nowych dokumentów (tworzonych) zwraca właściwy userId do zapisu:
 *  - admin może tworzyć dla dowolnego userId (np. dla sub-usera)
 *  - zwykły user zawsze user.id
 *  - pro może tworzyć dla siebie lub swoich subUsers
 *
 * Zwraca: { allowed: boolean, effectiveUserId: string }
 */
export function resolveWriteUserId(
    user: User | undefined,
    requestedUserId: string | null | undefined
): { allowed: boolean; effectiveUserId: string } {
    if (!user) return { allowed: false, effectiveUserId: '' };
    if (user.role === 'admin') {
        return { allowed: true, effectiveUserId: requestedUserId || user.id };
    }
    const target = requestedUserId || user.id;
    if (canWriteDoc(user, target)) {
        return { allowed: true, effectiveUserId: target };
    }
    return { allowed: false, effectiveUserId: '' };
}
