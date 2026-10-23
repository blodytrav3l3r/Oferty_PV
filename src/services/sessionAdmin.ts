/**
 * Administracyjne zarządzanie sesjami — logika DB poza routes (ADR-004).
 * Reguła wygaśnięcia i kasowanie sesji żyją w middleware/auth (SSoT sesji).
 */
import prisma from '../prismaClient';
import { revokeUserSessions } from '../middleware/auth';
import { logAudit } from './auditService';

export interface RevokeSessionsResult {
    revoked: number;
    targetUsername: string;
}

/**
 * Wylogowuje wszystkie sesje wskazanego użytkownika.
 * `null` = konto nie istnieje (route → 404). Błąd DB propaguje się (route → 500),
 * bo „nie udało się skasować" NIE jest tym samym co „0 sesji".
 * Audyt po revoke (I-012: jego błąd nie cofa operacji).
 */
export async function revokeSessionsForAdmin(
    targetUserId: string,
    actorId: string
): Promise<RevokeSessionsResult | null> {
    const target = await prisma.users.findUnique({
        where: { id: targetUserId },
        select: { username: true }
    });
    if (!target) return null;
    const revoked = await revokeUserSessions(targetUserId);
    await logAudit('session', targetUserId, actorId, 'delete', {
        reason: 'admin_revoke',
        revoked,
        targetUsername: target.username
    });
    return { revoked, targetUsername: target.username };
}
