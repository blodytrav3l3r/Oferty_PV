import express from 'express';
import prisma from '../../prismaClient';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';

const router = express.Router();

/* ===== RECYKLING NUMERÓW ===== */

router.get('/recycled', requireAuth, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const year = new Date().getFullYear();
        const rows = await prisma.recycled_production_numbers.findMany({
            where: { userId: authReq.user?.id, year },
            orderBy: { seqNumber: 'asc' }
        });
        res.json({ recycled: rows.map((r) => r.seqNumber) });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        res.status(500).json({ error: message });
    }
});

/* ===== GENEROWANIE NUMERU ZAMÓWIENIA ===== */

router.get('/next-number/:userId', requireAuth, async (req, res) => {
    try {
        const userId = req.params.userId;
        const year = new Date().getFullYear();

        const user = await prisma.users.findUnique({
            where: { id: userId },
            select: { symbol: true }
        });
        if (!user) return res.status(404).json({ error: 'Użytkownik nie znaleziony' });

        const symbol = user.symbol || '??';

        const counter = await prisma.order_counters.findUnique({
            where: { userId_year: { userId, year } }
        });
        const nextNumber = (counter?.lastNumber || 0) + 1;
        const formatted = `${symbol}/${String(nextNumber).padStart(6, '0')}/${year}`;

        res.json({ number: formatted, nextSeq: nextNumber, symbol, year });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        res.status(500).json({ error: message });
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
        if (!user) return res.status(404).json({ error: 'Użytkownik nie znaleziony' });

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
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        res.status(500).json({ error: message });
    }
});

/* ===== GENEROWANIE NUMERU ZLECENIA PRODUKCYJNEGO ===== */

router.post('/claim-production-number/:userId', requireAuth, async (req, res) => {
    try {
        const userId = req.params.userId;
        const year = new Date().getFullYear();
        const yearShort = String(year).slice(-2);

        const user = await prisma.users.findUnique({
            where: { id: userId },
            select: { symbol: true, productionOrderStartNumber: true }
        });
        if (!user) return res.status(404).json({ error: 'Użytkownik nie znaleziony' });

        const symbol = user.symbol || '??';
        const startNum = user.productionOrderStartNumber || 1;

        // Pobierz literę roku
        const letterKey = 'year_letter_' + year;
        const letterRow = await prisma.settings.findUnique({
            where: { key: letterKey }
        });
        const yearLetter = letterRow ? letterRow.value : '?';

        // Sprawdź czy są numery z recyklingu (recycled)
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
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        res.status(500).json({ error: message });
    }
});

export default router;
