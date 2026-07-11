import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import prisma from '../prismaClient';
import { getUserObject, User } from '../helpers';
import { ensureAdminExists as startupEnsureAdmin } from '../startup/adminCheck';

export const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 dni

export const COOKIE_OPTIONS = {
    httpOnly: true,
    maxAge: SESSION_MAX_AGE_MS,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    path: '/'
};

export interface Session {
    token: string;
    userId: string;
    createdAt: bigint;
    lastUsedAt: bigint | null;
    expiresAt: bigint | null;
    revokedAt: bigint | null;
}

declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace Express {
        interface Request {
            user?: User;
        }
    }
}

export interface AuthenticatedRequest extends Request {
    user?: User;
}

/**
 * Tworzy nową sesję dla użytkownika z metadanymi requestu.
 */
export async function createSession(userId: string, req?: Request): Promise<string> {
    const token = crypto.randomBytes(32).toString('hex');
    const now = Date.now();

    await prisma.sessions.create({
        data: {
            token,
            userId,
            createdAt: now,
            lastUsedAt: now,
            expiresAt: now + SESSION_MAX_AGE_MS,
            ipAddress: req?.ip || null,
            userAgent: req?.headers['user-agent'] || null
        }
    });

    return token;
}

/**
 * Rotuje sesję — tworzy nowy token, oznacza stary jako revoked.
 * Używane przy zdarzeniach wysokiego ryzyka: login, zmiana hasła.
 */
export async function rotateSession(
    oldToken: string,
    userId: string,
    req?: Request
): Promise<string> {
    const newToken = crypto.randomBytes(32).toString('hex');
    const now = Date.now();

    // Oznacz starą sesję jako revoked (soft delete — zachowuje audyt)
    await prisma.sessions
        .update({
            where: { token: oldToken },
            data: { revokedAt: now }
        })
        .catch(() => {});

    // Utwórz nową sesję
    await prisma.sessions.create({
        data: {
            token: newToken,
            userId,
            createdAt: now,
            lastUsedAt: now,
            expiresAt: now + SESSION_MAX_AGE_MS,
            ipAddress: req?.ip || null,
            userAgent: req?.headers['user-agent'] || null
        }
    });

    return newToken;
}

/**
 * Pobiera sesję po tokenie.
 * Odrzuca: nieistniejące, wygasłe, revoked.
 */
export async function getSession(token: string | undefined): Promise<Session | null> {
    if (!token) return null;

    try {
        const session = await prisma.sessions.findUnique({ where: { token } });
        if (!session) return null;

        // Sprawdź czy sesja nie jest unieważniona
        if (session.revokedAt !== null) return null;

        // Sprawdź czy nie wygasła (expiresAt lub createdAt + maxAge)
        const expiresAt =
            session.expiresAt !== null
                ? Number(session.expiresAt)
                : Number(session.createdAt) + SESSION_MAX_AGE_MS;

        if (expiresAt < Date.now()) {
            return null;
        }

        return session as unknown as Session;
    } catch {
        return null;
    }
}

/**
 * Unieważnia sesję (soft delete — revoke, nie hard delete).
 * Zachowuje rekord do audytu.
 */
export async function deleteSession(token: string): Promise<void> {
    try {
        await prisma.sessions.update({
            where: { token },
            data: { revokedAt: Date.now() }
        });
    } catch {
        // Ignoruj jeśli sesja nie istnieje
    }
}

/**
 * Lekki touch — aktualizuje tylko lastUsedAt (bez rotacji).
 */
async function touchSession(token: string): Promise<void> {
    await prisma.sessions
        .update({ where: { token }, data: { lastUsedAt: Date.now() } })
        .catch(() => {});
}

/**
 * Middleware: wymaga autoryzacji (ważna sesja).
 * Token odczytywany WYŁĄCZNIE z httpOnly cookie.
 * X-Auth-Token header jest jawnie ignorowany (zabezpieczenie przed pozostałościami).
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
    const token = req.cookies?.authToken;

    // X-Auth-Token jest jawnie ignorowany — bezpieczeństwo
    if (!token) {
        res.clearCookie('authToken', { path: '/' });
        res.status(401).json({ error: 'Nieautoryzowany — zaloguj się' });
        return;
    }

    const session = await getSession(token);
    if (!session) {
        res.clearCookie('authToken', { path: '/' });
        res.status(401).json({ error: 'Nieautoryzowany — zaloguj się' });
        return;
    }

    try {
        const user = await prisma.users.findUnique({ where: { id: session.userId } });
        if (!user) {
            res.clearCookie('authToken', { path: '/' });
            res.status(401).json({ error: 'Użytkownik nie istnieje w bazie' });
            return;
        }

        req.user = getUserObject(user);

        // Aktualizuj lastUsedAt (fire-and-forget, nie blokuje odpowiedzi)
        touchSession(token).catch(() => {});

        next();
    } catch (_e) {
        res.status(500).json({ error: 'Błąd bazy danych' });
    }
}

/**
 * Middleware: wymaga roli admin (po requireAuth).
 */
export async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
    if (!req.user || req.user.role !== 'admin') {
        res.status(403).json({ error: 'Brak uprawnień — wymagany administrator' });
        return;
    }
    next();
}

/**
 * Zapewnia istnienie admina podczas pierwszego uruchomienia
 * Deleguje do dedykowanego modułu startup/adminCheck.ts
 */
export async function ensureAdminExists(): Promise<void> {
    await startupEnsureAdmin();
}
