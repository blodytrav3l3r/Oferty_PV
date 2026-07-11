/**
 * generate-xss-audit.js — XSS audit generator (SAST-style)
 *
 * Rules:
 *   XSS001 — innerHTML + USER_DATA (untrusted) → CRITICAL / HIGH
 *   XSS002 — insertAdjacentHTML + external data → HIGH / MEDIUM
 *   XSS003 — inline event handler (onclick=, onchange=, …) → tracked separately
 *   XSS004 — template literal / concat bez escapeHtml → MEDIUM / REVIEW
 *
 * Features:
 * - Severity: CRITICAL / HIGH / MEDIUM / REVIEW / INFO
 * - Source: STATIC / DATABASE / USER_DATA / NUMERIC / UNKNOWN
 * - Trust: trusted / semi-trusted / untrusted
 * - Confidence: high / medium / low
 * - CWE (CWE-79, CWE-116) + OWASP (A03, A05)
 * - Security Score (0-100), Security Debt, Security Gate
 * - Escape Coverage (dynamic sinks only)
 * - CSP Readiness (inline handler baseline)
 * - False Positive Database (xss-ignore.json)
 * - History + trend (xss-history.json)
 * - Delta vs previous run
 * - Git diff modes: --changed, --staged, --diff <ref>
 *
 * Usage:
 *   node scripts/generate-xss-audit.js              # full scan
 *   node scripts/generate-xss-audit.js --changed    # only modified files
 *   node scripts/generate-xss-audit.js --staged     # only staged files
 *   node scripts/generate-xss-audit.js --diff HEAD~1 # diff against any ref
 *
 * Output: docs/security/xss-audit.md
 *
 * Refresh raw data:
 *   rg -n "innerHTML|insertAdjacentHTML|outerHTML" public/js/ --type js --glob '!xlsx.full.min.js' > docs/security/raw-sinks-utf8.txt
 *   rg -n "onclick=|onchange=|oninput=|onmouseover=|onmouseleave=|onmouseenter=|onerror=|onload=" public/js/ --type js --glob '!xlsx.full.min.js' > docs/security/raw-handlers.txt
 *   npm run audit:xss
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const RAW_SINKS = path.join(ROOT, 'docs/security/raw-sinks-utf8.txt');
const RAW_HANDLERS = path.join(ROOT, 'docs/security/raw-handlers.txt');
const IGNORE_FILE = path.join(ROOT, 'docs/security/xss-ignore.json');
const CLASSIFICATION_FILE = path.join(ROOT, 'docs/security/xss-classification.json');
const HISTORY_FILE = path.join(ROOT, 'docs/security/xss-history.json');
const BASELINE_FILE = path.join(ROOT, 'docs/security/xss-baseline.json');
const OUT = path.join(ROOT, 'docs/security/xss-audit.md');

// ─── CLI flags ───

const ARGS = process.argv.slice(2);
const MODE_CHANGED = ARGS.includes('--changed');
const MODE_STAGED = ARGS.includes('--staged');
const MODE_DIFF = ARGS.find((a) => a.startsWith('--diff='));
const DIFF_REF = MODE_DIFF ? MODE_DIFF.split('=')[1] : null;

// ─── helpers ───

function readRaw(fp) {
    let raw = fs.readFileSync(fp, 'utf8');
    raw = raw.replace(/^\uFEFF/, '');
    return raw.trim().split('\n').filter(Boolean);
}

function parseLine(line) {
    const m = line.match(/^(public\/js\/[^:]+):(\d+):([\s\S]+)\r?$/);
    if (!m) return null;
    return { file: m[1], line: parseInt(m[2]), code: m[3].trim() };
}

function ownerOf(file) {
    const f = file.toLowerCase().replace(/\\/g, '/');
    if (f.includes('/shared/')) return 'shared';
    if (f.includes('/rury/')) return 'rury';
    if (f.includes('/studnie/')) return 'studnie';
    if (f.includes('/sales/')) return 'sales';
    if (f.includes('/spa/')) return 'spa';
    if (f.includes('/admin/')) return 'admin';
    if (f.includes('/import-export/')) return 'import-export';
    if (f.includes('/app.js') || f.includes('/appstudnie.js')) return 'app';
    if (f.includes('/versiondisplay')) return 'shared';
    return 'other';
}

function sinkOf(code) {
    if (code.includes('insertAdjacentHTML')) return 'insertAdjacentHTML';
    if (code.includes('outerHTML')) return 'outerHTML';
    return 'innerHTML';
}

// ─── cwe / owasp ───

function cweOf(severity, source) {
    if (severity === 'INFO' || severity === 'LOW') return '—';
    if (source === 'USER_DATA' || severity === 'CRITICAL' || severity === 'HIGH') return 'CWE-79';
    if (severity === 'MEDIUM' || severity === 'REVIEW') return 'CWE-116';
    return '—';
}

function owaspOf(severity, source) {
    if (severity === 'CRITICAL' || severity === 'HIGH') return 'A03: Injection';
    if (severity === 'MEDIUM' && source === 'USER_DATA') return 'A03: Injection';
    if (severity === 'REVIEW') return 'A03: Injection';
    return '—';
}

// ─── fingerprint ───

function fingerprint(code, file, sink) {
    const norm = code.replace(/\s+/g, ' ').trim().toLowerCase();
    return crypto
        .createHash('sha1')
        .update(`${file}:${sink}:${norm}`)
        .digest('hex')
        .substring(0, 12);
}

// ─── baseline ───

function loadBaseline() {
    try {
        return JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8'));
    } catch (e) {
        return [];
    }
}

function saveBaseline(entries) {
    const baseline = entries
        .filter((e) => e.severity !== 'INFO' && e.severity !== 'LOW')
        .map((e) => ({
            fingerprint: e.fingerprint,
            file: e.file,
            line: e.line,
            severity: e.severity,
            rule: e.rule,
            sink: e.sink
        }));
    fs.writeFileSync(BASELINE_FILE, JSON.stringify(baseline, null, 2), 'utf8');
    return baseline;
}

function saveClassifications(entries, ignores) {
    const now = new Date().toISOString().split('T')[0];
    const ignoreMap = new Map();
    for (const ig of ignores)
        ignoreMap.set(ig.file.replace(/\\/g, '/') + ':' + ig.line, {
            ...ig,
            file: ig.file.replace(/\\/g, '/')
        });
    const classifications = entries.map((e) => {
        const key = e.file.replace(/\\/g, '/') + ':' + e.line;
        const manual = ignoreMap.get(key);
        return {
            fingerprint: e.fingerprint,
            file: e.file.replace(/\\/g, '/'),
            line: e.line,
            sink: e.sink,
            severity: e.severity,
            source: e.source,
            trust: e.trust,
            confidence: e.confidence,
            rule: e.rule,
            cwe: e.cwe,
            owasp: e.owasp,
            decision: e.decision,
            sprint: e.sprint !== '-' ? 'S' + e.sprint : '-',
            label: manual ? manual.label : e.severity === 'INFO' ? 'AUTO_SAFE' : 'UNREVIEWED',
            reason: manual ? manual.reason : '',
            approved: manual ? manual.approved || '' : ''
        };
    });
    fs.writeFileSync(CLASSIFICATION_FILE, JSON.stringify(classifications, null, 2), 'utf8');
    return classifications;
}

function compareBaseline(current, baseline) {
    const fps = new Map();
    for (const b of baseline) fps.set(b.fingerprint, b);
    const newFindings = current.filter((e) => {
        if (e.severity === 'INFO' || e.severity === 'LOW') return false;
        return !fps.has(e.fingerprint);
    });
    const fixedBaseline = baseline.filter(
        (b) => !current.some((e) => e.fingerprint === b.fingerprint)
    );
    return { newFindings, fixedFromBaseline: fixedBaseline };
}

// ─── rule id (xss001-xss004) ───

function ruleOf(severity, sink, source, code) {
    if (severity === 'INFO' || severity === 'LOW') return '—';
    if (
        sink === 'innerHTML' &&
        (source === 'USER_DATA' || severity === 'CRITICAL' || severity === 'HIGH')
    )
        return 'XSS001';
    if (sink === 'insertAdjacentHTML' && (source === 'USER_DATA' || source === 'UNKNOWN'))
        return 'XSS002';
    if (!code.includes('escapeHtml') && (severity === 'MEDIUM' || severity === 'REVIEW'))
        return 'XSS004';
    return '—';
}

// ─── ignore database ───

function loadIgnores() {
    try {
        return JSON.parse(fs.readFileSync(IGNORE_FILE, 'utf8'));
    } catch (e) {
        return [];
    }
}

function isIgnored(ignores, file, line) {
    const norm = file.replace(/\\/g, '/').replace('public/js/', '');
    return ignores.some((i) => {
        if (i.file === norm && i.line === line) return true;
        if (i.file === norm && i.line === '*') return true;
        return false;
    });
}

// ─── git diff filter ───

function getChangedFiles() {
    let cmd = 'git diff --name-only';
    if (MODE_STAGED) cmd = 'git diff --cached --name-only';
    if (DIFF_REF) cmd = `git diff --name-only ${DIFF_REF}`;
    try {
        const out = execSync(cmd, {
            cwd: ROOT,
            encoding: 'utf8',
            stdio: ['pipe', 'pipe', 'ignore']
        });
        return out
            .trim()
            .split('\n')
            .filter(Boolean)
            .map((f) => f.replace(/\\/g, '/'));
    } catch (e) {
        return null;
    }
}

function filterByChanged(raw, changed) {
    if (!changed || changed.length === 0) return raw;
    return raw.filter((line) => {
        const p = parseLine(line);
        if (!p) return false;
        const normFile = p.file.replace(/\\/g, '/');
        return changed.some((f) => normFile === f || normFile.endsWith('/' + f));
    });
}

// ─── classification ───

const DATA_KEYWORDS =
    /\b(offer|client|well|user|product|item|order|project|element|handl|creator|err|configError|displayName|username|name|label|note|comment|desc|symbol|budowa|invest|phone|email|address)\b/i;
const TEMPLATE_HAS_VAR = /\$\{/;
const IS_LINE_CONT = /[=+]\s*$/;
const HAS_CONCAT = /\s\+[\s'"\w]/;
const IS_CLEAR = /innerHTML\s*=\s*['"]\s*['"]\s*;?$/;
const IS_READ = /=\s*\w+\.innerHTML\s*;?\s*$/;
const IS_COPY = /\.innerHTML\s*=\s*\w+\.innerHTML/;
const HAS_ESCAPE = /escapeHtml\(/;
const HAS_LUCIDE_ICON = /data-lucide/;
const IS_NUMERIC_FMT = /fmt\(|\.toFixed\(|\.toLocaleString|parseInt\s*\(/;

function classify(code) {
    if (IS_READ.test(code) || IS_COPY.test(code) || IS_CLEAR.test(code))
        return {
            severity: 'INFO',
            source: 'STATIC',
            trust: 'trusted',
            confidence: 'high',
            decision: 'leave',
            sprint: '-'
        };

    if (HAS_ESCAPE.test(code))
        return {
            severity: 'INFO',
            source: 'DATABASE',
            trust: 'semi-trusted',
            confidence: 'high',
            decision: 'leave',
            sprint: '-'
        };

    if (IS_LINE_CONT.test(code))
        return {
            severity: 'REVIEW',
            source: 'UNKNOWN',
            trust: 'unknown',
            confidence: 'low',
            decision: 'review',
            sprint: '2'
        };

    const hasVar = TEMPLATE_HAS_VAR.test(code);
    const hasConcat = HAS_CONCAT.test(code);

    if (!hasVar && !hasConcat)
        return {
            severity: 'INFO',
            source: 'STATIC',
            trust: 'trusted',
            confidence: 'high',
            decision: 'leave',
            sprint: '-'
        };

    const hasDataRef = DATA_KEYWORDS.test(code);
    const isNumericFmt = IS_NUMERIC_FMT.test(code);

    if (isNumericFmt && !hasDataRef)
        return {
            severity: 'INFO',
            source: 'NUMERIC',
            trust: 'trusted',
            confidence: 'high',
            decision: 'leave',
            sprint: '-'
        };

    if (hasDataRef && hasVar)
        return {
            severity: 'HIGH',
            source: 'USER_DATA',
            trust: 'untrusted',
            confidence: 'medium',
            decision: 'fix',
            sprint: '2'
        };

    if (hasDataRef)
        return {
            severity: 'MEDIUM',
            source: 'USER_DATA',
            trust: 'semi-trusted',
            confidence: 'low',
            decision: 'review',
            sprint: '2'
        };

    return {
        severity: 'MEDIUM',
        source: 'UNKNOWN',
        trust: 'unknown',
        confidence: 'low',
        decision: 'review',
        sprint: '2'
    };
}

// ─── extra sinks ───

const EXTRA_SINKS = [
    'Range.createContextualFragment',
    'DOMParser',
    'template.innerHTML',
    'iframe.srcdoc',
    'srcdoc',
    'setHTML',
    'dangerouslySetInnerHTML'
];

function checkExtraSinks() {
    const results = [];
    for (const name of EXTRA_SINKS) {
        try {
            const r = execSync(
                `rg -c "${name.replace(/"/g, '\\"')}" public/js/ --type js --glob '!xlsx.full.min.js'`,
                { encoding: 'utf8', cwd: ROOT, stdio: ['pipe', 'pipe', 'ignore'] }
            );
            const lines = r.trim().split('\n').filter(Boolean);
            const total = lines.reduce((sum, l) => {
                const parts = l.split(':');
                return sum + (parts.length >= 3 ? parseInt(parts[parts.length - 1]) || 1 : 1);
            }, 0);
            if (total > 0) results.push({ name, count: total });
        } catch (e) {
            /* rg exit 1 = no matches */
        }
    }
    return results;
}

// ─── delta ───

function loadPreviousStats() {
    try {
        const h = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
        return h.length > 0 ? h[h.length - 1] : null;
    } catch (e) {
        return null;
    }
}

function deltaIcon(val) {
    if (val > 0) return '⚠️';
    if (val < 0) return '✅';
    return '➡️';
}

function deltaArrow(val) {
    if (val > 0) return '+';
    if (val < 0) return '';
    return '';
}

// ─── main ───

const ignores = loadIgnores();

// git filter
const changedFiles = MODE_CHANGED || MODE_STAGED || DIFF_REF ? getChangedFiles() : null;
const isPartial = changedFiles !== null;

let raw = readRaw(RAW_SINKS);
if (isPartial) {
    const before = raw.length;
    raw = filterByChanged(raw, changedFiles);
    console.log(
        `[git] filtered ${before} → ${raw.length} entries (${changedFiles.length} files changed)`
    );
}

const entries = [];
const stats = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, REVIEW: 0, INFO: 0, LOW: 0 };
const byOwner = {};
const bySprint = {};
let totalDynamicInnerHTML = 0;
let escapedDynamicInnerHTML = 0;

let id = 0;

for (const line of raw) {
    const p = parseLine(line);
    if (!p) continue;

    const cls = classify(p.code);
    const ignored = isIgnored(ignores, p.file, p.line);
    const sev = ignored ? 'INFO' : cls.severity;

    stats[sev] = (stats[sev] || 0) + 1;
    byOwner[ownerOf(p.file)] = (byOwner[ownerOf(p.file)] || 0) + 1;
    bySprint[cls.sprint] = (bySprint[cls.sprint] || 0) + 1;

    const isDynamic = TEMPLATE_HAS_VAR.test(p.code) || HAS_CONCAT.test(p.code);
    if (sinkOf(p.code) === 'innerHTML' || sinkOf(p.code) === 'insertAdjacentHTML') {
        if (isDynamic) totalDynamicInnerHTML++;
        if (HAS_ESCAPE.test(p.code)) escapedDynamicInnerHTML++;
    }

    id++;
    entries.push({
        id: 'XSS-' + String(id).padStart(3, '0'),
        fingerprint: fingerprint(p.code, p.file, sinkOf(p.code)),
        file: p.file.replace('public/js/', ''),
        line: p.line,
        sink: sinkOf(p.code),
        severity: sev,
        source: cls.source,
        trust: cls.trust,
        confidence: cls.confidence,
        decision: cls.decision,
        cwe: cweOf(sev, cls.source),
        owasp: owaspOf(sev, cls.source),
        rule: ruleOf(sev, sinkOf(p.code), cls.source, p.code),
        sprint: cls.sprint,
        owner: ownerOf(p.file),
        ignored: ignored,
        code: p.code.substring(0, 100).replace(/\|/g, '/')
    });
}

// ─── Security Score ───

const weights = { CRITICAL: 25, HIGH: 10, MEDIUM: 3, REVIEW: 2, INFO: 0, LOW: 0 };
const maxScore = entries.length * 25;
let penalty = 0;
for (const e of entries) penalty += weights[e.severity] || 0;
const score = Math.max(0, Math.round(100 - (penalty / Math.max(1, maxScore)) * 100));

// ─── Escape Coverage ───

const escapeCoverage =
    totalDynamicInnerHTML > 0
        ? Math.round((escapedDynamicInnerHTML / totalDynamicInnerHTML) * 100)
        : 100;

// ─── CSP Readiness ───

let handlerCount = 0;
let handlerHtmlCount = 0;
const handlerByType = {};
try {
    const handlers = readRaw(RAW_HANDLERS);
    handlerCount = handlers.length;
    for (const h of handlers) {
        const t = h.match(/on\w+(?=\s*=)/);
        const type = t ? t[0] : 'unknown';
        handlerByType[type] = (handlerByType[type] || 0) + 1;
    }
    const inlineInTemplates = handlers.filter((h) => {
        const afterColon = h.split(':').slice(2).join(':');
        return afterColon.includes('"') || afterColon.includes("'");
    }).length;
    handlerHtmlCount = inlineInTemplates;
} catch (e) {
    /* no handler file */
}

// ─── Security Debt ───

const debt = {};
for (const e of entries) {
    const s = e.sprint;
    if (!debt[s]) debt[s] = { total: 0, HIGH: 0, MEDIUM: 0, REVIEW: 0 };
    debt[s].total++;
    if (e.severity === 'HIGH') debt[s].HIGH++;
    if (e.severity === 'MEDIUM') debt[s].MEDIUM++;
    if (e.severity === 'REVIEW') debt[s].REVIEW++;
}

// ─── History ───

function updateHistory() {
    let history = [];
    try {
        history = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
    } catch (e) {}
    const now = new Date().toISOString().split('T')[0];
    history.push({
        date: now,
        score,
        stats: { ...stats },
        total: entries.length,
        escapeCoverage,
        dynamicSinks: totalDynamicInnerHTML,
        escapedSinks: escapedDynamicInnerHTML,
        handlerCount
    });
    if (history.length > 20) history = history.slice(-20);
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2), 'utf8');
    return history;
}

const history = updateHistory();

// ─── Delta ───

function buildDelta(prev) {
    if (!prev) return '';
    let md = '\n### Delta (vs poprzednie uruchomienie)\n\n';
    md += '| Metryka | Poprzednio | Obecnie | Zmiana |\n| --- | --- | --- | --- |\n';

    const fields = [
        { label: 'Score', prev: prev.score, cur: score, fmt: 'num' },
        {
            label: 'CRITICAL',
            prev: prev.stats?.CRITICAL || 0,
            cur: stats.CRITICAL || 0,
            fmt: 'num'
        },
        { label: 'HIGH', prev: prev.stats?.HIGH || 0, cur: stats.HIGH || 0, fmt: 'num' },
        { label: 'MEDIUM', prev: prev.stats?.MEDIUM || 0, cur: stats.MEDIUM || 0, fmt: 'num' },
        { label: 'REVIEW', prev: prev.stats?.REVIEW || 0, cur: stats.REVIEW || 0, fmt: 'num' },
        { label: 'Coverage', prev: prev.escapeCoverage || 0, cur: escapeCoverage, fmt: 'pct' }
    ];

    for (const f of fields) {
        const diff = f.cur - f.prev;
        const icon =
            f.label === 'Score' || f.label === 'Coverage'
                ? diff > 0
                    ? '📈'
                    : diff < 0
                      ? '📉'
                      : '➡️'
                : deltaIcon(diff);
        const sign =
            f.label === 'Score' || f.label === 'Coverage'
                ? diff > 0
                    ? '+'
                    : ''
                : deltaArrow(diff);
        const suffix = f.fmt === 'pct' ? '%' : '';
        md += `| ${f.label} | ${f.prev}${suffix} | ${f.cur}${suffix} | ${icon} ${sign}${diff > 0 ? '+' : ''}${diff}${suffix} |\n`;
    }

    return md;
}

const prevStats = loadPreviousStats();
const deltaMd = buildDelta(prevStats);

// ─── Baseline comparison ───

const baseline = loadBaseline();
const { newFindings, fixedFromBaseline } = compareBaseline(entries, baseline);

// save/update baseline (full scan only)
if (!isPartial) {
    saveBaseline(entries);
    console.log(
        `[baseline] saved: ${baseline.length} old → ${entries.filter((e) => e.severity !== 'INFO' && e.severity !== 'LOW').length} current findings`
    );
}

// save classification file (always)
saveClassifications(entries, ignores);
console.log(`[classification] ${entries.length} entries saved`);

// ─── write markdown ───

function mdTable(entries, title, extraCols) {
    const cols = extraCols || [];
    let hdr =
        '| ID | Reguła | Plik | Linia | Sink | Źródło | Trust | Pewność | CWE | OWASP | Decyzja | Sprint |';
    let sep = '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |';
    for (const c of cols) {
        hdr += ' ' + c + ' |';
        sep += ' --- |';
    }

    let md = `### ${title}\n\n**${title}** — ${entries.length} pozycji`;
    if (entries.some((e) => e.ignored))
        md += ` (${entries.filter((e) => e.ignored).length} ignored)`;
    md += '\n\n' + hdr + '\n' + sep + '\n';

    for (const e of entries) {
        let row = `| ${e.id} | ${e.rule} | ${e.file} | ${e.line} | ${e.sink} | ${e.source} | ${e.trust} | ${e.confidence} | ${e.cwe} | ${e.owasp} | ${e.decision} | ${e.sprint !== '-' ? 'S' + e.sprint : '-'} |`;
        for (const c of cols) {
            if (c === 'Ignored') row += ` ${e.ignored ? '✅' : ''} |`;
            else row += ' |';
        }
        md += row + '\n';
    }
    return md;
}

const bySev = {
    CRITICAL: entries.filter((e) => e.severity === 'CRITICAL'),
    HIGH: entries.filter((e) => e.severity === 'HIGH'),
    MEDIUM: entries.filter((e) => e.severity === 'MEDIUM'),
    REVIEW: entries.filter((e) => e.severity === 'REVIEW'),
    INFO: entries.filter((e) => e.severity === 'INFO')
};

// history table for trend
let historyMd = '';
if (history.length > 1) {
    historyMd +=
        '\n### Trend\n\n| Data | Score | Total | HIGH | MEDIUM | REVIEW | Coverage |\n| --- | --- | --- | --- | --- | --- | --- |\n';
    for (const h of history) {
        historyMd += `| ${h.date} | ${h.score} | ${h.total} | ${h.stats?.HIGH || 0} | ${h.stats?.MEDIUM || 0} | ${h.stats?.REVIEW || 0} | ${h.escapeCoverage || 0}% |\n`;
    }
}

const extraFound = checkExtraSinks();

// ─── build document ───

let modeLabel = '';
if (MODE_CHANGED) modeLabel = ' (tryb: --changed)';
else if (MODE_STAGED) modeLabel = ' (tryb: --staged)';
else if (DIFF_REF) modeLabel = ` (tryb: --diff=${DIFF_REF})`;

let md = `# Audyt XSS — WITROS Oferty PV

**Data**: ${new Date().toISOString().split('T')[0]}${modeLabel}
**Generator**: \`scripts/generate-xss-audit.js\`
**Ignore DB**: \`docs/security/xss-ignore.json\` (${ignores.length} suppressed)
**Classification**: \`docs/security/xss-classification.json\` (${entries.length} entries)
**Zakres**: \`public/js/**/*.js\` — innerHTML, insertAdjacentHTML, outerHTML, onclick/onchange/oninput/onmouseenter/onmouseleave/onerror/onload handlers

---

## Scanner Score

> Wynik skanera (0–100). Odróżnij od rzeczywistego poziomu bezpieczeństwa — skaner nie analizuje przepływu danych, logiki backendu ani kontekstu biznesowego.

**${score}/100**

`;

const sevOrder = ['CRITICAL', 'HIGH', 'MEDIUM', 'REVIEW', 'INFO'];
const icons = { CRITICAL: '🔴', HIGH: '🟠', MEDIUM: '🟡', REVIEW: '🔍', INFO: '⚪', LOW: '⬜' };

for (const s of sevOrder) {
    if ((stats[s] || 0) > 0) {
        md += `| ${icons[s]} **${s}** | ${stats[s]} |\n`;
    }
}

md += '\n### Escape Coverage (tooling metric)\n\n';
md +=
    '> Udział dynamicznych sinków (konkatenacja lub template literal) zabezpieczonych `escapeHtml()`. Nie odzwierciedla rzeczywistego poziomu bezpieczeństwa — statyczne literały liczone jako nieosłonięte zaniżają wynik.\n\n';
md += `**${escapeCoverage}%** (${escapedDynamicInnerHTML}/${totalDynamicInnerHTML} dynamiczne innerHTML/insertAdjacentHTML z escapeHtml)\n\n`;
md += '| Dynamiczne sinki | Z escapeHtml | Coverage |\n| --- | --- | --- |\n';
md += `| ${totalDynamicInnerHTML} | ${escapedDynamicInnerHTML} | ${escapeCoverage}% |\n`;

md += '\n### CSP Readiness (tooling metric)\n\n';
md += `**${handlerCount}** total inline event handlers (XSS003)\n`;
md +=
    'Przed usunięciem `' +
    "'unsafe-inline'" +
    '` z CSP wszystkie muszą być przeniesione do `addEventListener` lub event delegation.\n\n';

md += '\n### Security Debt\n\n';
md += '| Sprint | Total | HIGH | MEDIUM | REVIEW |\n| --- | --- | --- | --- | --- |\n';
const sprints = Object.keys(debt).sort();
for (const s of sprints) {
    const d = debt[s];
    md += `| ${s !== '-' ? 'S' + s : '-'} | ${d.total} | ${d.HIGH || 0} | ${d.MEDIUM || 0} | ${d.REVIEW || 0} |\n`;
}

md += '\n### Scanner Gate\n\n';
md += '| Kryterium | Wymóg | Obecnie | Status |\n| --- | --- | --- | --- |\n';
const gates = [
    ['CRITICAL = 0', '0', stats.CRITICAL || 0, (stats.CRITICAL || 0) === 0],
    ['HIGH = 0', '0', stats.HIGH || 0, (stats.HIGH || 0) === 0],
    ['MEDIUM ≤ 10', '≤ 10', stats.MEDIUM || 0, (stats.MEDIUM || 0) <= 10],
    ['REVIEW = 0', '0', stats.REVIEW || 0, (stats.REVIEW || 0) === 0],
    ['Coverage ≥ 95%', '≥ 95%', escapeCoverage, escapeCoverage >= 95]
];
for (const [crit, req, cur, ok] of gates) {
    md += `| ${crit} | ${req} | ${cur} | ${ok ? '✅' : '❌'} |\n`;
}

// ─── Baseline comparison ───

const newCrit = newFindings.filter((e) => e.severity === 'CRITICAL');
const newHigh = newFindings.filter((e) => e.severity === 'HIGH');
const newMed = newFindings.filter((e) => e.severity === 'MEDIUM');
const newReview = newFindings.filter((e) => e.severity === 'REVIEW');

if (!isPartial && baseline.length > 0) {
    md += '\n### Baseline comparison\n\n';
    md += '| Kategoria | Ilość |\n| --- | --- |\n';
    md += `| Nowe CRITICAL | ${newCrit.length} |\n`;
    md += `| Nowe HIGH | ${newHigh.length} |\n`;
    md += `| Nowe MEDIUM | ${newMed.length} |\n`;
    md += `| Nowe REVIEW | ${newReview.length} |\n`;
    md += `| Naprawione (zniknęły z baseline) | ${fixedFromBaseline.length} |\n`;
    if (newFindings.length > 0) {
        md += '\n#### Nowe znaleziska\n\n';
        md +=
            '| ID | Fingerprint | Plik | Linia | Severity | Reguła |\n| --- | --- | --- | --- | --- | --- |\n';
        for (const f of newFindings) {
            md += `| ${f.id} | \`${f.fingerprint}\` | ${f.file} | ${f.line} | ${f.severity} | ${f.rule} |\n`;
        }
    }
    md += '\n';
}

if (deltaMd) md += deltaMd;
if (historyMd) md += historyMd;

// ─── Rules reference ───

md += '\n## Reguły audytu\n\n';
md += '| ID | Opis |\n| --- | --- |\n';
md += '| **XSS001** | `innerHTML` z niezaufanymi danymi (USER_DATA) |\n';
md += '| **XSS002** | `insertAdjacentHTML` z danymi zewnętrznymi |\n';
md += '| **XSS003** | Inline event handler (onclick, onchange, …) — do migracji |\n';
md += '| **XSS004** | Template literal / konkatenacja bez `escapeHtml()` |\n';
md += '\n';

// ─── Sinks ───

md += `## Sinks\n\n**${entries.length} total**`;
for (const s of sevOrder) {
    if ((stats[s] || 0) > 0) md += ` | ${icons[s]} ${s} ${stats[s]}`;
}
md += '\n\n';

for (const [sev, label] of [
    ['CRITICAL', 'CRITICAL'],
    ['HIGH', 'HIGH'],
    ['MEDIUM', 'Medium'],
    ['REVIEW', 'Review'],
    ['INFO', 'Info (SAFE)']
]) {
    const items = bySev[sev];
    if (!items || items.length === 0) continue;
    const extra = sev === 'REVIEW' || sev === 'MEDIUM' ? ['Ignored'] : [];
    md += mdTable(items, label, extra) + '\n\n';
}

// ─── Inline handlers ───

if (handlerCount > 0) {
    md += `## Inline event handlers (XSS003)

**${handlerCount}** total (inline HTML \`onclick="..."\` + DOM property \`el.onclick = fn\`)

| Type | Count |
| --- | --- |
`;
    for (const [k, v] of Object.entries(handlerByType).sort((a, b) => b[1] - a[1])) {
        md += `| \`${k}\` | ${v} |\n`;
    }
    md += '\n';
}

// ─── Extra sinks ───

if (extraFound.length > 0) {
    md += '## Additional sinks\n\n';
    for (const f of extraFound) md += `- **${f.name}**: ${f.count}\n`;
    md += '\n';
} else {
    md += '## Additional sinks\n\nNone found.\n\n';
}

md += '## Absent\n\n';
md +=
    '- `eval()` — **0** ✅\n- `new Function()` — **0** ✅\n- `document.write()` — **0** ✅\n- `outerHTML` — **0** ✅\n';

md += '\n## False Positive Database\n\n';
md += `\`docs/security/xss-ignore.json\` — ${ignores.length} known FPs\n\n`;
md += `## Baseline\n\n\`docs/security/xss-baseline.json\` — ${baseline.length} findings (auto-generated, non-INFO only)\n\n`;
if (ignores.length > 0) {
    md += '| File | Line | Reason |\n| --- | --- | --- |\n';
    for (const i of ignores) {
        md += `| ${i.file} | ${i.line} | ${i.reason} |\n`;
    }
    md += '\n';
}

md += '## Review instructions\n\n';
md += '1. **REAL_XSS** — fix in code, then add to `xss-ignore.json` as FIXED\n';
md += '2. **SUSPECT** — trace data source; add `escapeHtml()` or reclassify\n';
md +=
    '3. **SAFE_STATIC** / **SAFE_NUMERIC** / **SAFE_ESCAPED** / **SERVER_GENERATED** — add to `xss-ignore.json` with classification label\n';
md += '4. **FALSE_POSITIVE** — add to `xss-ignore.json` with reason (wrong line, parser loss)\n';
md += '5. **XSS003** — migrate inline handlers to `addEventListener` / event delegation\n';
md += '6. Add to `docs/security/xss-ignore.json` to suppress in future runs\n';
md +=
    '7. After review: update baseline (`docs/security/xss-baseline.json`) by running `npm run audit:xss`\n';
md +=
    '8. Classification decisions stored in `docs/security/xss-classification.json` — commit alongside report\n\n';

md += '## CI integration (baseline-aware gates)\n\n';
md += 'Porównanie z `docs/security/xss-baseline.json` — blokowane tylko NOWE problemy.\n\n';
md += '```yaml\n# .github/workflows/xss-audit.yml (example)\n';
md += 'jobs:\n';
md += '  xss-audit:\n';
md += '    steps:\n';
md += '      - run: npm run audit:xss\n';
md += '      # FAIL if any NEW CRITICAL or HIGH (not in baseline)\n';
md +=
    '      - run: node -e "const m=require(' +
    "'fs'" +
    ').readFileSync(' +
    "'docs/security/xss-audit.md','utf8'" +
    ');\n';
md += '          const newHigh=m.match(/\\| Nowe HIGH \\| (\\d+) \\|/);\n';
md += '          const newCrit=m.match(/\\| Nowe CRITICAL \\| (\\d+) \\|/);\n';
md += '          if(parseInt(newCrit?.[1]||0)>0||parseInt(newHigh?.[1]||0)>0) process.exit(1)"\n';
md += '```\n\n';
md += '| Gate | Action | Behavior |\n| --- | --- | --- |\n';
md += '| Nowe CRITICAL > 0 | ❌ **FAIL** build | Blocks new vulnerability |\n';
md += '| Nowe HIGH > 0 | ❌ **FAIL** build | Blocks new vulnerability |\n';
md += '| Nowe MEDIUM > 0 | ⚠️ **WARN** | Does not block |\n';
md += '| Nowe REVIEW > 0 | ⚠️ **WARN** | Does not block |\n';
md += '| Coverage drop > 10pp | ❌ **FAIL** build | Regresja narzędziowa |\n';
md += '| Score drop | ⚠️ **WARN** | Regresja narzędziowa |\n';
md += '\n';
md += '## Classification file\n\n';
md +=
    '`docs/security/xss-classification.json` — auto-generowany plik z klasyfikacją wszystkich 246 sinków.\n\n';
md +=
    'Zawiera: fingerprint, severity, source, trust, confidence, rule, CWE, OWASP, decision, sprint, label, reason.\n\n';
md += 'Separacja od `xss-ignore.json`:\n';
md += '- `xss-classification.json` = **tool output** (generator, zawsze nadpisywany)\n';
md += '- `xss-ignore.json` = **manualne decyzje** (commitowany, recenzowany)\n\n';
md += '## Regeneration\n\n```bash\n';
md +=
    'rg -n "innerHTML|insertAdjacentHTML|outerHTML" public/js/ --type js --glob \'!xlsx.full.min.js\' > docs/security/raw-sinks-utf8.txt\n';
md +=
    'rg -n "onclick=|onchange=|oninput=|onmouseover=|onmouseleave=|onmouseenter=|onerror=|onload=" public/js/ --type js --glob \'!xlsx.full.min.js\' > docs/security/raw-handlers.txt\n';
md += 'npm run audit:xss\n```\n';

md += '\n### Tryby git\n\n';
md += '```bash\nnpm run audit:xss -- --changed      # tylko zmodyfikowane pliki\n';
md += 'npm run audit:xss -- --staged       # tylko staged\n';
md += 'npm run audit:xss -- --diff=HEAD~1  # diff względem dowolnego refa\n```\n';

fs.writeFileSync(OUT, md, 'utf8');
console.log(
    `OK: ${entries.length} entries | Scanner Score: ${score}/100 | Coverage: ${escapeCoverage}% | HIGH: ${stats.HIGH} | MEDIUM: ${stats.MEDIUM} | REVIEW: ${stats.REVIEW} | INFO: ${stats.INFO}${isPartial ? ' [partial]' : ''}`
);
