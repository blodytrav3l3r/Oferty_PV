import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
    isBackupStale,
    readBackupMarker,
    getBackupMarkerPath,
    MAX_BACKUP_AGE_MS,
    type BackupMarker
} from '../scripts/backup';

function markerAt(iso: string): BackupMarker {
    return {
        at: iso,
        file: 'backup_2026-01-01_1.sqlite',
        size: 1024,
        sha256: 'abc',
        verification: 'ok'
    };
}

describe('Monitoring świeżości backupu', () => {
    const now = Date.parse('2026-10-24T12:00:00.000Z');

    it('świeży marker (2 h) nie jest przestarzały', () => {
        expect(isBackupStale(markerAt('2026-10-24T10:00:00.000Z'), now)).toBe(false);
    });

    it('marker starszy niż 26 h jest przestarzały', () => {
        expect(isBackupStale(markerAt('2026-10-23T09:00:00.000Z'), now)).toBe(true);
    });

    it('granica dokładnie 26 h liczy się jako przestarzała', () => {
        const at = new Date(now - MAX_BACKUP_AGE_MS).toISOString();
        expect(isBackupStale(markerAt(at), now)).toBe(true);
    });

    it('brak markera = przestarzały (nie wiemy, czy kopia istnieje)', () => {
        expect(isBackupStale(null, now)).toBe(true);
    });

    it('marker z nieparsowalną datą = przestarzały', () => {
        expect(isBackupStale(markerAt('nie-data'), now)).toBe(true);
    });

    it('uszkodzony JSON markera → readBackupMarker zwraca null, bez wyjątku', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sok-backup-marker-'));
        try {
            fs.writeFileSync(getBackupMarkerPath(dir), '{ to nie jest json', 'utf8');
            expect(readBackupMarker(dir)).toBeNull();
            expect(isBackupStale(readBackupMarker(dir), now)).toBe(true);
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });

    it('poprawny marker jest odczytywany z katalogu', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sok-backup-marker-'));
        try {
            const marker = markerAt('2026-10-24T11:30:00.000Z');
            fs.writeFileSync(getBackupMarkerPath(dir), JSON.stringify(marker), 'utf8');
            expect(readBackupMarker(dir)).toEqual(marker);
            expect(isBackupStale(readBackupMarker(dir), now)).toBe(false);
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });
});
