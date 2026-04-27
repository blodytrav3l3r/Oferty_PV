import express from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../prismaClient';
import { requireAuth, requireAdmin, AuthenticatedRequest } from '../middleware/auth';
import { validateData } from '../validators/authSchema';
import { createRateLimiter } from '../middleware/rateLimiter';
import { userUpdateSchema } from '../validators/offerSchemas';

const router = express.Router();

// Rate limiter dla operacji admina na użytkownikach (30 zapytań na minutę)
const adminUsersLimiter = createRateLimiter({
    windowMs: 60 * 1000,
    maxHits: 30,
    message: 'Zbyt wiele operacji na użytkownikach. Odczekaj minutę.'
});

/**
 * POMOCNICZE: Pobieranie licznika zamówień
 */
async function getNextOrderNumber(user: { id: string; orderStartNumber?: number | null; symbol?: string | null }, year: number): Promise<string> {
    const startNum = user.orderStartNumber || 1;
    const symbol = user.symbol || '??';

    try {
        const counter = await prisma.order_counters.findUnique({
            where: { userId_year: { userId: user.id, year } }
        });

        const lastNum = counter?.lastNumber || 0;
        const nextNum = Math.max(lastNum + 1, startNum);
        return `${symbol}/${String(nextNum).padStart(6, '0')}/${year}`;
    } catch (_e) {
        return `${symbol}/${String(startNum).padStart(6, '0')}/${year}`;
    }
}

// GET /api/users (tylko administrator)
router.get('/', requireAuth, requireAdmin, async (_req, res) => {
    try {
        const users = await prisma.users.findMany();
        const year = new Date().getFullYear();

        const usersData = await Promise.all(
            users.map(async (user) => {
                let subUsers: string[] = [];
                try {
                    if (user.subUsers) subUsers = JSON.parse(user.subUsers);
                } catch (_e) {
                    subUsers = [];
                }

                const nextOrderNumber = await getNextOrderNumber(user, year);
                return {
                    id: user.id,
                    username: user.username,
                    role: user.role,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    phone: user.phone,
                    email: user.email,
                    symbol: user.symbol,
                    subUsers: subUsers,
                    orderStartNumber: user.orderStartNumber,
                    productionOrderStartNumber: user.productionOrderStartNumber || 1,
                    createdAt: user.createdAt,
                    nextOrderNumber
                };
            })
        );

        res.json({ data: usersData });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        res.status(500).json({ error: message });
    }
});

// PUT /api/users/:id (tylko administrator)
router.put('/:id', requireAuth, requireAdmin, adminUsersLimiter, validateData(userUpdateSchema), async (req, res) => {
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
    const userId = req.params.id;

    try {
        const user = await prisma.users.findUnique({
            where: { id: userId }
        });
        if (!user) {
            return res.status(404).json({ error: 'Użytkownik nie znaleziony' });
        }

        if (username && username !== user.username) {
            const existing = await prisma.users.findUnique({
                where: { username }
            });
            if (existing) return res.status(409).json({ error: 'Login zajęty' });
        }

        let newPassword = user.password;
        if (password) {
            newPassword = await bcrypt.hash(password, 10);
        }

        const newRole = role || user.role;
        const newFirstName = firstName !== undefined ? firstName : user.firstName;
        const newLastName = lastName !== undefined ? lastName : user.lastName;
        const newPhone = phone !== undefined ? phone : user.phone;
        const newEmail = email !== undefined ? email : user.email;
        const newSymbol = symbol !== undefined ? symbol : user.symbol;
        const newOrderStartNumber =
            orderStartNumber !== undefined
                ? parseInt(orderStartNumber) || 1
                : user.orderStartNumber;
        const newProdOrderStartNumber =
            productionOrderStartNumber !== undefined
                ? parseInt(productionOrderStartNumber) || 1
                : user.productionOrderStartNumber || 1;

        const newSubUsersString =
            subUsers !== undefined
                ? Array.isArray(subUsers)
                    ? JSON.stringify(subUsers)
                    : '[]'
                : user.subUsers;

        await prisma.users.update({
            where: { id: userId },
            data: {
                username: username || user.username,
                password: newPassword,
                role: newRole,
                firstName: newFirstName,
                lastName: newLastName,
                phone: newPhone,
                email: newEmail,
                symbol: newSymbol,
                subUsers: newSubUsersString,
                orderStartNumber: newOrderStartNumber,
                productionOrderStartNumber: newProdOrderStartNumber
            }
        });

        res.json({ ok: true });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        res.status(500).json({ error: message });
    }
});

// DELETE /api/users/:id (tylko administrator)
router.delete('/:id', requireAuth, requireAdmin, adminUsersLimiter, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    if (req.params.id === authReq.user?.id)
        return res.status(400).json({ error: 'Nie możesz usunąć siebie' });

    try {
        await prisma.users.delete({
            where: { id: req.params.id }
        });
        res.json({ ok: true });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        res.status(500).json({ error: message });
    }
});

// GET /api/users-for-assignment (alias: /for-assignment)
router.get('/for-assignment', requireAuth, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const users = await prisma.users.findMany();

        const mapUser = (u: { id: string; username: string; role: string; firstName?: string | null; lastName?: string | null; phone?: string | null; email?: string | null; symbol?: string | null; orderStartNumber?: number | null }) => ({
            id: u.id,
            username: u.username,
            role: u.role,
            firstName: u.firstName,
            lastName: u.lastName,
            email: u.email,
            phone: u.phone,
            symbol: u.symbol
        });

        if (authReq.user?.role === 'admin') {
            return res.json({ data: users.map(mapUser) });
        }

        const allowedIds = [authReq.user?.id, ...(authReq.user?.subUsers || [])];
        const filtered = users.filter((u) => allowedIds.includes(u.id));
        res.json({ data: filtered.map(mapUser) });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        res.status(500).json({ error: message });
    }
});

export default router;
