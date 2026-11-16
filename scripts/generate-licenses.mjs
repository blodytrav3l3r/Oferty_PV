#!/usr/bin/env node
/**
 * generate-licenses.mjs — generator pliku THIRD-PARTY-NOTICES.md.
 *
 * Czyta package-lock.json (pole `packages`) i buduje listę wszystkich pakietów
 * w drzewie zależności (nazwa@wersja — licencja, zakres prod/dev), pogrupowaną
 * po licencji i rodzinie licencyjnej. Dodatkowo wykrywa zasoby spoza npm
 * (vendored: SheetJS, Inter, Lucide) oraz składniki platformy (Node, PostgreSQL,
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
import { verifySupplementFiles } from './verify-license-supplements.mjs';

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
    BSD: [
        'Wymaga przeglądu',
        null,
        'Deklaracja BSD nie wskazuje liczby klauzul; ustal wariant i warunki na podstawie plików konkretnego pakietu.'
    ],
    'Apache-2.0': [
        'Permisywna (NOTICE)',
        true,
        'Dołącz tekst licencji oraz plik NOTICE, jeśli pakiet go zawiera.'
    ],
    'BlueOak-1.0.0': [
        'Permisywna (bez atrybucji)',
        false,
        'Przekaż odbiorcom tekst licencji lub link https://blueoakcouncil.org/license/1.0.0.'
    ],
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
        'Zachowaj informacje licencyjne i zapewnij odbiorcom dostęp do kodu źródłowego objętego MPL, także przy dystrybucji formy wykonywalnej. Warunki obejmują również modyfikacje; sprawdź sekcje 3.1–3.3: https://www.mozilla.org/en-US/MPL/2.0/.'
    ],
    'EPL-2.0': [
        'Słabe copyleft',
        true,
        'Zachowaj informacje licencyjne; przy dystrybucji programu w formie wynikowej zapewnij dostęp do odpowiadającego kodu źródłowego na warunkach EPL. Sprawdź zakres i warunki: https://www.eclipse.org/legal/epl-2.0/.'
    ],
    'MIT and ISC': [
        'Permisywna',
        true,
        'Deklaracja pakietu obejmuje MIT i ISC; zachowaj odpowiednie teksty licencji oraz informacje o prawach autorskich.'
    ],
    Unlicense: [
        'Domena publiczna',
        false,
        'Sprawdź tekst i informacje dołączone do konkretnego pakietu: https://unlicense.org/.'
    ],
    'CC-BY-3.0': [
        'Treści / dane',
        true,
        'Zachowaj wymagane noty i copyright, podaj autora i źródło, link do licencji oraz oznacz zmiany, gdy ma to zastosowanie: https://creativecommons.org/licenses/by/3.0/legalcode.'
    ],
    'CC-BY-4.0': [
        'Treści / dane',
        true,
        'Zachowaj wymagane noty i copyright, podaj autora i źródło, link do licencji oraz oznacz zmiany, gdy ma to zastosowanie: https://creativecommons.org/licenses/by/4.0/legalcode.'
    ],
    'CC0-1.0': ['Domena publiczna', false, 'Brak obowiązku atrybucji.'],
    UNKNOWN: [
        'Wymaga przeglądu',
        null,
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

function compareStrings(a, b) {
    return a < b ? -1 : a > b ? 1 : 0;
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
    items.sort((a, b) => compareStrings(a.name + a.version + a.key, b.name + b.version + b.key));
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
        return compareStrings(a[0], b[0]);
    });
}

function metaFor(license) {
    return (
        LICENSE_META[license] || [
            'Wymaga przeglądu',
            null,
            'Deklaracja licencji nie jest obsługiwana przez generator — zweryfikuj jej tekst i warunki przed dystrybucją.'
        ]
    );
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
    return {
        nodeEngine: pkg.engines?.node || '—',
        baseImage
    };
}

function buildSummary(groups) {
    const lines = [];
    lines.push('| Licencja | Prod | Dev | Rodzaj | Atrybucja |');
    lines.push('| --- | ---: | ---: | --- | :---: |');
    for (const [license, pkgs] of groups) {
        const [family, attribution] = metaFor(license);
        const { prod, dev } = countScope(pkgs);
        lines.push(
            `| ${license} | ${prod} | ${dev} | ${family} | ${attribution === null ? 'do ustalenia' : attribution ? 'tak' : 'nie'} |`
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
        `| SheetJS Community Edition (\`public/vendor/xlsx.full.min.js\`) | ${assets.xlsx.version} | Apache-2.0 | \`public/licenses/APACHE-2.0.txt\`; nota o wersji, atrybucji i braku NOTICE upstream: \`public/licenses/SheetJS-NOTICE.txt\` | \`e.version\` + sha256 \`${assets.xlsx.hash}\` |`
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
        '| PostgreSQL 18 | osobny kontener Compose `postgres:18-alpine@sha256:b6972e11…f015` | PostgreSQL License | Pełny tekst i copyright: `public/licenses/PostgreSQL.txt`. Serwer jest kompilowany ze źródeł do `/usr/local` w obrazie (18.7) i nie ma tam pliku COPYRIGHT. Pakiety Alpine: inwentarz i obowiązki w `public/licenses/system/README.md`. |'
    );
    lines.push(
        '| Docker Engine + Docker Compose plugin | hostowa zależność instalatora Linux z oficjalnego repozytorium; nie są dołączane do artefaktu S.O.K. | Apache-2.0 | https://docs.docker.com/engine/ oraz https://github.com/docker/compose/blob/main/LICENSE |'
    );
    lines.push(
        '| Docker Desktop (Windows) | hostowa zależność instalatora testowego; użytkownik instaluje i akceptuje warunki osobno | warunki Docker Desktop | Nie jest dołączany do artefaktu S.O.K.; sprawdź warunki i wymagania subskrypcji dla organizacji. https://www.docker.com/legal/docker-subscription-service-agreement/ |'
    );
    lines.push(
        `| Obraz bazowy Docker | \`${platform.baseImage}\` | MIT (Node) + licencje pakietów Debian | Pełne teksty: \`/usr/share/doc/*/copyright\` w obrazie (226 plików). Inwentarz 229 pakietów i opis: \`public/licenses/system/README.md\`. |`
    );
    lines.push(
        '| Chrome for Testing (Puppeteer) | instalowany jawnie w Dockerfile przez Puppeteer | licencje Chromium i komponentów | Zapis `chrome://credits` dla wersji instalowanej przez aktualny Puppeteer: `public/licenses/chrome-for-testing/<wersja>/credits.html`. Po zmianie wersji przeglądarki zapis wygenerować ponownie. Źródło upstream: https://chromium.googlesource.com/chromium/src/+/main/LICENSE |'
    );
    lines.push(
        '| Caddy (opcjonalny reverse proxy) | wdrożenie hosta | Apache-2.0 | Nie jest częścią artefaktu aplikacji. |'
    );
    return lines;
}

function buildApacheStatus(items) {
    const apache = items.filter((p) => p.license === 'Apache-2.0');
    const lines = [];
    lines.push('| Pakiet | Wersja | Zakres lockfile | Plik LICENSE | Plik NOTICE |');
    lines.push('| --- | --- | --- | :---: | :---: |');
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
        lines.push(
            `| ${p.name} | ${p.version} | ${p.dev ? 'dev' : 'prod'} | ${licenseState} | ${noticeState} |`
        );
    }
    return lines;
}

function buildMissingLicenseFiles(items) {
    const missing = items.filter((p) => {
        const files = findPackageFiles(p.key);
        return files.installed && files.license.length === 0;
    });
    const notInstalled = items.filter((p) => !findPackageFiles(p.key).installed).length;
    const lines = [];
    lines.push(
        `Nie można sprawdzić ${notInstalled} wpisów lockfile bez lokalnego katalogu pakietu; część może dotyczyć innych platform lub instalacji.`
    );
    lines.push('');
    if (missing.length === 0) {
        lines.push(
            'Nie wykryto brakujących plików LICENSE/COPYING w sprawdzonych katalogach pakietów.'
        );
        return lines;
    }
    lines.push(
        'Lokalnie zainstalowane pakiety bez pliku `LICENSE`/`COPYING` w katalogu głównym. Należy sprawdzić także inne pliki pakietu i źródła upstream oraz sposób przekazania wymaganych informacji odbiorcom.'
    );
    lines.push('');
    lines.push('| Pakiet | Wersja | Zakres lockfile | Deklarowana licencja | Repozytorium |');
    lines.push('| --- | --- | --- | --- | --- |');
    for (const p of missing) {
        lines.push(
            `| ${p.name} | ${p.version} | ${p.dev ? 'dev' : 'prod'} | ${p.license} | ${readPackageRepo(p.key)} |`
        );
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
        `- Wpisy bez flagi dev w lockfile: **${prod}**; nie jest to inwentaryzacja rzeczywiście zainstalowanych pakietów.`
    );
    lines.push(
        `- Wpisy z flagą dev w lockfile: **${dev}**. Zakres zależy od instalacji, platformy i sposobu dystrybucji.`
    );
    lines.push(
        '- Zasoby spoza npm (vendored): SheetJS, font Inter, subset ikon Lucide — są serwowane z `public/` i wymagają atrybucji.'
    );
    lines.push(
        '- Obecność devDependencies oraz ich obowiązki należy zweryfikować w rzeczywistym obrazie Docker i pozostałych artefaktach.'
    );
    lines.push(
        '- Oznaczenia `[prod]` / `[dev]` w sekcji 7 pochodzą z flagi dev w lockfile i nie dowodzą, czy dany pakiet znalazł się w konkretnym artefakcie.'
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
        '- Pliki licencji i NOTICE pakietów należy sprawdzić w rzeczywistym artefakcie. Brak pliku w lokalnym `node_modules` wymaga ustalenia źródła tekstu i sposobu dołączenia go do dystrybucji.'
    );
    lines.push(
        '- Zweryfikowane dodatkowe teksty dla wybranych wersji pakietów i ich źródła opisuje `public/licenses/npm/README.md`. Ta lista nie potwierdza kompletności licencji wszystkich zależności i artefaktów.'
    );
    lines.push(
        '- Teksty dla zasobów vendored są w `public/licenses/` i są dostępne pod `/licenses/<plik>` w działającej aplikacji.'
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
        'Lista zawiera wpisy `package-lock.json`; oznaczenia prod/dev nie potwierdzają zawartości artefaktu.'
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
    lines.push('## 8. Weryfikacja Apache-2.0 (NOTICE)');
    lines.push('');
    lines.push(
        'Wpisy Apache-2.0 wymagają weryfikacji tekstu licencji i ewentualnych plików NOTICE w dystrybuowanych pakietach oraz źródłach upstream. Sam lockfile nie potwierdza ich obecności.'
    );
    lines.push('');
    lines.push('## 9. Sprawdzanie lokalnych katalogów pakietów');
    lines.push('');
    lines.push(
        'Uruchom `node scripts/generate-licenses.mjs --installed-report`, aby wypisać diagnostykę lokalnej instalacji bez zapisu do tego dokumentu. Wynik zależy od platformy i zainstalowanych pakietów; nie zastępuje kontroli finalnego artefaktu ani upstream.'
    );
    lines.push('');
    lines.push('## 10. Weryfikacja i aktualizacja');
    lines.push('');
    lines.push('```bash');
    lines.push('npm run licenses:generate   # regeneracja tego pliku');
    lines.push('npm run licenses:check      # porównanie z package-lock.json (brama validate)');
    lines.push(
        'node scripts/generate-licenses.mjs --installed-report # raport lokalnej instalacji'
    );
    lines.push('```');
    lines.push('');
    lines.push(
        'Po dodaniu, usunięciu lub aktualizacji pakietu uruchom `licenses:generate` i zacommituj wynik razem ze zmianą w `package-lock.json`.'
    );
    lines.push(
        'Brama `licenses:check` porównuje wygenerowaną treść poza datą; nie potwierdza kompletności ani zgodności dystrybucji z licencjami i nie wykrywa wszystkich zmian zawartości zasobów.'
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
        verifySupplementFiles(lock);
    } catch (err) {
        console.error(`Błąd uzupełnień licencyjnych: ${err.message}`);
        process.exit(1);
    }
    if (process.argv.slice(2).includes('--installed-report')) {
        const items = collectPackages(lock);
        console.log('# Lokalny raport licencji (nie jest inwentarzem finalnego artefaktu)\n');
        console.log(
            'Wersje pochodzą z lockfile; wersje zainstalowanych pakietów nie są sprawdzane.\n'
        );
        console.log('## Apache-2.0\n');
        console.log(buildApacheStatus(items).join('\n'));
        console.log('\n## Lokalne katalogi bez pliku licencji\n');
        console.log(buildMissingLicenseFiles(items).join('\n'));
        return;
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
