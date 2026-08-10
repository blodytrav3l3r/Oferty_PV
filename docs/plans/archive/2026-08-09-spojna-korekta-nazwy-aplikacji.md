# Spójna korekta nazwy aplikacji na S.O.K. — kompletny plan wykonania

> Status: **plan** (po akceptacji — wykonanie etapami)
> Data: 2026-08-09
> Bazowe commity: `7075879` (rebranding), `0731d2b` (wersja 1.12.0 spójna)
> Źródło: konsolidacja analiz 11 subagentów (architect, build-error-resolver,
> code-reviewer, doc-updater, explore, general, planner, refactor-cleaner,
> security-reviewer, tdd-guide, e2e-runner)
> Wersja bazowa: 1.12.0 (VERSION/package.json/CHANGELOG spójne)

## 1. Cel i zakres

Doprowadzić nazwę aplikacji **„WITROS Oferty PV”** (oraz warianty „WITROS Oferty”,
„WITROS — Generator Ofert”, „WITROS PRECISION OS”) do **jednej nazwy systemu:
„S.O.K. — System Ofert i Kalkulacji”** we wszystkich **żywych** (nie-historycznych)
plikach — łącznie z warstwą Docker/CI — minimalizując ryzyko regresji przez
testy, runbooki migracji i strażnika anty-regresyjnego.

### Kryteria spójności (co jest poprawnym stanem końcowym)

1. **Nazwa aplikacji** = `S.O.K.` / `S.O.K. — System Ofert i Kalkulacji`.
2. **Firma/producent WITROS zostaje bez zmian** — nie jest nazwą aplikacji
   (contact Swagger, stopka PDF, telemetry producer, dane seed, „Autor: WITROS”).
3. **Identyfikatory operacyjne** zmieniane są **wyłącznie z migracją danych**
   (wariant B Dockera, task Scheduler, klucze localStorage — patrz §3 i runbooki).
4. **Dokumenty historyczne** (`docs/plans/archive/**`, `docs/adr/**`, `CHANGELOG.md`,
   `docs/AUDIT.md`) nie są modyfikowane — opisują decyzje z przeszłości.
5. Po KAŻDYM etapie build + testy + CI są zielone (incremental green).

## 2. Fakty zweryfikowane (stan bieżący — potwierdzone przez subagentów)

- **`APP_INFO` NIE istnieje w repo** (grep=0). `/api/version` zwraca `getVersion()`
  z `src/version.ts` (bez pola `name`), `/health` również — **bez zmian**.
- Backend nazwę już ma: `server.ts:45` (log), `src/swagger.ts:8` (title S.O.K.,
  contact „WITROS” zostaje), `src/app.ts:118` (customSiteTitle). **Nie tworzymy
  `src/appName.ts`** (YAGNI — nazwa w ~10 stałych miejscach, brak 30 importerów;
  pełna analiza refactor-cleaner: 1 użycie w JS + 3 różne warianty w backendzie +
  5 statycznych `<title>` — stała nie dałaby DRY bez nadmiaru).
- Tytuły/meta 5 modułów HTML (`app.html`, `kartoteka.html`, `rury.html`,
  `studnie.html`, `zlecenia.html`) — już S.O.K. (commit `7075879`).
- **Jedyny żywy bug runtime:** `public/js/rury/orderEditMode.js:92` —
  `document.title = 'WITROS — Generator Ofert'` cofa tytuł zakładki.
- `Dockerfile`, `.dockerignore`, `Caddyfile` — **zero trafień** „witros” (tylko
  `scripts/docker-entrypoint.sh:6` — banner, do zmiany). Jedyna lokalizacja danych
  w Dockerze: named volume `witros_data` → `/var/data`; brak bind mounts.
- **Ważne dla testu E2E:** `document.title` ustawiane wewnątrz iframe modułu NIE
  zmienia tytułu karty przeglądarki (top-level to `app.html`) — asercje tytułu
  regresyjne robimy w `frame.evaluate(() => document.title)`, nie `page.title()`.

## 3. Czego NIE zmieniamy bez migracji (decyzja architektoniczna + runbooki)

> Tabela A — elementy NIETKALNE (bez względu na decyzję o Dockerze):

| Element                                                                                                                      | Lokalizacja                                                                                                             | Powód                                                                                                                                                                        |
| ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Wolumen docker `witros_data`                                                                                                 | `docker-compose.yml:19,36`                                                                                              | Zmiana bez migracji = nowy PUSTY wolumen → seed pustej bazy = **pozorowana utrata danych (KRYTYCZNE, deterministyczne 100%)**. Zmiana WYŁĄCZNIE wg runbooku §4.3 (wariant B) |
| Ścieżka `/var/data` + `DATABASE_URL=file:/var/data/...`                                                                      | `Dockerfile:37`, `docker-entrypoint.sh:13`                                                                              | Zmiana = aplikacja szuka bazy w nowym miejscu → seed pustej bazy. **Nigdy**                                                                                                  |
| Key transferu `witros-offer-transfer` / `witros-order-transfer`                                                              | `jsonOfferTransfer.js:24,40,73,88,117`, `pvImportExportToolbar.js:248,265,284`, `docs/import-export/ARCHITECTURE.md:97` | `validatePayload` odrzuca inny `kind` — zmiana łamie import starych eksportów (MEDIUM RISK). Etykieta UI może brzmieć S.O.K., wartości `kind` zostają                        |
| Klucze localStorage `witros_excel_*`                                                                                         | `excelState.js:103,141`                                                                                                 | Utrata ustawień UI (szerokości kolumn, widoczność). Zmiana tylko z jednorazową migracją (§5.6)                                                                               |
| Nazwa cookie `authToken`, `x-auth-token`, mechanizm sesji                                                                    | `auth.ts`                                                                                                               | Wylogowanie wszystkich użytkowników + ryzyko złamania klientów API                                                                                                           |
| `$taskName = 'WITROS-Oferty-DailyBackup'`                                                                                    | `install-backup-cron.ps1:6`, `uninstall-backup-cron.ps1:4`                                                              | Zmiana = duplikat zadania na serwerach; tylko skoordynowany rename obu skryptów + rejestracja (§5.5). **Opis** w :42 zmieniamy (kosmetyka)                                   |
| pm2 `--name witros-oferty`, `/home/witros`, nginx `sites-available/witros`, `/var/log/witros-backup.log`, firewall port 3000 | README/DEPLOYMENT/INSTRUKCJA_SERWER                                                                                     | Osobne zadanie ops z własnym runbookiem i oknem serwisowym — NIE w tej turze                                                                                                 |
| Nazwa pakietu `witros-oferty`                                                                                                | `package.json:2`, `package-lock.json:2,8`                                                                               | Nieimportowana w `src` (zweryfikowane grepem); zmiana = regeneracja lockfile, zero korzyści. **`description` w :71 zmieniamy** (to inna właściwość)                          |
| Image tag CI `witros-oferty:$sha`                                                                                            | `ci.yml:91,95`                                                                                                          | Zmieniać tylko łącznie z decyzją o kontenerze (tag niezależny od wolumenu, 0 ryzyka danych)                                                                                  |
| `.gitignore` wzorce `WITROS-Oferty-PV-Offline.zip`, `witros_dev_port_check.*`                                                | `.gitignore:14,125`                                                                                                     | Zmiana wzorca bez zmiany nazwy plików = przestają być ignorowane. **Komentarze w :93,135 zmieniamy**                                                                         |
| Dane seed (RURA WITROS…, WITROS-1000, kategoria WITROS)                                                                      | `data/seed_*.json`, `data/price_defaults.json`                                                                          | Dane biznesowe firmy; `WITROS-1000` to `id` — zmiana zerwałaby FK produktów w bazach                                                                                         |
| Stopka PDF „• WITROS”                                                                                                        | `offerExports.js:187`                                                                                                   | Podpis firmy w dokumencie handlowym                                                                                                                                          |
| Producer telemetrii `'WITROS'`                                                                                               | `telemetryBridge.js:260`                                                                                                | Identyfikacja źródła po stronie firmy                                                                                                                                        |
| Contact Swagger `name: 'WITROS'`                                                                                             | `src/swagger.ts:13`                                                                                                     | Firma (title na :8 już S.O.K.)                                                                                                                                               |
| Meta/placeholder produktowy „rury WITROS” / „RURA WITROS”                                                                    | `public/rury.html:8`, `pricelistUi.js:256`                                                                              | Produkty firmy, nie nazwa aplikacji                                                                                                                                          |
| `LICENSE` (całość)                                                                                                           | `LICENSE:1,3`                                                                                                           | Dokument prawny; tytuł zawiera nazwę aplikacji, ale jako oznaczenie podmiotu — **zostaje bez zmian** (decyzja: nie ruszać dokumentu prawnego)                                |
| Dokumenty historyczne                                                                                                        | `docs/plans/archive/**`, `docs/adr/**`, `CHANGELOG.md`, `docs/AUDIT.md`                                                 | Immutable                                                                                                                                                                    |
| Plan (ten plik)                                                                                                              | `docs/plans/2026-08-09-spojna-korekta-nazwy-aplikacji.md`                                                               | Dokument roboczy; po wykonaniu → `docs/plans/archive/` (whitelista strażnika go obejmie)                                                                                     |

## 4. Zmiany do wykonania (etapami)

### ETAP 0 — Pre-flight (bez commita)

- **Cel:** zielony baseline przed zmianami.
- **Komendy:** `git status` (czyste drzewo), `npm run validate`, `npm run version:check`,
  `npm run encoding:check`, `docker compose config -q` (walidacja YAML).
- **Kryterium wyjścia:** wszystko zielone; w przeciwnym razie STOP przed Etapem 1.

### ETAP 1 — Bug runtime (1 plik, 1 linia) → COMMIT 1

- `public/js/rury/orderEditMode.js:92`:
  `document.title = 'WITROS — Generator Ofert';` → `document.title = 'S.O.K. — Generator Ofert';`
  (dokładnie ten string, bo `rury.html:10` ma `<title>S.O.K. — Generator Ofert</title>`).
  **Nie ruszać linii 73** (tytuł „Zamówienie: …”).
- **Weryfikacja:** `node -c public/js/rury/orderEditMode.js`; `npm run lint:frontend`;
  `npm run typecheck:frontend`; `npm run test:quick`; `npm run encoding:check`.
- **Commit:** `fix(ui): tytul zakladki sok w trybie edycji zamowienia rur`

### ETAP 2 — Komentarze i nagłówki w kodzie + pliki konfiguracyjne (14 plików) → COMMIT 2

> **KOREKTA PLANU (subagenci):** poprzednia lista „Pominięte (zero trafień)” była
> BŁĘDNA — sprawdzała nieistniejące ścieżki. Realne pliki to
> `public/js/appStudnie.js`, `public/js/shared/printModal.js`, `public/js/types.d.ts`.

| Plik                                     | Linia | Obecny tekst → Nowy tekst                                                                                      |
| ---------------------------------------- | ----- | -------------------------------------------------------------------------------------------------------------- |
| `public/js/app.js`                       | 2     | `WITROS PRECISION OS — APP.JS (RDZEŃ)` → `S.O.K. — APP.JS (RDZEŃ)`                                             |
| `public/js/appStudnie.js`                | 3     | `WITROS — Kalkulator Studni` → `S.O.K. — Kalkulator Studni`                                                    |
| `public/js/spa/router.js`                | 3     | `SPA Router — Router oparty na iframe dla WITROS.` → `...dla S.O.K.`                                           |
| `public/js/shared/printModal.js`         | 3     | `WITROS — Uniwersalny Modal Wydruku` → `S.O.K. — Uniwersalny Modal Wydruku`                                    |
| `public/js/rury/offerPrintManager.js`    | 3     | `WITROS — Wydruk Karty Budowy Rury` → `S.O.K. — ...`                                                           |
| `public/js/studnie/offerPrintManager.js` | 3     | `WITROS — Wydruk Oferty Studni` → `S.O.K. — ...`                                                               |
| `public/js/studnie/printManager.js`      | 3     | `WITROS — Druk Zleceń Produkcyjnych` → `S.O.K. — ...`                                                          |
| `public/js/types.d.ts`                   | 2     | `...frontendu WITROS Oferty PV.` → `...frontendu S.O.K. — System Ofert i Kalkulacji.`                          |
| `public/css/index.css`                   | 2     | `index.css — WITROS Landing...` → `index.css — S.O.K. Landing...`                                              |
| `public/css/printModal.css`              | 2     | `WITROS — Print Modal Styles` → `S.O.K. — Print Modal Styles`                                                  |
| `prisma/schema.prisma`                   | 1     | `...dla systemu WITROS Oferty` → `...dla systemu S.O.K.`                                                       |
| `.env.example`                           | 2     | `# WITROS Oferty — Konfiguracja środowiskowa` → `# S.O.K. — Konfiguracja środowiskowa`                         |
| `scripts/docker-entrypoint.sh`           | 6     | `...Docker WITROS Oferty...` → `...Docker S.O.K...`                                                            |
| `scripts/install-backup-cron.ps1`        | 42    | `...dla WITROS Oferty. VACUUM INTO...` → `...dla S.O.K. VACUUM INTO...` (NIE ruszaj `$taskName` :6)            |
| `package.json`                           | 71    | `"description": "WITROS Oferty - Generator..."` → `"S.O.K. - System Ofert i Kalkulacji (TypeScript + Prisma)"` |
| `.github/workflows/ci.yml`               | 1     | `# CI/CD Pipeline dla WITROS Oferty PV` → `# CI/CD Pipeline dla S.O.K.`                                        |
| `.gitignore`                             | 93    | `NIE część WITROS` → `NIE część S.O.K.`                                                                        |
| `.gitignore`                             | 135   | `nie jest częścią WITROS` → `nie jest częścią S.O.K.`                                                          |

- **Weryfikacja:** `node -c` na każdym zmienionym .js; `npm run lint:frontend`;
  `npm run typecheck:frontend`; `npm run typecheck`; `npm run encoding:check`;
  `npm run format:check`; `npm run test:quick`.
- **Commit:** `refactor(ui): komentarze i naglowki plikow bez nazwy witros oferty`

### ETAP 3 — Bannery skryptów .bat/.sh (9 linii, 7 plików) → COMMIT 3

> **`.bat` MUSI być ASCII-only** (S.O.K. jest ASCII-safe). Nie ruszać linii
> `set "APP_VERSION=1.12.0"` i `REM Wersja:` — `check-version.mjs` (regex
> `BAT_VERSION_RE`) i `auto-bat-version.mjs` muszą je znaleźć nietknięte.

| Plik          | Linia | Obecny tekst → Nowy tekst                                                                                   |
| ------------- | ----- | ----------------------------------------------------------------------------------------------------------- |
| `start.bat`   | 22    | `WITROS Oferty PV - Development Mode v%APP_VERSION%` → `S.O.K. - Development Mode v%APP_VERSION%`           |
| `start.bat`   | 23    | `WITROS Oferty PV - Production v%APP_VERSION%` → `S.O.K. - Production v%APP_VERSION%`                       |
| `build.bat`   | 13    | `WITROS Oferty PV - Budowanie produkcyjne v%APP_VERSION%` → `S.O.K. - Budowanie produkcyjne v%APP_VERSION%` |
| `install.bat` | 14    | `WITROS Oferty PV - Instalator v%APP_VERSION%` → `S.O.K. - Instalator v%APP_VERSION%`                       |
| `build.sh`    | 13    | `WITROS Oferty PV - Budowanie produkcyjne` → `S.O.K. - Budowanie produkcyjne`                               |
| `install.sh`  | 15    | `WITROS Oferty PV - Instalator (bash)` → `S.O.K. - Instalator (bash)`                                       |
| `dev.sh`      | 33    | `WITROS Oferty PV - Development Mode (bash)` → `S.O.K. - Development Mode (bash)`                           |
| `dev.sh`      | 84    | `...uruchomic WITROS?` → `...uruchomic S.O.K.?`                                                             |
| `prod.sh`     | 13    | `WITROS Oferty PV - Produkcja` → `S.O.K. - Produkcja`                                                       |

- **Weryfikacja:** `npm run version:check`; `npm run encoding:check` (ASCII);
  `npm run validate`.
- **Commit:** `chore(deploy): bannery skryptow startowych z nazwa sok`

### ETAP 4 — Dokumenty żywe (nagłówki + treść opisująca nazwę systemu) → COMMIT 4

Zasada per-line: „WITROS” = firma („© WITROS”, „Autor: WITROS”, „firmy WITROS”,
„producent”) → zostaje; „WITROS Oferty PV” = nazwa oprogramowania → zamieniamy na
`S.O.K. — System Ofert i Kalkulacji`.

| Plik                                         | Linia  | Zmiana                                                                                                  |
| -------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------- |
| `AGENTS.md`                                  | 1, 3   | H1 + „projektem WITROS Oferty PV” → S.O.K.                                                              |
| `CLAUDE.md`                                  | 1      | H1                                                                                                      |
| `CONTRIBUTING.md`                            | 1      | H1                                                                                                      |
| `.github/SECURITY.md`                        | 1      | H1                                                                                                      |
| `README.md`                                  | 16     | `WITROS Oferty PV to aplikacja webowa...` → `S.O.K. — System Ofert i Kalkulacji to aplikacja webowa...` |
| `README.md`                                  | 73     | `(np. C:\WITROS_Oferty)` → `(np. C:\SOK_Oferty)` — opcjonalnie (przykład ścieżki świeżej instalacji)    |
| `docs/ARCHITECTURE.md`                       | 1, 11  | H1 + „Aplikacja WITROS Oferty PV to...”                                                                 |
| `docs/COMPONENTS.md`                         | 1      | H1                                                                                                      |
| `docs/DATABASE.md`                           | 1      | H1                                                                                                      |
| `docs/DEPLOYMENT.md`                         | 1      | TYLKO H1 (treść docker/pm2/nginx — ops, zostaje)                                                        |
| `docs/SECURITY.md`                           | 1      | H1                                                                                                      |
| `docs/VERSIONING.md`                         | 3      | `Projekt **WITROS Oferty PV** używa...`                                                                 |
| `docs/baseline-https.md`                     | 1      | H1                                                                                                      |
| `docs/pricelist-buttons-documentation.md`    | 1      | H1                                                                                                      |
| `docs/INSTRUKCJA_SERWER.md`                  | 1      | `# WITROS Oferty — Instrukcja...` → `# S.O.K. — Instrukcja...` (linie 145–325 ops zostają)              |
| `docs/INSTALACJA_REFERENCJA.md`              | 1      | H1 (linie 180, 336 — kontener docker, ops)                                                              |
| `docs/instalacja-krok-po-kroku-dla-laika.md` | 1, 394 | H1 + stopka „...analizy projektu WITROS Oferty PV”                                                      |
| `docs/instalacja-przenoszenie-systemu.md`    | 1, 32  | H1 + ramka ASCII `WITROS Oferty PV` (wyrównać szerokość ramki!)                                         |

- **NIE ruszać:** `README.md` (root — nagłówek już S.O.K.; linie 5,139 = firma),
  `docs/import-export/ARCHITECTURE.md:97` (kind transferu), `docs/plans/archive/**`,
  `docs/adr/**`, `docs/AUDIT.md`, `CHANGELOG.md`, `LICENSE`, wszystkie linie ops.
- **Weryfikacja:** `npm run version:check`; `npm run encoding:check`;
  `npx prettier --write` TYLKO na zmienionych .md; `npm run validate`.
- **Commit:** `docs(config): spojna nazwa systemu sok w dokumentacji`

### ETAP 5 — Strażnik nazwy (guard anty-regresyjny) → COMMIT 5

> **KOREKTA (general/tdd-guide):** skrypt MUSI być `scripts/check-appname.cjs`
> (CommonJS), nie `.mjs` — test vm w ts-jest/CJS robi `require(...)`, a `.mjs`
> z `require` rzuci błąd ESM/CJS. Wzorzec: `scripts/encoding-integrity.js`.

**5.1 Nowy skrypt `scripts/check-appname.cjs`** (wzorzec `check-version.mjs`):

- Export `module.exports = { scanFiles(paths), validateRepo(root) }` (testowalny przez `require`).
- CLI: `node scripts/check-appname.cjs [--root <katalog>]` → exit 0/1.
- **Hard error (case-insensitive)** na wzorce w surowym tekście pliku:
    - `P1` `/WITROS[ \t\u00A0]+Oferty/i` (rdzeń nazwy aplikacji)
    - `P2` `/WITROS\s*[–—-]\s*Generator\s+Ofert/i` (bug z orderEditMode.js:92)
    - `P3` `/WITROS[ \t\u00A0]+PRECISION[ \t\u00A0]+OS/i` (stary working title)
    - `P4` `/WITROS\s*—/i` (nagłówki „WITROS — <Moduł>”)
- **Whitelist (pomijane):** `.git`, `node_modules`, `ECC`, `dist`, `coverage`,
  `generated`, `venv`, `.husky/_`, **`docs/plans/**` (CAŁE drzewo, także nie-archiwum —
  inaczej skrypt wywali się na własnym planie!)**, `docs/adr/**`, `CHANGELOG.md`,
  `docs/AUDIT.md`, `LICENSE`, `data/**` (seed/price — dane firmy), `package-lock.json`,
  `.env` (dokładna nazwa; `.env.example` JEST skanowany), binaria (`IGNORE_EXT` +
  guard NUL-bajt `\u0000` → binary skip).
- **Dozwolone (nie wywala):** sam „WITROS” (firma/identyfikatory/seed) — żaden nie
  pasuje do P1–P4 (P1 wymaga spacji + „Oferty”, P4 em-dasha).

**5.2 Nowy test `tests/appNameCheck.test.ts`** (wzorzec `encodingMojibake.test.ts`,
spawn CLI przez `execFileSync(process.execPath, [...])`, fixture w `os.tmpdir()` —
POZA repo, inaczej test łapałby własne fixture). **12 testów:**

- Pozytywne (exit 0): (1) dozwolony „WITROS” firma/dane; (2) whitelista ścieżek
  (plans/archive, CHANGELOG, data/seed, LICENSE); (3) binaria (NUL + .svg).
- Negatywne (exit 1): (4) „WITROS Oferty PV”; (5) „WITROS Oferty” bez PV;
  (6) „WITROS — Generator Ofert” (em dash); (7) „WITROS - Generator Ofert” (ASCII dash);
  (8) „WITROS — Kalkulator Studni” (P4); (9) „WITROS PRECISION OS” (P3);
  (10) raportuje wiele naruszeń (2 pliki w stdout).
- Strażnicy treści: (11) `orderEditMode.js` — `not.toMatch(/WITROS\s*[—-]\s*Generator\s+Ofert/i)`
  ORAZ `toMatch(/S\.O\.K\.\s*[—-]\s*Generator\s+Ofert/)` (bezpośredni test błędu #92);
  (12) **integracja:** `runCheck(root=repo)` → exit 0 (test RED przed poprawkami,
  stała sieć po nich).

**5.3 Wpięcia:**

- `package.json`: `"appname:check": "node scripts/check-appname.cjs"` + w `validate`
  (przed `test:quick`): `... && npm run appname:check && npm run test:quick`.
- `.husky/pre-push`: po `version:check` dodać
  `npm run appname:check 2>&1 || { echo "Nazwa aplikacji odbiega od S.O.K."; exit 1; }`.
- `.github/workflows/ci.yml` job `lint` (po „Run encoding check”):
  `- name: Run appname check` + `run: npm run appname:check`.

- **Weryfikacja:** `npm run appname:check` (0 błędów); `npm run test:quick` (nowy test);
  `npm run validate`.
- **Commit:** `chore(config): skrypt check-appname chroniacy nazwe sok`

### ETAP 5a — Nazwa pakietu npm (OPCJONALNY, tylko za zgodą usera) → COMMIT 6

- `package.json:2` + `package-lock.json:2,8`: `witros-oferty` → `sok-oferty`
  (3 pola, 2 pliki, JEDEN commit — inaczej `npm ci` w CI rzuci błąd EUSAGE).
- **Weryfikacja:** `npm ci`; `npm run validate`; `npm run version:check`.
- **Decyzja: domyślnie NIE zmieniamy** (nazwa niewidoczna dla użytkownika, ryzyko
  lockfile). User może zażądać — wtedy ten etap.
- **Commit:** `chore(config): nazwa pakietu npm sok-oferty`

### ETAP 6 — Docker (WARIANT A lub B, decyzja usera) → COMMIT 7 (+8 dla B)

Szczegółowy plan w §4.3. Domyślnie rekomendowany **WARIANT A** (0 ryzyka danych:
kontener + tagi CI + docs, wolumen i sieć zostają). **WARIANT B** (pełny rebrand
wolumenu i sieci) tylko z runbookiem migracji wolumenu.

### ETAP 7 — Finalna weryfikacja + DoD (bez commita)

- Pełny zestaw komend z §5 + obserwacja CI po pushu.

## 4.3 DOCKER — drobiazgowa sekwencja

### 4.3.1 Stan obecny (zweryfikowany)

- `docker-compose.yml` (41 linii): `container_name: witros-oferty` (L8),
  wolumen `witros_data:/var/data` (L19), sieć `witros-network` (L21, L40),
  deklaracje `witros_data:` (L36) i `witros-network:` (L40). Brak `image:` (tylko `build:`).
- `Dockerfile:37` hardcode `ENV DATABASE_URL=file:/var/data/app_database.sqlite`;
  `docker-entrypoint.sh:13` ma ten sam fallback. **Nie ruszać.**
- CI `ci.yml:91` `docker build -t witros-oferty:${{ github.sha }} .`;
  `ci.yml:95` `docker run -d --name test-container witros-oferty:${{ github.sha }}`.
  **Brak cache warstw (brak cache-from/to), brak registry/push** — tagi ephemeral.
- Docs docker: `docs/DEPLOYMENT.md:87,96,111,114`, `docs/INSTALACJA_REFERENCJA.md:180,336`,
  `docs/instalacja-przenoszenie-systemu.md:78,239`.

### 4.3.2 WARIANT A — tylko kontener + tagi CI + docs (ZALECANY, 0 ryzyka danych)

| Plik:linia                              | Obecne → Nowe                                                                     |
| --------------------------------------- | --------------------------------------------------------------------------------- |
| `docker-compose.yml:8`                  | `container_name: witros-oferty` → `container_name: sok-oferty`                    |
| `.github/workflows/ci.yml:91`           | `-t witros-oferty:${{ github.sha }}` → `-t sok-oferty:${{ github.sha }}`          |
| `.github/workflows/ci.yml:95`           | `docker run ... witros-oferty:${{ github.sha }}` → `sok-oferty:${{ github.sha }}` |
| `docs/DEPLOYMENT.md:87`                 | `container_name: witros-oferty` → `sok-oferty` (blok YAML przykładu)              |
| `docs/INSTALACJA_REFERENCJA.md:180,336` | `kontener witros-oferty` / `docker logs witros-oferty` → `sok-oferty`             |

**Bez zmian:** wolumen `witros_data` (L19, L36), sieć `witros-network` (L21, L40),
`docs/instalacja-przenoszenie-systemu.md:78,239`, DEPLOYMENT:96,111,114.

**Runbook wdrożenia (bez utraty danych):**

1. Pre-check: `docker compose ps` (działa), `git status` czyste, wersja 1.12.0.
2. Snapshot wolumenu (z katalogu `C:\Users\blody\AppData\Local\Temp\opencode\sok-migracja`):
    ```
    docker run --rm -v witros_data:/data -v "<temp>/sok-migracja:/snapshot" alpine:3.20 sh -c "cp -a /data/. /snapshot/"
    ```
3. `docker compose down` — zatrzymuje i usuwa KONTENER (wolumen trwa).
   **KRYTYCZNE:** bez `down` stary kontener trzyma port 3000 → konflikt bind.
4. Edycja plików wg tabeli → `docker compose up -d --build`.
5. Weryfikacja: `docker ps` (sok-oferty Up+healthy), `docker exec sok-oferty ls -la /var/data`
   (`app_database.sqlite` istnieje, nie pusty wolumen), `curl localhost:3000/health` 200,
   logowanie → istniejące oferty widoczne.
6. Retencja: stare obrazy `witros-oferty:*` zostaw do następnego release, potem `docker image prune`.

**Rollback A:** `docker compose down` → `git revert <sha>` → `docker compose up -d` →
kontener `witros-oferty`, ten sam wolumen, dane nietknięte.

### 4.3.3 WARIANT B — pełny rebrand (wolumen + sieć + kontener + tagi) — TYLKO Z MIGRACJĄ

| Plik:linia                                       | Obecne → Nowe                                      |
| ------------------------------------------------ | -------------------------------------------------- |
| `docker-compose.yml:8`                           | `container_name: witros-oferty` → `sok-oferty`     |
| `docker-compose.yml:19`                          | `- witros_data:/var/data` → `- sok_data:/var/data` |
| `docker-compose.yml:21`                          | `- witros-network` → `- sok-network`               |
| `docker-compose.yml:36`                          | `witros_data:` → `sok_data:`                       |
| `docker-compose.yml:40`                          | `witros-network:` → `sok-network:`                 |
| `ci.yml:91,95`                                   | jak w A (`sok-oferty:sha`)                         |
| `docs/DEPLOYMENT.md:87,96,111,114`               | wszystkie 4 nazwy                                  |
| `docs/INSTALACJA_REFERENCJA.md:180,336`          | `sok-oferty`                                       |
| `docs/instalacja-przenoszenie-systemu.md:78,239` | `witros_data` → `sok_data`                         |

**Runbook migracji wolumenu (KRYTYCZNY — nie pomijać kroków):**

1. Pre-check: `docker compose ps`, `git status` czyste, **`docker network inspect witros-network`**
   — jeśli NA SIECI są obce kontenery (zewnętrzny proxy) → **NIE zmieniaj nazwy sieci**,
   zostań w wariancie A dla sieci (repo nie ma obcych kontenerów — sieć wewnętrzna, brak `external:`).
2. `docker compose down` — WAŻNE: SQLite WAL; czysty shutdown → checkpoint do `app_database.sqlite`.
   **NIE `down -v`!**
3. `docker volume create sok_data`.
4. Kopia danych: `docker run --rm -v witros_data:/from -v sok_data:/to alpine:3.20 sh -c "cp -a /from/. /to/"`
5. **Weryfikacja kopii (TWOJE bezpieczeństwo):**
    ```
    docker run --rm -v witros_data:/from alpine:3.20 sh -c "sha256sum /from/app_database.sqlite"
    docker run --rm -v sok_data:/to alpine:3.20 sh -c "sha256sum /to/app_database.sqlite"
    ```
    → identyczne sumy; `ls -la /to` → `app_database.sqlite` + `-wal`/`-shm`.
6. Edycja plików wg tabeli → `docker compose up -d --build`.
7. Weryfikacja jak w A (health 200 + dane widoczne + porównanie liczby ofert).
8. **Retencja: NIE usuwać `witros_data`** — minimum 2 cykle release. Usunięcie:
   `docker volume rm witros_data` tylko po potwierdzeniu stabilności.

**Rollback B:** `docker compose down` → revert compose → `up -d` → wraca na `witros_data`
(nietknięty) → dane natychmiast; opcjonalnie `docker volume rm sok_data`.

**Ryzyko B:** zmiana nazwy sieci odcina obce kontenery → mitygacja: pre-check pkt 1.

### 4.3.4 Testowanie Dockera BEZ ryzyka (tdd-guide)

**Zasada: nigdy `docker compose up` lokalnie** (podpiąłby produkcyjny wolumen `witros_data`
i kolidował z kontenerem `witros-oferty`). Test w pełnej izolacji:

```powershell
docker compose config -q                                   # walidacja YAML (nic nie tworzy)
docker build -t sok-test:local .                            # build obrazu
docker run -d --name sok-test-run -e DEFAULT_ADMIN_PASSWORD=sok-test-tmp -p 3001:10000 sok-test:local
for ($i = 0; $i -lt 30; $i++) { $s = docker inspect --format '{{.State.Health.Status}}' sok-test-run; if ($s -eq 'healthy') { break }; Start-Sleep -Seconds 5 }
docker inspect --format '{{.State.Health.Status}}' sok-test-run      # wymagane: healthy
docker exec sok-test-run node -e "require('http').get('http://localhost:10000/health',r=>{process.exit(r.statusCode===200?0:1)})"
docker exec sok-test-run node scripts/check-appname.cjs              # exit 0 — nazwa S.O.K. w obrazie
docker stop sok-test-run; docker rm sok-test-run; docker rmi sok-test:local
```

Reguły: sufiksy `-test`/`sok-test` (kolizja z produkcją = błąd), port `3001` (nie 3000),
zawsze sprzątanie `stop`/`rm`/`rmi`, nie pushować do registry.

## 4.4 TESTY E2E — nowy `tests/playwright/appNameConsistency.cjs` (po Etapie 1)

> **KOREKTA:** `document.title` w iframe NIE zmienia karty → asercje regresyjne
> tytułu w `frame.evaluate(() => document.title)`, nie `page.title()`.

**Kroki (T1–T6):**

- **T1** — top-level `app.html`: `page.title()` zawiera `S.O.K.`, nie zawiera `WITROS`.
- **T2** — tytuły statyczne 6 modułów: `page.request.get(BASE+path)` → regex `<title>`
  (fetch omija redirecty iframe i timing JS).
- **T3** — nagłówek SPA: `img.logo-sok[alt="S.O.K."]`, `#spa-logo-text` ≠ puste, bez „WITROS”,
  nazwa modułu (`Kalkulator Studni`, `Oferty rury`, `Kartoteka Ofert`, `Kartoteka Zleceń`).
- **T4** — login + Pulpit: `page.title()` = `S.O.K. — Generator Ofert`,
  `img.index-logo-sok[alt="S.O.K."]`, `.subtitle` = `System Ofert i Kalkulacji`.
- **T5** — **REGRESJA #92 (główna asercja):** w iframe rury wstrzyknij mock zamówienia
  (`ordersRury = [{ id:'e2e-order-1', ... }]` — `let` globalne), wołaj
  `enterRuryOrderEditMode('e2e-order-1')` → title zawiera `Zamówienie:` (nie „WITROS”),
  potem `exitOrderEditMode()` → **`exitRes.title === 'S.O.K. — Generator Ofert'`** +
  obronnie „nie zawiera WITROS”. Uwaga: jeśli `exitOrderEditMode()` rzuci w `goToPhase(1)`
  (linia 91) przed ustawieniem title (92), raportuj `error` osobno i sprawdzaj tylko brak WITROS.
- **T6** — wydruk (soft-check, SKIP przy braku danych): treść modala bez
  „WITROS Oferty”/„WITROS —”; `• WITROS` (stopka) DOZWOLONY.

**Rozwiązywanie Playwright:** `process.env.CHROME_PATH || chromium.executablePath()` —
nie hardkodować wersji. **Spawn serwera** (`--spawn`): `dist/server.js`, `PORT:3177`,
`DATABASE_URL:file:./data/e2e.sqlite`, poll `/health` 30 s. Logowanie: `POST /api/auth/login`
(`admin`/`TEST_ADMIN_PASSWORD || 'anim123456'`) → `localStorage.setItem('authToken', token)`.

**Wpięcie:** `package.json` `"test:e2e-appname": "node tests/playwright/appNameConsistency.cjs"`
i `"test:e2e-appname:spawn": "npm run build && node tests/playwright/appNameConsistency.cjs --spawn"`.
Nowy job `e2e-appname` w `ci.yml` (`needs: [test]`, `npx playwright install --with-deps chromium`,
`prisma db push` + `prisma:seed` na `data/e2e.sqlite`). W job `docker-build` po health-check:
`docker exec test-container node scripts/check-appname.cjs` + asercja `<title>S.O.K.` w `/index.html`.

## 5. Weryfikacja (kolejność — tanie → drogie)

| #   | Komenda                                  | Kiedy                                          | Po co                                    |
| --- | ---------------------------------------- | ---------------------------------------------- | ---------------------------------------- |
| 1   | `node -c <plik.js>`                      | po każdej edycji JS w `public/js/`             | składnia bez TS                          |
| 2   | `npm run format`                         | po edycjach                                    | spójny diff Prettier                     |
| 3   | `npm run typecheck`                      | przed commit/push                              | backend TS                               |
| 4   | `npm run typecheck:frontend`             | przed commit/push                              | TS public                                |
| 5   | `npm run lint` + `npm run lint:frontend` | przed commit/push                              | ESLint oba zestawy                       |
| 6   | `npm run encoding:check`                 | **po zmianach .bat/.sh** i zawsze przed commit | ASCII w .bat, brak BOM/mojibake          |
| 7   | `npm run version:check`                  | przed push                                     | spójność 1.12.0                          |
| 8   | `npm run appname:check`                  | nowa, po każdej zmianie tekstów                | exit 0 = nazwa S.O.K. spójna             |
| 9   | `npm run test:quick`                     | przed commit/push                              | suita Jest (w tym appNameCheck.test.ts)  |
| 10  | `npm run validate`                       | agregat przed commitem                         | wszystko z 3–9 w jednym                  |
| 11  | `npm run test:alignment`                 | tylko jeśli zmiana dotyka Excel/UI             | Playwright — wymaga :3000; tu opcjonalne |
| 12  | `npm run format:check`                   | przed push                                     | to samo co CI job lint                   |
| 13  | `npm run test:e2e-appname`               | po Etapie 1 (po fixie #92)                     | runtime/UI spójność nazwy                |

Dodatkowo po wdrożeniu (checklist bezpieczeństwa z security-reviewer):
`git diff --cached | findstr /i "api[_-]?key secret password token"` (brak sekretów w diff);
`git status --short` (brak `.env`/`*.sqlite`/`*.pem` w stagingu); skan nagłówków
bezpieczeństwa `curl -sI localhost:3000/`; test sesji (logowanie → refresh → logout, brak 401).

## 6. Commity (Conventional Commits — **zgodne z scope-enum commitlint!**)

> **KRYTYCZNA KOREKTA:** commitlint `scope-enum` NIE dopuszcza `docs(projekt)` i
> `chore(quality)` (dozwolone scopy: ui, rury, studnie, offers, orders, prisma, auth,
> api, seed, deploy, clients, audit, settings, preco, telemetry, deps, docs, ci, config,
> test, docker, security, chore, release). Poprawione commity poniżej.

| #   | Commit                                                               | Etap | Temat ≤72 znaki, mała litera |
| --- | -------------------------------------------------------------------- | ---- | ---------------------------- |
| 1   | `fix(ui): tytul zakladki sok w trybie edycji zamowienia rur`         | 1    | 57 znaków ✓                  |
| 2   | `refactor(ui): komentarze i naglowki plikow bez nazwy witros oferty` | 2    | 68 znaków ✓                  |
| 3   | `chore(deploy): bannery skryptow startowych z nazwa sok`             | 3    | 60 znaków ✓                  |
| 4   | `docs(config): spojna nazwa systemu sok w dokumentacji`              | 4    | 57 znaków ✓                  |
| 5   | `chore(config): skrypt check-appname chroniacy nazwe sok`            | 5    | 58 znaków ✓                  |
| 6   | `chore(config): nazwa pakietu npm sok-oferty` (OPCJONALNY)           | 5a   | 53 znaki ✓                   |
| 7   | `chore(docker): kontener i tagi docker pod nazwa sok` (A)            | 6    | 58 znaków ✓                  |
| 8   | `chore(docker): migracja wolumenu witros_data na sok_data` (B)       | 6B   | 62 znaki ✓                   |

Uwaga: commitlint może blokować (subject-case/scope) — używać obejścia
`git -c core.hooksPath=/dev/null commit` (znane z CONTRIBUTING.md); NIGDY nie
zmieniać configu commitlint. Każdy commit pushowany OSOBNO po zielonej weryfikacji.
Commit 5 (strażnik) MUSI wejść przed commitem 6/7/8, żeby pilnował zmian dockerowych.

## 7. Definition of done (DoD — mierzalny)

```bash
# 1. Zero nazwy aplikacji w żywych plikach (historia/dane/identyfikatory pominięte):
rg -n "WITROS Oferty|WITROS —" --hidden -g "!.git/**" -g "!node_modules/**" -g "!ECC/**" \
  -g "!dist/**" -g "!docs/plans/**" -g "!docs/adr/**" -g "!CHANGELOG.md" -g "!docs/AUDIT.md" \
  -g "!LICENSE" -g "!data/**"
# → 0 trafień

# 2. Guard działa:
npm run appname:check          # exit 0
npm run version:check          # exit 0 (1.12.0)
npm run encoding:check         # exit 0
npm run typecheck && npm run typecheck:frontend
npm run lint && npm run lint:frontend
npm run test:quick             # wszystkie zielone (≥ baseline 1522)
npm run test:e2e-appname       # exit 0 (T5 = S.O.K. — Generator Ofert)

# 3. Bug tytułu naprawiony:
rg -n "document.title" public/js/rury/orderEditMode.js   # linia 92 bez "WITROS"

# 4. Identyfikatory operacyjne — pozytywna kontrola (trafienia NADAL obecne = OK):
rg -n "witros_data|witros-network|witros-oferty|witros-offer-transfer|witros-order-transfer|witros_excel_|WITROS-Oferty-DailyBackup" docker-compose.yml package.json public/js/import-export/shared/jsonOfferTransfer.js public/js/studnie/excelState.js scripts/install-backup-cron.ps1

# 5. Firma/dane biznesowe NIEZMIENIONE:
rg -n "WITROS" src/swagger.ts public/js/rury/offerExports.js public/js/studnie/telemetryBridge.js LICENSE README.md

# 6. Docker (jeśli dotknięty): docker compose config -q; docker ps; curl /health 200

# 7. Working tree po commicie czysty; push na main wykonany; CI (job lint + e2e-appname) zielone.
```

## 8. Zarządzanie ryzykiem (tabela — konsolidacja subagentów)

| #   | Ryzyko                                                                         | Prawd.                           | Wpływ     | Mitygacja                                                                         | Plan B                                                                                  |
| --- | ------------------------------------------------------------------------------ | -------------------------------- | --------- | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| R1  | Zmiana wolumenu bez migracji → seed pustej bazy                                | Niska (A), brak (B-z-runbookiem) | KRYTYCZNY | Wariant A domyślny; w B: `down` bez `-v`, `sha256sum`, retencja `witros_data`     | Snapshot: `docker run --rm -v <nowy>:/to -v <snapshot>:/from alpine cp -a /from/. /to/` |
| R2  | `container_name` zmienione bez `down` → konflikt portu 3000                    | Średnia                          | Wysoki    | Runbook wymusza `down` przed `up`                                                 | `docker compose down; up -d`                                                            |
| R3  | Zmiana `name` w package.json bez locka → `npm ci` FAIL                         | Średnia                          | Wysoki    | 3 pola w 1 commicie; `npm ci` + validate                                          | `git revert`                                                                            |
| R4  | `.bat` z polskim znakiem → encoding:check FAIL                                 | Niska                            | Średni    | Bannery ASCII-only; `encoding:check` po Etapie 3                                  | `npm run encoding:fix`                                                                  |
| R5  | commitlint blokuje (subject-case/scope)                                        | Średnia                          | Niski     | Tematy ≤72 z małą literą; `git -c core.hooksPath=/dev/null commit`                | Obejście; NIGDY nie zmieniaj configu                                                    |
| R6  | `version:check` złamany przez dotknięcie APP_VERSION w .bat                    | Niska                            | Średni    | Zmieniamy TYLKO linie `echo`; `version:check` po Etapie 3                         | Naprawa `set "APP_VERSION=1.12.0"`                                                      |
| R7  | `format:check` w CI FAIL przez docs                                            | Średnia                          | Niski     | `npx prettier --write` TYLKO na zmienionych                                       | `npm run format`                                                                        |
| R8  | Strażnik fałszywe pozytywy (własne plany, CHANGELOG, seed)                     | Wysoka (bez whitelisty)          | Średni    | Whitelist `docs/plans/**` itd.; test 1–3 pokrywa granice                          | Rozszerzenie whitelisty                                                                 |
| R9  | Zmiana sieci docker odcina obce kontenery                                      | Niska (brak zewn. w repo)        | Wysoki    | Pre-check `docker network inspect`; wariant A zostawia sieć                       | W B: nie zmieniaj sieci                                                                 |
| R10 | Uszkodzenie plików rdzenia (router.js)                                         | Bardzo niska                     | Wysoki    | Zmiana w router.js to komentarz L3; guard node -c + typecheck                     | Pominięcie (brak wpływu na DoD)                                                         |
| R11 | Mojibake przy edycji UTF-8                                                     | Niska                            | Średni    | Edytor UTF-8 bez BOM; `encoding:check`                                            | `npm run encoding:fix`                                                                  |
| R12 | Niespójność docs↔ops (pm2/nginx/task)                                          | Średnia                          | Niski     | Świadoma decyzja — osobne zadanie ops                                             | Runbook ops po tej turze                                                                |
| R13 | `.env.example:50` — `DEFAULT_ADMIN_PASSWORD=anim123456` (pre-existing finding) | Wysoka (out-of-box)              | KRYTYCZNY | **OSOBNY fix, NIE w tej turze:** usunąć wartość z szablonu / wymusić zmianę hasła | Poza zakresem rebrandingu                                                               |

## 9. Rollback

### 9.1 Kod (git)

- Praca na `main`; każdy etap = osobny commit → **przed pushem:** `git reset --hard <sha>`;
  **po pushu:** `git revert --no-edit <sha>` per commit od najnowszego (commit 5 strażnik
  cofany pierwszy, żeby nie blokował starych treści).
- Po każdym reverterze: `npm run validate`, `version:check`, `encoding:check`.

### 9.2 Ręczne

| Element                       | Jak przywrócić                                                                       |
| ----------------------------- | ------------------------------------------------------------------------------------ |
| Wolumen `witros_data` (B)     | NIGDY nie usuwany w trakcie migracji — rollback to `down` → revert compose → `up -d` |
| Wolumen `sok_data`            | `docker volume rm sok_data` po potwierdzeniu rollbacku                               |
| Kontener/sieć                 | `docker compose down` czyści; `up` odtwarza; stare obrazy `witros-oferty:*` zostają  |
| `npm ci` (5a)                 | revert locka → `npm ci` wraca do `witros-oferty`                                     |
| localStorage `witros_excel_*` | nie zmieniane w tej turze (bez akcji)                                                |
| Task Scheduler/pm2/nginx      | nie zmieniane w tej turze (bez akcji)                                                |
| Baza/seed                     | nie zmieniane (bez akcji)                                                            |

### 9.3 Pełny rollback po Etapie 6:

```
docker compose down
git revert --no-edit <sha7> <sha6> <sha5> <sha4> <sha3> <sha2> <sha1>
npm ci                                   # jeśli cofano 5a
npm run validate && npm run version:check && npm run encoding:check
docker compose up -d --build
curl localhost:3000/health               # 200
docker ps                                # kontener witros-oferty
git push
```

## 10. Pominięte świadomie (YAGNI / poza zakresem)

- **`src/appName.ts`** — brak centralnej stałej (analiza refactor-cleaner: 1 użycie w JS,
  3 różne warianty backendu, 5 statycznych `<title>`; stała nie dałaby DRY).
- **`scripts/auto-appname.mjs`** w `postbump` release — nazwa zmienia się rzadko,
  strażnik wystarcza.
- **Migracja localStorage** `witros_excel_*` w tej turze — utrata ustawień gorsza
  niż nazwa klucza; ewentualnie później runbook jednorazowej migracji (§5.6).
- **Runbook ops** (pm2/nginx/task scheduler//home/witros) — osobne zadanie wdrożeniowe.
- **Zmiana wzorców `.gitignore`** — bez zmiany nazwy plików wzorzec przestałby ignorować.
- **Zmiana nazwy repo GitHub** (`Oferty_PV`) — poza zakresem (repo to nie nazwa aplikacji).
- **Fix `.env.example:50`** (domyślne hasło admina) — osobny fix bezpieczeństwa (R13).
- **Fix backupu dockerowego** (`scripts/backup.ts:7` — backup w kontenerze ląduje w warstwie,
  nie w wolumenie `/var/data`) — osobny fix (finding security-reviewer #15).

## 11. Nieużywane rekomendacje subagentów (odrzucone świadomie — podsumowanie)

- **`src/appName.ts`** (architect): odrzucone — patrz §10.
- **Migracja localStorage** (planner): odrzucone w tej turze.
- **Runbook serwerowy** (planner): osobne zadanie ops.
- **Osobny test E2E na `document.title` przez top-level `page.title()`** (e2e-runner
  proposal początkowy): skorygowane — asercje w `frame.evaluate`.
- **Dodanie `playwright` do devDependencies** (e2e-runner, opcjonalnie): do rozważenia
  przy okazji; obecnie testy używają fallbacku npx-cache.
