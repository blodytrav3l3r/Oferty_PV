#!/usr/bin/env node
/**
 * prices-import.ts
 *
 * Przywraca cenniki z data/price_defaults.json (lub wskazanego pliku) do
 * tabel LIVE + *_Default. Pominia guard timestamp (force) — import jest
 * swiadoma operacja administratora. Wypisuje raport diff per sekcje.
 *
 * Uzycie:
 *   npm run prices:import
 *   npm run prices:import data/price_defaults.json
 *   npm run prices:import sciezka/do/price_defaults.json
 */

import 'dotenv/config';
import prisma from '../src/prismaClient';
import { priceOverrideService } from '../src/services/priceOverrideService';

async function main(): Promise<void> {
    const filePath = process.argv[2];
    const summary = await priceOverrideService.restoreDefaultsFromJson(filePath, {
        force: true
    });

    if (!summary) {
        console.error('[prices:import] Nie przywrocono cen — sprawdz logi serwera.');
        process.exit(1);
    }

    console.log(
        `[prices:import] Przywrocono: rury=${summary.rury}, studnie=${summary.studnie}, ` +
            `preco=${summary.precoKonfig}+${summary.precoKinety}+${summary.precoZakresy}`
    );
    console.log('[prices:import] Diff per sekcja (dodane/usuniete/zmienione):');
    console.log(`  rury:        ${JSON.stringify(summary.diff.rury)}`);
    console.log(`  studnie:     ${JSON.stringify(summary.diff.studnie)}`);
    console.log(`  precoKonfig: ${JSON.stringify(summary.diff.precoKonfig)}`);
    console.log(`  precoKinety: ${JSON.stringify(summary.diff.precoKinety)}`);
    console.log(`  precoZakresy:${JSON.stringify(summary.diff.precoZakresy)}`);
}

main()
    .catch((err: unknown) => {
        console.error('[prices:import] Blad:', err);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
