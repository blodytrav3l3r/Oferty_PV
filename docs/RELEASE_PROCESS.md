# Proces wydawniczy (Release Process)

**Wersja:** 1.9.0  
**Ostatnia aktualizacja:** 2026-07-22

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

- Podbicie wersji w `VERSION` i `package.json`
- Aktualizację `CHANGELOG.md`
- Commita `chore(release): X.Y.Z`
- Tag `vX.Y.Z`

### 3. Weryfikacja

```bash
npm run validate  # lint + typecheck + test
```

### 4. Push z tagami

```bash
git push --follow-tags
```

Push taga automatycznie uruchamia workflow `.github/workflows/release.yml`, który:

- Uruchamia testy
- Generuje GitHub Release z opisem z CHANGELOG

## Zasady

- **Nigdy nie taguj ani nie zmieniaj wersji ręcznie** — wszystko obsługuje `standard-version`
- `VERSION` i `package.json` muszą być zgodne (automatycznie po release)
- Po zmianie wersji restart backendu
- Release dopiero gdy zmiany są gotowe do produkcji
- **Cache-bust assetów** (`?v=` w HTML) jest automatycznie synchronizowany z `VERSION` podczas release (hook `postbump` w `scripts/auto-cache-bust.mjs`). Nie zmieniamy ręcznie parametrów `?v=` w plikach HTML.
- **Pre-push validation**: Husky pre-push sprawdza `npm run version:check` (blokuje push przy niespójnej wersji) oraz `typecheck` + testy.

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
