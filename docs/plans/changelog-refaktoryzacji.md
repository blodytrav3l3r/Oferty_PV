# CHANGELOG Refaktoryzacji — WITROS Oferty PV

> Żywy dokument śledzący postęp refaktoryzacji. Każda zmiana w kodzie związana z refaktoryzacją **musi** zostać odnotowana poniżej przed commitem.

---

## Legenda

| Kolumna    | Znaczenie                             |
| ---------- | ------------------------------------- |
| **Data**   | Data wprowadzenia zmiany (YYYY-MM-DD) |
| **Autor**  | Osoba/model odpowiedzialny            |
| **Pliki**  | Lista plików dotkniętych zmianą       |
| **Typ**    | Rodzaj zmiany (patrz niżej)           |
| **Status** | Status zadania                        |

### Typy zmian

| Skrót               | Opis                                   |
| ------------------- | -------------------------------------- |
| `CSS split`         | Podział pliku CSS na mniejsze          |
| `JS split`          | Podział pliku JS na moduły             |
| `HTML partial`      | Wydzielenie partiala HTML              |
| `Backend split`     | Podział pliku backend (TS)             |
| `Dokumentacja`      | Zmiana w dokumentacji/planach          |
| `Przygotowanie`     | Struktura katalogów, narzędzia, config |
| `Fix powdrożeniowy` | Naprawa błędu po refaktoryzacji        |

### Statusy

| Status          | Znaczenie                                                  |
| --------------- | ---------------------------------------------------------- |
| `Planowane`     | Zadanie zdefiniowane, gotowe do rozpoczęcia                |
| `W toku`        | Praca w trakcie                                            |
| `Zweryfikowane` | Kod napisany, typecheck przechodzi, działanie potwierdzone |
| `Wycofane`      | Zmiana anulowana lub odwrócona                             |

---

## Faza 0: Przygotowanie

| Data       | Autor    | Pliki                                                     | Typ           | Status        |
| ---------- | -------- | --------------------------------------------------------- | ------------- | ------------- |
| 2026-07-21 | opencode | `public/partials/` (katalog)                              | Przygotowanie | Zweryfikowane |
| 2026-07-21 | opencode | `public/partials/studnie/` (katalog)                      | Przygotowanie | Zweryfikowane |
| 2026-07-21 | opencode | `public/partials/rury/` (katalog)                         | Przygotowanie | Zweryfikowane |
| 2026-07-21 | opencode | `public/js/studnie/partialLoader.js`                      | Przygotowanie | Zweryfikowane |
| 2026-07-21 | opencode | `public/partials/header.html` (linie 19-147 studnie.html) | HTML partial  | Zweryfikowane |
| 2026-07-21 | opencode | `public/studnie.html` (header -> partial-header kontener) | HTML partial  | Zweryfikowane |

---

## Faza 1: Quick wins — CSS + Backend

### 1.1 Podział `style.css` → 6 plików

| Data | Autor | Pliki                                  | Typ       | Status    |
| ---- | ----- | -------------------------------------- | --------- | --------- |
| —    | —     | `style.variables.css` (nowy)           | CSS split | Planowane |
| —    | —     | `style.layout.css` (nowy)              | CSS split | Planowane |
| —    | —     | `style.components.css` (nowy)          | CSS split | Planowane |
| —    | —     | `style.modals.css` (nowy)              | CSS split | Planowane |
| —    | —     | `style.tables.css` (nowy)              | CSS split | Planowane |
| —    | —     | `style.css` (redukcja)                 | CSS split | Planowane |
| —    | —     | Wszystkie HTML (aktualizacja importów) | CSS split | Planowane |

### 1.2 Podział `offerSchemas.ts` → 3 pliki

| Data | Autor | Pliki                           | Typ           | Status    |
| ---- | ----- | ------------------------------- | ------------- | --------- |
| —    | —     | `offerSchemasCommon.ts` (nowy)  | Backend split | Planowane |
| —    | —     | `offerSchemasRury.ts` (nowy)    | Backend split | Planowane |
| —    | —     | `offerSchemasStudnie.ts` (nowy) | Backend split | Planowane |
| —    | —     | `offerSchemas.ts` (redukcja)    | Backend split | Planowane |

---

## Faza 2: Frontend JS — samodzielne moduły

### 2.1 Podział `wellSolver.js` → 3 pliki

| Data | Autor | Pliki                                                                                     | Typ      | Status    |
| ---- | ----- | ----------------------------------------------------------------------------------------- | -------- | --------- |
| —    | —     | `solverCore.js` (nowy) — backtrack, solve, checkConflicts, findBestAvrFill                | JS split | Planowane |
| —    | —     | `solverAutoSelect.js` (nowy) — runJsAutoSelection, buildConfigSegments, applyDrilledRings | JS split | Planowane |
| —    | —     | `solverValidation.js` (nowy) — recalculateWellErrors, fillKregiDP, fillKregiGreedy        | JS split | Planowane |
| —    | —     | `wellSolver.js` (redukcja)                                                                | JS split | Planowane |
| —    | —     | `studnie.html` (dodanie script tagów)                                                     | JS split | Planowane |

### 2.2 Podział `wellDiagram.js` → 4 pliki

| Data | Autor | Pliki                           | Typ      | Status    |
| ---- | ----- | ------------------------------- | -------- | --------- |
| —    | —     | `diagramSvgShapes.js` (nowy)    | JS split | Planowane |
| —    | —     | `diagramCalculations.js` (nowy) | JS split | Planowane |
| —    | —     | `diagramOtRings.js` (nowy)      | JS split | Planowane |
| —    | —     | `diagramRenderer.js` (nowy)     | JS split | Planowane |
| —    | —     | `wellDiagram.js` (redukcja)     | JS split | Planowane |

### 2.3 Podział `wellUI.js` → 4 pliki

| Data | Autor | Pliki                                                               | Typ      | Status    |
| ---- | ----- | ------------------------------------------------------------------- | -------- | --------- |
| —    | —     | `uiLockBanners.js` (nowy) — renderOfferLockBanner, updateAutoLockUI | JS split | Planowane |
| —    | —     | `uiParamTiles.js` (nowy) — setupParamTiles, updateParamTilesUI      | JS split | Planowane |
| —    | —     | `uiWellParams.js` (nowy) — renderWellParams                         | JS split | Planowane |
| —    | —     | `uiTabSwitcher.js` (nowy) — switchSidebarTab, switchBuilderTab      | JS split | Planowane |
| —    | —     | `wellUI.js` (redukcja)                                              | JS split | Planowane |

### 2.4 Podział `pvSalesUi.js` → 4 pliki

| Data | Autor | Pliki                                                                                                         | Typ      | Status    |
| ---- | ----- | ------------------------------------------------------------------------------------------------------------- | -------- | --------- |
| —    | —     | `pvSalesSearch.js` (nowy) — searchOffers, loadMore, buildSearchParams, onSearchInput                          | JS split | Planowane |
| —    | —     | `pvSalesFilter.js` (nowy) — setFilterLocalOffers, setTypeFilter, setUserFilter, clearFilters                  | JS split | Planowane |
| —    | —     | `pvSalesHistory.js` (nowy) — showOfferHistoryUnified, restoreOfferVersionUnified, showAuditSnapshotModal, ... | JS split | Planowane |
| —    | —     | `pvSalesActions.js` (nowy) — deleteOrderUnified, deleteOfferWithConfirmation, openOfferForEdit                | JS split | Planowane |
| —    | —     | `pvSalesUi.js` (redukcja)                                                                                     | JS split | Planowane |

---

## Faza 3: HTML monoliths — studnie.html + rury.html

### 3.1 Podział `studnie.html` → partiale

| Data | Autor | Pliki                                                             | Typ          | Status    |
| ---- | ----- | ----------------------------------------------------------------- | ------------ | --------- |
| —    | —     | `partials/studnie/offer.html` (nowy) — linie 4097–4386            | HTML partial | Planowane |
| —    | —     | `partials/studnie/pricelist.html` (nowy) — linie 4387–5207        | HTML partial | Planowane |
| —    | —     | `partials/studnie/step1-client.html` (nowy) — linie 341–643       | HTML partial | Planowane |
| —    | —     | `partials/studnie/step3-offer.html` (nowy) — linie 1699–2519      | HTML partial | Planowane |
| —    | —     | `partials/studnie/step2-parameters.html` (nowy) — linie 644–1698  | HTML partial | Planowane |
| —    | —     | `partials/studnie/sidebar.html` (nowy) — linie 3622–4090          | HTML partial | Planowane |
| —    | —     | `partials/studnie/step4-build-card.html` (nowy) — linie 2522–3621 | HTML partial | Planowane |
| —    | —     | `studnie.html` (redukcja do ~400 linii)                           | HTML partial | Planowane |

### 3.2 Podział `rury.html` → partiale

| Data | Autor | Pliki                                    | Typ          | Status    |
| ---- | ----- | ---------------------------------------- | ------------ | --------- |
| —    | —     | `partials/rury/step1-client.html` (nowy) | HTML partial | Planowane |
| —    | —     | `partials/rury/step2-params.html` (nowy) | HTML partial | Planowane |
| —    | —     | `partials/rury/step3-offer.html` (nowy)  | HTML partial | Planowane |
| —    | —     | `partials/rury/offer.html` (nowy)        | HTML partial | Planowane |
| —    | —     | `rury.html` (redukcja do ~400 linii)     | HTML partial | Planowane |

---

## Faza 4: Pozostałe — CSS studnie + Backend routes

### 4.1 Podział `studnie.css` → 3 pliki

| Data | Autor | Pliki                             | Typ       | Status    |
| ---- | ----- | --------------------------------- | --------- | --------- |
| —    | —     | `studnie/configurator.css` (nowy) | CSS split | Planowane |
| —    | —     | `studnie/offer.css` (nowy)        | CSS split | Planowane |
| —    | —     | `studnie/modal.css` (nowy)        | CSS split | Planowane |
| —    | —     | `studnie.css` (redukcja)          | CSS split | Planowane |

### 4.2 Podział route files

| Data | Autor | Pliki                            | Typ           | Status    |
| ---- | ----- | -------------------------------- | ------------- | --------- |
| —    | —     | `ruryOrders.crud.ts` (nowy)      | Backend split | Planowane |
| —    | —     | `ruryOrders.export.ts` (nowy)    | Backend split | Planowane |
| —    | —     | `studnieOrders.crud.ts` (nowy)   | Backend split | Planowane |
| —    | —     | `studnieOrders.export.ts` (nowy) | Backend split | Planowane |

---

## Dokumentacja

| Data       | Autor | Pliki                                    | Typ          | Status        |
| ---------- | ----- | ---------------------------------------- | ------------ | ------------- |
| 2026-07-20 | —     | `docs/plans/architecture-freeze.md`      | Dokumentacja | Zweryfikowane |
| 2026-07-20 | —     | `docs/plans/changelog-refaktoryzacji.md` | Dokumentacja | Zweryfikowane |

---

## Podsumowanie

| Faza                     | Planowane | W toku | Zweryfikowane | Wycofane |  Razem |
| ------------------------ | --------: | -----: | ------------: | -------: | -----: |
| 0 — Przygotowanie        |         4 |      0 |             0 |        0 |      4 |
| 1 — CSS + Backend        |        10 |      0 |             0 |        0 |     10 |
| 2 — Frontend JS          |        20 |      0 |             0 |        0 |     20 |
| 3 — HTML partiale        |        13 |      0 |             0 |        0 |     13 |
| 4 — CSS studnie + Routes |         8 |      0 |             0 |        0 |      8 |
| Dokumentacja             |         0 |      0 |             2 |        0 |      2 |
| **Razem**                |    **55** |  **0** |         **2** |    **0** | **57** |

---

**Procedura aktualizacji:**

1. Po każdej zmianie refaktoryzacyjnej: znajdź odpowiedni wiersz, zmień status na `Zweryfikowane`, wpisz datę i autora.
2. Jeśli zmiana okazała się błędna: zmień status na `Wycofane`, dodaj komentarz w nowym wierszu.
3. Na koniec dnia: zaktualizuj tabelę podsumowującą.
