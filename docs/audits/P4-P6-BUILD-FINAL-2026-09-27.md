# P4–P6 BUILD FINAL (2026-09-27, wave 2 po P0–P3 `e46a120`)

## P4 — Excel/Studnie UX (pakiet S, po USER GO)

Zaimplementowano (3 commity):

- `59e368f` A1/A2: guardy INPUT dla Ctrl+A (natywne select-all) i Ctrl+F w wyszukiwarce (natywny find) + `tests/frontend/excelKeyboardGuards.test.ts` (4).
- `67d782f` A3/A4/A5: `_excelRowTitle` (jeden title: błąd + blokada) + snapshot undo po walidacji rzędnych + early-return pustej nazwy przed dirty + `tests/studnie/excelEditGuards.test.ts` (5).
- `f43ab14` A6/A7/A8: A6 bez zmiany kodu (lock `_excelCreatingLock` już chroni — test regresyjny dowodzi); A7 pomiar h1 + cap 5 rAF; A8 jedno podsumowanie po zakresie + `tests/studnie/excelSelectRange.test.ts` (3).
- `3045be8` audyt P4 (read-only, 3 subagenty).

Decyzje UX (GO użytkownika): tylko pakiet S; pakiet M (B9–B22) odroczony — lista w audycie.
Testy: 12 nowych + sąsiedzi (errorRefresh, undoLifecycle, wellLock, drilledRings, virtualOracle, alignment, arrowNav) zielone.
Pliki: `excelCellNavigation/TableBody/ChangeHandlers/WellActions/CellSelection/TableRenderer` (małe diffy), 3 testy.

## P5 — ML lineage

- `616fb5b` P5.1: `src/utils/datasetFingerprint.ts` (kanonizacja SSoT + SHA-256 `sok-dataset-v1:`) + delegacja `_canonicalize` w telemetryService (dedup 57/57 zielone) + `tests/datasetFingerprint.test.ts` (6).
- `366063c` P5.2: `src/utils/lineageSnapshot.ts` (koperta v1: source/createdAt/fingerprint/wersje/payload; brak mutacji; throw zamiast silent) + fingerprint i wersja kandydata z `AiTrainingRun` do `ml-status` + tooltip badge + `tests/lineageSnapshot.test.ts` (7, 8 inwariantów).
- Reguły kanonizacji: sort kluczy rekurencyjnie, sort tablic obiektów, kolejność prymitywów znacząca, semantyka JSON, prefix domenowy.
- Bez migracji (treningowy fingerprint już w `AiTrainingRun.datasetFingerprint`).

## P6 — dashboard operacyjny

- `fe8344e`: sekcja Operacje w panelu admina (`index.html` + `opsDashboard.js` 315 linii, IIFE, zero nowych globali) + style statusów (`index.css`) + `tests/frontend/opsDashboard.test.ts` (5: OK/UNKNOWN/retry/non-admin/a11y).
- Źródła: `/health`, `/health/ready`, `/api/version`, `/api/admin/system-info`, `/metrics` (w tym nowe storage), `ml-status`. Migracje: brak endpointu → UNKNOWN z notką (bez wymyślonych sygnałów).
- Test złapał realny bug przed commitem (podwójne odpakowanie `{body,headers}`).

## Regresja

- `test:quick:lite`: 337 suitów / 3499 testów PASS (start fali: 329/3460; +8 suitów, +39 testów).
- typecheck BE+FE, lint BE+FE, version:check, encoding:check (2012 plików, 0 ERROR) — PASS.
- `git diff e46a120..HEAD --check` — czysto. Migracje nietknięte (drift 0 z P0–P3).
- Nowe testy fali: 12 (P4) + 6 (P5.1) + 7 (P5.2) + 5 (P6) = **30**.

## Odroczone

- Pakiet P4-M (B9–B22) — czeka na GO z listą.
- F1–F4 z `docs/plans/BUILD_FOLLOWUPS.md` (bez zmian).
- Dashboard: brak wykresów historycznych (brak szeregu czasowego po stronie API).

## Ryzyka resztkowe

- Sticky-measure po h1: przy przyszłej zmianie struktury thead selektor wymaga aktualizacji (test A7 pilnuje limitu, nie selektora).
- `_excelSelectRange` omija `_excelSelectCell` — przy zmianie tamtej logiki zsynchronizować ręcznie (test parzystości przez stan końcowy).
