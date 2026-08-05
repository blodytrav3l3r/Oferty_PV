import { parseJsonField, getUserObject, UserDoc } from '../src/helpers';

// ─── parseJsonField ─────────────────────────────────────────────────

describe('parseJsonField', () => {
    it('powinien parsować prawidłowy ciąg JSON', () => {
        const result = parseJsonField<{ name: string }>('{"name":"test"}', { name: '' });
        expect(result).toEqual({ name: 'test' });
    });

    it('powinien zwrócić wartość zapasową (fallback) dla danych null', () => {
        const fallback = { value: 42 };
        expect(parseJsonField(null, fallback)).toBe(fallback);
    });

    it('powinien zwrócić wartość zapasową (fallback) dla danych undefined', () => {
        const fallback: string[] = [];
        expect(parseJsonField(undefined, fallback)).toBe(fallback);
    });

    it('powinien zwrócić wartość zapasową (fallback) dla pustego ciągu', () => {
        expect(parseJsonField('', 'default')).toBe('default');
    });

    it('powinien zwrócić wartość zapasową (fallback) dla nieprawidłowego JSON', () => {
        expect(parseJsonField('{broken', {})).toEqual({});
    });

    it('powinien parsować tablice JSON', () => {
        const result = parseJsonField<number[]>('[1,2,3]', []);
        expect(result).toEqual([1, 2, 3]);
    });

    it('powinien parsować zagnieżdżone obiekty', () => {
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

    it('powinien mapować UserDoc na User bez hasła', () => {
        const user = getUserObject(baseDoc);
        expect(user).not.toHaveProperty('password');
        expect(user.id).toBe('user1');
        expect(user.username).toBe('john');
        expect(user.role).toBe('user');
    });

    it('powinien parsować subUsers z ciągu JSON', () => {
        const doc = { ...baseDoc, subUsers: '["sub1","sub2"]' };
        const user = getUserObject(doc);
        expect(user.subUsers).toEqual(['sub1', 'sub2']);
    });

    it('powinien zwrócić pustą listę subUsers dla null', () => {
        const user = getUserObject(baseDoc);
        expect(user.subUsers).toEqual([]);
    });

    it('powinien zwrócić pustą listę subUsers dla nieprawidłowego JSON', () => {
        const doc = { ...baseDoc, subUsers: '{broken' };
        const user = getUserObject(doc);
        expect(user.subUsers).toEqual([]);
    });

    it('powinien zachować pola dopuszczające null', () => {
        const doc = { ...baseDoc, firstName: null, lastName: null, email: null };
        const user = getUserObject(doc);
        expect(user.firstName).toBeNull();
        expect(user.lastName).toBeNull();
        expect(user.email).toBeNull();
    });
});
