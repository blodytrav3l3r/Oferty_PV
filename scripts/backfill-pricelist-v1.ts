#!/usr/bin/env node
/**
 * backfill-pricelist-v1.ts (F2 — Expand & Contract, krok 2).
 *
 * Tworzy seq:1 v1 ACTIVE (effectiveFrom=now) z tabel LIVE per typ
 * (rury, studnie, preco) — wstawianie przez chunkedCreateMany/25.
 *
 * URUCHAMIANIE RĘCZNE (nie w migracji, nie przy starcie):
 *   npx ts-node scripts/backfill-pricelist-v1.ts
 *
 * Idempotentny: typ z istniejącą wersją jest pomijany.
 * Po backfillu: verifySnapshot PASS + dymny (oferta v1 → draft v2 → activate).
 */

import 'dotenv/config';
import { randomUUID } from 'crypto';
import prisma, { Prisma } from '../src/prismaClient';
import { chunkedCreateMany } from '../src/utils/prismaBatch';
import { sha256Canonical } from '../src/services/priceOverrideService';

type Tx = Prisma.TransactionClient;

async function backfillRury(versionId: string): Promise<number> {
    const live = await prisma.productsRury.findMany({ orderBy: { id: 'asc' } });
    await prisma.$transaction(async (tx: Tx) => {
        await chunkedCreateMany(
            tx.pricelistItemRury,
            live.map((row) => ({ ...row, id: `${versionId}:${row.id}`, versionId }))
        );
    });
    return live.length;
}

async function backfillStudnie(versionId: string): Promise<number> {
    const live = await prisma.productsStudnie.findMany({ orderBy: { id: 'asc' } });
    await prisma.$transaction(async (tx: Tx) => {
        await chunkedCreateMany(
            tx.pricelistItemStudnie,
            live.map((row) => ({ ...row, id: `${versionId}:${row.id}`, versionId }))
        );
    });
    return live.length;
}

async function backfillPreco(versionId: string): Promise<number> {
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

const BACKFILLERS: Record<string, (versionId: string) => Promise<number>> = {
    rury: backfillRury,
    studnie: backfillStudnie,
    preco: backfillPreco
};

async function main(): Promise<void> {
    const nowIso = new Date().toISOString();
    for (const type of Object.keys(BACKFILLERS)) {
        const existing = await prisma.pricelistVersion.count({ where: { type } });
        if (existing > 0) {
            console.log(`[backfill] ${type}: pomijam (istnieje ${existing} wersji)`);
            continue;
        }
        const id = randomUUID();
        const count = await BACKFILLERS[type](id);
        await prisma.pricelistVersion.create({
            data: {
                id,
                type,
                seq: 1,
                version: 'v1',
                status: 'ACTIVE',
                effectiveFrom: nowIso,
                createdBy: 'backfill',
                note: 'Backfill v1.0.0 z LIVE (F2)',
                sha256: sha256Canonical({ type, count, at: nowIso }),
                createdAt: nowIso
            }
        });
        console.log(`[backfill] ${type}: v1 ACTIVE, wierszy=${count}, effectiveFrom=${nowIso}`);
    }
}

main()
    .catch((err: unknown) => {
        console.error('[backfill] Blad:', err);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
