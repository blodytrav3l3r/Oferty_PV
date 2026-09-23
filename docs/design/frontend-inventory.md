# Frontend inventory — S.O.K. (P0 audit, 2026-09-23)

Źródło: analiza kodu + testy. Stack: Vanilla JS SPA (iframe), Express serwuje `public/`, tokeny w `public/css/style.base.css:3-289`, dark = default, light przez `html[data-theme='light']`.

## Wejściówki i routing

| Plik                      | Rola                      | Kluczowe UI                                                                                                 |
| ------------------------- | ------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `app.html`                | shell SPA + router iframe | nav-apps, section-nav, `#spa-main`, transition-layer, toolbar wersji                                        |
| `public/js/spa/router.js` | routing `#/<moduł>`       | lazy iframe, guard niezapisanych zmian, `openOfferInModule`                                                 |
| `index.html`              | pulpit + login            | formularz logowania, launch-cards, panel admina, `ai-dashboard-container`                                   |
| `rury.html`               | host modułu rur           | partiale step1-5 + offer + pricelist, wizard-nav, summary-bar, transport-modal                              |
| `studnie.html`            | host modułu studni        | layout 3-kol (diagram/konfigurator/lista), partiale step1-4 + offer + pricelist + modals, ~20 plików excel* |
| `kartoteka.html`          | kartoteka ofert           | filter-bar, tabela ofert, akcje, toolbar import-export                                                      |
| `zlecenia.html`           | zlecenia produkcyjne      | statystyki, search, filtry, wirtualna tabela `#zlecenia-table`, batch-delete, modal zlecenia                |
| `benchmark-tm.html`       | benchmark dev             | tabela T avg/TTM/TTI, `<pre>` output                                                                        |

## Partiale rur (`public/partials/rury/`)

step1-client (formularz klienta) → step2-products (siatka kategorii, filtry, karty, koszyk) → step3-offer-summary (`#offer-items-body`, 13 kol, rabaty, PEHD) → step4-build-card (adres/transport/płatność) → step5-order (`#order-items-body`, tryb edycji, porównanie cen) + offer (9-11 kol, eksporty, modale druku) + pricelist (edycja komórek, import XLSX).

## Partiale studni (`public/partials/studnie/`)

step1-client → step2-parameters (kafelki DN, edytor przejść/wlazów, lista studni) → step3-offer (diagram SVG, solver, dobór elementów) → step4-build-card → offer (sort DN, kolumna błędów `.well-row-error/warning`) + pricelist + sidebar + modals (przejścia, redukcja, konus PEHD, styczna, notatki, global recalc).

## Excel studni (modal, `public/js/studnie/excel*.js`)

Grid komórek, zakładki DN, undo/redo (1 snapshot/handler), copy/paste/fill, skróty (Ctrl+D/R/Enter/M/S/F, Esc 2-stopniowy), wyszukiwarka, resize kolumn (localStorage), tła błędów, nawigacja strzałkami z korektą sticky. SSoT skrótów: `EXCEL_SHORTCUTS` w `excelShortcuts.js`. Tożsamość wiersza: `tr[data-widx]`.

## Szablony druku (`public/templates/`)

ofertaRury, ofertaStudnie, kartaBudowy, zlecenie, etykieta — workflow print zachowany, nie ruszany geometrią.

## JS współdzielone (`public/js/shared/`)

modalCore (jedyny wzorzec modali), toast, StorageService, draftAutosave, lockService, printModal/shareModal, dashboard, headerUser (jedyny writer nagłówka), auth.

## Theme

`:root` = dark (~150 vars). Light: blok `style.base.css:2174-2312` (~70 nadpisań) + łatki modułowe (studnie.css, printModal.css, zlecenia.css, studnie/offer.css, index.css). Kontrakt Excel: wyłącznie `--excel-*` (18 tokenów), pilnuje test `excelThemeTokens`.
