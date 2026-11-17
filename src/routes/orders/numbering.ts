import express from 'express';
import { z } from 'zod';
import prisma from '../../prismaClient';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import { WRITE_LIMITER } from '../../middleware/rateLimiters';
import { canClaimNumber } from '../../utils/ownership';
import {
    claimIdempotencyKey,
    completeIdempotencyKey,
    idempotencyKeyFrom
} from '../../utils/idempotency';
import { logger } from '../../utils/logger';
import { HOT_TX_OPTS } from '../../utils/hotTx';
import { formatProductionNumber } from '../../utils/productionNumber';
import { getNumberingYear } from '../../utils/numberingYear';

const router = express.Router();

/** Maks. liczb w jednym claim-zakresu — jak limit batch-delete (production.ts). */
const CLAIM_RANGE_MAX = 200;
/** Moduł numeracji zamówień studni w globalnej puli rocznej. */
const STUDNIE_ORDER_KIND = 'ZS';
const ORDER_NUMBER_DIGITS = 5;

function formatStudnieOrderNumber(seq: number, year: number): string {
    return `${STUDNIE_ORDER_KIND}/${String(seq).padStart(ORDER_NUMBER_DIGITS, '0')}/${year}`;
}

/** Błąd numeracji mapowany na konkretny status HTTP i kod dla frontu. */
class NumberingError extends Error {
    status: number;
    code: string;

    constructor(status: number, code: string, message: string) {
        super(message);
        this.status = status;
        this.code = code;
    }
}

// E3b: zod zamiast ręcznego typeof — unknown keys ignorowane (strip, default z.object),
// count musi być int 1..200. Komunikaty bez zmian (testy + frontend orderBulk.js).
const claimProductionNumbersSchema = z.object({
    count: z.number().int().min(1).max(CLAIM_RANGE_MAX)
});

/**
 * P0-B: atomowa rezerwacja numerów produkcyjnych z zakresu opiekuna.
 * Jedna transakcja: advisory lock per (rok, user) + INSERT ... SELECT najniższych
 * wolnych numerów z generate_series(od..do). PK (year, seqNumber) w claims dalej
 * gwarantuje globalną unikalność, a numery z recyklingu (brak wiersza w claims)
 * wracają do obiegu automatycznie.
 */
async function claimProductionSeqs(userId: string, year: number, count: number): Promise<number[]> {
    return prisma.$transaction(async (tx) => {
        const user = await tx.users.findUnique({
            where: { id: userId },
            select: { productionRangeFrom: true, productionRangeTo: true }
        });
        const from = user?.productionRangeFrom ?? null;
        const to = user?.productionRangeTo ?? null;
        if (from === null || to === null) {
            throw new NumberingError(
                409,
                'PRODUCTION_RANGE_MISSING',
                'Użytkownik nie ma ustawionego zakresu numerów zleceń produkcyjnych — ustaw go w panelu administracyjnym'
            );
        }

        // Serializuje claimy tego samego użytkownika w roku; zakresy różnych osób są rozłączne.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`prod-range:${year}:${userId}`}))`;

        const rows = await tx.$queryRaw<Array<{ seqNumber: number }>>`
            INSERT INTO "production_global_number_claims" ("userId", "year", "seqNumber")
            SELECT ${userId}, ${year}, free.seq
            FROM (
                SELECT s AS seq
                FROM generate_series(${from}::int, ${to}::int) AS s
                WHERE NOT EXISTS (
                    SELECT 1 FROM "production_global_number_claims" AS claim
                    WHERE claim."year" = ${year} AND claim."seqNumber" = s
                )
                ORDER BY s
                LIMIT ${count}
            ) AS free
            RETURNING "seqNumber"
        `;
        const allocated = rows.map((row) => row.seqNumber).sort((a, b) => a - b);
        if (allocated.length < count) {
            throw new NumberingError(
                409,
                'PRODUCTION_RANGE_EXHAUSTED',
                `Zakres numerów ${from}–${to} jest wyczerpany na rok ${year}`
            );
        }

        await tx.recycled_production_numbers_global.deleteMany({
            where: { year, seqNumber: { in: allocated } }
        });
        return allocated;
    }, HOT_TX_OPTS);
}

/* ===== RECYKLING NUMERÓW ===== */

router.get('/recycled', requireAuth, async (_req, res) => {
    try {
        const year = getNumberingYear();
        const yearShort = String(year).slice(-2);
        const letterKey = 'year_letter_' + year;
        const letterRow = await prisma.settings.findUnique({ where: { key: letterKey } });
        const yearLetter = letterRow ? letterRow.value : '?';
        const rows = await prisma.recycled_production_numbers_global.findMany({
            where: { year },
            orderBy: { seqNumber: 'asc' }
        });
        res.json({
            recycled: rows.map((r) => r.seqNumber),
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

// Podgląd następnego numeru — NIE rezerwuje (bez incrementu). Frontend
// nie może go traktować jako przyznanego; przydział tylko przez claim-*.
// Pula jest wspólna dla wszystkich użytkowników, więc numer nie zależy od userId.
router.get('/next-number/:userId', requireAuth, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const userId = req.params.userId;
        // P0.2: podgląd numeru tylko własnego / podwładnego / admin.
        if (!canClaimNumber(authReq.user, userId)) {
            return res.status(403).json({ error: 'Brak uprawnień do numeru tego użytkownika' });
        }
        const year = getNumberingYear();

        const user = await prisma.users.findUnique({
            where: { id: userId },
            select: { id: true }
        });
        if (!user) return res.status(404).json({ error: 'Użytkownik nie znaleziony' });

        const counter = await prisma.order_global_counters.findUnique({
            where: { year_kind: { year, kind: STUDNIE_ORDER_KIND } }
        });
        const nextNumber = (counter?.lastNumber || 0) + 1;

        res.json({
            number: formatStudnieOrderNumber(nextNumber, year),
            nextSeq: nextNumber,
            year
        });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        logger.error('Numbering', 'Błąd serwera', message);
        res.status(500).json({ error: 'Wewnętrzny błąd serwera' });
    }
});

// P1.2: WRITE_LIMITER przeciw drenażowi licznika (pętla claimów bez throttlingu).
// Crash przed completeIdempotencyKey zostawia lukę w numeracji (licznik
// poszedł w górę, retry rezerwuje kolejny) — luki dopuszczalne, unikalność
// zachowana przez atomowy upsert/increment.
router.post('/claim-number/:userId', requireAuth, WRITE_LIMITER, async (req, res) => {
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
        const year = getNumberingYear();

        const user = await prisma.users.findUnique({
            where: { id: userId },
            select: { id: true }
        });
        // P2: domknij klucz wynikiem — retry replayuje 404 zamiast wisieć PENDING.
        if (!user) {
            const notFound = { error: 'Użytkownik nie znaleziony' };
            if (idemKey)
                await completeIdempotencyKey(idemUser, idemEndpoint, idemKey, 404, notFound);
            return res.status(404).json(notFound);
        }

        const counter = await prisma.order_global_counters.upsert({
            where: { year_kind: { year, kind: STUDNIE_ORDER_KIND } },
            create: { year, kind: STUDNIE_ORDER_KIND, lastNumber: 1 },
            update: { lastNumber: { increment: 1 } }
        });
        const nextNumber = counter.lastNumber;

        const payload = {
            number: formatStudnieOrderNumber(nextNumber, year),
            nextSeq: nextNumber,
            year
        };
        if (idemKey) await completeIdempotencyKey(idemUser, idemEndpoint, idemKey, 200, payload);
        res.json(payload);
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        logger.error('Numbering', 'Błąd serwera', message);
        res.status(500).json({ error: 'Wewnętrzny błąd serwera' });
    }
});

/* ===== GENEROWANIE NUMERU ZLECENIA PRODUKCYJNEGO ===== */

router.post('/claim-production-number/:userId', requireAuth, WRITE_LIMITER, async (req, res) => {
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
        const year = getNumberingYear();
        const user = await prisma.users.findUnique({ where: { id: userId }, select: { id: true } });
        if (!user) return res.status(404).json({ error: 'Użytkownik nie znaleziony' });

        // Pobierz literę roku
        const letterKey = 'year_letter_' + year;
        const letterRow = await prisma.settings.findUnique({
            where: { key: letterKey }
        });
        const yearLetter = letterRow?.value || '?';

        // P0-B: atomowy claim najniższych wolnych numerów z zakresu opiekuna.
        const [nextNumber] = await claimProductionSeqs(userId, year, 1);

        const formatted = formatProductionNumber(yearLetter, nextNumber, year);
        const prodPayload = { number: formatted, nextSeq: nextNumber, yearLetter, year };
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
        if (e instanceof NumberingError) {
            // Domknij klucz błędem, żeby retry nie wisiał w PENDING.
            try {
                const idemKey = idempotencyKeyFrom(req);
                if (idemKey)
                    await completeIdempotencyKey(
                        (req as AuthenticatedRequest).user?.id || '',
                        'POST /api/orders-studnie/claim-production-number',
                        idemKey,
                        e.status,
                        { error: e.message, code: e.code }
                    );
            } catch (idemError) {
                logger.error('Numbering', 'Błąd domykania klucza idempotencji', idemError);
            }
            return res.status(e.status).json({ error: e.message, code: e.code });
        }
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
router.post('/claim-production-numbers/:userId', requireAuth, WRITE_LIMITER, async (req, res) => {
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
        // P2: domknij klucz wynikiem — retry replayuje błąd zamiast wisieć PENDING.
        if (!parsed.success) {
            const tooBig = parsed.error.issues.some((i) => i.code === 'too_big');
            const invalid = tooBig
                ? { error: `Zbyt wiele numerów w jednym żądaniu (max ${CLAIM_RANGE_MAX})` }
                : { error: 'Pole count musi być liczbą całkowitą >= 1' };
            if (idemBulkKey)
                await completeIdempotencyKey(
                    idemBulkUser,
                    idemBulkEndpoint,
                    idemBulkKey,
                    400,
                    invalid
                );
            return res.status(400).json(invalid);
        }
        const count = parsed.data.count;
        const year = getNumberingYear();
        const user = await prisma.users.findUnique({ where: { id: userId }, select: { id: true } });
        if (!user) {
            const notFound = { error: 'Użytkownik nie znaleziony' };
            if (idemBulkKey)
                await completeIdempotencyKey(
                    idemBulkUser,
                    idemBulkEndpoint,
                    idemBulkKey,
                    404,
                    notFound
                );
            return res.status(404).json(notFound);
        }

        const letterKey = 'year_letter_' + year;
        const letterRow = await prisma.settings.findUnique({
            where: { key: letterKey }
        });
        const yearLetter = letterRow?.value || '?';

        const seqs = await claimProductionSeqs(userId, year, count);
        const numbers = seqs.map((seq) => formatProductionNumber(yearLetter, seq, year));
        const bulkPayload = { numbers, seqs, yearLetter, year };
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
        if (e instanceof NumberingError) {
            try {
                const idemKey = idempotencyKeyFrom(req);
                if (idemKey)
                    await completeIdempotencyKey(
                        (req as AuthenticatedRequest).user?.id || '',
                        'POST /api/orders-studnie/claim-production-numbers',
                        idemKey,
                        e.status,
                        { error: e.message, code: e.code }
                    );
            } catch (idemError) {
                logger.error('Numbering', 'Błąd domykania klucza idempotencji', idemError);
            }
            return res.status(e.status).json({ error: e.message, code: e.code });
        }
        const message = e instanceof Error ? e.message : 'Unknown error';
        logger.error('Numbering', 'Błąd serwera', message);
        res.status(500).json({ error: 'Wewnętrzny błąd serwera' });
    }
});

export default router;
