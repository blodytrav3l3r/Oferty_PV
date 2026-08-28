import { User } from '../helpers';
import prisma from '../prismaClient';

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
 *  - legacy rekord bez userId (docUserId null/undefined): NIE dla nie-admina
 *    (brak właściciela = brak prawa zapisu, spójnie z canReadDoc)
 */
export function canWriteDoc(user: User | undefined, docUserId: string | null | undefined): boolean {
    if (!user) return false;
    if (user.role === 'admin') return true;
    if (!docUserId) return false;
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

// --- Sharing helpers (Zasada 2: documentType + documentId) ---

export const SHARE_DOCUMENT_TYPES = [
    'offer',
    'offer_studnie',
    'order_rury',
    'order_studnie'
] as const;
export type ShareDocumentType = (typeof SHARE_DOCUMENT_TYPES)[number];

export function isValidShareDocumentType(v: string): v is ShareDocumentType {
    return (SHARE_DOCUMENT_TYPES as readonly string[]).includes(v);
}

export async function hasShare(
    userId: string,
    documentType: string,
    documentId: string
): Promise<boolean> {
    if (!userId || !documentType || !documentId) return false;
    try {
        const row = await (prisma as any).document_shares?.findFirst({
            where: { sharedWithUserId: userId, documentType, documentId },
            select: { id: true }
        });
        return !!row;
    } catch {
        return false;
    }
}

export async function getSharedIdsForUser(userId: string, documentType: string): Promise<string[]> {
    if (!userId || !documentType) return [];
    try {
        const rows = await (prisma as any).document_shares?.findMany({
            where: { sharedWithUserId: userId, documentType },
            select: { documentId: true }
        });
        if (!rows) return [];
        return rows.map((r: any) => r.documentId);
    } catch {
        return [];
    }
}

export async function canReadWithShare(
    user: User | undefined,
    docUserId: string | null | undefined,
    documentType: string,
    documentId: string
): Promise<boolean> {
    if (canReadDoc(user, docUserId)) return true;
    if (!user || !documentType || !documentId) return false;
    return hasShare(user.id, documentType, documentId);
}
