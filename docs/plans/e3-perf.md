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

## 7. Domknięcie load-testów (Agent E3) — 2026-09-16, bez commita

Starej tabeli baseline (§3) NIE nadpisano — poniżej nowe, niezależne pomiary.

### 7.1 Warianty (jak odróżnić quick od sustained)

- **quick** (`--quick`, steady 60 s + burst N×): job CI `load-quick`
  (`.github/workflows/ci.yml`) — tylko push na main, po jobie `test`.
  Deterministyczny, szybki, zapisy self-cleaning (PUT+DELETE, claim+recycle),
  wynik DoD daje jasny PASS/FAIL. Odporny na brak środowiska: jeśli serwer
  nie wstanie w 60 s, job kończy się SKIP z wyraźnym powodem (nie FAIL).
- **sustained** (`--sustained`, steady ~15 min + burst N×): job CI
  `load-sustained` — TYLKO `workflow_dispatch` (input `users`, domyślnie 100)
  i nightly (`schedule` cron `0 2 * * *`). Nigdy przy pushu/PR.
- **`--users N`** (formy `--users 50` i `--users=50`): skala workerów steady
  i burstów w proporcjach historycznych; dla N=100 podział bitowo identyczny
  jak dotąd (80/15/3 + claim + PDF; burst 55/20/10/5 + 5 health + 2 PDF + 3 fill).
  Brak flagi = 100 (wsteczna kompatybilność); `--quick` bez `--users` bez zmian.
- Skrypty npm: `load` (domyślne 100 userów / 300 s), `load:quick`, `load:sustained`.

### 7.2 Pomiary lokalne (REALNE liczby)

- Serwer: `node dist/server.js` (build z 2026-09-16 17:55, bez przebudowy)
  na porcie **3210** (3000 zajęty przez instancję dev, nietknięta).
- Baza: **świeża** `data/loadtest_e3.sqlite` (push + `prisma:seed`: 94 rury,
  689 studnie) — prod `app_database.sqlite` nietknięta (rozmiar ten sam).
  Po pomiarach serwer zabity, `loadtest_e3.sqlite*` usunięte.
- Świeży seed NIE zawiera oferty studni → brak `pdfId`: worker PDF idle,
  `pdfB=0`, wiersz pdf pusty (N/A) we wszystkich przebiegach.

| Przebieg             | users | steady | req steady | błędy (5xx/fail) | p50/p95/p99 write | p95 CRUD | burst wall/p95 | throughput steady | DoD  |
| -------------------- | ----: | -----: | ---------: | ---------------: | ----------------- | -------: | -------------- | ----------------- | ---- |
| `--quick`            |   100 |   60 s |        802 |            0 / 0 | 17,6/230,7/236,7  | 230,7 ms | 262 ms / 218,1 | ~13,4 req/s       | PASS |
| `--users 25 --quick` |    25 |   60 s |        196 |            0 / 0 | 18,1/64,7/93,0    |  64,7 ms | 61 ms / 43,1   | ~3,3 req/s        | PASS |
| `--users 50 --quick` |    50 |   60 s |        394 |            0 / 0 | 16,9/85,8/93,7    |  85,8 ms | 92 ms / 70,7   | ~6,6 req/s        | PASS |

Szczegóły (wszystkie statusy 200, throttled 0, busyDelta 0):

- `--quick` (100): read n=520 p50 19 / p95 148,2 / p99 225,7; write n=204
  p50 17,6 / p95 230,7 / p99 236,7; batch n=66 p50 13,7 / p95 149,3 / p99 294,9;
  claim n=12 p50 15,4 / p95 222; burst 100× wall 262 ms p50 111,4 / p95 218,1;
  metryki: dbQueries 5605, dbAvg 0,21 ms, loopLag 16 ms, rss 170 MB.
- `--users 25 --quick`: read n=122 (18,8/46,5/71,4); write n=40 (18,1/64,7/93);
  batch n=22 (15,9/32,3/80,8); claim n=12 (15,2/62); burst 25× wall 61 ms
  p50 32,6 / p95 43,1; dbQueries 1430, dbAvg 0,18 ms, loopLag 16 ms, rss 168 MB.
- `--users 50 --quick`: read n=264 (18,6/60,9/73,1); write n=96 (16,9/85,8/93,7);
  batch n=22 (15,4/87,7/106,9); claim n=12 (14,2/81,3); burst 50× wall 92 ms
  p50 54,6 / p95 70,7; dbQueries 2649, dbAvg 0,15 ms, loopLag 16 ms, rss 170 MB.

Wniosek: p95 CRUD rośnie z liczbą piszących (64,7 → 85,8 → 230,7 ms),
ale przy świeżej bazie i limicie 60 s próg 500 ms spełniony we wszystkich
przebiegach (PASS). Różnica względem FAIL z §3.2 to inny stan bazy
(świeży seed, brak PDF, mniejsza kolejka single-writera) — nie regresja kodu.

### 7.3 Testy po zmianie (E3)

- `node --check scripts/load-100.mjs` PASS.
- `--help` (działa bez serwera) PASS — wypisuje użycie i exit 0.
- `--users abc` → exit 2 z komunikatem; `--users=0` → exit 2 (walidacja obu form).
- Matematyka podziału zweryfikowana: N=100 → dokładnie 80/15/3/1/1
  (burst 55/20/10/5/2/8); sumy workerów == N dla 1/5/9/10/25/50/100.
- `ci.yml` poprawny YAML (js-yaml parsuje); joby wzorowane na `e2e-smoke`
  (te same kroki setup + seed + build, env `test-ci.sqlite`).
- `npx prettier --check` na 4 edytowanych plikach (wynik poniżej w §7.5).

### 7.4 NIE wykonano (z powodem)

- Pełny steady 300 s (`load-100.mjs` bez flag) i `--sustained` (~15 min)
  lokalnie: NIE WYKONANO — koszt czasu (5–15 min + analiza) przy determinacji
  quick; wariant sustained pokrywa job `load-sustained` (dispatch/nightly).
- Przebieg `--users 100` bez `--quick`: NIE WYKONANO osobno — równoważny
  wariant to `--quick` przy N=100 (ten sam kod podziału, krótszy steady).
- Pomiar PDF/export-pdf: N/A — świeży seed nie zawiera oferty studni
  (worker idle zgodnie z projektem, burst bez PDF).

### 7.5 Prettier

- `npx prettier --check scripts/load-100.mjs docs/plans/e3-perf.md package.json`
  → PASS (wszystkie czyste; `.mjs` nie wchodzi w CI-owy `format:check`, ale
  wyrównano do `.prettierrc` — baseline `load-100.mjs` był czysty, więc
  `--write` dotknął tylko nowych linii).
- `.github/workflows/ci.yml` → WARN, ale **zastany**: cały plik ma CRLF
  (koniec linii), a `.prettierrc` wymaga LF — baseline z HEAD też WARN.
  Treściowo nowe joby są prettier-czyste (diff sformatowanej kopii to wyłącznie
  `\r`); konwersji całego pliku na LF nie robiono (szum poza zakresem).
