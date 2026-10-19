# Plan optymalizacji modułu Excel (Studnie) — v3

> **Status:** ZATWIERDZONY DO WYKONANIA (poprawki luk G1–G10 naniesione). **NIE WYKONANY.**
> **Data:** 2026-10-18 · **Supersedes:** v2 (`2026-10-18-excel-optimization-plan.md`).
> **Zakres:** `public/js/studnie/*`, save/load/draft/lock, backend `wellsExport`, harnessy pomiarowe.
> **Cel:** każda kategoria ≥ 8/10 (kierunek) — finalne oceny z kryteriów akceptacji i pomiarów.
> **Zasady:** pomiar przed zmianą · jedna zmiana = jeden obszar regresji · revert-on-no-win · nie ruszać bezpieczeństwa/walidacji · precedens > nowy wzorzec (`docs/PERF_BASELINE.md:3`).

## 0. Luki v2 znalezione i załatane (G1–G10)

| ID  | Luka                                                                                                                                                                                                                      | Dowód (plik:linia)                                                                                                                                        | Łatka w planie                          |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| G1  | **Brak guardu/telemetrii rozmiaru payloadu przy zapisie OFERTY studni** → ryzyko 500 `PayloadTooLargeError` i utraty danych przy ~5000 studni (wzbogacony `wellsExport` + clone). Zamówienia mają telemetrię, oferty nie. | `offerSave.js:121-124`; `mountRoutes.ts:50,68`; precedens `orderHelpers.js:74,242`                                                                        | **F2.4** (data-safety) + guard pre-save |
| G2  | **Draft autosave cap 4 MB** → duże oferty nie mają draftu (brak recovery po crashu).                                                                                                                                      | `draftStore.js:18,146-147,310`                                                                                                                            | **F2.5** (draft dla dużych ofert)       |
| G3  | **A11y tabeli Excel znikoma** (brak `role="grid"`, `aria-rowcount/colcount`, `scope`, semantyki klawiaturowej siatki) → UX ≥8 nieosiągalne.                                                                               | `excelTableBody.js` (aria tylko na przyciskach), brak roli siatki                                                                                         | **F6.1** (a11y siatki)                  |
| G4  | **278 `catch` / 52 puste bloki `catch(...){}`** w `public/js/studnie` → ukryte błędy maskują regresje.                                                                                                                    | licznik: 52 puste bloki / 278 catch w `public/js/studnie`                                                                                                 | **F7.2** (audyt silent-fail, hot-pathy) |
| G5  | **Lock/409 przy długiej edycji dużych ofert** nieujęte (lock `tryOpen`, wygaśnięcie/half-open, konflikt wersji).                                                                                                          | `offerManager.js:88-92` (`lockService.tryOpen`), `offerSave.js:71-80`                                                                                     | **F3.2** (concurrency)                  |
| G6  | **Brak jawnej invalidacji cache recalc przy zmianie cennika/katalogu** — F1 „wersja katalogu" w fp bez triggera.                                                                                                          | `resolveStudnieProduct` w `solverValidation.js:224,260,335`; `refreshAllWellErrors` `offerRendering.js:22`; `pendingStudnieStampId` `offerManager.js:278` | **F1** (trigger + klucz katalogu)       |
| G7  | **Lista `stripWellRuntimeFields` (6 kluczy) musi objąć pole cache z F1**, inaczej cache wycieka do payloadu DB (wzrost, nie spadek).                                                                                      | `offerSave.js:11-18`                                                                                                                                      | **F1** (konieczny wpis)                 |
| G8  | **Protokół A/B `excelHang2000.cjs` wymaga DWÓCH serwerów** (:3100/:3101) — F0 planował jeden spawn (:3178).                                                                                                               | `excelHang2000.cjs:33-34`                                                                                                                                 | **F0** (dwa izolowane serwery)          |
| G9  | **Golden `--update` governance** istniał, plan go nie cytował.                                                                                                                                                            | `excelDomGolden.cjs:9-13,35,275`                                                                                                                          | **F4** (procedura)                      |
| G10 | **Brak integracji bramek perf w CI, brak rollback/flag per-faza, brak estymat**                                                                                                                                           | brak jobu perf w CI; brak flag                                                                                                                            | **F9** + §6–§8                          |

**Nowe wymiary oceny (dodane):** _Data-safety/integrity_ oraz _A11y_ — wcześniej poza scorecardem.

## 1. Diagnoza (dowody)

| Obszar         | Teza                                                     | Dowód                                                                                                    |
| -------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Skalowalność   | O(n) recalc przy open/switch, bez guardu fp              | `excelPolling.js:319-328` → `solverValidation.js:157`                                                    |
| Skalowalność   | Edycja scopowana; structural flag → O(n)                 | `excelPolling.js:126-152`                                                                                |
| Skalowalność   | fp za wąski (`productId×qty`)                            | `solverValidation.js:122`                                                                                |
| RAM            | clone wells @load / @save; `wellsExport` wzbogacony w DB | `offerManager.js:182`; `offerSave.js:103-105`; `pricingCalculator.js:60,107-190`; `StorageService.js:61` |
| RAM            | lista slim ✔; snapshot modala ≤100 ✔                     | `studnieCrud.ts:413-431`; `excelModal.js:203-209`                                                        |
| Poprawność     | recalc **mutuje** stan i zależy od katalogu              | `solverValidation.js:351,355-359`                                                                        |
| Poprawność     | źródła błędów poza recalc: solver, asortyment            | `solverAutoSelect.js:172,233`; `diagramOtRings.js:175-176`                                               |
| Data-safety    | brak guardu payloadu ofert; draft cap 4 MB               | G1, G2                                                                                                   |
| Wątek UI       | sync bursty load/save/pricing                            | `offerManager.js:183-199`; `offerSave.js:104`; `pricingCalculator.js:60`                                 |
| Obserwowalność | brak heap; marks `?perf=1`                               | brak pomiaru                                                                                             |
| Bezpieczeństwo | `xlsx` vendored 0.20.3, poza `package.json`              | `public/vendor/xlsx.full.min.js:5302`                                                                    |

**Zastrzeżenia:** heap UNVERIFIED; recalc przy realnych configach INFERENCE; rozkład dużych ofert HYPOTHESIS (dev n=15).

## 2. Fazy

### F0 — Baseline i metryki (bez zmian logiki)

1. pomiar powtarzalny → 2) N=10/500/2000 na realistycznych configach → 3) mediana/P95/longtask/heap → 4) **dopiero wtedy** SLO.

- Heap: **CDP `Runtime.getHeapUsage` + `HeapProfiler.collectGarbage`** (sesja CDP: `throttleHelper.cjs:34`); `performance.memory` cross-check. Protokół: warmup + 3× GC'd sample, mediana.
- Liczniki recalc (open/switch/edit) w `?perf=1`; fixture realnych configów.
- **G8:** spawn **dwóch** izolowanych serwerów (:3100/:3101) dla A/B, seed z `perfBaseline.cjs` (`:3178` wzorzec) — nie ruszać dev DB.
- **Akceptacja:** liczby 3× w `docs/PERF_BASELINE.md` + JSON; progi z danych.

### F1 — Inkrementalny recalc

**Pre-krok: inwentarz walidacji (bez kodu prod).**

1. Wejścia `recalculateWellErrors` (`solverValidation.js:157-359`): `config`(+`disablePehd`), `rzednaWlazu`, `rzednaDna`, `przejscia`, `psiaBuda`, **katalog/cennik** (`resolveStudnieProduct`), `_solverErrorsGen`, `configStatus`.
2. Macierz źródeł błędów: solver (`solverAutoSelect.js:172,233`), asortyment (`diagramOtRings.js:175-176`), `validateCollisionsLive`, PEHD, rzędne; semantyka mutacji (`:351`, filtr `:355-359`).
3. fp = pełny zbiór wejść **+ wersja cennika/katalogu**; cache `{fp, errors}` tylko dla wells bez błędów solverowych/asortymentowych.
4. **G6:** jawne triggery invalidacji: zmiana zakładki, edycja, structural, **reload/zmiana cennika** (`pendingStudnieStampId`), `backfillSolverStamps`.
5. **G7:** pole cache dodać do `stripWellRuntimeFields` (`offerSave.js:11-18`) — inaczej wyciek do DB.
   **Testy:** `recalculateWellErrors.test.ts` + równoważność `configErrors` + test unieważnienia (rzędna/przejście/katalog) + A/B `excelHang2000.cjs` S2.
   **Akceptacja:** recalc count i longtask flat od n; zero różnic błędów; brak wzrostu payloadu; revert jeśli brak zysku.

### F2 — Pamięć i integralność danych (ROZDZIELONE)

- **F2.0 Retencja:** zmierzyć żywe kopie wells (load/save/cache/undo) per rozmiar.
- **F2.1 Cache solvera** (`__resCache` itd.; `offerSave.js:9-25`) — niezależny.
- **F2.2 `wellsExport` ofert** (gated F2.0): audyt konsumentów `docx/studnie/index.ts:46`, `pdf/context.ts:253`, `careService.ts:353`, `followUpStats.ts:146`, `kartotekaHelpers.js:151`, `externalExportTemplate.js:26`; odczyt starych rekordów + migracja; draft/recovery; błąd zapisu/retry; regeneracja wzbogacenia przy eksporcie. **Bramka: równoważność KANONIZOWANA** DOCX/PDF.
- **F2.3 Luka >100 „Zamknij bez zapisu"** (`excelModal.js:601-610`) — item funkcjonalny.
- **F2.4 (G1) Data-safety zapisu:** guard rozmiaru payloadu przed POST + telemetria (`PAYLOAD_WARN` wzorzec `orderHelpers.js:74,242`) + jasny komunikat/toast przy przekroczeniu; ewentualnie chunk/upload sesyjny. **Test:** payload > limit → brak cichego 500.
- **F2.5 (G2) Draft dla dużych ofert:** podnieść limit / częściowy draft (np. per-well lub chunk) albo jawny komunikat „draft niedostępny" + recovery z serwera. **Test:** 2000-well → draft lub świadomy komunikat.
- **Akceptacja:** eksport kanonizowany identyczny; stare rekordy czytają się; brak cichej utraty danych.

### F3 — Wątek UI i współbieżność

- **F3.1 (profil→technika):** zmierzyć najdłuższe zadania; chunk-rAF vs Worker dopiero z dowodów.
- **F3.2 (G5) Concurrency:** zachowanie przy wygaśnięciu locka/half-open i 409 podczas długiej edycji dużych ofert (`offerManager.js:88-92`, `offerSave.js:71-80`); komunikaty, retry, brak utraty.
  **Akceptacja:** longtask-max ≤ próg @2000; brak regresji open/switch; konflikt obsłużony bez utraty danych.

### F4 — Render: najpierw koszt

Koszt: ~135 węzłów/wiersz, paint 68-wierszowego slice ≈ 68% strony (`docs/plans/bench-excel-virtual-1k5k.json`).

- O2a `contain`/`content-visibility` — warunkowo, po pomiarze.
- O2b szablon ~135→~50 węzłów (`excelTableBody.js`) — **G9:** golden `--update` wg procedury `excelDomGolden.cjs:9-13` (FAIL→diagnoza→TAK/NIE→update), recenzja diffa semantyczna.
  **Akceptacja:** zmierzony spadek paint/węzłów; revert jeśli brak.

### F5 — Architektura (składana, bez big-bangu)

- ekstrakcja recalc = granica F1; `wellsStore` SSoT = artefakt F2; osobno dead code (`excelTableManager.js:556` — zweryfikować).
- Kontrakt `let`/init (`excelState.js:3-9`) = YAGNI (tylko z triggerem).

### F6 — UX i dostępność

- **F6.1 (G3) A11y siatki:** `role="grid"`, `aria-rowcount/colcount`, `scope` na nagłówkach, nawigacja klawiaturą, focus-visible, kontrast. Bramka `excelVisualGate.cjs` + axe (jeśli dostępne) / checklista WCAG 2.1 AA dla siatki.
- **F6.2** Progres load/save, licznik „N/M", anulowalny debounce search (`excelVirtual.js:863`).

### F7 — Obserwowalność i jakość błędów

- **F7.1** Heap + recalc-count w `__excelPerfReport`; wiersze w `PERF_BASELINE.md`; opcjonalnie telemetria histogramu studni/ofertę.
- **F7.2 (G4)** Audyt silent-fail w hot-pathach (`public/js/studnie` — 52 puste bloki): klasyfikacja celowe vs maskujące; maskujące → log/kontrakt.

### F8 — Zależność XLSX

Źródło + SHA-256 + skrypt kontroli wersji/hash + proces update + testy bezpieczeństwa (opcjonalnie tarball `cdn.sheetjs.com`). Migracja npm tylko jeśli utrzymywane źródło npm ≥ 0.20.3 (publiczne `xlsx` = 0.18.5 — do potwierdzenia).

### F9 — Bramki w CI i operacje

- **G10:** job perf/regresji (golden/parity/hang2000 + nowe) w CI lub udokumentowany manualny gate z progiem.
- **Rollback per faza:** flaga wyłączenia dla F2.2 (np. read-time regeneracja `wellsExport`) i F4; procedura wycofania.

## 3. Decyzje (Q1–Q6)

| #   | Decyzja                                                                                    |
| --- | ------------------------------------------------------------------------------------------ |
| Q1  | Heap = **CDP** (`Runtime.getHeapUsage`+`collectGarbage`), `performance.memory` cross-check |
| Q2  | **Izolowany spawn** (:3178 wzorzec; A/B :3100/:3101)                                       |
| Q3  | F2.2 osobny checkpoint — **gated F2.0**                                                    |
| Q4  | F5 składane z F1/F2 + dead-code; brak big-bangu                                            |
| Q5  | XLSX **vendored + hash/source/update** (npm = regres 0.18.5)                               |
| Q6  | **Brak prod danych** — fixture/dev + flaga HYPOTHESIS                                      |

## 4. Kolejność

`F0 → F1 → F2 (0→1→2→4→5; 3 osobno) → F3 → F4 → F5 → F6 → F7 → F8 → F9`
(Rekomendacja: F2.4/F2.5 data-safety rozważyć **wcześnie** — ryzyko utraty danych > zysk perf.)

## 5. Bramki (niezmienne)

golden DOM · parity 31/31 · `excelHang2000.cjs` · równoważność **kanonizowana** (DOCX/PDF) · **brak cichej utraty danych** · revert-on-no-win · każda faza: CLAIM→EVIDENCE→VERIFY.

## 6. Rollback per faza

| Faza      | Mechanizm                                                   |
| --------- | ----------------------------------------------------------- |
| F1        | wyłączenie cache (przywrócenie O(n) recalc) jedną flagą     |
| F2.2      | read-time regeneracja `wellsExport` (stare rekordy czytane) |
| F2.4/F2.5 | wyłączenie guardu/draftu bez zmiany formatu zapisu          |
| F4        | wyłączenie O2a/O2b (flag lub revert szablonu)               |

## 7. Ryzyka

1. Niekompletny fp walidacji → inwentarz F1 + triggery (G6) + test wycieku (G7).
2. Kontrakt `wellsExport` (konsumenci server-side) → audyt + równoważność kanonizowana + rollback F2.2.
3. Łączenie zmian → jeden obszar na checkpoint.
4. Brak prod danych → HYPOTHESIS + walidacja po snapshotcie.
5. CSS/Worker bez zysku → pomiar-gate + revert.
6. Utrata danych przy dużych ofertach (G1/G2) → F2.4/F2.5 wcześnie.

## 8. Estymaty (względne; INFERENCE do potwierdzenia w F0)

| Faza      | Rozmiar | Uwaga                                       |
| --------- | ------- | ------------------------------------------- |
| F0        | M       | harness heap + 2 serwery + fixture          |
| F1        | L       | inwentarz + fp + triggery + testy           |
| F2.0      | S       | pomiar                                      |
| F2.1      | S       |                                             |
| F2.2      | L       | audyt konsumentów + migracja + ekwiwalencja |
| F2.4/F2.5 | M       | data-safety                                 |
| F3        | M       | profil + concurrency                        |
| F4        | M       | CSS/paint + golden                          |
| F5        | M       | składane                                    |
| F6        | M       | a11y + UX                                   |
| F7        | S       |                                             |
| F8        | S       | hash/update                                 |
| F9        | M       | CI + rollback                               |

## 9. Kryteria „done" (faza)

1. Pomiar przed/po (mediany 3×, P95, longtask, heap). 2. Zidentyfikowany koszt do zbicia. 3. Testy równoważności/regresji zielone. 4. Bramki globalne zielone. 5. Brak zysku → revert + wpis decyzji.
