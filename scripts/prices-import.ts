#!/usr/bin/env node
/**
 * prices-import.ts
 *
 * Przywraca cenniki z data/price_defaults.json (lub wskazanego pliku) do
 * tabel LIVE + *_Default. Domyślnie DRY-RUN: liczy i wypisuje diff, nic nie
 * zapisuje. Zapis wymaga `--force` i zostawia wpis w audycie — etap 1 zamraża
 * LIVE, więc import jest świadomą operacją administratora, a nie skutkiem
 * ubocznym startu serwera.
 *
 * Uzycie:
 *   npm run prices:import                      # dry-run (diff, bez zapisu)
 *   npm run prices:import -- --force           # zapis do LIVE + *_Default
 *   npm run prices:import -- sciezka.json      # dry-run z innego pliku
 *   npm run prices:import -- sciezka.json --force
 */

import 'dotenv/config';
import prisma from '../src/prismaClient';
import { logAudit } from '../src/services/auditService';
import { priceOverrideService } from '../src/services/priceOverrideService';

async function main(): Promise<void> {
    const args = process.argv.slice(2);
    const apply = args.includes('--force');
    const filePath = args.find((arg) => !arg.startsWith('--'));
    const summary = await priceOverrideService.restoreDefaultsFromJson(filePath, {
        force: true,
        dryRun: !apply
    });

    if (!summary) {
        console.error('[prices:import] Nie przywrocono cen — sprawdz logi serwera.');
        process.exit(1);
    }

    const mode = apply ? 'ZAPIS' : 'DRY-RUN (bez zapisu)';
    console.log(`[prices:import] Tryb: ${mode}`);
    console.log(
        `[prices:import] W pliku: rury=${summary.rury}, studnie=${summary.studnie}, ` +
            `preco=${summary.precoKonfig}+${summary.precoKinety}+${summary.precoZakresy}`
    );
    console.log('[prices:import] Diff per sekcja (dodane/usuniete/zmienione):');
    console.log(`  rury:        ${JSON.stringify(summary.diff.rury)}`);
    console.log(`  studnie:     ${JSON.stringify(summary.diff.studnie)}`);
    console.log(`  precoKonfig: ${JSON.stringify(summary.diff.precoKonfig)}`);
    console.log(`  precoKinety: ${JSON.stringify(summary.diff.precoKinety)}`);
    console.log(`  precoZakresy:${JSON.stringify(summary.diff.precoZakresy)}`);

    if (!apply) {
        console.log('[prices:import] Nic nie zapisano. Dodaj --force, by zastosowac import.');
        return;
    }

    await logAudit('pricelist_live', 'defaults', 'system:prices-import', 'LIVE_RESTORE_FROM_JSON', {
        file: filePath ?? 'data/price_defaults.json',
        diff: summary.diff
    });
    console.log('[prices:import] Zapisano i zapisano wpis w audycie.');
}

main()
    .catch((err: unknown) => {
        console.error('[prices:import] Blad:', err);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
