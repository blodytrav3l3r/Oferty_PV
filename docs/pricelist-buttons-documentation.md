# Pricelist Button Documentation — WITROS Oferty PV

> **Last updated:** 2026-07-23
> **Scope:** All 3 modules: Rury, Studnie, PRECO
> **Based on:** `pricelist.html` (rury), `public/partials/studnie/pricelist.html`, `pricelistUi.js`, `pricelistManager.js`, `pricelistPreco.js`, `pricelistSaveReset.js`, `pricelistProductCrud.js`, `pricelistCategory.js`, `pricelistImportExport.js`, `dataService.js`, `uiHelpers.js`, `shared/ui.js`, backend routes (`productsV2.ts`, `productsStudnieV2.ts`, `precoPricingV2.ts`, `priceOverrides.ts`), `ADR-005-unified-pricing.md`

---

## 1. Button Inventory Table

### 1.1 Rury — globalne przyciski (pricelist.html)

| #   | Button                        | Label                                          | HTML File             | Line  | onclick Handler                                        | JS Function File     | Backend Endpoint            | Method | Auth                       | Lock      | Lock Code                     |
| --- | ----------------------------- | ---------------------------------------------- | --------------------- | ----- | ------------------------------------------------------ | -------------------- | --------------------------- | ------ | -------------------------- | --------- | ----------------------------- |
| R1  | Dodaj                         | `btn btn-primary`                              | `rury/pricelist.html` | 18    | `showAddProductModal()`                                | `pricelistUi.js:236` | — (local only)              | —      | —                          | —         | —                             |
| R2  | Zapisz                        | `btn btn-secondary` (id: `btn-save-pricelist`) | `rury/pricelist.html` | 21    | `savePriceList()`                                      | `pricelistUi.js:212` | `/api/products`             | `PUT`  | requireAuth + requireAdmin | writeLock | `acquireLock()` → 429 if busy |
| R3  | Sync cen                      | `btn btn-secondary`                            | `rury/pricelist.html` | 24    | `syncPriceOverrides()`                                 | `shared/ui.js:600`   | `/api/price-overrides/sync` | `POST` | requireAuth + requireAdmin | —         | —                             |
| R4  | Reset                         | `btn btn-secondary`                            | `rury/pricelist.html` | 27    | `resetPriceList()`                                     | `pricelistUi.js:184` | `/api/products/default`     | `GET`  | requireAuth                | —         | —                             |
| R5  | Eksportuj Excel               | `btn btn-secondary`                            | `rury/pricelist.html` | 30    | `exportRuryToExcel()`                                  | `pricelistUi.js:309` | — (client-side XLSX)        | —      | —                          | —         | —                             |
| R6  | Importuj Excel                | `btn btn-secondary`                            | `rury/pricelist.html` | 33    | `document.getElementById('import-rury-excel').click()` | `pricelistUi.js:342` | — (client-side XLSX)        | —      | —                          | —         | —                             |
| R7  | Powiel (per-row)              | `btn-icon`                                     | `rury/pricelist.html` | 72    | `copyProduct('${id}')`                                 | `pricelistUi.js:143` | — (local only)              | —      | —                          | —         | —                             |
| R8  | Usuń (per-row)                | `btn-icon del`                                 | `rury/pricelist.html` | 73    | `deleteProduct('${id}')`                               | `pricelistUi.js:169` | — (local only)              | —      | —                          | —         | —                             |
| R9  | Inline edit (per-cell)        | editable `<span>`                              | `rury/pricelist.html` | 65-70 | `editCell(this,'field','${id}')`                       | `pricelistUi.js:93`  | — (local only)              | —      | —                          | —         | —                             |
| R10 | Modal "Dodaj produkt" confirm | `btn btn-primary`                              | in modal (dynamic)    | 255   | `addProduct()`                                         | `pricelistUi.js:262` | — (local only)              | —      | —                          | —         | —                             |

### 1.2 Studnie — globalne przyciski (studnie/pricelist.html)

| #   | Button                           | Label                                                  | HTML File                       | Line        | onclick Handler                                           | JS Function File               | Backend Endpoint                | Method | Auth                       | Lock      | Lock Code                     |
| --- | -------------------------------- | ------------------------------------------------------ | ------------------------------- | ----------- | --------------------------------------------------------- | ------------------------------ | ------------------------------- | ------ | -------------------------- | --------- | ----------------------------- |
| S1  | Dodaj                            | `btn btn-primary`                                      | `studnie/pricelist.html`        | 21          | `showAddStudnieProductModal()`                            | `pricelistProductCrud.js:37`   | — (local only)                  | —      | —                          | —         | —                             |
| S2  | Zapisz                           | `btn btn-secondary` (id: `btn-save-studnie-pricelist`) | `studnie/pricelist.html`        | 24-30       | `saveStudniePriceList()`                                  | `pricelistSaveReset.js:32`     | `/api/products-studnie`         | `PUT`  | requireAuth + requireAdmin | writeLock | `acquireLock()` → 429 if busy |
| S3  | Sync cen                         | `btn btn-secondary`                                    | `studnie/pricelist.html`        | 31          | `syncPriceOverrides()`                                    | `shared/ui.js:600`             | `/api/price-overrides/sync`     | `POST` | requireAuth + requireAdmin | —         | —                             |
| S4  | Reset                            | `btn btn-secondary`                                    | `studnie/pricelist.html`        | 51          | `resetStudniePriceList()`                                 | `pricelistSaveReset.js:2`      | `/api/products-studnie/default` | `GET`  | requireAuth                | —         | —                             |
| S5  | Eksportuj Excel                  | `btn btn-secondary`                                    | `studnie/pricelist.html`        | 34          | `exportStudnieToExcel()`                                  | `pricelistImportExport.js:1`   | — (client-side XLSX)            | —      | —                          | —         | —                             |
| S6  | Importuj Excel                   | `btn btn-secondary`                                    | `studnie/pricelist.html`        | 37          | `document.getElementById('import-studnie-excel').click()` | `pricelistImportExport.js:163` | — (client-side XLSX)            | —      | —                          | —         | —                             |
| S7  | Powiel (per-row)                 | `btn-icon`                                             | `pricelistManager.js` (dynamic) | 243         | `copyStudnieProduct('${id}')`                             | `pricelistProductCrud.js:17`   | — (local only)                  | —      | —                          | —         | —                             |
| S8  | Usuń (per-row)                   | `btn-icon del`                                         | `pricelistManager.js` (dynamic) | 244         | `deleteStudnieProduct('${id}')`                           | `pricelistProductCrud.js:2`    | — (local only)                  | —      | —                          | —         | —                             |
| S9  | Inline edit (per-cell)           | `onclick` on `<td>`                                    | `pricelistManager.js` (dynamic) | 193-241     | `editStudnieCell(this,'field','${id}')`                   | `pricelistCellEdit.js:17`      | — (local only)                  | —      | —                          | —         | —                             |
| S10 | Toggle magazyn/active (per-cell) | `onclick` on `<td>`                                    | `pricelistManager.js` (dynamic) | 204,233-236 | `toggleMagazynField(this,'field','${id}')`                | `pricelistCellEdit.js:2`       | — (local only)                  | —      | —                          | —         | —                             |
| S11 | Przelicz PEHD                    | `btn btn-secondary btn-sm`                             | `pricelistManager.js` (dynamic) | 101         | `recalculatePEHD()`                                       | (in app_studnie.js)            | — (local only)                  | —      | —                          | —         | —                             |
| S12 | Dodaj kategorię                  | `btn btn-secondary`                                    | `pricelistManager.js` (dynamic) | 102         | `addStudnieCategory()`                                    | `pricelistCategory.js:69`      | — (local only)                  | —      | —                          | —         | —                             |
| S13 | Dodaj element (in-header)        | `btn-icon`                                             | `pricelistManager.js` (dynamic) | 173         | `addStudnieElement('${key}')`                             | `pricelistCategory.js:109`     | — (local only)                  | —      | —                          | —         | —                             |
| S14 | Usuń kategorię (in-header)       | `btn-icon del`                                         | `pricelistManager.js` (dynamic) | 175         | `deleteStudnieCategory('${key}')`                         | `pricelistCategory.js:181`     | — (local only)                  | —      | —                          | —         | —                             |
| S15 | Dodaj kategorię przejść          | `btn btn-secondary`                                    | `pricelistManager.js` (dynamic) | 102         | `addPrzejsciaCategory()`                                  | `pricelistCategory.js:2`       | — (local only)                  | —      | —                          | —         | —                             |
| S16 | Modal "Dodaj element" confirm    | `btn btn-primary`                                      | in modal (dynamic)              | 91          | `addStudnieProduct()`                                     | `pricelistProductCrud.js:113`  | — (local only)                  | —      | —                          | —         | —                             |

### 1.3 PRECO — przyciski wewnątrz zakładki (w renderPrecoPriceList)

| #   | Button                                   | Label                       | HTML                          | Line | onclick Handler                                                   | JS Function File        | Backend Endpoint             | Method | Auth                       | Lock      | Lock Code                     |
| --- | ---------------------------------------- | --------------------------- | ----------------------------- | ---- | ----------------------------------------------------------------- | ----------------------- | ---------------------------- | ------ | -------------------------- | --------- | ----------------------------- |
| P1  | Reset (PRECO)                            | `btn btn-secondary pill-sm` | `pricelistPreco.js` (dynamic) | 23   | `loadPrecoDefaults()`                                             | `pricelistPreco.js:304` | `/api/preco-pricing/default` | `GET`  | requireAuth                | —         | —                             |
| P2  | Zapisz cennik PRECO                      | `btn btn-primary pill-sm`   | `pricelistPreco.js` (dynamic) | 26   | `savePrecoFromUI()`                                               | `pricelistPreco.js:297` | `/api/preco-pricing`         | `PUT`  | requireAuth + requireAdmin | writeLock | `acquireLock()` → 423 if busy |
| P3  | Dodaj Kinetę (per-DN accordion)          | `btn btn-secondary btn-sm`  | `pricelistPreco.js` (dynamic) | 50   | `addPrecoKinetaRow(${dn})`                                        | `pricelistPreco.js:165` | — (local only)               | —      | —                          | —         | —                             |
| P4  | Usuń kinetę (per-row)                    | `btn-icon del`              | `pricelistPreco.js` (dynamic) | 63   | `removePrecoKinetaRow(${dn}, ${i})`                               | `pricelistPreco.js:173` | — (local only)               | —      | —                          | —         | —                             |
| P5  | Dodaj Zakres (per-range table)           | `btn btn-secondary btn-sm`  | `pricelistPreco.js` (dynamic) | 118  | `addPrecoRangeRow(${dn}, '${fieldBase}')`                         | `pricelistPreco.js:182` | — (local only)               | —      | —                          | —         | —                             |
| P6  | Usuń zakres (per-row)                    | `btn-icon del`              | `pricelistPreco.js` (dynamic) | 154  | `removePrecoRangeRow(${dn}, '${fieldBase}', ${ri})`               | `pricelistPreco.js:203` | — (local only)               | —      | —                          | —         | —                             |
| P7  | Dodaj grupę DN (per-range table)         | `btn btn-secondary btn-sm`  | `pricelistPreco.js` (dynamic) | 135  | `addPrecoGrupaCol(${dn}, '${fieldBase}')`                         | `pricelistPreco.js:226` | — (local only)               | —      | —                          | —         | —                             |
| P8  | Usuń grupę DN (per-range header)         | `btn-icon del`              | `pricelistPreco.js` (dynamic) | 129  | `removePrecoGrupaCol(${dn}, '${fieldBase}', '${sg}')`             | `pricelistPreco.js:242` | — (local only)               | —      | —                          | —         | —                             |
| P9  | Edytuj nazwę grupy DN (per-range header) | `onchange` on `<input>`     | `pricelistPreco.js` (dynamic) | 128  | `updatePrecoGrupaKey(${dn}, '${fieldBase}', '${sg}', this.value)` | `pricelistPreco.js:212` | — (local only)               | —      | —                          | —         | —                             |

---

## 2. Data Flow Diagrams

### 2.1 Zapisz (Save) — Wspólny wzorzec dla wszystkich 3 modułów

```
RURY:
  [btn-save-pricelist] → savePriceList() [pricelistUi.js:212]
    └─ if !_pricelistDirty → showToast('Brak zmian') → return
    └─ saveProducts(products) [dataService.js:89]
        └─ api.put('/api/products', { data }) [dataService.js:7]
            └─ fetchWithTimeout('/api/products', { method: 'PUT', headers: authHeaders() })
    └─ Backend: productsV2.ts PUT '/'
        ├─ requireAuth + requireAdmin
        ├─ acquireLock() → 429 if busy
        ├─ validateData(pricelistDataSchema)
        ├─ prisma.$transaction([deleteMany, createMany])
        └─ releaseLock() → { ok: true, count }
    └─ _pricelistDirty = false, updateSaveBtn(), renderPriceList(), renderTiles()
    └─ showToast('Zapisano cennik', 'success')

STUDNIE:
  [btn-save-studnie-pricelist] → saveStudniePriceList() [pricelistSaveReset.js:32]
    └─ if !_studniePricelistDirty → showToast('Brak zmian') → return
    └─ saveStudnieProducts(studnieProducts) [uiHelpers.js:466]
        └─ fetch('/api/products-studnie', { method: 'PUT', headers: authHeaders(), body: JSON.stringify({data}) })
    └─ Backend: productsStudnieV2.ts PUT '/'
        ├─ requireAuth + requireAdmin
        ├─ acquireLock() → 429 if busy
        ├─ validateData(pricelistDataSchema)
        ├─ fromLegacy() converter
        ├─ prisma.$transaction([deleteMany, createMany])
        └─ releaseLock() → { ok: true, count }
    └─ _studniePricelistDirty = false, updateStudnieSaveBtn(), refreshStudnieData()
    └─ showToast('Zapisano cennik studni', 'success')

PRECO:
  [Zapisz cennik PRECO] → savePrecoFromUI() [pricelistPreco.js:297]
    └─ collectPrecoFromUI() → builds nested object from DOM inputs
    └─ savePrecoPricing(data) [uiHelpers.js:503]
        └─ fetch('/api/preco-pricing', { method: 'PUT', headers: authHeaders(), body: JSON.stringify({data}) })
    └─ Backend: precoPricingV2.ts PUT '/'
        ├─ requireAuth + requireAdmin
        ├─ acquireLock() → 423 if busy (note: 423 vs 429!)
        ├─ validateData(precoPricingUpdateSchema)
        ├─ flattenAndSave() — deleteMany on 3 tables + createMany on each
        └─ releaseLock() → { ok: true }
    └─ refreshAll(), showToast('Cennik PRECO zapisany', 'success')
```

### 2.2 Reset — Wspólny wzorzec dla wszystkich 3 modułów

```
RURY:
  [Reset] → resetPriceList() [pricelistUi.js:184]
    └─ api.get('/api/products/default') [via window.api helper]
        └─ fetchWithTimeout('/api/products/default', { headers: authHeaders() })
    └─ Backend: productsV2.ts GET '/default'
        └─ prisma.productsRuryDefault.findMany()
    └─ appConfirm() warning dialog
    └─ products = structuredClone(customDefault)
    └─ _pricelistDirty = true, updateSaveBtn(), renderPriceList()
    └─ showToast('Cennik przywrócony — kliknij Zapisz by zachować', 'info')

STUDNIE:
  [Reset] → resetStudniePriceList() [pricelistSaveReset.js:2]
    └─ fetch('/api/products-studnie/default', { headers: authHeaders() })
    └─ Backend: productsStudnieV2.ts GET '/default'
        └─ prisma.productsStudnieDefault.findMany() → toLegacy()
    └─ appConfirm() warning dialog
    └─ studnieProducts = structuredClone(customDefault)
    └─ _studniePricelistDirty = true, updateStudnieSaveBtn(), renderStudniePriceList(), renderTiles()
    └─ showToast('Cennik studni przywrócony — kliknij Zapisz by zachować', 'info')

PRECO:
  [Reset] → loadPrecoDefaults() [pricelistPreco.js:304]
    └─ fetchWithTimeout('/api/preco-pricing/default')
    └─ Backend: precoPricingV2.ts GET '/default'
        └─ formatPrecoResponse(preco*Default tables)
    └─ NO confirmation dialog — loads directly
    └─ precoPricing = json.data[0], renderPrecoPriceList()
    └─ showToast('Cennik PRECO przywrócony — kliknij Zapisz by zachować', 'info')
```

### 2.3 Sync cen (Price Overrides) — Wspólny dla wszystkich modułów

```
  [Sync cen] → syncPriceOverrides() [shared/ui.js:600]
    └─ Disable all buttons with onclick*="syncPriceOverrides" (visual lock)
    └─ fetchWithTimeout('/api/price-overrides/sync', { method: 'POST', headers: authHeaders() })
    └─ Backend: priceOverrides.ts POST '/sync'
        ├─ requireAuth + requireAdmin
        └─ priceOverrideService.exportOverrides()
            └─ Odczytuje live dane z ProductsRury, ProductsStudnie, Preco* tables
            └─ Porównuje z Products*Default / Preco*Default
            └─ Zapisuje diff do data/price_overrides.json
            └─ Zwraca { total, rury, studnie, preco }
    └─ showToast('Zapisano X zmian (rury: Y, studnie: Z, preco: W)', 'success')
    └─ Re-enable all buttons
```

### 2.4 Eksport/Import Excel

```
RURY:
  [Eksportuj Excel] → exportRuryToExcel() [pricelistUi.js:309]
    └─ Build XLSX workbook (1 sheet: "Cennik Rury")
    └─ Columns: Indeks, Nazwa, Cena PLN, Kategoria, Waga, Szt./transport, Powierzchnia
    └─ XLSX.writeFile(wb, 'Cennik_Rury_Export.xlsx')

  [Importuj Excel] → importRuryFromExcel(event) [pricelistUi.js:342]
    └─ FileReader → XLSX.read → sheet_to_json
    └─ Normalize: map columns via RURY_HEADER_TO_KEY, parse numbers
    └─ appConfirm() warning → products = normalized
    └─ _pricelistDirty = true, renderPriceList()

STUDNIE:
  [Eksportuj Excel] → exportStudnieToExcel() [pricelistImportExport.js:1]
    └─ Build XLSX workbook with MULTIPLE sheets (1 per category)
    └─ Sheets: DN1000, DN1200, ..., Akcesoria, Przejścia, Kinety, Dennicy, Inne
    └─ ALSO exports PRECO data to PRECO_Kinety, PRECO_Zakresy, PRECO_Dodatki sheets
    └─ Columns defined by shared EXPORT_COLUMNS constant
    └─ XLSX.writeFile(wb, 'Cennik_Studni_Export.xlsx')

  [Importuj Excel] → importStudnieFromExcel(event) [pricelistImportExport.js:163]
    └─ FileReader → XLSX.read → per-sheet processing
    └─ PRECO_* sheets → merge into precoPricing object
    └─ Other sheets → normalize via HEADER_TO_KEY
    └─ appConfirm() warning → studnieProducts = normalized
    └─ If PRECO data: savePrecoPricing(precoPricing) immediately!
    └─ _studniePricelistDirty = true, renderStudniePriceList(), renderTiles()
```

### 2.5 Dodawanie produktów

```
RURY:
  [Dodaj] → showAddProductModal() [pricelistUi.js:236]
    └─ showModal() → dynamic HTML with fields: kategoria, indeks, nazwa, cena, pole, szt/transp, waga
  Modal confirm [Dodaj produkt] → addProduct() [pricelistUi.js:262]
    └─ Read form fields, validate required (id, name, price)
    └─ Check duplicate ID → error toast
    └─ products.push({ id, name, price, area, transport, weight, category })
    └─ _pricelistDirty = true, closeModal(), renderPriceList()

STUDNIE:
  [Dodaj] → showAddStudnieProductModal() [pricelistProductCrud.js:37]
    └─ Create overlay HTML with extensive fields:
        kategoria (→ custom category for przejścia), indeks, nazwa, cena,
        wysokość, waga, pow.wewn, pow.zewn, ilość/transp,
        dopłata PEHD, malow.wewn, malow.zewn, dopłata żelbet, drab.nierdzewna,
        (przejścia-only: zapas dół/góra, zapas dół/góra min)
  Modal confirm [Dodaj element] → addStudnieProduct() [pricelistProductCrud.js:113]
    └─ Read all form fields, validate
    └─ Auto-detect componentType from name matching (DENNICA → dennica, KONUS → konus, etc.)
    └─ Auto-detect DN from category + name regex
    └─ studnieProducts.push({...}) with many defaults
    └─ _studniePricelistDirty = true, closeModal(), renderStudniePriceList()
```

### 2.6 Operacje na wierszach (Powiel / Usuń)

```
RURY:
  copyProduct(id) [pricelistUi.js:143]
    └─ Find original → generate newId (id-KOP, id-KOP1, ...)
    └─ structuredClone → splice after original
    └─ _pricelistDirty = true, renderPriceList()

  deleteProduct(id) [pricelistUi.js:169]
    └─ appConfirm() → products.filter → _pricelistDirty → renderPriceList()

STUDNIE:
  copyStudnieProduct(id) [pricelistProductCrud.js:17]
    └─ Same pattern: find → clone → splice → dirty → render

  deleteStudnieProduct(id) [pricelistProductCrud.js:2]
    └─ Same pattern: confirm → filter → dirty → render
```

---

## 3. Error Handling Matrix

| Button                       | Network Error                                                                               | Validation Error                                                                                                                                                       | Auth Error (401/403)                                                                                  | Lock Contention (429/423)                                                                | Server Error (500)                                               |
| ---------------------------- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| **Zapisz (Rury)**            | `showToast('Błąd zapisu: ' + err.message, 'error')` via catch in savePriceList              | Dirty check (skip if no changes). Schema validation returns 400 on backend.                                                                                            | Backend returns 401 → fetch fails → `showToast('Błąd zapisu cennika', 'error')`                       | Backend returns 429 → api.put returns null → `showToast('Błąd zapisu cennika', 'error')` | Backend returns 500 → api.put returns null → generic error toast |
| **Zapisz (Studnie)**         | `showToast('Błąd zapisu: ' + err.message, 'error')` via catch in saveStudniePriceList       | Dirty check. Schema validation on backend.                                                                                                                             | Backend 401 → saveStudnieProducts returns false → `showToast('Błąd zapisu cennika studni', 'error')`  | Backend returns 429 → fetch not-ok → saveStudnieProducts returns false                   | Backend 500 → saveStudnieProducts returns false                  |
| **Zapisz (PRECO)**           | `showToast('Błąd sieci przy zapisie cennika PRECO', 'error')` via catch in savePrecoPricing | `collectPrecoFromUI()` validates nothing (parseFloat returns 0 on NaN)                                                                                                 | Backend 401 → savePrecoPricing catches → `showToast('Błąd zapisu cennika PRECO: ' + status, 'error')` | Backend returns 423 (different from 429!) → same error path                              | Backend 500 → same error path                                    |
| **Reset (Rury)**             | `showToast('Nie udało się pobrać domyślnego cennika z serwera', 'error')`                   | Backend schema: always returns default data                                                                                                                            | Backend 401 → api.get returns null → generic error                                                    | N/A (GET, no lock)                                                                       | Backend 500 → api.get returns null                               |
| **Reset (Studnie)**          | `showToast('Nie udało się pobrać domyślnego cennika studni z serwera', 'error')`            | Backend checks if customDefault.length === 0 → `'Brak zapisanych wartości fabrycznych'`                                                                                | Backend 401 → catch → generic network error                                                           | N/A (GET, no lock)                                                                       | Backend 500 → catch → generic network error                      |
| **Reset (PRECO)**            | `showToast('Błąd sieci przy ładowaniu cennika PRECO', 'error')`                             | If json.data empty → `'Brak fabrycznych wartości cennika PRECO'`                                                                                                       | Backend 401 → catch → generic network error                                                           | N/A (GET, no lock)                                                                       | Backend 500 → catch → generic network error                      |
| **Sync cen**                 | `showToast('Błąd sieci: ' + err.message, 'error')`                                          | Backend returns error message from priceOverrideService                                                                                                                | Backend 401 → fetch fails → catch shows error                                                         | N/A                                                                                      | Backend returns 500 with error.message                           |
| **Eksport Excel**            | `showToast('Błąd podczas eksportu do Excela', 'error')` — both modules                      | Empty products check: `showToast('Brak danych do eksportu', 'error')`                                                                                                  | N/A (client-side only)                                                                                | N/A                                                                                      | try/catch in XLSX lib                                            |
| **Import Excel**             | `showToast('Błąd podczas importu pliku Excel', 'error')`                                    | Empty rows: `'Brak prawidłowych wierszy'` / empty file: `'Skoroszyt jest pusty'`                                                                                       | N/A (client-side only)                                                                                | N/A                                                                                      | try/catch in XLSX parsing                                        |
| **Dodaj produkt (Rury)**     | N/A (local)                                                                                 | Missing fields: `'Wypełnij wymagane pola'`; Duplicate ID: `'Taki indeks już istnieje'`                                                                                 | N/A                                                                                                   | N/A                                                                                      | N/A                                                              |
| **Dodaj element (Studnie)**  | N/A (local)                                                                                 | Missing fields: `'Wypełnij wymagane pola'`; Duplicate ID: `'Element o takim indeksie już istnieje'`; Przejścia without custom cat: `'Wpisz nazwę kategorii przejścia'` | N/A                                                                                                   | N/A                                                                                      | N/A                                                              |
| **Usuń wiersz**              | N/A (local)                                                                                 | N/A (always in local array)                                                                                                                                            | N/A                                                                                                   | N/A                                                                                      | N/A                                                              |
| **Usuń kategorię (Studnie)** | N/A (local)                                                                                 | N/A (appConfirm before action)                                                                                                                                         | N/A                                                                                                   | N/A                                                                                      | N/A                                                              |

---

## 4. Differences Between Modules

### 4.1 Communication Layer

| Aspect          | Rury                                                                                              | Studnie                                                                                                       | PRECO                                                                                                                  |
| --------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **HTTP helper** | `window.api` object (`api.get`, `api.put`) defined in `dataService.js` — wraps `fetchWithTimeout` | Direct `fetch()` calls in `uiHelpers.js` (for save) and `pricelistSaveReset.js` (for reset). NO shared helper | Direct `fetchWithTimeout()` calls in `pricelistPreco.js` (for reset) and direct `fetch()` in `uiHelpers.js` (for save) |
| **Consistency** | Uses `api.put()` for save, `api.get()` for default                                                | Uses raw `fetch()` with manual `authHeaders()` + `Content-Type` header                                        | Uses raw `fetch()` for save, `fetchWithTimeout()` for default                                                          |

### 4.2 Dirty Flag Pattern

| Aspect                    | Rury                                                         | Studnie                                                             | PRECO                                               |
| ------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------- | --------------------------------------------------- |
| **Flag variable**         | `_pricelistDirty` (local to pricelistUi.js)                  | `_studniePricelistDirty` (global via var)                           | N/A — no dirty tracking. Every save sends full data |
| **Save button indicator** | `updateSaveBtn()` — adds orange `(!)` badge                  | `updateStudnieSaveBtn()` — similar pattern                          | N/A — no dirty indicator                            |
| **Skip-if-clean guard**   | `if (!_pricelistDirty) { showToast('Brak zmian'); return; }` | `if (!_studniePricelistDirty) { showToast('Brak zmian'); return; }` | **MISSING** — always saves even if no changes       |

### 4.3 Reset Confirmation

| Aspect                  | Rury                                                             | Studnie                             | PRECO                                             |
| ----------------------- | ---------------------------------------------------------------- | ----------------------------------- | ------------------------------------------------- |
| **Confirmation dialog** | `appConfirm(...)` with warning text about losing unsaved changes | `appConfirm(...)` with warning text | **NO CONFIRMATION** — resets immediately on click |

### 4.4 Lock Contention HTTP Status

| Module                         | Lock Busy Status | Error Message                                |
| ------------------------------ | ---------------- | -------------------------------------------- |
| Rury (productsV2.ts)           | **429**          | `'Zapis w toku, spróbuj ponownie za chwilę'` |
| Studnie (productsStudnieV2.ts) | **429**          | `'Zapis w toku, spróbuj ponownie za chwilę'` |
| PRECO (precoPricingV2.ts)      | **423**          | `'Zasób zablokowany, spróbuj ponownie'`      |

**Inconsistency:** PRECO uses HTTP 423 (Locked) while Rury and Studnie use 429 (Too Many Requests). ADR-005 says "writeLock on all modifiable endpoints" but doesn't specify the status code.

### 4.5 Auth on GET /default

| Module  | requiresAuth?    | requiresAdmin? |
| ------- | ---------------- | -------------- |
| Rury    | ✅ `requireAuth` | ❌ No          |
| Studnie | ✅ `requireAuth` | ❌ No          |
| PRECO   | ✅ `requireAuth` | ❌ No          |

All consistent — authenticated users can read defaults, only admin can write.

### 4.6 Endpoint Naming

| Action      | Rury                    | Studnie                         | PRECO                                               |
| ----------- | ----------------------- | ------------------------------- | --------------------------------------------------- |
| GET all     | `/api/products`         | `/api/products-studnie`         | `/api/preco-pricing`                                |
| PUT bulk    | `/api/products`         | `/api/products-studnie`         | `/api/preco-pricing`                                |
| PATCH one   | `/api/products/:id`     | `/api/products-studnie/:id`     | `/api/preco-pricing` (merge DN — different pattern) |
| DELETE one  | `/api/products/:id`     | `/api/products-studnie/:id`     | **N/A** (PUT covers all)                            |
| GET default | `/api/products/default` | `/api/products-studnie/default` | `/api/preco-pricing/default`                        |

**Inconsistency:** PRECO PATCH is at root `/` (merges a DN entry), not `/:id`. No DELETE endpoint for PRECO.

### 4.7 Excel Export Format

| Aspect         | Rury                                                                      | Studnie                                                                                         |
| -------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| **Sheets**     | 1 sheet ("Cennik Rury")                                                   | Multiple sheets (1 per DN category + Akcesoria + Przejścia + Kinety + Dennicy + Inne + PRECO_*) |
| **Columns**    | 7 columns (Indeks, Nazwa, Cena, Kategoria, Waga, Transport, Powierzchnia) | Full set from `EXPORT_COLUMNS` constant (all studnie fields)                                    |
| **PRECO data** | N/A                                                                       | Exported to 3 extra sheets: PRECO_Kinety, PRECO_Zakresy, PRECO_Dodatki                          |
| **File name**  | `Cennik_Rury_Export.xlsx`                                                 | `Cennik_Studni_Export.xlsx`                                                                     |

### 4.8 Studnie-Specific Features (No Rury Equivalent)

| Feature                 | File                      | Description                                                                        |
| ----------------------- | ------------------------- | ---------------------------------------------------------------------------------- |
| PEHD price recalculate  | `pricelistManager.js:101` | Per-tab PEHD price input + "Przelicz" button                                       |
| Category management     | `pricelistCategory.js`    | Add/delete categories with auto-generated sub-products                             |
| Tabbed view (DN tabs)   | `pricelistManager.js`     | Switch between DN1000, DN1200, ..., styczne, dennicy, akcesoria, przejścia, kinety |
| Per-cell boolean toggle | `pricelistCellEdit.js:2`  | Click to toggle magazynWL/magazynKLB/active/formaStandardowa 0↔1                   |

### 4.9 Function Exposure on `window`

| Function                                   | Rury                                                                    | Studnie                                                                                      |
| ------------------------------------------ | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `savePriceList` / `saveStudniePriceList`   | ✅ `window.savePriceList = savePriceList` (explicit)                    | ✅ Used directly in `onclick`, no explicit export needed (global `var` in non-module script) |
| `resetPriceList` / `resetStudniePriceList` | ✅ `window.resetPriceList = resetPriceList` (explicit)                  | ✅ Used directly in `onclick`                                                                |
| `export...` / `import...`                  | ✅ `exportRuryToExcel` used via onclick (global)                        | ✅ `window.exportStudnieToExcel = exportStudnieToExcel` (explicit)                           |
| `syncPriceOverrides`                       | ✅ `window.syncPriceOverrides = syncPriceOverrides` (from shared/ui.js) | ✅ Same                                                                                      |
| `savePrecoPricing`                         | N/A                                                                     | ✅ Used directly (global via var)                                                            |

---

## 5. Recommendations

### 🔴 Critical

1. **PRECO: Add confirmation dialog on Reset.** Currently `loadPrecoDefaults()` has no `appConfirm()` — it immediately replaces the in-memory PRECO data. This is inconsistent with Rury and Studnie. Add an `appConfirm()` before the fetch or after receiving data.

2. **PRECO: Add dirty tracking.** PRECO has no `_pricelistDirty` flag, no "skip if no changes" guard, and no save button indicator. Add a dirty flag similar to `_studniePricelistDirty` to avoid unnecessary PUT requests.

3. **Unify lock contention HTTP status codes.** PRECO returns 423 (Locked) while Rury and Studnie return 429 (Too Many Requests). The ADR doesn't specify a code. Pick one — RFC 423 is semantically correct for write locks — and use it consistently across all three modules. Update frontend error handling accordingly.

### 🟡 Medium

4. **Unify API communication pattern.** Rury uses the clean `window.api` helper (`api.get()`, `api.put()`), while Studnie and PRECO use raw `fetch()` with manual headers. Consider migrating Studnie and PRECO to use `window.api` for consistency and centralized timeout/error handling.

5. **Rury: Expose functions on `window` explicitly for consistency.** Currently `savePriceList` and `resetPriceList` are explicitly assigned (`window.savePriceList = savePriceList`), but `copyProduct`, `deleteProduct`, `addProduct`, `editCell` are not (they work because they're called via `onclick` from JS-generated HTML). Either standardize on one pattern or add a comment.

6. **Excel export format unification.** Rury exports a single sheet with 7 columns. Studnie exports multiple sheets with many more columns and includes PRECO data. Consider adding a similar multi-sheet export for Rury (by category) and including PRECO export in the Rury module if applicable.

7. **Studnie: Consolidate pricelist file sprawl.** The studnie pricelist is split across 6+ files (`pricelistManager.js`, `pricelistSaveReset.js`, `pricelistProductCrud.js`, `pricelistCategory.js`, `pricelistImportExport.js`, `pricelistCellEdit.js`, `pricelistPreco.js`) while rury pricelist is in 1 file (`pricelistUi.js`) + 1 data service (`dataService.js`). This fragmentation makes it harder to trace flows. Consider consolidation if SRP boundaries are clear.

### 🟢 Minor

8. **PRECO: Collect data from UI before save.** `savePrecoFromUI()` calls `collectPrecoFromUI()` which parses floating-point `input.value` with `parseFloat() || 0` — this silently converts invalid values to 0. Consider adding visual validation (red border on invalid fields) before the save.

9. **PRECO: `loadPrecoDefaults` uses `fetchWithTimeout`, while `savePrecoPricing` uses `fetch` (no timeout).** Make timeout behavior consistent — either both with timeout or both without.

10. **Sync cen button disable logic.** `syncPriceOverrides()` disables ALL buttons with `onclick*="syncPriceOverrides"` attribute. This is a fragile selector (matches by string fragment). Consider using a class or data attribute instead. Currently it disables buttons from ALL modules simultaneously (e.g., clicking Sync in Rury disables Sync in Studnie too).

---

## Appendix A: Backend Route Summary

| File                   | Base Path               | Method | Endpoint   | Auth                       | Lock            | Description                    |
| ---------------------- | ----------------------- | ------ | ---------- | -------------------------- | --------------- | ------------------------------ |
| `productsV2.ts`        | `/api/products`         | GET    | `/`        | requireAuth                | —               | Fetch all rury products        |
|                        |                         | PUT    | `/`        | requireAuth + requireAdmin | writeLock (429) | Bulk save rury products        |
|                        |                         | PATCH  | `/:id`     | requireAuth + requireAdmin | writeLock (429) | Update one rury product        |
|                        |                         | DELETE | `/:id`     | requireAuth + requireAdmin | writeLock (429) | Delete one rury product        |
|                        |                         | GET    | `/default` | requireAuth                | —               | Fetch default rury products    |
| `productsStudnieV2.ts` | `/api/products-studnie` | GET    | `/`        | requireAuth                | —               | Fetch all studnie products     |
|                        |                         | PUT    | `/`        | requireAuth + requireAdmin | writeLock (429) | Bulk save studnie products     |
|                        |                         | PATCH  | `/:id`     | requireAuth + requireAdmin | writeLock (429) | Update one studnie product     |
|                        |                         | DELETE | `/:id`     | requireAuth + requireAdmin | writeLock (429) | Delete one studnie product     |
|                        |                         | GET    | `/default` | requireAuth                | —               | Fetch default studnie products |
| `precoPricingV2.ts`    | `/api/preco-pricing`    | GET    | `/`        | requireAuth                | —               | Fetch full PRECO structure     |
|                        |                         | PUT    | `/`        | requireAuth + requireAdmin | writeLock (423) | Bulk save PRECO structure      |
|                        |                         | PATCH  | `/`        | requireAuth + requireAdmin | writeLock (423) | Merge DN entry                 |
|                        |                         | GET    | `/default` | requireAuth                | —               | Fetch default PRECO structure  |
| `priceOverrides.ts`    | `/api/price-overrides`  | POST   | `/sync`    | requireAuth + requireAdmin | —               | Export price overrides to JSON |

## Appendix B: Module Comparison Matrix

| Feature                    | Rury                                   | Studnie                                                                                                  | PRECO                                                                      |
| -------------------------- | -------------------------------------- | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| **HTML partial**           | `rury/pricelist.html` (49 lines)       | `studnie/pricelist.html` (94 lines)                                                                      | Rendered by JS in `pricelistPreco.js` (no HTML partial)                    |
| **Tab/navigation**         | None                                   | 10 DN/type tabs                                                                                          | Accordion per DN                                                           |
| **Dirty flag**             | `_pricelistDirty`                      | `_studniePricelistDirty`                                                                                 | ❌ None                                                                    |
| **Save guard**             | ✅ Skip if not dirty                   | ✅ Skip if not dirty                                                                                     | ❌ Always saves                                                            |
| **Reset confirm**          | ✅ appConfirm warning                  | ✅ appConfirm warning                                                                                    | ❌ No confirm                                                              |
| **Excel sheets**           | 1 (flat)                               | 4-10+ (per category + PRECO)                                                                             | Included in Studnie export                                                 |
| **Cell editing**           | Inline `<span>` → `<input>` (9 fields) | Inline `<td>` → prompt (20+ fields)                                                                      | Direct `<input>` fields (always editable)                                  |
| **CRUD operations**        | Add (modal), Copy, Delete, Edit        | Add (modal with auto-detect), Copy, Delete, Edit, Add category, Delete category, Bulk generate przejścia | Add/remove kinety rows, add/remove range rows, add/remove DN group columns |
| **PEHD price**             | ❌ None                                | ✅ Per-tab PEHD input + recalculate                                                                      | ❌ None (separate PRECO structure)                                         |
| **Search**                 | `#pricelist-search`                    | `#studnie-pricelist-search`                                                                              | ❌ None                                                                    |
| **Auto-fix products**      | ❌ None                                | ✅ `fixIncompleteProducts()` auto-runs on load                                                           | ❌ None                                                                    |
| **Backend tables**         | `ProductsRury`, `ProductsRuryDefault`  | `ProductsStudnie`, `ProductsStudnieDefault`                                                              | `PrecoKonfig`/`PrecoKinety`/`PrecoZakresy` + Default variants              |
| **Frontend data variable** | `products` (global)                    | `studnieProducts` (global)                                                                               | `precoPricing` (global, nested object)                                     |
| **App mount path**         | `/app` (rury)                          | `/studnie`                                                                                               | (inside studnie as tab)                                                    |
