#!/usr/bin/env node
/**
 * prices-export.ts
 *
 * Eksport bieżących cenników (tabele live) do data/price_defaults.json
 * oraz do tabel *_Default. Odpowiednik przycisku "Zapisz domyślne" z CLI.
 *
 * Uzycie:
 *   npm run prices:export
 *
 * Zapisany snapshot jest gitignored (ceny nie trafiaja do publicznego repo)
 * i przenosi sie go miedzy urzadzeniami (transfer), np.:
 *   npm run prices:export                     # urzadzenie A
 *   (skopiuj data/price_defaults.json)        # -> urzadzenie B
 *   start.bat / npm run prices:import         # urzadzenie B
 */

import 'dotenv/config';
import prisma from '../src/prismaClient';
import { priceOverrideService } from '../src/services/priceOverrideService';

async function main(): Promise<void> {
    const summary = await priceOverrideService.saveDefaults();
    console.log(
        `[prices:export] Zapisano: rury=${summary.rury}, studnie=${summary.studnie}, ` +
            `preco=${summary.precoKonfig}+${summary.precoKinety}+${summary.precoZakresy}`
    );
    console.log(`[prices:export] Snapshot: ${priceOverrideService.snapshotPath}`);
}

main()
    .catch((err: unknown) => {
        console.error('[prices:export] Blad:', err);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
