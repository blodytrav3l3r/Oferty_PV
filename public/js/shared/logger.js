/**
 * logger.js — Ustrukturyzowane logowanie dla frontendu.
 *
 * Zamiast ad-hoc console.* wywołań, używa się logger.debug/info/warn/error.
 * Wszystkie wpisy zawierają: poziom, timestamp, moduł, wiadomość.
 * W przyszłości można dodać wysyłkę do Sentry / backendu.
 *
 * Użycie:
 *   window.logger.info('offerManager', 'Oferta zapisana', { id, items });
 *   window.logger.error('wellSolver', 'Błąd backendu ML', err);
 */

(function () {
    const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
    const currentLevel = LOG_LEVELS.info;

    function formatTimestamp() {
        return new Date().toISOString().slice(11, 23);
    }

    function log(level, module, message, extra) {
        if (LOG_LEVELS[level] < currentLevel) return;
        const ts = formatTimestamp();
        const prefix = `[${ts}] [${level.toUpperCase()}] [${module}]`;
        if (extra instanceof Error) {
            console[level](prefix, message, extra.message, extra.stack);
        } else if (extra !== undefined) {
            console[level](prefix, message, extra);
        } else {
            console[level](prefix, message);
        }
    }

    window.logger = {
        debug: function (module, msg, extra) { log('debug', module, msg, extra); },
        info: function (module, msg, extra) { log('info', module, msg, extra); },
        warn: function (module, msg, extra) { log('warn', module, msg, extra); },
        error: function (module, msg, extra) { log('error', module, msg, extra); }
    };
})();
