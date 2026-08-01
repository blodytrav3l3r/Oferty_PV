/**
 * Serwer HTTP — punkt wejścia aplikacji
 * Importuje skonfigurowaną aplikację Express z src/app i uruchamia nasłuchiwanie.
 */
import app, { initApp } from './src/app';
import { logger } from './src/utils/logger';

const PORT = parseInt(process.env.PORT || '3000', 10);
// W produkcji domyślnie bind do loopback — HTTPS terminuje reverse proxy (Caddy/Nginx).
// Jawnie ustawiony HOST (np. w Dockerze dla osobnego kontenera proxy) ma pierwszeństwo.
const HOST = process.env.HOST || (process.env.NODE_ENV === 'production' ? '127.0.0.1' : '0.0.0.0');
const NODE_ENV = process.env.NODE_ENV || 'development';

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

    app.listen(PORT, HOST, () => {
        logger.info('Server', `WITROS Oferty — serwer działa na: http://localhost:${PORT}`);
        logger.info('Server', `Tryb: ${NODE_ENV === 'production' ? 'PRODUKCJA' : 'DEVELOPMENT'}`);
        logger.info('Server', 'Baza: SQLite (lokalna)');
    });
})();

/* ===== OBSŁUGA NIEOCZEKIWANYCH BŁĘDÓW ===== */
process.on('unhandledRejection', (reason: unknown) => {
    logger.error(
        'Server',
        'UnhandledRejection:',
        reason instanceof Error ? reason.message : String(reason)
    );
});

process.on('SIGTERM', () => {
    logger.info('Server', 'SIGTERM odebrany — zamykanie serwera...');
    process.exit(0);
});

export default app;
