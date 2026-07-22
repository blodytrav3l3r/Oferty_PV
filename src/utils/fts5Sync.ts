import prisma from '../prismaClient';

export interface OfferFts5Data {
    id: string;
    offer_number: string | null;
    clientName: string | null;
    investName: string | null;
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
            `INSERT INTO offers_search_fts(id, offer_number, clientName, investName, type) VALUES (?, ?, ?, ?, ?)`,
            data.id,
            data.offer_number || '',
            data.clientName || '',
            data.investName || '',
            type
        );
    } catch {
        // FTS5 table may not exist — safe to ignore
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
    } catch {
        // FTS5 table may not exist — safe to ignore
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
        const r = (await prisma.$queryRawUnsafe(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='offers_search_fts'"
        )) as any[];
        return r.length > 0;
    } catch {
        return false;
    }
}
