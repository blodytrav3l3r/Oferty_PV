/*
 * tests/migrations/helpers.ts
 * Helper do izolowanych testow migracji Prisma.
 *
 * Tworzy tymczasowy projekt Prisma w tests/tmp/<name>/ z wlasnym
 * prisma.config.ts, schema.prisma (kopia produkcyjnego) i wybranymi
 * migracjami. Testy NIE modyfikuja prisma/migrations w repo.
 *
 * TestTimeout w jest.config.ts to 10000 ms — operacje Prisma CLI
 * (db push, migrate deploy) wymagaja wiecej; uzyj testTimeout w opisie.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '..', '..');
const TMP_ROOT = path.join(ROOT, 'tests', 'tmp');
const PRISMA_CLI = path.join(ROOT, 'node_modules', 'prisma', 'build', 'index.js');

const SCHEMA_SRC = path.join(ROOT, 'prisma', 'schema.prisma');
const MIGRATIONS_SRC = path.join(ROOT, 'prisma', 'migrations');

/** Katalog zastępczy dla cleanup rename-away (DX-01). */
function deadDir(dir: string): string {
    return dir + '.dead';
}

/** Blokujące odczekanie ms (bez event loop — helper testowy, nie prod). */
function sleepSync(ms: number): void {
    try {
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
    } catch {
        /* brak SharedArrayBuffer — bez czekania */
    }
}

/**
 * Best-effort rmSync z retry — zwraca true gdy katalog nie istnieje (usunięty).
 * Na Windows proces wnuk Prisma CLI potrafi trzymać uchwyt jeszcze ~1-2 s
 * po wyjściu execFileSync (EPERM/EBUSY przy pierwszej próbie), więc przed
 * rename-away ponawiamy z odczekaniem. Koszt tylko na ścieżce błędu.
 */
function removeDirBestEffort(dir: string, retries = 5): boolean {
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            fs.rmSync(dir, { recursive: true, force: true, maxRetries: 30, retryDelay: 250 });
        } catch {
            /* flaky EPERM/EBUSY na Windows — retry poniżej */
        }
        if (!fs.existsSync(dir)) return true;
        if (attempt < retries) sleepSync(1000);
    }
    return !fs.existsSync(dir);
}

export interface IsolatedProject {
    dir: string;
    dbPath: string;
    schemaPath: string;
    migrationsDir: string;
    env: NodeJS.ProcessEnv;
    runPrisma: (args: string[]) => string;
    cleanup: () => void;
}

/**
 * Tworzy izolowany projekt Prisma z wybranymi migracjami.
 * @param name unikalna nazwa projektu (podkatalog tests/tmp/)
 * @param migrations lista nazw migracji do skopiowania (np. ['20260815000000_baseline'])
 */
export function createIsolatedProject(name: string, migrations: string[]): IsolatedProject {
    const dir = path.join(TMP_ROOT, name);
    removeDirBestEffort(dir);
    removeDirBestEffort(deadDir(dir));
    fs.mkdirSync(path.join(dir, 'prisma', 'migrations'), { recursive: true });

    const schemaPath = path.join(dir, 'prisma', 'schema.prisma');
    const migrationsDir = path.join(dir, 'prisma', 'migrations');
    fs.copyFileSync(SCHEMA_SRC, schemaPath);

    for (const m of migrations) {
        const srcDir = path.join(MIGRATIONS_SRC, m);
        if (!fs.existsSync(path.join(srcDir, 'migration.sql'))) {
            throw new Error(`Migration ${m} does not exist in repo`);
        }
        fs.cpSync(srcDir, path.join(migrationsDir, m), { recursive: true });
    }

    const config = `import 'dotenv/config';\nimport { defineConfig, env } from 'prisma/config';\n\nexport default defineConfig({\n    schema: 'prisma/schema.prisma',\n    migrations: {\n        path: 'prisma/migrations',\n        seed: 'ts-node prisma/seed.ts'\n    },\n    datasource: {\n        url: env('DATABASE_URL')\n    }\n});\n`;
    fs.writeFileSync(path.join(dir, 'prisma.config.ts'), config, 'utf8');

    const dbPath = path.join(dir, 'test.db');

    const env = {
        ...process.env,
        DATABASE_URL: 'file:' + dbPath.replace(/\\/g, '/')
    };

    function runPrisma(args: string[]): string {
        return execFileSync(process.execPath, [PRISMA_CLI, ...args], {
            cwd: dir,
            encoding: 'utf8',
            env,
            stdio: ['ignore', 'pipe', 'pipe']
        });
    }

    function cleanup() {
        // DX-01: na Windows silnik Prisma (proces wnuk CLI) potrafi trzymać
        // uchwyt katalogu długo po wyjściu execFileSync — flaky EPERM nie może
        // wyrzucać poprawnego testu. Strategia: rename-away (przeniesienie
        // katalogu zwykle udaje się mimo uchwytu) + rmSync celu zastępczego.
        // Resztka .dead jest sprzątana przy następnym createIsolatedProject.
        if (removeDirBestEffort(dir)) return;
        try {
            const dead = deadDir(dir);
            removeDirBestEffort(dead);
            fs.renameSync(dir, dead);
            if (!removeDirBestEffort(dead)) {
                console.warn(`[migrations-helpers] cleanup deferred for ${dir} (dead: ${dead})`);
            }
        } catch (err) {
            console.warn(
                `[migrations-helpers] cleanup failed for ${dir}: ${(err as Error)?.message ?? String(err)}`
            );
        }
    }

    return { dir, dbPath, schemaPath, migrationsDir, env, runPrisma, cleanup };
}

/**
 * Kopiuje dodatkowa migracje (np. testowa) do projektu.
 * @param project projekt izolowany
 * @param migrationName nazwa katalogu migracji w repo
 * @param overrides opcjonalne nadpisanie zawartosci migration.sql
 */
export function copyMigration(
    project: IsolatedProject,
    migrationName: string,
    overrides?: { migrationSql?: string; needsSeed?: boolean }
): string {
    const srcDir = path.join(MIGRATIONS_SRC, migrationName);
    const destDir = path.join(project.migrationsDir, migrationName);
    if (fs.existsSync(path.join(srcDir, 'migration.sql'))) {
        fs.cpSync(srcDir, destDir, { recursive: true });
    } else {
        fs.mkdirSync(destDir, { recursive: true });
    }
    if (overrides?.migrationSql) {
        fs.writeFileSync(path.join(destDir, 'migration.sql'), overrides.migrationSql, 'utf8');
    }
    return destDir;
}

/** Tworzy dowolny katalog migracji w projekcie z podanym SQL. */
export function addMigration(project: IsolatedProject, migrationName: string, sql: string): string {
    const destDir = path.join(project.migrationsDir, migrationName);
    fs.mkdirSync(destDir, { recursive: true });
    fs.writeFileSync(path.join(destDir, 'migration.sql'), sql, 'utf8');
    return destDir;
}

export function tempDb(project: IsolatedProject, name: string): string {
    return path.join(project.dir, name);
}

export function dbPathWithParams(dbPath: string): string {
    return 'file:' + dbPath.replace(/\\/g, '/') + '?connection_limit=1&busy_timeout=30000';
}
