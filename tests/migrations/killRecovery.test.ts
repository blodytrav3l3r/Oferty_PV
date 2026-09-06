/*
 * P0-F kill/recovery: KILL -9 w różnych momentach transakcji batch.
 * Prawdziwy SIGKILL childa (nie mock): po zabiciu batch jest 0% albo 100%,
 * nigdy 37%. Plus: stary backup (tylko baseline) restore'owany na nowym
 * kodzie przechodzi migrate deploy z zachowaniem danych.
 */
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createIsolatedProject } from './helpers';

const ROOT = path.resolve(__dirname, '..', '..');
const WRITER = path.join(__dirname, 'killWriter.cjs');
const RESTORE_SCRIPT = path.join(ROOT, 'scripts', 'restore-db.js');
const BASELINE = '20260815000000_baseline';

function integrityOk(dbPath: string): boolean {
    const db = new DatabaseSync(dbPath, { readOnly: true });
    try {
        const rows = db.prepare('PRAGMA integrity_check;').all() as Array<{
            integrity_check: string;
        }>;
        return rows.length === 1 && rows[0].integrity_check === 'ok';
    } finally {
        db.close();
    }
}

function countProbe(dbPath: string): number {
    const db = new DatabaseSync(dbPath, { readOnly: true });
    try {
        const tables = db
            .prepare(
                "SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table' AND name='kill_probe'"
            )
            .get() as { n: number };
        if (!tables.n) return 0;
        return (db.prepare('SELECT COUNT(*) AS n FROM kill_probe').get() as { n: number }).n;
    } finally {
        db.close();
    }
}

function waitForOutput(child: ReturnType<typeof spawn>, needle: string, timeoutMs = 30000): Promise<void> {
    return new Promise((resolve, reject) => {
        let buf = '';
        const timer = setTimeout(() => reject(new Error(`timeout na ${needle}`)), timeoutMs);
        child.stdout?.on('data', (d: Buffer) => {
            buf += d.toString();
            if (buf.includes(needle)) {
                clearTimeout(timer);
                resolve();
            }
        });
        child.on('error', (e) => {
            clearTimeout(timer);
            reject(e);
        });
    });
}

describe('P0-F kill/recovery', () => {
    it.each([10, 50, 90])(
        'KILL po %i wierszach ze 100 → 0 wierszy + integrity ok',
        async (written) => {
            const dir = path.join(ROOT, 'tests', 'tmp', `kill-${written}`);
            fs.rmSync(dir, { recursive: true, force: true });
            fs.mkdirSync(dir, { recursive: true });
            const dbPath = path.join(dir, 'victim.db');
            try {
                const child = spawn(process.execPath, [WRITER, dbPath, '100', '0'], {
                    stdio: ['ignore', 'pipe', 'pipe']
                });
                // Czekaj aż writer dotrze do co najmniej `written` wierszy.
                const milestone = written <= 25 ? 25 : written <= 50 ? 50 : written <= 75 ? 75 : 100;
                await waitForOutput(child, `progress:${milestone}`);
                child.kill('SIGKILL');
                await new Promise<void>((resolve) => {
                    const t = setTimeout(resolve, 10000);
                    child.on('exit', () => {
                        clearTimeout(t);
                        resolve();
                    });
                });
                expect(countProbe(dbPath)).toBe(0);
                expect(integrityOk(dbPath)).toBe(true);
            } finally {
                fs.rmSync(dir, { recursive: true, force: true });
            }
        },
        120000
    );

    it('commit bez killa → 100 wierszy (druga strona all-or-nothing)', async () => {
        const dir = path.join(ROOT, 'tests', 'tmp', 'kill-commit');
        fs.rmSync(dir, { recursive: true, force: true });
        fs.mkdirSync(dir, { recursive: true });
        const dbPath = path.join(dir, 'victim.db');
        try {
            const child = spawn(process.execPath, [WRITER, dbPath, '100', '1'], {
                stdio: ['ignore', 'pipe', 'pipe']
            });
            await waitForOutput(child, 'committed');
            await new Promise<void>((resolve) => {
                const t = setTimeout(resolve, 10000);
                child.on('exit', () => {
                    clearTimeout(t);
                    resolve();
                });
            });
            expect(countProbe(dbPath)).toBe(100);
            expect(integrityOk(dbPath)).toBe(true);
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    }, 120000);

    it('stary backup (baseline) restore na nowym kodzie + migrate deploy', () => {
        const project = createIsolatedProject('restore-oldbackup', [BASELINE]);
        try {
            project.runPrisma(['migrate', 'deploy']);
            const db = new DatabaseSync(project.dbPath);
            db.prepare('INSERT INTO ProductsRury (id, name, category, price) VALUES (?, ?, ?, ?)').run(
                'r_old',
                'Rura stara',
                'Rury Betonowe',
                11.0
            );
            db.close();

            const backupPath = path.join(project.dir, 'old_backup.sqlite');
            const src = new DatabaseSync(project.dbPath);
            src.exec(`VACUUM INTO '${backupPath.replace(/\\/g, '/')}'`);
            src.close();

            // Dokładamy resztę migracji (= "nowszy kod") i restore'ujemy stary backup.
            const { readdirSync } = fs;
            const repoMigrations = path.join(ROOT, 'prisma', 'migrations');
            for (const m of readdirSync(repoMigrations)) {
                if (m === BASELINE || m === 'migration_lock.toml') continue;
                const srcDir = path.join(repoMigrations, m);
                if (!fs.existsSync(path.join(srcDir, 'migration.sql'))) continue;
                fs.cpSync(srcDir, path.join(project.migrationsDir, m), { recursive: true });
            }

            const out = execFileSync(process.execPath, [RESTORE_SCRIPT, backupPath, '--yes'], {
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
            const check = new DatabaseSync(project.dbPath, { readOnly: true });
            const n = (check.prepare('SELECT COUNT(*) AS n FROM ProductsRury').get() as { n: number }).n;
            check.close();
            expect(n).toBe(1);
            const status = project.runPrisma(['migrate', 'status']);
            expect(/database schema is up to date/i.test(status)).toBe(true);
        } finally {
            project.cleanup();
        }
    }, 300000);
});
