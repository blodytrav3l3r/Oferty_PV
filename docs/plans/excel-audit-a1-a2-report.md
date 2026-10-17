# Audyt Excel — Etapy A1–A6 — raport

Data: 2026-10-17 · HEAD audytu: `456d541` · wersja: 1.46.0
Zakres: Studnie / Excel grid (`public/js/studnie/excel*.js`). Tryb: read-only + fixy A2/A3.

## A1 — Baseline (ŚWIEŻY, po `npm run build`)

| Metryka (1200 studni, F1 harness, virtual ON) | COLD        | WARM |
| --------------------------------------------- | ----------- | ---- |
| openMs                                        | 1008        | 875  |
| open-total (render)                           | 630         | 500  |
| innerHTML                                     | 63          | —    |
| **sticky**                                    | 8.8         | 6.5  |
| scroll frame                                  | 384         | —    |
| pollSnapMs / pollSyncMs                       | 0.3 / 0.9   | —    |
| editManualMs                                  | 1260        | —    |
| tabMs (1200–2500)                             | ~1.2–1.35 s | —    |

Bench DOM: ON n=1000 → open 573 ms / edit 1223 ms / DOM 13453 (stałe w cyklu scrolla).
OFF n=1000 → open 8133 ms / DOM 139511.

Bramki: `test:parity` 31/31 · `test:golden` DOM GOLDEN OK (SHA stały per zakładka).
Backupy pre-a1: `*.pre-a1.json`.

### Rozstrzygnięcie „sticky 221 ms"

`baseline-excel-open-1200.json` **legacy** = renderer OFF (pełny render 1200 wierszy):
sticky 221 ms / scroll-sticky 209 ms. **Domyślna ścieżka (virtual ON)** = sticky **8.8 ms**.
→ E-04 (sticky CSS) i E-06 (polling, 0.3/0.9 ms) — **ODRZUCONE** dla ścieżki domyślnej.
REALNE koszty domyślne: open-innerHTML (~63 ms) + przełączanie zakładek (~1.2–1.35 s).

## A2 — Korekta danych

Ground truth: wszystkie testy (2450) były **ZIELONE** na HEAD. Część zarzutów audytu
była już pokryta, część nieaktualna.

| Trop audytu                        | Weryfikacja                                            | Status       |
| ---------------------------------- | ------------------------------------------------------ | ------------ |
| Heurystyka nagłówka (`hits>=3`)    | `excelHeaderHeur.test.ts` (T1–T7) zielone              | POKRYTE      |
| Cichy `0` / pusty — ceny katalog   | price non-null (`Float @default(0)`) → brak realnego 0 | OK           |
| PRECO `return 0` (`precoCalcCore`) | 0 = brak konfiguracji PRECO (nie błąd); walidacja na   | OK (0 legal) |
|                                    | poziomie studni (`hasPricingError`/stats.error)        |              |
| Mapping paste (off-by-one, grup)   | `excelPasteMismatch`/`excelMultiColumnPaste` zielone   | POKRYTE      |
| **Cichy drop wiersza bez nazwy**   | `excelTableManager.js:642` `if(!name) return;`         | **FIX**      |

### FIX A2 — raport pominiętych wierszy bez nazwy

`_excelPasteCreateWells`: wiersz bez nazwy nie może powstać jako studnia, ale był
gubiony CICHO (bez licznika, bez komunikatu). Zmiana: licznik `skipped` + toast
(`warning`) przy pełnym i częściowym dropie. Kontrakt:
`tests/studnie/excelPasteSkipNamelessReport.test.ts`.

- Diff: `excelTableManager.js` (3 miejsca, additive). Zero zmian ścieżki renderu.
- Regression: studnie+frontend **2452 PASS** (+2), eslint clean, typecheck:frontend clean.

## Wnioski (skorygowane vs. audyt)

1. Excel jest zdrowszy niż sugerował audyt — virtual ON domyślnie, sticky/polling tanie.
2. Rewrite = **NO-GO** (potwierdzone pomiarem: open-total 630 ms, DOM 13.4k).
3. Realne cele optymalizacji (A4): open-innerHTML + tab-switch, nie sticky/polling.

## A3 — Bezpieczeństwo (security-reviewer + lock testy)

Postawa oceniona jako **mocna**. Formula-injection i path-traversal = nie-dotyczy
z konstrukcji. Realny gap: **brak `.max()` na tablicach wejściowych** (DoS).

| Kategoria                       | Werdykt | Dowód                                                   |
| ------------------------------- | ------- | ------------------------------------------------------- |
| Formula/CSV injection (eksport) | CLEAN   | BE `inlineStr`, FE `json_to_sheet`→`str`; brak CSV      |
| XSS (innerHTML)                 | CLEAN   | wszystkie sinki przez `escapeHtml`/`Attr`/`textContent` |
| AuthN/AuthZ + CSRF              | CLEAN   | `requireAuth` + same-origin CSRF + rate limiter         |
| Path traversal / temp write     | CLEAN   | brak uploadu serwerowego; nazwy `safeExportPart`        |
| eval/new Function               | CLEAN   | brak na danych z XLSX                                   |
| **DoS (rozmiar wejścia)**       | **FIX** | `wells`/`components`/`passages`/batch bez `.max()`      |

### FIX A3 — limity tablic (M)

`src/validators/offerSchemas.ts`: `MAX_WELLS_PER_OFFER=5000` (= cap UI `XLSX_IMPORT_MAX_ROWS`,

> udokumentowany sufit ~3000 studni), `MAX_COMPONENTS_PER_WELL=5000`,
> `MAX_PASSAGES_PER_WELL=500`, `MAX_OFFERS_PER_BATCH=1000`. Egzekwowane przez `validateData`.
> Testy: `tests/offerSchemasLimits.test.ts` (granica/ponad), lock formula-injection:
> `tests/minimalXlsx.test.ts` (+1) i `tests/frontend/xlsxExportInjection.test.ts`.

- LOW (bez zmian, świadome): `.passthrough()` (mass-assignment blob, brak XSS bo render escapuje);
  vendored SheetJS 0.20.3 poza `package.json` (niewidoczny dla Dependabot).

Bramki A3: 15/15 PASS (nowe), `typecheck` BE clean, `lint` BE clean,
smoke `test:quick:lite` **4865 PASS / 0 fail**. Zero zmian ścieżki renderu.

## A4 — Profilowanie (PRZED optymalizacją; wniosek: open jest paint-bound)

Rozbicie stage'ów (cold, 1200, virtual ON) rozstrzyga, gdzie jest koszt:

| Warstwa                                                            | Wartość                             | Natura                            |
| ------------------------------------------------------------------ | ----------------------------------- | --------------------------------- |
| CPU render (jeden przebieg: prepare+tbody+innerHTML+lucide+sticky) | ~120 ms                             | nasz JS                           |
| CPU open (open-prep+overlay+errors+tabs+maxtr)                     | ~54 ms                              | nasz JS                           |
| **`frame`** (rAF: layout/paint)                                    | **206 avg / 407 max**               | przeglądarka                      |
| open-total                                                         | 630 ms                              | = ~175 ms CPU + ~455 ms rAF/paint |
| scroll: render `total`                                             | 143 ms                              | nasz JS                           |
| **scroll: `frame`**                                                | **384 ms**                          | przeglądarka (dominuje)           |
| DOM / wiersz                                                       | ~13.4k / ~198 nodes (68 widocznych) | paint cost                        |

**Wniosek**: `open` (630 ms) jest **paint/rAF-bound**, nie CPU-bound (`frame` 206 ms > render 122 ms).
Optymalizacja samego JS da mało. Realny jank = **scroll `frame` 384 ms** (paint od ~13.4k węzłów +
`_excelApplyColWidths` przepisuje szerokości na każdą komórkę każdego slice'a — `excelVirtual.js:690`).

**tab-switch — ZMIERZONE** (instrumentacja A4 w `excelTabs.js` + `tabStages` w harnessie, `?perf=1`):
`switch-recalc` = **13,8 ms** → hipoteza O1/recalc **ODRZUCONA** (nie jest kosztem).
`switch-render` = **937 ms** = **3× ten sam slice render** (`total` count=3, ~143 ms JS każdy =
~429 ms) + paint `frame` 352 ms. Źródła (3 wywołania `_excelVirtualRenderBody`): `excelVirtual.js:795`
(buduje spacery) + `:806` (po restore scroll) + rAF `OnScroll` `:460` — **dwa ostatnie malują ten sam
slice (duplikat)**.

### Opcje A4 (ranking) — DO GO

| #       | Zmiana                                                                              | Zysk                                               | Ryzyko                                    | Golden/parity                        |
| ------- | ----------------------------------------------------------------------------------- | -------------------------------------------------- | ----------------------------------------- | ------------------------------------ |
| ~~O1'~~ | Skolapsować 3× render slice → 1–2 (`excelVirtual.js:790-808`) — **PRÓBA: cofnięte** | struktura 3→2 ✓, wall-clock **0** (paint dominuje) | n/a                                       | golden OK, parity OK, ale brak zysku |
| O2      | Mniej węzłów/wiersz + szerokości przez CSS zamiast inline per-komórka               | −scroll jank (frame 384 ms)                        | HIGH (prot. renderer + `golden --update`) | zmiana DOM                           |
| O3      | Mikro: cache map szerokości                                                         | ~0                                                 | LOW                                       | safe                                 |

**Rekomendacja (po realnej próbie O1')**: O1' **przetestowane i COFNIĘTE** — strukturalnie 3→2
`RenderBody` (`forcedTop` = render zapisanego slice w jednym przebiegu), DOM **bajt-identyczny**
(`test:golden` OK, parity 31/31, 2454 PASS), ALE `tabMs` 1200 **nie spadł** (cold 1350→1549 ms; JS
`total` ~172 ms ginie w szumie paintu). Wniosek pomiarowy: wąskie gardło to **paint** (~350–1000 ms/
frame), nie redundantny render → prawdziwa dźwignia to **O2** (mniej węzłów / szerokości CSS zamiast
inline per-komórka). O1' w izolacji = wymiana JS bez zmiany paintu (YAGNI). Kod przywrócony do HEAD.
**Stan A4**: werdykt pomiarowy + bezpieczna instrumentacja (`?perf=1`-gated: marki `switch-*` w
`excelTabs.js`, `tabStages` w harnessie; 0 wpływu na DOM — golden/parity/studnie PASS). Fix renderu
świadomie NIE wdrożony (brak zmierzonego zysku).

## A5 — UX: komunikat o pominiętych wierszach (import/paste)

Pokryte przez fix A2 — **bez nowego kodu**. Weryfikacja ścieżek:

- **Paste do grida** (`excelTableManager.js:_excelPasteCreateWells`): oba branche raportują
  pominięte wiersze bez nazwy toastem (`:706-717`; pełny drop → `warning`, partial → dodatkowy toast).
- **Import zewnętrzny XLSX** (`toolbar.js:580-654`): pełne raportowanie — `skipped` (nierozpoznany
  moduł / wszystkie wiersze odrzucone) w podsumowaniu + modal `XlsxImportShared.showRowErrors`
  dla odrzuconych wierszy (cap 50 + licznik reszty, `escapeHtml`, XSS-safe).
- **Dead-code**: `excelTableManager.js:556` `if (!name) continue;` — wejście pre-filtrowane
  (`.filter(l => l)` :546-548) → nieosiągalne, brak cichego dropu.
  Wniosek: brak kolejnego cichego pominięcia; A5 = **satisfied** (opcjonalny upgrade toast→panel
  jako przyszłość, YAGNI).

## A6 — Regresja + architektura

Bramki (na realnym diffie A2/A3 + instrumentacja A4):

- `npm run version:check` → **EXIT=0** (spójne wszystkie źródła).
- `npm run encoding:check` → **EXIT=0** (2341 OK, 3 WARN pre-existing w `requestLogger.ts`).
- `jest tests/studnie tests/frontend` → **2454 PASS**.
- `jest` (full, 495 suites) → 4902–4916 PASS; pojedyncze suites DB/HTTP/transfer/git-safety lecą
  na **timeoucie pod obciążeniem** (10s/30s), nie na asercji. **Dowód braku regresji**: w izolacji
  `claimIdempotencyHttp` + `appNameCheck` = **19/19 PASS w 4.3 s** (vs 146 s pod loadem). Żaden
  failing suite nie dotyka zmienionych plików (frontend JS / `offerSchemas`).
- DOM: `test:golden` OK (SHA stabilne), `test:parity` 31/31.

### Architektura (mapa przepływu danych → konfigurator)

`solverValidation.recalculateWellErrors` (well → błędy) → `_excelRecalcTabWellErrors`
(`excelPolling.js:319-339`, 13.8 ms/tab, NIE bottleneck) → render (`excelTableRenderer`/
`excelVirtual` slice) → `excelTabs` (przełączenie). Wąskie gardło = **paint** (~13.4k węzłów),
nie logika ani polling → jedyna realna dźwignia wydajności to O2 (mniej węzłów + szerokości CSS).

## Zamknięcie batcha A1–A6

- Wdrożone fixy: **A2** (raport pominiętych wierszy), **A3** (limity tablic, DoS-M).
- **A4**: werdykt pomiarowy + instrumentacja (`?perf=1`); próba O1' cofnięta (brak zysku).
- **A5**: satisfied przez A2. **A6**: regresja PASS (flaky-timeouts udowodnione jako env).
- Do commita gotowe: A2 + A3 + instrumentacja A4. Do GO: O2 (paint, wymaga prod histogramu).
- Commit dopiero po `npm run validate` + `version:check` i **jawnej zgodzie**.
