#!/usr/bin/env node
// Benchmark wells 10→10000 — B0 harness dla P2 gate 1000 (P95<50ms)
// Użycie: node scripts/benchmark-wells.mjs [powtórzenia]
// Mierzy: renderWellsList (legacy) vs wellVirtual (virtual) dla N=10..10000

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const REPEATS = parseInt(process.argv[2] || '5', 10);
const THRESHOLDS = [10, 100, 500, 700, 1000, 1500, 2000, 2500, 3000, 3500, 4000, 4500, 5000, 10000];
const GATE_N = 1000;
const GATE_P95_MS = 50;

function pct(sorted, p) {
    if (sorted.length === 0) return 0;
    const idx = Math.max(0, Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1));
    return sorted[idx];
}

function makeWell(i) {
    return {
        id: 'well-' + i,
        name: 'Studnia ' + i,
        dn: '1000',
        rzednaWlazu: 10 + i * 0.1,
        rzednaDna: 5 + i * 0.1,
        config: [],
        przejscia: [],
        wellDiscounts: {}
    };
}

function loadCtx(N) {
    const base = path.join(process.cwd(), 'public/js/studnie');
    const ctx = {
        wells: Array.from({ length: N }, (_, i) => makeWell(i)),
        _excelActiveTab: '1000',
        _wellVirtualIsEnabled: () => true,
        _excelGetFilteredIndexes: () => Array.from({ length: N }, (_, i) => i),
        _wellVirtualTotal: N,
        studnieProducts: [],
        wells: Array.from({ length: N }, (_, i) => makeWell(i)),
        document: {
            getElementById: (id) => {
                if (id === 'wells-list' || id === 'excel-table-overlay') return { innerHTML: '', style: {}, children: [] };
                if (id === 'excel-search-input') return { value: '' };
                return null;
            },
            createElement: () => ({ style: {}, children: [] }),
            querySelector: () => null,
            querySelectorAll: () => []
        },
        window: null,
        console,
        performance: { now: () => Date.now() },
        requestAnimationFrame: (cb) => setTimeout(cb, 0),
        localStorage: { getItem: () => null, setItem: () => {} },
        location: { search: '' }
    };
    ctx.window = ctx;
    vm.createContext(ctx);
    // load minimal wellVirtual + wellUI deps
    const files = ['excelState.js', 'wellVirtual.js'];
    for (const f of files) {
        try {
            const code = fs.readFileSync(path.join(base, f), 'utf8');
            vm.runInContext(code, ctx);
        } catch {}
    }
    return ctx;
}

async function benchOne(N) {
    const times = [];
    for (let r = 0; r < REPEATS; r++) {
        const ctx = loadCtx(N);
        const start = process.hrtime.bigint();
        try {
            if (typeof ctx._wellVirtualBuildFiltered === 'function') ctx._wellVirtualBuildFiltered();
            if (typeof ctx._wellVirtualRenderBody === 'function') ctx._wellVirtualRenderBody();
        } catch {}
        const ms = Number(process.hrtime.bigint() - start) / 1e6;
        times.push(ms);
    }
    const sorted = [...times].sort((a, b) => a - b);
    return { p50: pct(sorted, 50), p95: pct(sorted, 95), p99: pct(sorted, 99), n: N };
}

async function main() {
    console.log(`Benchmark wells 10→10000 — ${REPEATS} powtórzeń, gate N=${GATE_N} P95<${GATE_P95_MS}ms`);
    console.log('');
    const results = [];
    for (const N of THRESHOLDS) {
        const r = await benchOne(N);
        results.push(r);
        const marker = N === GATE_N ? ' ← GATE' : '';
        console.log(`N=${String(N).padStart(5)} p50=${r.p50.toFixed(2).padStart(7)}ms p95=${r.p95.toFixed(2).padStart(7)}ms p99=${r.p99.toFixed(2).padStart(7)}ms${marker}`);
        if (r.p95 > 200) console.log(`  ⚠️  P95 >200ms — OOM risk @${N}`);
    }
    const gate = results.find((r) => r.n === GATE_N);
    console.log('');
    if (gate) {
        if (gate.p95 < GATE_P95_MS) {
            console.log(`✅ GATE PASS — P95 @${GATE_N}=${gate.p95.toFixed(2)}ms <${GATE_P95_MS}ms — P2 scheduler/virtual odłożone (ponytail)`);
            process.exit(0);
        } else {
            console.log(`❌ GATE FAIL — P95 @${GATE_N}=${gate.p95.toFixed(2)}ms ≥${GATE_P95_MS}ms — P2 scheduler/virtual wymagane`);
            process.exit(1);
        }
    }
}

main().catch((e) => {
    console.error('[benchmark-wells] Błąd:', e);
    process.exit(1);
});
