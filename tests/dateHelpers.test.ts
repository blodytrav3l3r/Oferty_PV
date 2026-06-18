import { normalizeDate, dateConversionSql, isValidId } from '../src/helpers';

describe('normalizeDate', () => {
    it('konwertuje timestamp number', () => {
        const result = normalizeDate(1700000000000);
        expect(result).toMatch(/^2023-/);
    });

    it('konwertuje Date object', () => {
        const d = new Date('2024-01-15T10:00:00Z');
        expect(normalizeDate(d)).toBe('2024-01-15T10:00:00.000Z');
    });

    it('zostawia ISO string bez zmian', () => {
        const iso = '2024-06-01T12:00:00.000Z';
        expect(normalizeDate(iso)).toBe(iso);
    });

    it('konwertuje timestamp string na ISO', () => {
        const result = normalizeDate('1700000000000');
        expect(result).toMatch(/^2023-/);
    });

    it('zwraca teraz dla undefined', () => {
        const result = normalizeDate(undefined);
        expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('zwraca teraz dla null', () => {
        const result = normalizeDate(null);
        expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
});

describe('dateConversionSql', () => {
    it('generuje fragment SQL z aliasem domyślnym', () => {
        const sql = dateConversionSql('createdAt');
        expect(sql).toContain('CASE WHEN "createdAt" GLOB');
        expect(sql).toContain('ELSE "createdAt" END as "createdAt"');
    });

    it('generuje SQL dla kolumny kwalifikowanej tabelą z poprawnym aliasem', () => {
        const sql = dateConversionSql('production_orders_rel."createdAt"');
        expect(sql).toContain('production_orders_rel."createdAt"');
        expect(sql).toContain('END as "createdAt"');
    });

    it('akceptuje jawny alias zamiast domyślnego', () => {
        const sql = dateConversionSql('production_orders_rel."createdAt"', 'myCreated');
        expect(sql).toContain('END as "myCreated"');
    });

    it('generuje fragment SQL z własnym aliasem', () => {
        const sql = dateConversionSql('col', 'customAlias');
        expect(sql).toContain('CASE WHEN "col" GLOB');
        expect(sql).toContain('END as "customAlias"');
    });
});

describe('isValidId', () => {
    it('akceptuje UUID', () => {
        expect(isValidId('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    });

    it('akceptuje prosty identyfikator', () => {
        expect(isValidId('user_123')).toBe(true);
        expect(isValidId('test-user-id')).toBe(true);
    });

    it('odrzuca puste stringi', () => {
        expect(isValidId('')).toBe(false);
    });

    it('odrzuca stringi z SQL injection', () => {
        expect(isValidId("1'; DROP TABLE users; --")).toBe(false);
        expect(isValidId("' OR '1'='1")).toBe(false);
    });

    it('odrzuca bardzo długie stringi', () => {
        expect(isValidId('a'.repeat(100))).toBe(false);
    });
});
