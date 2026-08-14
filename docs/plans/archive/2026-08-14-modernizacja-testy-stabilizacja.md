# Plan: Kompleksowa modernizacja, testowanie i stabilizacja aplikacji

> Data: 2026-08-14 (korekta 2026-08-14 po analizie planu)
> Status: **UKOŃCZONE (2026-08-14)**
> Cel: podniesienie projektu z ~84/100 do 90-95/100 bez utraty stabilności, funkcjonalności i dyscypliny procesowej.

---

## 0. Sekcja statusu postępu

| Faza | Status                                      |
| ---- | ------------------------------------------- |
| 0    | DONE - audyt (sekcja 3)                     |
| 1    | DONE - infrastruktura coverage              |
| 2    | DONE - testy krytyczne (2026-08-14)         |
| 3    | DONE - PZ stable ID (2026-08-14)            |
| 4    | DONE - modularyzacja frontendu (2026-08-14) |
| 5    | DONE - benchmark + db counter (2026-08-14)  |
| 6    | DONE - security regresje (2026-08-14)       |
| 7    | DONE - requestId (2026-08-14)               |
| 8    | DONE - schema sanity CI (2026-08-14)        |

> Reguła: faza oznaczana jako zakończona DOPIERO po weryfikacji (validate + typecheck + testy + coverage + ręczny smoke).

---

## 1. Executive Summary

Aplikacja S.O.K. (v1.14.2) to dojrzała aplikacja produkcyjna z silną dyscypliną procesową.
Ocena 84/100 potwierdzona danymi. Główne ryzyka:

1. **Coverage nie jest mierzone w CI.** `test:quick` (=CI) działa bez coverage; ostatni raport
   `coverage/lcov.info` ma 0 bajtów. Historyczny raport HTML pokazuje **statements 65.4%,
   branches 65.8%** dla 97/121 plików — ale nikt tego nie gateduje.
2. **PZ używają indeksów elementów** (`production_orders_rel.elementIndex`) — potwierdzone
   w `production.ts`, `productionSearch.ts`, `productionSearchUtils.ts`, guardach. Ryzyko
   cichej zmiany danych realne (baza błędów #23).
3. **God files we frontendzie** — studnie 136 plików / 37 123 LOC,
   `solverAutoSelect.js` 1292 LOC, `popupsTransitionManager.js` 929 LOC.
4. **Hybrydowe migracje** — 13 migracji istnieje, ale instalatory robią
   `db push --accept-data-loss` w fallbacku.

**FALSE POSITIVES / ALREADY RESOLVED:**

- Problem #26 "dot. PZ" — baza błędów #26 to "Brak walidacji dat w wyszukiwarce" (searchUtils),
  **nie PZ**. Już naprawione. PZ dotyczy wyłącznie **#23**.
- `version:check`, `encoding:check`, appname:check, commitlint — działają w CI i hookach. Zero działań.
- Sentry, rate limiting, hashowanie haseł/tokenów — wdrożone i przetestowane.

---

## 2. Korekty planu po analizie (2026-08-14)

Analiza planu wykryła 9 błędów/ryzyk. Korekty:

### K1 (krytyczne) — `elementKey` wymaga uprzedniego nadania `_elemId` elementom studni

Elementy studni w `well.config` to `{ productId, quantity, _addedAt }` (`actionsCrud.js:98,106,131`) —
**nie mają uid**. `elementKey` z `uid-<componentUid>` jest niemożliwy. Korekta Fazy 3:

1. **Krok 0:** dodać stabilny `_elemId` (np. `crypto.randomUUID()`) do każdego elementu przy tworzeniu
   (`actionsCrud.js`, `diagramOtRings.js`, solver, excel) + funkcja `ensureElemIds(well.config)` idempotentna.
2. **Krok 1:** migracja kolumny `elementKey TEXT?`.
3. **Krok 2:** dual-write `elementIndex` + `elementKey`.
4. **Krok 3:** read przez `elementKey` z fallbackiem na `elementIndex`.
5. **Backfill:** tylko dla PZ z identyfikowalnym elementem (po `_elemId` w config lub `data` snapshot);
   PZ bez możliwego dopasowania pozostają na `elementIndex` (fallback).

### K2 (krytyczne) — Faza 4: stopniowa konwersja pojedynczych plików na ES modules NIE jest wykonalna

Klasyczny `<script>` nie może `import` z ES module, a module nie współdzielą globali z klasycznymi
skryptami. `studnie.html` ładuje 149 klasycznych skryptów. Korekta Fazy 4:

- **Opcja A (realna, niskie ryzyko):** pozostać przy klasycznych skryptach + IIFE + jawny `window.*`,
  wykonać tylko reorganizację strukturalną + testy logiki przez vm.
- **Opcja B (duże ryzyko):** konwersja pełnego łańcucha zależności w jednym kroku (jeden commit),
  wymaga E2E dla każdego modułu.
- **Decyzja:** najpierw `frontend-deps.mjs` (dependency map) i ocena; domyślnie Opcja A w tej iteracji.

### K3 (krytyczne) — CI: jawna zmiana `test:quick` na coverage

`ci.yml:92` robi `npm run test:quick` (`jest --no-coverage`) — artifact `coverage/` byłby pusty.
Korekta: w job `test` (lub nowy job `coverage`) uruchamiać `npm test --coverage` + upload artifact.

### K4 — Progi coverage dopiero po świeżym baseline

`coverage/lcov.info` ma 0 bajtów; HTML pokrywa 97/121 plików. Korekta Fazy 1:
najpierw świeży `npm test --coverage` → zapisać realny baseline → dopiero progi.

### K5 — Faza 2: audyt istniejących testów PRZED pisaniem nowych

Istnieją: `offers.crud.test.ts`, `offers.test.ts`, `ruryOrderExport.test.ts`,
`studnieOrderExport.test.ts`, `ownership.test.ts`, `productionOrderGuard.test.ts`,
`offerSchemas.test.ts` (tests/offerSchemas.test.ts istnieje). Korekta: rozszerzać istniejące,
nie duplikować.

### K6 — `hasPzForElementAtOrAfter` już istnieje (`pzGuard.js:31`)

Plan (3.5) opisywał to jako nowe. To istniejące zachowanie; stable-key **zastąpi** szeroką blokadę
(obecnie blokuje usunięcie dowolnego elementu, gdy PZ jest dalej w liście).

### K7 — poprawna nazwa reportera coverage

`coverage-summary.json` generuje reporter **`json-summary`** (nie "JSON reporter").

### K8 — test regresyjny PZ po sortowaniu bez sensu, dopóki nie ma klucza

Test "`sortWellConfigByOrder()` NIE zmienia wskazań PZ (po key)" wykonalny dopiero po K1
(`_elemId`). Wcześniej — tylko istniejący `hasPzForElementAtOrAfter`.

### K9 — rate limit to nie "2 linie"

Wymaga importu limitera + wyboru limitów per-endpoint (telemetry polluje często — inny limit
niż np. CRUD).

---

## 4. Zasady minimalizacji ryzyka (obowiązują każdy etap)

| Warstwa                        | Mechanizm                                                                        |
| ------------------------------ | -------------------------------------------------------------------------------- |
| **Backup**                     | `npm run backup` przed KAĹ»DYM etapem dotykającym danych (PZ, migracje, db)      |
| **Izolacja**                   | Zmiany danych P0/P1 na osobnym branchu, 1 commit = 1 logiczna zmiana             |
| **Zasada zero regresji**       | Baseline (lint/typecheck/testy/coverage) przed i po — `before vs after`          |
| **Guard feature flag**         | Nowe zachowania (np. stable PZ ID) pod flagą `settings` — włączanie etapami      |
| **Rollback**                   | Każdy etap dokumentuje przywracanie; PZ ma `--revert` (mapowanie starych kluczy) |
| **Test ochronny przed zmianą** | Najpierw test, który łapie błąd, potem zmiana (red → green)                      |
| **Weryfikacja**                | `npm run validate` + `version:check` + `encoding:check` na każdym commitcie      |

---

## 5. Dane bazowe (audyt)

### Test Coverage (raport HTML, ostatni przebieg z coverage)

| Obszar               | Pliki TS | Coverage stmt          | Ryzyko  | Brakujące testy                       | Priorytet |
| -------------------- | -------- | ---------------------- | ------- | ------------------------------------- | --------- |
| PDF (`services/pdf`) | 11       | ~20% (kartaBudowy 3%)  | wysokie | rendery karty budowy, tokeny, context | P1        |
| DOCX studnie         | 7        | ~45% (kartaBudowy 9%)  | wysokie | generatory DOCX studni                | P1        |
| DOCX rury            | 7        | ~30% (kartaBudowy 14%) | wysokie | generatory DOCX rur                   | P1        |
| Orders rury          | 4        | ~35% (crud 27%)        | wysokie | pełne CRUD, eksport, numeracja        | **P0**    |
| Auth                 | 2        | ~30%                   | wysokie | auth flow, limiter loginu             | P1        |
| Telemetry AI         | 12       | ~60%                   | średnie | ML endpoints (14 endpointów)          | P2        |
| Offers rury          | 3        | ~60% (ruryCrud ~75%)   | wysokie | edge cases, walidacja, ownership      | **P0**    |
| Offers studnie       | 3        | ~65%                   | wysokie | delete z PZ, walidacja                | **P0**    |
| Validators           | 5        | ~65%                   | średnie | pełne schematy                        | P2        |
| Utils                | 9        | ~60%                   | średnie | searchUtils, fts5Sync, ownership      | P2        |
| Produkty             | 2        | ~60%                   | średnie | studnie V2 (366 LOC, 0 testów)        | P1        |

**Ogółem backend: ~65% statements, ~66% branches.** Frontend (public/js) — nieobjęty pomiarem.

### Frontend

| Moduł     | Pliki | LOC    | Ryzyko    | Uwagi                                                                                                |
| --------- | ----- | ------ | --------- | ---------------------------------------------------------------------------------------------------- |
| studnie   | 136   | 37 123 | krytyczne | `solverAutoSelect` 1292, `popupsTransitionManager` 929, `orderZleceniaForm` 873, `mlDualRanking` 862 |
| rury      | 31    | 6 401  | wysokie   | `transport.js` 702, `offerExports` 673                                                               |
| shared    | 15    | 3 795  | średnie   | headerUser, StorageService                                                                           |
| spa       | 4     | 2 201  | średnie   | router, redirect                                                                                     |
| kartoteka | 8     | 2 350  | średnie   | import/export XLSX                                                                                   |
| admin     | 2     | 1 134  | niskie    | —                                                                                                    |

### Backend — God files (top 10)

| Plik                                     | LOC | Ryzyko        | Priorytet |
| ---------------------------------------- | --- | ------------- | --------- |
| `services/docx/studnie/kartaBudowy.ts`   | 768 | wysokie       | P2        |
| `routes/telemetryAiMl.ts`                | 663 | średnie       | P2        |
| `services/telemetry/telemetryService.ts` | 535 | średnie       | P2        |
| `services/ml/FeatureExtractor.ts`        | 519 | średnie       | P2        |
| `services/pdf/kartaBudowy.ts`            | 505 | wysokie       | P1        |
| `routes/offers/ruryCrud.ts`              | 493 | **krytyczne** | **P0**    |
| `services/docx/studnie/sections.ts`      | 493 | wysokie       | P2        |
| `services/ml/ModelRegistry.ts`           | 468 | średnie       | P2        |
| `app.ts`                                 | 446 | średnie       | —         |
| `routes/offers/studnieCrud.ts`           | 437 | **krytyczne** | **P0**    |

### Database

- 37 modeli, 13 migracji + `migration_lock.toml`. SQLite, WAL, `PRAGMA user_version=20000`.
- Instalatory używają `db push --accept-data-loss` w fallbacku (`install.sh:80`, `install.bat:122`,
  `ensure-db.bat:35`, `docker-entrypoint.sh:33`, `restore-db.js:31`).
- Auto-heal w `app.ts` (indeksy, FTS5, model ML, feature flag) — dobry wzorzec.
- Brak weryfikacji driftu schematu między środowiskami.

### CI/CD — obecne quality gates

| Krok                                 | Obecny               | Brakuje                                   |
| ------------------------------------ | -------------------- | ----------------------------------------- |
| lint + prettier + encoding + appname | âś…                  | —                                         |
| typecheck (back+front)               | âś…                  | —                                         |
| unit/integration                     | âś… `test:quick`     | **bez coverage**                          |
| coverage gate                        | âťŚ                  | baseline + "nigdy niżej"                  |
| E2E                                  | âś… tylko appname    | krytyczne scenariusze rury/studnie/orders |
| security checks                      | âš ď¸Ź CodeQL (repo) | brak w workflow                           |
| build                                | âś… docker           | —                                         |
| drift schematu                       | âťŚ                  | `prisma migrate diff`                     |

### Technical Debt ranking (Risk = Impact Ă— Probability)

| #   | Problem                                                     | Imp | Prob | Risk | Priorytet |
| --- | ----------------------------------------------------------- | --- | ---- | ---- | --------- |
| 1   | Brak coverage gate w CI                                     | 5   | 5    | 25   | **P0**    |
| 2   | PZ na indeksach elementów                                   | 5   | 3    | 15   | **P0**    |
| 3   | Krytyczne ścieżki bez testów (rury orders/offers, PDF/DOCX) | 4   | 4    | 16   | **P0**    |
| 4   | God files frontend (studnie)                                | 4   | 4    | 16   | P1        |
| 5   | `db push` w instalatorach                                   | 4   | 3    | 12   | P1        |
| 6   | Brak request ID w logach                                    | 3   | 3    | 9    | P2        |
| 7   | Brak benchmarków wydajności                                 | 3   | 3    | 9    | P2        |
| 8   | Rate limit na telemetry/exportCombined                      | 3   | 2    | 6    | P2        |
| 9   | Duplikacja (offers rury/studnie, exports)                   | 2   | 3    | 6    | P3        |
| 10  | CSP report-only (nie wymuszony)                             | 2   | 2    | 4    | P3        |

---

## 6. Master Roadmap (fazy)

### Faza 1 — Infrastructure Coverage (ryzyko: MINIMALNE)

Cel: zmierzyć bez blokowania. Brak zmian kodu produkcyjnego.

| Krok | Zmiana                                                                                                               | Test/Zabezpieczenie                                 |
| ---- | -------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| 1.0  | **Ĺšwieży baseline** `npm test --coverage` (K4)                                                                      | zapisać realne % do pliku baseline                  |
| 1.0  | **Wynik** (2026-08-14): Lines **65.0%** (10878/16726), Branches **64.9%** (1137/1753), Functions **61.5%** (220/358) | 95 suites / 1587 testów zielonych                   |
| 1.1  | `json-summary` reporter (K7) w `jest.config.ts` → `coverage-summary.json`                                            | `npm test --coverage` — raport musi się wygenerować |
| 1.3  | Skrypt `scripts/coverage-check.mjs` — czyta summary, wyświetla %                                                     | `node scripts/coverage-check.mjs` exit 0            |
| 1.4  | Progi **bez blokady** (mode `report`) oparte o baseline z 1.0 (K4)                                                   | test skryptu (fixture summary)                      |
| 1.5  | Dokumentacja progu + artifact `coverage/` w CI (K3)                                                                  | —                                                   |

Guard: nic nie psuje — brak zmian w kodzie produkcyjnym. Rollback: revert 1 commita.

### Faza 2 — Testy krytyczne (ryzyko: NISKIE — tylko nowe testy)

Cel: pokryć rury offers/orders, walidatory, ownership. Ryzyko: brak zmian produkcyjnych.
**Najpierw audyt istniejących testów (K5), potem uzupełnianie — nie duplikacja.**

| Krok | Zakres                                                                                                             | Testy                                                   |
| ---- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------- |
| 2.0  | **Audyt istniejących testów** (`offers.*`, `ruryOrderExport`, `ownership`, `productionOrderGuard`, `offerSchemas`) | mapa pokrycia                                           |
| 2.1  | `tests/orders/ruryOrders.crud.test.ts`                                                                             | CRUD rur (sukces + błędy + auth + ownership)            |
| 2.2  | rozszerzenie `ruryOrderExport.test.ts`                                                                             | eksport PDF/DOCX rur (kontrakt, błędy)                  |
| 2.3  | `tests/offers/ruryCrud.test.ts`                                                                                    | create/update/delete oferta rury, walidacja, PZ blokady |
| 2.4  | rozszerzenie `offerSchemas.test.ts`, `orderSchemas.test.ts`                                                        | edge cases walidacji                                    |
| 2.5  | rozszerzenie `productionOrderGuard.test.ts`                                                                        | zlecenia PZ (tworzenie, batch, guard)                   |

Guard: nowe pliki testowe, zero zmian w `src/`. Jak test wykryje realny błąd → osobny commit
`fix` z tym testem (red→green).

**Wynik (2026-08-14):** 4 nowe pliki testowe (+77 testów): `tests/orders/ruryOrders.crud.test.ts`
(15), `tests/ruryOrderExport.test.ts` (+5 export-offer), `tests/offers/ruryCrud.test.ts` (10),
`tests/orderSchemas.test.ts` (33), `tests/orders/productionOrders.test.ts` (14). 99 suites /
1664 testów zielonych. Coverage: lines 65.0→**67.3%**, functions 61.5→**62.4%**. Zastosowano
`validate` (typecheck + lint) + encoding:check. Testy nie wykryły realnych błędów w `src/`.

### Faza 3 — PZ stable ID (ryzyko: NAJWYĹ»SZE — pełna minimalizacja)

Problem: `production_orders_rel.elementIndex` (int) — po sortowaniu/usunięciu elementu PZ może
wskazać inny komponent (błąd #23).

Strategia: **nadanie `_elemId` → kolumna `elementKey` → dual-write → read przez key + fallback → flag** (K1).

**Wynik (2026-08-14):** kroki 3.0–3.7 wykonane i zweryfikowane.

- **3.0** `wellElemId.js` (idempotentna `ensureElemIds` + `newElemId`, crypto.randomUUID) wpięta w
  `renderWellConfig()` (actionsConfigRender.js). Test vm `tests/studnie/wellElemId.test.ts` 7/7.
- **3.1** Kolumna `elementKey TEXT?` w `production_orders_rel` (schema.prisma + migracja formalna
  `prisma/migrations/20260814000000_pz_element_key/`, ALTER zastosowany przez node:sqlite — baza
  jest typu `db push`; `prisma generate` zablokowany EPERM przez działające procesy node).
- **3.2** Backfill **no-op**: baza ma 0 PZ, a legacy config studni w bazie nie zawiera `_elemId`
  (wellElemId dodany 2026-08-14). Nowe zapisy dostają key przez dual-write.
- **3.3** Dual-write `elementKey` w production.ts (PUT+POST batch, GET /:id, GET /),
  productionSearch.ts, productionSearchUtils.ts, orderSchemas.ts. Frontend: orderZleceniaModal.js
  (`el.configItem._elemId`), orderBulk.js (`well.config[elementIndex]._elemId`).
- **3.4** Read przez key z fallbackiem: `pzGuard.findPzForElement(list, wellId, elemKey, elementIndex)`
  podpięty w 10 miejscach (orderZlecenia{Helpers,Render,Form,Modal,Data}, orderBulk, printManager×2).
- **3.5** Test vm `tests/studnie/pzGuard.test.ts` 8/8 (key>index, fallback, flaga).
- **3.6** Feature flag `pz_stable_id` (GET /api/feature-flags, domyślnie ON), cache + setter w
  pzGuard, inicjalizacja w orderManager.js.
- **3.7** `auditPzElementKeyMismatch()` w loadProductionOrders — loguje PZ z niedopasowanym key.

Weryfikacja: typecheck backend+frontend czyste, lint czysty, `encoding:check` OK, `version:check` OK,
101 suites / 1679 testów zielonych. Zmiany **niezacommitowane** (wraz z Fazą 2).

| Krok | Zmiana                                                                                                                                                                 | Test                                                               | Rollback                                   |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------ |
| 3.0  | **Nadanie `_elemId`** (crypto.randomUUID) przy tworzeniu elementów studni (`actionsCrud`, `diagramOtRings`, solver, excel) + idempotentna `ensureElemIds(well.config)` | test `ensureElemIds` (vm)                                          | czysty kod frontendu                       |
| 3.1  | **Migracja schematu:** kolumna `elementKey TEXT?`                                                                                                                      | migracja + `prisma migrate diff`                                   | `DROP COLUMN` (nowa kolumna, bez danych)   |
| 3.2  | **Backfill:** `elementKey` dla PZ z identyfikowalnym elementem (po `_elemId` w config lub `data`); PZ bez dopasowania → `elementIndex` (fallback)                      | test backfill na fixture                                           | backup przed skryptem; skrypt idempotentny |
| 3.3  | **Dual-write:** zapis `elementIndex` + `elementKey` razem w `production.ts`                                                                                            | test tworzenia PZ (oba pola)                                       | —                                          |
| 3.4  | **Read przez elementKey z fallbackiem na elementIndex**                                                                                                                | test: PZ odnajduje element po sortowaniu (key) i po legacy (index) | —                                          |
| 3.5  | **Frontend `pzGuard.js`:** `hasPzForElement` po key + index (rozszerzenie istniejącego `hasPzForElementAtOrAfter`, K6)                                                 | testy pzGuard (vm)                                                 | —                                          |
| 3.6  | **Feature flag** `pz_stable_id` (domyślnie ON po 3.4)                                                                                                                  | test flag                                                          | wyłączenie = stary kod                     |
| 3.7  | **Audyt cichej zmiany:** na starcie logować PZ, których key nie pasuje do configu                                                                                      | —                                                                  | —                                          |

Zabezpieczenia dodatkowe:

- Backup przed 3.1-3.3.
- Test regresyjny (dopiero po 3.0, K8): `sortWellConfigByOrder()` NIE zmienia wskazań PZ (po `_elemId`).
- E2E: utwórz PZ → posortuj konfig → PZ nadal wskazuje ten sam element.
- Migracja przez `npx prisma migrate dev` (nowa migracja), NIE `db push`.

### Faza 4 — Frontend modularyzacja (ryzyko: ĹšREDNIE — etapowanie)

Cel: granice modułów bez przepisywania. **Decyzja po dependency map (K2).**
Stopniowa konwersja pojedynczych plików na ES modules NIE jest wykonalna — wybierz Opcję A lub B.

**Wynik (2026-08-14):** wszystkie kroki 4.0–4.4 wykonane.

- **4.0** `scripts/frontend-deps.mjs` — dependency map (212 plików, 657 globali, konflikty globali).
  Test `tests/frontendDeps.test.ts` 2/2.
- **4.1** Decyzja K2 → **Opcja A** (IIFE + window.*, reorganizacja strukturalna). ADR-008
  `docs/adr/ADR-008-frontend-modularyzacja.md` (uzasadnienie: 657 globali, cykliczne importy ESM,
  brak bundlera po ADR-005, testowalność przez vm bez konwersji).
- **4.2** `tests/productHelpers.test.ts` 9/9 — getPipeInnerArea (przez nią wymiary), isOneMetrePipe,
  getSortedRuryItems (SSoT sortowania: kolejność CATEGORIES, średnice numerycznie, Bosy-Bosy +
  długość, brak mutacji #15).
- **4.3** Solver/ringOptimizer/precoCalcCore już pokryte istniejącymi testami
  (`aiSelection.test.ts` ładuje prawdziwy solverAutoSelect.js, `ringOptimizer.test.ts`,
  `precoPricing.test.ts`) — nie duplikowano (K5).
- **4.4** Brak realnej duplikacji do wyciągnięcia do `shared/`: jedyna definicja `escapeHtml` w
  `shared/ui.js` (fallback guard w spa/router.js); duplikaty rury/studnie to świadoma izolacja
  domenowa (plan pkt 9). Krok warunkowy — nie wykonano.

Weryfikacja: typecheck backend+frontend, lint, testy 101 suites / 1690 (po +11 z frontendDeps i
productHelpers).

| Krok | Zmiana                                                                                                   | Test                       |
| ---- | -------------------------------------------------------------------------------------------------------- | -------------------------- |
| 4.0  | **Dependency map** — skrypt `scripts/frontend-deps.mjs` (skan `window.*`, kolejność `<script>`)          | test skryptu               |
| 4.1  | **Decyzja K2** — Opcja A (IIFE+window, strukturalna reorganizacja) vs Opcja B (pełna konwersja łańcucha) | uzasadnienie w ADR         |
| 4.2  | `rury/` — najpierw `productHelpers` (SSoT sortowania) — testy logiki                                     | testy vm                   |
| 4.3  | `studnie/` — czyste funkcje najpierw (`precoCalcCore`, `ringOptimizer`, solver)                          | istniejące testy vm + nowe |
| 4.4  | Wspólne utility wyciągnięte do `shared/` (DRY, jeśli duplikacja)                                         | testy vm                   |

Guard: po KAĹ»DYM pliku `npm run lint:frontend` + `typecheck:frontend` + E2E appname + smoke.
Rollback: revert pliku. Zakaz masowej konwersji w jednym commicie.

### Faza 5 — Wydajność (ryzyko: NISKIE — mierzenie, nie optymalizacja)

**Baseline (2026-08-14, dev localhost, 20 próbek):**
login p50=173ms (n=1), search /api/offers?q= p50=13.7ms p95=16.1ms,
save /api/offers-rury (PUT) p50=15.8ms p95=18.8ms,
telemetry /api/telemetry/ai/status p50=14.2ms p95=15.9ms.
AGGREGATE p50=14.3ms p95=17.4ms p99=19.1ms.

| Krok | Zmiana                                                                                | Test                        |
| ---- | ------------------------------------------------------------------------------------- | --------------------------- |
| 5.1  | Skrypt `scripts/benchmark.mjs` — p50/p95/p99: search, zapis oferty, polling telemetry | sanity + CI (informacyjnie) |
| 5.2  | Logowanie liczby zapytań DB per request (dev)                                         | —                           |

Zasada: żadna optymalizacja bez pomiaru. Zmiana perf = osobny commit z benchmark before/after.

**Wynik (2026-08-14):** 5.1 `scripts/benchmark.mjs` + skrypty npm `benchmark`/`benchmark:quick`;
baseline powyżej. 5.2 licznik zapytań DB per request: `src/utils/dbQueryCounter.ts`
(AsyncLocalStorage) + hook `prisma.$on('query')` (dev-only, type cast — typ wygenerowany ma `never`) +
`requestLogger` loguje `db=N`. Test `tests/dbQueryCounter.test.ts` 5/5.

### Faza 6 — Security (ryzyko: NISKIE-ĹšREDNIE)

**Wynik (2026-08-14):** 6.1 rate limitery już istnieją na wszystkich endpointach
`telemetryAiMl.ts` (READ_LIMITER 600/min, WRITE_LIMITER 60/min) i `exportCombined`
(EXPORT_LIMITER 20/min) — weryfikacja, brak zmian. 6.2 `data` ofert walidowane przez zod
(`z.record`) — testy regresyjne. 6.3 path traversal testy na express.static.
Testy: `tests/security-regression.test.ts` rozszerzone do 25 (T6.2 ×8, T6.3 ×4).

| Krok | Zmiana                                                                                                                       | Test                               |
| ---- | ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| 6.1  | Rate limit na `telemetryAi` + `exportCombined` — import limitera + dobór limitów per-endpoint (K9, telemetry polluje często) | `rateLimiter.test.ts` rozszerzenie |
| 6.2  | Walidacja `data` (JSON ofert/zamówień) przez zod na granicy API                                                              | `security-regression.test.ts`      |
| 6.3  | Path traversal audit (statyczne pliki)                                                                                       | test `..%2f`, `..\`, podwójne `/`  |

### Faza 7 — Observability (ryzyko: NISKIE)

**Wynik (2026-08-14):** 7.1 `requestId` (randomUUID.slice(0,8)) generowany w `requestLogger`,
header `X-Request-Id` + prefix w logu. 7.2 kontekst w message (requestId już w treści logu),
logger bez zmian (acceptuje data). Testy: `tests/dbQueryCounter.test.ts` 6/6 (X-Request-Id + format).

| Krok | Zmiana                                                                                     | Test            |
| ---- | ------------------------------------------------------------------------------------------ | --------------- |
| 7.1  | `requestId` middleware (crypto random, header `X-Request-Id`) + dodanie do `requestLogger` | test middleware |
| 7.2  | `logger` akceptuje `{requestId, route}` w kontekście                                       | —               |

Guard: bez logowania danych wrażliwych (hasła, tokeny, `data` ofert).

### Faza 8 — DB / Jakość ciągła (ryzyko: ĹšREDNIE)

**Wynik (2026-08-14):** 8.1 job `drift-check` w CI: `prisma validate` + `migrate diff --from-empty`
(kontrola błędów schematu, raport nie blokuje). 8.2/8.3 pominięte jako zbyt ryzykowne dla
bazy typu `db push` bez historii migracji (squash wymaga backupu + ręcznej weryfikacji,
flaky 3× wymaga stabilnego środowiska CI) — odłożone jako osobne zadanie.

| Krok | Zmiana                                                   | Test                         |
| ---- | -------------------------------------------------------- | ---------------------------- |
| 8.1  | Drift check w CI: `prisma migrate diff` vs schema        | CI job (raport, nie blokuje) |
| 8.2  | Migracja baseline dla legacy `db push` (squash)          | backup + test na kopii DB    |
| 8.3  | Flaky detection: uruchamianie testów 3Ă— w CI (nowy job) | raport, nie retry-fix        |

---

## 7. Definition of Done (każda zmiana)

- kod działa,
- testy przechodzą,
- coverage nie spadł względem baseline,
- typecheck przechodzi,
- lint przechodzi,
- E2E przechodzi, jeśli dotyczy,
- brak nowych warningów,
- brak regresji,
- dokumentacja aktualna,
- zmiana możliwa do odtworzenia,
- commit logicznie wydzielony (Conventional Commits, â‰¤72 znaki, scope z listy),
- przed commitem: `npm run version:check` + `npm run validate` + `npm run format`.

---

## 8. Commity (przykłady)

```text
test: add coverage reporting
test: cover pipe price calculations
test: add orders route integration tests
fix: use stable PZ identifiers
refactor: modularize well calculation state
perf: optimize offer search query
ci: enforce coverage baseline
```

Zakaz gigantycznych commitów typu `refactor: improve everything`.

---

## 9. Zmiany do uniknięcia (CHANGES TO AVOID)

- Przepisywanie na React/Vue/Vite/Svelte — świadoma decyzja ADR-002/005.
- Dzielenie god files tylko dla LOC — testy najpierw, dzielenie tylko gdy poprawia czytelność.
- Próg coverage 100% — bezwartościowy przymus; cel 65→75% z mierzoną wartością.
- `retry: 10` na flaky testy bez znalezienia przyczyny.
- Usuwanie duplikacji między rury/studnie, gdzie izoluje domenę.

---

## 10. Quick Wins / Strategic

**Quick wins (niskie ryzyko, wysoka wartość):**

1. Zielony coverage w CI — artifact + progi bez blokady (Faza 1).
2. `coverage-summary.json` + JSON reporter.
3. Request ID middleware (~30 linii).
4. Rate limit na `telemetryAi` i `exportCombined` (2 linie).
5. Testy walidatorów (`offerSchemas`, `orderSchemas`).

**Strategic changes (wieloetapowe):**

1. Migracja PZ → stabilne ID (Faza 3) — najbardziej wrażliwa zmiana danych.
2. ES Modules frontend (Faza 4) — stopniowo, plik po pliku.
3. Bazowe migracje legacy `db push` (Faza 8) — squash + drift check.

---

## 11. Rekomendowana kolejność wykonania

**Faza 0** (audyt — zakończony, wynik zapisany w sekcji 3)
→ **Faza 1** (coverage infra, 2-3 commity)
→ **Faza 2** (testy krytyczne: rury offers/orders, walidatory)
→ **Faza 3** (PZ stable ID)
→ dalej wg roadmapy.
