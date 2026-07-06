#!/usr/bin/env node
/**
 * skill-cli.mjs (v3) — CLI do budowy/walidacji/planowania kontekstu z manifestem.
 *
 * v3 zmiany:
 *   - NEW: build-cost      -- czyta SKILL.md i oblicza `cost` (nie ręczny)
 *   - NEW: plan            -- 6-stage Context Planner (intent→capabilities→skills→deps→budget)
 *   - NEW: capabilities    -- inverse index capabilities → skills (capability resolver)
 *   - NEW: validate        -- v2 schema (typed deps, capabilities, version, checksum)
 *   - CHANGED: stats       -- pomija skills_bez_utility, raportuje avg_ratio
 *
 * Komendy:
 *   build-cost                 oblicz koszty wszystkich skills (wyłusk z SKILL.md)
 *   plan "<intent>"            uruchom Context Planner 6-staged
 *   capabilities               inverse index capabilities → skills
 *   validate                   schema v2 (typed deps, capabilities, version)
 *   stats                      per-category + top utility/cost ratio
 *   cost <id>                  direct + transitive
 *   deps <id>                  drzewo deps
 *   build-manifest             (legacy v1, alias: stats)
 *
 *   npm run skills:plan "rozwiąż bug w excelu (paste)"
 *   npm run skills:capabilities
 */

import { readFileSync, existsSync, writeFileSync } from 'fs';
import { resolve, join } from 'path';
import yaml from 'js-yaml';

const ROOT = resolve(process.cwd());
const MANIFEST_PATH = resolve(ROOT, '.hermes', 'skills', '_manifest.yaml');
const CLASSIFIER_PATH = resolve(ROOT, '.hermes', 'skills', '_classifier.md');

// ── Helpers ──

function readYAML(text) {
    return yaml.load(text);
}

function approxTokensFromBytes(bytes) {
    return Math.ceil(bytes / 0.75);
}

function resolveInstallPath(src) {
    if (!src) return null;
    if (src.startsWith('profile:')) {
        // profile:pv:path/to/skill
        const parts = src.split(':');
        const sub = parts.slice(2).join(':');
        return [
            'C:\\Users\\blody\\AppData\\Local\\hermes\\profiles\\pv\\skills',
            ...parts.slice(1, 2),
            sub,
            'SKILL.md'
        ]
            .filter(Boolean)
            .join('\\');
    }
    if (src.startsWith('http')) return src;
    return resolve(ROOT, src);
}

function loadSkillBytes(skill) {
    if (!skill.source) return null;
    if (skill.source.startsWith('http')) return null;
    const p = resolveInstallPath(skill.source);
    if (!p || !existsSync(p)) return null;
    return readFileSync(p, 'utf-8').length;
}

function loadManifest() {
    if (!existsSync(MANIFEST_PATH)) {
        process.stderr.write(`\n  ✗ Brak manifestu: ${MANIFEST_PATH}\n\n`);
        process.exit(1);
    }
    return readYAML(readFileSync(MANIFEST_PATH, 'utf-8'));
}

// ── Commands ──

function cmdBuildCost() {
    const manifest = loadManifest();
    const skills = manifest.skills ?? [];

    const rows = skills
        .filter((s) => s && typeof s === 'object')
        .map((s) => {
            const bytes = loadSkillBytes(s);
            const cost = bytes ? approxTokensFromBytes(bytes) : null;
            const utility =
                typeof s.utility === 'number' ? s.utility : (manifest.defaults?.utility ?? 50);
            const ratio = cost && utility > 0 ? cost / utility : Infinity;
            return {
                id: s.id,
                cat: s.category ?? 'feature',
                cost,
                utility,
                ratio
            };
        });

    rows.sort((a, b) => b.cost - a.cost);

    console.log('\n══════════════════════════════════════════════');
    console.log('  Build-Cost Report (computed)');
    console.log('══════════════════════════════════════════════\n');

    console.log(`  Id                                    | Cost       | Util | Ratio    `);
    console.log(`  ${'-'.repeat(80)}`);
    for (const r of rows) {
        const cost = r.cost === null ? '?     ' : String(r.cost).padStart(6);
        const util = String(r.utility).padStart(4);
        const ratio = isFinite(r.ratio) ? r.ratio.toFixed(1).padStart(7) : '   inf';
        console.log(`  ${r.id.padEnd(40)} | ${cost} t  | ${util} | ${ratio}`);
    }

    console.log('');

    // Stats per category
    const byCat = {};
    for (const r of rows) {
        if (!byCat[r.cat]) byCat[r.cat] = { count: 0, cost: 0, util: 0 };
        byCat[r.cat].count++;
        byCat[r.cat].cost += r.cost ?? 0;
        byCat[r.cat].util += r.utility;
    }
    console.log('  By category:');
    for (const [cat, s] of Object.entries(byCat)) {
        const avgU = (s.util / s.count).toFixed(1);
        console.log(
            `    ${cat.padEnd(14)} ${String(s.count).padStart(2)} sk  ${String(s.cost).padStart(7)} t  avg_util ${avgU}`
        );
    }

    const totalCore = byCat['core']?.cost ?? 0;
    const totalAll = rows.reduce((s, r) => s + (r.cost ?? 0), 0);
    const cap = manifest.policies?.cap_total_cost_tokens;
    const overCap = cap && totalAll > cap ? ' (OVER BUDGET)' : '';

    console.log('');
    console.log(`  Core baseline (auto-load):      ${totalCore} t`);
    console.log(`  All-loaded maximum:             ${totalAll} t${overCap}`);
    if (cap) {
        console.log(`  Budget cap:                     ${cap} t`);
        if (totalAll > cap) {
            const savings = Math.round(((totalAll - cap) / totalAll) * 100);
            console.log(`  Optimization needed:              ${savings}% reduction`);
        }
    }
    console.log('\n══════════════════════════════════════════════\n');
}

function cmdCapabilities() {
    const manifest = loadManifest();
    const skills = manifest.skills ?? [];

    const idx = {}; // capability -> [{id, utility, cost}]
    for (const s of skills) {
        if (!s || !Array.isArray(s.capabilities)) continue;
        for (const cap of s.capabilities) {
            if (!idx[cap]) idx[cap] = [];
            idx[cap].push({
                id: s.id,
                utility: s.utility ?? 50,
                cat: s.category
            });
        }
    }

    console.log('\n══════════════════════════════════════════════');
    console.log('  Capability Resolver Index');
    console.log('══════════════════════════════════════════════\n');

    const caps = Object.keys(idx).sort();
    for (const cap of caps) {
        const skills = idx[cap].sort((a, b) => b.utility - a.utility);
        const list = skills
            .map((s, i) => `${i === 0 ? '★' : '·'} ${s.id} (${s.cat}, ut=${s.utility})`)
            .join(', ');
        console.log(`  ${cap.padEnd(28)} → ${list}`);
    }

    console.log('');
    console.log(`  Total capabilities: ${caps.length}`);
    console.log(
        `  Total skills: ${Object.values(idx).reduce((n, s) => n + s.length, 0)} assignments`
    );
    console.log('\n══════════════════════════════════════════════\n');
}

function cmdPlan(usrIntent = null) {
    const inp = usrIntent;
    if (!inp) {
        process.stderr.write('\n  ✗ Użycie: plan "<intent>"\n\n');
        process.exit(1);
    }

    const manifest = loadManifest();
    const skills = manifest.skills ?? [];

    // ─── Stage 1: Intent Classifier ───
    console.log('\n[Stage 1] Intent Classifier...');
    let matched = null;
    let matchScore = 0;
    if (existsSync(CLASSIFIER_PATH)) {
        const cl = readFileSync(CLASSIFIER_PATH, 'utf-8');
        // Allow leading whitespace (YAML list item)
        const it = [...cl.matchAll(/^\s*- intent:\s*"([^"]+)"/gm)];
        const inpLower = inp.toLowerCase();
        const inpWords = inpLower.split(/\s+/).filter((w) => w.length > 2);
        for (const hit of it) {
            const ev = hit[1].toLowerCase();
            const evWords = ev.split(/\s+/).filter((w) => w.length > 2);
            // score: how many of inpWords appear in ev or vice versa
            let score = 0;
            for (const w of inpWords) if (ev.includes(w)) score++;
            for (const w of evWords) if (inpLower.includes(w)) score++;
            if (score > matchScore) {
                matchScore = score;
                matched = hit[1];
            }
        }
    }
    const matchedIntent = matched ?? 'general_help';
    console.log(`  matched intent (score=${matchScore}): "${matchedIntent}"`);

    // ─── Stage 2: Capability Resolver ───
    console.log('[Stage 2] Capability Resolver...');
    const capIdx = {}; // cap -> skills
    for (const s of skills) {
        if (!s || !Array.isArray(s.capabilities)) continue;
        for (const cap of s.capabilities) {
            (capIdx[cap] = capIdx[cap] ?? []).push(s);
        }
    }

    // ─── Stage 3: Skill Resolver ───
    console.log('[Stage 3] Skill Resolver...');
    // Skile bezpośrednio po capacity lub po znalezionego intent
    const scoringSkills = skills.filter((s) => s && typeof s === 'object');
    const intentWords = matchedIntent.split(/\s+/);
    let scored = scoringSkills.map((s) => {
        // heuristic match: id-contains + category match
        const idHit = intentWords.some((w) => w.length > 3 && s.id.includes(w));
        const llmSoft = s.utility ?? 50;
        return { skill: s, score: idHit ? llmSoft * 1.2 : llmSoft };
    });
    scored.sort((a, b) => b.score - a.score);
    let picked = scored
        .slice(0, manifest.policies?.max_skills_per_session ?? 6)
        .filter((x) => x.score > 0)
        .map((x) => x.skill);

    // Pre-pin core always-loaded
    const core = scoringSkills.filter((s) => s.auto_load);
    picked = [...core, ...picked.filter((p) => !core.includes(p))];

    // ─── Stage 4: Dependency Resolver ───
    console.log('[Stage 4] Dependency Resolver...');
    const transitive = new Set(picked.map((s) => s.id));
    function walkDeps(s, acc = new Set()) {
        if (!s) return acc;
        if (acc.has(s.id)) return acc;
        acc.add(s.id);
        for (const t of ['requires', 'optional']) {
            for (const d of s[t] ?? []) {
                const ds = skills.find((x) => x.id === d);
                if (ds) walkDeps(ds, acc);
            }
        }
        return acc;
    }
    for (const p of picked) walkDeps(p, transitive);
    const allLoaded = scoringSkills.filter((s) => transitive.has(s.id));
    const totalSkillsLoaded = allLoaded.length;
    console.log(`  transitive closure: ${totalSkillsLoaded} skills`);

    // ─── Stage 5: Budget Optimizer ───
    console.log('[Stage 5] Budget Optimizer...');
    const cap = manifest.policies?.cap_total_cost_tokens ?? 100000;
    function costOf(s) {
        const b = loadSkillBytes(s);
        return b ? approxTokensFromBytes(b) : 0;
    }
    let total = allLoaded.reduce((s, sk) => s + costOf(sk), 0);
    let dropped = [];
    if (total > cap) {
        // Drop drop_lowest_utility_cost_ratio aż mieści się
        const sorted = allLoaded
            .filter((s) => !s.auto_load)
            .map((s) => ({ s, ratio: costOf(s) / (s.utility ?? 50) }))
            .sort((a, b) => b.ratio - a.ratio); // worst ratio first
        while (total > cap && sorted.length > 0) {
            const victim = sorted.shift();
            if (!victim) break;
            dropped.push(victim.s);
            total -= costOf(victim.s);
        }
    }
    console.log(`  total cost: ${total} t (cap: ${cap} t)`);
    console.log(`  dropped for budget: ${dropped.map((d) => d.id).join(', ') || '(none)'}`);

    // ─── Output ───
    console.log('\n[Stage 6] Output (Hermes-ready context):');
    const final = allLoaded.filter((s) => !dropped.includes(s));
    console.log('\n  Skill plan:');
    for (const s of final) {
        const c = costOf(s);
        const util = s.utility ?? 50;
        const ratio = c / Math.max(util, 1);
        const tag = s.auto_load ? '★' : s.invoke_only ? '⚐' : '·';
        console.log(
            `    ${tag} ${(s.id ?? '?').padEnd(28)} cat=${(s.category ?? '?').padEnd(8)} cost=${String(c).padStart(6)} t  util=${util}  ratio=${ratio.toFixed(1)}`
        );
    }
    console.log(`\n  TOTAL: ${final.length} skills, ~${total} tokens`);
    console.log('\n══════════════════════════════════════════════\n');
}

function cmdValidate() {
    const manifest = loadManifest();
    const errors = [];

    if (manifest.schema_version !== 2 && manifest.schema_version !== 3) {
        errors.push(`schema_version musi być 2 lub 3 (got: ${manifest.schema_version ?? 'unset'})`);
    }

    const skills = manifest.skills ?? [];
    const ids = new Set();

    for (const s of skills) {
        if (!s || typeof s !== 'object') {
            errors.push(`Skill wpis nie jest obiektem: ${JSON.stringify(s)}`);
            continue;
        }
        if (!s.id) errors.push(`Skill bez 'id'`);
        if (ids.has(s.id)) errors.push(`Duplikat id '${s.id}'`);
        ids.add(s.id);

        // v2 specific
        if (!s.version) errors.push(`Skill '${s.id}': brak 'version'`);
        if (!Array.isArray(s.capabilities) || s.capabilities.length === 0) {
            errors.push(`Skill '${s.id}': brak / puste 'capabilities'`);
        }
        if (typeof s.utility !== 'number' || s.utility < 0 || s.utility > 100) {
            errors.push(`Skill '${s.id}': utility ∈ [0,100] (got: '${s.utility}')`);
        }
        const validCats = Object.keys(manifest.categories ?? {});
        if (s.category && !validCats.includes(s.category)) {
            errors.push(`Skill '${s.id}': nieznana kategoria '${s.category}'`);
        }

        // Typed deps
        const allowedKeys = ['requires', 'optional', 'conflicts', 'before', 'after'];
        const depFields = allowedKeys.filter((k) => Array.isArray(s[k]));
        for (const d of s.requires ?? []) {
            if (!ids.has(d)) errors.push(`Skill '${s.id}' requires '${d}' nie istnieje`);
        }
        for (const d of s.conflicts ?? []) {
            if (!ids.has(d)) errors.push(`Skill '${s.id}' conflicts '${d}' nie istnieje`);
        }
    }

    // Conflicts detected?
    for (const a of skills) {
        if (!a || !Array.isArray(a.conflicts)) continue;
        for (const cid of a.conflicts) {
            const b = skills.find((x) => x.id === cid);
            if (b && Array.isArray(b.conflicts) && b.conflicts.includes(a.id)) {
                // Mutual conflict - usually OK
            }
        }
    }

    // Cycles
    function hasCycle(start) {
        const path = new Set();
        function dfs(id) {
            if (path.has(id)) return true;
            path.add(id);
            const s = skills.find((x) => x.id === id);
            if (!s) return false;
            for (const d of s.requires ?? []) if (dfs(d)) return true;
            path.delete(id);
            return false;
        }
        return dfs(start);
    }
    for (const s of skills) {
        if (s && hasCycle(s.id)) errors.push(`Cycle w requires dla '${s.id}'`);
    }

    console.log('\n══════════════════════════════════════════════');
    console.log('  Manifest Validation (v2/v3)');
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

function cmdStats() {
    const manifest = loadManifest();
    const skills = manifest.skills ?? [];

    console.log('\n══════════════════════════════════════════════');
    console.log('  Skill Stats (legacy - preferuj build-cost)');
    console.log('══════════════════════════════════════════════\n');

    const sorted = [...skills]
        .filter((s) => s && typeof s === 'object')
        .map((s) => {
            const bytes = loadSkillBytes(s);
            const c = bytes ? approxTokensFromBytes(bytes) : null;
            const u = s.utility ?? 50;
            return { id: s.id, cost: c, utility: u, category: s.category };
        })
        .sort((a, b) => (b.cost ?? 0) - (a.cost ?? 0));

    console.log('  Top-8 najdroższych:\n');
    for (const s of sorted.slice(0, 8)) {
        const tag = s.category === 'core' ? '🟢' : s.category === 'heavy' ? '🟣' : '🟡';
        console.log(
            `    ${tag} ${(s.id ?? '?').padEnd(28)} cost: ${String(s.cost ?? 0).padStart(6)} t  util: ${s.utility}`
        );
    }

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
    let total = 0;
    const visited = new Set();
    function resolve(id) {
        if (visited.has(id)) return;
        visited.add(id);
        const s = skills.find((x) => x.id === id);
        if (!s) return;
        total += loadSkillBytes(s) ? approxTokensFromBytes(loadSkillBytes(s)) : 0;
        for (const d of s.requires ?? []) resolve(d);
    }
    resolve(skillId);

    console.log(`\n  Skill: ${skillId}`);
    console.log(`    category:    ${skill.category}`);
    console.log(`    version:     ${skill.version ?? '?'}`);
    console.log(`    utility:     ${skill.utility ?? 50}`);
    console.log(`    requires:    ${JSON.stringify(skill.requires ?? [])}`);
    console.log(`    total cost:  ~${total} t (with deps)`);
    console.log('\n');
}

function cmdDeps(skillId, depth = 0, seen = new Set()) {
    if (!skillId) {
        process.stderr.write('\n  ✗ Użycie: deps <skill_id>\n\n');
        process.exit(1);
    }
    const manifest = loadManifest();
    const skills = manifest.skills ?? [];
    const skill = skills.find((s) => s.id === skillId);
    if (!skill) {
        process.stderr.write(`  ✗ Brak skilla: ${skillId}\n\n`);
        process.exit(1);
    }
    if (depth === 0) console.log(`\n  Dep tree: ${skillId}\n`);
    if (seen.has(skillId)) {
        console.log('  '.repeat(depth + 1) + `(→cycle: ${skillId})`);
        return;
    }
    seen.add(skillId);
    console.log('  '.repeat(depth) + (depth === 0 ? '📦 ' : '└─ ') + `${skillId}`);

    const reqs = skill.requires ?? [];
    if (reqs.length === 0) return;
    for (const d of reqs) cmdDeps(d, depth + 1, new Set(seen));
    console.log('');
}

// ── v3 Provider Resolver ──

function cmdProviderResolve(cap) {
    if (!cap) {
        process.stderr.write('\n  ✗ Uzycie: provider-resolve <capability>\n\n');
        process.exit(1);
    }
    const manifest = loadManifest();
    const provs = manifest.providers || {};
    const entry = provs[cap];
    if (!entry) {
        console.log(`\n  Brak providerow dla capability: '${cap}'`);
        console.log('  Dostepne:', Object.keys(provs).join(', ') || '(brak)');
        console.log('');
        process.exit(0);
    }
    console.log(`\n  Provider Resolver -> ${cap}\n`);
    const tiers = { lite: 0, standard: 1, pro: 2, experimental: 3 };
    const sorted = (entry.implementations || []).sort(
        (a, b) => (tiers[a.tier] || 1) - (tiers[b.tier] || 1)
    );
    for (const imp of sorted) {
        const sk = (manifest.skills || []).find((s) => s.id === imp.skill_id);
        const cost = sk ? approxTokensFromBytes(loadSkillBytes(sk) || 0) : '?';
        const util = (sk && sk.utility_state && sk.utility_state.total) || (sk && sk.utility) || 50;
        const conf = imp.confidence ?? sk?.confidence ?? '?';
        const lat = imp.latency_ms ?? sk?.latency_ms ?? '?';
        console.log(
            `  ${imp.tier.padEnd(12)} ${imp.skill_id.padEnd(28)} util=${String(util).padStart(3)}  conf=${String(conf).padStart(4)}  lat=${String(lat).padStart(4)}ms  cost~${String(cost).padStart(6)}t`
        );
    }
    console.log(`\n  default_tier: ${entry.default_tier || 'standard'}`);
    console.log('');
}

// ── v3 Feedback Record ──

function cmdFeedbackRecord() {
    const fbPath = resolve(ROOT, '.hermes', 'skills', '_feedback.json');
    let fb = { schema: 1, history: [] };
    if (existsSync(fbPath)) {
        try {
            fb = JSON.parse(readFileSync(fbPath, 'utf-8'));
        } catch {}
    }
    const record = {
        task: process.env.FEEDBACK_TASK || '(nie podano)',
        outcome: 'unknown',
        skills_loaded: [],
        matched_intent: process.env.FEEDBACK_INTENT || '',
        tokens_estimated: 0,
        duration_ms: 0,
        errors: [],
        timestamp: new Date().toISOString()
    };
    fb.history.push(record);
    writeFileSync(fbPath, JSON.stringify(fb, null, 2));
    console.log(`\n  Feedback record zapisany (historia: ${fb.history.length})`);
    console.log(`    task: ${record.task}`);
    console.log(`    outcome: ${record.outcome}`);
    console.log(`    skills: ${record.skills_loaded.join(', ') || '(brak)'}`);
    console.log('');
}

// ── v3 Feedback Show ──

function cmdFeedbackShow() {
    const fbPath = resolve(ROOT, '.hermes', 'skills', '_feedback.json');
    if (!existsSync(fbPath)) {
        console.log('\n  Brak _feedback.json\n');
        return;
    }
    let fb;
    try {
        fb = JSON.parse(readFileSync(fbPath, 'utf-8'));
    } catch {
        console.log('\n  _feedback.json uszkodzony\n');
        return;
    }
    const hist = fb.history || [];
    if (hist.length === 0) {
        console.log('\n  Feedback historia: pusta (0 wpisow)\n');
        return;
    }
    const skillStats = {};
    for (const r of hist) {
        for (const sid of r.skills_loaded || []) {
            if (!skillStats[sid]) skillStats[sid] = { count: 0, success: 0, totalTokens: 0 };
            skillStats[sid].count++;
            if (r.outcome === 'success') skillStats[sid].success++;
            skillStats[sid].totalTokens += r.tokens_estimated || 0;
        }
    }
    console.log('\n══════════════════════════════════════════════');
    console.log(`  Feedback Report (${hist.length} records)`);
    console.log('══════════════════════════════════════════════\n');
    console.log('  Skills:');
    const sorted = Object.entries(skillStats).sort((a, b) => b[1].count - a[1].count);
    for (const [sid, st] of sorted) {
        const sr = st.count > 0 ? ((st.success / st.count) * 100).toFixed(0) : '?';
        const avgT = st.count > 0 ? Math.round(st.totalTokens / st.count) : '?';
        console.log(
            `    ${sid.padEnd(28)} loaded=${String(st.count).padStart(3)} success=${sr}%  avg_tokens=${String(avgT).padStart(6)}`
        );
    }
    console.log('\n  Last 5 outcomes:');
    const last5 = hist.slice(-5).reverse();
    for (const r of last5) {
        const ts = (r.timestamp || '').slice(0, 19).replace('T', ' ');
        const outcome = r.outcome === 'success' ? '+' : r.outcome === 'partial' ? '~' : '-';
        console.log(
            `    ${outcome} ${ts}  ${r.task.slice(0, 60).padEnd(60)} skills=${(r.skills_loaded || []).length}`
        );
    }
    console.log('');
}

// ── v3 Utility Recalc ──

function cmdUtilityRecalc() {
    const fbPath = resolve(ROOT, '.hermes', 'skills', '_feedback.json');
    const manifest = loadManifest();
    const doWrite = process.argv.includes('--write');
    let fb = { history: [] };
    if (existsSync(fbPath)) {
        try {
            fb = JSON.parse(readFileSync(fbPath, 'utf-8'));
        } catch {}
    }
    const hist = fb.history || [];
    const now = new Date();
    const skillData = {};
    for (const r of hist) {
        for (const sid of r.skills_loaded || []) {
            if (!skillData[sid])
                skillData[sid] = { total: 0, successCount: 0, lastUsed: null, count: 0 };
            skillData[sid].total++;
            if (r.outcome === 'success') skillData[sid].successCount++;
            skillData[sid].count++;
            const ts = r.timestamp ? new Date(r.timestamp) : null;
            if (ts && (!skillData[sid].lastUsed || ts > skillData[sid].lastUsed))
                skillData[sid].lastUsed = ts;
        }
    }
    console.log('\n══════════════════════════════════════════════');
    console.log('  Utility Recalc (dry-run)');
    console.log('══════════════════════════════════════════════\n');
    let changedAny = false;
    for (const s of manifest.skills || []) {
        if (!s) continue;
        const sd = skillData[s.id];
        let base = s.utility_state?.base ?? s.utility ?? 50;
        let historyBonus = 0,
            successBonus = 0,
            recencyPenalty = 0;
        if (sd && sd.total > 0) {
            historyBonus = Math.round(sd.total * 0.5);
            successBonus = Math.round((sd.successCount / sd.total) * 10);
            if (sd.lastUsed) {
                const daysSince = (now - sd.lastUsed) / (1000 * 60 * 60 * 24);
                recencyPenalty = Math.min(Math.round(daysSince / 15), 20);
            }
        }
        const total = Math.max(
            1,
            Math.min(100, base + historyBonus + successBonus - recencyPenalty)
        );
        const oldTotal = s.utility_state?.total ?? s.utility ?? 50;
        if (Math.abs(oldTotal - total) > 1) {
            changedAny = true;
            console.log(
                `  ${s.id.padEnd(28)} ${String(oldTotal).padStart(3)} -> ${String(total).padStart(3)} (base=${base} hist=+${historyBonus} succ=+${successBonus} rec=-${recencyPenalty})`
            );
            if (doWrite) {
                if (!s.utility_state) s.utility_state = {};
                s.utility_state.base = base;
                s.utility_state.history_bonus = historyBonus;
                s.utility_state.success_rate_bonus = successBonus;
                s.utility_state.recency_penalty = recencyPenalty;
                s.utility_state.total = total;
                s.utility_state.last_updated =
                    now.toISOString().replace('T', ' ').slice(0, 19) + 'Z';
            }
        }
    }
    if (!changedAny) console.log('  (brak zmian)');
    if (doWrite && changedAny) {
        writeFileSync(MANIFEST_PATH, yaml.dump(manifest, { indent: 2, lineWidth: -1 }));
        console.log('\n  Manifest zaktualizowany (--write)');
    } else {
        console.log('\n  dry-run: zadne zmiany nie zostaly zapisane.');
        console.log('  Uzyj --write by zatwierdzic.\n');
    }
    console.log('');
}

// ── Dispatcher ──

const [, , cmd, ...args] = process.argv;

if (!cmd || cmd === '--help' || cmd === '-h') {
    console.log(
        '\n  Hermes Skills Manifest CLI v3\n' +
            '\n  Komendy:\n' +
            '    build-cost                   oblicz koszty z SKILL.md (computed)\n' +
            '    plan "<intent>"              6-stage Context Planner (intent→plan)\n' +
            '    capabilities                 inverse index cap → skills\n' +
            '    validate                     schema v2 (typed deps, caps, version)\n' +
            '    stats                        per-category + top\n' +
            '    cost <skill_id>              direct + transitive\n' +
            '    deps <skill_id>              drzewo requires\n' +
            '    provider-resolve <capability>  resolve provider dla capability\n' +
            '    feedback-record              zapisz task outcome do _feedback.json\n' +
            '    feedback-show                raport metryk z feedback history\n' +
            '    utility-recalc [--write]     przelicz utility z dry-run/write\n' +
            '\n  SSoT: .hermes/skills/_manifest.yaml\n' +
            '  Classifier: .hermes/skills/_classifier.md (load_when, route rules)\n'
    );
    process.exit(0);
}

switch (cmd) {
    case 'build-cost':
    case 'build':
        cmdBuildCost();
        break;
    case 'plan':
        cmdPlan(args.join(' ').replace(/^["']|["']$/g, '') || null);
        break;
    case 'capabilities':
        cmdCapabilities();
        break;
    case 'validate':
        cmdValidate();
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
    case 'provider-resolve':
        cmdProviderResolve(args[0]);
        break;
    case 'feedback-record':
        cmdFeedbackRecord();
        break;
    case 'feedback-show':
        cmdFeedbackShow();
        break;
    case 'utility-recalc':
        cmdUtilityRecalc();
        break;
    case 'build-manifest':
        cmdStats();
        console.log('  Alias: build-manifest → stats (use build-cost for v3)');
        break;
    default:
        process.stderr.write(`  ✗ Nieznana komenda: ${cmd}\n`);
        process.exit(1);
}
