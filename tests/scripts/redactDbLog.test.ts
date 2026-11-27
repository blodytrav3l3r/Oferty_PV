import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const REDACTOR = path.resolve(__dirname, '..', '..', 'scripts', 'redact-db-log.mjs');

describe('redact-db-log.mjs', () => {
    it('removes the full connection URL and PostgreSQL credentials from output', () => {
        const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'sok-db-log-'));
        const logPath = path.join(directory, 'command.log');
        const databaseUrl = 'postgresql://sok_app:very-secret@postgres:5432/sok?schema=public';
        fs.writeFileSync(
            logPath,
            `Connection failed for ${databaseUrl}\nRetry URL: postgresql://sok_app:very-secret@postgres:5432/sok\n`,
            'utf8'
        );

        try {
            const output = execFileSync(process.execPath, [REDACTOR, logPath], {
                env: { ...process.env, DATABASE_URL: databaseUrl },
                encoding: 'utf8'
            });

            expect(output).toContain('[REDACTED]');
            expect(output).not.toContain(databaseUrl);
            expect(output).not.toContain('very-secret');
            expect(output).toContain('Connection failed');
        } finally {
            fs.rmSync(directory, { recursive: true, force: true });
        }
    });

    it('redacts credentials when only the migration URL is available', () => {
        const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'sok-db-log-'));
        const logPath = path.join(directory, 'command.log');
        const migrationUrl =
            'postgresql://sok_migrator:migration-secret@postgres:5432/sok?schema=public';
        fs.writeFileSync(
            logPath,
            `User sok_migrator failed; password migration-secret; URL ${migrationUrl}\n`,
            'utf8'
        );

        try {
            const output = execFileSync(process.execPath, [REDACTOR, logPath], {
                env: { ...process.env, DATABASE_URL: '', MIGRATION_DATABASE_URL: migrationUrl },
                encoding: 'utf8'
            });

            expect(output).toContain('[REDACTED]');
            expect(output).not.toContain('sok_migrator');
            expect(output).not.toContain('migration-secret');
        } finally {
            fs.rmSync(directory, { recursive: true, force: true });
        }
    });
});
