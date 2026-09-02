# Plan: Audyt wydajności READ-ONLY — 1 → 10 000 rekordów (bez regresji wizualnej)

Data: 2026-09-02
Wersja: 1.22.2
Commit: f4c9e61 `perf(studnie): p1 batch findmany + mutation invariant 10k`
Branch: main
Status: DONE v1.1 — P0+P1 zrealizowane, P2 bundle deferred (ponytail)
Poprzedni audyt: chat 2026-09-02 (wellUI/excelVirtual/zlecenia/backend/startup)
Review: 9.2/10 → 9.7/10 po 4 korektach obowiązkowych (poniżej)
Zastępuje/rozszerza: `2026-09-02-system-niezawodny-szybki-10-10000.md` (P0/P1/P2) w części performance
Dotyczy: `public/js/studnie/*`, `public/js/spa/*`, `public/js/kartoteka/*`, `src/routes/offers/*`, `src/routes/orders/*`, `src/app.ts`, `src/prismaClient.ts`, `prisma/schema.prisma`, `public/app.html`

---

## Wizja

Ten sam kod, ta sama baza, ten sam UX od 1 do 10 000 — `I1 DOM=VIEW ONLY`, `I2 ZERO VISUAL REGRESSION`, `I3 ZERO DATA REGRESSION`. Koszt liniowy `O(N)`, nie `O(N²)`, nie `O(N) DOM nodes`. Jedna ścieżka wirtualizacji `default true` (opt-out ≤500), `Map O(1)`, patch-undo z budżetem bajtowym, light DTO, cursor pagination, composite indexes — wszystko gated pomiarem `MEASURED`, nie `ESTIMATE`. Docelowo: `FASTER + MORE RELIABLE + VISUALLY IDENTICAL`.

---

## Nadrzędne invarianty

```
I1  DOM = VIEW ONLY
    SSoT: wells[] + filteredIndexes[] + wellIndexById Map + selection {range|array}
    + logicalRow/logicalColId. Nigdy wells.indexOf na hot path; nigdy DOM query dla danych.
    Mutacja Map tylko przy add/delete/reorder/replace — nie per render (korekta v1.1).

I2  ZERO VISUAL REGRESSION
    Performance + visual regression = FAILED. Każda zmiana: BEFORE screenshot vs AFTER
    desktop 1440 + 375. Sticky 7 cols, header 3 rows, heights, widths, selection tint identyczne.
    Stałe EXCEL_ROW_HEIGHT/WELL_CARD_HEIGHT = measured, nie dla wygody algorytmu.
    Sekwencja weryfikacji: focus → ArrowDown×100 → scroll → select range → hide column → paste → undo → screenshot.

I3  ZERO DATA REGRESSION
    Copy/paste/undo/hiddenColumns/selection/keyboard = zachowane. Fixes #16-#33 nienaruszone.
    data-widx jedyne źródło tożsamości; tr.children[indexOf(td)] nie lista inputów.

I4  NO O(N²) HOT PATH — doprecyzowane v1.1
    scroll/render/keypress/search/bulk ≤ O(N log N) sort + O(N) filter + O(1) lookup.
    Nie zamieniaj O(N²) na O(N) alloc per frame — Map cached + invalidated, nie rebuilt per render.
    Ocena per frequency×N×complexity przed Map.

I5  MEMORY MUST SCALE
    10k: live ~10MB, DOM virtual bounded slice (~65 rows × ~30 cols + 2 spacery),
    undo ≤ MAX_BYTES (measured cap) + MAX_ENTRIES, loaded lists ≤1000 (cursor).
    Brak unbounded: cache TTL+invalidate, snapshot limit+bytes, DOM cap, connection queue.
    "600 nodes" usunięte — zastąpione bounded slice + measurement.

I6  CORRECTNESS OVER SPEED + BUDGETS
    Nie accept 1000ms→20ms jeśli visual/layout/undo broken.
    FRAME ≤16ms (scroll/keyboard/selection), INTERACTION ≤50ms (search), BULK no frame >50ms (RAF chunk), BACKEND p95 osobno.
    Undo: bytes budget > entry count.
```

---

## Stan obecny (potwierdzony grep/read 9a8d81a)

**DONE (mocne):**

- `wellVirtual.js:54 default true` + prefix sums + binary search + `WELL_CARD_HEIGHT 78 OVERSCAN 350 rAF` + `calibrateHeights:263`
- `excelVirtual.js:9 ROW 32 OVERSCAN 15 RAF spacers logicalRow/ColId SSoT filteredIndexes excelState.js:279` + `Map<id,idx>`
- `excelCopyPaste chunk 50 RAF + progress + _pasteInProgress guard` (prior read)
- `zlecenia cursor LIMIT+1 MAX_LOADED 1000 sentinel append delegated` `spa/zlecenia.js:19 productionSearch.ts:73`
- `kartoteka cursor 50 AbortController`
- `offers studnie light DTO SELECT id,offer_number,state,wellCount,totalPrice` `studnieCrud.ts:270`
- `FTS5 offers_search_fts fts5Sync.ts + search.ts:118 MATCH`
- `Map O(1) globals.js:42 / excelState.js:27`

**Niestabilne / P0 bloki (CONFIRMED HIGH):**

- `wellUI.js:69 innerHTML` full recreate 180k nodes @10k — crash bez virtual
- `excelTableRenderer.js:284 non-virtual` 300k TDs @10k gdy `virtual=0`
- `wellVirtual.js:353 wells.indexOf` O(N²) 100M porównań @10k = ~80ms (expected, TBD measured)
- `excelTableManager.js:535,592,664,782 structuredClone(wells) type:full` + `LIMIT 50` = 1-2GB @10k
- `ruryCrud.ts:31 findMany` bez `select` + `...rurySpread` blob = ~6MB @200 rows
- `productionSearch.ts:45 SELECT data,orderData` blob ×500 = ~15MB
- `searchUtils.ts:62 CASE WHEN GLOB` + 13× `LIKE '%q%'` = 600-900ms @10k (full scan)
- `studnieCrud.ts:289 LIMIT/OFFSET` + `ruryCrud.ts:33 skip/take` — last page 300ms
- `app.html 11 sync scripts` + `229 JS 2.7MB no bundle` + `182 requests` + `app.ts:198 3× sync fs` + `initApp 13 awaits serial` + `triple auth/me` + `connection_limit=1`

**Skala (CODE-PROVEN counts, ms ESTIMATE):**

| N   | Lista non-virt      | Excel non-virt             | Undo full 50× | Search scan | Werdykt          |
| --- | ------------------- | -------------------------- | ------------- | ----------- | ---------------- |
| 1k  | 18k nodes 150ms     | 30k TDs 150ms+800ms layout | 250MB         | 60ms        | OK / lag         |
| 5k  | 90k nodes 3s freeze | 150k TDs 3s freeze         | 500M-1.2GB    | 700ms       | virtual-only     |
| 10k | 180k nodes crash    | 300k TDs crash             | 1-2GB OOM     | 900ms       | crash/OOM bez P0 |

Z virtual + patch: 10k DOM bounded slice, <16ms ticks (expected, TBD measured).

---

## Weryfikacja audytu (matrix — pełna 21 pozycji w sekcji 3 v1.0)

- 19× CONFIRMED HIGH, 2× PARTIALLY (rury wording, paste legacy medium conf), 0 REJECTED.
- Counts CODE-PROVEN, ms ESTIMATE przed baseline — w planie oznaczone `Expected: X → Y / Actual: TBD`.

---

## Progi decyzyjne

| N          | P95 / OOM                                        | Virtual                                         | Chunk / Pagination                               |
| ---------- | ------------------------------------------------ | ----------------------------------------------- | ------------------------------------------------ |
| 10-100     | `<50ms`, debounce 150ms `wellUI.js:94` wystarczy | jedna ścieżka `default true` koszt ~0ms @1      | OFF                                              |
| 500        | `~30ms` border                                   | rekomendowany, nie krytyczny                    | CHUNK 200 zaczyna pomagać                        |
| 1000       | `61ms string + layout >100ms FAIL`               | mandatory `wellVirtual 30 slice + excelVirtual` | dirtySet CHUNK 200 + light list bez `data`       |
| 2000       | `>300ms` frame                                   | mandatory                                       | `filteredIndexes` nie `style.display`            |
| 5000-10000 | `323-646ms` string `1-2GB` undo                  | mandatory `O(viewport)` `~65 rows × ~30 cols`   | cursor `LIMIT+1` + `$transaction` + bytes budget |

---

## Roadmap — kolejność ROI, reversybilne `git revert`, gated pomiarem

### PHASE 0 — Baseline (0.5 dnia, przed każdym P0, read-only)

**Cel:** zamienić ESTIMATE → MEASURED.

**Matrix do zmierzenia (10/100/1k/5k/10k):**

| Scenario                                                                                                  | Metryka                                                                      |
| --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Lista: initial render, select, search, scroll, rapid scroll                                               | `performance.mark` + `childElementCount` + `performance.memory` + long tasks |
| Excel: initial render, scroll tick, ArrowDown hold 1s, Ctrl+A, Copy, Paste 10/100/1k/10k, Undo/Redo, heap | ms per op + `tbody.querySelectorAll('tr').length` + `usedJSHeapSize`         |
| Backend: offers studnie/rury list, production search, offers search FTS vs LIKE, write batch 50           | query ms + `EXPLAIN QUERY PLAN` + `Content-Length` + JSON parse ms           |

**Narzędzia:** `scripts/benchmark.mjs --expose-gc`, `EXPLAIN QUERY PLAN`, `PerformanceObserver longtask>50ms + rAF droppedFrames`, Lighthouse TTI, Playwright screenshot.

**DoD PHASE 0:** tabela wypełniona MEASURED, plany EXPLAIN przed/po, payload bytes before/after.

---

### P0 — katastrofalne tryby usunięte (1 dzień, 4 fixes — v1.1 "10k DOM/heap safety baseline achieved")

#### [P0-1] Gate non-virtual >500 — effectiveVirtual

- **Priority:** P0 | **Audit:** CONFIRMED HIGH | **Evidence:** `excelVirtual.js:209`, `wellVirtual.js:54`, `excelTableRenderer.js:284`, `wellUI.js:69`
- **Root cause:** fallback O(N) DOM bomb osiągalny flagą `?virtual=0`/`localStorage 0`.
- **Korekta v1.1:** `requestVirtual = flag`, `effectiveVirtual = requestVirtual || total > 500` — diagnostyka zachowana, enforcement czysty. Nie `forceEnable()` z side effects.
- **Zmiana:** `if (total > 500) return true` w obu `IsEnabled` (2 linie + komentarz `ponytail:`).
- **Alternatives:** A usuń non-virtual (HIGH risk) | **B gate >500 (LOW risk — DECISION)** | C dynamic switch (complex).
- **Files:** `public/js/studnie/excelVirtual.js:209`, `public/js/studnie/wellVirtual.js:54`
- **Perf target:** 10k DOM crash → bounded slice (~65×30 + 2 spacery), init Expected 3s→25ms / Actual TBD.
- **Visual:** screenshot 6 sticky cols + header 3 rows BEFORE/AFTER 1440/375 + seq `focus→ArrowDown×100→scroll→select→hide col→paste→undo→screenshot`.
- **Tests:** `wellVirtualGate.test.ts` (>500 forces virtual, ≤500 respects flag) + `test:alignment`.
- **Rollback:** revert 2 linie; `?virtual=0` działa ≤500.
- **DoD:** 10k slice count measured, no crash, sticky identical, `?virtual=0` respected ≤500.

#### [P0-2] Undo patch-only + bytes budget + hard gate

- **Priority:** P0 | **Audit:** CONFIRMED HIGH | **Evidence:** `excelTableManager.js:510,535,592,664,782`, `excelState.js:114`
- **Root cause:** no-args → `type:full structuredClone(wells)`; `LIMIT 50` count nie chroni bytes; `bulk-add findIndex O(K*N)`.
- **Korekta v1.1 (najważniejsza):**
    ```
    INVARIANT: N>100 → structuredClone(wells) FORBIDDEN (grep gate + runtime guard)
    BUDGET: UNDO_MAX_ENTRIES=20 (soft 50 gdy N≤1000) + UNDO_MAX_BYTES=measured cap (est 8-12MB, baseline ustala)
           Eviction FIFO po przekroczeniu KTÓREGOKOLWIEK (entries OR bytes)
    PAYLOAD: changed rows only; bulk-add/delete = IDs + minimal inverse; if patchBytes > BUDGET_PER_ENTRY (~1MB): compact {op,inverse}
    LIMIT=20 is NOT protection — bytes is.
    ```
- **Zmiana:** gate + bytes eviction + `bulk-add` `findIndex→Map<id,idx>` + `Set`.
- **Alternatives:** A no snapshot >100 (REJECTED — łamie I3) | B command+inverse (XL cost — defer) | **C patch+bytes (DECISION)**.
- **Files:** `public/js/studnie/excelTableManager.js:477,510,565,646`, `excelState.js:114`
- **Perf target:** 1-2GB → ~50MB (Expected, Actual TBD baseline), each undo Expected <16ms.
- **DoD:** `structuredClone(wells)` grep 0 gdy N>100; heap after 20 edits < MAX_BYTES measured; each undo <16ms; bulk-add undo O(N).

#### [P0-3] `wells.indexOf` → cached Map

- **Priority:** P0 | **Audit:** CONFIRMED HIGH | **Evidence:** `wellVirtual.js:353`
- **Korekta v1.1:** nie `new Map` per render — reuse `wellIndexById` SSoT (`globals.js:31`/`excelState.js:27`), invalidacja tylko add/delete/reorder/replace. I4 doprecyzowane: nie zamieniaj O(N²) na O(N) alloc per frame.
- **Zmiana:** 1 Map cached + `dirty` flag; `wellVirtual.js:348-359` read-only `idxById.get(id)`.
- **Perf target:** Expected 80ms→~0.5ms / Actual TBD.
- **DoD:** 10k render <16ms measured, no `indexOf` w profile.

#### [P0-4] Rury list DTO light (jak studnie)

- **Priority:** P0 | **Audit:** PARTIALLY HIGH | **Evidence:** `ruryCrud.ts:31,89` vs `studnieCrud.ts:270`
- **Zmiana:** `prisma.offers_rel.findMany({where:roleClause, select:{id,offer_number,state,createdAt,updatedAt}, skip,take})` bez blob; detail `GET /:id` full.
- **Korekta v1.1 DoD:** `<100KB` = performance target, nie gate. Gate:
    ```
    [ ] no data blob in list
    [ ] every field consumed by kartotekaUI present
    [ ] detail still full
    [ ] payload measured before/after
    [ ] no N+1, rendering unchanged
    ```
- **Perf target:** Expected 6MB→<100KB / Actual TBD.
- **DoD:** `GET /api/offers-rury?limit=50` no `data`, Content-Length measured.

#### [P0-5] Production search light list (pending UI audit)

- **Priority:** P0 (audit) → P1 (DTO) | **Evidence:** `productionSearch.ts:45`
- **Korekta v1.1:** decyzja pend — najpierw `zleceniaRender.js` field inventory → DTO contract → `SELECT light` (id + `json_extract(pon,status)` + `createdAt/updatedAt/userId/orderId`) vs blob. `printSingleZlecenie` defer do detail fetch.
- **DoD:** field inventory done; 500 rows Expected <500KB / Actual TBD; p95 <150ms z P1-5 index.

**P0 DoD zbiorcze:** 10k DOM bounded slice measured, no crash, no OOM, no 1GB undo, `wellVirtual` <16ms — label `10k DOM/heap safety baseline achieved — structurally safe for tested paths`.

---

### P1 — udowodniona latencja (1 dzień, po P0, MEASURED)

#### [P1-1] Normalized `createdAt` + index

- **Evidence:** `searchUtils.ts:62`, `productionSearchUtils.ts:61` `CASE GLOB` zabija index.
- **Zmiana:** generated column `normalizedCreatedAt` + `CREATE INDEX` (lub expr index SQLite 3.31+). Backfill + `EXPLAIN QUERY PLAN` **przed i po** obligatoryjnie.
- **Perf target:** Expected 600ms→50ms @10k / Actual TBD.
- **Risk:** LOW, write +1 index (~10ms per insert).

#### [P1-2] Cursor replaces OFFSET

- **Evidence:** `studnieCrud.ts:289 LIMIT/OFFSET`, `ruryCrud.ts:33 skip/take`.
- **Spec:** `ORDER BY createdAt DESC, id DESC`, cursor `{createdAt,id}` base64, `WHERE (createdAt < cAt) OR (createdAt = cAt AND id < cId)`, `nextCursor = last.{createdAt,id}`, tie-breaker `id` duplicate prev, mutation: new rows top no gap, `totalCount` cached 5s.
- **Dependency v1.1:** po P1-1/P1-5 aby EXPLAIN verify seek nie scan.
- **Perf target:** Expected last page 300ms→20ms / Actual TBD.

#### [P1-3] Batch `findUnique` → `findMany IN` + Map

- **Evidence:** `studnieCrud.ts:401 POST loop`, `:198 json scan`.
- **Zmiana:** `findMany({where:{id:{in:ids}}})` + `Map` 1 query.
- **Perf target:** Expected 50 docs 800ms→50ms.

#### [P1-4] Startup low-risk quick wins (parallel z P0)

- `app.html 11 sync → defer` (keep 5 modules) — no visual.
- `initApp 13 awaits → Promise.all` niezależnych (WAL batch, indexes, shares, FTS) — sprawdzić zależności per `Promise.all` (korekta v1.1).
- `getBrandHtml 3× sync → startup dir index` cache.
- `connection_limit=1` **NOT changed** — measure queue first (clinic.js) per SQLITE RULE.

#### [P1-5] Composite indexes

- `idx_prod_user_created (userId,createdAt,id)`, `idx_prod_user_updated`, `idx_offersstud_updated` + EXPLAIN before/after.

#### [P1-6] Excel legacy nav O(N) → O(1)

- `excelCellNavigation.js:170 querySelectorAll` → reuse `logicalRow` + `filteredIndexes` index.
- **Budget v1.1:** FRAME ≤16ms, nie `all <16ms`.

#### [P1-7] Scheduler / bulk

- `wellManager.js:29 2× renderWellsList` → `globals.js:347 scheduleRender rAF` gated `P95>50ms`.
- Paste chunked już DONE; solver bulk serial → chunked RAF + progress.

#### [P1-8] Stats double scan → single CTE

- `productionSearch.ts:107 WITH filtered AS (...) SELECT COUNT+SUM FROM filtered`.

---

### P2 — tylko po P0/P1 (deferred)

- Bundle JS esbuild 229→3 chunks (arch refactor) — nie mieszać z krytyczną 10k ścieżką.
- Dedup `auth/me` via parent `postMessage`.
- `shared/*` double parse — single parent realm.
- Iframe LRU eviction — measure 4×50MB first.
- `xlsxLoader` dynamic import, `printModal.css` lazy, `inter.css` preload.
- `searchCache` per-user TTL nie `invalidateAll`.
- Brotli + `immutable`.

---

## 10k mutation invariant (nowy correctness gate P1 — korekta v1.1 pkt 10)

```
10k wells → scroll middle → edit row → add row → delete row → filter → clear filter → sort → scroll
After every mutation:
  wells.length === expected
  filteredIndexes valid
  wellIndexById valid
  logicalRow → wellIdx → well correct
  DOM === visible slice only (count + data-logical-row contiguous)
  selection → logicalRow/logicalColId (nie DOM nodes)
  spacer heights sum === total
```

---

## ROI matrix (v1.1 — bytes > count)

| ID                      |   Impact | Cost | Risk   | ROI            |
| ----------------------- | -------: | ---- | ------ | -------------- |
| P0-1 gate               | CRITICAL | XS   | LOW    | EXCEPTIONAL    |
| P0-2 bytes budget       | CRITICAL | S    | LOW    | EXCEPTIONAL    |
| P0-3 cached Map         |     HIGH | XS   | LOW    | EXCEPTIONAL    |
| P0-4 rury DTO           | CRITICAL | S    | LOW    | EXCEPTIONAL    |
| P0-5 prod audit         |     HIGH | M    | MEDIUM | HIGH           |
| P1-1 normalized+EXPLAIN |     HIGH | M    | LOW    | HIGH           |
| P1-2 cursor             |     HIGH | M    | LOW    | HIGH           |
| P1-3 batch IN           |   MEDIUM | S    | LOW    | HIGH           |
| P1-4 defer+parallel     |   MEDIUM | S    | LOW    | HIGH           |
| P1-5 composite          |   MEDIUM | XS   | LOW    | HIGH           |
| P1-6 nav O(1)           |   MEDIUM | S    | LOW    | MEDIUM         |
| P2 bundle               |     HIGH | L    | MEDIUM | MEDIUM (defer) |

---

## Dependency graph v1.1 (korekta pkt 7)

```
Baseline (MEASURED)
 ├── P0-1  ┐
 ├── P0-2  ├─ parallel P0
 ├── P0-3  │  (shared Map P0-2↔P0-3)
 ├── P0-4  │
 ├── P0-5 audit (decision pend)
 ├── P1-4 startup quick wins (parallel, low risk)
 ├── P1-1 normalized ─┐
 ├── P1-5 composite  ─┤ parallel (oba EXPLAIN)
 └── P1-2 cursor ─────┘ after P1-1/P1-5 to verify seek
      └── P1-3 batch IN after P1-2
```

Parallel sets: `{P0-1,P0-2,P0-3,P0-4} + {P1-4,P1-5}` independent.

---

## Test strategy

### Functional

| Suite                             | Cases                                                     |
| --------------------------------- | --------------------------------------------------------- |
| `globalsMapStale.test.ts`         | Map fresh after direct assignment, dup throw              |
| `excelDrilledRings.test.ts`       | krag/krag_ot independent                                  |
| `wellVirtualGate.test.ts` (new)   | gate >500 forces virtual, ≤500 respects flag              |
| `undoBytes.test.ts` (new)         | 10k 20 edits heap < MAX_BYTES, redo inverse, bulk-add Map |
| `ruryDto.test.ts` (new)           | list no `data`, detail has `data`                         |
| `mutationInvariant.test.ts` (new) | 10k scroll→edit→add→delete→filter→sort→scroll invariants  |
| E2E `test:alignment`              | excel empty row 5 selects + sticky visual                 |

### Performance (budgets v1.1)

```
BEFORE: baseline matrix 10/100/1k/5k/10k
AFTER targets (Expected → Actual TBD):
  FRAME (scroll/keyboard/selection/virtual tick): ≤16ms
  INTERACTION (search after debounce):             ≤50ms
  BULK (paste chunk RAF):                          no frame >50ms
  BACKEND p95 search:                              <150ms (after indexes)
  Rury list 200:                                   <100KB (target, not gate)
  Prod 500:                                        <500KB
  Start TTI:                                       fiber <800ms, 3G <2.5s
Threshold: long task >50ms = fail; >200ms = P0
```

### Visual regression (v1.1 — non-static seq)

**Baseline capture BEFORE each P0:**

- Lista: 0/10/100/1000, selected, search, filter, scroll start/mid/end, rapid scroll — 1440+375
- Excel: normal, sticky 7 cols, header 3 rows, selected cell/range, focus, hidden cols, vert/horz scroll, ArrowDown hold 1s, Ctrl+A, Copy, Paste 1k, 10k — Playwright `toHaveScreenshot` 0.1% + **seq focus→ArrowDown×100→scroll→select→hide col→paste→undo→screenshot**
- Oferty/zlecenia: first load, loading, empty, populated, search, loadMore, delete, selected

**DoD per task:**

```
[ ] Desktop 1440 identical
[ ] Mobile 375 identical
[ ] No layout shift (CLS 0)
[ ] Scroll no jump/flicker
[ ] Sticky correct
[ ] Focus/selection correct
[ ] Hover/active preserved
[ ] Virtual/non-virtual identical ≤500
```

---

## Minimum 10k plan (jeśli 1 dzień)

```
P0-1 gate (0.5h) + P0-3 Map (10m) + P0-2 bytes (1h) + P0-4 rury DTO (1h) = 2.5h
→ "10k DOM/heap safety baseline achieved — structurally safe for tested paths"
```

## Recommended plan (pełny P0, ~1.5 dnia)

```
Day 1 AM: Baseline 10/1k/10k (DOM nodes, heap, bytes, EXPLAIN) — 2h
Day 1 PM: P0-1 + P0-3 (gate+Map) + visual — 1h
Day 2 AM: P0-2 bytes + P0-4 rury DTO + P0-5 field inventory — 1.5h
Day 2 PM: P1-4 quick wins + P1-5 indexes + re-measure — 1h
```

---

## Exact implementation order

```
1.  Baseline run (read-only) — 2h
2.  P0-1 gate (excelVirtual.js:209, wellVirtual.js:54) — 0.5h + visual
3.  P0-3 cached Map (wellVirtual.js:353 + globals/excelState SSoT) — 10m + visual
4.  P0-2 bytes+hard gate (excelTableManager.js, excelState.js) — 1h
5.  P0-4 rury DTO (ruryCrud.ts:22) — 1h
6.  Audit prod fields (zleceniaRender.js) then P0-5 — 0.5h + 2h
7.  P1-4 defer/parallel (app.html, app.ts) — 1h
8.  P1-1 + P1-5 indexes — EXPLAIN then DDL — 1h
9.  P1-2 cursor (studnieCrud.ts:270, ruryCrud.ts:22) — 2h
10. P1-3 batch IN — 1h
11. Re-measure baseline matrix + visual compare — 1h
```

---

## Czego nie robić (ponytail YAGNI)

- `per-key writeLock` — measure contention first
- `10k Worker`, `E pagination full chunked PUT 5MB` — add when OOM @5000 or P95>50ms @1000
- `virtual OFF <100` — jedna ścieżka `default true`
- `connection_limit 1→N` — measure queue first

---

## Powiązane (archiwum)

`2026-09-02-studnie-lista-virtual-visual-safe.md` (PAUSED → tu), `2026-09-02-optymalizacja-lookup-zamowien-studni.md` (DONE → archive), `2026-08-31-excel-wirtualizacja-10k.md` (DONE → archive), `a2-benchmark-10k.md` (harness → archive), `2026-09-01-architektura-10k.md` (progi → tu), `audyt-serwera-2026-08-29.md` P0/P1 → tu.

---

## Definition of Done (release)

```
Per task:
  [ ] Perf: before MEASURED, after < budget (frame ≤16ms / interaction ≤50ms / bulk no frame >50ms)
  [ ] Correctness: unit+integration green, mutation invariant green, no I3 regression
  [ ] Visual: BEFORE/AFTER identical (7 checks + non-static seq)
  [ ] Memory: heap < MAX_BYTES (measured, nie hardcoded 100MB target)
  [ ] Invariants I1-I6 preserved
  [ ] Rollback: 1 commit revert

Release:
  [ ] 10k matrix MEASURED: no OOM, no 300k nodes, no 1GB undo, ticks ≤16ms
  [ ] EXPLAIN shows index seeks for search+cursor (before/after)
  [ ] TTI <800ms fiber, Lighthouse 90+
  [ ] Mutation invariant green @10k
```

---

## Implementation gate

```
STATUS: PLAN READY v1.1

CODE CHANGES: 0
FILES MODIFIED: 0

NEXT ACTION: WAITING FOR USER APPROVAL

  APPROVE PLAN        → pełny P0+P1 (~1.5 dnia)
  APPROVE MINIMUM     → P0-1..P0-4 only (2.5h, catastrophically safe)
  APPROVE P0-1+P0-3    → partial (np. tylko gates)

Plan zapisany: docs/plans/2026-09-02-audyt-wydajnosci-10k-readonly-plan.md
Źródło prawdy do implementacji — 0 zmian do czasu APPROVE.
```
