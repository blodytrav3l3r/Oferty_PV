/**
 * Twarda blokada edycji: 1 dokument = 1 uzytkownik.
 * acquire przy otwarciu, heartbeat 60 s, release przy zamknieciu.
 * Drugi uzytkownik dostaje 423 + holder (tylko niezbedne dane).
 */
import express from 'express';
import prisma from '../prismaClient';
import { requireAuth, requireAdmin, AuthenticatedRequest } from '../middleware/auth';
import { WRITE_LIMITER } from '../middleware/rateLimiters';
import { validateData } from '../validators/authSchema';
import { docLockBodySchema, docLockParamsSchema } from '../validators/lockSchemas';
import { logger } from '../utils/logger';
import {
    acquireDocLock,
    heartbeatDocLock,
    releaseDocLock,
    forceAcquireDocLock,
    mapDocLockConflict,
    DocLockType
} from '../utils/docLocks';

const router = express.Router();
const limiter = WRITE_LIMITER;

function holderOf(lock: { userId: string | null; userName: string | null; lockedAt: string }) {
    return { userId: lock.userId, userName: lock.userName, lockedAt: lock.lockedAt };
}

router.post('/acquire', requireAuth, limiter, validateData(docLockBodySchema), async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const { docType, docId } = req.body as { docType: DocLockType; docId: string };
        const { lock } = await acquireDocLock(prisma, { docType, docId, user: authReq.user! });
        res.json({ ok: true, lock: holderOf(lock) });
    } catch (e: unknown) {
        if (mapDocLockConflict(res, e)) return;
        const message = e instanceof Error ? e.message : 'Unknown error';
        logger.error('Locks', 'Blad acquire', message);
        res.status(500).json({ error: 'Wewnetrzny blad serwera' });
    }
});

router.post(
    '/heartbeat',
    requireAuth,
    limiter,
    validateData(docLockBodySchema),
    async (req, res) => {
        const authReq = req as AuthenticatedRequest;
        try {
            const { docType, docId } = req.body as { docType: DocLockType; docId: string };
            const { lock } = await heartbeatDocLock(prisma, {
                docType,
                docId,
                user: authReq.user!
            });
            res.json({ ok: true, lock: holderOf(lock) });
        } catch (e: unknown) {
            if (mapDocLockConflict(res, e)) return;
            const message = e instanceof Error ? e.message : 'Unknown error';
            logger.error('Locks', 'Blad heartbeat', message);
            res.status(500).json({ error: 'Wewnetrzny blad serwera' });
        }
    }
);

router.post('/release', requireAuth, limiter, validateData(docLockBodySchema), async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const { docType, docId } = req.body as { docType: DocLockType; docId: string };
        const { released } = await releaseDocLock(prisma, { docType, docId, user: authReq.user! });
        res.json({ ok: true, released });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        logger.error('Locks', 'Blad release', message);
        res.status(500).json({ error: 'Wewnetrzny blad serwera' });
    }
});

// Force-acquire admina: JEDEN upsert (bez okna DELETE->ACQUIRE).
router.post(
    '/force',
    requireAuth,
    requireAdmin,
    limiter,
    validateData(docLockBodySchema),
    async (req, res) => {
        const authReq = req as AuthenticatedRequest;
        try {
            const { docType, docId } = req.body as { docType: DocLockType; docId: string };
            const { lock } = await forceAcquireDocLock(prisma, {
                docType,
                docId,
                user: authReq.user!
            });
            res.json({ ok: true, lock: holderOf(lock) });
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : 'Unknown error';
            logger.error('Locks', 'Blad force', message);
            res.status(500).json({ error: 'Wewnetrzny blad serwera' });
        }
    }
);

router.get('/:docType/:docId', requireAuth, async (req, res) => {
    try {
        const parsed = docLockParamsSchema.safeParse(req.params);
        if (!parsed.success) return res.status(400).json({ error: 'Bledny typ lub ID dokumentu' });
        const { docType, docId } = parsed.data;
        const lock = await prisma.doc_locks.findUnique({
            where: { docType_docId: { docType, docId } }
        });
        if (!lock) return res.json({ ok: true, locked: false });
        res.json({
            ok: true,
            locked: true,
            lock: holderOf(
                lock as unknown as {
                    userId: string | null;
                    userName: string | null;
                    lockedAt: string;
                }
            )
        });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        logger.error('Locks', 'Blad status', message);
        res.status(500).json({ error: 'Wewnetrzny blad serwera' });
    }
});

export default router;
