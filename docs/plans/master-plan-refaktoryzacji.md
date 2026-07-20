# Master Plan Refaktoryzacji — WITROS Oferty PV

## Cel architektoniczny

Poprawa modularności, czytelności i możliwości utrzymania kodu we wszystkich warstwach aplikacji: HTML, CSS, frontend JS i backend TS. Po refaktoryzacji aplikacja działa identycznie jak przed zmianami — **zero zmian funkcjonalnych**.

---

## Dokumenty powiązane

| Dokument                                 | Opis                                                                                                |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `docs/plans/architecture-freeze.md`      | **Wiążący kontrakt** — API, struktura DOM, selektory, zmienne globalne, które nie mogą ulec zmianie |
| `docs/plans/changelog-refaktoryzacji.md` | Żywy dziennik zmian — każda modyfikacja odnotowana przed commitem                                   |

---

## Zasady ogólne (obowiązują dla WSZYSTKICH plików)

1.  **NIE dzielić funkcji** — funkcje są niepodzielne, przenoszone w całości
2.  **NIE zmieniać logiki biznesowej** — żadnych zmian w algorytmach, walidacji, przepływie danych
3.  **NIE zmieniać identyfikatorów (`id`), klas CSS, atrybutów `onclick`, `data-\*`** — selektory DOM muszą działać
4.  **Zero zmian funkcjonalnych** — aplikacja działa identycznie przed i po refaktoryzacji
5.  **Kolejność skryptów niezmieniona** — zachowana w HTML i w init JS
6.  **Każda funkcja przenoszona w całości** — bez cięcia, bez refaktoryzacji wewnętrznej
7.  **Zachować kolejność deklaracji funkcji** — przenosząc funkcje do nowych plików, nie zmieniać kolejności ich deklaracji w obrębie grupy
8.  **Stare pliki pozostają jako wrappery** — oryginalne pliki po wydzieleniu nie są usuwane, stają się cienkimi forwarderami (loadują nowe moduły); usunięcie wrapperów to osobna decyzja po zakończeniu refaktoryzacji
9.  **CSS nowych plików dodawany, nie zastępuje** — stare importy CSS pozostają, nowe pliki są dodawane obok; konsolidacja to osobna faza
10. **Commit po każdej zmianie** — `git add -A && git commit -m "refactor(scope): opis"`
11. **Verification after each step** — `npm run typecheck` (backend), `node -c` (frontend JS), wizualna weryfikacja w przeglądarce
12. **Przed pierwszym commitem — baseline** — wygenerować ofertę A-Z, zapisać HAR network log, finalny JSON oferty, zrzut DOM po każdym kroku wizarda. Baseline jest punktem odniesienia dla snapshotów i event regression.

---

## Stan obecny — wszystkie pliki

### HTML (6 plików)

| Plik                    |    Linie | Opis                                                                                                  | Priorytet    |
| ----------------------- | -------: | ----------------------------------------------------------------------------------------------------- | ------------ |
| `public/studnie.html`   | **5350** | Monolit: Builder (krok 1-5) + Oferta + Cennik + ~130 skryptów, ~129 onclick, ~3000 linii inline style | 🔴 Krytyczny |
| `public/rury.html`      | **2457** | Duży HTML z inline stylami, ~42 skrypty, podobny wzorzec do studnie.html                              | 🟡 Wysoki    |
| `public/kartoteka.html` |      466 | Dobrze zorganizowany, mały                                                                            | 🟢 Niski     |
| `public/zlecenia.html`  |      200 | Mały, czysty                                                                                          | 🟢 Niski     |
| `public/app.html`       |      147 | SPA shell, mały                                                                                       | 🟢 Niski     |
| `public/index.html`     |      437 | Login + admin dashboard, mały                                                                         | 🟢 Niski     |

### CSS (12 plików)

| Plik                              |    Linie | Opis                                                           | Priorytet |
| --------------------------------- | -------: | -------------------------------------------------------------- | --------- |
| `public/css/style.css`            | **3757** | Monolit — layout, komponenty, modale, tabele, utility w jednym | 🔴 Wysoki |
| `public/css/studnie.css`          | **2278** | Wszystkie style studni w jednym pliku                          | 🟡 Wysoki |
| `public/css/index.css`            | **1789** | Style index.html + admin dashboard                             | 🟢 Średni |
| `public/css/style.base.css`       | **1337** | Bazowe style — już częściowo wydzielony                        | 🟢 Niski  |
| `public/css/style.responsive.css` | **1174** | Style responsywne — już osobny plik                            | 🟢 Niski  |
| `public/css/rury.css`             | **1001** | Style modułu rur                                               | 🟡 Średni |
| `public/css/style.cards.css`      |     <500 | Karty i komponenty kart                                        | 🟢 Niski  |
| `public/css/style.utilities.css`  |     <500 | Klasy pomocnicze                                               | 🟢 Niski  |
| `public/css/spa.css`              |     <300 | Style SPA                                                      | 🟢 Niski  |
| `public/css/zlecenia.css`         |     <300 | Style zleceń                                                   | 🟢 Niski  |
| `public/css/printModal.css`       |      371 | Style modalu drukowania                                        | 🟢 Niski  |
| `public/css/inter.css`            |     <100 | Font Inter                                                     | 🟢 Niski  |

### Frontend JS (181 plików)

#### Katalog: `public/js/studnie/` (115 plików)

| Plik                         |    Linie | Funkcje | SRP                                          | Priorytet |
| ---------------------------- | -------: | ------: | -------------------------------------------- | --------- |
| `wellSolver.js`              | **1517** |      10 | ✗ God File: solver + auto-select + walidacja | 🔴 Wysoki |
| `wellDiagram.js`             | **1044** |      26 | ✗ SVG rendering + OT rings + kalkulacje      | 🔴 Wysoki |
| `wellUI.js`                  |  **968** |       7 | ✗ UI: lock banners + parametry + zakładki    | 🔴 Wysoki |
| `popupsTransitionManager.js` |  **903** |       6 | ~ UI + logika przejść                        | 🟡 Średni |
| `printManager.js`            |  **850** |      15 | ~ Druk + HTML + SVG + template loader        | 🟡 Średni |
| `orderCrud.js`               |  **847** |      10 | ~ CRUD + selekcja + synchronizacja           | 🟡 Średni |
| `orderZleceniaForm.js`       |  **839** |       6 | ~ Formularz + SVG preview + filtry           | 🟡 Średni |
| `offerPrintManager.js`       |  **797** |       7 | ~ HTML oferty + kalkulacja transportu + Word | 🟡 Średni |
| `mlDualRanking.js`           |  **795** |      19 | ~ AI ranking + API + cache + normalizacja    | 🟡 Średni |
| `excelTableBody.js`          |  **755** |       3 | ~ Renderowanie + filtry                      | 🟢 Niski  |
| `orderKartaBudowy.js`        |  **750** |      17 | ~ Karta budowy + formularz                   | 🟢 Niski  |
| `excelHelpers.js`            |  **712** |      30 | ~ Hashowanie + HTML + filtry + overlay       | 🟢 Niski  |
| `wellTransitions.js`         |  **711** |       1 | ~ Przejścia szczelne                         | 🟢 Niski  |
| `wellConfigRules.js`         |  **668** |       7 | ~ Reguły konfiguracji                        | 🟢 Niski  |
| `excelAutoSelect.js`         |  **650** |       5 | ~ Auto-select w Excel                        | 🟢 Niski  |
| `offerWellComponents.js`     |  **610** |       5 | ~ Komponenty oferty                          | 🟢 Niski  |
| `orderBulk.js`               |  **588** |      11 | ~ Operacje zbiorcze                          | 🟢 Niski  |
| `actionsWellPricing.js`      |  **586** |       5 | ~ Wycena studni                              | 🟢 Niski  |
| `orderPrzejscia.js`          |  **530** |      10 | ~ Przejścia w zamówieniu                     | 🟢 Niski  |
| Pozostałe 96 plików          |     <500 | zmienna | ✓ OK                                         | 🟢 Niski  |

#### Katalog: `public/js/rury/` (30 plików)

| Plik                |   Linie | SRP                | Priorytet |
| ------------------- | ------: | ------------------ | --------- |
| `wizard.js`         |     450 | ✓ OK               | 🟢 Niski  |
| `offerItems.js`     |     440 | ✓ OK               | 🟢 Niski  |
| `transport.js`      | **703** | ✓ Spójny, ale duży | 🟢 Niski  |
| `offerExports.js`   |     661 | ✓ Spójny           | 🟢 Niski  |
| `offerCrud.js`      |     536 | ✓ OK               | 🟢 Niski  |
| Pozostałe 25 plików |    <500 | ✓ OK               | 🟢 Niski  |

#### Katalog: `public/js/sales/` (5 plików)

| Plik                       |    Linie | Metody | SRP                                                     | Priorytet |
| -------------------------- | -------: | -----: | ------------------------------------------------------- | --------- |
| `pvSalesUi.js`             | **1256** | **52** | ✗ God Class: search + filter + audit + history + delete | 🔴 Wysoki |
| `pvSalesAudit.js`          |      476 |     13 | ✓ Audyt                                                 | 🟢 Niski  |
| `pvSalesHelpers.js`        |      300 |      8 | ✓ Helpery                                               | 🟢 Niski  |
| `pvImportExportToolbar.js` |      200 |      4 | ✓ Import/Export toolbar                                 | 🟢 Niski  |
| `kartotekaInit.js`         |      150 |      2 | ✓ Inicjalizacja                                         | 🟢 Niski  |

#### Katalog: `public/js/shared/` (14 plików) — wszystkie < 600 linii, ✓ OK

#### Katalog: `public/js/spa/` (3 pliki)

| Plik                 | Linie | Priorytet |
| -------------------- | ----: | --------- |
| `router.js`          |   500 | 🟢 Niski  |
| `zlecenia.js`        |   703 | 🟢 Niski  |
| `zleceniaHelpers.js` |   717 | 🟢 Niski  |

### Backend TypeScript (99 plików)

#### God Files — Backend

| Plik                                         | Linie | Opis                                   | Priorytet |
| -------------------------------------------- | ----: | -------------------------------------- | --------- |
| `src/validators/offerSchemas.ts`             |   659 | 32 type aliases w jednym pliku         | 🟢 Niski  |
| `src/services/docx/studnie/kartaBudowy.ts`   |   768 | Duży generator DOCX (spójny, ale duży) | 🟢 Niski  |
| `src/routes/orders/ruryOrders.ts`            |   590 | CRUD + export + PDF + DOCX             | 🟢 Niski  |
| `src/routes/orders/studnieOrders.ts`         |   577 | CRUD + export + PDF + DOCX             | 🟢 Niski  |
| `src/routes/productsStudnieV2.ts`            |   523 | CRUD + seed + synchronizacja           | 🟢 Niski  |
| `src/services/telemetry/telemetryService.ts` |   466 | Config + events + versioning           | 🟢 Niski  |
| `src/routes/telemetryAiMl.ts`                |   454 | ML endpoints                           | 🟢 Niski  |
| `src/routes/orders/production.ts`            |   454 | Zlecenia produkcyjne                   | 🟢 Niski  |
| `src/services/pdf/kartaBudowy.ts`            |   493 | PDF karty budowy                       | 🟢 Niski  |
| `src/routes/offers/ruryCrud.ts`              |   476 | CRUD ofert rur                         | 🟢 Niski  |
| `src/routes/offers/studnieCrud.ts`           |   428 | CRUD ofert studni                      | 🟢 Niski  |
| `src/services/docx/rury/kartaBudowy.ts`      |   421 | DOCX rur                               | 🟢 Niski  |

---

## God Files — pełna lista

### Krytyczne (SRP mocno naruszone)

| #   | Plik                               | Linie | Funkcje/Metody | Odpowiedzialności                                                                                             |
| --- | ---------------------------------- | ----- | -------------- | ------------------------------------------------------------------------------------------------------------- |
| 1   | `public/studnie.html`              | 5350  | N/A (HTML)     | Builder (5 kroków) + Oferta + Cennik + ~130 skryptów                                                          |
| 2   | `public/js/studnie/wellSolver.js`  | 1517  | 10             | Solver (backtrack, solve) + auto-dobór + walidacja + wypełnianie kręgów                                       |
| 3   | `public/js/sales/pvSalesUi.js`     | 1256  | 52             | Wyszukiwanie, filtrowanie, renderowanie, audyt, historia, wersjonowanie, synchronizacja, usuwanie, kopiowanie |
| 4   | `public/js/studnie/wellDiagram.js` | 1044  | 26             | SVG rendering (kształty, etykiety, wymiary, przejścia) + OT rings + kalkulacje geometryczne                   |
| 5   | `public/js/studnie/wellUI.js`      | 968   | 7              | Lock bannery + tile parametrów + przełączanie zakładek + rendering well params                                |
| 6   | `public/css/style.css`             | 3757  | N/A (CSS)      | Layout + komponenty + formularze + modale + tabele + utility                                                  |

### Średnie (SRP częściowo naruszone)

| #   | Plik                                           | Linie | Odpowiedzialności                                           |
| --- | ---------------------------------------------- | ----- | ----------------------------------------------------------- |
| 7   | `public/js/studnie/popupsTransitionManager.js` | 903   | Modal przejść + filtrowanie + typy + operacje zbiorcze      |
| 8   | `public/js/studnie/printManager.js`            | 850   | Template loader + dane drukarskie + HTML + SVG + drukowanie |
| 9   | `public/js/studnie/orderCrud.js`               | 847   | CRUD zamówień + selekcja studni + synchronizacja oferty     |
| 10  | `public/js/studnie/orderZleceniaForm.js`       | 839   | Formularz zleceń + SVG preview + filtrowanie                |
| 11  | `public/js/studnie/offerPrintManager.js`       | 797   | HTML oferty + kalkulacja transportu + eksport Word          |
| 12  | `public/js/studnie/mlDualRanking.js`           | 795   | AI ranking + API + cache + normalizacja + eksploracja       |
| 13  | `public/js/studnie/excelHelpers.js`            | 712   | Hashowanie + kalkulacje + HTML overlay + filtry             |
| 14  | `public/js/rury/transport.js`                  | 703   | Transport kalkulacje + formularz + podsumowanie             |
| 15  | `src/validators/offerSchemas.ts`               | 659   | 32 type aliases — rury, studnie, products, offers, orders   |
| 16  | `public/rury.html`                             | 2457  | HTML modułu rur — podobny do studnie.html ale mniejszy      |
| 17  | `public/css/studnie.css`                       | 2278  | Style wszystkich komponentów studni                         |

---

## Mapa zależności (Dependency Matrix)

### Macierz zależności między modułami JS

| Moduł                 | Zależy od                                | Używany przez                           |
| --------------------- | ---------------------------------------- | --------------------------------------- |
| `window.wellManager`  | offerData, currentWell, wells            | offerManager.js, wizardNavigation.js    |
| `window.offerManager` | wellManager, wellSolver, wellConfigRules | studnie.html (onclick), printManager.js |
| `window.wellSolver`   | wellConfigRules, jQuery                  | wellManager, offerManager               |
| `window.wellDiagram`  | jQuery, SVG helpers                      | offerManager, printManager              |
| `window.wellUI`       | wellManager                              | offerManager                            |
| `window.printManager` | getTemplate(), jQuery                    | offerManager, orderManager              |
| `window.excelManager` | jQuery, helpers                          | offerManager                            |
| `window.orderManager` | offerManager, wellManager                | studnie.html                            |
| `window.pvSalesUi`    | jQuery, API helpers                      | kartoteka.html, pvImportExportToolbar   |
| `window.ruryManager`  | jQuery, rury-specific helpers            | rury.html                               |
| `window.ruryOffer`    | ruryManager                              | rury.html                               |
| `window.ruryOrder`    | ruryManager                              | rury.html                               |

### Zależności między HTML a modułami

| HTML             | Ładowane skrypty                                                       | Ładowane CSS                                          |
| ---------------- | ---------------------------------------------------------------------- | ----------------------------------------------------- |
| `studnie.html`   | ~130 skryptów z `public/js/studnie/`, `public/js/shared/`              | style.css, studnie.css, rury.css, style.utilities.css |
| `rury.html`      | ~42 skrypty z `public/js/rury/`, `public/js/shared/`                   | style.css, rury.css                                   |
| `kartoteka.html` | `public/js/sales/*`, `public/js/shared/*`, `public/js/import-export/*` | style.css, kartoteka.css                              |
| `zlecenia.html`  | `public/js/spa/*`, `public/js/shared/*`                                | style.css, zlecenia.css                               |
| `app.html`       | `public/js/spa/router.js`                                              | spa.css                                               |
| `index.html`     | auth-related JS                                                        | index.css, style.css                                  |

### Zależności między DOM a JS

| Element DOM      | ID/Klasa                            | Używane przez                      |
| ---------------- | ----------------------------------- | ---------------------------------- |
| Wizard steps     | `#wizard-step-1`...`#wizard-step-5` | wizardNavigation.js                |
| Offer table body | `#offer-items-body`                 | offerItems.js                      |
| Order table body | `#order-items-body`                 | orderCrud.js                       |
| Sidebar          | `#sidebar`                          | wellUI.js, sidebarManager.js       |
| Diagram SVG      | `#well-diagram`                     | wellDiagram.js, diagramRenderer.js |
| Search input     | `#search-offer`                     | pvSalesSearch.js                   |
| Audit modal      | `#audit-modal`                      | pvSalesHistory.js                  |

---

## Mapa rejestracji `window.*` (Window Globals)

> Wszystkie globalne obiekty, funkcje i stan rejestrowane na `window`. Każdy wpis to potencjalny punkt耦合 między modułami.

### Stan danych (data state)

| Zmienna globalna       | Typ    | Inicjalizacja       | Używane w                               |
| ---------------------- | ------ | ------------------- | --------------------------------------- |
| `window.offerData`     | Object | `studnie.html` init | wellManager, offerManager, printManager |
| `window.currentWell`   | Object | `studnie.html` init | wellSolver, wellDiagram, wellUI         |
| `window.wells`         | Array  | `studnie.html` init | offerManager, orderCrud, sidebarManager |
| `window.currentOffer`  | Object | `studnie.html` init | offerManager, printManager              |
| `window.offerDataRury` | Object | `rury.html` init    | ruryManager, ruryOffer                  |
| `window.ruryParams`    | Object | `rury.html` init    | ruryManager                             |
| `window.ruryOffer`     | Object | `rury.html` init    | ruryOffer, ruryOrder                    |

### Obiekty menedżerów (singleton managers)

| Zmienna globalna               | Plik inicjalizacji         | Odpowiedzialność                     |
| ------------------------------ | -------------------------- | ------------------------------------ |
| `window.wellManager`           | `studnie.html`             | Zarządzanie studnią (CRUD, selekcja) |
| `window.offerManager`          | `offerManager.js`          | Zarządzanie ofertą studni            |
| `window.wellSolver`            | `wellSolver.js`            | Solver konfiguracji studni           |
| `window.wellDiagram`           | `wellDiagram.js`           | Renderowanie SVG diagramu            |
| `window.wellUI`                | `wellUI.js`                | Interfejs użytkownika studni         |
| `window.printManager`          | `printManager.js`          | Drukowanie, eksport PDF/Word         |
| `window.excelManager`          | `excelCore.js`             | Cennik Excel                         |
| `window.orderManager`          | `orderCrud.js`             | Zarządzanie zamówieniami             |
| `window.ruryManager`           | `wizard.js`                | Zarządzanie rurami                   |
| `window.ruryOffer`             | `offerCrud.js`             | Oferta rur                           |
| `window.ruryOrder`             | `orderCrud.js`             | Zamówienie rur                       |
| `window.pvSalesUi`             | `pvSalesUi.js`             | Kartoteka ofert (God Class)          |
| `window.pvImportExportToolbar` | `pvImportExportToolbar.js` | Import/Export                        |
| `window.router`                | `router.js`                | Routing SPA                          |
| `window.clientManager`         | `clientManager.js`         | Zarządzanie klientami                |

### Funkcje pomocnicze (helpers)

| Zmienna globalna              | Plik                  | Opis                                   |
| ----------------------------- | --------------------- | -------------------------------------- |
| `window.getTemplate(path)`    | `printManager.js`     | Ładowanie template'ów HTML z cache     |
| `window.escapeHtml(str)`      | `shared/utils.js`     | Sanityzacja XSS                        |
| `window.formatCurrency(val)`  | `shared/format.js`    | Formatowanie waluty                    |
| `window.safeEval(expr)`       | `shared/math.js`      | Bezpieczne eval wyrażeń matematycznych |
| `window.showToast(msg, type)` | `shared/ui.js`        | Powiadomienia toast                    |
| `window.showLoading(show)`    | `shared/ui.js`        | Wskaźnik ładowania                     |
| `window.lucide`               | Biblioteka zewnętrzna | Ikony SVG                              |

---

## Testy regresyjne (snapshot regression)

### Podejście

Zamiast testów jednostkowych (poza zakresem refaktoryzacji), stosujemy **snapshot regression**:

1. **Przed zmianą**: dla każdego modułu/god file wykonaj zrzut ekranu (screenshot) lub zapisz HTML wybranych widoków
2. **Po zmianie**: porównaj zrzuty/widoki — różnice oznaczają nieoczekiwaną zmianę funkcjonalną
3. **Automatyzacja**: Playwright (istniejący w projekcie `npm run test:alignment`) do przechwytywania snapshotów

### Plan snapshotów

| Test              | Co sprawdza                               | Metoda                                |
| ----------------- | ----------------------------------------- | ------------------------------------- |
| Wizard krok 1     | Formularz klienta renderowany poprawnie   | Screenshot Playwright                 |
| Wizard krok 2     | Parametry studni z diagramem SVG          | Screenshot + porównanie SVG HTML      |
| Wizard krok 3     | Tabela oferty z elementami                | Screenshot + porównanie struktury DOM |
| Oferta (zakładka) | Podsumowanie oferty                       | Screenshot                            |
| Cennik Excel      | Filtrowanie + tabela produktów            | Screenshot                            |
| Kartoteka         | Lista ofert z wynikami wyszukiwania       | Screenshot                            |
| Diagram SVG       | Renderowany SVG przy zadanych parametrach | Porównanie string SVG                 |
| Eksport XLSX      | Poprawność wygenerowanego pliku           | Porównanie zawartości (hash)          |

### Wykonanie

Snapshoty wykonujemy dla **każdego commita refaktoryzacyjnego** przed i po zmianie. W razie różnic — analizujemy czy to oczekiwana różnica (np. zmiana formatowania) czy regresja.

### Baseline przed pierwszym commitem

Przed rozpoczęciem Fazy 0 wykonaj pełną rejestrację stanu początkowego:

1. **Pełna oferta A-Z**: utwórz nową ofertę studni, przejdź wszystkie 5 kroków wizarda, zapisz ofertę
2. **Zapisz HAR network log** (DevTools → Network → Export HAR) — zawiera wszystkie żądania API, odpowiedzi, timing
3. **Finalny JSON oferty** — zapisz odpowiedź z `GET /api/offers/:id` po zapisie oferty
4. **DOM snapshot** — zrzut `document.body.innerHTML` po każdym kroku wizarda + po załadowaniu oferty
5. **Rury analogicznie** — utwórz ofertę rur, zapisz HAR + JSON + DOM
6. **Kartoteka** — zrzut listy ofert z wynikami wyszukiwania i filtrowania

Baseline przechowuj w `docs/baseline/` — pozwoli odróżnić regresję od oczekiwanej zmiany. Bez baseline'u każda regresja eventowa (onclick → fetch → re-render) to śledztwo na 2h zamiast 5-minutowego porównania.

---

## Struktura docelowa

### HTML

```
public/
    studnie.html                     (~ 400 linii) — szkielet, wczytuje partiale
    rury.html                        (~ 400 linii) — szkielet, wczytuje partiale
    kartoteka.html                   (bez zmian)
    zlecenia.html                    (bez zmian)
    app.html                         (bez zmian)
    index.html                       (bez zmian)
    partials/
        header.html                  (~ 150 linii) — HEAD + HEADER + NAV
        studnie/
            step1-client.html        (~ 303 linii) — dane klienta i oferty
            step2-parameters.html    (~ 1055 linii) — parametry studni
            step3-offer.html         (~ 821 linii) — konfigurator oferty
            sidebar.html             (~ 469 linii) — panel boczny
            step4-build-card.html    (~ 1100 linii) — karta budowy
            offer.html               (~ 290 linii) — widok oferty
            pricelist.html           (~ 821 linii) — widok cennika
        rury/
            step1-client.html        (~ 200 linii) — dane klienta
            step2-params.html        (~ 500 linii) — parametry
            step3-offer.html         (~ 600 linii) — oferta
```

### CSS

```
public/css/
    style.variables.css              (nowy) — zmienne CSS, kolory, fonty
    style.layout.css                 (nowy) — grid, flex, kontenery
    style.components.css             (nowy) — przyciski, formularze, karty
    style.modals.css                 (nowy) — modale, popupy, toasty
    style.tables.css                 (nowy) — tabele ofert, zamówień
    style.utilities.css              (istniejący)
    style.cards.css                  (istniejący)
    studnie/
        configurator.css             (nowy) — 3-kolumnowy layout konfiguratora
        offer.css                    (nowy) — tabele oferty studni
        modal.css                    (nowy) — modale specyficzne dla studni
```

### Frontend JS — nowe moduły

Z istniejących God Files wydzielamy:

```
public/js/studnie/
    solverCore.js                    (nowy) — backtrack, solve, checkConflicts, findBestAvrFill
    solverAutoSelect.js              (nowy) — runJsAutoSelection, buildConfigSegments, applyDrilledRings
    solverValidation.js              (nowy) — recalculateWellErrors, fillKregiDP, fillKregiGreedy
    diagramSvgShapes.js              (nowy) — drawComponentShape, drawComponentLabel, drawComponentDimension
    diagramCalculations.js           (nowy) — calculateCanvasParams, resolveSegmentLabel, buildTransitionRanges
    diagramOtRings.js                (nowy) — enforceOtRings, enforceOtForSegment, upgradeToOtRing
    diagramRenderer.js               (nowy) — renderWellDiagram (główna)
    uiLockBanners.js                 (nowy) — renderOfferLockBanner, updateAutoLockUI
    uiParamTiles.js                  (nowy) — setupParamTiles, updateParamTilesUI
    uiWellParams.js                  (nowy) — renderWellParams
    uiTabSwitcher.js                 (nowy) — switchSidebarTab, switchBuilderTab
```

```
public/js/sales/
    pvSalesSearch.js                 (nowy) — searchOffers, loadMore, buildSearchParams, onSearchInput
    pvSalesFilter.js                 (nowy) — setFilterLocalOffers, setTypeFilter, setUserFilter, clearFilters
    pvSalesHistory.js                (nowy) — showOfferHistoryUnified, restoreOfferVersion, showAuditSnapshot
    pvSalesActions.js                (nowy) — deleteOrderUnified, deleteOfferWithConfirmation, openOfferForEdit
```

### Backend TS — nowe moduły

```
src/validators/
    offerSchemasCommon.ts            (nowy) — typy wspólne
    offerSchemasRury.ts              (nowy) — typy dla rur
    offerSchemasStudnie.ts           (nowy) — typy dla studni
src/routes/orders/
    ruryOrders.crud.ts               (nowy) — CRUD zamówień rur
    ruryOrders.export.ts             (nowy) — eksport zamówień rur
    studnieOrders.crud.ts            (nowy) — CRUD zamówień studni
    studnieOrders.export.ts          (nowy) — eksport zamówień studni
```

---

## Template Loader

Wykorzystać istniejącą funkcję `getTemplate(path)` z `public/js/studnie/printManager.js`.

Mechanizm ładowania partiali:

```js
async function loadPartials() {
    const partials = [
        { id: 'app-header', path: 'partials/header.html' },
        { id: 'wizard-step-1', path: 'partials/studnie/step1-client.html' },
        { id: 'wizard-step-2', path: 'partials/studnie/step2-parameters.html' },
        { id: 'wizard-step-3', path: 'partials/studnie/step3-offer.html' },
        { id: 'wizard-step-4', path: 'partials/studnie/step4-build-card.html' },
        { id: 'wells-sidebar', path: 'partials/studnie/sidebar.html' },
        { id: 'section-offer', path: 'partials/studnie/offer.html' },
        { id: 'section-pricelist', path: 'partials/studnie/pricelist.html' }
    ];

    for (const { id, path } of partials) {
        const el = document.getElementById(id);
        if (el) {
            try {
                el.innerHTML = await getTemplate(path);
            } catch (e) {
                console.error('Failed to load partial: ' + path, e);
            }
        }
    }

    lucide.createIcons();
}
```

**Kluczowe wymagania:**

- Ładowanie sekwencyjne (nie `Promise.all`) — zachowanie kolejności
- `lucide.createIcons()` po każdym załadowaniu partiala zawierającego ikony
- `escapeHtml()` przy interpolacji danych
- Cache odpowiedzi `getTemplate()` (już istnieje)
- **Init-after-load**: Kod inicjalizujący JS (`window.wellManager = ...`, listenery, `setup*()`) uruchamiany dopiero po załadowaniu **wszystkich** partiali. Stosować `Promise.all` dla wszystkich `loadPartials()`, a następnie `document.addEventListener('DOMContentLoaded', initApp)` lub jawną funkcję `initAfterPartialsLoaded()`.
- **Kolejność init**: 1) loadPartials → 2) lucide.createIcons() → 3) window.* assignments → 4) addEventListener/setup → 5) pierwsze renderowanie

### ⚠️ Ryzyko inline `<script>` w partialach HTML

**Przeglądarka NIE wykonuje skryptów wstrzykniętych przez `innerHTML`** — są one po cichu pomijane. `studnie.html` ma ~130 bloków skryptów, a zakresy linii ekstrakcji (np. 341–643, 644–1698) mogą zawierać `<script>` wewnątrz sekcji HTML.

**Zasada postępowania przed ekstrakcją każdego partiala:**

1. Sprawdź sekcję źródłową pod kątem tagów `<script>` (inline i zewnętrzne)
2. Jeśli sekcja zawiera `<script>` — nie przenoś go do partiala HTML. Skrypt musi pozostać w głównym HTML lub zostać wydzielony jako osobny plik JS ładowany przez `<script src="...">`
3. Partial może zawierać wyłącznie znaczniki HTML (strukturę DOM)
4. Po ekstrakcji zweryfikuj, czy oryginalna funkcjonalność działa

---

## Opis zmian per plik — szczegółowo

### A. HTML — studnie.html

Podział na 8 partiali. Szczegóły w `docs/plans/podzial-studnie-html.md`.

| Partial                                  | Linie (z oryginału) | Zależności                                |
| ---------------------------------------- | ------------------- | ----------------------------------------- |
| `partials/header.html`                   | 1–150               | Brak (czysty HTML)                        |
| `partials/studnie/step1-client.html`     | 341–643             | window.offerData, window.clientManager    |
| `partials/studnie/step2-parameters.html` | 644–1698            | validateWizardStep2(), window.currentWell |
| `partials/studnie/step3-offer.html`      | 1699–2519           | window.wells, renderWellDiagram()         |
| `partials/studnie/sidebar.html`          | 3622–4090           | window.wells, saveOfferStudnie()          |
| `partials/studnie/step4-build-card.html` | 2522–3621           | collectKartaBudowyDataStep4()             |
| `partials/studnie/offer.html`            | 4097–4386           | renderOfferSummary(), window.currentOffer |
| `partials/studnie/pricelist.html`        | 4387–5207           | showAddStudnieProductModal()              |

### B. HTML — rury.html

Podział na 4-5 partiali (analogicznie do studnie.html):

| Partial                           | Szacowane linie | Zależności           |
| --------------------------------- | --------------- | -------------------- |
| `partials/rury/step1-client.html` | ~200            | window.offerDataRury |
| `partials/rury/step2-params.html` | ~500            | window.ruryParams    |
| `partials/rury/step3-offer.html`  | ~600            | window.ruryOffer     |
| `partials/rury/offer.html`        | ~300            | renderRuryOffer()    |

### C. CSS — style.css

Podział na 6 plików:

| Nowy plik              | Zawartość z oryginału                                 |
| ---------------------- | ----------------------------------------------------- |
| `style.variables.css`  | :root zmienne, kolory, fonty, --primary, --secondary  |
| `style.layout.css`     | Grid, flex, kontenery, padding, margin                |
| `style.components.css` | Przyciski, formularze, inputy, karty, nawigacja       |
| `style.modals.css`     | Modale, popupy, toasty, overlay                       |
| `style.tables.css`     | Tabele ofert, zamówień, cennika                       |
| `style.utilities.css`  | Już istnieje jako osobny plik — ewentualnie uzupełnić |

**Strategia wdrożenia (gradual migration):**

1. Nowe pliki CSS dodawane **obok** starego `style.css` — oba importowane jednocześnie
2. Stary `style.css` pozostaje jako fallback; nowe pliki stopniowo przejmują odpowiedzialność
3. Konsolidacja (usunięcie starego `style.css`) to osobna faza, wykonalna dopiero po zweryfikowaniu, że wszystkie style są pokryte
4. Kolejność importów ma znaczenie dla specyficzności — nowe pliki ładujemy **przed** starym `style.css`

Importy w HTML (faza przejściowa):

```html
<link rel="stylesheet" href="/css/style.variables.css?v=..." />
<link rel="stylesheet" href="/css/style.layout.css?v=..." />
<link rel="stylesheet" href="/css/style.components.css?v=..." />
<link rel="stylesheet" href="/css/style.modals.css?v=..." />
<link rel="stylesheet" href="/css/style.tables.css?v=..." />
<link rel="stylesheet" href="/css/style.utilities.css?v=..." />
<link rel="stylesheet" href="/css/style.css?v=..." />
<!-- stary, tymczasowo obok -->
```

### D. CSS — studnie.css

Podział na 3 pliki:

| Nowy plik                  | Zawartość                                           |
| -------------------------- | --------------------------------------------------- |
| `studnie/configurator.css` | 3-kolumnowy layout, wizard steps, sidebar           |
| `studnie/offer.css`        | Tabele oferty, podsumowanie, przyciski akcji        |
| `studnie/modal.css`        | Modale specyficzne dla studni (transition, pricing) |

### E. Frontend JS — wellSolver.js (1517L → 3 pliki)

| Nowy plik             | Funkcje przenoszone (CAŁE)                                       |
| --------------------- | ---------------------------------------------------------------- |
| `solverCore.js`       | `backtrack`, `solve`, `checkConflicts`, `findBestAvrFill`        |
| `solverAutoSelect.js` | `runJsAutoSelection`, `buildConfigSegments`, `applyDrilledRings` |
| `solverValidation.js` | `recalculateWellErrors`, `fillKregiDP`, `fillKregiGreedy`        |

### F. Frontend JS — pvSalesUi.js (1256L, 52 metody → 4 pliki)

| Nowy plik           | Metody przenoszone                                                                                                                                                                                                                                                                                                                                                            |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pvSalesSearch.js`  | `searchOffers`, `loadMore`, `buildSearchParams`, `onSearchInput`, `loadLocalOffers`                                                                                                                                                                                                                                                                                           |
| `pvSalesFilter.js`  | `setFilterLocalOffers`, `setTypeFilter`, `setUserFilter`, `clearFilters`, `setDatePreset`, `toggleDateRange`, `filterLocalOffers`                                                                                                                                                                                                                                             |
| `pvSalesHistory.js` | `showOfferHistoryUnified`, `restoreOfferVersionUnified`, `showAuditSnapshotModal`, `viewHistorySnapshotUnified`, `copyOfferWithVersion`, `loadMoreAuditLogs`, `getAuditContextLabel`, `getAuditActionMeta`, `getAuditFieldLabel`, `formatAuditValue`, `getAuditSnapshotTitle`, `getAuditSnapshotSummary`, `getBusinessChanges`, `renderAuditEntry`, `changeOfferUserFromList` |
| `pvSalesActions.js` | `deleteOrderUnified`, `deleteOfferWithConfirmation`, `openOfferForEdit`                                                                                                                                                                                                                                                                                                       |

### G. Frontend JS — wellDiagram.js (1044L, 26 funcji → 4 pliki)

| Nowy plik                | Funkcje                                                                                                                                                                                                                                                                               |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `diagramSvgShapes.js`    | Rysowanie: `drawComponentShape`, `drawComponentLabel`, `drawComponentDimension`, `drawTransitionShape`, `drawTransitionLabel`, `drawTransitionGuideLine`, `drawSegmentDimensions`, `drawTotalHeightBar`, `drawDnLabel`, `drawPrecoInsertLine`, `drawAllComponents`, `drawTransitions` |
| `diagramCalculations.js` | Obliczenia: `calculateCanvasParams`, `resolveSegmentLabel`, `calculatePrecoInsertHeight`, `buildTransitionRanges`, `mergeOverlappingRanges`, `buildVisibleComponents`, `getElementOuterDn`, `parseTransitionGeometry`                                                                 |
| `diagramOtRings.js`      | OT rings: `enforceOtRings`, `enforceOtForSegment`, `checkSegmentHasHole`, `upgradeToOtRing`, `degradeFromOtRing`                                                                                                                                                                      |
| `diagramRenderer.js`     | Główna: `renderWellDiagram`                                                                                                                                                                                                                                                           |

### H. Frontend JS — wellUI.js (968L, 7 funcji → 4 pliki)

| Nowy plik          | Funkcje                                     |
| ------------------ | ------------------------------------------- |
| `uiLockBanners.js` | `renderOfferLockBanner`, `updateAutoLockUI` |
| `uiParamTiles.js`  | `setupParamTiles`, `updateParamTilesUI`     |
| `uiWellParams.js`  | `renderWellParams`                          |
| `uiTabSwitcher.js` | `switchSidebarTab`, `switchBuilderTab`      |

### I. Backend — offerSchemas.ts (659L → 3 pliki)

| Nowy plik                | Zawartość                                          |
| ------------------------ | -------------------------------------------------- |
| `offerSchemasCommon.ts`  | Wspólne typy (pagination, base offer, metadata)    |
| `offerSchemasRury.ts`    | Schematy dla rur (rury offer, rury order)          |
| `offerSchemasStudnie.ts` | Schematy dla studni (studnie offer, studnie order) |

### J. Backend — Route files (opcjonalnie)

| Obecny plik        | Linie | Propozycja podziału                                   |
| ------------------ | ----- | ----------------------------------------------------- |
| `ruryOrders.ts`    | 590   | → `ruryOrders.crud.ts` + `ruryOrders.export.ts`       |
| `studnieOrders.ts` | 577   | → `studnieOrders.crud.ts` + `studnieOrders.export.ts` |

---

## Zależności między plikami

### Wewnątrz modułu studnie (JS)

```
wellSolver.js ────→ solverCore.js, solverAutoSelect.js, solverValidation.js
wellDiagram.js ───→ diagramSvgShapes.js, diagramCalculations.js, diagramOtRings.js, diagramRenderer.js
wellUI.js ────────→ uiLockBanners.js, uiParamTiles.js, uiWellParams.js, uiTabSwitcher.js
offerManager.js ──→ (korzysta z wellSolver, wellDiagram, wellUI)
printManager.js ──→ (zawiera getTemplate() — używane przez loadPartials)
```

### Między HTML a JS

```
studnie.html ────→ ~130 skryptów JS (wszystkie public/js/studnie/*.js)
                 → CSS: style.css, studnie.css, rury.css, style.utilities.css
rury.html ───────→ ~42 skrypty JS (public/js/rury/*.js)
                 → CSS: style.css, rury.css
```

### Między backendem

```
offerSchemas.ts ────→ używany przez routes/offers/* i routes/orders/*
routes/orders/* ────→ services/docx/* (generowanie dokumentów)
services/telemetry/ ──→ routes/telemetry*
```

### Zależności refaktoryzacji

| Zmiana                | Zależy od                            | Blokuje                               |
| --------------------- | ------------------------------------ | ------------------------------------- |
| CSS split             | Nic                                  | HTML split (zmiana importów)          |
| wellSolver.js split   | Nic                                  | offerManager.js, offerRendering.js    |
| wellDiagram.js split  | Nic                                  | offerPrintManager.js, printManager.js |
| wellUI.js split       | Nic                                  | offerManager.js                       |
| pvSalesUi.js split    | Nic                                  | kartotekaInit.js                      |
| studnie.html split    | CSS split (importy), template loader | Nic                                   |
| rury.html split       | CSS split (importy), template loader | Nic                                   |
| offerSchemas.ts split | Nic                                  | Routes (zmiana importów)              |
| Route files split     | offerSchemas.ts split                | Nic                                   |

---

## Ryzyka

### Dla HTML partiali

| Ryzyko                                   | Prawdopodobieństwo | Wpływ     | Mitigacja                                          |
| ---------------------------------------- | ------------------ | --------- | -------------------------------------------------- |
| Brak elementu DOM przy starcie JS        | Wysokie            | Krytyczny | Ładowanie sekwencyjne partiali przed init JS       |
| Utrata eventów inline onclick            | Średnie            | Wysoki    | Nie ruszamy onclick, kopiujemy HTML dosłownie      |
| Brak inicjalizacji Lucide po załadowaniu | Średnie            | Średni    | `lucide.createIcons()` po każdym partialu          |
| Zmiana kolejności skryptów               | Niskie             | Krytyczny | Zachowujemy kolejność w studnie.html               |
| Podwójne renderowanie                    | Niskie             | Niski     | Cache w getTemplate()                              |
| Race condition przy ładowaniu            | Niskie             | Średni    | Ładowanie sekwencyjne (pętla for, nie Promise.all) |

### Dla JS split

| Ryzyko                                   | Prawdopodobieństwo | Wpływ  | Mitigacja                                              |
| ---------------------------------------- | ------------------ | ------ | ------------------------------------------------------ |
| Brak globala (window.*) w nowym pliku    | Średnie            | Wysoki | Weryfikacja `node -c` + test w przeglądarce            |
| Pominięcie ładowania nowego pliku w HTML | Średnie            | Wysoki | Lista kontrolna — dodać script tag                     |
| Zmiana kolejności ładowania skryptów     | Niskie             | Wysoki | Nowe pliki ładujemy zaraz po oryginalnym               |
| Konflikt nazw z istniejącymi plikami     | Niskie             | Średni | Używamy unikalnych nazw (solverCore, diagramSvgShapes) |

### Dla CSS split

| Ryzyko                           | Prawdopodobieństwo | Wpływ  | Mitigacja                                   |
| -------------------------------- | ------------------ | ------ | ------------------------------------------- |
| Zmiana specyficzności selektorów | Średnie            | Wysoki | Zachowanie kolejności importów CSS          |
| Pominięcie importu nowego pliku  | Niskie             | Średni | Każdy nowy plik dodajemy do wszystkich HTML |
| Zduplikowane style               | Niskie             | Niski  | Usuwamy oryginalne linie z style.css        |

### Macierz ryzyka dla największych modułów (wpływ × prawdopodobieństwo)

| Moduł                               | Wielkość           | Ryzyko specyficzne                                                     | P-stwo                                   | Wpływ                           | Poziom        |
| ----------------------------------- | ------------------ | ---------------------------------------------------------------------- | ---------------------------------------- | ------------------------------- | ------------- |
| `studnie.html` → partiale (3.1-3.8) | 5350L → 8 partiali | Inline `<script>` w sekcjach HTML utracone przez innerHTML             | Wysokie (sekcje 2,3,4 zawierają skrypty) | Krytyczny (utrata funkcji)      | **KRYTYCZNY** |
| `wellSolver.js` → 3 moduły          | 1517L → 3 pliki    | Pominięcie `window.wellSolver = {...}` w nowym pliku                   | Średnie                                  | Wysoki (brak solwera)           | **WYSOKI**    |
| `wellDiagram.js` → 4 moduły         | 1044L → 4 pliki    | Zależności między funkcjami w różnych plikach (np. calculate → render) | Wysokie (funkcje wywołują się krzyżowo)  | Wysoki (diagram nie renderuje)  | **WYSOKI**    |
| `pvSalesUi.js` → 4 moduły           | 1256L → 4 pliki    | 52 metody rozrzucone — pominięcie metody w wrapperze                   | Średnie                                  | Wysoki (brak akcji w kartotece) | **WYSOKI**    |
| `offerSchemas.ts` → 3 pliki         | 659L → 3 pliki     | Circular import (type A → type B → type A)                             | Niskie (types są proste)                 | Średni (błąd kompilacji)        | **NISKI**     |
| `style.css` → 6 plików              | 3757L → 6 plików   | Zmiana specyficzności selektorów (kolejność importów)                  | Średnie                                  | Wysoki (layout broken)          | **ŚREDNI**    |

### Ryzyko projektu ogólne

| Ryzyko                                                                   | P-stwo  | Wpływ     | Mitigacja                                                          |
| ------------------------------------------------------------------------ | ------- | --------- | ------------------------------------------------------------------ |
| ~130 skryptów + ~129 onclick — efekt domina przy zmianie                 | Wysokie | Krytyczny | Architecture Freeze + wrapper strategy + zero zmian funkcjonalnych |
| 3-4 tygodnie → 6+ tygodni (przekroczenie czasu)                          | Średnie | Wysoki    | Priorytetyzacja: najpierw God Files, reszta opcjonalna             |
| Decyzja o usunięciu wrapperów nigdy nie zapada                           | Średnie | Średni    | Kryteria usunięcia zdefiniowane w F4                               |
| Zmęczenie refaktoryzacją → spadek jakości w F3-F4                        | Średnie | Średni    | Commit po każdej zmianie, snapshot regression jako "sędzia"        |
| Istniejący bug w aplikacji → snapshoty rejestrują bug jako stan poprawny | Średnie | Średni    | Inwentaryzacja znanych błędów przed baseline'em                    |

---

## Kolejność wdrożenia — 5 faz

### Faza 0: Przygotowanie (1 dzień)

| Krok | Co robić                                                                   | Czas    |
| ---- | -------------------------------------------------------------------------- | ------- |
| 0.1  | Stworzyć katalog `public/partials/` i podkatalogi                          | ~15 min |
| 0.2  | Stworzyć `partials/header.html` (HEAD + HEADER + NAV studnie.html 1-150)   | ~30 min |
| 0.3  | Dodać funkcję `loadPartials()` w nowym pliku `partialLoader.js`            | ~1h     |
| 0.4  | Zmodyfikować `studnie.html` — dodać atrapy partiali (puste kontenery z id) | ~30 min |
| 0.5  | Wykonać `npm run format`                                                   | ~5 min  |
|      | **Commit:** `feat(studnie): przygotowanie podzialu na partiale`            |         |

**Definition of Done (F0):**

- [ ] `public/partials/` i podkatalogi istnieją
- [ ] `partialLoader.js` ładuje header.html bez błędów
- [ ] `npm run format` — bez ostrzeżeń
- [ ] Aplikacja uruchamia się i wyświetla header w app.html / studnie.html
- [ ] Snapshot DOM — brak nieoczekiwanych zmian względem baseline'u

### Faza 1: Quick wins — CSS + Backend (1-2 dni)

| Krok | Co robić                                                                        | Ryzyko | Czas |
| ---- | ------------------------------------------------------------------------------- | ------ | ---- |
| 1.1  | Wydzielić `style.variables.css` z `style.css`                                   | Niskie | ~1h  |
| 1.2  | Wydzielić `style.layout.css` z `style.css`                                      | Niskie | ~1h  |
| 1.3  | Wydzielić `style.components.css` z `style.css`                                  | Niskie | ~2h  |
| 1.4  | Wydzielić `style.modals.css` z `style.css`                                      | Niskie | ~1h  |
| 1.5  | Wydzielić `style.tables.css` z `style.css`                                      | Niskie | ~1h  |
| 1.6  | Zaktualizować wszystkie HTML (dodać nowe importy CSS obok starego style.css)    | Niskie | ~1h  |
| 1.7  | Podzielić `offerSchemas.ts` na 3 pliki                                          | Niskie | ~2h  |
|      | **Commit:** `refactor(css): podzial style.css na 6 plikow`                      |        |      |
|      | **Commit:** `refactor(backend): podzial offerSchemas.ts na common/rury/studnie` |        |      |

**Definition of Done (F1):**

- [ ] `npm run typecheck` — bez błędów (backend typy po podziale offerSchemas.ts)
- [ ] Wszystkie HTML mają nowe importy CSS + stary style.css — aplikacja wygląda identycznie
- [ ] Wszystkie widoki (studnie, rury, kartoteka, zlecenia, index) ładują się bez błędów CSS
- [ ] Snapshot CSS — brak zmian wizualnych (layout, kolory, spacing)
- [ ] `npm run format` — bez ostrzeżeń

### Faza 2: Frontend JS — samodzielne moduły (3-5 dni)

**Kolejność splitów (ważna — malejąco według ryzyka + zależności):**

1. **`wellSolver.js` (1517L)** — największy, brak zewnętrznych zależności, największy zysk
2. **`wellDiagram.js` (1044L)** — drugi co do wielkości, zależny tylko od SVG/jQuery
3. **`wellUI.js` (968L)** — mniejszy, ale używany przez offerManager — lepiej podzielić przed HTML split
4. **`pvSalesUi.js` (1256L)** — niezależny od wizarda studni, można równolegle lub na końcu

**Uwaga**: Każdy God File dzielony w całości w jednym bloku (wydzielenie + wrapper + script tagi), nie rozbijaj na podfazy.

| Krok | Co robić                                                               | Ryzyko  | Czas    |
| ---- | ---------------------------------------------------------------------- | ------- | ------- |
| 2.1  | Wydzielić `solverCore.js` z `wellSolver.js`                            | Średnie | ~2h     |
| 2.2  | Wydzielić `solverAutoSelect.js` z `wellSolver.js`                      | Średnie | ~2h     |
| 2.3  | Wydzielić `solverValidation.js` z `wellSolver.js`                      | Średnie | ~2h     |
| 2.4  | Zredukować `wellSolver.js` (usunąć przeniesione funkcje)               | Średnie | ~1h     |
| 2.5  | Dodać script tagi w `studnie.html` dla nowych plików                   | Niskie  | ~15 min |
|      | **Commit:** `refactor(studnie): podzielono wellSolver.js na 3 moduly`  |         |         |
| 2.6  | Wydzielić `diagramSvgShapes.js` z `wellDiagram.js`                     | Średnie | ~2h     |
| 2.7  | Wydzielić `diagramCalculations.js` z `wellDiagram.js`                  | Średnie | ~2h     |
| 2.8  | Wydzielić `diagramOtRings.js` z `wellDiagram.js`                       | Średnie | ~1h     |
| 2.9  | Wydzielić `diagramRenderer.js` z `wellDiagram.js`                      | Średnie | ~1h     |
| 2.10 | Zredukować `wellDiagram.js`                                            | Średnie | ~1h     |
|      | **Commit:** `refactor(studnie): podzielono wellDiagram.js na 4 moduly` |         |         |
| 2.11 | Wydzielić `uiLockBanners.js` z `wellUI.js`                             | Średnie | ~1h     |
| 2.12 | Wydzielić `uiParamTiles.js` z `wellUI.js`                              | Średnie | ~1h     |
| 2.13 | Wydzielić `uiWellParams.js` z `wellUI.js`                              | Średnie | ~1h     |
| 2.14 | Wydzielić `uiTabSwitcher.js` z `wellUI.js`                             | Średnie | ~1h     |
| 2.15 | Zredukować `wellUI.js`                                                 | Średnie | ~1h     |
|      | **Commit:** `refactor(studnie): podzielono wellUI.js na 4 moduly`      |         |         |
| 2.16 | Wydzielić `pvSalesSearch.js` z `pvSalesUi.js`                          | Średnie | ~2h     |
| 2.17 | Wydzielić `pvSalesFilter.js` z `pvSalesUi.js`                          | Średnie | ~2h     |
| 2.18 | Wydzielić `pvSalesHistory.js` z `pvSalesUi.js`                         | Średnie | ~3h     |
| 2.19 | Wydzielić `pvSalesActions.js` z `pvSalesUi.js`                         | Średnie | ~1h     |
| 2.20 | Zredukować `pvSalesUi.js`                                              | Średnie | ~2h     |
|      | **Commit:** `refactor(sales): podzielono pvSalesUi.js na 4 moduly`     |         |         |

**Definition of Done (F2):**

- [ ] `node -c` dla każdego nowego pliku JS — bez błędów składni
- [ ] Wrapper (stary plik) ładuje nowe moduły — `window.*` dostępne na tym samym poziomie co przed splitem
- [ ] Wizard studni działa (krok 1→5) — brak błędów w konsoli
- [ ] Diagram SVG renderuje się poprawnie
- [ ] Oferta studni zapisuje się i otwiera
- [ ] Kartoteka ofert (pvSalesUi) działa — wyszukiwanie, filtrowanie, historia
- [ ] Snapshoty Playwright — zgodne z baseline'em

### Faza 3: HTML monoliths — studnie.html + rury.html (3-5 dni)

**Zagrożenie**: partial ładowany przez `innerHTML` traci inline `<script>`. Przed każdą ekstrakcją sprawdź sekcję źródłową — jeśli zawiera `<script>`, nie przenoś go do partiala. Patrz sekcja "⚠️ Ryzyko inline `<script>`".

**Contingency (gdy partial nie ładuje się poprawnie):**

1. Wycofaj zmiany w danym partialu: `git checkout -- public/partials/studnie/<partial>.html`
2. Przywróć oryginalną sekcję w `studnie.html`
3. Spróbuj ponownie z mniejszym partialem (podziel na 2 mniejsze)
4. Jeśli problemem jest inicjalizacja JS — dodaj `data-partial-loaded` atrybut i sprawdź w init
5. Tylko w ostateczności: scal partial z powrotem do głównego HTML i oznacz jako "do ponownej próby"

| Krok | Co robić                                                               | Ryzyko  | Czas  |
| ---- | ---------------------------------------------------------------------- | ------- | ----- |
| 3.1  | Wydzielić `partials/studnie/offer.html`                                | Niskie  | ~1h   |
| 3.2  | Wydzielić `partials/studnie/pricelist.html`                            | Niskie  | ~2h   |
| 3.3  | Wydzielić `partials/studnie/step1-client.html`                         | Niskie  | ~1h   |
| 3.4  | Wydzielić `partials/studnie/step3-offer.html`                          | Średnie | ~2h   |
| 3.5  | Wydzielić `partials/studnie/step2-parameters.html`                     | Średnie | ~3h   |
| 3.6  | Wydzielić `partials/studnie/sidebar.html`                              | Średnie | ~1.5h |
| 3.7  | Wydzielić `partials/studnie/step4-build-card.html`                     | Wysokie | ~3h   |
| 3.8  | Oczyścić `studnie.html` do ~400 linii                                  | Średnie | ~2h   |
|      | **Commit:** `refactor(studnie): podzielono studnie.html na 8 partiali` |         |       |
| 3.9  | Wydzielić `partials/rury/step1-client.html`                            | Niskie  | ~1h   |
| 3.10 | Wydzielić `partials/rury/step2-params.html`                            | Średnie | ~2h   |
| 3.11 | Wydzielić `partials/rury/step3-offer.html`                             | Średnie | ~2h   |
| 3.12 | Wydzielić `partials/rury/offer.html`                                   | Niskie  | ~1h   |
| 3.13 | Oczyścić `rury.html` do ~400 linii                                     | Średnie | ~1h   |
|      | **Commit:** `refactor(rury): podzielono rury.html na partiale`         |         |       |

**Definition of Done (F3):**

- [ ] `studnie.html` ~300-500 linii (partiale z `loadPartials()`)
- [ ] `rury.html` ~300-500 linii (partiale z `loadPartials()`)
- [ ] Żaden partial nie zawiera tagów `<script>` — wszystkie skrypty pozostały w głównym HTML
- [ ] Wszystkie widoki (builder, oferta, cennik, kartoteka) działają bez błędów
- [ ] Snapshoty Playwright — zgodne z baseline'em
- [ ] `npm run format` — bez ostrzeżeń

### Faza 4: Pozostałe — CSS studnie + Backend routes (1-2 dni)

| Krok | Co robić                                                       | Ryzyko  | Czas    |
| ---- | -------------------------------------------------------------- | ------- | ------- |
| 4.1  | Wydzielić `studnie/configurator.css` z `studnie.css`           | Średnie | ~2h     |
| 4.2  | Wydzielić `studnie/offer.css` z `studnie.css`                  | Średnie | ~1h     |
| 4.3  | Wydzielić `studnie/modal.css` z `studnie.css`                  | Średnie | ~1h     |
| 4.4  | Zaktualizować importy w studnie.html                           | Niskie  | ~30 min |
|      | **Commit:** `refactor(css): podzielono studnie.css na 3 pliki` |         |         |
| 4.5  | Podzielić `ruryOrders.ts` na .crud.ts + .export.ts             | Niskie  | ~2h     |
| 4.6  | Podzielić `studnieOrders.ts` na .crud.ts + .export.ts          | Niskie  | ~2h     |
|      | **Commit:** `refactor(backend): podzielono route files`        |         |         |

**Definition of Done (F4):**

- [ ] `npm run typecheck` — bez błędów (route exports po podziale)
- [ ] `studnie.css` — 3 nowe pliki dodane obok starego
- [ ] Wszystkie endpointy API działają (GET/POST/PUT/DELETE ofert, zamówień)
- [ ] Eksport PDF, DOCX, XLSX — bez zmian
- [ ] Wszystkie snapshoty Playwright — zgodne z baseline'em
- [ ] `npm run format` — bez ostrzeżeń

### Kryteria usunięcia wrapperów (osobna decyzja, nie w ramach tej refaktoryzacji)

Wrapper (stare pliki jako forwardery) mogą zostać usunięte gdy:

- Wszystkie środowiska (dev, staging, prod) działały na nowych plikach ≥2 tygodnie bez incydentów
- 0 błędów w konsoli JS związanych z ładowaniem modułów
- Testy regresyjne (Playwright snapshoty) przechodzą w 100%
- Brak zewnętrznych skryptów / bookmarkletów / rozszerzeń korzystających z oryginalnych ścieżek plików
- Wszyscy deweloperzy potwierdzili znajomość nowej struktury plików

---

## Szacowany nakład pracy

| Faza      | Zakres                                                   |             Czas | Ryzyko      |
| --------- | -------------------------------------------------------- | ---------------: | ----------- |
| 0         | Przygotowanie struktury, header.html, partial loader     |          1-2 dni | Niskie      |
| 1         | CSS (style.css) + Backend (offerSchemas.ts)              |          2-3 dni | Niskie      |
| 2         | Frontend JS (wellSolver, wellDiagram, wellUI, pvSalesUi) |          5-8 dni | Średnie     |
| 3         | HTML (studnie.html + rury.html) — największe ryzyko      |          5-8 dni | Wysokie     |
| 4         | CSS (studnie.css) + Backend (routes) + snapshot tests    |          2-4 dni | Niskie      |
| **Razem** | **17 plików → ~50 nowych plików**                        | **3-4 tygodnie** | **Średnie** |

> **Uwaga**: Czas 3-4 tygodnie uwzględnia wrapper strategy, snapshot regression, weryfikację window.* mapy i ewentualne poprawki powdrożeniowe. Około 30% czasu stanowi weryfikacja (snapshoty + testy regresyjne).

---

## Procedura po każdym kroku

```
□ npm run typecheck (backend)
□ node -c <nowy_plik.js> (frontend JS)
□ npm run format
□ Aplikacja uruchamia się bez błędów
□ Brak błędów JS w konsoli przeglądarki
□ Działa wizard (nawigacja między krokami)
□ Działa zapis oferty
□ Działa otwieranie istniejących ofert
□ Działa cennik (filtrowanie, edycja, zapis)
□ Działa SVG (renderowanie diagramu)
□ Działa drag&drop elementów
□ Działa druk (PDF, Word)
□ Działa eksport (XLSX)
□ Działa import
```

---

## Rollback

### Procedura

Po każdym kroku:

1. `git add -A`
2. `git commit -m "refactor(scope): opis zmiany"`
3. Uruchomić checklistę powyżej

W razie problemów:

```bash
git checkout -- public/studnie.html   # przywraca HTML
git checkout -- public/js/studnie/    # przywraca JS
git checkout -- public/css/           # przywraca CSS
git checkout -- src/validators/       # przywraca backend
```

### Kryteria rollbacku (kiedy cofamy zmianę)

Rollback wykonujemy, gdy spełniony jest **którykolwiek** z warunków:

| #   | Warunek                                                                   | Przykład                                                       | Decyzja                                                                         |
| --- | ------------------------------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| 1   | Snapshot regression — zmiana wizualna wykraczająca poza oczekiwany zakres | Zniknął przycisk, przesunęła się kolumna, brakuje elementu DOM | **Natychmiastowy rollback** — bez analizy                                       |
| 2   | Typecheck/lint nie przechodzi po zmianie                                  | `npm run typecheck` zwraca błędy                               | **Rollback przed commitem** — popraw i spróbuj ponownie                         |
| 3   | Funkcjonalność krytyczna przestała działać                                | Wizard nie przechodzi do kroku 2, oferta się nie zapisuje      | **Natychmiastowy rollback**                                                     |
| 4   | Błąd JS w konsoli związany z refaktoryzacją                               | `Cannot read property of undefined` z nowego pliku             | **Rollback** — napraw błąd i spróbuj ponownie                                   |
| 5   | Różnica w snapshotach, ale wizualnie OK                                   | Zmiana formatowania CSS, przesunięcie o 1px                    | **Analiza** — jeśli to artifact formatowania, zaakceptuj i zaktualizuj snapshot |
| 6   | Partial nie ładuje się (puste miejsce w UI)                               | `getTemplate()` zwraca błąd lub pusty string                   | **Rollback partiala** — spróbuj z mniejszym zakresem                            |
| 7   | Wrapper nie exportuje funkcji                                             | `window.wellSolver.backtrack is not a function`                | **Rollback** — dodaj brakujący export i spróbuj ponownie                        |

**Zasada ogólna**: Jeśli nie jesteś pewien czy zmiana jest bezpieczna — **cofnij**. Lepiej stracić 30 min na rollback niż 3 dni na szukanie regresji.

---

## Poza zakresem (czego NIE robić)

| Czynność                                         | Status                                    |
| ------------------------------------------------ | ----------------------------------------- |
| ❌ Zamiana `onclick` na `addEventListener`       | Poza zakresem                             |
| ❌ Usuwanie inline CSS (`style=""`)              | Poza zakresem                             |
| ❌ Zmiana nazw klas CSS                          | Poza zakresem                             |
| ❌ Zmiana `id` elementów                         | Poza zakresem                             |
| ❌ Zmiana logiki wizarda                         | Poza zakresem                             |
| ❌ Zmiana renderowania SVG                       | Poza zakresem                             |
| ❌ Zmiana kolejności skryptów                    | Poza zakresem                             |
| ❌ Dodawanie/usuwanie zależności npm             | Poza zakresem                             |
| ❌ Migracja do ES modules (import/export)        | Poza zakresem                             |
| ❌ Zmiana architektury SPA (iframe)              | Poza zakresem                             |
| ❌ Zmiana formatu bazy danych                    | Poza zakresem                             |
| ❌ Refaktoryzacja wewnątrz funkcji               | Poza zakresem                             |
| ❌ Usuwanie dead code                            | Poza zakresem                             |
| ✅ Snapshot regression tests (Playwright)        | W zakresie — zob. sekcja Testy regresyjne |
| ❌ Testy jednostkowe / integracyjne nowej logiki | Poza zakresem                             |

---

## Kryteria zakończenia

Refaktoryzacja zakończona gdy:

- ✓ `studnie.html` ~300-500 linii (partiale, wrapper zachowany)
- ✓ `rury.html` ~300-500 linii (partiale, wrapper zachowany)
- ✓ `style.css` uzupełniony przez 6 mniejszych plików (stary zachowany, nowe pliki dodane obok)
- ✓ `studnie.css` uzupełniony przez 3 mniejsze pliki (stary zachowany)
- ✓ `wellSolver.js` → 3 moduły + wrapper
- ✓ `wellDiagram.js` → 4 moduły + wrapper
- ✓ `wellUI.js` → 4 moduły + wrapper
- ✓ `pvSalesUi.js` → 4 moduły + wrapper
- ✓ `offerSchemas.ts` → 3 pliki + wrapper
- ✓ Wszystkie widoki działają (builder, oferta, cennik, kartoteka, rury)
- ✓ Brak błędów JS w konsoli
- ✓ Wszystkie partiale ładują się poprawnie
- ✓ Brak zmian funkcjonalnych
- ✓ Snapshot regression: brak nieoczekiwanych zmian wizualnych w Playwright
- ✓ Wszystkie testy z checklisty zakończone sukcesem
- ✓ `npm run format` wykonany na całym projekcie

---

## Metryki sukcesu (stan przed vs po)

| Metryka                                  | Przed refaktoryzacją | Po refaktoryzacji (cel)           |
| ---------------------------------------- | -------------------- | --------------------------------- |
| Liczba God Files (>500L + SRP naruszone) | 6                    | 0 (wszystkie podzielone)          |
| Największy plik (L)                      | `studnie.html` 5350  | ~400 (partiale, wrapper)          |
| Średnia linii na plik (JS frontend)      | ~150                 | ~120 (po splitach)                |
| Liczba plików JS (frontend)              | 181                  | ~195 (+14 z splitów)              |
| Liczba wrapperów                         | 0                    | ~6-7 (do usunięcia w przyszłości) |
| Liczba God Files backend (>500L)         | 3                    | 3 (bez zmian — poza zakresem)     |
| Czas pełnego typecheck                   | Mierzalny przed F0   | Taki sam lub krótszy              |
| Liczba snapshotów Playwright             | 0                    | ≥8 (pokrycie krytycznych widoków) |
