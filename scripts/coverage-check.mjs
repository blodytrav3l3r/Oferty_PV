import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SUMMARY = resolve('coverage/coverage-summary.json');
const DEFAULT_THRESHOLDS = { lines: 65, branches: 64, functions: 61 };

function loadSummary() {
    return JSON.parse(readFileSync(SUMMARY, 'utf8'));
}

function fail(message) {
    process.stderr.write(`[coverage-check] ${message}\n`);
    process.exit(1);
}

function report(total, thresholds) {
    const out = { lines: {}, branches: {}, functions: {} };
    let ok = true;
    for (const key of ['lines', 'branches', 'functions']) {
        const pct = total[key].pct;
        out[key] = { pct: pct.toFixed(1), threshold: thresholds[key] };
        if (pct < thresholds[key]) ok = false;
    }
    return { out, ok };
}

// --report (domyslne): pokazuje %, exit 0 zawsze (nie blokuje, K4).
// --fail: exit 1 gdy procent spadnie ponizej progu (do uzycia w CI).
const failMode = process.argv.includes('--fail');
const thresholds = DEFAULT_THRESHOLDS;

let total;
try {
    total = loadSummary().total;
} catch (err) {
    fail(`nie znaleziono raportu w ${SUMMARY}. Uruchom: npm test -- --coverage\n(${err.message})`);
}

const { out, ok } = report(total, thresholds);

for (const [key, v] of Object.entries(out)) {
    process.stdout.write(`${key.padEnd(10)} ${v.pct.padStart(5)}%  (prog ${v.threshold}%)\n`);
}

if (failMode && !ok) {
    fail('coverage ponizej progu');
}
process.exit(0);
