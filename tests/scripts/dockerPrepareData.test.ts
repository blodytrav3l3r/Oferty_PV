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

// Sciezka roota w formie, w jakiej widzi ja skrypt (git-bash/MSYS tlumaczy
// C:\... na /c/... lub /tmp/... — path.join z Node daj inny zapis).
function bashPosixPath(p: string): string {
    const r = spawnSync('bash', ['-c', `cd "${p}" && pwd -P`], { encoding: 'utf8' });
    return String(r.stdout || '').trim();
}

interface StubOpts {
    buildOut?: string;
    buildExit?: number;
    stubUid?: string;
    stubGid?: string;
    preExistingBackups?: boolean;
    preExistingDb?: boolean;
}

function setupIsolatedRoot(opts: StubOpts = {}): {
    root: string;
    posixRoot: string;
    chownLog: string;
} {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sok-prepare-'));
    const scriptsDir = path.join(root, 'scripts');
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

    // Stuby jako FUNKCJE przez BASH_ENV (deterministyczne: funkcje wygrywaja
    // z PATH bez skanowania katalogow; shadowing PATH jest niewiarygodny przy
    // kolizji z binarka systemowa — np. chown vs /usr/bin/chown w msys).
    // UWAGA: `exit` w funkcji zabilby skrypt — stad `return`.
    const posixRoot = bashPosixPath(root);
    const chownLog = `${posixRoot}/chown.log`;
    const envSh = [
        'docker() {',
        '  if [ "$1" = "build" ]; then',
        '    printf "%s" "$STUB_BUILD_OUT"',
        '    return "$STUB_BUILD_EXIT"',
        '  fi',
        '  if [ "$1" = "run" ]; then',
        '    last=""',
        '    for a in "$@"; do last="$a"; done',
        '    case "$last" in',
        '      "id -u node") printf "%s" "$STUB_UID" ;;',
        '      "id -g node") printf "%s" "$STUB_GID" ;;',
        '    esac',
        '    return 0',
        '  fi',
        '  return 0',
        '}',
        'chown() {',
        '  for a in "$@"; do',
        '    printf "%s\\n" "$a" >> "$CHOWN_LOG"',
        '  done',
        '  return 0',
        '}',
        ''
    ].join('\n');
    fs.writeFileSync(path.join(root, 'env.sh'), envSh, 'utf8');

    return { root, posixRoot, chownLog };
}

function runPrepare(
    root: string,
    posixRoot: string,
    chownLog: string,
    opts: StubOpts = {}
): { status: number | null; stdout: string; stderr: string; chownCalls: string[] } {
    const env: NodeJS.ProcessEnv = { ...process.env };
    delete env.SUDO_USER;
    env.BASH_ENV = `${posixRoot}/env.sh`;
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
        // Odczyt sciezka Windows (ten sam plik co posixowy CHOWN_LOG w bashu).
        const winLog = path.join(root, 'chown.log');
        if (fs.existsSync(winLog)) {
            chownCalls = fs
                .readFileSync(winLog, 'utf8')
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

// Widoczny skip zamiast cichego pass: bez basha testy sa OMINIETE (○),
// nie zaliczone — cichy `return` dal kiedys falszywie zielony run.
const testBash = bashAvailable() ? it : it.skip;
// Asercje UID wlasciciela (id -u / chown) maja sens tylko na POSIX:
// Git Bash pod Windows zwraca mapowany SID (np. 197609), wiec oczekiwane
// '1000:1000' nigdy sie nie spina. Na Linux CI testy dalej sie wykonuja.
const testPosixIds = process.platform !== 'win32' ? it : it.skip;

describe('docker-prepare-data.sh (stub docker)', () => {
    testBash(
        'build exit 0 BEZ image ID -> jasny blad o ID, zero chown (regresja CI 35762836155)',
        () => {
            const { root, posixRoot, chownLog } = setupIsolatedRoot({ buildOut: '', buildExit: 0 });
            try {
                const r = runPrepare(root, posixRoot, chownLog, { buildOut: '', buildExit: 0 });
                expect(r.status).not.toBe(0);
                expect(r.stderr).toMatch(/nie ustalono ID obrazu/);
                expect(r.chownCalls).toEqual([]);
            } finally {
                cleanup(root);
            }
        }
    );

    testPosixIds(
        'happy path: sha256 ID -> chown katalogu + sqlite, BEZ -R, backups nietkniete',
        () => {
            const caller = bashId();
            const { root, posixRoot, chownLog } = setupIsolatedRoot({
                preExistingDb: true,
                preExistingBackups: true
            });
            try {
                const r = runPrepare(root, posixRoot, chownLog, {});
                expect(r.status).toBe(0);
                expect(r.stdout).toMatch(/\[OK\]/);
                expect(posixRoot.length).toBeGreaterThan(0);
                // Chirurgiczny chown: [spec, katalog, plik DB] - jedno wywolanie...
                expect(r.chownCalls).toHaveLength(3);
                expect(r.chownCalls[0]).toBe('1000:1000');
                expect(r.chownCalls[1]).toBe(`${posixRoot}/data`);
                expect(r.chownCalls[2]).toBe(`${posixRoot}/data/app_database.sqlite`);
                // ...bez rekurencji i bez dotykania backups/*.
                expect(r.chownCalls).not.toContain('-R');
                expect(r.chownCalls.join('\n')).not.toContain('backups');
                // Istniejacy backups/ zostaje (flaga NIETKNIETY = brak chown na nim).
                expect(fs.existsSync(path.join(root, 'data', 'backups', 'keep.txt'))).toBe(true);
                expect(caller.uid.length).toBeGreaterThan(0);
            } finally {
                cleanup(root);
            }
        }
    );

    testPosixIds('nowy backups/ dostaje wlasciciela wywolujacego, nie node', () => {
        const caller = bashId();
        const { root, posixRoot, chownLog } = setupIsolatedRoot({});
        try {
            const r = runPrepare(root, posixRoot, chownLog, {});
            expect(r.status).toBe(0);
            expect(fs.existsSync(path.join(root, 'data', 'backups'))).toBe(true);
            expect(r.chownCalls).toContain(`${caller.uid}:${caller.gid}`);
            expect(r.chownCalls).toContain(`${posixRoot}/data/backups`);
        } finally {
            cleanup(root);
        }
    });

    testBash('garbage UID z obrazu -> blad przed chown', () => {
        const { root, posixRoot, chownLog } = setupIsolatedRoot({});
        try {
            const r = runPrepare(root, posixRoot, chownLog, { stubUid: 'abc', stubGid: '1000' });
            expect(r.status).not.toBe(0);
            expect(r.stderr).toMatch(/nieprawidlowy UID\/GID/);
            expect(r.chownCalls).toEqual([]);
        } finally {
            cleanup(root);
        }
    });

    testBash('blad budowania -> fail-fast, zero chown', () => {
        const { root, posixRoot, chownLog } = setupIsolatedRoot({ buildExit: 1 });
        try {
            const r = runPrepare(root, posixRoot, chownLog, { buildExit: 1 });
            expect(r.status).not.toBe(0);
            expect(r.chownCalls).toEqual([]);
        } finally {
            cleanup(root);
        }
    });
});
