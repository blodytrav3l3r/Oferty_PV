import { execSync } from 'child_process';
import prisma from '../prismaClient';
import { startupLogger } from './startupLogger';

export interface DatabaseHealth {
    walMode: boolean;
    foreignKeys: boolean;
    busyTimeout: number;
    userVersion: number;
}

export async function initDatabase(): Promise<DatabaseHealth> {
    startupLogger.info('Inicjalizacja bazy danych SQLite...');

    // Auto-inicjalizacja — jeśli tabel nie ma, uruchom prisma db push
    try {
        await prisma.$queryRaw`SELECT COUNT(*) FROM ProductsRury LIMIT 1`;
    } catch {
        startupLogger.warn('Brak tabel — inicjalizacja schematu...');
        try {
            execSync('npx prisma db push --skip-generate', {
                cwd: process.cwd(),
                stdio: 'inherit'
            });
            startupLogger.success('Schemat załadowany');
        } catch (e) {
            throw new Error(
                'Auto-inicjalizacja bazy nie powiodła się. ' +
                    'Uruchom ręcznie: npm run setup\n' +
                    (e instanceof Error ? e.message : String(e))
            );
        }
    }

    startupLogger.info('Konfiguracja PRAGMA SQLite...');

    // Krok 1: Foreign keys — integralność relacyjna (przed WAL, bo dotyczy połączenia)
    const fkResult = await prisma.$queryRaw<Array<{ foreign_keys: number }>>`
        PRAGMA foreign_keys=ON;
    `;
    const foreignKeys = fkResult?.[0]?.foreign_keys === 1;
    if (!foreignKeys) {
        startupLogger.warn('foreign_keys — nie udało się włączyć');
    } else {
        startupLogger.success('foreign_keys — włączone');
    }

    // Krok 2: busy_timeout — limit oczekiwania na blokadę
    await prisma.$queryRaw`PRAGMA busy_timeout=5000;`;
    startupLogger.success('busy_timeout=5000ms');

    // Krok 3: synchronous=NORMAL — bezpieczny przy WAL, szybszy niż FULL
    await prisma.$queryRaw`PRAGMA synchronous=NORMAL;`;
    startupLogger.success('synchronous=NORMAL');

    // Krok 4: WAL mode — pozwala na równoczesny odczyt i zapis (ostatni, bo zmienia stan bazy)
    const walResult = await prisma.$queryRaw<Array<{ journal_mode: string }>>`
        PRAGMA journal_mode=WAL;
    `;
    const walMode = walResult?.[0]?.journal_mode?.toLowerCase() === 'wal';
    if (!walMode) {
        throw new Error('Nie udało się włączyć WAL mode dla SQLite');
    }
    startupLogger.success('WAL mode — włączony');

    // user_version — znacznik wersji bazy
    await prisma.$queryRaw`PRAGMA user_version = 20000;`;
    startupLogger.success('user_version = 20000');

    // Odczytaj potwierdzenie ustawień
    const timeoutResult = await prisma.$queryRaw<Array<{ busy_timeout: number }>>`
        PRAGMA busy_timeout;
    `;
    const busyTimeout = timeoutResult?.[0]?.busy_timeout ?? -1;
    const userVersionResult = await prisma.$queryRaw<Array<{ user_version: number }>>`
        PRAGMA user_version;
    `;
    const userVersion = userVersionResult?.[0]?.user_version ?? -1;

    return { walMode, foreignKeys, busyTimeout, userVersion };
}
