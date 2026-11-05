import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { createIsolatedProject } from './helpers';

const WRITER = path.join(__dirname, 'pgKillWriter.cjs');
const MIGRATIONS_DIR = path.join(__dirname, '..', '..', 'prisma', 'migrations-postgresql');

function postgresMigrations(): string[] {
    return fs
        .readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .filter((entry) => fs.existsSync(path.join(MIGRATIONS_DIR, entry, 'migration.sql')))
        .sort();
}

function waitForOutput(child: ReturnType<typeof spawn>, marker: string): Promise<string> {
    return new Promise((resolve, reject) => {
        let output = '';
        const timeout = setTimeout(
            () => reject(new Error(`Timed out waiting for ${marker}`)),
            30_000
        );
        child.stdout?.on('data', (chunk: Buffer) => {
            output += chunk.toString();
            if (output.includes(marker)) {
                clearTimeout(timeout);
                resolve(output);
            }
        });
        child.once('error', (error) => {
            clearTimeout(timeout);
            reject(error);
        });
        child.once('exit', (code) => {
            if (code !== null && code !== 0) {
                clearTimeout(timeout);
                reject(new Error(`PostgreSQL transaction writer exited with code ${code}`));
            }
        });
    });
}

function startWriter(
    project: ReturnType<typeof createIsolatedProject>,
    prefix: string,
    commit = false
) {
    const baseUrl = new URL(project.databaseUrl);
    baseUrl.searchParams.delete('schema');
    return spawn(
        process.execPath,
        [WRITER, baseUrl.toString(), project.schemaName, prefix, commit ? 'commit' : 'hold'],
        { cwd: path.resolve(__dirname, '..', '..'), stdio: ['ignore', 'pipe', 'pipe'] }
    );
}

describe('PostgreSQL transaction recovery', () => {
    it('rolls back an interrupted write and preserves a committed batch', async () => {
        const project = createIsolatedProject('transaction-recovery', postgresMigrations());
        const prefix = `kill-${process.pid}-${Date.now()}`;
        let interrupted: ReturnType<typeof spawn> | undefined;
        try {
            project.runPrisma(['migrate', 'deploy']);
            interrupted = startWriter(project, `${prefix}-rollback`);
            const output = await waitForOutput(interrupted, 'progress:10');
            const backendPid = Number(/backend:(\d+)/.exec(output)?.[1]);
            expect(Number.isInteger(backendPid)).toBe(true);
            interrupted.kill('SIGKILL');
            await new Promise<void>((resolve, reject) => {
                const timeout = setTimeout(
                    () => reject(new Error('Interrupted PostgreSQL writer did not exit')),
                    10_000
                );
                interrupted?.once('exit', () => {
                    clearTimeout(timeout);
                    resolve();
                });
            });

            const backendStoppedAt = Date.now() + 10_000;
            while (Date.now() < backendStoppedAt) {
                const [backend] = project.query<{ active: boolean }>(
                    'SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE pid = $1) AS active',
                    [backendPid]
                );
                if (!backend.active) break;
                await new Promise((resolve) => setTimeout(resolve, 50));
            }
            expect(
                project.query<{ active: boolean }>(
                    'SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE pid = $1) AS active',
                    [backendPid]
                )[0].active
            ).toBe(false);

            expect(
                project.query<{ count: number }>(
                    'SELECT COUNT(*)::integer AS count FROM "settings" WHERE "key" LIKE $1',
                    [`${prefix}-rollback-%`]
                )[0].count
            ).toBe(0);

            const committed = startWriter(project, `${prefix}-commit`, true);
            await waitForOutput(committed, 'committed');
            await new Promise<void>((resolve, reject) => {
                committed.once('exit', (code) =>
                    code === 0
                        ? resolve()
                        : reject(new Error(`Committed writer exited with code ${code}`))
                );
            });
            expect(
                project.query<{ count: number }>(
                    'SELECT COUNT(*)::integer AS count FROM "settings" WHERE "key" LIKE $1',
                    [`${prefix}-commit-%`]
                )[0].count
            ).toBe(100);
        } finally {
            if (interrupted && interrupted.exitCode === null) interrupted.kill('SIGKILL');
            project.cleanup();
        }
    }, 120_000);
});
