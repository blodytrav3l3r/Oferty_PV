#!/usr/bin/env node
// Benchmark wydajności (Faza 5.1 planu): mierzy p50/p95/p99 dla kluczowych endpointów.
// Wymaga działającego serwera (npm run dev) — loguje się kontem z .env.
// Użycie: node scripts/benchmark.mjs [liczba_próbek]
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const BASE = process.env.BENCH_BASE_URL || 'http://localhost:3000';
const SAMPLES = parseInt(process.argv[2] || '20', 10);
const ADMIN_PASSWORD = (process.env.DEFAULT_ADMIN_PASSWORD || 'anim123456').trim();

function parseEnv(path) {
    const out = {};
    try {
        const txt = readFileSync(path, 'utf8');
        for (const line of txt.split(/\r?\n/)) {
            const m = line.match(/^([A-Z_]+)="?(.*?)"?\s*$/);
            if (m && m[1] && m[1] !== 'DATABASE_URL') out[m[1]] = m[2];
        }
    } catch {
        /* brak .env — użyj domyślnych */
    }
    return out;
}

function pct(sorted, p) {
    if (sorted.length === 0) return 0;
    const idx = Math.max(0, Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1));
    return sorted[idx];
}

async function timeFetch(url, opts) {
    const start = process.hrtime.bigint();
    const res = await fetch(BASE + url, opts);
    const body = await res.text();
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    return { ms, status: res.status, body, bytes: body.length };
}

function summarize(label, times) {
    const sorted = [...times].sort((a, b) => a - b);
    console.log(
        `${label.padEnd(28)} p50=${pct(sorted, 50).toFixed(1).padStart(7)}ms ` +
            `p95=${pct(sorted, 95).toFixed(1).padStart(7)}ms ` +
            `p99=${pct(sorted, 99).toFixed(1).padStart(7)}ms  n=${sorted.length}`
    );
}

async function main() {
    const env = parseEnv(resolve('.env'));
    const password = (env.DEFAULT_ADMIN_PASSWORD || ADMIN_PASSWORD).trim();

    const login = await timeFetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password })
    });
    let token = '';
    try {
        token = JSON.parse(login.body).token || JSON.parse(login.body).data?.token || '';
    } catch {
        /* niepoprawna odpowiedź */
    }
    if (!token) {
        console.error(
            `[benchmark] Logowanie nie powiodło się (HTTP ${login.status}). Uruchom serwer i sprawdź .env.`
        );
        process.exit(1);
    }
    const H = { 'Content-Type': 'application/json', 'X-Auth-Token': token };
    const loginTime = [login.ms];
    const results = { login: loginTime };

    // 1. Search ofert (kartoteka) — GET /api/offers?q=
    const search = [];
    for (let i = 0; i < SAMPLES; i++) {
        const r = await timeFetch('/api/offers?q=studnia&limit=20', { headers: H });
        search.push(r.ms);
    }
    results.search = search;

    // 2. Zapis oferty rur — PUT /api/offers-rury (payload jak z frontendu: { data: [offer] })
    const offerDoc = {
        id: 'bench_' + Date.now(),
        status: 'draft',
        items: [],
        clientName: 'BENCHMARK',
        investName: 'BENCHMARK',
        investAddress: 'BENCHMARK',
        investContractor: 'BENCHMARK'
    };
    const save = [];
    for (let i = 0; i < SAMPLES; i++) {
        const r = await timeFetch('/api/offers-rury', {
            method: 'PUT',
            headers: H,
            body: JSON.stringify({ data: [offerDoc] })
        });
        save.push(r.ms);
    }
    results.saveOffer = save;

    // 3. Polling telemetry AI (studnie) — GET /api/telemetry/ai/status
    const telemetry = [];
    for (let i = 0; i < SAMPLES; i++) {
        const r = await timeFetch('/api/telemetry/ai/status', { headers: H });
        telemetry.push(r.ms);
    }
    results.telemetry = telemetry;

    console.log('');
    summarize('login /api/auth/login', results.login);
    summarize('search /api/offers?q=', results.search);
    summarize('save offer /api/offers-rury (PUT)', results.saveOffer);
    summarize('telemetry /api/telemetry/ai/status', results.telemetry);

    const total = [...results.search, ...results.saveOffer, ...results.telemetry];
    const allSorted = [...total].sort((a, b) => a - b);
    console.log('');
    console.log(
        `AGGREGATE p50=${pct(allSorted, 50).toFixed(1)}ms p95=${pct(allSorted, 95).toFixed(1)}ms p99=${pct(allSorted, 99).toFixed(1)}ms`
    );
    console.log(`[benchmark] Uwaga: zapisano ${SAMPLES} ofert bench_* (usuń ręcznie w bazie).`);
}

main().catch((e) => {
    console.error('[benchmark] Błąd:', e.message);
    process.exit(1);
});
