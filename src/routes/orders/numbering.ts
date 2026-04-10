import express from 'express';
import prisma from '../../prismaClient';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';

const router = express.Router();

/* ===== RECYCLED NUMBERS ===== */

router.get('/recycled', requireAuth, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const year = new Date().getFullYear();
        const rows = await prisma.recycled_production_numbers.findMany({
            where: { userId: authReq.user?.id, year },
            orderBy: { seqNumber: 'asc' }
        });
        res.json({ recycled: rows.map((r: any) => r.seqNumber) });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

/* ===== ORDER NUMBER GENERATION ===== */

router.get('/next-number/:userId', requireAuth, async (req, res) => {
    try {
        const userId = req.params.userId;
        const year = new Date().getFullYear();

        const user = await prisma.users.findUnique({
            where: { id: userId },
            select: { symbol: true }
        });
        if (!user) return res.status(404).json({ error: 'User not found' });

        const symbol = user.symbol || '??';

        const counter = await prisma.order_counters.findUnique({
            where: { userId_year: { userId, year } }
        });
        const nextNumber = (counter?.lastNumber || 0) + 1;
        const formatted = `${symbol}/${String(nextNumber).padStart(6, '0')}/${year}`;

        res.json({ number: formatted, nextSeq: nextNumber, symbol, year });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/claim-number/:userId', requireAuth, async (req, res) => {
    try {
        const userId = req.params.userId;
        const year = new Date().getFullYear();

        const user = await prisma.users.findUnique({
            where: { id: userId },
            select: { symbol: true }
        });
        if (!user) return res.status(404).json({ error: 'User not found' });

        const symbol = user.symbol || '??';

        const counter = await prisma.order_counters.findUnique({
            where: { userId_year: { userId, year } }
        });
        const nextNumber = (counter?.lastNumber || 0) + 1;

        await prisma.order_counters.upsert({
            where: { userId_year: { userId, year } },
            create: { userId, year, lastNumber: nextNumber },
            update: { lastNumber: nextNumber }
        });

        const formatted = `${symbol}/${String(nextNumber).padStart(6, '0')}/${year}`;
        res.json({ number: formatted, nextSeq: nextNumber, symbol, year });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

/* ===== PRODUCTION ORDER NUMBER GENERATION ===== */

router.post('/claim-production-number/:userId', requireAuth, async (req, res) => {
    try {
        const userId = req.params.userId;
        const year = new Date().getFullYear();
        const yearShort = String(year).slice(-2);

        const user = await prisma.users.findUnique({
            where: { id: userId },
            select: { symbol: true, productionOrderStartNumber: true }
        });
        if (!user) return res.status(404).json({ error: 'User not found' });

        const symbol = user.symbol || '??';
        const startNum = user.productionOrderStartNumber || 1;

        // Get year letter
        const letterKey = 'year_letter_' + year;
        const letterRow = await prisma.settings.findUnique({
            where: { key: letterKey }
        });
        const yearLetter = letterRow ? letterRow.value : '?';

        // Check for recycled numbers
        const recycled = await prisma.recycled_production_numbers.findFirst({
            where: { userId, year },
            orderBy: { seqNumber: 'asc' }
        });

        let nextNumber: number;
        if (recycled) {
            nextNumber = recycled.seqNumber;
            await prisma.recycled_production_numbers.delete({
                where: {
                    userId_year_seqNumber: { userId, year, seqNumber: nextNumber }
                }
            });
        } else {
            const counter = await prisma.production_order_counters.findUnique({
                where: { userId_year: { userId, year } }
            });
            const lastNum = counter?.lastNumber || 0;
            nextNumber = Math.max(lastNum + 1, startNum);

            await prisma.production_order_counters.upsert({
                where: { userId_year: { userId, year } },
                create: { userId, year, lastNumber: nextNumber },
                update: { lastNumber: nextNumber }
            });
        }

        const formatted = `${symbol}/${yearLetter}/${String(nextNumber).padStart(5, '0')}/${yearShort}`;
        res.json({ number: formatted, nextSeq: nextNumber, symbol, yearLetter, year });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

export default router;
