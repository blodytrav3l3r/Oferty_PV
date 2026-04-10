import express from 'express';
import prisma from '../prismaClient';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';

const router = express.Router();

// GET /api/clients - Pobiera klientów z bazy użytkownika
router.get('/', requireAuth as any, async (req, res) => {
  const authReq = req as AuthenticatedRequest;
  try {
    let clients: any[];
    if (authReq.user?.role === 'admin') {
      clients = await prisma.clients_rel.findMany();
    } else if (authReq.user?.role === 'pro') {
      const allowedIds = [authReq.user?.id, ...(authReq.user?.subUsers || [])];
      clients = await prisma.clients_rel.findMany({
        where: { userId: { in: allowedIds } },
      });
    } else {
      clients = await prisma.clients_rel.findMany({
        where: { userId: authReq.user?.id },
      });
    }

    res.json({ data: clients });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/clients - Synchronizacja klientów
router.put('/', requireAuth as any, async (req, res) => {
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
          createdAt: c.createdAt || new Date().toISOString(),
        },
        update: {
          userId: authReq.user?.id,
          name: c.name || '',
          nip: c.nip || '',
          address: c.address || '',
          contact: c.contact || '',
          phone: c.phone || '',
          email: c.email || '',
          createdAt: c.createdAt || new Date().toISOString(),
        },
      });
    }

    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;