# S.O.K. — Agent: frontend (Vanilla JS SPA)

> Szczegółowy przewodnik domenowy. Root: `AGENTS.md` (mapa + bramy).

## Stack

- Czysty Vanilla JS (bez frameworków SPA), serwowany wprost przez Express z `public/` (dev i prod). Kod modułów: `public/js/rury/` oraz `public/js/studnie/`.
- SPA: `app.html` to jedyny entry point. Moduły (`studnie.html`, `rury.html`) ładowane jako iframe wewnątrz `app.html`.
- `tsc` nie kompiluje `public/`; frontend sprawdzają ESLint (osobne reguły w `eslint.config.mjs`), `npm run typecheck:frontend` i `npm run lint:frontend`. Składnię weryfikuj też ręcznie: `node -c <plik>`.
- Globalne helpery rejestruj jawnie na `window` (np. na końcu pliku: `window.myHelper = myHelper;`).
- Po dynamicznym wstrzyknięciu HTML z ikonami Lucide (`data-lucide`) wołaj: `lucide.createIcons({root: container})`.
- Cache-busting: parametrów `?v=` w HTML (w tym `public/templates/*.html`) **nie edytuj ręcznie** — synchronizuje je release (`scripts/auto-cache-bust.mjs`).

## Legacy surface (nie powiększaj)

- ~245 plików `public/js` (studnie ~150), ~1434 zapisy `window.*`, ~290 `onclick`, iframe + `defer-order` + partiale = wysokie coupling.
- Zasada: **NEW `window.*` = 0, NEW `onclick` = 0, NEW inline styles = 0.** Stary kod zostaje; nowy kod to ESM + `addEventListener` + jawne importy/eksporty.
- Excel (`excel*.js`) to protected zone: one problem → one diff → targeted tests → E2E → weryfikacja manualna. Bez "cleanup Excel".

## UI/UX (Design System SSoT) — obowiązkowe przy każdej zmianie UI

Jedyne źródło prawdy: `docs/UI_GUIDELINES.md`. Kluczowe reguły:

- **Tokeny**: kolory, fonty, rozmiary, radius, cienie, z-index wyłącznie przez `var(--*)` z `public/css/style.base.css` `:root`. **Zakaz gołych hexów poza `:root`**.
- **Z-index**: kanon to `LAYERS`/`LAYERS_EXCEL` w `public/js/studnie/layers.js`. Popupy/modale w JS używają `LAYERS.*` (nigdy twardych liczb); klasy CSS używają istniejących `--z-*`.
- **Modale**: wyłącznie przez `public/js/shared/modalCore.js` (klasy `.modal-overlay`/`.modal`). **Zakaz** modalów inline-styled w JS.
- **Ikony**: wyłącznie Lucide (`<i data-lucide="...">`). **Zakaz emoji jako ikon.**
- **XSS**: `escapeHtml(str)` przy interpolacji do `innerHTML`; atrybuty (`title`, `aria-label`) przez `escapeHtmlAttr`/`escapeJsStr` (błędy #3/#24/#39).
- **Klasy wspólne**: nie twórz klas per moduł dla rzeczy wspólnych (nagłówek, logo, przyciski, formularze, tabele) — używaj klas z `style.base.css`/`style.utilities.css`. Warianty przez modyfikatory `--<moduł>`.
- **Zakaz inline style**, gdy istnieje klasa/utility.
- **A11y**: widoczne `:focus-visible`, `aria-label` na przyciskach ikonowych, kolor nie jedynym wskaźnikiem statusu, `prefers-reduced-motion`, kontrast ≥ 4.5:1.
- **Responsywność**: breakpointy 1400/1200/1100/900/768/600/480 (lokalne odchylenia 860/720/700/640 — nie ujednolicaj bez screenshotów przed/po); brak poziomego scrolla w 375/768/1024/1440.

## Nagłówek, logo, SPA

- Nagłówek: wspólne klasy `.header-user-info`, `.header-username`, `.header-role-badge`, `.header-version`, `.header-logout`. Dane użytkownika renderuje **wyłącznie** `public/js/shared/headerUser.js` (`window.headerUser.render(user)`). Nie duplikuj, nie twórz klas nagłówka per strona.
- Logo: `public/images/logo-sok.svg` przez `<img class="logo-sok" ...>`; nazwę modułu w SPA ustawia `public/js/spa/router.js`.
- Każdy moduł HTML ma redirect do `app.html#/<moduł>` przy bezpośrednim otwarciu. Stopki (`<footer>`) w modułach nie ma — wersja tylko w toolbarze `app.html`.

## Logika domenowa frontend

### Rury

- Sortowanie SSoT: `getSortedRuryItems(items)` w `public/js/rury/productHelpers.js:73` → `{ grouped, sortedCategories, flat }`. Nie duplikuj logiki.
- Kolejność kategorii: `Rury Betonowe` → `Żelbetowe KL.A` → `Żelbetowe KL.S` → `Duże Żelbetowe II` → `Rury Jajowe Betonowe` → `Rury Jajowe Żelbetowe` → `Akcesoria PEHD` → `Uszczelki` → `Zabezpieczenie transportu`. Średnice numerycznie (fallback: `productId.split('-')[4]` × 100). Bosy-Bosy pierwsze, potem `lengthM` rosnąco.
- Krok 5: `updateRuryOrderSummary` kopiuje `#offer-items-body` → `#order-items-body`; edycja tylko w `orderEditMode`. Kolumny przez `buildRuryColgroup(extraCols)`. Lp/Nazwa LEFT, liczby RIGHT (`.rury-col-num`, tabular-nums).
- Przyciski PEHD tylko klasą `.pehd-btn` (bez inline). Akcje PEHD + usuwanie zawsze aktywne. Spinnery `input[type=number]` ukryte w CSS.
- Nowe itemy: `item.uid = 'rur_' + Date.now() + '_' + Math.random()...`.

### Studnie

- Sortowanie oferty wyłącznie po DN numerycznie; "styczna" na koniec (`Infinity`). Brak grupowania kategoriami.
- Tryb zamówienia: flaga `orderEditMode` + `originalSnapshot`; kolumny porównawcze ("Cena z oferty", "Różnica").
- Błędy konfiguracji (`well.configStatus` ERROR/WARNING): tła `.well-row-error`/`.well-row-warning` + ikona z tooltipem w kolumnie "Błąd" (`getWellErrorCell()` w `offerHelpers.js`). Przeliczane przez `refreshAllWellErrors()` na każdym renderze (też `wellUI.js`). Treść `configErrors` zawsze przez `escapeHtml`.
- Layout: trójkolumnowy grid (diagram | konfigurator | lista) z `clamp()` + `minmax(0, 1fr)`.
- Fokus po dodaniu przejścia: pole RZĘDNEJ (`inl-rzedna-*`), nie kąt — nie zmieniaj (feature `14907d3`/`7589ca5`).
- Blokada PZ: usuwanie oferty/zamówienia/elementu z PZ (`production_orders_rel`, `draft`/`accepted`) blokuje backend 403 (`src/utils/productionOrderGuard.ts`) + pre-checki `public/js/studnie/pzGuard.js` (`hasPzForOffer`, `hasPzForOrder`, `hasPzForWell`, `hasPzForElementAtOrAfter`). Popup po polsku, `showToast` z `<i data-lucide="x-circle"></i>`. Rury nie mają PZ.

### Excel studni (reguły nienaruszalne)

- `data-widx` to jedyne źródło tożsamości wiersza (`tr.children[indexOf(td)]`, `wIdx` z `data-widx`).
- Indeksy zależne od układu (`_excelLastDataCol`, `_excelLastClickedCell/Col`, `colIdx` w selekcjach) resetuj przy każdej zmianie struktury (DN, kolumny, dodanie/usunięcie kolumny przejścia, zamknięcie modala) — centralnie `_excelResetLayoutDependentState()` (excelState.js).
- Nawigacja/kopiowanie/wklejanie pomijają wiersze ukryte filtrem (`_excelGetVisibleRows()` w `excelCopyPaste.js`).
- Nawigacja pomija checkbox wyboru (`input:not(.excel-row-select)`), obejmuje checkbox "Psia buda".
- `_excelMarkDirty()` tylko w warstwie modala (nigdy w solverze `autoSelectComponents`).
- Zamknięcie: `_excelCloseOverlay()` + guard `_excelClosing`; `excelSaveAll()` zamyka w `finally`.
- `krag`/`krag_ot`: wpisana ilość zastępuje (nie sumuje) tylko wpisany typ o danym dn+height; finalny typ ustala `enforceOtRings()`. Test: `tests/studnie/excelDrilledRings.test.ts`.
- `rzednaWlaczenia` zawsze liczba lub `null` (konwersja z przecinkiem), nigdy string (błąd #27).
- Undo: snapshot na początku każdego mutującego handlera; wklejanie jeden snapshot (`_excelPasteInProgress`); w testach vm guard `typeof ... === 'undefined' || !...` (błąd #29).
- Komórka nazwy (`colIdx === 3`) nigdy nie kasowana/kopiowana; "zaznacz wszystko" pomija kolumny strukturalne (`cIdx < 4`).
- Pełny re-render tylko dla `krag`/`krag_ot`; dla reszty `_excelMarkAsManual` + `_excelRefreshAutoCells` (błąd #21/#33).
- Restore fokusa na koniec wartości (`setSelectionRange(len, len)`), nie `select()` (błąd #33).
- Wrapper nadpisujący globalną funkcję: najpierw zapisz oryginał (błąd #30). Kolejność: `excelPolling.js` PRZED `excelTableManager.js`.
- Skróty: SSoT to `EXCEL_SHORTCUTS` w `excelShortcuts.js` (aktualizuj przy każdej zmianie).
- Szerokości kolumn: `_excelColWidths` w localStorage (klucz `tab-colId`, split na pierwszym myślniku), try/catch + walidacja; kanoniczny nagłówek to h1 z `data-excel-col`; wiersz h3 ma `colspan=4` — nie mapuj po `first-child`.
- Tła błędów: `_excelGetRowStatus(well)` (duplikat > ERROR > WARNING > aktywny > base); sticky `td:nth-child(-n+7)` przez `_excelStickyCellBg`; nie używać `.well-row-error/.well-row-warning`.
- Wyszukiwarka: `#excel-search-input` 220px + `#excel-search-clear` (widoczny przy filtrze); `excelClearSearch()`.

### Import/Eksport (Kartoteka)

- Kod: `public/js/import-export/` (toolbar `window.importExportToolbar`), flaga `feature_import_export_enabled` w `settings`, init w `kartotekaInit.js:89`, API kartoteki `window.kartotekaUI`.
- Zakaz modyfikacji rdzenia: `offerCrud.js`, `offerManager.js`, `offerItems.js`, `wizard.js`, `router.js`.
- XLSX: 12 wspólnych kolumn; `NR_STUDNI` = typ PEHD (rury) / nazwa własna (studnie).
