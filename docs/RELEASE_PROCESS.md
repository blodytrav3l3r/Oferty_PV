# Proces wydawniczy (Release Process)

**Wersja:** 1.16.1  
**Ostatnia aktualizacja:** 2026-08-05

Projekt używa **jednej gałęzi `main`** — brak gałęzi `develop`, `release/*`, `hotfix/*`.

## Krok po kroku

### 1. Przygotowanie

```bash
git checkout main
git pull
# Upewnij się, że wszystkie zmiany są zakomitowane
```

### 2. Uruchomienie release

```bash
npm run release:patch  # Małe poprawki (bug fixy)
npm run release:minor  # Nowe funkcje (zgodne wstecz)
npm run release:major  # Zmiany przełamujące kompatybilność
npm run release        # Automatyczny dobór na podstawie commitów
```

To wykonuje:

- Podbicie wersji w `VERSION`, `package.json` i `package-lock.json` (lista plików
  z `bumpFiles` w `.versionrc.json`; `VERSION` aktualizowany przez
  `scripts/version-updater.mjs`)
- Aktualizację `CHANGELOG.md` (plik wskazany jako `infile`)
- Hook `postbump` uruchamia **trzy skrypty**:
    - `scripts/auto-cache-bust.mjs` — podmienia `?v=` we wszystkich plikach HTML
      (w tym `public/templates/*.html`) na nową wersję
    - `scripts/auto-docs-version.mjs` — aktualizuje wersję w dokumentacji
      `README.md` + `docs/*.md` (`**Wersja:**`, `**Wersja projektu:**`,
      `**Wersja aplikacji:**`, `> Wersja:`) oraz przykłady JSON
      `"version"`/`"dbVersion"` w `docs/API.md`
    - `scripts/auto-bat-version.mjs` — aktualizuje wersję w skryptach `.bat`
      (start, install, build, setup-ai, ensure-db)
- Commita `chore(release): X.Y.Z` (release commituje wszystkie zmiany — flaga `--commit-all`)
- Tag `vX.Y.Z`

**Pełna lista miejsc z numerem wersji** (weryfikacja `npm run version:check`):

1. `VERSION` (root) — źródło prawdy
2. `package.json` / `package-lock.json` → `version`
3. `CHANGELOG.md` (nagłówki)
4. `public/*.html` + `public/templates/*.html` → `?v=X.Y.Z`
5. `*.bat` (start, install, build, setup-ai, ensure-db) → `APP_VERSION`
6. `README.md` + `docs/*.md` → `**Wersja:**` / `**Wersja projektu:**` / `**Wersja aplikacji:**` / `> Wersja:`
7. `docs/API.md` przykłady JSON → `"version"` / `"dbVersion"`

### 3. Weryfikacja

```bash
npm run validate  # lint + typecheck + test
```

### 4. Push z tagami

```bash
git push --follow-tags
```

Push taga automatycznie uruchamia workflow `.github/workflows/release.yml`, który:

- Uruchamia typecheck (`npm run typecheck`) i testy (`npm run test:quick`)
- Generuje GitHub Release z automatycznie wygenerowanymi notatkami (`generate_release_notes: true`)

## Zasady

- **Nigdy nie taguj ani nie zmieniaj wersji ręcznie** — wszystko obsługuje `standard-version`
- `VERSION`, `package.json` i `package-lock.json` muszą być zgodne (automatycznie po release)
- Po zmianie wersji zrestartuj serwer (`npm run dev:backend` lub `npm start` w produkcji)
- Release dopiero gdy zmiany są gotowe do produkcji
- **Cache-bust assetów** (`?v=` w HTML, w tym `public/templates/*.html`) jest automatycznie synchronizowany z `VERSION` podczas release (hook `postbump` w `scripts/auto-cache-bust.mjs`). Nie zmieniamy ręcznie parametrów `?v=` w plikach HTML.
- **Pre-push validation**: hook `.husky/pre-push` sprawdza `npm run version:check` (blokuje push przy niespójnej wersji), `npm run typecheck`, `npm run typecheck:frontend` oraz `npm run test:quick`.
- **`--commit-all`**: standard-version domyślnie commituje tylko pliki objęte release; flaga `--commit-all` (np. `npm run release:patch -- --commit-all`) commituje wszystkie zmiany w working tree.
- **`HUSKY=0`**: jeśli hook blokuje operację (np. pre-push), obejściem jest `HUSKY=0 git push` (lub `git -c core.hooksPath=/dev/null push`).

## Release — podgląd (dry run)

```bash
npm run release:dry
```

Pokazuje zmiany w changelogu bez zapisywania.

## Sprawdzenie spójności wersji

```bash
npm run version:check
```

## Hotfix

W sytuacji awaryjnej (na `main`):

```bash
git checkout main
# Naprawa błędu
npm run release:patch
git push --follow-tags
```
