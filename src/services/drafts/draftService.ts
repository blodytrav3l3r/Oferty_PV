/**
 * L2: serwerowy draft roboczy (cross-device).
 *
 * Zasady, które ten serwis egzekwuje:
 * - draft jest ZAWSZE per-user (klucz `(userId, kind, docId)`), więc cudzy
 *   wiersz jest nieosiągalny na poziomie zapytania — nie tylko guardu;
 * - zapis nad istniejącym draftem wymaga `If-Match` (CAS na `drafts.version`);
 *   brak nagłówka = 412, nigdy ciche nadpisanie;
 * - przekroczenie limitu bajtów NIE rusza poprzedniej wersji;
 * - przekroczenie liczby draftów nie usuwa żadnego wiersza (jawny błąd).
 *
 * Ten serwis nie dotyka dokumentów (ofert/zamówień): draft to kopia robocza.
 * Ownership dokumentu egzekwuje trasa dokumentu przy przywracaniu draftu.
 */
import prisma from '../../prismaClient';
import {
    DRAFT_MAX_BYTES,
    DRAFT_MAX_PER_USER,
    DRAFT_TTL_MS,
    draftPayloadBytes,
    isPlainObject,
    type DraftKind
} from '../../validators/draftSchemas';

export interface DraftMeta {
    kind: string;
    docId: string;
    baseVersion: number | null;
    bytes: number;
    version: number;
    updatedAt: string;
    expiresAt: string;
}

export interface DraftRecord extends DraftMeta {
    payload: unknown;
}

export type DraftSaveResult =
    | { status: 'ok'; version: number; updatedAt: string; bytes: number }
    | { status: 'conflict'; serverVersion: number; serverUpdatedAt: string }
    | { status: 'precondition_required'; serverVersion: number }
    | { status: 'not_found' }
    | { status: 'too_large'; bytes: number; limit: number }
    | { status: 'limit'; count: number; limit: number }
    | { status: 'invalid_payload' };

/** ISO „teraz" — jeden format czasu w całym module (porównania leksykalne). */
function nowIso(now: number): string {
    return new Date(now).toISOString();
}

/**
 * Usuwa wygasłe drafty użytkownika (leniwe sprzątanie przy odczycie).
 * Błąd sprzątania nie może zepsuć odczytu — loguje i idzie dalej.
 */
async function sweepUserExpired(userId: string, now: number): Promise<void> {
    try {
        await prisma.drafts.deleteMany({
            where: { userId, expiresAt: { lt: nowIso(now) } }
        });
    } catch {
        // Odczyt ma pierwszeństwo; zaległe wiersze sprzątnie housekeeping.
    }
}

/** Lista metadanych (bez `payload`) — najnowsze pierwsze. */
export async function listDrafts(userId: string, now: number = Date.now()): Promise<DraftMeta[]> {
    await sweepUserExpired(userId, now);
    const rows = await prisma.drafts.findMany({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
        select: {
            kind: true,
            docId: true,
            baseVersion: true,
            bytes: true,
            version: true,
            updatedAt: true,
            expiresAt: true
        }
    });
    return rows;
}

/**
 * Pełny draft. Wygasły/uszkodzony jest usuwany i zwracany jako `null`
 * (żadnego „prawie poprawnego" draftu do przywrócenia).
 */
export async function getDraft(
    userId: string,
    kind: DraftKind,
    docId: string,
    now: number = Date.now()
): Promise<DraftRecord | null> {
    const row = await prisma.drafts.findUnique({
        where: { userId_kind_docId: { userId, kind, docId } }
    });
    if (!row) return null;
    if (row.expiresAt <= nowIso(now)) {
        await prisma.drafts.deleteMany({ where: { userId, kind, docId } });
        return null;
    }
    let payload: unknown = null;
    try {
        payload = JSON.parse(row.payload);
    } catch {
        // Uszkodzony wiersz nie może udawać poprawnego draftu.
        await prisma.drafts.deleteMany({ where: { userId, kind, docId } });
        return null;
    }
    return {
        kind: row.kind,
        docId: row.docId,
        baseVersion: row.baseVersion,
        bytes: row.bytes,
        version: row.version,
        updatedAt: row.updatedAt,
        expiresAt: row.expiresAt,
        payload
    };
}

/**
 * Zapis draftu z CAS.
 * @param ifMatch oczekiwana wersja draftu; `null` = klient nie przesłał nagłówka
 */
export async function saveDraft(args: {
    userId: string;
    kind: DraftKind;
    docId: string;
    payload: unknown;
    baseVersion: number | null;
    ifMatch: number | null;
    now?: number;
}): Promise<DraftSaveResult> {
    const now = args.now ?? Date.now();
    if (!isPlainObject(args.payload)) return { status: 'invalid_payload' };
    const bytes = draftPayloadBytes(args.payload);
    if (bytes === null) return { status: 'invalid_payload' };
    if (bytes > DRAFT_MAX_BYTES) return { status: 'too_large', bytes, limit: DRAFT_MAX_BYTES };

    const payloadJson = JSON.stringify(args.payload);
    const updatedAt = nowIso(now);
    const expiresAt = nowIso(now + DRAFT_TTL_MS);
    const key = { userId: args.userId, kind: args.kind, docId: args.docId };

    if (args.ifMatch === null) {
        // Nowy draft albo jawny błąd: nadpisanie istniejącego bez If-Match
        // byłoby cichą utratą pracy.
        const existing = await prisma.drafts.findUnique({
            where: { userId_kind_docId: key },
            select: { version: true }
        });
        if (existing) return { status: 'precondition_required', serverVersion: existing.version };
        const count = await prisma.drafts.count({ where: { userId: args.userId } });
        if (count >= DRAFT_MAX_PER_USER)
            return { status: 'limit', count, limit: DRAFT_MAX_PER_USER };
        try {
            await prisma.drafts.create({
                data: {
                    ...key,
                    baseVersion: args.baseVersion,
                    payload: payloadJson,
                    bytes,
                    version: 1,
                    updatedAt,
                    expiresAt
                }
            });
            return { status: 'ok', version: 1, updatedAt, bytes };
        } catch (e) {
            // Wyścig dwóch „pierwszych" zapisów: przegrany dostaje CAS, nie 500.
            if ((e as { code?: string }).code === 'P2002') {
                const raced = await prisma.drafts.findUnique({
                    where: { userId_kind_docId: key },
                    select: { version: true }
                });
                return {
                    status: 'conflict',
                    serverVersion: raced?.version ?? 1,
                    serverUpdatedAt: updatedAt
                };
            }
            throw e;
        }
    }

    const upd = await prisma.drafts.updateMany({
        where: { ...key, version: args.ifMatch },
        data: {
            baseVersion: args.baseVersion,
            payload: payloadJson,
            bytes,
            updatedAt,
            expiresAt,
            version: { increment: 1 }
        }
    });
    if (upd.count === 0) {
        const current = await prisma.drafts.findUnique({
            where: { userId_kind_docId: key },
            select: { version: true, updatedAt: true }
        });
        if (!current) return { status: 'not_found' };
        return {
            status: 'conflict',
            serverVersion: current.version,
            serverUpdatedAt: current.updatedAt
        };
    }
    return { status: 'ok', version: args.ifMatch + 1, updatedAt, bytes };
}

/** Jawne odrzucenie draftu. `false` = nie było czego usuwać. */
export async function deleteDraft(
    userId: string,
    kind: DraftKind,
    docId: string
): Promise<boolean> {
    const res = await prisma.drafts.deleteMany({ where: { userId, kind, docId } });
    return res.count > 0;
}

/**
 * Sweep globalny (housekeeping): usuwa wygasłe drafty wszystkich użytkowników.
 * Zwraca liczbę usuniętych wierszy. Nigdy nie rzuca — wołane z crona.
 */
export async function sweepExpiredDrafts(now: number = Date.now()): Promise<number> {
    try {
        const res = await prisma.drafts.deleteMany({
            where: { expiresAt: { lt: nowIso(now) } }
        });
        return res.count;
    } catch {
        return 0;
    }
}
