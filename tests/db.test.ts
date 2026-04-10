// Mock prismaClient BEFORE importing db.ts (which auto-runs cleanupAuditLogs)
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
    it('should detect changed fields', () => {
        const oldObj = { name: 'Jan', price: 100 };
        const newObj = { name: 'Jan', price: 200 };
        const result = computeDiff(oldObj, newObj);

        expect(result).not.toBeNull();
        expect(result!.changed).toEqual({ price: 200 });
        expect(result!.old).toEqual({ price: 100 });
    });

    it('should return null when objects are identical', () => {
        const obj = { name: 'Test', value: 42 };
        const result = computeDiff(obj, { ...obj });
        expect(result).toBeNull();
    });

    it('should detect added fields', () => {
        const oldObj = { name: 'Jan' };
        const newObj = { name: 'Jan', newField: 'added' };
        const result = computeDiff(oldObj, newObj);

        expect(result).not.toBeNull();
        expect(result!.changed).toEqual({ newField: 'added' });
        expect(result!.old).toEqual({ newField: undefined });
    });

    it('should detect removed fields', () => {
        const oldObj = { name: 'Jan', removed: 'value' };
        const newObj = { name: 'Jan' };
        const result = computeDiff(oldObj, newObj);

        expect(result).not.toBeNull();
        expect(result!.changed).toEqual({ removed: undefined });
        expect(result!.old).toEqual({ removed: 'value' });
    });

    it('should handle null oldObj', () => {
        const result = computeDiff(null, { name: 'new' });
        expect(result).toEqual({ changed: { name: 'new' }, old: {} });
    });

    it('should handle null newObj', () => {
        const result = computeDiff({ name: 'old' }, null);
        expect(result).toEqual({ changed: {}, old: { name: 'old' } });
    });

    it('should handle both null', () => {
        const result = computeDiff(null, null);
        expect(result).toEqual({ changed: {}, old: {} });
    });

    it('should detect nested object changes via JSON comparison', () => {
        const oldObj = { config: { a: 1, b: 2 } };
        const newObj = { config: { a: 1, b: 3 } };
        const result = computeDiff(oldObj, newObj);

        expect(result).not.toBeNull();
        expect(result!.changed).toHaveProperty('config');
    });

    it('should treat identical nested objects as unchanged', () => {
        const oldObj = { config: { a: 1, b: 2 } };
        const newObj = { config: { a: 1, b: 2 } };
        const result = computeDiff(oldObj, newObj);
        expect(result).toBeNull();
    });

    it('should handle multiple simultaneous changes', () => {
        const oldObj = { a: 1, b: 'old', c: true };
        const newObj = { a: 2, b: 'new', c: false };
        const result = computeDiff(oldObj, newObj);

        expect(result).not.toBeNull();
        expect(Object.keys(result!.changed)).toHaveLength(3);
    });

    it('should handle empty objects', () => {
        const result = computeDiff({}, {});
        expect(result).toBeNull();
    });
});
