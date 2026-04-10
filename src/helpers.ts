export interface UserDoc {
    id: string;
    username: string;
    password: string;
    role: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    symbol?: string;
    subUsers?: string;
    createdAt?: string;
    orderStartNumber?: number;
    productionOrderStartNumber?: number;
}

export interface User {
    id: string;
    username: string;
    role: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    symbol?: string;
    subUsers: string[];
}

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

export function parseJsonField(raw: string | null | undefined, fallback: any = {}): any {
    if (!raw) return fallback;
    try {
        return JSON.parse(raw);
    } catch (_e) {
        return fallback;
    }
}
