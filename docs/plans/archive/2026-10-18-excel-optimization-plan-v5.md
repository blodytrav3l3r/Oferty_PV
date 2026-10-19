# Plan optymalizacji modułu Excel (Studnie) — v5 (po F0)

> **Status:** F0 WYKONANE (pomiar). Cel: każda kategoria ≥ 8/10.
> **Data:** 2026-10-18 · **Supersedes:** v4.
> **Zmiana kluczowa vs v4:** F0 **obaliło tezę RAM** w rendererze (max ~12 MB @2000) i **wskazało realny koszt: long-task/UI-thread + przełączanie zakładek**. Priorytety przeprojektowane.

## A. Wyniki F0 (zmierzone, nie zgadywane)

Harness: `tests/playwright/excelHeapProbe.cjs` (CDP `HeapProfiler.collectGarbage` + `Runtime.getHeapUsage`, longtask observer, fixture realistyczny `buildPerfWells` skalowany). Protokół: warmup odrzucony + 3 przebiegi, mediana. Serwer dev :3000 (bez spawnu — `wells` wstrzykiwane do ramki). Bez throttle. Plik: `docs/plans/baseline-excel-heap-f0.json`.

| N    | openMs | tabMs*    | editMs | ltMax    | ltSum | heap afterOpen | deltaOpen | retained afterClose |
| ---- | ------ | --------- | ------ | -------- | ----- | -------------- | --------- | ------------------- |
| 10   | 356    | 330*      | 59     | 181      | 393   | 5.7 MB         | 1.4 MB    | 1.24 MB             |
| 500  | 853    | 348*      | 81     | **1117** | 4670  | 10.6 MB        | 6.1 MB    | 2.33 MB             |
| 2000 | 1286   | **2050*** | 151    | **2460** | 17580 | 12.0 MB        | 6.9 MB    | 5.01 MB             |

\* `tabMs` zawiera 300 ms settle (net @2000 ≈ **1750 ms**). `ltMax/ltSum` = longtask (≥50 ms) w całej sesji, observer resetowany przed open.

**Wnioski (FACT):**

1. **RAM to NIE problem renderera.** Heap po otwarciu ≤ 12 MB @2000 studni; deltaOpen nasyca ~7 MB. `wellsExport`/clone nie tworzą GB. → **F2.1/F2.2 (slim) = prawdopodobnie NO-OP; do zweryfikowania, nie do implementacji na ślepo.**
2. **Realny koszt = blokada wątku głównego:** `ltMax` 1.1 s @500 i **2.46 s @2000**; `ltSum` 17.6 s/sesję @2000. To największy UX-ból.
3. **Przełączanie zakładek @2000 ≈ 1.75 s net** — koszt O(n) recalc; @500 już 348 ms.
4. **Edycja scopowana jest szybka** (59/81/151 ms) — nie dotykać.
5. `retainedAfterClose` rośnie (1.2→5.0 MB) ≈ rozmiar tablicy `wells` (dane otwartej oferty, nie leak); **do potwierdzenia testem cykli open/close ×10**.
6. **Backupy (własne):** max historyczny **2933 studni** (backup 2026-09-04), 2920, 2317 — „duże oferty" są realne → mierzyć do **3000** jako headroom.

**Prod-tool:** `scripts/wellcount-stats.mjs` (node:sqlite, read-only) — gotowy na snapshot prod (Q6). Dev: 15 ofert, p50=1, p99=1840, max=1840.

**Zastrzeżenia (INFERENCE/UNVERIFIED):** unthrottled; headless; fixture wstrzykiwany (nie przez load z serwera); pomiar jednej maszyny; `openMs`/`ltMax` obejmują budowę modala; `tabMs`/`editMs` po korekcie pollingu.

## B. SLO (zaproponowane z danych; 200 ms = próg long-task Web Vitals)

| Metryka                    | N=10  | N=500                   | N=2000       | N=3000       |
| -------------------------- | ----- | ----------------------- | ------------ | ------------ |
| openMs (mediana)           | ≤ 300 | ≤ 500                   | ≤ 800        | ≤ 900        |
| **ltMax (blokada główna)** | ≤ 200 | ≤ 200                   | ≤ 200        | ≤ 200        |
| tabMs net @2000            | —     | ≤ 200                   | ≤ 300        | ≤ 300        |
| editMs                     | ≤ 100 | ≤ 120                   | ≤ 200        | ≤ 200        |
| heap afterOpen             | —     | ≤ 14 MB                 | ≤ 16 MB      | ≤ 18 MB      |
| retained po cyklach ×10    | —     | brak wzrostu (stabilne) | brak wzrostu | brak wzrostu |

Bramka: `excelHeapProbe.cjs` (progi w pliku) + istniejące golden/parity/hang2000.

## C. Priorytety (przeprojektowane po F0)

| #   | Cel                                             | Faza                     | Uzasadnienie (dane F0)        |
| --- | ----------------------------------------------- | ------------------------ | ----------------------------- |
| 1   | **ltMax ≤ 200 ms** przy open (chunk renderu)    | **F4/F3**                | ltMax 1.1–2.46 s → główny ból |
| 2   | **tabMs net ≤ 300 ms** @2000                    | **F1 (recalc)**          | 1.75 s @2000 → O(n)           |
| 3   | Data-safety zapisu (guard payloadu, telemetria) | **F2.4**                 | ryzyko utraty danych (50 mb)  |
| 4   | Draft dużych ofert                              | **F2.5**                 | brak recovery >4 MB           |
| 5   | A11y siatki (`test:axe`)                        | **F6.1**                 | UX ≥8                         |
| 6   | Silent-fail audit (52 puste catch)              | **F7.2**                 | jakość błędów                 |
| 7   | Concurrency lock/409                            | **F3.2**                 | brak utraty danych            |
| —   | ~~F2.1 cache solvera / F2.2 slim wellsExport~~  | **verify → likely DROP** | heap 12 MB — brak headroomu   |

## D. Fazy (zmienione vs v4)

- **F0 ✅** — patrz §A.
- **F1 — Recalc inkrementalny (PRIORYTET #2):** inwentarz wejść `recalculateWellErrors` + macierz źródeł; fp = wejścia + wersja cennika/katalogu; triggery invalidacji (G6); pole cache → `stripWellRuntimeFields` (G7). Cel: `tabMs net @2000 ≤ 300 ms`.
- **F2 — tylko:**
    - **F2.0 (verify):** powtórzyć pomiar retencji cyklem open/close ×10 (potwierdzić brak leaku); jeśli brak — **zamknąć F2.1/F2.2 jako NO-OP z dowodem**.
    - **F2.4** guard/telemetria payloadu zapisu + pomiar `JSON.stringify(wellsExport)` (podejrzenie blokady głównej przy zapisie 9 MB) — mierzyć `ltMax` w trakcie save.
    - **F2.5** draft dużych ofert. **F2.3** luka >100 restore.
- **F3 — UI-thread + concurrency:** F3.1 profil najdłuższego tasku open → chunk-rAF/Worker (z dowodu); F3.2 lock/409.
- **F4 — Render (PRIORYTET #1):** cel `ltMax ≤ 200 ms`; O2b szablon ~135→~50 węzłów + skeleton; O2a CSS warunkowo. Golden `--update` wg procedury.
- **F5/F6/F7/F8/F9** — jak v4 (F9 = rozszerzyć `excel-throttle-nightly.yml` + `ci.yml`; F6.1 = `tests/playwright/a11yAxe.spec.ts`).

## E. Bramki

golden · parity 31/31 · hang2000 · **excelHeapProbe (SLO §B)** · test:axe (modal) · kanonizowany eksport · brak cichej utraty danych.

## F. Rollback

F1: flaga cache · F2.4/5: wyłącz guard/draft · F4: wyłącz O2a/O2b.

## G. Estymaty (INFERENCE)

F1 24–40 h · F2.0 2–4 h · F2.4 6–10 h · F2.5 8–14 h · F3 14–26 h · F4 12–20 h · F5 10–18 h · F6 14–24 h · F7 6–10 h · F8 4–8 h · F9 8–14 h. **Razem ≈ 108–188 h** (F2.1/F2.2 wycięte → mniej niż v4).

## H. Kryteria done

Pomiar przed/po vs SLO §B · zidentyfikowany koszt · testy równoważności/regresji zielone · bramki zielone · brak zysku → revert.
