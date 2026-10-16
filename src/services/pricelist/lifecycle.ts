/**
 * pricelist/lifecycle — drafty per typ, aktywacja, backdate, cron,
 * usuwanie, clone-as-draft. Kod przeniesiony 1:1
 * z pricelistVersionService.ts (F1/F2/Faza B, zero zmian logiki).
 * Odczyty: resolveActive w usage.ts, getVersionDiff w export.ts.
 */

import { randomUUID } from 'crypto';
import prisma from '../../prismaClient';
import type { PricelistVersion } from '../../../generated/prisma';
import { sha256Canonical } from '../priceOverrideService';
import {
    PricelistVersionError,
    assertEditable,
    deleteVersionItems,
    insertVersionItems,
    isPricelistType,
    isUniqueViolation,
    lockFor,
    normalizeNote,
    requireType,
    toUtcIso,
    validateRows,
    writeAudit,
    RESOLVABLE_STATUSES
} from './validation';
import type { CreateDraftOptions, PricelistStatus, PricelistType, VersionRows } from './validation';
import { getVersionExport } from './export';
import { countUsage, countVersionUsage } from './usage';
import type { UsageClient, VersionUsage } from './usage';

/** Limity retry przy kolizji seq (race dwóch createDraft). */
const SEQ_RETRY_LIMIT = 3;

/** Klucz fresh-guarda współdzielony ze starym priceOverrideService. */
const DEFAULTS_UPDATED_AT_KEY = 'pricelist_defaults_updated_at';

/**
 * Osobny klucz znacznika aktywacji wersji (rozdzielony od snapshotu
 * domyślnych — wcześniej obie operacje bumpowały ten sam klucz, więc FE
 * nie rozróżniało przyczyny odświeżenia).
 */
export const ACTIVE_UPDATED_AT_KEY = 'pricelist_active_updated_at';

async function touchActiveTimestamp(
    tx: {
        settings: {
            upsert(args: {
                where: { key: string };
                update: { value: string };
                create: { key: string; value: string };
            }): Promise<unknown>;
        };
    },
    nowIso: string
): Promise<void> {
    await tx.settings.upsert({
        where: { key: DEFAULTS_UPDATED_AT_KEY },
        update: { value: nowIso },
        create: { key: DEFAULTS_UPDATED_AT_KEY, value: nowIso }
    });
    await tx.settings.upsert({
        where: { key: ACTIVE_UPDATED_AT_KEY },
        update: { value: nowIso },
        create: { key: ACTIVE_UPDATED_AT_KEY, value: nowIso }
    });
}

/** Minimalna długość noty backdate (uzasadnienie zmiany historycznej). */
const BACKDATE_NOTE_MIN = 10;

/** Statusy usuwalne: wersja nigdy nie była widoczna dla ofert ani resolveActive. */
const DELETABLE_STATUSES: readonly string[] = ['DRAFT', 'SCHEDULED', 'BACKDATE_REQUESTED'];

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
                await writeAudit(tx, {
                    entityId: id,
                    userId: meta.createdBy,
                    action: 'CREATE',
                    newData: {
                        seq,
                        wersja: version.version,
                        status,
                        effectiveFrom: meta.effectiveFrom
                    }
                });
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
 * Podmienia wiersze i/lub notę wersji (tylko DRAFT/SCHEDULED/BACKDATE_REQUESTED)
 * + nowe SHA przy podmianie wierszy. rows undefined = bez podmiany wierszy
 * (sama nota dozwolona); note undefined = nota bez zmian, pusty string czyści
 * notę. Brak obu (rows i note undefined) → 422 NO_CHANGES.
 */
export async function updateDraft(
    id: string,
    rowsInput?: unknown,
    noteInput?: unknown,
    opts: { userId?: string } = {}
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
            const updated = await tx.pricelistVersion.update({ where: { id }, data });
            await writeAudit(tx, {
                entityId: id,
                userId: opts.userId,
                action: 'UPDATE',
                oldData: { status: fresh.status },
                newData: {
                    ...(rows !== null ? { wiersze: 'podmienione', sha256 } : {}),
                    ...(note !== undefined ? { note } : {})
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
            await touchActiveTimestamp(tx, nowIso);
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
            await touchActiveTimestamp(tx, nowIso);
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

/**
 * Publikuje wersję roboczą (DRAFT → SCHEDULED albo BACKDATE_REQUESTED).
 * Domyka ślepą uliczkę klonów: cloneAsDraft tworzy DRAFT, a activate
 * przyjmuje tylko SCHEDULED — bez publish DRAFT nie mógł wejść na oś czasu.
 * Decyzja o statusie ta sama co w createDraft (effectiveFrom vs max).
 */
export async function publishDraft(
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
            if (fresh.status !== 'DRAFT') {
                throw new PricelistVersionError(
                    409,
                    'PUBLISH_NOT_DRAFT',
                    `Opublikować można tylko wersję roboczą DRAFT (obecny: ${fresh.status})`
                );
            }
            const agg = await tx.pricelistVersion.aggregate({
                _max: { effectiveFrom: true },
                where: { type, id: { not: id } }
            });
            const maxEffectiveFrom = (agg._max as { effectiveFrom?: string | null }).effectiveFrom;
            const next: PricelistStatus =
                maxEffectiveFrom == null || fresh.effectiveFrom > maxEffectiveFrom
                    ? 'SCHEDULED'
                    : 'BACKDATE_REQUESTED';
            const updated = await tx.pricelistVersion.update({
                where: { id },
                data: { status: next }
            });
            await writeAudit(tx, {
                entityId: id,
                userId: opts.userId,
                action: 'PUBLISH',
                oldData: { przed: 'DRAFT' },
                newData: { po: next, effectiveFrom: fresh.effectiveFrom }
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
