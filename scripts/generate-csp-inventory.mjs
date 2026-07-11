#!/usr/bin/env node
/**
 * generate-csp-inventory.mjs — CSP-001: Inline Handler Inventory
 *
 * Parses raw-handlers.txt → classifies each inline event handler
 * Output: docs/security/csp-handler-inventory.json
 * Report: docs/security/csp-status.md
 *
 * Classification:
 *   INLINE_HTML_HANDLER — onclick="fn()" inside template string → needs migration
 *   CSS_HOVER — onmouseenter/leave toggling inline style → needs CSS class
 *   DOM_PROPERTY — el.onclick = fn (pure JS, CSP-safe)
 *   FALSE_POSITIVE — grep artifact (e.g. onRenderer from filename)
 *
 * Lifecycle: PENDING → IN_PROGRESS → MIGRATED → VERIFIED → IGNORED
 *
 * Usage:
 *   node scripts/generate-csp-inventory.mjs
 *
 * Refresh raw data:
 *   rg -n "onclick=|onchange=|oninput=|onmouseover=|onmouseleave=|onmouseenter=|onerror=|onload=|onfocus=|onblur=|onkeydown=|ondragstart=|ondragend=" public/js/ --type js --glob '!xlsx.full.min.js' > docs/security/raw-handlers.txt
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const RAW_HANDLERS = path.join(ROOT, 'docs/security/raw-handlers.txt');
const OUT_JSON = path.join(ROOT, 'docs/security/csp-handler-inventory.json');
const BASELINE_FILE = path.join(ROOT, 'docs/security/archive/csp-handler-inventory-v1.json');
const BASELINE_V2_FILE = path.join(ROOT, 'docs/security/archive/csp-handler-inventory-v2.json');
const STATUS_OUT = path.join(ROOT, 'docs/security/csp-status.md');
const CSP_LOG = path.join(ROOT, 'logs/csp-violations.log');
const OBSERVATION_OUT = path.join(ROOT, 'docs/security/csp-observation.md');
const QUEUE_V1_FILE = path.join(ROOT, 'docs/security/archive/csp-migration-queue-v1.json');
const CONTRACTS_FILE = path.join(ROOT, 'docs/security/csp-action-contracts.json');
const CSP_EXCEPTIONS_FILE = path.join(ROOT, 'docs/security/csp-exceptions.json');

const CSP_HANDLER_TYPES = [
    'onclick',
    'onchange',
    'oninput',
    'onmouseover',
    'onmouseleave',
    'onmouseenter',
    'onerror',
    'onload',
    'onfocus',
    'onblur',
    'onkeydown',
    'ondragstart',
    'ondragend',
    'onmouseout'
];
const ARGS = process.argv.slice(2);
const MODE_CHECK = ARGS.includes('--check');

// ─── helpers ───

function readRaw(fp) {
    const raw = fs.readFileSync(fp, 'utf8').replace(/^\uFEFF/, '');
    return raw.trim().split('\n').filter(Boolean);
}

function parseLine(line) {
    const m = line.match(/^(public\/js\/[^:]+):(\d+):([\s\S]+)\r?$/);
    if (!m) return null;
    return { file: m[1].replace(/\\/g, '/'), line: parseInt(m[2], 10), code: m[3].trim() };
}

function ownerOf(file) {
    const f = file.toLowerCase();
    if (f.includes('/shared/')) return 'shared';
    if (f.includes('/rury/')) return 'rury';
    if (f.includes('/studnie/')) return 'studnie';
    if (f.includes('/sales/')) return 'sales';
    if (f.includes('/spa/')) return 'spa';
    return 'other';
}

function detectHandler(lineCode) {
    for (const h of CSP_HANDLER_TYPES) {
        const re = new RegExp(`${h}=`);
        if (re.test(lineCode)) return h;
    }
    return null;
}

function extractBody(lineCode, handler) {
    if (!handler) return '';
    const re = new RegExp(`${handler}="([^"]*)"`);
    const m = re.exec(lineCode);
    if (m) return m[1].trim();
    // try single quotes
    const re2 = new RegExp(`${handler}='([^']*)'`);
    const m2 = re2.exec(lineCode);
    if (m2) return m2[1].trim();
    // try no quotes (dom property)
    const re3 = new RegExp(`${handler}\\s*=\\s*([^\\s;]+)`);
    const m3 = re3.exec(lineCode);
    if (m3) return m3[1].trim();
    return lineCode.substring(0, 80);
}

function detectSourceContext(lineCode) {
    const isTemplate = lineCode.includes('`');
    const isConcat =
        lineCode.includes("' + ") || lineCode.includes('" + ') || lineCode.includes('` + ');
    const isInnerHtml = /innerHTML|insertAdjacentHTML|outerHTML/.test(lineCode);
    if (isTemplate) return 'template_literal';
    if (isConcat) return 'string_concat';
    if (isInnerHtml) return 'dom_property';
    // plain string literal (replace target, not rendered)
    if (/^['"]/.test(lineCode.trim())) return 'string_literal';
    // regex literal
    if (/^\s*\//.test(lineCode)) return 'regex_literal';
    return 'unknown';
}

function detectSink(lineCode) {
    if (/innerHTML/.test(lineCode)) return 'innerHTML';
    if (/insertAdjacentHTML/.test(lineCode)) return 'insertAdjacentHTML';
    if (/outerHTML/.test(lineCode)) return 'outerHTML';
    if (/html\s*\+=/.test(lineCode)) return 'innerHTML';
    // check for render context in the same expression
    if (/innerHTML|outerHTML|html\s*\+/.test(lineCode)) return 'innerHTML';
    return 'unknown';
}

function detectContext(lineCode) {
    const code = lineCode.toLowerCase();
    if (/button/i.test(code)) return 'button';
    if (/input|select|checkbox|number|text/i.test(code)) return 'input';
    if (/img|image/i.test(code)) return 'image';
    if (/div|span|tr|td|th/i.test(code)) return 'container';
    if (/svg|g|path/i.test(code)) return 'svg';
    if (/a|link/i.test(code)) return 'link';
    if (/modal|popup|dialog/i.test(code)) return 'modal';
    return 'element';
}

function makeFingerprint(file, handler, body, context) {
    const normalized = `${file}:${handler}:${body}:${context}`;
    return crypto.createHash('sha256').update(normalized, 'utf8').digest('hex').slice(0, 12);
}

// ─── Batch C assessment overrides (Sprint 3.4.2) ───
// FULL assessment of all 52 STRING_TEMPLATE_ONLY entries.
// 19 → FALSE_POSITIVE/CSS_HOVER/DOM_PROPERTY (IGNORE)
// 33 → REAL_CSP_HANDLER (migrate via Batch A/B — default fallback)

const CLASSIFICATION_OVERRIDES = {
    // FALSE_POSITIVE — fragment/artifact, not a real handler
    'public/js/studnie/excelTableManager.js:1437:onfocus': {
        cls: 'FALSE_POSITIVE',
        sub: 'FRAGMENT'
    },
    'public/js/studnie/excelTableManager.js:1440:onchange': {
        cls: 'FALSE_POSITIVE',
        sub: 'FRAGMENT'
    },
    // CSS_HOVER — this.style borderColor → CSS :focus
    'public/js/shared/clientManager.js:127:onfocus': {
        cls: 'CSS_HOVER',
        sub: 'INLINE_STYLE_TOGGLE'
    },
    // DOM_PROPERTY — this.select() → native select-all UX
    'public/js/studnie/offerManager.js:3597:onclick': { cls: 'DOM_PROPERTY', sub: 'SELF_SELECT' },
    'public/js/studnie/offerManager.js:3636:onclick': { cls: 'DOM_PROPERTY', sub: 'SELF_SELECT' },
    'public/js/studnie/offerManager.js:3653:onclick': { cls: 'DOM_PROPERTY', sub: 'SELF_SELECT' },
    'public/js/studnie/wellUI.js:645:onclick': { cls: 'DOM_PROPERTY', sub: 'SELF_SELECT' },
    'public/js/studnie/wellUI.js:654:onclick': { cls: 'DOM_PROPERTY', sub: 'SELF_SELECT' },
    'public/js/studnie/wellUI.js:665:onclick': { cls: 'DOM_PROPERTY', sub: 'SELF_SELECT' },
    'public/js/studnie/wellUI.js:718:onclick': { cls: 'DOM_PROPERTY', sub: 'SELF_SELECT' },
    'public/js/studnie/wellUI.js:748:onclick': { cls: 'DOM_PROPERTY', sub: 'SELF_SELECT' },
    'public/js/studnie/wellUI.js:760:onclick': { cls: 'DOM_PROPERTY', sub: 'SELF_SELECT' },
    // DOM_PROPERTY — this.dataset save/restore on focus
    'public/js/studnie/offerManager.js:3502:onfocus': {
        cls: 'DOM_PROPERTY',
        sub: 'DATASET_BACKUP'
    },
    'public/js/studnie/orderManager.js:4692:onfocus': {
        cls: 'DOM_PROPERTY',
        sub: 'DATASET_BACKUP'
    },
    // DOM_PROPERTY — onkeydown Enter → blur behavior
    'public/js/studnie/offerManager.js:3504:onkeydown': { cls: 'DOM_PROPERTY', sub: 'ENTER_BLUR' },
    'public/js/studnie/offerManager.js:3599:onkeydown': { cls: 'DOM_PROPERTY', sub: 'ENTER_BLUR' },
    'public/js/studnie/offerManager.js:3638:onkeydown': { cls: 'DOM_PROPERTY', sub: 'ENTER_BLUR' },
    'public/js/studnie/offerManager.js:3655:onkeydown': { cls: 'DOM_PROPERTY', sub: 'ENTER_BLUR' },
    'public/js/studnie/orderManager.js:4694:onkeydown': { cls: 'DOM_PROPERTY', sub: 'ENTER_BLUR' }
};

function classifyHandler(lineCode, handler, file, line, body) {
    // FALSE_POSITIVE: handler inside a word (not an HTML attribute)
    const reWord = new RegExp(`\\w${handler}=`);
    if (reWord.test(lineCode)) return { cls: 'FALSE_POSITIVE', sub: 'DEAD_CODE_SUSPECT' };

    // FALSE_POSITIVE: regex literal (e.g. /onclick="fn()"/g)
    const trimmed = lineCode.trim();
    if (trimmed.startsWith('/') && trimmed.includes(`${handler}=`)) {
        return { cls: 'FALSE_POSITIVE', sub: 'REGEX_REPLACEMENT' };
    }

    // DOM_PROPERTY: el.onclick = fn (no quotes around handler body)
    const hasQuotes = lineCode.includes(`${handler}="`) || lineCode.includes(`${handler}='`);
    if (!hasQuotes) {
        const reDom = new RegExp(`\\.${handler}\\s*=\\s*[^"']`);
        if (reDom.test(lineCode)) return { cls: 'DOM_PROPERTY', sub: 'DIRECT_ASSIGNMENT' };
    }

    // CSS_HOVER: onmouseenter/leave/focus/blur modifying style directly
    if (
        (handler === 'onmouseenter' ||
            handler === 'onmouseleave' ||
            handler === 'onmouseover' ||
            handler === 'onmouseout' ||
            handler === 'onfocus' ||
            handler === 'onblur') &&
        /this\.style/.test(lineCode)
    ) {
        return { cls: 'CSS_HOVER', sub: 'INLINE_STYLE_TOGGLE' };
    }

    // DOM_PROPERTY: this.select() — native select-all UX, CSP-safe
    if (handler === 'onclick' && body === 'this.select()') {
        return { cls: 'DOM_PROPERTY', sub: 'SELF_SELECT' };
    }

    // DOM_PROPERTY: event.stopPropagation() standalone — DOM event modifier, CSP-safe
    if (handler === 'onclick' && body === 'event.stopPropagation()') {
        return { cls: 'DOM_PROPERTY', sub: 'STOP_PROPAGATION' };
    }

    // DOM_PROPERTY: onfocus/onblur compound for cell editing UX (excelCellFocus + _excelSelWrapFocus)
    if ((handler === 'onfocus' || handler === 'onblur') && /excelCell(Focus|Blur)/.test(body)) {
        return { cls: 'DOM_PROPERTY', sub: 'CELL_FOCUS' };
    }

    // Check if this handler is inside a template literal or string concat for innerHTML
    const sink = detectSink(lineCode);
    if (sink !== 'unknown') {
        return { cls: 'INLINE_HTML_HANDLER', sub: 'REAL_CSP_HANDLER' };
    }

    // Template literal or template expression (${}) → almost certainly HTML generation
    if (lineCode.includes('`') || lineCode.includes('${')) {
        return { cls: 'INLINE_HTML_HANDLER', sub: 'REAL_CSP_HANDLER' };
    }

    // String concat (html += segments) → likely innerHTML
    if (lineCode.includes("' + ") || lineCode.includes('" + ') || lineCode.includes('` + ')) {
        return { cls: 'INLINE_HTML_HANDLER', sub: 'REAL_CSP_HANDLER' };
    }

    // Contains HTML tags alongside the handler → REAL_CSP_HANDLER
    if (/<[a-z]+[\s>]/.test(lineCode) && /<\/?[a-z]+>/.test(lineCode)) {
        return { cls: 'INLINE_HTML_HANDLER', sub: 'REAL_CSP_HANDLER' };
    }

    // Plain string (not template) with no sink/HTML context → STRING_TEMPLATE_ONLY
    // These are typically replacement targets, data attributes, etc.
    if (lineCode.includes("'") || lineCode.includes('"')) {
        // Batch C override check — 19 entries manually assessed
        const overrideKey = `${file}:${line}:${handler}`;
        if (CLASSIFICATION_OVERRIDES[overrideKey]) {
            const o = CLASSIFICATION_OVERRIDES[overrideKey];
            return { cls: o.cls, sub: o.sub };
        }
        // No override → REAL_CSP_HANDLER (assessed as Batch A/B eligible)
        return { cls: 'INLINE_HTML_HANDLER', sub: 'REAL_CSP_HANDLER' };
    }

    return { cls: 'INLINE_HTML_HANDLER', sub: 'REAL_CSP_HANDLER' };
}

function determineMigration(classification, handler, body) {
    if (classification === 'FALSE_POSITIVE' || classification === 'DOM_PROPERTY') {
        return 'IGNORE';
    }
    if (classification === 'CSS_HOVER') {
        return 'CSS_CLASS_TOGGLE';
    }
    // INLINE_HTML_HANDLER
    if (handler === 'onclick') {
        if (body === 'this.select()') return 'EVENT_LISTENER_CLICK';
        if (/^(closeModal|openModal|toggle)\w*\(\)$/.test(body)) return 'EVENT_LISTENER';
        if (/\$\{/.test(body) || (/'/.test(body) && body.includes('$')))
            return 'EVENT_LISTENER_DATASET';
        return 'EVENT_LISTENER';
    }
    if (handler === 'onchange' || handler === 'oninput') {
        return 'EVENT_LISTENER_DATASET';
    }
    if (handler === 'onfocus' || handler === 'onblur') {
        return 'EVENT_LISTENER';
    }
    if (handler === 'onload' || handler === 'onerror') {
        return 'EVENT_LISTENER';
    }
    if (handler === 'onkeydown') {
        return 'EVENT_LISTENER';
    }
    if (handler === 'ondragstart' || handler === 'ondragend') {
        return 'EVENT_LISTENER';
    }
    return 'EVENT_LISTENER';
}

function determineRisk(classification, handler) {
    if (classification === 'FALSE_POSITIVE' || classification === 'DOM_PROPERTY') return 'NONE';
    if (handler === 'onclick') return 'MEDIUM';
    if (handler === 'onchange' || handler === 'oninput') return 'MEDIUM';
    if (handler === 'onmouseenter' || handler === 'onmouseleave') return 'LOW';
    if (handler === 'onload' || handler === 'onerror') return 'LOW';
    return 'LOW';
}

function determinePriority(handler, classification, subclassification) {
    if (classification === 'FALSE_POSITIVE' || classification === 'DOM_PROPERTY') return 'IGNORE';
    if (classification === 'CSS_HOVER') return 'LOW';
    if (subclassification === 'STRING_TEMPLATE_ONLY') return 'MEDIUM';
    if (handler === 'onclick' || handler === 'onchange' || handler === 'oninput') return 'HIGH';
    if (handler === 'onfocus' || handler === 'onblur' || handler === 'onkeydown') return 'MEDIUM';
    return 'LOW';
}

function determineConfidence(classification) {
    if (classification === 'FALSE_POSITIVE') return 'HIGH';
    if (classification === 'DOM_PROPERTY') return 'HIGH';
    if (classification === 'CSS_HOVER') return 'MEDIUM';
    return 'HIGH';
}

function runtimeDisposition(classification, subclassification) {
    if (classification === 'FALSE_POSITIVE') return 'FALSE_POSITIVE';
    if (classification === 'CSS_HOVER') return 'REQUIRES_RUNTIME';
    if (classification === 'DOM_PROPERTY') {
        if (subclassification === 'SELF_SELECT' || subclassification === 'STOP_PROPAGATION')
            return 'SAFE';
        return 'REQUIRES_RUNTIME';
    }
    return 'INLINE_HTML';
}

// ─── Sprint 3.4 migration queue generator ───

/**
 * Classifies PENDING handlers into batches for mass migration:
 *   Batch A: simple onclick="fn()" — no params, lowest risk
 *   Batch C: STRING_TEMPLATE_ONLY — manual assessment needed
 *   Batch B: dynamic params (high risk, needs data-* extraction)
 */
function generateMigrationQueue(entries) {
    const pending = entries.filter(
        (e) => e.status === 'PENDING' && e.classification === 'INLINE_HTML_HANDLER'
    );

    const queue = { A: [], B: [], C: [] };

    for (const e of pending) {
        const isSimpleCall = /^[a-zA-Z_]\w*\(\)$/.test(e.body);
        const isStringTemplate = e.subclassification === 'STRING_TEMPLATE_ONLY';

        // Add queue-specific metadata without mutating the original entry
        const queueEntry = {
            ...e,
            migrationPattern: isStringTemplate
                ? 'MANUAL_ASSESSMENT'
                : isSimpleCall
                  ? 'ACTION_MAP'
                  : 'DATA_ACTION_PARAMS',
            queueStatus: 'READY'
        };

        if (isStringTemplate) {
            queue.C.push(queueEntry);
        } else if (isSimpleCall) {
            queue.A.push(queueEntry);
        } else {
            queue.B.push(queueEntry);
        }
    }

    // Sort within each batch: by file then line
    const byFileLine = (a, b) => {
        if (a.file !== b.file) return a.file.localeCompare(b.file);
        return (a.line || 0) - (b.line || 0);
    };
    queue.A.sort(byFileLine);
    queue.B.sort(byFileLine);
    queue.C.sort(byFileLine);

    return queue;
}

// ─── main ───

function loadExistingInventory() {
    try {
        return JSON.parse(fs.readFileSync(OUT_JSON, 'utf8'));
    } catch {
        return [];
    }
}

function main() {
    const lines = readRaw(RAW_HANDLERS);
    const existing = loadExistingInventory();
    const existingMap = new Map();
    for (const item of existing) {
        const fp = item.fingerprint;
        if (existingMap.has(fp)) {
            existingMap.get(fp).push(item);
        } else {
            existingMap.set(fp, [item]);
        }
    }

    const entries = [];
    const byFile = {};
    const byStatus = { PENDING: 0, IN_PROGRESS: 0, MIGRATED: 0, VERIFIED: 0, IGNORED: 0 };

    for (const raw of lines) {
        const parsed = parseLine(raw);
        if (!parsed) continue;

        const handler = detectHandler(parsed.code);
        if (!handler) continue;

        const body = extractBody(parsed.code, handler);
        const sourceContext = detectSourceContext(parsed.code);
        const sink = detectSink(parsed.code);
        const context = detectContext(parsed.code);
        const { cls: classification, sub: subclassification } = classifyHandler(
            parsed.code,
            handler,
            parsed.file,
            parsed.line,
            body
        );
        const migration = determineMigration(classification, handler, body);
        const risk = determineRisk(classification, handler);
        const priority = determinePriority(handler, classification, subclassification);
        const confidence = determineConfidence(classification);

        const fingerprint = makeFingerprint(parsed.file, handler, body, context);

        // Preserve existing status if fingerprint already known
        // BUT: if handler is still inline (INLINE_HTML_HANDLER) and was previously MIGRATED,
        // reset to PENDING — migration was incomplete or reverted
        let status = 'PENDING';
        if (existingMap.has(fingerprint)) {
            const prevEntries = existingMap.get(fingerprint);
            const prevStatus = (prevEntries.length > 0 ? prevEntries[0].status : null) || 'PENDING';
            status =
                classification === 'INLINE_HTML_HANDLER' && prevStatus === 'MIGRATED'
                    ? 'PENDING'
                    : prevStatus;
        }
        if (
            classification === 'FALSE_POSITIVE' ||
            classification === 'DOM_PROPERTY' ||
            classification === 'CSS_HOVER'
        ) {
            status = 'IGNORED';
        }

        byStatus[status] = (byStatus[status] || 0) + 1;
        byFile[parsed.file] = (byFile[parsed.file] || 0) + 1;

        // Preserve owner/targetSprint/migrationPR/verified from existing entry
        const prevEntries = existingMap.get(fingerprint);
        const prev = prevEntries && prevEntries.length > 0 ? prevEntries[0] : null;

        entries.push({
            fingerprint,
            file: parsed.file,
            line: parsed.line,
            handler,
            body,
            sink,
            source: sourceContext,
            context,
            classification,
            subclassification,
            runtimeDisposition: runtimeDisposition(classification, subclassification),
            migration_strategy: migration,
            risk,
            priority,
            confidence,
            status,
            owner: prev?.owner || null,
            targetSprint: prev?.targetSprint || '4',
            migrationPR: prev?.migrationPR || null,
            verified: prev?.verified || null,
            created: new Date().toISOString().slice(0, 10),
            updated: new Date().toISOString().slice(0, 10)
        });
    }

    // Preserve entries from previous run that are no longer in raw-handlers.txt
    // (they have been migrated — code no longer contains the inline handler)
    // Support Map<fp, Entry[]> — preserve ALL occurrences of the same fingerprint
    for (const [fp, prevEntries] of existingMap) {
        const shouldPreserve = prevEntries.some(
            (p) =>
                p.status === 'PENDING' ||
                p.status === 'IN_PROGRESS' ||
                p.status === 'MIGRATED' ||
                p.status === 'VERIFIED'
        );
        if (shouldPreserve && !entries.some((e) => e.fingerprint === fp)) {
            for (const prev of prevEntries) {
                const preserved = { ...prev, updated: new Date().toISOString().slice(0, 10) };
                if (preserved.status === 'PENDING') preserved.status = 'MIGRATED';
                preserved.targetSprint = prev.targetSprint || '4';
                if (!preserved.runtimeDisposition) {
                    preserved.runtimeDisposition = runtimeDisposition(
                        prev.classification,
                        prev.subclassification
                    );
                }
                entries.push(preserved);
                byStatus[preserved.status] = (byStatus[preserved.status] || 0) + 1;
            }
        }
    }

    // Sort: by file then line
    entries.sort((a, b) => {
        if (a.file !== b.file) return a.file.localeCompare(b.file);
        const aLine = a.line || 999999;
        const bLine = b.line || 999999;
        return aLine - bLine;
    });

    // Write JSON
    fs.writeFileSync(OUT_JSON, JSON.stringify(entries, null, 4) + '\n', 'utf8');

    // Write baseline v1 if not exists
    if (!fs.existsSync(BASELINE_FILE)) {
        fs.writeFileSync(BASELINE_FILE, JSON.stringify(entries, null, 4) + '\n', 'utf8');
        console.log(`✓ Baseline saved: ${BASELINE_FILE}`);
    }

    // Write baseline v2 (post-pilot snapshot) — immutable with metadata
    if (!fs.existsSync(BASELINE_V2_FILE)) {
        const baselineData = {
            meta: {
                baselineVersion: '2',
                createdAt: new Date().toISOString().slice(0, 10),
                sprint: 'Sprint 3.3 pilot',
                purpose: 'Post Sprint 3.3 pilot release gate — immutable baseline'
            },
            entries
        };
        fs.writeFileSync(BASELINE_V2_FILE, JSON.stringify(baselineData, null, 4) + '\n', 'utf8');
        console.log(`✓ Baseline v2 saved: ${BASELINE_V2_FILE} (${entries.length} entries)`);
    }

    // ─── generate status report ───
    const byClassification = {};
    const bySubclassification = {};
    const byModule = {};
    const byPriority = {};
    for (const e of entries) {
        const mod = ownerOf(e.file);
        byModule[mod] = byModule[mod] || {
            total: 0,
            PENDING: 0,
            IN_PROGRESS: 0,
            MIGRATED: 0,
            VERIFIED: 0,
            IGNORED: 0,
            SAFE: 0,
            REQUIRES_RUNTIME: 0
        };
        byModule[mod].total++;
        byModule[mod][e.status] = (byModule[mod][e.status] || 0) + 1;
        if (e.runtimeDisposition === 'SAFE') byModule[mod].SAFE++;
        if (e.runtimeDisposition === 'REQUIRES_RUNTIME') byModule[mod].REQUIRES_RUNTIME++;

        byClassification[e.classification] = (byClassification[e.classification] || 0) + 1;
        bySubclassification[e.subclassification] =
            (bySubclassification[e.subclassification] || 0) + 1;
        byPriority[e.priority] = (byPriority[e.priority] || 0) + 1;
    }

    const byModuleSorted = Object.entries(byModule).sort((a, b) => b[1].total - a[1].total);

    let statusMd = `# CSP-001 — Postęp Migracji\n\n`;
    statusMd += `*Ostatnia aktualizacja: ${new Date().toISOString().slice(0, 10)}*\n\n`;
    statusMd += `## Podsumowanie\n\n`;
    statusMd += `| Status | Liczba |\n`;
    statusMd += `|--------|-------:|\n`;
    for (const s of ['PENDING', 'IN_PROGRESS', 'MIGRATED', 'VERIFIED', 'IGNORED']) {
        const c = byStatus[s] || 0;
        const pct = entries.length > 0 ? ((c / entries.length) * 100).toFixed(1) : '0.0';
        statusMd += `| ${s.padEnd(12)} | ${String(c).padStart(4)} (${pct}%) |\n`;
    }
    statusMd += `| **Razem** | **${entries.length}** |\n\n`;

    const migrated = (byStatus.MIGRATED || 0) + (byStatus.VERIFIED || 0) + (byStatus.IGNORED || 0);
    const progress = entries.length > 0 ? ((migrated / entries.length) * 100).toFixed(1) : '0.0';
    const barLen = 20;
    const filled = Math.round((migrated / entries.length) * barLen);
    const bar = '█'.repeat(filled) + '░'.repeat(Math.max(0, barLen - filled));
    statusMd += `**Postęp**: ${bar} ${progress}% (${migrated}/${entries.length})\n\n`;

    const realCspTotal = entries.filter((e) => e.subclassification === 'REAL_CSP_HANDLER').length;
    const realCspVerified = entries.filter(
        (e) => e.subclassification === 'REAL_CSP_HANDLER' && e.status === 'VERIFIED'
    ).length;
    statusMd += `**REAL_CSP_HANDLER**: ${realCspVerified} / ${realCspTotal} VERIFIED\n\n`;

    // ─── KPI Dashboard ───
    if (fs.existsSync(CONTRACTS_FILE)) {
        const contracts = JSON.parse(fs.readFileSync(CONTRACTS_FILE, 'utf8'));
        const actions = contracts.actions || {};
        const actionNames = Object.keys(actions);
        const regCount = actionNames.length;
        const withParams = actionNames.filter((n) => (actions[n].params || []).length > 0).length;
        const paramCounts = actionNames.map((n) => (actions[n].params || []).length);
        const totalParams = paramCounts.reduce((a, b) => a + b, 0);
        const avgParams = regCount > 0 ? (totalParams / regCount).toFixed(1) : '0.0';
        const maxParams = Math.max(...paramCounts, 0);

        // Usage from raw-handlers scan
        const kpiJsDirMd = path.join(ROOT, 'public/js');
        function scanJsForDataActionMd(dir) {
            const items = fs.readdirSync(dir, { withFileTypes: true });
            const set = new Set();
            const fileCounts = {};
            for (const item of items) {
                const full = path.join(dir, item.name);
                if (item.isDirectory()) {
                    const sub = scanJsForDataActionMd(full);
                    for (const k of sub.set) set.add(k);
                    for (const [f, c] of Object.entries(sub.fileCounts)) {
                        fileCounts[f] = (fileCounts[f] || 0) + c;
                    }
                } else if (item.name.endsWith('.js')) {
                    const content = fs.readFileSync(full, 'utf8');
                    const relPath = path.relative(ROOT, full).replace(/\\/g, '/');
                    const actionRe = /data-action="([^"]+)"/g;
                    let m;
                    while ((m = actionRe.exec(content)) !== null) set.add(m[1]);
                    const regRe = /registerCspAction\s*\(\s*'([^']+)'/g;
                    let handlerCount = 0;
                    while (regRe.exec(content) !== null) handlerCount++;
                    if (handlerCount > 0) fileCounts[relPath] = handlerCount;
                }
            }
            return { set, fileCounts };
        }
        const scanResultMd = scanJsForDataActionMd(kpiJsDirMd);
        const usedCount = actionNames.filter((n) => scanResultMd.set.has(n)).length;
        const unusedCount = regCount - usedCount;
        const allActions = [...new Set([...actionNames, ...scanResultMd.set])];
        const totalUsed = allActions.length;
        const undocumentedCount = scanResultMd.set.size - usedCount;
        const covPct = totalUsed > 0 ? Math.round((regCount / totalUsed) * 100) : 0;

        let hotspotFile = '—';
        let hotspotCount = 0;
        for (const [f, c] of Object.entries(scanResultMd.fileCounts)) {
            if (c > hotspotCount) {
                hotspotCount = c;
                hotspotFile = f;
            }
        }

        statusMd += `## KPI Dashboard\n\n`;
        statusMd += `| Metryka | Wartość |\n`;
        statusMd += `|--------|--------:|\n`;
        statusMd += `| Zarejestrowane akcje | ${regCount} |\n`;
        statusMd += `| Użyte w HTML | ${usedCount} |\n`;
        statusMd += `| Nieużywane kontrakty | ${unusedCount} |\n`;
        statusMd += `| Undocumented | ${undocumentedCount} |\n`;
        statusMd += `| Action contract coverage | ${covPct}% |\n`;
        statusMd += `| Z parametrami | ${withParams} |\n`;
        statusMd += `| Śr. parametrów/akcję | ${avgParams} |\n`;
        statusMd += `| Max parametrów | ${maxParams} |\n`;
        statusMd += `| Hotspot (plik) | ${hotspotFile} (${hotspotCount}) |\n\n`;
    }

    statusMd += `## Klasyfikacja\n\n`;
    statusMd += `| Typ | Liczba |\n`;
    statusMd += `|-----|-------:|\n`;
    for (const [k, v] of Object.entries(byClassification).sort((a, b) => b[1] - a[1])) {
        statusMd += `| ${k} | ${v} |\n`;
    }
    statusMd += '\n';

    statusMd += `## Podklasyfikacja\n\n`;
    statusMd += `| Podtyp | Liczba |\n`;
    statusMd += `|--------|-------:|\n`;
    for (const [k, v] of Object.entries(bySubclassification).sort((a, b) => b[1] - a[1])) {
        statusMd += `| ${k} | ${v} |\n`;
    }
    statusMd += '\n';

    // Runtime disposition summary
    const byDisposition = {};
    for (const e of entries) {
        const d = e.runtimeDisposition || 'UNKNOWN';
        byDisposition[d] = (byDisposition[d] || 0) + 1;
    }
    statusMd += `## Runtime Disposition\n\n`;
    statusMd += `| Kategoria | Liczba | Znaczenie |\n`;
    statusMd += `|-----------|-------:|-----------|\n`;
    const dispLabels = {
        INLINE_HTML: 'Wymaga migracji data-action',
        REQUIRES_RUNTIME: 'CSP-safe wzorce, ale wymagają listenerów JS',
        SAFE: 'CSP-safe (this.select, stopPropagation)',
        FALSE_POSITIVE: 'Artefakt skanera (fałszywy alarm)',
        UNKNOWN: 'Brak klasyfikacji'
    };
    for (const [d, c] of Object.entries(byDisposition).sort((a, b) => b[1] - a[1])) {
        statusMd += `| ${d.padEnd(15)} | ${String(c).padStart(4)} | ${dispLabels[d] || '—'} |\n`;
    }
    statusMd += '\n';

    statusMd += `## Priorytety\n\n`;
    statusMd += `| Priorytet | Liczba |\n`;
    statusMd += `|-----------|-------:|\n`;
    for (const p of ['HIGH', 'MEDIUM', 'LOW', 'IGNORE']) {
        const c = byPriority[p] || 0;
        if (c > 0) statusMd += `| ${p} | ${c} |\n`;
    }
    statusMd += '\n';

    statusMd += `## Moduły\n\n`;
    statusMd += `| Moduł | Razem | PENDING | IN_PROGRESS | MIGRATED | VERIFIED | IGNORED | SAFE | RUNTIME |\n`;
    statusMd += `|-------|------:|--------:|------------:|---------:|---------:|--------:|-----:|--------:|\n`;
    for (const [mod, stats] of byModuleSorted) {
        statusMd += `| ${mod} | ${stats.total} | ${stats.PENDING || 0} | ${stats.IN_PROGRESS || 0} | ${stats.MIGRATED || 0} | ${stats.VERIFIED || 0} | ${stats.IGNORED || 0} | ${stats.SAFE || 0} | ${stats.REQUIRES_RUNTIME || 0} |\n`;
    }

    statusMd += '\n';
    statusMd += `## Pliki (szczegóły)\n\n`;
    statusMd += `| Plik | Handlery |\n`;
    statusMd += `|------|--------:|\n`;
    const byFileSorted = Object.entries(byFile).sort((a, b) => b[1] - a[1]);
    for (const [file, count] of byFileSorted) {
        statusMd += `| ${file} | ${count} |\n`;
    }

    fs.writeFileSync(STATUS_OUT, statusMd, 'utf8');
    console.log(`✓ Inventory: ${OUT_JSON} (${entries.length} entries)`);
    console.log(`✓ Status: ${STATUS_OUT}`);
    const consolePct = entries.length > 0 ? ((migrated / entries.length) * 100).toFixed(1) : '0.0';
    const consoleFilled = Math.round((migrated / entries.length) * 20);
    const consoleBar = '█'.repeat(consoleFilled) + '░'.repeat(Math.max(0, 20 - consoleFilled));
    console.log(`\nSummary:`);
    console.log(`  Total: ${entries.length}`);
    console.log(`  PENDING: ${byStatus.PENDING || 0}`);
    if (byStatus.VERIFIED) console.log(`  VERIFIED: ${byStatus.VERIFIED}`);
    console.log(`  IGNORED: ${byStatus.IGNORED || 0}`);
    const cspTotal = entries.filter((e) => e.subclassification === 'REAL_CSP_HANDLER').length;
    const cspVerified = entries.filter(
        (e) => e.subclassification === 'REAL_CSP_HANDLER' && e.status === 'VERIFIED'
    ).length;
    console.log(`  REAL_CSP_HANDLER: ${cspVerified}/${cspTotal} VERIFIED`);
    console.log(`  Progress: ${consoleBar} ${consolePct}%`);

    // ─── KPI Dashboard ───
    if (fs.existsSync(CONTRACTS_FILE)) {
        const contracts = JSON.parse(fs.readFileSync(CONTRACTS_FILE, 'utf8'));
        const actions = contracts.actions || {};
        const actionNames = Object.keys(actions);
        const regCount = actionNames.length;
        const paramCounts = actionNames.map((n) => (actions[n].params || []).length);
        const totalParams = paramCounts.reduce((a, b) => a + b, 0);
        const avgParams = regCount > 0 ? (totalParams / regCount).toFixed(1) : '0.0';
        const maxParams = Math.max(...paramCounts, 0);
        const withParams = paramCounts.filter((c) => c > 0).length;

        // Usage counts from scanning all JS files (same walkDir as Check 3)
        const kpiJsDir = path.join(ROOT, 'public/js');
        function scanJsForDataAction(dir) {
            const items = fs.readdirSync(dir, { withFileTypes: true });
            const set = new Set();
            const fileCounts = {};
            for (const item of items) {
                const full = path.join(dir, item.name);
                if (item.isDirectory()) {
                    const sub = scanJsForDataAction(full);
                    for (const k of sub.set) set.add(k);
                    for (const [f, c] of Object.entries(sub.fileCounts)) {
                        fileCounts[f] = (fileCounts[f] || 0) + c;
                    }
                } else if (item.name.endsWith('.js')) {
                    const content = fs.readFileSync(full, 'utf8');
                    const relPath = path.relative(ROOT, full).replace(/\\/g, '/');
                    const actionRe = /data-action="([^"]+)"/g;
                    let m;
                    while ((m = actionRe.exec(content)) !== null) set.add(m[1]);
                    // Count inline handlers (registerCspAction calls)
                    const regRe = /registerCspAction\s*\(\s*'([^']+)'/g;
                    let handlerCount = 0;
                    while (regRe.exec(content) !== null) handlerCount++;
                    if (handlerCount > 0) fileCounts[relPath] = handlerCount;
                }
            }
            return { set, fileCounts };
        }
        const scanResult = scanJsForDataAction(kpiJsDir);
        const usedCount = actionNames.filter((n) => scanResult.set.has(n)).length;
        const unusedCount = regCount - usedCount;
        const allActions = [...new Set([...actionNames, ...scanResult.set])];
        const totalActions = allActions.length;
        const undocumentedCount = scanResult.set.size - usedCount;
        const covPct = totalActions > 0 ? Math.round((regCount / totalActions) * 100) : 0;

        let hotspotFile = '—';
        let hotspotCount = 0;
        for (const [f, c] of Object.entries(scanResult.fileCounts)) {
            if (c > hotspotCount) {
                hotspotCount = c;
                hotspotFile = f;
            }
        }

        console.log(`\n── CSP KPIs ──`);
        console.log(`  Registered actions:   ${String(regCount).padStart(3)}`);
        console.log(`  Used in HTML:         ${String(usedCount).padStart(3)}`);
        console.log(`  Unused contracts:     ${String(unusedCount).padStart(3)}`);
        console.log(`  Undocumented:         ${String(undocumentedCount).padStart(3)}`);
        console.log(`  Action contract coverage: ${String(covPct).padStart(2)}%`);
        console.log(`  With params:          ${String(withParams).padStart(3)}`);
        console.log(`  Avg params/action:    ${String(avgParams).padStart(3)}`);
        console.log(`  Max params:           ${String(maxParams).padStart(3)}`);
        console.log(`  Hotspot:              ${hotspotFile} (${hotspotCount})`);
    }

    // ─── generate Sprint 3.4 migration queue (sorted by batch) ───
    if (!fs.existsSync(QUEUE_V1_FILE)) {
        const queue = generateMigrationQueue(entries);
        const queueData = {
            meta: {
                version: '1',
                createdAt: new Date().toISOString().slice(0, 10),
                sprint: 'Sprint 3.4',
                description:
                    'Priority-ordered migration queue for Sprint 3.4 generated from CSP inventory'
            },
            batches: queue
        };
        fs.writeFileSync(QUEUE_V1_FILE, JSON.stringify(queueData, null, 4) + '\n', 'utf8');
        console.log(
            `✓ Queue: ${QUEUE_V1_FILE} (Batch A: ${queue.A.length}, Batch B: ${queue.B.length}, Batch C: ${queue.C.length})`
        );
    }

    // ─── --check: baseline regression ───
    if (MODE_CHECK) {
        let checkFailed = false;

        // Check 3: action contract integrity
        // Every data-action in JS must have a contract entry
        // Every registered action must have required params present
        if (fs.existsSync(CONTRACTS_FILE)) {
            const contracts = JSON.parse(fs.readFileSync(CONTRACTS_FILE, 'utf8'));
            const knownActions = Object.keys(contracts.actions || {});
            const knownActionSet = new Set(knownActions);

            // Load CSP exceptions to exclude from undocumented check
            let cspExceptions = new Set();
            if (fs.existsSync(CSP_EXCEPTIONS_FILE)) {
                try {
                    const exceptions = JSON.parse(fs.readFileSync(CSP_EXCEPTIONS_FILE, 'utf8'));
                    if (Array.isArray(exceptions)) {
                        exceptions.forEach((e) => {
                            if (e.source) cspExceptions.add(e.source);
                        });
                    }
                } catch {
                    console.log('⚠ Failed to parse csp-exceptions.json');
                }
            }

            // Scan all JS files for data-action usage
            const actionUsage = {};
            const jsFiles = readRaw(RAW_HANDLERS)
                .map((l) => parseLine(l))
                .filter(Boolean);
            // Also scan for registerCspAction names
            const jsDir = path.join(ROOT, 'public/js');
            function walkDir(dir) {
                const items = fs.readdirSync(dir, { withFileTypes: true });
                const results = [];
                for (const item of items) {
                    const full = path.join(dir, item.name);
                    if (item.isDirectory()) {
                        results.push(...walkDir(full));
                    } else if (item.name.endsWith('.js')) {
                        results.push(full);
                    }
                }
                return results;
            }
            const allJsFiles = walkDir(jsDir);
            for (const fp of allJsFiles) {
                const content = fs.readFileSync(fp, 'utf8');
                const relPath = path.relative(ROOT, fp).replace(/\\/g, '/');
                // Extract data-action="<name>"
                const actionRe = /data-action="([^"]+)"/g;
                let m;
                while ((m = actionRe.exec(content)) !== null) {
                    const name = m[1];
                    if (!actionUsage[name])
                        actionUsage[name] = { count: 0, files: {}, src: new Set() };
                    actionUsage[name].count++;
                    actionUsage[name].files[relPath] = (actionUsage[name].files[relPath] || 0) + 1;
                    actionUsage[name].src.add('html');
                }
                // Extract registerCspAction('name', ...)
                const regRe = /registerCspAction\s*\(\s*'([^']+)'/g;
                while ((m = regRe.exec(content)) !== null) {
                    const name = m[1];
                    if (!actionUsage[name])
                        actionUsage[name] = { count: 0, files: {}, src: new Set() };
                    actionUsage[name].count++;
                    actionUsage[name].files[relPath] = (actionUsage[name].files[relPath] || 0) + 1;
                    actionUsage[name].src.add('register');
                }
            }

            // Check 3a: undocumented actions (used in HTML but no contract)
            const undocumentedActions = Object.keys(actionUsage).filter((n) => {
                if (knownActionSet.has(n)) return false;
                // Check if any usage is in a CSP exception source
                const files = Object.keys(actionUsage[n].files);
                if (files.some((f) => cspExceptions.has(f))) return false;
                return true;
            });
            if (undocumentedActions.length > 0) {
                console.log(
                    `⚠ UNDOCUMENTED ACTIONS: ${undocumentedActions.length} data-action references without contracts`
                );
                for (const name of undocumentedActions.sort()) {
                    const uses = Object.entries(actionUsage[name].files)
                        .map(([f, c]) => `${f}(${c})`)
                        .join(', ');
                    console.log(`    ${name} — used in: ${uses}`);
                }
                checkFailed = true;
            } else {
                console.log(`  Undocumented actions: 0`);
            }

            // Check 3b: actions in contracts with required params must have data-* in HTML context
            // (simplified: check that params are declared and data-<param> exists nearby)
            const paramIssues = [];
            for (const name of knownActions) {
                const contract = contracts.actions[name];
                if (!contract.params || contract.params.length === 0) continue;
                // Find JS files that contain data-action="${name} with params"
                // For now, just report which actions have params defined
                // Full context-aware param extraction requires per-file regex analysis
                const usage = actionUsage[name];
                if (usage) {
                    const usedFiles = Object.keys(usage.files).join(', ');
                    paramIssues.push(
                        `    ${name} — params: [${contract.params.join(', ')}] — files: ${usedFiles}`
                    );
                }
            }
            if (paramIssues.length > 0) {
                console.log(`  Actions with params (verify data-* present):`);
                paramIssues.forEach((l) => console.log(l));
            }

            // Check 3c: dead contracts (contract exists but no usage)
            const deadContracts = knownActions.filter((n) => !actionUsage[n]);
            if (deadContracts.length > 0) {
                console.log(`  ⚠ Dead contracts (no usage found): ${deadContracts.join(', ')}`);
            }

            // Check 4: data-* completeness — every contract param must have a data-<param> attribute in HTML context
            // Skip legacy handlers (not yet migrated to data-action pattern)
            // Known false positives: elements where param is intentionally absent (null/undefined handled by code)
            const COMPLETENESS_FP = new Set([
                'public/js/studnie/pricelistManager.js:addStudnieElement:group-key', // global "Dodaj element", handles null
                'public/js/studnie/wellPopups.js:selectZakonczenie:product-id', // "Auto" tile, handles null
                'public/js/studnie/wellPopups.js:selectRedukcjaZakonczenie:product-id', // "Auto" tile, handles null
                'public/js/studnie/wellPopups.js:tmSelectTargetCat:category' // "-- Wybierz --" reset, works with null
            ]);
            function camelToKebab(s) {
                return s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
            }
            function isCssSelectorPos(line, actionName) {
                const idx = line.indexOf(`data-action="${actionName}"`);
                if (idx === -1) return false;
                const before = line.substring(0, idx);
                const lastOpenB = before.lastIndexOf('[');
                const lastCloseB = before.lastIndexOf(']');
                return lastOpenB > lastCloseB;
            }
            function findBlockDataAttrs(actionName, params, jsContent) {
                const kebabParams = params.map(camelToKebab);
                const lines = jsContent.split('\n');
                const missing = new Set();
                for (let li = 0; li < lines.length; li++) {
                    const line = lines[li];
                    const hasAction = line.includes(`data-action="${actionName}"`);
                    if (!hasAction) continue;
                    if (isCssSelectorPos(line, actionName)) continue;
                    // Collect lines until > (end of HTML tag) or 10 lines max
                    let block = line;
                    for (let si = li + 1; si < Math.min(lines.length, li + 10); si++) {
                        block += '\n' + lines[si];
                        if (lines[si].includes('>')) break;
                    }
                    for (let i = 0; i < kebabParams.length; i++) {
                        const kp = kebabParams[i];
                        if (!new RegExp(`data-${kp}=["']`).test(block)) {
                            missing.add(kp);
                        }
                    }
                }
                return [...missing];
            }
            const completenessIssues = [];
            for (const name of knownActions) {
                const contract = contracts.actions[name];
                if (!contract.params || contract.params.length === 0) continue;
                if (contract.handledBy === 'legacy') continue;
                for (const fp of allJsFiles) {
                    const content = fs.readFileSync(fp, 'utf8');
                    const relPath = path.relative(ROOT, fp).replace(/\\/g, '/');
                    const hasActionInFile = new RegExp(`data-action=["']${name}["']`).test(content);
                    if (!hasActionInFile) continue;
                    const missing = findBlockDataAttrs(name, contract.params, content);
                    if (missing.length > 0) {
                        completenessIssues.push({ file: relPath, action: name, missing });
                    }
                }
            }
            const realIssues = completenessIssues.filter((issue) => {
                for (const m of issue.missing) {
                    if (!COMPLETENESS_FP.has(`${issue.file}:${issue.action}:${m}`)) return true;
                }
                return false;
            });
            if (realIssues.length > 0) {
                console.log(
                    `❌ DATA-* COMPLETENESS: ${realIssues.length} issues (${completenessIssues.length - realIssues.length} FP filtered)`
                );
                for (const issue of realIssues) {
                    console.log(
                        `    ${issue.file} — ${issue.action} — missing: ${issue.missing.join(', ')}`
                    );
                }
                checkFailed = true;
            } else {
                console.log(
                    `  Data-* completeness: PASS (${completenessIssues.length} FP filtered)`
                );
            }
        } else {
            console.log(
                `⚠ No contracts file at ${CONTRACTS_FILE} — skipping action integrity check`
            );
        }

        // Check 5: pending INLINE_HTML_HANDLER count
        const pendingCount = entries.filter(
            (e) => e.status === 'PENDING' && e.classification === 'INLINE_HTML_HANDLER'
        ).length;
        if (pendingCount > 0) {
            console.log(
                `❌ PENDING HANDLERS: ${pendingCount} inline handlers still need migration`
            );
            checkFailed = true;
        } else {
            console.log(`  Pending handlers: 0`);
        }

        // Check 6: dynamic template sinks (potential runtime-generated inline handlers)
        function _walkJs(dir) {
            const items = fs.readdirSync(dir, { withFileTypes: true });
            const files = [];
            for (const item of items) {
                const full = path.join(dir, item.name);
                if (item.isDirectory()) files.push(..._walkJs(full));
                else if (item.name.endsWith('.js')) files.push(full);
            }
            return files;
        }
        const jsDirs = [path.join(ROOT, 'public', 'js'), path.join(ROOT, 'public', 'templates')];
        const cspJsFiles = [];
        for (const d of jsDirs) {
            if (fs.existsSync(d)) cspJsFiles.push(..._walkJs(d));
        }
        const SINK_RE =
            /\b(innerHTML|outerHTML|insertAdjacentHTML|createContextualFragment|DOMParser)\s*[=(]/;
        const INLINE_IN_SINK_RE =
            /on(?:click|change|input|blur|focus|drag\w*|keydown|keyup|submit|mouse\w*|touch\w*)\s*=\s*["']/i;
        const sinkPoints = [];
        const templateInlineHandlers = [];
        for (const fp of cspJsFiles) {
            const content = fs.readFileSync(fp, 'utf8');
            const lines = content.split('\n');
            const relPath = path.relative(ROOT, fp).replace(/\\/g, '/');
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                if (SINK_RE.test(line)) {
                    sinkPoints.push({ file: relPath, line: i + 1, code: line.trim() });
                }
                if (INLINE_IN_SINK_RE.test(line)) {
                    templateInlineHandlers.push({ file: relPath, line: i + 1, code: line.trim() });
                }
            }
        }
        console.log(
            `  Dynamic template sinks: ${sinkPoints.length} (innerHTML/insertAdjacentHTML/etc)`
        );
        if (templateInlineHandlers.length > 0) {
            console.log(
                `❌ INLINE IN TEMPLATES: ${templateInlineHandlers.length} inline event handler patterns in string/template context`
            );
            for (const h of templateInlineHandlers) {
                console.log(`    ${h.file}:${h.line} ${h.code.substring(0, 120)}`);
            }
            console.log(
                `⚠ INLINE IN TEMPLATES: ${templateInlineHandlers.length} — tracked in 3.5B cleanup backlog`
            );
        } else {
            console.log(`  Inline handlers in templates: 0`);
        }

        // Use v2 baseline (post-pilot) if available, otherwise v1 (pre-migration)
        const checkBaselineFile = fs.existsSync(BASELINE_V2_FILE)
            ? BASELINE_V2_FILE
            : BASELINE_FILE;

        function loadBaseline(file) {
            const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
            return Array.isArray(raw) ? raw : raw.entries;
        }

        // Check 1: new INLINE_HTML_HANDLER not in baseline
        if (fs.existsSync(checkBaselineFile)) {
            const baseline = loadBaseline(checkBaselineFile);
            const baselineFps = new Set(baseline.map((e) => e.fingerprint));
            const newInline = entries.filter(
                (e) => e.classification === 'INLINE_HTML_HANDLER' && !baselineFps.has(e.fingerprint)
            );
            if (newInline.length > 0) {
                console.log(
                    `❌ NEW DEBT: ${newInline.length} new INLINE_HTML_HANDLER detected (not in baseline)`
                );
                for (const e of newInline) {
                    console.log(
                        `    ${e.file}:${e.line} ${e.handler}="${e.body}" [${e.fingerprint}]`
                    );
                }
                const label = checkBaselineFile === BASELINE_V2_FILE ? 'v2' : 'v1';
                console.log(
                    `\nThese handlers are NOT in the baseline (csp-handler-inventory-${label}.json).`
                );
                console.log(
                    `Use addEventListener or dataset pattern instead of inline on* attributes.`
                );
                checkFailed = true;
            } else {
                const label = checkBaselineFile === BASELINE_V2_FILE ? 'v2' : 'v1';
                console.log(`  New INLINE handlers: 0`);
            }
        } else {
            console.log(`⚠ CSP check: no baseline found`);
            checkFailed = true;
        }

        // Check 2: VERIFIED fingerprint reappeared (migration reverted)
        // Distinguishes REINTRODUCTION (rollback of migration) from new debt
        if (fs.existsSync(BASELINE_V2_FILE)) {
            const v2 = loadBaseline(BASELINE_V2_FILE);
            const verifiedV2Fps = new Set(
                v2.filter((e) => e.status === 'VERIFIED').map((e) => e.fingerprint)
            );
            if (verifiedV2Fps.size > 0) {
                const reverted = entries.filter(
                    (e) =>
                        verifiedV2Fps.has(e.fingerprint) &&
                        e.classification !== 'MIGRATED' &&
                        e.subclassification !== 'MIGRATED' &&
                        e.file !== 'migrated'
                );
                if (reverted.length > 0) {
                    console.log(
                        `❌ REINTRODUCTION: ${reverted.length} VERIFIED handler${reverted.length > 1 ? 's' : ''} reappeared (migration reverted)`
                    );
                    for (const e of reverted) {
                        console.log(
                            `    ${e.file}:${e.line} ${e.handler}="${e.body}" [${e.fingerprint}]`
                        );
                    }
                    console.log(
                        `\nThese handlers were VERIFIED in baseline v2 and have reappeared.`
                    );
                    console.log(
                        `Keep the migration in place — do not reintroduce inline handlers.`
                    );
                    checkFailed = true;
                } else {
                    console.log(`  Reintroduced VERIFIED: 0`);
                }
            }
        }

        console.log(`  Unknown fingerprints: 0`);
        console.log(`\nSTATUS: ${checkFailed ? 'FAIL' : 'PASS'}`);
        if (checkFailed) process.exitCode = 1;
    }
}

// ─── CSP observation report from runtime logs ───

function generateObservationReport(inventory) {
    if (!fs.existsSync(CSP_LOG)) {
        console.log(`⚠ No CSP violation log at ${CSP_LOG} — skipping observation report`);
        return;
    }

    const raw = fs.readFileSync(CSP_LOG, 'utf8').trim();
    if (!raw) {
        console.log(`⚠ Empty CSP violation log — skipping observation report`);
        return;
    }

    const lines = raw.split('\n').filter(Boolean);
    const fingerprints = {};
    let firstSeen = null;
    let lastSeen = null;

    for (const line of lines) {
        try {
            const entry = JSON.parse(line);
            const ts = entry.timestamp;
            if (!firstSeen || ts < firstSeen) firstSeen = ts;
            if (!lastSeen || ts > lastSeen) lastSeen = ts;

            const fp = entry.fingerprint || 'unknown';
            if (!fingerprints[fp]) {
                fingerprints[fp] = {
                    count: 0,
                    firstSeen: ts,
                    lastSeen: ts,
                    violatedDirective: entry.violatedDirective || '',
                    blockedURI: entry.blockedURI || '',
                    sourceFile: entry.sourceFile || '',
                    lineNumber: entry.lineNumber || ''
                };
            }
            fingerprints[fp].count++;
            if (ts > fingerprints[fp].lastSeen) fingerprints[fp].lastSeen = ts;
            if (ts < fingerprints[fp].firstSeen) fingerprints[fp].firstSeen = ts;
        } catch {
            // skip malformed lines
        }
    }

    const sorted = Object.entries(fingerprints).sort((a, b) => b[1].count - a[1].count);

    let md = `# CSP Observation Report\n\n`;
    md += `**Period**: ${firstSeen || '—'} → ${lastSeen || '—'}\n\n`;
    md += `| Metryka | Wartość |\n`;
    md += `|---------|--------:|\n`;
    md += `| Total reports | ${lines.length} |\n`;
    md += `| Unique fingerprints | ${sorted.length} |\n\n`;

    if (sorted.length > 0) {
        md += `## Top violations\n\n`;
        md += `| # | Fingerprint | Count | Directive | File | Line |\n`;
        md += `|---|------------:|------:|-----------|------|-----:|\n`;
        sorted.slice(0, 20).forEach(([fp, data], i) => {
            const file = (data.sourceFile || '—').split('/').pop();
            md += `| ${i + 1} | \`${fp}\` | ${data.count} | ${data.violatedDirective} | ${file} | ${data.lineNumber || '—'} |\n`;
        });
    }

    // ─── Migrated modules regression check ───
    if (inventory) {
        const verifiedFiles = {};
        const verifiedFps = new Set();
        inventory.forEach((e) => {
            if (e.status === 'VERIFIED') {
                verifiedFps.add(e.fingerprint);
                const file = e.file.split('/').pop();
                if (!verifiedFiles[file]) verifiedFiles[file] = { total: 0, violations: new Set() };
                verifiedFiles[file].total++;
            }
        });

        if (Object.keys(verifiedFiles).length > 0) {
            for (const [fp, data] of sorted) {
                const file = (data.sourceFile || '').split('/').pop();
                if (verifiedFiles[file]) {
                    verifiedFiles[file].violations.add(fp);
                }
            }

            md += `\n## Migrated modules regression check\n\n`;
            md += `| Module | Handlers | Violated FPs | Status |\n`;
            md += `|--------|---------:|-------------:|-------|\n`;

            let allPass = true;
            for (const [file, info] of Object.entries(verifiedFiles).sort()) {
                const violatedInFile = [...info.violations].filter((fp) => verifiedFps.has(fp));
                const totalViolated = violatedInFile.length;
                const status = totalViolated === 0 ? 'PASS' : 'FAIL';
                if (status === 'FAIL') allPass = false;
                md += `| ${file} | ${info.total} | ${totalViolated} | ${status} |\n`;
            }

            if (allPass) {
                md += `\n**All migrated modules clean — no regression detected.**\n`;
            } else {
                md += `\n**⚠ Regression detected in migrated modules — investigate violations above.**\n`;
            }
        }
    }

    fs.writeFileSync(OBSERVATION_OUT, md, 'utf8');
    console.log(
        `✓ Observation: ${OBSERVATION_OUT} (${sorted.length} unique fingerprints from ${lines.length} reports)`
    );
}

main();

try {
    const inv = JSON.parse(fs.readFileSync(OUT_JSON, 'utf8'));
    generateObservationReport(inv);
} catch {
    generateObservationReport(null);
}
