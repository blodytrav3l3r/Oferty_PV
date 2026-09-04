# Audyt wydajności auto-doboru studni (JS + AI) — raport z pomiarów

**Wersja:** 1.23.0 (repo `VERSION` w dniu audytu — patrz `npm run version:check`)
**Data:** 2026-09-04
**Harness:** `scripts/benchmark-autoselect.mjs` (`npm run benchmark:autoselect`, quick: `benchmark:autoselect:quick`)
**Surowe wyniki:** `docs/plans/benchmark-autoselect-results.json`
**Tryb:** pomiar only, zero fixów (baseline przed decyzjami P0/P1/P2).

## 1. Konfiguracja testu i środowisko (reprodukowalność)

| Parametr                | Wartość                                                                                                                                                    |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Node / V8               | v24.18.0 / 13.6.233.17-node.50                                                                                                                             |
| CPU                     | AMD Ryzen 7 3700X 8-Core, Linux x64, 8 wątków                                                                                                              |
| Katalog seed            | `data/seed_studnie.json` — 685 produktów (avr 3, dennic 104, konus 18, krag 102, krag_ot 24, przejscie 348, plyta_din 9, plyta_redukcyjna 8, uszczelka 21) |
| Kształt produktów       | znormalizowany do runtime (`productsStudnieV2.ts:203-204`: `magazynKLB/WL` boolean → 1/0); bez tego `getAvailableProducts` odrzuca cały katalog            |
| Wysokości kręgów (seed) | 250 / 500 / 750 / 1000 mm; AVR: 60 / 80 / 100 mm                                                                                                           |
| N (repeats) / warm-up   | 20 / 5 (quick: 10 / 3)                                                                                                                                     |
| Cache                   | cold = świeży kontekst vm na iterację; warm = reużyty kontekst (front `scoreCache` 15 min/200 + `_influenceCache` 60 s trafiają)                           |
| Sieć AI                 | stub `fetch` z programowalną latencją (0 / 50 / 200 / 1200 ms); backend live nieużyty                                                                      |

Metoda: produkcyjne `globals.js`, `ruleEngine.js`, `wellConfigRules.js`, `ringOptimizer.js`, `mlDualRanking.js` ładowane do `vm` **bez modyfikacji plików**. Liczniki DP (`solveDPRings`, `findAlternativeDPSolution`, `validateRingJoints`) wstrzyknięte string-replace w kopii źródła w pamięci. `findBestAvrFill` jest zagnieżdżona w `runJsAutoSelection` — mierzona **wierna replika 1:1** z licznikami (oznaczone w JSON jako `avr (replica)`).

## 2. Top-5 funkcji wg kosztu (atrybucja: calls + czas/call)

Pełna seria full, wall-clock harnessu ~suma totali 1375 ms:

| #   | Funkcja                                             | calls   | total   | per call  | P95/call | udział    |
| --- | --------------------------------------------------- | ------- | ------- | --------- | -------- | --------- |
| 1   | `optimizeRingsForDistance` (`ringOptimizer.js:109`) | 895     | 1100 ms | 1,23 ms   | 3 ms     | **86,3%** |
| 2   | `filterByWellParams` (`wellConfigRules.js:93`)      | 193 146 | 96 ms   | 0,0005 ms | ~0 ms    | 7,5%      |
| 3   | `buildFeatureVector` (`mlDualRanking.js:264`)       | 250     | 56 ms   | 0,22 ms   | 1 ms     | 4,4%      |
| 4   | `getAvailableProducts` (`wellConfigRules.js:191`)   | 303     | 8 ms    | 0,03 ms   | 0 ms     | 0,6%      |
| 5   | `getLowestDennicaHybrid` (`ruleEngine.js:275`)      | 75      | 9 ms    | 0,12 ms   | 1 ms     | 0,7%      |

Dalej: `getKregiList` 0,05 ms/call, `getTopClosure` 0,03 ms/call, `buildCandidateLayouts` 0,01 ms/call — pomijalne jednostkowo.

**Wniosek atrybucyjny:** DP nie jest drogi jednostkowo (~1 ms), tylko **wołany setki razy** per auto-dobór (patrz §5). `filterByWellParams` to 193 tys. wywołań, ale po 0,4 µs — tanie mimo wolumenu. `buildFeatureVector` ×10 kandydatów ≈ 3–4 ms (głównie lookup produktów + liczenie uszczelek).

## 3. DP scaling: `O(cap × heights)` — POTWIERDZONE

`solveDPRings` buduje tablicę `cap+1` i dla każdego `h` iteruje po wysokościach. Pomiar `optimizeRingsForDistance` (bez przejść):

| cap [mm] | h=3 (p50/p95) | h=4          | h=6         |
| -------- | ------------- | ------------ | ----------- |
| 500      | 0,20 / 0,87   | 0,16 / 0,23  | 0,16 / 0,23 |
| 1000     | 0,36 / 0,64   | 0,31 / 0,69  | 0,31 / 0,46 |
| 2000     | 0,64 / 1,25   | 0,70 / 0,97  | 0,59 / 0,79 |
| 4000     | 1,24 / 1,55   | 1,24 / 1,71  | 1,18 / 1,40 |
| 6000     | 2,01 / 2,82   | 1,88 / 2,25  | 1,84 / 2,17 |
| 10000    | 3,21 / 4,05   | 4,06 / 12,55 | 3,10 / 4,49 |

Liniowo w `cap` (≈0,3 ms na 1000 mm), **liczba wysokości prawie bez wpływu** (3 vs 6 porównywalnie — wewnętrzna pętla to stały koszt vs alokacja tablicy). Timeout 250 ms (`DP_TIMEOUT_MS`) nigdy nie wystrzelił w tych zakresach (max 22 ms outlier przy cap=10000/h=4 — GC/JIT, nie algorytm).

Z przejściami (rebuild alternatywy `findAlternativeDPSolution`): `altCalls/run = 0` — syntetyczne przejścia nie wymusiły alternatywnej ścieżki (pierwsze DP przechodziło `validateRingJoints`). Koszt walidacji wliczony w czasy powyżej (+0–1 ms). **Ograniczenie:** pełny koszt `findAlternativeDPSolution` (drugie pełne DP) niezaobserwowany — wymaga kolizyjnego przypadku z prod.

## 4. AVR: `findBestAvrFill` — tani, timeout martwy

Replika 1:1 (timeout 100 ms, `maxAvr` 260):

| Deficyt | typy AVR 3 (visited p95 / timeout / p95 czasu) | typy AVR 9         |
| ------- | ---------------------------------------------- | ------------------ |
| 30–260  | 20 / 0 / ≤0,02 ms                              | 237 / 0 / ≤0,08 ms |

`timeoutHit = 0` we wszystkich seriach — 100 ms bezpiecznik nigdy niepotrzebny przy 3 typach AVR (seed). Przestrzeń stanów rośnie z liczbą typów (20 → 237), ale czas pozostaje w mikrosekundach. **Nie jest hotspotem.**

## 5. Ile razy DP per jeden auto-dobór (bound ze struktury `solve()`)

`solve()` (`solverAutoSelect.js:802`): pętla `dennice × topConfigs(≤2) × stages(5)`; gałąź redukcji: `lift ≤40 × dennice × 2× fillKregiDP`. Realne listy z seeda, koszt 1 DP ≈ 0,64 ms (cap 2000):

| Przypadek                | dennic | DP best (stage Standard, 1 top) | DP worst (5 stages × 2 tops) | + redukcja worst | projekcja czasu     |
| ------------------------ | ------ | ------------------------------- | ---------------------------- | ---------------- | ------------------- |
| DN1000, 3 m, 0 przejść   | 13     | 13                              | 130                          | —                | **8 → 77 ms**       |
| DN1500, 5 m, redukcja    | 14     | 14                              | 140                          | +1120            | **8 → 83 → 745 ms** |
| DN2000, 6 m, 3 przejścia | 17     | 17                              | 170                          | —                | **10 → 100 ms**     |

Solver-proxy (1× pełny łańcuch filtr→dennica→top→DP→AVR→layout, bez DOM): **p50 ≈ 0,9 ms, p95 ≈ 1,1–1,2 ms** — potwierdza, że koszt = mnożnik wywołań, nie jednostkowy DP.

## 6. AI: CPU vs sieć vs cache vs race

`buildFeatureVector` ×10 kandydatów: **p95 2,82 ms** (0,2 ms/kandydat). `rankCandidates` (5 kandydatów):

| Wariant               | cold p95      | warm p50 / p95 | online    | wniosek                                                                                              |
| --------------------- | ------------- | -------------- | --------- | ---------------------------------------------------------------------------------------------------- |
| AI OFF (influence 0)  | 4,07 ms       | 1,01 / 1,21 ms | true*     | *model osiągalny, ranking techniczny; **nawet shadow płaci ~4 ms** za `ml-status` + `settings` fetch |
| cache-miss, sieć 0 ms | 2,30 ms       | 1,13 / 1,39 ms | true      | czysty CPU ≈ 2–5 ms cold / ~1 ms warm                                                                |
| sieć 50 ms            | 62,05 ms      | 1,14 / 1,29 ms | true      | cold = latencja + metadata; warm = cache front neutralizuje sieć                                     |
| sieć 200 ms           | 216,31 ms     | 0,98 / 1,37 ms | true      | jw. — po pierwszym solve sieć znika z profilu                                                        |
| timeout 1200 ms       | **810,15 ms** | 1,02 / 1,58 ms | **false** | race budget 800 ms działa: fallback techniczny w 810 ms, decyzja niezmutowana                        |

Kluczowe: **front `scoreCache` sprawia, że powtarzalny auto-dobór tej samej studni kosztuje ~1 ms** niezależnie od sieci. Cold (pierwszy solve, nowa konfiguracja) płaci pełną latencję. `ml-status` + `settings` lecą sekwencyjnie przed `predict/batch` w każdym cold — przy wolnej sieci to one dominują nad samym `model.predict` (backend: `O(29×10)` sigmoid ≈ µs + `getActiveModel` z DB + zod; nie mierzone live — patrz ograniczenia).

## 7. Filtrowanie katalogu

Pełny łańcuch `getAvailableProducts` + `filterByWellParams` na wszystkich produktach:

| Katalog           | beton+drabinka | żelbet+brak | redukcja |
| ----------------- | -------------- | ----------- | -------- |
| seed 685          | 0,31 ms        | 0,57 ms     | 0,40 ms  |
| synth small (~50) | 0,02 ms        | ~0 ms       | ~0 ms    |
| synth large ~2k   | 2,94 ms        | 3,27 ms     | 2,67 ms  |

Liniowo w rozmiarze katalogu, wartości bezwzględne małe. Powtarzanie filtra 4–5× w jednym solve (`solverAutoSelect.js:79,269,283,403,505`) to jednostki ms — nie hotspot przy obecnym katalogu; rośnie z katalogiem.

## 8. Gate'y — werdykt

| Gate                                        | Wynik                                                                 | Status                                  |
| ------------------------------------------- | --------------------------------------------------------------------- | --------------------------------------- |
| P95 / studnia ≤ 500 ms (JS)                 | best 8–10 ms; worst bez redukcji 77–100 ms; **redukcja worst 745 ms** | PASS z wyjątkiem rogu fallback+redukcja |
| 50 studni ≤ 10 s (solver serialnie)         | 50 × ~10–100 ms ≈ 0,5–5 s; róg redukcji do ~37 s                      | PASS typowo, FAIL w rogu                |
| Żadna studnia > 2 s bez powodu              | max zaobserwowane < 1 s (bez live-AI-timeout)                         | PASS                                    |
| AI nie blokuje ścieżki technicznej > 800 ms | race 811 ms cold-timeout, potem fallback; warm ~1 ms                  | PASS (budget działa)                    |
| Brak superliniowego wzrostu                 | DP liniowe w cap; filtr liniowy w katalogu; AVR stałe                 | PASS                                    |

Dominujący koszt: **JS (liczba wywołań DP)**, nie AI / sieć / filtr. Sieć AI dominuje tylko w cold-timeout (jednorazowo, z fallbackiem).

## 9. Excel bulk i przeglądarka — krok manualny (poza headless)

Harness nie ma DOM (`_excelRenderTable`, layout/paint niemierzalne w Node). Procedura do wykonania w `studnie.html` (DevTools → Performance, CPU 4× slowdown opcjonalnie):

1. Otwórz tabelę Excel z 50 studniami (DN1000, realny katalog Kluczbork).
2. Rekord Performance → „Uruchom auto-dobór dla wszystkich" → stop.
3. Odczytaj podział: `autoSelectComponents` (solver) vs `_excelRenderTable` vs Layout/Paint; oczekiwane wg audytu: solver ~0,5–5 s łącznie, render do zweryfikowania.
4. Pojedynczy auto-dobór z throttlingiem sieci (Fast 3G): zweryfikować cold-AI ~+200 ms i brak blokady UI (race 800 ms).

## 10. Rekomendacje P0/P1/P2 (bez implementacji w tym zadaniu)

- **P0-1 (mnożnik DP):** memoizacja `fillKregiDP(target, kList, tol…)` w obrębie jednego `solve()` — te same (target, dennica.height) liczone dla każdego topConfig i stage'u od nowa. Szacowany zysk: worst-case 130 → ~15–30 wywołań.
- **P0-2 (redukcja):** lift `while (lift < 40)` × dennice × 2 DP bez wczesnego stopu po znalezieniu kandydata w danym stage'u — ograniczyć lift lub współdzielić `bKregi` między iteracjami. Szacowany zysk: 1260 → ~200 wywołań w rogu.
- **P1-1 (cold AI metadata):** `ml-status` + `settings` równolegle (`Promise.all`) zamiast sekwencyjnie; rozważyć dłuższy TTL influence (60 s → np. 5 min) — cold 5 ms → ~2 ms, a przy wolnej sieci zysk proporcjonalny do RTT × 2 → × 1.
- **P1-2 (filtr):** jednorazowy pre-filtr `availProducts` per solve zamiast 4–5× `filter(filterByWellParams)` — zysk mały dziś (µs), rośnie z katalogiem.
- **P2-1 (DP cap):** `cap` rzędu 10 000 (studnie 10 m) ≈ 3–4 ms/DP — przy mnożniku ×170 daje ~0,5–0,7 s; ewentualny próg `tolBelow` adaptacyjny zamiast pełnych 5 stage'ów zawsze.
- **P2-2 (Excel):** dopiero po pomiarze z §9 — jeśli render >> solver, wirtualizacja/batch render zamiast optymalizacji solvera.

## 11. Ograniczenia audytu (uczciwie)

1. `findBestAvrFill` to replika (funkcja zagnieżdżona, brak eksportu) — logika 1:1 z `solverAutoSelect.js:642-678`, ale nie ten sam kod.
2. Ścieżka `findAlternativeDPSolution` nie wystrzeliła (alt/run = 0) — koszt pełnego rebuildu niezmierzony; potrzebny kolizyjny przypadek prod.
3. Backend `/ai/predict/batch` (DB `getActiveModel`, zod, `predictionCache`) niemierzony live — serwer dev nie był uruchomiony; `model.predict` O(29×10) z natury w µs.
4. Brak pomiaru `_excelRenderTable` / DOM / paint oraz `sortWellConfigByOrder` + `recalcGaskets` + `refreshAll` (render po solverze) — tylko krok manualny §9.
5. `Date.now()` (1 ms) w wrapperach per-function — P95 per-call dla funkcji <1 ms zgrubne; ranking udziałów mimo to jednoznaczny (85% DP).

## 12. Odpowiedź na kryterium zakończenia

> Które 5 funkcji faktycznie kosztuje najwięcej, ile razy są wywoływane, jak skalują się z danymi oraz czy koszt JS, AI, sieci czy renderowania jest dominujący?

1. `optimizeRingsForDistance` — 895 calls / 1100 ms total / 1,2 ms per call / 86,3% — skala liniowa w `cap`, stała w liczbie wysokości.
2. `filterByWellParams` — 193 tys. calls / 96 ms / 0,5 µs — skala liniowa w katalogu, jednostkowo pomijalne.
3. `buildFeatureVector` — 250 calls / 56 ms / 0,2 ms — skala liniowa w liczbie kandydatów (cap 10).
4. `getAvailableProducts` — 303 calls / 18 ms / 0,06 ms — liniowo w katalogu.
5. `getLowestDennicaHybrid` — 75 calls / 10 ms / 0,13 ms — liniowo w dennicach × przejściach.

**Dominuje JS (mnożnik wywołań DP w `solve()`), nie AI ani sieć.** AI cold to +5 ms (CPU) do +216 ms (sieć 200 ms) lub 811 ms timeout z bezpiecznym fallbackiem; warm AI ≈ 1 ms dzięki front-cache. Render (Excel/DOM) niezmierzony — do potwierdzenia krokiem §9 przed jakimkolwiek fixem P2-2.
