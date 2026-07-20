# Audyt Projektu — WITROS Oferty PV

## 1. Analiza Rozmiaru Projektu

### 1.1 Backend (`src/`) — 99 plików, ~18 730 linii

| Plik                                                 | Linie | Funkcje | Klasy | Ocena       |
| ---------------------------------------------------- | ----: | ------: | ----: | ----------- |
| `src/services/docx/studnie/kartaBudowy.ts`           |   768 |       7 |     0 | Bardzo duży |
| `src/validators/offerSchemas.ts`                     |   659 |       1 |     0 | Duży        |
| `src/routes/orders/ruryOrders.ts`                    |   590 |   ~1+10 |     0 | Duży        |
| `src/routes/orders/studnieOrders.ts`                 |   577 |   ~1+10 |     0 | Duży        |
| `src/routes/productsStudnieV2.ts`                    |   523 |    ~1+8 |     0 | Duży        |
| `src/services/docx/studnie/sections.ts`              |   494 |       9 |     0 | Duży        |
| `src/services/pdf/kartaBudowy.ts`                    |   493 |       4 |     0 | Duży        |
| `src/routes/offers/ruryCrud.ts`                      |   476 |    ~1+8 |     0 | Duży        |
| `src/services/telemetry/telemetryService.ts`         |   466 |       0 |     1 | Duży        |
| `src/routes/orders/production.ts`                    |   454 |    ~1+8 |     0 | Duży        |
| `src/routes/telemetryAiMl.ts`                        |   454 |       4 |     0 | Duży        |
| `src/routes/offers/studnieCrud.ts`                   |   428 |    ~1+8 |     0 | Duży        |
| `src/services/docx/rury/kartaBudowy.ts`              |   421 |       6 |     0 | Duży        |
| `src/services/docx/rury/sections.ts`                 |   406 |       9 |     0 | Średni      |
| `src/routes/telemetryAi.ts`                          |   348 |       1 |     0 | Średni      |
| `src/services/telemetry/learning/LearningEngine.ts`  |   317 |       0 |     1 | Średni      |
| `src/app.ts`                                         |   310 |       1 |     0 | Średni      |
| `src/services/telemetry/learning/KnowledgeBase.ts`   |   308 |       0 |     1 | Średni      |
| `src/services/pdf/ruryHtml.ts`                       |   300 |       2 |     0 | Średni      |
| `src/services/ml/TrainingPipeline.ts`                |   287 |       5 |     1 | Średni      |
| `src/services/pdf/context.ts`                        |   278 |       4 |     0 | Średni      |
| `src/services/docx/rury/tables.ts`                   |   269 |       4 |     0 | Średni      |
| `src/services/docx/studnie/content.ts`               |   267 |       3 |     0 | Średni      |
| `src/services/ml/FeatureExtractor.ts`                |   250 |       4 |     1 | Średni      |
| `src/services/telemetry/learning/PatternDetector.ts` |   242 |       0 |     1 | Średni      |
| `src/validators/telemetrySchemas.ts`                 |   230 |       0 |     0 | Średni      |
| `src/routes/users.ts`                                |   225 |       1 |     0 | Średni      |
| `src/services/pricelistService.ts`                   |   223 |       9 |     0 | Mały        |
| Pozostałe 71 plików                                  |  <220 | zmienna |   0-1 | Małe        |

### 1.2 Frontend (`public/js/`) — 181 plików, ~40 445 linii

| Plik                                 | Linie | Funkcje | Klasy | Ocena           |
| ------------------------------------ | ----: | ------: | ----: | --------------- |
| `studnie/wellSolver.js`              |  1517 |      10 |     0 | **Bardzo duży** |
| `sales/pvSalesUi.js`                 |  1256 |      52 |     1 | **Bardzo duży** |
| `studnie/wellDiagram.js`             |  1044 |      26 |     0 | **Bardzo duży** |
| `studnie/wellUI.js`                  |   968 |       7 |     0 | Bardzo duży     |
| `studnie/popupsTransitionManager.js` |   903 |       6 |     0 | Bardzo duży     |
| `studnie/printManager.js`            |   850 |      15 |     0 | Bardzo duży     |
| `studnie/orderCrud.js`               |   847 |      10 |     0 | Bardzo duży     |
| `studnie/orderZleceniaForm.js`       |   839 |       6 |     0 | Bardzo duży     |
| `studnie/offerPrintManager.js`       |   797 |       7 |     0 | Duży            |
| `studnie/mlDualRanking.js`           |   795 |      19 |     0 | Duży            |
| `studnie/excelTableBody.js`          |   755 |       3 |     0 | Duży            |
| `studnie/orderKartaBudowy.js`        |   750 |      17 |     0 | Duży            |
| `spa/zleceniaHelpers.js`             |   717 |      12 |     0 | Duży            |
| `studnie/excelHelpers.js`            |   712 |      30 |     0 | Duży            |
| `studnie/wellTransitions.js`         |   711 |       1 |     0 | Duży            |
| `rury/transport.js`                  |   703 |       7 |     0 | Duży            |
| `spa/zlecenia.js`                    |   703 |      24 |     0 | Duży            |
| `studnie/wellConfigRules.js`         |   668 |       7 |     0 | Średni          |
| `rury/offerExports.js`               |   661 |       9 |     0 | Średni          |
| `studnie/offerWellComponents.js`     |   610 |       5 |     0 | Średni          |
| `studnie/orderBulk.js`               |   588 |      11 |     0 | Średni          |
| `studnie/actionsWellPricing.js`      |   586 |       5 |     0 | Średni          |
| `shared/ui.js`                       |   582 |      17 |     0 | Średni          |
| `rury/offerCrud.js`                  |   536 |       8 |     0 | Średni          |
| `studnie/orderPrzejscia.js`          |   530 |      10 |     0 | Średni          |
| `shared/dashboard.js`                |   530 |      16 |     0 | Średni          |
| `admin/aiDashboard.js`               |   529 |       6 |     0 | Średni          |
| `studnie/uiHelpers.js`               |   508 |      17 |     0 | Średni          |
| `shared/iconsSlim.js`                |   501 |       2 |     0 | Średni          |
| `spa/router.js`                      |   500 |      15 |     0 | Średni          |
| `studnie/ruleEngine.js`              |   488 |       8 |     0 | Mały            |
| `sales/pvSalesAudit.js`              |   476 |      13 |     0 | Mały            |
| Pozostałe 149 plików                 |  <475 | zmienna |     0 | Małe-Średnie    |

### 1.3 HTML — Frontend Templates

| Plik                                  |    Linie | Skrypty | Ocena           |
| ------------------------------------- | -------: | ------: | --------------- |
| `public/studnie.html`                 | **5350** |    ~130 | **Ekstremalny** |
| `public/rury.html`                    |     2457 |     ~42 | Bardzo duży     |
| `public/templates/ofertaStudnie.html` |     1015 |       1 | Średni          |
| `public/index.html`                   |      437 |      10 | Mały            |
| `public/kartoteka.html`               |      466 |     ~15 | Mały            |
| `public/app.html`                     |      147 |       7 | Mały            |

### 1.4 CSS

| Plik                              |    Linie | Ocena       |
| --------------------------------- | -------: | ----------- |
| `public/css/style.css`            | **3757** | Bardzo duży |
| `public/css/studnie.css`          |     2278 | Duży        |
| `public/css/style.base.css`       |     1337 | Średni      |
| `public/css/style.responsive.css` |     1174 | Średni      |
| `public/css/rury.css`             |     1001 | Średni      |
| `public/css/index.css`            |     1789 | Duży        |
| `public/css/printModal.css`       |      371 | Mały        |

---

## 2. Pliki Wymagające Refaktoryzacji

### Priorytet: WYSOKI

| Plik                                   | Linie | Problem                                                                                                                                                                      | SRP               |
| -------------------------------------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| **`public/studnie.html`**              | 5350  | Monolityczny HTML z inline stylami na każdym elemencie. 129 handlerów `onclick` rozrzuconych po DOM. Trzy sekcje (Builder+Oferta+Cennik) w jednym pliku. Brak szablonowania. | ✗ Mocno naruszone |
| **`public/js/studnie/wellSolver.js`**  | 1517  | God File. Miesza algorytmy solvera (`backtrack`, `solve`), auto-dobór (`runJsAutoSelection`), walidację (`recalculateWellErrors`). 10 funkcji w jednym pliku.                | ✗ Naruszone       |
| **`public/js/sales/pvSalesUi.js`**     | 1256  | God Class. 52 metody w jednej klasie: wyszukiwanie, filtrowanie, renderowanie, audytowanie, historia, synchronizacja. Łamie SRP.                                             | ✗ Mocno naruszone |
| **`public/js/studnie/wellDiagram.js`** | 1044  | Miesza logikę SVG (rysowanie kształtów, etykiet, wymiarów) z logiką biznesową (OT rings, przejścia). 26 funkcji.                                                             | ✗ Naruszone       |
| **`public/js/studnie/wellUI.js`**      | 968   | Miesza banery blokady, tile parametrów, przełączanie zakładek, rendering UI. 7 dużych funkcji.                                                                               | ✗ Naruszone       |
| **`public/css/style.css`**             | 3757  | Monolityczny arkusz. Wszystkie komponenty w jednym pliku: layout, formularze, modale, karty, tabele, utility. Brak podziału na komponenty.                                   | ✗ Naruszone       |

### Priorytet: ŚREDNI

| Plik                                           | Linie | Problem                                                                                                           | SRP         |
| ---------------------------------------------- | ----- | ----------------------------------------------------------------------------------------------------------------- | ----------- |
| `public/js/studnie/popupsTransitionManager.js` | 903   | Modal menedżera przejść z filtrowaniem, zarządzaniem typami i zbiorczymi operacjami. Można wydzielić UI z logiki. | ~ Naruszone |
| `public/js/studnie/printManager.js`            | 850   | Manager druku + generowanie HTML + transformacje SVG. 15 funkcji.                                                 | ~ Naruszone |
| `public/js/studnie/orderCrud.js`               | 847   | CRUD zamówień + selekcja studni + synchronizacja oferty. 10 funkcji.                                              | ~ Naruszone |
| `public/js/studnie/orderZleceniaForm.js`       | 839   | Formularz zleceń + SVG preview + filtrowanie. 6 dużych funkcji.                                                   | ~ Naruszone |
| `public/js/studnie/offerPrintManager.js`       | 797   | Generowanie HTML oferty + kalkulacja transportu + eksport do Word. 7 funkcji.                                     | ~ Naruszone |
| `public/js/studnie/mlDualRanking.js`           | 795   | AI ranking + komunikacja API + cache + normalizacja + eksploracja. 19 funkcji.                                    | ~ Naruszone |
| `public/js/studnie/excelHelpers.js`            | 712   | 30 funkcji pomocniczych: hashowanie, kalkulacje, HTML, filtry, overlay. Miesza helpery danych z helperami UI.     | ~ Naruszone |
| `public/css/studnie.css`                       | 2278  | Style dedykowane studniom — do podziału na komponenty (konfigurator, tabela, oferta, modal).                      | ~ Naruszone |

### Priorytet: NISKI

| Plik                                         | Linie | Problem                                                                            |
| -------------------------------------------- | ----- | ---------------------------------------------------------------------------------- |
| `src/validators/offerSchemas.ts`             | 659   | 32 type aliase w jednym pliku — można podzielić na rury/studnie                    |
| `src/services/telemetry/telemetryService.ts` | 466   | Klasa z wieloma odpowiedzialnościami: zapis konfiguracji, zdarzenia, wersjonowanie |
| `src/services/docx/studnie/kartaBudowy.ts`   | 768   | Duży generator DOCX — spójny, ale duży                                             |
| `src/routes/orders/ruryOrders.ts`            | 590   | Wiele endpointów w jednym pliku (CRUD + eksport + PDF + DOCX)                      |
| `src/routes/orders/studnieOrders.ts`         | 577   | j.w. dla studni                                                                    |
| `src/routes/productsStudnieV2.ts`            | 523   | CRUD + seedowanie + synchronizacja                                                 |

---

## 3. Plan Refaktoryzacji

### 3.1 `public/studnie.html` — KRYTYCZNY

**Problem:** Monolityczny szablon HTML z inline stylami. 5350 linii. 129 onclick handlerów w HTML.

**Propozycja podziału:**

Nowe pliki:

- `public/templates/studnie-builder-step1.html` — Krok 1 (dane klienta)
- `public/templates/studnie-builder-step2.html` — Krok 2 (parametry studni)
- `public/templates/studnie-builder-step3.html` — Krok 3 (oferta)
- `public/templates/studnie-builder-step4.html` — Krok 4 (karta budowy)
- `public/templates/studnie-builder-step5.html` — Krok 5 (zamówienie)
- `public/templates/studnie-pricelist.html` — Widok cennika
- `public/templates/studnie-production.html` — Widok zleceń produkcyjnych

Funkcje do przeniesienia: brak (to HTML, nie JS)

**Zależności:** Wszystkie szablony ładowane dynamicznie przez funkcje typu `getTemplate()` (już istnieje w `printManager.js`).

### 3.2 `public/js/studnie/wellSolver.js` — WYSOKI

**Problem:** 1517 linii, miesza algorytmy solvera, auto-dobór, walidację.

**Propozycja:**

Nowe pliki:

- `public/js/studnie/solverCore.js` — `backtrack`, `solve`, `checkConflicts`, `findBestAvrFill`
- `public/js/studnie/solverAutoSelect.js` — `runJsAutoSelection`, `buildConfigSegments`, `applyDrilledRings`
- `public/js/studnie/solverValidation.js` — `recalculateWellErrors`, `fillKregiDP`, `fillKregiGreedy`

Przenoszone funkcje (CAŁE, bez cięcia):

- `backtrack`, `solve`, `checkConflicts`, `findBestAvrFill` → `solverCore.js`
- `runJsAutoSelection`, `buildConfigSegments`, `applyDrilledRings` → `solverAutoSelect.js`
- `recalculateWellErrors`, `fillKregiDP`, `fillKregiGreedy` → `solverValidation.js`

**Zależności:** Wszystkie funkcje operują na globalach (`studnieProducts`, `wells`, `currentWellIndex`).

### 3.3 `public/js/sales/pvSalesUi.js` — WYSOKI

**Problem:** Klasa z 52 metodami. Łamie SRP — audyt, historia, wersjonowanie, filtry, renderowanie.

**Propozycja:**

Nowe pliki:

- `public/js/sales/pvSalesFilter.js` — metody filtrowania: `setFilterLocalOffers`, `setTypeFilter`, `setUserFilter`, `clearFilters`, `setDatePreset`, `toggleDateRange`, `filterLocalOffers`
- `public/js/sales/pvSalesHistory.js` — metody historii/wersjonowania: `showOfferHistoryUnified`, `restoreOfferVersionUnified`, `showAuditSnapshotModal`, `viewHistorySnapshotUnified`, `copyOfferWithVersion`, `loadMoreAuditLogs`, `getAuditContextLabel`, `getAuditActionMeta`, `getAuditFieldLabel`, `formatAuditValue`, `getAuditSnapshotTitle`, `getAuditSnapshotSummary`, `getBusinessChanges`, `renderAuditEntry`, `changeOfferUserFromList`
- `public/js/sales/pvSalesSearch.js` — metody wyszukiwania: `searchOffers`, `loadMore`, `buildSearchParams`, `onSearchInput`, `loadLocalOffers`
- `public/js/sales/pvSalesActions.js` — operacje: `deleteOrderUnified`, `deleteOfferWithConfirmation`, `openOfferForEdit`

**Zależności:** Wszystkie nowe pliki będą importować `PVSalesUI` lub dziedziczyć po niej (lub być wydzielone jako obiekty współpracujące).

### 3.4 `public/js/studnie/wellDiagram.js` — WYSOKI

**Problem:** 1044 linie, 26 funkcji, miesza rysowanie SVG z logiką biznesową OT rings.

**Propozycja:**

Nowe pliki:

- `public/js/studnie/diagramSvgShapes.js` — funkcje rysujące: `drawComponentShape`, `drawComponentLabel`, `drawComponentDimension`, `drawTransitionShape`, `drawTransitionLabel`, `drawTransitionGuideLine`, `drawSegmentDimensions`, `drawTotalHeightBar`, `drawDnLabel`, `drawPrecoInsertLine`, `drawAllComponents`, `drawTransitions`
- `public/js/studnie/diagramCalculations.js` — funkcje obliczeniowe: `calculateCanvasParams`, `resolveSegmentLabel`, `calculatePrecoInsertHeight`, `buildTransitionRanges`, `mergeOverlappingRanges`, `buildVisibleComponents`, `getElementOuterDn`, `parseTransitionGeometry`
- `public/js/studnie/diagramOtRings.js` — logika OT: `enforceOtRings`, `enforceOtForSegment`, `checkSegmentHasHole`, `upgradeToOtRing`, `degradeFromOtRing`
- `public/js/studnie/diagramRenderer.js` — główna funkcja: `renderWellDiagram`

### 3.5 `public/js/studnie/wellUI.js` — WYSOKI

**Problem:** 968 linii, 7 funkcji, ale każda funkcja jest bardzo rozbudowana.

**Propozycja:**

Nowe pliki:

- `public/js/studnie/uiLockBanners.js` — `renderOfferLockBanner`, `updateAutoLockUI`
- `public/js/studnie/uiParamTiles.js` — `setupParamTiles`, `updateParamTilesUI`
- `public/js/studnie/uiWellParams.js` — `renderWellParams`
- `public/js/studnie/uiTabSwitcher.js` — `switchSidebarTab`, `switchBuilderTab`

### 3.6 `public/css/style.css` — WYSOKI

**Problem:** 3757 linii, wszystkie style w jednym pliku.

**Propozycja:**

Nowe pliki:

- `public/css/style.variables.css` — zmienne CSS, kolory, fonty
- `public/css/style.layout.css` — grid, flex, kontenery
- `public/css/style.components.css` — komponenty (karty, przyciski, formularze)
- `public/css/style.modals.css` — modale, popupy, toasty
- `public/css/style.tables.css` — tabele ofert, zamówień
- `public/css/style.utilities.css` — klasy pomocnicze (już istnieje jako osobny plik?)

### 3.7 `public/css/studnie.css` — ŚREDNI

**Problem:** 2278 linii, wszystkie style dla modułu studni.

**Propozycja:**

Nowe pliki:

- `public/css/studnie-configurator.css` — style konfiguratora (3-kolumnowy layout)
- `public/css/studnie-offer.css` — style tabel oferty
- `public/css/studnie-modal.css` — style modal/i specyficznych dla studni

### 3.8 `public/rury.html` — ŚREDNI

**Problem:** 2457 linii, podobny wzorzec do studni.html ale mniejszy.

**Propozycja:**

Nowe pliki:

- `public/templates/rury-builder-step1.html` — dane klienta
- `public/templates/rury-builder-step2.html` — parametry
- `public/templates/rury-builder-step3.html` — oferta

### 3.9 Backend — `offerSchemas.ts` — NISKI

**Problem:** 659 linii, 32 type aliase w jednym pliku.

**Propozycja:**

Nowe pliki:

- `src/validators/offerSchemasRury.ts` — schematy dla rur
- `src/validators/offerSchemasStudnie.ts` — schematy dla studni
- `src/validators/offerSchemasCommon.ts` — schematy wspólne

### 3.10 Backend — Route files — NISKI

Pliki `ruryOrders.ts` (590) i `studnieOrders.ts` (577) oraz `ruryCrud.ts` (476) i `studnieCrud.ts` (428) mogą zostać podzielone na:

- `*.crud.ts` — CRUD endpoints
- `*.export.ts` — eksport/PDF/DOCX endpoints

---

## 4. Ocena Ryzyka

### Ryzyko: WYSOKIE

| Plik                  | Ryzyko                                                                      | Wpływ                           | Testy                                          | Wydajność   |
| --------------------- | --------------------------------------------------------------------------- | ------------------------------- | ---------------------------------------------- | ----------- |
| `public/studnie.html` | **Bardzo wysokie** — podział HTML może zepsuć selektory DOM i inicjalizację | Krytyczny — cały moduł studni   | Testy Playwright mogą wymagać aktualizacji     | Brak wpływu |
| `wellSolver.js`       | **Wysokie** — funkcje korzystają z globalnych zmiennych                     | Wysoki — solver to rdzeń studni | Testy jednostkowe solvera wymagają weryfikacji | Brak wpływu |
| `pvSalesUi.js`        | **Wysokie** — 52 metody, ścisłe powiązania z `window`                       | Wysoki — kartoteka sprzedaży    | Testy integracyjne mogą wymagać aktualizacji   | Brak wpływu |

### Ryzyko: ŚREDNIE

| Plik             | Ryzyko                                                            | Wpływ                          | Testy                     | Wydajność                                     |
| ---------------- | ----------------------------------------------------------------- | ------------------------------ | ------------------------- | --------------------------------------------- |
| `wellDiagram.js` | Średnie — czyste funkcje, łatwiejsze do wydzielenia               | Średni — diagram SVG studni    | Testy wizualne/Playwright | Brak wpływu                                   |
| `wellUI.js`      | Średnie — funkcje renderujące, łatwe do testowania                | Średni — UI konfiguratora      | Testy wizualne            | Minimalny (więcej requestów HTTP po szablony) |
| `style.css`      | Średnie — zmiana importów CSS może wpłynąć na kolejność ładowania | Średni — cały wygląd aplikacji | Testy wizualne            | Brak wpływu                                   |

### Ryzyko: NISKIE

| Plik              | Ryzyko                                     | Wpływ                   | Testy               | Wydajność   |
| ----------------- | ------------------------------------------ | ----------------------- | ------------------- | ----------- |
| `offerSchemas.ts` | Niskie — czyste typy i schematy Zod        | Niski — tylko typowanie | Brak testów runtime | Brak wpływu |
| Route files       | Niskie — spójny wzorzec, łatwy do podziału | Średni — stabilne API   | Testy API           | Brak wpływu |

---

## 5. Ranking Refaktoryzacji

| Priorytet | Plik                                           | Linie | Problem                                            | Zalecenie                                        |
| --------- | ---------------------------------------------- | ----- | -------------------------------------------------- | ------------------------------------------------ |
| **1** 🔴  | `public/studnie.html`                          | 5350  | Monolit HTML + inline style + 129 onclicków        | Podzielić na 7 szablonów, przenieść style do CSS |
| **2** 🔴  | `public/js/studnie/wellSolver.js`              | 1517  | God File: solver+autoSelect+walidacja              | Wydzielić 3 moduły                               |
| **3** 🔴  | `public/js/sales/pvSalesUi.js`                 | 1256  | God Class: 52 metody, audyt+filtry+historia+search | Wydzielić 4 moduły                               |
| **4** 🔴  | `public/js/studnie/wellDiagram.js`             | 1044  | SVG + logika OT rings + kalkulacje                 | Wydzielić 4 moduły                               |
| **5** 🟡  | `public/js/studnie/wellUI.js`                  | 968   | Banery+parametry+zakładki                          | Wydzielić 4 moduły                               |
| **6** 🟡  | `public/css/style.css`                         | 3757  | Monolit CSS                                        | Podzielić na 6 plików                            |
| **7** 🟡  | `public/css/studnie.css`                       | 2278  | Style studni w jednym pliku                        | Podzielić na 3 pliki                             |
| **8** 🟡  | `public/rury.html`                             | 2457  | Duży HTML z inline stylami                         | Podzielić na 3 szablony                          |
| **9** 🟢  | `public/js/studnie/popupsTransitionManager.js` | 903   | UI + logika przejść                                | Wydzielić warstwę danych                         |
| **10** 🟢 | `public/js/studnie/printManager.js`            | 850   | Druk + HTML + SVG                                  | Wydzielić generatory HTML                        |

---

## 6. God Files

Zidentyfikowane pliki, które są "God Files" (mają zbyt wiele odpowiedzialności):

### God Files — Frontend

| #   | Plik                   | Linie | Funkcje | Odpowiedzialności                                                                                             |
| --- | ---------------------- | ----- | ------- | ------------------------------------------------------------------------------------------------------------- |
| 1   | **`pvSalesUi.js`**     | 1256  | 52      | Wyszukiwanie, filtrowanie, renderowanie, audyt, historia, wersjonowanie, synchronizacja, usuwanie, kopiowanie |
| 2   | **`wellSolver.js`**    | 1517  | 10      | Algorytmy solvera, auto-dobór, walidacja, wypełnianie kręgów, backtracking                                    |
| 3   | **`wellDiagram.js`**   | 1044  | 26      | Rysowanie SVG kształtów, etykiet, wymiarów, przejść; logika OT rings; kalkulacje geometryczne                 |
| 4   | **`excelHelpers.js`**  | 712   | 30      | Hashowanie konfiguracji, kalkulacje wysokości, generowanie HTML overlay, filtry, zarządzanie stanem           |
| 5   | **`printManager.js`**  | 850   | 15      | Pobieranie szablonów, zbieranie danych, generowanie HTML, rysowanie SVG, drukowanie                           |
| 6   | **`mlDualRanking.js`** | 795   | 19      | Komunikacja API, cache scoringowy, normalizacja, ranking, eksploracja, telemetria, status poller              |

### God Files — Backend

| #   | Plik                      | Linie | Odpowiedzialności                                                                      |
| --- | ------------------------- | ----- | -------------------------------------------------------------------------------------- |
| 7   | **`offerSchemas.ts`**     | 659   | 32 type aliase — walidacja ofert rur, studni, zamówień, produktów, cenników, eksportów |
| 8   | **`ruryOrders.ts`**       | 590   | CRUD zamówień rur + eksport PDF + DOCX + karta budowy                                  |
| 9   | **`studnieOrders.ts`**    | 577   | CRUD zamówień studni + eksport PDF + DOCX + karta budowy                               |
| 10  | **`telemetryService.ts`** | 466   | Zapis konfiguracji, zdarzenia AI, wersjonowanie, przejścia szczelne                    |

---

## 7. Ocena Architektury

### Modularność — 7/10

**Plusy:**

- Wyraźny podział backend/frontend (Express SPA)
- Moduły rury/studnie rozdzielone (20 vs 72 pliki)
- Warstwy backendu: routes → services → validators (czysta separacja)
- Frontend: shared/ zawiera współdzielone helpery
- Import/Export wydzielony do osobnego katalogu
- ML i telemetria mają własne podkatalogi

**Minusy:**

- Moduł studnie 72 pliki vs rury 20 plików — **dramatyczna nierównowaga**
- Frontend JS używa zmiennych globalnych (`window.*`) zamiast importów ES modules
- HTML to monolit z inline stylami (brak szablonowania)
- CSS w jednym pliku (style.css 3757 linii)

### Separacja Odpowiedzialności — 6/10

**Plusy:**

- Backend: routes (kontrolery) oddzielone od services (logika biznesowa) i validators (walidacja)
- Docx/PDF generatory mają własne podkatalogi
- Sales UI podzielony na helpery, audit, toolbar

**Minusy:**

- `pvSalesUi.js` — klasa z 52 metodami, łamie SRP
- `wellSolver.js` — miesza algorytmy, auto-dobór i walidację
- `wellDiagram.js` — miesza rendering SVG z logiką biznesową
- `studnie.html` — wszystko w jednym pliku HTML
- `excelHelpers.js` — 30 funkcji, miesza helpery danych i UI

### Zależności między modułami — 5/10

**Plusy:**

- Backend: jasne zależności (routes → services → prisma)
- Import/Export nie modyfikuje plików rdzenia systemu

**Minusy:**

- Frontend: brak formalnego systemu modułów (brak import/export w JS, wszystko przez globalne skrypty)
- Kolejność ładowania skryptów w HTML — problem przy refaktoryzacji
- `studnie.html` ładuje ~130 skryptów w ścisłej kolejności — krucha zależność

### Poziom Sprzężenia — 6/10

**Plusy:**

- Backend niskie sprzężenie (wstrzykiwanie zależności przez Express/Prisma)
- Frontend: podział na pliki fizycznie rozdziela odpowiedzialności

**Minusy:**

- Frontend: wysokie sprzężenie przez współdzielone zmienne globalne
- `wellSolver.js`, `wellUI.js`, `wellDiagram.js` — wysoki coupling (wszystkie operują na `window.wells`, `window.currentWellIndex`)
- Brak wyraźnych interfejsów między modułami frontendu

### Poziom Spójności — 7/10

**Plusy:**

- Backend: wysoka spójność (routes obsługują HTTP, services logikę, validators walidację)
- Moduł rury: spójny, dobrze podzielony na małe pliki
- Docx generatory: spójne, każdy plik odpowiada za jeden dokument

**Minusy:**

- `pvSalesUi.js` — niska spójność (audyt, historia, wyszukiwanie, filtry)
- `studnie.html` — niska spójność (builder, oferta, cennik, zlecenia w jednym pliku)
- `excelHelpers.js` — niska spójność (hashowanie, HTML, filtry, kalkulacje)

### Możliwość dalszego rozwoju — 6/10

**Plusy:**

- Dobra baza backendowa (Express + Prisma → łatwo rozszerzać)
- Moduł rury: łatwy do rozwijania (małe, dobrze nazwane pliki)
- Architektura SPA (iframy) pozwala na niezależny rozwój modułów

**Minusy:**

- Moduł studni: 72 pliki, wiele przekracza 700 linii — trudny do rozwijania
- Monolityczne HTML z inline stylami — każde UI wymaga zmian w HTML
- Brak systemu modułów JS (brak import/export) — utrudnia rozwój
- CSS w monolicie — ryzyko regresji przy zmianach

### Ocena ogólna: **6.5/10**

---

## 8. Podsumowanie Końcowe

### 10 Największych Problemów Projektu

| #   | Problem                                                        | Wpływ                                              |
| --- | -------------------------------------------------------------- | -------------------------------------------------- |
| 1   | **`studnie.html` — 5350 linii, monolit HTML z inline stylami** | Każda zmiana UI wymaga edycji gigantycznego pliku  |
| 2   | **`wellSolver.js` — 1517 linii, God File solvera**             | Utrudnia debugowanie i testowanie algorytmów       |
| 3   | **`pvSalesUi.js` — klasa z 52 metodami**                       | Łamie SRP, trudna w utrzymaniu                     |
| 4   | **`style.css` — 3757 linii w jednym pliku**                    | Ryzyko kolizji stylów, trudne utrzymanie           |
| 5   | **Moduł studni ma 72 pliki, rury 20**                          | Nierównowaga rozwoju, studnie są "drugim systemem" |
| 6   | **129 inline onclick w studnie.html**                          | Mieszanie logiki z widokiem, problemy z CSP        |
| 7   | **Brak systemu modułów JS (globalne skrypty)**                 | Utrudnia testowanie, refaktoryzację, tree-shaking  |
| 8   | **`studnie.html` ładuje ~130 skryptów**                        | 130 requestów HTTP, zła wydajność ładowania        |
| 9   | **Frontend: wysoki coupling przez zmienne globalne**           | Zmiana globala wpływa na wiele plików              |
| 10  | **Brak testów dla 80% plików frontendowych**                   | Refaktoryzacja bez siatki bezpieczeństwa           |

### 10 Największych Plików

| #   | Plik                               | Linie |
| --- | ---------------------------------- | ----: |
| 1   | `public/studnie.html`              |  5350 |
| 2   | `public/css/style.css`             |  3757 |
| 3   | `public/rury.html`                 |  2457 |
| 4   | `public/css/studnie.css`           |  2278 |
| 5   | `public/css/index.css`             |  1789 |
| 6   | `public/js/studnie/wellSolver.js`  |  1517 |
| 7   | `public/js/sales/pvSalesUi.js`     |  1256 |
| 8   | `public/css/style.base.css`        |  1337 |
| 9   | `public/css/style.responsive.css`  |  1174 |
| 10  | `public/js/studnie/wellDiagram.js` |  1044 |

### 10 Plików Najbardziej Wymagających Refaktoryzacji

| #   | Plik                                           | Linie | Priorytet    |
| --- | ---------------------------------------------- | ----- | ------------ |
| 1   | `public/studnie.html`                          | 5350  | 🔴 Krytyczny |
| 2   | `public/js/studnie/wellSolver.js`              | 1517  | 🔴 Wysoki    |
| 3   | `public/js/sales/pvSalesUi.js`                 | 1256  | 🔴 Wysoki    |
| 4   | `public/js/studnie/wellDiagram.js`             | 1044  | 🔴 Wysoki    |
| 5   | `public/js/studnie/wellUI.js`                  | 968   | 🟡 Średni    |
| 6   | `public/css/style.css`                         | 3757  | 🟡 Średni    |
| 7   | `public/css/studnie.css`                       | 2278  | 🟡 Średni    |
| 8   | `public/rury.html`                             | 2457  | 🟡 Średni    |
| 9   | `public/js/studnie/popupsTransitionManager.js` | 903   | 🟢 Niski     |
| 10  | `public/js/studnie/printManager.js`            | 850   | 🟢 Niski     |

### Kolejność Wykonywania Refaktoryzacji

**Faza 1 — Krytyczna (bezpieczna, duży zysk)**

1. Podział `offerSchemas.ts` na common/rury/studnie (niski risk, szybki zysk)
2. Podział `style.css` na komponenty (łatwy rollback)
3. Podział `studnie.css` na komponenty

**Faza 2 — Frontend JS (średni risk, duży zysk)** 4. Podział `wellSolver.js` na solverCore/AutoSelect/Validation 5. Podział `wellDiagram.js` na SVG/OT/Calculations/Renderer 6. Podział `wellUI.js` na Banners/Params/Tabs 7. Podział `pvSalesUi.js` na Search/Filter/History/Actions

**Faza 3 — Backend Routes (niski risk, średni zysk)** 8. Podział `ruryOrders.ts` i `studnieOrders.ts` na CRUD/Export 9. Podział `ruryCrud.ts` i `studnieCrud.ts`

**Faza 4 — HTML Templates (wysoki risk, największy zysk)** 10. Podział `studnie.html` na szablony krok po kroku 11. Podział `rury.html` na szablony 12. Migracja inline onclick → ES modules + addEventListener

### Szacowany Nakład Pracy

| Faza                        | Pliki         | Szacowany czas         | Ryzyko      |
| --------------------------- | ------------- | ---------------------- | ----------- |
| **Faza 1** — Schematy + CSS | 4 pliki       | 1-2 dni                | Niskie      |
| **Faza 2** — Frontend JS    | 7 plików      | 3-5 dni                | Średnie     |
| **Faza 3** — Backend Routes | 4 pliki       | 1-2 dni                | Niskie      |
| **Faza 4** — HTML Templates | 2 pliki       | 3-5 dni                | Wysokie     |
| **Razem**                   | **17 plików** | **8-14 dni roboczych** | **Średnie** |

**Zalecany zespół:** 1-2 developerów

**Krytyczne uwagi:**

- Faza 2 wymaga dobrego zrozumienia współdzielonych globali (`window.wells`, `window.currentWellIndex`)
- Faza 4 wymaga synchronizacji z istniejącymi funkcjami `getTemplate()` w `printManager.js`
- Po każdej fazie uruchomić `npm run typecheck`, `npm run format` i testy
- Wszystkie zmiany są zgodne z zasadą: **funkcje są niepodzielne, przenoszone w całości**
