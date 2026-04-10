import { parseJsonField, getUserObject, filterRowsByRole, UserDoc, User } from '../src/helpers';

// ─── parseJsonField ─────────────────────────────────────────────────

describe('parseJsonField', () => {
    it('should parse valid JSON string', () => {
        const result = parseJsonField<{ name: string }>('{"name":"test"}', { name: '' });
        expect(result).toEqual({ name: 'test' });
    });

    it('should return fallback for null input', () => {
        const fallback = { value: 42 };
        expect(parseJsonField(null, fallback)).toBe(fallback);
    });

    it('should return fallback for undefined input', () => {
        const fallback: string[] = [];
        expect(parseJsonField(undefined, fallback)).toBe(fallback);
    });

    it('should return fallback for empty string', () => {
        expect(parseJsonField('', 'default')).toBe('default');
    });

    it('should return fallback for malformed JSON', () => {
        expect(parseJsonField('{broken', {})).toEqual({});
    });

    it('should parse JSON arrays', () => {
        const result = parseJsonField<number[]>('[1,2,3]', []);
        expect(result).toEqual([1, 2, 3]);
    });

    it('should parse nested objects', () => {
        const json = '{"a":{"b":{"c":1}}}';
        const result = parseJsonField<Record<string, unknown>>(json, {});
        expect(result).toEqual({ a: { b: { c: 1 } } });
    });
});

// ─── getUserObject ──────────────────────────────────────────────────

describe('getUserObject', () => {
    const baseDoc: UserDoc = {
        id: 'user1',
        username: 'john',
        password: 'hashed',
        role: 'user',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@test.com',
        phone: '123456',
        symbol: 'JD',
        subUsers: null,
        createdAt: '2024-01-01',
        orderStartNumber: 1,
        productionOrderStartNumber: 1
    };

    it('should map UserDoc to User without password', () => {
        const user = getUserObject(baseDoc);
        expect(user).not.toHaveProperty('password');
        expect(user.id).toBe('user1');
        expect(user.username).toBe('john');
        expect(user.role).toBe('user');
    });

    it('should parse subUsers from JSON string', () => {
        const doc = { ...baseDoc, subUsers: '["sub1","sub2"]' };
        const user = getUserObject(doc);
        expect(user.subUsers).toEqual(['sub1', 'sub2']);
    });

    it('should return empty subUsers for null', () => {
        const user = getUserObject(baseDoc);
        expect(user.subUsers).toEqual([]);
    });

    it('should return empty subUsers for malformed JSON', () => {
        const doc = { ...baseDoc, subUsers: '{broken' };
        const user = getUserObject(doc);
        expect(user.subUsers).toEqual([]);
    });

    it('should preserve nullable fields', () => {
        const doc = { ...baseDoc, firstName: null, lastName: null, email: null };
        const user = getUserObject(doc);
        expect(user.firstName).toBeNull();
        expect(user.lastName).toBeNull();
        expect(user.email).toBeNull();
    });
});

// ─── filterRowsByRole ───────────────────────────────────────────────

describe('filterRowsByRole', () => {
    const docs: UserDoc[] = [
        { id: 'u1', username: 'a', password: 'x', role: 'user', subUsers: null },
        { id: 'u2', username: 'b', password: 'x', role: 'user', subUsers: null },
        { id: 'u3', username: 'c', password: 'x', role: 'user', subUsers: null }
    ];

    it('admin should see all documents', () => {
        const admin: User = { id: 'admin1', username: 'admin', role: 'admin', subUsers: [] };
        const result = filterRowsByRole(docs, admin);
        expect(result).toHaveLength(3);
    });

    it('user should see only own documents', () => {
        const user: User = { id: 'u2', username: 'b', role: 'user', subUsers: [] };
        const result = filterRowsByRole(docs, user);
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('u2');
    });

    it('pro should see own and subUsers documents', () => {
        const pro: User = { id: 'u1', username: 'a', role: 'pro', subUsers: ['u3'] };
        const result = filterRowsByRole(docs, pro);
        expect(result).toHaveLength(2);
        expect(result.map((d) => d.id)).toEqual(['u1', 'u3']);
    });

    it('pro with no subUsers should see only own', () => {
        const pro: User = { id: 'u1', username: 'a', role: 'pro', subUsers: [] };
        const result = filterRowsByRole(docs, pro);
        expect(result).toHaveLength(1);
    });

    it('unknown role should see only own documents', () => {
        const unknown: User = { id: 'u2', username: 'b', role: 'unknown', subUsers: [] };
        const result = filterRowsByRole(docs, unknown);
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('u2');
    });

    it('should return empty array if no matching docs', () => {
        const user: User = { id: 'nonexistent', username: 'x', role: 'user', subUsers: [] };
        const result = filterRowsByRole(docs, user);
        expect(result).toHaveLength(0);
    });
});
