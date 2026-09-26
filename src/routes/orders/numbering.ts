import express from 'express';
import { z } from 'zod';
import prisma from '../../prismaClient';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import { canClaimNumber } from '../../utils/ownership';
import {
    claimIdempotencyKey,
    completeIdempotencyKey,
    idempotencyKeyFrom
} from '../../utils/idempotency';
import { logger } from '../../utils/logger';
import { HOT_TX_OPTS } from '../../utils/hotTx';

const router = express.Router();

/** Maks. liczb w jednym claim-zakresu — jak limit batch-delete (production.ts). */
const CLAIM_RANGE_MAX = 200;

// E3b: zod zamiast ręcznego typeof — unknown keys ignorowane (strip, default z.object),
// count musi być int 1..200. Komunikaty bez zmian (testy + frontend orderBulk.js).
const claimProductionNumbersSchema = z.object({
    count: z.number().int().min(1).max(CLAIM_RANGE_MAX)
});

/**
 * P0-B: atomowa rezerwacja numerów produkcyjnych.
 * Jedna transakcja: recycled (delete warunkowy, rywal dostaje count=0 i retry)
 * + rezerwacja zakresu licznika atomowym UPDATE lastNumber+N (bez pętli cand++).
 * Bez RAM-locka — gwarancję daje DB. Zwraca posortowane seqi.
 */
async function claimProductionSeqs(
    userId: string,
    year: number,
    startNum: number,
    count: number
): Promise<number[]> {
    let lastErr: unknown = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            return await prisma.$transaction(async (tx) => {
                const recycled = await tx.recycled_production_numbers.findMany({
                    where: { userId, year },
                    orderBy: { seqNumber: 'asc' },
                    take: count
                });
                const wanted = recycled.map((r) => r.seqNumber);
                if (wanted.length > 0) {
                    const del = await tx.recycled_production_numbers.deleteMany({
                        where: { userId, year, seqNumber: { in: wanted } }
                    });
                    // Ktoś sprzątnął część puli spod nas — retry z nowym odczytem.
                    if (del.count !== wanted.length) throw new Error('RECYCLED_RACE_RETRY');
                }
                const out: number[] = [...wanted];
                // Rezerwacja zakresu: dokładamy atomowymi inkrementami, pomijając
                // numery wzięte z recycled (stan patologiczny: recycled powyżej
                // głowy licznika). Zwykle jedna iteracja.
                let need = count - out.length;
                let guard = 0;
                while (need > 0) {
                    if (++guard > 5) throw new Error('RANGE_RESERVE_FAIL');
                    // Baza wiersza licznika (pierwszy claim) albo nic.
                    await tx.$executeRaw`INSERT INTO production_order_counters ("userId", year, "lastNumber")
                        VALUES (${userId}, ${year}, ${startNum - 1})
                        ON CONFLICT("userId", year) DO NOTHING`;
                    // Atomowa rezerwacja: jeden UPDATE, głowa po inkrementacji.
                    await tx.$executeRaw`UPDATE production_order_counters
                        SET "lastNumber" = "lastNumber" + ${need}
                        WHERE "userId" = ${userId} AND year = ${year}`;
                    const head = (
                        await tx.$queryRaw<
                            Array<{ lastNumber: number }>
                        >`SELECT "lastNumber" AS "lastNumber"
                        FROM production_order_counters WHERE "userId" = ${userId} AND year = ${year}`
                    )[0]?.lastNumber;
                    if (typeof head !== 'number') throw new Error('COUNTER_READ_FAIL');
                    for (let s = head - need + 1; s <= head && out.length < count; s++) {
                        if (!out.includes(s)) out.push(s);
                    }
                    need = count - out.length;
                }
                return out.sort((a, b) => a - b);
            }, HOT_TX_OPTS);
        } catch (e) {
            // Retry tylko przy wyścigu o recycled, reszta od razu w górę.
            const msg = e instanceof Error ? e.message : '';
            if (msg !== 'RECYCLED_RACE_RETRY') throw e;
            lastErr = e;
            continue;
        }
    }
    throw lastErr instanceof Error ? lastErr : new Error('CLAIM_RETRY_EXHAUSTED');
}

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
        // P0.2: podgląd numeru tylko własnego / podwładnego / admin.
        if (!canClaimNumber(authReq.user, userId)) {
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
        // P0.2: claim numeru tylko własnego / podwładnego / admin.
        if (!canClaimNumber(authReq.user, userId)) {
            return res.status(403).json({ error: 'Brak uprawnień do numeru tego użytkownika' });
        }
        // Idempotency-Key (opcjonalny): retry nie robi luki w numeracji.
        const idemEndpoint = 'POST /api/orders-studnie/claim-number';
        const idemKey = idempotencyKeyFrom(req);
        const idemUser = authReq.user?.id || '';
        if (idemKey) {
            const claim = await claimIdempotencyKey(idemUser, idemEndpoint, idemKey, req.body);
            if (claim.action === 'replay') return res.status(claim.status).json(claim.body);
            if (claim.action === 'reuse')
                return res.status(409).json({
                    error: 'Klucz idempotencji użyty z innym payloadem',
                    code: 'IDEMPOTENCY_KEY_REUSE'
                });
            if (claim.action === 'in-progress')
                return res.status(409).json({
                    error: 'Żądanie w trakcie przetwarzania — spróbuj ponownie',
                    code: 'IDEMPOTENCY_IN_PROGRESS'
                });
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
        const payload = { number: formatted, nextSeq: nextNumber, symbol, year };
        if (idemKey) await completeIdempotencyKey(idemUser, idemEndpoint, idemKey, 200, payload);
        res.json(payload);
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
        // P0.2: claim numeru produkcyjnego tylko własnego / podwładnego / admin.
        if (!canClaimNumber(authReq.user, userId)) {
            return res.status(403).json({ error: 'Brak uprawnień do numeru tego użytkownika' });
        }
        // Idempotency-Key (opcjonalny): retry nie robi luki w numeracji.
        const idemProdEndpoint = 'POST /api/orders-studnie/claim-production-number';
        const idemProdKey = idempotencyKeyFrom(req);
        const idemProdUser = authReq.user?.id || '';
        if (idemProdKey) {
            const claim = await claimIdempotencyKey(
                idemProdUser,
                idemProdEndpoint,
                idemProdKey,
                req.body
            );
            if (claim.action === 'replay') return res.status(claim.status).json(claim.body);
            if (claim.action === 'reuse')
                return res.status(409).json({
                    error: 'Klucz idempotencji użyty z innym payloadem',
                    code: 'IDEMPOTENCY_KEY_REUSE'
                });
            if (claim.action === 'in-progress')
                return res.status(409).json({
                    error: 'Żądanie w trakcie przetwarzania — spróbuj ponownie',
                    code: 'IDEMPOTENCY_IN_PROGRESS'
                });
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

        // P0-B: atomowy claim (recycled albo licznik) w jednej transakcji.
        const [nextNumber] = await claimProductionSeqs(userId, year, startNum, 1);

        const formatted = `${symbol}/${yearLetter}/${String(nextNumber).padStart(5, '0')}/${yearShort}`;
        const prodPayload = { number: formatted, nextSeq: nextNumber, symbol, yearLetter, year };
        if (idemProdKey)
            await completeIdempotencyKey(
                idemProdUser,
                idemProdEndpoint,
                idemProdKey,
                200,
                prodPayload
            );
        res.json(prodPayload);
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        logger.error('Numbering', 'Błąd serwera', message);
        res.status(500).json({ error: 'Wewnętrzny błąd serwera' });
    }
});

/**
 * Hurtowy claim numerów zleceń produkcyjnych — 1 request zamiast N (bulk P0).
 * P0-B: recycled + atomowa rezerwacja zakresu licznika w transakcji (bez pętli
 * cand++ i bez RAM-locka — gwarancję daje DB).
 */
router.post('/claim-production-numbers/:userId', requireAuth, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const userId = req.params.userId;
        // P0.2: hurtowy claim tylko własny / podwładny / admin.
        if (!canClaimNumber(authReq.user, userId)) {
            return res.status(403).json({ error: 'Brak uprawnień do numeru tego użytkownika' });
        }
        // Idempotency-Key (opcjonalny): retry nie rezerwuje kolejnego zakresu.
        const idemBulkEndpoint = 'POST /api/orders-studnie/claim-production-numbers';
        const idemBulkKey = idempotencyKeyFrom(req);
        const idemBulkUser = authReq.user?.id || '';
        if (idemBulkKey) {
            const claim = await claimIdempotencyKey(
                idemBulkUser,
                idemBulkEndpoint,
                idemBulkKey,
                req.body
            );
            if (claim.action === 'replay') return res.status(claim.status).json(claim.body);
            if (claim.action === 'reuse')
                return res.status(409).json({
                    error: 'Klucz idempotencji użyty z innym payloadem',
                    code: 'IDEMPOTENCY_KEY_REUSE'
                });
            if (claim.action === 'in-progress')
                return res.status(409).json({
                    error: 'Żądanie w trakcie przetwarzania — spróbuj ponownie',
                    code: 'IDEMPOTENCY_IN_PROGRESS'
                });
        }
        const parsed = claimProductionNumbersSchema.safeParse(req.body ?? {});
        if (!parsed.success) {
            const tooBig = parsed.error.issues.some((i) => i.code === 'too_big');
            if (tooBig) {
                return res.status(400).json({
                    error: `Zbyt wiele numerów w jednym żądaniu (max ${CLAIM_RANGE_MAX})`
                });
            }
            return res.status(400).json({ error: 'Pole count musi być liczbą całkowitą >= 1' });
        }
        const count = parsed.data.count;
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

        const seqs = await claimProductionSeqs(userId, year, startNum, count);
        const numbers = seqs.map(
            (seq) => `${symbol}/${yearLetter}/${String(seq).padStart(5, '0')}/${yearShort}`
        );
        const bulkPayload = { numbers, seqs, symbol, yearLetter, year };
        if (idemBulkKey)
            await completeIdempotencyKey(
                idemBulkUser,
                idemBulkEndpoint,
                idemBulkKey,
                200,
                bulkPayload
            );
        res.json(bulkPayload);
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        logger.error('Numbering', 'Błąd serwera', message);
        res.status(500).json({ error: 'Wewnętrzny błąd serwera' });
    }
});

export default router;
