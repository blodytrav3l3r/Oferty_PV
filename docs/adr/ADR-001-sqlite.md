# ADR-001: SQLite jako baza produkcyjna

**Status:** Zaakceptowany  
**Data:** 2026-06-20  
**Autor:** Hermes Agent

## Kontekst

System WITROS Oferty wymaga bazy danych dla ofert, produktów, klientów i użytkowników.
Rozważano: PostgreSQL (standard dla web apps), SQLite, MySQL.

## Decyzja

**SQLite** jako baza danych dla wszystkich środowisk (dev, staging, production).

## Uzasadnienie

1. **Prostota backupu** — jeden plik (`app_database.sqlite`) = cała baza. Backup to `cp` pliku.
2. **Niski koszt hostingu** — Docker + VPS z Persistent Disk (1 GB) w zupełności wystarcza.
3. **Zero administracji** — brak serwera DB, brak konfiguracji replikacji, brak connection poolingu.
4. **Prisma ORM** — abstrakcja nad DB pozwala zmienić provider w przyszłości (wystarczy zmienić `datasource.provider` w schema.prisma).
5. **Single-writer model** — aplikacja biznesowa (jeden użytkownik generuje ofertę) nie wymaga concurrent writes.

## Konsekwencje

- **SQLITE_BUSY** — konieczny `PRAGMA busy_timeout = 30000` dla operacji współbieżnych (seed, audit cleanup).
- **Brak concurrent writes** — seedowanie produktów musi być sekwencyjne (chunk 25 prod/transakcja).
- **Render Persistent Disk** (sieciowy) — wolniejsze zapisy niż lokalny SQLite, uwzględnione w timeoutach.
- **Migracje** — Prisma migrate działa, ale `ALTER TABLE` w SQLite ma ograniczenia (nie wspiera DROP COLUMN bez recreacji).
- **Auto-heal indeksów przy starcie** — instalacje tworzone przez `prisma db push` nie mają
  historii migracji (`_prisma_migrations`), więc nowe indeksy nie są tam dokładane przez
  `migrate deploy`. `src/app.ts` wykonuje idempotentny `CREATE INDEX IF NOT EXISTS` przy
  starcie serwera (m.in. `idx_audit_created_at`, `idx_logs_well`, `idx_logs_source_well` —
  ten drugi z migracji `20260805100000_telemetry_well_dedup` dla dedup telemetrii AI).

## Alternatywy odrzucone

| Alternatywa | Powód odrzucenia                                                     |
| ----------- | -------------------------------------------------------------------- |
| PostgreSQL  | Wyższy koszt hostingu ($15+/mies.), konieczność zarządzania serwerem |
| MySQL       | Podobnie jak PostgreSQL, dodatkowe obciążenie operacyjne             |
