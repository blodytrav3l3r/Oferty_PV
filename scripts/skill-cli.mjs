#!/usr/bin/env node
/**
 * skill-cli.mjs — CLI do budowy/walidacji/audytu manifestu skilli.
 *
 * Komendy:
 *   build-manifest       — skanuj .hermes/skills/ + profile:pv/skills/, waliduj
 *   stats                — raport: count, total cost per category, top-5 costliest
 *   cost <skill_id>      — ile tokenów zajmie ten skill (koszt sam i z deps)
 *   deps <skill_id>      — transitive depends_on (drzewo)
 *   validate             — schema validation, referencje, cykle (TODO)
 *
 * Definicja SSoT = `_manifest.yaml` w `.hermes/skills/`. Ten CLI NIE MUTUJE
 * manifestu -- tylko raportuje i waliduje. Zmiany wprowadza developer
 * edytując YAML.
 *
 * Użycie:
 *   node scripts/skill-cli.mjs build-manifest
 *   node scripts/skill-cli.mjs stats
 *   node scripts/skill-cli.mjs cost conventions-lite
 *   node scripts/skill-cli.mjs deps graphify
 *
 *   npm run skills:stats
 *   npm run skills:validate
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import yaml from 'js-yaml';

const ROOT = resolve(process.cwd());
const MANIFEST_PATH = resolve(ROOT, '.hermes', 'skills', '_manifest.yaml');

// Pomocnik: YAML reader (js-yaml -- dependency w package.json devDeps).
function readYAML(text) {
    return yaml.load(text);
}

// ── Commands ──

function loadManifest() {
    if (!existsSync(MANIFEST_PATH)) {
        process.stderr.write(`\n✗ Brak pliku manifestu: ${MANIFEST_PATH}\n\n`);
        process.exit(1);
    }
    try {
        return readYAML(readFileSync(MANIFEST_PATH, 'utf-8'));
    } catch (e) {
        process.stderr.write(`\n✗ Błąd parsowania manifestu (uwaga: minimalistyczny parser YAML): ${e.message}\n`);
        process.exit(2);
    }
}

function cmdBuildManifest() {
    const manifest = loadManifest();
    console.log('\n══════════════════════════════════════════════');
    console.log('  Skill Manifest Build Report');
    console.log('══════════════════════════════════════════════\n');

    const skills = manifest.skills ?? [];
    const cats = { core: 0, feature: 0, heavy: 0 };
    const totalCost = { core: 0, feature: 0, heavy: 0 };

    for (const s of skills) {
        if (!s || typeof s !== 'object') continue;
        const cat = s.category ?? 'feature';
        cats[cat] = (cats[cat] ?? 0) + 1;
        totalCost[cat] = totalCost[cat] + (s.cost ?? 0);
    }

    console.log(`  Schema version:    ${manifest.schema_version ?? '?'}`);
    console.log(`  Skills total:      ${skills.length}`);
    console.log('');
    console.log('  ─── by category ───');
    for (const [cat, count] of Object.entries(cats)) {
        console.log(
            `    ${cat.padEnd(8)} ${String(count).padStart(3)} skills  cost: ~${String(
                totalCost[cat]
            ).padStart(6)} tokens`
        );
    }
    console.log('');
    const allCost = Object.values(totalCost).reduce((a, b) => a + b, 0);
    const coreCost = totalCost.core;
    const savings =
        allCost > 0 ? Math.round(((allCost - coreCost) / allCost) * 100) : 0;
    console.log(`  SUM-ALL (all-loaded):  ~${allCost} tokens`);
    console.log(`  SUM-CORE:              ~${coreCost} tokens`);
    console.log(`  Savings if core-only:  ${savings}% mniej kontekstu`);
    console.log('\n══════════════════════════════════════════════\n');

    // Manifest jest SSoT -- ten CLI NIE modyfikuje go.
    console.log(
        '  ℹ Manifest jest SSoT — ten CLI NIE MUTUJE go. Edytuj ręcznie YAML.\n'
    );
}

function cmdStats() {
    const manifest = loadManifest();
    const skills = manifest.skills ?? [];

    console.log('\n══════════════════════════════════════════════');
    console.log('  Skill Stats');
    console.log('══════════════════════════════════════════════\n');

    // Sortuj po cost (malejąco)
    const sorted = [...skills]
        .filter((s) => s && typeof s === 'object')
        .sort((a, b) => (b.cost ?? 0) - (a.cost ?? 0));

    console.log('  Top-N najdroższych skilli:\n');
    const topN = sorted.slice(0, 8);
    for (const s of topN) {
        const tag = s.category === 'core' ? '🟢' : s.category === 'heavy' ? '🟣' : '🟡';
        console.log(
            `    ${tag} ${(s.id ?? '?').padEnd(28)} cost: ~${String(s.cost ?? 0).padStart(6)} t`
        );
    }

    const coreOnly = sorted.filter((s) => s.category === 'core');
    const coreCost = coreOnly.reduce((sum, s) => sum + (s.cost ?? 0), 0);
    const allCost = sorted.reduce((sum, s) => sum + (s.cost ?? 0), 0);
    console.log('\n  Core baseline:', `~${coreCost} tokens`);
    console.log('  All-loaded maximum:', `~${allCost} tokens`);

    console.log('\n══════════════════════════════════════════════\n');
}

function cmdCost(skillId) {
    if (!skillId) {
        process.stderr.write('\n  ✗ Użycie: cost <skill_id>\n\n');
        process.exit(1);
    }
    const manifest = loadManifest();
    const skills = manifest.skills ?? [];
    const skill = skills.find((s) => s.id === skillId);
    if (!skill) {
        process.stderr.write(`  ✗ Nie ma skilla id="${skillId}"\n\n`);
        process.exit(1);
    }

    // transitive deps
    const visited = new Set();
    function resolveCost(id) {
        if (visited.has(id)) return 0;
        visited.add(id);
        const s = skills.find((x) => x.id === id);
        if (!s) return 0;
        let sum = s.cost ?? 0;
        for (const d of s.depends_on ?? []) sum += resolveCost(d);
        return sum;
    }

    const direct = skill.cost ?? 0;
    const total = resolveCost(skillId);
    console.log(`\n  Skill: ${skillId}`);
    console.log(`    Direct cost:    ~${direct}`);
    console.log(`    With deps:      ~${total}`);
    console.log(`    Deps:           ${JSON.stringify(skill.depends_on ?? [])}`);
    console.log(`    Category:       ${skill.category}`);
    console.log(`    Auto-loaded:    ${!!skill.auto_load}`);
    console.log(`    Invoke-only:    ${!!skill.invoke_only}`);
    console.log('\n');
}

function cmdDeps(skillId) {
    if (!skillId) {
        process.stderr.write('\n  ✗ Użycie: deps <skill_id>\n\n');
        process.exit(1);
    }
    const manifest = loadManifest();
    const skills = manifest.skills ?? [];
    const skill = skills.find((s) => s.id === skillId);
    if (!skill) {
        process.stderr.write(`  ✗ Nie ma skilla id="${skillId}"\n\n`);
        process.exit(1);
    }
    console.log(`\n  Dep tree for: ${skillId}\n`);

    function show(id, depth = 0) {
        const s = skills.find((x) => x.id === id);
        if (!s) return;
        console.log(
            '  '.repeat(depth) +
                (depth === 0 ? '📦 ' : '└─ ') +
                id +
                `  (~${s.cost ?? 0})`
        );
        for (const d of s.depends_on ?? []) show(d, depth + 1);
    }

    show(skillId);
    console.log('\n');
}

function cmdValidate() {
    const manifest = loadManifest();
    const errors = [];

    // 1. Schema version
    if (manifest.schema_version !== 1) {
        errors.push(`schema_version !== 1 (got: ${manifest.schema_version ?? 'unset'})`);
    }

    // 2. Skills are objects with `id`
    const skills = manifest.skills ?? [];
    const ids = new Set();
    for (const s of skills) {
        if (!s || typeof s !== 'object') {
            errors.push(`Skill wpis nie jest obiektem: ${JSON.stringify(s)}`);
            continue;
        }
        if (!s.id) errors.push(`Skill bez 'id': ${JSON.stringify(s)}`);
        if (ids.has(s.id)) errors.push(`Duplikat id '${s.id}'`);
        ids.add(s.id);
        if (s.category && !['core', 'feature', 'heavy'].includes(s.category)) {
            errors.push(`Skill '${s.id}': nieznana kategoria '${s.category}'`);
        }
    }

    // 3. depends_on references exist
    for (const s of skills) {
        if (!s || !s.depends_on) continue;
        for (const d of s.depends_on) {
            if (!ids.has(d)) errors.push(`Skill '${s.id}' dep '${d}' nie istnieje`);
        }
    }

    // 4. Cycles detection
    function cyclePath(start) {
        const path = [];
        const seen = new Set();
        function dfs(id) {
            if (path.includes(id)) return path.concat(id);
            if (seen.has(id)) return null;
            seen.add(id);
            path.push(id);
            const s = skills.find((x) => x.id === id);
            if (!s) return null;
            for (const d of s.depends_on ?? []) {
                const r = dfs(d);
                if (r) return r;
            }
            path.pop();
            return null;
        }
        return dfs(start);
    }
    for (const s of skills) {
        if (!s) continue;
        const cyc = cyclePath(s.id);
        if (cyc) errors.push(`Cycle detected: ${cyc.join(' → ')}`);
    }

    // 5. Source files exist (where applies)
    for (const s of skills) {
        if (!s || !s.source) continue;
        if (s.source.startsWith('profile:') || s.source.startsWith('http')) continue;
        const sp = resolve(ROOT, s.source);
        if (!existsSync(sp)) {
            console.warn(`  ⚠ Skill '${s.id}': source '${s.source}' NIE istnieje`);
        }
    }

    console.log('\n══════════════════════════════════════════════');
    console.log('  Manifest Validation Report');
    console.log('══════════════════════════════════════════════\n');

    if (errors.length === 0) {
        console.log('  ✓ Poprawny manifest — błędów: 0');
    } else {
        console.log(`  ✗ ZNALEZIONO ${errors.length} błędów:\n`);
        for (const e of errors) console.log(`  • ${e}`);
    }
    console.log('\n══════════════════════════════════════════════\n');

    process.exit(errors.length === 0 ? 0 : 1);
}

// ── Dispatcher ──

const [, , cmd, ...args] = process.argv;

if (!cmd || cmd === '--help' || cmd === '-h') {
    console.log(
        '\n  Hermes Skills Manifest CLI\n' +
            '\n  Komendy:\n' +
            '    build-manifest       skanuj + raport (non-mutating)\n' +
            '    stats                top-N najdroższych skilli\n' +
            '    cost <skill_id>      bezpośredni koszt + transitive deps\n' +
            '    deps <skill_id>      drzewo zależności\n' +
            '    validate             schema + cykle + missing sources\n' +
            '\n  SSoT: .hermes/skills/_manifest.yaml\n' +
            '  Ten CLI NIE modyfikuje manifestu — tylko raportuje/waliduje.\n'
    );
    process.exit(0);
}

switch (cmd) {
    case 'build-manifest':
        cmdBuildManifest();
        break;
    case 'stats':
        cmdStats();
        break;
    case 'cost':
        cmdCost(args[0]);
        break;
    case 'deps':
        cmdDeps(args[0]);
        break;
    case 'validate':
        cmdValidate();
        break;
    default:
        process.stderr.write(`  ✗ Nieznana komenda: ${cmd}\n`);
        process.exit(1);
}
