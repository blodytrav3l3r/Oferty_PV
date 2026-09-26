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

/** Waliduje wiersze zod per typ (schematy + .nonnegative()); błąd → 422. */
function validateRows(type: PricelistType, rows: unknown): VersionRows {
    if (type === 'rury') {
        const parsed = productsRuryRowSchema.array().safeParse(rows);
        if (!parsed.success) throwRowsError('rury', parsed.error.issues);
        return parsed.data;
    }
    if (type === 'studnie') {
        const parsed = productsStudnieRowSchema.array().safeParse(rows);
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

/** Wstawia wiersze wersji paczkami po 25 (baza błędów #1, chunkedCreateMany). */
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
        if (data.length > 0) await chunkedCreateMany(tx.pricelistItemRury, data);
        return;
    }
    if (type === 'studnie') {
        const data = (rows as StudnieRows).map((row) => ({
            ...row,
            id: `${versionId}:${row.id}`,
            versionId
        }));
        if (data.length > 0) await chunkedCreateMany(tx.pricelistItemStudnie, data);
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
    if (konfig.length > 0) await chunkedCreateMany(tx.pricelistItemPrecoKonfig, konfig);
    if (kinety.length > 0) await chunkedCreateMany(tx.pricelistItemPrecoKinety, kinety);
    if (zakresy.length > 0) await chunkedCreateMany(tx.pricelistItemPrecoZakresy, zakresy);
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

/** Podmienia wiersze wersji (tylko DRAFT/SCHEDULED/BACKDATE_REQUESTED) + nowe SHA. */
export async function updateDraft(id: string, rowsInput: unknown): Promise<PricelistVersion> {
    const current = await prisma.pricelistVersion.findUnique({ where: { id } });
    if (!current) {
        throw new PricelistVersionError(404, 'NOT_FOUND', `Wersja ${id} nie istnieje`);
    }
    assertEditable(current.status, id);
    if (!isPricelistType(current.type)) {
        throw new PricelistVersionError(422, 'INVALID_TYPE', `Wersja ${id} ma nieznany typ`);
    }
    const type = current.type;
    const rows = validateRows(type, rowsInput);
    const sha256 = sha256Canonical(rows);

    const lock = lockFor(type);
    const res = await lock.runWithLock(() =>
        prisma.$transaction(async (tx) => {
            const fresh = await tx.pricelistVersion.findUnique({ where: { id } });
            if (!fresh) {
                throw new PricelistVersionError(404, 'NOT_FOUND', `Wersja ${id} nie istnieje`);
            }
            assertEditable(fresh.status, id);
            await deleteVersionItems(tx, type, id);
            await insertVersionItems(tx, type, id, rows);
            return tx.pricelistVersion.update({ where: { id }, data: { sha256 } });
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
 * effectiveFrom nie późniejsze niż istniejące ACTIVE/BACKDATE → 409
 * PERIOD_OVERLAP (wskazanie na ścieżkę backdate).
 */
export async function activate(
    id: string,
    opts: { userId?: string } = {}
): Promise<PricelistVersion> {
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
            const updated = await tx.pricelistVersion.update({
                where: { id },
                data: { status: 'ACTIVE' }
            });
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
                    effectiveFrom: fresh.effectiveFrom
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
