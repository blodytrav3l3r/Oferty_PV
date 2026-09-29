/**
 * ensureActiveVersions — auto-heal braku ACTIVE po `git pull` / świeżym seedzie.
 * Idempotentne: typ z istniejącą wersją pomijany; LIVE puste → skip (przed seedem).
 * Nie mutuje ofert (stare mają pricelistVersionId=null = legacy, I-001 safe).
 */
import { randomUUID } from 'crypto';
import prisma, { Prisma } from '../prismaClient';
import { chunkedCreateMany } from '../utils/prismaBatch';
import { sha256Canonical } from './priceOverrideService';
import { logger } from '../utils/logger';

type Tx = Prisma.TransactionClient;
type PricelistType = 'rury' | 'studnie' | 'preco';

async function liveCount(type: PricelistType): Promise<number> {
    if (type === 'rury') return prisma.productsRury.count();
    if (type === 'studnie') return prisma.productsStudnie.count();
    const [k, n, z] = await Promise.all([
        prisma.precoKonfig.count(),
        prisma.precoKinety.count(),
        prisma.precoZakresy.count()
    ]);
    return k + n + z;
}

async function copyLiveToVersion(type: PricelistType, versionId: string): Promise<number> {
    if (type === 'rury') {
        const live = await prisma.productsRury.findMany({ orderBy: { id: 'asc' } });
        await prisma.$transaction(async (tx: Tx) => {
            await chunkedCreateMany(
                tx.pricelistItemRury,
                live.map((row) => ({ ...row, id: `${versionId}:${row.id}`, versionId }))
            );
        });
        return live.length;
    }
    if (type === 'studnie') {
        const live = await prisma.productsStudnie.findMany({ orderBy: { id: 'asc' } });
        await prisma.$transaction(async (tx: Tx) => {
            await chunkedCreateMany(
                tx.pricelistItemStudnie,
                live.map((row) => ({ ...row, id: `${versionId}:${row.id}`, versionId }))
            );
        });
        return live.length;
    }
    const [konfig, kinety, zakresy] = await Promise.all([
        prisma.precoKonfig.findMany({ orderBy: { key: 'asc' } }),
        prisma.precoKinety.findMany({ orderBy: [{ wellDn: 'asc' }, { order: 'asc' }] }),
        prisma.precoZakresy.findMany({ orderBy: [{ wellDn: 'asc' }, { order: 'asc' }] })
    ]);
    await prisma.$transaction(async (tx: Tx) => {
        await chunkedCreateMany(
            tx.pricelistItemPrecoKonfig,
            konfig.map((row) => ({ ...row, id: `${versionId}:${row.id}`, versionId }))
        );
        await chunkedCreateMany(
            tx.pricelistItemPrecoKinety,
            kinety.map((row) => ({ ...row, id: `${versionId}:${row.id}`, versionId }))
        );
        await chunkedCreateMany(
            tx.pricelistItemPrecoZakresy,
            zakresy.map((row) => ({ ...row, id: `${versionId}:${row.id}`, versionId }))
        );
    });
    return konfig.length + kinety.length + zakresy.length;
}

/** Tworzy v1 ACTIVE z LIVE dla typów bez żadnej wersji. Zwraca utworzone typy. */
export async function ensureActivePricelistVersions(): Promise<PricelistType[]> {
    const created: PricelistType[] = [];
    for (const type of ['rury', 'studnie', 'preco'] as const) {
        let existing = 0;
        try {
            existing = await prisma.pricelistVersion.count({ where: { type } });
        } catch {
            return created; // tabela sprzed migracji — check-db/ensure-db to naprawi
        }
        if (existing > 0) continue;
        const live = await liveCount(type);
        if (live === 0) continue;
        const id = randomUUID();
        const nowIso = new Date().toISOString();
        const count = await copyLiveToVersion(type, id);
        await prisma.pricelistVersion.create({
            data: {
                id,
                type,
                seq: 1,
                version: 'v1',
                status: 'ACTIVE',
                effectiveFrom: nowIso,
                createdBy: 'auto-ensure',
                note: 'Auto v1 z LIVE (start serwera)',
                sha256: sha256Canonical({ type, count, at: nowIso }),
                createdAt: nowIso
            }
        });
        logger.info('Server', `[auto-ensure] ${type}: v1 ACTIVE, wierszy=${count}`);
        created.push(type);
    }
    return created;
}
