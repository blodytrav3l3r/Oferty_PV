# A2 Benchmark — kalibracja przed B (1k/5k/10k)

Data: 2026-08-31
Stan: `ea45d32` (A1-light 4/7, wizual = 14c6d09)
Skrypt: `scripts/benchmark-excel-a2.mjs` (Node, bez layout/paint)
Hardware: Win32, Node 24.18, jsdom vm, 10 runs avg per test

## Wyniki

### 1. Map vs indexOf (tabWells 70% N, avg per render)

| N     | indexOf |    Map |                      gain |
| ----- | ------: | -----: | ------------------------: |
| 50    |  0.00ms | 0.02ms | -279% (overhead malych N) |
| 200   |  0.02ms | 0.20ms |                    -1136% |
| 1000  |  0.11ms | 0.32ms |                     -186% |
| 5000  |  2.08ms | 1.20ms |                    +42.5% |
| 10000 |  8.56ms | 2.48ms |                  **+71%** |

Wniosek: O(n²) `indexOf` w `excelTableBody:73,747` znika przy 5k+; 10k `8.5→2.4ms` na sam lookup.

### 2. Snapshot polling 200→500ms (per snapshot, 100 runs avg 211µs@1k, 2359µs@10k)

| N     | per snap | 200ms interval work | 500ms | mniej wakeups |
| ----- | -------: | ------------------: | ----: | ------------- |
| 1000  |    213µs |                936× | 2341× | 2.5×          |
| 5000  |   1007µs |                198× |  496× | 2.5×          |
| 10000 |   2359µs |                 85× |  212× | 2.5×          |

2× mniej CPU przy 500ms + watchdog `_excelDirty` (R4).

### 3. Memo `_excelBuildComponentColumns` (1000 calls, 3 prod)

`no-memo 27.0ms` → `memo 8.6ms` **+68.2%** — filtr 800 produktów → O(1) przy powtarzalnym DN.

### 4. DOM tbody generation (HTML string only, bez parse/layout/paint)

| N    |   czas |            html | ~cells (7+cols) |  perRow |
| ---- | -----: | --------------: | --------------: | ------: |
| 50   |  7.1ms |           605KB |             450 | 0.142ms |
| 200  |  8.5ms |          2397KB |            1800 | 0.043ms |
| 1000 | 61.3ms | 11961KB (~11MB) |            9000 | 0.061ms |
| 5000 |  323ms | 59915KB (~58MB) |           45000 | 0.065ms |

Ekstrapolacja 10k: **~646ms sam string + parse/layout/paint >1s, html ~120MB, ~90k komórek (7 sticky + ~38 comp + 4\*przejscia)** — GC + layout thrash, 60fps niemożliwe. Potwierdza: **virtual B wymagane** (render ~50 wierszy, nie 10k).

## Gate A2

A2 nie głosuje _czy_ B, tylko _co_ B musi rozwiązać:

- **Map/memo/polling/debounce (A1-light) wystarczą dla 1k**, ale **nie rozwiązują DOM 500k TD** przy 10k.
- **Sticky 7 i szerokości (`14c6d09`) pozostają wąskim gardłem layoutu** — `table-layout:fixed` + `max-content` i virtual `~50 rows` to jedyna droga do 60fps.
- **Real browser longtask/frame budget** wymaga dodatkowego pomiaru w Chrome (`public/benchmark-excel-a2.html` — `PerformanceObserver(longtask>50ms)` + `rAF` dropped frames + `performance.memory` jeśli dostępne) — ten skrypt to kalibracja bez layout, liczby layout/paint będą wyższe.

## Rekomendacja

Przejść do **B — virtual prototyp** na branchu `feature/excel-virtual` z flagą `?virtual=1`, `excelVirtual.js` + `excelTableBodyVirtual.js`, `filteredIndexes[logical→wellIdx→well]`, selection `range`, clipboard model-driven, focus/IME P0, semantic oracle `legacy vs virtual` (identical TSV). A1-light zostaje w `main` jako baseline.
