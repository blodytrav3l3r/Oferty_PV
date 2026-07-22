# Code Deletion Log

## [2026-07-22] Refactor Session 1 — Dead Code & Consolidation

### Unused Files Deleted

| Plik                   | Przyczyna                                                                                                          |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `scripts/backup-db.js` | Martwy. backup.js używa `VACUUM INTO` (WAL-safe); backup-db.js tylko kopiował plik. Nie miał wpisu w package.json. |

### Dependencies Removed

| Package | Przyczyna                             |
| ------- | ------------------------------------- |
| (brak)  | Na razie tylko logika, nie paczki npm |

### Unused Directories (oczekują na potwierdzenie)

| Katalog                   | Zawartość                                                                                                                      | Status   |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | -------- |
| `data/backup/` (singular) | Kilkadziesiąt plików `.json` (np. pv_offers.json, pv_clients.json itp.) — wyglądają na pozostałości z debugowania lub eksportu | OCZEKUJE |
| `data/migration_backup/`  | To samo + `_migration_info.json`                                                                                               | OCZEKUJE |

**Uwaga:** backup.ts używa `data/backups/` (plural), który jest poprawnym i aktywnym katalogiem backupu. Katalog `data/backup/` (singular) nie ma żadnego czytnika w kodzie.

### Files Consolidated

| Pliki                   | Operacja                                                                          | Uzasadnienie                                                                      |
| ----------------------- | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `start.bat` + `dev.bat` | start.bat: przepisany, łączy logikę obu. dev.bat: alias (call do start.bat --dev) | ~90% duplikacja. Zunifikowany port-check, wsparcie `--dev` (domyślne) i `--prod`. |

### Package.json Changes

| Wpis      | Operacja                                                                            |
| --------- | ----------------------------------------------------------------------------------- |
| `restore` | DODANO: `"restore": "node scripts/restore-db.js"` — skrypt istniał, brakowało wpisu |

### Documentation Updates

| Plik                   | Zmiana                                                                           |
| ---------------------- | -------------------------------------------------------------------------------- |
| `docs/ARCHITECTURE.md` | Usunięto wiersz z `backup-db.js` (linia była pomiędzy backup.ts a restore-db.js) |
| `docs/AUDIT_AI.md`     | Zmieniono backup-db.js na backup.ts                                              |

### Impact

| Wskaźnik            | Wartość                                                                    |
| ------------------- | -------------------------------------------------------------------------- |
| Pliki usunięte      | 1 (`scripts/backup-db.js`)                                                 |
| Pliki połączone     | 2 (`start.bat` + `dev.bat`)                                                |
| Pliki dodane        | 0 (tylko modyfikacje i aliasy)                                             |
| Linie kodu usunięte | ~11 (backup-db.js) + ~180 (duplikacja w batach usunięta, start.bat ma ~80) |
| Komendy npm dodane  | 1                                                                          |

### Testing

- [ ] Typecheck: N/A (backup-db.js nie TypeScript; start.bat/bar, aliasy nie są typowane)
- [ ] Logika: zweryfikowana porównaniem kodu (start.bat vs dev.bat vs prod.bat)
- [ ] Testy bazowe: N/A
