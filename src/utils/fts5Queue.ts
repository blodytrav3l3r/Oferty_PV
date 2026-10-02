/**
 * B1: kolejka FTS5 w tle (in-process, single-process per ADR-012).
 *
 * DOWÓD BEZPIECZEŃSTWA (nie założenie):
 * - sync FTS dzieje się PO commicie Tx (ruryCrud:524-528, studnieCrud:1203-1206)
 *   — brak gwarancji transakcyjnych do złamania;
 * - błąd sync to dziś warn-only (ftsFailed++, ruryCrud:529-534) — best-effort już;
 * - search ma fallback LIKE na tabelach bazowych (searchUtils.ts:130-140:
 *   `id IN (FTS ...) OR <LIKE>`), więc opóźniony wpis NIE daje fałszywego
 *   braku wyniku — co najwyżej wolniejszą ścieżkę LIKE.
 * Wniosek: async z retry jest ŚCIŚLE bardziej niezawodny niż status quo
 * (retry zamiast count-and-drop), bez zmiany semantyki biznesowej.
 */
import { syncFts5, removeFts5, ftsSyncStatus, type OfferFts5Data } from './fts5Sync';
import { logger } from './logger';
import prisma from '../prismaClient';

type FtsOp =
    | { kind: 'sync'; type: 'rury' | 'studnie'; data: OfferFts5Data }
    | { kind: 'remove'; type: 'rury' | 'studnie'; id: string };

const queue: FtsOp[] = [];
let pumping = false;

const RETRIES = 3;
const RETRY_DELAY_MS = 1000;

export const ftsQueueMetrics = {
    queued: 0,
    done: 0,
    failed: 0,
    depth: 0
};

export function getFtsQueueMetrics() {
    return { ...ftsQueueMetrics };
}

/** Fire-and-forget: odpowiedź HTTP nie czeka na FTS. Nigdy nie rzuca. */
export function enqueueFtsSync(type: 'rury' | 'studnie', data: OfferFts5Data): void {
    queue.push({ kind: 'sync', type, data });
    ftsQueueMetrics.queued++;
    ftsQueueMetrics.depth = queue.length;
    void pump();
}

/** Fire-and-forget: tombstone delete. Nigdy nie rzuca. */
export function enqueueFtsRemove(type: 'rury' | 'studnie', id: string): void {
    queue.push({ kind: 'remove', type, id });
    ftsQueueMetrics.queued++;
    ftsQueueMetrics.depth = queue.length;
    void pump();
}

async function runOp(op: FtsOp): Promise<boolean> {
    for (let attempt = 1; attempt <= RETRIES; attempt++) {
        try {
            if (op.kind === 'sync') {
                if (await syncFts5(op.type, op.data)) return true;
            } else {
                await removeFts5(op.type, op.id);
                return true;
            }
        } catch (e) {
            logger.debug(
                'FtsQueue',
                `próba ${attempt}/${RETRIES} (${op.kind})`,
                e instanceof Error ? e.message : String(e)
            );
        }
        if (attempt < RETRIES) await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    }
    return false;
}

async function pump(): Promise<void> {
    if (pumping) return;
    pumping = true;
    try {
        for (;;) {
            const op = queue.shift();
            if (!op) break;
            ftsQueueMetrics.depth = queue.length;
            const ok = await runOp(op);
            if (ok) {
                ftsQueueMetrics.done++;
            } else {
                ftsQueueMetrics.failed++;
                logger.warn(
                    'FtsQueue',
                    `dryf FTS po ${RETRIES} próbach (${op.kind} ${
                        op.kind === 'sync' ? op.data.id : op.id
                    }) — łata reconcile/rebuild`
                );
            }
        }
    } finally {
        pumping = false;
        ftsQueueMetrics.depth = queue.length;
    }
}

/** Test-only: czekaj na opróżnienie kolejki (drain przed asercją). */
export async function drainFtsQueue(timeoutMs = 30000): Promise<boolean> {
    const start = Date.now();
    for (;;) {
        if (queue.length === 0 && !pumping) return true;
        if (Date.now() - start > timeoutMs) return false;
        await new Promise((r) => setTimeout(r, 50));
    }
}

/**
 * Startup reconcile: symulacja utraconej kolejki (crash/restart) — wiersze
 * biznesowe bez wpisu FTS są backfillowane po id. Bounded (maxRounds × 20).
 * FTS to dane pochodne: nadmiarowy wpis niemożliwy (DELETE+INSERT per id),
 * brakujący = search fallback LIKE (searchUtils.ts:130-140).
 */
export async function reconcileFts5(maxRounds = 5): Promise<number> {
    let fixed = 0;
    for (let round = 0; round < maxRounds; round++) {
        const status = await ftsSyncStatus();
        if (status.inSync || status.missingIds.length === 0) break;
        for (const m of status.missingIds) {
            const table = m.type === 'rury' ? 'offers_rel' : 'offers_studnie_rel';
            const rows = (await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
                `SELECT id, offer_number, clientName, investName, clientNumber FROM "${table}" WHERE id = ?`,
                m.id
            )) as Array<Record<string, unknown>>;
            const row = rows[0];
            if (!row) continue;
            const ok = await syncFts5(m.type, {
                id: String(row.id),
                offer_number: (row.offer_number as string | null) ?? null,
                clientName: (row.clientName as string | null) ?? null,
                investName: (row.investName as string | null) ?? null,
                clientNumber: (row.clientNumber as string | null) ?? null
            });
            if (ok) fixed++;
        }
    }
    if (fixed > 0) logger.info('FtsQueue', `reconcile: dobudowano ${fixed} wpisów FTS`);
    return fixed;
}
