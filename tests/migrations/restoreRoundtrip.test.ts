/*
 * tests/migrations/restoreRoundtrip.test.ts
 * A4.6: Test rollback — model backupow v4.6 (M1).
 *
 * Scenariusz 1 (legacy / pre-baseline): restore PRZEZ kopie pliku (procedura
 * legacy), NIE przez restore-db.js. Dodatkowo straznik: restore-db.js --yes na
 * legacy backupie konczy sie kontrolowanym bledem (migrate deploy fail — brak
 * _prisma_migrations).
 *
 * Scenariusz 2 (migration-managed / post-baseline): migrate deploy (baseline)
 * + dane -> backup -> delete -> restore-db.js --yes -> dane wracaja,
 * _prisma_migrations przetrwala, migrate status = up to date.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createIsolatedProject } from './helpers';

const ROOT = path.resolve(__dirname, '..', '..');
const BASELINE = '20260815000000_baseline';
const SCRIPT = path.join(ROOT, 'scripts', 'restore-db.js');

function vacuumInto(src: string, dest: string) {
    const db = new DatabaseSync(src);
    db.exec(`VACUUM INTO '${dest.replace(/\\/g, '/')}'`);
    db.close();
}

function insertWell(db: DatabaseSync) {
    db.prepare('INSERT INTO ProductsRury (id, name, category, price) VALUES (?, ?, ?, ?)').run(
        'r_1',
        'Rura',
        'Rury Betonowe',
        99.0
    );
}

function countRury(dbPath: string): number {
    const db = new DatabaseSync(dbPath, { readOnly: true });
    const r = db.prepare('SELECT count(*) AS n FROM ProductsRury').get();
    db.close();
    return (r as { n: number }).n;
}

describe('A4.6 rollback (pre/post baseline)', () => {
    it('scenariusz 1: legacy restore przez kopie pliku + straznik restore-db.js', () => {
        const project = createIsolatedProject('restore-legacy', [BASELINE]);
        try {
            project.runPrisma(['db', 'push', '--skip-generate']);
            let db = new DatabaseSync(project.dbPath);
            insertWell(db);
            db.close();
            expect(countRury(project.dbPath)).toBe(1);

            const backupPath = path.join(project.dir, 'legacy_backup.sqlite');
            vacuumInto(project.dbPath, backupPath);

            db = new DatabaseSync(project.dbPath);
            db.prepare('DELETE FROM ProductsRury').run();
            db.close();
            expect(countRury(project.dbPath)).toBe(0);

            // restore legacy przez kopie pliku (schemat juz w bazie)
            fs.copyFileSync(backupPath, project.dbPath);
            expect(countRury(project.dbPath)).toBe(1);

            // straznik: restore-db.js --yes na legacy backupie -> kontrolowany blad
            const r = spawnSync(process.execPath, [SCRIPT, backupPath, '--yes'], {
                cwd: ROOT,
                encoding: 'utf8',
                env: {
                    ...project.env,
                    RESTORE_DB_PATH: project.dbPath,
                    RESTORE_PRISMA_DIR: project.dir
                },
                stdio: ['ignore', 'pipe', 'pipe'],
                maxBuffer: 16 * 1024 * 1024
            });
            const out = String(r.stdout || '') + String(r.stderr || '');
            expect(out).toContain('Nie udalo sie zsynchronizowac schematu');
            expect(out).not.toContain('[OK] Schemat zsynchronizowany');
        } finally {
            project.cleanup();
        }
    }, 180000);

    it('scenariusz 2: migration-managed restore przez restore-db.js --yes', () => {
        const project = createIsolatedProject('restore-managed', [BASELINE]);
        try {
            project.runPrisma(['migrate', 'deploy']);
            let db = new DatabaseSync(project.dbPath);
            insertWell(db);
            db.close();
            expect(countRury(project.dbPath)).toBe(1);

            const backupPath = path.join(project.dir, 'managed_backup.sqlite');
            vacuumInto(project.dbPath, backupPath);

            db = new DatabaseSync(project.dbPath);
            db.prepare('DELETE FROM ProductsRury').run();
            db.close();
            expect(countRury(project.dbPath)).toBe(0);

            const out = execFileSync(process.execPath, [SCRIPT, backupPath, '--yes'], {
                cwd: ROOT,
                encoding: 'utf8',
                env: {
                    ...project.env,
                    RESTORE_DB_PATH: project.dbPath,
                    RESTORE_PRISMA_DIR: project.dir
                },
                stdio: ['ignore', 'pipe', 'pipe']
            });
            expect(out).toContain('[OK] Schemat zsynchronizowany');
            expect(countRury(project.dbPath)).toBe(1);

            const db2 = new DatabaseSync(project.dbPath, { readOnly: true });
            const mig = db2
                .prepare('SELECT count(*) AS n FROM _prisma_migrations WHERE migration_name = ?')
                .get(BASELINE);
            db2.close();
            expect((mig as { n: number }).n).toBe(1);

            const status = project.runPrisma(['migrate', 'status']);
            expect(/database schema is up to date/i.test(status)).toBe(true);
        } finally {
            project.cleanup();
        }
    }, 180000);

    it('scenariusz 3: restore-db.js odrzuca nie-SQLite plik (A-12 nagłówek)', () => {
        const project = createIsolatedProject('restore-badheader', [BASELINE]);
        try {
            project.runPrisma(['migrate', 'deploy']);
            const garbage = path.join(project.dir, 'not_a_db.sqlite');
            fs.writeFileSync(garbage, 'To nie jest baza SQLite - zwykly tekst.', 'utf8');

            const r = spawnSync(process.execPath, [SCRIPT, garbage, '--yes'], {
                cwd: ROOT,
                encoding: 'utf8',
                env: {
                    ...project.env,
                    RESTORE_DB_PATH: project.dbPath,
                    RESTORE_PRISMA_DIR: project.dir
                },
                stdio: ['ignore', 'pipe', 'pipe']
            });
            const out = String(r.stdout || '') + String(r.stderr || '');
            expect(r.status).toBe(1);
            expect(out).toContain('nie jest poprawna baza SQLite');
        } finally {
            project.cleanup();
        }
    }, 180000);

    it('scenariusz 4: restore-db.js odrzuca backup bez integrity_check (A-12)', () => {
        const project = createIsolatedProject('restore-corrupt', [BASELINE]);
        try {
            project.runPrisma(['migrate', 'deploy']);
            const backupPath = path.join(project.dir, 'corrupt_backup.sqlite');
            vacuumInto(project.dbPath, backupPath);

            /* Uszkodzenie: usunięcie 4096 bajtów z 100-bajtowej bazy — za krótki
               plik przechodzi nagłówkiem, ale nie zdaje integrity_check */
            const buf = fs.readFileSync(backupPath);
            fs.writeFileSync(backupPath, buf.subarray(0, Math.min(buf.length - 4096, 4096)));

            const r = spawnSync(process.execPath, [SCRIPT, backupPath, '--yes'], {
                cwd: ROOT,
                encoding: 'utf8',
                env: {
                    ...project.env,
                    RESTORE_DB_PATH: project.dbPath,
                    RESTORE_PRISMA_DIR: project.dir
                },
                stdio: ['ignore', 'pipe', 'pipe']
            });
            const out = String(r.stdout || '') + String(r.stderr || '');
            expect(r.status).toBe(1);
            expect(out).toContain('PRAGMA integrity_check');
        } finally {
            project.cleanup();
        }
    }, 180000);

    it('scenariusz 5: restore-db.js czyści -wal/-shm po przywróceniu (A-12)', () => {
        const project = createIsolatedProject('restore-wal', [BASELINE]);
        try {
            project.runPrisma(['migrate', 'deploy']);
            let db = new DatabaseSync(project.dbPath);
            insertWell(db);
            db.close();

            const backupPath = path.join(project.dir, 'wal_backup.sqlite');
            vacuumInto(project.dbPath, backupPath);

            db = new DatabaseSync(project.dbPath);
            db.prepare('DELETE FROM ProductsRury').run();
            db.close();

            /* Stwórz boczne pliki -wal/-shm (symulacja starej sesji) */
            fs.writeFileSync(project.dbPath + '-wal', 'STALE WAL', 'utf8');
            fs.writeFileSync(project.dbPath + '-shm', 'STALE SHM', 'utf8');

            execFileSync(process.execPath, [SCRIPT, backupPath, '--yes'], {
                cwd: ROOT,
                encoding: 'utf8',
                env: {
                    ...project.env,
                    RESTORE_DB_PATH: project.dbPath,
                    RESTORE_PRISMA_DIR: project.dir
                },
                stdio: ['ignore', 'pipe', 'pipe']
            });

            expect(fs.existsSync(project.dbPath + '-wal')).toBe(false);
            expect(fs.existsSync(project.dbPath + '-shm')).toBe(false);
            expect(countRury(project.dbPath)).toBe(1);
        } finally {
            project.cleanup();
        }
    }, 180000);
});
