# Wersjonowanie — Semantic Versioning

Projekt **S.O.K. — System Ofert i Kalkulacji** używa **Semantic Versioning 2.0.0**.

## Format

```
major.minor.patch (np. 1.0.0)
```

## Zasady

| Zmiana                                          | Podbicie | Przykład          |
| ----------------------------------------------- | -------- | ----------------- |
| Naprawa błędu (fix)                             | patch    | `1.0.0` → `1.0.1` |
| Nowa funkcja (feat)                             | minor    | `1.0.0` → `1.1.0` |
| Zmiana łamiąca kompatybilność (BREAKING CHANGE) | major    | `1.0.0` → `2.0.0` |

## Jedno źródło wersji

Wersja jest przechowywana w pliku `VERSION` w katalogu głównym projektu. Stamtąd jest odczytywana przez:

- `package.json` i `package-lock.json` — muszą zgadzać się z `VERSION`
- `CHANGELOG.md` — nagłówki wersji (generuje `standard-version`)
- `GET /api/version` — endpoint API (`{ version, name, node }`)
- `GET /health` — health check (`{ status, version, ... }`)
- `public/js/versionDisplay.js` — wyświetlana w UI (toolbar aplikacji)
- `scripts/auto-cache-bust.mjs` — synchronizuje `?v=` w plikach HTML (`public/*.html`, `public/templates/*.html`) podczas release
- `scripts/auto-docs-version.mjs` — synchronizuje markery wersji w `README.md` i `docs/*.md` oraz JSON `"version"`/`"dbVersion"` w `docs/API.md`
- `scripts/auto-bat-version.mjs` — synchronizuje `APP_VERSION` w `.bat` (start, install, build, setup-ai, ensure-db)

Spójność wszystkich źródeł weryfikuje `npm run version:check` (detale i pełna lista miejsc: [RELEASE_PROCESS.md](RELEASE_PROCESS.md)).

## Automatyzacja

Kanoniczna ścieżka: `npm run version:patch` (skrypt `scripts/bump-version.mjs`).

```bash
npm run version:patch    # 1.0.0 → 1.0.1
npm run version:minor    # 1.0.0 → 1.1.0
npm run version:major    # 1.0.0 → 2.0.0
npm run version:bump 1.2.3   # konkretna wersja
```

Bump jest atomowy i sam propaguje numer (`npm run version:propagate`):

1. `VERSION` + `package.json`
2. `?v=` w HTML (`public/*.html`, `public/templates/*.html`)
3. markery `**Wersja:**` / `> Wersja:` / `"version"` / `"dbVersion"` / `?v=` w `README.md` i `docs/*.md`
4. `APP_VERSION` w plikach `.bat`
5. `package-lock.json`

Poza automatem zostaje wyłącznie `CHANGELOG.md` (wpis wymaga treści zmian) — dodaj go i uruchom `npm run version:check`, który blokuje commit przy jakimkolwiek rozjeździe. Ten sam `version:propagate` uruchamia się jako hook `postbump` w `standard-version` (`npm run release:*`, ścieżka historyczna) razem z `git add -u`, żeby pliki propagacji trafiły do commita release, a nie zostały w worktree.

Numer wersji w dokumentacji: w runbookach i komendach deployu pisz `vX.Y.Z` (placeholder), nigdy konkretnego numeru — `version:check` zgłasza zaszyty numer w `deploy.mjs` / `git checkout v…` / `git tag -a v…` jako błąd.

## Schemat bazy danych

Docelowa historia schematu PostgreSQL jest zarządzana przez wersjonowane
migracje Prisma w `prisma/migrations-postgresql/`; wdrożeniowa komenda to
`npx prisma migrate deploy`, a `db push` nie jest wspieraną ścieżką. SQLite
`PRAGMA user_version` nie jest mechanizmem wersjonowania docelowej bazy i
pozostaje wyłącznie historycznym szczegółem starszej instalacji. Pole
`dbVersion` raportowane przez endpoint administracyjny odzwierciedla wersję
aplikacji, nie numer migracji PostgreSQL. Runtime i aktywne testy korzystają z
PostgreSQL 18; historia migracji jest niezależna od wersji aplikacji. Status
wdrożeń i zakres walidacji opisuje [DEPLOYMENT.md](DEPLOYMENT.md).
