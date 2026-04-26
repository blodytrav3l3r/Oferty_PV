import express from 'express';
import prisma from '../prismaClient';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { buildRoleWhereClause } from '../utils/roleFilter';
import { validateData } from '../validators/authSchema';
import { clientsBatchSchema } from '../validators/offerSchemas';

const router = express.Router();

// GET /api/clients - Pobiera klientów z bazy użytkownika
router.get('/', requireAuth, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const roleClause = authReq.user ? buildRoleWhereClause(authReq.user) : undefined;
        const clients = await prisma.clients_rel.findMany({
            where: roleClause
        });

        res.json({ data: clients });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        res.status(500).json({ error: message });
    }
});

// PUT /api/clients - Synchronizacja klientów
router.put('/', requireAuth, validateData(clientsBatchSchema), async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const arr = req.body.data || [];

        for (const c of arr) {
            let docId = c.id;
            if (!docId) {
                docId = Date.now().toString() + '_' + Math.random().toString(36).substr(2, 5);
            }

            await prisma.clients_rel.upsert({
                where: { id: docId },
                create: {
                    id: docId,
                    userId: authReq.user?.id,
                    name: c.name || '',
                    nip: c.nip || '',
                    address: c.address || '',
                    contact: c.contact || '',
                    phone: c.phone || '',
                    email: c.email || '',
                    createdAt: c.createdAt || new Date().toISOString()
                },
                update: {
                    userId: authReq.user?.id,
                    name: c.name || '',
                    nip: c.nip || '',
                    address: c.address || '',
                    contact: c.contact || '',
                    phone: c.phone || '',
                    email: c.email || '',
                    createdAt: c.createdAt || new Date().toISOString()
                }
            });
        }

        res.json({ ok: true });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        res.status(500).json({ error: message });
    }
});

export default router;
