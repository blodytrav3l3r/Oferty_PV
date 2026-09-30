/**
 * P1.3: regresja guardów restore-db.js (F-001).
 * Import NIE uruchamia restore (guard require.main w skrypcie).
 * Wszystkie pliki w os.tmpdir — zero dotykania prod DB.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as crypto from 'crypto';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { isSqliteFile, verifyChecksum, integrityCheck } = require('../scripts/restore-db.js');

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
