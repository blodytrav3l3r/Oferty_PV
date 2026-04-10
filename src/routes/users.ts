import express from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../prismaClient';
import { requireAuth, requireAdmin, AuthenticatedRequest } from '../middleware/auth';


const router = express.Router();

/**
 * POMOCNICZE: Pobieranie licznika zamówień
 */
async function getNextOrderNumber(user: any, year: number): Promise<string> {
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

// GET /api/users (admin only)
router.get('/', requireAuth as any, requireAdmin as any, async (req, res) => {
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
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// PUT /api/users/:id (admin only)
router.put('/:id', requireAuth as any, requireAdmin as any, async (req, res) => {
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
            newPassword = bcrypt.hashSync(password, 10);
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
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// DELETE /api/users/:id (admin only)
router.delete('/:id', requireAuth as any, requireAdmin as any, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    if (req.params.id === authReq.user?.id)
        return res.status(400).json({ error: 'Nie możesz usunąć siebie' });

    try {
        await prisma.users.delete({
            where: { id: req.params.id }
        });
        res.json({ ok: true });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// GET /api/users-for-assignment (alias: /for-assignment)
router.get('/for-assignment', requireAuth as any, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const users = await prisma.users.findMany();

        const mapUser = (u: any) => ({
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
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

export default router;
