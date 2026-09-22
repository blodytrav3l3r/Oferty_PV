#!/usr/bin/env node
// Weryfikacja generowania PDF po deploy: lekki check + próbny render.
// Użycie: node scripts/check-pdf.mjs (APP_URL lub http://127.0.0.1:3000)
import core from './deploy-core.cjs';

const base = (process.env.APP_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');

async function fetchJson(url, timeoutMs = 20000) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
        const res = await fetch(url, { signal: ctrl.signal });
        const body = await res.json().catch(() => ({}));
        return { status: res.status, body };
    } finally {
        clearTimeout(timer);
    }
}

const light = `${base}/health/pdf`;
if (!(await core.checkHealth(light, { retries: 6, intervalMs: 5000 }))) {
    console.error(`[BLAD] /health/pdf nie odpowiada 200: ${light}`);
    process.exit(1);
}
const info = await fetchJson(light);
console.log(
    `[OK] Chromium: found=${info.body.found} bin=${info.body.executableName} shmMb=${info.body.shmMb} user=${info.body.user}`
);

const smoke = await fetchJson(`${base}/health/pdf?smoke=1`, 60000);
if (smoke.status !== 200 || !smoke.body.smoke?.ok) {
    console.error(`[BLAD] smoke-test PDF nieudany: ${JSON.stringify(smoke.body).slice(0, 300)}`);
    process.exit(1);
}
console.log(`[OK] Smoke PDF: ${smoke.body.smoke.bytes} bajtow`);
process.exit(0);
