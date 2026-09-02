# Plan: Płynna nawigacja strzałkami w Excelu (virtual-aware)

Data: 2026-09-02
Status: zatwierdzony 9.8/10 → build
Poprzednia analiza: rozmowa 2026-09-02 (3 korekty użytkownika)
Dotyczy: `public/js/studnie/excelVirtual.js`, `public/js/studnie/excelCellNavigation.js`, `public/js/studnie/excelModal.js` (weryfikacja)

## Wizja / Kryterium P0

Docelowy tryb `virtual=1` (default, `excelVirtual.js:26` `?virtual=0` opt-out) jako jedyna ścieżka produkcyjna 1→10000. `ArrowUp/Down` = **dokładnie 1 logiczny wiersz** na event, Sheets-like. Przy przytrzymanym klawiszu browser repeat napędza nawigację, bez własnego scheduler’a.

**Akceptacja P0:** 10k wierszy + przytrzymany ArrowDown → `logicalRow` rośnie o 1, fokus nigdy nie trafia do `body`, przejście przez granice viewport slice niewidoczne (brak przeskoku / utraty trybu).

## Invariant (kluczowy)

```
logicalRow  = position in filteredIndexes   // SSoT kolejności po filtrze/tabie
wellIdx     = identity (index w wells[])
wellId      = stabilny identyfikator
logicalColId = semantic column id (nie colIdx)
```

`filteredIndexes` z `excelState.js:279 _excelGetFilteredIndexes()` jest SSoT. Nigdy `wellIdx` jako porządek.

## Root cause

`excelCellNavigation.js:24 _excelHandleArrow` czyta DOM `tbody tr[data-widx]` jako SSoT. Przy virtual DOM = tylko viewport `~50 wierszy + spacery` (`ROW_HEIGHT 32, OVERSCAN 15, VIEWPORT 35` w `excelVirtual.js:9`). Na krawędzi viewport brak `nextRow` w DOM → fallback do pustego wiersza / `return`, fokus ginie. `scroll → rAF render` recykluje `input` z fokusem → `body`. `_excelVirtualActiveCell:24` istniał ale nie był kursorem SSoT.

## Architektura docelowa (po 3 korektach + 2 doprecyzowaniach)

### 1. Cursor-first (Korekta 1)

`_excelVirtualActiveCell = { logicalRow, logicalColId }` jest SSoT. Inicjalizacja po `click/focus/arrow` raz via `filtered.indexOf(wellIdx)` lub `data-logical-row`, potem tylko:

```
active.logicalRow = clamp(active.logicalRow + dir, 0, total-1)
```

Bez O(N) `indexOf` na każdym Arrow.

### 2. Jeden owner render/focus (Korekta 2 + doprecyzowanie 1)

Zakaz podwójnego rAF (`scrollTop` + własny rAF + scroll-handler rAF).

Kontrakt:

```
keydown Arrow → preventDefault → if composing return
  → nextRow = clamp(active.logicalRow + dir, 0, total-1)
  → active.logicalRow = nextRow
  → if row w [start,end) → focus w DOM (bez renderu)
  → else → container.scrollTop = nextRow*ROW_HEIGHT - center → _excelVirtualRenderBody() → focus
```

Tylko `renderBody` decyduje kiedy DOM gotowy i kiedy restore focus. Przytrzymany Arrow nie robi `innerHTML` gdy następny wiersz już w DOM.

### 3. Nie blokować recyklu (Korekta 3 + doprecyzowanie 2)

Virtualizer zawsze recykluje wg `scrollTop`. Nie `skip render` gdy active visible.

`_excelVirtualRenderBody()`:

```js
const hadGridFocus = activeEl && isExcelCell(activeEl) // input/select/.excel-sel-wrap w grid
const active = _excelVirtualActiveCell
tbody.innerHTML = renderSlice(...)
if (hadGridFocus && active && active.logicalRow>=start && active.logicalRow<end)
  _excelVirtualFocusCell(active)
```

`container.contains(activeElement)` zbyt szerokie — sprawdzaj czy activeElement to komórka Excela (input/select/wrap w `#excel-table-container`), nie dowolny control w containerze.

## Zmiany plików (minimal diff)

### excelVirtual.js (~35 linii)

- `isExcelCell(el)` helper + `_excelVirtualFocusCell(active)` — map `logicalColId → colIdx` via `_excelVirtualLogicalCols:22`, `tr[data-logical-row] → td[colIdx] → input/select/wrap → focus() + select()`.
- `ensureVisible(logicalRow)` — zwraca bool czy wymaga scroll+render.
- `renderBody` — save `hadGridFocus` przed `innerHTML`, restore po. Clamp `active.logicalRow` gdy `total` zmienił się po filtrze.
- Sync `activeCell` po filtrze/tab: rebuild `filtered` → clamp.

### excelCellNavigation.js (~45 linii)

- Na górze `_excelHandleArrow`: `if (_excelVirtualIsEnabled()) return _excelVirtualHandleArrow(e)`
- `_excelVirtualHandleArrow(e)` — handles ArrowUp/Down/Left/Right po logical coords, `isComposing` guard jak `excelVirtual.js:123`, `excelSelectRow(wellIdx)` dla podglądu.
- Left/Right w obrębie wiersza po `logicalColId`.
- `_excelHandleEmptyRowArrow` — przy virtual pusty wiersz tylko gdy `end===total` (`excelVirtual.js:234`).

### excelModal.js

Tylko weryfikacja `_arrowHandler:42` detach, bez zmian funkcjonalnych.

## Testy P0 (4 przypadki)

1. Granica viewport: `logicalRow=end-1 + ArrowDown → scroll/render + focus!=body`
2. 1000× ArrowDown — `activeRow` monotonicznie, `focus!=body` każdy krok
3. 200× down + 200× up → `logicalRow===start` bez driftu
4. Filtr `filtered=[2,8,15,31]` → ArrowDown `2→8→15→31` nie `2→3→4`

- `virtual=0` smoke — arrow legacy bez regresji

## Czego nie robić (ponytail YAGNI)

- Bez paginacji backend, Workerów, scheduler’a repeat, zmiany OVERSCAN (15 zostaje do pomiaru), zmian CSS.
- `OVERSCAN 15→20` tylko jeśli benchmark pokaże churn (LongTask>50ms, render/s).

## Weryfikacja

`npm run typecheck:frontend && npm run lint:frontend && npm run test:quick --runInBand` + manual `?virtual=1` 1k/10k przytrzymany ArrowDown + screenshoty sticky 7 kolumn (375/768/1024/1440) bez regresji błędu #17.

## DoD

- Brak przeskoków przy granicy slice, fokus stabilny, 1 wiersz/event, invariant `logicalRow ≠ wellIdx` udokumentowany.
- `virtual=0` bez regresji.

## Powiązane

`2026-09-02-system-niezawodny-szybki-10-10000.md` (P2), `excelVirtualOracle.test.ts`, błąd #17 (`_excelGetStickyColumnsWidth`).
