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

Do podbijania wersji służy `standard-version`:

```bash
# Podbicie patch (np. 1.0.0 → 1.0.1)
npm run release:patch

# Podbicie minor (np. 1.0.0 → 1.1.0)
npm run release:minor

# Podbicie major (np. 1.0.0 → 2.0.0)
npm run release:major

# Symulacja (dry-run, bez zmian)
npm run release:dry
```

Każde wydanie:

1. Podbija wersję w `VERSION` i `package.json`
2. Aktualizuje `CHANGELOG.md`
3. Tworzy commita z tagiem (np. `v1.1.0`)

## Baza danych

Wersja bazy SQLite jest przechowywana w `PRAGMA user_version`:

- `1.0.0` → `10000`
- `1.0.1` → `10001`
- `1.1.0` → `10100`
- `2.0.0` → `20000`

Wersja bazy jest dostępna przez `GET /api/version` → pole `dbVersion`.
