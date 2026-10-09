/**
 * P1.3: regresja guardów restore-db.js (F-001).
 * Import NIE uruchamia restore (guard require.main w skrypcie).
 * Wszystkie pliki w os.tmpdir — zero dotykania prod DB.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as crypto from 'crypto';
import { execFileSync } from 'child_process';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const restoreDb = require('../scripts/restore-db.js');
const {
    isSqliteFile,
    verifyChecksum,
    integrityCheck,
    parseCliArgs,
    resolveTarget,
    isLiveDbPath,
    liveDbPath
} = restoreDb;

function tmpFile(name: string): string {
    return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'p13-')), name);
}

function makeDb(): string {
    const p = tmpFile('g.sqlite');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { DatabaseSync } = require('node:sqlite');
    const db = new DatabaseSync(p);
    db.exec('CREATE TABLE t(id TEXT PRIMARY KEY, v TEXT)');
    db.prepare('INSERT INTO t VALUES (?, ?)').run('a', 'b');
    db.close();
    return p;
}

// OOM-guard: live DB bywa duży — porównanie strumieniem (stała pamięć),
// nigdy readFileSync całości (RangeError pod obciążeniem, fail hooka).
function sha256File(p: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const h = crypto.createHash('sha256');
        const s = fs.createReadStream(p);
        s.on('error', reject);
        s.on('data', (d) => h.update(d as Buffer));
        s.on('end', () => resolve(h.digest('hex')));
    });
}

describe('restore guards (P1.3 / F-001)', () => {
    test('isSqliteFile: prawdziwy sqlite → true, tekst → false, brak pliku → false', () => {
        const db = makeDb();
        expect(isSqliteFile(db)).toBe(true);
        const txt = tmpFile('t.txt');
        fs.writeFileSync(txt, 'nie baza', 'utf8');
        expect(isSqliteFile(txt)).toBe(false);
        expect(isSqliteFile(txt + '.missing')).toBe(false);
    });

    test('integrityCheck: spójna baza → true', () => {
        expect(integrityCheck(makeDb())).toBe(true);
    });

    test('verifyChecksum: zgodny sidecar → true, podmieniony plik → false', () => {
        const db = makeDb();
        const hash = crypto.createHash('sha256').update(fs.readFileSync(db)).digest('hex');
        fs.writeFileSync(db + '.sha256', `${hash}  g.sqlite\n`, 'utf8');
        expect(verifyChecksum(db)).toBe(true);
        // podmiana 1 bajta (jak w E2E p13-corrupt)
        const fd = fs.openSync(db, 'r+');
        const b = Buffer.alloc(1);
        fs.readSync(fd, b, 0, 1, 100);
        b[0] ^= 0xff;
        fs.writeSync(fd, b, 0, 1, 100);
        fs.closeSync(fd);
        expect(verifyChecksum(db)).toBe(false);
    });

    test('verifyChecksum: brak sidecara (legacy) → true z ostrzeżeniem', () => {
        expect(verifyChecksum(makeDb())).toBe(true);
    });
});

describe('restore target guard (P1: brak silent fallback do live DB)', () => {
    test('resolveTarget: brak --target i brak env → NO_TARGET (żadnego fallback)', () => {
        expect(resolveTarget({ targetArg: null, envTarget: undefined, live: false })).toEqual({
            ok: false,
            code: 'NO_TARGET'
        });
    });

    test('resolveTarget: cel live bez --live → LIVE_REFUSED', () => {
        const r = resolveTarget({ targetArg: liveDbPath(), envTarget: undefined, live: false });
        expect(r.ok).toBe(false);
        expect(r.code).toBe('LIVE_REFUSED');
    });

    test('resolveTarget: cel live z --live → dozwolony, oznaczony live', () => {
        const r = resolveTarget({ targetArg: liveDbPath(), envTarget: undefined, live: true });
        expect(r.ok).toBe(true);
        expect(r.live).toBe(true);
    });

    test('resolveTarget: jawny cel poza live → dozwolony, nie live', () => {
        const t = tmpFile('cel.sqlite');
        const r = resolveTarget({ targetArg: t, envTarget: undefined, live: false });
        expect(r.ok).toBe(true);
        expect(r.live).toBe(false);
    });

    test('isLiveDbPath: wykrywa live i odrzuca inne ścieżki', () => {
        expect(isLiveDbPath(liveDbPath())).toBe(true);
        expect(isLiveDbPath(tmpFile('inny.sqlite'))).toBe(false);
    });

    test('parseCliArgs: parsuje --target i --live, źródło to pierwszy pozycyjny', () => {
        const p = parseCliArgs([
            'node',
            'restore-db.js',
            'b.sqlite',
            '--target',
            'c.sqlite',
            '--live'
        ]);
        expect(p).toEqual({ yes: false, live: true, targetArg: 'c.sqlite', sourceArg: 'b.sqlite' });
    });

    test('CLI bez celu NIE rusza live DB (fail-closed, exit != 0)', async () => {
        const script = path.join(__dirname, '..', 'scripts', 'restore-db.js');
        // Hermetyczność CI: live DB może nie istnieć (runner używa test-ci.sqlite).
        // Odmowa następuje przed jakimkolwiek copyFileSync, więc brak pliku też
        // dowodzi fail-closed; porównanie skrótem tylko gdy plik istnieje.
        const liveExists = fs.existsSync(liveDbPath());
        const before = liveExists ? await sha256File(liveDbPath()) : null;
        const env = { ...process.env };
        delete env.RESTORE_DB_PATH;
        let code = 0;
        let stderr = '';
        try {
            execFileSync(process.execPath, [script, makeDb()], { encoding: 'utf8', env });
        } catch (e) {
            code = (e as { status?: number }).status ?? 1;
            stderr = String((e as { stderr?: unknown }).stderr ?? (e as Error).message);
        }
        expect(code).not.toBe(0);
        expect(stderr).toMatch(/jawnego celu/i);
        if (before !== null) {
            expect(await sha256File(liveDbPath())).toBe(before);
        }
    });
});
