import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function sha1(p) {
    try {
        const full = path.join(ROOT, p);
        return crypto.createHash('sha1').update(fs.readFileSync(full)).digest('hex').substring(0, 12);
    } catch {
        return 'missing';
    }
}

function loadJson(p) {
    const full = path.join(ROOT, p);
    if (!fs.existsSync(full)) return null;
    return JSON.parse(fs.readFileSync(full, 'utf8'));
}

function walkFiles(dir, ext) {
    const results = [];
    try {
        const items = fs.readdirSync(dir, { withFileTypes: true });
        for (const item of items) {
            const full = path.join(dir, item.name);
            if (item.isDirectory()) results.push(...walkFiles(full, ext));
            else if (item.name.endsWith(ext)) results.push(full);
        }
    } catch {}
    return results;
}

// Count unique data-action VALUES across HTML + JS files (skip template expressions)
const srcFiles = [
    ...walkFiles(path.join(ROOT, 'public'), '.html'),
    ...walkFiles(path.join(ROOT, 'public'), '.js')
];
const actionValues = new Set();
const DATA_ACTION_RE = /data-action=["']([a-zA-Z0-9_$\-]+)["']/g;
for (const fp of srcFiles) {
    try {
        const content = fs.readFileSync(fp, 'utf8');
        let m;
        while ((m = DATA_ACTION_RE.exec(content)) !== null) {
            const val = m[1];
            if (val.startsWith('$')) continue;
            actionValues.add(val);
        }
    } catch {}
}
const totalActionRefs = actionValues.size;

// Inventory
const inv = loadJson('docs/security/csp-handler-inventory.json');
const entries = Array.isArray(inv) ? inv : (inv ? inv.entries : []);
const byStatus = {};
const byRuntime = {};
for (const e of entries) {
    byStatus[e.status || 'UNKNOWN'] = (byStatus[e.status || 'UNKNOWN'] || 0) + 1;
    const rd = e.runtimeDisposition || (e.classification === 'INLINE_HTML_HANDLER' ? 'INLINE_HTML' : e.classification);
    byRuntime[rd] = (byRuntime[rd] || 0) + 1;
}

// Contracts
const contracts = loadJson('docs/security/csp-action-contracts.json');
const registeredActions = contracts ? Object.keys(contracts.actions || {}).length : 0;
const undocumented = Math.max(0, totalActionRefs - registeredActions);
const covPct = totalActionRefs > 0 ? Math.round(registeredActions / totalActionRefs * 100) : 0;

// Template scan
let sinkPoints = 0;
let inlineWarnings = 0;
try {
    const genOut = execSync('node scripts/generate-csp-inventory.mjs --check 2>&1', {
        cwd: ROOT, encoding: 'utf8', timeout: 60000
    });
    const sinkM = genOut.match(/Dynamic template sinks: (\d+)/);
    if (sinkM) sinkPoints = parseInt(sinkM[1], 10);
    const inlineM = genOut.match(/INLINE IN TEMPLATES: (\d+)/);
    if (inlineM) inlineWarnings = parseInt(inlineM[1], 10);
} catch (e) {
    const out = e.stdout || '';
    const sinkM = out.match(/Dynamic template sinks: (\d+)/);
    if (sinkM) sinkPoints = parseInt(sinkM[1], 10);
    const inlineM = out.match(/INLINE IN TEMPLATES: (\d+)/);
    if (inlineM) inlineWarnings = parseInt(inlineM[1], 10);
}

const baseline = {
    baselineVersion: 'runtime-v1',
    createdAt: new Date().toISOString(),
    sprint: '3.5A',
    inventory: {
        pending: byStatus.PENDING || 0,
        verified: byStatus.VERIFIED || 0,
        migrated: byStatus.MIGRATED || 0,
        ignored: byStatus.IGNORED || 0,
        total: entries.length
    },
    runtimeDisposition: {
        inlineHtml: byRuntime.INLINE_HTML || 0,
        requiresRuntime: byRuntime.REQUIRES_RUNTIME || 0,
        safe: byRuntime.SAFE || 0,
        falsePositive: byRuntime.FALSE_POSITIVE || 0
    },
    dispatcher: {
        registeredActions,
        undocumentedActions: undocumented,
        contractCoverage: covPct
    },
    templateScan: {
        sinkPoints,
        inlineHandlerWarnings: inlineWarnings,
        check6Mode: 'warning'
    },
    securityPolicy: {
        enforce: {
            scriptSrc: ["'self'", "'unsafe-inline'"],
            mode: 'current-production'
        },
        reportOnly: {
            scriptSrc: ["'self'"],
            mode: 'future-target',
            removesUnsafeInline: true
        }
    },
    fileHashes: {
        cspActionsJs: sha1('public/js/shared/cspActions.js'),
        generateCspInventoryMjs: sha1('scripts/generate-csp-inventory.mjs'),
        securityTs: sha1('src/middleware/security.ts'),
        appTs: sha1('src/app.ts'),
        cspReportTs: sha1('src/routes/cspReport.ts'),
        testCspGateMjs: sha1('scripts/test-csp-gate.mjs')
    },
    purpose: 'Pre CSP Report-Only observation baseline'
};

const outPath = path.join(ROOT, 'docs/security/runtime-baseline-v1.json');
fs.writeFileSync(outPath, JSON.stringify(baseline, null, 2) + '\n', 'utf8');
console.log('✓ Baseline: ' + outPath);
