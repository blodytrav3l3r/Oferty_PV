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

### 1.1 Podział `style.css` → 4 pliki

| Data       | Autor    | Pliki                                | Typ       | Status        |
| ---------- | -------- | ------------------------------------ | --------- | ------------- |
| przed sesją | opencode | 4 pliki zamiast planowanych 6        | CSS split | Zweryfikowane |
| przed sesją | opencode | Wszystkie HTML (aktualizacja importów) | CSS split | Zweryfikowane |

### 1.2 Podział `offerSchemas.ts` → 3 pliki

| Data       | Autor    | Pliki                               | Typ           | Status        |
| ---------- | -------- | ----------------------------------- | ------------- | ------------- |
| 2026-07-21 | opencode | `productSchemas.ts` (nowy)          | Backend split | Zweryfikowane |
| 2026-07-21 | opencode | `orderSchemas.ts` (nowy)            | Backend split | Zweryfikowane |
| 2026-07-21 | opencode | `offerSchemas.ts` (redukcja)        | Backend split | Zweryfikowane |

---

## Faza 2: Frontend JS — samodzielne moduły

### 2.1 Podział `wellSolver.js` → 3 pliki

| Data       | Autor    | Pliki                                                                                     | Typ      | Status        |
| ---------- | -------- | ----------------------------------------------------------------------------------------- | -------- | ------------- |
| 2026-07-21 | opencode | `solverCore.js` (nowy) — buildConfigSegments, applyDrilledRings                           | JS split | Zweryfikowane |
| 2026-07-21 | opencode | `solverAutoSelect.js` (nowy) — autoSelectComponents, runJsAutoSelection                   | JS split | Zweryfikowane |
| 2026-07-21 | opencode | `solverValidation.js` (nowy) — recalculateWellErrors                                      | JS split | Zweryfikowane |
| 2026-07-21 | opencode | `wellSolver.js` (redukcja do wrappera)                                                    | JS split | Zweryfikowane |
| 2026-07-21 | opencode | `studnie.html` (dodanie 3 script tagów)                                                    | JS split | Zweryfikowane |

### 2.2 Podział `wellDiagram.js` → 7 plików (więcej niż planowane 4)

| Data       | Autor    | Pliki                                      | Typ      | Status        |
| ---------- | -------- | ------------------------------------------ | -------- | ------------- |
| 2026-07-21 | opencode | `diagramTheme.js` (nowy) — SVG_COLORS itp. | JS split | Zweryfikowane |
| 2026-07-21 | opencode | `diagramOtRings.js` (nowy)                 | JS split | Zweryfikowane |
| 2026-07-21 | opencode | `diagramComponents.js` (nowy)              | JS split | Zweryfikowane |
| 2026-07-21 | opencode | `diagramTransitions.js` (nowy)             | JS split | Zweryfikowane |
| 2026-07-21 | opencode | `diagramDimensions.js` (nowy)              | JS split | Zweryfikowane |
| 2026-07-21 | opencode | `diagramPreco.js` (nowy)                   | JS split | Zweryfikowane |
| 2026-07-21 | opencode | `diagramRenderer.js` (nowy)                | JS split | Zweryfikowane |
| 2026-07-21 | opencode | `wellDiagram.js` (redukcja do wrappera)     | JS split | Zweryfikowane |

### 2.3 Podział `wellUI.js` → 4 pliki (+ wrapper z renderWellsList/updateSummary)

| Data       | Autor    | Pliki                                                  | Typ      | Status        |
| ---------- | -------- | ------------------------------------------------------ | -------- | ------------- |
| 2026-07-21 | opencode | `uiLockBanners.js` (nowy)                              | JS split | Zweryfikowane |
| 2026-07-21 | opencode | `uiParamTiles.js` (nowy)                               | JS split | Zweryfikowane |
| 2026-07-21 | opencode | `uiWellParams.js` (nowy)                               | JS split | Zweryfikowane |
| 2026-07-21 | opencode | `uiTabSwitcher.js` (nowy)                              | JS split | Zweryfikowane |
| 2026-07-21 | opencode | `wellUI.js` (redukcja — renderWellsList + updateSummary) | JS split | Zweryfikowane |

### 2.4 Podział `pvSalesUi.js` → 4 pliki (ES module mixin)

| Data       | Autor    | Pliki                                                | Typ      | Status        |
| ---------- | -------- | ---------------------------------------------------- | -------- | ------------- |
| 2026-07-21 | opencode | `pvSalesSearch.js` (nowy)                            | JS split | Zweryfikowane |
| 2026-07-21 | opencode | `pvSalesFilter.js` (nowy)                            | JS split | Zweryfikowane |
| 2026-07-21 | opencode | `pvSalesHistory.js` (nowy)                           | JS split | Zweryfikowane |
| 2026-07-21 | opencode | `pvSalesActions.js` (nowy)                           | JS split | Zweryfikowane |
| 2026-07-21 | opencode | `pvSalesUi.js` (redukcja do wrappera z Object.assign) | JS split | Zweryfikowane |

---

## Faza 3: HTML monoliths — studnie.html + rury.html

### 3.1 Podział `studnie.html` → 8 partiali

| Data       | Autor    | Pliki                                                   | Typ          | Status        |
| ---------- | -------- | ------------------------------------------------------- | ------------ | ------------- |
| 2026-07-21 | opencode | `partials/studnie/offer.html` (nowy)                    | HTML partial | Zweryfikowane |
| 2026-07-21 | opencode | `partials/studnie/pricelist.html` (nowy)                | HTML partial | Zweryfikowane |
| 2026-07-21 | opencode | `partials/studnie/step1-client.html` (nowy)             | HTML partial | Zweryfikowane |
| 2026-07-21 | opencode | `partials/studnie/step3-offer.html` (nowy)              | HTML partial | Zweryfikowane |
| 2026-07-21 | opencode | `partials/studnie/step2-parameters.html` (nowy)         | HTML partial | Zweryfikowane |
| 2026-07-21 | opencode | `partials/studnie/sidebar.html` (nowy)                  | HTML partial | Zweryfikowane |
| 2026-07-21 | opencode | `partials/studnie/step4-build-card.html` (nowy)         | HTML partial | Zweryfikowane |
| 2026-07-21 | opencode | `partials/studnie/modals.html` (nowy)                   | HTML partial | Zweryfikowane |
| 2026-07-21 | opencode | `studnie.html` (redukcja 5238→838 linii)                | HTML partial | Zweryfikowane |

### 3.2 Podział `rury.html` → 11 partiali

| Data       | Autor    | Pliki                                                    | Typ          | Status        |
| ---------- | -------- | -------------------------------------------------------- | ------------ | ------------- |
| 2026-07-21 | opencode | `partials/rury/header.html` (nowy)                       | HTML partial | Zweryfikowane |
| 2026-07-21 | opencode | `partials/rury/wizard-nav.html` (nowy)                   | HTML partial | Zweryfikowane |
| 2026-07-21 | opencode | `partials/rury/step1-client.html` (nowy)                 | HTML partial | Zweryfikowane |
| 2026-07-21 | opencode | `partials/rury/step2-products.html` (nowy)               | HTML partial | Zweryfikowane |
| 2026-07-21 | opencode | `partials/rury/step3-offer-summary.html` (nowy)          | HTML partial | Zweryfikowane |
| 2026-07-21 | opencode | `partials/rury/step4-build-card.html` (nowy)             | HTML partial | Zweryfikowane |
| 2026-07-21 | opencode | `partials/rury/step5-order.html` (nowy)                  | HTML partial | Zweryfikowane |
| 2026-07-21 | opencode | `partials/rury/offer.html` (nowy)                        | HTML partial | Zweryfikowane |
| 2026-07-21 | opencode | `partials/rury/pricelist.html` (nowy)                    | HTML partial | Zweryfikowane |
| 2026-07-21 | opencode | `partials/rury/summary-bar.html` (nowy)                  | HTML partial | Zweryfikowane |
| 2026-07-21 | opencode | `partials/rury/transport-modal.html` (nowy)              | HTML partial | Zweryfikowane |
| 2026-07-21 | opencode | `rury.html` (redukcja 2457→131 linii)                    | HTML partial | Zweryfikowane |

---

## Faza 4: Pozostałe — CSS studnie + Backend routes

### 4.1 Podział `studnie.css` → 3 pliki

| Data       | Autor    | Pliki                                  | Typ       | Status        |
| ---------- | -------- | -------------------------------------- | --------- | ------------- |
| 2026-07-21 | opencode | `studnie/configurator.css` (nowy)      | CSS split | Zweryfikowane |
| 2026-07-21 | opencode | `studnie/offer.css` (nowy)             | CSS split | Zweryfikowane |
| 2026-07-21 | opencode | `studnie/modal.css` (nowy)             | CSS split | Zweryfikowane |
| 2026-07-21 | opencode | `studnie.css` (oryginał zachowany)     | CSS split | Zweryfikowane |

### 4.2 Podział route files

| Data       | Autor    | Pliki                                    | Typ           | Status        |
| ---------- | -------- | ---------------------------------------- | ------------- | ------------- |
| 2026-07-21 | opencode | `ruryOrders.crud.ts` (nowy)              | Backend split | Zweryfikowane |
| 2026-07-21 | opencode | `ruryOrders.export.ts` (nowy)            | Backend split | Zweryfikowane |
| 2026-07-21 | opencode | `ruryOrders.ts` (redukcja do wrappera)    | Backend split | Zweryfikowane |
| 2026-07-21 | opencode | `studnieOrders.crud.ts` (nowy)           | Backend split | Zweryfikowane |
| 2026-07-21 | opencode | `studnieOrders.export.ts` (nowy)         | Backend split | Zweryfikowane |
| 2026-07-21 | opencode | `studnieOrders.ts` (redukcja do wrappera) | Backend split | Zweryfikowane |

### 4.3 Fix powdrożeniowy: brakujące script tagi

| Data       | Autor    | Pliki                                    | Typ              | Status        |
| ---------- | -------- | ---------------------------------------- | ---------------- | ------------- |
| 2026-07-21 | opencode | `studnie.html` (14 brakujących script tagów) | Fix powdrożeniowy | Zweryfikowane |

### 4.4 Fix powdrożeniowy: testy regresyjne

| Data       | Autor    | Pliki                                                          | Typ              | Status        |
| ---------- | -------- | -------------------------------------------------------------- | ---------------- | ------------- |
| 2026-07-21 | opencode | `tests/responsive/rury.test.ts` (partials dir)                | Fix powdrożeniowy | Zweryfikowane |
| 2026-07-21 | opencode | `tests/responsive/forms.test.ts` (partials dir)               | Fix powdrożeniowy | Zweryfikowane |
| 2026-07-21 | opencode | `tests/printDispatch.test.ts` (pvSalesActions.js redirect)    | Fix powdrożeniowy | Zweryfikowane |
| 2026-07-21 | opencode | `tests/security-regression.test.ts` (crud.ts redirect)        | Fix powdrożeniowy | Zweryfikowane |

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
| 0 — Przygotowanie        |         0 |      0 |             6 |        0 |      6 |
| 1 — CSS + Backend        |         0 |      0 |             5 |        0 |      5 |
| 2 — Frontend JS          |         0 |      0 |            23 |        0 |     23 |
| 3 — HTML partiale        |         0 |      0 |            19 |        0 |     19 |
| 4 — CSS studnie + Routes |         0 |      0 |            13 |        0 |     13 |
| Dokumentacja             |         0 |      0 |             2 |        0 |      2 |
| Fix powdrożeniowe        |         0 |      0 |             5 |        0 |      5 |
| **Razem**                |    **0**  |  **0** |        **73** |    **0** | **73** |

---

**Procedura aktualizacji:**

1. Po każdej zmianie refaktoryzacyjnej: znajdź odpowiedni wiersz, zmień status na `Zweryfikowane`, wpisz datę i autora.
2. Jeśli zmiana okazała się błędna: zmień status na `Wycofane`, dodaj komentarz w nowym wierszu.
3. Na koniec dnia: zaktualizuj tabelę podsumowującą.
