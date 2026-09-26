#!/usr/bin/env node
/**
 * prices-verify.ts
 *
 * Weryfikuje spojnosc trzech warstw cennikow (LIVE vs *_Default vs plik
 * data/price_defaults.json). Read-only — niczego nie zapisuje.
 *
 * Uzycie:
 *   npm run prices:verify
 *
 * Kody wyjscia:
 *   0 = zgodne albo SKIP (brak pliku: swieza instalacja / CI)
 *   1 = dryf — w logu lista sekcji + podpowiedz (npm run prices:export)
 */

import 'dotenv/config';
import prisma from '../src/prismaClient';
import { priceOverrideService } from '../src/services/priceOverrideService';

async function main(): Promise<void> {
    const result = await priceOverrideService.verifySnapshot();

    if (result.skipped) {
        console.log(`[prices:verify] SKIP: ${result.skipReason}`);
        return;
    }

    const live = result.live;
    const file = result.file;
    console.log(
        `[prices:verify] live: rury=${live.rury}, studnie=${live.studnie}, ` +
            `preco=${live.precoKonfig}+${live.precoKinety}+${live.precoZakresy}`
    );
    console.log(
        `[prices:verify] plik: rury=${file?.rury}, studnie=${file?.studnie}, ` +
            `preco=${file?.precoKonfig}+${file?.precoKinety}+${file?.precoZakresy} ` +
            `(export: ${file?.exportedAt ?? 'brak'})`
    );

    if (!result.ok) {
        for (const issue of result.issues) {
            console.error(`[prices:verify] DRYF: ${issue}`);
        }
        process.exit(1);
    }
    console.log('[prices:verify] OK — snapshot zgodny z baza (LIVE = Default = plik).');
}

main()
    .catch((err: unknown) => {
        console.error('[prices:verify] Blad:', err);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
