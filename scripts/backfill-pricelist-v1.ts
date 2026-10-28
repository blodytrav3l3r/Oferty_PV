#!/usr/bin/env node
/**
 * backfill-pricelist-v1.ts (F2 — Expand & Contract, krok 2).
 *
 * Ręczne uruchomienie bootstrapu wersji bazowej: seq:1 APPROVED
 * (etykieta {R|S|P}v1-{RRRRMMDD}, effectiveFrom=now) z tabel LIVE per typ
 * (rury, studnie, preco).
 *
 *   npx ts-node scripts/backfill-pricelist-v1.ts
 *
 * Serwer robi to samo automatycznie przy starcie (`ensureBaselineVersionsAtStartup`),
 * więc skrypt jest tylko awaryjnym/świadomym wywołaniem — ta sama, idempotentna
 * funkcja: typ z istniejącą wersją jest pomijany, pusty LIVE też.
 */

import 'dotenv/config';
import prisma from '../src/prismaClient';
import { ensureBaselineVersions } from '../src/services/pricelist/bootstrap';

async function main(): Promise<void> {
    const created = await ensureBaselineVersions();
    if (created.length === 0) {
        console.log('[backfill] Nic do zrobienia — każda oś ma już wersję albo puste LIVE.');
        return;
    }
    for (const info of created) {
        console.log(`[backfill] ${info.type}: ${info.version} APPROVED, wierszy=${info.rows}`);
    }
}

main()
    .catch((err: unknown) => {
        console.error('[backfill] Błąd:', err);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
