#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const IGNORE_DIRS = new Set([
    'node_modules',
    '.git',
    'venv',
    'dist',
    'well_configurator_backend',
    'data',
    'generated',
    'graphify-out',
    '.husky/_'
]);
const IGNORE_EXT = new Set([
    '.png',
    '.jpg',
    '.jpeg',
    '.gif',
    '.ico',
    '.woff',
    '.woff2',
    '.ttf',
    '.eot',
    '.otf',
    '.svg',
    '.sqlite',
    '.db',
    '.exe',
    '.dll',
    '.obj',
    '.bin',
    '.dat',
    '.xlsx',
    '.xls',
    '.docx',
    '.pdf'
]);
const IGNORE_FILES = new Set([
    'package-lock.json',
    '.gitignore',
    '.dockerignore',
    'xlsx.full.min.js'
]);
const TEXT_EXTENSIONS = new Set([
    '.html',
    '.js',
    '.ts',
    '.css',
    '.json',
    '.md',
    '.yml',
    '.yaml',
    '.sh',
    '.bat',
    '.ps1',
    '.py',
    '.sql',
    '.env',
    '.txt',
    '.mjs',
    '.cjs',
    '.mts',
    '.cts',
    '.xml',
    '.cfg',
    '.ini',
    '.conf',
    '.rc',
    '.properties',
    '.toml'
]);
const W1250_EXTS = new Set([
    '.html',
    '.js',
    '.ts',
    '.css',
    '.json',
    '.md',
    '.yml',
    '.yaml',
    '.py',
    '.sql',
    '.env',
    '.txt',
    '.xml'
]);

function shouldIgnore(dir) {
    const parts = dir.split(path.sep);
    return parts.some((p) => IGNORE_DIRS.has(p));
}

function walkDir(dir, files = []) {
    try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                if (!shouldIgnore(full)) walkDir(full, files);
            } else if (entry.isFile()) {
                const ext = path.extname(entry.name).toLowerCase();
                if (
                    !IGNORE_EXT.has(ext) &&
                    !IGNORE_FILES.has(entry.name) &&
                    TEXT_EXTENSIONS.has(ext)
                ) {
                    files.push(full);
                }
            }
        }
    } catch {}
    return files;
}

function validateUTF8(buffer) {
    let i = 0;
    let isValid = true;
    let invalidBytes = [];
    let continuationBytes = 0;

    while (i < buffer.length) {
        const byte = buffer[i];

        if (byte <= 0x7f) {
            if (continuationBytes > 0) {
                invalidBytes.push({
                    pos: i - continuationBytes,
                    reason: 'expected continuation byte (truncated sequence)'
                });
                continuationBytes = 0;
            }
            i++;
            continue;
        }

        if ((byte & 0xc0) === 0x80) {
            if (continuationBytes > 0) {
                continuationBytes--;
                i++;
                continue;
            }
            invalidBytes.push({ pos: i, reason: 'stray continuation byte' });
            i++;
            continue;
        }

        if ((byte & 0xe0) === 0xc0) {
            if (continuationBytes > 0) {
                invalidBytes.push({
                    pos: i,
                    reason: 'expected continuation byte (truncated sequence)'
                });
                continuationBytes = 0;
            }
            if (i + 1 >= buffer.length) {
                invalidBytes.push({ pos: i, reason: 'truncated 2-byte sequence' });
                i++;
                continue;
            }
            if ((buffer[i + 1] & 0xc0) !== 0x80) {
                invalidBytes.push({
                    pos: i,
                    reason: 'invalid 2-byte sequence (second byte not continuation)'
                });
                i++;
                continue;
            }
            i += 2;
            continue;
        }

        if ((byte & 0xf0) === 0xe0) {
            if (continuationBytes > 0) {
                invalidBytes.push({
                    pos: i,
                    reason: 'expected continuation byte (truncated sequence)'
                });
                continuationBytes = 0;
            }
            if (i + 2 >= buffer.length) {
                invalidBytes.push({ pos: i, reason: 'truncated 3-byte sequence' });
                i++;
                continue;
            }
            if ((buffer[i + 1] & 0xc0) !== 0x80 || (buffer[i + 2] & 0xc0) !== 0x80) {
                invalidBytes.push({
                    pos: i,
                    reason: 'invalid 3-byte sequence (continuation bytes)'
                });
                i++;
                continue;
            }
            i += 3;
            continue;
        }

        if ((byte & 0xf8) === 0xf0) {
            if (continuationBytes > 0) {
                invalidBytes.push({
                    pos: i,
                    reason: 'expected continuation byte (truncated sequence)'
                });
                continuationBytes = 0;
            }
            if (i + 3 >= buffer.length) {
                invalidBytes.push({ pos: i, reason: 'truncated 4-byte sequence' });
                i++;
                continue;
            }
            if (
                (buffer[i + 1] & 0xc0) !== 0x80 ||
                (buffer[i + 2] & 0xc0) !== 0x80 ||
                (buffer[i + 3] & 0xc0) !== 0x80
            ) {
                invalidBytes.push({ pos: i, reason: 'invalid 4-byte sequence' });
                i++;
                continue;
            }
            i += 4;
            continue;
        }

        invalidBytes.push({ pos: i, reason: 'invalid start byte' });
        i++;
    }

    return { isValid: invalidBytes.length === 0, invalidBytes };
}

function countUFFFD(buffer) {
    let count = 0;
    for (let i = 0; i < buffer.length - 2; i++) {
        if (buffer[i] === 0xef && buffer[i + 1] === 0xbf && buffer[i + 2] === 0xbd) count++;
    }
    return count;
}

function countPolishUTF8(buffer) {
    let count = 0;
    for (let i = 0; i < buffer.length - 1; i++) {
        if ((buffer[i] === 0xc4 || buffer[i] === 0xc5) && buffer[i + 1] & 0x80) count++;
    }
    return count;
}

function detectW1250(buffer) {
    const w1250Ranges = {
        low: { start: 0x80, end: 0x9f },
        mid: { start: 0xa0, end: 0xff }
    };
    let w1250Count = 0;
    let totalNonASCII = 0;

    for (let i = 0; i < buffer.length; i++) {
        if (buffer[i] > 0x7f) totalNonASCII++;
        if (buffer[i] >= w1250Ranges.low.start && buffer[i] <= w1250Ranges.mid.end) {
            if (
                (buffer[i] & 0xc0) !== 0x80 &&
                (buffer[i] & 0xe0) !== 0xc0 &&
                (buffer[i] & 0xf0) !== 0xe0 &&
                (buffer[i] & 0xf8) !== 0xf0
            ) {
                w1250Count++;
            }
        }
    }

    return { w1250Count, totalNonASCII };
}

function analyzeFile(filePath) {
    const buffer = fs.readFileSync(filePath);
    const result = {
        file: path.relative(ROOT, filePath).replace(/\\/g, '/'),
        size: buffer.length,
        status: 'OK',
        issues: []
    };

    // Validate UTF-8
    const utf8Result = validateUTF8(buffer);
    if (!utf8Result.isValid) {
        const { w1250Count, totalNonASCII } = detectW1250(buffer);
        if (totalNonASCII > 0 && totalNonASCII === utf8Result.invalidBytes.length) {
            result.status = 'FIXABLE';
            result.issues.push(
                `Windows-1250 encoding (${w1250Count} non-ASCII bytes) — run encoding:fix`
            );
        } else {
            result.status = 'ERROR';
            result.issues.push(
                `Invalid UTF-8 (${utf8Result.invalidBytes.length} invalid byte positions)`
            );
        }
    }

    // Check for U+FFFD (replacement character)
    const ufffd = countUFFFD(buffer);
    if (ufffd > 0) {
        if (result.status === 'OK') result.status = 'WARN';
        result.issues.push(`Contains ${ufffd} U+FFFD (replacement char) — previously corrupted`);
    }

    // Verify Polish characters are proper UTF-8
    const polishCount = countPolishUTF8(buffer);
    if (polishCount > 0 && result.status === 'OK') {
        result.polishUTF8 = polishCount;
    }

    return result;
}

function fixFile(filePath) {
    const buffer = fs.readFileSync(filePath);
    const utf8Result = validateUTF8(buffer);

    if (utf8Result.isValid) {
        console.log(
            `  SKIP: ${path.relative(ROOT, filePath).replace(/\\/g, '/')} — already valid UTF-8`
        );
        return false;
    }

    // Skip binary files by extension
    const ext = path.extname(filePath).toLowerCase();
    if (!W1250_EXTS.has(ext)) {
        console.log(
            `  SKIP: ${path.relative(ROOT, filePath).replace(/\\/g, '/')} — non-text extension`
        );
        return false;
    }

    try {
        const decoder = new TextDecoder('windows-1250');
        const text = decoder.decode(buffer);
        const utf8Buffer = Buffer.from(text, 'utf-8');

        // Verify the result is valid UTF-8
        const verifyResult = validateUTF8(utf8Buffer);
        if (!verifyResult.isValid) {
            console.log(
                `  FAIL: ${path.relative(ROOT, filePath).replace(/\\/g, '/')} — conversion produced invalid UTF-8`
            );
            return false;
        }

        fs.writeFileSync(filePath, utf8Buffer);
        console.log(`  FIXED: ${path.relative(ROOT, filePath).replace(/\\/g, '/')}`);
        return true;
    } catch (e) {
        console.log(`  ERROR: ${path.relative(ROOT, filePath).replace(/\\/g, '/')} — ${e.message}`);
        return false;
    }
}

function main() {
    const args = process.argv.slice(2);
    const mode = args[0] || 'check';
    const target = args[1] || ROOT;

    if (mode === 'check') {
        console.log('Encoding Integrity Check');
        console.log('='.repeat(50));

        const files = fs.statSync(target).isDirectory() ? walkDir(target) : [target];
        let okCount = 0,
            warnCount = 0,
            errorCount = 0,
            fixableCount = 0;

        for (const file of files) {
            const result = analyzeFile(file);
            const relPath = result.file;

            if (result.status === 'OK') {
                okCount++;
            } else if (result.status === 'WARN') {
                warnCount++;
                console.log(` WARN [${relPath}]: ${result.issues.join('; ')}`);
            } else if (result.status === 'FIXABLE') {
                fixableCount++;
                console.log(`FIXABLE [${relPath}]: ${result.issues.join('; ')}`);
            } else {
                errorCount++;
                console.log(` ERROR [${relPath}]: ${result.issues.join('; ')}`);
            }
        }

        console.log('='.repeat(50));
        console.log(
            `OK: ${okCount} | WARN: ${warnCount} | FIXABLE: ${fixableCount} | ERROR: ${errorCount} | Total: ${files.length}`
        );

        if (errorCount > 0 || fixableCount > 0) {
            process.exit(1);
        }
    } else if (mode === 'fix') {
        console.log('Encoding Auto-Fix');
        console.log('='.repeat(50));

        const files = fs.statSync(target).isDirectory() ? walkDir(target) : [target];
        let fixedCount = 0,
            skipCount = 0,
            failCount = 0;

        for (const file of files) {
            const result = analyzeFile(file);
            if (result.status === 'FIXABLE') {
                if (fixFile(file)) fixedCount++;
                else failCount++;
            } else {
                skipCount++;
            }
        }

        console.log('='.repeat(50));
        console.log(`Fixed: ${fixedCount} | Skipped: ${skipCount} | Failed: ${failCount}`);
    } else if (mode === 'staged') {
        console.log('Encoding Check — Staged Files');
        console.log('='.repeat(50));

        const { execSync } = require('child_process');
        let staged;
        try {
            staged = execSync('git diff --cached --name-only --diff-filter=ACM', {
                cwd: ROOT,
                encoding: 'utf-8'
            }).trim();
        } catch {
            console.log('Not a git repository or git not available');
            process.exit(0);
        }

        if (!staged) {
            console.log('No staged files');
            process.exit(0);
        }

        const stagedFiles = staged.split('\n').filter(Boolean);
        let okCount = 0,
            warnCount = 0,
            errorCount = 0,
            fixableCount = 0;

        for (const relFile of stagedFiles) {
            const fullPath = path.join(ROOT, relFile);
            if (!fs.existsSync(fullPath)) continue;

            const ext = path.extname(relFile).toLowerCase();
            if (!TEXT_EXTENSIONS.has(ext) || IGNORE_EXT.has(ext)) continue;

            const result = analyzeFile(fullPath);
            if (result.status === 'OK') {
                okCount++;
            } else if (result.status === 'WARN') {
                warnCount++;
                console.log(` WARN [${result.file}]: ${result.issues.join('; ')}`);
            } else if (result.status === 'FIXABLE') {
                fixableCount++;
                console.log(`FIXABLE [${result.file}]: ${result.issues.join('; ')}`);
            } else {
                errorCount++;
                console.log(` ERROR [${result.file}]: ${result.issues.join('; ')}`);
            }
        }

        console.log('='.repeat(50));
        console.log(
            `OK: ${okCount} | WARN: ${warnCount} | FIXABLE: ${fixableCount} | ERROR: ${errorCount}`
        );

        if (errorCount > 0 || fixableCount > 0) {
            console.log('\n\u2716 Encoding check FAILED. Fix with: npm run encoding:fix');
            process.exit(1);
        } else if (warnCount > 0) {
            console.log('\n\u26A0 Encoding has warnings (U+FFFD present). Review manually.');
        } else {
            console.log('\n\u2714 All staged files have correct encoding.');
        }
    } else {
        console.log('Usage: node encoding-integrity.js <check|fix|staged> [path]');
        console.log('  check  — Scan project for encoding issues (default)');
        console.log('  fix    — Auto-convert Windows-1250 files to UTF-8');
        console.log('  staged — Check only staged git files (for pre-commit)');
    }
}

main();
