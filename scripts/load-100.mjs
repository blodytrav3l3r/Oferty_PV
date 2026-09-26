#!/usr/bin/env node
// P1-F: realistyczny load-test 100 userów na żywym serwerze (dev).
// Każdy wirtualny user ma własne IP (X-Forwarded-For, trust proxy=1) —
// limitery są per-IP, więc 1 maszyna symuluje 100 różnych klientów.
// Tempo realistyczne: odczyty co 5-15 s, zapisy co 5-15 s (limity: api 300/15min,
// write 60/min, export 20/min na IP). Spike mierzy faza burst (100× one-shot).
// Wszystkie zapisy samosprzątające (PUT+DELETE, claim+recycle).
// Użycie: node scripts/load-100.mjs [--quick] [--sustained] [--users N] [--base URL]
// Wynik: JSON na stdout + tabela na stderr; exit 0 = DoD PASS, 1 = FAIL.
// Warianty: --quick do CI przy każdym pushu; --sustained tylko
// workflow_dispatch/nightly (opis w docs/plans/archive/e3-perf.md).
import { readFileSync } from 'node:fs';

// Pobiera wartość flagi w formach --flaga=wartosc i --flaga wartosc.
function argValue(name) {
    const eq = process.argv.find((a) => a.startsWith(name + '='));
    if (eq) return eq.slice(name.length + 1);
    const i = process.argv.indexOf(name);
    if (i !== -1 && i + 1 < process.argv.length && !process.argv[i + 1].startsWith('--'))
        return process.argv[i + 1];
    return null;
}

if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log(
        [
            'Użycie: node scripts/load-100.mjs [--quick] [--sustained] [--users N] [--base URL]',
            '  --quick      faza steady 60 s (domyślnie 300 s); wariant do CI przy pushu',
            '  --sustained  faza steady ~15 min (900 s); TYLKO workflow_dispatch/nightly',
            '  --users N    liczba wirtualnych userów (domyślnie 100); dla 100 podział',
            '               workerów identyczny jak historycznie (80/15/3 + claim + PDF)',
            '  --base URL   bazowy URL serwera (też BENCH_BASE_URL); formy --base=URL i --base URL',
            '  --help, -h   ta pomoc (działa bez serwera)'
        ].join('\n')
    );
    process.exit(0);
}

const BASE = process.env.BENCH_BASE_URL || argValue('--base') || 'http://localhost:3000';
const QUICK = process.argv.includes('--quick');
const SUSTAINED = process.argv.includes('--sustained');
const USERS_RAW = argValue('--users');
let USERS = 100;
if (USERS_RAW !== null) {
    USERS = parseInt(USERS_RAW, 10);
    if (!Number.isInteger(USERS) || USERS < 1) {
        console.error(
            `[load-100] Błąd: --users wymaga liczby całkowitej >= 1 (dano: ${USERS_RAW})`
        );
        process.exit(2);
    }
}
// --sustained wygrywa z --quick (celowo dłuższy pomiar ma pierwszeństwo).
const STEADY_MS = SUSTAINED ? 900_000 : QUICK ? 60_000 : 300_000;
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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const ipOf = (i) => `10.99.${Math.floor(i / 250) + 1}.${(i % 250) + 1}`;

// Podział workerów fazy steady w proporcjach historycznych dla 100 userów:
// 80 czytelników / 15 piszących / 3 batchujące + 1 claim + 1 PDF.
// Dla total=100 wynik to dokładnie {80, 15, 3, 1, 1} (wsteczna kompatybilność);
// mniejsze N skaluje proporcjonalnie (reszta z dzieleń trafia do czytelników).
function splitUsers(total) {
    if (total <= 1) return { readers: total, writers: 0, batchers: 0, claim: 0, pdf: 0 };
    if (total < 10) return { readers: total - 1, writers: 0, batchers: 0, claim: 1, pdf: 0 };
    const rest = total - 2; // slot claim + slot PDF
    let readers = Math.floor((rest * 80) / 98);
    let writers = Math.floor((rest * 15) / 98);
    let batchers = Math.floor((rest * 3) / 98);
    if (total >= 25 && batchers === 0) {
        batchers = 1;
        readers -= 1;
    }
    let remainder = rest - readers - writers - batchers;
    while (remainder-- > 0) readers++;
    return { readers, writers, batchers, claim: 1, pdf: 1 };
}

// Podział burstów: historycznie 55 search / 20 production-index / 10 write /
// 5 claim / 5 health + 2 PDF + dopełnienie health do N.
function splitBurst(total, hasPdf) {
    const readB = Math.round(total * 0.55);
    const prodB = Math.round(total * 0.2);
    const writeB = Math.round(total * 0.1);
    const claimB = Math.round(total * 0.05);
    const pdfB = !hasPdf ? 0 : total >= 50 ? 2 : total >= 10 ? 1 : 0;
    const healthB = Math.max(0, total - readB - prodB - writeB - claimB - pdfB);
    return { readB, prodB, writeB, claimB, pdfB, healthB };
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
            body,
            setCookie: res.headers.get('set-cookie'),
            url: `${opts?.method || 'GET'} ${url}`,
            retryAfter: res.headers.get('retry-after')
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

// 429 = backpressure (ochrona działa): odczekaj Retry-After i powtórz raz.
async function withBackoff(fn) {
    const r = await fn();
    if (r.status === 429) {
        const wait = Math.min(10000, (parseInt(r.retryAfter || '2', 10) || 2) * 1000);
        await sleep(wait);
        const r2 = await fn();
        return { ...r2, throttled: true };
    }
    return r;
}

const stats = [];
function rec(op, r) {
    stats.push({
        op,
        ms: r.ms,
        status: r.status,
        throttled: !!r.throttled,
        url: r.url || '',
        body: r.status !== 200 ? `${r.url || ''} :: ${(r.body || r.error || '').slice(0, 200)}` : ''
    });
}

async function main() {
    const env = parseEnv('I:\\GitHub\\Oferty_PV\\.env');
    const password = (env.DEFAULT_ADMIN_PASSWORD || ADMIN_PASSWORD).trim();
    const login = await timeFetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '10.99.0.1' },
        body: JSON.stringify({ username: 'admin', password })
    });
    let token = '';
    try {
        const m = /authToken=([^;]+)/.exec(login.setCookie || '');
        token = m ? m[1] : '';
    } catch {
        /* ignore */
    }
    if (!token) {
        console.error(`[load-100] login HTTP ${login.status} — uruchom serwer`);
        process.exit(1);
    }
    const H = (i) => ({
        'Content-Type': 'application/json',
        Cookie: `authToken=${token}`,
        'X-Forwarded-For': ipOf(i)
    });
    const me = await timeFetch('/api/auth/me', { headers: H(0) });
    const adminId = JSON.parse(me.body)?.user?.id || '';
    const metrics0 = await (
        await fetch(BASE + '/metrics', { headers: H(0) })
    )
        .json()
        .catch(() => null);

    const searchPdf = await timeFetch('/api/offers-rury/studnie?limit=5', { headers: H(0) });
    let pdfId = null;
    try {
        pdfId = (JSON.parse(searchPdf.body).data || [])[0]?.id || null;
    } catch {
        /* ignore */
    }

    const q = ['studnia', 'oferta', 'ACME', 'DN1000', ''];
    const workers = [];
    // Podział workerów wg --users (dla 100: 80/15/3 + claim + PDF jak dotąd).
    const grp = splitUsers(USERS);
    const W0 = grp.readers;
    const B0 = grp.readers + grp.writers;
    const C0 = grp.readers + grp.writers + grp.batchers;
    const P0 = C0 + grp.claim;
    // Czytelnicy: ~4-12 req/min na IP (limit api 300/15min = śr. 20/min).
    for (let i = 0; i < grp.readers; i++) {
        workers.push(
            (async () => {
                const end = Date.now() + STEADY_MS;
                while (Date.now() < end) {
                    const kind = Math.random();
                    const r = await withBackoff(() =>
                        kind < 0.5
                            ? timeFetch(
                                  `/api/offers/search?q=${encodeURIComponent(pick(q))}&limit=20`,
                                  { headers: H(i) }
                              )
                            : kind < 0.75
                              ? timeFetch('/api/offers-rury?limit=20', { headers: H(i) })
                              : kind < 0.9
                                ? timeFetch('/api/orders-studnie/production/index', {
                                      headers: H(i)
                                  })
                                : timeFetch('/health/ready', { headers: H(i) })
                    );
                    rec('read', r);
                    await sleep(rnd(5000, 15000));
                }
            })()
        );
    }
    // Piszący: PUT+DELETE co 5-15 s (limit write 60/min na IP).
    for (let i = W0; i < W0 + grp.writers; i++) {
        workers.push(
            (async () => {
                const end = Date.now() + STEADY_MS;
                while (Date.now() < end) {
                    const id = `load100_${Date.now()}_${i}`;
                    const put = await withBackoff(() =>
                        timeFetch('/api/offers-rury', {
                            method: 'PUT',
                            headers: H(i),
                            body: JSON.stringify({
                                data: [{ id, status: 'draft', items: [], clientName: 'LOAD100' }]
                            })
                        })
                    );
                    rec('write', put);
                    if (put.status === 200) {
                        const del = await withBackoff(() =>
                            timeFetch(`/api/offers-rury/${id}`, { method: 'DELETE', headers: H(i) })
                        );
                        rec('write', del);
                    }
                    await sleep(rnd(5000, 15000));
                }
            })()
        );
    }
    // Batchujące: batch 10 co 30-60 s.
    for (let i = B0; i < B0 + grp.batchers; i++) {
        workers.push(
            (async () => {
                const end = Date.now() + STEADY_MS;
                while (Date.now() < end) {
                    const docs = Array.from({ length: 10 }, (_, k) => ({
                        id: `load100b_${Date.now()}_${i}_${k}`,
                        status: 'draft',
                        items: [],
                        clientName: 'LOAD100'
                    }));
                    const put = await withBackoff(() =>
                        timeFetch('/api/offers-rury', {
                            method: 'PUT',
                            headers: H(i),
                            body: JSON.stringify({ data: docs })
                        })
                    );
                    rec('batch', put);
                    if (put.status === 200) {
                        for (const d of docs) {
                            const del = await withBackoff(() =>
                                timeFetch(`/api/offers-rury/${d.id}`, {
                                    method: 'DELETE',
                                    headers: H(i)
                                })
                            );
                            rec('batch', del);
                        }
                    }
                    await sleep(rnd(30000, 60000));
                }
            })()
        );
    }
    // 1 numerujący: claim+recycle co 10 s. 1 PDF: sekwencyjnie.
    if (grp.claim) {
        const ci = C0;
        workers.push(
            (async () => {
                const end = Date.now() + STEADY_MS;
                while (Date.now() < end) {
                    const c = await withBackoff(() =>
                        timeFetch(`/api/orders-studnie/claim-production-number/${adminId}`, {
                            method: 'POST',
                            headers: H(ci)
                        })
                    );
                    rec('claim', c);
                    try {
                        const seq = JSON.parse(c.body)?.nextSeq;
                        if (c.status === 200 && seq) {
                            const rc = await withBackoff(() =>
                                timeFetch('/api/orders-studnie/production/recycle-numbers', {
                                    method: 'POST',
                                    headers: H(ci),
                                    body: JSON.stringify({ userId: adminId, seqNumbers: [seq] })
                                })
                            );
                            rec('claim', rc);
                        }
                    } catch {
                        /* ignore */
                    }
                    await sleep(10000);
                }
            })()
        );
    }
    if (grp.pdf) {
        const pi = P0;
        workers.push(
            (async () => {
                if (!pdfId) return;
                const end = Date.now() + STEADY_MS;
                while (Date.now() < end) {
                    const r = await withBackoff(() =>
                        timeFetch(
                            `/api/offers-rury/studnie/${pdfId}/export-pdf`,
                            { headers: H(pi) },
                            90000
                        )
                    );
                    rec('pdf', r);
                    await sleep(15000);
                }
            })()
        );
    }

    await Promise.all(workers);

    // Burst: N jednoczesnych one-shotów (po 1 hicie na kubełek) + PDF.
    // Dla N=100 podział identyczny jak historycznie (55/20/10/5 + 5 health + 2 PDF + 3 fill).
    const burstFns = [];
    const bb = splitBurst(USERS, !!pdfId);
    let bi = 0;
    for (let k = 0; k < bb.readB; k++) {
        const i = bi++;
        burstFns.push(() =>
            timeFetch(`/api/offers/search?q=${encodeURIComponent(pick(q))}&limit=20`, {
                headers: H(i)
            })
        );
    }
    for (let k = 0; k < bb.prodB; k++) {
        const i = bi++;
        burstFns.push(() => timeFetch('/api/orders-studnie/production/index', { headers: H(i) }));
    }
    for (let k = 0; k < bb.writeB; k++) {
        const i = bi++;
        burstFns.push(async () => {
            const id = `load100x_${Date.now()}_${i}`;
            const put = await timeFetch('/api/offers-rury', {
                method: 'PUT',
                headers: H(i),
                body: JSON.stringify({
                    data: [{ id, status: 'draft', items: [], clientName: 'LOAD100' }]
                })
            });
            if (put.status === 200)
                await timeFetch(`/api/offers-rury/${id}`, { method: 'DELETE', headers: H(i) });
            return put;
        });
    }
    for (let k = 0; k < bb.claimB; k++) {
        const i = bi++;
        burstFns.push(() =>
            timeFetch(`/api/orders-studnie/claim-production-number/${adminId}`, {
                method: 'POST',
                headers: H(i)
            }).then(async (c) => {
                try {
                    const seq = JSON.parse(c.body)?.nextSeq;
                    if (c.status === 200 && seq)
                        await timeFetch('/api/orders-studnie/production/recycle-numbers', {
                            method: 'POST',
                            headers: H(i),
                            body: JSON.stringify({ userId: adminId, seqNumbers: [seq] })
                        });
                } catch {
                    /* ignore */
                }
                return c;
            })
        );
    }
    for (let k = 0; k < bb.healthB; k++) {
        const i = bi++;
        burstFns.push(() => timeFetch('/health/ready', { headers: H(i) }));
    }
    if (pdfId)
        for (let k = 0; k < bb.pdfB; k++) {
            const i = bi++;
            burstFns.push(() =>
                timeFetch(`/api/offers-rury/studnie/${pdfId}/export-pdf`, { headers: H(i) }, 90000)
            );
        }
    while (burstFns.length < USERS)
        burstFns.push(() => timeFetch('/health/ready', { headers: H(USERS - 1) }));
    const bStart = process.hrtime.bigint();
    const bRes = await Promise.all(burstFns.map((fn) => fn()));
    const wallMs = Number(process.hrtime.bigint() - bStart) / 1e6;
    for (const r of bRes) rec('burst', r);

    const metrics1 = await (
        await fetch(BASE + '/metrics', { headers: H(0) })
    )
        .json()
        .catch(() => null);

    const byOp = {};
    for (const s of stats) (byOp[s.op] = byOp[s.op] || []).push(s);
    const report = {
        quick: QUICK,
        sustained: SUSTAINED,
        users: USERS,
        steadyMs: STEADY_MS,
        ops: {},
        burst: null,
        metrics: null,
        dod: null
    };
    for (const [op, arr] of Object.entries(byOp)) {
        if (op === 'burst') continue;
        const times = arr.map((s) => s.ms).sort((a, b) => a - b);
        const bad = arr.filter((s) => s.status !== 200);
        report.ops[op] = {
            n: arr.length,
            p50: +pct(times, 50).toFixed(1),
            p95: +pct(times, 95).toFixed(1),
            p99: +pct(times, 99).toFixed(1),
            fail: bad.length,
            throttled: arr.filter((s) => s.throttled).length,
            statuses: arr.reduce((m, s) => ((m[s.status] = (m[s.status] || 0) + 1), m), {}),
            errSample: [...new Set(bad.slice(0, 3).map((s) => s.body))].slice(0, 3)
        };
    }
    const bTimes = bRes.map((r) => r.ms).sort((a, b) => a - b);
    report.burst = {
        wallMs: +wallMs.toFixed(0),
        n: bRes.length,
        p50: +pct(bTimes, 50).toFixed(1),
        p95: +pct(bTimes, 95).toFixed(1),
        statuses: bRes.reduce((m, r) => ((m[r.status] = (m[r.status] || 0) + 1), m), {})
    };
    if (metrics0 && metrics1) {
        report.metrics = {
            busyDelta: metrics1.db.busy - metrics0.db.busy,
            dbQueries: metrics1.db.queries - metrics0.db.queries,
            dbAvgMs: metrics1.db.avgMs,
            loopLagMaxMs: metrics1.loopLagMaxMs,
            rssMB: metrics1.rssMB,
            pdf: metrics1.pdf
        };
    }

    const fails5xx = stats.filter((s) => s.status >= 500 || s.status === 0).length;
    const writeFail = stats.filter(
        (s) => (s.op === 'write' || s.op === 'batch') && s.status !== 200
    ).length;
    const crudP95 = Math.max(
        report.ops.read?.p95 || 0,
        report.ops.write?.p95 || 0,
        report.ops.batch?.p95 || 0
    );
    const busyDelta = report.metrics?.busyDelta ?? -1;
    const throttled = stats.filter((s) => s.throttled).length;
    const dod = {
        '5xx==0': fails5xx === 0,
        'write-fail==0': writeFail === 0,
        'busyDelta==0': busyDelta === 0,
        'P95 CRUD<500ms': crudP95 < 500,
        'throttled==0': throttled === 0,
        fails5xx,
        writeFail,
        busyDelta,
        crudP95,
        throttled
    };
    report.dod = dod;
    const pass =
        dod['5xx==0'] &&
        dod['write-fail==0'] &&
        dod['busyDelta==0'] &&
        dod['P95 CRUD<500ms'] &&
        dod['throttled==0'];

    for (const [op, r] of Object.entries(report.ops))
        console.error(
            `${op.padEnd(8)} n=${r.n} p50=${r.p50}ms p95=${r.p95}ms p99=${r.p99}ms fail=${r.fail} thr=${r.throttled} ${JSON.stringify(r.statuses)}`
        );
    console.error(
        `BURST wall=${report.burst.wallMs}ms p50=${report.burst.p50}ms p95=${report.burst.p95}ms ${JSON.stringify(report.burst.statuses)}`
    );
    if (report.metrics) console.error(`METRICS ${JSON.stringify(report.metrics)}`);
    for (const [op, r] of Object.entries(report.ops))
        if (r.errSample?.length) console.error(`ERR ${op}: ${JSON.stringify(r.errSample)}`);
    console.error(`DoD ${pass ? 'PASS' : 'FAIL'} ${JSON.stringify(dod)}`);
    console.log(JSON.stringify(report));
    process.exit(pass ? 0 : 1);
}

main().catch((e) => {
    console.error('[load-100] Błąd:', e.message);
    process.exit(1);
});
