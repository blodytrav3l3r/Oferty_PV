# Plan optymalizacji Excela (Studnie) — v6 (F0 zamknięte, F1 zaprojektowane)

> **Status:** F0 ✅ ZMIERZONE · F1 gotowe do implementacji. **Supersedes:** v5.
> Cel: każda kategoria ≥ 8/10. Zasady: pomiar-gated, SSoT-reuse, revert-on-no-win.

## A. F0 — wyniki finalne (FACT, `docs/plans/baseline-excel-heap-f0.json`)

Harness `tests/playwright/excelHeapProbe.cjs` (CDP GC + `Runtime.getHeapUsage`, longtask, fixture realistyczny skalowany; warmup+3 runy, mediana; :3000 bez spawnu):

| N    | openMs | tabMs net | editMs | ltMax    | ltSum | heap@open | retained@close |
| ---- | ------ | --------- | ------ | -------- | ----- | --------- | -------------- |
| 10   | ~470   | ~70       | 71     | ~490     | 1414  | 5.4 MB    | 1.3 MB         |
| 500  | ~900   | ~45       | 91     | **1230** | 5237  | 10.1 MB   | 2.3 MB         |
| 2000 | ~960   | **~1140** | 130    | **1170** | 11159 | 11.0 MB   | 4.9 MB         |

**Save-path (serializacja: `calculateOfferPricing` + clone + stringify):**

| N    | ms  | payload | longtask |
| ---- | --- | ------- | -------- |
| 10   | 8   | 0.12 MB | 0        |
| 500  | 60  | 0.80 MB | 57 ms    |
| 2000 | 207 | 3.03 MB | 0        |

Realny blob (baza): 1840 studni = 9.3 MB → **save-path ≈ 0.5–0.9 s blokady** przy ~1800–3000 studniach.

**Retencja (open/close ×10 @2000, `baseline-excel-retention-f0.json`):** retained 4.42 → 5.05 MB (+~63 KB/cykl, plateau) = głównie tablica `wells` otwartej oferty. **Brak katastrofalnego leaku.**

**Wnioski:**

1. **RAM renderera = nie-problem** (≤12 MB). F2.1/F2.2 (slim) → **DROP** (dowód).
2. **Główny koszt = blokada wątku głównego:** open `ltMax` ~1.2 s, **switch zakładki @2000 ~1.1 s net**, `ltSum` 11 s/sesję.
3. Edycja scopowana szybka (~70–130 ms) — nie ruszać.
4. **Backupy własne: max 2933 studni** → projektować do 3000.

## B. Prod-tool

`scripts/wellcount-stats.mjs` (node:sqlite, read-only). Dev: 15 ofert, p50=1, p99=1840, max=1840. Gotowy na snapshot prod (Q6).

## C. SLO (bramka `excelHeapProbe`)

| Metryka             | N=10 | N=500    | N=2000   | N=3000   |
| ------------------- | ---- | -------- | -------- | -------- |
| openMs (med.)       | ≤300 | ≤500     | ≤800     | ≤900     |
| **ltMax**           | ≤200 | ≤200     | ≤200     | ≤200     |
| tabMs net @2000     | —    | ≤200     | ≤300     | ≤300     |
| editMs              | ≤100 | ≤120     | ≤200     | ≤200     |
| heap@open           | —    | ≤14 MB   | ≤16 MB   | ≤18 MB   |
| retained cyklicznie | —    | stabilne | stabilne | stabilne |

## D. F1 — projekt (na podstawie inwentarza, dowody)

**Inwentarz (agent, `plik:linia`):**

- `recalculateWellErrors` (`SV:157-379`) czyta: `config`, `configErrors`, `rzednaWlazu/Dna`, `przejscia(rzednaWlaczenia,angle,productId,flowType)`, `item(productId,quantity,disablePehd)`, `psiaBuda`, `_solverErrorsGen`, `configSource`; **treść produktów** przez `resolveStudnieProduct` (`globals.js:209`) → `studnieProducts`/`studnieProductsById` (`globals.js:4,46`); `FLOW_TYPES`, `SOLVER_NOTE_MARKERS`.
- Mutuje **tylko** `configErrors` (`SV:351,359-361`) i `configStatus` (`SV:372-378`).
- ~20 miejsc wywołania; hot-path perf = `_excelRecalcTabWellErrors` (`excelPolling.js:319-328`, open/switch) i `refreshAllWellErrors` (`SV:610-616`).
- Istniejące: `wellConfigFingerprint` (`SV:122`) = **za wąski** (tylko productId×qty). `well.__resCache` (`excelHelpers.js:321-335`). **`computeSolveInputHash`** (`solverAutoSelect.js:354-396`) = FNV-1a obejmujący dn/type/magazyn/nadbudowa/dennica/wkladka/redukcja/rzedna/przejscia — **istniejący, dobry klucz do REUŻYCIA** (nie pisać nowego).
- **Katalog jest mutowalny in-place** i przez setter (`globals.js:31-38`), `invalidateStudnieProductsMap` (`globals.js:67-69`), `pricelist*`. **Brak licznika wersji katalogu** → cache MUSI go mieć.

**Decyzje F1 (SSoT-reuse, minimalny diff):**

1. **Klucz cache** = `computeSolveInputHash(well)` (reuse; eksponować globalnie) **+ `window.__studnieCatalogGen`** (nowy licznik) **+ `pendingStudnieStampId`/wersja cennika**.
2. **`__studnieCatalogGen`**: inkrementacja w setterze `studnieProducts` (`globals.js:31-38`), `invalidateStudnieProductsMap` (`:67-69`) i punktach mutacji cennika. 1 linia każdy.
3. **Cache w `well.__recalcKey` + wynik w `configErrors/configStatus`** (bez nowego pola wyniku). Nowe pole runtime → **dodać do `stripWellRuntimeFields` (`offerSave.js:11-18`) [G7]** i wykluczeń draftu (`draftStore.js:54-55`).
4. **Zastosowanie w hot-path tylko:** `_excelRecalcTabWellErrors` — pomiń wells, gdy klucz bez zmian; reszta wywołań **bez zmian** (zero regresji semantyki). `force=true` dla paste/structural/solver/pricelist.
5. **Testy:** równoważność `configErrors/configStatus` (OLD vs NEW dla zbioru wells), unieważnienie (rzędna/przejście/katalog), `stripWellRuntimeFields` obejmuje `__recalcKey`, golden DOM, parity. Regresja RED→GREEN jak w planie.
6. **Pomiar:** `tabMs net @2000 ≤ 300 ms` (z ~1140 ms); brak wzrostu open `ltMax`.

## E. Priorytety (po F0)

1. **F1** recalc/taby (PRIORYTET #2, hot-path tab). 2. **F4/F3** long-task open (`ltMax ≤200`). 3. **F2.4** guard/telemetria payloadu (+ przenieść serializację poza main-thread jeśli >200 ms). 4. **F2.5** draft. 5. **F6.1** a11y (`test:axe`). 6. **F7.2** silent-fail. 7. **F3.2** lock/409. ~~F2.1/F2.2~~ **DROP**.

## F. Bramki / Rollback

golden · parity · hang2000 · **excelHeapProbe (SLO §C)** · test:axe · kanonizowany eksport · brak cichej utraty danych. Rollback: F1 flaga cache; F2.4/5 wyłącz; F4 wyłącz O2a/O2b.

## G. Estymaty (INFERENCE)

F1 20–32 h · F2.4 6–10 · F2.5 8–14 · F3 14–26 · F4 12–20 · F5 10–18 · F6 14–24 · F7 6–10 · F8 4–8 · F9 8–14 → **~102–176 h**.

## H. Kryteria done

Pomiar przed/po vs SLO · koszt zidentyfikowany · testy równoważności zielone · bramki zielone · brak zysku → revert.
