import { selectBackupsForRetention, findOrphanSidecars } from '../scripts/backup';

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
