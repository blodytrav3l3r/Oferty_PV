# Backup i Restore bazy danych SQLite

## Backup

Baza danych SQLite znajduje się w `data/app_database.sqlite`.

### Ręczny backup

```bash
node scripts/backup-db.js
```

Skrypt kopiuje bazę do `data/backup/backup_YYYY-MM-DD_HH-MM-SS.sqlite`.

### Automatyczny backup (Windows)

Harmonogram zadań można zainstalować:

```bash
npm run backup:install-cron
```

Odinstalowanie:

```bash
npm run backup:uninstall-cron
```

## Restore

### Przywrócenie z backupu

```bash
node scripts/restore-db.js data/backup/backup_2026-06-30_17-00-00.sqlite
```

Skrypt zapyta o potwierdzenie przed nadpisaniem.

### Ręczne przywrócenie

```bash
# Zatrzymaj aplikację
cp data/backup/backup_*.sqlite data/app_database.sqlite
# Uruchom aplikację
```

## Wersja bazy

Baza SQLite przechowuje numer wersji w `PRAGMA user_version`:

```sql
PRAGMA user_version;  -- zwraca np. 10000 (dla wersji 1.0.0)
```

Stan bazy (backup, wersja, rozmiar) można sprawdzić przez `GET /health`.

## Uwagi

- Backup wykonywany na działającej aplikacji jest bezpieczny (SQLite obsługuje równoczesny odczyt/zapis)
- **Nie** przywracaj backupu z innej wersji aplikacji bez sprawdzenia kompatybilności schematu (Prisma migrations)
- Regularne backupy konfiguruje się przez `data/backup/` — np. cron lub Windows Task Scheduler
