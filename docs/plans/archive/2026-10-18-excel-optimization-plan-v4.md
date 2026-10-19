# Plan optymalizacji modułu Excel (Studnie) — v4

> **Status:** ZATWIERDZONY DO WYKONANIA (luki G1–G15 załatane). **NIE WYKONANY.**
> **Data:** 2026-10-18 · **Supersedes:** v3 (`2026-10-18-excel-optimization-plan-v3.md`).
> **Zakres:** `public/js/studnie/*`, save/load/draft/lock, retention `wellsExport` (frontend), harnessy, CI, a11y.
> **Cel:** każda kategoria ≥ 8/10 (kierunek) — oceny z kryteriów akceptacji i pomiarów.
> **Zasady:** pomiar przed zmianą · jedna zmiana = jeden obszar regresji · revert-on-no-win · nie ruszać bezpieczeństwa/walidacji · precedens > nowy wzorzec (`docs/PERF_BASELINE.md:3`).

## 0. Luki v3 znalezione i załatane (G11–G15) + korekta krytyczna

| ID                  | Luka w v3                                                                                                                                                                                                                                                               | Dowód                                                                                                                                      | Łatka w v4                                                                                                                                              |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **G11 (krytyczna)** | **F2.2 zakładało „regeneruj wzbogacenie wellsExport przy eksporcie (server)" — SERWER NIE MA logiki wyceny.** PDF/DOCX tylko _czytają_ `wellsExport` z bloba. `_xp/_xskip/_xd` produkuje wyłącznie frontend `pricingCalculator.js`. Nie istnieje serwis wyceny pozycji. | `pdf/context.ts:253`; `docx/studnie/index.ts:46`; brak `price:` w `src/services/*`                                                         | **F2.2 prze-scope'owane na Option A (frontend-retention)** — bez migracji DB, kontrakt serwera nietknięty. Option B (port wyceny na serwer) = **NO-GO** |
| G12                 | Brak konkretu gdzie idą bramki perf w CI                                                                                                                                                                                                                                | `excel-throttle-nightly.yml` (cron 03:00, parity+bench+golden, advisory); `ci.yml`                                                         | **F9:** rozszerzyć istniejący workflow; blokujące → `ci.yml`                                                                                            |
| G13                 | a11y „do potwierdzenia narzędzia"                                                                                                                                                                                                                                       | `@axe-core/playwright` ^4.13.0 (devDep); `npm run test:axe`; `tests/playwright/a11yAxe.spec.ts` **już pokrywa `studnie.html`/`rury.html`** | **F6.1:** rozszerzyć istniejący spec o **modal siatki Excel** (nie nowe narzędzie)                                                                      |
| G14                 | „szczegóły migracji F2.2 do doprecyzowania" — a migracja **niepotrzebna** po G11                                                                                                                                                                                        | —                                                                                                                                          | usunięte; wzorzec backfill gdyby kiedyś: `scripts/backfill-offer-counts.cjs`, `scripts/migrate-diff-check.mjs`                                          |
| G15                 | brak prod-tool + brak absolutnych estymat                                                                                                                                                                                                                               | probe zweryfikowany (dev: 15 ofert, p50=1, max=1840)                                                                                       | **F0:** wkomitować `scripts/wellcount-stats.mjs` + procedura prod; **§8** estymaty godzinowe                                                            |

**Metryka:** F2.2 z L (audyt+migracja+ekwiwalencja) → **S** (frontend-retention). Ryzyko migracji spada do zera.

## 1. Diagnoza (dowody)

Jak v3 §1 (bez zmian), plus:

- **Konsumenci `wellsExport` server-side czytają blob, nie liczą**: `pdf/context.ts:253`, `docx/studnie/index.ts:46` (fallback `wells`), `careService.ts:353`, `followUpStats.ts:146`.
- **Frontend retention `wellsExport`**: `offerSave.js:105` → `updatedOffer = {...offerDoc}` → `offersStudnie[i]` (`offerSave.js:156-159`); clone `structuredClone(wells)` (`:104`).
- Prod: brak; dev `data/app_database.sqlite` (15 ofert), backupy ~1.31 GB (ta sama linia).

## 2. Fazy

### F0 — Baseline, metryki, prod-tool (bez zmian logiki)

1. pomiar powtarzalny → 2) N=10/500/2000 realistyczne configi → 3) mediana/P95/longtask/heap → 4) **dopiero wtedy** SLO.

- Heap: **CDP `Runtime.getHeapUsage` + `HeapProfiler.collectGarbage`** (`throttleHelper.cjs:34`); `performance.memory` cross-check. Protokół: warmup + 3× GC'd sample, mediana.
- Liczniki recalc (open/switch/edit) w `?perf=1`; fixture realnych configów.
- **G8:** spawn dwóch izolowanych serwerów (:3100/:3101) dla A/B (wzorzec `perfBaseline.cjs` :3178); nie ruszać dev DB.
- **G15 prod-tool:** wkomitować `scripts/wellcount-stats.mjs` (Prisma `$queryRaw` na `offers_studnie_rel.wellCount`; P50/P75/P90/P95/P99, histogram, sanity `wellCount==JSON.wells.length`). **Procedura prod:** skopiować snapshot → `node scripts/wellcount-stats.mjs data/prod.sqlite` → zapisać do `docs/plans/`. Do uruchomienia: rozkład = HYPOTHESIS.
- **Akceptacja:** liczby 3× w `docs/PERF_BASELINE.md` + JSON; progi z danych.

### F1 — Inkrementalny recalc

- **Inwentarz (bez kodu prod):** wejścia `recalculateWellErrors` (`solverValidation.js:157-359`) + macierz źródeł błędów (solver `solverAutoSelect.js:172,233`, asortyment `diagramOtRings.js:175-176`, `validateCollisionsLive`, PEHD, rzędne) + semantyka mutacji (`:351`, filtr `:355-359`).
- fp = pełny zbiór wejść **+ wersja cennika/katalogu** (`resolveStudnieProduct`); cache `{fp, errors}` tylko dla wells bez błędów solverowych/asortymentowych.
- **G6:** triggery invalidacji: zakładka, edycja, structural, **reload/zmiana cennika** (`pendingStudnieStampId`), `backfillSolverStamps`.
- **G7:** pole cache → do `stripWellRuntimeFields` (`offerSave.js:11-18`).
- **Testy:** `recalculateWellErrors.test.ts` + równoważność + unieważnienie (rzędna/przejście/katalog) + A/B S2.
- **Akceptacja:** recalc count + longtask flat od n; zero różnic błędów; brak wzrostu payloadu; revert jeśli brak zysku.

### F2 — Pamięć i integralność danych

- **F2.0 Retencja:** zmierzyć żywe kopie wells (load/save/cache/undo).
- **F2.1 Cache solvera** (`__resCache`; `offerSave.js:9-25`).
- **F2.2 (G11, Option A) Retention `wellsExport` — FRONTEND-ONLY:**
    - Nie trzymać `wellsExport` w in-memory cache `offersStudnie` (wpis slim: `wellCount/totalPrice/pricelistVersionId/version`) i zwolnić po zapisie; **DB blob bez zmian** (serwer czyta dalej).
    - **Bez migracji, bez zmian kontraktu.** Bramka: eksport DOCX/PDF identyczny (kanonizowany) — bo server czyta zapisany blob.
    - **Option B (slim DB + port wyceny na serwer): NO-GO** (brak serwisowego silnika wyceny; duże ryzyko; tylko z osobnym GO).
- **F2.3 Luka >100 „Zamknij bez zapisu"** (`excelModal.js:601-610`).
- **F2.4 (G1) Data-safety zapisu:** guard rozmiaru payloadu przed POST + telemetria (`PAYLOAD_WARN` wzorzec `orderHelpers.js:74,242`); jawny toast zamiast cichego 500. `mountRoutes.ts:50,68` (50 mb).
- **F2.5 (G2) Draft dużych ofert:** podnieść limit / częściowy draft / jawny komunikat „draft niedostępny" + recovery z serwera (`draftStore.js:18,310`).
- **Akceptacja:** eksport kanonizowany identyczny; stare rekordy czytają się; brak cichej utraty danych; zmierzony spadek heap (frontend).

### F3 — Wątek UI i współbieżność

- **F3.1** profil → chunk-rAF vs Worker (decyzja po pomiarze).
- **F3.2 (G5)** lock/half-open/409 przy długiej edycji (`offerManager.js:88-92`, `offerSave.js:71-80`) — brak utraty danych.
- **Akceptacja:** longtask ≤ próg @2000; konflikt obsłużony bez utraty.

### F4 — Render: najpierw koszt

- Koszt: ~135 węzłów/wiersz, paint 68-wiersz slice ≈68% (`docs/plans/bench-excel-virtual-1k5k.json`).
- O2a CSS `contain`/`content-visibility` — warunkowo. O2b szablon ~135→~50 (`excelTableBody.js`) — **G9:** golden `--update` wg `excelDomGolden.cjs:9-13`.
- **Akceptacja:** zmierzony spadek; revert jeśli brak.

### F5 — Architektura (składana)

- ekstrakcja recalc = granica F1; `wellsStore` SSoT = artefakt F2; dead code (`excelTableManager.js:556` — zweryfikować). Kontrakt `let`/init = YAGNI.

### F6 — UX i a11y

- **F6.1 (G13):** rozszerzyć `tests/playwright/a11yAxe.spec.ts` o **modal siatki Excel** (`role="grid"`, `aria-rowcount/colcount`, `scope`, focus-visible, nawigacja klawiaturą); naprawy wg axe `wcag2a/wcag2aa` (bez nowego narzędzia).
- **F6.2:** progres load/save, licznik „N/M", anulowalny debounce (`excelVirtual.js:863`).

### F7 — Obserwowalność i jakość błędów

- **F7.1** heap + recalc-count w `__excelPerfReport`; wiersze `PERF_BASELINE.md`; opcjonalnie telemetria histogramu.
- **F7.2 (G4)** audyt 52 pustych `catch{}` w `public/js/studnie`: celowe vs maskujące; maskujące → log/kontrakt.

### F8 — Zależność XLSX

Źródło + SHA-256 + skrypt kontroli wersji/hash + proces update + testy bezpieczeństwa (opcjonalnie tarball `cdn.sheetjs.com`). npm tylko jeśli utrzymywane źródło ≥ 0.20.3 (publiczne `xlsx` = 0.18.5).

### F9 — Bramki w CI (G12)

- **Rozszerzyć `excel-throttle-nightly.yml`** (advisory) o pomiar heap/recalc-count + próg; **blokujące** (parity/golden/nowe testy) → `ci.yml`.
- Rollback per faza (§6).

## 3. Decyzje (Q1–Q6)

Q1 CDP heap · Q2 izolowany spawn (A/B :3100/:3101) · Q3 F2.2 **Option A** (gated F2.0; Option B NO-GO) · Q4 F5 składane · Q5 vendored+hash · Q6 brak prod → `scripts/wellcount-stats.mjs` + HYPOTHESIS.

## 4. Kolejność

`F0 → F1 → F2 (0→1→2[A]→4→5; 3 osobno) → F3 → F4 → F5 → F6 → F7 → F8 → F9`
(F2.4/F2.5 data-safety rozważyć wcześnie — utrata danych > zysk perf.)

## 5. Bramki

golden · parity 31/31 · `excelHang2000.cjs` · **`test:axe` (modal Excel)** · eksport **kanonizowany** · brak cichej utraty danych · revert-on-no-win.

## 6. Rollback per faza

F1: flaga wyłączająca cache · F2.2: przywrócenie retention w cache (blob DB nietknięty) · F2.4/5: wyłączenie guardu/draftu · F4: wyłączenie O2a/O2b.

## 7. Ryzyka

1. fp niekompletny → inwentarz F1 + triggery (G6) + test wycieku (G7).
2. ~~Kontrakt wellsExport~~ → **usunięte** (G11: Option A nie zmienia kontraktu).
3. Łączenie zmian → jeden obszar/checkpoint.
4. Brak prod → HYPOTHESIS + tool gotowy.
5. CSS/Worker bez zysku → pomiar-gate + revert.
6. Utrata danych (G1/G2) → F2.4/2.5 wcześnie.

## 8. Estymaty absolutne (INFERENCE; korekta po F0) — orientacyjne, 1 senior + agent

| Faza                                              | h     | Faza | h     |
| ------------------------------------------------- | ----- | ---- | ----- |
| F0                                                | 10–16 | F3.1 | 8–14  |
| F1                                                | 24–40 | F3.2 | 6–12  |
| F2.0                                              | 3–5   | F4   | 12–20 |
| F2.1                                              | 4–8   | F5   | 10–18 |
| F2.2 (A)                                          | 6–10  | F6   | 14–24 |
| F2.3                                              | 6–10  | F7   | 6–10  |
| F2.4                                              | 6–10  | F8   | 4–8   |
| F2.5                                              | 8–14  | F9   | 8–14  |
| **Razem ≈ 155–253 h** (bez buforu przeglądów/CI). |

## 9. Kryteria „done" (faza)

1. Pomiar przed/po (3×, P95, longtask, heap). 2. Zidentyfikowany koszt. 3. Testy równoważności/regresji zielone. 4. Bramki zielone. 5. Brak zysku → revert + wpis decyzji.
