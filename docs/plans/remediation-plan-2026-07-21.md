# Plan Naprawczy — WITROS Oferty PV

**Data utworzenia:** 2026-07-21
**Status:** AKTYWNY
**Sposób użycia:** Po każdej sekcji wykonaj weryfikację i poproś użytkownika o zgodę na kolejny krok.

---

## Sekcja 1: 🔴 KRYTYCZNE XSS — [STATUS: DONE ✅]

**Cel:** Eliminacja 5 podatności XSS umożliwiających przejęcie kontekstu `onclick` i wstrzyknięcie HTML przez dane użytkownika.

**Czas:** ~30 min

### 1.1 `public/js/rury/offerCrudHelpers.js:95-120`

**Problem:** ID ofert (`o.id`) i zamówień (`ord.id`) interpolowane w inline `onclick` bez `escapeHtml`. ID pochodzą z bazy — atak przez API może wstrzyknąć cudzysłów.

**Zmiana:** Zamienić inline `onclick` z interpolacją stringów na `dataset` + `addEventListener`:

```js
// PRZED:
`<tr onclick="loadOffer('${o.id}')" ...>`
// PO:
`<tr data-offer-id="${escapeHtml(o.id)}" class="js-offer-row" ...>`;
```

Następnie dodać delegację zdarzeń:

```js
document.querySelector('#offer-list').addEventListener('click', (e) => {
    const row = e.target.closest('.js-offer-row');
    if (row) loadOffer(row.dataset.offerId);
});
```

**Weryfikacja:** `node -c public/js/rury/offerCrudHelpers.js`

### 1.2 `public/js/rury/offerItems.js:38`

**Problem:** `p.id` w inline `onclick="addOfferItem('${p.id}')"` bez `escapeHtml`.

**Zmiana:** Użyć `escapeHtml(p.id)`:

```js
// PRZED:
`<button onclick="addOfferItem('${p.id}')">`
// PO:
`<button onclick="addOfferItem('${escapeHtml(p.id)}')">`;
```

**Alternatywa:** Analogicznie jak 1.1 — dataset + addEventListener.

**Weryfikacja:** `node -c public/js/rury/offerItems.js`

### 1.3 `public/js/rury/orderPrzejscia.js:43-50`

**Problem:** Stored XSS — `row.rodzaj`, `row.dnOd`, `row.dnDo`, `row.uwagi` (dane użytkownika z inputów) wstrzykiwane do `innerHTML` bez `escapeHtml`. Wartość zapisywana w bazie, potem renderowana dla innych użytkowników.

**Zmiana:** Owinąć wszystkie interpolacje w `escapeHtml()`:

```js
// PRZED:
html += `<td>${row.rodzaj}</td><td>${row.dnOd}</td><td>${row.dnDo}</td><td>${row.uwagi}</td>`;

// PO:
html += `<td>${escapeHtml(row.rodzaj)}</td><td>${escapeHtml(row.dnOd)}</td><td>${escapeHtml(row.dnDo)}</td><td>${escapeHtml(row.uwagi)}</td>`;
```

**Weryfikacja:** `node -c public/js/rury/orderPrzejscia.js`

### 1.4 `public/js/studnie/actionsElevation.js:105-107`

**Problem:** `well.configErrors` (stringi z solvera, potencjalnie zawierające nazwy pól użytkownika) w `innerHTML` bez `escapeHtml`.

**Zmiana:**

```js
// PRZED:
liveErrors.map((e) => `• ${e}`).join('<br>');

// PO:
liveErrors.map((e) => `• ${escapeHtml(e)}`).join('<br>');
```

**Weryfikacja:** `node -c public/js/studnie/actionsElevation.js`

### 1.5 `public/js/rury/offerRendering.js:120`

**Problem:** `item.productId` w inline `onclick="showPipeLengthModal('${item.productId}', ${i})"` bez `escapeHtml`.

**Zmiana:**

```js
// PRZED:
`onclick="showPipeLengthModal('${item.productId}', ${i})"`
// PO:
`onclick="showPipeLengthModal('${escapeHtml(item.productId)}', ${i})"`;
```

**Weryfikacja:** `node -c public/js/rury/offerRendering.js`

---

## Sekcja 2: 🔴 SQL INJECTION — [STATUS: DONE ✅]

**Cel:** Wyeliminowanie nieparametryzowanego zapytania SQL w `roleFilter.ts`.

**Czas:** ~15 min

### 2.1 `src/utils/roleFilter.ts:47`

**Problem:** `buildRoleWhereSql()` konstruuje string SQL z manualnym escape'owaniem (`id.replace(/'/g, "''")`) zamiast parametryzowanego zapytania. Istnieje już bezpieczna alternatywa `buildRoleWhereCondition()` zwracająca `Prisma.Sql`.

**Zmiana:**

1. Prześledzić wszystkie callery `buildRoleWhereSql()` w kodzie
2. Zastąpić każde wywołanie przez `buildRoleWhereCondition()`
3. Jeśli `buildRoleWhereSql()` nie ma już callerów — usunąć funkcję

**Callery do sprawdzenia:**

- `src/routes/offers/search.ts`
- `src/services/auditService.ts`
- `src/routes/offers/studnieCrud.ts`
- `src/routes/offers/ruryCrud.ts`

**Weryfikacja:** `npm run typecheck` + `npm run lint`

---

## Sekcja 3: 🟡 WYSOKIE XSS — [STATUS: DONE ✅]

**Cel:** Eliminacja 5 dodatkowych podatności XSS wysokiego ryzyka.

**Czas:** ~30 min

### 3.1 `public/js/studnie/offerHistory.js:18-62`

**Problem:** Audit log — `log.oldData[k]`, `data[k]`, `JSON.stringify(oldVal)`, `log.id` w `innerHTML` bez `escapeHtml` (9 miejsc). Dane audit log mogą pochodzić od użytkownika.

**Zmiana:** Owinąć wszystkie interpolacje w `escapeHtml()` w `renderAuditLogEntry`. Każde wystąpienie zmiennej wstrzykiwanej do HTML.

**Weryfikacja:** `node -c public/js/studnie/offerHistory.js`

### 3.2 `public/js/studnie/orderZleceniaForm.js:316`

**Problem:** `liveErrors.map((e) => `• ${e}`)` w `innerHTML` bez `escapeHtml`.

**Zmiana:**

```js
// PRZED:
liveErrors.map((e) => `• ${e}`).join('<br>');

// PO:
liveErrors.map((e) => `• ${escapeHtml(e)}`).join('<br>');
```

**Weryfikacja:** `node -c public/js/studnie/orderZleceniaForm.js`

### 3.3 `public/js/shared/ui.js:487`

**Problem:** `el.innerHTML = ${icon}<span>${text}</span>` — parametr `text` bez `escapeHtml`.

**Zmiana:**

```js
// PRZED:
el.innerHTML = `${icon}<span>${text}</span>`;

// PO:
el.innerHTML = `${icon}<span>${escapeHtml(text)}</span>`;
```

**Weryfikacja:** `node -c public/js/shared/ui.js`

### 3.4 `public/js/rury/orderSummary.js:150-153`

**Problem:** `orderCell.innerHTML = '<input ... value="' + currentQty + '" ...>'` — `currentQty` bez `escapeHtml`.

**Zmiana:**

```js
// PRZED:
orderCell.innerHTML = '<input type="number" value="' + currentQty + '" ...>';

// PO:
orderCell.innerHTML = '<input type="number" value="' + escapeHtml(String(currentQty)) + '" ...>';
```

**Weryfikacja:** `node -c public/js/rury/orderSummary.js`

### 3.5 `public/js/rury/offerRendering.js:88-89`

**Problem:** `autoTag` z `item.autoAdded` + `isOneMetrePipe(item.productId)` — productId może być kontaminowane.

**Zmiana:** Zastosować `escapeHtml` przy konstrukcji autoTag.

**Weryfikacja:** `node -c public/js/rury/offerRendering.js`

---

## Sekcja 4: 🟡 BEZPIECZEŃSTWO — [STATUS: DONE ✅]

**Cel:** Poprawa bezpieczeństwa autoryzacji i API.

**Czas:** ~15 min

### 4.1 `src/routes/auth.ts:54-55`

**Problem:** Token JWT zwracany w body response OPRÓCZ httpOnly cookie. Token w body może być zalogowany przez middleware loggera, przechwycony w historii API lub logach backendu.

**Zmiana:** Usunąć `token` z response body, pozostawić tylko w httpOnly cookie. Jeśli frontend potrzebuje tokena w body (np. do zapisania w localStorage) — dodać opcjonalny parametr lub dokumentację.

**Weryfikacja:** `npm run typecheck`

### 4.2 `public/js/shared/dashboard.js:472`

**Problem:** fetch do `/api/auth/change-password` bez `{method:'POST'}` — domyślnie GET, backend oczekuje POST.

**Zmiana:**

```js
// PRZED:
fetch('/api/auth/change-password', { ...body });
// PO:
fetch('/api/auth/change-password', { method: 'POST', ...body });
```

**Weryfikacja:** `node -c public/js/shared/dashboard.js`

---

## Sekcja 5: 🟡 MARTWY KOD I DUPLIKACJE — [STATUS: DONE ✅]

**Cel:** Usunięcie nieużywanego kodu i duplikacji. Redukcja kodu o ~1-2%.

**Czas:** ~30 min

### 5.1 Usunięcie `public/js/shared/api.js`

**Problem:** Cały moduł (pełny klient REST API: get/post/put/patch/del + fetchWithTimeout) zdefiniowany, ale 0 użyć w całym projekcie. Żaden plik HTML go nie ładuje, żaden kod go nie woła.

**Zmiana:** Usunąć plik `public/js/shared/api.js`.

**Weryfikacja:** `grep -r "api\.\(get\|post\|put\|patch\|del\)" public/js/` — brak wyników.

### 5.2 Usunięcie `public/js/shared/appState.js`

**Problem:** Klasa `AppState` zdefiniowana i załadowana w HTML, ale nieużywana przez kod. Analiza grep nie wykazała żadnych odwołań do `window.AppState`.

**Zmiana:** Usunąć plik `public/js/shared/appState.js`.

**Weryfikacja:** `grep -r "AppState" public/js/` — brak wyników poza samym plikiem.

### 5.3 Usunięcie `public/js/shared/StorageService.js`

**Problem:** Klasa `StorageService` z pełnym REST API zdefiniowana, ale nigdy nie załadowana ani użyta.

**Zmiana:** Usunąć plik `public/js/shared/StorageService.js`.

**Weryfikacja:** `grep -r "StorageService" public/js/` — brak wyników poza samym plikiem + dynamicznymi importami. **UWAGA:** Sprawdzić czy istnieją dynamiczne `import('...StorageService...')` — jeśli tak, nie usuwać.

### 5.4 Deduplikacja `escapeHtml`

**Problem:** `escapeHtml` zdefiniowane 4 razy na froncie:

- `public/js/shared/ui.js:7` ← **zostawić (główne)**
- `public/js/shared/formatters.js:42` ← usunąć
- `public/js/shared/printModal.js:33` ← usunąć
- `public/js/spa/router.js:65` ← usunąć (ale zachować guard `if (typeof window.escapeHtml !== 'function')`)

**Zmiana:** Zostawić tylko definicję w `ui.js`. Z pozostałych plików usunąć definicję. W `router.js` przenieść guard do osobnej linii: `if (typeof window.escapeHtml !== 'function') window.escapeHtml = function...`

**Weryfikacja:** `node -c public/js/shared/ui.js` + `node -c public/js/shared/formatters.js` + `node -c public/js/shared/printModal.js` + `node -c public/js/spa/router.js`

### 5.5 Zakomentowany cache w `printManager.js:15-16`

**Problem:** Zakomentowana implementacja cache szablonów (2 linie). Nieużywana.

**Zmiana:** Usunąć zakomentowane linie.

**Weryfikacja:** `node -c public/js/studnie/printManager.js`

---

## Sekcja 6: 🟢 LITERÓWKI I NIESPÓJNOŚCI — [STATUS: DONE ✅]

**Cel:** Poprawa błędów językowych i drobnych niespójności.

**Czas:** ~15 min

### 6.1 `src/services/ml/TrainingPipeline.ts`

| Linia | Przed                        | Po                       |
| ----- | ---------------------------- | ------------------------ |
| 121   | `Za malo danych`             | `Za mało danych`         |
| 129   | `Za malo nowych danych`      | `Za mało nowych danych`  |
| 174   | `Wytrenowano i zdeployowano` | `Wytrenowano i wdrożono` |
| 182   | `Blad treningu`              | `Błąd treningu`          |

**Weryfikacja:** `npm run typecheck` (tylko stringi, nie wpływają na typy)

### 6.2 `public/js/studnie/excelAutoSelect.js:27`

**Problem:** Komentarz `Synchornizuj` → `Synchronizuj`

**Zmiana:** Poprawić literówkę w komentarzu.

**Weryfikacja:** `node -c public/js/studnie/excelAutoSelect.js`

### 6.3 `eslint.config.mjs:7`

**Problem:** `ignores: ['public/data/']` — katalog `public/data/` nie istnieje. Prawdopodobnie miało być `public/js/data/` lub ścieżka do usunięcia.

**Zmiana:** Sprawdzić rzeczywistą strukturę katalogów i poprawić lub usunąć wpis.

**Weryfikacja:** `npm run lint`

### 6.4 `public/js/studnie/excelColumnVisibility.js`

**Problem:** Użycie `var` zamiast `let`/`const` w całym pliku.

**Zmiana:** Zamienić wszystkie `var` na `let`/`const` zgodnie z konwencją projektu.

**Weryfikacja:** `node -c public/js/studnie/excelColumnVisibility.js`

---

## Sekcja 7: 🟢 BUGI LOGICZNE — [STATUS: PENDING]

**Cel:** Naprawa potencjalnych błędów logicznych.

**Czas:** ~20 min

### 7.1 `public/js/rury/orderKartaBudowy.js:113`

**Problem:** `.sort()` bez kopii — mutuje oryginalną tablicę `activeItemsForUwagi`.

**Zmiana:**

```js
// PRZED:
activeItemsForUwagi.sort((a, b) => ...)

// PO:
[...activeItemsForUwagi].sort((a, b) => ...)
```

**Weryfikacja:** `node -c public/js/rury/orderKartaBudowy.js`

### 7.2 `public/js/studnie/offerSavedList.js:15`

**Problem:** `.sort()` bez kopii — `offers` to parametr funkcji, potencjalna mutacja oryginalnej tablicy.

**Zmiana:**

```js
// PRZED:
offers.sort((a, b) => ...)

// PO:
[...offers].sort((a, b) => ...)
```

**Weryfikacja:** `node -c public/js/studnie/offerSavedList.js`

### 7.3 `public/js/rury/offerRendering.js:14-18`

**Problem:** Filtr usuwa elementy PEHD (`filter(i => !i.isPehd)`), potem podmienia `currentOfferItems`/`orderCurrentItems` — gubi elementy PEHD przy kolejnych renderowaniach.

**Zmiana:** Przechować oryginalną tablicę przed filtrowaniem, lub filtrować tylko do wyświetlania bez podmiany referencji.

**Weryfikacja:** `node -c public/js/rury/offerRendering.js`

### 7.4 `public/js/studnie/excelColumns.js:128`

**Problem:** `parseInt(p.height) === 200` — sztywne ograniczenie do wysokości 200mm dla `plyta_din`.

**Zmiana:** Użyć zakresu `<= 200` lub wartość konfigurowalną, jeśli inne wysokości mogą być poprawne.

**Weryfikacja:** `node -c public/js/studnie/excelColumns.js`

---

## Sekcja 8: 🟢 CSS / HTML — [STATUS: DONE ✅]

**Cel:** Uzupełnienie brakujących klas CSS, atrybutów HTML i meta tagów.

**Czas:** ~30 min

### 8.1 Brakujące klasy CSS

Dodać definicje CSS dla klas używanych w JS ale niezdefiniowanych:

```css
/* public/css/studnie/studnie.css (lub odpowiedni plik) */
.drag-over {
    outline: 2px dashed #3b82f6;
    outline-offset: -2px;
}
.drag-preview {
    opacity: 0.7;
    background: #eff6ff;
}
.cell-selected {
    outline: 2px solid #2563eb;
    outline-offset: -1px;
    background: #eff6ff;
}
.offer-summary-checkbox {
    width: 18px;
    height: 18px;
    cursor: pointer;
}
.item-order-checkbox {
    width: 16px;
    height: 16px;
    cursor: pointer;
}
.config-tile {
    cursor: pointer;
    transition: all 0.2s;
}
.config-tile:hover {
    background: #f0f9ff;
}
```

Lokalizacje do sprawdzenia przed dodaniem — znaleźć odpowiedni plik CSS.

### 8.2 `type="button"` dla buttonów

Dodać `type="button"` do wszystkich buttonów, które nie są `type="submit"`:

- `public/app.html`
- `public/index.html`
- `public/kartoteka.html`
- `public/rury.html`
- `public/studnie.html`
- `public/zlecenia.html`
- `public/partials/rury/*.html`
- `public/partials/studnie/*.html`

**Uwaga:** ~150+ buttonów. Można użyć regex: `<button(?!\s+type=)` → `<button type="button"`

### 8.3 Meta tagi

Dodać `meta name="viewport"` do szablonów w `public/templates/`:

- `public/templates/etykieta.html`
- `public/templates/kartaBudowy.html`
- `public/templates/ofertaRury.html`
- `public/templates/ofertaStudnie.html`
- `public/templates/zlecenie.html`

Dodać `meta name="description"` do:

- `public/app.html`
- `public/index.html`
- `public/kartoteka.html`
- `public/rury.html`

---

## Sekcja 9: 🔵 REFAKTOR TYPÓW TYPESCRIPT — [STATUS: DONE ✅]

**Cel:** Eliminacja ~28 `as any`, zastąpienie `Record<string, unknown>` konkretnymi interfejsami.

**Czas:** ~2h

**Czas:** ~1h

### 9.1 Wspólny interfejs `KartaBudowyOrderData`

Stworzyć w `src/types/kartaBudowy.ts`:

```ts
export interface KartaBudowyMeta {
    uwagiOgolne?: string;
    przejsciaDetails?: PrzejscieItem[];
    // ... pozostałe pola znane z template'ów HTML
}

export interface WellConfigItem {
    type?: string;
    dn?: number;
    height?: number;
    // ...
}

export interface PrzejscieItem {
    rodzaj?: string;
    dnOd?: number;
    dnDo?: number;
    uwagi?: string;
    // ...
}

export interface KartaBudowyOrderData {
    wells: WellItem[];
    items: OrderItem[];
    kartaBudowy: KartaBudowyMeta;
    // ...
}
```

Zastosować w:

- `src/services/pdf/kartaBudowy.ts` (~20 `as any`)
- `src/services/docx/studnie/kartaBudowy.ts` (~15 `as any`)
- `src/services/docx/rury/kartaBudowy.ts` (~8 `as any`)

### 9.2 `src/routes/offers/search.ts`

**Problem:** `as any[]` dla `$queryRaw` — typ `RawOfferRow` już istnieje.

**Zmiana:** Zastąpić `as any[]` przez `as RawOfferRow[]` w liniach 99, 121, 171.

### 9.3 `src/routes/telemetryAiMl.ts:226`

**Problem:** `(req as any).user?.id` — brak typu `AuthenticatedRequest`.

**Zmiana:** Zmienić typ parametru `req` na `AuthenticatedRequest`.

**Weryfikacja:** `npm run typecheck`

---

## Sekcja 10: 🔵 WSPÓLNY CRUD OFERT (Sprint 2-3) — [STATUS: DONE ✅]

**Cel:** Eliminacja ~80% duplikacji między modułami rury/studnie w operacjach CRUD ofert.

**Czas:** ~4h

**Opis:** Wydzielenie `public/js/shared/offerCrudCommon.js` zawierającego:

- `saveOfferCommon()` — zapis oferty (zbieranie pól formularza, wybór opiekuna, konstrukcja dokumentu)
- `loadOfferCommon()` — ładowanie oferty (fetch, normalize, setVal)
- `clearOfferCommon()` — czyszczenie oferty

Moduły rury/studnie importują wspólny kod i dodają tylko logikę specyficzną domenowo.

**Pliki do refaktoryzacji:**

- `public/js/rury/offerCrud.js` (535 linii → ~150)
- `public/js/studnie/offerSave.js` (380 linii → ~100)

**Weryfikacja:** `npm run typecheck` + `npm run test:quick` + testy manualne (zapis/odczyt oferty w obu modułach)

---

## Sekcja 11: ⚪ TECHNICAL DEBT (Backlog) — [STATUS: PENDING]

**Cel:** Dług techniczny do zaplanowania w przyszłych sprintach.

**Czas:** ~8-16h łącznie

### 11.1 Podział `solverAutoSelect.js` (1205 linii)

- `solverCore.js` — główny algorytm solvera
- `solverHeuristics.js` — heurystyki i reguły
- `solverUI.js` — renderowanie UI, diagramy

### 11.2 Wydzielenie `pricingCalculator.js` z `offerSave.js`

- Logika wyceny (rabaty, surcharge, PRECO, przejścia) → osobny moduł

### 11.3 Cleanup event listenerów (wycieki pamięci)

- `excelModal.js` — 8 listenerów na document/window bez cleanup przy zamknięciu
- `offerSvgDrag.js` — mousemove/touchmove bez cleanup
- `mlDualRanking.js` — setInterval bez clearInterval
- `ui.js` — trapFocus bez untrapFocus

### 11.4 CSP: `'unsafe-inline'` → nonce-based

- Migracja inline onclick na addEventListener
- Wprowadzenie nonce dla CSP

### 11.5 `Record<string, unknown>` → konkretne interfejsy

- Przejrzeć wszystkie `Record<string, unknown>` w `src/` i zastąpić konkretnymi typami
- Priorytet: serwisy PDF/DOCX, route handlers

---

## Podsumowanie ogólne

| Sekcja             | Priorytet     | Szacowany czas | Status  |
| ------------------ | ------------- | :------------: | :-----: |
| 1. Krytyczne XSS   | 🔴 Dzień 1    |     30 min     | PENDING |
| 2. SQL Injection   | 🔴 Dzień 1    |     15 min     | PENDING |
| 3. Wysokie XSS     | 🟡 Dzień 2    |     30 min     | PENDING |
| 4. Bezpieczeństwo  | 🟡 Dzień 2    |     15 min     | PENDING |
| 5. Martwy kod      | 🟡 Dzień 3    |     30 min     | PENDING |
| 6. Literówki       | 🟢 Dzień 3    |     15 min     | PENDING |
| 7. Bugi logiczne   | 🟢 Dzień 4    |     20 min     | PENDING |
| 8. CSS/HTML        | 🟢 Dzień 4    |     30 min     | PENDING |
| 9. Refaktor typów  | 🔵 Sprint 2   |       2h       | PENDING |
| 10. Wspólny CRUD   | 🔵 Sprint 2-3 |       4h       | DONE ✅ |
| 11. Technical Debt | ⚪ Backlog    |     8-16h      | PENDING |

**Łącznie:** ~8.5h (Sekcje 1-8) + ~6h (Sekcje 9-10) + backlog

---

## Instrukcja workflow

1. **Przed rozpoczęciem sekcji:** przeczytaj jej opis i zmiany
2. **Wykonaj zmiany** w kodzie
3. **Uruchom weryfikację** (komenda podana w sekcji)
4. **Uruchom `npm run format`** dla sformatowania kodu
5. **Zaktualizuj status** w pliku (PENDING → DONE)
6. **Poproś użytkownika** o zgodę na kolejną sekcję
7. W przypadku problemów: oznacz jako BLOCKED i opisz przeszkodę
