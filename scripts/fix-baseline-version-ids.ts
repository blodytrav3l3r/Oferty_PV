#!/usr/bin/env node
/**
 * fix-baseline-version-ids.ts — jednorazowa naprawa ID wersji bazowych.
 *
 * Bootstrap `ensureBaselineVersions` tworzył id z surowego ISO-8601, więc
 * w bazie zostały `rury-baseline-<ISO z ':'>`. Trasy walidują id jako
 * `[A-Za-z0-9_-]{1,64}` (pricelistVersions.ts), dlatego export/clone-draft
 * zwracały 400 INVALID_ID. Generator jest już poprawiony — ten skrypt
 * przenosi istniejące wiersze na poprawne id bez utraty danych.
 *
 *   npx ts-node scripts/fix-baseline-version-ids.ts          # plan (dry-run)
 *   npx ts-node scripts/fix-baseline-version-ids.ts --apply  # zapis
 *
 * Zapis: `UPDATE PricelistVersion SET id = <nowe>` (FK pozycji mają
 * ON UPDATE CASCADE, więc `versionId` idzie za nagłówkiem), przepisanie
 * prefiksu `id` pozycji (`<versionId>:<liveId>`), pieczątki ofert/zamówień
 * (`pricelistVersionId` to zwykła kolumna, bez FK). Jedna transakcja per
 * wersja + kontrola liczby wierszy przed/po. `seq`, `status`, `effectiveFrom`
 * i `sha256` zostają bez zmian.
 */

import 'dotenv/config';
import prisma from '../src/prismaClient';

/** Tabele pozycji wersji (FK → PricelistVersion, ON UPDATE CASCADE). */
const ITEM_TABLES = [
    'pricelistItemRury',
    'pricelistItemStudnie',
    'pricelistItemPrecoKonfig',
    'pricelistItemPrecoKinety',
    'pricelistItemPrecoZakresy'
] as const;

/** Pieczątki ofert/zamówień trzymające id wersji bez FK. */
const STAMP_TABLES = [
    'offers_rel',
    'offers_studnie_rel',
    'orders_rury_rel',
    'orders_studnie_rel'
] as const;

const VALID_ID = /^[A-Za-z0-9_-]{1,64}$/;

interface PlannedRename {
    oldId: string;
    newId: string;
    type: string;
    items: Record<string, number>;
    stamps: Record<string, number>;
}

async function countWhere(table: string, column: string, value: string): Promise<number> {
    const rows = await prisma.$queryRawUnsafe<{ n: bigint | number }[]>(
        `SELECT COUNT(*) AS n FROM "${table}" WHERE "${column}" = ?`,
        value
    );
    return Number(rows[0]?.n ?? 0);
}

async function countItems(
    versionId: string,
    column = 'versionId'
): Promise<Record<string, number>> {
    const counts: Record<string, number> = {};
    for (const table of ITEM_TABLES) {
        counts[table] = await countWhere(table, column, versionId);
    }
    return counts;
}

async function countStamps(versionId: string): Promise<Record<string, number>> {
    const counts: Record<string, number> = {};
    for (const table of STAMP_TABLES) {
        counts[table] = await countWhere(table, 'pricelistVersionId', versionId);
    }
    return counts;
}

async function planRenames(): Promise<PlannedRename[]> {
    const broken = await prisma.pricelistVersion.findMany({
        where: { id: { contains: ':' } },
        orderBy: { id: 'asc' }
    });
    const planned: PlannedRename[] = [];
    for (const version of broken) {
        const newId = version.id.replace(/[^A-Za-z0-9_-]/g, '');
        if (!VALID_ID.test(newId)) {
            throw new Error(`Nie da się wyprowadzić poprawnego id z "${version.id}"`);
        }
        const existing = await prisma.pricelistVersion.findUnique({ where: { id: newId } });
        if (existing) {
            throw new Error(`Docelowe id "${newId}" już istnieje (kolizja z "${version.id}")`);
        }
        planned.push({
            oldId: version.id,
            newId,
            type: version.type,
            items: await countItems(version.id),
            stamps: await countStamps(version.id)
        });
    }
    return planned;
}

async function applyRename(plan: PlannedRename): Promise<void> {
    await prisma.$transaction(async (tx) => {
        const renamed = await tx.$executeRawUnsafe(
            'UPDATE "PricelistVersion" SET "id" = ? WHERE "id" = ?',
            plan.newId,
            plan.oldId
        );
        if (renamed !== 1) throw new Error(`Nie zmieniono nagłówka "${plan.oldId}" (${renamed})`);
        for (const table of ITEM_TABLES) {
            await tx.$executeRawUnsafe(
                `UPDATE "${table}" SET "id" = replace("id", ?, ?) WHERE "versionId" = ?`,
                `${plan.oldId}:`,
                `${plan.newId}:`,
                plan.newId
            );
        }
        for (const table of STAMP_TABLES) {
            await tx.$executeRawUnsafe(
                `UPDATE "${table}" SET "pricelistVersionId" = ? WHERE "pricelistVersionId" = ?`,
                plan.newId,
                plan.oldId
            );
        }
    });
    // Kontrola po zmianie: nic nie zostało pod starym id, liczby wierszy bez zmian.
    const leftoverHeader = await prisma.pricelistVersion.count({ where: { id: plan.oldId } });
    const leftoverItems = await countItems(plan.oldId);
    const movedItems = await countItems(plan.newId);
    const movedStamps = await countStamps(plan.newId);
    const itemsOk = ITEM_TABLES.every((table) => movedItems[table] === plan.items[table]);
    const itemsLeftoverOk = ITEM_TABLES.every((table) => leftoverItems[table] === 0);
    const stampsOk = STAMP_TABLES.every((table) => movedStamps[table] === plan.stamps[table]);
    if (leftoverHeader !== 0 || !itemsOk || !itemsLeftoverOk || !stampsOk) {
        throw new Error(
            `Weryfikacja po zmianie "${plan.oldId}" nie przeszła: ` +
                `header=${leftoverHeader} items=${JSON.stringify(movedItems)} ` +
                `leftoverItems=${JSON.stringify(leftoverItems)} stamps=${JSON.stringify(movedStamps)}`
        );
    }
}

async function main(): Promise<void> {
    const apply = process.argv.includes('--apply');
    const planned = await planRenames();
    if (planned.length === 0) {
        console.log('[fix-ids] Brak wersji z niedozwolonym znakiem w id — nic do zrobienia.');
        return;
    }
    for (const plan of planned) {
        const items = Object.values(plan.items).reduce((sum, n) => sum + n, 0);
        const stamps = Object.values(plan.stamps).reduce((sum, n) => sum + n, 0);
        console.log(
            `[fix-ids] ${plan.type}: "${plan.oldId}" → "${plan.newId}" ` +
                `(pozycji=${items}, pieczątek=${stamps})`
        );
    }
    if (!apply) {
        console.log('[fix-ids] Dry-run. Powtórz z --apply, aby zapisać.');
        return;
    }
    for (const plan of planned) {
        await applyRename(plan);
        console.log(`[fix-ids] OK: ${plan.oldId} → ${plan.newId}`);
    }
}

main()
    .catch((err: unknown) => {
        console.error('[fix-ids] Błąd:', err);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
