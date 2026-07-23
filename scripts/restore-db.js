/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const args = process.argv.slice(2);
if (args.length === 0) {
    console.error('Użycie: node scripts/restore-db.js <plik_backupu>');
    process.exit(1);
}
const sourcePath = path.resolve(args[0]);
const DB_PATH = path.resolve('data/app_database.sqlite');
if (!fs.existsSync(sourcePath)) {
    console.error(`Plik backupu nie istnieje: ${sourcePath}`);
    process.exit(1);
}
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.question(
    `Czy na pewno przywrócić backup ${sourcePath}? Obecna baza zostanie nadpisana. (tak/nie): `,
    (answer) => {
        rl.close();
        if (answer.toLowerCase() !== 'tak') {
            console.log('Anulowano.');
            process.exit(0);
        }
        fs.copyFileSync(sourcePath, DB_PATH);
        console.log(`Baza przywrocona z: ${sourcePath}`);
        console.log('[INFO] Synchronizuje schemat bazy...');
        try {
            require('child_process').execSync('npx prisma db push --skip-generate --accept-data-loss', {
                stdio: 'inherit',
                cwd: path.resolve(__dirname, '..')
            });
            console.log('[OK] Schemat zsynchronizowany.');
        } catch (e) {
            console.warn('[WARN] Nie udalo sie zsynchronizowac schematu.');
            console.warn('[WARN] Uruchom recznie: npx prisma db push --accept-data-loss');
        }
    }
);
