# S.O.K. — Agent: baza danych (Prisma + SQLite)

> Szczegółowy przewodnik domenowy. Root: `AGENTS.md` (mapa + bramy).

## Model

- SQLite WAL, `busy_timeout=30000`, seed paczkami (chunk 25/transakcja), inicjalizacja sekwencyjna (`await`, błędy #1/#2/#12).
- 48 modeli Prisma; migracje w `prisma/migrations/` (16). Nowe instalacje: `prisma migrate deploy`. `db push` wyłącznie dla baz legacy bez `_prisma_migrations` (jednorazowa konwersja, nie alternatywny model utrzymania).
- N+1: zbiorcze `findMany` + `in` i mapowanie w pamięci (błąd #9). Czyszczenie audit loga partiami + indeks `createdAt` (błąd #11).
- JSON w kolumnach `String`: dopuszczalny dla snapshotów/telemetrii/konfiguracji; każdy snapshot przez kopertę `{schemaVersion, data}` (`src/utils/snapshots.ts` — `serialize/deserializeSnapshot`). Nie normalizuj wszystkiego; kolumny filtrowane/relacje biznesowe modeluj jawnie.
- Monitor wzrostu: `npm run measure:telemetry` (telemetria ~0.6 MB/dzień — brak pilnej retencji; audyt ~81 KB/wiersz by design, retencja 180 dni w `cleanupAuditLogs`).

## Migracje i schemat

- Migracje addytywne; status: `npx prisma migrate status`. Niezamigrowane bazy legacy: `npx prisma db push --skip-generate --accept-data-loss` (tylko legacy).
- CI: `drift-check` + `migrate-deploy-verify` (blokują); release na `migrate deploy` (parity prod).
- Schemat legacy: `prisma db push` tworzy brakujące obiekty ad-hoc przy starcie (auto-heal) — nie zastępuje migracji.

## Backup / restore / cenniki

- `npm run backup` (VACUUM INTO + sha256) / `npm run restore <plik>` (nagłówek + `integrity_check` + czyszczenie WAL/SHM). Integralność: `npm run audit:integrity`.
- Cenniki: `npm run prices:export` / `prices:import` (`data/price_defaults.json`, walidacja sha256); `prices:verify` w `validate`.
- Restore test istnieje (`tests/migrations/restoreRoundtrip.test.ts`) — utrzymuj, nie duplikuj.
