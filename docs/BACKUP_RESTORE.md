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

### Ręczne przywrócenie

```bash
# Zatrzymaj aplikację
cp data/backups/backup_2026-06-30_*.sqlite data/app_database.sqlite
# Uruchom aplikację
```

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
5. Jeśli schemat bazy różni się między wersjami:
    ```bash
    npx prisma db push --skip-generate
    ```

## Wersja bazy

Baza SQLite przechowuje numer wersji w `PRAGMA user_version`:

```sql
PRAGMA user_version;  -- zwraca np. 10000 (dla wersji 1.0.0)
```

Stan bazy (backup, wersja, rozmiar) można sprawdzić przez `GET /health`.

## Uwagi

- Backup wykonywany na działającej aplikacji jest bezpieczny (SQLite VACUUM INTO tworzy spójny snapshot)
- **Nie** przywracaj backupu z innej wersji aplikacji bez sprawdzenia kompatybilności schematu (uruchom `npx prisma db push --skip-generate`)
- Regularne backupy konfiguruje się przez `npm run backup:install-cron` lub cron na Linux
- Maksymalnie 30 najnowszych backupów jest przechowywanych (automatyczne czyszczenie)
