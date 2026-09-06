/**
 * P1-A: Idempotency-Key dla POST (dokładnie 1 wykonanie).
 * Bez zagnieżdżonych transakcji (Prisma ich nie wspiera): claim jednym
 * atomowym create (P2002 = ktoś był pierwszy), status PENDING → DONE.
 * Crash zostawia PENDING — reclaim po 5 min, replay DONE przez 24 h.
 * Ten sam klucz + inny payload → 409 IDEMPOTENCY_KEY_REUSE.
 */
import crypto from 'crypto';
import prisma from '../prismaClient';
import { logger } from './logger';

const REPLAY_TTL_MS = 24 * 3600 * 1000;
const PENDING_RECLAIM_MS = 5 * 60 * 1000;
const MAX_STORED_BODY = 64 * 1024;

export function stableStringify(value: unknown): string {
    if (value === null || value === undefined) return 'null';
    if (Array.isArray(value)) return `[${value.map((v) => stableStringify(v)).join(',')}]`;
    if (typeof value === 'object') {
        const record = value as Record<string, unknown>;
        const keys = Object.keys(record).sort();
        return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(record[k])}`).join(',')}}`;
    }
    return JSON.stringify(value) ?? 'null';
}

export function requestHash(body: unknown): string {
    return crypto.createHash('sha256').update(stableStringify(body)).digest('hex');
}

export type ClaimResult =
    | { action: 'proceed' }
    | { action: 'replay'; status: number; body: unknown }
    | { action: 'reuse' }
    | { action: 'in-progress' };

interface KeyRow {
    userId: string;
    endpoint: string;
    key: string;
    requestHash: string;
    status: string;
    responseStatus: number | null;
    responseBody: string | null;
    createdAt: string;
    expiresAt: string;
}

type KeyModel = {
    create(args: { data: Record<string, unknown> }): Promise<unknown>;
    findUnique(args: { where: Record<string, unknown> }): Promise<KeyRow | null>;
    updateMany(args: {
        where: Record<string, unknown>;
        data: Record<string, unknown>;
    }): Promise<{ count: number }>;
    deleteMany(args: { where: Record<string, unknown> }): Promise<{ count: number }>;
};

function model(db?: { idempotency_keys: KeyModel }): KeyModel {
    return db ? db.idempotency_keys : (prisma.idempotency_keys as unknown as KeyModel);
}

/**
 * Atomowy claim klucza. Jedno create = wygrywa; P2002 = odczyt i decyzja.
 * Zwraca akcję dla wołającego. Nie rzuca (poza awarią DB).
 */
export async function claimIdempotencyKey(
    userId: string,
    endpoint: string,
    key: string,
    body: unknown,
    db?: { idempotency_keys: KeyModel }
): Promise<ClaimResult> {
    const m = model(db);
    const now = new Date().toISOString();
    const hash = requestHash(body);
    const expiresAt = new Date(Date.now() + REPLAY_TTL_MS).toISOString();
    try {
        await m.create({
            data: {
                userId,
                endpoint,
                key,
                requestHash: hash,
                status: 'PENDING',
                createdAt: now,
                expiresAt
            }
        });
    } catch (e) {
        if ((e as { code?: string }).code !== 'P2002') throw e;
        // Ktoś był pierwszy — odczyt i decyzja.
        const row = await m.findUnique({
            where: { userId_endpoint_key: { userId, endpoint, key } }
        });
        if (!row) return { action: 'proceed' };
        if (row.status === 'DONE') {
            if (row.requestHash !== hash) return { action: 'reuse' };
            let parsed: unknown = null;
            try {
                parsed = row.responseBody ? JSON.parse(row.responseBody) : null;
            } catch {
                parsed = null;
            }
            return { action: 'replay', status: row.responseStatus ?? 200, body: parsed };
        }
        // PENDING: świeży = ktoś pracuje; stary = crash → reclaim.
        // updateMany nie przyjmuje compound-unique (tylko skalary) — trójka jest unikalna (PK).
        if (Date.now() - Date.parse(row.createdAt) < PENDING_RECLAIM_MS)
            return { action: 'in-progress' };
        const reclaimed = await m.updateMany({
            where: { userId, endpoint, key, status: 'PENDING', createdAt: row.createdAt },
            data: { requestHash: hash, createdAt: now, expiresAt }
        });
        return reclaimed.count === 1 ? { action: 'proceed' } : { action: 'in-progress' };
    }
    // Leniwe sprzątanie przeterminowanych (best-effort, jeden statement).
    try {
        await m.deleteMany({ where: { expiresAt: { lt: now } } });
    } catch (e) {
        logger.debug('Idempotency', 'cleanup ignore', e instanceof Error ? e.message : String(e));
    }
    return { action: 'proceed' };
}

/** Zapis odpowiedzi po udanym wykonaniu (tylko status < 500 — 5xx wolno powtórzyć). */
export async function completeIdempotencyKey(
    userId: string,
    endpoint: string,
    key: string,
    status: number,
    body: unknown,
    db?: { idempotency_keys: KeyModel }
): Promise<void> {
    if (status >= 500) return;
    const m = model(db);
    let stored: string | null = null;
    try {
        const raw = JSON.stringify(body);
        stored = raw.length > MAX_STORED_BODY ? null : raw;
    } catch {
        stored = null;
    }
    await m.updateMany({
        where: { userId, endpoint, key, status: 'PENDING' },
        data: { status: 'DONE', responseStatus: status, responseBody: stored }
    });
}

export function idempotencyKeyFrom(req: {
    get?: (h: string) => unknown;
    headers?: Record<string, unknown>;
}): string | null {
    let raw: unknown = null;
    try {
        raw = typeof req.get === 'function' ? req.get('Idempotency-Key') : null;
    } catch {
        raw = null;
    }
    if (raw == null) raw = req.headers?.['idempotency-key'];
    if (Array.isArray(raw)) raw = raw[0];
    if (typeof raw !== 'string' || raw.length === 0 || raw.length > 128) return null;
    return raw;
}
