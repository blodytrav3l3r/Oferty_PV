import express from 'express';
import prisma from '../../prismaClient';
import { logAudit } from '../../db';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import crypto from 'crypto';
import { buildRoleWhereClause } from '../../utils/roleFilter';
import { logger } from '../../utils/logger';
import { validateData } from '../../validators/authSchema';
import { createRateLimiter } from '../../middleware/rateLimiter';
import {
    OfferMapped
} from '../../types/models';
import {
    offersBatchSchema,
    offersStudnieBatchSchema
} from '../../validators/offerSchemas';

const router = express.Router();
const uuidv4 = crypto.randomUUID.bind(crypto);

// Rate limiter dla operacji zapisu ofert (60 zapytań na minutę)
const writeOffersLimiter = createRateLimiter({
    windowMs: 60 * 1000,
    maxHits: 60,
    message: 'Zbyt wiele operacji na ofertach. Odczekaj minutę.'
});

/* ===== OFERTY RURY — GET ===== */

router.get('/', requireAuth, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const roleClause = authReq.user ? buildRoleWhereClause(authReq.user) : undefined;
        const offers = await prisma.offers_rel.findMany({
            where: roleClause
        });

        const mapped: OfferMapped[] = [];
        for (const offer of offers) {
            const itemsRaw = await prisma.offer_items_rel.findMany({
                where: { offerId: offer.id }
            });
            const items = itemsRaw.map((i) => ({
                id: i.id,
                productId: i.productId,
                quantity: i.quantity,
                discount: i.discount,
                price: i.price,
                unitPrice: i.price ?? 0
            }));

            mapped.push({
                id: offer.id,
                type: 'offer',
                userId: offer.userId,
                title: `Oferta ${offer.offer_number || offer.id}`,
                price: items.reduce((sum, i) => sum + (i.price ?? 0) * (i.quantity ?? 0), 0),
                status: offer.state === 'final' ? 'active' : 'draft',
                createdAt: offer.createdAt?.toISOString(),
                updatedAt: offer.updatedAt?.toISOString() || offer.createdAt?.toISOString(),
                lastEditedBy: offer.userId,
                items: items,
                transportCost: offer.transportCost || 0,
                history: JSON.parse(offer.history || '[]')
            });
        }

        res.json({ data: mapped });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        res.status(500).json({ error: message });
    }
});

/* ===== OFERTY STUDNIE — GET ===== */

router.get('/studnie', requireAuth, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        // Użyj raw query aby obsłużyć błędne daty w bazie
        let whereSql = '';
        if (authReq.user?.role !== 'admin' && authReq.user) {
            if (authReq.user.role === 'pro') {
                const allowedIds = [authReq.user.id, ...(authReq.user.subUsers || [])].map(id => `'${id}'`).join(',');
                whereSql = `WHERE "userId" IN (${allowedIds})`;
            } else {
                whereSql = `WHERE "userId" = '${authReq.user.id}'`;
            }
        }

        logger.debug('Offers', 'GET /studnie', { userId: authReq.user?.id, role: authReq.user?.role, whereSql });

        const offers = await prisma.$queryRawUnsafe<
            Array<{
                id: string;
                userId: string | null;
                offer_number: string | null;
                state: string | null;
                data: string | null;
                history: string | null;
                createdAt: string | null;
                updatedAt: string | null;
            }>
        >(`SELECT id, "userId", "offer_number", state, data, history,
            CASE WHEN "createdAt" GLOB '[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'
                THEN datetime(CAST("createdAt" AS INTEGER)/1000, 'unixepoch')
                ELSE "createdAt" END as "createdAt",
            CASE WHEN "updatedAt" GLOB '[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'
                THEN datetime(CAST("updatedAt" AS INTEGER)/1000, 'unixepoch')
                ELSE "updatedAt" END as "updatedAt"
         FROM offers_studnie_rel ${whereSql}`);

        const mapped = offers.map((offer) => {
            let parsedData: Record<string, unknown> = {};
            try {
                if (offer.data) parsedData = JSON.parse(offer.data);
            } catch (_e) {}

            return {
                id: offer.id,
                type: 'studnia_oferta',
                userId: offer.userId,
                title: `Oferta Studnia ${offer.offer_number || offer.id}`,
                price: parsedData.totalPrice || 0,
                status: offer.state === 'final' ? 'active' : 'draft',
                createdAt: offer.createdAt || new Date().toISOString(),
                updatedAt: offer.updatedAt || offer.createdAt || new Date().toISOString(),
                lastEditedBy: offer.userId,
                data: parsedData,
                history: JSON.parse(offer.history || '[]')
            };
        });

        logger.debug('Offers', 'GET /studnie wynik', { count: mapped.length, ids: mapped.map(o => o.id) });
        res.json({ data: mapped });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        logger.error('Offers', 'Błąd GET /studnie', message);
        res.status(500).json({ error: message });
    }
});

/* ===== OFERTA RURY — GET BY ID ===== */

router.get('/:id', requireAuth, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const { id } = req.params;

        // Unikaj kolizji z sub-ścieżkami (np. /studnie)
        if (id === 'studnie') return res.status(400).json({ error: 'Nieprawidłowe ID oferty' });

        // Jeśli ID zaczyna się od 'offer_studnie_', to oferta studni
        if (id.startsWith('offer_studnie_')) {
            // Użyj raw query aby obsłużyć błędne daty w bazie
            const offers = await prisma.$queryRawUnsafe<
                Array<{
                    id: string;
                    userId: string | null;
                    offer_number: string | null;
                    state: string | null;
                    data: string | null;
                    history: string | null;
                    createdAt: string | null;
                    updatedAt: string | null;
                }>
            >(`SELECT id, "userId", "offer_number", state, data, history,
                CASE WHEN "createdAt" GLOB '[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'
                    THEN datetime(CAST("createdAt" AS INTEGER)/1000, 'unixepoch')
                    ELSE "createdAt" END as "createdAt",
                CASE WHEN "updatedAt" GLOB '[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'
                    THEN datetime(CAST("updatedAt" AS INTEGER)/1000, 'unixepoch')
                    ELSE "updatedAt" END as "updatedAt"
             FROM offers_studnie_rel WHERE id = '${id}'`);
            const offer = offers[0];
            if (!offer) return res.status(404).json({ error: 'Oferta studni nie istnieje' });

            // Weryfikacja uprawnień odczytu
            if (authReq.user?.role !== 'admin' && offer.userId !== authReq.user?.id) {
                return res.status(403).json({ error: 'Brak uprawnień do odczytu tej oferty' });
            }

            let parsedData: Record<string, unknown> = {};
            try {
                if (offer.data) parsedData = JSON.parse(offer.data);
            } catch (_e) {}

            return res.json({
                data: {
                    id: offer.id,
                    type: 'studnia_oferta',
                    userId: offer.userId,
                    title: `Oferta Studnia ${offer.offer_number || offer.id}`,
                    price: (parsedData.totalPrice as number) || 0,
                    status: offer.state === 'final' ? 'active' : 'draft',
                    createdAt: offer.createdAt || new Date().toISOString(),
                    updatedAt: offer.updatedAt || offer.createdAt || new Date().toISOString(),
                    lastEditedBy: offer.userId,
                    data: parsedData,
                    history: JSON.parse(offer.history || '[]')
                }
            });
        }

        // Standardowa oferta rur
        const offer = await prisma.offers_rel.findUnique({
            where: { id }
        });
        if (!offer) return res.status(404).json({ error: 'Oferta nie istnieje' });

        // Weryfikacja uprawnień odczytu
        if (authReq.user?.role !== 'admin' && offer.userId !== authReq.user?.id) {
            return res.status(403).json({ error: 'Brak uprawnień do odczytu tej oferty' });
        }

        const itemsRaw = await prisma.offer_items_rel.findMany({
            where: { offerId: offer.id }
        });
        const items = itemsRaw.map((i) => ({
            id: i.id,
            productId: i.productId,
            quantity: i.quantity,
            discount: i.discount,
            price: i.price,
            unitPrice: i.price
        }));

        res.json({
            data: {
                id: offer.id,
                type: 'offer',
                userId: offer.userId,
                title: `Oferta ${offer.offer_number || offer.id}`,
                price: items.reduce((sum, i) => sum + (i.price ?? 0) * (i.quantity ?? 0), 0),
                status: offer.state === 'final' ? 'active' : 'draft',
                createdAt: offer.createdAt,
                updatedAt: offer.updatedAt || offer.createdAt,
                lastEditedBy: offer.userId,
                items: items,
                transportCost: offer.transportCost || 0,
                history: JSON.parse(offer.history || '[]')
            }
        });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        res.status(500).json({ error: message });
    }
});

/* ===== OFERTA STUDNIA — GET BY ID ===== */

router.get('/studnie/:id', requireAuth, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const { id } = req.params;

        // Użyj raw query aby obsłużyć błędne daty w bazie
        const offers = await prisma.$queryRawUnsafe<
            Array<{
                id: string;
                userId: string | null;
                offer_number: string | null;
                state: string | null;
                data: string | null;
                history: string | null;
                createdAt: string | null;
                updatedAt: string | null;
            }>
        >(`SELECT id, "userId", "offer_number", state, data, history,
            CASE WHEN "createdAt" GLOB '[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'
                THEN datetime(CAST("createdAt" AS INTEGER)/1000, 'unixepoch')
                ELSE "createdAt" END as "createdAt",
            CASE WHEN "updatedAt" GLOB '[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'
                THEN datetime(CAST("updatedAt" AS INTEGER)/1000, 'unixepoch')
                ELSE "updatedAt" END as "updatedAt"
         FROM offers_studnie_rel WHERE id = '${id}'`);
        const offer = offers[0];
        if (!offer) return res.status(404).json({ error: 'Oferta studni nie istnieje' });

        // Weryfikacja uprawnień odczytu
        if (authReq.user?.role !== 'admin' && offer.userId !== authReq.user?.id) {
            return res.status(403).json({ error: 'Brak uprawnień do odczytu tej oferty' });
        }

        let parsedData: Record<string, unknown> = {};
        try {
            if (offer.data) parsedData = JSON.parse(offer.data);
        } catch (_e) {}

        res.json({
            data: {
                id: offer.id,
                type: 'studnia_oferta',
                userId: offer.userId,
                title: `Oferta Studnia ${offer.offer_number || offer.id}`,
                price: (parsedData.totalPrice as number) || 0,
                status: offer.state === 'final' ? 'active' : 'draft',
                createdAt: offer.createdAt || new Date().toISOString(),
                updatedAt: offer.updatedAt || offer.createdAt || new Date().toISOString(),
                lastEditedBy: offer.userId,
                data: parsedData,
                history: JSON.parse(offer.history || '[]')
            }
        });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        res.status(500).json({ error: message });
    }
});

/* ===== OFERTY RURY — POST (pojedyncza) ===== */

router.post('/', requireAuth, writeOffersLimiter, validateData(offersBatchSchema), async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const incoming = req.body.data || [req.body];

        const results: Record<string, unknown>[] = [];
        for (const o of incoming) {
            let docId = o.id;
            if (!docId) docId = uuidv4();

            // Migawka bieżącego stanu dla historii
            let newHistory: unknown[] = [];
            const old = await prisma.offers_rel.findUnique({
                where: { id: docId }
            });
            if (old) {
                try {
                    newHistory = JSON.parse(old.history || '[]');
                } catch (_e) {}
                const oldItems = await prisma.offer_items_rel.findMany({
                    where: { offerId: docId }
                });
                const snapshot = {
                    updatedAt: old.updatedAt || old.createdAt,
                    state: old.state,
                    transportCost: old.transportCost,
                    items: oldItems.map((i) => ({
                        productId: i.productId,
                        quantity: i.quantity,
                        discount: i.discount,
                        price: i.price
                    }))
                };
                newHistory.unshift(snapshot);
                if (newHistory.length > 5) newHistory = newHistory.slice(0, 5);

                logAudit(
                    'offer',
                    docId,
                    authReq.user?.id || '',
                    'update',
                    {
                        state: o.status === 'active' ? 'final' : 'draft',
                        transportCost: o.transportCost,
                        items: o.items
                    },
                    snapshot
                );
            } else {
                logAudit('offer', docId, authReq.user?.id || '', 'create', {
                    state: o.status === 'active' ? 'final' : 'draft',
                    transportCost: o.transportCost,
                    items: o.items
                });
            }

            const state = o.status === 'active' ? 'final' : 'draft';
            // Konwersja createdAt - obsługa: timestamp number/string, Date object, ISO string
            const created = (() => {
                const raw = o.createdAt;
                if (typeof raw === 'number') return new Date(raw).toISOString();
                if (raw instanceof Date) return raw.toISOString();
                if (typeof raw === 'string') {
                    if (/^\d{13}$/.test(raw)) return new Date(Number(raw)).toISOString();
                    return raw;
                }
                return new Date().toISOString();
            })();
            const updated = new Date().toISOString();
            const offerNumber = o.offer_number || o.number || '';

            await prisma.offers_rel.upsert({
                where: { id: docId },
                create: {
                    id: docId,
                    userId: o.userId || authReq.user?.id,
                    offer_number: offerNumber,
                    state: state,
                    createdAt: created,
                    updatedAt: updated,
                    transportCost: o.transportCost || 0,
                    history: JSON.stringify(newHistory)
                },
                update: {
                    userId: o.userId || authReq.user?.id,
                    offer_number: offerNumber,
                    state: state,
                    updatedAt: updated,
                    transportCost: o.transportCost || 0,
                    history: JSON.stringify(newHistory)
                }
            });

            // Usuń stare elementy i wstaw nowe
            await prisma.offer_items_rel.deleteMany({
                where: { offerId: docId }
            });
            const items = o.items || [];
            for (const item of items) {
                const itemId = item.id || uuidv4();
                const itemPrice = item.unitPrice !== undefined ? item.unitPrice : item.price || 0;
                await prisma.offer_items_rel.create({
                    data: {
                        id: itemId,
                        offerId: docId,
                        productId: item.productId,
                        quantity: item.quantity || 0,
                        discount: item.discount || 0,
                        price: itemPrice
                    }
                });
            }
            results.push({ id: docId, ok: true });
        }

        logger.info(
            'Offers',
            `Zapisano ${results.length} ofert rury przez ${authReq.user?.username}`
        );
        res.json({ ok: true, results });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        logger.error('Offers', 'Błąd POST offers', message);
        res.status(500).json({ error: message });
    }
});

/* ===== OFERTY STUDNIE — POST (pojedyncza) ===== */

router.post('/studnie', requireAuth, writeOffersLimiter, validateData(offersStudnieBatchSchema), async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const incoming = req.body.data || [req.body];

        const results: Record<string, unknown>[] = [];
        for (const o of incoming) {
            let docId = o.id;
            if (!docId) docId = uuidv4();

            let newHistory: unknown[] = [];
            // Użyj raw query aby obsłużyć błędne daty w bazie
            const oldRows = await prisma.$queryRawUnsafe<
                Array<{ history: string | null; data: string | null; state: string | null }>
            >(`SELECT history, data, state FROM offers_studnie_rel WHERE id = '${docId}'`);
            const old = oldRows[0];
            if (old) {
                try {
                    newHistory = JSON.parse(old.history || '[]');
                } catch (_e) {}
                const snapshot = {
                    timestamp: new Date().toISOString(),
                    state: old.state,
                    data: JSON.parse(old.data || '{}')
                };
                newHistory.unshift(snapshot);
                if (newHistory.length > 5) newHistory = newHistory.slice(0, 5);

                logAudit(
                    'studnia_oferta',
                    docId,
                    authReq.user?.id || '',
                    'update',
                    o,
                    JSON.parse(old.data || '{}')
                );
            } else {
                logAudit('studnia_oferta', docId, authReq.user?.id || '', 'create', o);
            }

            const state = o.status === 'active' ? 'final' : 'draft';
            // Konwersja createdAt - obsługa: timestamp number/string, Date object, ISO string
            const created = (() => {
                const raw = o.createdAt;
                if (typeof raw === 'number') return new Date(raw).toISOString();
                if (raw instanceof Date) return raw.toISOString();
                if (typeof raw === 'string') {
                    if (/^\d{13}$/.test(raw)) return new Date(Number(raw)).toISOString();
                    if (/^\d+$/.test(raw)) return new Date(Number(raw)).toISOString(); // dowolna liczba
                    return raw;
                }
                return new Date().toISOString();
            })();
            const updated = new Date().toISOString();
            const offerNumber = o.number || o.offer_number || '';
            const userId = o.userId || authReq.user?.id || '';
            const dataStr = JSON.stringify(o).replace(/'/g, "''");
            const historyStr = JSON.stringify(newHistory).replace(/'/g, "''");

            // Użyj raw query aby obsłużyć błędne daty w bazie
            // Najpierw spróbuj UPDATE, potem INSERT jeśli nie istnieje
            const updateResult = await prisma.$executeRawUnsafe(
                `UPDATE offers_studnie_rel SET "userId" = '${userId}', "offer_number" = '${offerNumber}', ` +
                `state = '${state}', "updatedAt" = '${updated}', data = '${dataStr}', history = '${historyStr}' ` +
                `WHERE id = '${docId}'`
            );
            // Jeśli nic nie zaktualizowano (brak rekordu), to INSERT
            if (updateResult === 0) {
                await prisma.$executeRawUnsafe(
                    `INSERT INTO offers_studnie_rel (id, "userId", "offer_number", state, "createdAt", "updatedAt", data, history) ` +
                    `VALUES ('${docId}', '${userId}', '${offerNumber}', '${state}', '${created}', '${updated}', '${dataStr}', '${historyStr}')`
                );
            }
            results.push({ id: docId, ok: true });
        }

        logger.info(
            'Offers',
            `Zapisano ${results.length} ofert studnie przez ${authReq.user?.username}`
        );
        res.json({ ok: true, results });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        logger.error('Offers', 'Błąd POST offers/studnie', message);
        res.status(500).json({ error: message });
    }
});

/* ===== OFERTY RURY — PUT (zbiorczo) ===== */

router.put('/', requireAuth, writeOffersLimiter, validateData(offersBatchSchema), async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const incoming = req.body.data || [];

        for (const o of incoming) {
            let docId = o.id;
            if (!docId) {
                docId = Date.now().toString() + '_' + Math.random().toString(36).substr(2, 5);
            }

            const state = o.status === 'active' ? 'final' : 'draft';
            // Konwersja createdAt - obsługa: timestamp number/string, Date object, ISO string
            const created = (() => {
                const raw = o.createdAt;
                if (typeof raw === 'number') return new Date(raw).toISOString();
                if (raw instanceof Date) return raw.toISOString();
                if (typeof raw === 'string') {
                    if (/^\d{13}$/.test(raw)) return new Date(Number(raw)).toISOString();
                    return raw;
                }
                return new Date().toISOString();
            })();

            await prisma.offers_rel.upsert({
                where: { id: docId },
                create: {
                    id: docId,
                    userId: authReq.user?.id,
                    state: state,
                    createdAt: created,
                    transportCost: o.transportCost || 0
                },
                update: {
                    userId: authReq.user?.id,
                    state: state,
                    createdAt: created,
                    transportCost: o.transportCost || 0
                }
            });

            // Odśwież elementy
            await prisma.offer_items_rel.deleteMany({
                where: { offerId: docId }
            });
            const items = o.items || [];
            for (const item of items) {
                const itemId = item.id || uuidv4();
                const itemPrice = item.unitPrice !== undefined ? item.unitPrice : item.price || 0;
                await prisma.offer_items_rel.create({
                    data: {
                        id: itemId,
                        offerId: docId,
                        productId: item.productId,
                        quantity: item.quantity || 0,
                        discount: item.discount || 0,
                        price: itemPrice
                    }
                });
            }
        }

        res.json({ ok: true });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        res.status(500).json({ error: message });
    }
});

/* ===== OFERTY STUDNIE — PUT (zbiorczo) ===== */

router.put('/studnie', requireAuth, writeOffersLimiter, validateData(offersStudnieBatchSchema), async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const incoming = req.body.data || [];

        for (const o of incoming) {
            let docId = o.id;
            if (!docId) {
                docId = Date.now().toString() + '_' + Math.random().toString(36).substr(2, 5);
            }

            const state = o.status === 'active' ? 'final' : 'draft';
            // Konwersja createdAt - obsługa: timestamp number/string, Date object, ISO string
            const created = (() => {
                const raw = o.createdAt;
                if (typeof raw === 'number') return new Date(raw).toISOString();
                if (raw instanceof Date) return raw.toISOString();
                if (typeof raw === 'string') {
                    if (/^\d{13}$/.test(raw)) return new Date(Number(raw)).toISOString();
                    return raw;
                }
                return new Date().toISOString();
            })();

            await prisma.offers_studnie_rel.upsert({
                where: { id: docId },
                create: {
                    id: docId,
                    userId: authReq.user?.id,
                    state: state,
                    createdAt: created,
                    data: o.data ? JSON.stringify(o.data) : '{}'
                },
                update: {
                    userId: authReq.user?.id,
                    state: state,
                    createdAt: created,
                    data: o.data ? JSON.stringify(o.data) : '{}'
                }
            });
        }

        res.json({ ok: true });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        res.status(500).json({ error: message });
    }
});

/* ===== DELETE ===== */

router.delete('/:id', requireAuth, writeOffersLimiter, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const { id } = req.params;

        // Jeśli ID zaczyna się od 'offer_studnie_', to oferta studni
        if (id.startsWith('offer_studnie_')) {
            logger.info('Offers', 'DELETE /:id (studnie) start', { id, userId: authReq.user?.id });

            // Użyj raw query aby obsłużyć błędne daty w bazie
            const offers = await prisma.$queryRawUnsafe<
                Array<{ id: string; userId: string | null; data: string | null }>
            >(`SELECT id, "userId", data FROM offers_studnie_rel WHERE id = '${id}'`);
            const offer = offers[0];
            if (!offer) {
                logger.warn('Offers', 'Oferta studni nie istnieje', { id });
                return res.status(404).json({ error: 'Oferta studni nie istnieje' });
            }

            if (authReq.user?.role !== 'admin' && offer.userId !== authReq.user?.id) {
                return res.status(403).json({ error: 'Brak uprawnien do usuniecia tej oferty' });
            }

            // Audyt
            let oldData: Record<string, unknown> = {};
            try {
                oldData = JSON.parse(offer.data || '{}');
            } catch (_e) {}
            logAudit('studnia_oferta', id, authReq.user?.id || '', 'delete', null, oldData);

            // Użyj raw query aby obsłużyć błędne daty w bazie
            await prisma.$executeRawUnsafe(`DELETE FROM offers_studnie_rel WHERE id = '${id}'`);

            logger.info('Offers', `Oferta studnie ${id} usunięta przez ${authReq.user?.username}`);
            return res.json({ ok: true });
        }

        // Standardowa oferta rur
        const offer = await prisma.offers_rel.findUnique({
            where: { id }
        });
        if (!offer) return res.status(404).json({ error: 'Oferta nie istnieje' });

        if (authReq.user?.role !== 'admin' && offer.userId !== authReq.user?.id) {
            return res.status(403).json({ error: 'Brak uprawnien do usuniecia tej oferty' });
        }

        // Audyt: zachowaj migawkę przed usunięciem
        const oldItems = await prisma.offer_items_rel.findMany({
            where: { offerId: id }
        });
        const oldSnapshot = {
            offer_number: offer.offer_number,
            state: offer.state,
            transportCost: offer.transportCost,
            items: oldItems.map((i) => ({
                productId: i.productId,
                quantity: i.quantity,
                discount: i.discount,
                price: i.price
            }))
        };
        logAudit('offer', id, authReq.user?.id || '', 'delete', null, oldSnapshot);

        await prisma.offer_items_rel.deleteMany({
            where: { offerId: id }
        });
        await prisma.offers_rel.delete({
            where: { id }
        });

        logger.info('Offers', `Oferta rury ${id} usunięta przez ${authReq.user?.username}`);
        res.json({ ok: true });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        res.status(500).json({ error: message });
    }
});

router.delete('/studnie/:id', requireAuth, writeOffersLimiter, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const { id } = req.params;
        logger.info('Offers', 'DELETE /studnie/:id start', { id, userId: authReq.user?.id });

        // Użyj raw query aby obsłużyć błędne daty w bazie
        const offers = await prisma.$queryRawUnsafe<
            Array<{ id: string; userId: string | null; data: string | null }>
        >(`SELECT id, "userId", data FROM offers_studnie_rel WHERE id = '${id}'`);
        const offer = offers[0];
        if (!offer) {
            logger.warn('Offers', 'Oferta studni nie istnieje', { id });
            return res.status(404).json({ error: 'Oferta studni nie istnieje' });
        }

        if (authReq.user?.role !== 'admin' && offer.userId !== authReq.user?.id) {
            return res.status(403).json({ error: 'Brak uprawnien do usuniecia tej oferty' });
        }

        // Audyt
        let oldData: Record<string, unknown> = {};
        try {
            oldData = JSON.parse(offer.data || '{}');
        } catch (_e) {}
        logAudit('studnia_oferta', id, authReq.user?.id || '', 'delete', null, oldData);

        // Użyj raw query aby obsłużyć błędne daty w bazie
        await prisma.$executeRawUnsafe(`DELETE FROM offers_studnie_rel WHERE id = '${id}'`);

        logger.info('Offers', `Oferta studnie ${req.params.id} usunięta przez ${authReq.user?.username}`);
        res.json({ ok: true });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        logger.error('Offers', `Błąd DELETE /studnie/:id (${req.params.id})`, message);
        res.status(500).json({ error: message });
    }
});

export default router;
