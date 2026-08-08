# Code Deletion Log

## [2026-08-08] Wycofanie Vite — Express jako jedyny serwer (ADR-005)

### Usunięte pliki

| Plik                         | Przyczyna                                                                                                                               |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `vite.config.js`             | Jedyny konsument to `vite` (dev:frontend); frontend nie używał żadnych cech Vite (klasyczne `<script>`, brak HMR/TS/`import.meta.env`). |
| `scripts/wait-and-start.mjs` | Spawnował Vite po healthchecku backendu — zbędne, gdy `npm run dev` = sam backend (Express serwuje `public/`).                          |
| `dist-web/` (katalog)        | Martwy artefakt `vite build` — niekompletny z definicji (brak klasycznych scriptów/partials).                                           |

### Dependencies

| Zmiana                                    | Przyczyna                                                                                                   |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `vite` usuniety z devDependencies         | Tylko dla `dev:frontend`/`build:frontend`, oba usuniete (patrz ADR-005).                                    |
| `esbuild` usuniety z devDependencies      | Optional peer dep Vite 8 dla `minify` — build frontendu usuniety. Uchyla poprzednia aktualizacje `deeb32a`. |
| `concurrently` usuniety z devDependencies | Tylko w skrypcie `dev` — skrypt uproszczony do `npm run dev:backend`.                                       |
| `wait-on` usuniety z devDependencies      | Tylko w `wait-and-start.mjs` (usuniety).                                                                    |

### Scripts

| Skrypt             | Zmiana                                                                             |
| ------------------ | ---------------------------------------------------------------------------------- |
| `dev`              | `concurrently backend + frontend` → `npm run dev:backend` (jeden proces na :3000). |
| `dev:frontend`     | Usuniety.                                                                          |
| `build:frontend`   | Usuniety (wczesniej, commit 0693fa9).                                              |
| `preview:frontend` | Usuniety (wczesniej, commit 0693fa9).                                              |

### Inne

- `start.bat` / `dev.sh`: komunikaty `:5173` → `http://localhost:3000`.
- Testy Playwright (`excelEmptyRowAlignment.cjs`, `partialOrderRury.cjs`): `BASE` z `:5173` → `:3000`.
- `src/app.ts` CSP: usuniety `ws://localhost:*` (relikt HMR Vite).
- ADR-003 oznaczony jako Superseded przez nowy ADR-005.

## [2026-08-06] Refactor Session 4 — Martwe endpointy i pola w API ML

### Martwe endpointy usunięte (`src/routes/telemetryAiDashboard.ts`)

| Endpoint                                             | Dowód (grep)                                                                                                                            |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/telemetry/ai/learning/status`              | Brak konsumenta w `public/js` — grep `learning/status` tylko w `docs/*` i src. Frontend (`aiDashboard.js`) usunął `status` z ENDPOINTS. |
| `GET /api/telemetry/ai/recommendations/:telemetryId` | Brak konsumenta w `public/js` — grep `recommendations` tylko w docs/schema/tests. Frontend usunął `recommendations` z ENDPOINTS.        |
| `POST /api/telemetry/ai/recommendations/decide`      | jw. Serwis `RecommendationEngine` **zostaje** — wołany przez `LearningEngine.ts` (grep: import w linii 22, użycie w 36/45).             |

Usunięto też nieużywane importy/instancje: `RecommendationEngine`, `AuthenticatedRequest`, `const recommend`.

### Martwe pola odpowiedzi usunięte (`GET /api/telemetry/ai/knowledge/patterns`)

| Pole            | Dowód (grep)                                                                                                                                                                              |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `dn`            | Frontend (`aiDashboard.js`) czyta tylko `items`, `telemetryCount`, `patternsTotal`, `patternsOtherDn`, `lastRunAt` — pola `dn`, `minConfidence`, `total`, `patternsForDn` bez konsumenta. |
| `minConfidence` | jw. (query params `?dn=`/`?minConfidence=` nadal przyjmowane, nie zwracane w response).                                                                                                   |
| `total`         | jw.                                                                                                                                                                                       |
| `patternsForDn` | jw. `patternsOtherDn` **zostaje** (frontend go czyta; `all_dn` naprawia inny agent w KnowledgeBase).                                                                                      |

### Over-fetch zredukowany (`src/services/ml/ModelRegistry.ts`)

- `listModels()` zwraca teraz nowy interfejs `ModelListItem` zamiast pełnego `StoredModel`.
- Usunięte z odpowiedzi: `weights`, `bias`, `featureMins`, `featureMaxs` (4 tablice liczb na model — główny ciężar payloadu).
- Zostaje: `id`, `version`, `active`, `createdAt`, `featureVersion`, `metrics` (sparsowane), `features` (tablica — frontend czyta `Array.isArray(m.features) ? m.features.length : ...`; zwrócenie liczby dałoby 0 cech), `trainingRows`.
- Typ `StoredModel` globalnie NIE zmieniony — mapowanie tylko w `listModels()`. Pozostałe metody (`getActiveModel`, `rollbackToPrevious`, `activateModel`, `promoteBestModel`, `deleteModel`) bez zmian.
- Konsument `listModels` — wyłącznie `GET /api/telemetry/ai/models` (`telemetryAiMl.ts:445`).

### Naprawa testu (`tests/ml/telemetryAiMl.test.ts`)

- Pre-existing failure: test mockował `rateLimiters` tylko z `WRITE_LIMITER`, a `telemetryAiMl.ts` używa też `READ_LIMITER` → `Route.get() requires a callback function`. Błąd występował na czystym HEAD (zweryfikowane przez `git stash`). Dodano `READ_LIMITER` do mocka — test przechodzi.

### P4 — usunięto po sesji (`KnowledgeBase.getStats` pole `stale`)

- Brak konsumenta pola `stale` w frontendzie (grep `stats.stale` — 0 trafień) — usunięte z `getStats` (typ, `count({ where: { status: 'stale' } })` i catch) w sesji obejmującej `KnowledgeBase.ts`.

### Martwa metoda usunięta (`PatternDetector.detectDennicaSwap`)

- `detectDennicaSwap` (PatternDetector.ts) — jedyny konsument to test `telemetryRoutes.test.ts` (describe `detectDennicaSwap: minimum 3 powtórzeń`); nie wołana z `LearningEngine.ts` ani nigdzie indziej. Usunięta wraz z nieużywanym interfejsem `Correction` i testem.

### Impact

| Wskaźnik                 | Wartość                                  |
| ------------------------ | ---------------------------------------- |
| Endpointy usunięte       | 3                                        |
| Pola odpowiedzi usunięte | 4                                        |
| Pola modelu (over-fetch) | 4 tablice liczb na model w `listModels`  |
| Linie kodu usunięte      | ~73 (`telemetryAiDashboard.ts` 159 → 86) |

### Testing

- [x] `npm run typecheck` — OK
- [x] `npx jest tests/telemetryRoutes.test.ts` — 58 passed
- [x] `npx jest tests/ml/telemetryAiMl.test.ts` — 16 passed
- [x] Prettier na zmodyfikowanych plikach

---

## [2026-08-05] Refactor Session 2 â€” Dead Code & Docs Cleanup

### Unused Code Removed

| Element                                             | Przyczyna                                                                                                                                                                              |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `KnowledgeBase.archivePattern`                      | Pole nie byĹ‚o uĹĽywane â€” archiwizacja wzorcĂłw nie byĹ‚a implementowana. UsuniÄ™te w commicie `fe1679f` (KnowledgeBase.ts).                                                         |
| `LearningEngine.feedback` / `LearningEngine.ranker` | Publiczne pola subkomponentĂłw nieistniejÄ…cych w `getComponents()` â€” zwraca wyĹ‚Ä…cznie `kb`, `patterns`, `prefs`, `recommend`. UsuniÄ™te w commicie `fe1679f` (LearningEngine.ts). |

### Artifacts Removed

| Plik                             | Przyczyna                                                                                                                                                                         |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `dataapp_database.sqlite` (root) | Artefakt bazy utworzonej w katalogu gĹ‚Ăłwnym projektu (poza `data/`). UsuniÄ™ty, dodano wpis `/*.sqlite*` do `.gitignore` (commit `c905934`), by zapobiec ponownemu trackowaniu. |

### Documentation Updates

| Plik                                                | Zmiana                                                                                                                                                                     |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/CONTRIBUTING.md`, `docs/INSTRUKCJA_SERWER.md` | Zaktualizowano zalecenia migracji bazy: `prisma migrate dev` â†’ `prisma migrate deploy` / `npx prisma db push` (w zaleĹĽnoĹ›ci od typu bazy). CzÄ™Ĺ›Ä‡ commitu `fe1679f`. |
| `docs/DELETION_LOG.md`                              | Ten wpis (Session 2).                                                                                                                                                      |

### Impact

| WskaĹşnik               | WartoĹ›Ä‡                                        |
| ----------------------- | ------------------------------------------------ |
| Pola/eksporty usuniÄ™te | 2 (`archivePattern`, `feedback`/`ranker`)        |
| Artefakty usuniÄ™te     | 1 (`dataapp_database.sqlite`)                    |
| Wpisy .gitignore        | 1 (`/*.sqlite*`)                                 |
| Linie kodu usuniÄ™te    | ~14 (KnowledgeBase.ts) + ~10 (LearningEngine.ts) |

### Testing

- [ ] Typecheck: przechodzi po usuniÄ™ciu pĂłl (commit `fe1679f`)
- [ ] Testy: `npm test` â€” 1305 testĂłw, wszystkie przechodzÄ… (commit `fe1679f`)
- [ ] Testy telemetrii: `tests/telemetryRoutes.test.ts` zaktualizowane pod kÄ…tem dedup AUTO_JS i braku referencji do usuniÄ™tych pĂłl
- [x] Encoding: `npm run encoding:check` â€” 0 bĹ‚Ä™dĂłw (4412 plikĂłw)

---

## [2026-07-22] Refactor Session 1 â€” Dead Code & Consolidation

### Unused Files Deleted

| Plik                   | Przyczyna                                                                                                             |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `scripts/backup-db.js` | Martwy. backup.js uĹĽywa `VACUUM INTO` (WAL-safe); backup-db.js tylko kopiowaĹ‚ plik. Nie miaĹ‚ wpisu w package.json. |

### Dependencies Removed

| Package | Przyczyna                             |
| ------- | ------------------------------------- |
| (brak)  | Na razie tylko logika, nie paczki npm |

### Unused Directories (oczekujÄ… na potwierdzenie)

| Katalog                   | ZawartoĹ›Ä‡                                                                                                                            | Status   |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `data/backup/` (singular) | KilkadziesiÄ…t plikĂłw `.json` (np. pv_offers.json, pv_clients.json itp.) â€” wyglÄ…dajÄ… na pozostaĹ‚oĹ›ci z debugowania lub eksportu | OCZEKUJE |
| `data/migration_backup/`  | To samo + `_migration_info.json`                                                                                                       | OCZEKUJE |

**Uwaga:** backup.ts uĹĽywa `data/backups/` (plural), ktĂłry jest poprawnym i aktywnym katalogiem backupu. Katalog `data/backup/` (singular) nie ma ĹĽadnego czytnika w kodzie.

### Files Consolidated

| Pliki                   | Operacja                                                                             | Uzasadnienie                                                                       |
| ----------------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| `start.bat` + `dev.bat` | start.bat: przepisany, Ĺ‚Ä…czy logikÄ™ obu. dev.bat: alias (call do start.bat --dev) | ~90% duplikacja. Zunifikowany port-check, wsparcie `--dev` (domyĹ›lne) i `--prod`. |

### Package.json Changes

| Wpis      | Operacja                                                                                |
| --------- | --------------------------------------------------------------------------------------- |
| `restore` | DODANO: `"restore": "node scripts/restore-db.js"` â€” skrypt istniaĹ‚, brakowaĹ‚o wpisu |

### Documentation Updates

| Plik                   | Zmiana                                                                              |
| ---------------------- | ----------------------------------------------------------------------------------- |
| `docs/ARCHITECTURE.md` | UsuniÄ™to wiersz z `backup-db.js` (linia byĹ‚a pomiÄ™dzy backup.ts a restore-db.js) |
| `docs/AUDIT_AI.md`     | Zmieniono backup-db.js na backup.ts                                                 |

### Impact

| WskaĹşnik            | WartoĹ›Ä‡                                                                   |
| -------------------- | --------------------------------------------------------------------------- |
| Pliki usuniÄ™te      | 1 (`scripts/backup-db.js`)                                                  |
| Pliki poĹ‚Ä…czone    | 2 (`start.bat` + `dev.bat`)                                                 |
| Pliki dodane         | 0 (tylko modyfikacje i aliasy)                                              |
| Linie kodu usuniÄ™te | ~11 (backup-db.js) + ~180 (duplikacja w batach usuniÄ™ta, start.bat ma ~80) |
| Komendy npm dodane   | 1                                                                           |

### Testing

- [ ] Typecheck: N/A (backup-db.js nie TypeScript; start.bat/bar, aliasy nie sÄ… typowane)
- [ ] Logika: zweryfikowana porĂłwnaniem kodu (start.bat vs dev.bat vs prod.bat)
- [ ] Testy bazowe: N/A

## [2026-08-05] Refactor Session 3 - Dead Code Cleanup

### Unused Functions/Exports Removed

| Element                                                                                                            | Przyczyna                                                                              |
| ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| `public/js/studnie/offerSvgDrag.js`: `_cleanupSvgDrag`, `_onSyncStatusChanged` + listener `pv-sync-status-changed` | Brak emitera zdarzenia w kodzie (tylko docs + ten plik).                               |
| `public/js/studnie/actionsConfigDrag.js`: `handleCfgDragLeave`                                                     | Jedyna definicja, brak wywołan (HTML uzywa `dragLeaveWellComponent` z actionsDrag.js). |
| `public/js/studnie/orderExport.js`: `showKartaBudowyExportChoice`                                                  | Brak wywołan w kodzie.                                                                 |
| `public/js/studnie/printManager.js`: `printEtykietaAll` + eksport window                                           | Brak wywołan; dziala `printEtykieta`.                                                  |
| `public/js/studnie/mlDualRanking.js`: `stopMlPollers` + eksport window                                             | Brak wywołan.                                                                          |
| `src/helpers.ts`: `filterRowsByRole`                                                                               | Uzywane tylko w testach (usuniete).                                                    |
| `src/helpers.ts`: `dateConversionSql`                                                                              | Uzywane tylko w testach (usuniete).                                                    |

### Tests Removed

| Plik                        | Zakres                                          |
| --------------------------- | ----------------------------------------------- |
| `tests/helpers.test.ts`     | Usunieto describe `filterRowsByRole` i import.  |
| `tests/dateHelpers.test.ts` | Usunieto describe `dateConversionSql` i import. |

### Files/Artifacts Removed

| Element                        | Przyczyna                                                                                                                                          |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `local_catalog.db` (root)      | Artefakt bazy w root; `git rm --cached` + usuniecie z dysku + wpis `/*.db` w `.gitignore`. Wpis `local_catalog.db` w `.dockerignore` pozostawiony. |
| `scripts/archive/` (15 plikow) | Zarchiwizowane skrypty; historia w git, wpis `scripts/archive/` juz w `.gitignore`.                                                                |

### Dependencies

| Zmiana                               | Przyczyna                                                                      |
| ------------------------------------ | ------------------------------------------------------------------------------ |
| `esbuild` usuniety z devDependencies | Uzywany tylko w konfiguracji Vite (`minify`), nie jako bezposrednia zaleznosc. |
| `jszip` juz w devDependencies        | Import tylko w `tests/combinedDocument.test.ts` - nie wymagal przeniesienia.   |

> **Aktualizacja (commit `deeb32a`, 2026-08-06):** `esbuild` zostal **ponownie dodany** do
> `devDependencies` (`^0.28.1`). Vite 8 traktuje `esbuild` jako opcjonalna zaleznosc peer —
> bez niego `npm run build:frontend` (z `minify: 'esbuild'` w `vite.config.js`) konczy sie bledem.
> Nie usuwac ponownie (patrz AGENTS.md #25 oraz ADR-003).

### Bug Fix

| Element                               | Opis                                                                                                                                                                    |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `public/js/studnie/offerTransport.js` | Lambda `fmt` w `updateModalTransportDetails` - dodano `.replace('.', ',')` (wzor z `updateTransportCostSummary`), cena w modalu transportu ma przecinek zamiast kropki. |

### Impact

- Files deleted: 16 (15 scripts/archive + local_catalog.db)
- Lines removed: ~200
- Bundle size reduction: 0 (tylko kod przegladarkowy nie w bundle)

### Testing

- [x] `node -c` na wszystkich zmodyfikowanych plikach JS
- [x] `npm run typecheck` - OK
- [x] `npm run lint` - OK (0 errors)
- [x] `npm run typecheck:frontend` - OK
- [x] `npm run lint:frontend` - 1204 warnings (0 errors), spadek z 1206
- [x] `npm test` - 69 suites, 1426 tests passed
- [x] `npm run version:check` - 1.11.1 spójna
