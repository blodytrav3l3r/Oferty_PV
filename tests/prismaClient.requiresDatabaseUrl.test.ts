import fs from 'node:fs';
import path from 'node:path';
import { requirePostgresDatabaseUrl } from '../src/utils/databaseUrl';

/**
 * Inwariant: brak fallbacku do domyślnego DATABASE_URL.
 * Misconfig prod nie może po cichu otworzyć innej/pustej bazy.
 */
describe('requirePostgresDatabaseUrl', () => {
    test('undefined → jawny błąd', () => {
        expect(() => requirePostgresDatabaseUrl(undefined)).toThrow(/DATABASE_URL/);
    });

    test('pusty string → jawny błąd', () => {
        expect(() => requirePostgresDatabaseUrl('')).toThrow(/DATABASE_URL/);
    });

    test('akceptuje jawny PostgreSQL URL bez ujawniania lub modyfikowania wartości', () => {
        const url = 'postgresql://user:password@localhost/sok';
        expect(requirePostgresDatabaseUrl(url)).toBe(url);
    });

    test('wymaga zweryfikowanego TLS dla zdalnych połączeń PostgreSQL', () => {
        expect(() =>
            requirePostgresDatabaseUrl('postgresql://user:password@example.test/sok')
        ).toThrow(/verify-full/);
        expect(() =>
            requirePostgresDatabaseUrl(
                'postgresql://user:password@example.test/sok?sslmode=require'
            )
        ).toThrow(/unsupported sslmode/);
        expect(
            requirePostgresDatabaseUrl(
                'postgresql://user:password@example.test/sok?sslmode=verify-full'
            )
        ).toContain('sslmode=verify-full');
    });

    test('odrzuca nieprawidłowy URL i inny provider', () => {
        expect(() => requirePostgresDatabaseUrl('not a url')).toThrow(/valid PostgreSQL/);
        expect(() => requirePostgresDatabaseUrl('file:./x.sqlite')).toThrow(/PostgreSQL protocol/);
    });

    test('wymaga jawnego hosta i nazwy bazy', () => {
        expect(() => requirePostgresDatabaseUrl('postgresql:///sok')).toThrow(/host and database/);
        expect(() => requirePostgresDatabaseUrl('postgresql://localhost')).toThrow(
            /host and database/
        );
    });

    test('prismaClient używa guardu i nie ma wbudowanego fallbacku', () => {
        const src = fs.readFileSync(
            path.resolve(__dirname, '..', 'src', 'prismaClient.ts'),
            'utf8'
        );
        expect(src).toContain('rawUrl = process.env.DATABASE_URL');
        expect(src).toContain('requirePostgresDatabaseUrl(rawUrl)');
        expect(src).not.toContain('app_database.sqlite');
        expect(src).not.toContain('@prisma/adapter-better-sqlite3');
    });
});
