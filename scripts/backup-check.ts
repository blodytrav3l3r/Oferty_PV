/**
 * Monitoring świeżości backupu — bramka dla zewnętrznego monitoringu.
 *
 * Czyta wyłącznie marker zapisany przez `runBackup` (`.last-backup.json`),
 * nie dotyka bazy i nie tworzy kopii. Exit 0 = świeżo, exit 1 = brak lub
 * przestarzały (> `MAX_BACKUP_AGE_MS`).
 *
 * Opcjonalny alert: gdy `BACKUP_ALERT_WEBHOOK` jest ustawione i check zawiedzie,
 * wysyła POST z raportem (ntfy.sh / Telegram / dowolny webhook). Brak zmiennej
 * = cisza, zero ruchu sieciowego.
 */
import { getBackupMarkerPath, isBackupStale, readBackupMarker, MAX_BACKUP_AGE_MS } from './backup';

const HOUR_MS = 60 * 60 * 1000;

async function sendAlert(payload: unknown): Promise<void> {
    const url = process.env.BACKUP_ALERT_WEBHOOK;
    if (!url) return;
    try {
        await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        console.log('[backup:check] Alert wysłany');
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`[backup:check] Alert nie doszedł: ${msg}`);
    }
}

async function main(): Promise<void> {
    const now = Date.now();
    const marker = readBackupMarker();
    const stale = isBackupStale(marker, now);
    const at = marker ? Date.parse(marker.at) : NaN;

    const report = {
        ok: !stale,
        ageHours: Number.isFinite(at) ? Math.round(((now - at) / HOUR_MS) * 10) / 10 : null,
        maxAgeHours: MAX_BACKUP_AGE_MS / HOUR_MS,
        markerPath: getBackupMarkerPath(),
        marker
    };

    console.log(JSON.stringify(report, null, 2));

    if (!stale) return;

    console.error(
        marker
            ? `[backup:check] FAIL — ostatni backup starszy niż ${report.maxAgeHours} h`
            : '[backup:check] FAIL — brak markera, backup nigdy nie potwierdził sukcesu'
    );
    process.exitCode = 1;
    await sendAlert({ text: 'SOK: backup bazy nieświeży', report });
}

main();
