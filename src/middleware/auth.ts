import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
// bcryptjs celowo (pure-JS, zero node-gyp na Windows): koszt tylko na
// login/change-password, a LOGIN_LIMITER (10/min) ucina burst. Sesja cookie
// omija hash per request.
import bcrypt from 'bcryptjs';
import prisma from '../prismaClient';
import { getUserObject, User } from '../helpers';
import { logger } from '../utils/logger';

export const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 dni (absolute max)
// P1-idle: wylogowanie po 1h bezczynnosci; aktywnosc (kazdy autoryzowany request)
// przedluza sesje. Absolute max 7d od utworzenia zostaje.
export const SESSION_ABSOLUTE_MAX_MS = SESSION_MAX_AGE_MS;
export const SESSION_IDLE_TIMEOUT_MS = 60 * 60 * 1000; // 1h
// Throttle dotkniecia lastActivity — zapis max co 5 min, zeby nie dokladac
// write na kazdy request (SQLite, connection_limit=3).
export const SESSION_TOUCH_THROTTLE_MS = 5 * 60 * 1000;
export type SessionExpiredReason = 'idle' | 'absolute';

// P1-D: limit aktywnych sesji na użytkownika (rotacja najstarszych).
export const SESSION_MAX_PER_USER = 10;

// Fallback hasła admina z .env.example — instalatory (install.bat/install.sh) generują
// losowe hasło przy świeżej instalacji; ta wartość to wyłącznie tryb dev/awaryjny.
const DEFAULT_ADMIN_FALLBACK_PASSWORD = 'anim123456';
// Placeholder z .env.example — równie niebezpieczny w produkcji.
const DEFAULT_ADMIN_PLACEHOLDER_PASSWORD = 'CHANGE_ME_PLEASE';

export interface Session {
    token: string;
    userId: string;
    createdAt: bigint;
    lastActivity?: bigint;
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

// P1-auth-cache: gorąca ścieżka robiła 2Q per request (sesja + user) na
// 1 połączeniu SQLite. Cache usera per token hash z krótkim TTL 30 s —
// odświeżenie roli/uprawnień opóźnione max 30 s, akceptowalne dla 100 userów.
// Unieważniane w deleteSession/deleteUserSessions (wylogowanie/zmiana hasła).
const AUTH_CACHE_TTL_MS = 30_000;
interface AuthCacheEntry {
    user: User;
    userId: string;
    exp: number;
}
const authCache = new Map<string, AuthCacheEntry>();

function authCacheGet(tokenHash: string): User | null {
    const e = authCache.get(tokenHash);
    if (!e) return null;
    if (Date.now() > e.exp) {
        authCache.delete(tokenHash);
        return null;
    }
    return e.user;
}

function authCacheSet(tokenHash: string, user: User, userId: string): void {
    // Bound: sesji max 10/user, użytkowników setki — cap 2000 wpisów przed leakiem.
    if (authCache.size >= 2000) authCache.clear();
    authCache.set(tokenHash, { user, userId, exp: Date.now() + AUTH_CACHE_TTL_MS });
}

function authCacheInvalidateToken(tokenHash: string): void {
    authCache.delete(tokenHash);
}

export function authCacheInvalidateUser(userId: string, exceptTokenHash?: string): void {
    for (const [k, e] of authCache) {
        if (e.userId === userId && k !== exceptTokenHash) authCache.delete(k);
    }
}

/**
 * Haszuje token sesji (SHA-256). W bazie przechowywany jest wyłącznie hash —
 * surowy token nigdy nie jest zapisywany, co chroni sesje przed wyciekiem DB.
 */
export function hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Tworzy nową sesję dla użytkownika.
 * P1-D: powyżej SESSION_MAX_PER_USER kasuje najstarsze (rotacja).
 */
export async function createSession(userId: string): Promise<string> {
    const token = crypto.randomBytes(32).toString('hex');
    const now = Date.now();

    await prisma.sessions.create({
        data: {
            token: hashToken(token),
            userId,
            createdAt: now,
            lastActivity: now
        }
    });

    try {
        // Leniwa czystka sesji idle-wygaslych (bez crona).
        try {
            await prisma.sessions.deleteMany({
                where: { lastActivity: { lt: now - SESSION_IDLE_TIMEOUT_MS } }
            });
        } catch (_e) {
            // Kolumna lastActivity moze nie istniec na legacy DB bez migrate —
            // wtedy auto-heal w ensureDatabaseIndexes() ja dolozy.
        }
        const stale = await prisma.sessions.findMany({
            where: { userId },
            select: { token: true, createdAt: true },
            orderBy: { createdAt: 'asc' }
        });
        const excess = stale.length - SESSION_MAX_PER_USER;
        if (excess > 0) {
            const victims = stale.slice(0, excess).map((s) => s.token);
            await prisma.sessions.deleteMany({
                where: { token: { in: victims } }
            });
        }
    } catch (e) {
        logger.error('Auth', 'Błąd rotacji sesji', e);
    }

    return token;
}

export interface SessionStatus {
    session: Session | null;
    reason: SessionExpiredReason | null;
}

function lastActivityOf(session: { createdAt: bigint; lastActivity?: bigint | null }): number {
    const raw = session.lastActivity ?? session.createdAt;
    return Number(raw);
}

/**
 * Pobiera sesję po tokenie wraz z powodem wygaśnięcia.
 * - absolute: now - createdAt > SESSION_ABSOLUTE_MAX_MS (7d)
 * - idle: now - lastActivity > SESSION_IDLE_TIMEOUT_MS (1h)
 * Legacy wiersze bez lastActivity traktowane jak lastActivity = createdAt.
 */
export async function getSessionWithStatus(token: string | undefined): Promise<SessionStatus> {
    if (!token) return { session: null, reason: null };
    const tokenHash = hashToken(token);
    try {
        const session = await prisma.sessions.findUnique({
            where: { token: tokenHash }
        });
        if (!session) return { session: null, reason: null };
        const now = Date.now();
        if (Number(session.createdAt) + SESSION_ABSOLUTE_MAX_MS < now) {
            await deleteSession(token);
            return { session: null, reason: 'absolute' };
        }
        if (lastActivityOf(session) + SESSION_IDLE_TIMEOUT_MS < now) {
            await deleteSession(token);
            return { session: null, reason: 'idle' };
        }
        return { session: session as Session, reason: null };
    } catch (e) {
        logger.error('Auth', 'Błąd odczytu sesji', e);
        return { session: null, reason: null };
    }
}

/**
 * Pobiera sesję po tokenie.
 */
export async function getSession(token: string | undefined): Promise<Session | null> {
    const { session } = await getSessionWithStatus(token);
    return session;
}

/**
 * Odświeża lastActivity sesji (throttled — max co SESSION_TOUCH_THROTTLE_MS).
 * Wariant po hashu (bez dodatkowego odczytu — requireAuth ma już wiersz).
 * Fire-and-forget safe: błędy tylko logowane, nigdy nie psują requestu.
 */
export async function touchSessionByHash(
    tokenHash: string,
    lastActivity: bigint | number | null,
    createdAt: bigint | number
): Promise<void> {
    try {
        const last = Number(lastActivity ?? createdAt);
        const now = Date.now();
        if (last + SESSION_TOUCH_THROTTLE_MS > now) return;
        await prisma.sessions.update({
            where: { token: tokenHash },
            data: { lastActivity: now }
        });
    } catch (e) {
        logger.error('Auth', 'Błąd odświeżenia sesji', e);
    }
}

/**
 * Odświeża lastActivity sesji (throttled — max co SESSION_TOUCH_THROTTLE_MS).
 * Fire-and-forget safe: błędy tylko logowane, nigdy nie psują requestu.
 */
export async function touchSession(token: string): Promise<void> {
    try {
        const tokenHash = hashToken(token);
        const row = await prisma.sessions.findUnique({
            where: { token: tokenHash },
            select: { lastActivity: true, createdAt: true }
        });
        if (!row) return;
        await touchSessionByHash(tokenHash, row.lastActivity, row.createdAt);
    } catch (e) {
        logger.error('Auth', 'Błąd odświeżenia sesji', e);
    }
}

/**
 * Kasuje sesję po tokenie.
 */
export async function deleteSession(token: string): Promise<void> {
    try {
        const tokenHash = hashToken(token);
        authCacheInvalidateToken(tokenHash);
        await prisma.sessions.delete({
            where: { token: tokenHash }
        });
    } catch (_e) {
        // Ignoruj jeśli sesja nie istnieje
    }
}

/**
 * P1-D: kasuje WSZYSTKIE sesje użytkownika (np. po zmianie hasła).
 * `exceptToken` (surowy token) — sesja do zachowania (ta, z której zmieniono hasło).
 * Zwraca liczbę skasowanych.
 */
export async function deleteUserSessions(userId: string, exceptToken?: string): Promise<number> {
    try {
        const keep = exceptToken ? hashToken(exceptToken) : null;
        const rows = await prisma.sessions.findMany({
            where: { userId },
            select: { token: true }
        });
        const victims = rows.map((r) => r.token).filter((t) => t !== keep);
        if (victims.length === 0) return 0;
        authCacheInvalidateUser(userId, keep ?? undefined);
        const res = await prisma.sessions.deleteMany({
            where: { token: { in: victims } }
        });
        return res.count;
    } catch (e) {
        logger.error('Auth', 'Błąd kasowania sesji użytkownika', e);
        return 0;
    }
}

/**
 * Middleware: wymaga autoryzacji (ważna sesja).
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
    // Cookie-only: legacy shim x-auth-token usunięty (sunset) — nagłówek ignorowany.
    const token = req.cookies?.authToken;
    if (!token) {
        res.status(401).json({ error: 'Nieautoryzowany — zaloguj się' });
        return;
    }
    // Fast-path: sesja ZAWSZE weryfikowana w DB (natychmiastowa rewokacja
    // po logout/usunięciu usera), tylko wiersz usera brany z cache 30 s.
    // Zysk: 2Q → 1Q per request zamiast 0Q (0Q łamało test usuniętego usera).
    const tokenHash = hashToken(token);
    const cached = authCacheGet(tokenHash);
    const { session, reason } = await getSessionWithStatus(token);
    if (!session) {
        if (cached) authCacheInvalidateToken(tokenHash);
        if (reason === 'idle') {
            res.status(401).json({
                error: 'Sesja wygasła po 1h bezczynności — zaloguj się ponownie',
                code: 'SESSION_IDLE_EXPIRED'
            });
            return;
        }
        if (reason === 'absolute') {
            res.status(401).json({
                error: 'Sesja wygasła — zaloguj się ponownie',
                code: 'SESSION_EXPIRED'
            });
            return;
        }
        res.status(401).json({ error: 'Nieautoryzowany — zaloguj się' });
        return;
    }
    // Aktywnosc przedluza sesje (throttled, bez czekania na zapis;
    // bez dodatkowego odczytu — wiersz juz mamy z getSessionWithStatus).
    void touchSessionByHash(tokenHash, session.lastActivity ?? null, session.createdAt);
    if (cached && cached.id === session.userId) {
        req.user = cached;
        next();
        return;
    }

    try {
        const user = await prisma.users.findUnique({
            where: { id: session.userId }
        });
        if (!user) {
            res.status(401).json({ error: 'Użytkownik nie istnieje w bazie' });
            return;
        }

        req.user = getUserObject(user);
        authCacheSet(tokenHash, req.user, session.userId);
        next();
    } catch (e) {
        logger.error('Auth', 'Błąd bazy danych w requireAuth', e);
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
 */
export async function ensureAdminExists(): Promise<void> {
    logger.info('Auth', 'Sprawdzanie użytkownika administratora...');
    try {
        const admin = await prisma.users.findUnique({
            where: { username: 'admin' }
        });
        if (!admin) {
            const defaultPassword = process.env.DEFAULT_ADMIN_PASSWORD;
            if (!defaultPassword) {
                logger.error(
                    'Auth',
                    'BŁĄD KRYTYCZNY: DEFAULT_ADMIN_PASSWORD nie jest ustawiony. Ustaw zmienną środowiskową.'
                );
                throw new Error(
                    'DEFAULT_ADMIN_PASSWORD must be set - cannot create default admin account'
                );
            }
            if (
                defaultPassword === DEFAULT_ADMIN_FALLBACK_PASSWORD ||
                defaultPassword === DEFAULT_ADMIN_PLACEHOLDER_PASSWORD
            ) {
                if (process.env.NODE_ENV === 'production') {
                    logger.error(
                        'Auth',
                        'BŁĄD KRYTYCZNY: w produkcji użyto domyślnego hasła administratora. Ustaw losowe hasło w DEFAULT_ADMIN_PASSWORD.'
                    );
                    throw new Error(
                        'DEFAULT_ADMIN_PASSWORD must not be the default/placeholder value in production'
                    );
                }
                logger.warn(
                    'Auth',
                    'Użyto DOMYŚLNEGO hasła administratora. Zaleca się natychmiastową zmianę hasła po pierwszym logowaniu.'
                );
            }
            const hash = await bcrypt.hash(defaultPassword, 10);
            await prisma.users.create({
                data: {
                    id: 'usr_admin',
                    username: 'admin',
                    password: hash,
                    role: 'admin',
                    firstName: 'System',
                    lastName: 'Admin'
                }
            });
            logger.info('Auth', 'Domyślny administrator został utworzony.');
        }
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        logger.error('Auth', 'Błąd ensureAdminExists', message);
        throw e;
    }
}
