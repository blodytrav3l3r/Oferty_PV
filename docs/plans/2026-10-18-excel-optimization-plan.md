# Plan optymalizacji modułu Excel (Studnie) — v2

> **Status:** ZATWIERDZONY DO WYKONANIA (po decyzjach Q1–Q6). **NIE WYKONANY.**
> **Data:** 2026-10-18 · **Zakres:** `public/js/studnie/*`, save/load, backend `wellsExport`, harnessy pomiarowe.
> **Cel:** każda kategoria oceny ≥ 8/10 (kierunek, nie gwarancja) — finalne oceny z kryteriów akceptacji i pomiarów.
> **Zasady nadrzędne:** pomiar przed zmianą · jedna zmiana = jeden obszar regresji · revert-on-no-win · nie ruszać bezpieczeństwa/walidacji na granicach · precedens > nowy wzorzec (zgodne z `docs/PERF_BASELINE.md:3`).

## 1. Diagnoza (dowody z kodu)

| Obszar         | Teza                                                          | Dowód (plik:linia)                                                       |
| -------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Skalowalność   | Pełny O(n) recalc przy open/switch, bez guardu na fingerprint | `excelPolling.js:319-328` → `solverValidation.js:157`                    |
| Skalowalność   | Ścieżka edycji jest scopowana; structural flag wraca do O(n)  | `excelPolling.js:126-152`                                                |
| Skalowalność   | Fingerprint istnieje, ale za wąski (`productId×qty`)          | `solverValidation.js:122`                                                |
| RAM            | Pełny clone wells przy load                                   | `offerManager.js:182`                                                    |
| RAM            | Clone wells + `wellsExport` przy save (store w DB)            | `offerSave.js:103-105`, `StorageService.js:61`                           |
| RAM            | `wellsExport` ofert jest **wzbogacony** (`_xp/_xskip/_xd`)    | `pricingCalculator.js:60,107-190`                                        |
| RAM            | Lista ofert jest slim (brak wells) — dobrze                   | `studnieCrud.ts:413-431`                                                 |
| RAM            | Snapshot modala ograniczony do ≤100 studni (nie żerca RAM)    | `excelModal.js:203-209`                                                  |
| RAM            | Budżet undo                                                   | `excelState.js:151-153`                                                  |
| Poprawność     | `recalculateWellErrors` **mutuje** stan i zależy od katalogu  | `solverValidation.js:351,355-359`                                        |
| Poprawność     | Błędy generują też: solver i asortyment (poza recalc)         | `solverAutoSelect.js:172,233`, `diagramOtRings.js:175-176`               |
| Wątek UI       | Bursty synchroniczne (load/save/pricing)                      | `offerManager.js:183-199`, `offerSave.js:104`, `pricingCalculator.js:60` |
| Obserwowalność | Brak metryki heap; marks `?perf=1` istnieją                   | brak pomiaru; `excelTabs.js`                                             |
| Bezpieczeństwo | `xlsx` vendored 0.20.3, nie w `package.json`                  | `public/vendor/xlsx.full.min.js:5302`                                    |

**Zastrzeżenia dowodowe:** brak pomiaru heap (UNVERIFIED); koszt recalc przy realnych configach = INFERENCE (fixture `excelPerfFixture.cjs:55-61` ma puste/2-elementowe configi); rozkład dużych ofert = dev n=15 (HYPOTHESIS).

## 2. Fazy

### F0 — Baseline i metryki (bez zmian logiki)

**Kolejność:** 1) powtarzalny pomiar → 2) N=10/500/2000 na realistycznych configach → 3) mediana/P95/longtask/heap → 4) **dopiero wtedy** propozycja SLO z uzasadnieniem.

- Heap: **CDP `Runtime.getHeapUsage` + `HeapProfiler.collectGarbage`** (sesja CDP już istnieje: `throttleHelper.cjs:34`); `performance.memory` = cross-check.
- Liczniki recalc (open/switch/edit) w `?perf=1`; nowy fixture realnych configów.
- Izolowany spawn: reuse `perfBaseline.cjs --spawn` (`:3178`, `data/perf-baseline.sqlite`) — nie ruszać dev DB.
- **Akceptacja:** 3× powtarzalne liczby zapisane w `docs/PERF_BASELINE.md` + JSON; progi wyprowadzone z danych.

### F1 — Inkrementalny recalc (osobna zmiana)

**Pre-krok (bez kodu produkcyjnego): inwentarz walidacji.**

1. Enumeracja wejść `recalculateWellErrors` (`solverValidation.js:157-359`): `config` (+`disablePehd`), `rzednaWlazu`, `rzednaDna`, `przejscia`, `psiaBuda`, **katalog/cennik** (`resolveStudnieProduct`), `_solverErrorsGen`, `configStatus`.
2. Macierz źródeł błędów: solver (`solverAutoSelect.js:172,233`), asortyment (`diagramOtRings.js:175-176`), `validateCollisionsLive`, PEHD, rzędne — oraz semantyka mutacji (`:351`, filtr `:355-359`).
3. Fingerprint pokrywający **pełny** zbiór wejść **+ wersję cennika/katalogu**; cache `{fp, errors}` tylko dla wells bez błędów solverowych/asortymentowych albo z jawnym źródłem.
   **Testy:** `recalculateWellErrors.test.ts` + równoważność `configErrors` na realnym fixture + test unieważnienia (rzędna/przejście/katalog) + A/B `excelHang2000.cjs` S2.
   **Akceptacja:** `switch-recalc` count i longtask **flat niezależnie od n**; zero różnic błędów; revert jeśli brak zysku.

### F2 — Pamięć (ROZDZIELONE małe kroki)

- **F2.0 Retencja najpierw:** policzyć żywe kopie wells (load/save/cache/undo) per rozmiar; udowodnić, gdzie idzie heap.
- **F2.1 Cykl życia cache solvera** (`__resCache` itd. w live wells; `offerSave.js:9-25`) — niezależny checkpoint.
- **F2.2 Projekcja `wellsExport` ofert** — osobno, po audycie: kontrakt API + odczyt **starych** rekordów + migracja; konsumenci `docx/studnie/index.ts:46`, `pdf/context.ts:253`, `careService.ts:353`, `followUpStats.ts:146`, `kartotekaHelpers.js:151`, `externalExportTemplate.js:26`; draft/recovery; błąd zapisu/retry; regeneracja wzbogacenia przy eksporcie. **Bramka: równoważność KANONIZOWANA DOCX/PDF** (nie bajt-równość).
- **F2.3 Luka >100 „Zamknij bez zapisu"** (`excelModal.js:601-610`) — item **funkcjonalny**, nie RAM; osobny ticket.
- **Akceptacja F2.2:** identyczny wynik eksportu (kanonizowany) + stare rekordy czytają się bez zmian; **trigger = zysk zmierzony w F2.0**.

### F3 — Wątek UI: profil → technika

Najpierw zmierzyć najdłuższe zadania; **dopiero potem** decyzja chunk-rAF vs Worker (Worker tylko z dowodami: przekazanie danych, brak zależności od globals, integracja wyniku).
**Akceptacja:** longtask-max ≤ próg przy 2000; brak regresji open/switch.

### F4 — Render: najpierw wskaż koszt

Koszt do zbicia: ~135 węzłów/wiersz, paint 68-wierszowego slice ≈ 68% strony (`docs/plans/bench-excel-virtual-1k5k.json`).

- O2a `contain`/`content-visibility` — **warunkowo, po pomiarze zysku**.
- O2b szablon wiersza ~135→~50 węzłów (`excelTableBody.js`) — golden `--update` za zgodą.
  **Akceptacja:** zmierzony spadek paint/węzłów; revert jeśli brak.

### F5 — Architektura: składana z F1/F2 (bez big-bangu)

- ekstrakcja recalc = naturalna granica F1;
- `wellsStore` SSoT „jedna kopia" = naturalny artefakt F2;
- osobny checkpoint: usunięcie potwierdzonego dead code (`excelTableManager.js:556` — zweryfikować).
- Przepisanie kontraktu `let`/init (`excelState.js:3-9`) = **YAGNI** (tylko z triggerem).

### F6 — UX (po stabilizacji długich operacji)

Progres load/save, licznik „N/M", anulowalny debounce search (`excelVirtual.js:863`). Bramka `excelVisualGate.cjs`.

### F7 — Obserwowalność (połączyć z F0)

Heap + recalc-count w `__excelPerfReport`; wiersze w `PERF_BASELINE.md`; opcjonalnie telemetria realnego histogramu studni/ofertę.

### F8 — Zależność XLSX

Manifest **nie** jest monitorowany przez Dependabot. Wariant: **źródło + SHA-256 + skrypt kontroli wersji/hash + proces update + testy bezpieczeństwa** (opcjonalnie tarball z `cdn.sheetjs.com`). Migracja na npm tylko jeśli istnieje utrzymywane źródło npm ≥ 0.20.3 (publiczne `xlsx` zatrzymane na 0.18.5 — do potwierdzenia w F8).

## 3. Decyzje (odpowiedzi na pytania blokujące)

| #   | Pytanie                          | Decyzja                                                          | Uzasadnienie                                                        |
| --- | -------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------- |
| Q1  | Heap/CDP vs `performance.memory` | **CDP** (`Runtime.getHeapUsage` + `HeapProfiler.collectGarbage`) | sesja CDP już istnieje (`throttleHelper.cjs:34`); dokładniej, po GC |
| Q2  | Izolowana DB/port                | **TAK**, `--spawn` (:3178, `data/perf-baseline.sqlite`)          | wzorzec `perfBaseline.cjs`; brak flake, brak wpływu na dev          |
| Q3  | F2.2 osobny checkpoint           | **TAK**, gated pomiarem F2.0                                     | wellsExport ofert jest wzbogacony — nie kopia P1-A                  |
| Q4  | F5 zakres                        | **Składany z F1/F2** + dead-code                                 | ≥8 arch. bez ryzykownego big-bangu                                  |
| Q5  | XLSX                             | **Vendored + hash/source/update**                                | npm `xlsx` = 0.18.5 < 0.20.3 (regres)                               |
| Q6  | Prod dane                        | **Brak w repo** — fixture/dev + flaga HYPOTHESIS                 | wszystkie backupy = dev (`data/backups/*`, ~1.31 GB)                |

## 4. Kolejność wdrożenia

`F0 → F1 → F2 (F2.0 → F2.1 → F2.2; F2.3 osobno) → F3–F4 (tylko z profilu) → F5–F8 (osobne checkpointy)`

## 5. Twarde bramki (niezmienne)

- golden DOM · parity 31/31 · `excelHang2000.cjs`
- równoważność **kanonizowana** (DOCX/PDF), nie bajt-równość
- revert-on-no-win
- każda faza: pomiar → zmiana → pomiar → bramka (CLAIM → EVIDENCE → VERIFY)

## 6. Ryzyka

1. Niekompletny fingerprint walidacji (zależy od katalogu + mutacja stanu) — mitigacja: inwentarz F1 przed kodem.
2. Zmiana kontraktu `wellsExport` (konsumenci server-side) — mitigacja: audyt + kanonizowana równoważność.
3. Łączenie zmian — mitigacja: jeden obszar regresji na checkpoint.
4. Brak prod danych — mitigacja: flaga HYPOTHESIS, walidacja po dostarczeniu snapshotu.
5. `content-visibility`/Worker bez zmierzonego zysku — mitigacja: pomiar-gate + revert.

## 7. Kryteria „done" (definicja zakończenia fazy)

1. Pomiar przed i po (mediany 3×, P95, longtask, heap).
2. Zidentyfikowany koszt do zbicia (nie „optymalizacja ogólna").
3. Testy równoważności/regresji zielone.
4. Bramki globalne zielone.
5. Zmierzonego zysku brak → revert + wpis decyzji.
