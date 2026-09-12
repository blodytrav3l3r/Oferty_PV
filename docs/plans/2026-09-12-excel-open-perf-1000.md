# Plan: przyśpieszenie Excela studni przy 1000+ (open + polling + cache)

Data: 2026-09-12
Status: F1 dowieziona, gates F1a zielone (`2026-09-12-excel-gates-f1a.md`).
Decyzja o F2: osobna, po tym dokumencie.
Dotyczy: `public/js/studnie/excelModal.js`, `excelPolling.js`, `excelTableBody.js`,
`excelTableRenderer.js`, `excelHelpers.js`, `excelColumns.js`, `excelState.js`,
`excelTabs.js`, `excelVirtual.js`, `tests/playwright/excelPerfFixture.cjs`,
`tests/studnie/excelPerfFixture.test.ts`

## Kontekst i diagnoza

Przy włączonej wirtualizacji (`excelVirtual.js`, default ON, slice ~65 wierszy)
wąskim gardłem dla 1000+ studni nie jest DOM slice, tylko koszty `O(N)`:

1. Open modala (`openExcelTableModal`, `excelModal.js:166-440`): `structuredClone(wells)`
    - pętla clean/gaskets/legacy-expand po wszystkich studniach + `_excelMaxTransitions`
      dla 6 tabów (6× filter) + `refreshAllWellErrors()` dla wszystkich przed pierwszym
      renderem.
2. Render: dup-detect `wells.forEach` per render (`excelTableBody.js:53-83`); header
   `studnieProducts.find` per kolumna + podwójny `_excelUpdateHeaderProdCodes`
   (`excelTableRenderer.js:178,318`, `excelTabs.js:44`).
3. Polling co 500 ms (`excelPolling.js:14-33`): snapshot-string `O(N)` +
   `getElementById` ×2 per studnia w `_excelSyncAutoManualUI` + pełny
   `_excelRefreshDupColors` z `querySelector` per wiersz.
4. Per wiersz w slice: filter przejść/właza per wiersz (`excelTableBody.js:303-427`);
   sticky `while(prev)` + colWidths `cols×rows` + `lucide.createIcons` per slice
   (`excelTableRenderer.js:331-426`).

## Twarde zasady (wszystkie fazy)

- Zero regresji wizualnej/funkcjonalnej: memo/cache/hoist/lazy dają bit-identyczny
  HTML i identyczne stany (`data-*`, klasy, selekcja, fokus, PZ-lock, sort, filtr).
- Każda faza osobny commit z kill-switchem i jednokomendowym revert.
- Zakaz: zmiana kolejności tabów/kolumn, treści tooltipów/błędów, timingów UX,
  skrótów, API, usuwanie branchy funkcyjnych.
- Sufit oceny: plan 9,5/10; 10/10 dopiero po zielonej F0+F1 na datasecie 1000+.

## Faza 0 — Measurement + Golden + Contract (zero zmian logiki prod)

- Fixture: `tests/playwright/excelPerfFixture.cjs` — 1200 studni, seed
  deterministyczny (mulberry32), kontrolowany rozkład: DN×6, magazyny KLB/Włoc,
  config pełny/minimalny, przejścia 0..maxTr, włazy, duplikaty nazw,
  ERROR/WARNING/OK, PZ-lock, mieszane `configStatus`. Ten sam fixture = ta sama
  praca = porównywalny benchmark.
- Test: `tests/studnie/excelPerfFixture.test.ts` — waliduje rozkład i
  determinizm fixture (czyste dane, bez DOM, <1 s).
- Instrumentacja: stage `open-*` w istniejącej infrze `?perf=1`
  (`excelVirtual.js:28-118`, raport `__excelPerfReport()`): `open-clone`,
  `open-prep` (clean/gaskets/expand), `open-maxtr`, `open-errors`, `open-tabs`,
  `open-render`, `open-total`. Zero overhead bez flagi (jeden boolean check).
- Golden: DOM golden (canonicalized HTML + hash: `data-*`, klasy, kolejność,
  selected/disabled/aria/colspan; normalizacja ID/timestampów — nie surowy hash)
    - layout golden (screenshot 375/768/1024/1440, stały browser/zoom/fonty,
      comparator z progiem, bez caret/focus-anim).
- Performance contract (targety z baseline+UX, nie magiczne liczby):

| Metryka            |             Baseline F0 (mediana) | F1 target |     F2 target |
| ------------------ | --------------------------------: | --------: | ------------: |
| open 1200          |         763 wall / 548 open-total |    ≤ ×0,5 |             — |
| switch tab         |       1031–1461 (real ≈ 700–1150) |       ≤ X |        ≤ ×0,7 |
| scroll slice       |     418 total (sticky 268 z tego) |       ≤ X |        ≤ ×0,8 |
| keystroke (rzędna) |  2229 (real ≈ 1000, panel główny) | brak regr | brak regresji |
| polling tick       | snap 0,3 + sync 35–57 ms / 500 ms |     ~O(1) |         ~O(1) |

- Pełne liczby: `docs/plans/baseline-excel-open-1200.json` (F0/F1 wczesne,
  RUNS=3, historyczny) oraz `docs/plans/baseline-excel-open-1200-f1.json`
  (F1a: 5 cold + 5 warm, osobne protokoły). Headless 1600×1000, fixture 1200
  seed 20260912; `tabMs`/`editMs` zawierają wait 300/1200 ms; `openMs` =
  start `openExcelTableModal()` → pierwsze wiersze > 0 (polling 200 ms to
  detekcja, błąd do ~200 ms; miarodajny `open-total`).
- DOM-golden: `docs/plans/golden-excel-dom-1200.json` (SHA-256 per tab ×6).
  Visual golden: `tests/playwright/screenshots/excel-gate/` (6 PNG).
- Wynik F0 (12.09.2026): render dominuje open (`open-render` 444 z 548); w
  renderze `sticky` 264 ms (≈60%) > `innerHTML` 74 > `tbody` 49 >
  `open-errors` 43 ≈ `open-prep` 41; `lucide` 7, `clone` 7, `maxtr` 1.
  Wniosek: fix sticky (`cellIndex` zamiast `while(prev)`, ten sam output)
  awansuje z deferred do F2; reszta ex-F3 (`<colgroup>`, sprite ikon)
  zostaje deferred.
- Gate F0: ZALICZONY (liczby + golden-test fixture). Reżim: ta sama
  przeglądarka/profil, mediana 3 przebiegów.

## F1.0 — audyt readers + writers (bramka wejścia F1, read-only)

- Writers `wells[]`: add/delete/rename/paste/fill/undo/import/load/switch-tab/
  config/status + główny panel. Wynik: pełna lista miejsc wymagających
  invalidacji.
- Readers lazy-state (`configStatus`/gaskets/`config`/legacy/errors) × konsumenci
  (diagram/export/preview/offer-panel/order/validation/autosave/AI).
  Invariant: po open żaden konsument nie widzi stanu sprzed materializacji.
- Decyzja po audycie: centralny `invalidate*()` (wzorzec
  `_excelInvalidateFilteredIndexes`) vs wersja danych `wellsRevision`
  (`cache.revision === wellsRevision`).

## F1 — wynik (12.09.2026, ZALICZONY częściowo)

Dostarczone (ten sam stan końcowy, zero zmian wizualnych):

1. `EXCEL_OVERSCAN` 15→10 (`excelVirtual.js`) — slice 58→48 wierszy; overscan
   jest z definicji niewidzialny. Kill-switch `?virtual=0` bez zmian.
2. Polling 500→1000 ms + skip `document.hidden` (`excelPolling.js`) —
   steady-state to sam snapshot (~0,3 ms).
3. Instrumentacja `open-*` w `?perf=1` (z F0, zostaje na stałe).

Odrzucone po pomiarze (bankrutująca atrybucja, revert w tej samej sesji):

- dup-cache: skan 1200 nazw to ~2 ms — brak zysku, wycofany.
- sticky `cellIndex` + cache offsetów: probe wykazał ciepły sticky 1,7 ms;
  264 ms to zimny layout tabeli, nie pętla — wycofany.
- syncUI visible-only: 35 ms to `_excelIsWellLocked`×N, nie DOM — wycofany.
- lazy open (snapshot/prep/errors per tab): ~90 ms zysku przy najwyższym
  ryzyku (czytelnicy globalni: `updateSummary`, diagram, eksport) —
  przeniesiony do F2 z audytem F1.0 jako bramką.

Pomiar po F1 (ten sam fixture, mediana 3):

| Metryka      |                                                                                                    F0 |    F1 | Cel F1   |
| ------------ | ----------------------------------------------------------------------------------------------------: | ----: | -------- |
| open wall    |                                                                                                   763 |   659 | ≤ ×0,5 ✗ |
| open-total   |                                                                                                   548 |   454 | ≤ ×0,5 ✗ |
| scroll total |                                                                                                   418 |   321 | ≤ ×0,8 ✓ |
| switch tab   |                                                                     wszystkie lepsze (1500: 1381→916) | ≤ X ✓ |
| keystroke    | ~1000 real, bez zmian — koszt panelu głównego (`updateSummary` + diagram + pełna lista), poza Excelem |
| polling tick |                                                                               0,3 snapshot, bez zmian |

- Gate: `tests/studnie` 87/1267 PASS, `typecheck:frontend` + `lint:frontend`
  0 errors, `test:parity` PARITY OK, `encoding:check` OK. `test:alignment`
  nieuruchomialny w tym środowisku (pre-existing: twarda ścieżka
  chromium-1228 w teście, zainstalowany 1234) — do powtórki na zielonym runnerze.

## F2 — hoist + memo czystych funkcji (te same zwrotki)

4. Opcje przejść/właza memo per `DN+magazyn+visibleTypes+refWellParams` —
   identyczne `<option>` i selected.
5. Header `ProdCode/Price` memo per `well.id+configVersion`; usunięcie 2.
   wywołania w `excelSwitchTab` (nadpisywało tym samym).
6. `ColsCacheKey` przez wersję cennika zamiast `map+sort+join` id.
7. Per-tab lazy `open-prep` (41 ms) + `open-errors` (43 ms) — TYLKO po zielonym
   audycie F1.0 (czytelnicy: `updateSummary`, diagram, eksport, offer-panel,
   order, validation, autosave, AI). Bez audytu NIE implementować.
8. `editMs` (~1000 ms real): pełny `renderWellsList` + `updateSummary` +
   `renderWellDiagram` w `_excelDebouncedRefresh` — osobny temat (panel
   główny, nie Excel), poza tym planem.

- Cel F2: open-total 454 → ≤350 (hoist opcji ~15 + lazy prep/errors ~80).
  Gate: diff opcji header per kolumna = 0; testy `excelDrilledRings`, relief
  pair, `validate`; STOP-CONTROL → cel z contractu? KONIEC : osobny RFC.

## Poza scope (deferred)

Ex-F3 (`<colgroup>` zamiast `style.width` per komórka, sprite ikon) —
wykreślone z planu: większa powierzchnia zmian, mniejsza pewność zysku
(`innerHTML` 74, `lucide` 7 ms). Wracają tylko osobnym RFC, gdy benchmark po
F2 pokaże konkretny bottleneck DOM.

## Weryfikacja przekrojowa

`npm run typecheck`, `typecheck:frontend`, `lint:frontend`, `encoding:check`,
`test:quick`, `test:alignment`, `test:axe`, E2E excel — po każdej fazie +
raport perf przed/po na tym samym fixture.
