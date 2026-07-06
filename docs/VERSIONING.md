# Wersjonowanie — Semantic Versioning

Projekt **WITROS Oferty PV** używa **Semantic Versioning 2.0.0**.

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

- `src/version.ts` — centralny moduł wersji
- `package.json` — zadbaj aby zgadzała się z `VERSION`
- `GET /api/version` — endpoint API
- `GET /health` — health check
- Swagger/OpenAPI — dokumentacja API
- UI — wyświetlana w stopce aplikacji

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
