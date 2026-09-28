#!/usr/bin/env node
// Weryfikacja generowania PDF po deploy: lekki check + próbny render.
// Użycie: node scripts/check-pdf.mjs (APP_URL lub http://127.0.0.1:3000)
// Publiczny /health/pdf zwraca wylacznie {status} (I-011).
// Smoke ?smoke=1 jest admin-only: skrypt loguje sie jako admin gdy haslo
// dostepne w env (SOK_ADMIN_PASSWORD || DEFAULT_ADMIN_PASSWORD);
// bez hasla smoke jest SKIPPED (exit 0, jawny komunikat), nie FAIL.
import core from './deploy-core.cjs';

const base = (process.env.APP_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');

async function fetchJson(url, opts = {}, timeoutMs = 20000) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
        const res = await fetch(url, { signal: ctrl.signal, ...opts });
        const body = await res.json().catch(() => ({}));
        return { status: res.status, body, headers: res.headers };
    } finally {
        clearTimeout(timer);
    }
}

const light = `${base}/health/pdf`;
if (!(await core.checkHealth(light, { retries: 6, intervalMs: 5000 }))) {
    const probe = await fetchJson(light);
    console.error(`[BLAD] /health/pdf nie odpowiada 200: ${light} (status=${probe.status})`);
    process.exit(1);
}
const info = await fetchJson(light);
console.log(`[OK] PDF health: status=${info.body.status}`);

const adminPassword = process.env.SOK_ADMIN_PASSWORD || process.env.DEFAULT_ADMIN_PASSWORD || '';
if (!adminPassword) {
    console.log('[SKIP] Smoke PDF pominięty — brak hasła admina w env (SOK_ADMIN_PASSWORD).');
    process.exit(0);
}
let cookie = '';
try {
    const loginRes = await fetch(`${base}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: adminPassword })
    });
    const setCookie = loginRes.headers.get('set-cookie') || '';
    const m = /authToken=([^;]+)/.exec(setCookie);
    if (loginRes.status !== 200 || !m) {
        console.log(
            `[SKIP] Smoke PDF pominięty — login admina nieudany (status=${loginRes.status}).`
        );
        process.exit(0);
    }
    cookie = `authToken=${m[1]}`;
} catch {
    console.log('[SKIP] Smoke PDF pominięty — login admina nieosiągalny.');
    process.exit(0);
}
const smoke = await fetchJson(`${base}/health/pdf?smoke=1`, { headers: { Cookie: cookie } }, 60000);
if (smoke.status !== 200 || !smoke.body.smoke?.ok) {
    console.error(`[BLAD] smoke-test PDF nieudany: status=${smoke.status}`);
    process.exit(1);
}
console.log(`[OK] Smoke PDF: ${smoke.body.smoke.bytes} bajtow`);
process.exit(0);
