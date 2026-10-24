/**
 * /health/backup — kontrakt statusu: 200 przy świeżej kopii, 503 przy braku
 * lub przestarzałej. Logika świeżości ma własne testy (backupFreshness.test.ts);
 * tutaj pinujemy wyłącznie mapowanie na kody HTTP.
 */
import request from 'supertest';

jest.mock('../scripts/backup', () => ({
    ...jest.requireActual('../scripts/backup'),
    readBackupMarker: jest.fn(),
    isBackupStale: jest.fn()
}));

import app from '../src/app';
import { readBackupMarker, isBackupStale } from '../scripts/backup';

const mockedRead = readBackupMarker as jest.MockedFunction<typeof readBackupMarker>;
const mockedStale = isBackupStale as jest.MockedFunction<typeof isBackupStale>;

describe('GET /health/backup', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('świeża kopia → 200 z wiekiem i nazwą pliku', async () => {
        mockedRead.mockReturnValue({
            at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
            file: 'backup_2026-01-01_1.sqlite',
            size: 1024,
            sha256: 'abc',
            verification: 'ok'
        });
        mockedStale.mockReturnValue(false);

        const res = await request(app).get('/health/backup');

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('ok');
        expect(res.body.ageHours).toBeGreaterThan(0);
        expect(res.body.file).toBe('backup_2026-01-01_1.sqlite');
        expect(res.body.maxAgeHours).toBe(26);
    });

    it('brak markera → 503 stale bez wieku', async () => {
        mockedRead.mockReturnValue(null);
        mockedStale.mockReturnValue(true);

        const res = await request(app).get('/health/backup');

        expect(res.status).toBe(503);
        expect(res.body.status).toBe('stale');
        expect(res.body.ageHours).toBeNull();
        expect(res.body.lastBackupAt).toBeNull();
    });

    it('kopia starsza niż limit → 503', async () => {
        mockedRead.mockReturnValue({
            at: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
            file: 'backup_2026-01-01_1.sqlite',
            size: 1024,
            sha256: 'abc',
            verification: 'ok'
        });
        mockedStale.mockReturnValue(true);

        const res = await request(app).get('/health/backup');

        expect(res.status).toBe(503);
        expect(res.body.status).toBe('stale');
        expect(res.body.ageHours).toBeGreaterThanOrEqual(48);
    });
});
