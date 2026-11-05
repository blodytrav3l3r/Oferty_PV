import path from 'path';
import { execFileSync } from 'child_process';

const SCRIPT = path.resolve(__dirname, '../../scripts/check-db.js');

// eslint-disable-next-line @typescript-eslint/no-require-imports
const checkDb = require('../../scripts/check-db.js') as {
    parseDatabaseUrl: (rawUrl: string) => { connectionString: string; schema: string };
};

describe('check-db PostgreSQL contract', () => {
    it('requires explicit PostgreSQL URL and never falls back to a file path', () => {
        expect(() => checkDb.parseDatabaseUrl('')).toThrow(/DATABASE_URL is required/);
        expect(() => checkDb.parseDatabaseUrl('file:./app.sqlite')).toThrow(/PostgreSQL/);
    });

    it('extracts schema for catalog checks while keeping a valid PostgreSQL URL', () => {
        const parsed = checkDb.parseDatabaseUrl(
            'postgresql://user:secret@localhost:5432/sok_test?schema=sok_test_schema'
        );
        expect(parsed.schema).toBe('sok_test_schema');
        expect(parsed.connectionString).not.toContain('schema=');
        expect(parsed.connectionString).not.toContain('file:');
    });

    it('script fails closed when DATABASE_URL is absent', () => {
        let stderr = '';
        try {
            execFileSync(process.execPath, [SCRIPT], {
                encoding: 'utf8',
                env: { ...process.env, DATABASE_URL: '' }
            });
        } catch (error) {
            stderr = String((error as { stderr?: unknown }).stderr ?? '');
        }
        expect(stderr).toMatch(/DATABASE_URL is required/);
        expect(stderr).not.toMatch(/app_database\.sqlite/);
    });
});
