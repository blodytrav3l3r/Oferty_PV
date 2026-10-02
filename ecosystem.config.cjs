// C2: PM2 — TYLKO Linux bare-metal (deploy: node scripts/deploy.mjs linux).
// Windows używa start.bat (watchdog), Docker — restart policy composa.
// Nie dokładać PM2 do kontenera ani na Windows (dublowanie nadzoru).
//
// Wartości z pomiarów S.O.K. (nie kopiowane z internetu):
// - fork ×1: ADR-012 single-process (SQLite jeden plik = jeden proces);
// - min_uptime 10s + max_restarts 10: crash loop staje po 10 szybkich
//   crashach; rzadkie crashe restartują w nieskończoność (jak watchdog);
// - max_memory_restart 1G: RSS ~200 MB + 2× Chromium ~500 MB + zapas;
//   siatka bezpieczeństwa przed OOM, nie ciasny limit;
// - kill_timeout 10s = SHUTDOWN_TIMEOUT_MS w server.ts (graceful shutdown).
module.exports = {
    apps: [
        {
            name: 'sok-oferty',
            script: 'dist/server.js',
            instances: 1,
            exec_mode: 'fork',
            env: {
                NODE_ENV: 'production'
            },
            autorestart: true,
            min_uptime: '10s',
            max_restarts: 10,
            max_memory_restart: '1G',
            kill_timeout: 10000,
            error_file: 'data/logs/pm2-error.log',
            out_file: 'data/logs/pm2-out.log',
            log_date_format: 'YYYY-MM-DD HH:mm:ss',
            merge_logs: true
        }
    ]
};
