# Plan: Kartoteka Zleceń — zgodność z wizualizacją (aktualizacja 2026-08-08)

Data: 2026-08-08
Status: **W trakcie realizacji — fazy 0–6 wdrożone, faza 7 zablokowana (brak reguły biznesowej), faza 8 opcjonalna (wymaga wyraźnego żądania pixel-parity)**
Pierwotny status planu: **Plan wdrożenia — nadpisuje poprzednią rekomendację „wariant C (nie wirtualizować)"**
Decyzja użytkownika: stan na żywo ma być zgodny z wizualizacją (`zlecenia-preview.html`), z minimalnym ryzykiem regresji.
Zakres: `public/zlecenia.html`, `public/js/spa/zlecenia.js`, `public/js/spa/zleceniaHelpers.js`, `public/css/zlecenia.css`, `src/routes/orders/production.ts`, `src/routes/orders/productionSearch.ts`, `src/utils/productionSearchUtils.ts`, `tests/`

---

## 0. Stan wdrożenia (2026-08-08)

Wszystkie zmiany poniżej są **uncommitted** (pracują na nich subagenci build/refactor — patrz DELETION_LOG.md dla szczegółów usunięć).

- **Faza 0 — [DONE]** Naprawa blokerów walidacji: `npm run typecheck:frontend` przechodzi (guard `instanceof HTMLElement` w delegacji zdarzeń, 3 błędy TS2339 usunięte), dodany CSS `.zlecenia-date-filter`/`.zlecenia-date-sep`, `aria-label` przez `escapeJsStr`, `prefer-const` dla `selectedIds`.
- **Faza 1 — [DONE]** Cleanup: usunięty martwy `GET /registry` (`src/routes/orders/production.ts`), dedupe mapowania PZ do `mapProductionOrderRow`, usunięte martwe eksporty `stopAutoRefresh`/`toggleSelect` z `AppZlecenia`, usunięte 4 zbędne re-rejestracje `window.*` (`zleceniaHelpers.js`), usunięte `id="zlecenia-filter-tabs"`, poprawione komentarze kolumn w media queries, DRY `buildZleceniePayload`/`buildEtykietaPayload` (716 → 618 linii).
- **Faza 2 — [DONE]** Batch-delete hardening: backend `POST /batch-delete` pomija `accepted` i zwraca `{ deleted, skipped }` (403 tylko przy braku uprawnień); frontend `deleteSelectedOrders` chunkuje ids po 200 (sekwencyjnie, rate limiter 60/min), toast „Usunięto X, pominięto Y".
- **Faza 3 — [DONE]** Kontener scrolla: `.zlecenia-table-container` `height: min(480px, 60vh); overflow-y: auto`, sentinel przeniesiony do kontenera, IntersectionObserver z `root: kontener` (bez tego eager-load w pętli), sticky `th` z nieprzezroczystym tłem `var(--bg-card)`. **Rewersja (decyzja użytkownika, 2026-08-08):** scroll całej strony zamiast wewnętrznego paska — usunięto `height`/`overflow-y` z kontenera, sentinel wrócił za kontener, IO na `root: null` (viewport). Sticky `th` zostaje (przykleja się do góry okna).
- **Faza 4 — [DONE]** Tri-state select-all 3-stanowy: `selectState: 0|1|2` (none/visible/all), cykl 0→1→2→0, `updateSelectAllState` liczy stan z `selectedIds` + `items`, batch bar z `.batch-scope` („— wszystkie spełniające filtr" / „— widoczne"), przyciski „Odznacz widoczne" / „Odznacz wszystko".
- **Faza 5 — [DONE]** Agregaty COUNT + cursor fix: backend — jedno zapytanie COUNT + `SUM(CASE ...)` (total/accepted/draft/today) współdzielące WHERE z search, odpowiedź `stats: {...}`; cursor fix w `productionSearchUtils.ts` (`normalizedCreatedAtSql` zamiast surowej kolumny); frontend `renderStats` czyta `searchResults.stats` + `decrementStats` po usunięciu.
- **Faza 6 — [DONE]** Tożsamość wizualna: `.zlecenia-batch-bar--sticky` (różowy, `bottom: 10px`, `z-index: 50`), toolbar `.zlecenia-virtual-toolbar` (daty przeniesione z headera, select użytkownika z `/api/users-for-assignment`, przycisk „Wyczyść filtry (N)"), chipsy `.zlecenia-chips`/`.zlecenia-chip`, sentinel ze spinnerem `.zlecenia-sentinel-spin`, stat icon klasy `.zlecenia-stat-icon--*` zamiast inline styli.
- **Faza 7 — [BLOKOWANA]** Duplikaty: **nie wykonano** — brak reguły biznesowej „co to jest duplikat PZ" od użytkownika. Nie wymyślamy semantyki.
- **Faza 8 — [OPCJONALNA]** Grid-swap: **nie wykonano** — tylko na wyraźne żądanie pixel-parity.

> Aktualizacja dokumentacji (2026-08-08): plan oznacza powyższy status, CHANGELOG.md otrzymał wpis `feat(zlecenia)`, AGENTS.md sekcja 5 dostała wiersze #35–#39 w Bazie Znanych Błędów. Wersja NIE jest podbijana — robi to `npm run release`.

---

## 1. Stan faktyczny (zweryfikowany w kodzie 2026-08-08)

F1–F4 (uncommitted, ~565+/191−) już wdrożone:

- Sentinel infinite scroll w `<table>`, `SEARCH_LIMIT=500`, `MAX_LOADED=1000`, gate animacji `.zlecenia-table--flat`, scoped `lucide.createIcons({root: tbody})`.
- Batch-delete (endpoint z limitem **200 ids/request**), tri-state select-all 2-stanowy + natywny `indeterminate`, race-fix `requestSeq`/`abortController`, epoch-dates (`normalizedCreatedAtSql`).

Weryfikacja (build-error-resolver): `npm run typecheck` ✅, `node -c` ✅ (oba), `npm run lint` ✅, `npm run lint:frontend` ⚠️ 1 warning. **🔴 `npm run typecheck:frontend` FAIL — 3 błędy TS2339 w `zlecenia.js:375,378`** (blokada pre-push/`validate`).

## 2. Sprzeczności wizji ze stanem (rozstrzygnięcia)

| Element wizji                                    | Rozstrzygnięcie                                                                                                                                                |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 4 karty „ze /stats"                              | `/stats` **nie istnieje i NIE wskrzeszamy go** — zamiast tego agregaty `COUNT` w istniejącym zapytaniu search (Faza 5). Tańsze, cache'owane tym samym kluczem. |
| „Usuń (1243), pominięto 43 zatwierdzone"         | Backend: batch-delete pomija `accepted` i zwraca `{deleted, skipped}` zamiast 403 (Faza 2). Limit 200/request zostaje; frontend chunkuje.                      |
| Tri-state „☑ wszystkie spełniające filtr · 1243" | 3. stan obejmuje **załadowane** `searchResults.items` (≤ MAX_LOADED) — uczciwa etykieta scope, nie 1243.                                                       |
| Scroll 60vh                                      | Kontener scrolla na istniejącej `<table>` (`height: min(480px, 60vh); overflow-y: auto`), sentinel z `root: kontener`.                                         |
| „Dodaj zlecenie"                                 | **Odrzucone przez użytkownika — NIE wdrażamy.**                                                                                                                |
| Duplikaty (badge)                                | **BLOKER:** brak reguły biznesowej „co to jest duplikat PZ" w repo. Nie wymyślamy semantyki — czekamy na decyzję użytkownika (Faza 6).                         |

## 3. Decyzja architektoniczna: Wariant A′ (zamiast pełnego gridu z wirtualizacją)

**Rekomendacja: zachować `<table>`, dodać stałej wysokości kontener scrolla, resztę wizji dobudować addytywnie.** Pełna wirtualizacja okna (grid + spacer + okno) zostaje odrzucona — argumenty poprzedniego planu (kruchość przy breakpointach, pomiar wysokości wiersza, utrata fokusa) są nadal aktualne, a `MAX_LOADED=1000` już stanowi ceiling DOM.

| Wariant                                                            | Koszt                                            | Ryzyko regresji                                   | Zgodność z wizją |
| ------------------------------------------------------------------ | ------------------------------------------------ | ------------------------------------------------- | ---------------- |
| **A′ (wybór): `<table>` + kontener scrolla + feature'y addytywne** | ~60–90 linii JS + ~150 CSS (głównie z prototypu) | **Niskie** — renderer, delegacja, testy bez zmian | ~95%             |
| A (pełny grid + wirtualizacja okna)                                | ~150+ JS + ~200 CSS                              | Wysokie — re-render, fokus, breakpointy           | 100%             |
| C (status quo)                                                     | 0                                                | Brak                                              | ~40%             |

Grid-swap (pełny Wariant A) — **tylko na wyraźne żądanie pixel-parity, jako ostatnia faza (7), za flagą, z planem usunięcia flagi.** Nie utrzymywać dwóch rendererów permanentnie.

## 4. Twarde contracty testów (nie wolno złamać)

`tests/responsive/zlecenia.test.ts` — 4 testy regex na plikach:

1. `@media (max-width: 768px)` zawiera `display: none` w `zlecenia.css`,
2. `@media (max-width: 600px)` z `.zlecenia-stats` + `grid-template-columns: 1fr`,
3. `@media (max-width: 768px)` z `.zlecenia-header` + `flex-direction: column`,
4. `class="zlecenia-page"` w `zlecenia.html`.

`tests/i18n/comments.test.ts` — komentarze w `zlecenia.css` tylko po polsku; dozwolone techniczne: `Toast, flex, none, auto`. Zakaz angielskich słów (`Header`, `Footer`, `Container`, `Hidden` itd.).

---

## 5. Fazy

Kolejność minimalizuje ryzyko: naprawa blokerów → cleanup → serce wizji → feature'y. Każda faza niezależnie commitowalna.

### Faza 0 — Naprawa blokerów walidacji (P0, PRZED wszystkim) `[DONE]`

**Pliki:** `public/js/spa/zlecenia.js`, `public/css/zlecenia.css`

1. **`typecheck:frontend` 3 błędy TS2339** (`zlecenia.js:375,378`): `event.target` nie ma `classList`/`dataset`. Fix: `if (!(target instanceof HTMLElement) || !target.classList.contains('zlecenia-row-cb')) return;`. (Uwaga: w testach vm/jsdom bez okna używać `target && target.dataset` z optional chaining.)
2. **Brak CSS dla `.zlecenia-date-filter`/`.zlecenia-date-sep`** (HTML ich używa, CSS nie definiuje — rozjeżdża header). Dodać `display:flex; gap:0.4rem; align-items:center;` + dopasowanie `input[type=date]`.
3. **`aria-label` z `escapeHtml`** — `escapeHtml` nie escapuje `"` (potencjalna iniekcja atrybutu). Użyć `escapeJsStr` (jest w `zleceniaHelpers.js`) lub istniejącego `escapeHtmlAttr`.
4. **`prefer-const` dla `selectedIds`** (`zlecenia.js:9`) — warning lint.

**Walidacja:** `npm run typecheck:frontend` ✅, `node -c`, `npm run format`, `npm test -- tests/responsive/zlecenia.test.ts` (4/4).

### Faza 1 — Cleanup (P1, osobny commit `refactor(zlecenia)`) `[DONE]`

**Pliki:** `src/routes/orders/production.ts`, `src/utils/productionSearchUtils.ts`, `public/js/spa/zlecenia.js`, `public/js/spa/zleceniaHelpers.js`, `public/zlecenia.html`, `public/css/zlecenia.css`

1. Usunąć martwy **`GET /registry`** (`production.ts:122-200`) — zero wywołań w repo; to duplikat `GET /`.
2. Dedupe mapowanie PZ → **`mapProductionOrderRow`** (obecnie 3 kopie: production.ts ×2, productionSearchUtils.ts:134).
3. Usunąć martwe eksporty `stopAutoRefresh`, `toggleSelect` z public API `AppZlecenia` (zero wywołań zewnętrznych).
4. Usunąć 4 zbędne re-rejestracje `window.*` w `zleceniaHelpers.js:706-710` (formatDate/paramLabel/renderTemplate/silentPrint już globalne z `formatters.js`).
5. Usunąć nieużywane `id="zlecenia-filter-tabs"` (HTML:37).
6. **Poprawić błędne komentarze kolumn w media queries** (`zlecenia.css:445-487`) — komentarze nie zgadzają się z `nth-child`. Zweryfikować intencję ukrywanych kolumn.
7. Komentarz „wersja z paginacją" → „infinite scroll".
8. (opcjonalnie, DRY) Wydzielić `buildZleceniePayload`/`buildEtykietaPayload` z builderów druku (`zleceniaHelpers.js:395-503` vs `555-661` — ~90% identyczne). Czysty refaktor bez zmiany zachowania.

**Walidacja:** `npm run typecheck`, `npm run lint`, `node -c`, `npm test`.

### Faza 2 — Batch-delete hardening (P1, prerekwizyt tri-state; naprawia istniejący latentny bug) `[DONE]`

**Pliki:** `src/routes/orders/production.ts`, `public/js/spa/zlecenia.js`

1. **Backend `POST /batch-delete`**: zamiast 403 przy `accepted` — **pominąć accepted, zwracać `{ deleted, skipped }`** (403 zostaje tylko przy braku uprawnień). Limit 200/request zostaje.
2. **Frontend `deleteSelectedOrders`**: chunkowanie ids po 200 (sekwencyjnie z `await`, zliczanie), toast „Usunięto X, pominięto Y zatwierdzone (ochrona PZ)". Przycisk Usuń `disabled` gdy puste lub wszystkie accepted.
3. Nie podnosić limitu serwera (ochrona payloadu i `writeProductionLimiter` 60/min).

**Weryfikacja:** brak testów backendowych assertujących 403-on-accepted (sprawdzone). Test ręczny z >200 zaznaczeń.

### Faza 3 — Kontener scrolla (P1, serce wizji) `[DONE]`

**Pliki:** `public/css/zlecenia.css`, `public/zlecenia.html`, `public/js/spa/zlecenia.js`

1. **CSS**: `.zlecenia-table-container` dostaje `height: min(480px, 60vh); overflow-y: auto;` (ma już `overflow-x: auto`). Sticky `th` działa już w kontenerze (najbliższy scroll ancestor).
2. **HTML**: przenieść `#zlecenia-sentinel` do środka kontenera (za `</table>`).
3. **JS `setupSentinel`**: `new IntersectionObserver(cb, { root: kontener, rootMargin: '300px 0px' })`.
    - **⚠️ Krytyczne:** bez `root: kontener` sentinel będzie zawsze w viewport (kontener 480px < iframe ~1023px) → **eager-load w pętli do MAX_LOADED**.
4. Stopka/footer zostają pod kontenerem. `updateAnimationGate` celuje dalej w `#zlecenia-table`.

**Walidacja:** 4 testy regex przechodzą bez zmian; ręcznie: scroll wewnątrz kontenera, sticky nagłówek, sentinel doładowuje i zatrzymuje się na MAX_LOADED.

### Faza 4 — Tri-state select-all 3-stanowy + batch-scope (P2) `[DONE]`

**Pliki:** `public/zlecenia.html`, `public/css/zlecenia.css`, `public/js/spa/zlecenia.js`

1. Stan selekcji `selectState: 0|1|2`, cykl `none → visible → all → none`:
    - `visible`: zaznacza widoczne wiersze — **iteracja DOM pozostaje** (print paths i delegacja zależą od `data-id` w DOM).
    - `all`: zaznacza **wszystkie załadowane** `searchResults.items` (uczciwy scope ≤ MAX_LOADED).
    - Master checkbox: klasa `.zlecenia-cb-indeterminate` (CSS z prototypu) + `aria-checked="mixed"` + natywny `indeterminate`.
    - **`updateSelectAllState` musi wyliczać stan z `selectedIds` ORAZ `items`** (nie tylko DOM), by poprawnie pokazać `all` po manualnych odznaczeniach.
2. Batch bar: `.batch-scope` („— widoczne" / „— wszystkie spełniające filtr"), przyciski „Odznacz widoczne"/„Odznacz wszystko". Liczba = `selectedIds.size` lub `items.length` (stan 2).
3. Zachować sygnatury publicznych funkcji (`toggleSelectAll` wciąż `onclick` w HTML).

**Walidacja:** ręcznie sekwencja ☐→▣→☑→☐, mieszanka manualnych kliknięć, print batch z `all`.

### Faza 5 — Statystyki całego zbioru (P2, rozstrzyga sprzeczność „ze /stats") `[DONE]`

**Pliki:** `src/routes/orders/productionSearch.ts`, `src/utils/productionSearchUtils.ts`, `public/js/spa/zlecenia.js`

1. **NIE wskrzeszać `/stats`.** Rozszerzyć istniejący COUNT (uruchamiany przy `!cursor`) o `SUM(CASE ...)` dla accepted/draft/today w **jednym** zapytaniu — współdzieli `whereSql`, cache'uje się tym samym kluczem, `normalizedCreatedAtSql()` już istnieje.
2. **Backend cursor fix** (przy okazji): klauzula kursora (`productionSearchUtils.ts:64-71`) porównuje **surowe** `createdAt` z kursorem ze **znormalizowanej** wartości SELECT → przy danych mieszanych (epoch-ms legacy + ISO) pomija/duplikuje wiersze. Użyć `normalizedCreatedAtSql()` w gałęzi `cursor && cursorId`.
3. **Frontend `renderStats`**: czyta nowe pola z odpowiedzi search (fallback do obecnej semantyki, gdy brak). Karty z `.zlecenia-stat-icon--accent/success/warn/purple` (zamiast inline styli). Etykieta źródła „z całego zbioru".

**Walidacja:** `npm run typecheck`, test ręczny z >1000 wierszy.

### Faza 6 — Toolbar filtrów + chipsy + tożsamość wizualna (P2/P3) `[DONE]`

**Pliki:** `public/zlecenia.html`, `public/css/zlecenia.css`, `public/js/spa/zlecenia.js`

1. **Pink**: `--pink: #ec4899`/`--pink-rgb: 236,72,153` **już istnieją** (`style.base.css:75,127,154`) — nie definiować nowych. Batch bar sticky różowy (`bottom:10px`, klasa `.zlecenia-batch-bar--sticky` z prototypu). **Rozstrzygnąć kolizję** z istniejącym `.zlecenia-batch-bar` (obecny `sticky bottom:0`).
2. **Toolbar** `.zlecenia-virtual-toolbar`: daty (przeniesione z headera — **zachować id** `zlecenia-date-from/to/clear`), select użytkownika (populate z `/api/users`; `buildSearchParams.userId` już wspiera — dziś zawsze `''`), „Wyczyść filtry (N)".
    - **NIE dodawać** drugiego pola tekstowego „Filtr: zamówienie / studnia…" z prototypu — duplikuje główne `q`.
3. **Chipsy** `.zlecenia-chips`/`.zlecenia-chip`: daty, użytkownik, q, select-state 2. Każdy z ikoną X (`lucide`) + `searchOffers`.
4. Sentinel ze spinnerem `.zlecenia-sentinel-spin` + „Wczytuję kolejne…"/„Koniec listy — X/Y".

**Walidacja:** testy regex (bloki nietknięte), i18n comments (komentarze po polsku), ręcznie filtry → chips → X.

### Faza 7 — Duplikaty (P2, BLOKER: decyzja użytkownika) `[BLOKOWANA]`

**Nie startuje bez reguły biznesowej** „co jest duplikatem PZ" (wellId+elementIndex? wellId+elementName? ten sam productionOrderNumber? okno czasowe?). Po dostarczeniu reguły: grupowanie klient-side w `Map` po kluczu na `searchResults.items`, wiersz `.zlecenia-virtual-row--dup`/`.zlecenia-row-dup` + `.zlecenia-dup-badge` („duplikat" + ikona `copy`) w kolumnie Element.

### Faza 8 — Grid-swap (P3, OPCJONALNIE — tylko na wyraźne żądanie pixel-parity) `[OPCJONALNA]`

`renderOrderRow` → divy `.zlecenia-virtual-row`, delegacja na kontener, media queries na `grid-template-columns` + `div:nth-child`, z **zachowaniem 1:1 trzech bloków MQ i `.zlecenia-page`** (testy). Flaga (klasa `.zlecenia-view-grid`), domyślnie tabela. Usunięcie flagi po stabilizacji. **Nie utrzymywać dwóch rendererów permanentnie.**

---

## 6. Ryzyka i mitigacje

| Priorytet | Ryzyko                                                                             | Mitigacja                                                          |
| --------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| WYSOKI    | Sentinel bez `root: kontener` po dodaniu kontenera → eager-load w pętli            | Faza 3: `root` obowiązkowo z przeniesieniem sentinela; test ręczny |
| WYSOKI    | Batch-delete >200 → 400 (istniejący bug, ujawniony przez tri-state `all`)          | Faza 2 przed Fazą 4: chunking po 200                               |
| WYSOKI    | Accepted w selekcji → 403 całego batch (wizja „pominięto zatwierdzone" niemożliwa) | Faza 2: backend skip+count `{deleted, skipped}`                    |
| WYSOKI    | **typecheck:frontend blokuje push od F2**                                          | Faza 0.1 (guard HTMLElement)                                       |
| ŚREDNI    | Zmiana semantyki select-all (2→3 stan) psuje print/select paths                    | Faza 4: zachować sygnatury publiczne; iteracja DOM dla `visible`   |
| ŚREDNI    | Testy regex — jeśli ktoś „uładni" media queries przy gridzie                       | Nie ruszać bloków 768/600 `.zlecenia-stats`/`.zlecenia-header`     |
| ŚREDNI    | Cursor vs znormalizowane createdAt (mieszane formaty, pre-existing)                | Faza 5.2: `normalizedCreatedAtSql()` w klauzuli kursora            |
| NISKI     | i18n comments test — angielskie słowa w komentarzach CSS                           | Komentarze po polsku; `npm test` przed commitem                    |
| NISKI     | `renderStats` przy >1000 pokazuje zaniżone liczby                                  | Faza 5 rozwiązuje; do tego czasu etykieta „z załadowanych"         |
| NISKI     | Nested scrollbars przy bardzo niskim viewporcie                                    | `min(480px, 60vh)` kurczy się; weryfikacja na 1366×768             |
| NISKI     | print batch z `all` (1000) → bardzo długi dokument                                 | Poza zakresem; odnotowane jako znane ograniczenie                  |

## 7. Czego NIE robić (antywzorce)

1. **Nie wdrażać wirtualizacji okna/spacerów** bez wyraźnej decyzji o pixel-parity — `MAX_LOADED` + kontener scrolla rozwiązują jank.
2. **Nie wymyślać reguły duplikatu** (Faza 7 zablokowana).
3. **Nie wskrzeszać `/stats`** — agregaty w COUNT są tańsze i cache'owalne.
4. **Nie podnosić limitu 200 batch-delete** zamiast chunkowania (payload + rate-limiter).
5. **Nie utrzymywać dwóch rendererów** (table + grid) permanentnie.
6. **Nie dodawać przycisku „Dodaj zlecenie"** — odrzucony.
7. **Nie dodawać drugiego pola tekstowego filtra** w toolbarze — duplikuje `q`.
8. **Nie ruszać** `renderOrderRow`/delegacji/`selectedIds` bez potrzeby — to fundament printów i selekcji; zmiany rozszerzają, nie przebudowują.
9. **Nie zmieniać** nazwy `zlecenia.css` ani klasy `.zlecenia-page` — testy czytają je po ścieżce/wzorcu.
10. **Nie używać angielskich słów w komentarzach** `zlecenia.css`.

## 8. Walidacja per faza

- Backend: `npm run typecheck`, `npm run lint`.
- Frontend JS: `node -c public/js/spa/zlecenia.js`, `npm run typecheck:frontend`, `npm run lint:frontend`.
- CSS/HTML: `npm test -- tests/responsive/zlecenia.test.ts` + `tests/i18n/comments.test.ts`.
- Globalnie przed zakończeniem: `npm run format` (SSoT), `npm run encoding:check`, `npm test`, `npm run validate`.
- Ręczne scenariusze: sentinel bez eager-load, >200 batch, sekwencja tri-state, mały viewport 1366×768.

## 9. Lista plików

| Plik                                           | Zmiana                                                                                                                           |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `public/zlecenia.html`                         | sentinel do kontenera, toolbar+chipsy, batch bar sticky+scope+Odznacz…, spinner sentinel                                         |
| `public/js/spa/zlecenia.js`                    | Faza 0 fixy; tri-state 3-stanowy; chunking; kontener scrolla; renderStats z agregatów; toolbar/chipsy                            |
| `public/css/zlecenia.css`                      | `.zlecenia-table-container` scroll; pink batch bar; chipsy; tri-state; spinner; stat-icon klasy; **bloki MQ 768/600 nietknięte** |
| `public/js/spa/zleceniaHelpers.js`             | Faza 1 cleanup; (opcjonalnie) wydzielenie payload builderów                                                                      |
| `src/routes/orders/production.ts`              | batch-delete skip+count `{deleted, skipped}`; usunięcie `/registry`; `mapProductionOrderRow`                                     |
| `src/routes/orders/productionSearch.ts`        | agregaty COUNT (accepted/draft/today)                                                                                            |
| `src/utils/productionSearchUtils.ts`           | cursor na `normalizedCreatedAtSql()`; export helpera jw.                                                                         |
| `tests/responsive/zlecenia.test.ts`            | bez zmian (musi przechodzić)                                                                                                     |
| `tests/productionSearch.test.ts` (opcjonalnie) | agregaty + cursor fix                                                                                                            |

## 10. Kolejność wykonania

P0: **Faza 0** (naprawa blokerów — odblokowuje push/validate)
P1: **Faza 1** (cleanup) → **Faza 2** (batch-delete) → **Faza 3** (kontener scrolla — serce wizji)
P2: **Faza 4** (tri-state) → **Faza 5** (statystyki + cursor fix) → **Faza 6** (toolbar/chipsy/pink)
P2/3: **Faza 7** (duplikaty — czeka na decyzję użytkownika)
P3: **Faza 8** (grid-swap — tylko na wyraźne żądanie pixel-parity)
