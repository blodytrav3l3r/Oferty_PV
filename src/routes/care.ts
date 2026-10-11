import crypto from 'node:crypto';
import express from 'express';
import { z } from 'zod';
import prisma from '../prismaClient';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { WRITE_LIMITER, READ_LIMITER } from '../middleware/rateLimiters';
import { canWriteDoc } from '../utils/ownership';
import {
    getCareQueue,
    getCareSummary,
    getCareEtagInput,
    buildCareQueueView,
    resolveRepOwner,
    CareScope,
    clampCareLimit,
    CareKind,
    getCareState,
    setCareState,
    clearCareState,
    getSlaConfig,
    setSlaConfig,
    getEffectiveSla,
    setScopedSla,
    syncCareNotifications,
    listCareNotifications,
    markCareNotificationRead,
    markCareNotificationsRead,
    MAX_SNOOZE_DAYS
} from '../services/careService';
import {
    claimIdempotencyKey,
    completeIdempotencyKey,
    idempotencyKeyFrom
} from '../utils/idempotency';
import { logger } from '../utils/logger';
import { mapPrismaError } from '../utils/prismaErrors';

const router = express.Router();

const scopeSchema = z.enum(['mine', 'team', 'all']);
// z.coerce.boolean() kłamie: Boolean('false') === true. Jawny parser.
const queryBool = z
    .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
    .transform((v) => v === true || v === 'true' || v === '1')
    .optional();
const ISO_DATETIME_RE =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|[+-](\d{2}):?(\d{2}))$/;

function isStrictIsoDateTime(s: string): boolean {
    const m = ISO_DATETIME_RE.exec(s);
    if (!m) return false;
    const mo = Number(m[2]);
    const d = Number(m[3]);
    const hh = Number(m[4]);
    const mi = Number(m[5]);
    if (mo < 1 || mo > 12 || d < 1 || d > 31 || hh > 23 || mi > 59) return false;
    return Number.isFinite(Date.parse(s));
}

const isoDateTime = z.string().refine(isStrictIsoDateTime, {
    message: 'Nieprawidłowa data ISO-8601 ze strefą'
});
const rangeFields = {
    from: isoDateTime.optional(),
    to: isoDateTime.optional()
};
// Kafelek handlowca (repId po resolveRepOwner, AND wewnątrz scope).
const repField = {
    repId: z.string().min(1).max(50).optional()
};
function rangeOk(d: { from?: string; to?: string }): boolean {
    return !d.from || !d.to || Date.parse(d.from) <= Date.parse(d.to);
}
// Ten sam cap co followUpStats.ts (MAX_RANGE_MS) — spójny kontrakt zakresów.
const MAX_RANGE_MS = 366 * 86400000;
function rangeSpanOk(d: { from?: string; to?: string }): boolean {
    return (
        rangeOk(d) && (!d.from || !d.to || Date.parse(d.to) - Date.parse(d.from) <= MAX_RANGE_MS)
    );
}
const queueQuerySchema = z
    .object({
        scope: scopeSchema.optional(),
        cursor: z.string().max(2000).optional(),
        limit: z.coerce.number().int().min(1).max(100).optional(),
        hidePaused: queryBool,
        ...rangeFields,
        ...repField
    })
    .refine(rangeSpanOk, { message: 'Zakres dat: from <= to, maksymalnie 366 dni' });
const summaryQuerySchema = z
    .object({
        scope: scopeSchema.optional(),
        hidePaused: queryBool,
        ...rangeFields,
        ...repField
    })
    .refine(rangeSpanOk, { message: 'Zakres dat: from <= to, maksymalnie 366 dni' });

function toScope(v: unknown): CareScope {
    return v === 'team' || v === 'all' ? v : 'mine';
}

// Limit powiadomień w pakiecie panelu (osobny od limitu kolejki).
const QUEUE_PANEL_NOTIF_LIMIT = 20;

router.get('/summary', requireAuth, READ_LIMITER, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const user = authReq.user;
        if (!user) return res.status(401).json({ error: 'Nieautoryzowany' });
        const parsed = summaryQuerySchema.safeParse(req.query);
        if (!parsed.success) return res.status(400).json({ error: 'Nieprawidłowe parametry' });
        const scope = toScope(parsed.data.scope);
        const repOwner = resolveRepOwner(user, parsed.data.repId);
        const nowIso = new Date().toISOString();
        const counts = await getCareSummary(prisma, user, scope, nowIso, {
            from: parsed.data.from,
            to: parsed.data.to,
            repOwner,
            hidePaused: parsed.data.hidePaused ?? false
        });
        return res.json({ ok: true, scope, now: nowIso, ...counts });
    } catch (e) {
        if ((e as { status?: number }).status === 403) {
            return res.status(403).json({ error: 'Brak uprawnień do zakresu' });
        }
        logger.warn('Care', 'Błąd summary', String(e));
        return res.status(500).json({ error: 'Błąd serwera' });
    }
});

router.get('/queue', requireAuth, READ_LIMITER, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const user = authReq.user;
        if (!user) return res.status(401).json({ error: 'Nieautoryzowany' });
        const parsed = queueQuerySchema.safeParse(req.query);
        if (!parsed.success) return res.status(400).json({ error: 'Nieprawidłowe parametry' });
        const scope = toScope(parsed.data.scope);
        const repOwner = resolveRepOwner(user, parsed.data.repId);
        const nowIso = new Date().toISOString();
        const limit = clampCareLimit(parsed.data.limit);
        const hidePaused = parsed.data.hidePaused ?? false;
        const result = await getCareQueue(prisma, user, {
            scope,
            nowIso,
            cursor: parsed.data.cursor ?? null,
            limit,
            hidePaused,
            from: parsed.data.from,
            to: parsed.data.to,
            repOwner
        });
        const sla = await getEffectiveSla(prisma, user, scope);
        const items = buildCareQueueView(result.items, sla, nowIso);
        return res.json({
            ok: true,
            scope,
            now: nowIso,
            items,
            nextCursor: result.nextCursor,
            totalCount: result.totalCount
        });
    } catch (e) {
        const se = e as { status?: number; code?: string };
        if (se.status === 400 && se.code === 'INVALID_CURSOR') {
            return res.status(400).json({ error: 'Nieprawidłowy cursor', code: 'INVALID_CURSOR' });
        }
        if ((e as { status?: number }).status === 403) {
            return res.status(403).json({ error: 'Brak uprawnień do zakresu' });
        }
        logger.warn('Care', 'Błąd queue', String(e));
        return res.status(500).json({ error: 'Błąd serwera' });
    }
});

// ─── P2 planu poprawy: cały panel w 1 requeście + ETag/304 ─────────────
// Stare endpointy (summary/queue/notifications) zostają jako fallback + kompat.
router.get('/panel', requireAuth, READ_LIMITER, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const user = authReq.user;
        if (!user) return res.status(401).json({ error: 'Nieautoryzowany' });
        const parsed = queueQuerySchema.safeParse(req.query);
        if (!parsed.success) return res.status(400).json({ error: 'Nieprawidłowe parametry' });
        const scope = toScope(parsed.data.scope);
        const repOwner = resolveRepOwner(user, parsed.data.repId);
        // ETag best-effort: brak tabeli na legacy DB nie może wywalić panelu.
        let etag: string | null = null;
        try {
            etag =
                '"care-' +
                crypto
                    .createHash('sha1')
                    .update(
                        JSON.stringify([
                            user.id,
                            scope,
                            parsed.data.from ?? null,
                            parsed.data.to ?? null,
                            repOwner,
                            parsed.data.hidePaused ?? false,
                            await getCareEtagInput(prisma, repOwner ?? user.id)
                        ])
                    )
                    .digest('hex') +
                '"';
        } catch {
            etag = null;
        }
        if (etag) {
            res.set('ETag', etag);
            if (req.headers['if-none-match'] === etag) return res.status(304).end();
        }
        const nowIso = new Date().toISOString();
        const limit = clampCareLimit(parsed.data.limit);
        const hidePaused = parsed.data.hidePaused ?? false;
        const [summary, queue, sla] = await Promise.all([
            getCareSummary(prisma, user, scope, nowIso, {
                from: parsed.data.from,
                to: parsed.data.to,
                repOwner,
                hidePaused
            }),
            getCareQueue(prisma, user, {
                scope,
                nowIso,
                cursor: parsed.data.cursor ?? null,
                limit,
                hidePaused,
                from: parsed.data.from,
                to: parsed.data.to,
                repOwner
            }),
            getEffectiveSla(prisma, user, scope)
        ]);
        const sync = await syncCareNotifications(prisma, user, scope, nowIso, sla, {
            repOwner
        });
        logger.debug(
            'Care',
            `panel scope=${scope} inserted=${sync.inserted} resolved=${sync.resolved}`
        );
        const { items: notifItems, unreadCount } = await listCareNotifications(
            prisma,
            repOwner ?? user.id,
            {
                unreadOnly: true,
                limit: QUEUE_PANEL_NOTIF_LIMIT
            }
        );
        return res.json({
            ok: true,
            scope,
            now: nowIso,
            etag,
            summary,
            queue: {
                items: buildCareQueueView(queue.items, sla, nowIso),
                nextCursor: queue.nextCursor,
                totalCount: queue.totalCount
            },
            notifications: {
                items: notifItems,
                unreadCount,
                sync,
                mailboxUserId: repOwner ?? user.id
            },
            sla
        });
    } catch (e) {
        const se = e as { status?: number; code?: string };
        if (se.status === 400 && se.code === 'INVALID_CURSOR') {
            return res.status(400).json({ error: 'Nieprawidłowy cursor', code: 'INVALID_CURSOR' });
        }
        if ((e as { status?: number }).status === 403) {
            return res.status(403).json({ error: 'Brak uprawnień do zakresu' });
        }
        logger.warn('Care', 'Błąd panelu', String(e));
        return res.status(500).json({ error: 'Błąd serwera' });
    }
});

export default router;

// ─── P1: snooze / done / reopen + konfiguracja SLA ─────────────────────

const snoozeSchema = z.object({
    snoozedUntil: isoDateTime,
    expectedUpdatedAt: isoDateTime.nullish()
});
const doneSchema = z.object({ expectedUpdatedAt: isoDateTime.nullish() });
const slaSchema = z.object({
    firstContactH: z.number().int().min(1).max(720),
    staleD: z.number().int().min(1).max(90),
    escalationH: z.number().int().min(1).max(720)
});

function checkKind(kind: string): kind is CareKind {
    return kind === 'rury' || kind === 'studnie';
}

async function loadOffer(kind: CareKind, id: string) {
    if (kind === 'rury') return prisma.offers_rel.findUnique({ where: { id } });
    return prisma.offers_studnie_rel.findUnique({ where: { id } });
}

type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

async function loadOfferTx(tx: TxClient, kind: CareKind, id: string) {
    if (kind === 'rury') return tx.offers_rel.findUnique({ where: { id } });
    return tx.offers_studnie_rel.findUnique({ where: { id } });
}

function forbid(e: unknown): { status: number } | null {
    const s = (e as { status?: number })?.status;
    return s === 403 || s === 404 ? { status: s } : null;
}

/** Odczyt stanu po zapisie z re-checkiem uprawnień (getCareState sam nie sprawdza). */
async function readStateChecked(
    canWrite: (ownerUserId: string | null) => boolean,
    kind: CareKind,
    id: string
) {
    const offer = await loadOffer(kind, id);
    if (!offer) throw Object.assign(new Error('Oferta nie istnieje'), { status: 404 });
    if (!canWrite(offer.userId)) {
        throw Object.assign(new Error('Brak uprawnień do zapisu'), { status: 403 });
    }
    return getCareState(prisma, kind, id);
}

async function writeCareState(
    req: express.Request,
    res: express.Response,
    mode: 'snooze' | 'done' | 'reopen'
) {
    const authReq = req as AuthenticatedRequest;
    try {
        const user = authReq.user;
        if (!user) return res.status(401).json({ error: 'Nieautoryzowany' });
        const { kind, id } = req.params;
        if (!checkKind(kind)) return res.status(400).json({ error: 'Nieprawidłowy typ oferty' });
        // Wstępny check (szybki 404/403) + TWARDY re-check w transakcji
        // (TOCTOU: właściciel mógł się zmienić między odczytem a zapisem).
        const pre = await loadOffer(kind, id);
        if (!pre) return res.status(404).json({ error: 'Oferta nie istnieje' });
        if (!canWriteDoc(user, pre.userId)) {
            return res.status(403).json({ error: 'Brak uprawnień do zapisu' });
        }
        const key = idempotencyKeyFrom(req);
        const endpoint = `care:${mode}:${kind}:${id}`;
        if (key) {
            const claim = await claimIdempotencyKey(user.id, endpoint, key, req.body);
            if (claim.action === 'replay') return res.status(claim.status).json(claim.body);
            if (claim.action === 'reuse') {
                return res.status(409).json({ error: 'Klucz użyty z innym payloadem' });
            }
            if (claim.action === 'in-progress') {
                return res.status(409).json({ error: 'Operacja w toku' });
            }
        }
        const nowIso = new Date().toISOString();
        const guardTx = async (tx: TxClient) => {
            const offer = await loadOfferTx(tx, kind, id);
            if (!offer) throw Object.assign(new Error('Oferta nie istnieje'), { status: 404 });
            if (!canWriteDoc(user, offer.userId)) {
                throw Object.assign(new Error('Brak uprawnień do zapisu'), { status: 403 });
            }
        };
        // prevJson (before-image audytu) czytany WEWNĄTRZ tx — odczyt sprzed
        // transakcji kłamał przy współbieżnym zapisie.
        const prevJsonTx = async (tx: TxClient): Promise<string | null> => {
            const prev = await getCareState(tx, kind, id);
            return prev ? JSON.stringify(prev) : null;
        };
        let state;
        if (mode === 'reopen') {
            const parsed = doneSchema.safeParse(req.body ?? {});
            if (!parsed.success) {
                return res.status(400).json({ error: 'Nieprawidłowe parametry' });
            }
            await prisma.$transaction(async (tx) => {
                await guardTx(tx);
                const prevJson = await prevJsonTx(tx);
                await clearCareState(tx, kind, id, parsed.data.expectedUpdatedAt ?? undefined);
                await tx.audit_logs.create({
                    data: {
                        id: crypto.randomUUID(),
                        entityType: 'care_state',
                        entityId: `${kind}:${id}`,
                        userId: user.id,
                        action: 'reopen',
                        oldData: prevJson,
                        newData: null,
                        createdAt: nowIso
                    }
                });
            });
            state = await readStateChecked((o) => canWriteDoc(user, o), kind, id);
        } else if (mode === 'done') {
            const parsed = doneSchema.safeParse(req.body ?? {});
            if (!parsed.success) {
                return res.status(400).json({ error: 'Nieprawidłowe parametry' });
            }
            await prisma.$transaction(async (tx) => {
                await guardTx(tx);
                const prevJson = await prevJsonTx(tx);
                await setCareState(tx, {
                    offerKind: kind,
                    offerId: id,
                    snoozedUntil: null,
                    doneAt: nowIso,
                    updatedBy: user.id,
                    nowIso,
                    expectedUpdatedAt: parsed.data.expectedUpdatedAt ?? undefined
                });
                await tx.audit_logs.create({
                    data: {
                        id: crypto.randomUUID(),
                        entityType: 'care_state',
                        entityId: `${kind}:${id}`,
                        userId: user.id,
                        action: 'done',
                        oldData: prevJson,
                        newData: JSON.stringify({ doneAt: nowIso }),
                        createdAt: nowIso
                    }
                });
            });
            state = await readStateChecked((o) => canWriteDoc(user, o), kind, id);
        } else {
            const parsed = snoozeSchema.safeParse(req.body);
            if (!parsed.success) {
                return res.status(400).json({ error: 'Nieprawidłowa data odroczenia' });
            }
            const until = new Date(parsed.data.snoozedUntil).toISOString();
            const maxUntil = new Date(Date.now() + MAX_SNOOZE_DAYS * 86400000).toISOString();
            if (until <= nowIso || until > maxUntil) {
                return res
                    .status(400)
                    .json({ error: `Odroczenie: przyszłość, max ${MAX_SNOOZE_DAYS} dni` });
            }
            await prisma.$transaction(async (tx) => {
                await guardTx(tx);
                const prevJson = await prevJsonTx(tx);
                await setCareState(tx, {
                    offerKind: kind,
                    offerId: id,
                    snoozedUntil: until,
                    doneAt: null,
                    updatedBy: user.id,
                    nowIso,
                    expectedUpdatedAt: parsed.data.expectedUpdatedAt ?? undefined
                });
                await tx.audit_logs.create({
                    data: {
                        id: crypto.randomUUID(),
                        entityType: 'care_state',
                        entityId: `${kind}:${id}`,
                        userId: user.id,
                        action: 'snooze',
                        oldData: prevJson,
                        newData: JSON.stringify({ snoozedUntil: until }),
                        createdAt: nowIso
                    }
                });
            });
            state = await readStateChecked((o) => canWriteDoc(user, o), kind, id);
        }
        const body = { ok: true, state };
        if (key) await completeIdempotencyKey(user.id, endpoint, key, 200, body);
        return res.json(body);
    } catch (e) {
        const f = forbid(e);
        if (f) {
            return res
                .status(f.status)
                .json({ error: f.status === 404 ? 'Oferta nie istnieje' : 'Brak uprawnień' });
        }
        if ((e as { code?: string })?.code === 'CARE_STATE_CONFLICT') {
            return res.status(409).json({ error: 'Stan zmieniony przez kogoś innego' });
        }
        if (mapPrismaError(res, e)) return;
        logger.warn('Care', 'Błąd zapisu stanu', String(e));
        return res.status(500).json({ error: 'Błąd serwera' });
    }
}

router.post('/:kind/:id/snooze', requireAuth, WRITE_LIMITER, (req, res) =>
    writeCareState(req, res, 'snooze')
);
router.post('/:kind/:id/done', requireAuth, WRITE_LIMITER, (req, res) =>
    writeCareState(req, res, 'done')
);
router.post('/:kind/:id/reopen', requireAuth, WRITE_LIMITER, (req, res) =>
    writeCareState(req, res, 'reopen')
);

router.get('/sla', requireAuth, READ_LIMITER, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    if (!authReq.user) return res.status(401).json({ error: 'Nieautoryzowany' });
    try {
        const parsed = summaryQuerySchema.safeParse(req.query);
        if (!parsed.success) return res.status(400).json({ error: 'Nieprawidłowe parametry' });
        const eff = await getEffectiveSla(prisma, authReq.user, toScope(parsed.data.scope));
        const { source, ...sla } = eff;
        return res.json({ ok: true, scope: toScope(parsed.data.scope), source, sla });
    } catch (e) {
        logger.warn('Care', 'Błąd odczytu SLA', String(e));
        return res.status(500).json({ error: 'Błąd serwera' });
    }
});

const slaPutSchema = slaSchema.extend({
    scopeType: z.enum(['team', 'user']).optional()
});

router.put('/sla', requireAuth, WRITE_LIMITER, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const user = authReq.user;
    if (!user) return res.status(401).json({ error: 'Nieautoryzowany' });
    const parsed = slaPutSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Nieprawidłowa konfiguracja SLA' });
    const { scopeType, ...cfg } = parsed.data;
    // Global: tylko admin. Team: pro/admin (własny zespół). User: każdy dla siebie.
    if (!scopeType && user.role !== 'admin') {
        return res.status(403).json({ error: 'Tylko administrator' });
    }
    if (scopeType === 'team' && user.role !== 'pro' && user.role !== 'admin') {
        return res.status(403).json({ error: 'Próg zespołu tylko dla pro/admin' });
    }
    const entityId = !scopeType ? 'global' : `${scopeType}:${user.id}`;
    try {
        const nowIso = new Date().toISOString();
        const sla = await prisma.$transaction(async (tx) => {
            const prevSla = !scopeType
                ? await getSlaConfig(tx)
                : await getEffectiveSla(tx, user, scopeType === 'team' ? 'team' : 'mine');
            const next = !scopeType
                ? await setSlaConfig(tx, { ...cfg, updatedBy: user.id, nowIso })
                : await setScopedSla(tx, {
                      ...cfg,
                      scopeType,
                      scopeId: user.id,
                      updatedBy: user.id,
                      nowIso
                  });
            await tx.audit_logs.create({
                data: {
                    id: crypto.randomUUID(),
                    entityType: 'care_sla',
                    entityId,
                    userId: user.id,
                    action: 'update',
                    oldData: JSON.stringify(prevSla),
                    newData: JSON.stringify(cfg),
                    createdAt: nowIso
                }
            });
            return next;
        });
        return res.json({ ok: true, sla, scopeType: scopeType ?? 'global' });
    } catch (e) {
        if (mapPrismaError(res, e)) return;
        logger.warn('Care', 'Błąd zapisu SLA', String(e));
        return res.status(500).json({ error: 'Błąd serwera' });
    }
});

// ─── P2: centrum powiadomień (sync przy odczycie, polling FE) ──────────

const notifQuerySchema = z.object({
    scope: scopeSchema.optional(),
    unreadOnly: queryBool,
    limit: z.coerce.number().int().min(1).max(100).optional(),
    ...repField
});

router.get('/notifications', requireAuth, READ_LIMITER, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const user = authReq.user;
        if (!user) return res.status(401).json({ error: 'Nieautoryzowany' });
        const parsed = notifQuerySchema.safeParse(req.query);
        if (!parsed.success) return res.status(400).json({ error: 'Nieprawidłowe parametry' });
        const scope = toScope(parsed.data.scope);
        const repOwner = resolveRepOwner(user, parsed.data.repId);
        const nowIso = new Date().toISOString();
        const sla = await getEffectiveSla(prisma, user, scope);
        const sync = await syncCareNotifications(prisma, user, scope, nowIso, sla, {
            repOwner
        });
        logger.debug(
            'Care',
            `notifications scope=${scope} inserted=${sync.inserted} resolved=${sync.resolved}`
        );
        const { items, unreadCount } = await listCareNotifications(prisma, repOwner ?? user.id, {
            unreadOnly: parsed.data.unreadOnly ?? true,
            limit: clampCareLimit(parsed.data.limit)
        });
        return res.json({
            ok: true,
            scope,
            now: nowIso,
            items,
            unreadCount,
            sync,
            mailboxUserId: repOwner ?? user.id
        });
    } catch (e) {
        if ((e as { status?: number }).status === 403) {
            return res.status(403).json({ error: 'Brak uprawnień do zakresu' });
        }
        logger.warn('Care', 'Błąd powiadomień', String(e));
        return res.status(500).json({ error: 'Błąd serwera' });
    }
});

// Zbiorczy odczyt MUSI być przed '/notifications/:id/read' (inaczej 'read' wpadnie w :id).
router.post('/notifications/read', requireAuth, WRITE_LIMITER, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const user = authReq.user;
        if (!user) return res.status(401).json({ error: 'Nieautoryzowany' });
        const parsed = z
            .object({ ids: z.array(z.string().min(1).max(200)).min(1).max(100) })
            .safeParse(req.body);
        if (!parsed.success) return res.status(400).json({ error: 'Nieprawidłowe parametry' });
        const nowIso = new Date().toISOString();
        const read = await markCareNotificationsRead(prisma, user.id, parsed.data.ids, nowIso);
        return res.json({ ok: true, read });
    } catch (e) {
        if (mapPrismaError(res, e)) return;
        logger.warn('Care', 'Błąd zbiorczego odczytu powiadomień', String(e));
        return res.status(500).json({ error: 'Błąd serwera' });
    }
});

router.post('/notifications/:id/read', requireAuth, WRITE_LIMITER, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const user = authReq.user;
        if (!user) return res.status(401).json({ error: 'Nieautoryzowany' });
        const nowIso = new Date().toISOString();
        const n = await markCareNotificationRead(prisma, user.id, String(req.params.id), nowIso);
        if (n === 0) return res.status(404).json({ error: 'Nie znaleziono powiadomienia' });
        return res.json({ ok: true });
    } catch (e) {
        if (mapPrismaError(res, e)) return;
        logger.warn('Care', 'Błąd odczytu powiadomienia', String(e));
        return res.status(500).json({ error: 'Błąd serwera' });
    }
});
