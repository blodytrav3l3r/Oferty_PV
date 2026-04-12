import fs from 'fs';
import path from 'path';

const dbPath = path.resolve(__dirname, '../data/app_database.sqlite');
const backupDir = path.resolve(__dirname, '../data/backups');

if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
}

const date = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
const backupName = `backup_${date}_${Date.now()}.sqlite`;
const backupPath = path.join(backupDir, backupName);

try {
    fs.copyFileSync(dbPath, backupPath);
    console.log(`[Kopia Zapasowa] Kopia utworzona pomyślnie: ${backupPath}`);

    const files = fs.readdirSync(backupDir);
    // Zachowaj tylko pliki zaczynające się od 'backup_' i posortuj je
    const backups = files.filter((f) => f.startsWith('backup_')).sort();

    const MAX_BACKUPS = 30;
    while (backups.length > MAX_BACKUPS) {
        const toDelete = backups.shift();
        if (toDelete) {
            fs.unlinkSync(path.join(backupDir, toDelete));
            console.log(`[Kopia Zapasowa] Usunięto starą kopię: ${toDelete}`);
        }
    }

    console.log(`[Kopia Zapasowa] Całkowita liczba kopii: ${backups.length}`);
} catch (error: any) {
    console.error('[Kopia Zapasowa] Błąd:', error.message);
    process.exit(1);
}
