/**
 * Twarda blokada edycji: 1 dokument = 1 uzytkownik.
 * Prawda o blokadzie zyje w DB (tabela doc_locks), nie w pamieci procesu.
 * TTL 180 s + heartbeat 60 s, wygasniecie leniwe przy acquire (bez crona).
 *
 * Semantyka re-entrancy: wlascicielem jest userId (1 dokument = 1 uzytkownik,
 * nie 1 karta — dwie karty tego samego uzytkownika dziela blokade swiadomie).
 * Brak wiersza = brak blokady = zapis przepuszczony (stare sesje sprzed
 * acquire; chroni je optimistic locking 409).
 */
import prisma from '../prismaClient';
import type { User } from '../helpers';

/** TTL blokady: brak heartbeat w tym czasie = blokada wygasla. */
export const DOC_LOCK_TTL_MS = 180000;

export const DOC_LOCK_TYPES = ['offer', 'offer_studnie', 'order_rury', 'order_studnie'] as const;
export type DocLockType = (typeof DOC_LOCK_TYPES)[number];

export interface DocLockRow {
    docType: string;
    docId: string;
    userId: string | null;
    userName: string | null;
    lockedAt: string;
    heartbeatAt: string;
}

export interface DocLockHolder {
    userId: string | null;
    userName: string | null;
    lockedAt: string;
}

export type DocLockClient = Pick<typeof prisma, 'doc_locks'>;

/** Nazwa do wyswietlenia w modalu 423 (tylko niezbedne dane). */
export function lockDisplayName(
    user: Pick<User, 'id' | 'username' | 'firstName' | 'lastName'>
): string {
    if (user.firstName && user.lastName) return `${user.firstName} ${user.lastName}`;
    return user.username || user.id;
}

/** Czy heartbeat jest swiezy (blokada wazna)? ISO-stringi porownywalne leksykograficznie. */
export function isLockFresh(heartbeatAt: string | null | undefined, nowMs = Date.now()): boolean {
    if (!heartbeatAt) return false;
    const t = Date.parse(heartbeatAt);
    if (Number.isNaN(t)) return false;
    return nowMs - t < DOC_LOCK_TTL_MS;
}

function cutoffIso(nowMs: number): string {
    return new Date(nowMs - DOC_LOCK_TTL_MS).toISOString();
}

/** Buduje strukturalny blad 423 (status/code/holder — nigdy sam tekst). */
export function docLockConflict(lock: DocLockRow): Error & {
    status: number;
    code: string;
    holder: DocLockHolder;
} {
    const err = new Error('Dokument jest edytowany przez innego użytkownika') as Error & {
        status: number;
        code: string;
        holder: DocLockHolder;
    };
    err.status = 423;
    err.code = 'DOC_LOCKED';
    err.holder = { userId: lock.userId, userName: lock.userName, lockedAt: lock.lockedAt };
    return err;
}

function isUniqueViolation(e: unknown): boolean {
    return (e as { code?: string }).code === 'P2002';
}

/**
 * Acquire atomowy wzorcem UPDATE-predykat (jak versionedWrite):
 * 1. updateMany WHERE wlasny-lub-wygasly -> count 1 = przejecie/odswiezenie.
 * 2. Pudlo -> create; P2002 = ktos rownoczesnie utworzyl -> odczyt i 423 albo retry.
 * Dwa rownoczesne acquire: dokladnie jeden dostaje 200, drugi 423.
 */
export async function acquireDocLock(
    client: DocLockClient,
    args: {
        docType: DocLockType;
        docId: string;
        user: Pick<User, 'id' | 'username' | 'firstName' | 'lastName'>;
    }
): Promise<{ acquired: true; lock: DocLockRow }> {
    const nowMs = Date.now();
    const now = new Date(nowMs).toISOString();
    const cutoff = cutoffIso(nowMs);
    const userName = lockDisplayName(args.user);
    const where = { docType: args.docType, docId: args.docId };
    const whereUnique = { docType_docId: { docType: args.docType, docId: args.docId } };

    const take = await client.doc_locks.updateMany({
        where: {
            ...where,
            OR: [{ userId: args.user.id }, { heartbeatAt: { lt: cutoff } }]
        },
        data: { userId: args.user.id, userName, heartbeatAt: now }
    });
    if (take.count === 1) {
        const lock = (await client.doc_locks.findUnique({
            where: whereUnique
        })) as unknown as DocLockRow;
        return { acquired: true, lock };
    }

    try {
        const lock = (await client.doc_locks.create({
            data: {
                docType: args.docType,
                docId: args.docId,
                userId: args.user.id,
                userName,
                lockedAt: now,
                heartbeatAt: now
            }
        })) as unknown as DocLockRow;
        return { acquired: true, lock };
    } catch (e: unknown) {
        if (!isUniqueViolation(e)) throw e;
        // Wysig: rownoczesny acquire utworzyl wiersz — odczytaj zwyciezce.
        const existing = (await client.doc_locks.findUnique({
            where: whereUnique
        })) as unknown as DocLockRow | null;
        if (!existing) {
            // Wiersz zniknal miedzy create a odczytem (release) — jedna proba retry.
            const retry = await client.doc_locks.updateMany({
                where: { ...where, heartbeatAt: { lt: cutoffIso(Date.now()) } },
                data: { userId: args.user.id, userName, heartbeatAt: new Date().toISOString() }
            });
            if (retry.count === 1) {
                const lock = (await client.doc_locks.findUnique({
                    where: whereUnique
                })) as unknown as DocLockRow;
                return { acquired: true, lock };
            }
            const gone = (await client.doc_locks.findUnique({
                where: whereUnique
            })) as unknown as DocLockRow | null;
            if (gone && gone.userId !== args.user.id && isLockFresh(gone.heartbeatAt))
                throw docLockConflict(gone);
            const recreated = (await client.doc_locks.create({
                data: {
                    docType: args.docType,
                    docId: args.docId,
                    userId: args.user.id,
                    userName,
                    lockedAt: new Date().toISOString(),
                    heartbeatAt: new Date().toISOString()
                }
            })) as unknown as DocLockRow;
            return { acquired: true, lock: recreated };
        }
        if (existing.userId !== args.user.id && isLockFresh(existing.heartbeatAt))
            throw docLockConflict(existing);
        const retry = await client.doc_locks.updateMany({
            where: { ...where, heartbeatAt: { lt: cutoffIso(Date.now()) } },
            data: { userId: args.user.id, userName, heartbeatAt: new Date().toISOString() }
        });
        if (retry.count === 1) {
            const lock = (await client.doc_locks.findUnique({
                where: whereUnique
            })) as unknown as DocLockRow;
            return { acquired: true, lock };
        }
        const final = (await client.doc_locks.findUnique({
            where: whereUnique
        })) as unknown as DocLockRow;
        throw docLockConflict(final);
    }
}

/** Heartbeat: odswieza wlasna blokade. Cudza swieza -> 423; brak -> 404. */
export async function heartbeatDocLock(
    client: DocLockClient,
    args: { docType: DocLockType; docId: string; user: Pick<User, 'id'> }
): Promise<{ refreshed: true; lock: DocLockRow }> {
    const now = new Date().toISOString();
    const upd = await client.doc_locks.updateMany({
        where: { docType: args.docType, docId: args.docId, userId: args.user.id },
        data: { heartbeatAt: now }
    });
    if (upd.count === 1) {
        const lock = (await client.doc_locks.findUnique({
            where: { docType_docId: { docType: args.docType, docId: args.docId } }
        })) as unknown as DocLockRow;
        return { refreshed: true, lock };
    }
    const existing = (await client.doc_locks.findUnique({
        where: { docType_docId: { docType: args.docType, docId: args.docId } }
    })) as unknown as DocLockRow | null;
    if (!existing) {
        const err = new Error('Blokada nie istnieje') as Error & { status: number; code: string };
        err.status = 404;
        err.code = 'DOC_LOCK_MISSING';
        throw err;
    }
    throw docLockConflict(existing);
}

/** Release: kasuje wlasna lub wygasla blokade. Zawsze 200 (idempotentny). */
export async function releaseDocLock(
    client: DocLockClient,
    args: { docType: DocLockType; docId: string; user: Pick<User, 'id'> }
): Promise<{ released: boolean }> {
    const del = await client.doc_locks.deleteMany({
        where: {
            docType: args.docType,
            docId: args.docId,
            OR: [{ userId: args.user.id }, { heartbeatAt: { lt: cutoffIso(Date.now()) } }]
        }
    });
    return { released: del.count > 0 };
}

/**
 * Force-acquire admina JEDNA operacja DB (upsert, bez okna DELETE->ACQUIRE).
 * Atomowy — brak race z rownoczesnym acquire zwyklego uzytkownika.
 */
export async function forceAcquireDocLock(
    client: DocLockClient,
    args: {
        docType: DocLockType;
        docId: string;
        user: Pick<User, 'id' | 'username' | 'firstName' | 'lastName'>;
    }
): Promise<{ acquired: true; lock: DocLockRow }> {
    const now = new Date().toISOString();
    const lock = (await client.doc_locks.upsert({
        where: { docType_docId: { docType: args.docType, docId: args.docId } },
        update: {
            userId: args.user.id,
            userName: lockDisplayName(args.user),
            lockedAt: now,
            heartbeatAt: now
        },
        create: {
            docType: args.docType,
            docId: args.docId,
            userId: args.user.id,
            userName: lockDisplayName(args.user),
            lockedAt: now,
            heartbeatAt: now
        }
    })) as unknown as DocLockRow;
    return { acquired: true, lock };
}

/**
 * Guard zapisu: brak wiersza -> przepusc (stare sesje sprzed acquire;
 * chroni je optimistic locking 409). Swieza cudza -> throw 423.
 */
export async function assertDocLockForWrite(
    client: DocLockClient,
    args: { docType: DocLockType; docId: string; user: Pick<User, 'id'> }
): Promise<void> {
    // Brak delegata/tabeli (baza legacy bez migracji, stare mocki) = brak
    // blokady = zapis przepuszczony (chroni optimistic locking 409, nie 500).
    const delegate = (client as Partial<DocLockClient> | undefined)?.doc_locks;
    if (!delegate || typeof delegate.findUnique !== 'function') return;
    const existing = (await delegate.findUnique({
        where: { docType_docId: { docType: args.docType, docId: args.docId } }
    })) as unknown as DocLockRow | null;
    if (!existing) return;
    if (existing.userId !== args.user.id && isLockFresh(existing.heartbeatAt)) {
        throw docLockConflict(existing);
    }
}

/** Mapuje blad blokady na odpowiedz 423/404. Zwraca true gdy obsluzony. */
export function mapDocLockConflict(
    res: { status(code: number): { json(body: unknown): unknown } },
    e: unknown
): boolean {
    const status = (e as { status?: number }).status;
    if (status === 423) {
        res.status(423).json({
            error:
                (e as { message?: string }).message ||
                'Dokument jest edytowany przez innego użytkownika',
            code: (e as { code?: string }).code || 'DOC_LOCKED',
            holder: (e as { holder?: DocLockHolder }).holder
        });
        return true;
    }
    if (status === 404 && (e as { code?: string }).code === 'DOC_LOCK_MISSING') {
        res.status(404).json({ error: 'Blokada nie istnieje', code: 'DOC_LOCK_MISSING' });
        return true;
    }
    return false;
}
