import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const SCRIPT_SOURCE = path.resolve(__dirname, '..', '..', 'scripts', 'docker-preflight.sh');

function bashAvailable(): boolean {
    const result = spawnSync('bash', ['--version'], { stdio: 'ignore' });
    return !result.error && result.status === 0;
}

function createFixture(): { root: string; scriptPath: string; commandsPath: string } {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sok-docker-preflight-'));
    const scriptsDirectory = path.join(root, 'scripts');
    fs.mkdirSync(scriptsDirectory, { recursive: true });
    const scriptPath = path.join(scriptsDirectory, 'docker-preflight.sh');
    fs.copyFileSync(SCRIPT_SOURCE, scriptPath);
    fs.chmodSync(scriptPath, 0o755);
    fs.writeFileSync(path.join(root, 'docker-compose.yml'), 'services:\n  postgres:\n');
    fs.writeFileSync(path.join(root, 'Dockerfile'), 'FROM node:22-slim\n');

    const commandsPath = path.join(root, 'docker-commands.log');
    fs.writeFileSync(
        path.join(root, 'docker-stub.sh'),
        [
            'docker() {',
            '  printf "%s\\n" "$*" >> "$DOCKER_COMMANDS"',
            '  return "$DOCKER_EXIT"',
            '}',
            ''
        ].join('\n')
    );
    return { root, scriptPath, commandsPath };
}

function runPreflight(
    fixture: { root: string; scriptPath: string; commandsPath: string },
    options: { exitCode?: number; args?: string[] } = {}
): { status: number | null; stdout: string; stderr: string; dockerCommands: string[] } {
    const result = spawnSync('bash', [fixture.scriptPath, ...(options.args ?? [])], {
        env: {
            ...process.env,
            BASH_ENV: path.join(fixture.root, 'docker-stub.sh'),
            DOCKER_COMMANDS: fixture.commandsPath,
            DOCKER_EXIT: String(options.exitCode ?? 0)
        },
        cwd: fixture.root,
        encoding: 'utf8'
    });
    const dockerCommands = fs.existsSync(fixture.commandsPath)
        ? fs.readFileSync(fixture.commandsPath, 'utf8').split('\n').filter(Boolean)
        : [];
    return {
        status: result.status,
        stdout: String(result.stdout ?? ''),
        stderr: String(result.stderr ?? ''),
        dockerCommands
    };
}

function cleanup(root: string): void {
    fs.rmSync(root, { recursive: true, force: true });
}

const bashTest = bashAvailable() ? it : it.skip;

describe('docker-preflight.sh', () => {
    bashTest('validates Compose without changing host data ownership', () => {
        const fixture = createFixture();
        try {
            const result = runPreflight(fixture);
            expect(result.status).toBe(0);
            expect(result.dockerCommands).toEqual(['compose config --quiet']);
            expect(result.stdout).toContain('PostgreSQL Compose configuration is valid');
            expect(result.stdout).not.toMatch(/password|DATABASE_URL|postgres:\/\//i);
        } finally {
            cleanup(fixture.root);
        }
    });

    bashTest('dry-run does not call Docker or print connection values', () => {
        const fixture = createFixture();
        try {
            const result = runPreflight(fixture, { args: ['--dry-run'] });
            expect(result.status).toBe(0);
            expect(result.dockerCommands).toEqual([]);
            expect(result.stdout).toContain('required PostgreSQL Compose configuration');
        } finally {
            cleanup(fixture.root);
        }
    });

    bashTest('Compose validation failure is returned to the caller', () => {
        const fixture = createFixture();
        try {
            const result = runPreflight(fixture, { exitCode: 1 });
            expect(result.status).not.toBe(0);
            expect(result.dockerCommands).toEqual(['compose config --quiet']);
            expect(result.stderr).toContain('configuration is invalid');
        } finally {
            cleanup(fixture.root);
        }
    });
});
