const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

test('opisuje faktyczny zakres obrazu i nie zapewnia o kompletności licencji', async () => {
    const { buildNotices } = await import('../../scripts/generate-licenses.mjs');
    const notices = await buildNotices({
        packages: {
            'node_modules/example-runtime': { version: '1.0.0', license: 'MIT' },
            'node_modules/example-dev': { version: '1.0.0', license: 'MIT', dev: true }
        }
    });

    assert.match(notices, /devDependencies.*(?:zweryfik|sprawd)/i);
    assert.doesNotMatch(notices, /nie są przedmiotem dystrybucji/);
    assert.doesNotMatch(notices, /Pełne teksty licencji pakietów npm znajdują się/);
    assert.match(notices, /brak pliku.*dystrybucji/i);
});

test('odróżnia brak deklaracji i nieobsługiwaną deklarację bez zapewnień handlowych', async () => {
    const { buildNotices } = await import('../../scripts/generate-licenses.mjs');
    const notices = await buildNotices({
        packages: {
            'node_modules/example-unknown': { version: '1.0.0' },
            'node_modules/example-other': { version: '1.0.0', license: 'Other-1.0' }
        }
    });

    assert.match(notices, /Other-1\.0[^\n]*wymaga/i);
    assert.match(notices, /UNKNOWN[^\n]*brak deklaracji/i);
    assert.doesNotMatch(notices, /\| Other-1\.0\s*\|[^\n]*\|\s*tak\s*\|/i);
});

test('opisuje obowiązki Blue Oak, MPL i EPL przy dystrybucji', async () => {
    const { buildNotices } = await import('../../scripts/generate-licenses.mjs');
    const notices = await buildNotices({
        packages: {
            'node_modules/example-blue': { version: '1.0.0', license: 'BlueOak-1.0.0' },
            'node_modules/example-mpl': { version: '1.0.0', license: 'MPL-2.0' },
            'node_modules/example-epl': { version: '1.0.0', license: 'EPL-2.0' }
        }
    });

    assert.match(notices, /BlueOak-1\.0\.0\*\*[^\n]*(?:tekst|link)/i);
    assert.match(notices, /MPL-2\.0\*\*[^\n]*źródł/i);
    assert.match(notices, /EPL-2\.0\*\*[^\n]*źródł/i);
    assert.doesNotMatch(notices, /Projekt nie modyfikuje plików objętych MPL/);
});

test('wskazuje zapis credits Chrome i nie potwierdza wariantu BSD bez dowodów', async () => {
    const { buildNotices } = await import('../../scripts/generate-licenses.mjs');
    const notices = await buildNotices({
        packages: { 'node_modules/example-bsd': { version: '1.0.0', license: 'BSD' } }
    });
    assert.match(notices, /BSD\*\*[^\n]*wariant/i);
    assert.match(notices, /Chrome for Testing[^\n]*chrome:\/\/credits/);
    assert.doesNotMatch(notices, /Chrome for Testing[^\n]*niezweryfikowan/i);
    assert.doesNotMatch(notices, /lista licencji w binarce/i);
    const dockerRow = notices.split('\n').find((line) => line.startsWith('| Docker Engine'));
    assert.equal(dockerRow.split('|').length, 6);
    assert.match(notices, /\| PostgreSQL 18\s+\| osobny kontener Compose/);
    assert.match(notices, /Pełny tekst i copyright: `public\/licenses\/PostgreSQL\.txt`/);
    assert.match(notices, /public\/licenses\/system\/README\.md/);
    assert.match(notices, /public\/licenses\/SheetJS-NOTICE\.txt/);
    assert.match(notices, /\| Docker Desktop \(Windows\)\s+\|.*warunki Docker Desktop/);
    assert.match(notices, /nie potwierdza kompletności/i);
});

test('kanoniczny dokument nie odczytuje lokalnych pakietów node_modules', async () => {
    const { buildNotices } = await import('../../scripts/generate-licenses.mjs');
    const originalExists = fs.existsSync;
    fs.existsSync = (file) => {
        if (String(file).includes('node_modules')) {
            throw new Error('zawartość node_modules zależy od platformy');
        }
        return originalExists(file);
    };
    try {
        const notices = await buildNotices({
            packages: { 'node_modules/example': { version: '1.0.0', license: 'Apache-2.0' } }
        });
        assert.match(notices, /--installed-report/);
    } finally {
        fs.existsSync = originalExists;
    }
});

test('wykrywa brak oraz zmianę zapisanych tekstów i manifestu czytelnego dla odbiorcy', async () => {
    const { verifyLicenseSupplements } =
        await import('../../scripts/verify-license-supplements.mjs');
    const text = 'Oryginalna licencja\n';
    const source = 'https://example.org/project/LICENSE';
    const manifest = {
        version: 1,
        entries: [
            {
                file: 'example-LICENSE.txt',
                sha256: crypto.createHash('sha256').update(text).digest('hex'),
                source,
                packages: [{ name: 'example', version: '1.0.0' }]
            }
        ]
    };
    const readme = '| `example` | 1.0.0 | `example-LICENSE.txt` | ' + source + ' |';
    const lock = { packages: { 'node_modules/example': { version: '1.0.0' } } };
    const files = { 'README.md': readme, 'example-LICENSE.txt': text };
    const readFile = (name) => {
        if (!(name in files)) throw new Error('brak pliku');
        return Buffer.from(files[name]);
    };
    assert.doesNotThrow(() => verifyLicenseSupplements({ manifest, readFile, lock }));
    files['example-LICENSE.txt'] = 'zmieniony tekst';
    assert.throws(() => verifyLicenseSupplements({ manifest, readFile, lock }), /SHA-256/);
    delete files['example-LICENSE.txt'];
    assert.throws(() => verifyLicenseSupplements({ manifest, readFile, lock }), /example-LICENSE/);
    files['example-LICENSE.txt'] = text;
    files['README.md'] = 'brak powiązań';
    assert.throws(() => verifyLicenseSupplements({ manifest, readFile, lock }), /README/);
    files['README.md'] =
        readme + '\n| `other` | 1.0.0 | `other-LICENSE.txt` | https://example.org/other |';
    assert.throws(() => verifyLicenseSupplements({ manifest, readFile, lock }), /README/);
    delete files['README.md'];
    assert.throws(() => verifyLicenseSupplements({ manifest, readFile, lock }), /README/);
});

test('CC BY wskazuje zachowanie not, licencji i oznaczenia zmian', async () => {
    const { buildNotices } = await import('../../scripts/generate-licenses.mjs');
    const notices = await buildNotices({
        packages: {
            'node_modules/example-cc3': { version: '1.0.0', license: 'CC-BY-3.0' },
            'node_modules/example-cc4': { version: '1.0.0', license: 'CC-BY-4.0' }
        }
    });
    for (const version of ['3.0', '4.0']) {
        const line = notices.split('\n').find((item) => item.startsWith(`- **CC-BY-${version}**`));
        assert.match(line, /not|copyright/i);
        assert.match(line, /zmian/i);
        assert.match(line, new RegExp(`creativecommons.org/licenses/by/${version}/legalcode`));
    }
});

test('licenses:check odrzuca brak lub zmianę dołączonego tekstu i brak README', () => {
    const preload = `import fs from 'node:fs';
const original = fs.readFileSync;
fs.readFileSync = function (file, ...args) {
  const target = String(file).replaceAll('\\\\', '/');
  if (process.env.SOK_LICENSE_TEST_CASE === 'readme' && target.endsWith('/public/licenses/npm/README.md')) throw new Error('missing');
  if (target.endsWith('/public/licenses/npm/puppeteer-a207faf-LICENSE.txt')) {
    if (process.env.SOK_LICENSE_TEST_CASE === 'missing') throw new Error('missing');
    if (process.env.SOK_LICENSE_TEST_CASE === 'modified') return Buffer.from('zmienione');
  }
  return original.call(this, file, ...args);
};`;
    const moduleUrl = `data:text/javascript;base64,${Buffer.from(preload).toString('base64')}`;
    const root = path.resolve(__dirname, '../..');
    for (const mode of ['missing', 'modified', 'readme']) {
        const result = spawnSync(
            process.execPath,
            ['--import', moduleUrl, 'scripts/check-licenses.mjs'],
            {
                cwd: root,
                env: { ...process.env, SOK_LICENSE_TEST_CASE: mode },
                encoding: 'utf8'
            }
        );
        assert.equal(result.status, 1, `${mode}: ${result.stderr}`);
        assert.match(result.stderr, /Błąd uzupełnień licencyjnych/);
    }
});
