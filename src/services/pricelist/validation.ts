/**
 * pricelist/validation — typy, błąd domenowy, walidacja zod i współdzielona
 * infrastruktura transakcyjna (lock per-type, insert/delete wierszy, audyt,
 * odczyt wierszy). Liść grafu: zero importów z innych modułów pricelist.
 *
 * Kod przeniesiony 1:1 z pricelistVersionService.ts (split, zero zmian logiki).
 */

import { randomUUID } from 'crypto';
import { z } from 'zod';
import type { Prisma } from '../../prismaClient';
import { createModuleLock } from '../../middleware/writeLock';
import { chunkedCreateMany } from '../../utils/prismaBatch';
import {
    precoKinetyRowSchema,
    precoKonfigRowSchema,
    precoZakresyRowSchema,
    productsRuryRowSchema,
    productsStudnieRowSchema
} from '../../validators/priceDefaultsSchemas';
import type {
    PrecoKinetyRow,
    PrecoKonfigRow,
    PrecoZakresyRow,
    ProductsRuryRow,
    ProductsStudnieRow
} from '../../validators/priceDefaultsSchemas';

export const PRICELIST_TYPES = ['rury', 'studnie', 'preco'] as const;
export type PricelistType = (typeof PRICELIST_TYPES)[number];

export type PricelistStatus =
    'DRAFT' | 'SCHEDULED' | 'ACTIVE' | 'ARCHIVED' | 'BACKDATE_REQUESTED' | 'BACKDATE';

/** Statusy edytowalne treściowo (replace wierszy dozwolony). */
export const EDITABLE_STATUSES: readonly string[] = ['DRAFT', 'SCHEDULED', 'BACKDATE_REQUESTED'];

/** Statusy niemutowalne — mutacja to odpowiednik 403. */
const IMMUTABLE_STATUSES: readonly string[] = ['ACTIVE', 'ARCHIVED', 'BACKDATE'];

/** Statusy brane pod uwagę przy resolveActive. */
export const RESOLVABLE_STATUSES: readonly string[] = ['ACTIVE', 'BACKDATE'];

/** Maksymalna długość noty wersji (edycja PUT + nota aktywacji). */
export const NOTE_MAX = 500;

export type RuryRows = ProductsRuryRow[];
export type StudnieRows = ProductsStudnieRow[];
export interface PrecoRows {
    konfig: PrecoKonfigRow[];
    kinety: PrecoKinetyRow[];
    zakresy: PrecoZakresyRow[];
}
export type VersionRows = RuryRows | StudnieRows | PrecoRows;

export interface CreateDraftOptions {
    effectiveFrom?: string;
    note?: string;
    createdBy?: string;
}

/** Błąd domenowy z kodem HTTP (walidacja 422, immutability 403, konflikt 409). */
export class PricelistVersionError extends Error {
    readonly statusCode: number;
    readonly code: string;

    constructor(statusCode: number, code: string, message: string) {
        super(message);
        this.name = 'PricelistVersionError';
        this.statusCode = statusCode;
        this.code = code;
    }
}

/** Lock per-type (wzorzec writeLock.ts), nie globalny. */
const typeLocks = new Map<PricelistType, ReturnType<typeof createModuleLock>>();

export function lockFor(type: PricelistType): ReturnType<typeof createModuleLock> {
    let lock = typeLocks.get(type);
    if (!lock) {
        lock = createModuleLock();
        typeLocks.set(type, lock);
    }
    return lock;
}

export function isPricelistType(value: unknown): value is PricelistType {
    return typeof value === 'string' && (PRICELIST_TYPES as readonly string[]).includes(value);
}

export function requireType(value: unknown): PricelistType {
    if (!isPricelistType(value)) {
        throw new PricelistVersionError(
            422,
            'INVALID_TYPE',
            `Nieprawidłowy typ cennika: ${String(value)} (dozwolone: rury, studnie, preco)`
        );
    }
    return value;
}

/** Normalizuje datę do UTC ISO; nieprawidłowa → 422. */
export function toUtcIso(value: unknown, field: string): string {
    if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
        throw new PricelistVersionError(
            422,
            'INVALID_DATE',
            `Nieprawidłowa data ${field}: oczekiwano UTC ISO`
        );
    }
    return new Date(value).toISOString();
}

/** Pola boolean w PricelistItemStudnie (legacy FE przysyła 1/0). */
export const STUDNIE_BOOL_FIELDS = [
    'magazynWL',
    'magazynKLB',
    'formaStandardowa',
    'formaStandardowaKLB',
    'active'
] as const;

/**
 * Normalizuje legacy shape z GET /api/products-studnie (toLegacy:
 * booleany jako 1/0, dn liczbowe, price null) do canonical zod/Prisma
 * (boolean, dn string, brak klucza = default). Nie-array przepuszcza dalej
 * by zod zwrócił standardowy 422.
 */
function normalizeStudnieRows(rows: unknown): unknown {
    if (!Array.isArray(rows)) return rows;
    return rows.map((row) => {
        if (row === null || typeof row !== 'object') return row;
        const rec = { ...(row as Record<string, unknown>) };
        for (const field of STUDNIE_BOOL_FIELDS) {
            const value = rec[field];
            if (value === 1 || value === true) rec[field] = true;
            else if (value === 0 || value === false) rec[field] = false;
            else if (value === null || value === undefined) delete rec[field];
        }
        if (typeof rec.dn === 'number') rec.dn = String(rec.dn);
        if (rec.price === null || rec.price === undefined) delete rec.price;
        return rec;
    });
}

const precoRowsSchema = z.object({
    konfig: precoKonfigRowSchema.array(),
    kinety: precoKinetyRowSchema.array(),
    zakresy: precoZakresyRowSchema.array()
});

function throwRowsError(
    section: string,
    issues: Array<{ path: Array<PropertyKey>; message: string }>
): never {
    const details = issues
        .slice(0, 5)
        .map((issue) => `${section}${formatIssuePath(issue.path)} — ${issue.message}`)
        .join('; ');
    throw new PricelistVersionError(422, 'INVALID_ROWS', `Nieprawidłowe wiersze: ${details}`);
}

function formatIssuePath(path: Array<PropertyKey>): string {
    if (path.length === 0) return '';
    let out = typeof path[0] === 'number' ? `[${path[0]}]` : `.${String(path[0])}`;
    for (const part of path.slice(1)) {
        out += typeof part === 'number' ? `[${part}]` : `.${String(part)}`;
    }
    return out;
}

/** Waliduje wiersze zod per typ (schematy + .nonnegative()); błąd → 422. */
export function validateRows(type: PricelistType, rows: unknown): VersionRows {
    if (type === 'rury') {
        const parsed = productsRuryRowSchema.array().safeParse(rows);
        if (!parsed.success) throwRowsError('rury', parsed.error.issues);
        return parsed.data;
    }
    if (type === 'studnie') {
        const parsed = productsStudnieRowSchema.array().safeParse(normalizeStudnieRows(rows));
        if (!parsed.success) throwRowsError('studnie', parsed.error.issues);
        return parsed.data;
    }
    const parsed = precoRowsSchema.safeParse(rows);
    if (!parsed.success) throwRowsError('preco', parsed.error.issues);
    return parsed.data;
}

/** Guard niemutowalności: ACTIVE/ARCHIVED/BACKDATE → 403. */
export function assertEditable(status: string, id: string): void {
    if (IMMUTABLE_STATUSES.includes(status)) {
        throw new PricelistVersionError(
            403,
            'IMMUTABLE_VERSION',
            `Wersja ${id} ma status ${status} — treść niemutowalna`
        );
    }
}

export function isUniqueViolation(err: unknown): boolean {
    return (
        err !== null &&
        typeof err === 'object' &&
        'code' in err &&
        (err as { code: unknown }).code === 'P2002'
    );
}

export type Tx = Prisma.TransactionClient;

/**
 * Wstawia wiersze wersji paczkami po 100 — benchmark B2 na 2000 wierszach:
 * chunk 25 = 7531 ms, 100 = 2116 ms (÷3.5), 500 = zrywanie silnika.
 * Default 25 zostaje dla seeda (baza błędów #1) — tu jawny parametr.
 */
const VERSION_ITEMS_CHUNK = 100;
export async function insertVersionItems(
    tx: Tx,
    type: PricelistType,
    versionId: string,
    rows: VersionRows
): Promise<void> {
    if (type === 'rury') {
        const data = (rows as RuryRows).map((row) => ({
            ...row,
            id: `${versionId}:${row.id}`,
            versionId
        }));
        if (data.length > 0)
            await chunkedCreateMany(tx.pricelistItemRury, data, VERSION_ITEMS_CHUNK);
        return;
    }
    if (type === 'studnie') {
        const data = (rows as StudnieRows).map((row) => ({
            ...row,
            id: `${versionId}:${row.id}`,
            versionId
        }));
        if (data.length > 0)
            await chunkedCreateMany(tx.pricelistItemStudnie, data, VERSION_ITEMS_CHUNK);
        return;
    }
    const preco = rows as PrecoRows;
    const konfig = preco.konfig.map((row) => ({
        ...row,
        id: `${versionId}:${row.id}`,
        versionId
    }));
    const kinety = preco.kinety.map((row) => ({
        ...row,
        id: `${versionId}:${row.id}`,
        versionId
    }));
    const zakresy = preco.zakresy.map((row) => ({
        ...row,
        id: `${versionId}:${row.id}`,
        versionId
    }));
    if (konfig.length > 0)
        await chunkedCreateMany(tx.pricelistItemPrecoKonfig, konfig, VERSION_ITEMS_CHUNK);
    if (kinety.length > 0)
        await chunkedCreateMany(tx.pricelistItemPrecoKinety, kinety, VERSION_ITEMS_CHUNK);
    if (zakresy.length > 0)
        await chunkedCreateMany(tx.pricelistItemPrecoZakresy, zakresy, VERSION_ITEMS_CHUNK);
}

export async function deleteVersionItems(
    tx: Tx,
    type: PricelistType,
    versionId: string
): Promise<void> {
    const where = { where: { versionId } };
    if (type === 'rury') {
        await tx.pricelistItemRury.deleteMany(where);
        return;
    }
    if (type === 'studnie') {
        await tx.pricelistItemStudnie.deleteMany(where);
        return;
    }
    await tx.pricelistItemPrecoKonfig.deleteMany(where);
    await tx.pricelistItemPrecoKinety.deleteMany(where);
    await tx.pricelistItemPrecoZakresy.deleteMany(where);
}

/**
 * Normalizuje notę wersji: undefined = brak zmiany; string po trim
 * (pusty czyści notę → null); > 500 znaków → 422 NOTE_TOO_LONG.
 * Labelka version niemutowalna — nota to jedyne edytowalne pole opisowe.
 */
export function normalizeNote(noteInput: unknown): string | null | undefined {
    if (noteInput === undefined) return undefined;
    if (typeof noteInput !== 'string') {
        throw new PricelistVersionError(
            422,
            'INVALID_NOTE',
            'Nieprawidłowa nota: oczekiwano tekstu (max 500 znaków)'
        );
    }
    const trimmed = noteInput.trim();
    if (trimmed.length > NOTE_MAX) {
        throw new PricelistVersionError(
            422,
            'NOTE_TOO_LONG',
            `Nota za długa (max ${NOTE_MAX} znaków)`
        );
    }
    return trimmed === '' ? null : trimmed;
}

export interface AuditEntry {
    entityId: string;
    userId?: string;
    action: string;
    oldData?: unknown;
    newData?: unknown;
}

/** Wpis audytu w ramach tx (audit_logs: id/entityType/entityId/action + JSON). */
export async function writeAudit(tx: Tx, entry: AuditEntry): Promise<void> {
    await tx.audit_logs.create({
        data: {
            id: randomUUID(),
            entityType: 'pricelist_version',
            entityId: entry.entityId,
            userId: entry.userId ?? null,
            action: entry.action,
            oldData: entry.oldData === undefined ? null : JSON.stringify(entry.oldData),
            newData: entry.newData === undefined ? null : JSON.stringify(entry.newData),
            createdAt: new Date().toISOString()
        }
    });
}

/** Porównywalny wiersz: id biznesowe (bez prefiksu wersji), bez versionId. */
export function toComparable(
    items: Array<Record<string, unknown>>,
    versionId: string
): Array<Record<string, unknown>> {
    return items.map((item) => {
        const { versionId: _ignored, id, ...rest } = item;
        void _ignored;
        const fullId = String(id);
        const rowId = fullId.startsWith(`${versionId}:`)
            ? fullId.slice(versionId.length + 1)
            : fullId;
        return { ...rest, id: rowId };
    });
}

export type ItemDelegates = Pick<
    Tx,
    | 'pricelistItemRury'
    | 'pricelistItemStudnie'
    | 'pricelistItemPrecoKonfig'
    | 'pricelistItemPrecoKinety'
    | 'pricelistItemPrecoZakresy'
>;

export async function loadVersionItems(
    client: ItemDelegates,
    type: PricelistType,
    versionId: string
): Promise<Record<string, Array<Record<string, unknown>>>> {
    const asRecords = (rows: unknown): Array<Record<string, unknown>> =>
        rows as Array<Record<string, unknown>>;
    if (type === 'rury') {
        return {
            rury: asRecords(await client.pricelistItemRury.findMany({ where: { versionId } }))
        };
    }
    if (type === 'studnie') {
        return {
            studnie: asRecords(await client.pricelistItemStudnie.findMany({ where: { versionId } }))
        };
    }
    const [konfig, kinety, zakresy] = await Promise.all([
        client.pricelistItemPrecoKonfig.findMany({ where: { versionId } }),
        client.pricelistItemPrecoKinety.findMany({ where: { versionId } }),
        client.pricelistItemPrecoZakresy.findMany({ where: { versionId } })
    ]);
    return { konfig: asRecords(konfig), kinety: asRecords(kinety), zakresy: asRecords(zakresy) };
}

/** Źródło eksportu: tabele LIVE, *Default albo zamrożona ACTIVE. */
export type PricelistExportSource = 'live' | 'default' | 'active';

/** Walidacja ?source=live|default|active — zły → 422 (jak INVALID_TYPE). */
export function requireExportSource(value: unknown): PricelistExportSource {
    if (value === 'live' || value === 'default' || value === 'active') return value;
    throw new PricelistVersionError(
        422,
        'INVALID_SOURCE',
        `Nieprawidłowe źródło eksportu: ${String(value)} (dozwolone: live, default, active)`
    );
}

/** Walidacja ?source= dla GET cenników — brak = dotychczasowy LIVE bez zmian. */
export type PricingSource = 'active';

export function requirePricingSource(value: unknown): PricingSource | undefined {
    if (value === undefined) return undefined;
    if (value === 'active') return 'active';
    throw new PricelistVersionError(
        422,
        'INVALID_SOURCE',
        `Nieprawidłowe źródło cennika: ${String(value)} (dozwolone: active)`
    );
}
