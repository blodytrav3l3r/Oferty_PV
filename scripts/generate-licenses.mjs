#!/usr/bin/env node
/**
 * generate-licenses.mjs — generator pliku THIRD-PARTY-NOTICES.md.
 *
 * Czyta package-lock.json (pole `packages`) i buduje listę wszystkich pakietów
 * w drzewie zależności (nazwa@wersja — licencja, zakres prod/dev), pogrupowaną
 * po licencji i rodzinie licencyjnej. Dodatkowo wykrywa zasoby spoza npm
 * (vendored: SheetJS, Inter, Lucide) oraz składniki platformy (Node, SQLite,
 * obraz Docker), żeby dokument pokrywał całość dystrybucji.
 *
 * Zapis: UTF-8 bez BOM, zakończenia linii LF (spójne z encoding policy + Prettier).
 *
 * Użycie:
 *   node scripts/generate-licenses.mjs            # zapisuje THIRD-PARTY-NOTICES.md
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { format } from 'prettier';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LOCKFILE = path.join(ROOT, 'package-lock.json');
const PKG_FILE = path.join(ROOT, 'package.json');
const DOCKERFILE = path.join(ROOT, 'Dockerfile');
const OUT_FILE = path.join(ROOT, 'THIRD-PARTY-NOTICES.md');
const LICENSES_DIR = path.join(ROOT, 'public', 'licenses');

const VENDORED = {
    xlsx: path.join(ROOT, 'public', 'vendor', 'xlsx.full.min.js'),
    fonts: path.join(ROOT, 'public', 'css', 'fonts'),
    interCss: path.join(ROOT, 'public', 'css', 'inter.css'),
    icons: path.join(ROOT, 'public', 'js', 'shared', 'iconsSlim.js')
};

const VENDORED_LICENSE_FILES = {
    apache: path.join(LICENSES_DIR, 'APACHE-2.0.txt'),
    ofl: path.join(LICENSES_DIR, 'SIL-OFL-1.1.txt'),
    lucide: path.join(LICENSES_DIR, 'ISC-Lucide.txt')
};

const FAMILY_ORDER = [
    'Permisywna',
    'Permisywna (NOTICE)',
    'Permisywna (bez atrybucji)',
    'Dualna — wybór licencji',
    'Słabe copyleft',
    'Treści / dane',
    'Domena publiczna',
    'Wymaga przeglądu'
];

const LICENSE_META = {
    MIT: ['Permisywna', true, 'Zachowaj notę o prawach autorskich i tekst licencji.'],
    ISC: ['Permisywna', true, 'Zachowaj notę o prawach autorskich i tekst licencji.'],
    'BSD-2-Clause': ['Permisywna', true, 'Zachowaj notę o prawach autorskich i tekst licencji.'],
    'BSD-3-Clause': ['Permisywna', true, 'Zachowaj notę o prawach autorskich i tekst licencji.'],
    BSD: ['Permisywna', true, 'Zachowaj notę o prawach autorskich i tekst licencji.'],
    'Apache-2.0': [
        'Permisywna (NOTICE)',
        true,
        'Dołącz tekst licencji oraz plik NOTICE, jeśli pakiet go zawiera.'
    ],
    'BlueOak-1.0.0': ['Permisywna (bez atrybucji)', false, 'Brak obowiązku atrybucji.'],
    'MIT-0': ['Permisywna (bez atrybucji)', false, 'Brak obowiązku atrybucji.'],
    '0BSD': ['Permisywna (bez atrybucji)', false, 'Brak obowiązku atrybucji.'],
    'Python-2.0': ['Permisywna', true, 'Zachowaj notę o prawach autorskich i tekst licencji PSF.'],
    'MIT OR Apache-2.0': [
        'Dualna — wybór licencji',
        true,
        'Projekt korzysta ze ścieżki MIT; zachowaj notę i tekst MIT.'
    ],
    'MIT OR CC0-1.0': [
        'Dualna — wybór licencji',
        false,
        'Wybór MIT (atrybucja) albo CC0 (bez atrybucji); wystarczy jedna ścieżka.'
    ],
    'MIT OR GPL-3.0-or-later': [
        'Dualna — wybór licencji',
        true,
        'Projekt korzysta ze ścieżki MIT — bez obowiązków copyleft.'
    ],
    'MIT AND Zlib': ['Permisywna', true, 'Spełnij oba warunki: nota MIT oraz nota Zlib.'],
    'MPL-2.0': [
        'Słabe copyleft',
        true,
        'Copyleft na poziomie pliku; publikuj źródło zmodyfikowanych plików MPL, reszta produktu bez zmian.'
    ],
    'CC-BY-3.0': ['Treści / dane', true, 'Podaj autora i źródło danych.'],
    'CC-BY-4.0': ['Treści / dane', true, 'Podaj autora i źródło danych.'],
    'CC0-1.0': ['Domena publiczna', false, 'Brak obowiązku atrybucji.'],
    UNKNOWN: [
        'Wymaga przeglądu',
        false,
        'Brak deklaracji licencji — zweryfikuj ręcznie przed dystrybucją.'
    ]
};

function readText(file) {
    return fs.readFileSync(file, 'utf-8');
}

function licenseToString(license) {
    if (typeof license === 'string') return license;
    if (license && typeof license === 'object' && license.type) return license.type;
    return 'UNKNOWN';
}

// Normalizacja licencji: "(MIT OR CC0-1.0)" → "MIT OR CC0-1.0".
function normalizeLicense(license) {
    return license.replace(/^\(|\)$/g, '').trim();
}

// Wyciąga nazwę pakietu z klucza package-lock ("node_modules/@scope/pkg" → "@scope/pkg").
function nameFromKey(key) {
    const parts = key.split('node_modules/');
    return parts[parts.length - 1];
}

function collectPackages(lock) {
    const items = [];
    for (const [key, pkg] of Object.entries(lock.packages || {})) {
        if (!key || !pkg || !pkg.version) continue; // pomiń root ""
        items.push({
            key,
            name: nameFromKey(key),
            version: pkg.version,
            license: normalizeLicense(licenseToString(pkg.license)),
            dev: pkg.dev === true
        });
    }
    items.sort((a, b) => (a.name + a.version + a.key).localeCompare(b.name + b.version + b.key));
    return items;
}

function groupByLicense(items) {
    const groups = new Map();
    for (const item of items) {
        if (!groups.has(item.license)) groups.set(item.license, []);
        groups.get(item.license).push(item);
    }
    return [...groups.entries()].sort((a, b) => {
        const fa = FAMILY_ORDER.indexOf(metaFor(a[0])[0]);
        const fb = FAMILY_ORDER.indexOf(metaFor(b[0])[0]);
        if (fa !== fb) return fa - fb;
        const sa = a[1].filter((p) => !p.dev).length + a[1].length;
        const sb = b[1].filter((p) => !p.dev).length + b[1].length;
        if (sa !== sb) return sb - sa;
        return a[0].localeCompare(b[0]);
    });
}

function metaFor(license) {
    return LICENSE_META[license] || LICENSE_META.UNKNOWN;
}

function countScope(items) {
    const prod = items.filter((p) => !p.dev).length;
    return { prod, dev: items.length - prod };
}

function findPackageFiles(key) {
    const dir = path.join(ROOT, key);
    if (!fs.existsSync(dir)) return { installed: false, license: [], notice: [] };
    const files = fs.readdirSync(dir);
    return {
        installed: true,
        license: files.filter((f) => /^(licen[cs]e|copying)/i.test(f)),
        notice: files.filter((f) => /^notice/i.test(f))
    };
}

function readPackageRepo(key) {
    try {
        const pkg = JSON.parse(readText(path.join(ROOT, key, 'package.json')));
        return pkg.repository?.url || pkg.repository || pkg.homepage || '—';
    } catch {
        return '—';
    }
}

function detectVendoredAssets() {
    if (!fs.existsSync(VENDORED.xlsx)) {
        throw new Error(`Brak zasobu ${VENDORED.xlsx} — nie można potwierdzić wersji SheetJS.`);
    }
    for (const [label, file] of Object.entries(VENDORED_LICENSE_FILES)) {
        if (!fs.existsSync(file)) {
            throw new Error(`Brak pliku licencji (${label}): ${path.relative(ROOT, file)}.`);
        }
    }

    const xlsxSource = readText(VENDORED.xlsx);
    const xlsxVersion = /e\.version = '([0-9.]+)'/.exec(xlsxSource)?.[1] || 'nieznana';
    const xlsxHash = crypto.createHash('sha256').update(xlsxSource).digest('hex').slice(0, 16);

    const fontFiles = fs.existsSync(VENDORED.fonts)
        ? fs.readdirSync(VENDORED.fonts).filter((f) => f.endsWith('.woff2'))
        : [];
    const interCss = fs.existsSync(VENDORED.interCss) ? readText(VENDORED.interCss) : '';
    const fontWeights = [
        ...new Set([...interCss.matchAll(/font-weight:\s*(\d+)/g)].map((m) => m[1]))
    ]
        .sort((a, b) => Number(a) - Number(b))
        .join(', ');

    return {
        xlsx: { version: xlsxVersion, hash: xlsxHash },
        fonts: { count: fontFiles.length, weights: fontWeights || '—' },
        icons: fs.existsSync(VENDORED.icons)
    };
}

function detectPlatform() {
    const pkg = JSON.parse(readText(PKG_FILE));
    const dockerfile = fs.existsSync(DOCKERFILE) ? readText(DOCKERFILE) : '';
    const baseImage = /^FROM\s+(\S+)/im.exec(dockerfile)?.[1] || '—';
    // Komentarze w Dockerfile nie są instrukcjami — liczy się tylko realny RUN.
    const dockerInstructions = dockerfile
        .split(/\r?\n/)
        .filter((line) => !line.trim().startsWith('#'))
        .join('\n');
    const keepsDevDeps = /npm\s+prune/i.test(dockerInstructions) === false;
    return {
        nodeEngine: pkg.engines?.node || '—',
        baseImage,
        keepsDevDeps
    };
}

function buildSummary(groups) {
    const lines = [];
    lines.push('| Licencja | Prod | Dev | Rodzaj | Komercyjnie | Atrybucja |');
    lines.push('| --- | ---: | ---: | --- | :---: | :---: |');
    for (const [license, pkgs] of groups) {
        const [family, attribution] = metaFor(license);
        const { prod, dev } = countScope(pkgs);
        lines.push(
            `| ${license} | ${prod} | ${dev} | ${family} | tak | ${attribution ? 'tak' : 'nie'} |`
        );
    }
    return lines;
}

function buildObligations(groups) {
    const lines = [];
    for (const [license] of groups) {
        const [, , obligation] = metaFor(license);
        lines.push(`- **${license}** — ${obligation}`);
    }
    return lines;
}

function buildVendored(assets) {
    const lines = [];
    lines.push('| Zasób | Wersja | Licencja | Plik licencji w repo | Dowód wersji |');
    lines.push('| --- | --- | --- | --- | --- |');
    lines.push(
        `| SheetJS Community Edition (\`public/vendor/xlsx.full.min.js\`) | ${assets.xlsx.version} | Apache-2.0 | \`public/licenses/APACHE-2.0.txt\` | \`e.version\` + sha256 \`${assets.xlsx.hash}\` |`
    );
    lines.push(
        `| Inter — subset woff2 (\`public/css/fonts/\`, ${assets.fonts.count} plików) | subset statyczny (wagi ${assets.fonts.weights}) | SIL OFL 1.1 | \`public/licenses/SIL-OFL-1.1.txt\` | \`public/css/inter.css\` |`
    );
    lines.push(
        `| Lucide — subset ikon (\`public/js/shared/iconsSlim.js\`) | subset (bez numeru wersji w pliku) | ISC + MIT (część Feather) | \`public/licenses/ISC-Lucide.txt\` | nagłówek pliku + \`data-lucide\` w HTML |`
    );
    return lines;
}

function buildPlatform(platform) {
    const lines = [];
    lines.push('| Składnik | Wersja / źródło | Licencja | Uwagi |');
    lines.push('| --- | --- | --- | --- |');
    lines.push(
        `| Node.js | \`${platform.nodeEngine}\` | MIT | Runtime aplikacji; tekst licencji w dystrybucji Node. |`
    );
    lines.push(
        '| SQLite (silnik Prisma) | biblioteka dołączona do `@prisma/client` | Public Domain | https://sqlite.org/copyright.html |'
    );
    lines.push(
        `| Obraz bazowy Docker | \`${platform.baseImage}\` | MIT (Node) + licencje pakietów Debian | Pełne teksty: \`/usr/share/doc/*/copyright\` w obrazie. |`
    );
    lines.push(
        '| Chromium (Puppeteer) | pobierany przy `npm ci` | BSD-3-Clause + licencje komponentów | Używany do PDF; lista licencji w binarce Chromium. |'
    );
    lines.push(
        '| Caddy (opcjonalny reverse proxy) | wdrożenie hosta | Apache-2.0 | Nie jest częścią artefaktu aplikacji. |'
    );
    return lines;
}

function buildApacheStatus(items) {
    const apache = items.filter((p) => !p.dev && p.license === 'Apache-2.0');
    const lines = [];
    lines.push('| Pakiet | Wersja | Plik LICENSE | Plik NOTICE |');
    lines.push('| --- | --- | :---: | :---: |');
    for (const p of apache) {
        const files = findPackageFiles(p.key);
        const licenseState = !files.installed
            ? 'brak katalogu'
            : files.license.length
              ? 'tak'
              : 'nie';
        const noticeState = !files.installed
            ? 'brak katalogu'
            : files.notice.length
              ? 'tak'
              : 'nie';
        lines.push(`| ${p.name} | ${p.version} | ${licenseState} | ${noticeState} |`);
    }
    return lines;
}

function buildMissingLicenseFiles(items) {
    const missing = items.filter((p) => !p.dev && findPackageFiles(p.key).license.length === 0);
    if (missing.length === 0) return ['Wszystkie pakiety produkcyjne zawierają plik LICENSE.'];
    const lines = [];
    lines.push(
        'Pakiety produkcyjne bez pliku `LICENSE`/`COPYING` w zainstalowanym katalogu. Licencja pochodzi z `package.json`; tekst należy zachować z repozytorium upstream (są to zależności pośrednie).'
    );
    lines.push('');
    lines.push('| Pakiet | Wersja | Deklarowana licencja | Repozytorium |');
    lines.push('| --- | --- | --- | --- |');
    for (const p of missing) {
        lines.push(`| ${p.name} | ${p.version} | ${p.license} | ${readPackageRepo(p.key)} |`);
    }
    return lines;
}

async function buildNotices(lock) {
    const items = collectPackages(lock);
    const groups = groupByLicense(items);
    const assets = detectVendoredAssets();
    const platform = detectPlatform();
    const today = new Date().toISOString().slice(0, 10);
    const prod = items.filter((p) => !p.dev).length;
    const dev = items.length - prod;

    const lines = [];
    lines.push('# THIRD-PARTY-NOTICES');
    lines.push('');
    lines.push('Informacje o oprogramowaniu firm trzecich używanym w projekcie');
    lines.push('**S.O.K. — System Ofert i Kalkulacji**.');
    lines.push('');
    lines.push(
        `> Plik generowany automatycznie z \`package-lock.json\` oraz zasobów w \`public/\` przez \`npm run licenses:generate\`. Nie edytuj ręcznie — zmień generator \`scripts/generate-licenses.mjs\`.`
    );
    lines.push('');
    lines.push(`Dane na dzień: **${today}**.`);
    lines.push('');
    lines.push('## 1. Licencja projektu');
    lines.push('');
    lines.push('Projekt **S.O.K. — System Ofert i Kalkulacji** jest objęty licencją własnościową.');
    lines.push(
        'Właściciel praw majątkowych i warunki licencji — patrz `LICENSE` (nagłówek Copyright).'
    );
    lines.push('Kod projektu nie jest objęty licencją open source; szczegóły w `LICENSE`.');
    lines.push('');
    lines.push('## 2. Model dystrybucji i zakres dokumentu');
    lines.push('');
    lines.push(
        `- Zależności produkcyjne: **${prod}** pakietów — wchodzą do obrazu Docker i artefaktu wdrożenia.`
    );
    lines.push(
        `- Zależności deweloperskie/testowe: **${dev}** pakietów — nie są wymagane w runtime i nie są przedmiotem dystrybucji.`
    );
    lines.push(
        '- Zasoby spoza npm (vendored): SheetJS, font Inter, subset ikon Lucide — są serwowane z `public/` i wymagają atrybucji.'
    );
    lines.push(
        platform.keepsDevDeps
            ? '- Obraz Docker zachowuje `node_modules` (także devDependencies), więc teksty licencji są obecne w obrazie.'
            : '- Obraz Docker usuwa devDependencies (`npm prune`), więc w obrazie pozostają tylko teksty licencji pakietów produkcyjnych.'
    );
    lines.push(
        '- Oznaczenia `[prod]` / `[dev]` w sekcji 7 określają zakres: `[prod]` = dystrybuowane, `[dev]` = tylko development/CI.'
    );
    lines.push('');
    lines.push('## 3. Podsumowanie licencji');
    lines.push('');
    lines.push(...buildSummary(groups));
    lines.push('');
    lines.push('## 4. Obowiązki przy dystrybucji');
    lines.push('');
    lines.push(...buildObligations(groups));
    lines.push('');
    lines.push(
        '- Pełne teksty licencji pakietów npm znajdują się w `node_modules/<pakiet>/LICENSE` (obraz Docker je zawiera).'
    );
    lines.push(
        '- Teksty dla zasobów vendored są w `public/licenses/` i są dostępne pod `/licenses/<plik>` w działającej aplikacji.'
    );
    lines.push(
        '- Projekt nie modyfikuje plików objętych MPL-2.0; obowiązek udostępnienia źródła dotyczy tylko przyszłych modyfikacji tych plików.'
    );
    lines.push('');
    lines.push('## 5. Zasoby spoza npm (vendored)');
    lines.push('');
    lines.push(...buildVendored(assets));
    lines.push('');
    lines.push('## 6. Składniki platformy i wdrożenia');
    lines.push('');
    lines.push(...buildPlatform(platform));
    lines.push('');
    lines.push('## 7. Pakiety npm według licencji');
    lines.push('');
    lines.push(
        'Lista zawiera wszystkie pakiety z drzewa `package-lock.json`, z podziałem na zakres dystrybucji.'
    );
    lines.push('');
    for (const [license, pkgs] of groups) {
        const { prod: p, dev: d } = countScope(pkgs);
        lines.push(`### ${license} (${pkgs.length}; prod: ${p}, dev: ${d})`);
        lines.push('');
        for (const item of pkgs) {
            lines.push(`- ${item.name}@${item.version} [${item.dev ? 'dev' : 'prod'}]`);
        }
        lines.push('');
    }
    lines.push('## 8. Status Apache-2.0 (NOTICE)');
    lines.push('');
    lines.push(
        'Dla pakietów Apache-2.0 w dystrybucji sprawdzono obecność plików `LICENSE` i `NOTICE` w zainstalowanym pakiecie.'
    );
    lines.push('');
    lines.push(...buildApacheStatus(items));
    lines.push('');
    const noticeRequired = items.filter(
        (p) => !p.dev && p.license === 'Apache-2.0' && findPackageFiles(p.key).notice.length > 0
    );
    if (noticeRequired.length > 0) {
        lines.push(
            `Pakiety z plikiem NOTICE (zachowaj go w dystrybucji): ${noticeRequired
                .map((p) => `\`${p.name}\``)
                .join(', ')}.`
        );
        lines.push('');
    }
    lines.push('Pakiety z „nie” w kolumnie LICENSE są wymienione w sekcji 9.');
    lines.push('');
    lines.push('## 9. Pakiety bez pliku licencji w dystrybucji');
    lines.push('');
    lines.push(...buildMissingLicenseFiles(items));
    lines.push('');
    lines.push('## 10. Weryfikacja i aktualizacja');
    lines.push('');
    lines.push('```bash');
    lines.push('npm run licenses:generate   # regeneracja tego pliku');
    lines.push('npm run licenses:check      # porównanie z package-lock.json (brama validate)');
    lines.push('```');
    lines.push('');
    lines.push(
        'Po dodaniu, usunięciu lub aktualizacji pakietu uruchom `licenses:generate` i zacommituj wynik razem ze zmianą w `package-lock.json`.'
    );
    lines.push(
        'Brama `licenses:check` porównuje cały plik poza datą generowania, więc każda zmiana drzewa zależności lub zasobów vendored wymaga regeneracji.'
    );
    lines.push('');
    return format(lines.join('\n') + '\n', { parser: 'markdown' });
}

async function main() {
    let lock;
    try {
        lock = JSON.parse(readText(LOCKFILE));
    } catch (err) {
        console.error(`Nie można odczytać ${LOCKFILE}: ${err.message}`);
        process.exit(1);
    }
    try {
        fs.writeFileSync(OUT_FILE, await buildNotices(lock), 'utf-8');
    } catch (err) {
        console.error(`Nie można wygenerować ${OUT_FILE}: ${err.message}`);
        process.exit(1);
    }
    const count = collectPackages(lock).length;
    console.log(`✓ Wygenerowano ${OUT_FILE} (${count} pakietów).`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    main();
}

export { buildNotices, collectPackages, groupByLicense };
