# E3 — Performance: BASELINE → poprawki Excel → POMIAR

**Wersja:** 1.26.0 · Data: 2026-09-16 · Bez commita (roboczo)

## 1. Metodyka

- Serwer: `npm run build` + `node dist/server.js` na porcie **3101** (3000 zajęty
  przez instancję dev 1.26.0, nietknięta). Po pomiarach zabity, `bench_*` usunięte (2 szt.).
- API: `scripts/benchmark.mjs 20` (sekwencyjnie) + `scripts/load-100.mjs --quick`
  (mix 100 userów: 80 read / 15 write / 3 batch / claim+PDF, 60 s + burst 100×).
- Excel: `tests/playwright/excelOpenPerf.cjs` (cold 5× / warm 5×) +
  `tests/playwright/excelVirtualBench.cjs` (1k/5k × OFF/ON) przeciw `:3000`
  (ta sama wersja 1.26.0; frontend serwowany live z `public/`, więc pomiar „po"
  widzi zmodyfikowane pliki; backend w obu przebiegach ten sam — porównanie
  dotyczy zmiany frontendowej, co jest zgodne z zakresem E3).
- `load-100.mjs` nie parametryzuje liczby userów (tylko `--quick`), więc wiersze
  25/50 poniżej to ekstrapolacja z rozbicia na operacje; pełne 25/50/100 jako E5-A.

## 2. Zmiany kodu (tylko 3 pliki, bez logiki, bez wizualiów)

- `excelCellNavigation.js`: `_excelCursorToEnd()` (reguła #33) zamiast 3× `select()`
  (focus,restore po nawigacji, Ctrl+F); `EXCEL_STICKY_COLS = 7` zamiast `i < 7`.
- `excelModal.js`: `EXCEL_STICKY_CELL_SELECTOR = 'td:nth-child(-n+7)'` (2 użycia).
- `excelBulkJob.js`: `EXCEL_BULK_ZINDEX_FALLBACK = 9999` zamiast fallbacku `9999`.
- `createIcons()` bez `root` w `excel*.js`: **brak** — wszystkie już z `{root}`
  (gołe wywołania tylko poza Excelem, poza zakresem E3).
- Wartości bez zmian; `excelTableRenderer.js`/`excelTableBody.js` nadal z literałem
  selektora — kandydat do E4.

## 3. Wyniki

### 3.1 benchmark.mjs (sekwencyjnie, n=20)

| Endpoint  | Baseline p50/p95/p99 | Po p50/p95/p99    | Δ p95                                      |
| --------- | -------------------- | ----------------- | ------------------------------------------ |
| login     | 151,1/151,1/151,1    | 125,5/125,5/125,5 | szum (n=1)                                 |
| search    | 14,6/16,3/16,6       | 13,8/15,8/16,1    | −0,5 ms                                    |
| save PUT  | 12,4/38,9/417,7      | 15,5/18,6/19,8    | outlier 418 ms zniknął (szum single-write) |
| telemetry | 15,3/16,0/16,3       | 15,2/16,6/16,7    | ~0                                         |
| AGG       | 15,1/16,6/417,7      | 15,2/16,6/19,8    | ~0                                         |

### 3.2 load-100.mjs --quick (mix 100 userów)

| Op            | Baseline p50/p95/p99                             | Po p50/p95/p99                                   | Δ p95                            |
| ------------- | ------------------------------------------------ | ------------------------------------------------ | -------------------------------- |
| read (n≈525)  | 20,4/268,5/682                                   | 20,6/239,1/364,9                                 | −29 ms (szum)                    |
| write (n≈190) | 58,8/1130,1/1302,4                               | 61,8/943,7/949,8                                 | −186 ms (wariancja kolejki)      |
| batch (n=55)  | 100/2487,4/3146,6                                | 64,7/1367,1/2197,4                               | −1120 ms (wariancja, mała próba) |
| claim (n=12)  | 33,6/746,9/746,9                                 | 33,5/877,1/877,1                                 | szum                             |
| pdf (n=4)     | 1726/3281/3281                                   | 1548/2346/2346                                   | szum                             |
| burst 100×    | wall 2382, p50 314, p95 690                      | wall 2425, p50 208, p95 593                      | ~0                               |
| metryki       | busyΔ 0, dbAvg 6,1 ms, loopLag 16 ms, rss 187 MB | busyΔ 0, dbAvg 5,7 ms, loopLag 25 ms, rss 217 MB | ~0                               |
| DoD           | FAIL (CRUD p95 2487 > 500)                       | FAIL (CRUD p95 1367 > 500)                       | nadal FAIL                       |

5xx=0, write-fail=0, throttled=0 w obu przebiegach.

### 3.3 Excel (Playwright, Chromium OK — nie pominięto)

| Scenariusz              | Baseline     | Po           | Δ                        |
| ----------------------- | ------------ | ------------ | ------------------------ |
| open cold (mediana 5×)  | 547 ms       | 569 ms       | +4% (szum)               |
| open warm (mediana 5×)  | 468 ms       | 543 ms       | +16% (szum maszyny, n=5) |
| edit rzędna AUTO/MAN    | 1286/1280 ms | 1293/1281 ms | ~0                       |
| tab-switch (6 zakładek) | 711–879 ms   | 737–1000 ms  | ~0                       |
| virtual 1k OFF/ON open  | 5279/440 ms  | 5171/447 ms  | ~0                       |
| virtual 5k OFF/ON open  | 24850/433 ms | 28326/436 ms | szum (DOM 679k węzłów)   |
| węzły DOM               | identyczne   | identyczne   | brak zmian wizualnych ✓  |

## 4. Wnioski

1. **Wąskie gardło: single-writer SQLite.** Zapisy serializują się (write p95 ~1 s,
   batch-10 p95 1,4–2,5 s przy 100 userach); odczyty zdrowe (p95 ~250 ms).
   `busyDelta=0` — kolejka/`busy_timeout` trzymają poprawność kosztem latencji.
2. **Poprawki E3 neutralne wydajnościowo** — zgodnie z oczekiwaniami (stałe +
   kursor, zero hot-path). Brak regresji; DOM identyczny.
3. **DoD `P95 CRUD<500ms` FAIL przed i po** — próg spełniają odczyty, nie zapisy
   wsadowe. To jest wejście do E5, nie do kolejnej kosmetyki.

## 5. Rekomendacja E5 (propozycja z liczb)

- **E5-A (najpierw):** sustained 15 min (pełny `load-100.mjs`) + parametryzacja
  25/50/100 userów (flaga `--users`, dziś brak) — potwierdzić, czy batch p95
  rośnie liniowo z liczbą piszących, czy z długością kolejki single-writera.
- **E5-B (jeśli A potwierdzi):** ścieżka batch/claim — mniejsze wsady, rozjazd
  PUT+DELETE, kolejka po stronie serwera; cel: CRUD p95 < 500 ms przy 100 userach.
- **E5-C (PostgreSQL) TYLKO jeśli A/B nie domykają progu.** Dane za C dziś:
  brak — busy=0, 5xx=0, odczyty OK. Zakaz skoku bez dowodu z A/B.

## 6. Testy po zmianie

`node -c` ×3 PASS, `eslint` ×3 czysto, `npx jest tests/frontend tests/studnie`:
**102 suity / 1398 testów PASS**. Worktree: 3 pliki Excel + ten raport, bez commita.
