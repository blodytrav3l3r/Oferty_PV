/**
 * Format pakietu aktywnych cenników (`data/pricelists/active-pricelists.json`).
 *
 * Jedno źródło definicji dla importera (`scripts/import-active-pricelists.ts`)
 * i eksportera (`scripts/export-active-pricelists.ts`). Hash pakietu, hash
 * wersji i reguły pól muszą być liczone identycznie po obu stronach — inaczej
 * świeża instalacja odrzuci pakiet, który sami wygenerowaliśmy.
 *
 * Ten moduł jest czysto obliczeniowy: żadnych zapytań do bazy ani zapisów.
 */
import { createHash } from 'crypto';
import fs from 'fs';
import { z } from 'zod';
import { sha256Canonical } from './canonical';
import { validateRows } from './validation';

export const ACTIVE_PACKAGE_TYPES = ['rury', 'studnie', 'preco'] as const;
export type ActivePackageType = (typeof ACTIVE_PACKAGE_TYPES)[number];

export const ACTIVE_PACKAGE_TABLES = [
    'pricelist_item_rury',
    'pricelist_item_studnie',
    'pricelist_item_preco_konfig',
    'pricelist_item_preco_kinety',
    'pricelist_item_preco_zakresy'
] as const;
export type ActivePackageTable = (typeof ACTIVE_PACKAGE_TABLES)[number];

export const MONEY_FIELDS = new Set([
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
export const FLOAT_FIELDS = new Set(['weight', 'area', 'areaExt']);
export const BOOLEAN_FIELDS = new Set([
    'magazynWL',
    'magazynKLB',
    'formaStandardowa',
    'formaStandardowaKLB',
    'active'
]);
export const REQUIRED_TABLES = {
    rury: ['pricelist_item_rury'],
    studnie: ['pricelist_item_studnie'],
    preco: [
        'pricelist_item_preco_konfig',
        'pricelist_item_preco_kinety',
        'pricelist_item_preco_zakresy'
    ]
} as const;

export const ITEM_FIELDS: Record<ActivePackageTable, readonly string[]> = {
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

export const activePackageVersionSchema = z
    .object({
        id: z.string().min(1),
        type: z.enum(ACTIVE_PACKAGE_TYPES),
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

export type ActivePackageVersion = z.infer<typeof activePackageVersionSchema>;

const rowSchema = z.record(z.string(), z.unknown());
const tableRowsSchema = z
    .object({
        pricelist_item_rury: z.array(rowSchema),
        pricelist_item_studnie: z.array(rowSchema),
        pricelist_item_preco_konfig: z.array(rowSchema),
        pricelist_item_preco_kinety: z.array(rowSchema),
        pricelist_item_preco_zakresy: z.array(rowSchema)
    })
    .strict();

export const activePackageSchema = z
    .object({
        format: z.literal('sok-active-pricelists'),
        formatVersion: z.literal(1),
        exportedAt: z.string().datetime({ offset: true }),
        sourceSchema: z.literal('sok-bundled-active-pricelists-v1'),
        versions: z
            .object({
                rury: activePackageVersionSchema,
                studnie: activePackageVersionSchema,
                preco: activePackageVersionSchema
            })
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
                rury: tableRowsSchema,
                studnie: tableRowsSchema,
                preco: tableRowsSchema
            })
            .strict(),
        counts: z.record(z.string(), z.number().int().nonnegative()),
        sha256: z.string().regex(/^[a-f0-9]{64}$/)
    })
    .strict();

export type ActivePackage = z.infer<typeof activePackageSchema>;
export type ActivePackageRows = ActivePackage['items'][ActivePackageType];
export type PackageRow = Record<string, unknown>;

/** Kanoniczny JSON (sortowanie kluczy) — stabilny SHA niezależny od kolejności. */
export function stableJson(value: unknown): string {
    // `undefined` w obiekcie/arrayu musi zniknąć tak jak w `JSON.stringify` po
    // zapisie do pliku — inaczej hash w pamięci nie zgadza się z hashem pliku.
    if (value === undefined) return 'null';
    if (Array.isArray(value)) return `[${value.map((item) => stableJson(item)).join(',')}]`;
    if (value && typeof value === 'object') {
        const record = value as Record<string, unknown>;
        const entries = Object.keys(record)
            .filter((key) => record[key] !== undefined)
            .sort()
            .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`);
        return `{${entries.join(',')}}`;
    }
    return JSON.stringify(value);
}

/** SHA-256 całego pakietu: liczone po payloadzie bez pola `sha256`. */
export function packagePayloadHash(artifact: ActivePackage): string {
    const { sha256: _ignored, ...payload } = artifact;
    return createHash('sha256').update(stableJson(payload), 'utf8').digest('hex');
}

/**
 * Kwota → tekst dziesiętny 2 miejsca, jak w pakiecie.
 * Przyjmuje Decimal z PostgreSQL albo liczbę z projekcji wersji.
 */
export function moneyToPackage(value: unknown): string {
    if (typeof value === 'string') return value;
    if (typeof value === 'number' && Number.isFinite(value)) return value.toFixed(2);
    if (value && typeof value === 'object') {
        const toFixed = (value as { toFixed?: (scale: number) => string }).toFixed;
        if (typeof toFixed === 'function') return toFixed.call(value, 2);
    }
    throw new Error('Wartość kwoty z PostgreSQL nie jest typem dziesiętnym');
}

/** Wiersz bazy → wiersz pakietu (tylko pola z allowlisty, kwoty jako tekst). */
export function toPackageRow(table: ActivePackageTable, row: Record<string, unknown>): PackageRow {
    const out: PackageRow = {};
    for (const key of ITEM_FIELDS[table]) {
        const value = row[key];
        if (value === undefined) throw new Error(`Wiersz ${table} nie ma pola ${key}`);
        if (value === null) {
            out[key] = null;
        } else if (MONEY_FIELDS.has(key)) {
            out[key] = moneyToPackage(value);
        } else if (FLOAT_FIELDS.has(key)) {
            out[key] = String(value);
        } else {
            out[key] = value;
        }
    }
    return out;
}

/** Wiersz pakietu → typy domenowe (kwoty tekstowe zamieniane na liczby). */
export function transformPackageRow(table: ActivePackageTable, row: PackageRow): PackageRow {
    const transformed = Object.fromEntries(ITEM_FIELDS[table].map((key) => [key, row[key]]));
    for (const [key, value] of Object.entries(transformed)) {
        if (value === null || value === undefined) continue;
        if (MONEY_FIELDS.has(key) && typeof value !== 'string') {
            throw new Error(`Kwota ${table}.${key} nie jest tekstem dziesiętnym`);
        }
        if (FLOAT_FIELDS.has(key)) {
            if (typeof value !== 'string' || !Number.isFinite(Number(value))) {
                throw new Error(`Nieprawidłowa miara ${table}.${key}`);
            }
            transformed[key] = Number(value);
        }
        if (BOOLEAN_FIELDS.has(key)) {
            if (value !== 0 && value !== 1 && typeof value !== 'boolean') {
                throw new Error(`Nieprawidłowa flaga ${table}.${key}`);
            }
            transformed[key] = value === true || value === 1;
        }
    }
    return transformed;
}

/** Wiersze wersji bez prefiksu `versionId:` i z kwotami jako liczbami. */
export function packageComparableRows(
    table: ActivePackageTable,
    versionId: string,
    rows: PackageRow[]
): PackageRow[] {
    return rows.map((row) => {
        const fullId = String(row.id);
        const prefix = `${versionId}:`;
        if (!fullId.startsWith(prefix)) {
            throw new Error(`Wiersz ${table} nie ma prefiksu aktywnej wersji ${versionId}`);
        }
        const transformed = transformPackageRow(table, row);
        const comparable = Object.fromEntries(
            Object.entries(transformed).filter(([key]) => key !== 'versionId')
        );
        comparable.id = fullId.slice(prefix.length);
        for (const [key, value] of Object.entries(comparable)) {
            if (MONEY_FIELDS.has(key) && typeof value === 'string') {
                const number = Number(value);
                if (!Number.isFinite(number)) {
                    throw new Error(`Nieprawidłowa kwota ${table}.${key}`);
                }
                comparable[key] = number;
            }
        }
        return comparable;
    });
}

/** SHA wersji liczony z jej wierszy — musi zgadzać się z `version.sha256` bazy. */
export function packageVersionSha(
    type: ActivePackageType,
    versionId: string,
    items: ActivePackageRows
): string {
    const toComparable = (table: ActivePackageTable) =>
        packageComparableRows(table, versionId, items[table]);
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
    return sha256Canonical(rows);
}

/**
 * Pełna walidacja pakietu: struktura, spójność liczników, komplet pól wierszy,
 * hash każdej wersji i hash całości. Rzuca `Error` z konkretnym powodem.
 */
export function assertActivePackage(artifact: ActivePackage): void {
    for (const type of ACTIVE_PACKAGE_TYPES) {
        const version = artifact.versions[type];
        if (version.type !== type) throw new Error(`Wersja ${version.id} ma niewłaściwy typ`);
        if (new Date(version.effectiveFrom).getTime() > new Date(artifact.exportedAt).getTime()) {
            throw new Error(`Wersja ${version.id} nie była aktywna w chwili eksportu`);
        }
        if (artifact.activeOverrides[type] && artifact.activeOverrides[type] !== version.id) {
            throw new Error(`Override ${type} nie wskazuje wyeksportowanej aktywnej wersji`);
        }
        for (const table of ACTIVE_PACKAGE_TABLES) {
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
        const actual = packageVersionSha(type, version.id, artifact.items[type]);
        if (actual !== version.sha256) {
            throw new Error(
                `SHA cennika ${type} (${version.id}) nie zgadza się z jego rekordami; przerywam cutover`
            );
        }
    }
    if (packagePayloadHash(artifact) !== artifact.sha256) {
        throw new Error('SHA-256 artefaktu nie pasuje; plik zmieniony lub uszkodzony');
    }
}

export interface ActivePackageInput {
    exportedAt: string;
    versions: Record<ActivePackageType, ActivePackageVersion>;
    items: Record<ActivePackageType, ActivePackageRows>;
    activeOverrides: Record<ActivePackageType, string | undefined>;
}

/**
 * Buduje pakiet z aktywnych wersji i ich wierszy. Weryfikuje hash każdej wersji
 * (dryf baza ↔ rekordy wersji nie może wejść do pakietu) i liczy hash całości.
 */
export function buildActivePackage(input: ActivePackageInput): ActivePackage {
    const counts: Record<string, number> = {};
    for (const type of ACTIVE_PACKAGE_TYPES) {
        for (const table of ACTIVE_PACKAGE_TABLES) {
            counts[`${type}.${table}`] = input.items[type][table].length;
        }
    }
    const artifact: ActivePackage = {
        format: 'sok-active-pricelists',
        formatVersion: 1,
        exportedAt: input.exportedAt,
        sourceSchema: 'sok-bundled-active-pricelists-v1',
        versions: input.versions,
        activeOverrides: input.activeOverrides,
        items: input.items,
        counts,
        sha256: '0'.repeat(64)
    };
    artifact.sha256 = packagePayloadHash(artifact);
    assertActivePackage(artifact);
    return artifact;
}

/** Odczyt i pełna walidacja pakietu z pliku. */
export function readActivePackage(filePath: string): ActivePackage {
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
    const artifact = activePackageSchema.parse(raw);
    assertActivePackage(artifact);
    return artifact;
}
