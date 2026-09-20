# Backup/restore live drill — read-only plan (bez wykonywania)

**Status:** CLOSED. Plan APPROVED + drill WYKONANY: SHA PASS, restore PASS, integrity ok, parity 4/4, migrate up-to-date, smoke `/health` 200 + login 200, cleanup PASS. Incydent :3000 OPEN (osobny raport `2026-09-12-incident-audit.md`).
**Cel:** jednorazowy dowód, że pełny cykl backup → restore → smoke działa na prawdziwej kopii produkcji.
**Twardy warunek:** ZERO operacji na żywej bazie. Restore wyłącznie do osobnego celu (`RESTORE_DB_PATH` w Temp), smoke na osobnym porcie. Nigdy `--yes` bez `RESTORE_DB_PATH`.

## 1. Fakty (audyt)

- Backup (`scripts/backup.ts`): `VACUUM INTO` (live-safe), SHA-256 sidecar, `integrity_check`, retencja 30. Zapisuje tylko nowy plik w `data/backups`.
- Restore (`scripts/restore-db.js`): strzeże magic-bytes + SHA + integrity pre/post, czyści `-wal/-shm`, `migrate deploy`; wspiera `RESTORE_DB_PATH` i `RESTORE_PRISMA_DIR` (cel poza prod). Bez `--yes` pyta interaktywnie.
- Testy jednostkowe istnieją (`tests/migrations/restoreRoundtrip.test.ts`, 5 scenariuszy: roundtrip, strażnik legacy, odrzut nie-SQLite/bez-integrity, czyszczenie WAL) — na izolowanych DB, nie na produkcyjnym kształcie danych.
- Serwer startuje z `data/app_database.sqlite` (`.env`); drill go nie dotyka ani nie restartuje.

## 2. Przebieg drillu (przyszły, jawne GO)

1. Pre: `git status` czysty; wybierz najnowszy backup z `.sha256`; cel: `%TEMP%/sok-drill/drill.sqlite` (poza repo i poza `data/`).
2. Asercja fail-closed PRZED restore: wypisz `RESTORE_DB_PATH` i potwierdź, że NIE wskazuje `app_database.sqlite` (porównanie ścieżek, stop przy równości).
3. `RESTORE_DB_PATH=<cel> node scripts/restore-db.js <backup> --yes` (`--yes` legalne TYLKO z ustawionym celem).
4. Smoke na kopii: `integrity_check` OK; parzystość liczników z DWÓCH niezależnych źródeł — baseline `COUNT(*)` z backupu zapisany PRZED restore vs `COUNT(*)` z celu PO restore (`users`, `offers_rel`, `orders_studnie_rel`, `settings`); SHA-256 pliku backupu przed/po drillu (źródło niemodyfikowane); `migrate status` na celu wyłącznie jako kontrola (bez ręcznych napraw); opcjonalnie boot serwera na celu + osobnym porcie, `/health` 200, login, shutdown.
5. Cleanup: usuń katalog drillu. Raport: każdy krok PASS/FAIL + czasy.

## 3. Zakazane w drillu

Restore bez `RESTORE_DB_PATH`; `--yes` na ścieżkę prod; restart serwera produkcyjnego; `migrate`/seed na prod; usuwanie backupów; commitowanie wyników jako kodu (raport w czacie).

## 4. Weryfikacja planu (nie drillu)

Review tego dokumentu. Sam drill — osobne jawne polecenie.
