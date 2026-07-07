/**
 * Interfejs reprezentujący dokument użytkownika z bazy danych
 */
export interface UserDoc {
    id: string;
    username: string;
    password: string;
    role: string;
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
    phone?: string | null;
    symbol?: string | null;
    subUsers?: string | null;
    createdAt?: Date | string | null;
    orderStartNumber?: number | null;
    productionOrderStartNumber?: number | null;
}

export interface User {
    id: string;
    username: string;
    role: string;
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
    phone?: string | null;
    symbol?: string | null;
    subUsers: string[];
}

/**
 * Mapuje dokument użytkownika na obiekt użytkownika z sesji
 */
export function getUserObject(doc: UserDoc): User {
    let subUsers: string[] = [];
    try {
        if (doc.subUsers) {
            subUsers = JSON.parse(doc.subUsers);
        }
    } catch (_e) {
        subUsers = [];
    }
    return {
        id: doc.id,
        username: doc.username,
        role: doc.role,
        firstName: doc.firstName,
        lastName: doc.lastName,
        email: doc.email,
        phone: doc.phone,
        symbol: doc.symbol,
        subUsers: subUsers
    };
}

/**
 * Filtruje wiersze (np. oferty, klientów) na podstawie roli i uprawnień użytkownika
 */
export function filterRowsByRole(docs: UserDoc[], user: User): UserDoc[] {
    if (user.role === 'admin') {
        return docs;
    }
    if (user.role === 'user') {
        return docs.filter((d) => d.id === user.id);
    }
    if (user.role === 'pro') {
        const subs = new Set([user.id, ...(user.subUsers || [])]);
        return docs.filter((d) => subs.has(d.id));
    }
    return docs.filter((d) => d.id === user.id);
}

/**
 * Bezpiecznie parsuje pole JSON z bazy danych
 */
export function parseJsonField<T>(raw: string | null | undefined, fallback: T): T {
    if (!raw) return fallback;
    try {
        return JSON.parse(raw) as T;
    } catch (_e) {
        return fallback;
    }
}

/**
 * Normalizuje wartość daty do ISO string.
 * Obsługuje: timestamp number, Date object, ISO string, timestamp string.
 */
export function normalizeDate(raw: unknown): string {
    if (typeof raw === 'number') return new Date(raw).toISOString();
    if (raw instanceof Date) return raw.toISOString();
    if (typeof raw === 'string') {
        if (/^\d+$/.test(raw)) return new Date(Number(raw)).toISOString();
        return raw;
    }
    return new Date().toISOString();
}

/**
 * Zwraca fragment SQL konwertujący kolumnę z timestamp (13-cyfrowy ms) na ISO string.
 * Używany w raw queries dla tabel z mieszanymi formatami dat.
 */
export function dateConversionSql(column: string, alias?: string): string {
    const col = column.includes('.') ? column : `"${column}"`;
    const aliasStr = alias || column.split('.').pop()?.replace(/"/g, '') || column;
    return (
        `CASE WHEN ${col} GLOB '[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]' ` +
        `THEN datetime(CAST(${col} AS INTEGER)/1000, 'unixepoch') ` +
        `ELSE ${col} END as "${aliasStr}"`
    );
}

/**
 * Sprawdza czy ID ma bezpieczny format (alfanumeryczny + myślniki/ podkreślenia).
 * Używane do sanityzacji ID przed interpolacją w raw queries WHERE.
 */
export function isValidId(id: string): boolean {
    return (
        typeof id === 'string' && id.length > 0 && id.length < 100 && /^[a-zA-Z0-9_-]+$/.test(id)
    );
}
