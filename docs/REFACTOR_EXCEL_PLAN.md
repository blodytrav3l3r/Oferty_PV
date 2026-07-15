# Plan podziału excelTableManager.js (5855 linii)

> **Status:** Plan gotowy do realizacji
> **Data:** 2026-07-15

---

## 1. Lista nowych plików

| Plik                       | ~linii | Odpowiedzialność                                                                                                                        |
| -------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| `excelState.js`            | 90     | 24 `let` state vars + 4 consts (`DN_TABS`, `DN_COLORS`, `KINETA_OPTIONS`, `_EXCEL_FONT`) + undo/redo stack                              |
| `excelHelpers.js`          | 500    | Hash helpers, labeli, calc (height/uszczelka), product code/price, overlay select HTML, search/filter                                   |
| `excelPolling.js`          | 120    | Polling (start/stop), snapshot builder, sync AUTO/MAN UI, debounced refresh                                                             |
| `excelColumns.js`          | 350    | `_excelGetComponentsForDn`, `_excelBuildComponentColumns` (właz, AVR, plus/minus)                                                       |
| `excelReductionColumns.js` | 300    | `_excelBuildReductionColumns` (R.AVR, R.Konus, R.Płyty, R.Kręgi, R.Osadnik)                                                             |
| `excelModal.js`            | 450    | `openExcelTableModal`, `closeExcelTableModal`, `excelSelectRow`, `_excelUpdateLeftPreview`                                              |
| `excelTabs.js`             | 350    | Tabs render + switch, `excelAddWellToTab`, `excelCreateFromEmpty`, `_excelEnsureRowCount`                                               |
| `excelAutoSelect.js`       | 100    | `_excelAutoSelectForWell`, `_excelToggleWellAutoMode`, `_excelRunAutoSelectForWell`                                                     |
| `excelTableRenderer.js`    | 500    | `_excelRenderTable` (część THEAD + logika przed TBODY)                                                                                  |
| `excelTableBody.js`        | 450    | `_excelRenderTbody` (data rows + empty row), `_excelRefreshAutoCells`, `_excelRefreshDupColors`                                         |
| `excelColumnOps.js`        | 350    | Sticky columns, resize (`_excelInitColumnResize`), column select (`_excelInitColumnSelect`, `_excelSelectCol`, `_excelDeselectAllCols`) |
| `excelSelection.js`        | 500    | Cell selection (click, drag, bulk), focus overlay, `_excelBulkSetMode`, `_excelSelectAllCells`                                          |
| `excelClipboard.js`        | 500    | Copy/paste, batch/sync paste, `_excelSetCellValue`, `_excelPasteCreateWells`                                                            |
| `excelNavigation.js`       | 450    | Cell focus/blur, Tab/Arrow nawigacja, `_excelGetNavElements`, `_excelFocusNavEl`                                                        |
| `excelChangeHandlers.js`   | 480    | Wszystkie `excelOn*Change` handlery (rzedna, przejscia, wlaz, comp, kineta, psiaBuda, reduction)                                        |
| `excelConfigManager.js`    | 250    | `_excelInsertConfigItem`, `_excelSortConfig`, `_excelMoveWlazToTop`                                                                     |
| `excelWellActions.js`      | 350    | `excelSaveAll`, `excelOpenWellParams`, `excelOnNameChange`, `excelDuplicateWell`, `excelDeleteWell`                                     |
| `excelDialogs.js`          | 400    | `excelShowAddDialog`, `excelShowPasteDialog`, `_excelParsePasteData`, `_excelImportPasteList`                                           |
| `excelKeyboard.js`         | 160    | `_excelHandleKeydown` (Ctrl+Z/Y/X/C/V/D/R/A, Delete)                                                                                    |
| `excelTableManager.js`     | ~30    | Bootstrap + window exports (`refreshExcelFromConfig`, `_excelSyncAutoManualUI`)                                                         |

---

## 2. Kolejność kroków

### Krok 1 — `excelState.js` (Ryzyko: LOW)

- **Linie**: 4-24 (state vars), 176-228 (consts), 5518-5521 (undo stack init), 3596 (paste cancel flag)
- **Przenoszone**: Wszystkie `let` + `const` na poziomie pliku
- **Test**: `node -c excelState.js`, otwarcie Excela

### Krok 2 — `excelHelpers.js` (Ryzyko: LOW→MEDIUM)

- **Linie**: 26-81, 230-284, 951-1143, 1146-1313, 1378-1406, 1410-1504, 1507-1525
- **Funkcje**: `_excelGetWellConfigHash`, `getHasReduction`, `_excelGetColumnStructureHash`, `_excelWellMatchesTab`, `_excelGetReferenceWell`, `_excelGetMaxTransitions`, `_excelCreatePrzejscie`, `_excelShortLabel`, `_excelWrapDetail`, `_excelCalcWellHeight`, `_excelCalcDennicaHeight`, `_excelSafeHeightMatch`, `_excelCalcUszczelkaCount`, `_excelCountProductInConfig`, `_excelGetResolution`, `_excelClearResCache`, `_excelGetWellProdCode`, `_excelGetWellProdPrice`, `_excelUpdateHeaderProdCodes`, `_excelGetWlazFromConfig`, `_excelAutoSetWlaz`, `_excelCellInp`, `_excelOverlaySelectHtml`, `_excelPositionOverlay`, `excelToggleFullscreen`, `_excelMarkDirty`, `_excelMarkClean`, `excelFilterWells`
- **Test**: `node -c`, sprawdzić overlay select w pustym wierszu, filter wells

### Krok 3 — `excelPolling.js` (Ryzyko: LOW)

- **Linie**: 83-173
- **Funkcje**: `_excelStartPolling`, `_excelBuildWellsSnapshot`, `_excelSyncAutoManualUI`, `_excelStopPolling`, `_excelDebouncedRefresh`
- **Test**: Otworzyć Excel, zmienić configSource w głównym panelu → AUTO/MAN w Excelu się aktualizuje

### Krok 4 — `excelColumns.js` + `excelReductionColumns.js` (Ryzyko: MEDIUM)

- **Linie**: 286-949
- **Funkcje**: `_excelGetComponentsForDn`, `_excelBuildComponentColumns`
- **REFACTOR przed splitem**: Wyodrębnić sekcję redukcji (371-949) do `_excelBuildReductionColumns` w oryginalnym pliku. Potem rozdzielić na 2 nowe.
- **Test**: Otworzyć Excel dla każdej zakładki DN, sprawdzić kolumny komponentów

### Krok 5 — `excelModal.js` (Ryzyko: HIGH)

- **Linie**: 1528-1884
- **Funkcje**: `openExcelTableModal`, `closeExcelTableModal`, `_excelUpdateLeftPreview`, `excelSelectRow`
- **Uwaga**: Rejestruje globalne event listenery (keydown, copy, paste, focusin, focusout, scroll, click), resize observer
- **Test**: Otworzyć/zamknąć Excel → overlay znika, listenery wyczyszczone, select row działa

### Krok 6 — `excelTabs.js` + `excelAutoSelect.js` (Ryzyko: MEDIUM)

- **Linie**: 1887-1979 (tabs), 3737-3858 (empty row), 1983-2078 (auto-select)
- **Funkcje tabs**: `_excelRenderTabs`, `_excelUpdateWellCount`, `excelSwitchTab`, `excelAddWellToTab`, `excelCreateFromEmpty`, `_excelEnsureRowCount`
- **Funkcje auto**: `_excelAutoSelectForWell`, `_excelToggleWellAutoMode`, `_excelRunAutoSelectForWell`
- **Test**: Dodać studnię, przełączyć zakładkę, uruchomić auto-dobór

### Krok 7 — `excelTableRenderer.js` + `excelTableBody.js` (Ryzyko: CRITICAL)

- **Linie**: 2081-2788
- **REFACTOR przed splitem**: Wyodrębnić z `_excelRenderTable` tworzenie TBODY do `_excelRenderTbody(dataRows, dn)`
- **Funkcje renderer**: `_excelRenderTable` (część THEAD + logika)
- **Funkcje body**: `_excelRenderTbody`, `_excelRefreshAutoCells`, `_excelRefreshDupColors`
- **Test**: Otworzyć Excel ze studniami wszystkich DN, sprawdzić kolumny, dane w komórkach, empty row

### Krok 8 — `excelColumnOps.js` (Ryzyko: MEDIUM)

- **Linie**: 2791-3010
- **Funkcje**: `_excelApplyStickyColumns`, `_excelInitColumnResize`, `_excelInitColumnSelect`, `_excelSelectCol`, `_excelDeselectAllCols`, `_excelToggleColClass`
- **Test**: Przeciągnąć kolumnę, Ctrl+click na kolumnę, sprawdzić sticky left

### Krok 9 — `excelSelection.js` (Ryzyko: MEDIUM)

- **Linie**: 3013-3382
- **Funkcje**: Obsługa zaznaczania komórek (click, drag, Shift+click, Ctrl+click), drag state, bulk mode, focus overlay
- **Test**: Kliknąć komórkę, Shift+click (zakres), Ctrl+click (toggle), przeciągnąć myszą

### Krok 10 — `excelClipboard.js` (Ryzyko: MEDIUM)

- **Linie**: 3386-3771 (copy/paste) + 5549-5673 (paste create wells)
- **Funkcje**: `_excelHandleCopy`, `_excelHandlePaste`, `_excelPasteBatch`, `_excelPasteSync`, `_excelSetCellValue`, `_excelMarkAsManual`, `_excelPasteCreateWells`, `_excelShowPasteProgress`, `_excelHidePasteProgress`, `_excelGetPasteColIdx`
- **Test**: Ctrl+C, Ctrl+V w Excelu, wkleić listę studni do pustego wiersza

### Krok 11 — `excelNavigation.js` (Ryzyko: MEDIUM)

- **Linie**: 3861-4179
- **Funkcje**: `excelCellFocus`, `excelCellBlur`, `_excelHandleTab`, `_excelHandleArrow`, `_excelNormalizeNavTarget`, `_excelGetNavElements`, `_excelSkipDisabled`, `_excelIsDisabledNav`, `_excelFocusNavEl`
- **Test**: Tab/Shift+Tab, strzałki góra/dół/lewo/prawo

### Krok 12 — `excelChangeHandlers.js` + `excelConfigManager.js` (Ryzyko: CRITICAL)

- **Linie**: 4182-4842 (handlery) + 4370-4595 (config manager)
- **Funkcje handlers**: `excelOnRzednaChange`, `excelRemoveTransitionColumn`, `excelAddTransitionColumn`, `_excelCleanEmptyPrzejscia`, `excelOnPrzejscieChange`, `excelOnPrzejscieTypeChange`, `excelOnWlazChange`, `_excelMarkManual`, `excelOnKinetaChange`, `excelOnPsiaBudaChange`, `excelOnReductionSelectChange`, `excelOnCompChange`
- **Funkcje config**: `_excelInsertConfigItem`, `_excelSortConfig`, `_excelMoveWlazToTop`
- **Test**: Zmienić ilość kręgów, AVR, właz, przejścia, redukcję, kinetę, psiaBuda → sprawdzić czy zmiany widać w głównym panelu

### Krok 13 — `excelWellActions.js` + `excelDialogs.js` (Ryzyko: MEDIUM)

- **Linie**: 4969-5176 (well actions) + 5179-5516 (dialogs)
- **Funkcje actions**: `excelSaveAll`, `_excelUpdateWellParam`, `excelOpenWellParams`, `excelRefreshParamsPopup`, `excelOnNameChange`, `excelDuplicateWell`, `excelDeleteWell`
- **Funkcje dialogs**: `_excelToggleAddMenu`, `excelShowAddDialog`, `_excelCreateFromDialog`, `excelShowPasteDialog`, `_excelUpdatePastePreview`, `_excelParsePasteData`, `_excelDetectColumn`, `_excelImportPasteList`
- **Test**: Otworzyć parametry, zmienić wartość, zapisać, usunąć studnię

### Krok 14 — `excelKeyboard.js` (Ryzyko: LOW)

- **Linie**: 5676-5836
- **Funkcje**: `_excelHandleKeydown` (Ctrl+Z/Y/X/C/V/D/R/A, Delete)
- **Test**: Ctrl+Z cofa, Ctrl+Y przywraca, Delete czyści komórki

### Krok 15 — Bootstrap `excelTableManager.js` (Ryzyko: MEDIUM)

- **Linie**: 1-2, 5838-5855
- **Zostaje**: window exports (`refreshExcelFromConfig`, `_excelSyncAutoManualUI`)
- **Test**: Otworzyć Excel, zapisać (Gotowe), sprawdzić czy `refreshAll` wywołany

---

## 3. Kolejność script tagów w `studnie.html`

Zastąpić istniejący `<script src="js/studnie/excelTableManager.js?v=1.6.0">` następującą sekwencją:

```html
<!-- excel: stan i stałe -->
<script src="js/studnie/excelState.js?v=1.6.0"></script>
<!-- excel: helpery (zależą od state) -->
<script src="js/studnie/excelHelpers.js?v=1.6.0"></script>
<!-- excel: polling (zależy od helperów) -->
<script src="js/studnie/excelPolling.js?v=1.6.0"></script>
<!-- excel: kolumny (zależą od helperów) -->
<script src="js/studnie/excelColumns.js?v=1.6.0"></script>
<script src="js/studnie/excelReductionColumns.js?v=1.6.0"></script>
<!-- excel: modal (zależy od helperów + columns) -->
<script src="js/studnie/excelModal.js?v=1.6.0"></script>
<!-- excel: tabs + auto-select (zależą od modalu) -->
<script src="js/studnie/excelTabs.js?v=1.6.0"></script>
<script src="js/studnie/excelAutoSelect.js?v=1.6.0"></script>
<!-- excel: renderer (zależy od columns + tabs) + body (zależy od renderer) -->
<script src="js/studnie/excelTableRenderer.js?v=1.6.0"></script>
<script src="js/studnie/excelTableBody.js?v=1.6.0"></script>
<!-- excel: column ops (zależy od renderer) -->
<script src="js/studnie/excelColumnOps.js?v=1.6.0"></script>
<!-- excel: selection (zależy od column ops) -->
<script src="js/studnie/excelSelection.js?v=1.6.0"></script>
<!-- excel: clipboard (zależy od selection) -->
<script src="js/studnie/excelClipboard.js?v=1.6.0"></script>
<!-- excel: nawigacja (zależy od modalu + selection) -->
<script src="js/studnie/excelNavigation.js?v=1.6.0"></script>
<!-- excel: handlery + config (zależą od helperów + modalu) -->
<script src="js/studnie/excelConfigManager.js?v=1.6.0"></script>
<script src="js/studnie/excelChangeHandlers.js?v=1.6.0"></script>
<!-- excel: well actions + dialogs (zależą od handlerów) -->
<script src="js/studnie/excelWellActions.js?v=1.6.0"></script>
<script src="js/studnie/excelDialogs.js?v=1.6.0"></script>
<!-- excel: keyboard shortcuts (zależy od wszystkiego) -->
<script src="js/studnie/excelKeyboard.js?v=1.6.0"></script>
<!-- excel: bootstrap / window exports (MUSI BYĆ OSTATNI) -->
<script src="js/studnie/excelTableManager.js?v=1.6.0"></script>
```

---

## 4. Analiza ryzyka

| #   | Zagrożenie                                                                    | Prawdopodobieństwo | Wpływ     | Mitrygacja                                             |
| --- | ----------------------------------------------------------------------------- | ------------------ | --------- | ------------------------------------------------------ |
| 1   | **`_excelRenderTable` błąd** — 710 linii, największa funkcja                  | Średnie            | Krytyczny | Refactor przed splitem: wyodrębnić `_excelRenderTbody` |
| 2   | **`excelOnCompChange` błąd** — 182 linie, złożona logika configu studni       | Średnie            | Krytyczny | Feature flag (zostawić starą kopię w main)             |
| 3   | **Inline onclick → undefined** — funkcje muszą być na window po podziale      | Niskie             | Wysoki    | Sprawdzić `node -c` dla wszystkich nowych plików       |
| 4   | **Event listener leak** — modal rejestruje listenery na document/window       | Niskie             | Wysoki    | Sprawdzić closeExcelTableModal czyści listenery        |
| 5   | **Cross-call między modułami** — `_excelRenderTable` woła funkcje z 5+ plików | Wysokie            | Średni    | Kolejność script tagów                                 |
| 6   | **`wells` mutacja** — wiele modułów modyfikuje wells[]                        | Wysokie            | Krytyczny | Test po każdym CRITICAL kroku                          |
| 7   | **Komórki Excela nie działają po podziale** — brak fokusu, nawigacji, edycji  | Średnie            | Krytyczny | Smoke test: kliknij + edytuj + Tab + strzałka          |
| 8   | **Copy/paste nie działa** — event capture na document                         | Niskie             | Wysoki    | Test Ctrl+C, Ctrl+V z danymi                           |
| 9   | **Otwarcie/zamknięcie Excela nie renderuje** — modal nie pokazuje tabeli      | Niskie             | Krytyczny | Test otwarcia z istniejącymi studniami                 |

---

## 5. Zasady wykonania

### Refactor przed splitem (dla dużych funkcji)

Dla `_excelBuildComponentColumns` (335-949) i `_excelRenderTable` (2081-2788):

1. Wyodrębnij podfunkcje w ORYGINALNYM pliku (commit 1)
2. Przenieś podfunkcje do NOWEGO pliku (commit 2)
3. Usuń stare definicje z oryginalnego pliku (commit 3)
4. Test: smoke test + golden master po każdym commicie

### Feature flag dla CRITICAL funkcji

- `excelOnCompChange`, `_excelRenderTable`: utrzymaj starą definicję w pliku źródłowym jako `_excelRenderTable_old`
- Po przeniesieniu: `window._excelRenderTable = _excelRenderTable_new` (redirect)
- Po testach: usuń starą

### Procedura testowa (każdy krok)

1. `node -c public/js/studnie/<nowy_plik>.js` — składnia JS
2. `npm run typecheck` — TypeScript backend (nie dotyczy plików frontendowych, ale sprawdza czy nie ma błędów w imporcie)
3. Otworzyć przeglądarkę → Excel → szybki smoke test
4. Sprawdzić konsolę (F12) — brak błędów `is not defined` lub `is not a function`
5. `npm run format` — Prettier
