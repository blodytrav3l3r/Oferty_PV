# Plan: Architektura dużych zbiorów — 10 000 studni

Data: 2026-09-01
Status: **implemented — A1/B/C-1/C-3/C-2/D/E wdrożone za flagami ?virtual=1/?wellVirtual=1, B-Gate + C-4 oracle zielone, validate 2075/2078**
Branch: `main` (fazy na osobnych branchach, merge po gate)
Dotyczy: `public/js/studnie/*`, `public/css/*`, `public/studnie.html`, `src/routes/offers/*`, `src/routes/orders/*`, `prisma/schema.prisma`
Powiązane: `docs/plans/2026-08-31-excel-wirtualizacja-10k.md`, `docs/plans/a2-benchmark-10k.md`, ADR-001/002/004/005/008, `docs/UI_GUIDELINES.md`, baza błędów #15/#18/#21/#29/#33

## Cel

2933 studni już słabo, 10k niemożliwe. Przyczyna nie jest w bazie, tylko w modelu: aplikacja traktuje tysiące rekordów jak mały formularz (10k × DOM, `innerHTML` całości, `find()` w pętlach, synchroniczny solver ×10k, ciężkie API).

Cel nie jest:

> „obsłużyć 10 000 studni”

Tylko:

> **Rozmiar datasetu może rosnąć, ale koszt DOM, pojedynczej interakcji i pojedynczego renderu pozostaje ograniczony przez viewport, a nie przez N.**

Przy tym invariancie 2933 i 10k przestają być specjalnymi przypadkami.

Metryki docelowe (main thread):

| Metryka            | Cel                                                                                         |
| ------------------ | ------------------------------------------------------------------------------------------- |
| zwykła interakcja  | <16 ms                                                                                      |
| P95 interakcji     | <50 ms                                                                                      |
| virtual row render | <8–10 ms                                                                                    |
| search P95         | <100–150 ms                                                                                 |
| edit P95           | <50 ms                                                                                      |
| Ctrl+A             | O(1) range change + O(visibleRows) DOM (nie O(N))                                           |
| paste 100×20       | <100–200 ms UI                                                                              |
| frame budget       | 16.7 ms @60Hz, brak serii długich frame’ów podczas ciągłego scrolla                         |
| DOM rows           | liczba `<tr>` = O(viewport+overscan) nie O(N); ~50 tr × ~35–55 td = kilka tys. elementów OK |

Gate otwarcia 10k (doprecyzowanie — nie „bez >1s blokady”):

```text
Open 10k:
- no OOM
- first usable UI < 1 s
- no continuous blocking >50 ms after first usable UI
- P95 interaction <50 ms
- brak serii long tasks >50 ms po pierwszym paint
```

`scroll — 60 FPS / blisko` oznacza budżet `16.7 ms @60Hz` i brak powtarzalnych long frames — nie średnie FPS (`15/15/180/15` jako fail mimo średniej 60 FPS).

## Architektura docelowa

```text
                    ┌─────────────────────────┐
                    │       SQLite / API       │
                    │                         │
                    │ metadata ≠ pełne data  │
                    └────────────┬────────────┘
                                 │
                    paginated / targeted API
                                 │
                                 ▼
┌──────────────────────────────────────────────────────┐
│                    APPLICATION STATE                  │
│                                                      │
│ wells[]: Well[]  — canonical identity/storage order   │
│ wellIndexById: Map<WellId, number> — O(1) indeks     │
│                 do tych samych obiektów (nie kopia)  │
│ filteredIndexes: number[]  // logicalRow → wellIdx   │
│                 sort nigdy nie zmienia wells[]       │
│ ordersByWellId: Map<wellId, Order>                   │
│ productsById: Map<productId, Product>                │
│ selectionRange {r1,r2,c1,c2} O(1)                    │
│   r = logicalRow, c = logicalColumnId (never wellIdx)│
│ dirtySet                                             │
│                                                      │
│ Invariant: wells[idx] === wellsById.get(wells[idx].id) │
│ Sort = nowa filteredIndexes[], nie reorder wells[]   │
└───────────────────────┬──────────────────────────────┘
                        │
              derived state / selectors (cache per tick)
                        │
             ┌──────────┴──────────┐
             ▼                     ▼
      CONFIGURATOR               EXCEL
      virtual rows              virtual rows
      ~30–60 DOM                ~30–60 DOM
             │                     │
             └──────────┬──────────┘
                        ▼
                 ONE render scheduler
                   requestAnimationFrame
                        │
                        ▼
                  DOM = VIEW ONLY
```

```text
logicalRow  (selectionRange.r = logicalRow, c = logicalColumnId)
    ↓
filteredIndexes[logicalRow]
    ↓
wellIdx  (stabilny między add/delete; sort nie zmienia wells[])
    ↓
wells[wellIdx] / wellIndexById.get(id)  — ten sam obiekt
    ↓
viewport (start..end)  // ~50 <tr> × ~35–55 <td> = O(viewport+overscan)
    ↓
~40–80 rows w DOM (spacery top/bottom)  // nie ~40-80 DOM
```

`filteredIndexes` zawiera indeksy rekordów w canonical dataset; zmiana sort/filter tworzy nową projekcję indeksów, ale nie zmienia tożsamości studni. Mapowanie `logicalRow → wellIdx → well` zamrożone dla wszystkich operacji: sort, filter, paste, selection, recycling, Ctrl+A. Nigdy odwrotnie przez DOM.

**Sort freeze:** `Sort` nigdy nie reorders `wells[]`; zmienia wyłącznie `filteredIndexes[]`. `wellIdx` jest stabilnym indeksem canonical dataset między zmianami strukturalnymi `add/delete`. `wells[123]` to zawsze ta sama studnia niezależnie od sortowania. `add/delete` modyfikują `wells[]` i wymagają rekonstrukcji `filteredIndexes`.

## Nadrzędne invarianty (zamrożone)

### I1 — Visual freeze (Excel)

> **Wygląd Excela nie może się zmienić.**

- Kolory/typografia/radius/cienie/z-index wyłącznie `var(--*)` z `public/css/style.base.css:3` `:root` + `public/css/studnie.css`.
- 7 sticky kol: `left:0/32/162/240/318` + `z-index: LAYERS_EXCEL.STICKY_COLUMN` `public/js/studnie/excelTableBody.js:222` — wartości identyczne po virtual, tylko źródło zmienia się z `offsetWidth` runtime `public/js/studnie/excelTableRenderer.js:349` na deklaratywne `--col-*-left` wyliczone ze snapshotu bieżących szerokości.
- Szerokości: `28/70/32/130/78/78/65 + maxTr*4 + compCols 95px` `public/js/studnie/excelTableBody.js:183` inline `min-width` — po virtual identyczne; `table-layout:fixed` dozwolone tylko z `colgroup` ustawionym na zmierzone widths (ten sam `computed width`).
- Header 3 rzędy `thead sticky top:0/1.4rem/3.2rem` `public/js/studnie/excelTableRenderer.js:266` + `public/js/studnie/excelModal.js:275` `STICKY_THEAD` — bez zmian.
- Wiersz: `tr[data-widx]` `data-base-bg/data-hover-bg/data-active-bg` + `transition` `excelTableBody.js:157` + `stickyBg = _excelStickyCellBg(rowBg,solidBase)` `excelTableBody.js:152` — 1:1 w virtual slice.
- `tr{height:var(--excel-row-height);overflow:hidden;box-sizing:border-box}` gdzie `var(--excel-row-height)=32px` = obecna zmierzona wysokość; brak clipped text przy `zoom 125/150%`.
- Spacer `<tr class="excel-spacer-top/bottom" height:N*32>` transparent, `border:none`, `colspan=colCount` — nie wpływa na widths. Zamrożone: spacery, nie `transform:translateY`.
- **Visual gate:** prototyp spacer-table z ekstremami (długa nazwa/magazyn/rodzaj, puste, DN1000, decimale) + `npm run test:alignment` #16. Sticky: geometryczny `computed left === expected snapshot` (twardszy niż screenshot). Screenshot `375/768/1024/1440/1920` — no intentional regression; pixel diff tylko w tolerancji antialiasingu.
- **Zakaz:** `content-visibility:auto` nie jest substytutem wirtualizacji — dodatkowa warstwa, nie architektura.
- **Selection semantics:** `selectionRange {r1,r2,c1,c2}` gdzie `r = logicalRow`, `c = logicalColumnId` zawsze viewport-independent; nigdy `wellIdx` ani DOM row index. Przykład `r1:123` to `logicalRow 123`, nie `wellIdx 123` — krytyczne dla `filter→sort→selection→clear filter`.

### I2 — DOM

> **DOM zawiera wyłącznie viewport + overscan.**

Zakaz `wells.map → 10k HTML rows` w ścieżce virtual. A2 kalibracja: 10k → `~646ms sam string + ~120MB html + ~90k komórek` — GC + layout = brak 60fps.

### I3 — State

> **`wells[] + wellsById + filteredIndexes + selectionRange` jest SSoT.**

Canonical: `wells[]` to ordered storage dataset (identity order). `wellsById: Map<WellId, number>` (`wellIndexById`) to O(1) indeks do tych samych obiektów — nie druga kopia. `filteredIndexes` to indeksy do `wells[]`. Invariant `wells[idx] === wellsById.get(wells[idx].id)` i `wells[idx] === well` musi być utrzymywany przy każdym paste/undo.

**Lifecycle `wellIndexById` (zamrożone):** `initial load → build`; `add → add entry`; `delete → wells.splice() → rebuild wellIndexById + rebuild filteredIndexes` (opcja A — prosta, tombstones nie w MVP); `sort → NO rebuild`; `filter → NO rebuild`; `edit → NO rebuild`; `paste → NO rebuild`; `undo edit → NO rebuild`. Sort/filter nigdy nie wymagają rebuild indeksu.

**Stabilność `wellIdx`:** `wellIdx is stable between structural mutations. add/delete invalidate numeric wellIdx references. sort/filter/edit/paste/undo-edit do not.` Po `wells.splice(idx,1)` wszystkie indeksy `>= idx` się przesuwają — numeryczny `wellIdx` nie jest permanentnym ID; tożsamość to `well.id` + `wellIndexById`.

**Guard duplikatu ID (FAIL FAST):** `duplicate well.id → FAIL FAST`. `Map.set()` nie może po cichu nadpisać rekordu; A1 buduje mapę z guardem `if (map.has(id)) throw / warn`.

DOM nigdy nie jest źródłem: wartości, selection, clipboard, search, undo. Przepływ `model → render → DOM`, nigdy `DOM → model`. Dotyczy Delete, Ctrl+A, search, sort, fill-down, Ctrl+Enter, paste, undo/redo.

**Twardy zakaz `DOM → model` dla ścieżek virtual (MUST NOT):** `querySelectorAll()` do wyprowadzania stanu datasetu, `style.display` jako stan filtra, `DOM cell values` jako źródło clipboard, `DOM selection` jako application selection, `DOM presence` jako istnienie well. Dozwolone `querySelector` dla `focus/aria/event target/visual measurement` — zakaz dotyczy wyłącznie DOM jako źródła stanu.

```text
COPY: selection range → filteredIndexes → wells → TSV → clipboard
      (nigdy querySelectorAll('.selected') → TSV)
```

```text
filteredIndexes[logicalRow] → wellIdx → wells[wellIdx]
```

Zmiana filter/sort tworzy nową projekcję indeksów, nie zmienia tożsamości studni.

### I4 — Render

> **Jedna synchronous user transaction → maksymalnie jeden scheduled render cycle.**

```text
paste 2000 cells
       ↓
2000 mutations → ONE transaction → dirtySet
       ↓
scheduleRender()
       ↓
rAF (at most one pending rAF per synchronous transaction)
       ↓
calculate derived (stats/transport/totals cache per tick)
       ↓
render visible rows + update summary
       // render may mark dirty, but cannot recursively render synchronously
```

Zakaz kaskady `render → summary → render → validation → render` (dziś `wellUI.js:366` `renderWellsList` wołane z `updateSummary`). **Reentrancy invariant:** `at most one pending rAF per synchronous transaction`; `render may mark dirty, but cannot recursively render synchronously` — żadnego `render() → updateSummary() → render()` ani pośredniego wariantu.

**Semantyka `dirty` (od A1):** `dirty = "model may have changed"` nie `"render required"`. W A1 boolean wystarcza; później `MODEL_DIRTY / FILTER_DIRTY / LAYOUT_DIRTY / VIEW_DIRTY` to różne znaczenia — polling nie może stać się drugim schedulerem.

### I5 — Skalowanie

> **Koszt interakcji/renderu ograniczony viewportem, nie N.**

## Zamrożone decyzje (4)

| #   | Decyzja                  | Ustalenie                                                                                                                                                                                                                                                                                                                      |
| --- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | **32px invariant**       | `EXCEL_ROW_HEIGHT=32` SSoT CSS `--excel-row-height` ↔ JS, `table-layout:fixed`, spacery `rowIdx*32`, brak dynamic heights w B. Wielolinie = osobny projekt.                                                                                                                                                                    |
| 2   | **Lekka lista**          | Kontrakt listy lekki bez feature flag: `id/offer_number/wellCount/totalPrice/createdAt/updatedAt/state`. Pełne `data/history` tylko `GET /studnie/:id`. Breaking change wewnętrznego API — audyt konsumentów `loadOffersStudnie()` przed zmianą.                                                                               |
| 3   | **Worker**               | NIE od razu. `dirtySet → rAF → chunk 200 → isInputPending/requestIdleCallback → pomiar P95 → dopiero Worker`. Worker required only if measured batch processing causes `P95 interaction >50 ms` or produces repeated main-thread long tasks `>50 ms` under representative 10k workload. Invariant: żadna porcja nie freeze UI. |
| 4   | **SQLite normalization** | Odłożone. Zostaje JSON snapshot. Najpierw lekka lista + detail + indeksy + `wellCount` + virtual UI. Normalizacja warunkowa profilingiem.                                                                                                                                                                                      |

## Obecny stan — audyt

### A2 benchmark — DONE (kalibracja, `a2-benchmark-10k.md`, commit `e436710`)

| Test                          | Wynik                                                                | Wniosek                                                         |
| ----------------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------- |
| Map vs indexOf 10k            | `8.56ms → 2.48ms` +71%                                               | `wells.indexOf` `excelTableBody.js:79,748` O(n²) znika przy 5k+ |
| Snapshot polling 10k per snap | `2359µs`, 200ms→500ms = 2.5× mniej wakeupów                          | dirty watchdog wymagany                                         |
| Memo `excelColumns.js:53`     | `27.0ms → 8.6ms` +68%                                                | filtr 800 produktów → O(1)                                      |
| DOM tbody string 5k           | `323ms, ~58MB, 45k cells` → ekstrapolacja 10k ~646ms/120MB/90k cells | **virtual B obowiązkowe**                                       |

- Kalibracja bez layout/paint — real longtask/frames wyższe; `performance.memory` opcjonalne. A2 DONE — nie odtwarzać jako fazy; kolejne pomiary to B0 baseline i B-Gate validation.

### Wąskie gardła (P0 = krytyczne)

| Obszar         | Plik:linia                                              | Problem                                                                                                                                      |
| -------------- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Excel DOM      | `excelTableRenderer.js:5` + `excelTableBody.js:36`      | `container.innerHTML` N×35-55 TD, 18+ full render paths, `table-layout:auto`                                                                 |
| Excel dup scan | `excelTableBody.js:42-79`                               | `wells.forEach` + `Map(wells)` + fallback `indexOf` O(n²) per tbody                                                                          |
| Excel sticky   | `excelTableRenderer.js:349` `_excelApplyStickyColumns`  | `querySelectorAll(n*7)` + forced reflow + rAF retry                                                                                          |
| Excel polling  | `excelPolling.js:14`                                    | snapshot O(n) + `getElementById` per well mimo dirty                                                                                         |
| Excel search   | `excelHelpers.js:651`                                   | linear DOM `style.display` bez debounce                                                                                                      |
| Undo           | `excelTableManager.js:394`                              | `structuredClone(wells)` ×50 → 500k obiektów przy 10k                                                                                        |
| Configurator   | `wellUI.js:21,45,71`                                    | `refreshAllWellErrors()` + `calcWellStats` ×2 per row + `calculateWellTransportMap` + 5× `wells.map+filter` = 50k iter; `innerHTML` 10k kart |
| Pricing        | `offerPricingCalc.js:47` `actionsWellPricing.js:87,345` | `studnieProducts.find` w pętli 50k×800 = 40M porównań                                                                                        |
| Offer summary  | `offerSummaryTable.js:34`                               | sort + double `calcWellStats` + `html+=` 20MB string przy 10k                                                                                |
| Backend lista  | `studnieCrud.ts:282`                                    | `SELECT data,history` + double `JSON.parse` per wiersz, 50×5MB = 250MB transfer                                                              |
| Backend batch  | `studnieCrud.ts:403,585`                                | `for await upsert` sekwencyjnie, `getOrderedWellIdsForOffer` N+1 `JSON.parse` per order                                                      |
| Lucide         | `globals.js:166` + ~12 miejsc                           | `lucide.createIcons()` bez `{root}` scan całego dokumentu                                                                                    |

### Prototyp `excelVirtual.js` (516 linii, `?virtual=1`)

| Wymóg                     | Stan                                                                                                                                                     |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| spacery top/bottom        | OK `excelVirtual.js:167`                                                                                                                                 |
| `filteredIndexes` wellIdx | OK `54-68`                                                                                                                                               |
| rAF + OVERSCAN 10         | OK `82-100`                                                                                                                                              |
| 32px SSoT                 | brak CSS sync, nadal `table-layout:auto`                                                                                                                 |
| sticky CSS vars           | NIE — nadal woła `_excelApplyStickyColumns()` `263`                                                                                                      |
| selection range O(1)      | częściowo — `window._excelVirtualSelectionRange` `477` + fallback array 400k                                                                             |
| row recycling R11         | brak — `tbody.innerHTML` full replace                                                                                                                    |
| focus/IME R12             | brak — `activeCell` model nie istnieje                                                                                                                   |
| clipboard model-driven    | tak `382` ale mapowanie `colIdx` heurystyczne kruche — P0 do poprawy na `logicalColumnId`                                                                |
| search debounce           | NIE — `style.display` + double debounce 160ms — w virtual path zakaz `style.display`, flow `input→150ms debounce→filteredIndexes→virtual range→viewport` |

Nie gotowy do merge bez oracle.

## Fazy

### Faza A1 — quick wins, minimal diff (estimated 1d; split A1a/A1b po estimated 0.5d)

**Cel:** grunt pod B bez zmiany semantyki ani wyglądu (poza A1b niewidocznym).

1. `wells.indexOf` → `wellIndexById: Map<WellId, number>` budowana w `openExcelTableModal` `excelModal.js:118`; rebuild tylko po `add` (add entry) i `delete` (`splice → rebuild` — opcja A); `sort/filter/edit/paste/undo` → NO rebuild. Guard `typeof` jak #29.
2. Memo `excelColumns.js:53` + `_excelGetComponentsForDn` per DN — klucz `dn|magazyn|precoVersion` (R5), invalid na `well.magazyn`.
3. Dirty flag `markExcelDirty()` centralnie, polling `200→500ms` + `if(!dirty) return` (watchdog). W A1 jeden boolean (`dirty = "model may have changed"` nie `"render required"`); docelowo `MODEL_DIRTY/FILTER_DIRTY/LAYOUT_DIRTY/VIEW_DIRTY` — nie w A1.
4. Debounce search `excelHelpers.js:651` 150ms na `filteredIndexes`, nie DOM `style.display`. **Twarda reguła:** w ścieżce virtual `search/filter` nie manipuluje `style.display` ani nie skanuje DOM.
5. `table-layout:fixed` + eliminacja `_excelApplyStickyColumns:349` → CSS vars `--col-*-left` (A1b). Snapshot widths → `colgroup` → `fixed` (visual gate).
6. `--excel-row-height:32px` SSoT CSS ↔ JS `EXCEL_ROW_HEIGHT` (A1b).
7. Baseline benchmark 1k/5k/10k (JS gen + parse + layout + paint).

Split:

- **A1a:** Map + memo + dirty + debounce (nie rusza CSS)
- **A1b:** fixed layout + sticky CSS + row height (visual gate)

**Nie ruszać w A1:** undo refactor, selection refactor, virtual DOM, zmiana semantyki paste.

Pliki: `excelTableBody.js`, `excelColumns.js`, `excelPolling.js`, `excelHelpers.js`, `excelTableRenderer.js`, `excelState.js`, `studnie.css`.

### Faza A2 — DONE

Kalibracja zakończona (`e436710`, `a2-benchmark-10k.md`). Kolejne pomiary to:

- **B0 — real browser baseline:** actual Chrome 2933/10k przed B (longtask + frames + heap).
- **B-Gate — virtual performance validation:** te same metryki po B (patrz Weryfikacja).

Nie tworzyć ponownie A2.

### Kolejność gate (zamrożona)

```text
A1a → A1b → B0 baseline → R1 visual prototype → B → Semantic Oracle → B-Gate → B+ → C → D → E
```

Nie `A1 → B → potem odtwarzanie baseline` — baseline musi istnieć przed B by udowodnić że poprawa pochodzi z virtualizacji nie z A1.

### Faza B — Excel Virtual (estimated 2–3d, osobny branch, flaga `?virtual=1`)

**Warunek startu:** zielony prototyp R1 (spacer-table + ekstrema) + B0.

- Viewport: `scroll-container → table → thead(sticky)` + `tbody → top spacer + visible rows + bottom spacer`. Wysokość = `filteredIndexes.length * EXCEL_ROW_HEIGHT`. Zamrożone: spacery, nie `transform`.
- `_excelRenderTbodyVirtual(slice, offset)` — ~50 rows, rAF throttled scroll, `OVERSCAN 10`.
- Sticky 7 kol via CSS sticky SSoT widths (bez JS measure), I1 visual freeze.
- Selection range O(1) `isCellSelected(logicalRow, logicalColumnId)` dla visible slice; `filteredIndexes[logicalRow]→wellIdx→well`. Nie `Set` 400k cells, range `{r1,r2,c1,c2}` gdzie `r = logicalRow`, `c = logicalColumnId` — nigdy `wellIdx` ani DOM row index. `Ctrl+A` = O(1) `selectionRange = {0..N-1, firstCol..lastCol}` + `DOM mutation = O(visibleRows)` — zakaz `for 10k rows: add .selected`.
- **Clipboard P0:** `visibleCol → logicalColumnId` i dalej tylko `logicalColumnId`; clipboard nie zależy od układu sticky/hidden columns. Mapowanie `colIdx` heurystyczne `excelVirtual.js:325` zakazane jako źródło.
- Batch copy/paste chunk 200 + `isInputPending` progressive.
- **R11 Gate — recycling + row binding:** podczas ciągłego `scroll 0→10k→0` liczba `tr/td` nie rośnie proporcjonalnie do odwiedzonych wierszy; `initial row nodes ≈ final row nodes`; `DOM row identity != logical row identity`; every recycled `<tr>` gets fresh explicit binding `data-logical-row + data-well-idx`; event handler zawsze odczytuje aktualny binding, nie zamkniętą wartość closure.
- **R12 Gate — focus/IME:** `activeCell={row,col}` w modelu, DOM może nie istnieć; scroll usuwający `row 500` nie gubi `activeCell`; aktywna komórka w `compositionstart` nie jest niszczona przed `compositionend→commit`; restore `focus+caret+setSelectionRange` (historia #33).
- `content-visibility:auto` jako dodatkowa warstwa, nie architektura — nie substytut virtualizacji.
- `lucide.createIcons({root:tbody})` tylko dla visible.

**Dodatkowe scenariusze B (P0/P1):**

```text
10k → filter DN500 → sort → selection → clear filter → scroll → selection
```

Test integralności `filteredIndexes`, selection, virtual range, row binding, scroll height, stale cache.

```text
wheel / scrollbar drag: 0→9000→300→7000→100→9999
```

Wykrywa race, stale rAF/binding, błędne spacery/start/end, recycling closure. Zamiast `average FPS` — `frame budget 16.7ms @60Hz`, brak serii long frames.

### Semantic oracle — P0 przed merge B

```text
legacy renderer → oracle → virtual renderer
```

Dla tych samych `wells + filteredIndexes + selection` porównać `values, cell coords, selection, TSV` — nie HTML 1:1.

Przykład: `10000 wells, filter="DN500", sort=name DESC, selection rows 123..487, cols 2..17` → `identical TSV, identical logical selection, identical cell values`.

R12 rozszerzony:

```text
focus cell → type → compositionstart → scroll → compositionupdate → scroll → compositionend → commit
focus row 5000 → scroll tak że row 5000 znika → scroll back → focus/caret/value preserved
```

Pliki: `public/js/studnie/excelVirtual.js`, `public/js/studnie/excelTableBodyVirtual.js`.

### Faza B+ — patch undo (po B, osobno)

- Command `{type:'cell-edit', wellId, path, before, after}` + `{type:'batch', changes:[]}` dla paste, osobne komendy add/delete row.
- Oracle/fuzz: 100 losowych edit→undo→redo vs `structuredClone` fallback.
- Limit nie maskuje problemu — full snapshot fallback przy błędzie patcha. **Nie łączyć B z B+** — dwa niezależne ryzyka. Flaga `USE_PATCH_UNDO`.

### Faza C — Well Configurator Virtual (estimated 2d)

**Problem:** `wellUI.js:6` `renderWellsList` — `refreshAllWellErrors()` 10k + double `calcWellStats` + `html+=` 10k kart = ten sam wzorzec co Excel, tylko drugi największy.

- Virtual Well List: `wellsById:Map` + `filteredIndexes` + recycling 50–80 DOM rows (konfigurator i lista studni).
- `Map` wszędzie: `productsById`, `ordersByWellId`, `componentsById` — tworzone raz `array→Map`, O(1) lookup zamiast `products.find` 40M porównań `offerPricingCalc.js:47`.
- Derived cache per tick: `calculateWellStats()` + `calculateTransport()` + `calculateTotals()` raz per `scheduleRender()`, nie per `render/summary/transport/pricing` 5–7×.
- Jedna ścieżka `refreshAll` → `scheduleRender()` rAF batched; `updateSummary` nie woła `renderWellsList` `wellUI.js:366` (guard `_renderingWellsList` → scheduler).
- `lucide.createIcons({root:container})` tylko visible; eliminacja globalnych `createIcons()` `globals.js:166`.
- Search/filter/sort na `filteredIndexes` bez klonowania 10k obiektów.
- **C semantic oracle (P0):** `legacy configurator vs virtual configurator` dla 2933 + 10k syntetycznych × (filter, sort, edit, global params, selection, pricing, totals, validation, summary, order mapping) — nie HTML diff, tylko `well values/identity/pricing/validation/summary/order mapping`.

### Faza D — Calculation pipeline (estimated 1–2d)

```text
global change
      ↓
mark 10k wells dirty (dirtySet)
      ↓
rAF → chunk 200 → isInputPending / requestIdleCallback
      ↓
main thread dostaje wyniki → update state → render visible only
      ↓
pomiar P95 → dopiero wtedy Worker (solver deterministyczny/czysty w batchach)
```

- Solver w main thread tylko `input → UI`; ciężkie 10k× obliczenia poza critical path.
- Invariant: żadna porcja >50ms blokady. 200 nie magiczne — adaptive gdy nie wystarcza.
- **Yielding (nie `requestIdleCallback` jako kontrakt):** `rAF → bounded chunk → if budget remaining → next chunk else yield → resume` via `scheduler.postTask / setTimeout(0) / requestIdleCallback` zależnie od dostępności. `requestIdleCallback` nie jest wymaganym elementem architektury — kontrakt to yielding do event loop.
- **Worker exit criterion:** required only if measured batch processing causes `P95 interaction >50 ms` or produces repeated main-thread long tasks `>50 ms` under representative 10k workload. P95 dotyczy interakcji, nie samego chunka.

### Faza E — Backend (estimated 1d)

**Lekka lista — breaking change bez flagi:**

```text
GET /api/offers-studnie        → { id, offer_number, wellCount, totalPrice, createdAt, updatedAt, state }
GET /api/offers-studnie/:id    → pełne data + history
```

- Zmiana `studnieCrud.ts:282` `SELECT id,"offer_number","wellCount",...` bez `data,history`; projekcja w `search.ts:84` też.
- Audyt konsumentów `loadOffersStudnie()` — każdy konsument listy używający `data.wells` musi przejść na `GET :id`.
- `wellCount` i `totalPrice` jako **derived persisted metadata**: liczone przy zapisie, utrzymywane atomowo `transaction { data + wellCount + totalPrice }`, używane w `GET list → SELECT metadata`. `data.wells.length` służy do recovery/periodic validation, nie do list query.
- **Invariant:** `wellCount` i `totalPrice` nigdy nie są niezależnie edytowalne. `Persisted metadata is derived exclusively from canonical data; clients cannot authoritatively set wellCount/totalPrice.` Flow: `write(data) → calculate metadata from resulting data → transaction: data + wellCount + totalPrice`. Dotyczy PUT/POST/import/batch/legacy/migration/recovery — jeden canonical calculator.
- **Semantyka `totalPrice`:** `totalPrice = persisted snapshot metadata` — cena tej konkretnej zapisanej oferty z momentu zapisu, nie wynik aktualnego pricing engine (który mógłby stać się stale przy zmianie cennika). `wellCount = data.wells.length` jest oczywisty; `totalPrice` zależy od cennika/rabatów/parametrów — persist jako snapshot.
- Pagination/cursor dla list (już `paginationQuerySchema`); docelowo `?fields=meta` opcjonalnie.
- **Payload size is measured, not assumed.** Body limit must exceed measured worst-case serialized offer with safety margin (2933 już ~14.6 MB w audycie, nie `10k ~5MB` jako gwarancja). Chunked upload poza MVP.

**Poza MVP (warunkowo profilingiem):**

- Normalizacja `offer_wells / well_passages` — nie teraz; JSON snapshot jako transport/snapshot zostaje.
- Patch/diff history zamiast 5×15MB snapshotów — osobny etap po pomiarze heap.
- FTS na `json_extract(data,'$.wells[*].name')` — P2.

## Ryzyka i guardy

| R   | Ryzyko                                        | Ciężar | Guard                                                                                                                                                                                                                                                                             |
| --- | --------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | Sticky 7 + virtual rozwala alignment          | P0     | Fixed + CSS vars snapshot, prototyp ekstrema + `test:alignment` + geometry `left === expected` + screenshot 375/768/1024/1440/1920; no intentional regression (tolerance)                                                                                                         |
| R3  | Selection/clipboard po virtual                | P0     | Model-driven range `logicalColumnId` P0, `isCellSelected(logicalRow,logicalColumnId)`, `excelVirtualSelection.test.ts`; zakaz DOM colIdx; `visibleCol→logicalColumnId`                                                                                                            |
| R10 | Kod zakłada obecność wszystkich komórek w DOM | P0     | Audit `querySelector/querySelectorAll/style.display` — twardy zakaz DOM jako źródła stanu (MUST NOT: querySelectorAll for state, style.display as filter, DOM values as clipboard, DOM selection as selection, DOM presence as existence); dozwolone focus/aria/event/measurement |
| R11 | Recycling stale closure                       | P0     | Binding per render, nie closure; gate `scroll 0→10k→0 ×3: row count/listeners/DOM plateau, no monotonic heap growth after GC`                                                                                                                                                     |
| R12 | Focus/IME gubiony przy scroll                 | P0     | `activeCell` model + commit przed recycle + `setSelectionRange` + composition `start→scroll→update→scroll→end→commit` + row 5000 scroll away→back                                                                                                                                 |
| R4  | Dirty pomija mutację                          | WYS    | `markExcelDirty()` centralnie + 500ms watchdog `if(!dirty) return`                                                                                                                                                                                                                |
| R5  | Memo stale dane                               | WYS    | Key `dn                                                                                                                                                                                                                                                                           | magazyn | precoVersion`, invalid na change |
| R2  | Undo patch gubi dane                          | P0     | Nie w B; B+ z fuzz oracle                                                                                                                                                                                                                                                         |

## Weryfikacja

```bash
npm run typecheck
npm run typecheck:frontend
npm run lint
npm run lint:frontend
npm run format
npm run encoding:check
npm run version:check
npm run test:quick
node scripts/benchmark.mjs
node scripts/benchmark-excel-a2.mjs   # + public/benchmark-excel-a2.html (longtask/frames)
```

Manualnie:

- Open 10k: first usable <1s, no continuous >50ms after, P95 <50ms, no OOM; brak serii long tasks >50ms po first paint.
- Scroll: frame budget 16.7ms @60Hz, brak serii long frames, `15/15/180/15` jako fail mimo średniej 60 FPS; wheel chaos `0→9000→300→7000→100→9999` ×3; plateau: `scroll 0→10k→0 ×3: DOM nodes/row nodes/listeners plateau, heap no monotonic growth after GC`.
- `filter→sort→selection→clear filter→scroll→selection` integralność; `10k → filter DN500 → sort → selection → clear → scroll → selection`.
- Search P95 <100ms, edit <50ms, paste 100×20 bez freeze, Ctrl+A O(1), copy bez DOM scan.
- Undo bez utraty, focus/IME `compositionstart→scroll→compositionend` + `row 5000 scroll away→back`.
- Zoom 125/150%, sticky geometry `left === expected`, `escapeHtml` w nazwach, `filteredIndexes` poza viewport, semantic oracle TSV match (B) i configurator oracle (C).

## Kryteria zakończenia

- [ ] A1: Map, memo, dirty+500ms, debounce, fixed layout CSS vars, 32px SSoT, baseline benchmark
- [ ] A2 DONE + B0 baseline + B-Gate validation udokumentowane
- [ ] R1 prototyp spacer-table zielony (ekstrema + geometry left)
- [ ] B: virtual ~50 rows (O(viewport+overscan) tr), 10k płynnie, clipboard `logicalColumnId` P0, range O(1) logicalRow+logicalColumnId, focus/IME P0, R10/R11/R12 guarded, `?virtual=1` → oracle → integracja; no intentional visual regression (tolerance) + geometry `left===expected`, recycling gate `0→10k→0 ×3 plateau`
- [ ] B+: patch undo + fuzz oracle (osobno)
- [ ] C: configurator virtual 50-80 rows, Map, filteredIndexes, scheduleRender, single validation, calc cache + semantic oracle
- [ ] D: dirtySet chunk200 idle, Worker tylko gdy `P95>50ms or repeated long tasks >50ms` pod 10k workload
- [ ] E: light list projekcja, detail endpoint, `wellCount/totalPrice` atomowo, pagination; konsumenci `loadOffersStudnie` dostosowani; no data/history w liście; payload limit measured + margin
- [ ] `npm run validate` + `version:check` EXIT=0

## Świadomie pominięte (YAGNI)

- Paginacja Excel (psuje copy/paste/Ctrl+A/search).
- Dynamic heights w B.
- `MutationObserver` jako dirty (DOM ≠ SSoT).
- `JSON.stringify` diff dla undo.
- Backend JSON normalization i patch-history — poza MVP, warunkowo.
- IndexedDB / WebAssembly / React/Vue / server-side grid / WebSocket / dynamic heights / pagination Excel.

> `content-visibility:auto` — tylko dodatkowa warstwa, nie substytut virtualizacji.

## Powiązane plany

- `docs/plans/2026-08-31-excel-wirtualizacja-10k.md` — szczegół Excel B (pozostaje SSoT dla Excel; ten plan go rozszerza o C/D/E i visual freeze).
- `docs/plans/a2-benchmark-10k.md` — kalibracja A1/B (DONE).

## Po zakończeniu

`git mv docs/plans/2026-09-01-architektura-10k.md docs/plans/archive/` po wdrożeniu wszystkich faz i weryfikacji.
