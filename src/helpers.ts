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
