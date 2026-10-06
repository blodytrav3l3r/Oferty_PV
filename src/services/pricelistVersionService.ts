/**
 * F1: Wersjonowanie cenników — drafty per typ + resolveActive.
 *
 * Obok starego priceOverrideService (LIVE + *_Default działają do Contract).
 * seq = źródło prawdy (int per type), version = labelka pochodna (v{seq}),
 * nigdy z inputu. Status = lifecycle techniczny, effectiveFrom = historia
 * biznesowa (UTC ISO). ACTIVE/ARCHIVED/BACKDATE niemutowalne (403).
 */

import { randomUUID } from 'crypto';
import { z } from 'zod';
import prisma, { Prisma } from '../prismaClient';
import { createModuleLock } from '../middleware/writeLock';
import { chunkedCreateMany } from '../utils/prismaBatch';
import { diffById, sha256Canonical } from './priceOverrideService';
import type { XlsxSheet } from '../utils/minimalXlsx';
import {
    precoKinetyRowSchema,
    precoKonfigRowSchema,
    precoZakresyRowSchema,
    productsRuryRowSchema,
    productsStudnieRowSchema
} from '../validators/priceDefaultsSchemas';
import type {
    PrecoKinetyRow,
    PrecoKonfigRow,
    PrecoZakresyRow,
    ProductsRuryRow,
    ProductsStudnieRow
} from '../validators/priceDefaultsSchemas';
import type { PricelistVersion } from '../../generated/prisma';

export const PRICELIST_TYPES = ['rury', 'studnie', 'preco'] as const;
export type PricelistType = (typeof PRICELIST_TYPES)[number];

export type PricelistStatus =
    'DRAFT' | 'SCHEDULED' | 'ACTIVE' | 'ARCHIVED' | 'BACKDATE_REQUESTED' | 'BACKDATE';

/** Statusy edytowalne treściowo (replace wierszy dozwolony). */
export const EDITABLE_STATUSES: readonly string[] = ['DRAFT', 'SCHEDULED', 'BACKDATE_REQUESTED'];

/** Statusy niemutowalne — mutacja to odpowiednik 403. */
const IMMUTABLE_STATUSES: readonly string[] = ['ACTIVE', 'ARCHIVED', 'BACKDATE'];

/** Statusy brane pod uwagę przy resolveActive. */
const RESOLVABLE_STATUSES: readonly string[] = ['ACTIVE', 'BACKDATE'];

/** Limity retry przy kolizji seq (race dwóch createDraft). */
const SEQ_RETRY_LIMIT = 3;

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

function lockFor(type: PricelistType): ReturnType<typeof createModuleLock> {
    let lock = typeLocks.get(type);
    if (!lock) {
        lock = createModuleLock();
        typeLocks.set(type, lock);
    }
    return lock;
}

function isPricelistType(value: unknown): value is PricelistType {
    return typeof value === 'string' && (PRICELIST_TYPES as readonly string[]).includes(value);
}

function requireType(value: unknown): PricelistType {
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
function toUtcIso(value: unknown, field: string): string {
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
const STUDNIE_BOOL_FIELDS = [
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

/** Waliduje wiersze zod per typ (schematy + .nonnegative()); błąd → 422. */
function validateRows(type: PricelistType, rows: unknown): VersionRows {
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

function isUniqueViolation(err: unknown): boolean {
    return (
        err !== null &&
        typeof err === 'object' &&
        'code' in err &&
        (err as { code: unknown }).code === 'P2002'
    );
}

type Tx = Prisma.TransactionClient;

/**
 * Wstawia wiersze wersji paczkami po 100 — benchmark B2 na 2000 wierszach:
 * chunk 25 = 7531 ms, 100 = 2116 ms (÷3.5), 500 = zrywanie silnika.
 * Default 25 zostaje dla seeda (baza błędów #1) — tu jawny parametr.
 */
const VERSION_ITEMS_CHUNK = 100;
async function insertVersionItems(
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

async function deleteVersionItems(tx: Tx, type: PricelistType, versionId: string): Promise<void> {
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
 * Tworzy draft wersji: zod + SHA + seq = MAX+1 w tx + status
 * (SCHEDULED gdy effectiveFrom > maxEffectiveFrom, inaczej BACKDATE_REQUESTED).
 * Labelka version = v{seq}, nigdy z inputu. Kolizja seq → retry (R2).
 */
export async function createDraft(
    typeInput: unknown,
    rowsInput: unknown,
    opts: CreateDraftOptions = {}
): Promise<PricelistVersion> {
    const type = requireType(typeInput);
    const effectiveFrom =
        opts.effectiveFrom === undefined
            ? new Date().toISOString()
            : toUtcIso(opts.effectiveFrom, 'effectiveFrom');
    const rows = validateRows(type, rowsInput);
    const sha256 = sha256Canonical(rows);

    const lock = lockFor(type);
    const res = await lock.runWithLock(() =>
        createDraftTx(type, rows, {
            effectiveFrom,
            note: opts.note,
            createdBy: opts.createdBy,
            sha256
        })
    );
    if (!res.acquired) {
        throw new PricelistVersionError(
            503,
            'LOCK_BUSY',
            `Zapis wersji ${type} chwilowo zablokowany`
        );
    }
    return res.value;
}

/** Labelka wersji: v{seq}-{RRRRMMDD} z effectiveFrom (UTC). Seq w nazwie = unikalność per type. */
export function versionLabel(seq: number, effectiveFromIso: string): string {
    const d = new Date(effectiveFromIso);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `v${seq}-${y}${m}${day}`;
}

async function createDraftTx(
    type: PricelistType,
    rows: VersionRows,
    meta: { effectiveFrom: string; note?: string; createdBy?: string; sha256: string }
): Promise<PricelistVersion> {
    let lastErr: unknown = null;
    for (let attempt = 1; attempt <= SEQ_RETRY_LIMIT; attempt++) {
        try {
            return await prisma.$transaction(async (tx) => {
                const agg = await tx.pricelistVersion.aggregate({
                    _max: { seq: true, effectiveFrom: true },
                    where: { type }
                });
                const seq = (agg._max.seq ?? 0) + 1;
                const maxEffectiveFrom = agg._max.effectiveFrom ?? null;
                const status: PricelistStatus =
                    maxEffectiveFrom === null || meta.effectiveFrom > maxEffectiveFrom
                        ? 'SCHEDULED'
                        : 'BACKDATE_REQUESTED';
                const id = randomUUID();
                const version = await tx.pricelistVersion.create({
                    data: {
                        id,
                        type,
                        seq,
                        version: versionLabel(seq, meta.effectiveFrom),
                        status,
                        effectiveFrom: meta.effectiveFrom,
                        createdBy: meta.createdBy,
                        note: meta.note,
                        sha256: meta.sha256,
                        createdAt: new Date().toISOString()
                    }
                });
                await insertVersionItems(tx, type, id, rows);
                return version;
            });
        } catch (err) {
            lastErr = err;
            if (!isUniqueViolation(err)) throw err;
        }
    }
    throw new PricelistVersionError(
        409,
        'SEQ_CONFLICT',
        `Nie udało się przydzielić seq dla ${type} (kolizja równoległych zapisów): ${String(lastErr)}`
    );
}

/**
 * Normalizuje notę wersji: undefined = brak zmiany; string po trim
 * (pusty czyści notę → null); > 500 znaków → 422 NOTE_TOO_LONG.
 * Labelka version niemutowalna — nota to jedyne edytowalne pole opisowe.
 */
function normalizeNote(noteInput: unknown): string | null | undefined {
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

/**
 * Podmienia wiersze i/lub notę wersji (tylko DRAFT/SCHEDULED/BACKDATE_REQUESTED)
 * + nowe SHA przy podmianie wierszy. rows undefined = bez podmiany wierszy
 * (sama nota dozwolona); note undefined = nota bez zmian, pusty string czyści
 * notę. Brak obu (rows i note undefined) → 422 NO_CHANGES.
 */
export async function updateDraft(
    id: string,
    rowsInput?: unknown,
    noteInput?: unknown
): Promise<PricelistVersion> {
    const current = await prisma.pricelistVersion.findUnique({ where: { id } });
    if (!current) {
        throw new PricelistVersionError(404, 'NOT_FOUND', `Wersja ${id} nie istnieje`);
    }
    assertEditable(current.status, id);
    if (!isPricelistType(current.type)) {
        throw new PricelistVersionError(422, 'INVALID_TYPE', `Wersja ${id} ma nieznany typ`);
    }
    const type = current.type;
    const note = normalizeNote(noteInput);
    if (rowsInput === undefined && note === undefined) {
        throw new PricelistVersionError(
            422,
            'NO_CHANGES',
            `Brak zmian dla wersji ${id}: podaj wiersze (rows) lub notę (note)`
        );
    }
    const rows = rowsInput === undefined ? null : validateRows(type, rowsInput);
    const sha256 = rows === null ? null : sha256Canonical(rows);

    const lock = lockFor(type);
    const res = await lock.runWithLock(() =>
        prisma.$transaction(async (tx) => {
            const fresh = await tx.pricelistVersion.findUnique({ where: { id } });
            if (!fresh) {
                throw new PricelistVersionError(404, 'NOT_FOUND', `Wersja ${id} nie istnieje`);
            }
            assertEditable(fresh.status, id);
            const data: { sha256?: string; note?: string | null } = {};
            if (rows !== null && sha256 !== null) {
                await deleteVersionItems(tx, type, id);
                await insertVersionItems(tx, type, id, rows);
                data.sha256 = sha256;
            }
            if (note !== undefined) data.note = note;
            return tx.pricelistVersion.update({ where: { id }, data });
        })
    );
    if (!res.acquired) {
        throw new PricelistVersionError(
            503,
            'LOCK_BUSY',
            `Zapis wersji ${type} chwilowo zablokowany`
        );
    }
    return res.value;
}

/**
 * Deterministyczne resolveActive: kandydaci ACTIVE/BACKDATE z
 * effectiveFrom <= at, sort effectiveFrom DESC, seq DESC, LIMIT 1.
 * Dokładnie 1 wersja albo null dla każdego at.
 */
export async function resolveActive(
    typeInput: unknown,
    at?: string
): Promise<PricelistVersion | null> {
    const type = requireType(typeInput);
    const atIso = at === undefined ? new Date().toISOString() : toUtcIso(at, 'at');
    return prisma.pricelistVersion.findFirst({
        where: {
            type,
            status: { in: [...RESOLVABLE_STATUSES] },
            effectiveFrom: { lte: atIso }
        },
        orderBy: [{ effectiveFrom: 'desc' }, { seq: 'desc' }]
    });
}

/** Porównywalny wiersz: id biznesowe (bez prefiksu wersji), bez versionId. */
function toComparable(
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

type ItemDelegates = Pick<
    Tx,
    | 'pricelistItemRury'
    | 'pricelistItemStudnie'
    | 'pricelistItemPrecoKonfig'
    | 'pricelistItemPrecoKinety'
    | 'pricelistItemPrecoZakresy'
>;

async function loadVersionItems(
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

export interface VersionDiff {
    version: string;
    previousVersion: string | null;
    sections: Record<string, { added: number; removed: number; changed: number }>;
}

/** Diff wersji względem poprzedniej (seq-1) przez diffById. */
export async function getVersionDiff(id: string): Promise<VersionDiff> {
    const current = await prisma.pricelistVersion.findUnique({ where: { id } });
    if (!current) {
        throw new PricelistVersionError(404, 'NOT_FOUND', `Wersja ${id} nie istnieje`);
    }
    if (!isPricelistType(current.type)) {
        throw new PricelistVersionError(422, 'INVALID_TYPE', `Wersja ${id} ma nieznany typ`);
    }
    const type = current.type;
    const previous = await prisma.pricelistVersion.findFirst({
        where: { type, seq: current.seq - 1 }
    });
    const curItems = await loadVersionItems(prisma, type, current.id);
    const prevItems = previous
        ? await loadVersionItems(prisma, type, previous.id)
        : Object.fromEntries(Object.keys(curItems).map((k) => [k, []]));
    const sections: VersionDiff['sections'] = {};
    for (const key of Object.keys(curItems)) {
        sections[key] = diffById(
            toComparable(prevItems[key] ?? [], previous?.id ?? ''),
            toComparable(curItems[key], current.id)
        );
    }
    return { version: current.version, previousVersion: previous?.version ?? null, sections };
}

// ─── F2: aktywacja, backdate, cron ─────────────────────────────────────
// Dopiski F2 — F1 powyżej nietknięte.

/** Klucz fresh-guarda współdzielony ze starym priceOverrideService. */
const DEFAULTS_UPDATED_AT_KEY = 'pricelist_defaults_updated_at';

/** Minimalna długość noty backdate (uzasadnienie zmiany historycznej). */
const BACKDATE_NOTE_MIN = 10;

/** Maksymalna długość noty wersji (edycja PUT + nota aktywacji). */
const NOTE_MAX = 500;

interface AuditEntry {
    entityId: string;
    userId?: string;
    action: string;
    oldData?: unknown;
    newData?: unknown;
}

/** Wpis audytu w ramach tx (audit_logs: id/entityType/entityId/action + JSON). */
async function writeAudit(tx: Tx, entry: AuditEntry): Promise<void> {
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

/**
 * Aktywuje wersję SCHEDULED z effectiveFrom <= now. Jedna tx: stare
 * ACTIVE→ARCHIVED + nowa ACTIVE + settings timestamp + audit ACTIVATE.
 * Opcjonalna nota (trim, max 500, pustka = bez noty) trafia tylko do wpisu
 * audytu (newData.note) — wiersz wersji nietknięty poza statusem.
 * effectiveFrom nie późniejsze niż istniejące ACTIVE/BACKDATE → 409
 * PERIOD_OVERLAP (wskazanie na ścieżkę backdate).
 */
export async function activate(
    id: string,
    opts: { userId?: string; note?: unknown } = {}
): Promise<PricelistVersion> {
    const rawNote = normalizeNote(opts.note);
    // Pustka = aktywacja bez noty (jak brak pola); zapis tylko niepustej.
    const note = rawNote === null ? undefined : rawNote;
    const current = await prisma.pricelistVersion.findUnique({ where: { id } });
    if (!current) {
        throw new PricelistVersionError(404, 'NOT_FOUND', `Wersja ${id} nie istnieje`);
    }
    if (!isPricelistType(current.type)) {
        throw new PricelistVersionError(422, 'INVALID_TYPE', `Wersja ${id} ma nieznany typ`);
    }
    const type = current.type;
    const lock = lockFor(type);
    const res = await lock.runWithLock(() =>
        prisma.$transaction(async (tx) => {
            const fresh = await tx.pricelistVersion.findUnique({ where: { id } });
            if (!fresh) {
                throw new PricelistVersionError(404, 'NOT_FOUND', `Wersja ${id} nie istnieje`);
            }
            if (fresh.status !== 'SCHEDULED') {
                throw new PricelistVersionError(
                    409,
                    'ACTIVATE_NOT_SCHEDULED',
                    `Wersję ${id} można aktywować tylko ze statusu SCHEDULED (obecny: ${fresh.status})` +
                        (fresh.status === 'BACKDATE_REQUESTED'
                            ? ' — użyj ścieżki backdate (POST /:id/backdate)'
                            : '')
                );
            }
            const nowIso = new Date().toISOString();
            if (fresh.effectiveFrom > nowIso) {
                throw new PricelistVersionError(
                    409,
                    'ACTIVATE_NOT_DUE',
                    `Wersja ${id} wejdzie w życie ${fresh.effectiveFrom} — aktywacja przed terminem`
                );
            }
            const lived = await tx.pricelistVersion.findMany({
                where: { type, status: { in: [...RESOLVABLE_STATUSES] } },
                select: { id: true, effectiveFrom: true }
            });
            const maxEff =
                lived.length > 0
                    ? lived
                          .map((v) => v.effectiveFrom)
                          .sort()
                          .reverse()[0]
                    : null;
            if (maxEff !== null && fresh.effectiveFrom <= maxEff) {
                throw new PricelistVersionError(
                    409,
                    'PERIOD_OVERLAP',
                    `effectiveFrom ${fresh.effectiveFrom} wpada w istniejący okres (max ${maxEff})` +
                        ' — użyj ścieżki backdate (POST /:id/backdate)'
                );
            }
            const archived = await tx.pricelistVersion.updateMany({
                where: { type, status: 'ACTIVE' },
                data: { status: 'ARCHIVED' }
            });
            // M2: predykat statusu — dwa procesy (in-memory lock jest per-proces)
            // nie aktywują tej samej wersji dwukrotnie; przegrany dostaje 409.
            const activated = await tx.pricelistVersion.updateMany({
                where: { id, status: 'SCHEDULED' },
                data: { status: 'ACTIVE' }
            });
            if (activated.count !== 1) {
                throw new PricelistVersionError(
                    409,
                    'ACTIVATE_RACE',
                    `Wersja ${id} zmieniła status w trakcie aktywacji — odśwież i spróbuj ponownie`
                );
            }
            const updated = await tx.pricelistVersion.findUnique({ where: { id } });
            if (!updated) {
                throw new PricelistVersionError(404, 'NOT_FOUND', `Wersja ${id} nie istnieje`);
            }
            await tx.settings.upsert({
                where: { key: DEFAULTS_UPDATED_AT_KEY },
                update: { value: nowIso },
                create: { key: DEFAULTS_UPDATED_AT_KEY, value: nowIso }
            });
            await writeAudit(tx, {
                entityId: id,
                userId: opts.userId,
                action: 'ACTIVATE',
                oldData: { przed: 'SCHEDULED' },
                newData: {
                    po: 'ACTIVE',
                    archivedCount: archived.count,
                    effectiveFrom: fresh.effectiveFrom,
                    ...(note === undefined ? {} : { note })
                }
            });
            return updated;
        })
    );
    if (!res.acquired) {
        throw new PricelistVersionError(
            503,
            'LOCK_BUSY',
            `Zapis wersji ${type} chwilowo zablokowany`
        );
    }
    return res.value;
}

/**
 * Stosuje backdate (DRAFT→BACKDATE_REQUESTED→BACKDATE): tylko
 * BACKDATE_REQUESTED, nota ≥ 10 znaków, kolizja (type, effectiveFrom)
 * z inną wersją → 409 EFFECTIVE_COLLISION. Tx + audit BACKDATE {przed/po}.
 * Bez auto-aktywacji cronem.
 */
export async function applyBackdate(
    id: string,
    noteInput: unknown,
    opts: { userId?: string } = {}
): Promise<PricelistVersion> {
    const note = typeof noteInput === 'string' ? noteInput.trim() : '';
    if (note.length < BACKDATE_NOTE_MIN) {
        throw new PricelistVersionError(
            400,
            'NOTE_TOO_SHORT',
            `Nota backdate musi mieć min. ${BACKDATE_NOTE_MIN} znaków (uzasadnienie zmiany historycznej)`
        );
    }
    const current = await prisma.pricelistVersion.findUnique({ where: { id } });
    if (!current) {
        throw new PricelistVersionError(404, 'NOT_FOUND', `Wersja ${id} nie istnieje`);
    }
    if (!isPricelistType(current.type)) {
        throw new PricelistVersionError(422, 'INVALID_TYPE', `Wersja ${id} ma nieznany typ`);
    }
    const type = current.type;
    const lock = lockFor(type);
    const res = await lock.runWithLock(() =>
        prisma.$transaction(async (tx) => {
            const fresh = await tx.pricelistVersion.findUnique({ where: { id } });
            if (!fresh) {
                throw new PricelistVersionError(404, 'NOT_FOUND', `Wersja ${id} nie istnieje`);
            }
            if (fresh.status !== 'BACKDATE_REQUESTED') {
                throw new PricelistVersionError(
                    409,
                    'BACKDATE_NOT_REQUESTED',
                    `Backdate dotyczy tylko statusu BACKDATE_REQUESTED (obecny: ${fresh.status})`
                );
            }
            const clash = await tx.pricelistVersion.findFirst({
                where: {
                    type,
                    effectiveFrom: fresh.effectiveFrom,
                    id: { not: id },
                    // Tylko wersje na osi czasu — drugi szkic z tym samym eff
                    // dostanie 409 dopiero przy próbie wejścia na oś.
                    status: { in: ['ACTIVE', 'BACKDATE', 'SCHEDULED'] }
                },
                select: { id: true, version: true, status: true }
            });
            if (clash) {
                throw new PricelistVersionError(
                    409,
                    'EFFECTIVE_COLLISION',
                    `Kolizja effectiveFrom ${fresh.effectiveFrom} z wersją ${clash.version} (${clash.status})`
                );
            }
            const nowIso = new Date().toISOString();
            const updated = await tx.pricelistVersion.update({
                where: { id },
                data: { status: 'BACKDATE', note }
            });
            await tx.settings.upsert({
                where: { key: DEFAULTS_UPDATED_AT_KEY },
                update: { value: nowIso },
                create: { key: DEFAULTS_UPDATED_AT_KEY, value: nowIso }
            });
            await writeAudit(tx, {
                entityId: id,
                userId: opts.userId,
                action: 'BACKDATE',
                oldData: { przed: 'BACKDATE_REQUESTED' },
                newData: { po: 'BACKDATE', effectiveFrom: fresh.effectiveFrom, note }
            });
            return updated;
        })
    );
    if (!res.acquired) {
        throw new PricelistVersionError(
            503,
            'LOCK_BUSY',
            `Zapis wersji ${type} chwilowo zablokowany`
        );
    }
    return res.value;
}

export interface ActivateDueResult {
    activated: string[];
    skipped: Array<{ id: string; code: string; reason: string }>;
}

/**
 * Cron: aktywuje pojedynczo każdą SCHEDULED z effectiveFrom <= now
 * (po eff asc, seq asc). BACKDATE_REQUESTED nigdy auto. Błąd jednej
 * wersji nie blokuje pozostałych (trafia do skipped).
 */
export async function activateDue(
    at?: string,
    opts: { userId?: string } = {}
): Promise<ActivateDueResult> {
    const nowIso = at === undefined ? new Date().toISOString() : toUtcIso(at, 'at');
    const due = await prisma.pricelistVersion.findMany({
        where: { status: 'SCHEDULED', effectiveFrom: { lte: nowIso } },
        orderBy: [{ effectiveFrom: 'asc' }, { seq: 'asc' }]
    });
    const result: ActivateDueResult = { activated: [], skipped: [] };
    for (const v of due) {
        try {
            await activate(v.id, opts);
            result.activated.push(v.id);
        } catch (err) {
            if (err instanceof PricelistVersionError) {
                result.skipped.push({ id: v.id, code: err.code, reason: err.message });
            } else {
                result.skipped.push({
                    id: v.id,
                    code: 'UNKNOWN',
                    reason: err instanceof Error ? err.message : String(err)
                });
            }
        }
    }
    return result;
}

export interface VersionExport {
    version: PricelistVersion;
    sections: Record<string, Array<Record<string, unknown>>>;
}

// ─── Etap A: projekcja wersji → shape LIVE (eksport XLSX 1:1 z FE) ───
// SSoT kształtu:
// - RURY: public/js/rury/pricelistUi.js RURY_EXPORT_COLUMNS (linia 336)
// - STUDNIE: public/js/studnie/pricelistState.js EXPORT_COLUMNS (linia 42)
// - arkusze + sort Przejścia + sanitize: liveStudnieSheetName / projectStudnie
//   poniżej (eksport studni buduje serwer, Etap C — brak getSheetName w FE)
// - PRECO: public/js/studnie/pricelistImportExport.js (linie 78-147)
// Zero zmian DB/importu/UI — tylko projekcja wierszy w eksporcie wersji.

export type LiveSheetRows = Record<string, Array<Record<string, unknown>>>;

/** SSoT FE: public/js/rury/pricelistUi.js:336 RURY_EXPORT_COLUMNS. */
export const RURY_LIVE_COLUMNS = [
    { header: 'Indeks', key: 'id' },
    { header: 'Nazwa produktu', key: 'name' },
    { header: 'Cena PLN (netto)', key: 'price' },
    { header: 'Kategoria', key: 'category' },
    { header: 'Waga (kg)', key: 'weight' },
    { header: 'Szt./transport', key: 'transport' },
    { header: 'Powierzchnia (m2)', key: 'area' }
] as const;

export const RURY_LIVE_SHEET = 'Cennik Rury';

/** SSoT FE: public/js/studnie/pricelistState.js:42 EXPORT_COLUMNS. */
export const STUDNIE_LIVE_COLUMNS = [
    { key: 'id', header: 'Indeks' },
    { key: 'name', header: 'Nazwa' },
    { key: 'category', header: 'Kategoria' },
    { key: 'componentType', header: 'Typ komponentu' },
    { key: 'dn', header: 'DN' },
    { key: 'height', header: 'Wysokość mm' },
    { key: 'weight', header: 'Waga kg' },
    { key: 'area', header: 'Pow. wewn. m²' },
    { key: 'areaExt', header: 'Pow. zewn. m²' },
    { key: 'transport', header: 'Ilość/transport' },
    { key: 'price', header: 'Cena PLN' },
    { key: 'doplataPEHD', header: 'Dopłata PEHD' },
    { key: 'malowanieWewnetrzne', header: 'Malow. wewn.' },
    { key: 'malowanieZewnetrzne', header: 'Malow. zewn.' },
    { key: 'doplataZelbet', header: 'Dopłata Żelbet' },
    { key: 'doplataDrabNierdzewna', header: 'Drab. Nierdzewna' },
    { key: 'magazynWL', header: 'Mag WL' },
    { key: 'magazynKLB', header: 'Mag KLB' },
    { key: 'formaStandardowa', header: 'Forma std. WL' },
    { key: 'formaStandardowaKLB', header: 'Forma std. KLB' },
    { key: 'zapasDol', header: 'Zapas dół mm' },
    { key: 'zapasGora', header: 'Zapas góra mm' },
    { key: 'zapasDolMin', header: 'Zapas dół min mm' },
    { key: 'zapasGoraMin', header: 'Zapas góra min mm' },
    { key: 'spocznikH', header: 'Wys. spocznika' },
    { key: 'hMin1', header: 'Hmin 1 mm' },
    { key: 'hMax1', header: 'Hmax 1 mm' },
    { key: 'cena1', header: 'Cena 1 PLN' },
    { key: 'hMin2', header: 'Hmin 2 mm' },
    { key: 'hMax2', header: 'Hmax 2 mm' },
    { key: 'cena2', header: 'Cena 2 PLN' },
    { key: 'hMin3', header: 'Hmin 3 mm' },
    { key: 'hMax3', header: 'Hmax 3 mm' },
    { key: 'cena3', header: 'Cena 3 PLN' }
] as const;

/** SSoT FE: public/js/studnie/pricelistImportExport.js:89-94 (PRECO_Kinety). */
export const PRECO_KINETY_LIVE_COLUMNS = [
    'DN Studni',
    'DN Rury',
    'Cena prosta (PLN)',
    'Dod. wlot (PLN)'
] as const;

/** SSoT FE: public/js/studnie/pricelistImportExport.js:103-110 (PRECO_Zakresy). */
export const PRECO_ZAKRESY_LIVE_COLUMNS = [
    'Typ',
    'DN Studni',
    'Min',
    'Max',
    'Grupa DN',
    'Cena (PLN)'
] as const;

/** SSoT FE: public/js/studnie/pricelistImportExport.js:117-122 (PRECO_Dodatki). */
export const PRECO_DODATKI_LIVE_COLUMNS = [
    'DN Studni',
    'Skrzynka włazowa',
    'Cena dna osadnika',
    'Cena pełna wys MB'
] as const;

export const PRECO_LIVE_SHEETS = ['PRECO_Kinety', 'PRECO_Zakresy', 'PRECO_Dodatki'] as const;

/** SSoT FE: eksport studni buduje serwer (Etap C); grupowanie arkuszy tutaj. */
export function liveStudnieSheetName(p: Record<string, unknown>): string {
    const c = String(p.category ?? '').toLowerCase();
    const ct = String(p.componentType ?? '').toLowerCase();
    if (
        c.includes('akcesoria') ||
        c.includes('chemia') ||
        c.includes('stopnie') ||
        c.includes('uszczelki') ||
        ct === 'wlaz' ||
        ct === 'osadnik'
    )
        return 'Akcesoria';
    if (
        c.includes('przejścia') ||
        c.includes('przejscia') ||
        c.includes('otwór') ||
        c.includes('otwor') ||
        ct === 'przejscie'
    )
        return 'Przejścia';
    if (
        String(p.componentType ?? '')
            .trim()
            .toLowerCase() === 'styczna'
    )
        return 'Styczna';
    if (c.includes('kinet') || ct === 'kineta') return 'Kinety';
    if (c.includes('dennic') || ct === 'dennica') return 'Dennice';
    if (p.dn !== null && p.dn !== undefined && String(p.dn) !== '') {
        return 'DN' + String(p.dn);
    }
    return 'Inne';
}

/** SSoT FE: public/js/studnie/pricelistImportExport.js:74 sanitize. */
export function liveSanitizeSheetName(cat: string): string {
    return cat.replace(/[[\]*/\\?:]/g, '_').substring(0, 31);
}

function toLiveValue(value: unknown): unknown {
    return value ?? '';
}

function parseJsonObject(raw: unknown): Record<string, unknown> {
    if (raw !== null && typeof raw === 'object' && !Array.isArray(raw)) {
        return raw as Record<string, unknown>;
    }
    if (typeof raw !== 'string' || raw === '') return {};
    try {
        const parsed: unknown = JSON.parse(raw);
        if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
            return parsed as Record<string, unknown>;
        }
    } catch {
        // Mechanicznie: zły JSON → brak wierszy z tego rekordu (jak pusta grupa w LIVE).
    }
    return {};
}

function byOrder(a: Record<string, unknown>, b: Record<string, unknown>): number {
    const oa = typeof a.order === 'number' ? a.order : 0;
    const ob = typeof b.order === 'number' ? b.order : 0;
    return oa - ob;
}

function projectRury(rows: Array<Record<string, unknown>>): LiveSheetRows {
    if (rows.length === 0) return {};
    return {
        [RURY_LIVE_SHEET]: rows.map((p) => {
            const row: Record<string, unknown> = {};
            for (const col of RURY_LIVE_COLUMNS) {
                row[col.header] = toLiveValue(p[col.key]);
            }
            return row;
        })
    };
}

function projectStudnie(rows: Array<Record<string, unknown>>): LiveSheetRows {
    const groups: Record<string, Array<Record<string, unknown>>> = {};
    for (const p of rows) {
        const cat = liveStudnieSheetName(p);
        if (!groups[cat]) groups[cat] = [];
        groups[cat].push(p);
    }
    const out: LiveSheetRows = {};
    for (const cat of Object.keys(groups)) {
        // Sort tylko Przejścia (Styczna i reszta bez sortowania).
        const items =
            cat === 'Przejścia'
                ? [...groups[cat]].sort((a, b) => {
                      if (a.category !== b.category) {
                          return String(a.category ?? '').localeCompare(String(b.category ?? ''));
                      }
                      const dnA =
                          typeof a.dn === 'string' ? parseInt(a.dn) || 0 : Number(a.dn) || 0;
                      const dnB =
                          typeof b.dn === 'string' ? parseInt(b.dn) || 0 : Number(b.dn) || 0;
                      return dnA - dnB;
                  })
                : groups[cat];
        out[liveSanitizeSheetName(cat)] = items.map((p) => {
            const row: Record<string, unknown> = {};
            for (const col of STUDNIE_LIVE_COLUMNS) {
                row[col.header] = toLiveValue(p[col.key]);
            }
            return row;
        });
    }
    return out;
}

function projectPreco(sections: Record<string, Array<Record<string, unknown>>>): LiveSheetRows {
    const out: LiveSheetRows = {};
    // LIVE nie sortuje arkuszy preco — kolejność z DB (order). Puste sekcje → pomiń arkusz.
    const kinety = [...(sections.kinety ?? [])].sort(byOrder);
    if (kinety.length > 0) {
        out.PRECO_Kinety = kinety.map((k) => ({
            'DN Studni': k.wellDn ?? '',
            'DN Rury': k.dn ?? '',
            'Cena prosta (PLN)': k.height ?? '',
            'Dod. wlot (PLN)': k.cena ?? ''
        }));
    }
    const zakresy = [...(sections.zakresy ?? [])].sort(byOrder);
    const zakresyRows: Array<Record<string, unknown>> = [];
    for (const row of zakresy) {
        const grupy = parseJsonObject(row.grupy);
        for (const g of Object.keys(grupy)) {
            zakresyRows.push({
                Typ: row.label ?? '',
                'DN Studni': row.wellDn ?? '',
                Min: row.min ?? '',
                Max: row.max ?? '',
                'Grupa DN': g,
                'Cena (PLN)': grupy[g] ?? ''
            });
        }
    }
    if (zakresyRows.length > 0) out.PRECO_Zakresy = zakresyRows;
    const konfig = [...(sections.konfig ?? [])].sort((a, b) => Number(a.key) - Number(b.key));
    if (konfig.length > 0) {
        out.PRECO_Dodatki = konfig.map((row) => {
            const data = parseJsonObject(row.value);
            return {
                'DN Studni': Number(row.key),
                'Skrzynka włazowa': data.skrzynkaWlazowa || 0,
                'Cena dna osadnika': data.cenaDnoOsadnika || 0,
                'Cena pełna wys MB': data.cenaPelnaWysMB || 0
            };
        });
    }
    return out;
}

/**
 * Projekcja wierszy wersji → shape LIVE (arkusze + nagłówki + kolejność 1:1
 * z eksportem przeglądarki). Puste sekcje → brak arkusza (jak LIVE).
 */
export function projectVersionToLiveShape(
    type: PricelistType,
    sections: Record<string, Array<Record<string, unknown>>>
): LiveSheetRows {
    if (type === 'rury') return projectRury(sections.rury ?? []);
    if (type === 'studnie') return projectStudnie(sections.studnie ?? []);
    return projectPreco(sections);
}

// ─── Etap C: eksport XLSX cenników LIVE i DEFAULT ───
// SSoT kształtu = frontend (jak Etap A). Kolumny tabel *Default == LIVE
// (prisma/schema.prisma: ProductsRury == ProductsRuryDefault, ProductsStudnie
// == ProductsStudnieDefault, PrecoKonfig/Kinety/Zakresy == odpowiedniki
// *Default), więc rury/studnie jadą tą samą projekcją na wierszach w shape
// GET (legacy 1/0, dn liczbowe — bez normalizacji, tylko `?? ''` jak FE).
// PRECO live w FE to kształt ZAGNIEŻDŻONY po DN (formatPrecoResponse), więc
// projekcja z tego kształtu 1:1 z pricelistImportExport.js:78-147.

/** Źródło eksportu Etapu C: tabele LIVE albo *Default. */
export type PricelistExportSource = 'live' | 'default';

/** Walidacja ?source=live|default — zły → 422 (jak INVALID_TYPE). */
export function requireExportSource(value: unknown): PricelistExportSource {
    if (value === 'live' || value === 'default') return value;
    throw new PricelistVersionError(
        422,
        'INVALID_SOURCE',
        `Nieprawidłowe źródło eksportu: ${String(value)} (dozwolone: live, default)`
    );
}

/** Typy zakresów PRECO (SSoT FE pricelistImportExport.js:98, kolejność arkusza). */
const PRECO_RANGE_TYPES = ['spadekKineta', 'spadekMufa', 'uniesienie', 'redukcja'] as const;

/**
 * Projekcja kształtu zagnieżdżonego PRECO (formatPrecoResponse: entry
 * { DN: { scalar, kinety, spadekKineta... } }) na 3 arkusze 1:1 z FE
 * (pricelistImportExport.js:78-147). Puste sekcje → brak arkusza (jak FE).
 */
export function projectPrecoNestedToSheets(
    entry: Record<string, unknown> | null | undefined
): LiveSheetRows {
    const out: LiveSheetRows = {};
    const kinetyRows: Array<Record<string, unknown>> = [];
    const zakresyRows: Array<Record<string, unknown>> = [];
    const dodatkiRows: Array<Record<string, unknown>> = [];
    for (const dn of Object.keys(entry ?? {})) {
        const data = (entry as Record<string, unknown>)[dn];
        if (data === null || typeof data !== 'object' || Array.isArray(data)) continue;
        const rec = data as Record<string, unknown>;
        if (Array.isArray(rec.kinety)) {
            for (const k of rec.kinety as Array<Record<string, unknown>>) {
                kinetyRows.push({
                    'DN Studni': Number(dn),
                    'DN Rury': k.dn,
                    'Cena prosta (PLN)': k.prosta,
                    'Dod. wlot (PLN)': k.dodWlot
                });
            }
        }
        for (const typ of PRECO_RANGE_TYPES) {
            const arr = rec[typ];
            if (!Array.isArray(arr)) continue;
            for (const row of arr as Array<Record<string, unknown>>) {
                const grupy = row.grupy;
                if (grupy === null || typeof grupy !== 'object' || Array.isArray(grupy)) continue;
                for (const g of Object.keys(grupy as Record<string, unknown>)) {
                    zakresyRows.push({
                        Typ: typ,
                        'DN Studni': Number(dn),
                        Min: row.min,
                        Max: row.max,
                        'Grupa DN': g,
                        'Cena (PLN)': (grupy as Record<string, unknown>)[g]
                    });
                }
            }
        }
        dodatkiRows.push({
            'DN Studni': Number(dn),
            'Skrzynka włazowa': rec.skrzynkaWlazowa || 0,
            'Cena dna osadnika': rec.cenaDnoOsadnika || 0,
            'Cena pełna wys MB': rec.cenaPelnaWysMB || 0
        });
    }
    if (kinetyRows.length > 0) out.PRECO_Kinety = kinetyRows;
    if (zakresyRows.length > 0) out.PRECO_Zakresy = zakresyRows;
    if (dodatkiRows.length > 0) out.PRECO_Dodatki = dodatkiRows;
    return out;
}

function toXlsxCell(value: unknown): string | number | boolean | null {
    if (value === null || value === undefined) return null;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        return value;
    }
    return String(value);
}

/**
 * Arkusze LIVE → wiersze buildXlsx (nagłówki z pierwszego wiersza).
 * Pusto → 1 pusty arkusz fallback (jak GET /:id/export wersji).
 */
export function liveSheetsToXlsxSheets(live: LiveSheetRows, fallbackName: string): XlsxSheet[] {
    const sheets: XlsxSheet[] = Object.entries(live).map(([name, rows]) => {
        const headers = rows.length > 0 ? Object.keys(rows[0]) : ['id'];
        return {
            name,
            headers,
            rows: rows.map((row) => headers.map((h) => toXlsxCell(row[h])))
        };
    });
    return sheets.length > 0 ? sheets : [{ name: fallbackName, headers: ['id'], rows: [] }];
}

/** Wiersze wersji z biznesowymi id (bez prefiksu versionId:) — pod diff/eksport. */
export async function getVersionExport(id: string): Promise<VersionExport> {
    const version = await prisma.pricelistVersion.findUnique({ where: { id } });
    if (!version) {
        throw new PricelistVersionError(404, 'NOT_FOUND', `Wersja ${id} nie istnieje`);
    }
    if (!isPricelistType(version.type)) {
        throw new PricelistVersionError(422, 'INVALID_TYPE', `Wersja ${id} ma nieznany typ`);
    }
    const items = await loadVersionItems(prisma, version.type, version.id);
    const sections: VersionExport['sections'] = {};
    for (const [key, rows] of Object.entries(items)) {
        sections[key] = toComparable(rows, version.id);
    }
    return { version, sections };
}

/**
 * Arkusze eksportu wersji (shape LIVE) — domknięcie asymetrii LIVE vs VERSION.
 * LIVE (GET /api/products-studnie/export.xlsx, F1) dokleja PRECO po arkuszach
 * studni; eksport zamrożonej wersji studni robi to samo: najnowsza wersja
 * PRECO nie nowsza niż eksportowana (seq <=, dowolny status — snapshot),
 * arkusze PO studni (merge {...studnie, ...preco} jak w F1). Brak starszej
 * lub równej PRECO → tylko studnie (bez błędu, flaga precoIncluded=false).
 * Rury i preco bez zmian.
 */
export async function getVersionExportSheets(
    id: string
): Promise<{ version: PricelistVersion; sheets: LiveSheetRows; precoIncluded: boolean }> {
    const { version, sections } = await getVersionExport(id);
    if (!isPricelistType(version.type)) {
        throw new PricelistVersionError(422, 'INVALID_TYPE', `Wersja ${id} ma nieznany typ`);
    }
    const sheets = projectVersionToLiveShape(version.type, sections);
    if (version.type !== 'studnie') return { version, sheets, precoIncluded: true };
    // PRECO: najnowsza wersja nie nowsza niż eksportowana (seq <=) — parowanie
    // po equal-seq gubiło PRECO zawsze gdy typy miały rozjechane seq.
    const precoVersion = await prisma.pricelistVersion.findFirst({
        where: { type: 'preco', seq: { lte: version.seq } },
        orderBy: { seq: 'desc' }
    });
    if (!precoVersion) return { version, sheets, precoIncluded: false };
    const preco = await getVersionExport(precoVersion.id);
    return {
        version,
        sheets: { ...sheets, ...projectVersionToLiveShape('preco', preco.sections) },
        precoIncluded: true
    };
}

// ─── Faza B: clone-as-draft (rollback „przywróć starą jako nowy draft") ───
// Dopiski Fazy B — F1/F2/F3 powyżej nietknięte.

export interface CloneDraftOptions {
    userId?: string;
    note?: string;
}

/**
 * Klonuje wiersze dowolnej wersji (ACTIVE/BACKDATE/SCHEDULED/DRAFT — bez
 * ograniczeń statusu źródła) do nowej wersji DRAFT z seq = MAX+1.
 * Aktywna wersja nietknięta; nowy draft czeka na edycję/aktywację.
 * Lock per-type + audit CLONE (wzorzec activate/applyBackdate).
 */
export async function cloneAsDraft(
    id: string,
    opts: CloneDraftOptions = {}
): Promise<PricelistVersion> {
    const source = await prisma.pricelistVersion.findUnique({ where: { id } });
    if (!source) {
        throw new PricelistVersionError(404, 'NOT_FOUND', `Wersja ${id} nie istnieje`);
    }
    if (!isPricelistType(source.type)) {
        throw new PricelistVersionError(422, 'INVALID_TYPE', `Wersja ${id} ma nieznany typ`);
    }
    const type = source.type;
    const { sections } = await getVersionExport(id);
    const rowsInput: unknown =
        type === 'preco'
            ? {
                  konfig: sections.konfig ?? [],
                  kinety: sections.kinety ?? [],
                  zakresy: sections.zakresy ?? []
              }
            : ((sections[type] ?? []) as unknown);
    const validated = validateRows(type, rowsInput);
    const sha256 = sha256Canonical(validated);

    const lock = lockFor(type);
    const res = await lock.runWithLock(() =>
        prisma.$transaction(async (tx) => {
            const agg = await tx.pricelistVersion.aggregate({
                _max: { seq: true },
                where: { type }
            });
            const seq = (agg._max.seq ?? 0) + 1;
            const nowIso = new Date().toISOString();
            const newId = randomUUID();
            const version = await tx.pricelistVersion.create({
                data: {
                    id: newId,
                    type,
                    seq,
                    version: versionLabel(seq, nowIso),
                    status: 'DRAFT',
                    effectiveFrom: nowIso,
                    createdBy: opts.userId,
                    note: opts.note ?? `Klon wersji ${source.version}`,
                    sha256,
                    createdAt: nowIso
                }
            });
            await insertVersionItems(tx, type, newId, validated);
            await writeAudit(tx, {
                entityId: newId,
                userId: opts.userId,
                action: 'CLONE',
                oldData: { z: source.id, wersja: source.version, status: source.status },
                newData: { seq, wersja: version.version }
            });
            return version;
        })
    );
    if (!res.acquired) {
        throw new PricelistVersionError(
            503,
            'LOCK_BUSY',
            `Zapis wersji ${type} chwilowo zablokowany`
        );
    }
    return res.value;
}

export interface VersionUsage {
    offers: number;
    orders: number;
    total: number;
}

interface UsageCounter {
    count(args: { where: { pricelistVersionId: string } }): Promise<number>;
}

interface UsageClient {
    offers_rel: UsageCounter;
    offers_studnie_rel: UsageCounter;
    orders_rury_rel: UsageCounter;
    orders_studnie_rel: UsageCounter;
}

/** Ile ofert/zamówień trzyma pieczątkę danej wersji (4× count po pricelistVersionId). */
async function countUsage(client: UsageClient, id: string): Promise<VersionUsage> {
    const where = { where: { pricelistVersionId: id } };
    const [o1, o2, r1, r2] = await Promise.all([
        client.offers_rel.count(where),
        client.offers_studnie_rel.count(where),
        client.orders_rury_rel.count(where),
        client.orders_studnie_rel.count(where)
    ]);
    const offers = o1 + o2;
    const orders = r1 + r2;
    return { offers, orders, total: offers + orders };
}

/** Użycie wersji przez oferty/zamówienia (publiczne — pod GET / usedBy). */
export async function countVersionUsage(id: string): Promise<VersionUsage> {
    return countUsage(prisma as unknown as UsageClient, id);
}

// ─── Usuwanie wersji ─────────────────────────────────────────────

/** Statusy usuwalne: wersja nigdy nie była widoczna dla ofert ani resolveActive. */
const DELETABLE_STATUSES: readonly string[] = ['DRAFT', 'SCHEDULED', 'BACKDATE_REQUESTED'];

/**
 * Usuwa wersję wraz z pozycjami (tx) + audit DELETE. Allowlist
 * (DRAFT/SCHEDULED/BACKDATE_REQUESTED) kasuje jak dziś. ACTIVE/BACKDATE
 * ZAWSZE 409 NOT_DELETABLE — także przy zerowym użyciu, bo resolveActive
 * rozdaje je nowym ofertom (wyścig: count=0 w tej chwili ≠ 0 za chwilę).
 * ARCHIVED (i inne przyszłe statusy spoza allowlist) kasuje się tylko bez
 * użycia (usage.total === 0); z użyciem → 409 USED_BY z liczbą w komunikacie.
 */
export async function deleteVersion(
    id: string,
    opts: { userId?: string } = {}
): Promise<{ id: string }> {
    const current = await prisma.pricelistVersion.findUnique({ where: { id } });
    if (!current) {
        throw new PricelistVersionError(404, 'NOT_FOUND', `Wersja ${id} nie istnieje`);
    }
    if (!isPricelistType(current.type)) {
        throw new PricelistVersionError(422, 'INVALID_TYPE', `Wersja ${id} ma nieznany typ`);
    }
    if (current.status === 'ACTIVE' || current.status === 'BACKDATE') {
        throw new PricelistVersionError(
            409,
            'NOT_DELETABLE',
            `Wersji ${id} o statusie ${current.status} nie można usunąć (trzyma historię ofert)`
        );
    }
    let usage: VersionUsage | null = null;
    if (!DELETABLE_STATUSES.includes(current.status)) {
        usage = await countVersionUsage(id);
        if (usage.total > 0) {
            throw new PricelistVersionError(
                409,
                'USED_BY',
                `Wersji ${id} używa ${usage.total} ofert/zamówień — historia chroniona`
            );
        }
    }
    const type = current.type;
    const lock = lockFor(type);
    const res = await lock.runWithLock(() =>
        prisma.$transaction(async (tx) => {
            const fresh = await tx.pricelistVersion.findUnique({ where: { id } });
            if (!fresh) {
                throw new PricelistVersionError(404, 'NOT_FOUND', `Wersja ${id} nie istnieje`);
            }
            if (fresh.status === 'ACTIVE' || fresh.status === 'BACKDATE') {
                throw new PricelistVersionError(
                    409,
                    'NOT_DELETABLE',
                    `Wersji ${id} o statusie ${fresh.status} nie można usunąć (trzyma historię ofert)`
                );
            }
            const allowlisted = DELETABLE_STATUSES.includes(fresh.status);
            if (!allowlisted) {
                // Re-check w tx: pieczątka mogła przybyć po wstępnym councie.
                const freshUsage = await countUsage(tx as unknown as UsageClient, id);
                if (freshUsage.total > 0) {
                    throw new PricelistVersionError(
                        409,
                        'USED_BY',
                        `Wersji ${id} używa ${freshUsage.total} ofert/zamówień — historia chroniona`
                    );
                }
            }
            await deleteVersionItems(tx, type, id);
            await writeAudit(tx, {
                entityId: id,
                userId: opts.userId,
                action: 'DELETE',
                oldData: allowlisted
                    ? { wersja: fresh.version, status: fresh.status, seq: fresh.seq }
                    : { wersja: fresh.version, status: fresh.status, seq: fresh.seq, offers: 0 }
            });
            await tx.pricelistVersion.delete({ where: { id } });
            return { id };
        })
    );
    if (!res.acquired) {
        throw new PricelistVersionError(
            503,
            'LOCK_BUSY',
            `Usunięcie wersji ${type} chwilowo zablokowane`
        );
    }
    return res.value;
}

// ─── F3: freeze ofert ────────────────────────────────────────────────
// Dopiski F3 — F1/F2 powyżej nietknięte.

/**
 * Null-safe freeze: id aktywnej wersji w chwili utworzenia oferty.
 * Null gdy brak wersji (legacy) albo błąd odczytu — oferta i tak powstaje,
 * snapshot cen w JSON jest źródłem prawdy (Expand & Contract).
 */
export async function resolveVersionIdSafe(typeInput: unknown): Promise<string | null> {
    try {
        const active = await resolveActive(typeInput);
        return active?.id ?? null;
    } catch {
        return null;
    }
}

// ─── Paczka 1: oferty czytają ceny z wersji ACTIVE (centralny resolver) ───
// Jeden switch per-type tutaj — trasy wołają tylko resolveActivePricing(type)
// bez własnych ifów. Rows w kształcie LEGACY gotowym do response:
// rury flat, studnie flat legacy (toLegacy: 1/0, dn liczba/string),
// preco nested per DN jak formatPrecoResponse (data = zawartość pola data).

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

export interface ActivePricing {
    /** Zawartość pola `data` w response (rury/studnie: wiersze; preco: [entry]). */
    data: unknown;
    /** true = brak ACTIVE, trasa czyta LIVE + stawia X-Pricelist-Fallback: live. */
    fallback: boolean;
    versionId: string | null;
}

/** Porównanie tekstów jak sort DB (kategoria/id w GET live). */
function cmpText(a: unknown, b: unknown): number {
    const sa = String(a ?? '');
    const sb = String(b ?? '');
    return sa < sb ? -1 : sa > sb ? 1 : 0;
}

/**
 * Wiersz wersji studni (canonical: boolean, dn string) → legacy z GET live
 * (kopia toLegacy z productsStudnieV2.ts: booleany 1/0, dn liczba/string).
 */
function studnieVersionRowToLegacy(row: Record<string, unknown>): Record<string, unknown> {
    const out = { ...row };
    for (const field of STUDNIE_BOOL_FIELDS) {
        out[field] = out[field] ? 1 : 0;
    }
    const dn = out.dn;
    out.dn = dn != null ? (Number.isNaN(Number(dn)) ? dn : Number(dn)) : null;
    return out;
}

/**
 * Sekcje wersji preco → entry zagnieżdżone per DN (kopia semantyki
 * formatPrecoResponse z precoPricingV2.ts: konfig value JSON → scalary;
 * kinety {dn, prosta: height, dodWlot: cena, order}; zakresy per label
 * z grupy JSON; sort kinety dn/height, zakresy order).
 */
function buildPrecoEntryFromSections(
    sections: Record<string, Array<Record<string, unknown>>>
): Record<string, unknown> {
    const konfig = sections.konfig ?? [];
    const kinety = sections.kinety ?? [];
    const zakresy = sections.zakresy ?? [];
    const entry: Record<string, unknown> = {};
    for (const row of konfig) {
        const key = String(row.key);
        const wellDn = Number(row.key);
        const parsed = parseJsonObject(row.value);
        const kin = [...kinety]
            .filter((k) => Number(k.wellDn) === wellDn)
            .sort((a, b) => Number(a.dn) - Number(b.dn) || Number(a.height) - Number(b.height))
            .map((k) => ({ dn: k.dn, prosta: k.height, dodWlot: k.cena, order: k.order }));
        const ranges: Record<string, unknown> = {};
        for (const label of PRECO_RANGE_TYPES) {
            ranges[label] = [...zakresy]
                .filter((z) => String(z.label) === label && Number(z.wellDn) === wellDn)
                .sort((a, b) => Number(a.order) - Number(b.order))
                .map((z) => ({
                    order: z.order,
                    min: z.min,
                    max: z.max,
                    grupy: parseJsonObject(z.grupy)
                }));
        }
        entry[key] = { ...parsed, kinety: kin, ...ranges };
    }
    return entry;
}

/**
 * Ceny z wersji ACTIVE w kształcie LEGACY. Brak ACTIVE → fallback (data null,
 * trasa czyta LIVE jak dziś). Jedyny switch per-type w paczce.
 */
export async function resolveActivePricing(typeInput: unknown): Promise<ActivePricing> {
    const type = requireType(typeInput);
    const active = await resolveActive(type);
    if (!active) return { data: null, fallback: true, versionId: null };
    const { sections } = await getVersionExport(active.id);
    if (type === 'rury') {
        const rows = [...(sections.rury ?? [])].sort(
            (a, b) => cmpText(a.category, b.category) || cmpText(a.id, b.id)
        );
        return { data: rows, fallback: false, versionId: active.id };
    }
    if (type === 'studnie') {
        const rows = [...(sections.studnie ?? [])]
            .sort(
                (a, b) =>
                    cmpText(a.category, b.category) ||
                    cmpText(a.componentType, b.componentType) ||
                    cmpText(a.id, b.id)
            )
            .map(studnieVersionRowToLegacy);
        return { data: rows, fallback: false, versionId: active.id };
    }
    const entry = buildPrecoEntryFromSections(sections);
    return {
        data: Object.keys(entry).length > 0 ? [entry] : [{}],
        fallback: false,
        versionId: active.id
    };
}
