#!/usr/bin/env node
/**
 * frontend-deps-check.mjs — Gate weryfikacji zależności frontendu (P1.2).
 *
 * Sprawdza:
 * 1. Czy pojawiły się nowe krawędzie cross-file nieuwzględnione w baseline (ratchet stop +1).
 * 2. Czy pojawiły się nowe zależności o statusie SUSPECTED (wywołania top-level przed załadowaniem).
 * 3. Czy liczba krawędzi spadła (ratchet alert z instrukcją odświeżenia baseline).
 *
 * Flagi:
 *   --update   Aktualizuje plik baseline do bieżącego stanu.
 *   --json     Zwraca wynik jako JSON.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const execFileP = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const BASELINE_PATH = path.join(__dirname, 'frontend-deps-baseline.json');
const CONTRACT_PATH = path.join(REPO_ROOT, 'docs', 'contracts', 'excel-boundary.json');
const ANALYZE_SCRIPT = path.join(__dirname, 'frontend-deps-analyze.mjs');

function isExcelCluster(file) {
    return /studnie\/excel[^/]*\.js$/.test(file);
}

function buildEdgeKey(e) {
    return `${e.page}|${e.name}|${e.userFile}|${e.defFile}|${e.defKind}`;
}

async function runAnalysis(root = REPO_ROOT, pages = null) {
    const args = [ANALYZE_SCRIPT, '--json', '--root', root];
    if (pages) {
        args.push('--pages', pages.join(','));
    }
    const { stdout } = await execFileP('node', args, { maxBuffer: 64 * 1024 * 1024 });
    return JSON.parse(stdout);
}

function extractUniqueEdges(report) {
    const edgeMap = new Map();
    for (const p of report.pages) {
        for (const e of p.edges) {
            const k = buildEdgeKey({ page: p.page, ...e });
            if (!edgeMap.has(k)) {
                edgeMap.set(k, {
                    page: p.page,
                    name: e.name,
                    userFile: e.userFile,
                    defFile: e.defFile,
                    defKind: e.defKind,
                    confidence: e.confidence
                });
            }
        }
    }
    return edgeMap;
}

function updateBaseline(edgeMap) {
    const sortedEdges = [...edgeMap.values()].sort(
        (a, b) =>
            a.page.localeCompare(b.page) ||
            a.name.localeCompare(b.name) ||
            a.userFile.localeCompare(b.userFile) ||
            a.defFile.localeCompare(b.defFile)
    );
    const data = {
        schemaVersion: 1,
        generatedAt: new Date().toISOString().split('T')[0],
        totalEdges: sortedEdges.length,
        edges: sortedEdges
    };
    fs.writeFileSync(BASELINE_PATH, JSON.stringify(data, null, 2) + '\n', 'utf8');
    console.log(`[deps:check] Baseline zaktualizowany: ${sortedEdges.length} unikalnych krawędzi.`);
}

async function main() {
    const isUpdate = process.argv.includes('--update');
    const isJson = process.argv.includes('--json');

    if (!fs.existsSync(BASELINE_PATH) && !isUpdate) {
        console.error(
            `[deps:check] BŁĄD: Brak pliku baseline (${BASELINE_PATH}). Uruchom z flagą --update.`
        );
        process.exit(1);
    }

    const report = await runAnalysis();
    const currentEdgeMap = extractUniqueEdges(report);

    if (isUpdate) {
        updateBaseline(currentEdgeMap);
        process.exit(0);
    }

    const baselineData = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));
    const baselineKeys = new Set(baselineData.edges.map(buildEdgeKey));

    const contractData = fs.existsSync(CONTRACT_PATH)
        ? JSON.parse(fs.readFileSync(CONTRACT_PATH, 'utf8'))
        : null;

    const newEdges = [];
    const suspectedEdges = [];
    const boundaryViolations = [];

    for (const [key, edge] of currentEdgeMap) {
        if (!baselineKeys.has(key)) {
            newEdges.push(edge);
        }
        if (edge.confidence === 'SUSPECTED') {
            suspectedEdges.push(edge);
        }

        // P2: Excel Boundary Check — ochrona klastra excel*.js
        if (contractData && isExcelCluster(edge.defFile) && !isExcelCluster(edge.userFile)) {
            const isFacade = Boolean(
                contractData.publicFacade && contractData.publicFacade[edge.name]
            );
            const legacyEntry =
                contractData.legacyAllowlist && contractData.legacyAllowlist[edge.name];

            if (!isFacade && !legacyEntry) {
                boundaryViolations.push({
                    type: 'UNAUTHORIZED_EXCEL_INTERNAL',
                    ...edge,
                    reason: `Global "${edge.name}" jest prywatny dla klastra Excel i nie należy do Fasady Publicznej.`
                });
            } else if (legacyEntry) {
                const allowedCallers = legacyEntry.allowedCallers || [];
                if (!allowedCallers.includes(edge.userFile)) {
                    boundaryViolations.push({
                        type: 'NEW_CALLER_TO_LEGACY_ALLOWLIST',
                        ...edge,
                        reason: `Global "${edge.name}" jest na liście wycieków legacy — zakaz dodawania nowych callerów (${edge.userFile}).`
                    });
                }
            }
        }
    }

    const removedEdgesCount = [...baselineKeys].filter((k) => !currentEdgeMap.has(k)).length;
    const currentCount = currentEdgeMap.size;
    const baselineCount = baselineKeys.size;

    if (isJson) {
        console.log(
            JSON.stringify(
                {
                    passed:
                        newEdges.length === 0 &&
                        suspectedEdges.length === 0 &&
                        boundaryViolations.length === 0,
                    baselineCount,
                    currentCount,
                    newEdgesCount: newEdges.length,
                    suspectedEdgesCount: suspectedEdges.length,
                    boundaryViolationsCount: boundaryViolations.length,
                    removedEdgesCount,
                    newEdges,
                    suspectedEdges,
                    boundaryViolations
                },
                null,
                2
            )
        );
        process.exit(
            newEdges.length === 0 && suspectedEdges.length === 0 && boundaryViolations.length === 0
                ? 0
                : 1
        );
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  Frontend Dependencies & Excel Boundary Guard (P2)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`  Krawędzie baseline:  ${baselineCount}`);
    console.log(`  Bieżące krawędzie:   ${currentCount}`);

    let hasErrors = false;

    if (boundaryViolations.length > 0) {
        hasErrors = true;
        console.error(
            `\n  ✖ BŁĄD P2 (Excel Boundary): Wykryto ${boundaryViolations.length} naruszeń kontraktu granicy Excela:`
        );
        for (const v of boundaryViolations) {
            console.error(`    - [${v.page}] ${v.name} w ${v.userFile} -> ${v.reason}`);
        }
    }

    if (suspectedEdges.length > 0) {
        hasErrors = true;
        console.error(
            `\n  ✖ BŁĄD: Wykryto ${suspectedEdges.length} zależności SUSPECTED (wywołanie przed załadowaniem):`
        );
        for (const e of suspectedEdges.slice(0, 10)) {
            console.error(`    - [${e.page}] ${e.name} w ${e.userFile} (def: ${e.defFile})`);
        }
        if (suspectedEdges.length > 10) {
            console.error(`    ... i jeszcze ${suspectedEdges.length - 10}`);
        }
    }

    if (newEdges.length > 0) {
        hasErrors = true;
        console.error(
            `\n  ✖ BŁĄD: Wykryto ${newEdges.length} NOWYCH krawędzi cross-file spoza baseline (ratchet):`
        );
        for (const e of newEdges.slice(0, 15)) {
            console.error(
                `    - [${e.page}] ${e.name} w ${e.userFile} <- ${e.defFile} (${e.defKind})`
            );
        }
        if (newEdges.length > 15) {
            console.error(`    ... i jeszcze ${newEdges.length - 15}`);
        }
        console.error(
            '\n  Jeśli zmiana jest zamierzona, zaktualizuj baseline przez: npm run frontend:deps:update'
        );
    }

    if (removedEdgesCount > 0 && !hasErrors) {
        console.log(
            `\n  ℹ Ratchet: usunięto ${removedEdgesCount} starych krawędzi! Możesz zaktualizować baseline:`
        );
        console.log('    npm run frontend:deps:update');
    }

    if (!hasErrors) {
        console.log('\n  ✓ OK — brak nieautoryzowanych krawędzi i naruszeń kolejności.');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        process.exit(0);
    } else {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        process.exit(1);
    }
}

main().catch((err) => {
    console.error('[deps:check] Błąd wykonania:', err);
    process.exit(1);
});
