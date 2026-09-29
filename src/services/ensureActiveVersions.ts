/**
 * ensureActiveVersions — auto-heal braku ACTIVE po `git pull` / świeżym seedzie.
 * Idempotentne: typ z istniejącą wersją pomijany; LIVE puste → skip (przed seedem).
 * Nie mutuje ofert (stare mają pricelistVersionId=null = legacy, I-001 safe).
 *
 * REWRITE (nie reuse createDraft): serwis tworzy SCHEDULED/BACKDATE_REQUESTED
 * (createDraftTx, linie ~322-369), a ensure potrzebuje od razu ACTIVE dla
 * pustego typu. createDraft+activate = 2 transakcje = okno partial-write.
 * Jedna $transaction per typ: check + sha256(rows) + versionLabel jak serwis
 * + create wersji + insert items. Race: lock modułowy per-type + catch P2002
 * (@@unique type,seq) → re-read → skip.
 */
import { randomUUID } from 'crypto';
import prisma, { Prisma } from '../prismaClient';
import { createModuleLock } from '../middleware/writeLock';
import { chunkedCreateMany } from '../utils/prismaBatch';
import { sha256Canonical } from './priceOverrideService';
import { versionLabel } from './pricelistVersionService';
import { logger } from '../utils/logger';

type Tx = Prisma.TransactionClient;
type PricelistType = 'rury' | 'studnie' | 'preco';

/** Limit prób przy kolizji seq (wzorzec SEQ_RETRY_LIMIT z serwisu). */
const ENSURE_RETRY_LIMIT = 3;

const typeLocks = new Map<PricelistType, ReturnType<typeof createModuleLock>>();

function lockFor(type: PricelistType): ReturnType<typeof createModuleLock> {
    let lock = typeLocks.get(type);
    if (!lock) {
        lock = createModuleLock();
        typeLocks.set(type, lock);
    }
    return lock;
}

function isUniqueViolation(err: unknown): boolean {
    return (
        err !== null &&
        typeof err === 'object' &&
        'code' in err &&
        (err as { code: unknown }).code === 'P2002'
    );
}

/** Jeden typ: check + kopia LIVE + create ACTIVE w JEDNEJ transakcji. Null = skip. */
async function ensureOneTypeTx(type: PricelistType): Promise<PricelistType | null> {
    return prisma.$transaction(async (tx: Tx) => {
        const existing = await tx.pricelistVersion.count({ where: { type } });
        if (existing > 0) return null;

        const nowIso = new Date().toISOString();
        const id = randomUUID();

        if (type === 'rury') {
            const live = await tx.productsRury.findMany({ orderBy: { id: 'asc' } });
            if (live.length === 0) return null;
            // Seq stałe = 1: create tylko gdy zero wersji, więc race dwóch startów
            // celuje w ten sam (type, seq) → drugi dostaje P2002 → re-read → skip.
            const seq = 1;
            const version = await tx.pricelistVersion.create({
                data: {
                    id,
                    type,
                    seq,
                    version: versionLabel(seq, nowIso),
                    status: 'ACTIVE',
                    effectiveFrom: nowIso,
                    createdBy: 'auto-ensure',
                    note: `Auto ${versionLabel(seq, nowIso)} z LIVE (start serwera)`,
                    sha256: sha256Canonical(live),
                    createdAt: nowIso
                }
            });
            await chunkedCreateMany(
                tx.pricelistItemRury,
                live.map((row) => ({ ...row, id: `${id}:${row.id}`, versionId: id }))
            );
            logger.info(
                'Server',
                `[auto-ensure] ${type}: ${version.version} ACTIVE, wierszy=${live.length}`
            );
            return type;
        }

        if (type === 'studnie') {
            const live = await tx.productsStudnie.findMany({ orderBy: { id: 'asc' } });
            if (live.length === 0) return null;
            // Seq stałe = 1: create tylko gdy zero wersji, więc race dwóch startów
            // celuje w ten sam (type, seq) → drugi dostaje P2002 → re-read → skip.
            const seq = 1;
            const version = await tx.pricelistVersion.create({
                data: {
                    id,
                    type,
                    seq,
                    version: versionLabel(seq, nowIso),
                    status: 'ACTIVE',
                    effectiveFrom: nowIso,
                    createdBy: 'auto-ensure',
                    note: `Auto ${versionLabel(seq, nowIso)} z LIVE (start serwera)`,
                    sha256: sha256Canonical(live),
                    createdAt: nowIso
                }
            });
            await chunkedCreateMany(
                tx.pricelistItemStudnie,
                live.map((row) => ({ ...row, id: `${id}:${row.id}`, versionId: id }))
            );
            logger.info(
                'Server',
                `[auto-ensure] ${type}: ${version.version} ACTIVE, wierszy=${live.length}`
            );
            return type;
        }

        const [konfig, kinety, zakresy] = await Promise.all([
            tx.precoKonfig.findMany({ orderBy: { key: 'asc' } }),
            tx.precoKinety.findMany({ orderBy: [{ wellDn: 'asc' }, { order: 'asc' }] }),
            tx.precoZakresy.findMany({ orderBy: [{ wellDn: 'asc' }, { order: 'asc' }] })
        ]);
        if (konfig.length + kinety.length + zakresy.length === 0) return null;
        const rows = { konfig, kinety, zakresy };
        // Seq stałe = 1: create tylko gdy zero wersji, więc race dwóch startów
        // celuje w ten sam (type, seq) → drugi dostaje P2002 → re-read → skip.
        const seq = 1;
        const version = await tx.pricelistVersion.create({
            data: {
                id,
                type,
                seq,
                version: versionLabel(seq, nowIso),
                status: 'ACTIVE',
                effectiveFrom: nowIso,
                createdBy: 'auto-ensure',
                note: `Auto ${versionLabel(seq, nowIso)} z LIVE (start serwera)`,
                sha256: sha256Canonical(rows),
                createdAt: nowIso
            }
        });
        await chunkedCreateMany(
            tx.pricelistItemPrecoKonfig,
            konfig.map((row) => ({ ...row, id: `${id}:${row.id}`, versionId: id }))
        );
        await chunkedCreateMany(
            tx.pricelistItemPrecoKinety,
            kinety.map((row) => ({ ...row, id: `${id}:${row.id}`, versionId: id }))
        );
        await chunkedCreateMany(
            tx.pricelistItemPrecoZakresy,
            zakresy.map((row) => ({ ...row, id: `${id}:${row.id}`, versionId: id }))
        );
        const count = konfig.length + kinety.length + zakresy.length;
        logger.info('Server', `[auto-ensure] ${type}: ${version.version} ACTIVE, wierszy=${count}`);
        return type;
    });
}

async function ensureOneType(type: PricelistType): Promise<PricelistType | null> {
    const lock = lockFor(type);
    for (let round = 1; round <= 2; round++) {
        const res = await lock.runWithLock(async () => {
            for (let attempt = 1; attempt <= ENSURE_RETRY_LIMIT; attempt++) {
                try {
                    return await ensureOneTypeTx(type);
                } catch (err) {
                    if (!isUniqueViolation(err)) throw err;
                    // Race cross-process: drugi start wygrał — re-read, idempotentny skip.
                    const existing = await prisma.pricelistVersion.count({ where: { type } });
                    if (existing > 0) return null;
                }
            }
            return null;
        });
        if (res.acquired) return res.value;
        // Lock zajęty = drugi start w trakcie — jego wynik rozstrzyga.
        const existing = await prisma.pricelistVersion.count({ where: { type } });
        if (existing > 0) return null;
    }
    return null;
}

/** Tworzy ACTIVE z LIVE dla typów bez żadnej wersji. Zwraca utworzone typy. */
export async function ensureActivePricelistVersions(): Promise<PricelistType[]> {
    const created: PricelistType[] = [];
    for (const type of ['rury', 'studnie', 'preco'] as const) {
        try {
            const done = await ensureOneType(type);
            if (done) created.push(done);
        } catch {
            return created; // tabela sprzed migracji — check-db/ensure-db to naprawi
        }
    }
    return created;
}
