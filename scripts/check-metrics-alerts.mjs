#!/usr/bin/env node
// Alerting /metrics dla 100 userów: logowanie jako admin, pobranie snapshotu,
// progi ostrzegawcze. Exit 0 = OK, 1 = breach (do crona/CI).
// Użycie: node scripts/check-metrics-alerts.mjs [--base URL]
// Progi: db.busy>0 | db.avgMs>100ms | loopLagMaxMs>500ms | rssMB>1024 | rejected429>0
import { readFileSync } from 'node:fs';

const BASE = (process.env.BENCH_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const TH = { busy: 0, dbAvgMs: 100, loopLagMaxMs: 500, rssMB: 1024 };

function parseEnv(path) {
    const out = {};
    try {
        for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
            const m = line.match(/^([A-Z_]+)="?(.*?)"?\s*$/);
            if (m && m[1] !== 'DATABASE_URL') out[m[1]] = m[2];
        }
    } catch {}
    return out;
}

const env = parseEnv('.env');
const password = (env.DEFAULT_ADMIN_PASSWORD || process.env.DEFAULT_ADMIN_PASSWORD || '').trim();
if (!password) {
    console.error('[alerts] brak hasła admina (.env DEFAULT_ADMIN_PASSWORD)');
    process.exit(2);
}

const login = await fetch(BASE + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: BASE },
    body: JSON.stringify({ username: 'admin', password })
});
const cookie = login.headers.get('set-cookie') || '';
const m = /authToken=([^;]+)/.exec(cookie);
if (!m) {
    console.error(`[alerts] login HTTP ${login.status}`);
    process.exit(2);
}
const metrics = await (
    await fetch(BASE + '/metrics', { headers: { Cookie: `authToken=${m[1]}` } })
).json();

const breaches = [];
if (metrics.db?.busy > TH.busy) breaches.push(`db.busy=${metrics.db.busy} (>0: contention SQLite)`);
if (metrics.db?.avgMs > TH.dbAvgMs) breaches.push(`db.avgMs=${metrics.db.avgMs} (>100ms)`);
if (metrics.loopLagMaxMs > TH.loopLagMaxMs)
    breaches.push(`loopLagMaxMs=${metrics.loopLagMaxMs} (>500ms)`);
if (metrics.rssMB > TH.rssMB) breaches.push(`rssMB=${metrics.rssMB} (>1024)`);
const rejected = metrics.ratelimit?.rejected ?? metrics.rateLimited?.rejected ?? 0;
if (rejected > 0) breaches.push(`rateLimited.rejected=${rejected} (429 w oknie)`);

console.log(JSON.stringify({ ok: breaches.length === 0, breaches, metrics }));
process.exit(breaches.length ? 1 : 0);
