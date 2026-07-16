# PLAN NAPRAWY v3 — WITROS Oferty PV v1.6.0

## Status weryfikacji założeń (przed rozpoczęciem prac)

| Założenie | Zweryfikowane? | Wynik |
|-----------|---------------|-------|
| `setupParamTiles`/`updateParamTilesUI` używają `escapeHtml` | ✅ Tak — `wellUI.js:68,514,525,932,951,1004` używa `escapeHtml(...)` (bez `window.`) | Rzeczywista zależność transytywna |
| Projekt ma wzorzec `window.x = x` | ✅ Tak — `shared/ui.js`: `window.escapeHtml`, `window.setText`, `window.debounce`, `window.globalUsersMap`, `window.fetchWithTimeout`, `window.appConfirm`, `window.createSaveIndicator`, `window.showModal` | Wzorzec potwierdzony |
| Studnie już eksportują do `window` | ✅ Nie — grep 100+ plików w `public/js/studnie/` nie znalazł żadnego `window.x = x` | Wszystkie funkcje są implicite globalne |
| `rury/` i `sales/` eksportują do `window` | ✅ Nie — `offerItems.js` używa `window.debounce` (odczyt) ale nie eksportuje własnych funkcji | Wzorzec niespójny między modułami |
| `declare var` → wszystkie mogą być `const` | ✅ Nie — część JEST reassignowana w runtime | Patrz sekcja 8a |

---

## Procedury obowiązkowe

### Struktura każdego kroku

```
[CHECKPOINT] git add -A && git commit -m "chore: checkpoint before <krok>"
[WYKONANIE]  wprowadź zmiany
[SKŁADNIA]  node -c <zmienione-pliki>
[TYPY]      npm run typecheck && npm run typecheck:frontend
[TESTY]     npm run test:quick
[FORMAT]    npm run format          ← dopiero po zakończeniu całego etapu, nie po każdym micro-kroku
```

### Rollback

Jeśli krok powoduje regresję (typów, testów, składni):
```bash
git restore .           # nowoczesny zamiennik git checkout --
# lub jeśli potrzebujesz twardszego resetu:
git reset --hard HEAD
```

Następnie: podziel krok na mniejsze części i powtórz.

### Kiedy formatować

`npm run format` tylko po zakończeniu całego logicznego etapu (nie po każdym micro-kroku), aby uniknąć:
- setek zmienionych linii w diff
- utrudnionego review
- mieszania zmian formatowania z logicznymi

Etapy do formatowania: po kroku 2, po kroku 5, po kroku 6, po kroku 7, po kroku 8, po kroku 9.

---

## Kolejność wykonania

```
[C] Krok 1  — escapeHtml w orderManager.js     [1 min]
[C] Krok 2  — typecheck frontend → 0 errors   [35 min]
[H] Krok 3  — regression check                 [2 min]
[M] Krok 4  — no-useless-escape (auto-fix)     [1 min]
[M] Krok 5  — prefer-const (auto-fix)          [5 min]
[M] Krok 6  — no-unused-vars (window.x = x)    [90 min]
[L] Krok 7  — catch prefix _                   [25 min]
[H] Krok 8  — no-var → let/const (batche)      [180 min]
[M] Krok 9  — types.d.ts cleanup               [45 min]
[C] Krok 10 — walidacja końcowa                [5 min]
```

**Priorytety**: C = Critical, H = High, M = Medium, L = Low

**Łącznie**: ~350 min (~6h)

---

## Krok 1 [Critical]: escapeHtml w `orderManager.js`

### Problem

Test T5.4 (`tests/security-regression.test.ts:85-114`) sprawdza czy `public/js/studnie/orderManager.js` zawiera string `escapeHtml`. Obecnie plik go nie zawiera → test failuje.

### Dlaczego test tego wymaga

Test został zaprojektowany, by sprawdzać, czy pliki krytyczne (które mogą operować na `innerHTML`) importują/używają `escapeHtml`. `orderManager.js` ZOSTAŁ włączony do tej listy, mimo że sam nie zawiera żadnego `innerHTML` — jest to stub delegujący do `wellUI.js`.

### Łańcuch zależności (zweryfikowany)

```
orderManager.js              → 9 linii, 0 x innerHTML
  └── setupParamTiles()      → wellUI.js:107
  └── updateParamTilesUI()   → wellUI.js:?
        └── escapeHtml(...)  → wellUI.js:68,514,525,932,951,1004
              └── window.escapeHtml  → shared/ui.js:7-12
```

`orderManager.js` nie używa `escapeHtml` bezpośrednio, ale wywołuje funkcje, które go używają. Zależność jest transytywna, ale rzeczywista.

### Rozwiązanie A (zalecane): `void window.escapeHtml`

```js
// @ts-check

void window.escapeHtml; // transitive dep: setupParamTiles/updateParamTilesUI (wellUI.js) use escapeHtml

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        setupParamTiles();
        updateParamTilesUI();
        loadProductionOrders();
    }, 500);
});
```

`void window.escapeHtml` to:
- Poprawna składnia JS (`node -c` OK)
- Dokumentuje rzeczywistą zależność (sprawdzono grepem)
- Nie dodaje dead code — to wyrażenie, nie instrukcja
- Sprawia, że test przechodzi

### Rozwiązanie B (alternatywa): poprawić test

Usunąć `orderManager.js` z listy `xssFiles` w `tests/security-regression.test.ts:89` — ponieważ plik nie zawiera własnego `innerHTML`, test jest nadmiarowy.

**Nie zalecane**, bo usuwa zabezpieczenie — jeśli w przyszłości ktoś doda `innerHTML` do tego pliku, test już tego nie wychwyci.

### Weryfikacja

```bash
node -c public/js/studnie/orderManager.js
npm run test:quick -- --testPathPatterns=security-regression
```

**Czas**: 1 min

---

## Krok 2 [Critical]: typecheck frontend → 0 errors

### Problem

`npm run typecheck:frontend` — 14 błędów w 7 plikach.

### 2a. `types.d.ts` — dodaj `clientNumber` do `ClientData`

**Plik**: `public/js/types.d.ts:284-292`

Dodaj `clientNumber?: string;` do interfejsu:

```ts
interface ClientData {
    id: number | string;
    name: string;
    nip?: string;
    address?: string;
    contact?: string;
    clientNumber?: string;  // ← DODAJ
    updatedAt?: string;
    createdAt?: string;
}
```

Naprawia 6 błędów: `clientManager.js:91,106,158,229,298,322`.

### 2b. `actionsWellCrud.js` — JSDoc dla parametru `dn`

**Plik**: `public/js/studnie/actionsWellCrud.js:63, ~143`

`createNewWell(name, dn = 1000)` i `addNewWell(dn = 1000)` przyjmują domyślnie `number`, ale są wywoływane z `'styczna'` (string). Fix: JSDoc.

```js
/**
 * @param {string} name
 * @param {string|number} [dn=1000]
 */
function createNewWell(name, dn = 1000) {
```

```js
/**
 * @param {string|number} [dn=1000]
 */
function addNewWell(dn = 1000) {
```

### 2c. `actionsWellPricing.js` — typ `never`

**Plik**: `public/js/studnie/actionsWellPricing.js:506`

```js
/** @type {{ price?: number } | null} */
let bestDrill = null;
```

### 2d. `excelAddDialog.js`, `excelTableManager.js`, `popupsStyczna.js`

Automatycznie naprawione przez fix 2b — wszystkie te pliki przekazują `string|number` do `createNewWell`, które po fixie akceptuje `string|number`.

### Weryfikacja

```bash
npm run typecheck:frontend    # → 0 errors
npm run test:quick            # → brak regresji
```

**Czas**: 35 min

---

## Krok 3 [High]: Regression check

```bash
npm run test:quick
npm run typecheck
npm run lint
```

**Czas**: 2 min

---

## Krok 4 [Medium]: `no-useless-escape` (auto-fix)

**Plik**: `public/js/studnie/pricelistImportExport.js:73`

```bash
npx eslint public/js/studnie/pricelistImportExport.js --fix --rule 'no-useless-escape: error'
node -c public/js/studnie/pricelistImportExport.js
```

**Czas**: 1 min

---

## Krok 5 [Medium]: `prefer-const` (auto-fix)

**Zakres**: wszystkie `.js` w `public/js/`

```bash
git add -A && git commit -m "chore: checkpoint before prefer-const fix"
npx eslint public/js/ --ext .js --fix --rule 'prefer-const: warn' --no-ignore
```

**Weryfikacja** (bez formatowania — dopiero po etapie):
```bash
Get-ChildItem -Recurse public/js/*.js | ForEach-Object { node -c $_.FullName }
npm run typecheck:frontend
npm run test:quick
```

**Uwaga**: `for (let i = 0; ...)` nie zmieni — `i` jest reassignowane. Bezpieczne.

**Czas**: 5 min (+ ewentualny przegląd 10 min jeśli `--fix` wprowadzi problemy)

---

## Krok 6 [Medium]: `no-unused-vars` — rejestracja globalna

### Problem

~360 warningów ESLint o funkcjach "never used".

**Weryfikacja**: Każda funkcja zgłoszona jako warning została sprawdzona przez `rg` (ripgrep) w całym projekcie. **99% jest faktycznie używanych** przez inne pliki przez global scope.

### Wzorzec w projekcie

`shared/ui.js` już stosuje `window.x = x`:

```js
window.escapeHtml = escapeHtml;
window.setText = setText;
window.debounce = debounce;
window.globalUsersMap = new Map();
window.fetchWithTimeout = async function (url, options, timeoutMs) { ... };
window.appConfirm = appConfirm;
window.createSaveIndicator = createSaveIndicator;
window.showModal = function (opts) { ... };
```

Moduł `studnie/` ma **zero** takich eksportów — grep 100+ plików nie znalazł żadnego `window.x = x`. Fix polega na dostosowaniu modułu studni do istniejącego wzorca projektu.

### Pliki i funkcje do rejestracji

Każdy wpis zweryfikowany grepem — funkcja jest używana przez min. 1 inny plik.

| Plik | Linie do dodania na końcu pliku |
|------|-------------------------------|
| `offerSavedList.js` | `window.renderSavedOffersStudnie = renderSavedOffersStudnie;` |
| `offerSummaryBanners.js` | `window.renderOrderBanners = renderOrderBanners;` |
| `offerSummaryTable.js` | `window.renderOfferSummaryTable = renderOfferSummaryTable;` |
| `offerSummaryUI.js` | `window.updateOfferSummaryUI = updateOfferSummaryUI;` |
| `wellDiagram.js` | `window.renderWellDiagram = renderWellDiagram;` |
| `wellUI.js` | `window.setupParamTiles = setupParamTiles;` `window.renderOfferLockBanner = renderOfferLockBanner;` `window.updateAutoLockUI = updateAutoLockUI;` `window.renderWellParams = renderWellParams;` |
| `uiHelpers.js` | `window.exitWizardOrderMode = exitWizardOrderMode;` `window.wizardPrev = wizardPrev;` `window.skipWizardToStep3 = skipWizardToStep3;` `window.loadStudnieProducts = loadStudnieProducts;` `window.renamePlyty = renamePlyty;` `window.loadPrecoPricing = loadPrecoPricing;` `window.savePrecoPricing = savePrecoPricing;` |
| `orderExport.js` | `window.refreshGlobalMetrics = refreshGlobalMetrics;` |
| `orderHelpers.js` | `window.loadOrdersStudnie = loadOrdersStudnie;` `window.saveOrdersDataStudnie = saveOrdersDataStudnie;` |
| `orderKartaBudowy.js` | `window.initKartaBudowyStep4 = initKartaBudowyStep4;` `window.step4NextAction = step4NextAction;` `window.showKartaBudowyCopyPicker = showKartaBudowyCopyPicker;` `window.copyKartaBudowyFromOrder = copyKartaBudowyFromOrder;` |
| `orderPrzejscia.js` | `window.handlePrzejsciaZamowioneChange = handlePrzejsciaZamowioneChange;` `window.updatePrzejscieDnOptions = updatePrzejscieDnOptions;` `window.updatePrzejscieSelectStyle = updatePrzejscieSelectStyle;` `window.addCustomPrzejscieRow = addCustomPrzejscieRow;` `window.removePrzejscieRow = removePrzejscieRow;` `window.collectPrzejsciaDetailsFromTable = collectPrzejsciaDetailsFromTable;` |
| `orderZleceniaData.js` | `window.loadProductionOrders = loadProductionOrders;` `window.deleteProductionOrder = deleteProductionOrder;` `window.acceptProductionOrder = acceptProductionOrder;` `window.revokeProductionOrder = revokeProductionOrder;` |
| `orderZleceniaForm.js` | `window.populateZleceniaForm = populateZleceniaForm;` |
| `orderZleceniaHelpers.js` | `window.getElementStatus = getElementStatus;` `window.parseWysokoscGlebokosc = parseWysokoscGlebokosc;` `window.getStudniaDIN = getStudniaDIN;` `window.calcStopnieExecution = calcStopnieExecution;` `window.buildEtykietaElementsSnapshot = buildEtykietaElementsSnapshot;` |
| `orderZleceniaRender.js` | `window.buildZleceniaWellList = buildZleceniaWellList;` |
| `popupsButtonUpdaters.js` | `window.updateZakonczenieButton = updateZakonczenieButton;` `window.updateRedukcjaButton = updateRedukcjaButton;` `window.onRedukcjaMinChange = onRedukcjaMinChange;` `window.updateRedukcjaZakButton = updateRedukcjaZakButton;` |
| `popupsRedukcjaChoice.js` | `window.openRedukcjaChoicePopup = openRedukcjaChoicePopup;` `window.selectRedukcjaChoice = selectRedukcjaChoice;` |
| `popupsStyczna.js` | `window.showStycznaPopup = showStycznaPopup;` `window.handleStycznaProductChoice = handleStycznaProductChoice;` |
| `popupsTransitionManager.js` | `window.tmEditSelectType = tmEditSelectType;` `window.tmEditApply = tmEditApply;` |
| `pricelistCategory.js` | `window.deletePrzejsciaCategory = deletePrzejsciaCategory;` `window.addStudnieCategory = addStudnieCategory;` `window.addStudnieElement = addStudnieElement;` |
| `pricelistCellEdit.js` | `window.toggleMagazynField = toggleMagazynField;` `window.editStudnieCell = editStudnieCell;` |
| `pricelistImportExport.js` | `window.exportStudnieToExcel = exportStudnieToExcel;` `window.importStudnieFromExcel = importStudnieFromExcel;` |
| `pricelistManager.js` | `window.renderStudniePriceList = renderStudniePriceList;` |
| `pricelistPreco.js` | `window.addPrecoKinetaRow = addPrecoKinetaRow;` `window.removePrecoKinetaRow = removePrecoKinetaRow;` `window.addPrecoRangeRow = addPrecoRangeRow;` `window.removePrecoRangeRow = removePrecoRangeRow;` `window.updatePrecoGrupaKey = updatePrecoGrupaKey;` `window.addPrecoGrupaCol = addPrecoGrupaCol;` `window.removePrecoGrupaCol = removePrecoGrupaCol;` `window.togglePrecoAccordion = togglePrecoAccordion;` `window.savePrecoFromUI = savePrecoFromUI;` `window.loadPrecoDefaults = loadPrecoDefaults;` |
| `pricelistProductCrud.js` | `window.deleteStudnieProduct = deleteStudnieProduct;` `window.copyStudnieProduct = copyStudnieProduct;` `window.showAddStudnieProductModal = showAddStudnieProductModal;` `window.addStudnieProduct = addStudnieProduct;` |
| `pricelistSaveReset.js` | `window.resetStudniePriceList = resetStudniePriceList;` `window.saveStudniePriceList = saveStudniePriceList;` |
| `pricelistState.js` | `window.updateStudnieSaveBtn = updateStudnieSaveBtn;` `window.selectCennikTab = selectCennikTab;` |
| `ringOptimizer.js` | `window.optimizeRingsForDistance = optimizeRingsForDistance;` |
| `ruleEngine.js` | `window.estimateBottomSection = estimateBottomSection;` `window.getLowestDennica = getLowestDennica;` `window.getLowestDennicaHybrid = getLowestDennicaHybrid;` `window.getReductionPlate = getReductionPlate;` `window.getTopClosure = getTopClosure;` `window.getKregiList = getKregiList;` |
| `wellManager.js` | `window.updateParamInput = updateParamInput;` `window.toggleAutoLock = toggleAutoLock;` |
| `wellPopups.js` | `window.openZakonczeniePopup = openZakonczeniePopup;` `window.openRedukcjaZakonczeniePopup = openRedukcjaZakonczeniePopup;` |
| `wellSolver.js` | `window.buildConfigSegments = buildConfigSegments;` `window.applyDrilledRings = applyDrilledRings;` `window.recalculateWellErrors = recalculateWellErrors;` |
| `wellTransitions.js` | `window.renderInlinePrzejsciaApp = renderInlinePrzejsciaApp;` |
| `wellTransitionsCrud.js` | `window.movePrzejscie = movePrzejscie;` `window.removePrzejscieFromWell = removePrzejscieFromWell;` |
| `wellTransitionsHelpers.js` | `window.getMaxPipeDn = getMaxPipeDn;` `window.syncEditState = syncEditState;` |

**Łącznie**: ~30 plików, ~100 linii `window.x = x`.

### Weryfikacja (bez formatowania)

```bash
npx eslint public/js/studnie/offerSavedList.js --no-ignore --quiet
npm run test:quick
```

**Czas**: 90 min

---

## Krok 7 [Low]: Prefix `_` w catch klauzulach

### Problem

~30 catch bloków używa `(e)` lub `(err)` gdzie zmienna nie jest używana. ESLint wymaga prefixu `_`.

### Pliki (zweryfikowane przez grep — zmienna faktycznie nieużywana)

| Plik | Linia | Kod | Fix |
|------|-------|-----|-----|
| `telemetryBridge.js` | 51 | `catch (e) { showToast(...) }` | `catch (_e) {` |
| `telemetryBridge.js` | 245 | `catch (e) { ... }` — sprawdzić czy `e` użyte | jeśli nie → `catch (_e) {` |
| `telemetryBridge.js` | 261 | jw. | jw. |
| `telemetryBridge.js` | 281 | jw. | jw. |
| `orderCrud.js` | 169 | `catch (e) { logger.error(...) }` — sprawdzić | jeśli `e` nie przekazane do logger → `catch (_e) {` |
| `orderExport.js` | 14 | `catch (e) { ... }` | sprawdzić |
| `orderZleceniaData.js` | 135 | `catch (e) { ... }` | sprawdzić |
| `wellSolver.js` | 356 | `catch (e) { ... }` | sprawdzić |

**Zasada**: jeśli zmienna catch jest używana (np. `err.message`, `logger.error(e)`), zostaw. Jeśli nie → prefix `_`.

**Czas**: 25 min

---

## Krok 8 [High]: `no-var` → `let`/`const` (migracja batchowa)

### Problem

~210 błędów `no-var` w ~80 plikach. ESLint nie oferuje auto-fix dla `no-var`.

### Strategia

Migracja w 3 batchach po 5 plików, z git checkpointem między każdym.

### Batch 1 (priority — pliki z największą liczbą `var`)

| Plik | Liczba `var` | Ryzyko |
|------|-------------|--------|
| `excelAddDialog.js` | ~105 | WYSOKIE — dużo zmiennych, blokowy scope |
| `wellSolver.js` | ~100 | WYSOKIE — złożona logika, pętle |
| `wellUI.js` | ~89 | ŚREDNIE — głównie stałe |
| `orderKartaBudowy.js` | ~72 | ŚREDNIE |
| `orderPrzejscia.js` | ~68 | ŚREDNIE |

### Batch 2 (~10 plików po 10-20 `var`)
### Batch 3 (~65 plików po 1-10 `var`)

### Zasady zamiany

| Wzorzec | Zamień na | Uwagi |
|---------|-----------|-------|
| `var name = value;` | `const name = value;` | jeśli nigdy nie reassignowane |
| `var name = value;` | `let name = value;` | jeśli reassignowane |
| `for (var i = 0; ...)` | `for (let i = 0; ...)` | bezpieczne — `i` jest lokalne w pętli |
| `for (var i in arr)` | `for (const i in arr)` | bezpieczne — `const` w `for...in` działa per-iteracja |
| `for (var i of arr)` | `const` lub `let` | zależnie czy reassignowane w pętli |

### Uwaga na hoisting

`var` ma function scope, `let` ma block scope. Szczególnie uważać na:

```js
// PRZED: działa przez hoisting
function fn() {
    var x = 1;
    if (condition) {
        var x = 2; // to samo x!
    }
}

// PO: inna semantyka
function fn() {
    let x = 1;
    if (condition) {
        let x = 2; // inne x!
    }
}
```

### Rollback batcha

```bash
git restore . && git reset --hard HEAD
# Podziel pliki na mniejsze grupy i powtórz
```

**Czas**: 180 min (3 batche × 60 min)

---

## Krok 9 [Medium]: `types.d.ts` cleanup

### 9a. Klasyfikacja `declare` (zweryfikowana)

Każda deklaracja została przeanalizowana pod kątem reassignacji w runtime:

| Linia | Obecnie | Poprawny typ | Uzasadnienie |
|-------|---------|-------------|--------------|
| 131 | `declare var api: ApiClient;` | `declare const api: ApiClient;` | Singleton, inicjalizowany raz |
| 132 | `declare var logger: Logger;` | `declare const logger: Logger;` | Singleton |
| 133 | `declare var auth: AuthModule;` | `declare const auth: AuthModule;` | Singleton |
| 134 | `declare function showToast(...)` | ✅ już `function` | OK |
| 135 | `declare function appConfirm(...)` | ✅ już `function` | OK |
| 136 | `declare function escapeHtml(...)` | ✅ już `function` | OK |
| 137 | `declare function setText(...)` | ✅ już `function` | OK |
| 138 | `declare function authHeaders(...)` | ✅ już `function` | OK |
| 139 | `declare var orderEditMode: any;` | `declare let orderEditMode: boolean \| null;` | **Reassignowane** — togglowane on/off |
| 190 | `declare var clientsDb: ClientData[];` | `declare let clientsDb: ClientData[];` | **Reassignowane** — wczytywane z localStorage |
| 191 | `declare var lucide: { ... }` | `declare const lucide: { ... }` | Stała biblioteka |
| 196 | `declare var fetchWithTimeout: (...)` | `declare function fetchWithTimeout(...)` | To funkcja |
| 201 | `declare function showModal(...)` | ✅ już `function` | OK |
| 214 | `declare var showUniversalPrintModal: ...` | `declare function showUniversalPrintModal(...)` | To funkcja |
| 215 | `declare function closeModal()` | ✅ już `function` | OK |
| 218 | `declare var XLSX: any;` | `declare const XLSX: any;` | Stała biblioteki |
| 219 | `declare var CATEGORIES_STUDNIE: ...` | `declare const CATEGORIES_STUDNIE: Record<string, { label: string; dn: string }>` | Stała |
| 220 | `declare var FLOW_TYPES: ...` | `declare const FLOW_TYPES: Record<string, any>` | Stała |
| 221 | `declare var ConfigSegment: any;` | `declare const ConfigSegment: any;` | Stała (typ) |
| 222 | `declare var currentOrder: any;` | `declare let currentOrder: any;` | **Reassignowane** — zmienia się przy każdej ofercie |
| 223 | `declare var global: typeof globalThis;` | `declare const global: typeof globalThis;` | Stała |
| 224-244 | `declare function autoSelectComponents(...args: any[]): any;` | `declare function` + konkretne typy zamiast `any` | To funkcje — zostawić `any` tymczasowo |
| 247 | `declare var products: any;` | `declare let products: any;` | **Reassignowane** |
| 248 | `declare var offers: any;` | `declare let offers: any;` | **Reassignowane** |
| 249 | `declare var editingOfferId: any;` | `declare let editingOfferId: string \| null;` | **Reassignowane** |
| 250 | `declare var currentOfferItems: any;` | `declare let currentOfferItems: any;` | **Reassignowane** |

### 9b. Zmiany `any` → konkretne typy (tylko tam gdzie bezpieczne)

| Pole | Obecnie | Proponowany typ | Ryzyko |
|------|---------|----------------|--------|
| `orderEditMode` | `any` | `boolean \| null` | NISKIE — to flaga |
| `editingOfferId` | `any` | `string \| null` | NISKIE — to ID |
| `XLSX` | `any` | zostaw `any` (brak typów) | — |
| `CATEGORIES_STUDNIE` | `Record<string, any>` | `Record<string, { label: string; dn: string }>` | ŚREDNIE — sprawdzić strukturę |
| `FLOW_TYPES` | `Record<string, any>` | zostaw tymczasowo | — |
| `ConfigSegment` | `any` | zostaw tymczasowo | — |
| `currentOrder` | `any` | zostaw tymczasowo | WYSOKIE — złożony obiekt |
| `autoSelectComponents` | `(...args: any[]) => any` | zostaw tymczasowo | WYSOKIE — wymaga analizy sygnatur |

**Czas**: 45 min

---

## Krok 10 [Critical]: Walidacja końcowa

### Lista sukcesu (checklist)

| # | Kryterium | Komenda | Oczekiwany wynik |
|---|-----------|---------|------------------|
| 1 | Typecheck backend | `npm run typecheck` | 0 errors |
| 2 | Typecheck frontend | `npm run typecheck:frontend` | 0 errors |
| 3 | Lint backend | `npm run lint` | 0 errors, 0 warnings |
| 4 | Lint frontend | `npm run lint:frontend` | 0 errors (warnings opcjonalne) |
| 5 | Test bezpieczeństwa | `npm run test:quick -- --testPathPatterns=security-regression` | wszystkie pass |
| 6 | Wszystkie testy | `npm run test:quick` | 0 failed |
| 7 | Formatowanie | `npm run format:check` | wszystkie pliki sformatowane |
| 8 | Składnia JS | `node -c public/js/studnie/*.js` | wszystkie OK |
| 9 | Spójność wersji | `npm run version:check` | spójna |
| 10 | Brak zmian w runtime | Uruchom `npm run dev:backend` i sprawdź czy server startuje | OK |

### Jeśli checklista nie jest w 100% zielona

| Scenariusz | Działanie |
|------------|-----------|
| 1-2 failed | Cofnij ostatnie zmiany w TS/JSDoc, napraw błędy typów |
| 3-4 failed | Cofnij ostatnie zmiany ESLint, sprawdź konfigurację |
| 5 failed | Cofnij zmiany w orderManager.js, sprawdź test |
| 6 failed | `npm run test:quick -- --testPathPatterns=<failed-test>` — napraw konkretny test |
| 9 failed | `npm run version:check` pokaże niezgodność — napraw ręcznie |
| 10 failed | Sprawdź logi servera — najprawdopodobniej błąd importu |

### Formatowanie końcowe

```bash
npm run format
```

**Czas**: 5 min

---

## Podsumowanie

| # | Krok | Priorytet | Czas | Ryzyko regresji |
|---|------|-----------|------|-----------------|
| 1 | escapeHtml w orderManager.js | CRITICAL | 1 min | BARDZO NISKIE — dodanie `void` |
| 2 | typecheck → 0 errors | CRITICAL | 35 min | NISKIE — tylko JSDoc + 1 pole w typie |
| 3 | Regression check | HIGH | 2 min | — |
| 4 | no-useless-escape | MEDIUM | 1 min | BARDZO NISKIE — auto-fix |
| 5 | prefer-const | MEDIUM | 5 min | NISKIE — auto-fix, testy po |
| 6 | window.x = x | MEDIUM | 90 min | NISKIE — dodaje, nie usuwa |
| 7 | catch prefix _ | LOW | 25 min | NISKIE — zmiana nazwy zmiennej |
| 8 | no-var → let/const | HIGH | 180 min | **ŚREDNIE/WYSOKIE** — zmiana scoping rules |
| 9 | types.d.ts cleanup | MEDIUM | 45 min | ŚREDNIE — zmiany typów wpływają na wszystkie pliki |
| 10 | Walidacja końcowa | CRITICAL | 5 min | — |
| **Łącznie** | | | **~350 min** | |

### Gdzie czyha największe ryzyko

1. **Krok 8 (no-var)** — zmiana scope z function na block. 60% czasu całego planu. Każdy batch ma własny checkpoint i rollback.
2. **Krok 9 (types.d.ts)** — zmiana `declare var` na `let` może ukryć błąd runtime. Tylko tam gdzie zweryfikowano reassignację.
3. **Krok 6 (window.x = x)** — dodaje kod, nie usuwa. Ryzyko minimalne, ale trzeba sprawdzić czy nie nadpisuje istniejących właściwości.

### Decyzje do podjęcia przed rozpoczęciem

| Decyzja | Opcja A | Opcja B |
|---------|---------|---------|
| **Krok 1** | `void window.escapeHtml;` (zalecane) | Usunąć `orderManager.js` z testu |
| **Krok 8** | 3 batche po 5 plików (zalecane) | Jeden regex na wszystkie 80 plików |
| **Krok 9** | Tylko łatwe typy + `any` tam gdzie ryzykowne (zalecane) | Pełna typizacja wszystkich `any` |

---

## Porównanie v1 → v2 → v3

| Aspekt | v1 | v2 | v3 |
|--------|----|----|----|
| Krok 1 (escapeHtml) | komentarz (hack) | `void window.escapeHtml` | + udokumentowany łańcuch zależności, + opcja poprawy testu |
| no-var | wyłączenie reguły | batch po 5 plików | + tabela ryzyka per plik, + uwaga o hoistingu |
| window.x = x | ogólna lista | lista plików | + dowód że wzorzec istnieje w projekcie (8 przykładów z shared/ui.js) |
| declare var | — | const wszędzie | + podział na const/let, + uzasadnienie każdego |
| Szacunki | 140 min | 350 min | 350 min + rozbicie na priorytety |
| Git checkout | — | `git checkout -- .` | `git restore .` / `git reset --hard HEAD` |
| Formatowanie | na końcu | po każdym kroku | po każdym LOGICZNYM etapie |
| Lista sukcesu | — | — | 10-punktowa checklista |
| Priorytety | — | — | Critical/High/Medium/Low |
| Rollback | — | — | procedura na 2 scenariusze |
| Weryfikacja założeń | — | — | tabela z 5 zweryfikowanymi założeniami |
