# Plan implementacji: Blokada usuwania przy istniejących zleceniach produkcyjnych (PZ)

> **Stan: ZREALIZOWANE (commit ae57cbc).** Treść ponizżej zachowana jako dokumentacja procesu - szczegóły w sekcji 10 "Stan wdrożenia".

Data: 2026-08-02
Moduły: studnie (oferty, zamówienia, elementy studni) — backend + frontend
Status: WDROŻONE (2026-08-02)

## 1. Przegląd

Dodać twarde (backend) i miękkie (frontend UX) blokady usuwania dla:

1. OFERTY studni — gdy do którejkolwiek z jej zamówień (lub bezpośrednio do oferty) przypisane jest PZ (dowolny status).
2. ZAMÓWIENIA studni — gdy ma przypisane jakiekolwiek PZ (rozszerzenie obecnej blokady `status === 'accepted'` na KAŻDE PZ).
3. ELEMENTU (studnia / element konfiguracji studni) — gdy dany element (wellId+elementIndex) ma PZ; przy usuwaniu całej studni — gdy którykolwiek jej element ma PZ.

Każdej blokadzie towarzyszy popup `showToast` (z ikoną `<i data-lucide="x-circle"></i>`) po polsku. Backend zwraca `403 { error }`, frontend wykonuje pre-check na liście `productionOrders` w pamięci.

Rury: PZ **nie istnieją** dla ofert/zamówień rur (tabela `production_orders_rel` linkuje wyłącznie przez `orders_studnie_rel.orderId`; moduł rur nie ma żadnego odwołania do `productionOrders` — potwierdzone grepem). → **Brak zmian** w `ruryOrders.crud.ts` i w gałęzi rury `crud.ts:172-208`.

## 2. Zweryfikowane fakty (plik:linia)

- Model PZ: `prisma/schema.prisma:388-403` — kolumny `orderId`, `wellId`, `elementIndex`, `data` (JSON: status/productionOrderNumber/offerId), `@@index([orderId])`. Brak relacji Prisma (klucze logiczne).
- PZ zapisywane z `offerId` i `orderId` z frontendu: `public/js/studnie/orderZleceniaModal.js:176-180`, `public/js/studnie/orderBulk.js:177-179` (w trybie oferty `orderId` = `''`, `offerId` = `editingOfferIdStudnie`).
- Dopasowanie PZ do elementu wyłącznie po parze (wellId, elementIndex): `orderZleceniaData.js:87-89`, `orderZleceniaModal.js:122-124`, `orderZleceniaRender.js:92-94`, `orderZleceniaForm.js:94-96`, `orderZleceniaHelpers.js:4-6`.
- Usuwanie oferty studni:
    - `src/routes/offers/crud.ts:136` — `DELETE /:id`, gałąź `offer_studnie_*` (linie 141-170) — **brak kontroli PZ**.
    - `src/routes/offers/studnieCrud.ts:395` — `DELETE /studnie/:id` — **brak kontroli PZ**.
    - Frontend: `public/js/studnie/offerFileOps.js:4` (`deleteOfferStudnie`), PV Sales przez `public/js/shared/StorageService.js:145` (`deleteOffer` — próbuje OBA endpointy i **połyka błąd 403**).
- Usuwanie zamówienia:
    - `src/routes/orders/studnieOrders.crud.ts:231` — obecna blokada TYLKO `accepted` przez pełny skan `SELECT data FROM production_orders_rel` + filtr w JS (linie 248-262) — do wymiany na zapytanie indeksowane.
    - `src/routes/orders/ruryOrders.crud.ts:272` — brak kontroli (PZ dla rur nie istnieją → bez zmian).
    - Frontend: `public/js/studnie/orderCrud.js:398` (`deleteOrderStudnie`, pre-check `accepted` w liniach 400-411).
- Usuwanie elementów studni (frontend):
    - `public/js/studnie/actionsWellCrud.js:207` `removeWell(index)` — `wells.splice` bez kontroli PZ (poza `isWellLocked()` dla `accepted`).
    - `public/js/studnie/actionsCrud.js:206` `removeWellComponent(index)` — `well.config.splice` bez kontroli PZ; `clearWellConfig()` (309) czyści cały config.
    - `public/js/studnie/actionsConfigDrag.js:4` `moveWellComponent` + drag-reorder (36-99) — zmieniają indeksy; `actionsConfigSort.js:86` `sortWellConfigByOrder()` reindeksuje po dodaniu elementu.
- Popup: `showToast(html, type)` — ikony Lucide wstawiane jako `<i data-lucide="...">`.
- Helpery backend: `parseJsonField` (`src/helpers.ts:77`), `canWriteDoc` (`src/utils/ownership.ts:23`).
- Mount routingu: `src/app.ts:208-216` (`/api/offers-rury` → offerRoutes; `/api/offers-studnie` → prefiks `/studnie` + offerRoutes; `/api/orders-studnie` → orders barrel `src/routes/orders/index.ts`, gdzie `/production` jest przed `/:id`).
- Testy routes istnieją: `tests/offers.crud.test.ts` (mock prisma, supertest), `tests/partialOrders.test.ts` (mock dla `studnieOrders`).

## 3. Decyzje architektoniczne

### 3.1 Wspólny helper backend — `src/utils/productionOrderGuard.ts` (NOWY plik)

- **Dlaczego jeden plik**: oba endpointy DELETE oferty studni (`crud.ts` i `studnieCrud.ts`) muszą mieć identyczną logikę (StorageService próbuje obu endpointów — jeśli tylko jeden by blokował, drugi by usunął ofertę, omijając blokadę). DRY → jedna funkcja.
- **Kontekst**: helper nie potrzebuje użytkownika — blokada PZ jest obiektowa, nie właścicielska. Kontrola uprawnień (`canWriteDoc` / rola) dzieje się wcześniej w routingu. Sygnatury czyste: `(offerId)` / `(orderId, offerId?)`.
- **Wydajność (bez N+1)**: zapytania COUNT(*) z użyciem indeksów `production_orders_rel."orderId"` oraz `orders_studnie_rel."offerStudnieId"`. Fallback na legacy rekordy bez `orderId` przez `json_extract(data, '$.offerId')` (SQLite JSON1 jest wbudowany w build Prisma; w przypadku wątpliwości — zamiennik w sekcji Ryzyka).

```ts
// src/utils/productionOrderGuard.ts (nowy plik)
import prisma from '../prismaClient';

type CntRow = Array<{ cnt: number | bigint }>;

/** Liczba PZ (dowolny status) powiązanych z zamówieniem. */
export async function countProductionOrdersForOrder(
    orderId: string,
    offerId?: string
): Promise<number> {
    const rows = await prisma.$queryRaw<CntRow>`
        SELECT COUNT(*) as cnt FROM production_orders_rel
        WHERE "orderId" = ${orderId}
           OR (${offerId || ''} <> ''
               AND ("orderId" IS NULL OR "orderId" = '')
               AND json_extract(data, '$.offerId') = ${offerId || ''})`;
    return Number(rows?.[0]?.cnt ?? 0);
}

/** Czy oferta studni ma jakiekolwiek PZ (przez zamówienia lub bezpośrednio). */
export async function hasProductionOrdersForOffer(offerId: string): Promise<boolean> {
    const rows = await prisma.$queryRaw<CntRow>`
        SELECT COUNT(*) as cnt
        FROM production_orders_rel po
        WHERE po."orderId" IN (
            SELECT o.id FROM orders_studnie_rel o WHERE o."offerStudnieId" = ${offerId}
        )
           OR json_extract(po.data, '$.offerId') = ${offerId}`;
    return Number(rows?.[0]?.cnt ?? 0) > 0;
}
```

Uwaga: `rows?.[0]?.cnt ?? 0` jest odporne na mocki testowe zwracające `undefined`.

### 3.2 Zamówienie — rozszerzenie warunku

W `studnieOrders.crud.ts:248-262` usunąć pełny skan `SELECT data FROM production_orders_rel` + filtr JS i zastąpić wywołaniem `countProductionOrdersForOrder(docId, offerId)` — status PZ NIE jest sprawdzany (każde PZ blokuje). Semantyka fallbacku (rekordy bez `orderId` dopasowane po `data.offerId`) zachowuje zachowanie obecnej blokady dla danych historycznych.

### 3.3 Rury — rozstrzygnięcie

**Brak jakiejkolwiek kontroli dla rur.** Uzasadnienie: `production_orders_rel` istnieje wyłącznie dla zamówień studni (frontend studni zapisuje `orderId` z `orders_studnie_rel`); moduł rur nie posiada pojęcia PZ (0 trafień grepa). Dodanie kontroli byłoby martwym kodem.

## 4. Komunikaty (PL, spójne backend ↔ frontend)

| Blokada              | Backend `403.error` (plain text)                                                                                              | Frontend pre-check (z ikoną Lucide)                                                                                                                        |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Oferta studni        | `Nie można usunąć oferty — ma przypisane zlecenia produkcyjne. Usuń najpierw zlecenia w zamówieniach tej oferty.`             | `<i data-lucide="x-circle"></i> ` + ten sam tekst                                                                                                          |
| Zamówienie studni    | `Nie można usunąć zamówienia — ma przypisane zlecenia produkcyjne. Usuń najpierw zlecenia w zakładce „Zlecenia produkcyjne”.` | `<i data-lucide="x-circle"></i> ` + ten sam tekst                                                                                                          |
| Element konfiguracji | — (tylko frontend)                                                                                                            | `<i data-lucide="x-circle"></i> Nie można usunąć elementu — ma przypisane zlecenie produkcyjne. Usuń najpierw zlecenie w zakładce „Zlecenia produkcyjne”.` |
| Studnia              | — (tylko frontend)                                                                                                            | `<i data-lucide="x-circle"></i> Nie można usunąć studni — ma przypisane zlecenia produkcyjne. Usuń najpierw zlecenia w zakładce „Zlecenia produkcyjne”.`   |

## 5. Kroki implementacji

### Faza A — Backend (blokady twarde)

**A1. Nowy plik `src/utils/productionOrderGuard.ts`**

- Treść: dwie funkcje z sekcji 3.1.
- Ryzyko: niskie. Zależności: brak.

**A2. `src/routes/orders/studnieOrders.crud.ts` — blokada zamówienia (linie 245-262)**

- Dodać import: `import { countProductionOrdersForOrder } from '../../utils/productionOrderGuard';`
- Po `const offerId = oldData.offerId || '';` (linia 246) zastąpić blok `if (offerId) { ... }` (248-262) na:

```ts
const poCount = await countProductionOrdersForOrder(docId, offerId);
if (poCount > 0) {
    return res.status(403).json({
        error: 'Nie można usunąć zamówienia — ma przypisane zlecenia produkcyjne. Usuń najpierw zlecenia w zakładce „Zlecenia produkcyjne”.'
    });
}
```

- Usunąć stare `prisma.$queryRaw<...>SELECT data FROM production_orders_rel` (249-255).
- Ryzyko: średnie (zmiana semantyki na dokładniejszą + fallback legacy). Zależności: A1.

**A3. `src/routes/offers/crud.ts` — blokada oferty studni (gałąź 141-170)**

- Dodać import: `import { hasProductionOrdersForOffer } from '../../utils/productionOrderGuard';`
- W gałęzi `offer_studnie_*`, PO kontroli uprawnień (linia 155), PRZED `logAudit` (161):

```ts
if (await hasProductionOrdersForOffer(id)) {
    return res.status(403).json({
        error: 'Nie można usunąć oferty — ma przypisane zlecenia produkcyjne. Usuń najpierw zlecenia w zamówieniach tej oferty.'
    });
}
```

- Ryzyko: niskie. Zależności: A1.

**A4. `src/routes/offers/studnieCrud.ts` — blokada `DELETE /studnie/:id` (linia 395)**

- Import jak w A3. Po kontroli uprawnień (linia 412), PRZED `logAudit` (418) — identyczny guard jak A3.
- Ryzyko: niskie. Zależności: A1.
- **Krytyczne**: A3 i A4 MUSZĄ być zrobione razem — `StorageService.deleteOffer` próbuje najpierw `/studnie/:id`, potem `/:id`; oba endpointy muszą blokować, inaczej drugi ominie blokadę.

### Faza B — Backend testy

**B1. Nowy `tests/productionOrderGuard.test.ts`**

- Wzorzec jak w `tests/offers.crud.test.ts` (mock `src/prismaClient` z `$queryRaw: jest.fn()`).
- Przypadki: `hasProductionOrdersForOffer` true (cnt=1) / false (cnt=0) / defensywne `undefined` → false; `countProductionOrdersForOrder` zwraca liczbę; przekazanie poprawnego SQL (asercja, że `$queryRaw` dostał tagowany template z `"orderId" = ` i `offerStudnieId`).
- Zależności: A1.

**B2. Rozszerzenie `tests/offers.crud.test.ts`**

- Dodać do mocka prisma `$queryRaw` już istnieje. Nowe testy:
    - `DELETE /api/offers/studnie/s-1` → 403 gdy `$queryRaw` → `[{ cnt: 1 }]`; `body.error` zawiera „zlecenia produkcyjne”.
    - `DELETE /api/offers/offer_studnie_s-1` (gałąź crud.ts) → 403 analogicznie.
    - Istniejące testy DELETE (215-227, 230-240) muszą nadal przechodzić — `$queryRaw` default `undefined` → guard zwraca 0 → brak blokady.
- Zależności: A3, A4.

**B3. Rozszerzenie `tests/partialOrders.test.ts`**

- Do mocka prisma dodać `$executeRaw: jest.fn()` (używane w DELETE admina).
- Nowe testy:
    - `DELETE /api/orders-studnie/order-1` → 403 gdy `$queryRaw` → `[{ cnt: 1 }]` (PZ w statusie `draft` także blokuje — to sedno wymagania).
    - `DELETE /api/orders-studnie/order-1` → 200 gdy cnt=0.
- Zależności: A2.

### Faza C — Frontend helpery i blokady miękkie

**C1. `public/js/studnie/orderZleceniaHelpers.js` — nowe helpery (na końcu pliku)**

```js
/* ===== BLOKADY USUWANIA PRZY ISTNIEJĄCYCH PZ ===== */
function getProductionOrders() {
    return typeof productionOrders !== 'undefined' && productionOrders ? productionOrders : [];
}
function hasProductionOrderForElement(wellId, elementIndex) {
    return getProductionOrders().some(
        (po) => po.wellId === wellId && po.elementIndex === elementIndex
    );
}
function hasProductionOrderAtOrBelow(wellId, startIndex) {
    // ochrona reindeksacji: usunięcie elementu przesuwa indeksy elementów poniżej
    return getProductionOrders().some(
        (po) => po.wellId === wellId && po.elementIndex >= startIndex
    );
}
function hasAnyProductionOrderForWell(wellId) {
    return getProductionOrders().some((po) => po.wellId === wellId);
}
function getProductionOrdersForOffer(offerId) {
    return getProductionOrders().filter((po) => po.offerId === offerId);
}
```

- Uwaga o kolejności ładowania: `orderZleceniaHelpers.js` (studnie.html:408) ładuje się po `actionsWellCrud.js` (302) i `actionsCrud.js` (328), ale wywołania helperów następują w runtime (po załadowaniu wszystkich skryptów), więc hoisting między plikami jest bezpieczny.
- Ryzyko: niskie. Zależności: brak.

**C2. `public/js/studnie/actionsCrud.js` — `removeWellComponent(index)` (linia 206)**

- Po bloku `isWellLocked()` (211-214), przed `const well = getCurrentWell();` (215) wstawić:

```js
const well = getCurrentWell();
if (
    hasProductionOrderForElement(well.id, index) ||
    hasProductionOrderAtOrBelow(well.id, index + 1)
) {
    showToast(
        '<i data-lucide="x-circle"></i> Nie można usunąć elementu — ma przypisane zlecenie produkcyjne. Usuń najpierw zlecenie w zakładce „Zlecenia produkcyjne”.',
        'error'
    );
    return;
}
```

(wtedy usunąć późniejszą, zduplikowaną deklarację `const well = getCurrentWell();` w linii 215).

- `clearWellConfig()` (linia 309): po `isWellLocked()` (314-317) dodać:

```js
const well = getCurrentWell();
if (hasAnyProductionOrderForWell(well.id)) {
    showToast(
        '<i data-lucide="x-circle"></i> Nie można wyczyścić konfiguracji studni — ma przypisane zlecenia produkcyjne.',
        'error'
    );
    return;
}
```

- `updateWellQuantity(index, 0)` (272) deleguje do `removeWellComponent` → pokryte automatycznie.
- Ryzyko: niskie. Zależności: C1.

**C3. `public/js/studnie/actionsWellCrud.js` — `removeWell(index)` (linia 207)**

- Po bloku `isWellLocked(index)` (212-215), przed `appConfirm` (216):

```js
if (hasAnyProductionOrderForWell(wells[index].id)) {
    showToast(
        '<i data-lucide="x-circle"></i> Nie można usunąć studni — ma przypisane zlecenia produkcyjne. Usuń najpierw zlecenia w zakładce „Zlecenia produkcyjne”.',
        'error'
    );
    return;
}
```

- Ryzyko: niskie. Zależności: C1.

**C4. `public/js/studnie/actionsConfigDrag.js` — zabezpieczenie reindeksacji**

- `moveWellComponent(index, direction)` (linia 4): po `isWellLocked()` (11-14) dodać:

```js
const well = getCurrentWell();
if (hasAnyProductionOrderForWell(well.id)) {
    showToast(
        '<i data-lucide="x-circle"></i> Nie można zmieniać kolejności elementów studni — ma przypisane zlecenia produkcyjne.',
        'error'
    );
    return;
}
```

- `handleCfgDrop` (linia 108): analogiczny guard na początku (po `isWellLocked()` 115-118).
- **Dlaczego**: przesunięcie elementu zmienia `elementIndex`, a PZ są zindeksowane parą (wellId, elementIndex) — bez guardu PZ zacząłby wskazywać inny komponent (cichy błąd danych). `sortWellConfigByOrder()` przy dodawaniu pozostaje poza zakresem (dodawanie nie jest usuwaniem) — odnotowane w Ryzykach.
- Ryzyko: niskie. Zależności: C1.

**C5. `public/js/studnie/orderCrud.js` — `deleteOrderStudnie(orderId)` (linia 398)**

- Zastąpić pre-check (400-411):

```js
const orderPzs = (productionOrders || []).filter(
    (po) => po.orderId === order.id || (!po.orderId && po.offerId === order.offerId)
);
if (orderPzs.length > 0) {
    showToast(
        '<i data-lucide="x-circle"></i> Nie można usunąć zamówienia — ma przypisane zlecenia produkcyjne. Usuń najpierw zlecenia w zakładce „Zlecenia produkcyjne”.',
        'error'
    );
    return;
}
```

- Przy `!res.ok` (linia 426-430) dodać ikonę: `showToast('<i data-lucide="x-circle"></i> ' + (errData.error || 'Błąd usuwania zamówienia'), 'error');`
- Ryzyko: niskie. Zależności: C1 (opcjonalnie — można inline).

**C6. `public/js/studnie/offerFileOps.js` — `deleteOfferStudnie(id)` (linia 4)**

- Na początku funkcji (przed `appConfirm`):

```js
if (getProductionOrdersForOffer(id).length > 0) {
    showToast(
        '<i data-lucide="x-circle"></i> Nie można usunąć oferty — ma przypisane zlecenia produkcyjne. Usuń najpierw zlecenia w zamówieniach tej oferty.',
        'error'
    );
    return;
}
```

- Przy `!res.ok` (linia 19) dodać ikonę: `showToast('<i data-lucide="x-circle"></i> ' + (err.error || 'Błąd usuwania'), 'error');`
- Ryzyko: niskie. Zależności: C1.

**C7. `public/js/shared/StorageService.js` — `deleteOffer(id)` (linia 145-190)**

- **Problem**: pętla po endpointach kontynuuje przy KAŻDYM `!ok` niebędącym 500 → 403 z pierwszego endpointu powoduje próbę drugiego (który dla `offer_studnie_*` też zwróci 403 po A3) i finalnie generyczny błąd „Nie udało się usunąć oferty z żadnego endpointu” — użytkownik nie widzi polskiego komunikatu.
- **Fix**: w pętli, przed obsługą 500, dodać:

```js
if (res.status === 403) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Nie można usunąć oferty — operacja zablokowana przez serwer');
}
```

- To pozwala `deleteOfferWithConfirmation` (pvSalesActions.js:452-462) pokazać właściwy komunikat (catch → toast).
- Ryzyko: niskie. Zależności: A3+A4 (inaczej 403 nigdy nie wystąpi).

**C8. PV Sales — `pvSalesActions.js`**

- `deleteOrderUnified` (356): już rzuca `data.error` przy `!response.ok` (386) → toast pokaże komunikat backendu. Bez zmian.
- `deleteOfferWithConfirmation` (441): po C7 komunikat przepłynie przez catch (457-461). Bez zmian kodu.

## 6. Strategia testów

### Backend (Jest + supertest, wzorzec `tests/offers.crud.test.ts`)

- `tests/productionOrderGuard.test.ts` (NOWY): jednostkowe dla helperów — liczniki, fallback, defensywne `undefined`.
- `tests/offers.crud.test.ts`: 2 nowe przypadki 403 dla obu endpointów DELETE oferty studni; regresja istniejących DELETE.
- `tests/partialOrders.test.ts`: 403 dla PZ `draft` (sedno wymagania nr 2) i 200 dla braku PZ; dodać `$executeRaw` do mocka.

### Frontend

- Guardy to proste predykaty `.some()` — testy jednostkowe YAGNI. Weryfikacja: `node -c` + lint + `typecheck:frontend`.
- Testy manualne (scenariusze):
    1. Studnie: utwórz ofertę → zamówienie → PZ (draft) → próba usunięcia oferty/zamówienia/elementu/studni → blokada z toastem; po usunięciu PZ → operacja dozwolona.
    2. PZ accepted → dotychczasowe blokady nadal działają (regresja).
    3. PV Sales (kartoteka): usunięcie oferty studni z PZ → polski komunikat 403 zamiast generycznego.
    4. Rury: usunięcie oferty/zamówienia rur działa bez zmian (regresja).

## 7. Ryzyka i mitigacje

- **Reindeksacja elementIndex (ryzyko danych)**: PZ dopasowywane po (wellId, elementIndex); usuwanie/przesuwanie elementów przesuwa indeksy. Mitigacja: C2 (guard na `removeWellComponent` + `hasProductionOrderAtOrBelow`), C4 (blokada reorderu), C3 (blokada usuwania studni). **Ryzyko resztkowe**: `sortWellConfigByOrder()` (wywoływany przy dodawaniu, `actionsConfigSort.js:86`) oraz `autoSelectComponents` (solver) mogą przesunąć indeksy przy istnieniu PZ draft. Zalecane (poza zakresem): przyszła migracja PZ na stabilny identyfikator (np. productId+uid) — ADR.
- **Legacy rekordy PZ bez `orderId`**: pokryte fallbackiem `json_extract(data,'$.offerId')`. Jeśli JSON1 byłby niedostępny w buildzie SQLite (mało prawdopodobne — wbudowany), zamiennik: `SELECT data, "orderId" FROM production_orders_rel WHERE "orderId" = ? OR "orderId" IS NULL OR "orderId" = ''` + filtr w JS.
- **Ominięcie blokady przez drugi endpoint**: wykluczone — A3 i A4 blokują oba endpointy oferty studni; C7 zatrzymuje pętlę StorageService na 403.
- **Mocki testowe**: helpery odporne (`rows?.[0]?.cnt ?? 0`), istniejące testy DELETE nie wymagają zmian poza dodaniem `$executeRaw` w `partialOrders.test.ts`.
- **Komunikaty**: backend zwraca plain text, frontend dodaje ikonę Lucide — spójne treści w tabeli sekcji 4.

## 8. Komendy weryfikacji (w tej kolejności)

```bash
npm run typecheck
npm run lint
npm run lint:frontend
node -c public/js/studnie/orderZleceniaHelpers.js
node -c public/js/studnie/actionsCrud.js
node -c public/js/studnie/actionsWellCrud.js
node -c public/js/studnie/actionsConfigDrag.js
node -c public/js/studnie/orderCrud.js
node -c public/js/studnie/offerFileOps.js
node -c public/js/shared/StorageService.js
npx jest tests/productionOrderGuard.test.ts tests/offers.crud.test.ts tests/partialOrders.test.ts
npm run format
npm run format:check
```

## 9. Kryteria sukcesu

- [ ] `DELETE /api/offers/studnie/:id` i `DELETE /api/offers/:id` (gałąź `offer_studnie_*`) zwracają 403 z polskim komunikatem, gdy oferta ma PZ (dowolny status); 200 bez PZ.
- [ ] `DELETE /api/orders-studnie/:id` zwraca 403 dla PZ `draft` ORAZ `accepted`; 200 bez PZ.
- [ ] Rury: brak zmian w zachowaniu DELETE (oferta i zamówienie).
- [ ] Frontend studni: pre-checki blokują usuwanie oferty/zamówienia/studni/elementu z toastem z ikoną `<i data-lucide="x-circle"></i>`; operacje dozwolone po usunięciu PZ.
- [ ] Reindeksacja: usuwanie/przesuwanie elementów w studni z PZ zablokowane (C2/C4).
- [ ] PV Sales pokazuje polski komunikat 403 (C7).
- [ ] `npm run typecheck`, `lint`, `lint:frontend`, `node -c`, testy, `format` przechodzą.

## 10. Stan wdrożenia (2026-08-02)

**Status: WDROŻONE.** Wszystkie fazy A–C oraz testy B1–B3 zrealizowane. Rury bez zmian (zgodnie z sekcją 3.3).

### Faktycznie zmienione pliki

Nowe:

- `src/utils/productionOrderGuard.ts` — helpery backend (`hasProductionOrdersForOffer`, `countProductionOrdersForOrder`).
- `public/js/studnie/pzGuard.js` — pre-checki frontend (`window.pzGuard`: `hasPzForOffer`, `hasPzForOrder`, `hasPzForWell`, `hasPzForElementAtOrAfter`).
- `tests/productionOrderGuard.test.ts` — testy jednostkowe helperów.

Zmodyfikowane:

- `src/routes/offers/crud.ts` — DELETE `/:id`, gałąź `offer_studnie_*` → 403 przy PZ (linia ~158).
- `src/routes/offers/studnieCrud.ts` — DELETE `/studnie/:id` → 403 przy PZ (linia ~415).
- `src/routes/orders/studnieOrders.crud.ts` — DELETE `/:id` → 403 dla KAŻDEGO statusu PZ (linia ~249).
- `public/js/studnie/actionsWellCrud.js` — `removeWell` blokowane przez `hasPzForWell`.
- `public/js/studnie/actionsCrud.js` — `removeWellComponent` przez `hasPzForElementAtOrAfter`, `clearWellConfig` przez `hasPzForWell`.
- `public/js/studnie/actionsConfigDrag.js` — `moveWellComponent` i drag-reorder blokowane przez `hasPzForWell`.
- `public/js/studnie/orderCrud.js` — `deleteOrderStudnie` pre-check przez `hasPzForOrder` + ikona w toastcie przy 403.
- `public/js/studnie/offerFileOps.js` — `deleteOfferStudnie` pre-check przez `hasPzForOffer` + ikona w toastcie przy 403.
- `public/js/shared/StorageService.js` — `deleteOffer` propaguje `data.error` przy 403 zamiast generycznego komunikatu (C7).
- `tests/partialOrders.test.ts` — 403 dla PZ `draft` i `accepted`, 200 bez PZ.
- `tests/offers.crud.test.ts` — 403 dla obu endpointów DELETE oferty studni.

### Odchylenia od planu

- **C1 — lokalizacja helperów frontend**: plan zakładał nowe funkcje w `public/js/studnie/orderZleceniaHelpers.js`; wdrożenie umieściło je w osobnym pliku `public/js/studnie/pzGuard.js` (dodanym do `studnie.html`) z eksportem przez `window.pzGuard = { hasPzForOffer, hasPzForOrder, hasPzForWell, hasPzForElementAtOrAfter }`. Nazwy i semantyka zgodne z intencją C1 (w tym `hasPzForElementAtOrAfter` chroniący przed reindeksacją).
- **Komunikaty**: treści popupów zgodne z sekcją 4; PV Sales wyświetla komunikat backendu dzięki C7.

### Kryteria sukcesu — status

- [x] `DELETE /api/offers/studnie/:id` i gałąź `offer_studnie_*` zwracają 403 z polskim komunikatem przy PZ; 200 bez PZ.
- [x] `DELETE /api/orders-studnie/:id` zwraca 403 dla PZ `draft` ORAZ `accepted`; 200 bez PZ.
- [x] Rury: brak zmian w zachowaniu DELETE.
- [x] Frontend studni: pre-checki blokują usuwanie oferty/zamówienia/studni/elementu z toastem `<i data-lucide="x-circle"></i>`.
- [x] Reindeksacja: usuwanie/przesuwanie elementów w studni z PZ zablokowane.
- [x] PV Sales pokazuje polski komunikat 403.
- [x] `npm run typecheck`, `lint`, `lint:frontend`, testy, `format` przechodzą.
