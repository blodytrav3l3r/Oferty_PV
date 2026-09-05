import express from 'express';
import prisma from '../../prismaClient';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import { canWriteDoc } from '../../utils/ownership';
import { logger } from '../../utils/logger';
import { createModuleLock } from '../../middleware/writeLock';

const router = express.Router();

/** Lock numeracji produkcyjnej — recycled findFirst+delete to read-then-write (błąd #42). */
const { runWithLock: runNumberingWithLock } = createModuleLock();

/** Maks. liczb w jednym claim-zakresu — jak limit batch-delete (production.ts). */
const CLAIM_RANGE_MAX = 200;

/* ===== RECYKLING NUMERÓW ===== */

router.get('/recycled', requireAuth, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const year = new Date().getFullYear();
        const yearShort = String(year).slice(-2);
        const letterKey = 'year_letter_' + year;
        const letterRow = await prisma.settings.findUnique({ where: { key: letterKey } });
        const yearLetter = letterRow ? letterRow.value : '?';
        const rows = await prisma.recycled_production_numbers.findMany({
            where: { userId: authReq.user?.id, year },
            orderBy: { seqNumber: 'asc' }
        });
        res.json({
            recycled: rows.map((r) => r.seqNumber),
            symbol: authReq.user?.symbol || '??',
            yearLetter,
            yearShort
        });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        logger.error('Numbering', 'Błąd serwera', message);
        res.status(500).json({ error: 'Wewnętrzny błąd serwera' });
    }
});

/* ===== GENEROWANIE NUMERU ZAMÓWIENIA ===== */

router.get('/next-number/:userId', requireAuth, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const userId = req.params.userId;
        if (!canWriteDoc(authReq.user, userId)) {
            return res.status(403).json({ error: 'Brak uprawnień do numeru tego użytkownika' });
        }
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
        const formatted = `${symbol}/ZS/${String(nextNumber).padStart(6, '0')}/${year}`;

        res.json({ number: formatted, nextSeq: nextNumber, symbol, year });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        logger.error('Numbering', 'Błąd serwera', message);
        res.status(500).json({ error: 'Wewnętrzny błąd serwera' });
    }
});

router.post('/claim-number/:userId', requireAuth, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const userId = req.params.userId;
        if (!canWriteDoc(authReq.user, userId)) {
            return res.status(403).json({ error: 'Brak uprawnień do numeru tego użytkownika' });
        }
        const year = new Date().getFullYear();

        const user = await prisma.users.findUnique({
            where: { id: userId },
            select: { symbol: true }
        });
        if (!user) return res.status(404).json({ error: 'Użytkownik nie znaleziony' });

        const symbol = user.symbol || '??';

        const counter = await prisma.order_counters.upsert({
            where: { userId_year: { userId, year } },
            create: { userId, year, lastNumber: 1 },
            update: { lastNumber: { increment: 1 } }
        });
        const nextNumber = counter.lastNumber;

        const formatted = `${symbol}/ZS/${String(nextNumber).padStart(6, '0')}/${year}`;
        res.json({ number: formatted, nextSeq: nextNumber, symbol, year });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        logger.error('Numbering', 'Błąd serwera', message);
        res.status(500).json({ error: 'Wewnętrzny błąd serwera' });
    }
});

/* ===== GENEROWANIE NUMERU ZLECENIA PRODUKCYJNEGO ===== */

router.post('/claim-production-number/:userId', requireAuth, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const userId = req.params.userId;
        if (!canWriteDoc(authReq.user, userId)) {
            return res.status(403).json({ error: 'Brak uprawnień do numeru tego użytkownika' });
        }
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
            const counter = await prisma.production_order_counters.upsert({
                where: { userId_year: { userId, year } },
                create: { userId, year, lastNumber: startNum },
                update: { lastNumber: { increment: 1 } }
            });
            nextNumber = counter.lastNumber ?? startNum;
        }

        const formatted = `${symbol}/${yearLetter}/${String(nextNumber).padStart(5, '0')}/${yearShort}`;
        res.json({ number: formatted, nextSeq: nextNumber, symbol, yearLetter, year });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        logger.error('Numbering', 'Błąd serwera', message);
        res.status(500).json({ error: 'Wewnętrzny błąd serwera' });
    }
});

/**
 * Hurtowy claim numerów zleceń produkcyjnych — 1 request zamiast N (bulk P0).
 * Najpierw drenuje recycled (rosnąco), resztę bierze atomowym incrementem licznika.
 * Całość pod modułowyn lockiem: dwa równoległe bulki nie dostaną tych samych numerów.
 */
router.post('/claim-production-numbers/:userId', requireAuth, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const userId = req.params.userId;
        if (!canWriteDoc(authReq.user, userId)) {
            return res.status(403).json({ error: 'Brak uprawnień do numeru tego użytkownika' });
        }
        const count = (req.body || {}).count;
        if (typeof count !== 'number' || !Number.isInteger(count) || count < 1) {
            return res.status(400).json({ error: 'Pole count musi być liczbą całkowitą >= 1' });
        }
        if (count > CLAIM_RANGE_MAX) {
            return res
                .status(400)
                .json({ error: `Zbyt wiele numerów w jednym żądaniu (max ${CLAIM_RANGE_MAX})` });
        }
        const year = new Date().getFullYear();
        const yearShort = String(year).slice(-2);

        const user = await prisma.users.findUnique({
            where: { id: userId },
            select: { symbol: true, productionOrderStartNumber: true }
        });
        if (!user) return res.status(404).json({ error: 'Użytkownik nie znaleziony' });

        const symbol = user.symbol || '??';
        const startNum = user.productionOrderStartNumber || 1;

        const letterKey = 'year_letter_' + year;
        const letterRow = await prisma.settings.findUnique({
            where: { key: letterKey }
        });
        const yearLetter = letterRow ? letterRow.value : '?';

        const result = await runNumberingWithLock(async () => {
            const recycled = await prisma.recycled_production_numbers.findMany({
                where: { userId, year },
                orderBy: { seqNumber: 'asc' },
                take: count
            });
            if (recycled.length > 0) {
                await prisma.recycled_production_numbers.deleteMany({
                    where: {
                        userId,
                        year,
                        seqNumber: { in: recycled.map((r) => r.seqNumber) }
                    }
                });
            }
            const seqs: number[] = recycled.map((r) => r.seqNumber);
            const remaining = count - seqs.length;
            if (remaining > 0) {
                // Świeże numery z pominięciem recycled wziętych w tym samym claimie
                // (recycled to dziury poniżej głowy licznika — bez skipa byłyby duble).
                const taken = new Set(seqs);
                const cur = await prisma.production_order_counters.findUnique({
                    where: { userId_year: { userId, year } },
                    select: { lastNumber: true }
                });
                let cand = (cur?.lastNumber ?? startNum - 1) + 1;
                const fresh: number[] = [];
                while (fresh.length < remaining) {
                    if (!taken.has(cand)) fresh.push(cand);
                    cand++;
                }
                await prisma.production_order_counters.upsert({
                    where: { userId_year: { userId, year } },
                    create: { userId, year, lastNumber: cand - 1 },
                    update: { lastNumber: cand - 1 }
                });
                seqs.push(...fresh);
            }
            const numbers = seqs.map(
                (seq) => `${symbol}/${yearLetter}/${String(seq).padStart(5, '0')}/${yearShort}`
            );
            return { numbers, seqs, symbol, yearLetter, year };
        });
        if (!result.acquired) {
            res.status(429).json({ error: 'Numeracja w toku, spróbuj ponownie za chwilę' });
            return;
        }
        res.json(result.value);
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        logger.error('Numbering', 'Błąd serwera', message);
        res.status(500).json({ error: 'Wewnętrzny błąd serwera' });
    }
});

export default router;
