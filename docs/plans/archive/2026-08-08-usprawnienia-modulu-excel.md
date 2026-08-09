# Implementation Plan: Usprawnienia modułu Excel (wypełnianie, kolumny, duplikacja, błędy, wyszukiwarka)

> Status: ZREALIZOWANY (wdrożone w commitach 9c44d07/e1eb742 — F1–F5, skróty, sortowanie, menu kolumn).

## Overview

Cel: 5 usprawnień w tabeli konfiguracyjnej studni (modal Excel) podnoszących tempo pracy przy masowym konfigurowaniu studni. Wszystkie zmiany są frontendowe (`public/js/studnie/excel*.js`) i nie dotykają plików zastrzeżonych (offerCrud.js, offerManager.js, offerItems.js, wizard.js, router.js).

Audyt 7 subagentów (architect, build-error-resolver, code-reviewer, doc-updater, general, planner, refactor-cleaner) wskazał kluczowe fakty, konflikty i ryzyka — ujęte poniżej.

## Zakres — 5 feature'ów

### F1. Wypełnianie zaznaczenia (Ctrl+Enter)

Wartość wpisana w aktywną komórkę + **Ctrl+Enter** → ta sama wartość do wszystkich komórek w `_excelSelectedCells` (oraz `_excelSelectedCols` — całe kolumny).

**Decyzja projektowa:** drag-fill za narożnik **NIE jest realizowany** — koliduje z drag-selekcją (`_excelDragState`, excelCellSelection.js:58-160), wymaga kilkuset linii stanowego kodu i realnie zagraża `test:alignment` (zmiana box modelu komórek, bug #16). Ctrl+Enter pokrywa ~90% realnego przypadku użycia.

### F2. Trwałość szerokości kolumn (localStorage)

`_excelColWidths` (excelState.js:21, klucze `_excelActiveTab + '-' + colIdx`) zapisywane do localStorage, wzorem `_excelHiddenColumnIds` (excelState.js:99-130).

### F3. Duplikacja studni (Ctrl+D bez zaznaczenia)

Kopiuje aktywny wiersz jako nową studnię z pełnym stanem. **`excelDuplicateWell(wIdx)` już istnieje** (excelWellActions.js:184-198, przycisk w excelTableBody.js:471) — feature to skrót klawiszowy + uzupełnienie braków (undo, dirty, guard PZ, czyszczenie `__resCache`).

### F4. Podświetlenie wierszy z błędami konfiguracji

Studnie z `configStatus === 'ERROR'/'WARNING'` dostają tint wiersza w Excelu, spójny z zakładką Oferta.

### F5. Szerokość wyszukiwarki + przycisk czyszczenia

`#excel-search-input` (excelModal.js:226, `width:100px`) → szerszy input + przycisk ✕ czyszczący filtr.

## Pliki do modyfikacji

| Plik                                       | F1                       | F2                | F3                             | F4                              | F5                 |
| ------------------------------------------ | ------------------------ | ----------------- | ------------------------------ | ------------------------------- | ------------------ |
| `public/js/studnie/excelModal.js`          |                          | load              |                                | otwarcie + debounce             | HTML               |
| `public/js/studnie/excelState.js`          |                          | klucz + load/save |                                |                                 |                    |
| `public/js/studnie/excelTableManager.js`   |                          | save w `onUp`     |                                |                                 |                    |
| `public/js/studnie/excelCellNavigation.js` | gałąź Ctrl+Enter         |                   | gałąź Ctrl+D                   |                                 |                    |
| `public/js/studnie/excelCopyPaste.js`      | `_excelHandleFillDown`   |                   |                                |                                 |                    |
| `public/js/studnie/excelWellActions.js`    |                          |                   | rozbudowa `excelDuplicateWell` |                                 |                    |
| `public/js/studnie/excelTableBody.js`      |                          |                   |                                | tint + `_excelRefreshDupColors` |                    |
| `public/js/studnie/excelPolling.js`        |                          |                   |                                | snapshot + refresh              |                    |
| `public/js/studnie/excelHelpers.js`        | guard `!e.ctrlKey` (546) |                   |                                |                                 | `excelClearSearch` |

## Reguły obowiązujące przy implementacji (odnośniki do AGENTS.md)

- `data-widx` to jedyne źródło tożsamości wiersza; operacje przez `tr.children[colIdx]`, nigdy przez listy inputów/selectów (#18).
- `_excelMarkDirty()` tylko w warstwie modala, nigdy w solverze (#22).
- Każdy mutujący handler zaczyna się od `_excelSaveUndoSnapshot()`; akcje zbiorcze robią **jeden** snapshot (wzór wklejania `_excelPasteInProgress`, #29).
- Pełny re-render TYLKO dla `krag`/`krag_ot` (#21); restore fokusa przez `setSelectionRange(len,len)`, nie `select()` (#33).
- `_excelResetLayoutDependentState()` przy zmianie struktury (zakładka, kolumny).
- `escapeHtml()` przy interpolacji danych do innerHTML (#3, #24). Nazwy EN, komunikaty PL. SRP, max 3 poziomy zagnieżdżenia, bez placeholderów.

## Konflikt skrótu Ctrl+D — decyzja projektowa (zatwierdzona 2026-08-08)

- **Ctrl+D z zaznaczeniem komórek** (`_excelSelectedCells.length > 0`) → istniejący **fill-down** (bez zmian, excelCellNavigation.js:372-394).
- **Ctrl+D bez zaznaczenia komórek** (focus w dowolnym polu wiersza) → **duplikacja studni**.
- Wzajemnie wykluczające się gałęzie w `_excelHandleKeydown` — zero zmiany istniejącego zachowania. W natywnym Excelu Ctrl+D bez zaznaczenia nic nie robi, więc nie łamiemy oczekiwań.

## Etapy

### Etap 1 — F5 wyszukiwarka (niskie ryzyko)

Pliki: `excelModal.js:226`, `excelHelpers.js`.

1. Owinąć input w wrapper `position:relative`; `width:100px` → `220px`, `padding-right:1.4rem`.
2. Przycisk `✕` (`id="excel-search-clear"`, `onclick="excelClearSearch()"`, `display:none` domyślnie) — ikona tekstowa, bez Lucide.
3. W `excelFilterWells` (excelHelpers.js:619) ustawić widoczność ✕ wg wartości `q`.
4. Nowa funkcja globalna `excelClearSearch()`: `si.value = ''; excelFilterWells(''); si.focus();`.

Kryterium akceptacji: ✕ widoczny tylko przy aktywnym filtrze; klik czyści filtr, przywraca wszystkie wiersze i focus.

### Etap 2 — F2 trwałość szerokości kolumn (niskie ryzyko)

Pliki: `excelState.js`, `excelModal.js:243`, `excelTableManager.js:71-84`.

1. `const _EXCEL_COL_WIDTHS_KEY = 'witros_excel_col_widths';`
2. `_excelLoadColWidths()` / `_excelSaveColWidths()` — try/catch + walidacja typu, wzorzec `_excelLoadColumnVisibility`/`_excelSaveColumnVisibility` (excelState.js:99-130).
3. Load obok `_excelLoadColumnVisibility()` w `openExcelTableModal` (przed pierwszym `_excelRenderTable`).
4. Save na końcu `onUp` handlera resize (jedyny punkt z finalnym `newWidth`).
5. `_excelColWidths` NIE wchodzi do `_excelResetLayoutDependentState()` — to stan trwały, nie selekcja.

Kryterium akceptacji: szerokości przetrwają zamknięcie/otwarcie modala; per zakładka DN; błędny JSON → fallback `{}`.

### Etap 3 — F1 Ctrl+Enter fill (średnie ryzyko)

Pliki: `excelCellNavigation.js`, `excelCopyPaste.js`, `excelHelpers.js:546`.

1. Nowa funkcja `_excelHandleFillDown()`:
    - wartość źródłowa z `document.activeElement` (INPUT `.value` / SELECT `.value`; fallback: komórka anchor z `_excelSelectedCells`),
    - `_excelSaveUndoSnapshot()` + `_excelPasteInProgress = true` (reużycie flagi — guardy w 8 handlerach już działają, #29),
    - dla `_excelSelectedCells` (i `_excelSelectedCols`): `_excelSetCellValue(target, value)` przez `row.children[colIdx]`, pomijając `colIdx === 3` (nazwa) i wiersze ukryte filtrem (`row.style.display === 'none'`),
    - `finally { _excelPasteInProgress = false; }` (wzorzec #32),
    - commit aktywnej komórki też przez `_excelSetCellValue` (spójny, jeden snapshot).
2. Gałąź w `_excelHandleKeydown`: `isCtrl && e.key === 'Enter'` → `preventDefault()` + `_excelHandleFillDown()` (bez early-return dla INPUT — Ctrl+Enter wciska się właśnie z fokusem w inpucie).
3. **Guard `!e.ctrlKey`** w inline handlerze Enter select wrappera (excelHelpers.js:546) — dziś `Ctrl+Enter` na select-celu otwiera picker; po F1 zrobiłby oba.
4. Bez pełnego re-rendera — handlery robią re-render tylko dla `krag`/`krag_ot` (#21), reszta przez `_excelRefreshAutoCells` + `_excelDebouncedRefresh`.

Kryterium akceptacji: fill działa dla zakresów prostokątnych i nieciągłych (Ctrl+klik); nazwa (colIdx 3) nigdy nie nadpisywana; ukryte wiersze pomijane; Ctrl+Z cofa cały fill jako jedną operację; studnie zablokowane (PZ) pomijane z toastem.

### Etap 4 — F3 Ctrl+D duplikacja studni (średnie ryzyko)

Pliki: `excelWellActions.js:184-198`, `excelCellNavigation.js:372-394`.

1. Rozbudowa `excelDuplicateWell(wIdx)`:
    - `_excelSaveUndoSnapshot()` przed mutacją, `_excelMarkDirty()` (dziś brak — nie było undo/dirty),
    - guard `_excelIsWellLocked(wIdx)` → toast błędu (decyzja produktowa, spójna z resztą edycji),
    - `delete copy.__resCache;` (nie kopiować cache resolution),
    - po `splice` usunąć `_excelRowSelectStates[wIdx + 1]` (kopia nie dziedziczy zaznaczenia checkboxa — latentny bug przy splajsie),
    - reszta bez zmian (`_excelGetMaxTransitions`, render, `excelSelectRow(wIdx+1)`, toast).
2. Gałąź w bloku Ctrl+D `_excelHandleKeydown`: `if (_excelSelectedCells.length === 0) { e.preventDefault(); excelDuplicateWell(activeRowWIdx); return; }`, gdzie `activeRowWIdx` z `document.activeElement.closest('tr[data-widx]')`. Cała logika fill-down zostaje dla zaznaczenia.

Kryterium akceptacji: Ctrl+D bez selekcji duplikuje studnię z pełnym stanem; fill-down bez zmian; duplikacja zablokowanej studni blokowana; Ctrl+Z cofa duplikację; kopia nie dziedziczy checkboxa ani `__resCache`.

### Etap 5 — F4 podświetlenie błędów konfiguracji (średnie ryzyko)

Pliki: `excelTableBody.js`, `excelPolling.js`, `excelModal.js`.

1. Helper `_excelGetRowStatus(well)` → tint ERROR/WARNING (`rgba(var(--danger-rgb), 0.12)` / `rgba(var(--warn-rgb), 0.1)`, aktywny mocniejszy) — wspólny punkt prawdy dla renderu i refreshu (DRY).
2. `_excelRenderTbody` (excelTableBody.js:35-104): wpiąć status w paletę `rowBg`/`hoverBg`/`data-active-bg` z priorytetem **ERROR > WARNING > duplikat > aktywny > base**. Sticky przez istniejące `_excelStickyCellBg(rowBg, solidBase)` (linia 80).
3. `_excelRefreshDupColors` (linia 644): dodać status w tym samym priorytecie (odświeżanie bez re-rendera).
4. `refreshAllWellErrors()` przy otwarciu modala (excelModal.js, przed renderem).
5. `_excelDebouncedRefresh` (excelPolling.js:100): `recalculateWellErrors(currentWell)` tylko dla aktywnej studni + `_excelRefreshDupColors()` — status aktualny ~800ms po edycji.
6. Polling snapshot (`_excelBuildWellsSnapshot`, excelPolling.js:29-46): dodać `configStatus` do snapshotu → zmiana statusu z głównego panelu (auto-dobór) odświeża tła.
7. **Bez ikony/kolumny w TD** — tylko tło + `title` z pierwszym błędem (`escapeHtml`) — nie ruszać box modelu (ochrona `test:alignment`).
8. **Nie używać klas `.well-row-error/.well-row-warning`** z oferty (mają `background:...!important`, kolidują z inline tłem i hoverem) — tint inline.

Kryterium akceptacji: ERROR → czerwony tint (wiersz + sticky), WARNING → bursztynowy; aktywny wiersz z błędem ma mocniejszy tint statusu; aktualizacja po zmianach w tle i po edycji; zero regresji w kolorach duplikatów.

## Testowanie / weryfikacja

- **Ręczne** (scenariusze per etap w sekcjach wyżej): fill, undo, PZ, kopia, tła, filtr.
- **Jednostkowe**: nowy `tests/studnie/excelFillPlan.test.ts` (vm, wzorzec `runChangeContext` z `excelDrilledRings.test.ts`) dla czystej funkcji budowy planu fill. **Nie rozszerzać `excelDrilledRings.test.ts`** (temat niezwiązany — konwersja krag/krag_ot).
- **Playwright**: `npm run test:alignment` obowiązkowo po F1/F4 (F1/F4 nie dodają elementów do TD — tylko tło/title).

```bash
node -c public/js/studnie/excelModal.js
node -c public/js/studnie/excelState.js
node -c public/js/studnie/excelTableManager.js
node -c public/js/studnie/excelCellNavigation.js
node -c public/js/studnie/excelCopyPaste.js
node -c public/js/studnie/excelWellActions.js
node -c public/js/studnie/excelTableBody.js
node -c public/js/studnie/excelPolling.js
node -c public/js/studnie/excelHelpers.js
npm run lint:frontend
npm run typecheck:frontend
npm run test:quick
npm run test:alignment
npm run format
```

## Ryzyka i mitigacje

| Ryzyko                                            | Mitigacja                                                                    |
| ------------------------------------------------- | ---------------------------------------------------------------------------- |
| Konflikt Ctrl+D (fill-down vs duplikacja)         | Rozstrzygnięte: rozgałęzienie po `_excelSelectedCells.length`                |
| Snapshoty undo przy fill (limit 20, #29)          | Reużycie `_excelPasteInProgress` — jeden snapshot na akcję                   |
| Pełny re-render przy fill kręgów (#21/#33)        | Guard flagi + odroczony re-render; bezwarunkowy re-render tylko krag/krag_ot |
| Kolizja kolorów tła (F4)                          | Priorytet ERROR > WARNING > dup > active w jednym helperze (DRY)             |
| `!important` klas oferty vs inline tła (F4)       | Nie używać klas — tint inline                                                |
| Box model TD (F1/F4) łamie `test:alignment` (#16) | Zero nowych elementów w TD; tło + `title`                                    |
| Błędny JSON w localStorage                        | try/catch + fallback `{}` (wzorzec widoczności kolumn)                       |

## Kryteria sukcesu

- [ ] Wszystkie 5 feature'ów działa wg kryteriów per-etap
- [ ] `node -c` bez błędów dla wszystkich zmienionych plików
- [ ] `npm run lint:frontend` + `npm run typecheck:frontend` bez błędów
- [ ] `npm test` zielone (istniejące + nowe testy vm)
- [ ] `npm run test:alignment` zielone (regresja box modelu)
- [ ] `npm run format` wykonany

## Aktualizacja dokumentacji po wdrożeniu (AGENTS.md)

- Sekcja 4 "Moduł: Excel studni": skróty klawiszowe (Ctrl+Enter fill, Ctrl+D rozgałęziony), trwałość szerokości, tła błędów, przycisk czyszczenia.
- Sekcja 5 baza błędów — rozszerzenia istniejących wpisów: #18 (reguła tr.children dla fill/duplikacji), #21 (fill nie robi pełnego re-renderu po komórce), #29 (akcje zbiorcze = jeden snapshot), #31 (tła błędów aktualizują komórki sticky).
- **Nowych wpisów #34+ nie dodawać z góry** — baza opisuje realne błędy.

## Komunikaty commitów (Conventional Commits, po polsku bez diakrytyków — konwencja repo)

| Etap              | Commit                                                                                              |
| ----------------- | --------------------------------------------------------------------------------------------------- |
| Plan              | `docs(plans): plan usprawnien modulu excel (wypelnianie, kolumny, duplikacja, bledy, wyszukiwarka)` |
| F5                | `feat(studnie): szersza wyszukiwarka excela z przyciskiem czyszczenia`                              |
| F2                | `feat(studnie): trwalosc szerokosci kolumn excela w localStorage`                                   |
| F1                | `feat(studnie): wypelnianie zaznaczonego zakresu excela Ctrl+Enter`                                 |
| F3                | `feat(studnie): duplikacja studni Ctrl+D bez zaznaczenia komorek`                                   |
| F4                | `feat(studnie): podswietlenie wierszy excela z bledami konfiguracji`                                |
| Docs po wdrożeniu | `docs(agents): reguly modulu Excel po wdrozeniu usprawnien`                                         |
