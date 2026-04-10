import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import prisma from '../prismaClient';
import { getUserObject, User } from '../helpers';

export const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 dni

export interface Session {
  token: string;
  userId: string;
  createdAt: bigint;
}

export interface AuthenticatedRequest extends Request {
  user?: User;
}

/**
 * Tworzy nową sesję dla użytkownika.
 */
export async function createSession(userId: string): Promise<string> {
  const token = crypto.randomBytes(32).toString('hex');
  const now = Date.now();

  await prisma.sessions.create({
    data: {
      token,
      userId,
      createdAt: now,
    },
  });

  return token;
}

/**
 * Pobiera sesję po tokenie.
 */
export async function getSession(token: string | undefined): Promise<Session | null> {
  if (!token) return null;
  try {
    const session = await prisma.sessions.findUnique({
      where: { token },
    });
    if (!session) return null;
    if (Number(session.createdAt) + SESSION_MAX_AGE_MS < Date.now()) {
      await deleteSession(token);
      return null;
    }
    return session as Session;
  } catch (_e) {
    return null;
  }
}

/**
 * Kasuje sesję po tokenie.
 */
export async function deleteSession(token: string): Promise<void> {
  try {
    await prisma.sessions.delete({
      where: { token },
    });
  } catch (_e) {
    // Ignoruj jeśli sesja nie istnieje
  }
}

/**
 * Middleware: wymaga autoryzacji (ważna sesja).
 */
export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  const token = (req.headers['x-auth-token'] as string) || req.cookies?.authToken;
  const session = await getSession(token);
  if (!session) {
    res.status(401).json({ error: 'Nieautoryzowany — zaloguj się' });
    return;
  }

  try {
    const user = await prisma.users.findUnique({
      where: { id: session.userId },
    });
    if (!user) {
      res.status(401).json({ error: 'Użytkownik nie istnieje w bazie' });
      return;
    }

    req.user = getUserObject(user);
    next();
  } catch (_e) {
    res.status(500).json({ error: 'Błąd bazy danych' });
  }
}

/**
 * Middleware: wymaga roli admin (po requireAuth).
 */
export async function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
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
  console.log('[INFO] Checking for admin user...');
  try {
    const admin = await prisma.users.findUnique({
      where: { username: 'admin' },
    });
    if (!admin) {
      const hash = bcrypt.hashSync('admin123', 10);
      await prisma.users.create({
        data: {
          id: 'usr_admin',
          username: 'admin',
          password: hash,
          role: 'admin',
          firstName: 'System',
          lastName: 'Admin',
        },
      });
      console.log('[OK] Default admin created.');
    }
  } catch (e: any) {
    console.error('[ERROR] ensureAdminExists', e.message);
  }
}