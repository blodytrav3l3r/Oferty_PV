import express from 'express';
import crypto from 'crypto';
import prisma from '../prismaClient';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';

import { validateData } from '../validators/authSchema';
import { WRITE_LIMITER } from '../middleware/rateLimiters';
import { clientsBatchSchema } from '../validators/offerSchemas';
import { logger } from '../utils/logger';
import { canDeleteDoc } from '../utils/ownership';

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
            const isAdmin = authReq.user?.role === 'admin';

            // P0: destrukcyjny full-wipe (pusta tablica = skasuj wszystko) tylko
            // dla admina. Kontrakt UI nigdy nie czyści całości (dodawanie/edycja/
            // pojedyncze usuwanie), więc zwykły handlowiec traci tu wyłącznie
            // operację, której legalnie nie wykonuje.
            if (arr.length === 0 && !isAdmin) {
                return res
                    .status(403)
                    .json({ error: 'Brak uprawnień do czyszczenia bazy klientów' });
            }

            const now = new Date().toISOString();
            const upserted: { id: string }[] = [];

            // Wspólna baza klientów — wszyscy widzą i edytują wszystkich (Wariant A).
            // P0: upsert NIE przepisuje właściciela istniejących wierszy (userId
            // z DB zostaje); userId edytującego dostają wyłącznie NOWE wiersze.
            try {
                await prisma.$transaction(async (tx) => {
                    const existingClients =
                        await tx.$queryRaw`SELECT id, "userId" FROM clients_rel`;
                    const existingOwners = new Map(
                        (existingClients as { id: string; userId: string | null }[]).map((c) => [
                            c.id,
                            c.userId ?? null
                        ])
                    );
                    const existingIds = [...existingOwners.keys()];
                    const incomingIds = arr.map((c: { id?: string }) => c.id).filter(Boolean);
                    const toDelete = existingIds.filter((id) => !incomingIds.includes(id));

                    // P0: DELETE cudzych wierszy tylko admin/pro-opiekun (canDeleteDoc).
                    // Decyzja: Wariant A (wspólna baza) dotyczy EDYCJI współdzielonych
                    // danych — upsert poniżej celowo bez guardu (clientsIdor.test.ts:
                    // "nadpisuje klienta innego użytkownika"). Usunięcie cudzego
                    // wiersza przez pominięcie ID to IDOR → 403 fail-closed PRZED
                    // jakimkolwiek zapisem. Bezpańskie (userId null, legacy)
                    // fail-closed: tylko admin (spójnie z ownership.ts).
                    const forbiddenDelete = toDelete.filter(
                        (id) => !canDeleteDoc(authReq.user, existingOwners.get(id))
                    );
                    if (forbiddenDelete.length > 0) {
                        throw {
                            status: 403,
                            message: 'Brak uprawnień do usuwania cudzych klientów'
                        };
                    }

                    if (toDelete.length > 0) {
                        // Semantyka: link clientId NULL-uj (snapshot clientName/NIP/NIP
                        // w ofertach zostaje — historia czytelna). Bez tego offers_rel /
                        // offers_studnie_rel.clientId wiszą (kolumna bez FK): PDF/DOCX są
                        // null-safe (findUnique w ternary), ale dane gniją po cichu.
                        // FK clients_rel jako rekomendacja migracyjna (poza zakresem).
                        await tx.offers_rel.updateMany({
                            where: { clientId: { in: toDelete } },
                            data: { clientId: null }
                        });
                        await tx.offers_studnie_rel.updateMany({
                            where: { clientId: { in: toDelete } },
                            data: { clientId: null }
                        });
                        // Batch (N+1 -> 1): jeden DELETE ... WHERE id IN zamiast
                        // per-row DELETE. Ta sama semantyka, ta sama tx.
                        await tx.clients_rel.deleteMany({ where: { id: { in: toDelete } } });
                    }

                    if (arr.length > 0) {
                        // Prep bez I/O: docId / owner / createdAt na wiersz. Owner jak
                        // dotąd: istniejący z DB (w tym null = bezpański zostaje
                        // bezpański), edytujący — tylko dla nowych wierszy.
                        const rows = arr.map(
                            (c: {
                                id?: string;
                                createdAt?: string | number | null;
                                name?: string;
                                nip?: string;
                                address?: string;
                                contact?: string;
                                clientNumber?: string;
                                phone?: string;
                                email?: string;
                            }) => {
                                const docId = c.id || crypto.randomUUID();
                                const ownerId = existingOwners.has(docId)
                                    ? existingOwners.get(docId)
                                    : userId;

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

                                return {
                                    docId,
                                    ownerId: ownerId ?? null,
                                    name: c.name || '',
                                    nip: c.nip || '',
                                    address: c.address || '',
                                    contact: c.contact || '',
                                    clientNumber: c.clientNumber || '',
                                    phone: c.phone || '',
                                    email: c.email || '',
                                    createdAt: parsedDate
                                };
                            }
                        );

                        // Batch (N+1 -> 1): jeden multi-row INSERT ... ON CONFLICT
                        // (SQLite wspiera od 3.24 — zweryfikowane runtime na silniku
                        // Prisma). DO UPDATE czyta excluded.* = te same wartości co
                        // per-row upsert, w tym owner bez przepisywania. RETURNING
                        // zbędne — docId znamy z prepu (poprzedni kod też ignorował
                        // wynik RETURNING, pushował docId).
                        const placeholders = rows.map(() => '(?,?,?,?,?,?,?,?,?,?,?)').join(',');
                        const params: unknown[] = [];
                        for (const r of rows) {
                            params.push(
                                r.docId,
                                r.ownerId,
                                r.name,
                                r.nip,
                                r.address,
                                r.contact,
                                r.clientNumber,
                                r.phone,
                                r.email,
                                r.createdAt,
                                now
                            );
                        }
                        await tx.$queryRawUnsafe(
                            `INSERT INTO clients_rel (id, userId, name, nip, address, contact, clientNumber, phone, email, createdAt, updatedAt)` +
                                ` VALUES ${placeholders}` +
                                ` ON CONFLICT(id) DO UPDATE SET` +
                                ` userId = excluded.userId,` +
                                ` name = excluded.name,` +
                                ` nip = excluded.nip,` +
                                ` address = excluded.address,` +
                                ` contact = excluded.contact,` +
                                ` clientNumber = excluded.clientNumber,` +
                                ` phone = excluded.phone,` +
                                ` email = excluded.email,` +
                                ` updatedAt = excluded.updatedAt`,
                            ...params
                        );
                        for (const r of rows) upserted.push({ id: r.docId });
                    }
                });
            } catch (e: unknown) {
                if ((e as { status?: number }).status === 403) {
                    return res
                        .status(403)
                        .json({ error: (e as { message?: string }).message || 'Brak uprawnień' });
                }
                throw e;
            }

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
