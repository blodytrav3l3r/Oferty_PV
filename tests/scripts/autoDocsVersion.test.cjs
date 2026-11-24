const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');

const projectRoot = path.resolve(__dirname, '..', '..');
const scriptPath = path.join(projectRoot, 'scripts', 'auto-docs-version.mjs');

test('propagates active markers and preserves historical versions and snapshots', () => {
    const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sok-doc-version-'));
    const docsDir = path.join(fixtureRoot, 'docs');
    const importExportDir = path.join(docsDir, 'import-export');
    const auditsDir = path.join(docsDir, 'audits');
    fs.mkdirSync(importExportDir, { recursive: true });
    fs.mkdirSync(auditsDir);
    fs.writeFileSync(path.join(fixtureRoot, 'VERSION'), '9.8.7\n');
    fs.writeFileSync(path.join(fixtureRoot, 'README.md'), '**Wersja:** 1.0.0\n');
    const fixtureDoc = path.join(docsDir, 'install.md');
    const importExportDoc = path.join(importExportDir, 'transfer.md');
    const historicalDoc = path.join(auditsDir, 'snapshot.md');
    fs.writeFileSync(
        fixtureDoc,
        '**Wersja dokumentacji:** 1.0.0\nWynik wydania 1.0.0 pozostaje historyczny.\n'
    );
    fs.writeFileSync(importExportDoc, '**Wersja:** 1.0.0\n');
    fs.writeFileSync(historicalDoc, '**Wersja:** 1.0.0\n');

    try {
        const result = spawnSync(process.execPath, [scriptPath], {
            cwd: fixtureRoot,
            encoding: 'utf8'
        });

        assert.equal(result.status, 0, result.stderr);
        assert.equal(
            fs.readFileSync(fixtureDoc, 'utf8'),
            '**Wersja dokumentacji:** 9.8.7\nWynik wydania 1.0.0 pozostaje historyczny.\n'
        );
        assert.equal(fs.readFileSync(importExportDoc, 'utf8'), '**Wersja:** 9.8.7\n');
        assert.equal(fs.readFileSync(historicalDoc, 'utf8'), '**Wersja:** 1.0.0\n');
        assert.equal(
            fs.readFileSync(path.join(fixtureRoot, 'README.md'), 'utf8'),
            '**Wersja:** 9.8.7\n'
        );
    } finally {
        const relativePath = path.relative(os.tmpdir(), fixtureRoot);
        if (!relativePath.startsWith('sok-doc-version-') || relativePath.includes('..')) {
            throw new Error(`Refusing to remove an unexpected fixture path: ${fixtureRoot}`);
        }
        fs.rmSync(fixtureRoot, { recursive: true, force: true });
    }
});
