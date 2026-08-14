#!/usr/bin/env node
'use strict';

import fs from 'node:fs';

const RUNS = 3;

function fail(msg) {
    console.error(`[flaky-compare] ${msg}`);
    process.exit(1);
}

function readReport(path) {
    if (!fs.existsSync(path)) {
        fail(`INFRA FAIL: brak pliku raportu ${path}`);
    }
    let raw;
    try {
        raw = fs.readFileSync(path, 'utf8');
    } catch (e) {
        fail(`INFRA FAIL: nie mozna odczytac ${path}: ${e.message}`);
    }
    let json;
    try {
        json = JSON.parse(raw);
    } catch (e) {
        fail(`INFRA FAIL: nieparsowalny JSON w ${path}: ${e.message}`);
    }
    if (!Array.isArray(json.testResults) || json.testResults.length === 0) {
        fail(`INFRA FAIL: ${path} nie ma pola testResults (tablica niepusta)`);
    }
    if (!Number.isInteger(json.numTotalTests) || json.numTotalTests <= 0) {
        fail(`INFRA FAIL: ${path} ma numTotalTests=${json.numTotalTests}`);
    }
    return json;
}

// Klucz unikalnosci: testFilePath + fullName + line (jezeli --testLocationInResults).
// Line daje odpornosc na testy o identycznej nazwie w tym samym pliku.
function testKey(filePath, assertion) {
    const line =
        assertion.location && Number.isInteger(assertion.location.line)
            ? assertion.location.line
            : '';
    return `${filePath}::${assertion.fullName}::${line}`;
}

function collect(report) {
    const map = new Map();
    for (const result of report.testResults) {
        const filePath = result.name || '';
        for (const assertion of result.assertionResults || []) {
            const key = testKey(filePath, assertion);
            const status = assertion.status || 'skipped';
            if (!map.has(key)) {
                map.set(key, { filePath, title: assertion.fullName, statuses: [] });
            }
            map.get(key).statuses.push(status);
        }
    }
    return map;
}

function run(argv) {
    if (argv.length < RUNS) {
        fail(`Uzycie: node scripts/flaky-compare.mjs <run1.json> <run2.json> <run3.json>`);
    }
    const reports = argv.slice(0, RUNS).map(readReport);

    const perRun = reports.map(collect);

    const flaky = [];
    const stableFail = [];
    const stablePass = [];
    const missingInconsistent = [];

    // Zbior wszystkich kluczy (test obecny w co najmniej jednym runie)
    const allKeys = new Set();
    for (const map of perRun) {
        for (const key of map.keys()) allKeys.add(key);
    }

    for (const key of allKeys) {
        const present = [];
        for (let i = 0; i < RUNS; i++) {
            if (perRun[i].has(key)) present.push(i + 1);
        }
        const statuses = present.map((runIdx) => perRun[runIdx - 1].get(key).statuses[0]);

        const anyFail = statuses.includes('failed');
        const allPass = statuses.every((s) => s === 'passed');
        const runsWithFail =
            present.length === RUNS ? statuses.filter((s) => s === 'failed').length : null;

        if (present.length < RUNS) {
            missingInconsistent.push({
                key,
                title: perRun[present[0] - 1].get(key).title,
                present: present
            });
        } else if (anyFail && runsWithFail < RUNS) {
            // fail w podzbiorze runow (1-2 z 3) = FLAKY
            flaky.push({
                key,
                title: perRun[0].get(key).title,
                statuses,
                failCount: runsWithFail
            });
        } else if (allPass) {
            stablePass.push(key);
        } else {
            // fail we wszystkich 3 runach = STABLE FAIL (to NIE flaky)
            stableFail.push({ key, title: perRun[0].get(key).title });
        }
    }

    console.log('[flaky-compare] === RAPORT FLAKY ===');
    console.log(`[flaky-compare] Stable PASS: ${stablePass.length}`);
    console.log(`[flaky-compare] Stable FAIL: ${stableFail.length}`);
    console.log(`[flaky-compare] FLAKY (fail w podzbiorze runow): ${flaky.length}`);
    console.log(
        `[flaky-compare] MISSING / INCONSISTENT (obecnosc w 1-2 z 3 runow): ${missingInconsistent.length}`
    );

    for (const f of flaky) {
        console.log(`[flaky-compare] FLAKY: ${f.title} (statusy: ${f.statuses.join(' | ')})`);
    }
    for (const m of missingInconsistent) {
        console.log(`[flaky-compare] MISSING: ${m.title} (runs: ${m.present.join(',')})`);
    }
    for (const s of stableFail) {
        console.log(`[flaky-compare] STABLE FAIL: ${s.title}`);
    }

    // report-only: INFRA FAIL exit 1 (juz w fail()), flaky sam w sobie exit 0
    process.exit(0);
}

run(process.argv.slice(2));
