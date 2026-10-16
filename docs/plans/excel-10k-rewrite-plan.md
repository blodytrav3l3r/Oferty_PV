# Excel 10k — audyt + plan rewrite (700 wierszy → 1.6GB RAM)

**Wersja:** 1.0 — 2026-10-16
**Status:** PLAN (nie wykonywać bez GO)
**Decyzja usera:** C) rewrite od podstaw, cel 4GB/stary i3-i5, wszystkie funkcje jak dziś
**Tryb:** evidence-first (CLAIM → EVIDENCE → VERIFY → ACT)

> Uwaga ADR: pełna normalizacja JSON to dziś zakazany kierunek (AGENTS.md).
> Plan NIE łamie zakazu: blob zostaje SoT + sidecar/chunki.
> Pełna normalizacja (tabela `well`) tylko za jawną decyzją zmieniającą ADR.

## 1. Evidence ledger

| ID    | Twierdzenie                                                       | Dowód                                                                                     | Status   |
| ----- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | -------- |
| E-001 | Full `innerHTML` całej tabeli na akcje strukturalne               | `public/js/studnie/excelTableRenderer.js:290`                                             | VERIFIED |
| E-002 | AutoFit O(C×R) `measureText` + write per cell na każdy render     | `excelTableRenderer.js:297,499-581,604-611`                                               | VERIFIED |
| E-003 | Sticky O(N×7) query + `offsetWidth` + walk + retry rAF×5          | `excelTableRenderer.js:713-764`                                                           | VERIFIED |
| E-004 | `lucide.createIcons` na cały kontener per render/slice            | `excelTableRenderer.js:306-308`, `excelVirtual.js:676-680` + ~40 miejsc                   | VERIFIED |
| E-005 | Virtual live, ~75 wierszy, kill-switch `?virtual=0`               | `excelVirtual.js:11-16,365-371,643,739-787`                                               | VERIFIED |
| E-006 | Wiersz ~120-180 nodes (35-45 td, ~20 input, ~8 selectów, 4 ikony) | `excelTableBody.js:302-694`, `excelHelpers.js:719-775`                                    | VERIFIED |
| E-007 | Dup-colors N×querySelector = O(N²) per flush/poll                 | `excelTableBody.js:1023-1117`                                                             | VERIFIED |
| E-008 | Polling 1s: snapshot N wells + N×getElementById                   | `excelPolling.js:14-33,61-96`                                                             | VERIFIED |
| E-009 | Paste ≥100 chunk 200/rAF, 1 render finalize, solver tylko last-5  | `excelCopyPaste.js:1145-1148,1215-1223,544-560,605-626`                                   | VERIFIED |
| E-010 | Brak Workera w całym `public/`                                    | grep `Worker` puste; `calculationPipeline.js:1-40`                                        | VERIFIED |
| E-011 | Solver O(N×(C×M+P²)): linear find + kaskada preco + triple-pass   | `actionsWellPricing.js:475-549`, `precoCalcCore.js:144-269`, `pricingCalculator.js:29-62` | VERIFIED |
| E-012 | BE: 1 oferta = 1 wielki JSON blob, brak tabeli well               | `prisma/schema.prisma:356,484`, `studnieCrud.ts:830,462-473`                              | VERIFIED |
| E-013 | Limit 50MB, komentarz ~3000 studni ~10MB                          | `src/mountRoutes.ts:67-68,50-53`                                                          | VERIFIED |
| E-014 | Zapis = 1 tx 30s na single-writer SQLite                          | `studnieCrud.ts:890-909`, `hotTx.ts:7`, ADR-012                                           | VERIFIED |
| E-015 | Telemetry do 50 POSTów per save, BE per-well 2×create+lock        | `offerSave.js:340-341`, `telemetryBridge.js:170-196`, `telemetryService.ts:101-224`       | VERIFIED |
| E-016 | Diagram: 1 SVG na stronę, nie per wiersz                          | `studnie.html:176-181`, `diagramRenderer.js:309-312`                                      | VERIFIED |
| E-017 | Undo gate N>100, prefs tylko w LS, draft cap 4MB + jawny quota    | `excelUndo.js:116-146`, `draftStore.js:18,302-332`                                        | VERIFIED |
| E-018 | Bench: virtual ON 1k 15s→1.5s, 5k-throttle 300s→4.9s, DOM ~12k    | `bench-*.json`, `docs/PERF_BASELINE.md:24-35`                                             | VERIFIED |

## 2. Niewinni (mity obalone)

- Paste NIE blokuje UI (batch 200/rAF, E-009).
- Undo NIE kopiuje 700 (gate N>100, E-017).
- Diagram NIE renderuje 700 SVG (1 SVG current well, E-016).
- `window.*` to rejestracje celowe; wiersze na delegacji `data-csp`; `onclick` inline = 0.

## 3. Root cause rank (dlaczego 1.6GB)

1. DOM/wiersz ×700 — baza RAM (E-006). Header 3 rzędy zawsze full + akcje strukturalne full-renderem (E-001).
2. AutoFit + Sticky + Lucide per render — CPU freeze, sync layout (E-002/003/004). Na i3 boli bardziej niż RAM.
3. Dup-colors + filtr + locked-rows O(N²) (E-007).
4. Polling 1s + summary bez guarda (E-008).
5. Solver main-thread O(N×C×M), linear `find` 824 produkty ×10 itemów ×700 ≈ 5.7M porównań/recalc (E-011).
6. BE: blob + sync Zod + 30s tx + 50× telemetry. 700 przeżyje, 10k padnie (E-012/013/014/015).

## 4. Nowa architektura (rewrite, wszystkie funkcje zachowane)

UX bez zmian: paste TSV, Ctrl+A O(1), search, sort, filtr, solver live, diagram 1 SVG, undo.
Silnik pod spodem nowy. Zero nowych globali; ESM + delegacja (legacy surface — nie powiększać).

### 4.1 FE: ExcelGrid v2

- `WellStore`: dane w `Map<id,well>` + typed arrays, model SoT (nie DOM).
- Jeden `<table>` tylko viewport (~40 wierszy) + spacery `top/bottom`, `ROW_HEIGHT 32` stałe.
- Pool komórek (recycle `td/input`), brak `innerHTML` per slice.
- Sticky: czysty CSS `position:sticky`, zero JS walk/`offsetWidth`.
- AutoFit: mierz tylko viewport + cache klucz `dn|cols`; nie per add/delete.
- Ikony: sprite inline `<svg><use>` zamiast `lucide.createIcons(root)` (1× parse).
- Nawigacja: zachować `_excelVirtualActiveCell {row,col}`; dodać `aria-rowcount/rowindex`, `aria-busy` w trakcie slice.
- `content-visibility:auto` na wierszach jako pas bezpieczeństwa.
- `SolverWorker` (dedicated worker): `calcWellStats + pricing + preco` off-main-thread, chunk 200, indeks `Map<dn|nazwa,produkt>` zamiast linear `find`. Fallback sync.
- Usunąć triple-pass w `pricingCalculator.js` (2× liczenie wagi).
- Paste: zostaje batch 200/rAF + 1 render finalize; copy Ctrl+A model-driven.
- Undo: command log (operacje), nie snapshoty. Cap 50 kroków.

### 4.2 BE: blob SoT + sidecar (bez łamania zakazu)

- `offers_studnie_rel.data` / `orders_studnie_rel.data` ZOSTAJĄ.
- Nowe: `offer_well_index(offerId, wellIdx, dn, name, hash, price)` + `offer_chunks(offerId, idx, json)` (500 wells/chunk).
- Endpointy:
    - `GET /api/offers-studnie/:id/wells?offset&limit` (strona 200),
    - `PATCH .../wells:append` (bulk append),
    - `PATCH .../wells:range` (slice update),
    - `POST /api/telemetry:batch` (1 req zamiast 50, BE `createMany` w 1 tx).
- Zod: `wells.max(10000)` + walidacja chunków (async), limit 50MB zostaje, typowy save <500KB.
- Export XLSX/PDF: stream/generator zamiast string-concat (`minimalXlsx.ts:43-53`); kolejka poza requestem.
- Migracja `2026XXXX_well_index` idempotentna + backfill z blobów w tle.

### 4.3 UI/UX na słabe maszyny

- Virtual scroll ZOSTAJE (paginacja odrzucona: psuje copy/paste, Ctrl+A, numerację — decyzja `2026-08-31-excel-wirtualizacja-10k.md:15`).
- Preview diagram debounce 90→250ms pod `THROTTLE_X4`/słabym CPU.
- Polling 1s → event-driven gdy Excel otwarty.
- `prefers-reduced-motion` respektowane (już jest w `style.responsive.css`).

### 4.4 Security

- Paste dziś `text`-only + escape przy renderze (`excelTableBody.js:380-381`, `excelPasteMismatch.js:517-594`) — ZACHOWAĆ, nie regresować.
- Nowy `text/html` paste (opcjonalny) tylko przez sanitizer.
- Atrybuty zawsze `escapeHtmlAttr`/`escapeJsStr`, nigdy `escapeHtml` (błąd #39).

## 5. Fazy

- **P0 hotfix (2-3 dni, ulga przy 700):** scope `createIcons` do nowych nodes; sticky tylko viewport + rAF throttle; preview debounce adaptacyjny; polling→event gdy Excel open; `Map` indeks produktów; telemetry cap 50→20.
- **P1 worker+store (1 tydz):** `WellStore` + `SolverWorker` + usunięcie triple-pass.
- **P2 grid v2 + BE bulk (1-2 tyg):** pool komórek, sprite SVG, `wells:range/append`, `telemetry:batch`, chunki/sidecar, aria-rowcount.
- **P3 10k hardening:** harness 10k-throttle-x4, axe na otwartym Excelu, draft chunkowany, eksport stream.

## 6. Bramy i testy

Istniejące: `test:bench`, `test:openperf`, `perf:baseline`, `test:parity`, `test:golden`, `throttleHelper.cjs` (CPU×4).
Bramy z `PERF_BASELINE.md`: DOM ON ~12k, open 1k <2s, 5k-throttle <6s.
Nowe bramy 10k-throttle: open <10s, edit <2s, RAM <600MB (maszyna 4GB).
Plus: axe na Excelu 1k ON, test Tab-trap 10k.

## 7. Ryzyka / ADR

- Pełna normalizacja (`well` jako tabela zamiast blob) WYMAGA zmiany ADR — nie w tym planie.
- `connection_limit 1-3` + single-writer: długie tx znikają dzięki chunkom, ale backfill robić w tle.
- Eksport 10k w RAM dziś — stream obowiązkowy przed P3.

## 8. Następny krok (po GO)

`P0.1 scope createIcons` → `test:bench + test:openperf` → diff → commit `scripts/commit.mjs`.
Każda faza za osobnym GO. Bez GO nic nie ruszać.

## 9. Aktualizacja v1.1 — batch weryfikacyjny 6 subagentów (2026-10-16)

Baseline: `typecheck` PASS, `typecheck:frontend` PASS, `test:quick:lite` PASS (4804 pass / 0 fail). Repo green.

### 9.1 Korekty tez (dowody z batcha)

- Klik wiersza: `recalculateWellErrors` **0×**, `calcWellStats` **1×** (aktywna studnia, cache), `refreshAllWellErrors` **0×**, `renderWellsList`/`renderDiscountPanel` **0×** — guard `_renderingWellsList` działa (`excelModal.js:640-648`, `wellUI.js:434-442`). Teza „~3N recalcs per klik" ODRZUCONA.
- E-015 skorygowane: worst case to ~100 POSTów (50 config + 50 acceptance + 1 batch), nie 50. Kolejka 2/50 + breaker VERIFIED.
- Virtual Excela default ON VERIFIED (brak klucza = ON). Virtual listy default ON VERIFIED (n>500 to enforcement pod opt-outem, nie próg).
- Bypass patcha virtual: BRAK (referencje lokalne, restore, jedyny fallback `wellVirtual.js:504-505`).
- E-002 (AutoFit per render) ODRZUCONE — cache `_excelLastFitKey` istnieje.

### 9.2 Top finding: `JSON.stringify(wells)` per klik [HIGH]

`wellUI.js:26` `_wellUISumFp` buduje pełny string N=700 per `updateSummary` (wołane z `_excelSyncMainPreview` per klik) + trzyma w `_sumFp`. O(N) MB churn per klik. Fix F1: rev-counter z `_wellUIPatchInvalidation`/`_excelMarkDirty` zamiast stringify.

### 9.3 Fixy F1-F8 (zysk/ryzyko malejąco, bez kodu)

- F1: fingerprint stringify → rev-counter (`wellUI.js:26,285`). Ryzyko średnie.
- F2: `refreshAllWellErrors` N→1 w preview, dirty-set + visible-only (`wellVirtual.js:507`, `solverValidation.js:610`). Ryzyko nisko-średnie.
- F3: `renderDiscountPanel` skip za overlayem + debounce + reuse cache (`wellUIHelpers.js:33`). Ryzyko niskie.
- F4: diagram per klik → debounce + visible-only, flush na close (`excelModal.js:652`). Ryzyko niskie.
- F5: polling N×DOM → tylko widoczne wiersze (`excelPolling.js:61`, `excelTableBody.js:1056`). Ryzyko niskie.
- F6: transport fingerprint O(N) per scroll → cache/rev (`wellVirtual.js:29,402`). Ryzyko średnio-niskie.
- F7: lucide per slice → tylko nowe ikony (`excelVirtual.js:676`, `excelTableRenderer.js:306`). Ryzyko niskie.
- F8: h3 kody + totals → memoizacja Map (`excelHelpers.js:605`). Ryzyko minimalne.
- Skipped: normalizacja blob, paginacja, worker, nowe globale.

### 9.4 P-1 reprodukcja (user, DevTools)

P-1.1 heap snapshot przed/po 10 klikach (delta/klik + detached). P-1.2 Performance trace klik+scroll (CPU 4×). P-1.3 odczyt `sok_excel_virtual` z Local Storage + `test:parity`. P-1.4 Network: payload MB + liczba POST telemetry. P-1.5 agent: `test:bench`, `test:openperf`, `perf:baseline`, `THROTTLE_X4=1` warianty.

### 9.5 Paczki kodu (każda osobne GO)

- Paczka 1 (proponowana): F1 + F6 (ten sam mechanizm fingerprint, średnie ryzyko).
- Paczka 2: F5 + F7 (visible-only + lucide scope, niskie ryzyko).
- Paczka 3: F2 + F3 + F4 (preview/discount/diagram, nisko-średnie ryzyko).
- Progi: open 1k <2s, 5k-throttle <6s, DOM ON ~12k. Bramy: `version:check` + `validate`, commit `scripts/commit.mjs`.
