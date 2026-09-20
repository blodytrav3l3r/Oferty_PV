# ADR-012: SQLite single-node — jeden proces na plik bazy

**Status:** przyjęta (2026-09-20, E6 Master Planu 1.27.0)
**Kontekst:** ADR-001 (SQLite jako produkcja), Master Plan §7/E6

## Decyzja

1. Jeden plik bazy = dokładnie jeden proces Node. Zakaz PM2 cluster, drugiego kontenera i drugiej instalacji na tym samym pliku.
2. `connection_limit=1`, `journal_mode=WAL`, `synchronous=NORMAL`, `busy_timeout=30000` (`src/prismaClient.ts`, `src/initDatabase.ts`) — bez zmian.
3. `createModuleLock()` (`src/middleware/writeLock.ts`, timeout 30 s, poll 100 ms) jest wyłącznie anty-TOCTOU **w procesie** (bulk cenników, dedup AUTO_JS). Między procesami chroni tylko SQLite (busy-timeout).
4. Claimy numerów atomowym `UPDATE lastNumber+N` (`src/routes/orders/numbering.ts`) — bez RAM-locka, DB daje gwarancję. Wzorzec obowiązujący dla nowych claimów.

## Konsekwencje

- Przy `acquired:false` caller zwraca 429 — dodać warn + metrykę (E6 follow-up, 5 linii).
- Każdy `acquireLock` musi mieć `release` w `finally` (audyt przy dotyku; sprawdzić ścieżkę dedup w `telemetryService.ts`).
- Przyszła migracja (multi-node) wymaga dystrybuowanego locka — NIE implementować bez dowodu potrzeby.

## Odwołania

`docs/plans/2026-09-20-master-plan-ulepszen-sok-1.27.0.md` §7/E6, sweep writeLock R1.
