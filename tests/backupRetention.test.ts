import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
    selectBackupsForRetention,
    findOrphanSidecars,
    getBackupDir,
    canPruneOldBackups,
    classifyVerification,
    planRetention,
    MAX_BACKUPS,
    ensurePrivateBackupDirectory,
    createPrivateBackupArchive,
    verifyPrivateBackupArchive
} from '../scripts/backup';
import { resolveDataDir, resolveProjectRoot } from '../src/utils/paths';

function files(nDumps: number, nSha: number) {
    const out: Array<{ name: string; mtimeMs: number }> = [];
    for (let i = 0; i < nDumps; i++) {
        out.push({ name: `backup_2026-01-01_${i}.dump`, mtimeMs: i });
        if (i < nSha) {
            out.push({ name: `backup_2026-01-01_${i}.dump.sha256`, mtimeMs: i });
        }
    }
    return out;
}

describe('P0.6 retencja backupu', () => {
    it('limit retencji wynosi 1 sprawdzone archiwum', () => {
        expect(MAX_BACKUPS).toBe(1);
    });

    it('domyślny limit: 10 PostgreSQL -> zostaje tylko najnowsza', () => {
        const toDelete = selectBackupsForRetention(files(10, 10));
        expect(toDelete).toHaveLength(9);
        expect(toDelete).not.toContain('backup_2026-01-01_9.dump');
    });

    it('liczy wyłącznie .dump: 7 PostgreSQL + 7 sha przy limicie 7 -> usuwa 0', () => {
        expect(selectBackupsForRetention(files(7, 7), 7)).toEqual([]);
    });

    it('9 PostgreSQL + 9 sha przy limicie 7 -> usuwa dokładnie 2 najstarsze .dump', () => {
        expect(selectBackupsForRetention(files(9, 9), 7)).toEqual([
            'backup_2026-01-01_0.dump',
            'backup_2026-01-01_1.dump'
        ]);
    });

    it('same sidecary bez limitu przekroczenia -> brak usuwania PostgreSQL', () => {
        expect(selectBackupsForRetention(files(5, 5), 7)).toEqual([]);
    });

    it('wykrywa sieroce sidecary (sha bez pary PostgreSQL)', () => {
        expect(
            findOrphanSidecars(['backup_a.dump', 'backup_a.dump.sha256', 'backup_b.dump.sha256'])
        ).toEqual(['backup_b.dump.sha256']);
    });
});

describe('Bramka retencji: stare kopie zostają bez zweryfikowanego backupu', () => {
    it('tylko zweryfikowany backup pozwala na retencję', () => {
        expect(canPruneOldBackups('ok')).toBe(true);
        expect(canPruneOldBackups('corrupt')).toBe(false);
        expect(canPruneOldBackups('unverified')).toBe(false);
    });

    it('klasyfikuje błąd archiwum lub brak narzędzia walidacyjnego', () => {
        expect(classifyVerification('pg_restore: unsupported archive version')).toBe('corrupt');
        expect(classifyVerification('spawn pg_restore ENOENT')).toBe('unverified');
    });

    it('plan retencji: 10 kopii przy unverified -> nic nie usuwamy', () => {
        const plan = planRetention(files(10, 10), 'unverified');
        expect(plan.toDelete).toEqual([]);
    });

    it('plan retencji: 10 kopii przy corrupt -> nic nie usuwamy', () => {
        const plan = planRetention(files(10, 10), 'corrupt');
        expect(plan.toDelete).toEqual([]);
    });

    it('plan retencji: 10 kopii przy ok -> zostaje tylko najnowsza', () => {
        const plan = planRetention(files(10, 10), 'ok');
        expect(plan.toDelete).toHaveLength(9);
        expect(plan.toDelete).not.toContain('backup_2026-01-01_9.dump');
    });

    it('plan retencji: sieroty (sha bez pary PostgreSQL) sprzątane niezależnie od weryfikacji', () => {
        const plan = planRetention(
            [
                { name: 'backup_a.dump', mtimeMs: 1 },
                { name: 'backup_a.dump.sha256', mtimeMs: 1 },
                { name: 'backup_b.dump.sha256', mtimeMs: 2 }
            ],
            'unverified'
        );
        expect(plan.orphanSidecars).toEqual(['backup_b.dump.sha256']);
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

describe('Uprawnienia archiwów PostgreSQL', () => {
    it('tworzy katalog backupu prywatny dla właściciela i odrzuca symlink', () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sok-backup-permissions-'));
        const directory = path.join(root, 'backups');
        const target = path.join(root, 'target');
        fs.mkdirSync(target);
        try {
            ensurePrivateBackupDirectory(directory);
            expect(fs.statSync(directory).isDirectory()).toBe(true);
            if (process.platform !== 'win32') {
                fs.chmodSync(directory, 0o777);
                ensurePrivateBackupDirectory(directory);
                expect(fs.statSync(directory).mode & 0o077).toBe(0);
                fs.symlinkSync(target, path.join(root, 'link'), 'dir');
                expect(() => ensurePrivateBackupDirectory(path.join(root, 'link'))).toThrow(
                    /symbolic link/
                );
            }
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });

    it('tworzy nowe archiwum wyłącznie z prawami właściciela i naprawia zbyt szerokie prawa', () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sok-backup-archive-'));
        const archive = path.join(root, 'backup.dump');
        try {
            createPrivateBackupArchive(archive);
            fs.writeFileSync(archive, 'fixture', 'utf8');
            verifyPrivateBackupArchive(archive);
            if (process.platform !== 'win32') {
                expect(fs.statSync(archive).mode & 0o077).toBe(0);
                fs.chmodSync(archive, 0o644);
                verifyPrivateBackupArchive(archive);
                expect(fs.statSync(archive).mode & 0o077).toBe(0);
                const link = path.join(root, 'backup-link.dump');
                fs.symlinkSync(archive, link);
                expect(() => verifyPrivateBackupArchive(link)).toThrow(/regular file/);
            }
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });
});
