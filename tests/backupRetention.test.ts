import * as path from 'path';
import { selectBackupsForRetention, findOrphanSidecars, getBackupDir } from '../scripts/backup';
import { resolveDataDir, resolveProjectRoot } from '../src/utils/paths';

function files(nSqlite: number, nSha: number) {
    const out: Array<{ name: string; mtimeMs: number }> = [];
    for (let i = 0; i < nSqlite; i++) {
        out.push({ name: `backup_2026-01-01_${i}.sqlite`, mtimeMs: i });
        if (i < nSha) {
            out.push({ name: `backup_2026-01-01_${i}.sqlite.sha256`, mtimeMs: i });
        }
    }
    return out;
}

describe('P0.6 retencja backupu', () => {
    it('liczy wyłącznie .sqlite: 30 sqlite + 30 sha przy limicie 30 -> usuwa 0', () => {
        expect(selectBackupsForRetention(files(30, 30), 30)).toEqual([]);
    });

    it('32 sqlite + 32 sha przy limicie 30 -> usuwa dokładnie 2 najstarsze .sqlite', () => {
        expect(selectBackupsForRetention(files(32, 32), 30)).toEqual([
            'backup_2026-01-01_0.sqlite',
            'backup_2026-01-01_1.sqlite'
        ]);
    });

    it('same sidecary bez limitu przekroczenia -> brak usuwania sqlite', () => {
        expect(selectBackupsForRetention(files(10, 10), 30)).toEqual([]);
    });

    it('wykrywa sieroce sidecary (sha bez pary sqlite)', () => {
        expect(
            findOrphanSidecars([
                'backup_a.sqlite',
                'backup_a.sqlite.sha256',
                'backup_b.sqlite.sha256'
            ])
        ).toEqual(['backup_b.sqlite.sha256']);
    });
});

describe('P0.1 kontrakt ścieżki backupu', () => {
    // Regresja: path.resolve(__dirname, '../data/backups') po tsc wskazywał
    // dist/data/backups (mkdir -p tworzył zły katalog po cichu), podczas gdy
    // planRollback/restore szukały w data/backups. Test pinuje kontrakt:
    // backupDir == <root>/data/backups, nigdy pod dist/.
    it('getBackupDir() to <root>/data/backups (ten sam root co reszta aplikacji)', () => {
        expect(getBackupDir()).toBe(path.join(resolveDataDir(), 'backups'));
        expect(getBackupDir()).toBe(path.join(resolveProjectRoot(), 'data', 'backups'));
    });

    it('getBackupDir() jest absolutny i nigdy nie prowadzi przez dist/', () => {
        const dir = getBackupDir();
        expect(path.isAbsolute(dir)).toBe(true);
        expect(dir.split(path.sep)).not.toContain('dist');
        expect(dir.endsWith(`data${path.sep}backups`)).toBe(true);
    });
});
