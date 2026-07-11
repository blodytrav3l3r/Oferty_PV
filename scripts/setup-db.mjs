import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const dbPath = resolve(root, 'data/app_database.sqlite');
const dbExists = existsSync(dbPath);

console.log('');
console.log('=== WITROS Oferty — Setup bazy danych ===');
console.log('');

if (dbExists) {
    console.log('Baza istnieje: ' + dbPath);
    console.log('Aktualizuję schemat...');
} else {
    console.log('Tworzę nową bazę: ' + dbPath);
}

console.log('');

try {
    console.log('[1/2] Synchronizacja schematu (prisma db push)...');
    execSync('npx prisma db push', { cwd: root, stdio: 'inherit' });
    console.log('');

    console.log('[2/2] Seed danych...');
    try {
        execSync('npx prisma db seed', { cwd: root, stdio: 'inherit' });
        console.log('');
        console.log('✓ Seed zakończony');
    } catch (seedErr) {
        console.log('');
        console.log('⚠ Seed nie powiódł się (baza ma schemat, ale brak danych początkowych).');
        console.log('  Aplikacja uruchomi się, ale może wymagać ręcznego dodania produktów.');
        console.log('  Błąd: ' + (seedErr instanceof Error ? seedErr.message : String(seedErr)));
    }

    console.log('');
    console.log('✓ Baza gotowa!');
    console.log('');
} catch (err) {
    console.error('');
    console.error('✗ Błąd krytyczny:');
    console.error(err instanceof Error ? err.message : String(err));
    console.error('');
    console.error('Sprawdź:');
    console.error('  1. .env istnieje (kopiuj z .env.example)');
    console.error('  2. DATABASE_URL w .env jest poprawna');
    console.error('  3. node_modules zainstalowane (npm install)');
    console.error('');
    process.exit(1);
}
