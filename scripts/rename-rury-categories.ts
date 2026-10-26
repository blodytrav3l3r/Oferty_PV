#!/usr/bin/env node
/**
 * rename-rury-categories.ts — jednorazowa zmiana etykiet trzech kategorii rur.
 *
 * Dotyka DANYCH cennika: ProductsRury (Live), ProductsRuryDefault i wierszy
 * wszystkich wersji PricelistItemRury. Zmienia wyłącznie pole `category` —
 * ceny, transport, waga i powierzchnia pozostają nietknięte.
 *
 * URUCHAMIANIE RĘCZNE (najpierw backup: npm run backup):
 *   npx ts-node scripts/rename-rury-categories.ts            # dry-run (tylko podgląd)
 *   npx ts-node scripts/rename-rury-categories.ts --apply    # zapis
 *
 * Po zapisie: npm run prices:export (odświeża lokalny snapshot cen).
 *
 * Idempotentny: wiersze z etykietą docelową są pomijane, a hashe wersji są
 * przeliczane za każdym razem (naprawia stan po przerwanym przebiegu).
 *
 * Wersje APPROVED są niemutowalne przez API (assertEditable). Ten skrypt omija
 * ten guard świadomie — jawna decyzja użytkownika 2026-10-26. Dlatego po zmianie
 * wierszy przelicza PricelistVersion.sha256 DOKŁADNIE tą samą ścieżką co approve
 * (getVersionExport → validateRows → sha256Canonical) i dopisuje notę audytową.
 */

import 'dotenv/config';
import prisma from '../src/prismaClient';
import { getVersionExport } from '../src/services/pricelist/export';
import { validateRows } from '../src/services/pricelist/validation';
import { sha256Canonical } from '../src/services/priceOverrideService';

const RENAMES: ReadonlyArray<readonly [string, string]> = [
    ['Żelbetowe KL. A (II)', 'Rury Żelbetowe KL. A'],
    ['Żelbetowe KL. S (I)', 'Rury Żelbetowe KL. S'],
    ['Duże Żelbetowe II', 'Duże Rury Żelbetowe']
];

const OLD_NAMES = RENAMES.map(([oldName]) => oldName);
const NOTE_MARKER = 'Etykiety kategorii rur znormalizowane 2026-10-26';
const TX_TIMEOUT_MS = 60_000;

/** Hash wierszy wersji liczony tak samo jak w lifecycle.approveVersion. */
async function computeVersionSha(versionId: string): Promise<string> {
    const { sections } = await getVersionExport(versionId);
    return sha256Canonical(validateRows('rury', sections.rury ?? []));
}

function buildNote(current: string | null): string {
    if (current && current.includes(NOTE_MARKER)) return current;
    return current ? `${current} | ${NOTE_MARKER}` : NOTE_MARKER;
}

async function main(): Promise<void> {
    const apply = process.argv.includes('--apply');

    const versions = await prisma.pricelistVersion.findMany({
        where: { type: 'rury' },
        orderBy: { seq: 'asc' }
    });
    if (versions.length === 0) {
        console.log('[rename-rury] Brak wersji cennika rur — nic do zrobienia.');
        return;
    }

    // Kontrola ścieżki hasha PRZED mutacją: zgodność z zapisanym sha256 dowodzi,
    // że recompute po zmianie da wartość zaufaną. Rozjazd → STOP.
    const shaBefore = new Map<string, string>();
    const staleHashes: string[] = [];
    for (const v of versions) {
        const computed = await computeVersionSha(v.id);
        shaBefore.set(v.id, computed);
        if (computed !== v.sha256) {
            staleHashes.push(`${v.version} (baza ${v.sha256}, wyliczony ${computed})`);
        }
    }
    if (staleHashes.length > 0) {
        console.error('[rename-rury] STOP: hash wersji nie zgadza się z wierszami:');
        for (const line of staleHashes) console.error(`  - ${line}`);
        console.error('[rename-rury] Najpierw wyjaśnij dryf cennika — nie ruszam danych.');
        process.exitCode = 1;
        return;
    }
    console.log(`[rename-rury] Hash wersji zgodny przed zmianą (${versions.length} wersji).`);

    const liveOld = await prisma.productsRury.count({ where: { category: { in: OLD_NAMES } } });
    const defOld = await prisma.productsRuryDefault.count({
        where: { category: { in: OLD_NAMES } }
    });
    console.log(`[rename-rury] Do zmiany: ProductsRury=${liveOld}, ProductsRuryDefault=${defOld}`);

    const itemsOldByVersion = new Map<string, number>();
    for (const v of versions) {
        const count = await prisma.pricelistItemRury.count({
            where: { versionId: v.id, category: { in: OLD_NAMES } }
        });
        itemsOldByVersion.set(v.id, count);
        console.log(`[rename-rury]   ${v.version} (${v.status}): ${count} wierszy`);
    }

    if (!apply) {
        console.log('[rename-rury] dry-run — zapis: dodaj --apply');
        return;
    }

    await prisma.$transaction(
        async (tx) => {
            for (const [oldName, newName] of RENAMES) {
                await tx.productsRury.updateMany({
                    where: { category: oldName },
                    data: { category: newName }
                });
                await tx.productsRuryDefault.updateMany({
                    where: { category: oldName },
                    data: { category: newName }
                });
                await tx.pricelistItemRury.updateMany({
                    where: { category: oldName },
                    data: { category: newName }
                });
            }
        },
        { timeout: TX_TIMEOUT_MS }
    );

    // UPDATE nie zmienia rowid, więc kolejność wierszy (i tym samym kolejność
    // tablicy w hashu) jest stabilna — hash przeliczamy dopiero po commicie.
    for (const v of versions) {
        const sha256 = await computeVersionSha(v.id);
        await prisma.pricelistVersion.update({
            where: { id: v.id },
            data: { sha256, note: buildNote(v.note), updatedAt: new Date().toISOString() }
        });
        console.log(`[rename-rury] ${v.version}: sha256 → ${sha256.slice(0, 12)}…`);
    }

    console.log('[rename-rury] Zapisano. Następny krok: npm run prices:export + prices:verify.');
}

main()
    .catch((err: unknown) => {
        console.error('[rename-rury] Błąd:', err);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
