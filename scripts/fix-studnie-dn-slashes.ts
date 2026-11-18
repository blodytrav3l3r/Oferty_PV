#!/usr/bin/env node
/**
 * fix-studnie-dn-slashes.ts
 *
 * Przywraca `dn` w formie "x/y" w aktywnej wersji cennika studni, jeśli
 * późniejsza wersja zapisała tylko pierwszą liczbę (cicha utrata danych
 * przez parseFloat — patrz `pricelistXlsx.coerceNumerics`).
 *
 * Źródło prawdy: najnowsza wcześniejsza wersja studni, która miała `dn` z "/".
 * Naprawa wymaga WSZYSTKICH warunków:
 *   - aktywny wiersz ma `dn` bez "/",
 *   - wcześniejsza wersja ma dla tego samego itemu `dn` "x/y",
 *   - pierwsza liczba z "x/y" równa się aktywnemu `dn`,
 *   - nazwa itemu zawiera pełne "x/y" (dowód, że to ta sama pozycja).
 *
 * Domyślnie dry-run. `--apply` zapisuje przez `replaceVersionRows`
 * (blokada osi, nowe sha256, wpis EDIT_APPROVED w audit_logs).
 *
 * Uzycie:
 *   npx ts-node --transpile-only scripts/fix-studnie-dn-slashes.ts
 *   npx ts-node --transpile-only scripts/fix-studnie-dn-slashes.ts --apply
 *
 * Kody wyjscia:
 *   0 = OK (dry-run lub zapis)
 *   1 = błąd odczytu/zapisu
 */

import 'dotenv/config';
import prisma from '../src/prismaClient';
import { getVersionExport } from '../src/services/pricelist/export';
import { replaceVersionRows } from '../src/services/pricelist/lifecycle';
import { resolveActive } from '../src/services/pricelist/usage';

const APPLY = process.argv.slice(2).includes('--apply');
const SYSTEM_USER = 'system:fix-dn-przejscia';

function isSlashDn(value: unknown): value is string {
    return typeof value === 'string' && /^\s*\d+\s*\/\s*\d+\s*$/.test(value);
}

/** Pierwsza liczba z "x/y" jako tekst (porównanie z aktywnym `dn`). */
function leadingNumber(value: string): string {
    return value.split('/')[0].trim();
}

function sameLeadingNumber(activeDn: unknown, slashDn: string): boolean {
    if (activeDn === null || activeDn === undefined) return false;
    return String(activeDn).trim() === leadingNumber(slashDn);
}

async function collectSlashHistory(
    beforeIso: string
): Promise<Map<string, { dn: string; version: string }>> {
    const versions = await prisma.pricelistVersion.findMany({
        where: { type: 'studnie', createdAt: { lt: beforeIso } },
        orderBy: { createdAt: 'asc' },
        select: { id: true, version: true }
    });
    const history = new Map<string, { dn: string; version: string }>();
    for (const version of versions) {
        const { sections } = await getVersionExport(version.id);
        for (const row of sections.studnie ?? []) {
            if (!isSlashDn(row.dn)) continue;
            history.set(String(row.id), { dn: row.dn.trim(), version: version.version });
        }
    }
    return history;
}

async function main(): Promise<void> {
    const active = await resolveActive('studnie');
    if (!active) {
        throw new Error('Brak aktywnej wersji cennika studni');
    }
    if (active.status !== 'APPROVED') {
        throw new Error(`Aktywna wersja ${active.version} ma status ${active.status}`);
    }
    const { sections } = await getVersionExport(active.id);
    const rows = sections.studnie ?? [];
    if (rows.length === 0) {
        throw new Error(`Aktywna wersja ${active.version} nie ma wierszy`);
    }
    const history = await collectSlashHistory(String(active.createdAt));

    let repaired = 0;
    const nextRows = rows.map((row) => {
        const previous = history.get(String(row.id));
        if (!previous) return row;
        if (typeof row.dn === 'string' && row.dn.includes('/')) return row;
        if (!sameLeadingNumber(row.dn, previous.dn)) return row;
        if (!String(row.name ?? '').includes(previous.dn)) return row;
        repaired++;
        console.log(
            `[fix-dn] ${active.version} ${String(row.id)}: dn ${String(row.dn)} → ${previous.dn}` +
                ` (źródło: ${previous.version})`
        );
        return { ...row, dn: previous.dn };
    });

    if (repaired === 0) {
        console.log(`[fix-dn] ${active.version}: brak wierszy do naprawy`);
        return;
    }
    if (!APPLY) {
        console.log(`[fix-dn] dry-run: ${repaired} wierszy; dodaj --apply, aby zapisać`);
        return;
    }
    const saved = await replaceVersionRows(active.id, nextRows, {
        userId: SYSTEM_USER,
        expectedSha: active.sha256 ?? undefined
    });
    console.log(
        `[fix-dn] zapisano ${repaired} wierszy w ${saved.version}; nowe sha256=${saved.sha256}`
    );
}

main()
    .catch((err: unknown) => {
        console.error('[fix-dn] Blad:', err instanceof Error ? err.message : err);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
