# Solver STOP — re-weryfikacja (E4 → dziś)

**Werdykt: STOP** — ekstrakcja `fillKregiDP` / `solve` z `runJsAutoSelection` nadal niebezpieczna.
Kod nietknięty (read-only, bez commita).

## 1. Stan kodu (IDENTYCZNY z E4)

- `fillKregiDP` nadal domknięciem w `runJsAutoSelection`
  (`public/js/studnie/solverAutoSelect.js:621`).
- `solve` nadal domknięciem (`solverAutoSelect.js:904`), wołane 1× w pętli
  `STAGES` (`:1266`).
- Stałe `SOLVER_*` istnieją (`:32-54`, 13 stałych + `DP_MEMO_MAX_ENTRIES` `:59`).
- Brak nowych zależności: `fillKregiDP` wołane 3× tylko wewnętrznie
  (`:919`, `:1093`, `:1105`); zero wołań zewnętrznych (grep).
- Zagnieżdżonych domknięć w `runJsAutoSelection`: **9**
  (`buildTopConfig`, `parseHoleClearance`, `isDrilledRing`, `fillKregiDP`,
  `fillKregiGreedy`, `findBestAvrFill`, `backtrack`, `checkConflicts`, `solve`).

## 2. Chwytane locale (dowód: ekstrakcja droga)

- `fillKregiDP` chwyta **~8** lokalsów: `kregi`, `targetDnKregi`,
  `transitionsForDP`, `dpMemo`, `DP_MEMO_MAX_ENTRIES`, `dn`, `mag`,
  `availProducts` (+ sibling `fillKregiGreedy`).
- `solve` chwyta **~20+** lokalsów: `topConfigs`, `dennicy`, `maxReqH`,
  `requiredMm`, `well`, `minDenH`, `canReduce`, `targetDn`, `redTargetFiltered`,
  `mag`, `isWkladkaZwienczenie`, `reductionPlate`, `kregi`, `targetDnKregi`,
  `availProducts`, `lastHoleRejectMsg` (zapis) + siblingi (`fillKregiDP`,
  `findBestAvrFill`, `checkConflicts`) + stałe `SOLVER_*` + helpery
  (`getTopClosure`, `resolveStudnieProduct`, `resolveDefaultWlazItem`,
  `dennicaPsiaBudaPenalty`).
- Razem distinct: **~22 locale** → param-object ~22 pól albo szeroki kontekst.
  Granice nieczyste (DP-memo per-run, `lastHoleRejectMsg` write, gałąź redukcji
  z `lift` loop). Ekstrakcja = wysokie ryzyko regresji przy zerowym zysku
  funkcjonalnym.

## 3. Testy pokrycia (8 suitów, 141 testów — WSZYSTKIE ZIELONE)

| Test                           | Pokrycie (1 linia)                                                                                                                                           |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `solverEquivalence`            | Gate P0-1: kanoniczna serializacja `runJsAutoSelection` vs golden (14 snapshotów DN×wys×przejścia×redukcja×psiaBuda×magazyn).                                |
| `solverDeterminism`            | Gate P1.6: snapshot regresyjny + determinizm pod obciążeniem (ten sam input 2× + po blokującym delay = identyczny output).                                   |
| `ringOptimizer`                | Jednostki repliki `dpRings`: target/tolerancje/zestawy kręgów/OT/brzegowe.                                                                                   |
| `ringOptimizerReal`            | Regresja F3 na PRAWDZIWYM `ringOptimizer.js` w vm: bez przejść / kolizja bez alternatywy (fallback+warn) / kolizja z alternatywą (500 vs 750) / determinizm. |
| `selection/selectionRings`     | Reguły OT-substitution + reguły scoringu layoutu (kary +20000/+50000/+100000/+5000000, priorytety).                                                          |
| `selection/selectionFiltering` | `getReductionPlate` + `filterByWellParams` (materiał/stopnie/redukcja) + kompatybilność DN↔rura.                                                             |
| `selection/selectionClosure`   | `getTopClosure` (konus/DIN/wymuszenia/sortowanie forma) + `findClosureForDn` + `zakonczenieByDn` (pamięć per-DN).                                            |
| `selection/selectionFallback`  | `getKregiList` (sort/filtr DN/styczna/height=0) + forced-items preservation + full fallback flow DN1500–DN2500.                                              |

Goldeny: `tests/studnie/__snapshots__/solverEquivalence.golden.json`,
`solverDeterminism.golden.json`.

Wynik komend:

```text
npx jest tests/studnie/solverEquivalence tests/studnie/solverDeterminism
  tests/studnie/ringOptimizer tests/studnie/ringOptimizerReal
  tests/studnie/selection --silent
→ Test Suites: 8 passed, 8 total / Tests: 141 passed, 141 total
```

## 4. Powód STOP

Liczba chwytanych lokalsów (~22) nie spadła od E4; brak nowych czystych granic.
Ekstrakcja wymagałaby param-objecta ~22 pól + przeniesienia DP-memo per-run
i `lastHoleRejectMsg` — ryzyko rozerwania goldenów (equivalence/determinism)
przewyższa zysk (plik 1520 linii to spójny proces, podział zwiększyłby
`window.*`, por. nagłówek pliku).

## 5. Warunek re-review

Re-review ekstrakcji TYLKO gdy spełnione łącznie:

1. Liczba chwytanych lokalsów spadnie do **≤ 8** (np. po hoiście
   DP-memo + list kręgów do jawnego kontekstu), ORAZ
2. `solverEquivalence` + `solverDeterminism` zielone PRZED i PO (bez regeneracji
   goldenów), ORAZ
3. Zmiana w osobnym commicie `refactor(studnie)` z pełnymi testami solvera.
