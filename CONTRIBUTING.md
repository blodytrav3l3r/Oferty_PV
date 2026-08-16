# Zasady pracy — S.O.K. — System Ofert i Kalkulacji

## Codzienna praca

- Pracujesz na `main` — to jedyna gałąź.
- Commit: `git add -A` → `git commit -m "typ(scope): opis"` → `git push`
- Przed commitem: `npm run validate` (typecheck backend+frontend, lint backend+frontend, testy)
- Po modyfikacji kodu frontendowego: `npm run format`
- **OBOWIĄZKOWO przed każdym commitem i pushem**: `npm run version:check` — waliduje spójność wersji we WSZYSTKICH źródłach (VERSION, package.json, CHANGELOG.md, *.bat, HTML `?v=`, oraz markery `**Wersja:**`/`> Wersja:`/JSON w `README.md` i `docs/*.md`). **Bez wyjątków** — także przy samych poprawkach dokumentacji. Rozjazd = blokada (pre-push).
- **Uwaga:** Husky pre-commit hook jest aktywny (python `scripts/excel-validator.py` + lint-staged). Gdyby zablokował commit (np. błąd walidatora Excel), obejście:
    ```bash
    git -c core.hooksPath=/dev/null commit -m "typ(scope): opis"
    ```
    (Obejście hooka NIE zwalnia z obowiązku `npm run version:check` — uruchom go ręcznie przed commitem.)

## Workflow

1. Utwórz branch z `main` (jeśli zadanie jest złożone)
2. Wprowadź zmiany
3. Uruchom `npm run validate` (typecheck + lint + testy)
4. Uruchom `npm run format`
5. Utwórz commit zgodny z [Conventional Commits](https://www.conventionalcommits.org/):
    - `feat(scope):` — nowa funkcjonalność
    - `fix(scope):` — naprawa błędu
    - `refactor(scope):` — refaktoryzacja
    - `docs(scope):` — zmiany w dokumentacji
    - `chore(scope):` — zadania techniczne (zależności, konfiguracja)
    - **Zalecany helper (bez mojibake z konsoli Windows):** `node scripts/commit.mjs "typ(scope): temat" ["linia body"...]` (lub `npm run commit`). Waliduje reguły commitlint (scope z listy, ≤72 znaki, małe litery) i zapisuje wiadomość przez plik UTF-8.
6. Push na `main`

## Release

```bash
npm run release:patch   # Małe poprawki
npm run release:minor   # Nowe funkcje (zgodne wstecz)
npm run release:major   # Zmiany przełamujące kompatybilność
git push --follow-tags
```

Proces release:

1. `npm run release` automatycznie dobiera typ wersji na podstawie commitów
2. Aktualizuje `VERSION`, `package.json` i `package-lock.json` (lista plików z `bumpFiles` w `.versionrc.json`) oraz `CHANGELOG.md` (`infile`)
3. Hook `postbump` uruchamia **trzy skrypty**:
    - `scripts/auto-cache-bust.mjs` — aktualizuje `?v=` we wszystkich HTML (w tym `public/templates/*.html`) do nowej wersji
    - `scripts/auto-docs-version.mjs` — aktualizuje wersję w dokumentacji `README.md` + `docs/*.md` (`**Wersja:**`, `**Wersja aplikacji:**`, `> Wersja:`) oraz przykłady JSON `"version"`/`"dbVersion"` w `docs/API.md`
    - `scripts/auto-bat-version.mjs` — aktualizuje wersję w skryptach `.bat` (start, install, build, setup-ai, ensure-db)
4. Tworzy commit `chore(release): X.Y.Z` (release commituje wszystkie zmiany — flaga `--commit-all`) oraz tag git
5. Po pushu tagów GitHub automatycznie tworzy Release
6. Po zmianie wersji zrestartuj serwer

> **WAŻNE — po KAŻDYM release:** natychmiast uruchom `npm run version:check` i potwierdź EXIT=0 przed `git push --follow-tags`. Od wersji 1.13.1 `version:check` waliduje **wszystkie** źródła wersji, w tym markery w `README.md` i `docs/*.md` — rozjazd w JAKIMKOLWIEK miejscu (także w dokach) = blokada pre-push. Bez wyjątków.

**Pełna lista miejsc z numerem wersji** (weryfikacja `npm run version:check`):

1. `VERSION` (root) — źródło prawdy
2. `package.json` / `package-lock.json` → `version`
3. `CHANGELOG.md` (nagłówki)
4. `public/*.html` + `public/templates/*.html` → `?v=X.Y.Z`
5. `*.bat` (start, install, build, setup-ai, ensure-db) → `APP_VERSION`
6. `README.md` + `docs/*.md` → `**Wersja:**` / `**Wersja projektu:**` / `**Wersja aplikacji:**` / `> Wersja:`
7. `docs/API.md` przykłady JSON → `"version"` / `"dbVersion"`

**Uwaga:** Nie zmieniaj ręcznie parametrów `?v=` w HTML — są synchronizowane z `VERSION` podczas release.

**Pre-push validation:** hook `.husky/pre-push` uruchamia `npm run version:check` + `npm run encoding:check` (pełny skan repo, blokada przy mojibake/niepoprawnym UTF-8) + `npm run typecheck` + `npm run typecheck:frontend` + `npm run test:quick`. Jeśli hook blokuje push, użyj obejścia: `HUSKY=0 git push` (lub `git -c core.hooksPath=/dev/null push`).

## Świeża instalacja

Przy pierwszym uruchomieniu na nowym komputerze (bez istniejącej bazy danych):

1. Sklonuj lub pobierz projekt z GitHub:
    ```bash
    git clone https://github.com/blodytrav3l3r/Oferty_PV.git
    cd Oferty_PV
    ```
2. Uruchom instalator:
    ```bash
    .\install.bat   # Windows
    bash install.sh # Linux
    ```
    Instalator: skopiuje `.env`, zainstaluje zależności, skonfiguruje bazę i załaduje dane początkowe (produkty, cenniki, konto admina).
    Po pierwszym uruchomieniu serwera automatycznie odczytany jest plik `data/price_defaults.json`
    (jeśli istnieje) zawierający snapshot domyślnych cenników — pozwala przenieść niestandardowe
    ceny z innej instalacji.
3. Uruchom serwer:
    ```bash
    .\start.bat
    ```
4. Zaloguj się na http://localhost:3000 (admin / hasło z `.env`). Do pracy zdalnej użyj HTTPS (reverse proxy) — patrz [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

> **UWAGA:** Nie uruchamiaj `start.bat` przed `install.bat` na świeżej instalacji.
> `start.bat` automatycznie seeduje pustą bazę przez `ensure-db.bat`, ale `install.bat`
> wykonuje pełną konfigurację (.env, zależności, migracje) — bez niego aplikacja nie zadziała.

## Przenoszenie bazy między urządzeniami

Podczas pracy z istniejącą bazą cenników na nowym urządzeniu:

1. Na starym urządzeniu wykonaj `npm run backup`
2. Skopiuj plik `data/backups/backup_*.sqlite` na nowe urządzenie
3. Na nowym urządzeniu wykonaj instalację z pominięciem seedowania:
    ```bash
    .\install.bat --skip-seed   # Windows
    bash install.sh --skip-seed  # Linux
    ```
4. Przywróć bazę z backupu (restore automatycznie synchronizuje schemat):
    ```bash
    npm run restore data/backups/backup_*.sqlite
    ```
5. Uruchom serwer:
    ```bash
    .\start.bat
    ```
6. Upewnij się, że `DEFAULT_ADMIN_PASSWORD` w `.env` jest zgodne z poprzednią instalacją.
7. (opcjonalnie) Jeśli chcesz przenieść niestandardowe ceny domyślne (rury, studnie, preco),
   skopiuj plik `data/price_defaults.json` ze starego urządzenia do katalogu `data/` na nowym.
   Zostanie automatycznie przywrócony przy starcie serwera.

    > **Lżejsza alternatywa:** Jeśli potrzebujesz przenieść tylko ceny (bez ofert/zamówień),
    > wystarczy skopiować `data/price_defaults.json` i uruchomić `start.bat` — nie jest
    > potrzebny backup SQLite ani `--skip-seed`.

## Aktualizacja istniejącej instalacji (schemat bazy)

1. Zawsze najpierw backup: `npm run backup`
2. Pobierz nowy kod i zależności: `git pull`, `npm ci`
3. Zsynchronizuj schemat — domyślnie `npx prisma migrate deploy`; `db push` wyłącznie
   dla baz legacy:
    - **Baza legacy utworzona przez `prisma db push`** (brak tabeli `_prisma_migrations`):
      `npx prisma db push --skip-generate --accept-data-loss`
      (komenda `migrate deploy` na niej NIE zadziała — baza nie ma historii migracji).
    - **Baza z historią migracji** (`_prisma_migrations` istnieje):
      `npx prisma migrate deploy`
    - Jak sprawdzić: `npx prisma migrate status` — jeśli pokazuje wszystkie
      migracje jako niezastosowane mimo działającej aplikacji, baza jest typu `db push`.
4. Uruchom serwer (`start.bat`).

> Migracja `20260815000000_baseline` zawiera indeksy na `ai_telemetry_logs`
> (`idx_logs_well`, `idx_logs_source_well`) pod deduplikację telemetrii AI. Indeksy są
> idempotentne i powstają automatycznie przez `migrate deploy` (definicje w `schema.prisma`).
> Na bazie bez `migrate deploy` (legacy db push) można je utworzyć ręcznie:
>
> ```sql
> CREATE INDEX IF NOT EXISTS "idx_logs_well" ON "ai_telemetry_logs"("wellId");
> CREATE INDEX IF NOT EXISTS "idx_logs_source_well" ON "ai_telemetry_logs"("solverSource", "wellId");
> ```

## Dependabot

Na GitHubie otwórz PR → zielony przycisk "Squash and merge". Tyle.

## Testy

```bash
npm test                 # Wszystkie testy
npm run test:quick       # Tylko testy dymne (szybkie)
npm run test:watch       # Watch mode
```

Przed mergem upewnij się, że wszystkie testy przechodzą.

## Formatowanie i lint

```bash
npm run format           # Prettier — automatyczne formatowanie
npm run format:check     # Sprawdź formatowanie
npm run lint             # ESLint
npm run lint:fix         # ESLint z auto-naprawą
```

## Kod frontendowy

- Kod w `public/js/` nie jest kompilowany przez TypeScript, ale jest sprawdzany przez `npm run typecheck:frontend` oraz `npm run lint:frontend` (osobny zestaw reguł ESLint dla przeglądarki)
- Zawsze weryfikuj składnię: `node -c public/js/<plik>.js`
- Nowe globalne helpery rejestruj przez `window.mojHelper = mojHelper;`
- Używaj `escapeHtml(str)` przy interpolacji do `innerHTML` (zapobieganie XSS)
- Po dynamicznym wstrzyknięciu HTML z ikonami Lucide wywołaj: `lucide.createIcons({root: container})`

### Kodowanie polskich znaków (encoding policy)

| Typ pliku                          | Kodowanie           | Uwagi                                              |
| ---------------------------------- | ------------------- | -------------------------------------------------- |
| `.ts`, `.js`, `.mjs`, `.cjs`       | **UTF-8 (bez BOM)** | Standard dla Node.js/TypeScript                    |
| `.html`, `.css`, `.json`           | **UTF-8 (bez BOM)** | Standard webowy                                    |
| `.md`, `.txt`                      | **UTF-8 (bez BOM)** | Dokumentacja                                       |
| `.sh`, `.ps1`                      | **UTF-8 (bez BOM)** | Skrypty powłoki                                    |
| `.bat`, `.cmd`                     | **ASCII-only**      | Brak polskich znaków — cmd.exe nie obsługuje UTF-8 |
| `.yaml`, `.yml`, `.sql`, `.prisma` | **UTF-8 (bez BOM)** | Pliki konfiguracyjne i migracje                    |

**Zasady:**

- W plikach `.bat` NIE używaj polskich znaków ani znaków spoza ASCII (np. `—` em dash). Zastąp je odpowiednikami ASCII (`-` zamiast `—`, `l` zamiast `ł`, `s` zamiast `ś` itp.).
- We wszystkich pozostałych plikach używaj swobodnie polskich znaków w UTF-8.
- Unikaj BOM (Byte Order Mark) na początku plików UTF-8.
- **Zakaz mojibake (podwójnego kodowania):** nie zapisuj plików z polskimi znakami przez narzędzia interpretujące CP1250/Windows-1250 i zapisujące ponownie jako UTF-8. Po edycji uruchom `npm run encoding:check`; przy ERROR — `npm run encoding:fix`. `encoding:check` uruchamia się też w `pre-push` (pełny skan repo) i w CI (job `lint`).
