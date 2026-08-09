// Wczytaj zmienne środowiskowe NAJWCZEŚNIEJ — importowane moduły mogą czytać process.env na starcie.
import 'dotenv/config';

/**
 * Serwer HTTP — punkt wejścia aplikacji
 * Importuje skonfigurowaną aplikację Express z src/app i uruchamia nasłuchiwanie.
 */
import app, { initApp } from './src/app';
import { logger } from './src/utils/logger';
import { cronService } from './src/utils/cronService';
import prisma from './src/prismaClient';

const PORT = parseInt(process.env.PORT || '3000', 10);
// W produkcji domyślnie bind do loopback — HTTPS terminuje reverse proxy (Caddy/Nginx).
// Jawnie ustawiony HOST (np. w Dockerze dla osobnego kontenera proxy) ma pierwszeństwo.
const HOST = process.env.HOST || (process.env.NODE_ENV === 'production' ? '127.0.0.1' : '0.0.0.0');
const NODE_ENV = process.env.NODE_ENV || 'development';
const SHUTDOWN_TIMEOUT_MS = 10_000;

/* ===== OBSŁUGA NIEOCZEKIWANYCH BŁĘDÓW ===== */
process.on('unhandledRejection', (reason: unknown) => {
    logger.error(
        'Server',
        'UnhandledRejection:',
        reason instanceof Error ? reason.message : String(reason)
    );
    // Oznacz proces do wyjścia z kodem błędu zamiast cichego maskowania problemu.
    process.exitCode = 1;
});

/* ===== INICJALIZACJA ===== */
(async function startServer() {
    try {
        await initApp();
    } catch (err) {
        logger.error(
            'Server',
            'Błąd inicjalizacji aplikacji:',
            err instanceof Error ? err.message : String(err)
        );
        process.exit(1);
    }

    const server = app.listen(PORT, HOST, () => {
        logger.info('Server', `S.O.K. — serwer działa na: http://localhost:${PORT}`);
        logger.info('Server', `Tryb: ${NODE_ENV === 'production' ? 'PRODUKCJA' : 'DEVELOPMENT'}`);
        logger.info('Server', 'Baza: SQLite (lokalna)');
    });

    // EADDRINUSE — czytelny komunikat PL zamiast surowego stack trace.
    server.on('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE') {
            logger.error(
                'Server',
                `Port ${PORT} jest już zajęty. Zatrzymaj proces używający portu ${PORT} lub ustaw inny PORT w .env i uruchom ponownie.`
            );
            process.exit(1);
        }
        logger.error('Server', `Błąd serwera: ${err.message}`);
        process.exit(1);
    });

    /* ===== GRACEFUL SHUTDOWN ===== */
    const gracefulShutdown = async (): Promise<void> => {
        try {
            cronService.shutdown();
        } catch (err) {
            logger.warn(
                'Server',
                'Błąd przy zamykaniu CronService:',
                err instanceof Error ? err.message : String(err)
            );
        }
        try {
            await prisma.$disconnect();
        } catch (err) {
            logger.warn(
                'Server',
                'Błąd przy rozłączaniu Prisma:',
                err instanceof Error ? err.message : String(err)
            );
        }
        logger.info('Server', 'Zamknięto serwer. Do widzenia.');
        process.exit(0);
    };

    const shutdown = (signal: string): void => {
        logger.info('Server', `${signal} odebrany — zamykanie serwera...`);

        // Awaryjny timeout — wymuś exit, jeśli graceful shutdown się zawiesi.
        const forceTimer = setTimeout(() => {
            logger.error('Server', 'Przekroczono limit graceful shutdown — wymuszam exit.');
            process.exit(1);
        }, SHUTDOWN_TIMEOUT_MS);
        forceTimer.unref();

        const finish = (): void => {
            void gracefulShutdown();
        };
        try {
            server.close(finish);
        } catch {
            // Serwer nie zdążył wystartować — nie ma połączeń do domknięcia.
            finish();
        }
        // Node >= 18.2: domyka otwarte połączenia keep-alive (np. z przeglądarek).
        if (typeof server.closeIdleConnections === 'function') {
            server.closeIdleConnections();
        }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
})();

export default app;
