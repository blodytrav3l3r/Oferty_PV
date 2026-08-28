import express from 'express';
import prisma from '../prismaClient';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';

import { validateData } from '../validators/authSchema';
import { WRITE_LIMITER } from '../middleware/rateLimiters';
import { clientsBatchSchema } from '../validators/offerSchemas';
import { logger } from '../utils/logger';

const router = express.Router();

const writeClientsLimiter = WRITE_LIMITER;

// GET /api/clients - Pobiera wszystkich klientów (wspólna baza, widoczna dla każdego zalogowanego użytkownika)
router.get('/', requireAuth, async (_req, res) => {
    try {
        const clients: Array<{
            id: string;
            userId: string | null;
            name: string | null;
            nip: string | null;
            address: string | null;
            email: string | null;
            phone: string | null;
            contact: string | null;
            clientNumber: string | null;
            createdAt: string | null;
            updatedAt: string | null;
        }> = await prisma.clients_rel.findMany();

        // Normalizuj pola dat — konwertuj numeryczne timestampy na stringi ISO
        const normalized = clients.map((c) => ({
            ...c,
            createdAt:
                c.createdAt && /^\d{10,}$/.test(String(c.createdAt))
                    ? new Date(parseInt(String(c.createdAt), 10)).toISOString()
                    : c.createdAt,
            updatedAt:
                c.updatedAt && /^\d{10,}$/.test(String(c.updatedAt))
                    ? new Date(parseInt(String(c.updatedAt), 10)).toISOString()
                    : c.updatedAt
        }));

        res.json({ data: normalized });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        logger.error('Clients', 'GET /api/clients błąd', message);
        res.status(500).json({ error: 'Wewnętrzny błąd serwera' });
    }
});

// PUT /api/clients - Synchronizacja klientów
router.put(
    '/',
    requireAuth,
    writeClientsLimiter,
    validateData(clientsBatchSchema),
    async (req, res) => {
        const authReq = req as AuthenticatedRequest;
        try {
            const arr = req.body.data || [];
            const userId = authReq.user?.id;

            const now = new Date().toISOString();
            const upserted: { id: string }[] = [];

            // Wspólna baza klientów — wszyscy widzą i edytują wszystkich (Wariant A)
            await prisma.$transaction(async (tx) => {
                const existingClients = await tx.$queryRaw`SELECT id FROM clients_rel`;
                const existingIds = (existingClients as { id: string }[]).map((c) => c.id);
                const incomingIds = arr.map((c: { id?: string }) => c.id).filter(Boolean);
                const toDelete = existingIds.filter((id) => !incomingIds.includes(id));

                if (toDelete.length > 0) {
                    for (const id of toDelete) {
                        await tx.$executeRaw`DELETE FROM clients_rel WHERE id = ${id}`;
                    }
                }

                for (const c of arr) {
                    let docId = c.id;
                    if (!docId) {
                        docId =
                            Date.now().toString() + '_' + Math.random().toString(36).substr(2, 5);
                    }

                    // Zawsze normalizuj createdAt do stringa ISO 8601
                    let parsedDate = now;
                    if (c.createdAt != null && c.createdAt !== '') {
                        const num = Number(c.createdAt);
                        if (!isNaN(num) && num > 0) {
                            // Obsłuż zarówno timestampy w sekundach, jak i milisekundach
                            const ms = num > 1e12 ? num : num * 1000;
                            parsedDate = new Date(ms).toISOString();
                        } else {
                            const d = new Date(c.createdAt);
                            if (!isNaN(d.getTime())) parsedDate = d.toISOString();
                        }
                    }

                    await tx.$queryRaw`
                    INSERT INTO clients_rel (id, userId, name, nip, address, contact, clientNumber, phone, email, createdAt, updatedAt)
                    VALUES (${docId}, ${userId}, ${c.name || ''}, ${c.nip || ''}, ${c.address || ''}, ${c.contact || ''}, ${c.clientNumber || ''}, ${c.phone || ''}, ${c.email || ''}, ${parsedDate}, ${now})
                    ON CONFLICT(id) DO UPDATE SET
                        userId = ${userId},
                        name = ${c.name || ''},
                        nip = ${c.nip || ''},
                        address = ${c.address || ''},
                        contact = ${c.contact || ''},
                        clientNumber = ${c.clientNumber || ''},
                        phone = ${c.phone || ''},
                        email = ${c.email || ''},
                        updatedAt = ${now}
                    RETURNING id
                `;
                    upserted.push({ id: docId });
                }
            });

            res.json({ ok: true, count: upserted.length });
        } catch (e: unknown) {
            logger.error('Clients', 'PUT /api/clients błąd', e);
            const message = e instanceof Error ? e.message : 'Unknown error';
            logger.error('Clients', 'Błąd serwera', message);
            res.status(500).json({ error: 'Wewnętrzny błąd serwera' });
        }
    }
);

export default router;
