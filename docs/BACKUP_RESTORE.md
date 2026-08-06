# Backup i Restore bazy danych SQLite

Baza danych SQLite znajduje się w `data/app_database.sqlite`.

## Backup

### Ręczny backup

```bash
npm run backup
```

Skrypt kopiuje bazę do `data/backups/backup_YYYY-MM-DD_TIMESTAMP.sqlite` przy użyciu `VACUUM INTO` (spójny snapshot, działa podczas zapisu).

### Automatyczny backup (Windows)

```bash
npm run backup:install-cron    # Instaluje zadanie w Harmonogramie zadań
npm run backup:uninstall-cron  # Usuwa zadanie
```

## Restore

### Przywrócenie z backupu (zalecane)

```bash
npm run restore data/backups/backup_2026-06-30_*.sqlite
```

Skrypt pyta o potwierdzenie przed nadpisaniem bieżącej bazy.

> **Synchronizacja schematu:** po skopiowaniu pliku `npm run restore` automatycznie wykonuje
> `npx prisma db push --skip-generate --accept-data-loss`, co synchronizuje schemat bazy
> z aktualnym `schema.prisma` — tworzy m.in. indeksy deduplikacji telemetrii AI
> (`idx_logs_well`, `idx_logs_source_well`) oraz nowe kolumny/tabele. **Ręczne kopiowanie
> pliku backupu NIE synchronizuje schematu.**

### Ręczne przywrócenie

```bash
# Zatrzymaj aplikację
cp data/backups/backup_2026-06-30_*.sqlite data/app_database.sqlite
# Uruchom aplikację
```

> **Uwaga:** ręczne skopiowanie pliku **nie tworzy nowych indeksów/kolumn** (np. indeksy
> telemetrii AI). Po ręcznym restore uruchom `npx prisma db push --skip-generate
--accept-data-loss`. Przy starcie serwera indeksy telemetrii AI i tak są uzupełniane
> automatycznie (auto-heal w `src/app.ts`), ale dla spójności pełnego schematu użyj `db push`.

## Przenoszenie bazy na nowe urządzenie

1. Na starym urządzeniu: `npm run backup`
2. Skopiuj plik `data/backups/backup_*.sqlite` na nowe urządzenie (pendrive, SCP, chmura)
3. Na nowym urządzeniu wykonaj instalację z pominięciem seedowania:
    ```bash
    .\install.bat --skip-seed   # Windows
    bash install.sh --skip-seed  # Linux
    ```
4. Przywróć bazę z backupu:
    ```bash
    npm run restore data/backups/backup_*.sqlite
    ```
5. Schemat bazy jest synchronizowany automatycznie przez `npm run restore`
   (`prisma db push --skip-generate --accept-data-loss`) — indeksy telemetrii AI
   (`idx_logs_well`, `idx_logs_source_well`) zostaną utworzone bez ręcznej interwencji.

## Wersja bazy

Baza SQLite przechowuje numer wersji w `PRAGMA user_version`:

```sql
PRAGMA user_version;  -- zwraca np. 10000 (dla wersji 1.0.0)
```

Stan bazy (backup, wersja, rozmiar) można sprawdzić przez `GET /health`.

## Uwagi

- Backup wykonywany na działającej aplikacji jest bezpieczny (SQLite VACUUM INTO tworzy spójny snapshot)
- **Nie** przywracaj backupu z innej wersji aplikacji bez sprawdzenia kompatybilności schematu — `npm run restore` synchronizuje schemat automatycznie (`prisma db push --skip-generate --accept-data-loss`), ręczne kopiowanie tego nie robi
- Regularne backupy konfiguruje się przez `npm run backup:install-cron` lub cron na Linux
- Maksymalnie 30 najnowszych backupów jest przechowywanych (automatyczne czyszczenie)
