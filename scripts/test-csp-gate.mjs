#!/usr/bin/env node
/**
 * test-csp-gate.mjs — Contract tests for CSP regression gate (--check mode)
 *
 * Weryfikuje, że logika wykrywania regresji w generate-csp-inventory.mjs
 * działa poprawnie dla wszystkich checków:
 *   Check 1: new INLINE_HTML_HANDLER → FAIL
 *   Check 2: reintroduced VERIFIED → FAIL
 *   Check 3: unknown data-action bez kontraktu → FAIL
 *
 * Użycie:
 *   node scripts/test-csp-gate.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const FIXTURES = path.join(ROOT, 'docs/security/test/csp-gate-fixtures.json');

function loadBaseline(raw) {
    return Array.isArray(raw) ? raw : raw.entries;
}

function runChecks(currentEntries, v2BaselineRaw, contractsRaw, actionUsage) {
    const v2 = loadBaseline(v2BaselineRaw);
    const baselineFps = new Set(v2.map((e) => e.fingerprint));
    const verifiedV2Fps = new Set(
        v2.filter((e) => e.status === 'VERIFIED').map((e) => e.fingerprint)
    );

    const results = {
        check1New: 0,
        check2Reverted: 0,
        check3Undocumented: 0,
        messages: []
    };

    // Check 1: new INLINE_HTML_HANDLER not in baseline
    const newInline = currentEntries.filter(
        (e) => e.classification === 'INLINE_HTML_HANDLER' && !baselineFps.has(e.fingerprint)
    );
    results.check1New = newInline.length;
    if (newInline.length > 0) {
        results.messages.push(
            `❌ NEW DEBT: ${newInline.length} new INLINE_HTML_HANDLER detected (not in baseline)`
        );
        for (const e of newInline) {
            results.messages.push(
                `    ${e.file}:${e.line} ${e.handler || '?'}="${e.body || ''}" [${e.fingerprint}]`
            );
        }
    }

    // Check 2: VERIFIED fingerprint reappeared (migration reverted)
    if (verifiedV2Fps.size > 0) {
        const reverted = currentEntries.filter(
            (e) =>
                verifiedV2Fps.has(e.fingerprint) &&
                e.classification !== 'MIGRATED' &&
                e.subclassification !== 'MIGRATED' &&
                e.file !== 'migrated'
        );
        results.check2Reverted = reverted.length;
        if (reverted.length > 0) {
            results.messages.push(
                `❌ REINTRODUCTION: ${reverted.length} VERIFIED handler${reverted.length > 1 ? 's' : ''} reappeared (migration reverted)`
            );
            for (const e of reverted) {
                results.messages.push(
                    `    ${e.file}:${e.line} ${e.handler || '?'}="${e.body || ''}" [${e.fingerprint}]`
                );
            }
        }
    }

    // Check 3: action contract integrity
    if (contractsRaw) {
        const knownActions = new Set(Object.keys(contractsRaw.actions || {}));
        const undocumentedActions = Object.keys(actionUsage || {}).filter(
            (n) => !knownActions.has(n)
        );
        results.check3Undocumented = undocumentedActions.length;
        if (undocumentedActions.length > 0) {
            results.messages.push(
                `⚠ UNDOCUMENTED ACTIONS: ${undocumentedActions.length} data-action references without contracts`
            );
            for (const name of undocumentedActions.sort()) {
                results.messages.push(`    ${name}`);
            }
        }
    }

    return results;
}

// ─── test runner ───

let passed = 0;
let failed = 0;

const fixturesRaw = JSON.parse(fs.readFileSync(FIXTURES, 'utf8'));
const scenarios = fixturesRaw.scenarios;

console.log(`\n=== CSP Gate Contract Tests ===`);
console.log(`Fixtures: ${FIXTURES}`);
console.log(`Scenarios: ${scenarios.length}\n`);

for (const scenario of scenarios) {
    const results = runChecks(
        scenario.currentEntries,
        scenario.v2Baseline,
        scenario.contracts,
        scenario.actionUsage
    );
    const hasCheck3 = scenario.expectedCheck3Unknown !== undefined;
    const actualExit =
        results.check1New > 0 || results.check2Reverted > 0 || results.check3Undocumented > 0 ? 1 : 0;
    const exitOk = actualExit === scenario.expectedExit;
    const c1Ok = results.check1New === scenario.expectedCheck1New;
    const c2Ok = results.check2Reverted === scenario.expectedCheck2Reverted;
    const c3Ok = !hasCheck3 || results.check3Undocumented === scenario.expectedCheck3Unknown;
    const ok = exitOk && c1Ok && c2Ok && c3Ok;

    if (ok) {
        console.log(`  ✓ ${scenario.name}`);
        passed++;
    } else {
        console.log(`  ✗ ${scenario.name}`);
        console.log(`    Description: ${scenario.description}`);
        if (!exitOk) console.log(`    Expected exit: ${scenario.expectedExit}, got: ${actualExit}`);
        if (!c1Ok)
            console.log(
                `    Expected Check1 (new): ${scenario.expectedCheck1New}, got: ${results.check1New}`
            );
        if (!c2Ok)
            console.log(
                `    Expected Check2 (reverted): ${scenario.expectedCheck2Reverted}, got: ${results.check2Reverted}`
            );
        if (!c3Ok)
            console.log(
                `    Expected Check3 (undocumented actions): ${scenario.expectedCheck3Unknown}, got: ${results.check3Undocumented}`
            );
        for (const msg of results.messages) {
            console.log(`    ${msg}`);
        }
        failed++;
    }
}

const total = passed + failed;
console.log(`\n=== ${total} scenarios: ${passed} passed, ${failed} failed ===\n`);
process.exitCode = failed > 0 ? 1 : 0;
