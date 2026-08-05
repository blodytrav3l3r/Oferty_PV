# Code Deletion Log

## [2026-08-05] Refactor Session 2 — Dead Code & Docs Cleanup

### Unused Code Removed

| Element                                  | Przyczyna                                                                                                            |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `KnowledgeBase.archivePattern`           | Pole nie było używane — archiwizacja wzorców nie była implementowana. Usunięte w commicie `fe1679f` (KnowledgeBase.ts). |
| `LearningEngine.feedback` / `LearningEngine.ranker` | Publiczne pola subkomponentów nieistniejących w `getComponents()` — zwraca wyłącznie `kb`, `patterns`, `prefs`, `recommend`. Usunięte w commicie `fe1679f` (LearningEngine.ts). |

### Artifacts Removed

| Plik                                    | Przyczyna                                                                                  |
| --------------------------------------- | ------------------------------------------------------------------------------------------- |
| `dataapp_database.sqlite` (root)        | Artefakt bazy utworzonej w katalogu głównym projektu (poza `data/`). Usunięty, dodano wpis `/*.sqlite*` do `.gitignore` (commit `c905934`), by zapobiec ponownemu trackowaniu. |

### Documentation Updates

| Plik                    | Zmiana                                                                                                                     |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `docs/CONTRIBUTING.md`, `docs/INSTRUKCJA_SERWER.md` | Zaktualizowano zalecenia migracji bazy: `prisma migrate dev` → `prisma migrate deploy` / `npx prisma db push` (w zależności od typu bazy). Część commitu `fe1679f`. |
| `docs/DELETION_LOG.md`  | Ten wpis (Session 2).                                                                                                       |

### Impact

| Wskaźnik            | Wartość                                                        |
| ------------------- | -------------------------------------------------------------- |
| Pola/eksporty usunięte | 2 (`archivePattern`, `feedback`/`ranker`)                     |
| Artefakty usunięte  | 1 (`dataapp_database.sqlite`)                                  |
| Wpisy .gitignore    | 1 (`/*.sqlite*`)                                               |
| Linie kodu usunięte | ~14 (KnowledgeBase.ts) + ~10 (LearningEngine.ts)               |

### Testing

- [ ] Typecheck: przechodzi po usunięciu pól (commit `fe1679f`)
- [ ] Testy: `npm test` — 1305 testów, wszystkie przechodzą (commit `fe1679f`)
- [ ] Testy telemetrii: `tests/telemetryRoutes.test.ts` zaktualizowane pod kątem dedup AUTO_JS i braku referencji do usuniętych pól
- [x] Encoding: `npm run encoding:check` — 0 błędów (4412 plików)

---

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
