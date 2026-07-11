import { validateEnv, getParsedEnv } from './envCheck';
import { initDatabase, DatabaseHealth } from './databaseCheck';
import { ensureAdminExists } from './adminCheck';
import { startupLogger } from './startupLogger';

export interface StartupReport {
    env: ReturnType<typeof getParsedEnv>;
    database: DatabaseHealth;
}

/**
 * Główna procedura startupowa — walidacja przed uruchomieniem serwera HTTP.
 * Kolejność:
 *   1. validateEnv() — sprawdza zmienne środowiskowe (Zod)
 *   2. initDatabase() — konfiguruje SQLite (WAL, busy_timeout, foreign_keys)
 *   3. ensureAdminExists() — weryfikuje/tworzy konto administratora
 *
 * Każdy krok rzuca błędem przy niepowodzeniu — startup nie przejdzie dalej.
 *
 * Zwraca StartupReport z parsowanym env i stanem bazy danych.
 * W przyszłości może być użyty do endpointów /health i /readiness.
 */
export async function runStartupChecks(): Promise<StartupReport> {
    startupLogger.section('WITROS Oferty PV — procedura startowa');

    // Krok 1: Środowisko
    startupLogger.step('Krok 1/3', 'Walidacja środowiska');
    const env = await validateEnv();
    startupLogger.value('Tryb', env.NODE_ENV);
    startupLogger.value('Port', env.PORT);
    startupLogger.value('Host', env.HOST);

    // Krok 2: Baza danych
    startupLogger.step('Krok 2/3', 'Inicjalizacja bazy danych');
    const database = await initDatabase();

    // Krok 3: Admin
    startupLogger.step('Krok 3/3', 'Konto administratora');
    await ensureAdminExists();

    // Podsumowanie
    startupLogger.section('Aplikacja uruchomiona pomyślnie');
    startupLogger.info('Baza danych:');
    startupLogger.value('WAL mode', database.walMode ? '✓' : '✗');
    startupLogger.value('Foreign keys', database.foreignKeys ? '✓' : '✗');
    startupLogger.value('busy_timeout', `${database.busyTimeout}ms`);
    startupLogger.valueLast('user_version', database.userVersion);
    startupLogger.info('');
    startupLogger.info('Środowisko:');
    startupLogger.value('NODE_ENV', env.NODE_ENV);
    startupLogger.value('Port', env.PORT);
    startupLogger.valueLast('Host', env.HOST);
    startupLogger.info('');
    startupLogger.info('Admin:');
    startupLogger.valueLast('Status', '✓');

    return { env, database };
}
