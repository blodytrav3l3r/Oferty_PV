# Plan naprawy: banner „Błędy w konfiguracji studni:" — odświeżanie w czasie rzeczywistym

Data: 2026-08-02
Moduł: studnie (frontend Vanilla JS, `public/js/studnie/`)
Status: PLAN (do akceptacji)
Plik wynikowy: `docs/plans/banner-errors-realtime-fix.md`

## 1. Przegląd

Zgłoszony błąd: pole „Błędy w konfiguracji studni:" w konfiguratorze (kontener
`#well-config-errors-container`, `public/partials/studnie/step3-offer.html:37-51`)
nie odświeża się w czasie rzeczywistym i nie odpowiada stanowi faktycznemu.

Weryfikacja kodu wykazała, że **hipoteza zgłoszenia jest częściowo nietrafna**:

- Sam banner odświeża się **bezwarunkowo** — `actionsElevation.js:103-115` zawsze
  nadpisuje `innerHTML`/`display` kontenera przy każdym wywołaniu
  `updateHeightIndicator()`. Warunek z linii 117-118 **nie bramkuje bannera** —
  bramkuje tylko ponowny render **listy studni po lewej** (`renderWellsList()`).
- Prawdziwy defekt: porównanie na `actionsElevation.js:117-118` jest **tautologią
  (dead code)** — `prevErrors` czytane jest PO wywołaniu `recalculateWellErrors(well)`
  (linia 100), które w `solverValidation.js:133` podmienia `well.configErrors` na
  nową tablicę. Warunek `prevErrors !== liveErrors.length` porównuje więc tę samą
  tablicę z samą sobą i jest **zawsze fałszywy** → `renderWellsList()` z poziomu
  `updateHeightIndicator` **nigdy się nie wykonuje**.
- Skutek widoczny dla użytkownika: gdy zmienia się **treść** błędów przy tej samej
  **liczbie** (np. 1 błąd zastąpiony innym), lista studni po lewej (czerwone tło
  karty, badge statusu, podgląd treści błędów — `wellUI.js:119-123, 155-160`) oraz
  jedyna ścieżka mutacji bez `updateSummary` (`handleCfgDragEnd`,
  `actionsConfigDrag.js:228-232`) pozostają **nieaktualne**.
- Druga przyczyna „nie odpowiada stanowi faktycznemu": `solverValidation.js:17-24`
  **zachowuje** błędy solvera (typu „Kolizja otworu…", „Zastosowana rozszerzona
  tolerancja…") po ręcznej edycji konfiguracji, która je rozwiązuje — kasowane są
  dopiero przez kolejny pełny `autoSelectComponents`. To ograniczenie projektowe
  (re-walidacja tylko luzów przejść), naprawiane częściowo w tym planie
  (sekcja 6.4 — poza zakresem głównym, dokumentacja).

Cel: banner i lista studni mają zawsze odzwierciedlać aktualny stan błędów
aktualnej studni, z minimalnym diffem i bez regresji wydajności przy wielu
studniach.

## 2. Zweryfikowane fakty (plik:linia)

### Warunek odświeżania (rdzeń błędu)

- `public/js/studnie/actionsElevation.js:84` — `function updateHeightIndicator()`.
- `:91` — early return, gdy brak `well-required-height` / `well-configured-height` /
  `height-diff-indicator` (banner pomijany razem z nimi — ten sam wiersz UI).
- `:100` — `recalculateWellErrors(well)` — **mutuje** `well.configErrors`.
- `:101` — `let liveErrors = well.configErrors || [];` — alias do nowej tablicy.
- `:103-115` — **bezwarunkowy** render bannera (`innerHTML` + `display`, `escapeHtml`,
  `lucide.createIcons()`).
- `:117-118` — `const prevErrors = well.configErrors ? well.configErrors.length : 0;`
  `if (prevErrors !== liveErrors.length) renderWellsList();` — **TAUTOLOGIA**,
  `renderWellsList()` nigdy nie wywoływane stąd.
- `public/js/studnie/solverValidation.js:133` — `well.configErrors = [...new Set(liveErrors)]`
  (podmiana referencji — źródło tautologii).
- `solverValidation.js:12-136` — `recalculateWellErrors()`: waliduje **wyłącznie
  luzy przejść**; błędy nie-luzowe (solvera) tylko **filtruje i zachowuje**
  (linie 17-24), nie re-waliduje.
- `solverValidation.js:139-142` — `refreshAllWellErrors()` — wspólny punkt
  przeliczenia błędów WSZYSTKICH studni (wołany z `renderWellsList` i
  `renderOfferSummary`).

### Punkty renderowania

- `public/js/studnie/wellUI.js:6-210` — `window.renderWellsList`: na starcie
  `refreshAllWellErrors()` (linia 11); karta studni: błędy inline (119-123),
  czerwone tło `validateAutomatedErrors` (155-160).
- `wellUI.js:213-336` — `updateSummary`: na końcu `updateHeightIndicator()`
  (linia 327) + guarded `renderWellsList()` (331-335).
- `public/js/studnie/offerRendering.js:22` — `refreshAllWellErrors()` na renderze
  zakładki Oferta (nie dotyka bannera konfiguratora — inna zakładka).

### Ścieżki mutacji → czy docierają do odświeżenia bannera?

Wszystkie główne ścieżki mutacji docierają do `updateHeightIndicator` (bezpośrednio
lub przez `refreshAll()` → `syncElevationInputs()` → `updateHeightIndicator()`):

| Ścieżka mutacji                                                                                                                             | Wywołanie odświeżenia                                                                     |
| ------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `actionsCrud.js:182, 270` (add/removeWellComponent)                                                                                         | `updateSummary()` + `renderWellsList()` + `updateHeightIndicator()`                       |
| `actionsCrud.js:313` (updateWellQuantity)                                                                                                   | `updateSummary()` + `updateHeightIndicator()`                                             |
| `actionsCrud.js:339` (clearWellConfig)                                                                                                      | `refreshAll()`                                                                            |
| `actionsConfigDrag.js:38, 160, 215` (move/drop)                                                                                             | `updateSummary()` + `updateHeightIndicator()`                                             |
| `actionsConfigDrag.js:228-232` (handleCfgDragEnd)                                                                                           | **tylko** `updateHeightIndicator()` — JEDYNA LUKA (w rAF)                                 |
| `actionsDrag.js:155, 166` (drop do diagramu)                                                                                                | `updateSummary()`                                                                         |
| `actionsElevation.js:33` (updateElevations)                                                                                                 | `updateHeightIndicator()` + `_debouncedRefreshWells()`                                    |
| `wellManager.js:8-54` `refreshAll()` → `:34` `syncElevationInputs()`                                                                        | `updateHeightIndicator()` (banner) + `renderWellsList()` (lista)                          |
| `actionsWellConfig.js:32, 77, 120, 167, 240, 292`                                                                                           | `refreshAll()`                                                                            |
| `wellTransitionsCrud.js:38, 109`; `wellTransitionsInline.js:105`; `wellTransitionsPopup.js:261, 339`; `popupsTransitionManager.js:668, 838` | `refreshAll()` / `autoSelectComponents` → `refreshAll()`                                  |
| `solverAutoSelect.js:76, 88, 157` (autoSelectComponents)                                                                                    | `refreshAll()`                                                                            |
| Excel: `excelChangeHandlers.js` (`_excelMarkManual` 174-185 → `updateSummary`; `_excelDebouncedRefresh` 43, 87…)                            | `excelPolling.js:83-95` (debounce 800 ms) → `updateSummary()` → `updateHeightIndicator()` |

→ **Wniosek:** brakuje WYŁĄCZNIE re-renderu listy w ścieżkach wołających sam
`updateHeightIndicator`; banner jest odświeżany wszędzie tam, gdzie
`updateHeightIndicator` się wykonuje. Nie potrzeba dopinania per-ścieżek —
wystarczy naprawa wspólnego punktu (sekcja 4).

### Debounce („nie w czasie rzeczywistym" — odczucie, nie defekt)

- `actionsElevation.js:251-253` — `_debouncedRefreshWells` (250 ms, lista).
- `actionsElevation.js:36-40` — auto-dobór po 300 ms od zmiany rzędnych.
- `excelPolling.js:83-95` — `_excelDebouncedRefresh` (800 ms, edycja w Excel).
  Debounce są zamierzone (wydajność); banner w obrębie `updateHeightIndicator`
  jest synchronizowany. **Nie zmieniamy debounce'ów.**

## 3. Decyzje architektoniczne

### 3.1 Jeden wspólny punkt zamiast dopinania per-ścieżek (odpowiedź na pytanie 2)

- **Punkt przeliczenia błędów** (chokepoint): `refreshAllWellErrors()` —
  już wołany z `renderWellsList` i `renderOfferSummary`. Bez zmian.
- **Punkt renderu bannera** (chokepoint): `updateHeightIndicator()` —
  już wołany ze wszystkich ścieżek mutacji (tabela w sekcji 2). Bez zmian.
- **Poprawiamy tylko warunek wewnątrz `updateHeightIndicator`** — to domyka
  automatycznie lukę `handleCfgDragEnd` oraz wszystkie przypadki
  „liczba bez zmian, treść inna" dla listy. Zero nowego okablowania.

### 3.2 Porównanie treści zamiast liczby (odpowiedź na pytanie 1)

Zamiast `prevErrors !== liveErrors.length` — porównanie **klucza treści**
(usunięte duplikaty, posortowane, zserializowane), przechwycone PRZED
`recalculateWellErrors(well)`. Sortowanie klucza stabilizuje porównanie
(ta sama treść w innej kolejności = brak re-renderu; kolejność w bannerze
pozostaje oryginalna, bo render używa `liveErrors` bez sortowania).

## 4. Kroki implementacji

### Krok 1 — `public/js/studnie/actionsElevation.js`, `updateHeightIndicator()` (linie 100-118)

Zastąpić blok:

```js
// PRZED (linie 100-118):
recalculateWellErrors(well);
let liveErrors = well.configErrors || [];
// ... banner (103-115) ...
const prevErrors = well.configErrors ? well.configErrors.length : 0;
if (prevErrors !== liveErrors.length) renderWellsList();
```

na:

```js
// PO:
const errorsKey = (arr) => JSON.stringify([...(arr || [])].sort());
const prevErrorsKey = errorsKey(well.configErrors);
recalculateWellErrors(well);
let liveErrors = well.configErrors || [];
// ... banner (bez zmian, linie 103-115 — pozostaje bezwarunkowy) ...
if (prevErrorsKey !== errorsKey(liveErrors)) _debouncedRefreshWells();
```

- `prevErrorsKey` musi być przechwycony PRZED linią 100 (przed mutacją przez
  `recalculateWellErrors`).
- `_debouncedRefreshWells` (istniejący debounce 250 ms, linie 251-253) zamiast
  surowego `renderWellsList()` — spójne z `updateElevations` (linia 34) i
  chroni przed pełnym re-renderem listy przy każdym znaku wpisywania rzędnej
  (w każdej iteracji `updateElevations` wywołuje `updateHeightIndicator`).
  Referencja do `const` zadeklarowanego niżej w module jest bezpieczna —
  wywołanie następuje w runtime, po inicjalizacji modułu (brak TDZ).
- Banner pozostaje **synchronizowany** (real-time) — zmiana dotyczy wyłącznie
  odroczonego re-renderu listy.
- **Wariant alternatywny (jeśli zespół woli pełną synchroniczność listy):**
  zostawić bezpośrednie `renderWellsList()` zamiast `_debouncedRefreshWells()`.
  Koszt: 1 dodatkowy render listy w łańcuchu `updateSummary` (linie 327 → 331-335)
  oraz re-render przy każdym znaku rzędnej. Rekomendacja: wariant z debounce.

Walidacja po zmianie: `node -c public/js/studnie/actionsElevation.js`,
`npm run lint:frontend`, `npm run format`.

### Krok 2 — `public/js/studnie/solverValidation.js` (opcjonalne utwardzenie, poza głównym scope)

Udokumentować (komentarz przy liniach 17-24) ograniczenie: błędy nie-luzowe są
zachowywane do czasu kolejnego `autoSelectComponents`; ręczna edycja, która
rozwiązuje błąd solvera, nie kasuje go natychmiast (sekcja 6.4). **Bez zmiany
logiki w tym planie** — pełna re-walidacja kolizji po edycji ręcznej to osobny
temat (wymaga wywołania walidacji solvera z `actionsCrud`/`actionsConfigDrag`
zamiast `recalculateWellErrors`).

### Krok 3 — bez zmian w pozostałych plikach

- `wellUI.js`, `actionsCrud.js`, `actionsConfigDrag.js`, `actionsWellConfig.js`,
  `wellManager.js`, `excel*.js`, `popupsTransitionManager.js` — **brak modyfikacji**.
- `solverValidation.js` — tylko komentarz (Krok 2), brak zmiany logiki.

## 5. Testy regresyjne

Wzorce: `tests/studnie/recalculateWellErrors.test.ts` i
`tests/studnie/excelDrilledRings.test.ts` (sandbox `vm` + stuby globali).

### 5.1 Nowy plik: `tests/studnie/updateHeightIndicator.test.ts`

Ładowanie `public/js/studnie/actionsElevation.js` w kontekście `vm` ze stubami:

- `getCurrentWell: () => well` (mutowalne per test),
- `document.getElementById: (id) => stubEl` — stub z `style: {}`,
  `textContent`, `innerHTML`, `classList: { add(){}, remove(){} }`; dla
  `well-config-errors-container` zwracany obiekt musi rejestrować `innerHTML`
  i `style.display`,
- `recalculateWellErrors: jest.fn((w) => { w.configErrors = nextErrors;
w.configStatus = nextErrors.length ? 'ERROR' : 'OK'; })` — test steruje `nextErrors`,
- `calcWellStats: () => ({ height: 2000 })`,
- `renderWellsList: jest.fn()` — do asercji (przez `_debouncedRefreshWells`,
  którego fallback bez `window.debounce` = wywołanie bezpośrednie),
- `escapeHtml: (s) => String(s)`,
- `window: { lucide: { createIcons: () => {} } }` (bez `window.debounce` → fallback
  synchroniczny, deterministyczny test).

Przypadki (regresja zgłoszonego błędu + ochrona przed nadmiernymi renderami):

1. **Ta sama liczba błędów, inna treść** → `renderWellsList` wywołane RAZ;
   `innerHTML` bannera zawiera nową treść błędu (główny przypadek zgłoszenia).
2. **Zmiana liczby 1 → 0** → banner `style.display = 'none'`, `renderWellsList`
   wywołane (błąd znika także z listy).
3. **Zmiana liczby 0 → 1** → banner `display = 'block'` + treść, `renderWellsList`
   wywołane.
4. **Brak zmian treści** → `renderWellsList` NIE wywołane (guard wydajnościowy).
5. **Ten sam zbiór, inna kolejność** → `renderWellsList` NIE wywołane
   (stabilność klucza sortowanego).
6. **Treść bannera przez `escapeHtml`** → `innerHTML` zawiera zeskapowaną treść
   (ochrona XSS przy współdzielonym renderze oferty/zamówienia).
7. _(opcjonalnie, integracyjnie)_ Załadować w tym samym kontekście prawdziwy
   `solverValidation.js` (fixtury jak w `recalculateWellErrors.test.ts`):
   studnia z 2 przejściami → zmiana `rzednaWlaczenia` jednego z nich przy
   zachowaniu liczby błędów → banner pokazuje nowy komunikat.

### 5.2 Checklista manualna (bez automatyzacji — do wykonania w przeglądarce)

- Konfigurator: przesunięcie przejścia w popupie → banner i lista odświeżone
  (liczba błędów bez zmian, treść inna).
- Drag reorder (`handleCfgDragEnd`): zmiana kolejności elementów → lista
  odświeżona po ≤250 ms.
- Excel (modal otwarty): zmiana ilości kręgu/przejścia → banner aktualny
  po debounce ≤800 ms.
- Tryb edycji zamówienia (`orderEditMode`): usunięcie elementu z błędem → banner
  znika (współdzielony render — brak regresji).
- Studnia z PZ (zablokowana): brak zmian w zachowaniu (re-validacja jest
  read-only dla `configErrors`).

## 6. Ryzyka i mitygacje

### 6.1 Wydajność przy wielu studniach (Excel bulk 50+)

- **Ryzyko**: naprawiony warunek wywołuje `_debouncedRefreshWells()` częściej
  niż dotychczasowy dead code → `renderWellsList()` → `refreshAllWellErrors()`
  = O(studnie × config × przejścia) przy każdym zdarzeniu zmiany treści błędów.
- **Mitygacja**: (a) debounce 250 ms (konsolidacja serii zmian, np. wpisywanie
  rzędnej); (b) guard treści — brak zmian = brak renderu; (c) klucz liczony na
  tablicy błędów (koszt pomijalny). Jeśli nadal za wolno — mierzyć i ewentualnie
  wywoływać `refreshAllWellErrors` tylko dla bieżącej studni w
  `_debouncedRefreshWells` (osobny temat).

### 6.2 Podwójny render listy w łańcuchu `updateSummary`

- **Ryzyko**: `updateSummary` → `updateHeightIndicator` (debounced
  `renderWellsList`) ORAZ własny guarded `renderWellsList` (linie 331-335) →
  2 rendery listy w odległości 250 ms przy każdej zmianie treści błędów.
- **Mitygacja**: render idempotentny, brak rekurencji (renderWellsList nie woła
  updateHeightIndicator); koszt ograniczony do przypadków faktycznej zmiany
  błędów. Wariant bez debounce (sekcja 4, Krok 1) eliminuje podwójny render
  kosztem synchroniczności — decyzja do potwierdzenia w code review.

### 6.3 Interakcje z trybem zamówienia, PZ, Excelem

- **Ryzyko**: niskie. Zmiana dotyczy wyłącznie warunku wewnątrz
  `updateHeightIndicator`; nie dotyka `orderEditMode` (współdzielony render),
  guardów PZ (`pzGuard.js` — re-validacja błędów nie mutuje konfiguracji) ani
  logiki Excela (ścieżki excel* już konwergują do `updateSummary`/
  `updateHeightIndicator`).
- **Mitygacja**: checklista manualna (sekcja 5.2) pokrywa te tryby.

### 6.4 Znane ograniczenie NIE naprawiane tym planem

- **Ryzyko oczekiwań**: ręczna edycja rozwiązująca błąd SOLVERA (kolizja otworu,
  tolerancja) nie kasuje go do czasu kolejnego `autoSelectComponents` —
  to zachowanie `solverValidation.js:17-24`, poza zakresem tego planu.
- **Mitygacja**: komentarz w kodzie (Krok 2) + ewentualny osobny plan
  (re-walidacja kolizji po edycji ręcznej przez wywołanie walidacji solvera
  z `actionsCrud`/`actionsConfigDrag`).

## 7. Kryteria sukcesu

- [ ] `updateHeightIndicator` odświeża listę studni przy zmianie TREŚCI błędów
      (liczba bez zmian) — warunek oparty o klucz treści, nie liczbę.
- [ ] Banner aktualizowany synchronizowanie przy każdej zmianie (bez zmian,
      już działał — potwierdzone testem).
- [ ] Brak nowych ścieżek per-mutacja — jeden wspólny punkt naprawiony.
- [ ] `tests/studnie/updateHeightIndicator.test.ts` przechodzi (6 przypadków).
- [ ] `npm run typecheck:frontend` / `npm run lint:frontend` / `node -c` czyste.
- [ ] Checklista manualna (sekcja 5.2) wykonana bez regresji w trybie
      oferty, zamówienia, Excel i przy studniach z PZ.
