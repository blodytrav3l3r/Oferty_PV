import express from 'express';
import crypto from 'crypto';
import prisma from '../prismaClient';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { WRITE_LIMITER } from '../middleware/rateLimiters';
import { validateData } from '../validators/authSchema';
import { shareCreateSchema, shareRevokeSchema } from '../validators/offerSchemas';
import { canWriteDoc, isValidShareDocumentType, hasShare } from '../utils/ownership';
import { logger } from '../utils/logger';
import { logAudit } from '../services/auditService';

const router = express.Router();
const SHARE_LIMIT = 50;

async function resolveDocOwner(
    documentType: string,
    documentId: string
): Promise<{ userId: string | null; exists: boolean }> {
    switch (documentType) {
        case 'offer': {
            const r = await prisma.offers_rel.findUnique({
                where: { id: documentId },
                select: { userId: true }
            });
            return r ? { userId: r.userId, exists: true } : { userId: null, exists: false };
        }
        case 'offer_studnie': {
            const r = await prisma.offers_studnie_rel.findUnique({
                where: { id: documentId },
                select: { userId: true }
            });
            return r ? { userId: r.userId, exists: true } : { userId: null, exists: false };
        }
        case 'order_rury': {
            const r = await prisma.orders_rury_rel.findUnique({
                where: { id: documentId },
                select: { userId: true }
            });
            return r ? { userId: r.userId, exists: true } : { userId: null, exists: false };
        }
        case 'order_studnie': {
            const r = await prisma.orders_studnie_rel.findUnique({
                where: { id: documentId },
                select: { userId: true }
            });
            return r ? { userId: r.userId, exists: true } : { userId: null, exists: false };
        }
        default:
            return { userId: null, exists: false };
    }
}

// GET /api/shares?documentType&documentId — kto ma dostęp
router.get('/', requireAuth, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const { documentType, documentId } = req.query as {
        documentType?: string;
        documentId?: string;
    };
    if (!documentType || !documentId || !isValidShareDocumentType(String(documentType))) {
        return res.status(400).json({ error: 'Nieprawidłowe documentType lub documentId' });
    }
    const doc = await resolveDocOwner(String(documentType), String(documentId));
    if (!doc.exists) return res.status(404).json({ error: 'Dokument nie istnieje' });
    // tylko jeśli caller ma read (owner/pro/admin lub shared)
    const canRead = (() => {
        if (authReq.user?.role === 'admin') return true;
        if (
            doc.userId &&
            authReq.user &&
            (doc.userId === authReq.user.id ||
                (authReq.user.role === 'pro' && (authReq.user.subUsers || []).includes(doc.userId)))
        )
            return true;
        return false;
    })();
    // pozwól też odbiorcy zobaczyć shares swojego dokumentu (read via share)
    let allowed = canRead;
    if (!allowed && authReq.user) {
        allowed = await hasShare(authReq.user.id, String(documentType), String(documentId));
        // jeśli ma share, to może zobaczyć listę — ale tylko wtedy gdy jest odbiorcą? Pozwól właścicielowi i odbiorcom
        // Dla prostoty: każdy kto ma read (share) może zobaczyć listę
    }
    if (!allowed && authReq.user?.role !== 'admin') {
        // jeszcze sprawdź owner globalnie — jeśli nie ma read, to 403
        // ale pozwól właścicielowi (już canRead) — więc tu 403
        return res.status(403).json({ error: 'Brak uprawnień do podglądu udostępnień' });
    }

    const shares = await prisma.document_shares.findMany({
        where: { documentType: String(documentType), documentId: String(documentId) },
        orderBy: { createdAt: 'desc' }
    });
    const canShare =
        !!authReq.user && (authReq.user.role === 'admin' || canWriteDoc(authReq.user, doc.userId));
    res.json({ data: shares, canShare });
});

// POST /api/shares — udostępnij
router.post('/', requireAuth, WRITE_LIMITER, validateData(shareCreateSchema), async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const { documentType, documentId, userIds } = req.body as {
        documentType: string;
        documentId: string;
        userIds: string[];
    };

    const doc = await resolveDocOwner(documentType, documentId);
    if (!doc.exists) return res.status(404).json({ error: 'Dokument nie istnieje' });
    if (!doc.userId)
        return res.status(400).json({ error: 'Dokument bez właściciela — nie można udostępnić' });

    if (
        !authReq.user ||
        (!canWriteDoc(authReq.user, doc.userId) && authReq.user.role !== 'admin')
    ) {
        return res.status(403).json({ error: 'Brak uprawnień do udostępniania tego dokumentu' });
    }

    const uniqueIds = [...new Set(userIds.map(String).filter(Boolean))];
    if (uniqueIds.includes(authReq.user!.id)) {
        return res.status(400).json({ error: 'Nie możesz udostępnić dokumentu samemu sobie' });
    }
    // sprawdź czy wszyscy istnieją
    const users = await prisma.users.findMany({
        where: { id: { in: uniqueIds } },
        select: { id: true, role: true }
    });
    const foundIds = new Set(users.map((u) => u.id));
    const missing = uniqueIds.filter((id) => !foundIds.has(id));
    if (missing.length > 0)
        return res.status(400).json({ error: `Nieznani użytkownicy: ${missing.join(', ')}` });
    // user może udostępniać tylko innym userom — admin/pro mają dostęp zawsze
    if (authReq.user!.role === 'user') {
        const nonUserTargets = users.filter((u) => u.role !== 'user').map((u) => u.id);
        if (nonUserTargets.length > 0) {
            return res
                .status(400)
                .json({ error: 'Możesz udostępniać tylko innym użytkownikom z rolą USER' });
        }
    }

    // Zasada 1: limit 50 aktywnych na dokument — atomowo
    const currentCount = await prisma.document_shares.count({
        where: { documentType, documentId }
    });
    const existing = await prisma.document_shares.findMany({
        where: { documentType, documentId, sharedWithUserId: { in: uniqueIds } },
        select: { sharedWithUserId: true }
    });
    const already = new Set(existing.map((e) => e.sharedWithUserId));
    const newIds = uniqueIds.filter((id) => !already.has(id));
    if (currentCount + newIds.length > SHARE_LIMIT) {
        return res.status(400).json({
            error: `Limit ${SHARE_LIMIT} udostępnień na dokument przekroczony (${currentCount}/${SHARE_LIMIT}, próba +${newIds.length})`
        });
    }
    if (newIds.length === 0) {
        const shares = await prisma.document_shares.findMany({
            where: { documentType, documentId }
        });
        return res.json({ ok: true, data: shares, added: 0 });
    }

    const now = new Date().toISOString();
    const toCreate = newIds.map((uid) => ({
        id: crypto.randomUUID(),
        documentType,
        documentId,
        ownerId: doc.userId!,
        sharedWithUserId: uid,
        permission: 'read',
        createdAt: now,
        createdBy: authReq.user!.id
    }));
    await prisma.document_shares.createMany({ data: toCreate });

    logAudit('document_share', documentId, authReq.user!.id, 'create', {
        documentType,
        sharedWithUserIds: newIds
    });
    logger.info(
        'Shares',
        `Udostępniono ${documentType} ${documentId} → ${newIds.join(', ')} przez ${authReq.user!.username}`
    );

    const shares = await prisma.document_shares.findMany({ where: { documentType, documentId } });
    res.json({ ok: true, data: shares, added: newIds.length });
});

// POST /api/shares/revoke — batch revoke po userIds (musi być przed /:id)
router.post(
    '/revoke',
    requireAuth,
    WRITE_LIMITER,
    validateData(shareRevokeSchema),
    async (req, res) => {
        const authReq = req as AuthenticatedRequest;
        const { documentType, documentId, userIds } = req.body as {
            documentType: string;
            documentId: string;
            userIds: string[];
        };
        const doc = await resolveDocOwner(documentType, documentId);
        if (!doc.exists) return res.status(404).json({ error: 'Dokument nie istnieje' });
        const isOwner =
            !!authReq.user &&
            !!doc.userId &&
            (doc.userId === authReq.user.id ||
                authReq.user.role === 'admin' ||
                (authReq.user.role === 'pro' &&
                    (authReq.user.subUsers || []).includes(doc.userId)));
        const isAdmin = authReq.user?.role === 'admin';
        if (!isOwner && !isAdmin)
            return res.status(403).json({ error: 'Brak uprawnień do cofnięcia' });

        // user może cofać tylko udostępnienia dla innych userów
        if (authReq.user?.role === 'user' && userIds.length > 0) {
            const targets = await prisma.users.findMany({
                where: { id: { in: userIds } },
                select: { role: true }
            });
            if (targets.some((u) => u.role !== 'user')) {
                return res.status(400).json({
                    error: 'Możesz cofać udostępnienia tylko dla użytkowników z rolą USER'
                });
            }
        }

        await prisma.document_shares.deleteMany({
            where: { documentType, documentId, sharedWithUserId: { in: userIds } }
        });
        logAudit('document_share', documentId, authReq.user!.id, 'revoke_batch', {
            documentType,
            userIds
        });
        const shares = await prisma.document_shares.findMany({
            where: { documentType, documentId }
        });
        res.json({ ok: true, data: shares });
    }
);

// DELETE /api/shares/:id — revoke pojedynczy share
router.delete('/:id', requireAuth, WRITE_LIMITER, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const { id } = req.params;
    const share = await prisma.document_shares.findUnique({ where: { id } });
    if (!share) return res.status(404).json({ error: 'Udostępnienie nie istnieje' });

    const doc = await resolveDocOwner(share.documentType, share.documentId);
    const isOwner =
        !!authReq.user &&
        !!doc.userId &&
        (doc.userId === authReq.user.id ||
            authReq.user.role === 'admin' ||
            (authReq.user.role === 'pro' && (authReq.user.subUsers || []).includes(doc.userId)));
    const isSelfRevoke = !!authReq.user && share.sharedWithUserId === authReq.user.id;
    const isAdmin = authReq.user?.role === 'admin';
    if (!isOwner && !isSelfRevoke && !isAdmin) {
        return res.status(403).json({ error: 'Brak uprawnień do cofnięcia udostępnienia' });
    }
    await prisma.document_shares.delete({ where: { id } });
    logAudit('document_share', share.documentId, authReq.user!.id, 'revoke', {
        shareId: id,
        documentType: share.documentType,
        sharedWithUserId: share.sharedWithUserId
    });
    res.json({ ok: true });
});

export default router;
