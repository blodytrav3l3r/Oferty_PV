# Plan F1a — domknięcie gates F1 (visual + DOM-golden + statystyka)

Data: 2026-09-12
Status: WYKONANY 12.09.2026 (FINAL GATE zielony, STOP-CONTROL)
Poprzednik: `docs/plans/2026-09-12-excel-open-perf-1000.md` (F1 dowieziona częściowo)
Decyzje: zakres gates-first (bez F2), gate wizualny PNG-golden
Zasady: zero zmian logiki `public/` i `src/`; kroki sekwencyjnie 1→5, każdy
weryfikowany przed następnym; bez commita (osobna decyzja).

## Kontekst

F1 (overscan 15→10, polling 1000 ms + hidden-skip) poprawiła scroll −23% i open
−14%, ale bramka wizualna z planu nie została spełniona: `test:alignment`
nieuruchomialny w tym środowisku (twarda ścieżka chromium-1228 w teście,
zainstalowany 1234), DOM-golden i screenshoty modala nie powstały. Ten plan
domyka dowody bez dotykania kodu produkcyjnego. Szacunek: 2–3 h.

## Krok 1. Fix runnera alignment (test-only, 1 linia)

- `tests/playwright/excelEmptyRowAlignment.cjs:49`: fallback
  `chromium_headless_shell-1228` → `chromium_headless_shell-1234`
  (bench i parity już używają 1234 — ujednolicenie).
- Świadomie BEZ refaktoru runnera (wspólny resolver ścieżki byłby lepszy
  niż hardcoded wersja, ale to rozszerzenie zakresu — odłożone poza F1a).
- Weryfikacja: `npm run test:alignment` PASS.
- Gate: FAIL z innego powodu niż ścieżka → STOP, raport, brak dalszych kroków.

## Krok 2. Visual gate modala — `tests/playwright/excelVisualGate.cjs` (nowy)

- Reużywa `excelPerfFixture.cjs` (determinizm) i flow logowania z
  `excelOpenPerf.cjs`.
- Scenariusz per viewport (1600×1000, 390×844): wstrzyknij fixture →
  `openExcelTableModal()` → czekaj na wiersze → screenshot
  `#excel-table-overlay` → scroll na dół → screenshot (pusty wiersz) →
  zakładka `styczne` → screenshot.
- Tryby: `--update` zapisuje referencje do
  `tests/playwright/screenshots/excel-gate/` (commitowane PNG, ~6 plików);
  domyślnie porównuje z progiem tolerancji antyaliasingu (np. maxDiffPixels
  100, wzorzec `appNameConsistency.cjs`) i FAIL przy różnicy.
- Referencje generowane z bieżącego kodu (post-F1) — gate chroni F2+, nie
  cofa F1.
- Anty-flaky: `prefers-reduced-motion`, stały viewport, czekanie na
  `document.fonts.ready`, screenshot bez fokusa w inpucie (caret).
- Elementy dynamiczne (czas, losowe ID, spinnery, scrollbary zależne od
  środowiska): jawnie zidentyfikowane przed pierwszym `--update`; maska
  minimalna i uzasadniona w komentarzu skryptu — nigdy automatyczne maskowanie
  dużych obszarów.
- Weryfikacja: 2× `--update` pod rząd daje diff 0 (najpierw determinizm, potem
  golden, potem golden chroni zmiany).

## Krok 3. DOM-golden — `tests/playwright/excelDomGolden.cjs` (nowy)

- Zakres jawnie: golden KONTRAKTU virtualizowanego widoku, nie 1200 rekordów
  (DOM = view only). Obejmuje: `thead`, aktualnie renderowany `tbody`,
  kolejność kolumn, `data-widx`, klasy/atrybuty istotne dla layoutu, strukturę
  komórek. Z definicji wykrywa m.in. zmianę liczby renderowanych wierszy,
  utratę `data-widx`, zmianę struktury komórki lub kolejności kolumn.
- W przeglądarce: canonicalizacja jw. → SHA-256 per tab ×6 → zapis
  `docs/plans/golden-excel-dom-1200.json`.
- Tryb compare (domyślny): FAIL przy zmianie hasha.
- Dodatkowy test strukturalny (bez osobnych goldenów): scroll top → middle →
  bottom, po każdym canonicalizowany DOM spełnia kontrakt (liczba wierszy
  w slice, `data-widx` monotoniczne, pusty wiersz na dole) — chroni mechanizm
  virtualizacji przed regresją przy F2.
- Test czułości na IZOLOWANEJ kopii fixture (kolejność: determinizm →
  sensitivity → restore fixture → real compare), żeby nie zanieczyścić
  bazowego fixture. Dowód, że golden nie jest fałszywie zielony.
- Twardy invariant `--update`: to autoryzacja nowego expected state, NIE
  sposób naprawy FAIL-a. Przebieg: FAIL → diagnoza → zmiana oczekiwana?
  NIE → STOP; TAK → `--update` → review PNG/DOM diff → PASS.
- Weryfikacja: 2 przebiegi = identyczne hashe; mutacja nazwy zmienia hash;
  review JSON.

## Krok 4. Statystyka bencha — modyfikacja `excelOpenPerf.cjs`

- 5 prób zimnych + 5 prób ciepłych jako DWA OSOBNE protokoły (nie mieszać):
  zimny = świeży kontekst per próba (start strony, fixture, pierwszy modal,
  cache miss); ciepły = istniejący runtime, close+reopen modala w tej samej
  stronie. Raport: mediana zimna / mediana ciepła osobno.
- Definicja `openMs` (jednoznaczna): czas od rozpoczęcia
  `openExcelTableModal()` do pierwszego spełnienia warunku gotowości
  (wiersze > 0); polling obserwacyjny co 200 ms jest mechanizmem detekcji,
  nie częścią metryki (systematyczny błąd do ~200 ms); miarodajny dla
  porównań jest `open-total` ze stage'y `?perf=1`.
- Wynik do NOWEGO pliku `baseline-excel-open-1200-f1.json` (baseline dla
  dalszych zmian od F1). Plik F0 i jego liczby w tabeli planu open-perf
  zostają NIENARUSZONYM historycznym baseline'em — nie przepisywać historii
  pod nową metodologię.
- Bez zmian metryk (te same stage'e).

## Krok 5. Porządek w dokach + FINAL F1a GATE

- `2026-09-12-excel-open-perf-1000.md`: status nagłówka `Faza 0` → `F1
dowieziona, gates F1a (ten plan) w toku`; dopisać definicję `openMs` z
  kroku 4; odhaczyć DOM-golden po kroku 3.
- FINAL F1a GATE (zbiorczy, nie sam format): `test:alignment` + visual gate
    - DOM-golden + bench 5+5 + `typecheck:frontend` + `lint:frontend` +
      `tests/studnie` + `prettier --check` + `version:check`. Wszystko zielone →
      STOP-CONTROL i osobna decyzja o F2.

## Jawne nie-cele

Bez poprawek logiki Excela, bez ruszania `screenshotsBaseline.cjs`, bez
F2, bez commita. Po zielonym F1a: STOP-CONTROL i osobna decyzja o F2.

## Wynik wykonania (12.09.2026)

- Krok 1: runner 1228→1234 + test virtual-aware (sticky 1:1, colspan span).
  Przy okazji wykryty i naprawiony realny latent bug: virtual liczył `colspan`
  pustego wiersza z wiersza h3 (43) zamiast kanonicznego h1 (46) — pusty
  wiersz był o 3 kolumny za krótki (`excelVirtual.js`, ta sama zasada co
  `_excelApplyColWidths`). `test:alignment` PASS 6/6 tabów. Odstępstwo od
  planu: 1-linijkowy fix prod (`thead tr` → `thead tr:nth-child(2)`),
  uzasadniony pomiarem (probe: 46 vs 8, potem span 39).
- Krok 2: `excelVisualGate.cjs`, 6 PNG w `tests/playwright/screenshots/
excel-gate/`, 2× compare 0px na wszystkich ujęciach. Dynamiczne elementy:
  brak (udokumentowane w nagłówku skryptu, maska niepotrzebna).
- Krok 3: `excelDomGolden.cjs` → `docs/plans/golden-excel-dom-1200.json`
  (SHA-256 per tab ×6); 2× identyczne hashe; sensitivity na izolowanej kopii
  PASS; scroll-kontrakt top/middle/bottom OK (48 wierszy, monotoniczne
  `data-logical-row`, pusty wiersz na dole).
- Krok 4: `baseline-excel-open-1200-f1.json` — cold mediana openMs 730
  (próby 644/730/1301/694/788; COLD-3 outlier środowiskowy, mediana odporna),
  warm mediana 642. Plik F0 (`baseline-excel-open-1200.json`) nienaruszony.
- FINAL F1a GATE: alignment PASS, visual 2× 0px, DOM 2× identyczny +
  sensitivity, bench 5+5, `tests/studnie` 87/1267 PASS, `typecheck:frontend`
  PASS, `lint:frontend` 0 errors, `test:parity` PARITY OK, prettier +
  `version:check` + `encoding:check` zielone. Bez commita.
