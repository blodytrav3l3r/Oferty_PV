#!/usr/bin/env node
// Baseline P0-I: steady (sekwencyjnie) + burst (współbieżnie) na żywym serwerze.
// Odczyty domyślnie; zapisy tylko z --writes (PUT+DELETE sprząta po sobie).
// Użycie: node scripts/benchmark-baseline.mjs [--writes] [próbki]
// Wynik: JSON na stdout (machine-readable) + tabela p50/p95/p99 na stderr.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const BASE = process.env.BENCH_BASE_URL || 'http://localhost:3000';
const SAMPLES = parseInt(process.argv.find((a) => /^\d+$/.test(a)) || '20', 10);
const WITH_WRITES = process.argv.includes('--writes');
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
        /* brak .env */
    }
    return out;
}

function pct(sorted, p) {
    if (!sorted.length) return 0;
    return sorted[
        Math.max(0, Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1))
    ];
}

async function timeFetch(url, opts, timeoutMs = 30000) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const start = process.hrtime.bigint();
    try {
        const res = await fetch(BASE + url, { ...opts, signal: ctrl.signal });
        const body = await res.text();
        return {
            ms: Number(process.hrtime.bigint() - start) / 1e6,
            status: res.status,
            bytes: body.length,
            body
        };
    } catch (e) {
        return {
            ms: Number(process.hrtime.bigint() - start) / 1e6,
            status: 0,
            bytes: 0,
            error: e.message
        };
    } finally {
        clearTimeout(t);
    }
}

function row(label, times) {
    const s = [...times].sort((a, b) => a - b);
    return {
        label,
        n: s.length,
        p50: +pct(s, 50).toFixed(1),
        p95: +pct(s, 95).toFixed(1),
        p99: +pct(s, 99).toFixed(1)
    };
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
        token = JSON.parse(login.body).token || '';
    } catch {
        /* ignore */
    }
    if (!token) {
        console.error(`[baseline] login HTTP ${login.status} — uruchom serwer`);
        process.exit(1);
    }
    const H = { 'Content-Type': 'application/json', 'X-Auth-Token': token };
    const out = { base: BASE, samples: SAMPLES, writes: WITH_WRITES, steady: [], burst: null };

    const steadyJobs = [
        [
            'GET /api/offers/search?q=',
            () => timeFetch('/api/offers/search?q=studnia&limit=20', { headers: H })
        ],
        [
            'GET /api/orders-studnie/production/index',
            () => timeFetch('/api/orders-studnie/production/index', { headers: H })
        ],
        ['GET /health/ready', () => timeFetch('/health/ready', {})]
    ];
    if (WITH_WRITES) {
        steadyJobs.push([
            'PUT+DELETE /api/offers-rury',
            async () => {
                const id = 'bench_' + Date.now() + '_' + Math.floor(Math.random() * 1e6);
                const doc = { id, status: 'draft', items: [], clientName: 'BENCH' };
                const put = await timeFetch('/api/offers-rury', {
                    method: 'PUT',
                    headers: H,
                    body: JSON.stringify({ data: [doc] })
                });
                if (put.status === 200)
                    await timeFetch('/api/offers-rury/' + id, { method: 'DELETE', headers: H });
                return put;
            }
        ]);
    }
    for (const [label, fn] of steadyJobs) {
        const times = [];
        let fails = 0;
        for (let i = 0; i < SAMPLES; i++) {
            const r = await fn();
            times.push(r.ms);
            if (r.status !== 200) fails++;
        }
        out.steady.push({ ...row(label, times), fails });
    }

    // Burst 5–10 s: 25 search + 10 index + 5 ready (+ 5 PUT/DELETE gdy --writes).
    const burstFns = [];
    for (let i = 0; i < 25; i++)
        burstFns.push(() => timeFetch('/api/offers/search?q=studnia&limit=20', { headers: H }));
    for (let i = 0; i < 10; i++)
        burstFns.push(() => timeFetch('/api/orders-studnie/production/index', { headers: H }));
    for (let i = 0; i < 5; i++) burstFns.push(() => timeFetch('/health/ready', {}));
    if (WITH_WRITES) {
        for (let i = 0; i < 5; i++) {
            burstFns.push(async () => {
                const id = 'benchb_' + Date.now() + '_' + i + '_' + Math.floor(Math.random() * 1e6);
                const put = await timeFetch('/api/offers-rury', {
                    method: 'PUT',
                    headers: H,
                    body: JSON.stringify({
                        data: [{ id, status: 'draft', items: [], clientName: 'BENCH' }]
                    })
                });
                if (put.status === 200)
                    await timeFetch('/api/offers-rury/' + id, { method: 'DELETE', headers: H });
                return put;
            });
        }
    }
    const bStart = process.hrtime.bigint();
    const bRes = await Promise.all(burstFns.map((fn) => fn()));
    const wallMs = Number(process.hrtime.bigint() - bStart) / 1e6;
    const statusHist = {};
    const errSample = [];
    for (const r of bRes) {
        statusHist[r.status] = (statusHist[r.status] || 0) + 1;
        if (r.status !== 200 && errSample.length < 3)
            errSample.push((r.body || r.error || '').slice(0, 200));
    }
    out.burst = {
        ...row(
            'BURST mieszany',
            bRes.map((r) => r.ms)
        ),
        wallMs: +wallMs.toFixed(0),
        fails: bRes.filter((r) => r.status !== 200).length,
        reqs: bRes.length,
        statusHist,
        errSample
    };

    for (const s of out.steady)
        console.error(
            `${s.label.padEnd(42)} p50=${s.p50}ms p95=${s.p95}ms p99=${s.p99}ms fails=${s.fails}`
        );
    const b = out.burst;
    console.error(
        `BURST wall=${b.wallMs}ms p50=${b.p50}ms p95=${b.p95}ms p99=${b.p99}ms fails=${b.fails}/${b.reqs}`
    );
    console.log(JSON.stringify(out));
}

main().catch((e) => {
    console.error('[baseline] Błąd:', e.message);
    process.exit(1);
});
