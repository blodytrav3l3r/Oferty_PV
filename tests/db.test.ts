// Mockuj prismaClient PRZED importem db.ts (który automatycznie uruchamia cleanupAuditLogs)
jest.mock('../src/prismaClient', () => ({
    __esModule: true,
    default: {
        audit_logs: {
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue({}),
            update: jest.fn().mockResolvedValue({}),
            deleteMany: jest.fn().mockResolvedValue({ count: 0 })
        }
    }
}));

import { computeDiff } from '../src/db';

describe('computeDiff', () => {
    it('powinien wykrywać zmienione pola', () => {
        const oldObj = { name: 'Jan', price: 100 };
        const newObj = { name: 'Jan', price: 200 };
        const result = computeDiff(oldObj, newObj);

        expect(result).not.toBeNull();
        expect(result!.changed).toEqual({ price: 200 });
        expect(result!.old).toEqual({ price: 100 });
    });

    it('powinien zwrócić null, gdy obiekty są identyczne', () => {
        const obj = { name: 'Test', value: 42 };
        const result = computeDiff(obj, { ...obj });
        expect(result).toBeNull();
    });

    it('powinien wykrywać dodane pola', () => {
        const oldObj = { name: 'Jan' };
        const newObj = { name: 'Jan', newField: 'added' };
        const result = computeDiff(oldObj, newObj);

        expect(result).not.toBeNull();
        expect(result!.changed).toEqual({ newField: 'added' });
        expect(result!.old).toEqual({ newField: undefined });
    });

    it('powinien wykrywać usunięte pola', () => {
        const oldObj = { name: 'Jan', removed: 'value' };
        const newObj = { name: 'Jan' };
        const result = computeDiff(oldObj, newObj);

        expect(result).not.toBeNull();
        expect(result!.changed).toEqual({ removed: undefined });
        expect(result!.old).toEqual({ removed: 'value' });
    });

    it('powinien obsługiwać null jako oldObj', () => {
        const result = computeDiff(null, { name: 'new' });
        expect(result).toEqual({ changed: { name: 'new' }, old: {} });
    });

    it('powinien obsługiwać null jako newObj', () => {
        const result = computeDiff({ name: 'old' }, null);
        expect(result).toEqual({ changed: {}, old: { name: 'old' } });
    });

    it('powinien obsługiwać oba obiekty jako null', () => {
        const result = computeDiff(null, null);
        expect(result).toEqual({ changed: {}, old: {} });
    });

    it('powinien wykrywać zmiany w zagnieżdżonych obiektach poprzez porównanie JSON', () => {
        const oldObj = { config: { a: 1, b: 2 } };
        const newObj = { config: { a: 1, b: 3 } };
        const result = computeDiff(oldObj, newObj);

        expect(result).not.toBeNull();
        expect(result!.changed).toHaveProperty('config');
    });

    it('powinien traktować identyczne zagnieżdżone obiekty jako niezmienione', () => {
        const oldObj = { config: { a: 1, b: 2 } };
        const newObj = { config: { a: 1, b: 2 } };
        const result = computeDiff(oldObj, newObj);
        expect(result).toBeNull();
    });

    it('powinien obsługiwać wiele jednoczesnych zmian', () => {
        const oldObj = { a: 1, b: 'old', c: true };
        const newObj = { a: 2, b: 'new', c: false };
        const result = computeDiff(oldObj, newObj);

        expect(result).not.toBeNull();
        expect(Object.keys(result!.changed)).toHaveLength(3);
    });

    it('powinien obsługiwać puste obiekty', () => {
        const result = computeDiff({}, {});
        expect(result).toBeNull();
    });
});
