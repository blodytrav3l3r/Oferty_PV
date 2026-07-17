# Plan Krok 8: `var` → `let`/`const`

## 1. Status quo (audyt)

| Kategoria            | Ilość | Pliki                             |
| -------------------- | ----- | --------------------------------- |
| Pliki JS (app)       | 137   | `public/js/`                      |
| Pliki z `var`        | 44    | (bez `xlsx.full.min.js` — vendor) |
| Wystąpienia `var`    | ~947  | w 44 plikach                      |
| w `xlsx.full.min.js` | ~3600 | **NIE TYKAĆ**                     |
| Pliki BEZ `var`      | 93    | już używają `let`/`const`         |

### Podział według scope

| Scope                              | Ilość | Ryzyko przy konwersji                                  |
| ---------------------------------- | ----- | ------------------------------------------------------ |
| IIFE (function-scope)              | ~700  | **NISKIE** — lokalne do IIFE, brak leak do global      |
| for-loop header (`for (var i...)`) | ~150  | **NISKIE** — `let` w `for` to domyślnie poprawne JS    |
| closure-in-loop (for+callback)     | ~6    | **POPRAWIA BŁĄD** — `var` powoduje bug, `let` go leczy |
| top-level (poza funkcją)           | ~22   | **ŚREDNIE** — zależy od dostępu przez `window.x`       |
| top-level z `window.x` API         | ~7    | **NAJWYŻSZE** — trzeba jawnie przypisać `window.x`     |

---

## 2. Macierz ryzyka

### 2.1 🔴 Strefa ZAKAZU (0 zmian)

- `public/js/shared/xlsx.full.min.js` — biblioteka SheetJS (minified vendor)
- `public/js/shared/xlsx.full.min.js.LICENSE.txt` — licencja

### 2.2 🟢 Strefa BEZPIECZNA (var → let/const, bardzo niskie ryzyko)

**Wszystkie `var` wewnątrz IIFE** — ~700 wystąpień w ~33 plikach.

- `var` jest function-scoped do IIFE, `let`/`const` też są block/function-scoped
- Ryzyko TDZ (zmienna użyta przed `let` w tej samej funkcji) — bardzo niskie, ale możliwe
- ESLint `no-use-before-define` wykryje to przed migracją
- **Ryzyko**: bardzo niskie po pozytywnej analizie kodu

**Top-level `var` bez `window.x` dostępu** — ~15 wystąpień.

- `let`/`const` na top-level w `<script>` są w global scope
- Są dostępne po nazwie z innych plików — to samo co `var`
- Różnica: `window.nazwa` nie istnieje dla `let`/`const`
- **Ryzyko**: bardzo niskie gdy żaden plik nie używa `window.nazwa`

### ⚠️ CSS `var()` w stringach — CICHY ZABÓJCA

**Nie używaj regex `\bvar\b` do zamiany**. CSS custom properties `var(--nazwa)` występują w stringach HTML/template literals w wielu plikach:

```js
// Przykład: mlHealthDashboard.js:55 — JEDNA linia zawiera i JS var i CSS var()
var color = pct >= 95 ? 'var(--success)' : pct >= 80 ? 'var(--warn)' : 'var(--danger)';
//        ^^ JS keyword           ^^^^^^^^^       ^^^^^^^^      ^^^^ CSS w stringu
```

Regex `\bvar\b` zmieni to na: `let color = ... 'let(--success)' ...` → **CSS zniszczone**.

**Pliki zagrożone**: `admin/aiDashboard.js`, `admin/mlHealthDashboard.js`, `sales/pvSalesUi.js`, `sales/pvImportExportToolbar.js`, `sales/kartotekaInit.js`, `spa/router.js`, `rury/catalogUi.js`, `studnie/actionsConfigRender.js`.

**Rozwiązanie**: NIGDY nie używaj regex do globalnej zamiany `var`. Używaj ESLint `--fix` (AST-safe, nie tknie stringów).

### 2.3 🟡 Strefa KONTROLOWANA (wymaga dodatkowej linii kodu)

**Top-level `var` z `window.x`** — 2 zmienne, 2 pliki:

| Zmienna         | Plik                       | Dostęp przez `window.`              |
| --------------- | -------------------------- | ----------------------------------- |
| `wellDiscounts` | `studnie/globals.js:12`    | 17 miejsc (`window.wellDiscounts`)  |
| `orderEditMode` | `rury/orderManager.js:733` | ~60 miejsc (`window.orderEditMode`) |

**Mitigacja**: po zmianie `var` → `let` dodać `window.nazwa = nazwa;`.

`orderEditMode` już ma `window.orderEditMode = false;` w linii 734 — wystarczy zmienić `var` → `let`.

**Uwaga**: te zmienne są obsługiwane w Fazie 4 (najwyższa ostrożność).

### 2.4 🟢 Strefa POPRAWY (var ukrywa buga)

**for-loop z closure** — 2 pliki, ~6 wystąpień:

- `excelAddDialog.js:320` — `for (var k...)` + IIFE `(function(idx){...})(k)` + `setTimeout`
- `excelTableManager.js:293` — identyczny pattern

Zmiana `var k` → `let k` **usuwa przyczynę** stosowania IIFE workaround. Można usunąć otaczające `(function(idx){...})(k)`.

---

## 3. Fazy wykonania (kolejność: od najbezpieczniejszego)

**Narzędzie podstawowe**: ESLint `--fix` z regułą `no-var`. AST-safe — nie tknie CSS `var(--)` w stringach.
**Zakaz**: regex `\bvar\b` — NIEBEZPIECZNY, zniszczy CSS custom properties w stringach.

**`node -c` — uwaga**: w planie pojawia się jako weryfikacja składni. Jego wartość po pierwszych kilku plikach maleje — ESLint i tak uruchamia parser przy `--fix`. Traktuj `node -c` jako dodatkowe zabezpieczenie, nie główną walidację. Główną walidacją jest `npm run test:quick`.

### Faza 0: Checkpoint

```bash
git add -A; git commit -m "chore: checkpoint before krok8-var-to-let"
```

---

### Faza 1: Closure-in-loop (WYSOKA wartość, NISKIE ryzyko)

**2 pliki, ~6 var → let**

#### Krok 1.1: `excelAddDialog.js`

- **Linie**: 320-334
- **Przed**:

```js
for (var k = 0; k < added; k++) {
    (function (idx) {
        setTimeout(function () {
            var nwi = wells.length - added + idx;
            var w = wells[nwi];
            // ...
        }, 0);
    })(k);
}
```

- **Po**:

```js
for (let k = 0; k < added; k++) {
    setTimeout(function () {
        var nwi = wells.length - added + k;
        var w = wells[nwi];
        // ...
    }, 0);
}
```

- **Weryfikacja**: `node -c public/js/studnie/excelAddDialog.js`
- **Rollback**: `git restore public/js/studnie/excelAddDialog.js`
- **Czas**: 2 min

#### Krok 1.2: `excelTableManager.js`

- **Linie**: 293-306
- **Identyczna zmiana** jak 1.1
- **przed**: `(function (idx) {...})(k)` → usuń IIFE, zmień `var k` → `let k` i `idx` → `k`
- **Weryfikacja**: `node -c public/js/studnie/excelTableManager.js`
- **Rollback**: `git restore public/js/studnie/excelTableManager.js`

#### Verify F1: `npm run test:quick`

---

### Faza 2: Wszystkie `var` → `let`/`const` w IIFE (ESLint --fix, AST-safe)

**~850 var (w tym ~150 for-loop) w ~33 plikach**

**WAŻNE**: Używamy ESLint `--fix` zamiast regex. ESLint jest AST-aware — NIE tknie `var(--color)` w stringach.

**Komenda bazowa** (uruchamiana per plik):

```bash
npx eslint --fix --rule 'no-var: error' --rule 'no-unused-vars: off' --rule 'prefer-const: off' public/js/studnie/plik.js
```

**Dlaczego ESLint?**

- ✅ AST-safe: nie tknie `var(--accent)` w stringach HTML
- ✅ Automatycznie wybiera `let` vs `const` (const gdy brak reassign)
- ✅ Obsługuje `for (var i=0;...)` → `for (let i=0;...)`
- ✅ Obsługuje `for (var key in obj)` → `for (let key in obj)`
- ✅ `var {a,b} = obj` → `const {a,b} = obj`
- ✅ Sprawdza składnię przy okazji (jak `node -c`)
- ❌ **UWAGA**: na top-level zmienia `var` → `let`/`const`, co NIE tworzy `window.x`. Top-level pliki (bez IIFE) wymagają Fazy 4.

**Jak działa ESLint `no-var`?**

- Reguła `no-var` (dziedziczona z `eslint.configs.recommended`) zmienia `var → let`
- **WSZYSTKIE** zmienne dostają `let`, niezależnie czy są reassignowane czy nie
- Reguła `prefer-const` (którą wyłączamy) zmienia `let → const` tam gdzie brak reassign
- **Decyzja**: w Fazach 1-4 celowo używamy `let` wszędzie. Optymalizację `let → const` zostawiamy na Fazę 5

| Wzorzec | Po `no-var` | Po `prefer-const` (Faza 5) |
|---|---|
| `var x = 5;` i nigdy potem `x = ...` | `let x = 5;` | `const x = 5;` |
| `var x = 0; x++` | `let x = 0; x++` | `let x = 0; x++` (brak zmiany) |
| `var x = null; x = find()` | `let x = null; x = find()` | `let` (brak zmiany) |
| `for (var i = 0; ...)` | `for (let i = 0; ...)` | `for (let i = 0; ...)` |
| `var {a,b} = obj` | `let {a,b} = obj` | `const {a,b} = obj` |

#### Part 2a: excelTableRenderer.js (~60 var) + excelTableManager.js (~55 var)

```bash
$files = @('excelTableRenderer.js','excelTableManager.js')
foreach ($f in $files) {
    $p = "I:\GitHub\Oferty_PV\public\js\studnie\$f"
    npx eslint --fix --rule 'no-var: error' --rule 'no-unused-vars: off' --rule 'prefer-const: off' $p
    node -c $p; if ($LASTEXITCODE -eq 0) { Write-Output "$f OK" } else { Write-Output "$f FAIL" }
}
```

- **Weryfikacja**: `node -c` każdy → `npm run test:quick`
- **Rollback**: `git restore public/js/studnie/excelTable*.js`

#### Part 2b: excelHelpers.js (~50 var) + excelAddDialog.js (~49 var) + excelCopyPaste.js (~40 var)

- **Weryfikacja**: `node -c` każdy → `npm run test:quick`

#### Part 2c: excelConfigManager.js, excelCellSelection.js, excelTableBody.js, excelSelection.js, excelColumns.js

- **Weryfikacja**: `node -c` każdy → `npm run test:quick`

#### Part 2d: excelTabs.js, excelPolling.js, excelModal.js, excelReductionColumns.js, excelChangeHandlers.js, excelAutoSelect.js

- **Weryfikacja**: `node -c` każdy → `npm run test:quick`

#### Part 2e: mlDualRanking.js (~30 var)

- **UWAGA**: plik ma zagnieżdżone pętle `for (var i/j/k/l/m/n...)`. ESLint poradzi sobie.
- **Weryfikacja**: `node -c` → `npm run test:quick`

#### Part 2f: shared/aiApi.js, shared/aiUi.js (~60 var)

- **Weryfikacja**: `node -c` każdy → `npm run test:quick`

#### Part 2g: admin/aiDashboard.js, admin/mlHealthDashboard.js (~40 var)

- **⚠️ Te pliki mają CSS `var(--)` w stringach** — ESLint NIE tknie stringów, bezpieczne.
- **Weryfikacja**: `node -c` każdy → `npm run test:quick`

#### Part 2h: shared/iconsSlim.js (~15 var), shared/constants.js (~18 var), shared/api.js (~5 var), actionsConfigSort.js (~4 var), offerWellComponents.js (~10 var)

- **Weryfikacja**: `node -c` każdy → `npm run test:quick`

**Po Fazie 2**: wszystkie `var` wewnątrz IIFE i for-loop są zamienione. Pozostają tylko top-level `var` w standalone files (Faza 3).

---

### Faza 3: Top-level standalone (bez IIFE, bez `window.x`)

**~15 var, bezpieczna zmiana**

**UWAGA**: W tych plikach NIE używamy ESLint --fix (zmieni `var` na `let`/`const`, co nie tworzy `window.x`). Zamiast tego ręczna zmiana dla top-level vars, ESLint dla vars wewnątrz funkcji.

**Wykonaj po 1 pliku, test po każdym:**

#### Krok 3.1: `rury/offerCrud.js` (3 var)

```js
// Linie 6-8 — top-level var. Flagi stanu → let (mogą być zmieniane przez kod)
let editingOfferCreatedByUserId = null;
let editingOfferCreatedByUserName = '';
let isSavingOffer = false;
```

- `let` przezornie — nazwy sugerują zmienne stanu (flagi, userId)
- Jeśli analiza potwierdzi brak reassign → Faza 5 zmieni na `const`
- `node -c` → `npm run test:quick`

#### Krok 3.2: `rury/orderManager.js` (4 var — linie 4-7)

```js
// Linie 4-7 — top-level var (orderEditMode w linii 733 jest w Fazie 4)
const pendingOrderCreationData = null;
const _customPrzejscieRows = [];
const _offerPrzejscieRows = [];
const _przejsciaInitialized = false;
```

- Tu `const` jest bezpieczne — tablice są mutowane przez `.push()`, nie przez reassign
- **UWAGA**: zostaw `var orderEditMode` (linia 733) — idzie w Fazie 4
- `node -c` → `npm run test:quick`

#### Krok 3.3: `studnie/globals.js` (6 var bez window.x — linie 13,25-29)

```js
// Linie 13,25-29 — top-level var. Flagi stanu → let, stałe inicjalizacje → const
let precoPricing = {};
let editingOfferAssignedUserId = null;
let editingOfferAssignedUserName = '';
let editingOfferCreatedByUserId = null;
let editingOfferCreatedByUserName = '';
let isSavingOffer = false;
```

- ⚠️ **Wszystkie `let` przezornie**: nazwy sugerują zmienne stanu (`isSavingOffer` to flaga, `precoPricing` może być resetowane, `editingOffer*` to ID/userName które mogą być nadpisywane)
- Jeśli analiza potwierdzi brak reassign → Faza 5 zmieni na `const`
- **UWAGA**: zostaw `var orderEditMode` (linia 31) i `var wellDiscounts` (linia 12) — one idą w Fazie 4
- `node -c` → `npm run test:quick`

#### Krok 3.4: `studnie/orderPrzejscia.js` (3 var — linie 17-19)

```js
const _customPrzejscieRows = [];
const _offerPrzejscieRows = [];
const _przejsciaInitialized = false;
```

- `const` bezpieczne — tablice mutowane `.push()`, nie reassignowane
- `node -c` → `npm run test:quick`

#### Krok 3.5: `studnie/excelState.js` (1 var — linia 80)

```js
let _excelPasteCancelFlag = false; // let bo flaga jest toggle'owana
```

- `node -c` → `npm run test:quick`

#### Krok 3.6: `studnie/ringOptimizer.js` (1 var — linia 278)

```js
const DP_TIMEOUT_MS = 250; // stała konfiguracyjna
```

- `node -c` → `npm run test:quick`

#### Krok 3.7: `studnie/actionsWellPainting.js` (6 var)

- Wszystkie wewnątrz funkcji poza IIFE → użyj ESLint --fix dla tego pliku
- `npx eslint --fix --rule 'no-var: error' --rule 'no-unused-vars: off' --rule 'prefer-const: off' public/js/studnie/actionsWellPainting.js`
- `node -c` → `npm run test:quick`

#### Krok 3.8: `studnie/actionsWellPricing.js` (10 var)

- Wewnątrz funkcji → ESLint --fix
- `node -c` → `npm run test:quick`

#### Krok 3.9: `studnie/actionsConfigSort.js` (4 var)

- ESLint --fix
- `node -c` → `npm run test:quick`

#### Krok 3.10: `studnie/uiHelpers.js` (1 var)

- ESLint --fix
- `node -c` → `npm run test:quick`

#### Krok 3.11: `rury/dataService.js` (1 var — linia 11)

```js
const result = /** @type {any} */ (...);
```

- `node -c` → `npm run test:quick`

#### Krok 3.12: `versionDisplay.js` (1 var — linia 14)

```js
const versionEl = document.getElementById('app-version-toolbar');
```

- `node -c` → `npm run test:quick`

---

### Faza 4: Top-level `var` z `window.x` API (NAJWYŻSZA OSTROŻNOŚĆ)

**2 pliki, 3 zmienne — RĘCZNIE, po jednej zmianie**

#### Krok 4.1: `studnie/globals.js:12` — `wellDiscounts`

```js
// Przed (linia 12):
var wellDiscounts = {};

// Po:
let wellDiscounts = (window.wellDiscounts = {});
```

- ⚠️ **Wzorzec atomowy**: `let x = window.x = wartość` — zapewnia że obie referencje wskazują na ten sam obiekt od początku
- Gdyby później był reassign `wellDiscounts = {}`, `window.wellDiscounts` dalej wskazuje na stary obiekt — to osobny problem (patrz poniżej)
- **Sprawdź przed zmianą**: `Select-String -Pattern "wellDiscounts\s*=" public/js/studnie/*.js` — czy reassign istnieje? Jeśli tak, wszystkie miejsca muszą używać `window.wellDiscounts`
- **Weryfikacja**: `node -c` → `npm run test:quick`
- **Sprawdź**: `Select-String "window.wellDiscounts" public/js/studnie/*.js` — wszystkie 17 miejsc nadal działa

#### Krok 4.2: `rury/orderManager.js:733` — `orderEditMode`

```js
// Przed (linie 733-734):
var orderEditMode = false;
window.orderEditMode = false;

// Po:
let orderEditMode = false;
window.orderEditMode = false; // ta linia już istnieje — nie trzeba dodawać
```

- **Weryfikacja**: `node -c` → `npm run test:quick`
- **Sprawdź**: `Select-String "window.orderEditMode" public/js/rury/*.js` — wszystkie ~60 miejsc nadal działa

#### Krok 4.3: `studnie/globals.js:31` — `orderEditMode` (studnie)

```js
// Przed (linia 31):
var orderEditMode = null;

// Po:
let orderEditMode = null;
```

- **Sprawdź**: `Select-String "window.orderEditMode" public/js/studnie/*.js` — jeśli nie ma, samo `let` wystarczy
- `node -c` → `npm run test:quick`

---

### Faza 5: `const` optymalizacja (opcjonalna)

Po wszystkich zmianach (wszystko już na `let`), przejdź przez pliki i zmień na `const` tam gdzie to bezpieczne.

**Narzędzie**: ESLint `prefer-const` już jest `warn` w configu. Uruchom:

```bash
npx eslint --fix --rule 'prefer-const: error' --rule 'no-var: off' --rule 'no-unused-vars: off' public/js/studnie/excelHelpers.js
```

**⚠️ UWAGA**: ESLint może zasugerować `const` dla zmiennych które są reassignowane przez `.push()` lub `.pop()` (mutable). To jest FALSE POSITIVE — `const` z mutacją to poprawny JS i często zamierzony. ESLint --fix NIE zmieni takich przypadków (bo to nie jest reassign).

**Reguła**: zmień na `const` TYLKO gdy zmienna ma 1 przypisanie (inicjalizacja) i NIGDY potem nie jest reassignowana (ani przez `=`, ani przez `.push()`/`.pop()`/`.delete`). ESLint --fix jest bezpieczny — nie rusza przypadków z `.push()`. **Można użyć bez obaw.**

---

### TDZ (Temporal Dead Zone) — weryfikacja przed wykonaniem

Zanim zaczniesz Fazy 2-3, sprawdź czy w plikach nie ma patternu "użycie var przed deklaracją":

**Problem**: `var` hoistuje deklarację (wartość `undefined`), `let` ma TDZ → `ReferenceError` przy użyciu przed deklaracją.

**`node -c` NIE WYKRYJE TDZ** — to błąd runtime, nie składniowy.  
**Grep też nie wykryje** — potrzebna analiza semantyczna, nie tekstowa.

**Weryfikacja przed migracją** — użyj ESLint `no-use-before-define`:

```bash
npx eslint --rule 'no-use-before-define: error' --rule 'no-var: off' public/js/studnie/excelHelpers.js
```

Jeśli ESLint nie zgłosi błędów `no-use-before-define`, ryzyko TDZ jest zerowe.

**Weryfikacja po migracji** — uruchom przeglądarkę i sprawdź konsolę (linie z `ReferenceError`).

**Ostateczne zabezpieczenie**: testy runtime. Wszystkie 1265 testów przechodzą → brak ReferenceError w testowanych ścieżkach. Dla pozostałych ścieżek — testy integracyjne w przeglądarce.

---

## 4. Procedura awaryjna (rollback)

### Dla pojedynczego kroku:

```bash
git restore <ścieżka_do_pliku>
```

### Dla całej fazy:

```bash
# Jeśli był commit checkpoint przed fazą:
git checkout -- <ścieżki_plików>
# lub:
git restore .
```

### Dla całego Kroku 8:

```bash
# wrócić do checkpoint przed Faza 0:
git log --oneline -5  # znajdź commit "checkpoint before krok8-var-to-let"
git reset --hard HEAD~1  # cofnij jeden commit (jeśli nic innego nie było)
```

### Sygnały do rollbacku:

1. `node -c` zwraca błąd składni → rollback pliku
2. `npm run test:quick` pokazuje FAIL → rollback ostatniej partii
3. Konsola przeglądarki pokazuje `ReferenceError: xxx is not defined` → sprawdź czy zmienna nie jest używana przez `window.x`

---

## 5. Walidacja końcowa (checklista po wszystkich fazach)

- [ ] `Select-String -Pattern "\bvar\b" public/js/studnie/*.js public/js/rury/*.js shared/*.js admin/*.js sales/*.js spa/*.js` — sprawdzić czy nie zostały `var` (poza xlsx.full.min.js)
- [ ] `Select-String -Pattern "\beval\s*\(" public/js/*.js` — upewnić się że nie ma dynamicznego kodu który mógłby zależeć od `var`
- [ ] `npm run typecheck` — backend TypeScript (0 błędów)
- [ ] `npm run typecheck:frontend` — frontend JSDoc types (0 błędów)
- [ ] `npm run lint` — ESLint (0 błędów)
- [ ] `npm run test:quick` — 1265 testów (0 failed)
- [ ] `npm run format` — Prettier (bez zmian)
- [ ] Otworzyć `app.html` w przeglądarce, przejść do modułu studnie i rury, sprawdzić konsolę (0 ReferenceError)
- [ ] `console.log(typeof window.wellDiscounts)` w konsoli — działa (object)
- [ ] `console.log(typeof window.orderEditMode)` w konsoli — działa (boolean lub object)
- [ ] Zaktualizować `eslint.config.mjs` — dodać `no-var: 'error'` w sekcji `public/js/`
- [ ] `git diff --stat` — podsumowanie zmian (~900 zmienionych linii)

---

## 6. Załącznik: Pełna lista plików

### 6.1 Pliki z IIFE (ESLint --fix, Faza 2)

| Plik                               | Var count | For-var count | Part |
| ---------------------------------- | --------- | ------------- | ---- |
| `studnie/excelTableRenderer.js`    | ~60       | ~5            | 2a   |
| `studnie/excelTableManager.js`     | ~55       | ~4            | 2a   |
| `studnie/excelHelpers.js`          | ~50       | ~10           | 2b   |
| `studnie/excelAddDialog.js`        | ~49       | ~3            | 2b   |
| `studnie/excelCopyPaste.js`        | ~40       | ~2            | 2b   |
| `studnie/excelConfigManager.js`    | ~35       | ~3            | 2c   |
| `studnie/excelCellSelection.js`    | ~30       | ~2            | 2c   |
| `studnie/excelTableBody.js`        | ~30       | ~2            | 2c   |
| `studnie/excelSelection.js`        | ~25       | ~3            | 2c   |
| `studnie/excelColumns.js`          | ~25       | ~2            | 2c   |
| `studnie/excelTabs.js`             | ~25       | ~2            | 2d   |
| `studnie/excelPolling.js`          | ~20       | ~2            | 2d   |
| `studnie/excelModal.js`            | ~20       | ~1            | 2d   |
| `studnie/excelReductionColumns.js` | ~20       | ~2            | 2d   |
| `studnie/excelChangeHandlers.js`   | ~20       | ~1            | 2d   |
| `studnie/excelAutoSelect.js`       | ~7        | ~0            | 2d   |
| `studnie/mlDualRanking.js`         | ~30       | ~7            | 2e   |
| `studnie/offerWellComponents.js`   | ~10       | ~1            | 2h   |
| `shared/iconsSlim.js`              | ~15       | ~4            | 2h   |
| `shared/aiApi.js`                  | ~30       | ~0            | 2f   |
| `shared/aiUi.js`                   | ~30       | ~0            | 2f   |
| `shared/constants.js`              | ~18       | ~1            | 2h   |
| `shared/api.js`                    | ~5        | ~1            | 2h   |
| `shared/auth.js`                   | ~1        | ~0            | 2h   |
| `admin/aiDashboard.js`             | ~25       | ~0            | 2g   |
| `admin/mlHealthDashboard.js`       | ~15       | ~0            | 2g   |

### 6.2 Pliki standalone (Faza 3 i 4)

| Plik                             | Var count          | Z `window.x`    | Faza      |
| -------------------------------- | ------------------ | --------------- | --------- |
| `studnie/globals.js`             | 8 (2 z `window.x`) | `wellDiscounts` | 🟡 Faza 4 |
| `rury/orderManager.js`           | 5 (1 z `window.x`) | `orderEditMode` | 🟡 Faza 4 |
| `studnie/orderPrzejscia.js`      | 3                  | —               | 🟢 Faza 3 |
| `rury/offerCrud.js`              | 3                  | —               | 🟢 Faza 3 |
| `studnie/excelState.js`          | 1                  | —               | 🟢 Faza 3 |
| `studnie/ringOptimizer.js`       | 1                  | —               | 🟢 Faza 3 |
| `studnie/actionsWellPainting.js` | 6                  | —               | 🟢 Faza 3 |
| `studnie/actionsWellPricing.js`  | 10                 | —               | 🟢 Faza 3 |
| `studnie/actionsConfigSort.js`   | 4                  | —               | 🟢 Faza 3 |
| `studnie/uiHelpers.js`           | 1                  | —               | 🟢 Faza 3 |
| `rury/dataService.js`            | 1                  | —               | 🟢 Faza 3 |

### 6.3 Pliki wykluczone (vendor)

- `shared/xlsx.full.min.js` (~3600 var) — SheetJS — **NIE TYKAĆ**

---

### Redeklaracje — sprawdź przed migracją

`var` pozwala na redeklarację w tym samym scope. `let`/`const` rzucają `SyntaxError`.

```bash
# Znajdź podejrzane podwójne deklaracje
Select-String -Pattern "^\s+var\s+(\w+)" public/js/studnie/excelTableRenderer.js | Group-Object { $_.Matches.Groups[1].Value } | Where-Object { $_.Count -gt 1 }
```

Jeśli ESLint nie zgłasza błędów na tych plikach, redeklaracje nie występują (ESLint wykrywa `no-redeclare` z `eslint.configs.recommended`).

### Dynamiczny kod — sprawdź przed migracją

`eval`, `new Function`, `with` mogą tworzyć zmienne które `let` obsłuży inaczej niż `var`.

```bash
Select-String -Pattern "\beval\s*\(" public/js/studnie/*.js
Select-String -Pattern "\bnew\s+Function\s*\(" public/js/studnie/*.js
Select-String -Pattern "\bwith\s*\(" public/js/studnie/*.js
```

Jeśli któreś występują, wymagają osobnej analizy (ale w tym projekcie nie powinny — to jest rzadki pattern w nowoczesnym JS).

### ESLint rules po migracji — zabezpieczenie przed powrotem

Po zakończeniu Kroku 8, dodaj do `eslint.config.mjs` w sekcji `public/js/`:

```js
rules: {
    'no-var': 'error',
    'prefer-const': 'warn',
    'no-use-before-define': ['warn', { functions: false, classes: false }],
    // ... istniejące reguły
}
```

Dzięki temu problem `var` nie wróci w przyszłych commitach.

---

### Script load order — weryfikacja top-level `let`

Gdy zmieniasz top-level `var` na `let` (Faza 3 i 4), sprawdź czy plik który deklaruje zmienną jest ładowany PRZED plikami które jej używają.

```bash
# Znajdź kolejność ładowania skryptów w HTML
Select-String -Pattern '<script' public/rury.html | Select-Object -First 20
Select-String -Pattern '<script' public/studnie.html | Select-Object -First 20
```

**Uwaga**: hoisting nie działa między plikami. Każdy `<script>` wykonuje się osobno.

Z `var`: zmienna na top-level tworzy właściwość `window.x`, dostępną dla kolejnych skryptów.  
Z `let`: zmienna na top-level NIE tworzy `window.x`, ale jest w global scope i dostępna po nazwie.  
**Różnica**: jeśli plik B wywoła `typeof x` przed załadowaniem pliku A, to:

- Z `var`: `typeof x === 'undefined'` (właściwość istnieje na window, wartość undefined)
- Z `let`: `ReferenceError: x is not defined` (let nie istnieje na window)

**W praktyce**: w projekcie wszystkie pliki są ładowane w HTML w kolejności zależności (najpierw definicje, potem użycie). To jest bezpieczne. Dla `typeof` checks — nie ma ich w kodzie dla tych zmiennych.

---

## 7. Szacowany czas i podsumowanie

| Faza                    | Kroki                | Szac. czas | Ryzyko               |
| ----------------------- | -------------------- | ---------- | -------------------- |
| 0: Checkpoint           | 1 commit             | 1 min      | Zerowe               |
| 1: Closure fix          | 2 pliki              | 5 min      | Poprawia bug         |
| 2: ESLint --fix IIFE    | ~850 var, 8 partii   | 25 min     | Niskie (AST-safe)    |
| 3: top-level standalone | 12 plików, 12 kroków | 15 min     | Niskie               |
| 4: window.x API         | 2 pliki              | 5 min      | Średnie (mitygowane) |
| 5: const optymalizacja  | opcjonalnie          | 5 min      | Niskie (ESLint-safe) |
| Walidacja końcowa       | checklista           | 5 min      | —                    |

**Razem**: ~60 min (bez Fazy 5)
**Commity**: 1 (checkpoint) + ~10 (po każdej partii) + 1 (final) = ~12 commity
**Weryfikacje**: ~12× `node -c` + ~10× `npm run test:quick`
