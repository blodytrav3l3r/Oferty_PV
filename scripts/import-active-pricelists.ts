import prisma, { Prisma } from '../src/prismaClient';
import {
    ACTIVE_PACKAGE_TABLES,
    ACTIVE_PACKAGE_TYPES,
    ITEM_FIELDS,
    MONEY_FIELDS,
    moneyToPackage,
    readActivePackage,
    stableJson,
    transformPackageRow
} from '../src/services/pricelist/package';
import type { ActivePackage } from '../src/services/pricelist/package';

const TYPES = ACTIVE_PACKAGE_TYPES;
const TABLES = ACTIVE_PACKAGE_TABLES;

function canonicalRow(value: unknown): string {
    return stableJson(value);
}

function firstRowDifference(
    expected: Record<string, unknown>[],
    actual: Record<string, unknown>[],
    fields: readonly string[]
): string | null {
    if (expected.length !== actual.length) return 'row-count';
    for (let rowIndex = 0; rowIndex < expected.length; rowIndex++) {
        for (const field of fields) {
            if (canonicalRow(expected[rowIndex][field]) !== canonicalRow(actual[rowIndex][field])) {
                return `row-${rowIndex + 1}.${field}`;
            }
        }
    }
    return null;
}

async function verifyOrInsert(artifact: ActivePackage, apply: boolean): Promise<void> {
    const ids = TYPES.map((type) => artifact.versions[type].id);
    const existing = await prisma.pricelistVersion.findMany({ where: { id: { in: ids } } });
    const allExisting = await prisma.pricelistVersion.findMany({ select: { id: true } });
    const artifactIds = new Set(ids);
    if (allExisting.some((row) => !artifactIds.has(row.id))) {
        throw new Error(
            'Docelowa baza zawiera inne wersje cenników; importer wymaga pustego zakresu cenników'
        );
    }
    if (existing.length !== 0 && existing.length !== TYPES.length) {
        throw new Error('Docelowa baza zawiera tylko część wersji; przerwano bez zmian');
    }
    if (existing.length === TYPES.length) {
        for (const type of TYPES) {
            const version = artifact.versions[type];
            const rows = await prisma.pricelistVersion.findUniqueOrThrow({
                where: { id: version.id },
                include: {
                    itemsRury: true,
                    itemsStudnie: true,
                    itemsPrecoKonfig: true,
                    itemsPrecoKinety: true,
                    itemsPrecoZakresy: true
                }
            });
            if (
                rows.sha256 !== version.sha256 ||
                rows.version !== version.version ||
                rows.effectiveFrom !== version.effectiveFrom
            ) {
                throw new Error(`Wersja ${version.id} istnieje z inną metadanych`);
            }
            const relationRows: Record<(typeof TABLES)[number], Record<string, unknown>[]> = {
                pricelist_item_rury: rows.itemsRury as unknown as Record<string, unknown>[],
                pricelist_item_studnie: rows.itemsStudnie as unknown as Record<string, unknown>[],
                pricelist_item_preco_konfig: rows.itemsPrecoKonfig as unknown as Record<
                    string,
                    unknown
                >[],
                pricelist_item_preco_kinety: rows.itemsPrecoKinety as unknown as Record<
                    string,
                    unknown
                >[],
                pricelist_item_preco_zakresy: rows.itemsPrecoZakresy as unknown as Record<
                    string,
                    unknown
                >[]
            };
            for (const table of TABLES) {
                const expected = artifact.items[type][table]
                    .map((row) => transformPackageRow(table, row))
                    .sort((a, b) => String(a.id).localeCompare(String(b.id)));
                const actual = relationRows[table]
                    .map((row) =>
                        Object.fromEntries(
                            ITEM_FIELDS[table].map((key) => {
                                const value = row[key];
                                if (MONEY_FIELDS.has(key) && value !== null && value !== undefined)
                                    return [key, moneyToPackage(value)];
                                return [key, value];
                            })
                        )
                    )
                    .sort((a, b) => String(a.id).localeCompare(String(b.id)));
                const difference = firstRowDifference(expected, actual, ITEM_FIELDS[table]);
                if (difference)
                    throw new Error(`Dane ${type}.${table} różnią się od artefaktu: ${difference}`);
            }
        }
        for (const type of TYPES) {
            const key = `pricelist_active_override_${type}`;
            const expected = artifact.activeOverrides[type] ?? null;
            const current = await prisma.settings.findUnique({ where: { key } });
            if ((current?.value ?? null) !== expected)
                throw new Error(`Ustawienie ${key} różni się od artefaktu`);
        }
        console.info(`Artefakt ${artifact.sha256} jest już zaimportowany bez różnic.`);
        return;
    }
    if (!apply) {
        console.info(
            `Dry-run: można zaimportować 3 wersje i ${Object.values(artifact.counts).reduce((sum, count) => sum + count, 0)} pozycji; SHA-256 ${artifact.sha256}.`
        );
        return;
    }

    await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`LOCK TABLE "PricelistVersion" IN EXCLUSIVE MODE`;
        const lockedVersions = await tx.pricelistVersion.count();
        if (lockedVersions !== 0) {
            throw new Error(
                'Zakres cenników nie jest pusty po uzyskaniu blokady; przerwano bez zmian'
            );
        }
        for (const type of TYPES) {
            const version = artifact.versions[type];
            await tx.pricelistVersion.create({ data: version });
            const typedRows = Object.fromEntries(
                TABLES.map((table) => [
                    table,
                    artifact.items[type][table].map((row) => transformPackageRow(table, row))
                ])
            );
            if (typedRows.pricelist_item_rury.length)
                await tx.pricelistItemRury.createMany({
                    data: typedRows.pricelist_item_rury as Prisma.PricelistItemRuryCreateManyInput[]
                });
            if (typedRows.pricelist_item_studnie.length)
                await tx.pricelistItemStudnie.createMany({
                    data: typedRows.pricelist_item_studnie as Prisma.PricelistItemStudnieCreateManyInput[]
                });
            if (typedRows.pricelist_item_preco_konfig.length)
                await tx.pricelistItemPrecoKonfig.createMany({
                    data: typedRows.pricelist_item_preco_konfig as Prisma.PricelistItemPrecoKonfigCreateManyInput[]
                });
            if (typedRows.pricelist_item_preco_kinety.length)
                await tx.pricelistItemPrecoKinety.createMany({
                    data: typedRows.pricelist_item_preco_kinety as Prisma.PricelistItemPrecoKinetyCreateManyInput[]
                });
            if (typedRows.pricelist_item_preco_zakresy.length)
                await tx.pricelistItemPrecoZakresy.createMany({
                    data: typedRows.pricelist_item_preco_zakresy as Prisma.PricelistItemPrecoZakresyCreateManyInput[]
                });
        }
        for (const type of TYPES) {
            const versionId = artifact.activeOverrides[type];
            if (versionId)
                await tx.settings.create({
                    data: { key: `pricelist_active_override_${type}`, value: versionId }
                });
        }
    });
    console.info(`Zaimportowano 3 aktywne cenniki; SHA-256 ${artifact.sha256}.`);
}

async function main(): Promise<void> {
    const args = process.argv.slice(2);
    const apply = args.includes('--apply');
    const validateOnly = args.includes('--validate-only');
    const filePath = args.find((arg) => !arg.startsWith('--'));
    if (
        !filePath ||
        args.filter((arg) => !arg.startsWith('--')).length !== 1 ||
        args.some((arg) => !['--apply', '--validate-only'].includes(arg) && arg.startsWith('--')) ||
        (apply && validateOnly)
    ) {
        throw new Error(
            'Użycie: ts-node scripts/import-active-pricelists.ts <artefakt.json> [--apply]'
        );
    }
    const artifact = readActivePackage(filePath);
    if (validateOnly) {
        const totalItems = Object.values(artifact.counts).reduce((sum, count) => sum + count, 0);
        console.info(
            `Pakiet cenników poprawny: 3 aktywne wersje, ${totalItems} pozycji; SHA-256 ${artifact.sha256}.`
        );
        return;
    }
    await verifyOrInsert(artifact, apply);
}

main()
    .catch((error: unknown) => {
        console.error(
            error instanceof Error ? error.message : 'Import aktywnych cenników nie powiódł się'
        );
        process.exitCode = 1;
    })
    .finally(async () => prisma.$disconnect());
