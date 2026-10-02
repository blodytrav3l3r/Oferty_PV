#!/usr/bin/env node
// Alerting /metrics dla 100 userów: logowanie jako admin, pobranie snapshotu,
// progi ostrzegawcze. Exit 0 = OK, 1 = breach (do crona/CI).
// Użycie: node scripts/check-metrics-alerts.mjs [--base URL]
// Progi (B4, bez zmian wartości — tylko okno): delty busy/rejected od poprzedniego
// odczytu (plik stanu w os.tmpdir; pierwszy odczyt zapisuje i daje OK),
// absolutne: db.avgMs>100ms | loopLagMaxMs>500ms | rssMB>1024 |
// pdf.failed429/504/500>0 | audit.failures>0.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

function argValue(name) {
    const eq = process.argv.find((a) => a.startsWith(name + '='));
    if (eq) return eq.slice(name.length + 1);
    const i = process.argv.indexOf(name);
    if (i !== -1 && i + 1 < process.argv.length && !process.argv[i + 1].startsWith('--'))
        return process.argv[i + 1];
    return null;
}

const BASE = (process.env.BENCH_BASE_URL || argValue('--base') || 'http://localhost:3000').replace(
    /\/$/,
    ''
);
const TH = { dbAvgMs: 100, loopLagMaxMs: 500, rssMB: 1024 };

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
// B4: delty zamiast latch — liczniki kumulatywne od startu procesu.
let prev = null;
try {
    const stateFile = join(tmpdir(), 'sok-metrics-alerts.json');
    try {
        prev = JSON.parse(readFileSync(stateFile, 'utf8'));
    } catch {
        /* pierwszy odczyt */
    }
    writeFileSync(
        stateFile,
        JSON.stringify({
            busy: metrics.db?.busy ?? 0,
            rejected: metrics.ratelimit?.rejected ?? metrics.rateLimited?.rejected ?? 0,
            ts: Date.now()
        })
    );
} catch {
    /* brak tmp — fallback do absolutów */
}
const busyDelta = prev ? (metrics.db?.busy ?? 0) - (prev.busy ?? 0) : 0;
const rejectedDelta = prev
    ? (metrics.ratelimit?.rejected ?? metrics.rateLimited?.rejected ?? 0) - (prev.rejected ?? 0)
    : 0;
if (busyDelta > 0) breaches.push(`db.busyDelta=${busyDelta} (contention SQLite w oknie)`);
if (rejectedDelta > 0) breaches.push(`rateLimited.delta=${rejectedDelta} (429 w oknie)`);
if (metrics.db?.avgMs > TH.dbAvgMs) breaches.push(`db.avgMs=${metrics.db.avgMs} (>100ms)`);
if (metrics.loopLagMaxMs > TH.loopLagMaxMs)
    breaches.push(`loopLagMaxMs=${metrics.loopLagMaxMs} (>500ms)`);
if (metrics.rssMB > TH.rssMB) breaches.push(`rssMB=${metrics.rssMB} (>1024)`);
const pdf = metrics.pdf || {};
for (const k of ['failed429', 'failed504', 'failed500']) {
    if ((pdf[k] ?? 0) > 0) breaches.push(`pdf.${k}=${pdf[k]}`);
}
if ((metrics.audit?.failures ?? 0) > 0) breaches.push(`audit.failures=${metrics.audit.failures}`);
if ((metrics.fts?.failed ?? 0) > 0) breaches.push(`fts.failed=${metrics.fts.failed}`);
// Informacyjnie: top-3 endpointy p95 (bez progów — diagnostyka, nie bramka).
const eps = Object.entries(metrics.endpoints || {})
    .map(([k, v]) => ({ ep: k, p95: v?.p95 ?? 0, n: v?.n ?? 0 }))
    .sort((a, b) => b.p95 - a.p95)
    .slice(0, 3);

console.log(JSON.stringify({ ok: breaches.length === 0, breaches, slowTop3: eps }));
process.exit(breaches.length ? 1 : 0);
