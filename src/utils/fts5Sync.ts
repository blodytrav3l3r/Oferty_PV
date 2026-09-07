import prisma from '../prismaClient';
import { logger } from './logger';

export interface OfferFts5Data {
    id: string;
    offer_number: string | null;
    clientName: string | null;
    investName: string | null;
    clientNumber?: string | null;
}

/**
 * Sync a single offer into FTS5 index.
 * Uses DELETE + INSERT to avoid rowid conflicts.
 * Zwraca false przy błędzie (P1-B: wołający zlicza, nigdy nie rzuca).
 */
export async function syncFts5(type: 'rury' | 'studnie', data: OfferFts5Data): Promise<boolean> {
    try {
        await prisma.$executeRawUnsafe(
            `DELETE FROM offers_search_fts WHERE id = ? AND type = ?`,
            data.id,
            type
        );
        await prisma.$executeRawUnsafe(
            `INSERT INTO offers_search_fts(id, offer_number, clientName, investName, clientNumber, type) VALUES (?, ?, ?, ?, ?, ?)`,
            data.id,
            data.offer_number || '',
            data.clientName || '',
            data.investName || '',
            data.clientNumber || '',
            type
        );
        return true;
    } catch (e) {
        logger.debug(
            'Fts5',
            `syncFts5 ignore (${type} ${data.id})`,
            e instanceof Error ? e.message : String(e)
        );
        return false;
    }
}

/**
 * Remove an offer from FTS5 index.
 */
export async function removeFts5(type: 'rury' | 'studnie', id: string): Promise<void> {
    try {
        await prisma.$executeRawUnsafe(
            `DELETE FROM offers_search_fts WHERE id = ? AND type = ?`,
            id,
            type
        );
    } catch (e) {
        logger.debug(
            'Fts5',
            `removeFts5 ignore (${type} ${id})`,
            e instanceof Error ? e.message : String(e)
        );
    }
}

/**
 * Build FTS5 MATCH query string from user input.
 * Escapes special chars and appends * for prefix matching.
 */
export function buildFts5Query(input: string): string {
    if (!input.trim()) return '';

    let q = input
        .replace(/['"]/g, ' ')
        .replace(/[-/]/g, ' ')
        .replace(/[^a-zA-Z0-9\u00C0-\u024F\u0400-\u04FF\u0100-\u017F\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    const tokens = q.split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return '';

    return tokens.map((t) => (t.endsWith('-') ? t.slice(0, -1) + '*' : t + '*')).join(' ');
}

/**
 * Check if FTS5 table exists.
 */
export async function fts5Exists(): Promise<boolean> {
    try {
        const r = await prisma.$queryRawUnsafe<{ name: string }[]>(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='offers_search_fts'"
        );
        return r.length > 0;
    } catch {
        return false;
    }
}

const FTS5_COLUMNS = ['id', 'offer_number', 'clientName', 'investName', 'clientNumber', 'type'];

/**
 * SQL tworzący tabelę wirtualną FTS5 (identyczna definicja jak w scripts/setup-fts5.ts).
 */
function createFts5Table(): string {
    return `
        CREATE VIRTUAL TABLE IF NOT EXISTS offers_search_fts USING fts5(
            id UNINDEXED,
            offer_number,
            clientName,
            investName,
            clientNumber,
            type UNINDEXED,
            tokenize='porter unicode61'
        )
    `;
}

/**
 * Backfill ofert (rury + studnie) do tabeli FTS5.
 * P1-B: chunkami po zakresach id (krótki zapis, nie jeden wielki INSERT..SELECT).
 */
const BACKFILL_CHUNK = 500;

async function backfillChunk(
    table: 'offers_rel' | 'offers_studnie_rel',
    type: 'rury' | 'studnie',
    lastId: string
): Promise<{ rows: number; nextId: string | null }> {
    const rows = (await prisma.$queryRawUnsafe<Array<{ id: string }>>(
        `SELECT id FROM "${table}" WHERE id > ? ORDER BY id LIMIT ${BACKFILL_CHUNK}`,
        lastId
    )) as Array<{ id: string }>;
    if (rows.length === 0) return { rows: 0, nextId: null };
    const ids = rows.map((r) => r.id);
    const placeholders = ids.map(() => '?').join(',');
    await prisma.$executeRawUnsafe(
        `INSERT INTO offers_search_fts(id, offer_number, clientName, investName, clientNumber, type)
         SELECT id, offer_number, clientName, investName,
                COALESCE(NULLIF(clientNumber, ''), json_extract(data, '$.clientNumber'), ''),
                '${type}'
         FROM "${table}" WHERE id IN (${placeholders})`,
        ...ids
    );
    return { rows: rows.length, nextId: ids[ids.length - 1] };
}

async function backfillFts5(onProgress?: (done: number) => void): Promise<number> {
    let total = 0;
    for (const [table, type] of [
        ['offers_rel', 'rury'],
        ['offers_studnie_rel', 'studnie']
    ] as Array<['offers_rel' | 'offers_studnie_rel', 'rury' | 'studnie']>) {
        let lastId = '';
        for (;;) {
            const { rows, nextId } = await backfillChunk(table, type, lastId);
            if (rows === 0 || nextId === null) break;
            total += rows;
            lastId = nextId;
            onProgress?.(total);
        }
    }
    return total;
}

export interface FtsSyncStatus {
    inSync: boolean;
    tables: {
        rury: { offers: number; fts: number };
        studnie: { offers: number; fts: number };
    };
    /** Przykładowe id ofert bez wpisu FTS (max 20, do diagnostyki). */
    missingIds: Array<{ id: string; type: 'rury' | 'studnie' }>;
}

/**
 * P1-B: szybka kontrola spójności FTS vs tabele biznesowe (tylko odczyty).
 * FTS to dane pochodne — rozjazd to ostrzeżenie, nie błąd zapisu.
 */
export async function ftsSyncStatus(): Promise<FtsSyncStatus> {
    const count = async (sql: string): Promise<number> => {
        const rows = (await prisma.$queryRawUnsafe<Array<{ n: number | bigint }>>(sql)) as Array<{
            n: number | bigint;
        }>;
        return Number(rows?.[0]?.n ?? 0);
    };
    const offersRury = await count('SELECT COUNT(*) AS n FROM offers_rel');
    const offersStudnie = await count('SELECT COUNT(*) AS n FROM offers_studnie_rel');
    const ftsExistsNow = await fts5Exists();
    const ftsRury = ftsExistsNow
        ? await count(`SELECT COUNT(*) AS n FROM offers_search_fts WHERE type = 'rury'`)
        : 0;
    const ftsStudnie = ftsExistsNow
        ? await count(`SELECT COUNT(*) AS n FROM offers_search_fts WHERE type = 'studnie'`)
        : 0;
    let missingIds: FtsSyncStatus['missingIds'] = [];
    if (ftsExistsNow) {
        const missing = (await prisma.$queryRawUnsafe<Array<{ id: string; type: string }>>(
            `SELECT id, 'rury' AS type FROM offers_rel
             WHERE id NOT IN (SELECT id FROM offers_search_fts WHERE type = 'rury')
             LIMIT 10`
        )) as Array<{ id: string; type: string }>;
        const missing2 = (await prisma.$queryRawUnsafe<Array<{ id: string; type: string }>>(
            `SELECT id, 'studnie' AS type FROM offers_studnie_rel
             WHERE id NOT IN (SELECT id FROM offers_search_fts WHERE type = 'studnie')
             LIMIT 10`
        )) as Array<{ id: string; type: string }>;
        missingIds = [...missing, ...missing2].map((r) => ({
            id: r.id,
            type: r.type as 'rury' | 'studnie'
        }));
    }
    const inSync =
        offersRury === ftsRury && offersStudnie === ftsStudnie && missingIds.length === 0;
    return {
        inSync,
        tables: {
            rury: { offers: offersRury, fts: ftsRury },
            studnie: { offers: offersStudnie, fts: ftsStudnie }
        },
        missingIds
    };
}

/**
 * P1-B: pełna przebudowa indeksu FTS z tabel biznesowych (SSoT).
 * Uruchamiana wyłącznie na żądanie admina — nigdy automatycznie.
 * DELETE (bez DROP — brak okna bez tabeli) + chunkowany backfill.
 */
export async function rebuildFts5(onProgress?: (done: number) => void): Promise<number> {
    if (!(await fts5Exists())) {
        await prisma.$executeRawUnsafe(createFts5Table());
    } else {
        await prisma.$executeRawUnsafe('DELETE FROM offers_search_fts');
    }
    const total = await backfillFts5(onProgress);
    logger.info('Fts5', `rebuild zakończony: ${total} wierszy`);
    return total;
}

/** Start serwera: brak tabeli → utwórz + backfill; brak kolumn → DROP + backfill (jednorazowo). */
export async function ensureFts5Schema(): Promise<void> {
    try {
        if (!(await fts5Exists())) {
            // Świeża baza — tabela wirtualna nie istnieje: utwórz ją i uzupełnij danymi
            logger.info('Fts5', 'Brak tabeli FTS5 — tworzenie i backfill');
            await prisma.$executeRawUnsafe(createFts5Table());
            await backfillFts5();
            return;
        }

        const cols = await prisma.$queryRawUnsafe<{ name: string }[]>(
            'PRAGMA table_info(offers_search_fts)'
        );
        const names = cols.map((c) => c.name);
        const missing = FTS5_COLUMNS.filter((c) => !names.includes(c));
        if (missing.length === 0) return;

        logger.warn(
            'Fts5',
            `FTS5 brak kolumn: ${missing.join(', ')} — przebudowa tabeli i backfill`
        );
        await prisma.$executeRawUnsafe('DROP TABLE offers_search_fts');
        await prisma.$executeRawUnsafe(createFts5Table());
        await backfillFts5();
    } catch (e) {
        // FTS5 niedostępny (np. build bez fts5) — nie blokuj startu serwera
        logger.warn(
            'Fts5',
            'Nie udało się upewnić schematu FTS5:',
            e instanceof Error ? e.message : String(e)
        );
    }
}
