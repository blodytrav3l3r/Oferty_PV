#!/usr/bin/env node
/**
 * prices-verify.ts
 *
 * Weryfikuje spojnosc warstw cennikow:
 *   1) LIVE vs *_Default vs plik data/price_defaults.json (stan od S5) — blad,
 *   2) ACTIVE (wersje) vs LIVE — WARN, a z `--strict` blad.
 *
 * Punkt 2 istnieje, bo nic nie synchronizuje LIVE po `approveVersion`; rozjazd
 * cen (5 dennic DN1200: 1150 vs 1050) przeszedl przez wszystkie bramy.
 * Read-only — niczego nie zapisuje.
 *
 * Uzycie:
 *   npm run prices:verify
 *   npx ts-node --transpile-only scripts/prices-verify.ts --strict
 *
 * Kody wyjscia:
 *   0 = zgodne albo SKIP (brak pliku: swieza instalacja / CI), dryf ACTIVE vs LIVE = WARN
 *   1 = dryf snapshotu (LIVE/Default/plik) albo dowolny dryf przy --strict
 */

import 'dotenv/config';
import prisma from '../src/prismaClient';
import { priceOverrideService } from '../src/services/priceOverrideService';
import { collectDrift, formatDrift } from '../src/services/pricelist/drift';
import type { DriftType } from '../src/services/pricelist/drift';

const DRIFT_TYPES: DriftType[] = ['rury', 'studnie', 'preco'];
const SAMPLE_LIMIT = 5;

/** Sekcja ACTIVE vs LIVE. Zwraca false tylko gdy rozjazd jest realny (nie: brak ACTIVE). */
async function reportDrift(): Promise<boolean> {
    let ok = true;
    for (const type of DRIFT_TYPES) {
        try {
            const report = await collectDrift(type, SAMPLE_LIMIT);
            const line = formatDrift(report);
            if (report.noActive) {
                console.warn(`[prices:verify] ACTIVE vs LIVE ${line}`);
                continue;
            }
            if (report.ok) {
                console.log(`[prices:verify] ACTIVE vs LIVE ${line}`);
                continue;
            }
            ok = false;
            console.warn(`[prices:verify] ROZJAZD ${line}`);
            for (const sample of report.samples) {
                console.warn(
                    `[prices:verify]   ${sample.key} ${sample.kind} ` +
                        `${sample.field}: live=${String(sample.live)} active=${String(sample.active)}`
                );
            }
            console.warn(
                '[prices:verify]   ACTIVE jest zrodlem cen ofert — rozjazd oznacza, ze LIVE ' +
                    '(eksport/rollback) klamie o cenach.'
            );
        } catch (err: unknown) {
            ok = false;
            console.error(
                `[prices:verify] Blad porownania ACTIVE vs LIVE (${type}):`,
                err instanceof Error ? err.message : err
            );
        }
    }
    return ok;
}

async function main(): Promise<void> {
    const strict = process.argv.slice(2).includes('--strict');
    let snapshotOk = true;

    const result = await priceOverrideService.verifySnapshot();

    if (result.skipped) {
        console.log(`[prices:verify] SKIP: ${result.skipReason}`);
    } else {
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
            snapshotOk = false;
            for (const issue of result.issues) {
                console.error(`[prices:verify] DRYF: ${issue}`);
            }
        } else {
            console.log('[prices:verify] OK — snapshot zgodny z baza (LIVE = Default = plik).');
        }
    }

    const driftOk = await reportDrift();

    if (!snapshotOk) process.exit(1);
    if (!driftOk && strict) {
        console.error('[prices:verify] --strict: rozjazd ACTIVE vs LIVE traktowany jak blad.');
        process.exit(1);
    }
    if (!driftOk) {
        console.warn(
            '[prices:verify] WARN: rozjazd ACTIVE vs LIVE (exit 0). Uzyj --strict, by blokowac CI.'
        );
    }
}

main()
    .catch((err: unknown) => {
        console.error('[prices:verify] Blad:', err);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
