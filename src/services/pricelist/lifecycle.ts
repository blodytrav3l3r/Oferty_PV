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
    writeAudit
} from './validation';
import type { CreateDraftOptions, PricelistStatus, PricelistType, VersionRows } from './validation';
import { getVersionExport } from './export';
import { countUsage, countVersionUsage, getPrecoReferences } from './usage';
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

/**
 * Tworzy draft wersji: zod + SHA + seq = MAX+1 w tx. Status zawsze DRAFT —
 * o osi czasu decyduje dopiero approve (effectiveFrom).
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
            note: normalizeNote(opts.note) ?? undefined,
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

/** Prefiks etykiety per oś (R=rury, S=studnie, P=preco). */
const TYPE_PREFIX: Record<PricelistType, string> = {
    rury: 'R',
    studnie: 'S',
    preco: 'P'
};

/** Labelka wersji: {Prefiks}v{seq}-{RRRRMMDD} z effectiveFrom (UTC). */
export function versionLabel(type: PricelistType, seq: number, effectiveFromIso: string): string {
    const d = new Date(effectiveFromIso);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${TYPE_PREFIX[type]}v${seq}-${y}${m}${day}`;
}

/** Jeden szkic na typ — pilnuje tego indeks `ux_pricelist_version_one_draft`. */
const DRAFT_EXISTS_MESSAGE = (type: string, version: string) =>
    `Szkic ${version} (${type}) już istnieje — edytuj go zamiast tworzyć kolejny`;

async function createDraftTx(
    type: PricelistType,
    rows: VersionRows,
    meta: { effectiveFrom: string; note?: string; createdBy?: string; sha256: string }
): Promise<PricelistVersion> {
    let lastErr: unknown = null;
    for (let attempt = 1; attempt <= SEQ_RETRY_LIMIT; attempt++) {
        try {
            return await prisma.$transaction(async (tx) => {
                const existingDraft = await tx.pricelistVersion.findFirst({
                    where: { type, status: 'DRAFT' },
                    select: { version: true }
                });
                if (existingDraft) {
                    throw new PricelistVersionError(
                        409,
                        'DRAFT_EXISTS',
                        DRAFT_EXISTS_MESSAGE(type, existingDraft.version)
                    );
                }
                const agg = await tx.pricelistVersion.aggregate({
                    _max: { seq: true },
                    where: { type }
                });
                const seq = (agg._max.seq ?? 0) + 1;
                const status: PricelistStatus = 'DRAFT';
                const id = randomUUID();
                const version = await tx.pricelistVersion.create({
                    data: {
                        id,
                        type,
                        seq,
                        version: versionLabel(type, seq, meta.effectiveFrom),
                        status,
                        effectiveFrom: meta.effectiveFrom,
                        createdBy: meta.createdBy,
                        note: meta.note,
                        sha256: meta.sha256,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
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
            // Wyścig dwóch createDraft: przegrany trafia w indeks jednego szkicu.
            const clash = await prisma.pricelistVersion.findFirst({
                where: { type, status: 'DRAFT' },
                select: { version: true }
            });
            if (clash) {
                throw new PricelistVersionError(
                    409,
                    'DRAFT_EXISTS',
                    DRAFT_EXISTS_MESSAGE(type, clash.version)
                );
            }
        }
    }
    throw new PricelistVersionError(
        409,
        'SEQ_CONFLICT',
        `Nie udało się przydzielić seq dla ${type} (kolizja równoległych zapisów): ${String(lastErr)}`
    );
}

/**
 * Podmienia wiersze i/lub notę wersji (tylko DRAFT).
 * + nowe SHA przy podmianie wierszy. rows undefined = bez podmiany wierszy
 * (sama nota dozwolona); note undefined = nota bez zmian, pusty string czyści
 * notę. Brak obu (rows i note undefined) → 422 NO_CHANGES.
 */
export async function updateDraft(
    id: string,
    rowsInput?: unknown,
    noteInput?: unknown,
    opts: { userId?: string; expectedSha?: string } = {}
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
            // If-Match: klient pracował na innym sha niż aktualny → nie nadpisujemy po cichu.
            if (opts.expectedSha !== undefined && fresh.sha256 !== opts.expectedSha) {
                throw new PricelistVersionError(
                    409,
                    'STALE_DRAFT',
                    `Szkic ${fresh.version} zmienił się od czasu wczytania — odśwież dane`,
                    { currentSha: fresh.sha256 }
                );
            }
            assertEditable(fresh.status, id);
            const data: { sha256?: string; note?: string | null; updatedAt?: string } = {};
            if (rows !== null && sha256 !== null) {
                await deleteVersionItems(tx, type, id);
                await insertVersionItems(tx, type, id, rows);
                data.sha256 = sha256;
            }
            if (note !== undefined) data.note = note;
            data.updatedAt = new Date().toISOString();
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
 * Zatwierdza DRAFT: status='APPROVED' + approvedBy/approvedAt. Oś czasu należy
 * do effectiveFrom — przyszła data = SCHEDULED, przeszła = ACTIVE/ARCHIVED
 * (wyliczane, nigdy zapisane). Jedna tx: re-walidacja statusu/kolizji + audit.
 * `effectiveFrom` bez body = zapisany w wersji (FE publish nie wysyła daty).
 * `requirePastNote` = true wymaga noty >=10 znaków przy dacie w przeszłości.
 */
export interface ApproveVersionOptions {
    userId?: string;
    note?: unknown;
    effectiveFrom?: unknown;
    requirePastNote?: boolean;
}

export async function approveVersion(
    id: string,
    opts: ApproveVersionOptions = {}
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
                    'APPROVE_NOT_DRAFT',
                    `Zatwierdzić można tylko szkic DRAFT (obecny: ${fresh.status})`
                );
            }
            const effectiveFrom =
                opts.effectiveFrom === undefined
                    ? fresh.effectiveFrom
                    : toUtcIso(opts.effectiveFrom, 'effectiveFrom');
            const note = normalizeNote(opts.note);
            const nowIso = new Date().toISOString();
            if (opts.requirePastNote && effectiveFrom < nowIso) {
                // Puste body czyści notę — nie może odziedziczyć starej i zniknąć.
                const reason = (note === null ? '' : (note ?? fresh.note ?? '')).trim();
                if (reason.length < BACKDATE_NOTE_MIN) {
                    throw new PricelistVersionError(
                        400,
                        'NOTE_TOO_SHORT',
                        `Nota korekty wstecznej musi mieć min. ${BACKDATE_NOTE_MIN} znaków`
                    );
                }
            }
            const clash = await tx.pricelistVersion.findFirst({
                where: {
                    type,
                    effectiveFrom,
                    id: { not: id },
                    status: 'APPROVED'
                },
                select: { id: true, version: true }
            });
            if (clash) {
                throw new PricelistVersionError(
                    409,
                    'EFFECTIVE_COLLISION',
                    `Kolizja effectiveFrom ${effectiveFrom} z wersją ${clash.version}`
                );
            }
            let updated: PricelistVersion;
            try {
                const changed = await tx.pricelistVersion.updateMany({
                    where: { id, status: 'DRAFT' },
                    data: {
                        status: 'APPROVED',
                        effectiveFrom,
                        ...(effectiveFrom === fresh.effectiveFrom
                            ? {}
                            : { version: versionLabel(type, fresh.seq, effectiveFrom) }),
                        approvedBy: opts.userId ?? null,
                        approvedAt: nowIso,
                        updatedAt: nowIso,
                        ...(note === undefined ? {} : { note })
                    }
                });
                if (changed.count !== 1) {
                    throw new PricelistVersionError(
                        409,
                        'APPROVE_RACE',
                        `Wersja ${id} zmieniła status w trakcie zatwierdzania — odśwież i spróbuj ponownie`
                    );
                }
                const row = await tx.pricelistVersion.findUnique({ where: { id } });
                if (!row) {
                    throw new PricelistVersionError(404, 'NOT_FOUND', `Wersja ${id} nie istnieje`);
                }
                updated = row;
            } catch (err) {
                if (isUniqueViolation(err)) {
                    throw new PricelistVersionError(
                        409,
                        'EFFECTIVE_COLLISION',
                        `Kolizja effectiveFrom ${effectiveFrom} z inną zatwierdzoną wersją`
                    );
                }
                throw err;
            }
            // Tylko wersja wchodząca od razu zmienia aktywny cennik.
            if (effectiveFrom <= nowIso) await touchActiveTimestamp(tx, nowIso);
            await writeAudit(tx, {
                entityId: id,
                userId: opts.userId,
                action: 'APPROVE',
                oldData: { przed: 'DRAFT' },
                newData: {
                    po: 'APPROVED',
                    effectiveFrom,
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

/** Alias legacy: aktywacja tylko dla daty <= now (guard zachowany z F2). */
export async function activate(
    id: string,
    opts: { userId?: string; note?: unknown } = {}
): Promise<PricelistVersion> {
    const current = await prisma.pricelistVersion.findUnique({ where: { id } });
    if (!current) {
        throw new PricelistVersionError(404, 'NOT_FOUND', `Wersja ${id} nie istnieje`);
    }
    if (current.effectiveFrom > new Date().toISOString()) {
        throw new PricelistVersionError(
            409,
            'ACTIVATE_NOT_DUE',
            `Wersja ${id} wejdzie w życie ${current.effectiveFrom} — aktywacja przed terminem`
        );
    }
    return approveVersion(id, { userId: opts.userId, note: opts.note });
}

/** Alias legacy: korekta wsteczna = approve z wymaganym uzasadnieniem. */
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
    return approveVersion(id, { userId: opts.userId, note, requirePastNote: true });
}

/** Alias legacy: publikacja szkicu = approve na zapisanej dacie. */
export async function publishDraft(
    id: string,
    opts: { userId?: string } = {}
): Promise<PricelistVersion> {
    return approveVersion(id, { userId: opts.userId });
}

/**
 * DELETE PRECO musi wykluczyć równoległy createDraft studni, który mógłby
 * dopisać referencję po re-checku. Locki w stałej kolejności preco → studnie
 * (createDraft studni bierze tylko studnie, więc nie ma cyklu).
 */
async function withPrecoDeleteLocks<T>(
    fn: () => Promise<T>
): Promise<{ acquired: true; value: T } | { acquired: false }> {
    const outer = await lockFor('preco').runWithLock(() => lockFor('studnie').runWithLock(fn));
    return outer.acquired ? outer.value : { acquired: false };
}

/**
 * Usuwa wersję wraz z pozycjami (tx) + audit DELETE.
 * DRAFT: zawsze. APPROVED: tylko przyszła (effectiveFrom > now) i usage=0 —
 * historyczna/aktywna wersja jest nieusuwalna, bo trzyma pieczątki ofert.
 * PRECO z referencjami studni blokuje zawsze (historia eksportu).
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
    const isDraft = current.status === 'DRAFT';
    const isFutureApproved =
        current.status === 'APPROVED' && current.effectiveFrom > new Date().toISOString();
    if (!isDraft && !isFutureApproved) {
        throw new PricelistVersionError(
            409,
            'NOT_DELETABLE',
            `Wersji ${id} o statusie ${current.status} nie można usunąć (trzyma historię ofert)`
        );
    }
    if (current.type === 'preco') {
        const refs = (await getPrecoReferences()).get(id);
        if (refs && refs.count > 0) {
            throw new PricelistVersionError(
                409,
                'USED_BY_STUDNIE',
                `Wersji ${id} używa ${refs.count} wersji studni (${refs.labels.join(', ')}) — historia eksportu chroniona`
            );
        }
    }
    let usage: VersionUsage | null = null;
    if (!isDraft) {
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
    const runDeleteTx = () =>
        prisma.$transaction(async (tx) => {
            const fresh = await tx.pricelistVersion.findUnique({ where: { id } });
            if (!fresh) {
                throw new PricelistVersionError(404, 'NOT_FOUND', `Wersja ${id} nie istnieje`);
            }
            const freshDraft = fresh.status === 'DRAFT';
            const freshFutureApproved =
                fresh.status === 'APPROVED' && fresh.effectiveFrom > new Date().toISOString();
            if (!freshDraft && !freshFutureApproved) {
                throw new PricelistVersionError(
                    409,
                    'NOT_DELETABLE',
                    `Wersji ${id} o statusie ${fresh.status} nie można usunąć (trzyma historię ofert)`
                );
            }
            let studnieReferences = 0;
            if (fresh.type === 'preco') {
                // Re-check pod lockiem studni: referencja mogła dojść po wstępnym odczycie.
                const freshRefs = (await getPrecoReferences(tx)).get(id);
                studnieReferences = freshRefs?.count ?? 0;
                if (studnieReferences > 0) {
                    throw new PricelistVersionError(
                        409,
                        'USED_BY_STUDNIE',
                        `Wersji ${id} używa ${studnieReferences} wersji studni (${(freshRefs?.labels ?? []).join(', ')}) — historia eksportu chroniona`
                    );
                }
            }
            if (!freshDraft) {
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
                oldData:
                    fresh.type === 'preco'
                        ? {
                              wersja: fresh.version,
                              status: fresh.status,
                              seq: fresh.seq,
                              studnieReferences
                          }
                        : freshDraft
                          ? { wersja: fresh.version, status: fresh.status, seq: fresh.seq }
                          : {
                                wersja: fresh.version,
                                status: fresh.status,
                                seq: fresh.seq,
                                offers: 0
                            }
            });
            await tx.pricelistVersion.delete({ where: { id } });
            return { id };
        });
    const res =
        type === 'preco'
            ? await withPrecoDeleteLocks(runDeleteTx)
            : await lockFor(type).runWithLock(runDeleteTx);
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
            const existingDraft = await tx.pricelistVersion.findFirst({
                where: { type, status: 'DRAFT' },
                select: { version: true }
            });
            if (existingDraft) {
                throw new PricelistVersionError(
                    409,
                    'DRAFT_EXISTS',
                    DRAFT_EXISTS_MESSAGE(type, existingDraft.version)
                );
            }
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
                    version: versionLabel(type, seq, nowIso),
                    status: 'DRAFT',
                    effectiveFrom: nowIso,
                    createdBy: opts.userId,
                    note: opts.note ?? `Klon wersji ${source.version}`,
                    sha256,
                    createdAt: nowIso,
                    updatedAt: nowIso
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
