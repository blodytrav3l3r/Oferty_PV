# Zasady pracy — S.O.K. — System Ofert i Kalkulacji

## Codzienna praca

- Pracujesz na `main` — to jedyna gałąź.
- Commit: `git add -A` → `git commit -m "typ(scope): opis"` → `git push`
- Przed commitem: `npm run validate` (typecheck backend+frontend, lint backend+frontend, testy)
- Po modyfikacji kodu frontendowego: `npm run format`
- Po zmianie CSS testowanej w prod (`start.bat`, `NODE_ENV=production`): zrestartuj serwer (prestart regeneruje ignorowany w gicie `public/css/min/`, który prod serwuje zamiast źródeł) i zrób twardy refresh (Ctrl+Shift+R) — `?v=` zmienia tylko release, więc zwykłe F5 poda stare pliki z cache.
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
3. Hook `postbump` (`standard-version.scripts.postbump` w `package.json`) uruchamia `npm run version:propagate`, czyli **trzy skrypty**:
    - `scripts/auto-cache-bust.mjs` — aktualizuje `?v=` we wszystkich HTML (w tym `public/templates/*.html`) do nowej wersji
    - `scripts/auto-docs-version.mjs` — aktualizuje wersję w dokumentacji `README.md` + `docs/*.md` (`**Wersja:**`, `**Wersja aplikacji:**`, `> Wersja:`) oraz przykłady JSON `"version"`/`"dbVersion"` w `docs/API.md`
    - `scripts/auto-bat-version.mjs` — aktualizuje wersję w skryptach `.bat` (lista w `scripts/bat-files.mjs`, 14 plików)

    Hook kończy się `git add -u` — bez tego `--commit-all` commitował tylko `bumpFiles` + `CHANGELOG.md`, a propagacja zostawała w worktree po commicie.

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
    Instalator: skopiuje `.env`, zainstaluje zależności, skonfiguruje bazę i załaduje dane początkowe (produkty, konto admina).
    Przy pierwszym starcie serwer założy wersję cennika `v1` (ACTIVE) z plików `data/seed_*.json`.
    Niestandardowe ceny przeniesiesz między instalacjami przez panel „Wersje cennika” (eksport/import XLSX).
3. Uruchom serwer:
    ```bash
    .\start.bat
    ```
4. Zaloguj się na http://localhost:3000 (admin / hasło z `.env`). Do pracy zdalnej użyj HTTPS (reverse proxy) — patrz [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

> **UWAGA:** Nie uruchamiaj `start.bat` przed `install.bat` na świeżej instalacji.
> `start.bat` automatycznie seeduje pustą bazę przez `ensure-db.bat`, ale `install.bat`
> wykonuje pełną konfigurację (.env, zależności, migracje) — bez niego aplikacja nie zadziała.

## Instalacja na nowym urządzeniu

Nowa instalacja wykonuje migracje PostgreSQL 18, seed oraz import trzech
zatwierdzonych cenników z `data/pricelists/active-pricelists.json` automatycznie.
Używaj `install-new-pc.bat` na Windows albo `sudo bash install-linux-server.sh`
na Ubuntu/Debian. Instalator nie przenosi ofert, użytkowników, zamówień ani
historii i nie usuwa istniejących wolumenów. Backup PostgreSQL służy do restore
tej samej instalacji; szczegóły: `docs/instalacja-przenoszenie-systemu.md`.

## Aktualizacja istniejącej instalacji (schemat bazy)

1. Wykonaj i zweryfikuj backup PostgreSQL zgodnie z [procedurą wdrożenia](docs/DEPLOYMENT.md).
2. Pobierz nowy kod i zainstaluj zależności przez `npm ci`.
3. Sprawdź historię migracji przez `npm run prisma:status`. Jeśli istniejąca baza zawiera dane bez kanonicznej historii migracji, przerwij aktualizację i wyjaśnij rozbieżność na kopii.
4. Zastosuj wersjonowane migracje PostgreSQL przez `npm run prisma:deploy`, używając roli migratora. Uruchom serwer i sprawdź gotowość aplikacji zgodnie z [procedurą aktualizacji](docs/DEPLOY_UPDATE.md).

Uruchomienie `bash dev.sh` sprawdza status migracji oraz schemat i dane startowe PostgreSQL. Świeżą bazę deweloperską przygotowuje `bash install.sh`.

## Dependabot

Na GitHubie otwórz PR → zielony przycisk "Squash and merge". Tyle.

## Testy

```bash
npm test                 # Wszystkie testy
npm run test:quick       # Tylko testy dymne (szybkie)
npm run test:quick:lite  # Szybkie testy bez migracji (pre-push)
npm run test:git-safety  # Testy warstwy Git Safety (pre-push)
npm run test:frontend    # Testy frontendowe
npm run test:watch       # Watch mode
```

Przed mergem upewnij się, że wszystkie testy przechodzą.

## Formatowanie i lint

```bash
npm run format           # Prettier — automatyczne formatowanie
npm run format:check     # Sprawdź formatowanie
npm run lint             # ESLint (backend)
npm run lint:frontend    # ESLint (frontend, public/js)
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
