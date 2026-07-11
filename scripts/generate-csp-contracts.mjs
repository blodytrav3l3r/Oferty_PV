#!/usr/bin/env node
/**
 * generate-csp-contracts.mjs — Generuje brakujące kontrakty CSP
 *
 * Skanuje public/js/ w poszukiwaniu registerCspAction w celu
 * uzupełnienia docs/security/csp-action-contracts.json o brakujące wpisy.
 *
 * Tryby:
 *   generate  (domyślny) — generuje brakujące kontrakty i zapisuje plik
 *   --check  — sprawdza czy są brakujące kontrakty, zwraca kod !=0 jeśli tak
 *
 * Wygenerowane kontrakty mają flagi: "generated": true, "reviewed": false
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const CONTRACTS_PATH = path.join(ROOT, 'docs/security/csp-action-contracts.json');
const JS_DIR = path.join(ROOT, 'public/js');

function walkJsDir(dir) {
    const files = [];
    try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const e of entries) {
            const full = path.join(dir, e.name);
            if (e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules') {
                files.push(...walkJsDir(full));
            } else if (e.isFile() && e.name.endsWith('.js') && e.name !== 'xlsx.full.min.js') {
                files.push(full);
            }
        }
    } catch { }
    return files;
}

const isCheckMode = process.argv.includes('--check');

const RE_REGISTER = /registerCspAction\s*\(\s*('[^']+'|`[^`]+`)\s*,\s*(['{\w])/gs;

function parseRegisterCalls(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const calls = [];
    let match;
    while ((match = RE_REGISTER.exec(content)) !== null) {
        const fullMatch = match[0];
        const nameRaw = match[1];
        const restMatch = match[2];
        let name;
        let relPath = path.relative(ROOT, filePath).replace(/\\/g, '/');

        if (nameRaw.startsWith("'") && nameRaw.endsWith("'")) {
            name = nameRaw.slice(1, -1);
        } else if (nameRaw.startsWith('`')) {
            const inner = nameRaw.slice(1, -1);
            if (inner.includes('${')) {
                name = nameRaw;
            } else {
                name = inner;
            }
        } else {
            continue;
        }

        const startIdx = match.index + fullMatch.length;
        const handlerBody = content.slice(startIdx, startIdx + 2000);

        let params = [];
        const paramsMatch = handlerBody.match(/params\s*:\s*\[([^\]]*)\]/);
        if (paramsMatch) {
            params = paramsMatch[1].split(',').map(s => s.trim().replace(/['"]/g, '')).filter(Boolean);
        } else {
            const funcBody = handlerBody.match(/(?:function\s*)\([^)]*\)\s*\{([\s\S]{1,1500})\}/);
            if (funcBody) {
                const body = funcBody[1];
                const paramRefs = new Set();
                const refRegex = /(?<=[^.])\.(\w+)(?=\s*[),;\]}!=<>+\-*/]|\s*$)/g;
                let ref;
                while ((ref = refRegex.exec(body)) !== null) {
                    const before = body.slice(Math.max(0, ref.index - 3), ref.index);
                    if (/\bp\b/.test(before.slice(-3))) {
                        paramRefs.add(ref[1]);
                    }
                }
                const skip = ['value', 'dataset', 'closest', 'id', 'type', 'checked', 'style',
                    'classList', 'className', 'disabled', 'selectedIndex', 'options', 'tagName',
                    'parentElement', 'nextElementSibling', 'previousElementSibling',
                    'children', 'innerHTML', 'innerText', 'textContent'];
                params = [...paramRefs].filter(r => !skip.includes(r));
            }
        }

        calls.push({ name, params, file: relPath, raw: fullMatch });
    }
    return calls;
}

function collectAllActions() {
    const allJsFiles = walkJsDir(JS_DIR);
    const actionMap = new Map();

    for (const fullPath of allJsFiles) {
        const relFile = path.relative(ROOT, fullPath).replace(/\\/g, '/');
        try {
            const calls = parseRegisterCalls(fullPath);
            for (const c of calls) {
                if (!actionMap.has(c.name)) {
                    actionMap.set(c.name, { ...c, files: [] });
                }
                const entry = actionMap.get(c.name);
                if (!entry.files.includes(c.file)) {
                    entry.files.push(c.file);
                }
            }
        } catch (e) {
            console.error('Blad parsowania ' + relFile + ': ' + e.message);
        }
    }

    return actionMap;
}

function loadExistingContracts() {
    if (!fs.existsSync(CONTRACTS_PATH)) {
        return {
            meta: {
                version: '1',
                createdAt: new Date().toISOString().split('T')[0],
                description: 'Action contracts for CSP migration'
            },
            actions: {}
        };
    }
    return JSON.parse(fs.readFileSync(CONTRACTS_PATH, 'utf-8'));
}

function generateContracts(registeredActions, existingContracts) {
    const existingActions = existingContracts.actions || {};
    let added = 0;
    let skipped = 0;

    for (const [name, info] of registeredActions) {
        if (existingActions[name]) {
            skipped++;
            continue;
        }

        existingActions[name] = {
            description: 'TODO',
            generated: true,
            reviewed: false,
            params: info.params,
            handler: 'TODO',
            files: info.files
        };
        added++;
    }

    const sorted = {};
    for (const key of Object.keys(existingActions).sort()) {
        sorted[key] = existingActions[key];
    }
    existingContracts.actions = sorted;

    return { added, skipped, total: Object.keys(existingContracts.actions).length };
}

function main() {
    console.log('');
    console.log('=== CSP Action Contracts Generator ===');
    console.log('');

    const existing = loadExistingContracts();
    const existingCount = Object.keys(existing.actions).length;
    console.log('Istniejace kontrakty: ' + existingCount);

    console.log('Skanuje registerCspAction() w public/js/...');
    const registered = collectAllActions();
    console.log('Znalezione unikalne akcje: ' + registered.size);

    const { added, skipped, total } = generateContracts(registered, existing);

    if (isCheckMode) {
        console.log('');
        console.log('Wynik check:');
        console.log('  Kontrakty:     ' + total);
        console.log('  Zarejestrowane: ' + registered.size);
        console.log('  Brakujace:     ' + (registered.size - skipped));
        if (added > 0) {
            console.log('');
            console.log('! Brakuje ' + added + ' kontraktow. Uruchom bez --check aby wygenerowac.');
            console.log('');
            process.exit(1);
        }
        console.log('OK Wszystkie akcje maja kontrakty.');
        console.log('');
        return;
    }

    fs.writeFileSync(CONTRACTS_PATH, JSON.stringify(existing, null, 4) + '\n', 'utf-8');

    console.log('');
    console.log('Podsumowanie:');
    console.log('  Dodane kontrakty: ' + added);
    console.log('  Pominiete (juz istnialy): ' + skipped);
    console.log('  Lacznie: ' + total);
    console.log('');
    console.log('Zapisano: ' + path.relative(ROOT, CONTRACTS_PATH));
    console.log('');
    console.log('Nastepne kroki:');
    console.log('  1. Przejrzyj dodane kontrakty - uzupelnij opisy i handlery');
    console.log('  2. Ustaw "reviewed": true po weryfikacji');
    console.log('  3. Uruchom: node scripts/generate-csp-contracts.mjs --check');
    console.log('');
}

try {
    main();
} catch (err) {
    console.error('Blad:', err.message);
    process.exit(1);
}
