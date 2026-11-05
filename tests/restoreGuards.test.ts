import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as crypto from 'crypto';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const restoreDb = require('../scripts/restore-db.js');

function temporaryFile(name: string): string {
    return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'pg-restore-')), name);
}

describe('PostgreSQL restore guards', () => {
    test('requires a valid explicit PostgreSQL URL', () => {
        expect(restoreDb.parseDatabaseUrl('file:./app.sqlite')).toBeNull();
        expect(restoreDb.parseDatabaseUrl('postgresql:///sok_test')).toBeNull();
        expect(
            restoreDb.parseDatabaseUrl('postgresql://user:password@localhost/sok_test')
        ).not.toBeNull();
    });

    test('same database is live even if URL alias or password differs', () => {
        expect(
            restoreDb.sameDatabase(
                'postgres://user:one@localhost:5432/sok?schema=public',
                'postgresql://user:two@localhost:5432/sok?schema=other'
            )
        ).toBe(true);
    });

    test('requires --live and the migration role for live restore', () => {
        const runtimeUrl = 'postgresql://user:secret@localhost:5432/sok_test';
        expect(
            restoreDb.resolveTarget({
                targetArg: 'postgres://user:secret@localhost:5432/sok_test',
                live: false,
                runtimeUrl
            })
        ).toEqual({ ok: false, code: 'LIVE_REFUSED' });
        expect(
            restoreDb.resolveTarget({
                targetArg: 'postgresql://user:secret@localhost:5432/isolated_test',
                live: true,
                runtimeUrl
            })
        ).toEqual({ ok: false, code: 'LIVE_TARGET_MISMATCH' });
        expect(
            restoreDb.resolveTarget({
                targetArg: 'postgresql://user:secret@localhost:5432/sok_test',
                live: true,
                runtimeUrl
            })
        ).toEqual({ ok: false, code: 'LIVE_ROLE_REQUIRED' });
        expect(
            restoreDb.resolveTarget({
                targetArg: 'postgresql://user:secret@localhost:5432/isolated_test',
                live: true,
                runtimeUrl,
                migrationUrl: 'postgresql://migrator:secret@localhost:5432/sok_test'
            })
        ).toEqual({ ok: false, code: 'LIVE_TARGET_MISMATCH' });
    });

    test('accepts only the separate migration role URL for live restore', () => {
        const runtimeUrl =
            'postgresql://app:secret@db.example.com:5432/sok_prod?sslmode=verify-full';
        const migrationUrl =
            'postgresql://migrator:secret@db.example.com:5432/sok_prod?sslmode=verify-full';
        expect(
            restoreDb.resolveTarget({
                targetArg: migrationUrl,
                live: false,
                runtimeUrl:
                    'postgresql://app:secret@db.example.com:5432/sok_prod?sslmode=verify-full',
                migrationUrl
            })
        ).toEqual({ ok: false, code: 'LIVE_REFUSED' });
        expect(
            restoreDb.resolveTarget({
                targetArg: migrationUrl,
                live: true,
                runtimeUrl,
                migrationUrl
            })
        ).toMatchObject({ ok: true, live: true });
        expect(restoreDb.sameDatabaseRole(runtimeUrl, migrationUrl)).toBe(false);
        expect(
            restoreDb.resolveTarget({ targetArg: runtimeUrl, live: true, runtimeUrl, migrationUrl })
        ).toEqual({ ok: false, code: 'LIVE_ROLE_REQUIRED' });
    });

    test('refuses remote or non-test restore targets without the explicit runtime GO', () => {
        expect(
            restoreDb.resolveTarget({
                targetArg:
                    'postgresql://user:secret@db.example.com:5432/other_prod?sslmode=verify-full',
                live: false,
                runtimeUrl: 'postgresql://user:secret@localhost:5432/sok_test'
            })
        ).toEqual({ ok: false, code: 'NON_TEST_TARGET_REFUSED' });
        expect(
            restoreDb.resolveTarget({
                targetArg: 'postgresql://user:secret@localhost:5432/sok_dev',
                live: false,
                runtimeUrl: 'postgresql://user:secret@localhost:5432/sok_test'
            })
        ).toEqual({ ok: false, code: 'NON_TEST_TARGET_REFUSED' });
    });

    test('requires a sidecar and verifies its SHA-256 asynchronously', async () => {
        const archive = temporaryFile('backup.dump');
        fs.writeFileSync(archive, 'synthetic custom archive fixture');
        expect(await restoreDb.verifyChecksum(archive)).toBe(false);
        const digest = crypto.createHash('sha256').update(fs.readFileSync(archive)).digest('hex');
        fs.writeFileSync(`${archive}.sha256`, `${digest}  backup.dump\n`);
        expect(await restoreDb.verifyChecksum(archive)).toBe(true);
        fs.appendFileSync(archive, 'tamper');
        expect(await restoreDb.verifyChecksum(archive)).toBe(false);
    });

    test('parses target URLs without exposing them as a fallback', () => {
        expect(
            restoreDb.resolveTarget({ targetArg: null, envTarget: undefined, live: false })
        ).toEqual({ ok: false, code: 'NO_TARGET' });
        expect(
            restoreDb.resolveTarget({
                targetArg: 'file:./restore.sqlite',
                envTarget: undefined,
                live: false
            })
        ).toEqual({ ok: false, code: 'INVALID_TARGET' });
    });

    test('rejects URL target arguments to prevent process-list disclosure', () => {
        expect(() =>
            restoreDb.parseCliArgs([
                'node',
                'restore-db.js',
                'backup.dump',
                '--target',
                'postgresql://user:secret@localhost/target_test'
            ])
        ).toThrow(/RESTORE_DB_URL/);
    });

    test('parses PostgreSQL restore CLI arguments without a target URL', () => {
        expect(
            restoreDb.parseCliArgs(['node', 'restore-db.js', 'backup.dump', '--live', '--yes'])
        ).toEqual({
            yes: true,
            live: true,
            targetArg: null,
            sourceArg: 'backup.dump'
        });
    });
});
