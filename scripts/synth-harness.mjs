#!/usr/bin/env node
/*
 * Synthetic validation harness (v1, HTTP-level) — plan docs/plans/2026-09-12-synth-harness.md
 * Steruje RZECZYWISTYM backendem przez HTTP na IZOLOWANEJ bazie i weryfikuje
 * pipeline ML: telemetry -> feature -> reward -> label -> training guards.
 * NIGDY nie dotyka prod/dev DB ani nie trenuje modelu produkcyjnego.
 *
 * Użycie: node scripts/synth-harness.mjs [--offers N] [--port P] [--db PATH]
 *         [--seed S] [--no-build] [--keep] [--scale]
 * --scale = tryb objętości telemetrycznej (do 10k recordConfig; bez solvera,
 *           pełnego flow ofertowego i treningu).
 */
import { spawn, execFileSync } from 'node:child_process';
import { existsSync, rmSync, symlinkSync, writeFileSync, readFileSync } from 'node:fs';
import { join, resolve, basename } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';

const require0 = createRequire(import.meta.url);

const ROOT = resolve(import.meta.dirname, '..');
const PROD_PORT = 3000;
const SYNTH_USER_PREFIX = 'synth_';
const DENY_BASENAMES = ['app_database.sqlite', 'e2e.sqlite'];
const ADMIN_USER = 'admin';

function arg(name, def) {
    const i = process.argv.indexOf('--' + name);
    if (i === -1) return def;
    const v = process.argv[i + 1];
    return v && !v.startsWith('--') ? v : def;
}
function flag(name) {
    return process.argv.includes('--' + name);
}

const OPTS = {
    offers: parseInt(arg('offers', '100'), 10),
    port: parseInt(arg('port', '3177'), 10),
    db: arg('db', './data/synth-harness.sqlite'),
    seed: parseInt(arg('seed', '42'), 10),
    build: !flag('no-build'),
    keep: flag('keep'),
    scale: flag('scale')
};
const DB_FILE = resolve(ROOT, OPTS.db);
const DB_URL = 'file:' + DB_FILE.replace(/\\/g, '/') + '?connection_limit=1&busy_timeout=30000';
const ADMIN_PASSWORD = 'synth-admin-' + OPTS.seed;
const BASE = 'http://localhost:' + OPTS.port;

// Mulberry32 — deterministyczny RNG (reprodukowalność).
function rng32(seed) {
    let a = seed >>> 0;
    return function () {
        a |= 0;
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// ─── FAIL-CLOSED GUARDS (przed czymkolwiek) ───
function failClosed(reason) {
    console.error('HARNESS ABORT (fail-closed): ' + reason);
    process.exit(2);
}
function guards() {
    const base = basename(DB_FILE);
    if (!base.includes('synth')) failClosed('nazwa pliku DB musi zawierać "synth": ' + DB_FILE);
    for (const d of DENY_BASENAMES) {
        if (base === d || DB_FILE.includes(d)) failClosed('DB na denyliscie: ' + d);
    }
    if (OPTS.port === PROD_PORT) failClosed('port 3000 to produkcja');
    if (!DB_FILE.startsWith(ROOT)) failClosed('DB poza katalogiem projektu: ' + DB_FILE);
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8') || '{}');
    if (!pkg.name) failClosed('nie w root projektu (brak package.json)');
}

// ─── HTTP ───
let TOKEN = '';
// Zod odrzuca jawne nulle w polach optional (string().optional() ≠ nullable) —
// czyścimy je jak frontend (telemetryBridge nigdy nie wysyła nulli).
function clean(obj) {
    if (Array.isArray(obj)) return obj.map(clean);
    if (obj && typeof obj === 'object') {
        const out = {};
        for (const [k, v] of Object.entries(obj)) {
            if (v !== null && v !== undefined) out[k] = clean(v);
        }
        return out;
    }
    return obj;
}
async function api(method, path, body, attempt = 0) {
    const res = await fetch(BASE + path, {
        method,
        headers: {
            'Content-Type': 'application/json',
            'x-auth-token': TOKEN
        },
        body: body === undefined ? undefined : JSON.stringify(clean(body))
    });
    if (res.status === 429 && attempt < 3) {
        await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
        return api(method, path, body, attempt + 1);
    }
    let json = null;
    try {
        json = await res.json();
    } catch {
        /* nie-JSON */
    }
    return { status: res.status, json };
}

// ─── Setup: build + migracje + seed admina (przez start serwera) ───
function setup() {
    for (const f of [DB_FILE, DB_FILE + '-wal', DB_FILE + '-shm', DB_FILE + '-journal']) {
        if (existsSync(f)) rmSync(f);
    }
    const distGen = join(ROOT, 'dist', 'generated');
    if (!existsSync(distGen)) {
        symlinkSync(join(ROOT, 'generated'), distGen, 'junction');
    }
    if (OPTS.build) {
        console.log('▶ build...');
        execFileSync('npm', ['run', 'build'], { cwd: ROOT, stdio: 'pipe', shell: true });
    }
    // UWAGA: generate pomijamy, gdy klient istnieje — nadpisywanie engine DLL
    // pada EPERM, gdy działa inny serwer (trzyma uchwyt). Flaga --regen wymusza
    // (tylko gdy żaden serwer nie działa). Brak zmian schematu = klient aktualny.
    if (flag('regen') || !existsSync(join(ROOT, 'generated', 'prisma', 'client.js'))) {
        console.log('▶ prisma generate...');
        execFileSync(process.execPath, [require0.resolve('prisma/build/index.js'), 'generate'], {
            cwd: ROOT,
            env: { ...process.env, DATABASE_URL: DB_URL },
            stdio: 'pipe'
        });
    }
    console.log('▶ migrate deploy...');
    execFileSync(
        process.execPath,
        [require0.resolve('prisma/build/index.js'), 'migrate', 'deploy'],
        {
            cwd: ROOT,
            env: { ...process.env, DATABASE_URL: DB_URL },
            stdio: 'pipe'
        }
    );
}
function spawnServer() {
    const server = spawn(process.execPath, [join(ROOT, 'dist', 'server.js')], {
        cwd: ROOT,
        env: {
            ...process.env,
            PORT: String(OPTS.port),
            DATABASE_URL: DB_URL,
            DEFAULT_ADMIN_PASSWORD: ADMIN_PASSWORD,
            NODE_ENV: 'development'
        },
        stdio: 'pipe'
    });
    server.stderr.on('data', (d) => process.stderr.write('[srv-err] ' + d));
    return server;
}
async function pollHealth(url, tries = 40) {
    for (let i = 0; i < tries; i++) {
        try {
            const r = await fetch(url);
            if (r.status === 200) return true;
        } catch {}
        await new Promise((r) => setTimeout(r, 1000));
    }
    return false;
}

// ─── Odczyt DB (read-only asercje) ───
function openDb() {
    return new DatabaseSync(DB_FILE, { readOnly: true });
}

// ─── Scenariusze ───
const results = [];
function check(name, ok, detail = '') {
    results.push({ name, ok: !!ok, detail: String(detail || '') });
    console.log((ok ? '  ✅ ' : '  ❌ ') + name + (ok || !detail ? '' : ' — ' + detail));
}

const DNS = ['600', '800', '1000', '1200', '1500', '2000'];
const WELLTYPES = ['standard', 'standard', 'standard', 'psia_buda', 'styczna'];

async function main() {
    guards();
    const t0 = Date.now();
    setup();
    const server = spawnServer();
    const timings = {};
    let offersCreated = 0;
    let wellsInOffers = 0;
    let telTotalN = 0;
    let eligRows = [];
    let byUserRows = [];
    async function timed(label, fn) {
        const s = process.hrtime.bigint();
        const out = await fn();
        timings[label] = (timings[label] || []).concat(Number(process.hrtime.bigint() - s) / 1e6);
        return out;
    }
    try {
        if (!(await pollHealth(BASE + '/health'))) {
            server.kill();
            failClosed('serwer testowy nie wstał (health check)');
        }
        // Login admin (ensureAdminExists tworzy konto przy starcie).
        const login = await timed('login', () =>
            api('POST', '/api/auth/login', { username: ADMIN_USER, password: ADMIN_PASSWORD })
        );
        TOKEN = login.json?.token || login.json?.data?.token || '';
        check('S0 login admin', login.status === 200 && !!TOKEN, 'status=' + login.status);

        const rand = rng32(OPTS.seed);
        const pick = (arr) => arr[Math.floor(rand() * arr.length)];
        const synthWell = (i) => ({
            id: `${SYNTH_USER_PREFIX}well_${i}`,
            dn: pick(DNS),
            wellType: pick(WELLTYPES)
        });

        // S11: oferty w sensie biznesowym (DTO wizarda) — wiele POST-ów po maks.
        // 50 studni (cap jak na frontendzie). Liczniki offers/wells/configs
        // raportowane ROZDZIELNIE (recenzja v1: 1 oferta ≠ 50 studni ≠ N configs).
        // Pętla ofert capped do 10 (WRITE_LIMITER 60/min); wolumen idzie z pętli
        // telemetrycznej w skali.
        const nOffers = Math.min(10, Math.max(1, Math.ceil(OPTS.offers / 50)));
        for (let o = 0; o < nOffers; o++) {
            const batchSize = Math.min(50, OPTS.offers - o * 50);
            if (batchSize <= 0) break;
            const offerWells = Array.from({ length: batchSize }, (_, i) => ({
                id: `${SYNTH_USER_PREFIX}well_${o * 50 + i}`,
                name: `synth-${o * 50 + i}`,
                dn: pick(DNS),
                config: []
            }));
            const offer = await timed('offer-create', () =>
                api('POST', '/api/offers-rury/studnie', {
                    data: [
                        {
                            clientName: 'synth-client',
                            investName: 'synth-harness',
                            wells: offerWells
                        }
                    ]
                })
            );
            if (offer.status === 200 && offer.json?.ok === true) {
                offersCreated++;
                wellsInOffers += batchSize;
            }
        }
        check(
            'S11 offer CRUD roundtrip',
            offersCreated === nOffers,
            `offers=${offersCreated}/${nOffers} wells=${wellsInOffers}`
        );
        const offerGet = await timed('offer-list', () => api('GET', '/api/offers-rury/studnie'));
        check(
            'S11 offer widoczna w GET',
            offerGet.status === 200 &&
                (offerGet.json?.totalCount >= 1 || (offerGet.json?.data || []).length >= 1),
            'status=' + offerGet.status
        );

        // S1: poprawna AUTO_JS + acceptance-full → ACCEPTED.
        const w1 = synthWell(1001);
        const cfg1 = await timed('recordConfig', () =>
            api('POST', '/api/telemetry/ai/config', {
                solverSource: 'AUTO_JS',
                dn: w1.dn,
                wellType: w1.wellType,
                wellId: w1.id,
                warehouse: 'KLB',
                ringCount: 3,
                totalPrice: 2500,
                totalWeight: 5000,
                featureSnapshot: { totalPrice: 2500, totalWeight: 5000, ringCount: 3 },
                allComponentIds: ['KDB-1000-1000']
            })
        );
        const tel1 = cfg1.json?.telemetryId || null;
        check(
            'S1 recordConfig zwraca telemetryId',
            cfg1.status === 200 && !!tel1,
            'status=' + cfg1.status
        );
        if (tel1) {
            const acc = await timed('acceptance-full', () =>
                api('POST', '/api/telemetry/ai/acceptance-full', {
                    telemetryId: tel1,
                    accepted: true,
                    wellId: w1.id
                })
            );
            check('S1 acceptance-full 200', acc.status === 200, 'status=' + acc.status);
        }

        // S2: AUTO_JS + MODIFY z parentConfigId → MODIFIED na sugestii.
        const w2 = synthWell(1002);
        const cfg2 = await api('POST', '/api/telemetry/ai/config', {
            solverSource: 'AUTO_JS',
            dn: w2.dn,
            wellType: w2.wellType,
            wellId: w2.id,
            warehouse: 'KLB',
            totalPrice: 2500,
            featureSnapshot: { totalPrice: 2500 },
            allComponentIds: ['KDB-1000-1000']
        });
        const tel2 = cfg2.json?.telemetryId || null;
        // Decyzja MANUAL wskazująca sugestię (łańcuch parentConfigId).
        const dec2 = await api('POST', '/api/telemetry/ai/config', {
            solverSource: 'MANUAL',
            dn: w2.dn,
            wellType: w2.wellType,
            wellId: w2.id,
            parentConfigId: tel2,
            wasModified: true,
            allComponentIds: ['KDB-1000-500']
        });
        check('S2 MODIFY z parentConfigId 200', dec2.status === 200, 'status=' + dec2.status);
        const mod2 = await api('POST', '/api/telemetry/ai/reward', {
            action: 'MODIFY',
            wellId: w2.id,
            parentConfigId: tel2
        });
        check('S2 reward MODIFY 200', mod2.status === 200, 'status=' + mod2.status);

        // S3: REJECT z parentConfigId → REJECTED (ścieżka istnieje, gdy sygnał dojdzie).
        const w3 = synthWell(1003);
        const cfg3 = await api('POST', '/api/telemetry/ai/config', {
            solverSource: 'AUTO_JS',
            dn: w3.dn,
            wellType: w3.wellType,
            wellId: w3.id,
            totalPrice: 2500,
            featureSnapshot: { totalPrice: 2500 },
            allComponentIds: ['KDB-1000-1000']
        });
        const tel3 = cfg3.json?.telemetryId || null;
        const rej3 = await api('POST', '/api/telemetry/ai/reward', {
            action: 'REJECT',
            wellId: w3.id,
            parentConfigId: tel3
        });
        check('S3 reward REJECT 200', rej3.status === 200, 'status=' + rej3.status);

        // S4: zwykła zmiana AUTO_JS bez parent → NIGDY REJECTED.
        const w4 = synthWell(1004);
        const cfg4 = await api('POST', '/api/telemetry/ai/config', {
            solverSource: 'AUTO_JS',
            dn: w4.dn,
            wellType: w4.wellType,
            wellId: w4.id,
            totalPrice: 2500,
            featureSnapshot: { totalPrice: 2500 },
            allComponentIds: ['KDB-1000-1000']
        });
        const tel4 = cfg4.json?.telemetryId || null;
        await api('POST', '/api/telemetry/ai/reward', { action: 'MODIFY', wellId: w4.id });

        // S5: czysty MANUAL → NO_FEEDBACK; MANUAL + acceptance → ACCEPTED (G2).
        const w5 = synthWell(1005);
        const cfg5 = await api('POST', '/api/telemetry/ai/config', {
            solverSource: 'MANUAL',
            dn: w5.dn,
            wellType: w5.wellType,
            wellId: w5.id,
            totalPrice: 2500,
            featureSnapshot: { totalPrice: 2500 },
            allComponentIds: ['KDB-1000-1000']
        });
        const tel5 = cfg5.json?.telemetryId || null;
        const w6 = synthWell(1006);
        const cfg6 = await api('POST', '/api/telemetry/ai/config', {
            solverSource: 'MANUAL',
            dn: w6.dn,
            wellType: w6.wellType,
            wellId: w6.id,
            totalPrice: 2500,
            featureSnapshot: { totalPrice: 2500 },
            allComponentIds: ['KDB-1000-1000']
        });
        const tel6 = cfg6.json?.telemetryId || null;
        if (tel6) {
            await api('POST', '/api/telemetry/ai/acceptance-full', {
                telemetryId: tel6,
                accepted: true,
                wellId: w6.id
            });
        }

        // S6: duplikat rewardu → duplicate.
        const dup1 = await api('POST', '/api/telemetry/ai/reward', {
            action: 'ACCEPT',
            wellId: w1.id
        });
        const dup2 = await api('POST', '/api/telemetry/ai/reward', {
            action: 'ACCEPT',
            wellId: w1.id
        });
        check('S6 duplikat oznaczony', dup2.json?.duplicate === true, JSON.stringify(dup2.json));

        // S7: batch 501 → 400; batch mieszany → kształt odpowiedzi.
        const big = Array.from({ length: 501 }, (_, i) => ({
            action: 'ACCEPT',
            wellId: `${SYNTH_USER_PREFIX}well_${i}`
        }));
        const bigRes = await api('POST', '/api/telemetry/ai/reward-batch', { items: big });
        check('S7 batch 501 → 400', bigRes.status === 400, 'status=' + bigRes.status);
        const mixed = await api('POST', '/api/telemetry/ai/reward-batch', {
            items: [
                { action: 'ACCEPT', wellId: w1.id },
                { action: 'ACCEPT', wellId: `${SYNTH_USER_PREFIX}ghost` }
            ]
        });
        check(
            'S7 batch mieszany applied/rejected',
            mixed.status === 200 &&
                Array.isArray(mixed.json?.applied) &&
                (mixed.json?.rejected || []).some((r) => r.reason === 'WELL_NOT_FOUND'),
            'status=' + mixed.status
        );

        // S8: reward dla nieznanej studni → WELL_NOT_FOUND, zero skutków.
        const ghost = await api('POST', '/api/telemetry/ai/reward', {
            action: 'ACCEPT',
            wellId: `${SYNTH_USER_PREFIX}ghost`
        });
        check('S8 WELL_NOT_FOUND 400', ghost.status === 400, 'status=' + ghost.status);

        // S10: well_deleted → event, brak wpływu na labele.
        const ev = await api('POST', '/api/telemetry/ai/event', {
            eventType: 'well_deleted',
            telemetryId: tel2,
            wellId: w2.id,
            changeReason: 'unknown'
        });
        check('S10 well_deleted 200', ev.status === 200, 'status=' + ev.status);

        // Skala: N recordConfig (szybka ścieżka objętości).
        if (OPTS.scale || OPTS.offers > 50) {
            const n = OPTS.scale ? 10000 : OPTS.offers;
            console.log(`▶ skala: ${n} recordConfig...`);
            const tS = Date.now();
            for (let i = 0; i < n; i++) {
                const w = synthWell(20000 + i);
                await api('POST', '/api/telemetry/ai/config', {
                    solverSource: i % 10 === 0 ? 'MANUAL' : 'AUTO_JS',
                    dn: w.dn,
                    wellType: w.wellType,
                    wellId: w.id,
                    totalPrice: 2000 + (i % 500),
                    featureSnapshot: { totalPrice: 2000 + (i % 500) },
                    allComponentIds: ['KDB-1000-1000']
                });
                if (i % 500 === 499) process.stdout.write(`  ${i + 1}/${n}\r`);
            }
            console.log(`  skala ${n} w ${((Date.now() - tS) / 1000).toFixed(1)}s`);
        }

        // S12: trening end-to-end na syntetyku (endpoint = run(true)/force, więc
        // extractAndStore ZAWSZE się wykona — cechy muszą istnieć PRZED asercjami
        // labeli). Oczekiwany SKIPPED na guardach (malutki dataset).
        const train = await timed('train', () => api('POST', '/api/telemetry/ai/train', {}));
        check(
            'S12 train odpowiada (guard, nie crash)',
            train.status === 200 && typeof train.json?.trained === 'boolean',
            'status=' + train.status + ' ' + JSON.stringify(train.json)?.slice(0, 120)
        );

        // ─── Asercje DB (linkage + etykiety + invarianty) ───
        const db = openDb();
        try {
            const byTel = (id) =>
                id
                    ? db.prepare('SELECT label FROM AiFeature WHERE telemetryId = ?').get(id)?.label
                    : null;
            // S1: ACCEPTED (acceptance-full na AUTO_JS).
            check('S1 label ACCEPTED', byTel(tel1) === 'ACCEPTED', 'label=' + byTel(tel1));
            // S2: MODIFIED na sugestii (nie na decyzji MANUAL).
            check(
                'S2 label MODIFIED na sugestii',
                byTel(tel2) === 'MODIFIED',
                'label=' + byTel(tel2)
            );
            // S3: REJECTED (ścieżka działa, gdy sygnał dojdzie).
            check('S3 label REJECTED', byTel(tel3) === 'REJECTED', 'label=' + byTel(tel3));
            // S4: AUTO_JS + MODIFY bez parent → nigdy REJECTED.
            const l4 = byTel(tel4);
            check('S4 brak REJECTED bez parent', l4 !== 'REJECTED', 'label=' + l4);
            // S5: MANUAL → NO_FEEDBACK; MANUAL+accept → ACCEPTED.
            check('S5 MANUAL → NO_FEEDBACK', byTel(tel5) === 'NO_FEEDBACK', 'label=' + byTel(tel5));
            check(
                'S5 MANUAL+accept → ACCEPTED',
                byTel(tel6) === 'ACCEPTED',
                'label=' + byTel(tel6)
            );
            // S8: ghost nie zostawił rewardu.
            const ghostRows = db
                .prepare('SELECT COUNT(*) AS n FROM aiRewardLog WHERE wellId = ?')
                .get(`${SYNTH_USER_PREFIX}ghost`);
            check('S8 brak rewardu dla ghost', ghostRows.n === 0, 'n=' + ghostRows.n);
            // S10: event zapisany; labele sugestii bez zmian poza S2/S3.
            const evRows = db
                .prepare(
                    "SELECT COUNT(*) AS n FROM ai_telemetry_events WHERE eventType = 'well_deleted'"
                )
                .get();
            check('S10 event well_deleted zapisany', evRows.n >= 1, 'n=' + evRows.n);
            // S4 bez parent: backend oznacza PIERWSZĄ sugestię AUTO studni jako
            // MODIFIED (fallback) — nigdy REJECTED. Więc REJECTED ma być dokładnie
            // 1 (tel3), a MODIFIED zawiera co najmniej tel2.
            const rejRows = db
                .prepare("SELECT telemetryId FROM AiFeature WHERE label = 'REJECTED'")
                .all();
            check(
                'S10 REJECTED dokładnie 1 (tel3)',
                rejRows.length === 1 && rejRows[0].telemetryId === tel3,
                JSON.stringify(rejRows)
            );
            const modRows = db
                .prepare("SELECT telemetryId FROM AiFeature WHERE label = 'MODIFIED'")
                .all()
                .map((r) => r.telemetryId);
            check('S10 MODIFIED zawiera tel2', modRows.includes(tel2), JSON.stringify(modRows));
            // Linkage: każdy AiFeature wskazuje istniejący wiersz telemetry
            // (telemetryId to UUID — join po id, nie po wellId).
            const orphans = db
                .prepare(
                    `SELECT COUNT(*) AS n FROM AiFeature f LEFT JOIN ai_telemetry_logs t
                     ON t.id = f.telemetryId WHERE t.id IS NULL`
                )
                .get();
            check('S-linkage brak sierot AiFeature', orphans.n === 0, 'n=' + orphans.n);
            // Balans +runs.
            const labels = db
                .prepare('SELECT label, COUNT(*) AS n FROM AiFeature GROUP BY label')
                .all();
            const runs = db
                .prepare('SELECT status, COUNT(*) AS n FROM AiTrainingRun GROUP BY status')
                .all();
            console.log('  labels: ' + JSON.stringify(labels));
            console.log('  runs: ' + JSON.stringify(runs));
            // Uczciwa tożsamość (recenzja v1): auth = admin sesyjny, NIE userId
            // synth_*. Izolacja wynika z osobnego pliku DB, nie z allowlisty.
            byUserRows = db
                .prepare('SELECT userId, COUNT(*) AS n FROM ai_telemetry_logs GROUP BY userId')
                .all();
            check(
                'S-id jeden użytkownik sesyjny (admin)',
                byUserRows.length === 1,
                JSON.stringify(byUserRows)
            );
            const allowRow = db
                .prepare("SELECT value FROM settings WHERE key = 'ai_training_user_ids'")
                .get();
            check(
                'S-id brak allowlisty na synth DB (fail-open null; izolacja = osobny plik)',
                !allowRow,
                JSON.stringify(allowRow || null)
            );
            eligRows = db
                .prepare(
                    'SELECT trainingEligible, COUNT(*) AS n FROM ai_telemetry_logs GROUP BY trainingEligible'
                )
                .all();
            console.log('  trainingEligible: ' + JSON.stringify(eligRows));
            telTotalN = db.prepare('SELECT COUNT(*) AS n FROM ai_telemetry_logs').get().n;
            console.log(
                `  counts: offers=${offersCreated} wellsInOffers=${wellsInOffers} telemetryConfigs=${telTotalN}`
            );
        } finally {
            db.close();
        }

        // Metryki czasów.
        for (const [k, arr] of Object.entries(timings)) {
            const s = [...arr].sort((a, b) => a - b);
            const pct = (p) =>
                s[Math.max(0, Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1))];
            console.log(
                `  ⏱ ${k}: p50=${pct(50).toFixed(1)}ms p95=${pct(95).toFixed(1)}ms n=${s.length}`
            );
        }
    } finally {
        server.kill();
        await new Promise((r) => setTimeout(r, 3000));
        if (!OPTS.keep) {
            for (let attempt = 0; attempt < 5; attempt++) {
                try {
                    for (const f of [
                        DB_FILE,
                        DB_FILE + '-wal',
                        DB_FILE + '-shm',
                        DB_FILE + '-journal'
                    ]) {
                        if (existsSync(f)) rmSync(f);
                    }
                    break;
                } catch {
                    await new Promise((r) => setTimeout(r, 1000));
                }
            }
            console.log('▶ teardown: usunięto syntetyczną DB');
        } else {
            console.log('▶ teardown: --keep, zostawiam ' + DB_FILE);
        }
    }

    const failed = results.filter((r) => !r.ok);
    // Raport poza repo (os.tmpdir) — zero zanieczyszczeń worktree.
    const report = {
        harness: 'synth-harness v1 (HTTP backend telemetry/reward validation)',
        seed: OPTS.seed,
        offersCreated,
        wellsInOffers,
        telemetryConfigs: telTotalN,
        trainingEligibleRows: eligRows,
        telemetryByUser: byUserRows,
        durationMs: Date.now() - t0,
        // Mierzone/z konstrukcji, nie deklarowane: osobny plik DB (fail-closed),
        // trening prod niemożliwy fizycznie; eligible mierzone na synth DB.
        productionDbAccess: 0,
        passed: results.length - failed.length,
        failed: failed.length,
        results
    };
    const reportPath = join(tmpdir(), 'synth-harness-report.json');
    writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log('Raport: ' + reportPath);
    console.log(`\nWYNIK: ${report.passed}/${results.length} passed`);
    if (failed.length > 0) process.exit(1);
}

main().catch((e) => {
    console.error('HARNESS FAIL:', e instanceof Error ? e.message : String(e));
    process.exit(1);
});
