# Plan naprawy parzystości wklejania w Excelu wirtualnym

## Status wykonania — 2026-11-24

- Poprawiono test parity: payload `copy` pochodzi z rzeczywistego eventu, paste czeka na zakończenie operacji, hashe kanonikalizują kolejność kluczy, a scenariusz używa edytowalnej kolumny rzędnej.
- Paste w dużej tabeli zapisuje jeden bounded row patch. Snapshoty są wymagane przed mutacją; jeśli limit/budżet nie pozwala zapisać undo, paste zostaje anulowane bez zmiany danych.
- Undo/redo obejmuje także kolumnę wklejaną po przewinięciu wirtualnego widoku, tablicę przejść rozszerzaną dla całej zakładki i globalne `_excelMaxTransitions`.
- **FACT — weryfikacja końcowa:** parity ON/OFF na 600 rekordach przechodzi; obejmuje payload, paste, undo/redo, przewiniętą selekcję kolumny i rozszerzenie przejść. Wynikowy artefakt `docs/plans/parity-excel-virtual-600.json` jest przywracany po teście.
- **FACT — kontrole po poprawce:** 37/37 celowanych testów Excela, version check, backend/frontend typecheck, frontend lint i frontend dependency guard przechodzą. `npm run licenses:check` także przechodzi.
- **FACT — kontrole niezamknięte:** pełne `npm run validate` nie zwróciło wyniku po 35 minutach i zostało przerwane. Ponowne lokalne `test:alignment` nie mogło połączyć się z wymaganym serwerem E2E `localhost:3199`; wcześniej w tej sesji test przeszedł na skonfigurowanym serwerze. Do potwierdzenia w świeżym CI.
- **FACT — pozostała bramka:** lokalne `npm run test:golden` zachowuje kontrakt scrolla, lecz zgłasza różne hashe dla wszystkich sześciu kart. Goldenów nie aktualizowano, ponieważ zmiana nie dotyka renderowania i lokalny test nie dostarcza porównania DOM uzasadniającego regenerację.
- **FACT — konflikt dokumentacji poza zakresem poprawki:** kod Excela nadal umożliwia kopiowanie kolumny nazwy, mimo że `docs/agents/frontend.md` tego zabrania. Nowy test parity przenosi copy/paste na rzędną i nie zmienia zachowania nazwy bez osobnej decyzji.

## Cel główny

Wklejanie i cofanie zmian w Excelu studni ma prowadzić do tego samego poprawnego stanu danych przy wirtualizacji włączonej i wyłączonej, a CI ma wykrywać rzeczywiste różnice bez losowych awarii harnessu.

## Stan i dowody

- **FACT — bieżący commit:** `12c4fc93a407313656c46332e67f27f8b165a57a` zmienia pliki Kartoteki ofert; nie zmienia plików Excela.
- **FACT — bieżące CI:** job `Excel — parity + golden + align` w [runie 45362355187](https://github.com/blodytrav3l3r/Oferty_PV/actions/runs/45362355187/job/138349801540) zatrzymał się na `npm run test:parity`. Asercje `paste: wells hash identyczny` i `paste+undo: ten sam stan` zawiodły. Nazwy VP-001..VP-004 były takie same, ale hash danych wynosił OFF `1710867758`, ON `2186206542`; po undo oba tryby zachowały swoje różne hashe.
- **FACT — poprzedni run:** job Excela z [runu 45284958062](https://github.com/blodytrav3l3r/Oferty_PV/actions/runs/45284958062/job/138093457685) również był czerwony, lecz z innymi objawami: pusty render OFF, `null` po scrollu ON i błąd odczytu `count`. Nie jest to dowód na tę samą przyczynę.
- **FACT — harness:** `tests/playwright/excelVirtualParity.cjs` wcześniej podstawiał `copyText = 'via-paste'`, więc nie weryfikował payloadu schowka. Hash porównywał surową kolejność kluczy JSON; lokalne odtworzenie dało różne hashe surowe, ale identyczne hashe po rekurencyjnej kanonikalizacji kluczy. To potwierdza różnicę serializacji, nie różnicę modelu. Oczekiwanie stałe 1200 ms nie było warunkiem zakończenia paste.
- **FACT — ograniczenie asercji undo:** komentarz w harnessie `:649-650` zakłada pusty undo stack dla N=600. Obecne `paste+undo` sprawdza więc tylko równość stanów ON/OFF po wywołaniu undo, nie odtworzenie baseline.
- **FACT — konflikt dokumentacji:** scenariusz parity wybiera logical column 3 i oczekuje skopiowania nazw. Istniejący kod paste oraz `tests/studnie/excelVirtualOracle.test.ts` obsługują nazwy, natomiast `docs/agents/frontend.md` zabrania kopiowania/kasowania nazwy. Naprawa parity zachowuje istniejące zachowanie i nie rozstrzyga tego konfliktu wymagań.
- **FACT — ścieżka produkcyjna:** `public/js/studnie/excelCopyPaste.js` zawiera `_excelHandlePaste`, mapowanie/modelowe ustawianie komórek i batchowanie; `public/js/studnie/excelPasteSeq.js` dostarcza mapowanie filtrowanych wierszy; `public/js/studnie/excelVirtual.js` renderuje widoczny wycinek; `public/js/studnie/excelUndo.js` obsługuje cofanie.
- **HYPOTHESIS — prawdopodobny seam:** `_excelSetModelCellValue` rozgałęzia się zależnie od obecności elementu docelowego w DOM. Możliwe, że ścieżka DOM i model-only stosują różne skutki uboczne przy ustawieniu nazwy; log CI nie wskazuje, która ścieżka ani właściwość powoduje różnicę.
- **FACT — istniejący wzorzec testu:** `tests/playwright/excelHang2000.cjs:329-350` wywołuje `_excelHandlePaste` z kontrolowanym `clipboardData` i czeka na zakończenie `_excelPasteInProgress`. To może posłużyć do szybkiego testu modelu; nie zastępuje testu integracyjnego ON/OFF.
- **Ograniczenia domenowe:** `docs/agents/frontend.md:63-85` definiuje `data-widx` jako tożsamość wiersza, jeden snapshot undo dla całego paste, brak kopiowania/kasowania kolumny nazwy oraz jeden końcowy render. Excel jest protected zone: jeden problem, jeden diff, testy celowane, E2E i weryfikacja ręczna (`:19`). Błędy undo i budżetu renderowania są opisane w `docs/errors-known.md:218-221` i `:399-404`.
- **FACT — RED:** po zastąpieniu hasha surowego kanonicznym parity ON/OFF przechodzi. Nowe asercje ujawniły osobny błąd: paste na 600 rekordach nie miało undo snapshotu (hard gate pełnego snapshotu blokował go dla N>100), więc undo nie przywracało czterech zmienionych rekordów.
- **INFERENCE:** pierwotna awaria bramki parity była fałszywym alarmem kolejności kluczy, a brak undo na dużej liście jest rzeczywistą luką kontraktu i wymaga osobnej regresji.

## Hipotezy do falsyfikacji

1. **Mapowanie logicznego wiersza na `wells[]` różni się pod wirtualizacją.** Przewidywanie: field-level diff pokaże zmianę innego `wIdx` lub innego zakresu wierszy w ON niż OFF.
2. **Harness testuje kolumnę nazwy wbrew kontraktowi albo błędnie mapuje współrzędną.** Przewidywanie: porównanie `data-excel-col`/logicalColId z `colIdx` wykaże, czy selektor trafia w nazwę; prawidłowy scenariusz powinien używać dozwolonej komórki danych i osobno asertować niezmienność nazwy.
3. **Test nie kontroluje wejściowego payloadu schowka albo porównuje różne operacje.** Przewidywanie: jawny identyczny TSV w obu trybach usunie rozjazd albo ujawni błąd w realnym Ctrl+C/Ctrl+V.
4. **Asynchroniczna/batchowa finalizacja odczytywana jest przed zakończeniem lub mutuje po undo.** Przewidywanie: oczekiwanie na stan zakończenia paste zamiast timeoutu zmieni hash/diff albo wykaże późną mutację.
5. **Hash uwzględnia pochodne pola lub undo dużego zestawu pomija snapshot.** Przewidywanie: diff pokaże pola pochodne albo brak snapshotu; osobne asercje statusów oraz ograniczony snapshot dotkniętych wierszy odróżnią te przypadki.

## Faza 0 — Odkrycie dokumentacji i kontraktów

**Jak służy celowi głównemu:** ustala obowiązujące zasady Excela i dostępne testowe seam'y przed wyborem poprawki.

### Do wykonania

- Potwierdzić aktualny HEAD, zakres diffu i pełne logi obu runów CI; pobrać artefakt `excel-gates-forensics` z bieżącego runu, w szczególności `parity-excel-virtual-600.json`.
- Przeczytać przed kodem: `docs/agents/frontend.md`, `docs/agents/testing.md`, `docs/agents/evidence.md`, `docs/errors-known.md` (problemy Excela), `docs/business-logic/calculations-and-excel.md`, `docs/SYSTEM_INVARIANTS.md` (tylko stosowne inwarianty) oraz ADR-002 i ADR-014.
- Odtworzyć aktualny przepływ na źródłach: `excelVirtualParity.cjs`, `excelCopyPaste.js`, `excelPasteSeq.js`, `excelVirtual.js`, `excelUndo.js` i test `excelHang2000.cjs`.

### Dozwolone API / istniejące seam'y

- Test uruchomieniowy: `npm run test:parity` → `node tests/playwright/excelVirtualParity.cjs` (`package.json:24`).
- Testowana ścieżka: `_excelHandlePaste(e)`; modelowa mutacja: `_excelSetModelCellValue(wIdx, effLogical, val, ctx, targetElement)` (`excelCopyPaste.js`).
- Mapowanie sekwencji: `_excelSnapshotFiltered`, `_excelResolvePasteRow`, `_excelGetVisibleRows` (`excelPasteSeq.js`).
- Render wirtualny: `_excelVirtualRenderBody` (`excelVirtual.js`); undo: `_excelUndo` (`excelUndo.js`).
- Testową pracę z kontrolowanym payloadem kopiować z `tests/playwright/excelHang2000.cjs:329-350`.
- Istniejące szybkie testy modelowe: `tests/studnie/excelPasteInvariants.test.ts:302-430` (mapowanie), `:775-850` (Semantic/Sync/Batch i idempotencja), `:897-1010` (copy-paste roundtrip); oracle wirtualnego copy: `tests/studnie/excelVirtualOracle.test.ts:107-135`.

### Weryfikacja i zakazy

- Uzupełnić dowody o artefakt JSON i wskazać pierwszy różniący się `wIdx`/field; jeżeli artefakt nie jest dostępny, zapisać lukę i odtworzyć ją lokalnie.
- Nie zakładać, że indeksy z DOM są identyczne z `wIdx`; nie ufać stałej `via-paste` jako dowodowi schowka.
- Nie zmieniać jeszcze kodu produkcyjnego, goldenów ani bramek CI.

## Faza 1 — Deterministyczna reprodukcja i minimalny RED

**Jak służy celowi głównemu:** zamienia ogólny hash mismatch w szybki, powtarzalny test wskazujący konkretną niepoprawną zmianę danych.

### Do wykonania

- Rozdzielić testy na: modelowy test kontrolowanego TSV przez `_excelHandlePaste` oraz Playwright parity z kontrolowanym schowkiem i rzeczywistym Ctrl+C/Ctrl+V.
- Przed i po paste oraz undo zapisać niezależne snapshoty `wells`; wyliczyć pierwszy diff po `wIdx` i ścieżce pola. Hash zostawić jako szybki sygnał, nie jedyne wyjaśnienie.
- Porównać selektor DOM, `data-excel-col`, logicalColId i kolumnę modelu. Jeżeli scenariusz obecnie wybiera nazwę, zastąpić go legalnym paste do edytowalnej kolumny; osobną asercją ochronić nazwę przed kopiowaniem i kasowaniem.
- Każdy tryb uruchamiać z osobną, świeżą kopią tej samej fixture i identycznym clipboard payloadem. Zapisać, czy edytowalny target input istnieje w DOM, i porównać ścieżkę z targetem oraz model-only. Zastąpić stały timeout warunkiem zakończenia operacji/renderu; dodać limit czasu z czytelnym błędem.
- Zminimalizować przypadek: 4 wiersze, wskazana kolumna, konkretne dane przed/po, jeden paste i jedno undo. Potwierdzić, że test czerwienieje przed poprawką.

### Dokumentacja i wzorce

- Harness i asercje: `tests/playwright/excelVirtualParity.cjs:42-59`, `:68-158`, `:629-655`.
- Kontrolowane clipboardData i oczekiwanie zakończenia: `tests/playwright/excelHang2000.cjs:329-350`.
- Używać istniejących Playwright helpers/importów z testów Excel; nie dodawać nowego frameworka ani helperów clipboard bez potwierdzenia ich obecności w repo.

### Weryfikacja

- Nowy minimalny test na aktualnym kodzie ma odtworzyć konkretny diff i przejść identycznie w co najmniej trzech powtórzeniach.
- Wstępny baseline ON/OFF przed operacją musi być równoważny.
- Raport ma oddzielnie potwierdzić payload kopiowania, wynik paste, undo stack i stan modelu po undo.

### Zakazy

- Nie zwiększać timeoutów jako naprawy; timeout może służyć wyłącznie jako górny limit.
- Nie porównywać tylko DOM-u wirtualnego, który zawiera widoczny wycinek, ani nie usuwać z serializacji pól bez wykazania, że są pochodne.

## Faza 2 — Minimalna poprawka przyczyny

**Jak służy celowi głównemu:** naprawia dokładną rozbieżność w danych lub semantyce undo, zachowując zachowanie obu trybów.

### Do wykonania

- Na podstawie czerwonego testu wybrać jedną przyczynę i poprawić tylko odpowiedni seam: mapowanie filtrowanego/logicznnego wiersza, identyfikację kolumny albo cykl batch/finalizacji/undo.
- W modelu wirtualnym opierać tożsamość na `wIdx`/`data-widx` i zamrożonej mapie sekwencji, nigdy na indeksie elementu DOM.
- Zachować: pomijanie ukrytych wierszy, jeden snapshot dla całego paste, ochronę kolumn strukturalnych i nazwy, finalizację oraz pojedynczy render.
- Jeżeli diff wykaże wyłącznie pola pochodne, naprawić synchronizację tych pól lub jawnie zdefiniować kanoniczny stan parity i osobne asercje pól pochodnych. Nie maskować błędnej logiki przez wykluczenie danych z testu.

### Dokumentacja i wzorce

- `docs/agents/frontend.md:65-85` — invariants wierszy, copy/paste i undo.
- `docs/errors-known.md:218-221`, `:399-404` — znane zasady snapshotu i renderowania.
- `excelCopyPaste.js` / `excelPasteSeq.js` — zachować bieżące funkcje i sygnatury; nie wymyślać równoległego mapowania.

### Weryfikacja

- Test minimalny zmienia wynik RED → GREEN i potwierdza dokładnie oczekiwany stan całego dotkniętego zakresu.
- Dla obu trybów: ten sam stan przed paste i po paste. Ustalić oraz udokumentować kontrakt undo dla dużego zestawu; kryterium tej naprawy to cofnięcie jednego paste przez snapshot ograniczony do zmienionych komórek/wierszy także przy N=600, z pełnym powrotem do baseline.
- Kontrole warstwy po zmianie zgodnie z `docs/agents/testing.md`: właściwy test regresyjny, typecheck/lint frontendu; bez uruchamiania pełnego `validate` bez uzasadnienia zakresu.

### Zakazy

- Nie wyłączać wirtualizacji, nie zmieniać progu auto-ON ani nie osłabiać/skipować bramki parity.
- Nie zmieniać `wells[]`, kontraktu nazw ani semantyki paste/undo „przy okazji”; każda taka zmiana wymaga osobnej decyzji.

## Faza 3 — Wzmocnienie pokrycia regresyjnego

**Jak służy celowi głównemu:** utrwala poprawność dla reprezentatywnych przypadków, które mogłyby ponownie rozjechać model i wirtualny widok.

### Do wykonania

- Dodać właściwości do testów modelowych: wklejanie wielokomórkowe, undo jednego paste, puste i nadmiarowe komórki, niezależne obiekty fixture, zakończenie batchowania oraz brak zmian poza zakresem.
- W Playwright sprawdzić wiersze widoczne i poza bieżącym slice, wklejanie przy scrollu, filtrowanie i sortowanie, a także granicę poniżej/progu/powyżej wirtualizacji (w tym obecne 600 wierszy).
- Upewnić się, że copy/paste porównuje rzeczywisty payload, współrzędne logiczne, zmienione rekordy i undo; nie polegać na samym hash.

### Dokumentacja i wzorce

- `tests/playwright/excelVirtualParity.cjs` — istniejąca macierz parity z wartościami wirtualizacji OFF/ON.
- `tests/playwright/excelHang2000.cjs` — kontrolowany szybki test paste.
- `docs/agents/testing.md` — testy właściwości domenowych i regresja RED/GREEN w tym samym commicie.

### Weryfikacja

- Powtórzyć test minimalny trzykrotnie.
- Potwierdzić deterministyczny wynik przy tych samych fixture/payloadach i wykrywanie pomyłki `wIdx`.
- Zachować odrębne asercje dotyczące wyniku operacji i kształtu/renderu tabeli.

### Zakazy

- Nie zamieniać testu modelu w substytut testu prawdziwego UI.
- Nie aktualizować snapshotów golden automatycznie ani bez oceny diffu.

## Faza 4 — Pełna weryfikacja bramek Excela

**Jak służy celowi głównemu:** potwierdza, że fix nie naprawia paste kosztem renderowania, wyrównania ani wydajności istniejącej tabeli.

### Do wykonania

- Uruchomić `npm run test:parity`, `npm run test:golden` bez `--update`, `npm run test:alignment` oraz powiązane testy frontendowe Excel.
- W CI potwierdzić job `Excel — parity + golden + align`, pełny Jest, lint, typecheck i pozostałe obowiązkowe statusy; obejrzeć artefakt parity i golden diff.
- Wykonać ręczny smoke test w trybie wirtualnym: kopiowanie/wklejanie wielokomórkowe, undo, scroll, filtr i sort na dużej tabeli; potwierdzić brak przeskoku fokusu i widoku.
- Sprawdzić diff pod kątem zmian ograniczonych do problemu; `npm run version:check` oraz hooki przed commitem zgodnie z repo.

### Dokumentacja i wzorce

- Komendy w `package.json:23-29`; gate CI w `.github/workflows/ci.yml:406-501`.
- Bramy commita i CI: `docs/agents/testing.md`; commit tylko przez `node scripts/commit.mjs "fix(excel): …"`.

### Kryteria zakończenia

- Minimalny RED/GREEN i pełna parity OFF/ON przechodzą deterministycznie.
- Golden i alignment są zielone bez osłabienia oczekiwanych wyników.
- CI dla commita jest zielone; deploy pozostaje sterowany istniejącymi warunkami CI i wymaga osobnego GO, jeśli kontrakt autonomii go wymaga.

### Zakazy

- Nie omijać hooków, nie wyłączać wymaganych checków ani nie pushować bez osobnego GO na dokładne `origin/main`.

## Poza zakresem

Refaktor całej strefy Excel, zmiana UX kopiowania/wklejania, zmiana architektury virtual scroll, modernizacja niezwiązanych testów, podmiana bibliotek oraz korekta niepowiązanych błędów Kartoteki.
