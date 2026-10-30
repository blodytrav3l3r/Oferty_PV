/**
 * Jednorazowa naprawa flag cennika studni (M.WL / M.KLB / FS.WL / FS.KLB)
 * przez skopiowanie wartości z wersji źródłowej do wersji docelowych.
 *
 * Powód: bug normalizacji gubił flagi boolean (true → 0) przy wczytywaniu
 * wersji do siatki; zapis utrwalał zera w wersji.
 *
 * Użycie (dry-run — nic nie zapisuje):
 *   npx ts-node --transpile-only scripts/restore-pricelist-flags.ts \
 *     --source=<versionId> --targets=<id1,id2>
 *
 * Zapis (Tier 🔴 — tylko na jawne GO):
 *   npx ts-node --transpile-only scripts/restore-pricelist-flags.ts \
 *     --source=<versionId> --targets=<id1,id2> --apply
 *
 * Opcje:
 *   --fields=magazynWL,magazynKLB,formaStandardowa,formaStandardowaKLB  (domyślnie wszystkie 4)
 *   --limit=50   liczba próbek diff w wydruku (domyślnie 50)
 */
import { writeFileSync } from 'fs';
import { prisma } from '../src/prismaClient';
import { getVersionExport } from '../src/services/pricelist/export';
import { validateRows } from '../src/services/pricelist/validation';
import { sha256Canonical } from '../src/services/priceOverrideService';

type FlagField = 'magazynWL' | 'magazynKLB' | 'formaStandardowa' | 'formaStandardowaKLB';

const ALL_FIELDS: FlagField[] = [
    'magazynWL',
    'magazynKLB',
    'formaStandardowa',
    'formaStandardowaKLB'
];

interface ChangedRow {
    rowId: string;
    flags: Partial<Record<FlagField, boolean>>;
    before: Partial<Record<FlagField, boolean>>;
}

function argValue(name: string): string | null {
    const prefix = `--${name}=`;
    const hit = process.argv.slice(2).find((a) => a.startsWith(prefix));
    return hit ? hit.slice(prefix.length) : null;
}

function hasFlag(name: string): boolean {
    return process.argv.slice(2).includes(`--${name}`);
}

function requireArg(name: string): string {
    const value = argValue(name);
    if (!value) {
        console.error(`BŁĄD: brak --${name}=...`);
        process.exit(1);
    }
    return value;
}

function parseFields(): FlagField[] {
    const raw = argValue('fields');
    if (!raw) return ALL_FIELDS;
    const list = raw
        .split(',')
        .map((f) => f.trim())
        .filter(Boolean) as FlagField[];
    const unknown = list.filter((f) => !ALL_FIELDS.includes(f));
    if (unknown.length > 0) {
        console.error(`BŁĄD: nieznane pola: ${unknown.join(', ')}`);
        process.exit(1);
    }
    return list;
}

function asBool(value: unknown): boolean {
    return value === true || value === 1;
}

async function loadStudnieRows(versionId: string): Promise<Array<Record<string, unknown>>> {
    const { version, sections } = await getVersionExport(versionId);
    if (version.type !== 'studnie') {
        throw new Error(`Wersja ${versionId} ma typ ${version.type}, oczekiwano studnie`);
    }
    return sections.studnie ?? [];
}

async function main(): Promise<void> {
    const sourceId = requireArg('source');
    const targetIds = requireArg('targets')
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean);
    const fields = parseFields();
    const apply = hasFlag('apply');
    const limit = Number(argValue('limit') ?? 50);

    if (targetIds.includes(sourceId)) {
        console.error('BŁĄD: źródło nie może być celem');
        process.exit(1);
    }

    const sourceRows = await loadStudnieRows(sourceId);
    const sourceById = new Map<string, Record<string, unknown>>();
    for (const row of sourceRows) sourceById.set(String(row.id), row);
    console.log(`Źródło ${sourceId}: ${sourceRows.length} wierszy`);

    for (const targetId of targetIds) {
        const targetRows = await loadStudnieRows(targetId);
        const changed: ChangedRow[] = [];
        const perField: Record<string, { up: number; down: number }> = {};
        for (const field of fields) perField[field] = { up: 0, down: 0 };

        for (const row of targetRows) {
            const rowId = String(row.id);
            const source = sourceById.get(rowId);
            if (!source) continue;
            const flags: Partial<Record<FlagField, boolean>> = {};
            const before: Partial<Record<FlagField, boolean>> = {};
            for (const field of fields) {
                const want = asBool(source[field]);
                const have = asBool(row[field]);
                if (want === have) continue;
                flags[field] = want;
                before[field] = have;
                if (want) perField[field].up++;
                else perField[field].down++;
            }
            if (Object.keys(flags).length > 0) changed.push({ rowId, flags, before });
        }

        const totalFields = fields.reduce(
            (acc, field) => acc + perField[field].up + perField[field].down,
            0
        );
        console.log(`\n=== ${targetId}: ${changed.length} wierszy, ${totalFields} pól ===`);
        for (const field of fields) {
            console.log(`  ${field}: 0→1 ${perField[field].up} | 1→0 ${perField[field].down}`);
        }
        const samples = changed.slice(0, Number.isFinite(limit) ? limit : 50);
        for (const c of samples) {
            const parts = Object.keys(c.flags).map(
                (f) =>
                    `${f}: ${c.before[f as FlagField] ? 1 : 0} → ${c.flags[f as FlagField] ? 1 : 0}`
            );
            console.log(`  ${c.rowId}: ${parts.join(', ')}`);
        }
        if (changed.length > samples.length) {
            console.log(`  … ${changed.length - samples.length} wierszy więcej`);
        }

        if (!apply) continue;

        const snapshotPath = argValue('snapshot');
        if (snapshotPath) {
            const snapshot: Record<string, unknown> = {};
            for (const c of changed) {
                snapshot[c.rowId] = {};
                for (const field of fields) {
                    (snapshot[c.rowId] as Record<string, boolean>)[field] = !!c.before[field];
                }
            }
            // Osobny plik per cel — inaczej druga wersja nadpisuje snapshot pierwszej.
            const file = /\.json$/i.test(snapshotPath)
                ? snapshotPath.replace(/\.json$/i, `-${targetId}.json`)
                : `${snapshotPath}-${targetId}.json`;
            writeFileSync(file, JSON.stringify(snapshot, null, 1), 'utf-8');
            console.log(`  Snapshot stanu sprzed: ${file}`);
        }

        await prisma.$transaction(async (tx) => {
            for (const c of changed) {
                await tx.pricelistItemStudnie.update({
                    where: { id: `${targetId}:${c.rowId}` },
                    data: c.flags
                });
            }
        });

        // SHA musi odpowiadać nowym wierszom, inaczej kolejna edycja z UI
        // dostanie 409 STALE_DRAFT.
        const afterRows = await loadStudnieRows(targetId);
        const sha256 = sha256Canonical(validateRows('studnie', afterRows));
        await prisma.pricelistVersion.update({
            where: { id: targetId },
            data: { sha256, updatedAt: new Date().toISOString() }
        });
        console.log(`  ZAPISANE. Nowy sha256: ${sha256}`);
    }

    if (!apply) {
        console.log('\nDRY-RUN: nic nie zapisano. Dodaj --apply po akceptacji listy.');
    }
}

main()
    .catch((err) => {
        console.error('BŁĄD:', err instanceof Error ? err.message : err);
        process.exitCode = 1;
    })
    .finally(() => {
        void prisma.$disconnect();
    });
