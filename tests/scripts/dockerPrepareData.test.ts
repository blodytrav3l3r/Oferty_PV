/*
 * tests/scripts/dockerPrepareData.test.ts
 * P0.3-B: testy harnessu scripts/docker-prepare-data.sh ze stubowanym dockerem.
 *
 * Pokrycie:
 *  1. build z kodem 0 BEZ image ID na stdout (regresja CI 35762836155:
 *     `docker compose build -q` nic nie wypisal) -> jasny blad o ID.
 *  2. happy path: sha256 ID -> id -u/-g node -> chirurgiczny chown
 *     (katalog + sqlite, BEZ -R, backups/* nietkniete).
 *  3. garbage UID/GID z obrazu -> blad (fail-fast przed chown).
 *  4. blad budowania -> fail-fast, zero wywolan chown.
 *
 * Testy wymagaja basha (skip gdy brak — wzorzec z deployCore.test.ts P0.2).
 * Skrypt operuje wylacznie na izolowanym tmpdir (ROOT wywodzony z jego
 * wlasnej lokalizacji), nigdy na prawdziwym ./data repo.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const SCRIPT_SRC = path.resolve(__dirname, '..', '..', 'scripts', 'docker-prepare-data.sh');

const FAKE_SHA = 'sha256:' + 'a1b2'.repeat(16);

function bashAvailable(): boolean {
    try {
        const r = spawnSync('bash', ['--version'], { stdio: 'ignore' });
        return !r.error && r.status === 0;
    } catch {
        return false;
    }
}

function bashId(): { uid: string; gid: string } {
    const u = spawnSync('bash', ['-c', 'id -u'], { encoding: 'utf8' });
    const g = spawnSync('bash', ['-c', 'id -g'], { encoding: 'utf8' });
    return { uid: String(u.stdout).trim(), gid: String(g.stdout).trim() };
}

interface StubOpts {
    buildOut?: string;
    buildExit?: number;
    stubUid?: string;
    stubGid?: string;
    preExistingBackups?: boolean;
    preExistingDb?: boolean;
}

function setupIsolatedRoot(opts: StubOpts = {}): { root: string; bin: string; chownLog: string } {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sok-prepare-'));
    const bin = path.join(root, 'bin');
    const scriptsDir = path.join(root, 'scripts');
    fs.mkdirSync(bin, { recursive: true });
    fs.mkdirSync(scriptsDir, { recursive: true });

    // Prawdziwy skrypt (normalizacja LF), falszywe repo wokol niego.
    const src = fs.readFileSync(SCRIPT_SRC, 'utf8').replace(/\r\n/g, '\n');
    const scriptPath = path.join(scriptsDir, 'docker-prepare-data.sh');
    fs.writeFileSync(scriptPath, src, 'utf8');
    fs.chmodSync(scriptPath, 0o755);
    fs.writeFileSync(
        path.join(root, 'docker-compose.yml'),
        'services:\n  app:\n    build: .\n    volumes:\n      - ./data:/var/data\n',
        'utf8'
    );
    fs.writeFileSync(path.join(root, 'Dockerfile'), '# stub\n', 'utf8');

    if (opts.preExistingDb) {
        fs.mkdirSync(path.join(root, 'data'), { recursive: true });
        fs.writeFileSync(path.join(root, 'data', 'app_database.sqlite'), 'x', 'utf8');
    }
    if (opts.preExistingBackups) {
        fs.mkdirSync(path.join(root, 'data', 'backups'), { recursive: true });
        fs.writeFileSync(path.join(root, 'data', 'backups', 'keep.txt'), 'x', 'utf8');
    }

    const dockerStub = [
        '#!/bin/sh',
        'if [ "$1" = "build" ]; then',
        '  printf "%s" "$STUB_BUILD_OUT"',
        '  exit "$STUB_BUILD_EXIT"',
        'fi',
        'if [ "$1" = "run" ]; then',
        '  last=""',
        '  for a in "$@"; do last="$a"; done',
        '  case "$last" in',
        '    "id -u node") printf "%s" "$STUB_UID" ;;',
        '    "id -g node") printf "%s" "$STUB_GID" ;;',
        '  esac',
        '  exit 0',
        'fi',
        'exit 0',
        ''
    ].join('\n');
    fs.writeFileSync(path.join(bin, 'docker'), dockerStub, 'utf8');
    fs.chmodSync(path.join(bin, 'docker'), 0o755);

    const chownLog = path.join(root, 'chown.log');
    fs.writeFileSync(
        path.join(bin, 'chown'),
        '#!/bin/sh\necho "$@" >> "$CHOWN_LOG"\nexit 0\n',
        'utf8'
    );
    fs.chmodSync(path.join(bin, 'chown'), 0o755);

    return { root, bin, chownLog };
}

function runPrepare(
    root: string,
    bin: string,
    chownLog: string,
    opts: StubOpts = {}
): { status: number | null; stdout: string; stderr: string; chownCalls: string[] } {
    const env: NodeJS.ProcessEnv = { ...process.env };
    delete env.SUDO_USER;
    env.PATH = bin + path.delimiter + (process.env.PATH || '');
    env.STUB_BUILD_OUT = opts.buildOut ?? FAKE_SHA;
    env.STUB_BUILD_EXIT = String(opts.buildExit ?? 0);
    env.STUB_UID = opts.stubUid ?? '1000';
    env.STUB_GID = opts.stubGid ?? '1000';
    env.CHOWN_LOG = chownLog;
    const r = spawnSync('bash', [path.join(root, 'scripts', 'docker-prepare-data.sh')], {
        env,
        encoding: 'utf8'
    });
    let chownCalls: string[] = [];
    try {
        if (fs.existsSync(chownLog)) {
            chownCalls = fs
                .readFileSync(chownLog, 'utf8')
                .split('\n')
                .map((l) => l.trim())
                .filter((l) => l.length > 0);
        }
    } catch {
        chownCalls = [];
    }
    return {
        status: r.status,
        stdout: String(r.stdout || ''),
        stderr: String(r.stderr || ''),
        chownCalls
    };
}

function cleanup(root: string): void {
    fs.rmSync(root, { recursive: true, force: true });
}

describe('docker-prepare-data.sh (stub docker)', () => {
    it('build exit 0 BEZ image ID -> jasny blad o ID, zero chown (regresja CI 35762836155)', () => {
        if (!bashAvailable()) return;
        const { root, bin, chownLog } = setupIsolatedRoot({ buildOut: '', buildExit: 0 });
        try {
            const r = runPrepare(root, bin, chownLog, { buildOut: '', buildExit: 0 });
            expect(r.status).not.toBe(0);
            expect(r.stderr).toMatch(/nie ustalono ID obrazu/);
            expect(r.chownCalls).toEqual([]);
        } finally {
            cleanup(root);
        }
    });

    it('happy path: sha256 ID -> chown katalogu + sqlite, BEZ -R, backups nietkniete', () => {
        if (!bashAvailable()) return;
        const caller = bashId();
        const { root, bin, chownLog } = setupIsolatedRoot({
            preExistingDb: true,
            preExistingBackups: true
        });
        try {
            const r = runPrepare(root, bin, chownLog, {});
            expect(r.status).toBe(0);
            expect(r.stdout).toMatch(/\[OK\]/);
            // Chirurgiczny chown: dokladnie 2 wywolania (katalog + plik DB)...
            expect(r.chownCalls).toHaveLength(2);
            expect(r.chownCalls[0]).toBe(`1000:1000 ${path.join(root, 'data')}`);
            expect(r.chownCalls[1]).toBe(
                `1000:1000 ${path.join(root, 'data', 'app_database.sqlite')}`
            );
            // ...bez rekurencji i bez dotykania backups/*.
            expect(r.chownCalls.join('\n')).not.toMatch(/(^|\s)-R(\s|$)/);
            expect(r.chownCalls.join('\n')).not.toContain('backups');
            // Istniejacy backups/ zostaje (flaga NIETKNIETY = brak chown na nim).
            expect(fs.existsSync(path.join(root, 'data', 'backups', 'keep.txt'))).toBe(true);
            expect(caller.uid.length).toBeGreaterThan(0);
        } finally {
            cleanup(root);
        }
    });

    it('nowy backups/ dostaje wlasciciela wywolujacego, nie node', () => {
        if (!bashAvailable()) return;
        const caller = bashId();
        const { root, bin, chownLog } = setupIsolatedRoot({});
        try {
            const r = runPrepare(root, bin, chownLog, {});
            expect(r.status).toBe(0);
            expect(fs.existsSync(path.join(root, 'data', 'backups'))).toBe(true);
            expect(r.chownCalls).toContain(
                `${caller.uid}:${caller.gid} ${path.join(root, 'data', 'backups')}`
            );
        } finally {
            cleanup(root);
        }
    });

    it('garbage UID z obrazu -> blad przed chown', () => {
        if (!bashAvailable()) return;
        const { root, bin, chownLog } = setupIsolatedRoot({});
        try {
            const r = runPrepare(root, bin, chownLog, { stubUid: 'abc', stubGid: '1000' });
            expect(r.status).not.toBe(0);
            expect(r.stderr).toMatch(/nieprawidlowy UID\/GID/);
            expect(r.chownCalls).toEqual([]);
        } finally {
            cleanup(root);
        }
    });

    it('blad budowania -> fail-fast, zero chown', () => {
        if (!bashAvailable()) return;
        const { root, bin, chownLog } = setupIsolatedRoot({ buildExit: 1 });
        try {
            const r = runPrepare(root, bin, chownLog, { buildExit: 1 });
            expect(r.status).not.toBe(0);
            expect(r.chownCalls).toEqual([]);
        } finally {
            cleanup(root);
        }
    });
});
