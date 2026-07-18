# Raport statycznej analizy modułu Kartoteki — v2

## Legenda

| Symbol | Znaczenie |
|--------|-----------|
| ✔ | Potwierdzony — wynik analizy kodu jednoznaczny |
| ◐ | Bardzo prawdopodobny — wymaga potwierdzenia w runtime |
| ○ | Hipotetyczny — założenie o stanie danych/architektury |

**Wpływ biznesowy**: crash · data loss · wrong data · UX only · refactor only

---

## Pliki
- `public/js/sales/pvSalesUi.js` (2223 linii)
- `public/kartoteka.html` (487 linii)
- `public/js/sales/kartotekaInit.js` (209 linii)
- `src/routes/offers/search.ts` (182 linie)
- `src/utils/searchUtils.ts` (182 linie)
- `src/utils/searchCache.ts` (61 linii)
- `src/utils/fts5Sync.ts` (73 linie)
- `src/routes/orders/studnieOrders.ts` (576 linii)
- `src/routes/orders/ruryOrders.ts` (589 linii)

---

## KATEGORIE: RUNTIME | LOGIC | ASYNC | SECURITY/TYPES | DEADCODE | API | MEMORY | ARCH

---

### [RUNTIME-1] `pvSalesUi.js:853` — `offer.data` może być `null`, crash przy dostępie do `.summary`
**Pewność**: ✔ · **Wpływ**: crash · **Koszt**: 5 min

Backend (`mapOfferRow`) parsuje `data` tylko gdy jest stringiem — `null` pozostaje `null`. W `renderOffersList` przy `offer.data.summary` nastąpi `TypeError: Cannot read properties of null`.

**Scenariusz**: Oferta z `data IS NULL` w bazie renderowana w kartotece.

---

### [RUNTIME-2] `pvSalesUi.js:1096` — `overlay` może być `null`
**Pewność**: ◐ · **Wpływ**: crash · **Koszt**: 5 min

`showModal()` może zwrócić `null`/`undefined` (np. błąd w tworzeniu overlay). Kod woła `overlay.querySelectorAll(...)` bez guarda.

**Scenariusz**: Błąd w `showModal` przy wyświetlaniu popupu zamówień.

---

### [RUNTIME-3] `pvSalesUi.js:87` — `calculateTransportTrips` jako goła nazwa zamiast `window.*`
**Pewność**: ✔ · **Wpływ**: refactor only · **Koszt**: 5 min

Funkcja zdefiniowana jako `window.calculateTransportTrips` w `constants.js`. `pvSalesUi.js` (moduł ES) woła ją jako gołą nazwę — przechodzi przez scope chain. Działa, ale zmiana kolejności ładowania skryptów zniszczy to bez ostrzeżenia.

**Scenariusz**: Refaktoryzacja kolejności `<script>` w HTML → `ReferenceError: calculateTransportTrips is not defined`.

---

### [RUNTIME-4] `pvSalesUi.js:942` — `formatCurrency` sprawdzane przed użyciem
**Pewność**: ✔ · **Wpływ**: none · **Koszt**: 0

`typeof formatCurrency === 'function'` — guard istnieje, fallback działa. Bezpieczne.

---

### [RUNTIME-5] `pvSalesUi.js:67` — Kolejność fallbacków `SpaRouter` prawidłowa
**Pewność**: ✔ · **Wpływ**: none · **Koszt**: 0

Kolejność: `window.parent?.SpaRouter` → `window.SpaRouter` → `location.href`. Prawidłowa.

---

### [RUNTIME-6] `kartotekaInit.js:25` — `escapeHtml` dostępne w momencie wywołania
**Pewność**: ✔ · **Wpływ**: none · **Koszt**: 0

`escapeHtml` z `ui.js` (klasyczny skrypt) wczytany przed `kartotekaInit.js`. Działa.

---

### [LOGIC-1] `pvSalesUi.js:173-174` — Podwójny render przy init → flash UI
**Pewność**: ✔ · **Wpływ**: UX only · **Koszt**: 30 min

`init()`: `searchOffers()` (linia 170) woła wewnętrznie `renderResults()` (linia 595). Następnie `loadOrdersMap()` (linia 173) i ponowne `renderResults()` (linia 174). Skutkuje flash'em — najpierw karty bez badge'ów zamówień, potem pełny stan.

**Scenariusz**: Normalne ładowanie strony. Karty pojawiają się, po 200-500ms zmieniają się badge'e.

---

### [LOGIC-2] `pvSalesUi.js:798` — `hasModifiedOrder` fałszywy negatyw dla rur
**Pewność**: ◐ · **Wpływ**: wrong data · **Koszt**: 2h (wymaga weryfikacji backendu)

`getOrderChangeInfo(ord)` porównuje `ord.totalNetto` z `ord.originalTotalNetto`. Dla zamówień rur `totalNetto` może być liczone dynamicznie bez zapisu, a `originalTotalNetto` rzadko ustawione. `Math.abs(0 - 0) > 0.01` → `false`.

**Weryfikacja**: Sprawdzić czy backend kiedykolwiek ustawia `originalTotalNetto` dla zamówień rur. Jeśli nie — bug potwierdzony.

**Scenariusz**: Zamówienie rur po modyfikacjach → badge nie pokazuje "• zmiany".

---

### [LOGIC-3] `pvSalesUi.js:846-865` — Dublowanie logiki ceny dla studni
**Pewność**: ◐ · **Wpływ**: wrong data · **Koszt**: 30 min

`wellsExport?.reduce(...)` sumuje `totalPrice`. Gdy wszystkie `totalPrice = 0`, spada do `totalNetto` z bazy. Brak clear rozróżnienia między "cena = 0" a "brak danych cenowych".

**Scenariusz**: Studnia z `wellsExport` gdzie wszystkie `totalPrice = 0` → pokazuje legacy `totalNetto` zamiast 0.

---

### [LOGIC-4] `kartotekaInit.js:57-71` — `filterByType` i `pvSalesUI.setTypeFilter` desynchronizacja
**Pewność**: ✔ · **Wpływ**: UX only · **Koszt**: 15 min

`filterByType` manipuluje klasami buttonów, potem woła `setTypeFilter(type)` → `searchOffers` → `renderResults`. `renderResults` NIE woła `_syncFilterUI()`. Klasy pozostają takie jak ustawiła `filterByType`. Działa, ale kruche.

**Scenariusz**: Dodanie wywołania `searchOffers` z pominięciem `filterByType` → buttony nie zostaną odświeżone.

---

### [LOGIC-5] `searchUtils.ts:35-38` — `Prisma.raw` z `sort` — jedyna bariera to walidacja
**Pewność**: ✔ · **Wpływ**: refactor only (architectural risk) · **Koszt**: 15 min

`parseSearchParams` ogranicza `sort` do `createdAt` | `offer_number`, ale potem `Prisma.raw(params.sort)` omija parametryzację. Obecnie brak SQL injection — ryzyko pojawi się gdy walidacja zostanie zmieniona.

**Kategoria**: ARCH, nie bug.

---

### [ASYNC-1] `pvSalesUi.js:159` — `setTimeout` pętla bez limitu prób
**Pewność**: ✔ · **Wpływ**: refactor only · **Koszt**: 15 min

Gdy `sessionStorage.getItem('user')` puste, `init()` ustawia `setTimeout(() => this.init(), 500)`. Bez limitu prób — potencjalnie nieskończona pętla.

**Scenariusz**: Błąd w `kartotekaInit.js` przy fetch `/api/auth/me` → `sessionStorage` nie ustawione → pętla init → timeout → init...

---

### [ASYNC-2] `pvSalesUi.js:284` — `searchOffers` bez `await` w `_startAutoRefresh`
**Pewność**: ✔ · **Wpływ**: refactor only · **Koszt**: 5 min

`setInterval` callback: `this.searchOffers(...)` — brak `await`. Promise ignorowany. `UnhandledPromiseRejection` przy błędzie sieci.

---

### [ASYNC-3] `pvSalesUi.js:2178-2187` — Fire-and-forget PATCH, user widzi sukces mimo błędu
**Pewność**: ✔ · **Wpływ**: data loss (częściowa) · **Koszt**: 30 min

W `changeOfferUserFromList`, PATCH opiekuna na zamówieniu nie jest `await`'owany. Błąd logowany tylko do konsoli. UI pokazuje "Opiekun zmieniony" niezależnie od wyniku.

**Scenariusz**: Timeout na PATCH → oferta ma nowego opiekuna, zamówienie nie.

---

### [ASYNC-4] `pvSalesUi.js:239-241` — `loadOrdersMap` ciche połknięcie błędu
**Pewność**: ✔ · **Wpływ**: wrong data · **Koszt**: 15 min

`loadOrdersMap` ma try-catch tylko z `logger.warn`. `init()` kontynuuje, `renderResults()` pokazuje wszystkie oferty jako "bez zamówienia". Użytkownik nie widzi błędu.

**Scenariusz**: API zamówień nie odpowiada → system milczy, dane niekompletne.

---

### [ASYNC-5] `searchUtils.ts:119` — COUNT SQL potencjalnie wolny
**Pewność**: ◐ · **Wpływ**: UX only · **Koszt**: 2h (optymalizacja)

`SELECT COUNT(*) FROM (SELECT id FROM offers_rel ... UNION ALL ...)` skanuje dwie tabele. Bez filtrów (gdy `whereSql` pusty) może być wolny przy 10k+ rekordów.

---

### [MAINT-1] (dawniej SECURITY-1) `pvSalesUi.js:701` — Inline onclick w innerHTML
**Pewność**: ✔ · **Wpływ**: refactor only · **Koszt**: 15 min

`onclick="window.pvSalesUI.searchOffers(...)"` w stringu wstrzykiwanym przez `innerHTML`. Obecnie CSP zezwala na `unsafe-inline`. Nie jest to podatność bezpieczeństwa — to problem utrzymania i przyszłej kompatybilności CSP.

**Zreklasowane z SECURITY na MAINT**.

---

### [SECURITY-1] `pvSalesUi.js:655-661, 696-706` — Wszystkie interpolacje tekstu są escapowane
**Pewność**: ✔ · **Wpływ**: none · **Koszt**: 0

Przejrzano wszystkie miejsca `innerHTML`. Wartości liczbowe (`items.length`, `totalCount`) — brak ryzyka XSS. `message` w `showError` przechodzi przez `this.escapeHtml`.

---

### [TYPES-1] `pvSalesUi.js:211` — `order.offerId` zawsze `undefined` dla studni
**Pewność**: ✔ · **Wpływ**: refactor only · **Koszt**: 5 min

`studnieOrders.ts` NIE zwraca `offerId` — zwraca `offerStudnieId`. Fallback działa, ale misleading.

---

### [TYPES-2] `search.ts ↔ pvSalesUi.js` — `'rura_oferta'` nigdy nie występuje w search API
**Pewność**: ✔ · **Wpływ**: refactor only · **Koszt**: 15 min

Backend mapuje `_type='rury'` → `type:'offer'`. Frontend w `computeOrderValueWithTransport` (linia 113) sprawdza też `offerType === 'rura_oferta'` — wartość, która NIGDY nie pochodzi z search API. Może przyjść z `storageService`.

**Scenariusz**: Inny moduł przekazuje `'rura_oferta'` jako typ → nie rozpoznane jako rury.

---

### [TYPES-3] `pvSalesUi.js:844` — `offer.type` może być `undefined` dla legacy ofert
**Pewność**: ○ · **Wpływ**: wrong data · **Koszt**: 5 min (sprawdzenie) + 15 min (fix)

Hipoteza: legacy oferty bez pola `type`. `isWell = false` → błędna ikona i licznik pozycji.

**Weryfikacja**: Sprawdzić czy w bazie istnieją rekordy z `data` JSON nie zawierającym `type`.

---

### [TYPES-4] `pvSalesUi.js:260` — `_orderCount` jako bigint — konwersja istnieje w backendzie
**Pewność**: ✔ · **Wpływ**: none · **Koszt**: 0

`mapOfferRow` (searchUtils.ts:175-177) konwertuje bigint na Number. Porównanie `> 0` działa nawet bez konwersji.

---

### [TYPES-5] `pvSalesUi.js:206-232` — ordersMap: różny kształt dla studni i rur
**Pewność**: ✔ · **Wpływ**: refactor only · **Koszt**: 1h

Studnie: `{ offerStudnieId, ... }` · Rury: `{ offerId, ... }`. Fallback w `loadOrdersMap` unifikuje klucz mapy, ale same obiekty mają różne nazwy pól.

---

### [DEADCODE-1] `pvSalesUi.js:190-192` — `attachEventListeners()` jest no-op
**Pewność**: ✔ · **Wpływ**: refactor only · **Koszt**: 5 min

Metoda wołana z `init()`, ciało to tylko komentarz. Event listenery są w `attachActionListeners` i `initAdvancedFilterEvents`.

---

### [DEADCODE-2] `pvSalesUi.js:8` — `this.allLocalOffers` zawsze `[]`
**Pewność**: ✔ · **Wpływ**: refactor only · **Koszt**: 5 min

Pole zainicjalizowane w konstruktorze jako `[]`. Używane tylko jako dead fallback w `populateUserFilter`. Nigdy nie wypełniane.

---

### [DEADCODE-3] `pvSalesUi.js:276-278` — `loadLocalOffers` to wrapper na `searchOffers`
**Pewność**: ✔ · **Wpływ**: refactor only · **Koszt**: 5 min

Zachowane dla kompatybilności wstecznej (wywołanie z HTML). Po refactorze HTML → usunąć.

---

### [DEADCODE-4] `kartotekaInit.js:114` — `showSection()` puste, nigdy nieużywane
**Pewność**: ✔ · **Wpływ**: refactor only · **Koszt**: 2 min

---

### [API-1] `pvSalesUi.js:575` — Brak parsowania body błędu HTTP
**Pewność**: ✔ · **Wpływ**: UX only · **Koszt**: 15 min

`throw new Error('HTTP ' + resp.status)` gubi body z komunikatem. Backend zwraca `{ error: message }` przy 401/500/429.

**Scenariusz**: Rate limit (429) → użytkownik widzi tylko "HTTP 429" zamiast "Za dużo zapytań".

---

### [API-2] `pvSalesUi.js:597-603` — Brak rozróżnienia typów błędów
**Pewność**: ✔ · **Wpływ**: UX only · **Koszt**: 30 min

400, 401, 403, 429, 500 — wszystkie obsłużone tak samo: `showError`.

---

### [API-3] `search.ts:25` — Guard przed dostępem do `user.id`
**Pewność**: ✔ · **Wpływ**: none · **Koszt**: 0

401 return przed `searchCache.get(user.id)`. Poprawne.

---

### [API-4] `search.ts:151-153` — Walidacja `type` w `/api/offers/search/orders`
**Pewność**: ✔ · **Wpływ**: none · **Koszt**: 0

Wymaga `'rury'` lub `'studnie'`. Frontendowe `_offerTypeForApi` zwraca właśnie te wartości. Zgodne.

---

### [API-5] `search.ts:142-180` — `/api/offers/search/orders` bez rate limitera
**Pewność**: ◐ · **Wpływ**: refactor only · **Koszt**: 15 min

Sub-ruta w `search.ts` może nie być chroniona `apiLimiter` — zależy od montowania w `app.ts`. Warto zweryfikować.

---

### [MEMORY-1] `pvSalesUi.js:283-285` — `setInterval` bez cleanup przy odpięciu iframe
**Pewność**: ◐ · **Wpływ**: UX only · **Koszt**: 15 min

`_startAutoRefresh()` co 60s. Brak `beforeunload`/`pagehide` cleanup. W SPA iframe po przejściu do innego modułu interval może wisieć.

**Zależne od architektury**: Czy iframe jest faktycznie usuwane z DOM przy nawigacji SPA? Jeśli tak — wyciek. Weryfikacja wymaga testu w przeglądarce.

---

### [MEMORY-2] `kartotekaInit.js:105-107` — `MutationObserver` bez disconnect
**Pewność**: ✔ · **Wpływ**: UX only · **Koszt**: 10 min

Observer na gridzie ofert. Jeśli grid usunięty z DOM (pełne odświeżenie), observer pozostaje.

---

### [MEMORY-3] `kartotekaInit.js:181-194` — `requestAnimationFrame` closure bez cleanup
**Pewność**: ○ · **Wpływ**: refactor only · **Koszt**: 5 min

RAF callback w `showDatePopover`. Jeśli popover zamknięty przed RAF, callback wisi w kolejce. Zaniedbywalne.

---

## Ranking naprawy (kolejność biznesowa)

| # | ID | Opis | Pewność | Wpływ | Koszt |
|---|----|------|---------|-------|-------|
| 1 | RUNTIME-1 | `offer.data = null` → crash | ✔ | crash | 5 min |
| 2 | ASYNC-4 | `loadOrdersMap` cichy fail → brak zamówień | ✔ | wrong data | 15 min |
| 3 | ASYNC-3 | PATCH fire-and-forget → brak zapisu w zamówieniu | ✔ | data loss | 30 min |
| 4 | API-1 | Gubienie body błędu HTTP → "HTTP 429" bez sensu | ✔ | UX only | 15 min |
| 5 | LOGIC-2 | Brak badge "zmiany" dla rur (wymaga weryfikacji) | ◐ | wrong data | 2h |
| 6 | LOGIC-1 | Flash UI przy init | ✔ | UX only | 30 min |
| 7 | API-2 | Brak rozróżnienia błędów HTTP | ✔ | UX only | 30 min |
| 8 | ASYNC-2 | `searchOffers` bez `await` → unhandled rejection | ✔ | refactor | 5 min |
| 9 | ASYNC-1 | `setTimeout` pętla bez limitu | ✔ | refactor | 15 min |
| 10 | MAINT-1 | Inline onclick zamiast listenera | ✔ | refactor | 15 min |
| 11 | RUNTIME-3 | `calculateTransportTrips` jako goła nazwa | ✔ | refactor | 5 min |
| 12 | MEMORY-1 | `setInterval` bez cleanup (do weryfikacji) | ◐ | UX only | 15 min |
| 13 | MEMORY-2 | `MutationObserver` bez disconnect | ✔ | UX only | 10 min |
| 14 | TYPES-3 | Legacy oferty bez `type` (do weryfikacji) | ○ | wrong data | 20 min |
| 15 | DEADCODE-1 | `attachEventListeners()` no-op | ✔ | refactor | 5 min |
| 16 | DEADCODE-2 | `allLocalOffers` zawsze `[]` | ✔ | refactor | 5 min |
| 17 | DEADCODE-4 | `showSection()` puste | ✔ | refactor | 2 min |
| 18 | TYPES-2 | `'rura_oferta'` vs `'offer'` | ✔ | refactor | 15 min |
| 19 | LOGIC-5 | `Prisma.raw` z sort — arch. risk | ✔ | ARCH | 15 min |

---

## Plan napraw — fazy

### Faza 1: Crashi i błędne dane (0.5–2h)
1. `RUNTIME-1` — guard `offer.data &&` przed `offer.data.summary` w `pvSalesUi.js:853-863` (5 min)
2. `ASYNC-4` — `showToast` z ostrzeżeniem w catch `loadOrdersMap` (15 min)
3. `ASYNC-3` — `await` na PATCH + obsługa błędu w `changeOfferUserFromList` (30 min)
4. `API-1` — parsuj body błędu `resp.json().catch(() => ({})).error` w `searchOffers` (15 min)
5. `LOGIC-2` — zweryfikować backend, potem dodać `computeOrderValueWithTransport` jako fallback w `getOrderChangeInfo` (2h)

### Faza 2: UX i komunikacja błędów (1h)
6. `LOGIC-1` — usunąć redundantne `renderResults()` w `init()` po `searchOffers` (30 min)
7. `API-2` — zmapować kody HTTP na komunikaty: 401 → "Sesja wygasła", 429 → "Za dużo zapytań", 500 → "Błąd serwera" (30 min)

### Faza 3: Refactor i cleanup (1h)
8. `ASYNC-2` — dodać `.catch(logger.error)` do `searchOffers` w auto-refresh
9. `ASYNC-1` — dodać licznik prób (max 3) w `init()`
10. `MAINT-1` — zamienić inline `onclick` na `addEventListener` w `attachActionListeners`
11. `RUNTIME-3` — `window.calculateTransportTrips(...)` zamiast gołej nazwy
12. `MEMORY-1` — `window.addEventListener('pagehide', ...)` z cleanup
13. `MEMORY-2` — `observer.disconnect()` przed ponownym observe

### Faza 4: Dead code (15 min)
14. `DEADCODE-1` — usunąć `attachEventListeners()` i wywołanie
15. `DEADCODE-2` — usunąć `this.allLocalOffers`
16. `DEADCODE-4` — usunąć `showSection()`

### Faza 5: Architektura (1h)
17. `TYPES-2` — zmapować `'rura_oferta'` → `'offer'` na wszystkich ścieżkach
18. `LOGIC-5` — dodać runtime guard przed `Prisma.raw`: `if (!['createdAt','offer_number'].includes(params.sort)) ...`
19. `TYPES-3` — dodać fallback: `const isWell = offer.type === 'studnia_oferta' || offer.wells?.length > 0`

---

## Pozycje do weryfikacji przed implementacją

| ID | Co sprawdzić | Gdzie |
|----|-------------|-------|
| LOGIC-2 | Czy backend ustawia `originalTotalNetto` dla zamówień rur? | `ruryOrders.ts` — logika save/update |
| TYPES-3 | Czy w bazie są legacy oferty bez `type`? | `SELECT DISTINCT json_extract(data, '$.type') FROM offers_rel` |
| MEMORY-1 | Czy SPA usuwa iframe z DOM przy nawigacji? | Test przeglądarkowy: `Performance.memory` przed/po |
| ASYNC-5 | Czas wykonania COUNT SQL na 10k ofertach | `EXPLAIN QUERY PLAN SELECT COUNT(*) ...` |
