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
 */
export async function syncFts5(type: 'rury' | 'studnie', data: OfferFts5Data): Promise<void> {
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
    } catch (e) {
        logger.debug(
            'Fts5',
            `syncFts5 ignore (${type} ${data.id})`,
            e instanceof Error ? e.message : String(e)
        );
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
 */
async function backfillFts5(): Promise<void> {
    await prisma.$executeRawUnsafe(`
        INSERT INTO offers_search_fts(id, offer_number, clientName, investName, clientNumber, type)
        SELECT id, offer_number, clientName, investName,
               COALESCE(NULLIF(clientNumber, ''), json_extract(data, '$.clientNumber'), ''),
               'rury'
        FROM offers_rel WHERE id IS NOT NULL
    `);
    await prisma.$executeRawUnsafe(`
        INSERT INTO offers_search_fts(id, offer_number, clientName, investName, clientNumber, type)
        SELECT id, offer_number, clientName, investName,
               COALESCE(NULLIF(clientNumber, ''), json_extract(data, '$.clientNumber'), ''),
               'studnie'
        FROM offers_studnie_rel WHERE id IS NOT NULL
    `);
}

/**
 * Ensure FTS5 table exists with the full column set (idempotent).
 * Gdy tabeli brak (świeża baza) — tworzy ją i robi backfill.
 * Gdy tabela istnieje, ale brakuje kolumn (np. clientNumber na starszych
 * instalacjach) — przebudowuje ją (FTS5 nie ma ALTER TABLE ADD COLUMN) i backfilluje.
 */
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
