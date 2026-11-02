#!/usr/bin/env node
/**
 * frontend-deps-analyze.mjs — P1.1: diagnostyczny analizator zależności frontendu.
 *
 * Model: strony HTML -> kolejność wykonania (classic/defer/module/inline) -> pliki JS
 * -> zakresy (TypeScript Compiler API, hoisting, IIFE, importy ESM) -> krawędzie
 * cross-file -> klasyfikacja CONFIRMED / SUSPECTED / UNDEFINED / HAZARD / UNANALYZED.
 *
 * Tryb raportowy: zawsze exit 0. Blokowanie `validate` (baseline + ratchet) to P1.2.
 *
 * Użycie:
 *   node scripts/frontend-deps-analyze.mjs                 # raport tekstowy
 *   node scripts/frontend-deps-analyze.mjs --json          # pełne dane (JSON)
 *   node scripts/frontend-deps-analyze.mjs --root <dir>    # inny korzeń (fixture'y)
 *   node scripts/frontend-deps-analyze.mjs --pages a.html,b.html
 *
 * Ograniczenia (raportowane jako UNANALYZED, nigdy jako PASS):
 * - dynamiczne wstrzyknięcie <script>, eval/new Function,
 * - cykle importów ESM,
 * - skrypty `async` (kolejność niezdeterminowana),
 * - błędy parsowania.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import globals from 'globals';

const SCHEMA_VERSION = 1;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

const DEFAULT_PAGES = [
    'public/studnie.html',
    'public/rury.html',
    'public/kartoteka.html',
    'public/app.html',
    'public/index.html',
    'public/zlecenia.html'
];

/** Biblioteki zewnętrzne ładowane spoza `public/js` (vendor/CDN) — nie są błędem. */
const EXTERNAL_GLOBALS = [
    'lucide',
    'html2pdf',
    'jspdf',
    'Papa',
    'Chart',
    'bootstrap',
    'Prism',
    'XLSX'
];

const BROWSER_GLOBALS = new Set(Object.keys(globals.browser));

function parseArgs(argv) {
    const args = { root: REPO_ROOT, pages: null, json: false };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--json') args.json = true;
        else if (a === '--root') args.root = path.resolve(argv[++i]);
        else if (a === '--pages') {
            args.pages = argv[++i]
                .split(',')
                .map((p) => p.trim())
                .filter(Boolean);
        } else if (a === '--help' || a === '-h') {
            console.log(
                'Użycie: node scripts/frontend-deps-analyze.mjs [--json] [--root <dir>] [--pages a.html,b.html]'
            );
            process.exit(0);
        }
    }
    return args;
}

function toPosix(p) {
    return p.split(path.sep).join('/');
}

function lineOf(sf, node) {
    return sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
}

/** Identyfikatory w deklaracji (obsługa destrukturyzacji). */
function idsIn(name) {
    const out = [];
    (function walk(n) {
        if (ts.isIdentifier(n)) out.push(n.text);
        else ts.forEachChild(n, walk);
    })(name);
    return out;
}

function extractScripts(html) {
    const scripts = [];
    const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
    let m;
    let index = 0;
    while ((m = re.exec(html)) !== null) {
        const attrs = m[1];
        const body = m[2];
        const srcMatch = /\ssrc="([^"]+)"/i.exec(attrs);
        const isModule = /type\s*=\s*"module"/i.test(attrs);
        const isAsync = /\sasync\b/i.test(attrs);
        const isDefer = /\sdefer\b/i.test(attrs);
        const script = { index: index++, src: null, inlineBody: null, kind: null };
        if (srcMatch) {
            script.src = srcMatch[1];
            if (isModule) script.kind = 'module';
            else if (isAsync) script.kind = 'classic-async';
            else if (isDefer) script.kind = 'classic-defer';
            else script.kind = 'classic-blocking';
        } else if (body.trim()) {
            script.kind = 'inline';
            script.inlineBody = body;
        } else {
            continue;
        }
        scripts.push(script);
    }
    return scripts;
}

const isScopeNode = (n) =>
    ts.isSourceFile(n) ||
    ts.isFunctionLike(n) ||
    ts.isBlock(n) ||
    ts.isCatchClause(n) ||
    ts.isForStatement(n) ||
    ts.isForOfStatement(n) ||
    ts.isForInStatement(n);

function buildScopes(sf) {
    const parentOf = new Map();
    const namesOf = new Map();
    const scopeByNode = new Map();
    const root = { node: sf };
    namesOf.set(root, new Set());
    parentOf.set(root, null);
    scopeByNode.set(sf, root);

    (function walk(n, cur) {
        if (n !== sf && isScopeNode(n)) {
            const scope = { node: n };
            namesOf.set(scope, new Set());
            parentOf.set(scope, cur);
            scopeByNode.set(n, scope);
            cur = scope;
        }
        const fnScope = () => {
            let s = cur;
            while (s && !ts.isFunctionLike(s.node) && !ts.isSourceFile(s.node)) s = parentOf.get(s);
            return s || cur;
        };
        if (ts.isImportDeclaration(n)) {
            const clause = n.importClause;
            if (clause) {
                if (clause.name) namesOf.get(root).add(clause.name.text);
                if (clause.namedBindings) {
                    if (ts.isNamespaceImport(clause.namedBindings)) {
                        namesOf.get(root).add(clause.namedBindings.name.text);
                    } else {
                        for (const el of clause.namedBindings.elements) {
                            namesOf.get(root).add(el.name.text);
                        }
                    }
                }
            }
        }
        if (ts.isParameter(n) && ts.isIdentifier(n.name)) {
            namesOf.get(fnScope()).add(n.name.text);
        }
        if (ts.isVariableDeclaration(n)) {
            const isVar = !(n.parent.flags & (ts.NodeFlags.Let | ts.NodeFlags.Const));
            const target = isVar ? fnScope() : cur;
            for (const id of idsIn(n.name)) namesOf.get(target).add(id);
        }
        if (ts.isFunctionDeclaration(n) && n.name) {
            const enclosing = parentOf.get(cur) || cur;
            namesOf.get(enclosing).add(n.name.text);
        }
        if (ts.isClassDeclaration(n) && n.name) namesOf.get(cur).add(n.name.text);
        if (ts.isCatchClause(n) && n.variableDeclaration) {
            for (const id of idsIn(n.variableDeclaration.name)) namesOf.get(cur).add(id);
        }
        ts.forEachChild(n, (c) => walk(c, cur));
    })(sf, root);

    return { parentOf, namesOf, root, scopeByNode };
}

function isReference(node) {
    const p = node.parent;
    if (!p) return false;
    if (ts.isPropertyAccessExpression(p) && p.name === node) return false;
    if (ts.isPropertyAssignment(p) && p.name === node) return false;
    if (
        (ts.isMethodDeclaration(p) ||
            ts.isPropertyDeclaration(p) ||
            ts.isGetAccessorDeclaration(p) ||
            ts.isSetAccessorDeclaration(p)) &&
        p.name === node
    )
        return false;
    if (ts.isVariableDeclaration(p) && p.name === node) return false;
    if (ts.isParameter(p) && p.name === node) return false;
    if (
        (ts.isFunctionDeclaration(p) || ts.isClassDeclaration(p) || ts.isFunctionExpression(p)) &&
        p.name === node
    )
        return false;
    if (ts.isBindingElement(p) && p.name === node) return false;
    if (ts.isImportSpecifier(p) || ts.isImportClause(p) || ts.isNamespaceImport(p)) return false;
    if (ts.isLabeledStatement(p) && p.label === node) return false;
    if (ts.isBreakOrContinueStatement(p) && p.label === node) return false;
    if (ts.isExportSpecifier(p) && p.name === node) return false;
    return true;
}

function isPlainAssignmentLhs(node) {
    const p = node.parent;
    return (
        p &&
        ts.isBinaryExpression(p) &&
        p.left === node &&
        p.operatorToken.kind === ts.SyntaxKind.EqualsToken
    );
}

function resolveScope(scopes, from, name) {
    let s = from;
    while (s) {
        if (scopes.namesOf.get(s).has(name)) return s;
        s = scopes.parentOf.get(s);
    }
    return null;
}

function collectReferences(sf, scopes) {
    const refs = [];
    (function walk(n, cur) {
        if (n !== sf && scopes.scopeByNode.has(n)) cur = scopes.scopeByNode.get(n);
        if (ts.isIdentifier(n) && isReference(n) && !isPlainAssignmentLhs(n)) {
            if (!resolveScope(scopes, cur, n.text)) {
                refs.push({
                    name: n.text,
                    line: lineOf(sf, n),
                    inFunction: cur.node !== sf
                });
            }
        }
        ts.forEachChild(n, (c) => walk(c, cur));
    })(sf, scopes.root);
    return refs;
}

function collectWindowDefs(sf) {
    const defs = [];
    (function walk(n, inFn) {
        if (
            ts.isBinaryExpression(n) &&
            n.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
            ts.isPropertyAccessExpression(n.left) &&
            n.left.expression.getText(sf) === 'window'
        ) {
            defs.push({ name: n.left.name.text, line: lineOf(sf, n), nested: inFn });
        }
        if (
            ts.isBinaryExpression(n) &&
            n.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
            ts.isElementAccessExpression(n.left) &&
            n.left.expression.getText(sf) === 'window' &&
            ts.isStringLiteral(n.left.argumentExpression)
        ) {
            defs.push({
                name: n.left.argumentExpression.text,
                line: lineOf(sf, n),
                nested: inFn
            });
        }
        const nextInFn = inFn || ts.isFunctionLike(n);
        ts.forEachChild(n, (c) => walk(c, nextInFn));
    })(sf, false);
    return defs;
}

/** Przypisania do nazwy bez deklaracji = sloppy-mode implicit global. */
function collectImplicitGlobals(sf, scopes) {
    const hazards = [];
    (function walk(n, cur) {
        if (n !== sf && scopes.scopeByNode.has(n)) cur = scopes.scopeByNode.get(n);
        if (
            ts.isBinaryExpression(n) &&
            n.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
            ts.isIdentifier(n.left) &&
            !resolveScope(scopes, cur, n.left.text)
        ) {
            hazards.push({ name: n.left.text, line: lineOf(sf, n.left) });
        }
        ts.forEachChild(n, (c) => walk(c, cur));
    })(sf, scopes.root);
    return hazards;
}

function collectImports(sf) {
    const imports = [];
    for (const st of sf.statements) {
        if (ts.isImportDeclaration(st) && ts.isStringLiteral(st.moduleSpecifier)) {
            imports.push({ specifier: st.moduleSpecifier.text, line: lineOf(sf, st) });
        }
    }
    return imports;
}

function detectDynamicMarkers(sf, source) {
    const markers = [];
    (function walk(n) {
        if (
            ts.isCallExpression(n) &&
            ts.isPropertyAccessExpression(n.expression) &&
            n.expression.getText(sf) === 'document.createElement' &&
            n.arguments[0] &&
            ts.isStringLiteral(n.arguments[0]) &&
            n.arguments[0].text === 'script'
        ) {
            markers.push({ type: 'dynamic-script-injection', line: lineOf(sf, n) });
        }
        if (ts.isCallExpression(n) && n.expression.getText(sf) === 'eval') {
            markers.push({ type: 'dynamic-eval', line: lineOf(sf, n) });
        }
        if (ts.isNewExpression(n) && n.expression.getText(sf) === 'Function') {
            markers.push({ type: 'dynamic-eval', line: lineOf(sf, n) });
        }
        ts.forEachChild(n, walk);
    })(sf);
    if (/\bdocument\.write\s*\(/.test(source)) {
        markers.push({ type: 'document-write', line: 0 });
    }
    return markers;
}

function resolveScriptPath(src) {
    const cleanSrc = src.replace(/^\//, '').replace(/\?.*$/, '');
    return cleanSrc.startsWith('js/') ? `public/${cleanSrc}` : cleanSrc;
}

function createFileModel(root, pageRel, spec) {
    const { kind, order } = spec;
    let relPath;
    let source;
    let displayName;
    if (kind === 'inline') {
        relPath = `${pageRel}#inline${order}`;
        displayName = relPath;
        source = spec.inlineBody;
    } else {
        relPath = spec.relPath;
        displayName = relPath;
        const full = path.join(root, relPath);
        if (!fs.existsSync(full)) return null;
        source = fs.readFileSync(full, 'utf8');
    }
    const sf = ts.createSourceFile(
        displayName,
        source,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.JS
    );
    const scopes = buildScopes(sf);
    const diagnostics = sf.parseDiagnostics || [];
    return {
        page: pageRel,
        order,
        kind,
        relPath,
        displayName,
        source,
        sf,
        scopes,
        rootNames: scopes.namesOf.get(scopes.root),
        windowDefs: collectWindowDefs(sf),
        implicitGlobals: collectImplicitGlobals(sf, scopes),
        refs: collectReferences(sf, scopes),
        imports: collectImports(sf),
        dynamicMarkers: detectDynamicMarkers(sf, source),
        parseErrors: diagnostics.map((d) => ({
            line: d.start != null ? sf.getLineAndCharacterOfPosition(d.start).line + 1 : 0,
            message: ts.flattenDiagnosticMessageText(d.messageText, ' ')
        }))
    };
}

function classifyEdge(ref, file, def) {
    if (ref.inFunction) return 'CONFIRMED';
    return def.order <= file.order ? 'CONFIRMED' : 'SUSPECTED';
}

function findImportCycles(files) {
    const byPath = new Map(files.filter((f) => f.kind === 'module').map((f) => [f.relPath, f]));
    const state = new Map();
    const cycles = [];
    function visit(file, stack) {
        const current = state.get(file.relPath);
        if (current === 'done') return;
        if (current === 'visiting') {
            const start = stack.indexOf(file.relPath);
            cycles.push(stack.slice(start).concat(file.relPath));
            return;
        }
        state.set(file.relPath, 'visiting');
        stack.push(file.relPath);
        for (const imp of file.imports) {
            if (!imp.specifier.startsWith('.')) continue;
            const targetRel = toPosix(path.join(path.dirname(file.relPath), imp.specifier));
            const target = byPath.get(targetRel);
            if (target) visit(target, stack);
        }
        stack.pop();
        state.set(file.relPath, 'done');
    }
    for (const f of byPath.values()) visit(f, []);
    return cycles;
}

function analyzePage(root, pageRel) {
    const htmlPath = path.join(root, pageRel);
    if (!fs.existsSync(htmlPath)) {
        return {
            page: pageRel,
            missing: true,
            scripts: {},
            files: 0,
            globalNames: 0,
            edges: [],
            undefinedReferences: [],
            hazards: [],
            unanalyzed: [{ type: 'missing-page', file: pageRel, line: 0 }],
            cycles: []
        };
    }
    const html = fs.readFileSync(htmlPath, 'utf8');
    const scripts = extractScripts(html);
    const scriptKinds = {
        'classic-defer': 0,
        'classic-blocking': 0,
        'classic-async': 0,
        module: 0,
        inline: 0
    };
    for (const s of scripts) scriptKinds[s.kind] = (scriptKinds[s.kind] || 0) + 1;

    const files = [];
    for (const script of scripts) {
        const spec =
            script.kind === 'inline'
                ? { kind: 'inline', order: script.index, inlineBody: script.inlineBody }
                : {
                      kind: script.kind,
                      order: script.index,
                      relPath: resolveScriptPath(script.src)
                  };
        const model = createFileModel(root, pageRel, spec);
        if (model) files.push(model);
    }

    // Moduły importowane wykonują się przed importerem — ich mostki window.*
    // są częścią kontraktu strony, mimo braku własnego tagu <script>.
    const byRel = new Map(files.map((f) => [f.relPath, f]));
    const queue = files.filter((f) => f.kind === 'module');
    while (queue.length) {
        const file = queue.shift();
        for (const imp of file.imports) {
            if (!imp.specifier.startsWith('.')) continue;
            const targetRel = toPosix(path.join(path.dirname(file.relPath), imp.specifier));
            if (byRel.has(targetRel)) continue;
            const model = createFileModel(root, pageRel, {
                kind: 'module',
                order: file.order,
                relPath: targetRel
            });
            if (!model) continue;
            files.push(model);
            byRel.set(targetRel, model);
            queue.push(model);
        }
    }

    // Wspólny scope strony: klasyki + inline (moduły mają własny scope).
    const pageGlobals = new Map();
    for (const file of files) {
        for (const def of file.windowDefs) {
            if (!pageGlobals.has(def.name)) {
                pageGlobals.set(def.name, {
                    file: file.relPath,
                    order: file.order,
                    kind: file.kind === 'module' ? 'window-module' : 'window',
                    line: def.line,
                    nested: def.nested
                });
            }
        }
        if (file.kind !== 'module') {
            for (const name of file.rootNames) {
                if (!pageGlobals.has(name)) {
                    pageGlobals.set(name, {
                        file: file.relPath,
                        order: file.order,
                        kind: 'lexical',
                        line: 0,
                        nested: false
                    });
                }
            }
        }
    }

    const hazardNames = new Map();
    for (const file of files) {
        for (const h of file.implicitGlobals) {
            if (!hazardNames.has(h.name)) hazardNames.set(h.name, []);
            hazardNames.get(h.name).push({ file: file.relPath, line: h.line, order: file.order });
        }
    }

    const edges = [];
    const undefinedReferences = [];
    const hazardUsages = new Map();

    for (const file of files) {
        for (const ref of file.refs) {
            const def = pageGlobals.get(ref.name);
            if (def) {
                if (def.file === file.relPath) continue;
                edges.push({
                    page: pageRel,
                    name: ref.name,
                    userFile: file.relPath,
                    userLine: ref.line,
                    defFile: def.file,
                    defKind: def.kind,
                    defLine: def.line,
                    confidence: classifyEdge(ref, file, def),
                    inFunction: ref.inFunction
                });
                continue;
            }
            if (hazardNames.has(ref.name)) {
                if (!hazardUsages.has(ref.name)) hazardUsages.set(ref.name, []);
                hazardUsages.get(ref.name).push({
                    file: file.relPath,
                    line: ref.line,
                    order: file.order
                });
                continue;
            }
            if (BROWSER_GLOBALS.has(ref.name) || EXTERNAL_GLOBALS.includes(ref.name)) continue;
            undefinedReferences.push({
                page: pageRel,
                name: ref.name,
                file: file.relPath,
                line: ref.line
            });
        }
    }

    const hazards = [];
    for (const [name, definitions] of hazardNames) {
        const usages = hazardUsages.get(name) || [];
        const firstDefOrder = Math.min(...definitions.map((d) => d.order));
        const hasTopLevelUseBeforeDef = usages.some((u) => u.order < firstDefOrder);
        hazards.push({
            page: pageRel,
            name,
            mechanism: 'sloppy-mode implicit global (przypisanie bez deklaracji)',
            risk: hasTopLevelUseBeforeDef || definitions.length === 0 ? 'HIGH' : 'MEDIUM',
            definitions: definitions.sort((a, b) => a.order - b.order || a.line - b.line),
            usages: usages.sort((a, b) => a.order - b.order || a.line - b.line),
            referenceCount: usages.length
        });
    }

    const unanalyzed = [];
    for (const file of files) {
        for (const m of file.dynamicMarkers) {
            unanalyzed.push({ type: m.type, file: file.relPath, line: m.line });
        }
        for (const e of file.parseErrors) {
            unanalyzed.push({
                type: 'parse-error',
                file: file.relPath,
                line: e.line,
                detail: e.message
            });
        }
        if (file.kind === 'classic-async') {
            unanalyzed.push({ type: 'async-script-order', file: file.relPath, line: 0 });
        }
    }
    const cycles = findImportCycles(files);
    for (const cycle of cycles) {
        unanalyzed.push({ type: 'esm-import-cycle', file: cycle.join(' -> '), line: 0 });
    }

    const sortEdges = (a, b) =>
        a.name.localeCompare(b.name) ||
        a.userFile.localeCompare(b.userFile) ||
        a.userLine - b.userLine ||
        a.defFile.localeCompare(b.defFile);
    edges.sort(sortEdges);
    undefinedReferences.sort(
        (a, b) => a.name.localeCompare(b.name) || a.file.localeCompare(b.file) || a.line - b.line
    );
    hazards.sort((a, b) => a.name.localeCompare(b.name));
    unanalyzed.sort(
        (a, b) => a.type.localeCompare(b.type) || a.file.localeCompare(b.file) || a.line - b.line
    );

    return {
        page: pageRel,
        missing: false,
        scripts: scriptKinds,
        files: files.length,
        globalNames: pageGlobals.size,
        edges,
        undefinedReferences,
        hazards,
        unanalyzed,
        cycles
    };
}

function buildReport(root, pages) {
    const results = pages.map((p) => analyzePage(root, p));
    return {
        schemaVersion: SCHEMA_VERSION,
        root: toPosix(path.relative(REPO_ROOT, root)) || '.',
        pages: results
    };
}

function countBy(items, keyFn) {
    const map = new Map();
    for (const item of items) {
        const key = keyFn(item);
        map.set(key, (map.get(key) || 0) + 1);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

function renderText(report) {
    const lines = [];
    lines.push(`FRONTEND DEPENDENCY REPORT (schema ${report.schemaVersion})`);
    lines.push(`root: ${report.root}`);
    lines.push('');
    lines.push('PAGES');
    for (const p of report.pages) {
        const confirmed = p.edges.filter((e) => e.confidence === 'CONFIRMED').length;
        const suspected = p.edges.filter((e) => e.confidence === 'SUSPECTED').length;
        lines.push(
            `  ${p.page}  files=${p.files} globals=${p.globalNames} ` +
                `edges=${p.edges.length} (confirmed=${confirmed} suspected=${suspected}) ` +
                `undefined=${p.undefinedReferences.length} hazards=${p.hazards.length} ` +
                `unanalyzed=${p.unanalyzed.length}`
        );
        lines.push(
            `    scripts: defer=${p.scripts['classic-defer'] || 0} blocking=${
                p.scripts['classic-blocking'] || 0
            } module=${p.scripts.module || 0} inline=${p.scripts.inline || 0} async=${
                p.scripts['classic-async'] || 0
            }`
        );
    }
    lines.push('');
    lines.push('DEPENDENCIES BY NAME (aggregated; full edge list via --json)');
    for (const p of report.pages) {
        lines.push(`  ${p.page}`);
        for (const [name, count] of countBy(p.edges, (e) => e.name)) {
            const defs = [...new Set(p.edges.filter((e) => e.name === name).map((e) => e.defFile))];
            lines.push(`    ${String(count).padStart(5)}  ${name}  <- ${defs.join(', ')}`);
        }
    }
    lines.push('');
    lines.push('HAZARDS (implicit globals)');
    for (const p of report.pages) {
        for (const h of p.hazards) {
            lines.push(`  [${h.risk}] ${p.page} :: ${h.name} refs=${h.referenceCount}`);
            lines.push(`    mechanism: ${h.mechanism}`);
            lines.push(
                `    defs: ${h.definitions.map((d) => `${d.file}:${d.line}`).join(', ') || '(brak)'}`
            );
            const files = [...new Set(h.usages.map((u) => u.file))];
            lines.push(`    used in: ${files.join(', ')}`);
        }
    }
    lines.push('');
    lines.push('UNDEFINED REFERENCES');
    for (const p of report.pages) {
        for (const u of p.undefinedReferences) {
            lines.push(`  ${p.page} :: ${u.name} @ ${u.file}:${u.line}`);
        }
    }
    lines.push('');
    lines.push('UNANALYZED');
    for (const p of report.pages) {
        for (const u of p.unanalyzed) {
            lines.push(
                `  ${p.page} :: ${u.type} @ ${u.file}:${u.line}${u.detail ? ` (${u.detail})` : ''}`
            );
        }
    }
    return lines.join('\n');
}

function main() {
    const args = parseArgs(process.argv.slice(2));
    const pages = args.pages || DEFAULT_PAGES;
    const report = buildReport(args.root, pages);
    if (args.json) {
        process.stdout.write(JSON.stringify(report, null, 2) + '\n');
    } else {
        process.stdout.write(renderText(report) + '\n');
    }
}

main();
