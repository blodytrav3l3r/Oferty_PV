# Plan: Excel studni — wirtualizacja dla 10 000 studni

Data: 2026-08-31
Status: **draft** (zatwierdzony do implementacji, nie rozpoczęty)
Branch: `main`
Dotyczy: moduł `studnie` Excel (`public/js/studnie/excel*.js`, `public/css/studnie.css`, `public/studnie.html`)
Powiązane: ADR-002 (Vanilla JS SPA), ADR-008 (modularyzacja), baza błędów #15/#18/#21/#29/#33, `docs/UI_GUIDELINES.md`

## Cel

Przy 50 studniach widoczne spowolnienie, przy 200 znaczne, przy 2000 praca niemożliwa. Cel: **10 000 studni na jednej ofercie/zamówieniu działa płynnie (60 fps scroll/edit)**.

Diagnoza: nie backend, tylko **liczba żywych elementów DOM i koszt renderowania tabeli**. Dziś `excelTableRenderer.js:5` + `excelTableBody.js:36` budują `container.innerHTML` z N wierszy x 35-55 TD = 10k → 450k TD + 150k inputów + GC + layout.

Decyzja architektoniczna: **full virtual scroll jako docelowe rozwiązanie**. Paginacja odrzucona dla Excel UI (psuje copy/paste między stronami, Ctrl+A, search, numerację, fill).

## Nadrzędny invariant (zamrożony)

> **Po wirtualizacji DOM jest tylko widokiem. Jedynym źródłem prawdy (SSoT) pozostaje model: `wells` + `filteredIndexes[]` + selection range. Copy/paste, search, sort, selection, edit i undo nigdy nie czytają DOM.**
>
> Kierunek przepływu: `model → render → DOM`, nigdy `DOM → model`.
>
> ```
> COPY: selection → filteredIndexes → wells → TSV → clipboard   (nigdy querySelectorAll('.selected') → TSV)
> ```
>
> Dotyczy: Delete, Ctrl+A, search, sort, fill-down, Ctrl+Enter, paste, undo, redo.

## Zamrożone decyzje

| Obszar                   | Decyzja                                                                                                                                                            |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Target 10k**           | Full virtual scroll — jedyna skalowalna architektura                                                                                                               |
| **Paginacja**            | ❌ nie dla Excel modal                                                                                                                                             |
| **Row height**           | Stały invariant `32px` SSoT `var(--excel-row-height)` CSS ↔ JS `EXCEL_ROW_HEIGHT = 32`, `tr{height:var(--excel-row-height); overflow:hidden}`, bez dynamic heights |
| **Ctrl+A**               | Cały logical sheet, range model `{r1,r2,c1,c2}` O(1) pamięci, helper `isCellSelected(row,col)` dla visible slice                                                   |
| **Selection**            | Nie `Set` 400k cells, range O(1)                                                                                                                                   |
| **Undo**                 | Docelowo patch/command `{type, wellId, path, before, after}` + batch, nie full `structuredClone`                                                                   |
| **Polling**              | Dirty flag `markExcelDirty()` + 500 ms safety polling watchdog                                                                                                     |
| **`content-visibility`** | Progressive enhancement `contain-intrinsic-size: auto 32px`, nie zamiennik wirtualizacji                                                                           |
| **Sticky 7 kolumn**      | Deklaratywne szerokości/offsety via CSS vars, bez `offsetWidth` per render                                                                                         |
| **filteredIndexes**      | **Zamrożone: `well indexes` (nie IDs)** — `filteredIndexes[logicalRow] → wellIndex → wells[wellIndex]`, rebuild po add/delete/sort                                 |
| **Virtual technika**     | **Zamrożone: spacery top/bottom w tbody**, nie `transform:translateY`                                                                                              |
| **Kolejność**            | **A1 → A2 benchmark → B → B+**                                                                                                                                     |

## Obecny stan (audyt 2026-08-31, 22 pliki excel ~7433 linii)

- `_excelRenderTable(dn)` `excelTableRenderer.js:5` buduje THEAD (3 sticky rows) + `_excelRenderTbody()` + `container.innerHTML = html` full replace. 18+ miejsc woła full render. `table-layout:auto`, `border-collapse:separate`.
- `_excelRenderTbody` `excelTableBody.js:36`: dup scan `wells.forEach` O(totalWells), per-row `wells.indexOf(well)` O(n²) `excelTableBody.js:74,748`, per-row 30-45 TD, 15-25 inputów, overlay selects, `escapeHtml` + `_excelOverlaySelectHtml` per cell.
- `_excelBuildComponentColumns` `excelColumns.js:53` filtruje ~800 produktów bez memo, wołane per render/header/paste cell.
- Undo `excelTableManager.js:394` `structuredClone(wells)` x50 → 500k obiektów przy 10k.
- Polling `excelPolling.js:10` co 200 ms snapshot hash O(n) + `getElementById` per well.
- Sticky `_excelApplyStickyColumns:349` `querySelectorAll(th/td:nth-child(-n+7))` O(n*7) + forced reflow + rAF retry.
- Search `excelHelpers.js:651` linear DOM `style.display` bez debounce.
- Brak wirtualizacji, brak paginacji. Zlecenia mają cursor pagination + sentinel `zlecenia.js:365` — Excel nie ma nic.
- Focus restore via `setSelectionRange` (fix #33), sticky widths mierzone runtime, 50 wells <50 ms, 1k ~500 ms, 10k >5 s + OOM.

## Ocena ryzyka i minimalizacja regresji

| R          | Ryzyko                                                    | Ciężar               | Minimalizacja (warunek startu fazy)                                                                                                                                                                                                                                                                                                                                                                 |
| ---------- | --------------------------------------------------------- | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **R1**     | Sticky 7 kol + virtualizacja rozwala alignment/szerokości | KRYTYCZNE P0         | A1: `table-layout:fixed` + `--col-*` SSoT bez `offsetWidth`. Invariant: szerokości identyczne dla header/body/spacer, niezależne od wyrenderowanego slice. Prototyp spacer-table przed B + test ekstremalnych wartości (długa nazwa/magazyn/rodzaj, puste, DN 1000, decimale). Screenshot diff 375/768/1024/1440 + `test:alignment`. B nie start bez zielonego prototypu.                           |
| **R2**     | Undo patch gubi dane / nie cofa                           | KRYTYCZNE            | **Nie ruszać w A1**. B: wirtualizacja bez undo refactor. B+: patch+batch, fuzz oracle vs `structuredClone` fallback, flag `USE_PATCH_UNDO`.                                                                                                                                                                                                                                                         |
| **R3**     | Selection/clipboard traci zakres po virtual               | KRYTYCZNE P0         | Invariant model-driven: `range → filteredIndexes → wells → TSV → clipboard` (nie `querySelectorAll(td.selected)`). Mapowanie `logicalRow → filteredIndexes[logicalRow] → wellIndex → well` zamrożone. Selection `100→8500` działa gdy DOM=`8490-8540`. Dotyczy `Ctrl+C/V`, `Delete`, `Ctrl+Enter`, fill-down. A1 bez zmiany semantyki. B: `excelVirtual.js` + test `excelVirtualSelection.test.ts`. |
| **R4**     | Dirty flag pomija mutację → brak odświeżenia błędów       | WYSOKIE              | Centralne `markExcelDirty()` w każdym `onCellChange/onPaste/addWell/deleteWell` + solver `enforceOtRings` `diagramRenderer.js:79`. Safety poll 500 ms `if(!dirty) return` + snapshot tylko po dirty. Polling = watchdog, nie jedyny mechanizm. W A1 jeden boolean wystarcza; docelowo rozważyć `MODEL_DIRTY/FILTER_DIRTY/LAYOUT_DIRTY/VIEW_DIRTY` zamiast magic boolean — nie w A1.                 |
| **R5**     | Memoizacja zwraca stale dane po zmianie magazynu/cennika  | WYSOKIE              | Invariant: cache key zawiera **wszystkie wejścia determinujące wynik** `_excelGetComponentsForDn`. Start `dn                                                                                                                                                                                                                                                                                        | magazyn | precoVersion`, zweryfikować brak zależności od typu oferty/klienta/statusu — fałszywe trafienia zakazane. Invalid na `well.magazyn` change. |
| **R6**     | Benchmark na syntetycznych 10k fałszywie zielony          | WYSOKIE              | A2: `PerformanceObserver(longtask)` + dropped frames + input latency + heap trend, nie tylko `performance.now()`. `performance.memory` traktować jako **jeżeli dostępne**, nie obowiązkowy gate. Gate = udowodnić czy DOM-renderer skalowalny — **B i tak docelowe niezależnie od 500 ms**. `content-visibility:auto` na `tr` wymaga pomiaru, nie założenia 70%.                                    |
| **R7**     | Fixed 32px łamie walidację/zoom/a11y                      | ŚREDNIE              | `tr{height:var(--excel-row-height); overflow:hidden}`, `box-sizing:border-box`, test zoom 125/150%.                                                                                                                                                                                                                                                                                                 |
| **R8**     | Map `wellId→idx` desynchronizacja po sort/delete          | ŚREDNIE              | Rebuild na `add/delete/sort`, guard `typeof` jak #29.                                                                                                                                                                                                                                                                                                                                               |
| **R9**     | Paste chunk 200 nadal blokuje main thread                 | ŚREDNIE              | Baseline `200 cells → yield → 200`, progressive `if(navigator.scheduling?.isInputPending?.()) await yield` — `isInputPending` nie wymagane, enhancement. 200 nie magiczne, adaptive dopiero gdy 200 nie wystarcza.                                                                                                                                                                                  |
| **R10**    | Istniejący kod zakłada obecność wszystkich komórek w DOM  | KRYTYCZNE P0         | Audit `querySelector/querySelectorAll/getElementById/closest/matches/style.display/classList/innerHTML/textContent` w module. Problemem jest odczyt stanu logicznego z DOM — po B test zakazuje DOM jako SSoT.                                                                                                                                                                                      |
| **R11**    | Row recycling / stale closure po recyclingu               | KRYTYCZNE            | Każdy event rozwiązuje `logicalRow→model` z aktualnego bindingu, nie ze starego closure. `DOM row #3: logical 100 → 150` po scroll nie może modyfikować studni 100.                                                                                                                                                                                                                                 |
| **R12**    | Focus/IME gubiony przy scroll podczas edycji              | KRYTYCZNE P0         | `activeCell = {row,col}` to stan modelu, DOM może nie istnieć. Scroll usuwający `row 500` z viewport nie gubi `activeCell`. Aktywnie edytowana komórka (composition/input, polskie znaki/IME) nie może zostać zniszczona przed commit — virtualizer commit przed recyclowaniem. Restore `focus+caret+setSelectionRange` po materializacji (historia #33).                                           |
| **FUTURE** | Payload 10k wells ~5 MB JSON `PUT /api/offers-studnie`    | NISKIE / poza zakres | Odnotowane osobno. Excel DOM perf ≠ HTTP/JSON perf. Nie mieszać z fazami Excel.                                                                                                                                                                                                                                                                                                                     |

## Architektura docelowa (B)

```
WELLS (10k model)
   │
   ▼
FILTER/SORT → filteredIndexes[]  (well indexes, bez kopii obiektów)
   │         // filteredIndexes[logicalRow] → wellIndex → wells[wellIndex]
   ▼
VIRTUAL RANGE  start..end  (spacery top/bottom w tbody — zamrożone, nie transform)
   │
   ▼
VISIBLE ROW RENDER  (~50 rows, ~32px * N wysokość kontenera)
```

- Spacer model zachowuje semantykę `table/thead/tbody/tr`, alignment kolumn, sticky header. Nie `position:absolute` inner bez prototypu.
- Selection range osobno, undo patches osobno. Virtualizer pracuje na `filteredIndexes`, nie na DOM.
- Clipboard model-driven: `selection range → filteredIndexes → wells/model → TSV → clipboard` (i odwrotnie dla paste).
- `content-visibility:auto` jako dodatkowa warstwa, nie architektura.

## Fazy

### Faza A1 — quick wins, minimal diff (1 dzień; alternatywnie A1a/A1b po 0.5 dnia)

**Cel:** przygotować grunt pod B bez zmiany semantyki.

1. `wells.indexOf(well)` → `Map<wellId, idx>` budowana w `openExcelTableModal` `excelModal.js:118`, rebuild po `add/delete/sort`.
2. Memoizacja `excelColumns.js:53` + `_excelGetComponentsForDn` per DN (klucz zweryfikowany per R5).
3. Dirty flag `markExcelDirty()` centralnie, polling 200 ms → 500 ms + `if(!_excelDirty) return` (watchdog zostaje).
4. Debounce search `excelHelpers.js:651` 150 ms na `filteredIndexes`, nie DOM `style.display`.
5. `table-layout: fixed` + eliminacja `_excelApplyStickyColumns:349` JS measuring → CSS vars `--col-*-left` + invariant R1.
6. `--excel-row-height: 32px` SSoT CSS ↔ JS `EXCEL_ROW_HEIGHT`.
7. Baseline benchmark 1k / 5k / 10k (JS gen + parse + layout + paint).

Opcjonalny podział dla kontroli presji czasu:

- **A1a:** Map + memo + dirty + debounce
- **A1b:** fixed layout + sticky CSS + row height

**Nie ruszać w A1:** undo refactor, selection refactor, virtual DOM, zmiana semantyki paste.

Pliki: `excelTableBody.js`, `excelColumns.js`, `excelPolling.js`, `excelHelpers.js`, `excelTableRenderer.js`, `excelState.js`, `studnie.css`, `studnie.html`.

Branch: `A1` branch → tests → benchmark → merge (nie `A1 → merge → B` bez testów).

### Faza A2 — real browser benchmark (decision gate)

Mierzyć osobno (nie tylko `_excelRenderTable`), na ustalonej maszynie/przeglądarce:

| Test         | Metryka                   | Gate (DoD)                                                                                           |
| ------------ | ------------------------- | ---------------------------------------------------------------------------------------------------- |
| Open 10k     | render time + heap        | bez OOM + interakcja po renderze, np. <1 s                                                           |
| Scroll       | long tasks + frame budget | brak ciągłych frame drops, brak blokad >50 ms, median <16.67 ms, P95 kontrolowane, brak layout jumps |
| Search       | input latency             | P95 <100 ms                                                                                          |
| Paste 100×20 | completion + GC pauses    | brak blokady >50 ms                                                                                  |
| Edit cell    | latency                   | P95 <50 ms                                                                                           |
| Ctrl+A       | memory                    | O(1)                                                                                                 |
| Copy         | TSV generation            | bez DOM scan, zależnie od zakresu                                                                    |
| Undo paste   | memory + time             | —                                                                                                    |
| DOM rows     | count                     | **NIE 10k**, ~40-70                                                                                  |
| Memory trend | heap podczas scroll       | stabilna, brak ciągłego wzrostu                                                                      |

Narzędzia: `performance.now()` + `PerformanceObserver(longtask)` + rAF dropped frames + `performance.memory` **jeżeli dostępne**. Nie średnie FPS — mierzyć `15/15/180/15` jako fail mimo średniej 60 FPS.

Gate: A1+A2 mają udowodnić, czy DOM-based renderer jest skalowalny. **Nawet jeśli open = 400 ms, ale 450k TD + 150k inputów + heap + GC + search latency pozostają — B pozostaje obowiązkowe.** `content-visibility` nie jest kryterium stop.

### Faza B — wirtualizacja (2-3 dni, osobny branch)

**Warunek startu:** zielony prototyp R1 (spacer-table + ekstremalne wartości) + A2 ukończone.

- Nowe pliki: `public/js/studnie/excelVirtual.js`, `public/js/studnie/excelTableBodyVirtual.js` (osobny branch, feature flag `?virtual=1`).
- Viewport: `scroll-container` → `table` → `thead(sticky)` + `tbody` → `top spacer` + `visible rows` + `bottom spacer`. Wysokość kontenera = `filteredIndexes.length * EXCEL_ROW_HEIGHT`. **Zamrożone: spacery, nie transform.**
- `_excelRenderTbodyVirtual(slice, offset)` — tylko ~50 wierszy, rAF throttled scroll, `OVERSCAN` 10.
- Sticky 7 kol via CSS sticky z SSoT widths (bez JS measure), R1 invariant.
- Selection range O(1), `isCellSelected(row,col)` dla visible slice, focus/IME P0 (R12), copy/paste batch chunk 200 + `isInputPending` progressive, row recycling guard R11.
- `content-visibility:auto` jako dodatkowa warstwa, nie architektura.

Integracja z głównym rendererem dopiero po testach + semantic oracle.

### Semantic oracle (P0 przed merge B)

```
legacy renderer → oracle → virtual renderer
```

Dla tych samych `wells + filteredIndexes + selection` porównać `values, cell coords, selection, TSV` — nie HTML 1:1.

Przykład: `10000 wells, filter="DN 500", sort=name DESC, selection rows 123..487, cols 2..17` → legacy i virtual muszą dać `identical TSV, identical logical selection, identical cell values`.

### Faza B+ — patch undo (po B)

- Command `{type:'cell-edit', wellId, path, before, after}` + `{type:'batch', changes:[]}` dla paste, osobne komendy dla add/delete row.
- Oracle/fuzz: 100 losowych edit→undo→redo vs `structuredClone` fallback.
- Limit nie maskuje problemu — full snapshot fallback w razie błędu patcha. **Nie łączyć B z B+** — dwa niezależne źródła ryzyka.

### Świadomie pominięte (YAGNI)

- Paginacja Excel.
- Dynamic heights.
- `MutationObserver` jako główne rozwiązanie dirty (DOM ≠ SSoT po B).
- `JSON.stringify` diff (GC, typy).
- Backend payload 5 MB — osobny plan.

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
node scripts/benchmark.mjs        # + custom excel 10k benchmark (A2)
```

Manualnie: open 10k, scroll bez long tasks/frame drops, search P95 <100 ms, edit P95 <50 ms, paste 100×20 bez blokady >50 ms, Ctrl+A O(1), copy bez DOM scan, undo/redo bez utraty danych, focus/caret/IME po scroll, zoom 125/150%, sticky alignment 375/768/1024/1440, XSS `escapeHtml` w nazwach, `filteredIndexes` mapping poza viewport.

## Kryteria zakończenia

- [ ] A1: Map, memo, dirty+500ms, debounce, fixed layout, CSS widths SSoT, row height 32px SSoT, baseline benchmark (1 dzień lub A1a/A1b)
- [ ] A2: real browser metrics 10k (open/scroll/search/edit/paste/Ctrl+A/undo) + DoD gates udokumentowane
- [ ] R1 prototyp spacer-table zielony (ekstremalne wartości)
- [ ] B: virtual viewport ~50 rows, 10k płynnie, clipboard model-driven, selection range O(1), focus/IME P0, R10/R11 guarded, flag `?virtual=1` → semantic oracle → integracja
- [ ] B+: patch undo + fuzz oracle
- [ ] `npm run validate` + `version:check` EXIT=0

## Po zakończeniu

Przenieść plan do `docs/plans/archive/` (`git mv`) po wdrożeniu i weryfikacji.
