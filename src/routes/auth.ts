import express from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../prismaClient';
import {
    createSession,
    deleteSession,
    requireAuth,
    requireAdmin,
    SESSION_MAX_AGE_MS,
    AuthenticatedRequest
} from '../middleware/auth';
import { createRateLimiter } from '../middleware/rateLimiter';

const router = express.Router();

const loginLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    maxHits: 10,
    message: 'Zbyt wiele prób logowania. Odczekaj 15 minut.'
});

// POST /api/auth/login
router.post('/login', loginLimiter, async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Podaj login i hasło' });
    }

    try {
        const user = await prisma.users.findUnique({
            where: { username }
        });

        if (!user || !user.password || !bcrypt.compareSync(password, user.password)) {
            return res.status(401).json({ error: 'Nieprawidłowy login lub hasło' });
        }

        const token = await createSession(user.id);

        let subUsers: string[] = [];
        try {
            if (user.subUsers) subUsers = JSON.parse(user.subUsers);
        } catch (_e) {
            subUsers = [];
        }

        res.cookie('authToken', token, {
            httpOnly: false, // false aby frontend mógł odczytać
            maxAge: SESSION_MAX_AGE_MS,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax', // lax zamiast strict dla nawigacji między stronami
            path: '/'
        });
        res.json({
            token,
            user: {
                id: user.id,
                username: user.username,
                role: user.role,
                firstName: user.firstName,
                lastName: user.lastName,
                phone: user.phone,
                email: user.email,
                symbol: user.symbol,
                subUsers: subUsers
            }
        });
    } catch (e: any) {
        console.error('[AUTH] Login error:', e.message);
        res.status(500).json({ error: 'Błąd serwera bazy danych' });
    }
});

// POST /api/auth/register (admin only)
router.post('/register', requireAuth as any, requireAdmin as any, async (req, res) => {
    const {
        username,
        password,
        role,
        firstName,
        lastName,
        phone,
        email,
        symbol,
        subUsers,
        orderStartNumber,
        productionOrderStartNumber
    } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Podaj login i hasło' });
    }

    try {
        const existing = await prisma.users.findUnique({
            where: { username }
        });

        if (existing) {
            return res.status(409).json({ error: 'Użytkownik o takim loginie już istnieje' });
        }

        const hash = bcrypt.hashSync(password, 10);
        const userId = 'user_' + Date.now();
        const subUsersString = Array.isArray(subUsers) ? JSON.stringify(subUsers) : '[]';

        await prisma.users.create({
            data: {
                id: userId,
                username,
                password: hash,
                role: role || 'user',
                firstName: firstName || '',
                lastName: lastName || '',
                phone: phone || '',
                email: email || '',
                symbol: symbol || '',
                subUsers: subUsersString,
                orderStartNumber: parseInt(orderStartNumber) || 1,
                productionOrderStartNumber: parseInt(productionOrderStartNumber) || 1,
                createdAt: new Date().toISOString() as string
            }
        });

        res.json({
            user: {
                id: userId,
                username,
                role: role || 'user',
                firstName: firstName || '',
                lastName: lastName || '',
                phone: phone || '',
                email: email || '',
                symbol: symbol || '',
                subUsers: Array.isArray(subUsers) ? subUsers : []
            }
        });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// POST /api/auth/logout
router.post('/logout', async (req, res) => {
    const token = (req.headers['x-auth-token'] as string) || req.cookies?.authToken;
    if (token) await deleteSession(token);
    res.clearCookie('authToken');
    res.json({ ok: true });
});

// GET /api/auth/me
router.get('/me', requireAuth as any, (req, res) => {
    const authReq = req as AuthenticatedRequest;
    // req.user jest już wypełniony przez middleware requireAuth
    res.json({ user: authReq.user });
});

// POST /api/auth/change-password
router.post('/change-password', requireAuth as any, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) {
        return res.status(400).json({ error: 'Podaj stare i nowe hasło' });
    }

    try {
        const user = await prisma.users.findUnique({
            where: { id: authReq.user!.id }
        });

        if (!user || !bcrypt.compareSync(oldPassword, user.password)) {
            return res.status(401).json({ error: 'Nieprawidłowe stare hasło' });
        }

        const hash = bcrypt.hashSync(newPassword, 10);
        await prisma.users.update({
            where: { id: authReq.user!.id },
            data: { password: hash }
        });

        res.json({ ok: true });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

export default router;
