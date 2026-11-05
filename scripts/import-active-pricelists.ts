import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import prisma, { Prisma } from '../src/prismaClient';
import { sha256Canonical } from '../src/services/pricelist/canonical';
import { validateRows } from '../src/services/pricelist/validation';

const TYPES = ['rury', 'studnie', 'preco'] as const;
const TABLES = [
    'pricelist_item_rury',
    'pricelist_item_studnie',
    'pricelist_item_preco_konfig',
    'pricelist_item_preco_kinety',
    'pricelist_item_preco_zakresy'
] as const;
const MONEY_FIELDS = new Set([
    'price',
    'transport',
    'cena',
    'cena1',
    'cena2',
    'cena3',
    'doplataPEHD',
    'doplataZelbet',
    'doplataDrabNierdzewna',
    'malowanieWewnetrzne',
    'malowanieZewnetrzne'
]);
const FLOAT_FIELDS = new Set(['weight', 'area', 'areaExt']);
const REQUIRED_TABLES = {
    rury: ['pricelist_item_rury'],
    studnie: ['pricelist_item_studnie'],
    preco: [
        'pricelist_item_preco_konfig',
        'pricelist_item_preco_kinety',
        'pricelist_item_preco_zakresy'
    ]
} as const;
const BOOLEAN_FIELDS = new Set([
    'magazynWL',
    'magazynKLB',
    'formaStandardowa',
    'formaStandardowaKLB',
    'active'
]);

const versionSchema = z
    .object({
        id: z.string().min(1),
        type: z.enum(TYPES),
        seq: z.number().int().positive(),
        version: z.string().min(1),
        status: z.literal('APPROVED'),
        effectiveFrom: z.string().datetime({ offset: true }),
        createdBy: z.string().nullable(),
        note: z.string().nullable(),
        labelOverride: z.string().nullable(),
        sha256: z.string().regex(/^[a-f0-9]{64}$/),
        createdAt: z.string().nullable(),
        updatedAt: z.string().nullable(),
        approvedBy: z.string().nullable(),
        approvedAt: z.string().nullable(),
        approvalStatus: z.string().nullable()
    })
    .strict();

const rowSchema = z.record(z.string(), z.unknown());
const artifactSchema = z
    .object({
        format: z.literal('sok-active-pricelists'),
        formatVersion: z.literal(1),
        exportedAt: z.string().datetime({ offset: true }),
        sourceSchema: z.literal('sok-bundled-active-pricelists-v1'),
        versions: z
            .object({ rury: versionSchema, studnie: versionSchema, preco: versionSchema })
            .strict(),
        activeOverrides: z
            .object({
                rury: z.string().min(1).optional(),
                studnie: z.string().min(1).optional(),
                preco: z.string().min(1).optional()
            })
            .strict(),
        items: z
            .object({
                rury: z
                    .object({
                        pricelist_item_rury: z.array(rowSchema),
                        pricelist_item_studnie: z.array(rowSchema),
                        pricelist_item_preco_konfig: z.array(rowSchema),
                        pricelist_item_preco_kinety: z.array(rowSchema),
                        pricelist_item_preco_zakresy: z.array(rowSchema)
                    })
                    .strict(),
                studnie: z
                    .object({
                        pricelist_item_rury: z.array(rowSchema),
                        pricelist_item_studnie: z.array(rowSchema),
                        pricelist_item_preco_konfig: z.array(rowSchema),
                        pricelist_item_preco_kinety: z.array(rowSchema),
                        pricelist_item_preco_zakresy: z.array(rowSchema)
                    })
                    .strict(),
                preco: z
                    .object({
                        pricelist_item_rury: z.array(rowSchema),
                        pricelist_item_studnie: z.array(rowSchema),
                        pricelist_item_preco_konfig: z.array(rowSchema),
                        pricelist_item_preco_kinety: z.array(rowSchema),
                        pricelist_item_preco_zakresy: z.array(rowSchema)
                    })
                    .strict()
            })
            .strict(),
        counts: z.record(z.string(), z.number().int().nonnegative()),
        sha256: z.string().regex(/^[a-f0-9]{64}$/)
    })
    .strict();

type Artifact = z.infer<typeof artifactSchema>;

const ITEM_FIELDS: Record<(typeof TABLES)[number], readonly string[]> = {
    pricelist_item_rury: [
        'id',
        'versionId',
        'name',
        'category',
        'price',
        'transport',
        'weight',
        'area'
    ],
    pricelist_item_studnie: [
        'id',
        'versionId',
        'name',
        'category',
        'componentType',
        'dn',
        'height',
        'weight',
        'price',
        'area',
        'areaExt',
        'transport',
        'magazynWL',
        'magazynKLB',
        'formaStandardowa',
        'formaStandardowaKLB',
        'active',
        'zapasDol',
        'zapasGora',
        'zapasDolMin',
        'zapasGoraMin',
        'spocznikH',
        'hMin1',
        'hMax1',
        'hMin2',
        'hMax2',
        'hMin3',
        'hMax3',
        'cena1',
        'cena2',
        'cena3',
        'doplataPEHD',
        'doplataZelbet',
        'doplataDrabNierdzewna',
        'malowanieWewnetrzne',
        'malowanieZewnetrzne'
    ],
    pricelist_item_preco_konfig: ['id', 'versionId', 'key', 'value'],
    pricelist_item_preco_kinety: ['id', 'versionId', 'order', 'dn', 'wellDn', 'height', 'cena'],
    pricelist_item_preco_zakresy: [
        'id',
        'versionId',
        'order',
        'label',
        'min',
        'max',
        'grupy',
        'wellDn'
    ]
};

function stableJson(value: unknown): string {
    if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
    if (value && typeof value === 'object') {
        const record = value as Record<string, unknown>;
        const entries = Object.keys(record)
            .sort()
            .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`);
        return `{${entries.join(',')}}`;
    }
    return JSON.stringify(value);
}

function parseArtifact(filePath: string): Artifact {
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
    const artifact = artifactSchema.parse(raw);
    for (const type of TYPES) {
        const version = artifact.versions[type];
        if (version.type !== type) throw new Error(`Wersja ${version.id} ma niewłaściwy typ`);
        if (new Date(version.effectiveFrom).getTime() > new Date(artifact.exportedAt).getTime()) {
            throw new Error(`Wersja ${version.id} nie była aktywna w chwili eksportu`);
        }
        if (artifact.activeOverrides[type] && artifact.activeOverrides[type] !== version.id) {
            throw new Error(`Override ${type} nie wskazuje wyeksportowanej aktywnej wersji`);
        }
        for (const table of TABLES) {
            const rows = artifact.items[type][table];
            if (artifact.counts[`${type}.${table}`] !== rows.length) {
                throw new Error(`Licznik w artefakcie nie zgadza się dla ${type}.${table}`);
            }
            for (const row of rows) {
                const missing = ITEM_FIELDS[table].filter((key) => !(key in row));
                const unknown = Object.keys(row).filter((key) => !ITEM_FIELDS[table].includes(key));
                if (
                    missing.length ||
                    unknown.length ||
                    row.versionId !== version.id ||
                    typeof row.id !== 'string'
                ) {
                    throw new Error(`Nieprawidłowy wiersz ${table} dla wersji ${version.id}`);
                }
            }
        }
        for (const table of REQUIRED_TABLES[type]) {
            if (artifact.items[type][table].length === 0) {
                throw new Error(`Aktywny cennik ${type} ma pustą tabelę ${table}`);
            }
        }
        verifyVersionContentHash(artifact, type);
    }
    const { sha256, ...payload } = artifact;
    const actualHash = createHash('sha256').update(stableJson(payload), 'utf8').digest('hex');
    if (actualHash !== sha256)
        throw new Error('SHA-256 artefaktu nie pasuje; plik zmieniony lub uszkodzony');
    return artifact;
}

function transformRow(
    table: (typeof TABLES)[number],
    row: Record<string, unknown>
): Record<string, unknown> {
    const transformed = Object.fromEntries(ITEM_FIELDS[table].map((key) => [key, row[key]]));
    for (const [key, value] of Object.entries(transformed)) {
        if (value === null || value === undefined) continue;
        if (MONEY_FIELDS.has(key) && typeof value !== 'string')
            throw new Error(`Kwota ${table}.${key} nie jest tekstem dziesiętnym`);
        if (FLOAT_FIELDS.has(key)) {
            if (typeof value !== 'string' || !Number.isFinite(Number(value)))
                throw new Error(`Nieprawidłowa miara ${table}.${key}`);
            transformed[key] = Number(value);
        }
        if (BOOLEAN_FIELDS.has(key)) {
            if (value !== 0 && value !== 1 && typeof value !== 'boolean')
                throw new Error(`Nieprawidłowa flaga ${table}.${key}`);
            transformed[key] = value === true || value === 1;
        }
    }
    return transformed;
}

function canonicalRow(value: unknown): string {
    return stableJson(value);
}

function normalizeMoney(value: unknown): string {
    if (typeof value === 'string') return value;
    if (value && typeof value === 'object') {
        const toFixed = (value as { toFixed?: (scale: number) => string }).toFixed;
        if (typeof toFixed === 'function') return toFixed.call(value, 2);
    }
    throw new Error('Wartość kwoty z PostgreSQL nie jest typem dziesiętnym');
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

function comparableRows(
    table: (typeof TABLES)[number],
    versionId: string,
    rows: Record<string, unknown>[]
): Record<string, unknown>[] {
    return rows.map((row) => {
        const fullId = String(row.id);
        const prefix = `${versionId}:`;
        if (!fullId.startsWith(prefix)) {
            throw new Error(`Wiersz ${table} nie ma prefiksu aktywnej wersji ${versionId}`);
        }
        const transformed = transformRow(table, row);
        const comparable = Object.fromEntries(
            Object.entries(transformed).filter(([key]) => key !== 'versionId')
        );
        comparable.id = fullId.slice(prefix.length);
        for (const [key, value] of Object.entries(comparable)) {
            if (MONEY_FIELDS.has(key) && typeof value === 'string') {
                const number = Number(value);
                if (!Number.isFinite(number))
                    throw new Error(`Nieprawidłowa kwota ${table}.${key}`);
                comparable[key] = number;
            }
        }
        return comparable;
    });
}

function verifyVersionContentHash(artifact: Artifact, type: (typeof TYPES)[number]): void {
    const version = artifact.versions[type];
    const items = artifact.items[type];
    const toComparable = (table: (typeof TABLES)[number]) =>
        comparableRows(table, version.id, items[table]);
    const rows =
        type === 'rury'
            ? validateRows(type, toComparable('pricelist_item_rury'))
            : type === 'studnie'
              ? validateRows(type, toComparable('pricelist_item_studnie'))
              : validateRows(type, {
                    konfig: toComparable('pricelist_item_preco_konfig'),
                    kinety: toComparable('pricelist_item_preco_kinety'),
                    zakresy: toComparable('pricelist_item_preco_zakresy')
                });
    if (sha256Canonical(rows) !== version.sha256) {
        throw new Error(
            `SHA cennika ${type} (${version.id}) nie zgadza się z jego rekordami; przerywam cutover`
        );
    }
}

async function verifyOrInsert(artifact: Artifact, apply: boolean): Promise<void> {
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
                    .map((row) => transformRow(table, row))
                    .sort((a, b) => String(a.id).localeCompare(String(b.id)));
                const actual = relationRows[table]
                    .map((row) =>
                        Object.fromEntries(
                            ITEM_FIELDS[table].map((key) => {
                                const value = row[key];
                                if (MONEY_FIELDS.has(key) && value !== null && value !== undefined)
                                    return [key, normalizeMoney(value)];
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
                    artifact.items[type][table].map((row) => transformRow(table, row))
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
    const artifact = parseArtifact(filePath);
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
