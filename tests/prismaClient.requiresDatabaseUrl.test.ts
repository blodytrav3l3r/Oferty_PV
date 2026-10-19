import fs from 'node:fs';
import path from 'node:path';
import { requireDatabaseUrl } from '../src/utils/databaseUrl';

/**
 * Inwariant: brak fallbacku do domyślnego DATABASE_URL.
 * Misconfig prod nie może po cichu otworzyć innej/pustej bazy.
 */
describe('requireDatabaseUrl', () => {
    test('undefined → jawny błąd', () => {
        expect(() => requireDatabaseUrl(undefined)).toThrow(/DATABASE_URL/);
    });

    test('pusty string → jawny błąd', () => {
        expect(() => requireDatabaseUrl('')).toThrow(/DATABASE_URL/);
    });

    test('zwraca wartość bez zmian', () => {
        expect(requireDatabaseUrl('file:./x.sqlite')).toBe('file:./x.sqlite');
    });

    test('prismaClient używa guardu i nie ma wbudowanego fallbacku', () => {
        const src = fs.readFileSync(
            path.resolve(__dirname, '..', 'src', 'prismaClient.ts'),
            'utf8'
        );
        expect(src).toContain('requireDatabaseUrl(process.env.DATABASE_URL)');
        expect(src).not.toContain('app_database.sqlite');
    });
});
