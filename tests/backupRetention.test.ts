import * as path from 'path';
import {
    selectBackupsForRetention,
    findOrphanSidecars,
    getBackupDir,
    canPruneOldBackups,
    classifyVerification,
    planRetention,
    MAX_BACKUPS
} from '../scripts/backup';
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
    it('limit retencji to 7 kopii (dysk: 30 kopii ~= 37 GB)', () => {
        expect(MAX_BACKUPS).toBe(7);
    });

    it('domyślny limit: 10 sqlite -> usuwa 3 najstarsze', () => {
        expect(selectBackupsForRetention(files(10, 10))).toEqual([
            'backup_2026-01-01_0.sqlite',
            'backup_2026-01-01_1.sqlite',
            'backup_2026-01-01_2.sqlite'
        ]);
    });

    it('liczy wyłącznie .sqlite: 7 sqlite + 7 sha przy limicie 7 -> usuwa 0', () => {
        expect(selectBackupsForRetention(files(7, 7), 7)).toEqual([]);
    });

    it('9 sqlite + 9 sha przy limicie 7 -> usuwa dokładnie 2 najstarsze .sqlite', () => {
        expect(selectBackupsForRetention(files(9, 9), 7)).toEqual([
            'backup_2026-01-01_0.sqlite',
            'backup_2026-01-01_1.sqlite'
        ]);
    });

    it('same sidecary bez limitu przekroczenia -> brak usuwania sqlite', () => {
        expect(selectBackupsForRetention(files(5, 5), 7)).toEqual([]);
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

describe('Bramka retencji: stare kopie zostają bez zweryfikowanego backupu', () => {
    it('tylko zweryfikowany backup pozwala na retencję', () => {
        expect(canPruneOldBackups('ok')).toBe(true);
        expect(canPruneOldBackups('corrupt')).toBe(false);
        expect(canPruneOldBackups('unverified')).toBe(false);
    });

    it('klasyfikuje błąd: integralność -> corrupt, brak możliwości sprawdzenia -> unverified', () => {
        expect(classifyVerification('integrity_check: database disk image is malformed')).toBe(
            'corrupt'
        );
        expect(classifyVerification('EBUSY: resource busy or locked')).toBe('unverified');
    });

    it('plan retencji: 10 kopii przy unverified -> nic nie usuwamy', () => {
        const plan = planRetention(files(10, 10), 'unverified');
        expect(plan.toDelete).toEqual([]);
    });

    it('plan retencji: 10 kopii przy corrupt -> nic nie usuwamy', () => {
        const plan = planRetention(files(10, 10), 'corrupt');
        expect(plan.toDelete).toEqual([]);
    });

    it('plan retencji: 10 kopii przy ok -> usuwa 3 najstarsze', () => {
        const plan = planRetention(files(10, 10), 'ok');
        expect(plan.toDelete).toEqual([
            'backup_2026-01-01_0.sqlite',
            'backup_2026-01-01_1.sqlite',
            'backup_2026-01-01_2.sqlite'
        ]);
    });

    it('plan retencji: sieroty (sha bez pary sqlite) sprzątane niezależnie od weryfikacji', () => {
        const plan = planRetention(
            [
                { name: 'backup_a.sqlite', mtimeMs: 1 },
                { name: 'backup_a.sqlite.sha256', mtimeMs: 1 },
                { name: 'backup_b.sqlite.sha256', mtimeMs: 2 }
            ],
            'unverified'
        );
        expect(plan.orphanSidecars).toEqual(['backup_b.sqlite.sha256']);
        expect(plan.toDelete).toEqual([]);
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
