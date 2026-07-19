# Plan podziału excelTableManager.js (5855 linii → 20 modułów)

> **Status:** ✅ **UKOŃCZONY** (2026-07-16)
> **Data:** 2026-07-15
> **Autor:** Principal Software Architect / Senior Refactoring Engineer

---

## Spis treści

1. [Cel i zasady](#1-cel-i-zasady)
2. [Lista nowych plików](#2-lista-nowych-plików)
3. [Mapa zależności — Call Graph](#3-mapa-zależności--call-graph)
4. [Hidden Globals — mapa stanu globalnego](#4-hidden-globals--mapa-stanu-globalnego)
5. [Golden Master — procedura](#5-golden-master--procedura)
6. [Regression Matrix](#6-regression-matrix)
7. [Kolejność kroków z mikrokrokami](#7-kolejność-kroków-z-mikrokrokami)
8. [Kolejność script tagów](#8-kolejność-script-tagów)
9. [Analiza ryzyka](#9-analiza-ryzyka)
10. [Zasady bezpieczeństwa refaktoryzacji](#10-zasady-bezpieczeństwa-refaktoryzacji)

---

## 1. Cel i zasady

### Cel nadrzędny

100% zachowanie istniejącego zachowania aplikacji (behavior preservation).

### Zasady bezwzględne

| #   | Zasada                            | Opis                                                                |
| --- | --------------------------------- | ------------------------------------------------------------------- |
| 1   | **Big Bang zabroniony**           | Każda zmiana atomiczna — jeden commit = jedna odpowiedzialność      |
| 2   | **Najpierw analiza**              | Przed zmianą grep wszystkich wywołań i zależności                   |
| 3   | **Minimalizacja diffów**          | Mniej zmian = mniejsze ryzyko                                       |
| 4   | **Nie zmieniaj nazw publicznych** | `excel*` funkcje, `onclick`, `window.*` — bez zmian                 |
| 5   | **Nie zmieniaj logiki**           | Algorytmy, warunki, operatory, kolejność — bez zmian                |
| 6   | **Nie usuwaj kodu**               | Nawet jeśli wygląda na nieużywany — może być wywoływany dynamicznie |
| 7   | **Refactor → test → move**        | Najpierw wyodrębnij w miejscu, przetestuj, dopiero przenieś         |
| 8   | **Golden Master**                 | Przed CRITICAL krokami: snapshot HTML + wells + state               |
| 9   | **Regression Matrix**             | Po każdym kroku pełna macierz 34 testów                             |
| 10  | **Zero nowych globali**           | `Object.keys(window)` przed i po — diff musi być pusty              |

### Zasada "No logic edits" — lista zakazów

- zmiana kolejności instrukcji w funkcji
- zmiana warunków if/else
- zmiana operatorów (=== na ==, && na ||)
- zmiana async/await
- zmiana return (wartość, typ, kolejność)
- zmiana throw (komunikat, typ błędu)
- optymalizacje jakiejkolwiek natury
- DRY/deduplikacja (odłożone do Stage 2)
- rename zmiennych, funkcji, parametrów
- dodawanie/usuwanie guard clauses

---

## 2. Lista nowych plików

| Plik                       | ~linii | Odpowiedzialność                                                        |
| -------------------------- | ------ | ----------------------------------------------------------------------- |
| `excelState.js` ✅         | 78     | 24 `let` state vars + 4 consts + undo/redo stack                        |
| `excelHelpers.js`          | 500    | Hash helpers, labeli, calc, overlay select HTML, search/filter          |
| `excelPolling.js`          | 120    | Polling (start/stop), snapshot, sync AUTO/MAN UI                        |
| `excelColumns.js`          | 350    | `_excelGetComponentsForDn`, `_excelBuildComponentColumns`               |
| `excelReductionColumns.js` | 300    | `_excelBuildReductionColumns`                                           |
| `excelModal.js`            | 450    | `openExcelTableModal`, `closeExcelTableModal`, `excelSelectRow`         |
| `excelTabs.js`             | 350    | Tabs, `excelAddWellToTab`, `excelCreateFromEmpty`                       |
| `excelAutoSelect.js`       | 100    | Auto-dobór dla studni                                                   |
| `excelTableRenderer.js`    | 500    | `_excelRenderTable` (THEAD + logika)                                    |
| `excelTableBody.js`        | 450    | `_excelRenderTbody`, `_excelRefreshAutoCells`, `_excelRefreshDupColors` |
| `excelColumnOps.js`        | 350    | Sticky, resize, column select                                           |
| `excelSelection.js`        | 500    | Cell selection, drag, bulk, focus overlay                               |
| `excelClipboard.js`        | 500    | Copy/paste, batch paste, `_excelPasteCreateWells`                       |
| `excelNavigation.js`       | 450    | Tab/Arrow nawigacja, focus management                                   |
| `excelChangeHandlers.js`   | 480    | Wszystkie `excelOn*Change` handlery                                     |
| `excelConfigManager.js`    | 250    | `_excelInsertConfigItem`, `_excelSortConfig`                            |
| `excelWellActions.js`      | 350    | `excelSaveAll`, `excelOpenWellParams`, CRUD studni                      |
| `excelDialogs.js`          | 400    | Dialogi dodawania, paste listy, parametry                               |
| `excelKeyboard.js`         | 160    | `_excelHandleKeydown`                                                   |
| `excelTableManager.js`     | ~30    | Bootstrap + window exports                                              |

---

## 3. Mapa zależności — Call Graph

### 3.1 Główne drzewa wywołań

```
openExcelTableModal (1528)
├── _excelCleanEmptyPrzejscia (dla każdej studni)
├── _excelGetMaxTransitions
├── _excelRenderTabs
├── _excelRenderTable
│   ├── _excelCleanEmptyPrzejscia (dla każdej studni)
│   ├── _excelBuildComponentColumns (dla każdej studni)
│   │   ├── _excelGetComponentsForDn
│   │   ├── _excelShortLabel
│   │   ├── _excelBuildReductionColumns
│   │   │   ├── _excelGetComponentsForDn
│   │   │   ├── _excelGetWellProdCode
│   │   │   ├── _excelGetWellProdPrice
│   │   │   └── _excelCountProductInConfig
│   │   ├── _excelGetWellProdCode
│   │   ├── _excelGetWellProdPrice
│   │   └── _excelCountProductInConfig
│   ├── _excelRenderTbody
│   │   ├── _excelOverlaySelectHtml (dla każdej komórki)
│   │   ├── _excelCellInp
│   │   ├── _excelGetWellProdCode (dla każdego config item)
│   │   ├── _excelGetWellProdPrice
│   │   ├── _excelCalcWellHeight
│   │   ├── _excelCalcDennicaHeight
│   │   ├── _excelCalcUszczelkaCount
│   │   └── _excelGetResolution
│   ├── _excelRefreshAutoCells
│   ├── _excelRefreshDupColors
│   ├── _excelUpdateHeaderProdCodes
│   ├── _excelApplyStickyColumns
│   ├── _excelInitColumnResize
│   ├── _excelInitColumnSelect
│   └── lucide.createIcons
│
├── _excelStartPolling
│   ├── _excelBuildWellsSnapshot
│   └── _excelSyncAutoManualUI
│
├── addEventListener (keydown)      → _excelHandleKeydown
├── addEventListener (copy)         → _excelHandleCopy
├── addEventListener (paste)        → _excelHandlePaste
├── addEventListener (focusin)      → _excelOnFocusIn
├── addEventListener (focusout)     → _excelOnFocusOut
├── addEventListener (scroll)       → _excelOnOverlayScroll
└── addEventListener (click)        → _excelOnMouseDown → _excelOnMouseMove → _excelOnMouseUp

closeExcelTableModal (1844)
├── _excelStopPolling
├── removeEventListener (keydown)
├── removeEventListener (copy)
├── removeEventListener (paste)
├── removeEventListener (focusin)
├── removeEventListener (focusout)
├── removeEventListener (scroll)
├── removeEventListener (click)
└── disconnect (ResizeObserver)

excelOnCompChange (4597) [CRITICAL — 182 linie]
├── _excelSaveUndoSnapshot
├── _excelMarkAsManual
├── _excelClearResCache
├── getAvailableProducts / studnieProducts (filter)
├── filterByWellParams
├── _excelInsertConfigItem
│   ├── _excelClearResCache
│   ├── _excelSortConfig
│   │   └── _excelMoveWlazToTop
│   └── window.ensureReliefRingPair
├── _excelMarkManual
├── _excelRefreshAutoCells
├── _excelUpdateLeftPreview
├── _excelUpdateHeaderProdCodes
├── _excelDebouncedRefresh
├── window.updateSummary
├── window.renderWellDiagram
└── window.renderWellsList

excelSaveAll (4969)
├── refreshAll
├── showToast
├── _excelMarkClean
└── closeExcelTableModal

_excelHandleKeydown (5676)
├── _excelUndo / _excelRedo
│   ├── _excelSaveUndoSnapshot
│   └── _excelRenderTable
├── _excelHandleCopy
├── _excelSaveUndoSnapshot
└── _excelSetCellValue

excelShowAddDialog (5197) / excelShowPasteDialog (5314)
├── document.body.insertAdjacentHTML
├── lucide.createIcons
└── _excelParsePasteData
    └── _excelDetectColumn
```

### 3.2 Funkcje wywoływane przez HTML (onclick/onchange)

| Atrybut HTML       | Funkcja                                           | Plik docelowy          |
| ------------------ | ------------------------------------------------- | ---------------------- |
| `onclick`          | `excelToggleFullscreen()`                         | excelHelpers.js        |
| `onclick`          | `excelSwitchTab(tab)`                             | excelTabs.js           |
| `onclick`          | `excelAddWellToTab()`                             | excelTabs.js           |
| `onclick`          | `excelCreateFromEmpty()`                          | excelTabs.js           |
| `onclick`          | `excelRemoveTransitionColumn()`                   | excelChangeHandlers.js |
| `onclick`          | `excelAddTransitionColumn()`                      | excelChangeHandlers.js |
| `onclick`          | `excelSaveAll()`                                  | excelWellActions.js    |
| `onclick`          | `excelDuplicateWell(wIdx)`                        | excelWellActions.js    |
| `onclick`          | `excelDeleteWell(wIdx)`                           | excelWellActions.js    |
| `onclick`          | `excelShowAddDialog()`                            | excelDialogs.js        |
| `onclick`          | `excelShowPasteDialog()`                          | excelDialogs.js        |
| `onclick`          | `excelOpenWellParams(wIdx)`                       | excelWellActions.js    |
| `onclick`          | `_excelToggleWellAutoMode(wIdx)`                  | excelAutoSelect.js     |
| `onclick`          | `_excelRunAutoSelectForWell(wIdx)`                | excelAutoSelect.js     |
| `onclick`          | `excelFilterWells(value)`                         | excelHelpers.js        |
| `onclick`          | `excelSelectRow(wIdx)`                            | excelModal.js          |
| `onclick`          | `excelCellFocus(el)`                              | excelNavigation.js     |
| `onchange`         | `excelOnRzednaChange(wIdx)`                       | excelChangeHandlers.js |
| `onchange`         | `excelOnPrzejscieChange(wIdx,trIdx,field,value)`  | excelChangeHandlers.js |
| `onchange`         | `excelOnPrzejscieTypeChange(wIdx,trIdx,value)`    | excelChangeHandlers.js |
| `onchange`         | `excelOnWlazChange(wIdx,productId)`               | excelChangeHandlers.js |
| `onchange`         | `excelOnCompChange(wIdx,ct,height,val,pid,redDn)` | excelChangeHandlers.js |
| `onchange`         | `excelOnKinetaChange(wIdx,value)`                 | excelChangeHandlers.js |
| `onchange`         | `excelOnPsiaBudaChange(wIdx,checked)`             | excelChangeHandlers.js |
| `onchange`         | `excelOnNameChange(wIdx,value)`                   | excelWellActions.js    |
| `onchange`         | `excelOnReductionSelectChange(wIdx,value)`        | excelChangeHandlers.js |
| `onclick` (inline) | `_excelUpdateWellParam(wIdx,key,val)`             | excelWellActions.js    |

### 3.3 Funkcje rejestrowane na window.*

| window.*                        | Skąd                        | Cel                 |
| ------------------------------- | --------------------------- | ------------------- |
| `window.refreshExcelFromConfig` | excelTableManager.js (5839) | Bootstrap — zostaje |
| `window._excelSyncAutoManualUI` | excelTableManager.js (5845) | Bootstrap — zostaje |

**Uwaga:** Funkcje `excel*` (np. `excelSwitchTab`, `excelOnCompChange`) są dostępne globalnie przez hoisting — nie wymagają jawnego `window.excelXxx = excelXxx`. Po przeniesieniu do nowego pliku nadal będą globalne.

### 3.4 Miejsca modyfikujące wells

| Funkcja                                   | Operacja                                                  |
| ----------------------------------------- | --------------------------------------------------------- |
| `excelOnCompChange`                       | `wells[wIdx].config` — filter + splice                    |
| `_excelInsertConfigItem`                  | `well.config` — splice, push, sort                        |
| `_excelSortConfig`                        | `well.config` — sort + splice (wlaz na top)               |
| `excelOnWlazChange`                       | `well.config` — filter + insert                           |
| `excelOnKinetaChange`                     | `wells[wIdx].kineta` = value                              |
| `excelOnPsiaBudaChange`                   | `well.kineta`, `well.spocznik`, `well.psiaBuda`           |
| `excelOnReductionSelectChange`            | `well.redukcjaDN1000`, `well.config`                      |
| `excelOnRzednaChange`                     | `wells[wIdx].rzednaWlazu`, `wells[wIdx].rzednaDna`        |
| `excelOnNameChange`                       | `wells[wIdx].name`, `wells[wIdx].numer`                   |
| `excelDuplicateWell`                      | `wells.splice(wIdx+1, 0, copy)`                           |
| `excelDeleteWell`                         | `wells.splice(wIdx, 1)`                                   |
| `excelAddWellToTab`                       | `wells.push(well)`                                        |
| `excelCreateFromEmpty`                    | `wells.push(well)`                                        |
| `_excelCreateFromDialog`                  | `wells.push(well)`                                        |
| `_excelImportPasteList`                   | `wells.push(well)` × N                                    |
| `_excelPasteCreateWells`                  | `wells.push(well)` × N                                    |
| `_excelEnsureRowCount`                    | `wells.push(well)` × N                                    |
| `_excelUndo` / `_excelRedo`               | `wells.splice(0, wells.length, ...snap)`                  |
| `excelOnPrzejscieChange`                  | `wells[wIdx].przejscia[trIdx]`                            |
| `excelOnPrzejscieTypeChange`              | `wells[wIdx].przejscia[trIdx]`                            |
| `excelRemoveTransitionColumn`             | `wells.forEach → w.przejscia.pop()`                       |
| `excelAddTransitionColumn`                | `wells.forEach → w.przejscia.push()`                      |
| `_excelMarkManual` / `_excelMarkAsManual` | `well.autoLocked`, `well.configSource`, `well.autoSelect` |
| `_excelToggleWellAutoMode`                | `wells[wIdx].autoSelect`, `wells[wIdx].configSource`      |
| `_excelUpdateWellParam`                   | `well[paramKey] = value`                                  |

### 3.5 Funkcje korzystające z undo/redo

| Funkcja                        | Woła `_excelSaveUndoSnapshot`                            |
| ------------------------------ | -------------------------------------------------------- |
| `excelOnRzednaChange`          | NIE (brak undo dla zmiany rzednej)                       |
| `excelOnCompChange`            | ✅ TAK                                                   |
| `excelOnWlazChange`            | NIE (pośrednio przez `_excelMarkManual` → nie woła undo) |
| `excelOnReductionSelectChange` | ✅ TAK                                                   |
| `excelOnNameChange`            | ✅ TAK                                                   |
| `excelDeleteWell`              | NIE (brak undo dla usunięcia studni)                     |
| `_excelHandleKeydown` (Ctrl+Z) | NIE (tylko woła `_excelUndo`)                            |
| `_excelHandleKeydown` (Ctrl+X) | ✅ TAK (przed wyczyszczeniem)                            |
| `_excelHandleKeydown` (Delete) | ✅ TAK                                                   |
| `_excelHandleKeydown` (Ctrl+D) | ✅ TAK                                                   |
| `_excelHandleKeydown` (Ctrl+R) | ✅ TAK                                                   |
| `_excelEnsureRowCount`         | ✅ TAK                                                   |
| `_excelPasteCreateWells`       | ✅ TAK                                                   |

### 3.6 Funkcje korzystające z polling

| Funkcja                    | Używa                                     |
| -------------------------- | ----------------------------------------- |
| `_excelStartPolling`       | `_excelPollInterval = setInterval(...)`   |
| `_excelStopPolling`        | `clearInterval(_excelPollInterval)`       |
| `_excelBuildWellsSnapshot` | Buduje snapshot `wells` (czyta)           |
| `_excelSyncAutoManualUI`   | Aktualizuje UI AUTO/MAN (zapisuje do DOM) |
| `_excelDebouncedRefresh`   | `_excelRefreshTimer = setTimeout(...)`    |

---

## 4. Hidden Globals — mapa stanu globalnego

### 4.1 Stan modułu (wszystko w excelState.js — single source of truth)

| Zmienna                   | Typ           | Używana przez                         | Mutowana przez                                                                                                       |
| ------------------------- | ------------- | ------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `_excelMaxTransitions`    | `{}`          | Render, Columns, Tabs, ChangeHandlers | excelAddTransitionColumn, excelRemoveTransitionColumn, excelCreateFromEmpty, excelAddWellToTab, _excelEnsureRowCount |
| `_excelActiveTab`         | `string`      | ~90% funkcji                          | excelSwitchTab                                                                                                       |
| `_excelCreatingLock`      | `bool`        | excelCreateFromEmpty                  | excelCreateFromEmpty                                                                                                 |
| `_excelRefreshTimer`      | `null\|timer` | _excelDebouncedRefresh                | _excelDebouncedRefresh                                                                                               |
| `_excelSelectedCols`      | `[]`          | Selection, Clipboard, Keyboard        | _excelSelectCol, _excelDeselectAllCols                                                                               |
| `_excelSelectedCells`     | `[]`          | Selection, Clipboard, Keyboard        | _excelSelectCell, _excelDeselectAllCells, _excelSelectRange                                                          |
| `_excelLastClickedCell`   | `null\|{}`    | Selection                             | _excelSelectCell, _excelOnMouseDown                                                                                  |
| `_excelLastDataCol`       | `number`      | Navigation (Arrow)                    | _excelHandleArrow                                                                                                    |
| `_excelDragState`         | `null\|{}`    | Selection                             | _excelOnMouseDown, _excelOnMouseUp                                                                                   |
| `_excelDragThrottle`      | `null\|timer` | Selection                             | _excelOnMouseMove                                                                                                    |
| `_excelFocusOverlayEl`    | `null\|el`    | Selection, Focus                      | _excelPositionFocusOverlay                                                                                           |
| `_excelFocusRaf`          | `null\|raf`   | Selection                             | _excelOnOverlayScroll                                                                                                |
| `_excelRowSelectStates`   | `{}`          | Selection                             | _excelOnRowSelectChange                                                                                              |
| `_excelDirty`             | `bool`        | UI, Save                              | _excelMarkDirty, _excelMarkClean                                                                                     |
| `_excelFullscreen`        | `bool`        | excelToggleFullscreen                 | excelToggleFullscreen                                                                                                |
| `_excelPollInterval`      | `null\|timer` | Polling                               | _excelStartPolling, _excelStopPolling                                                                                |
| `_excelLastClickedCol`    | `number`      | Focus                                 | _excelOnFocusIn                                                                                                      |
| `_excelColWidths`         | `{}`          | ColumnOps                             | _excelInitColumnResize                                                                                               |
| `_excelAddingReliefPair`  | `bool`        | ConfigManager                         | _excelInsertConfigItem                                                                                               |
| `_excelUserEditing`       | `bool`        | Polling, Focus                        | excelCellFocus, excelCellBlur                                                                                        |
| `_excelAutoSelectEnabled` | `bool`        | Well CRUD, AutoSelect                 | — (stała w UI)                                                                                                       |
| `_excelPasteCancelFlag`   | `bool`        | Clipboard                             | _excelPasteBatch                                                                                                     |
| `_excelUndoStack`         | `[]`          | Undo/Redo                             | _excelSaveUndoSnapshot, _excelUndo                                                                                   |
| `_excelRedoStack`         | `[]`          | Undo/Redo                             | _excelUndo, _excelRedo                                                                                               |
| `_EXCEL_UNDO_LIMIT`       | `const 20`    | Undo/Redo                             | —                                                                                                                    |

### 4.2 Zależności od globali zewnętrznych

| Global                        | Typ      | Gdzie zadeklarowany | Używany w excel*                        |
| ----------------------------- | -------- | ------------------- | --------------------------------------- |
| `wells`                       | `Array`  | wellManager.js      | **WSZYSTKIE moduły** (czytanie/mutacja) |
| `studnieProducts`             | `Array`  | pricelistManager.js | Helpers, Columns, ChangeHandlers        |
| `currentWellIndex`            | `number` | wellManager.js      | Modal, Tabs, Render, Selection          |
| `WELL_PARAM_DEFS`             | `Array`  | wellUI.js:239       | WellActions (excelOpenWellParams)       |
| `window.showToast`            | `fn`     | shared/ui.js        | Wszystkie moduły z UI                   |
| `window.logger`               | `obj`    | shared/logger.js    | Navigation (warn)                       |
| `window.escapeHtml`           | `fn`     | shared/utils.js     | Dialogs, WellActions                    |
| `window.lucide`               | `obj`    | CDN                 | Modal, Dialogs (createIcons)            |
| `window.updateSummary`        | `fn`     | offerManager.js     | ChangeHandlers, AutoSelect              |
| `window.renderWellDiagram`    | `fn`     | wellDiagram.js      | ChangeHandlers                          |
| `window.renderWellsList`      | `fn`     | wellManager.js      | ChangeHandlers, AutoSelect              |
| `window.renderWellConfig`     | `fn`     | wellManager.js      | ChangeHandlers                          |
| `window.createNewWell`        | `fn`     | wellManager.js      | Tabs, Dialogs (Well CRUD)               |
| `window.autoSelectComponents` | `fn`     | wellManager.js      | AutoSelect, ChangeHandlers              |
| `window.ensureReliefRingPair` | `fn`     | wellManager.js      | ConfigManager                           |
| `window.getAvailableProducts` | `fn`     | pricelistManager.js | ChangeHandlers                          |
| `window.filterByWellParams`   | `fn`     | pricelistManager.js | ChangeHandlers                          |
| `window.refreshAll`           | `fn`     | appStudnie.js       | Save (excelSaveAll)                     |
| `window.updateAutoLockUI`     | `fn`     | wellUI.js           | ChangeHandlers                          |
| `window.syncKineta`           | `fn`     | wellManager.js      | ChangeHandlers                          |
| `window.autoUpdateWellName`   | `fn`     | wellManager.js      | WellActions                             |
| `window.isSettlingWell`       | `fn`     | wellManager.js      | WellActions                             |
| `window.isWellLocked`         | `fn`     | wellManager.js      | WellActions                             |
| `window.appConfirm`           | `fn`     | shared/ui.js        | WellActions                             |

**Zasada:** Żaden nowy moduł nie może tworzyć własnej kopii tych globali — zawsze czytamy z `excelState.js` (dla `_excel*`) lub z `window` (dla zewnętrznych).

---

## 5. Golden Master — procedura

### 5.1 Snapshot przed refaktorem

Przed pierwszym krokiem i po każdym CRITICAL kroku wykonaj:

```javascript
function captureExcelBaseline() {
    const container = document.getElementById('excel-table-container');
    return {
        html: container ? container.outerHTML : null,
        wells: JSON.parse(JSON.stringify(window.wells || [])),
        state: {
            activeTab: typeof _excelActiveTab !== 'undefined' ? _excelActiveTab : null,
            maxTransitions:
                typeof _excelMaxTransitions !== 'undefined' ? { ..._excelMaxTransitions } : {},
            selectedCells:
                typeof _excelSelectedCells !== 'undefined' ? _excelSelectedCells.length : 0,
            dirty: typeof _excelDirty !== 'undefined' ? _excelDirty : false,
            fullscreen: typeof _excelFullscreen !== 'undefined' ? _excelFullscreen : false,
            pollInterval: typeof _excelPollInterval !== 'undefined' ? !!_excelPollInterval : false
        }
    };
}
```

Zapisz wynik do `baseline/excel-{krok}-before.json`.

### 5.2 Porównanie po kroku

```bash
diff <(python3 -c "import json; print(json.dumps(json.load(open('baseline/excel-k1-before.json')), sort_keys=True))") <(python3 -c "import json; print(json.dumps(json.load(open('baseline/excel-k1-after.json')), sort_keys=True))")
```

### 5.3 Whitelista akceptowalnych różnic

- `_excelPollInterval` — timer ID zmienia się po restarcie
- Kolejność właściwości w `JSON.stringify(wells)` — jeśli obiekty są identyczne
- Białe znaki w HTML (jeśli Prettier zmienił formatowanie)

**Każda inna różnica = STOP + rollback.**

---

## 6. Regression Matrix

Po **każdym** kroku przejdź całą macierz:

| #   | Funkcja                 | Test                                                   | Krytyczność |
| --- | ----------------------- | ------------------------------------------------------ | ----------- |
| 1   | Otwórz Excel            | Kliknij przycisk Excel → modal widoczny                | CRITICAL    |
| 2   | Zamknij Excel           | Kliknij X/Escape → modal znika, listenery wyczyszczone | CRITICAL    |
| 3   | Render tabeli           | Widoczne wiersze dla wszystkich DN (1000-2500+styczne) | CRITICAL    |
| 4   | Przełącz zakładkę       | Kliknij DN1200 → tabela przeładowana                   | WYSOKA      |
| 5   | Empty row               | Pole `excel-empty-name` widoczne na dole               | WYSOKA      |
| 6   | Dodaj studnię           | Wpisz nazwę w empty row → nowy wiersz                  | WYSOKA      |
| 7   | Dodaj studnię (dialog)  | Kliknij "Dodaj" → dialog → wypełnij → OK               | ŚREDNIA     |
| 8   | Usuń studnię            | Kliknij kosz → confirm → usunięta                      | WYSOKA      |
| 9   | Duplikuj                | Kliknij duplikuj → kopia w następnym wierszu           | ŚREDNIA     |
| 10  | Edytuj nazwę            | Zmień nazwę w tabeli → aktualizacja                    | ŚREDNIA     |
| 11  | Zmień ilość kręgów      | Select → nowa wartość → config zaktualizowany          | CRITICAL    |
| 12  | Zmień AVR               | Select → nowa wartość                                  | WYSOKA      |
| 13  | Zmień właz              | Select → nowy właz                                     | WYSOKA      |
| 14  | Zmień przejścia         | Select rodzaj + średnica                               | WYSOKA      |
| 15  | Dodaj kolumnę przejścia | Kliknij "+" → nowa kolumna                             | ŚREDNIA     |
| 16  | Usuń kolumnę przejścia  | Kliknij "−" → kolumna usunięta                         | ŚREDNIA     |
| 17  | Zmień redukcję          | Select DN1000/DN1200/Brak                              | WYSOKA      |
| 18  | Zmień kinetę            | Select wartość                                         | ŚREDNIA     |
| 19  | Zmień psiaBuda          | Checkbox → kineta/spocznik zablokowane                 | ŚREDNIA     |
| 20  | Auto-dobór              | Kliknij "Run" → komponenty dobrane                     | WYSOKA      |
| 21  | Manual mode             | Kliknij AUTO/MAN → przełączenie                        | ŚREDNIA     |
| 22  | Copy (Ctrl+C)           | Zaznacz komórki → Ctrl+C → schowek                     | WYSOKA      |
| 23  | Paste (Ctrl+V)          | Ctrl+V → wartości wklejone                             | WYSOKA      |
| 24  | Undo (Ctrl+Z)           | Ctrl+Z → stan cofnięty                                 | WYSOKA      |
| 25  | Redo (Ctrl+Y)           | Ctrl+Y → stan przywrócony                              | WYSOKA      |
| 26  | Delete                  | Zaznacz + Delete → komórki wyczyszczone                | ŚREDNIA     |
| 27  | Tab nawigacja           | Tab → następna komórka                                 | WYSOKA      |
| 28  | Strzałki                | → ← ↑ ↓ → nawigacja między komórkami                   | WYSOKA      |
| 29  | Resize kolumn           | Przeciągnij krawędź th → zmiana szerokości             | ŚREDNIA     |
| 30  | Sticky columns          | Przewiń w prawo → kolumny Lp+Nazwa+DN sticky           | ŚREDNIA     |
| 31  | Focus overlay           | Kliknij komórkę → niebieski highlight                  | NISKA       |
| 32  | Parametry popup         | Kliknij przycisk parametrów → popup widoczny           | ŚREDNIA     |
| 33  | Save (Gotowe)           | Kliknij "Gotowe" → modal znika, wells zaktualizowane   | CRITICAL    |
| 34  | Polling AUTO/MAN        | Zmień configSource w głównym panelu → sync w Excelu    | ŚREDNIA     |

**Zasada:** Po kroku LOW — wystarczy podzbiór (1-5). Po kroku CRITICAL — pełna macierz 34 testów.

---

## 7. Kolejność kroków z mikrokrokami

### Krok 1 ✅ — `excelState.js` (Ryzyko: LOW) — ZROBIONE

**commit 1.1:** Utwórz `excelState.js` ze wszystkimi `let`/`const` (linie 4-24, 176-228, 3596, 5519-5521)
**commit 1.2:** Usuń przeniesione linie z `excelTableManager.js`, dodaj script tag w `studnie.html`
**Test:** `node -c` dla obu plików, Regression Matrix #1-5
**Golden Master:** snapshot przed/po (tylko `wells` powinien być identyczny)

---

### Krok 2 — `excelHelpers.js` (Ryzyko: LOW→MEDIUM)

**Zakres linii:** 26-81, 230-284, 951-1143, 1146-1313, 1378-1406, 1410-1504, 1507-1525

**Funkcje:**
`_excelGetWellConfigHash`, `getHasReduction`, `_excelGetColumnStructureHash`, `_excelWellMatchesTab`, `_excelGetReferenceWell`, `_excelGetMaxTransitions`, `_excelCreatePrzejscie`, `_excelShortLabel`, `_excelWrapDetail`, `_excelCalcWellHeight`, `_excelCalcDennicaHeight`, `_excelSafeHeightMatch`, `_excelCalcUszczelkaCount`, `_excelCountProductInConfig`, `_excelGetResolution`, `_excelClearResCache`, `_excelGetWellProdCode`, `_excelGetWellProdPrice`, `_excelUpdateHeaderProdCodes`, `_excelGetWlazFromConfig`, `_excelAutoSetWlaz`, `_excelCellInp`, `_excelOverlaySelectHtml`, `_excelPositionOverlay`, `excelToggleFullscreen`, `_excelMarkDirty`, `_excelMarkClean`, `excelFilterWells`

**Mikrokroki:**

1. **Statyczna analiza:** grep dla każdej z powyższych funkcji — sprawdź czy nie ma cross-call do funkcji spoza zakresu
2. **commit 2.1:** Utwórz `excelHelpers.js` ze wszystkimi funkcjami (skopiuj 1:1)
3. **commit 2.2:** Dodaj script tag w `studnie.html` PRZED `excelTableManager.js`
4. **Test:** `node -c`, Regression Matrix #1-10, sprawdź overlay select w pustym wierszu
5. **commit 2.3:** Usuń oryginalne definicje z `excelTableManager.js`
6. **Test:** Regression Matrix #1-10, sprawdź konsolę (F12) — brak błędów
7. **Golden Master:** snapshot wells przed/po (oczekiwany: brak różnic)

---

### Krok 3 — `excelPolling.js` (Ryzyko: LOW)

**Zakres linii:** 83-173

**Funkcje:**
`_excelStartPolling`, `_excelBuildWellsSnapshot`, `_excelSyncAutoManualUI`, `_excelStopPolling`, `_excelDebouncedRefresh`

**Mikrokroki:**

1. **Statyczna analiza:** `_excelSyncAutoManualUI` woła `_excelDebouncedRefresh` (obie w zakresie) i modyfikuje DOM
2. **commit 3.1:** Utwórz `excelPolling.js`
3. **commit 3.2:** Dodaj script tag, usuń z main
4. **Test:** Otwórz Excel, zmień configSource w głównym panelu → AUTO/MAN w Excelu się aktualizuje, Regression Matrix #34

---

### Krok 4 — `excelColumns.js` + `excelReductionColumns.js` (Ryzyko: MEDIUM)

**Zakres linii:** 286-949

**Funkcje:**
`_excelGetComponentsForDn` (286-333), `_excelBuildComponentColumns` (335-949)

**Mikrokroki:**

1. **Statyczna analiza:** `_excelBuildComponentColumns` woła `_excelGetComponentsForDn`, `_excelShortLabel`, `_excelGetWellProdCode`, `_excelGetWellProdPrice`, `_excelCountProductInConfig` — wszystkie w excelHelpers.js
2. **commit 4.1 (refactor in-place):** Wyodrębnij sekcję redukcji (linie ~371-949) do nowej funkcji `_excelBuildReductionColumns` wewnątrz `excelTableManager.js`
3. **Test:** `node -c`, otwórz Excel dla każdej zakładki DN — kolumny redukcji muszą być identyczne
4. **commit 4.2:** Utwórz `excelReductionColumns.js` z `_excelBuildReductionColumns`
5. **commit 4.3:** Utwórz `excelColumns.js` z `_excelGetComponentsForDn` i `_excelBuildComponentColumns`
6. **Test:** Regression Matrix #1-4, sprawdź kolumny dla każdego DN (1000, 1200, 1500, 2000, 2500, styczne)

---

### Krok 5 — `excelModal.js` (Ryzyko: HIGH)

**Zakres linii:** 1528-1884

**Funkcje:**
`openExcelTableModal`, `closeExcelTableModal`, `_excelUpdateLeftPreview`, `excelSelectRow`

**Uwaga:** `openExcelTableModal` rejestruje 7+ globalnych event listenerów. `closeExcelTableModal` musi je wszystkie wyczyścić.

**Mikrokroki:**

1. **Statyczna analiza:** Znajdź wszystkie `addEventListener` i `removeEventListener` w zakresie. Sprawdź czy każdy add ma odpowiadający remove.
2. **Golden Master:** snapshot przed (HTML + wells + state)
3. **commit 5.1:** Wyodrębnij listenery do osobnych funkcji w `excelTableManager.js` (refactor in-place): `_excelRegisterExcelListeners`, `_excelUnregisterExcelListeners`
4. **Test:** Otwórz/zamknij Excel 3× — brak duplikacji listenerów (sprawdź w devtools)
5. **Golden Master:** snapshot po — porównaj HTML + wells
6. **commit 5.2:** Utwórz `excelModal.js` z wszystkimi funkcjami
7. **Test:** Regression Matrix #1-2, sprawdź select row, sprawdź listenery w devtools (brak leaków)

---

### Krok 6 — `excelTabs.js` + `excelAutoSelect.js` (Ryzyko: MEDIUM)

**Zakres linii:** 1887-1979 (tabs), 3737-3858 (empty row), 1944-1979 (add well), 1983-2078 (auto-select)

**Funkcje tabs:** `_excelRenderTabs`, `_excelUpdateWellCount`, `excelSwitchTab`, `excelAddWellToTab`, `excelCreateFromEmpty`, `_excelEnsureRowCount`
**Funkcje auto:** `_excelAutoSelectForWell`, `_excelToggleWellAutoMode`, `_excelRunAutoSelectForWell`

**Mikrokroki:**

1. **commit 6.1:** Utwórz `excelTabs.js`
2. **commit 6.2:** Utwórz `excelAutoSelect.js`
3. **Test:** Regression Matrix #4-7, #20-21, dodaj studnię z auto-doborem

---

### Krok 7 — `excelTableRenderer.js` + `excelTableBody.js` (Ryzyko: CRITICAL)

**Zakres linii:** 2081-2788

**Funkcje:**
`_excelRenderTable` (~710 linii — NAJWIĘKSZA), `_excelRefreshAutoCells`, `_excelRefreshDupColors`

**Mikrokroki:**

1. **Statyczna analiza:** `_excelRenderTable` woła funkcje z excelHelpers, excelColumns, excelColumnOps — sprawdź czy wszystkie są załadowane przed wykonaniem
2. **Golden Master:** snapshot przed (HTML tabeli + wells + state)
3. **commit 7.1 (refactor in-place):** Wyodrębnij tworzenie TBODY do `_excelRenderTbody(dataRows, dn, tab, curWellIdx)` w `excelTableManager.js`
4. **Test:** Otwórz Excel ze studniami wszystkich DN — tabela musi wyglądać IDENTYCZNIE
5. **Golden Master:** porównaj HTML przed/po (tylko różnice białych znaków dozwolone)
6. **commit 7.2:** Utwórz `excelTableBody.js` z `_excelRenderTbody`, `_excelRefreshAutoCells`, `_excelRefreshDupColors`
7. **test:** Regression Matrix #3
8. **commit 7.3:** Utwórz `excelTableRenderer.js` z pozostałą częścią `_excelRenderTable`
9. **Test:** Pełna Regression Matrix #1-34

---

### Krok 8 — `excelColumnOps.js` (Ryzyko: MEDIUM)

**Zakres linii:** 2791-3010

**Funkcje:**
`_excelApplyStickyColumns`, `_excelInitColumnResize`, `_excelInitColumnSelect`, `_excelSelectCol`, `_excelDeselectAllCols`, `_excelToggleColClass`

**Test:** Regression Matrix #29-30, przeciągnij kolumnę, Ctrl+click

---

### Krok 9 — `excelSelection.js` (Ryzyko: MEDIUM)

**Zakres linii:** 3013-3370

**Funkcje:**
Cell selection (click, drag, Shift+click, Ctrl+click), drag state, bulk mode, focus overlay, row select

**Test:** Regression Matrix #22-23, #26, #31, kliknij komórkę, Shift+click (zakres), Ctrl+click (toggle)

---

### Krok 10 — `excelClipboard.js` (Ryzyko: MEDIUM)

**Zakres linii:** 3386-3694 + 5548-5673

**Funkcje:**
`_excelHandleCopy`, `_excelHandlePaste`, `_excelPasteBatch`, `_excelPasteSync`, `_excelSetCellValue`, `_excelMarkAsManual`, `_excelPasteCreateWells`, `_excelShowPasteProgress`, `_excelHidePasteProgress`, `_excelGetPasteColIdx`

**Test:** Regression Matrix #22-23, Ctrl+C + Ctrl+V z danymi

---

### Krok 11 — `excelNavigation.js` (Ryzyko: MEDIUM)

**Zakres linii:** 3860-4179

**Funkcje:**
`excelCellFocus`, `excelCellBlur`, `_excelHandleTab`, `_excelHandleArrow`, `_excelNormalizeNavTarget`, `_excelGetNavElements`, `_excelSkipDisabled`, `_excelIsDisabledNav`, `_excelFocusNavEl`

**Test:** Regression Matrix #27-28

---

### Krok 12 — `excelChangeHandlers.js` + `excelConfigManager.js` (Ryzyko: CRITICAL)

**Zakres linii:** 4182-4842 (handlery) + 4370-4595 (config manager)

**Funkcje handlers:**
`excelOnRzednaChange`, `excelRemoveTransitionColumn`, `excelAddTransitionColumn`, `_excelCleanEmptyPrzejscia`, `excelOnPrzejscieChange`, `excelOnPrzejscieTypeChange`, `excelOnWlazChange`, `_excelMarkManual`, `excelOnKinetaChange`, `excelOnPsiaBudaChange`, `excelOnReductionSelectChange`, `excelOnCompChange`

**Funkcje config:**
`_excelInsertConfigItem`, `_excelSortConfig`, `_excelMoveWlazToTop`

**Mikrokroki:**

1. **Statyczna analiza:** `excelOnCompChange` (182 linie) — znajdź wszystkie ścieżki wywołań (ma 5+ zagnieżdżonych if/else)
2. **Golden Master:** snapshot przed
3. **commit 12.1:** Utwórz `excelConfigManager.js` z `_excelInsertConfigItem`, `_excelSortConfig`, `_excelMoveWlazToTop`
4. **Test:** Zmień ilość kręgów → config zaktualizowany
5. **commit 12.2:** Utwórz `excelChangeHandlers.js` z handlerami (bez `excelOnCompChange`)
6. **Test:** Regression Matrix #11-19
7. **commit 12.3 (CRITICAL):** Przenieś `excelOnCompChange` (feature flag: zostaw starą jako `_excelOnCompChange_old`)
8. **Test:** Pełna Regression Matrix #1-34, porównaj wells snapshot przed/po zmianie configu
9. **Golden Master:** porównaj wells — musi być IDENTYCZNY

---

### Krok 13 — `excelWellActions.js` + `excelDialogs.js` (Ryzyko: MEDIUM)

**Zakres linii:** 4969-5176 (actions) + 5179-5516 (dialogs) + 4844-4966 (dup colors)

**Funkcje actions:**
`excelSaveAll`, `_excelUpdateWellParam`, `excelOpenWellParams`, `excelRefreshParamsPopup`, `excelOnNameChange`, `excelDuplicateWell`, `excelDeleteWell`

**Funkcje dialogs:**
`_excelToggleAddMenu`, `excelShowAddDialog`, `_excelCreateFromDialog`, `excelShowPasteDialog`, `_excelUpdatePastePreview`, `_excelParsePasteData`, `_excelDetectColumn`, `_excelImportPasteList`

**Test:** Regression Matrix #7-10, #32-33

---

### Krok 14 — `excelKeyboard.js` (Ryzyko: LOW)

**Zakres linii:** 5676-5836

**Funkcje:**
`_excelHandleKeydown` (Ctrl+Z/Y/X/C/V/D/R/A, Delete, Backspace)

**Test:** Regression Matrix #24-26

---

### Krok 15 — Bootstrap `excelTableManager.js` (Ryzyko: MEDIUM)

**Zostaje:** `window.refreshExcelFromConfig`, `window._excelSyncAutoManualUI`, komentarz nagłówkowy

**Mikrokroki:**

1. **commit 15.1:** Usuń wszystkie przeniesione definicje, zostaw tylko 2 window exporty
2. **Test:** `node -c`, Regression Matrix #1-34
3. **Golden Master:** snapshot końcowy

---

## 8. Kolejność script tagów w `studnie.html`

```html
<!-- excel: stan i stałe (krok 1) -->
<script src="js/studnie/excelState.js?v=1.7.0"></script>
<!-- excel: helpery (krok 2) -->
<script src="js/studnie/excelHelpers.js?v=1.7.0"></script>
<!-- excel: polling (krok 3) -->
<script src="js/studnie/excelPolling.js?v=1.7.0"></script>
<!-- excel: kolumny (krok 4) -->
<script src="js/studnie/excelColumns.js?v=1.7.0"></script>
<script src="js/studnie/excelReductionColumns.js?v=1.7.0"></script>
<!-- excel: modal (krok 5) -->
<script src="js/studnie/excelModal.js?v=1.7.0"></script>
<!-- excel: tabs + auto-select (krok 6) -->
<script src="js/studnie/excelTabs.js?v=1.7.0"></script>
<script src="js/studnie/excelAutoSelect.js?v=1.7.0"></script>
<!-- excel: renderer + body (krok 7) -->
<script src="js/studnie/excelTableRenderer.js?v=1.7.0"></script>
<script src="js/studnie/excelTableBody.js?v=1.7.0"></script>
<!-- excel: column ops (krok 8) -->
<script src="js/studnie/excelColumnOps.js?v=1.7.0"></script>
<!-- excel: selection (krok 9) -->
<script src="js/studnie/excelSelection.js?v=1.7.0"></script>
<!-- excel: clipboard (krok 10) -->
<script src="js/studnie/excelClipboard.js?v=1.7.0"></script>
<!-- excel: nawigacja (krok 11) -->
<script src="js/studnie/excelNavigation.js?v=1.7.0"></script>
<!-- excel: config + handlers (krok 12) -->
<script src="js/studnie/excelConfigManager.js?v=1.7.0"></script>
<script src="js/studnie/excelChangeHandlers.js?v=1.7.0"></script>
<!-- excel: well actions + dialogs (krok 13) -->
<script src="js/studnie/excelWellActions.js?v=1.7.0"></script>
<script src="js/studnie/excelDialogs.js?v=1.7.0"></script>
<!-- excel: keyboard shortcuts (krok 14) -->
<script src="js/studnie/excelKeyboard.js?v=1.7.0"></script>
<!-- excel: bootstrap (krok 15 — MUSI BYĆ OSTATNI) -->
<script src="js/studnie/excelTableManager.js?v=1.7.0"></script>
```

---

## 9. Analiza ryzyka

| #   | Zagrożenie                                                               | Prawdopodobieństwo | Wpływ     | Mitrygacja                                                             |
| --- | ------------------------------------------------------------------------ | ------------------ | --------- | ---------------------------------------------------------------------- |
| 1   | **`_excelRenderTable` błąd** — 710 linii, największa funkcja             | Średnie            | Krytyczny | Refactor przed splitem: wyodrębnić `_excelRenderTbody` + Golden Master |
| 2   | **`excelOnCompChange` błąd** — 182 linie, złożona logika configu studni  | Średnie            | Krytyczny | Feature flag (zostawić starą jako `_old`) + snapshot wells przed/po    |
| 3   | **Inline onclick → undefined** — funkcje muszą być na window po podziale | Niskie             | Wysoki    | `node -c` dla wszystkich nowych plików + Regression Matrix #1-5        |
| 4   | **Event listener leak** — modal rejestruje 7+ listenerów                 | Średnie            | Wysoki    | Sprawdzić parę add/remove + devtools listeners                         |
| 5   | **Circular dependency** — Renderer → Selection → Clipboard → Renderer    | Niskie             | Krytyczny | Mapa zależności (sekcja 3) przed każdym krokiem                        |
| 6   | **Stan współdzielony** — duplikacja `_excel*` vars w wielu modułach      | Średnie            | Wysoki    | Wszystkie `_excel*` tylko w excelState.js (single source of truth)     |
| 7   | **`wells` mutacja** — wiele modułów modyfikuje wells[]                   | Wysokie            | Krytyczny | Golden Master snapshot wells przed/po każdym CRITICAL kroku            |
| 8   | **Komórki Excela nie działają** — brak fokusu, nawigacji, edycji         | Średnie            | Krytyczny | Regression Matrix #11-19, #27-28                                       |
| 9   | **Copy/paste nie działa** — event capture na document                    | Niskie             | Wysoki    | Regression Matrix #22-23                                               |
| 10  | **Otwarcie/zamknięcie nie renderuje** — modal nie pokazuje tabeli        | Niskie             | Krytyczny | Regression Matrix #1-2                                                 |
| 11  | **Nowe globale** — przypadkowe `var`/`let` poza excelState.js            | Niskie             | Średni    | `Object.keys(window)` przed/po — diff musi być pusty                   |
| 12  | **Utrata listenerów** — addEventListener bez removeEventListener w close | Średnie            | Wysoki    | Statyczna analiza przed krokiem 5                                      |

---

## 10. Zasady bezpieczeństwa refaktoryzacji

1. **Nigdy nie zmieniaj logiki biznesowej** podczas podziału modułów

2. **Każdy commit powinien być uruchamialny** — przechodzi `node -c` i podstawową regresję

3. **Najpierw wyodrębnij funkcję w miejscu** (refactor in-place), dopiero później przenieś ją do nowego pliku

4. **Każdy nowy moduł** powinien przejść statyczną analizę zależności przed utworzeniem

5. **Po każdym kroku wykonaj pełną Regression Matrix** — dla CRITICAL wszystkie 34 testy, dla LOW podzbiór

6. **Golden Master** — porównaj HTML tabeli, `wells` i state przed/po każdym CRITICAL kroku

7. **Zero nowych globali** — `Object.keys(window).filter(k => k.startsWith('_excel') || k.startsWith('excel'))` przed i po musi dać identyczny zestaw

8. **Pary addEventListener/removeEventListener** — każdy add musi mieć odpowiadający remove w `closeExcelTableModal`

9. **Pojedyncze źródło prawdy** — cały stan modułu (`_excel*`) tylko w `excelState.js`; żaden moduł nie tworzy własnej kopii

10. **Refaktoryzacja = zachowanie 1:1** — wszelkie zmiany funkcjonalne (optymalizacje, DRY, cleanup) są realizowane dopiero po zakończeniu podziału (Stage 2)
