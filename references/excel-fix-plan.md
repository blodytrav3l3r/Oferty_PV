# PLAN NAPRAW EXCEL TABLE MANAGER

## Zweryfikowane DN i ich właściwości

| DN | Redukcja | Nadbudowa | Uwagi |
|----|----------|-----------|-------|
| 1000 | ✅ tak | - | |
| 1200 | ✅ tak | - | |
| 1500 | ✅ tak | - | |
| 2000 | ✅ tak | - | |
| 2500 | ✅ tak | - | ⚠️ pominięte w Excel |
| styczne | ❌ nie | DN1000/DN1200 via `stycznaNadbudowa1200` | ⚠️ Excel nie filtruje nadbudowy |

---

## ETAP 1 — POPRAWNOŚĆ DANYCH (wszystkie średnice)

### 1a) `getHasReduction` — dodaj DN2500

**Plik:** `excelTableManager.js`

```javascript
// ZAMIAST:
function getHasReduction(well, dn) {
    if (!well) return !!dn && ['1000', '1200', '1500', '2000'].includes(String(dn));
    return ['1000', '1200', '1500', '2000'].includes(String(well.dn));
}
// MA BYĆ:
function getHasReduction(well, dn) {
    if (!well) return !!dn && ['1000','1200','1500','2000','2500'].includes(String(dn));
    return ['1000','1200','1500','2000','2500'].includes(String(well.dn));
}
```

### 1b) `hasReduction` w `_excelRenderTable` — dodaj DN2500

**Plik:** `excelTableManager.js` (linia ~998)

```javascript
// ZAMIAST:
const hasReduction = ['1000', '1200', '1500', '2000'].includes(dn);
// MA BYĆ:
const hasReduction = ['1000', '1200', '1500', '2000', '2500'].includes(dn);
```

### 1c) Styczne — filtracja nadbudowy w `_excelGetComponentsForDn`

**Plik:** `excelTableManager.js` (linie 198-204)

```javascript
// ZAMIAST:
if (dn === 'styczna') {
    products = products.filter(
        (p) => p.dn === 'styczna' || p.dn === null || p.componentType === 'styczna'
    );
}
// MA BYĆ:
if (dn === 'styczna') {
    const effDn = well && well.stycznaNadbudowa1200 ? 1200 : 1000;
    products = products.filter(
        (p) => p.dn === 'styczna' || p.dn === null || p.componentType === 'styczna' ||
              parseInt(p.dn) === effDn
    );
}
```

### 1d) `_excelGetWellConfigHash` — dodaj brakujące parametry

**Plik:** `excelTableManager.js` (linie 14-32)

Dodać do tablicy `wellParams`:
```javascript
well.spocznikH || '',
well.redukcjaTargetDN || '',
well.wkladkaOsadnikPreco || '',
well.stycznaNadbudowa1200 ? '1' : '0',
```

### 1e) `_excelGetColumnStructureHash` — dodaj brakujące parametry

**Plik:** `excelTableManager.js` (linie 47-57)

Dodać do tablicy:
```javascript
well.kineta || '',
well.wkladkaZwienczenie || '',
well.wkladkaOsadnikPreco || '',
well.stycznaNadbudowa1200 ? '1' : '0',
```

### 1f) Resize kolumn — trwałość po re-renderze

**Plik:** `excelTableManager.js`

**Krok 1:** Dodaj stan globalny (koło linii 10):
```javascript
let _excelColWidths = {};
```

**Krok 2:** W `_excelInitColumnResize` (po `cell.style.minWidth = newWidth + 'px'`):
```javascript
_excelColWidths[dnColKey] = newWidth;
```

**Krok 3:** W `_excelRenderTable`, po zakończeniu generowania HTML (przed `container.innerHTML = html` lub zaraz po), zastosuj zapisane szerokości:
```javascript
// Po wstrzyknięciu HTML, odczytaj TH i zastosuj szerokości
setTimeout(() => {
    if (!container) return;
    Object.keys(_excelColWidths).forEach(key => {
        const [d, colId] = key.split('-', 2);
        if (d === dn) {
            const th = container.querySelector(`th[data-col="${colId}"]`);
            if (th) {
                th.style.minWidth = _excelColWidths[key] + 'px';
                th.style.width = _excelColWidths[key] + 'px';
            }
        }
    });
}, 0);
```

---

## ETAP 2 — STABILNOŚĆ I WYDAJNOŚĆ

### 2a) Magazyn — z pierwszej studni w danym DN, nie wells[0]

**Plik:** `excelTableManager.js` (linia ~188)

```javascript
// ZAMIAST:
const mag = typeof wells !== 'undefined' && wells.length > 0
    ? wells[0].magazyn || 'Kluczbork'
    : 'Kluczbork';
// MA BYĆ — użyj parametru well (przekazanego do funkcji):
const mag = well && well.magazyn ? well.magazyn
    : (typeof wells !== 'undefined' && wells.length > 0 ? wells[0].magazyn || 'Kluczbork' : 'Kluczbork');
```

### 2b) Usuń duplikację event listenera keydown

**Plik:** `excelTableManager.js`

W `openExcelTableModal` — zostaw keydown TYLKO na overlay (Escape). Usuń `keydown` z container.
Lub odwrotnie — zostaw nawigację na container, a na overlay tylko Escape.

**Najprościej:** Usuń z overlay linie z `_excelHandleTab` i `_excelHandleArrow`, zostaw tylko Escape.
```javascript
// W overlay.addEventListener — ZAMI AST:
if (e.key === 'Escape') closeExcelTableModal();
if (e.key === 'Tab') _excelHandleTab(e);
if (e.key.startsWith('Arrow')) _excelHandleArrow(e);
// ZOSTAW TYLKO:
if (e.key === 'Escape') closeExcelTableModal();
```
Container ma już arrow handler — to wystarczy. Tab działa natywnie.

### 2c) Delegacja onclick TR zamiast inline

**Plik:** `excelTableManager.js`

**Krok 1:** Usuń `onclick="..."` z każdego `<tr>` (linia ~1211).
**Krok 2:** Dodaj jeden event listener po otwarciu modala:
```javascript
// W openExcelTableModal, po stworzeniu container:
container.addEventListener('click', function(e) {
    const row = e.target.closest('tr[data-widx]');
    if (row && !e.target.closest('button') && !e.target.closest('input') && !e.target.closest('select')) {
        excelSelectRow(parseInt(row.getAttribute('data-widx')));
    }
});
```

### 2d) Cache dla resolveEffectiveProduct

**Plik:** `excelTableManager.js`

**Krok 1:** Dodaj funkcję cache:
```javascript
function _excelGetResolution(well, item) {
    if (!well.__resCache) well.__resCache = {};
    const key = item.productId + ':' + (item.quantity || 0);
    if (!well.__resCache[key]) {
        well.__resCache[key] = typeof resolveEffectiveProduct === 'function'
            ? resolveEffectiveProduct(well, item.productId, item)
            : null;
    }
    return well.__resCache[key];
}
```

**Krok 2:** W `_excelGetWellProdCode` i `_excelGetWellProdPrice` zamień:
```javascript
// ZAMIAST:
var resolved = typeof resolveEffectiveProduct === 'function'
    ? resolveEffectiveProduct(well, item.productId, item)
    : null;
// NA:
var resolved = _excelGetResolution(well, item);
```

**Krok 3:** Inwalidacja cache przy zmianie configu:
W `excelOnCompChange`, `excelOnRzednaChange` itp. po zmianie configu:
```javascript
delete well.__resCache;
// lub dedykowana funkcja:
function _excelClearResCache(well) { delete well.__resCache; }
```

### 2e) Blokada rekurencji dla relief pair

**Plik:** `excelTableManager.js`

**Krok 1:** Dodaj stan globalny:
```javascript
let _excelAddingReliefPair = false;
```

**Krok 2:** W `excelOnCompChange` przed dodawaniem relief pair:
```javascript
if (_excelAddingReliefPair) return;
_excelAddingReliefPair = true;
// ... reszta kodu ...
setTimeout(() => { _excelAddingReliefPair = false; }, 100);
```

### 2f) ExcelDeleteWell — synchronizacja podglądu

**Plik:** `excelTableManager.js` (linia ~2531)

Po `showToast('Studnia usunięta', 'info');` dodaj:
```javascript
if (typeof renderWellConfig === 'function') renderWellConfig();
if (typeof updateWellParamPreviews === 'function') updateWellParamPreviews();
```

---

## ETAP 3 — UI I UX

### 3a) Sticky header — CSS klasy

**Plik:** `studnie.css` (dodaj)

```css
.excel-th-sticky-h3 { position: sticky; top: 0; z-index: 20; background: #13151f; }
.excel-th-sticky-h1 { position: sticky; top: 1.4rem; z-index: 20; background: #13151f; }
.excel-th-sticky-h2 { position: sticky; top: 3.2rem; z-index: 20; background: #13151f; }
```

**Plik:** `excelTableManager.js` — w `_excelRenderTable` zamień `style="position:sticky;top:0;z-index:20;"` na `class="excel-th-sticky-h3"` itp. dla trzech wierszy.

### 3b) Placeholder rzędnej włazu — czytelniejszy

**Plik:** `excelTableManager.js` (linia ~1234)

```javascript
// ZAMIAST:
const rzWlPlaceholder = !hasExplicitRzWl && well.rzednaDna != null ? well.rzednaDna.toFixed(3) : '';
// NA:
const rzWlPlaceholder = !hasExplicitRzWl && well.rzednaDna != null
    ? 'auto (' + well.rzednaDna.toFixed(3) + ')' : '';
```

### 3c) _excelAutoSetWłaz — konfigurowalna wysokość

**Plik:** `excelTableManager.js` (linia ~731)

```javascript
// ZAMIAST:
const chosen = avail.find((p) => parseInt(p.height) === 150) || avail[0];
// NA — sprawdź parametr oferty, domyślnie 150:
const defaultWlazH = typeof window.offerDefaultWlazH !== 'undefined' ? window.offerDefaultWlazH : 150;
const chosen = avail.find((p) => parseInt(p.height) === defaultWlazH) || avail[0];
```

---

## PODSUMOWANIE ZMIAN PER ŚREDNICA

| # | Zmiana | 1000 | 1200 | 1500 | 2000 | 2500 | styczne | Plik |
|---|--------|------|------|------|------|------|---------|------|
| 1a | getHasReduction | ✅ | ✅ | ✅ | ✅ | **+** | - | .js |
| 1b | hasReduction render | ✅ | ✅ | ✅ | ✅ | **+** | - | .js |
| 1c | Nadbudowa stycznych | - | - | - | - | - | **+** | .js |
| 1d | Hash config parametry | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | .js |
| 1e | Hash struktury parametry | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | .js |
| 1f | Resize trwały | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | .js |
| 2a | Magazyn per-DN | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | .js |
| 2b | Event listenery | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | .js |
| 2c | Delegacja onclick | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | .js |
| 2d | Cache resolve | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | .js |
| 2e | Blokada rekurencji | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | .js |
| 2f | DeleteWell sync | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | .js |
| 3a | CSS klasy header | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | .js+.css |
| 3b | Placeholder rzędnej | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | .js |
| 3c | Właz wysokość | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | .js |

---

## KOLEJNOŚĆ WDROŻENIA

```
ETAP 1 → ETAP 2 → ETAP 3
  (dane)   (stabilność)  (UI)
```

Każdy etap: `npm run typecheck` + test w przeglądarce.
Po ETAP 3: commit i push.
