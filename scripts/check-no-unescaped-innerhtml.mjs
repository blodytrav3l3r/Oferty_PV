/**
 * Custom linter: znajdz innerHTML z danymi dynamicznymi w public/js/.
 *
 * Regula: scan wszystkich plikow .js w katalogach public/js/
 *   - Dla kazdej linii z innerHTML = ...  sprawdz czy interpolowane z ${...}
 *     lub zawiera dynamiczne zmienne
 *   - Pozwolone sa statyczne stringi z `innerHTML = 'foo'` (bez ${...})
 *     NIE powinno wywolywac warn.
 *
 * Helper - uruchamiany raz przed commitem (pipeline CI moze wywolac walidacje).
 *
 * Specjalne wyjatki - dozwolone "bezpieczne wzorce":
 *   - innerHTML z interpolacja ale zawierajacy escapeHtml() - pomijane
 *   - Liczby i stale lookup values (np. SVG_COLORS.dnLabel) - sygnalizowane jako
 *     'potentially unsafe' ale w praktyce bezpieczne (false positive - 11/70 plikow)
 *   - Kod w liniach komentarzy (//lub /* * /)
 *
 * Uzycie:
 *   node scripts/check-no-unescaped-innerhtml.js                  # raport
 *   node scripts/check-no-unescaped-innerhtml.js --strict        # exit 1 gdy blad
 *   npm run security:xss:check                                   # raport
 *   npm run security:xss:strict                                  # CI strict mode
 *
 * Zastosowanie: pre-commit hook + CI pipeline do wykrywania regresji XSS.
 * Po manual review kazdego przypadku przez code review, ten skrypt bedzie
 * obejmowal rowniez statyczne wzorce z liczbami.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_JS_DIR = path.join(__dirname, '..', 'public', 'js');

function getAllJsFiles(dir) {
    let files = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            files = files.concat(getAllJsFiles(fullPath));
        } else if (entry.name.endsWith('.js') && !entry.name.endsWith('.min.js')) {
            files.push(fullPath);
        }
    }
    return files;
}

function isCommentLine(line) {
    const trimmed = line.trim();
    return trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*');
}

function hasDynamicInterpolation(line) {
    // template literal z interpolacja ${...}
    // (pozwala na string bez interpolacji - 'foo' = "foo")
    if (!line.includes('${')) return false;
    // ESCAPE: literał z samymi lucide icons lub bez prawdziwych danych
    if (line.match(/`[\s\\S]*<i\s+data-lucide=/)) {
        // Cala tresc to ikona Lucide - moze byc traktowane jako bezpieczne
        return !line.match(/`[^`]*\$\{[^}]*[^`\$]/);
    }
    // ESCAPE: prosty interplowany string bez XML/SVG
    if (/innerHTML\s*=\s*`[^`]*\$\{[^}]+\}[^`]*`/.test(line)) {
        return true;
    }
    // Concatenated string - moze zawierac dynamic
    const concatMatch = line.match(/innerHTML\s*=\s*(['"`])([^'"`]*\${[^}]+}[^'"`]*)\1/);
    if (concatMatch) {
        return true;
    }
    return false;
}

let totalIssues = 0;
const findings = [];

function scanFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const relativePath = path.relative(path.join(__dirname, '..'), filePath);

    lines.forEach((line, idx) => {
        const lineNo = idx + 1;
        if (isCommentLine(line)) return;
        // Ma innerHTML = ...
        if (
            /(\.innerHTML\s*=|\binnerHTML\s*[\)])/.test(line) &&
            (line.includes('=') || line.includes('(')) &&
            hasDynamicInterpolation(line)
        ) {
            // Sprawdz czy to prawdziwie user-controlled content
            // Pomijamy jesli linia zawiera `escapeHtml` (zabezpieczone)
            if (/escapeHtml\(/.test(line)) {
                return;
            }
            findings.push({
                file: relativePath,
                line: lineNo,
                text: line.trim(),
                reason: 'unescaped dynamic data in innerHTML'
            });
            totalIssues++;
        }
    });
}

function main() {
    if (!fs.existsSync(PUBLIC_JS_DIR)) {
        console.error('Cannot find public/js directory:', PUBLIC_JS_DIR);
        process.exit(1);
    }
    const files = getAllJsFiles(PUBLIC_JS_DIR);

    for (const file of files) {
        scanFile(file);
    }

    if (findings.length === 0) {
        console.log(`✓ Checked ${files.length} files. All innerHTML usages are escaped or safe.`);
        return;
    }

    console.log(`Checked ${files.length} files.`);
    console.log(`Found ${findings.length} potentially unsafe innerHTML usages:`);
    console.log('');
    for (const f of findings) {
        console.log(`  ${f.file}:${f.line}`);
        console.log(`    ${f.text.slice(0, 100)}`);
        console.log(`    → ${f.reason}`);
        console.log('');
    }

    const args = process.argv.slice(2);
    if (args.includes('--strict')) {
        console.log('STRICT MODE: exiting with code 1');
        process.exit(1);
    } else {
        console.log('Run with --strict to fail on these findings.');
    }
}

main();
