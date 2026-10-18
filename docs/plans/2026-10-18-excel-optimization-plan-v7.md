# Plan optymalizacji Excela (Studnie) — v7 (F2.5 naprawione, F4#2 wdrożone, F4#1 odrzucone dowodem)

> **Status:** P0-C ✅ WDROŻONE+I ZMIERZONE · F2.5 ✅ NAPRAWIONE (utrata danych) · F4#2 ✅ · F4#1 ❌ ODRZUCONE (profil) · F1 ❌ REVERT (no-win).
> **Supersedes:** v6. Cel: każda kategoria ≥ 8/10. Zasady: pomiar-gated, SSoT-reuse, revert/no-build-on-no-evidence.

## A. Zmiany statusów względem v6

| ID       | v6                       | v7 (dowód)                                                                                                                    |
| -------- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| F0       | ✅ zmierzone             | ✅ bez zmian (`baseline-excel-heap-f0.json`; harness + `tab`/`split`/`profile`)                                               |
| F1       | gotowe do implementacji  | ❌ **REVERT** — cache recalc dał `recalcMs=0` (zero win). 8 plików czystych vs HEAD                                           |
| P0-C     | —                        | ✅ **WDROŻONE** (`2db4b95`) — guard podwójnego renderu body. openMs ~940→677 (−25%), switch ~1518→1167 (−23%)                 |
| F2.1/2.2 | DROP                     | DROP (bez zmian)                                                                                                              |
| F2.4     | telemetria/413           | ⚠️ **DOWNGRADE** — limit serwera 50 MB vs realny max 16.23 MB → 413 praktycznie nierealny. Zostaje tylko komunikat 413 + hint |
| F2.5     | HIGH (do naprawy)        | ✅ **NAPRAWIONE** — uczciwy komunikat, brak podmiany formularza 409 bez draftu, jawny hint oversize/quota w toastach          |
| F3.2     | done                     | ✅ potwierdzone (423/409 w `offerSave`)                                                                                       |
| F4#1     | TOP (memoizacja headera) | ❌ **ODRZUCONE PROFILem** — patrz sekcja C (nie jest kosztem dominującym)                                                     |
| F4#2     | LOW risk                 | ✅ **WDROŻONE** — O(all-wells) → SSoT `_excelGetFilteredIndexes()` (fast-path bez query); golden hash-neutral                 |
| F5       | dead-code                | ❌ VOID — `excelTableManager.js:556` jest live                                                                                |

## B. F2.5 — cicha utrata danych (naprawione, HIGH)

**Problem (FACT):** `DRAFT_MAX_BYTES=4000000` (`draftStore.js:18,310`); ~20–25% realnych ofert >4 MB (prod backup: 3/14). Oversize → `{ok:false,reason:'oversize'}`, toast raz i **tłumiony przy flush** (`draftAutosave.js:823-829`). `offerSave.js` w 423/409/401 twierdził „Niezapisane zmiany zachowane w drafcie" **mimo braku draftu**; 409 dodatkowo **podmieniał formularz** (`:302-303`) → praca przepadała po cichu.

**Fix (`offerSave.js`):**

- `_draftAvailableForOffer()` — SSoT klucza `draftStore.buildDraftKey(userId,'offer_studnie',docId)` + `loadDraft().status==='ok'`.
- `_lostWorkMessage(prefix)` — draft jest → „…zachowane w drafcie"; nie ma → „Draft NIEDOSTĘPNY (oferta zbyt duża) — SKOPIUJ zmiany ręcznie".
- **409 bez draftu: `return false` PRZED podmianą formularza** (nie niszczymy niezapisanej pracy).
- 401: dopisek ostrzegawczy gdy brak draftu. 413: komunikat o limicie 50 MB.
- `draftAutosave.js`: komunikaty oversize/quota mówią wprost „NIE zostanie zapisany; chroń się jawnym zapisem (Ctrl+S)".

**Świadomie pominięte:** chunking draftu per-studnia (duże/ryzykowne) — jeśli ~25% ofert ma faktycznie ginąć przy awarii, dodać; obecnie fix usuwa _ciszę_, nie _limit_.

## C. F4 — dlaczego ODRZUCAMY memoizację headera (dowód z profilu)

Profil `HEAP_PROFILE=1` @2000 (przełączenie zakładki, total 999 ms instrumentowane):

| Funkcja                       | ms (acc) | cnt |
| ----------------------------- | -------- | --- |
| `_excelVirtualRenderBody`     | 217      | 1   |
| `_excelRenderTbody` (stub)    | 30       | 1   |
| `_excelApplyColWidths`        | 21       | 3   |
| `_excelApplyStickyColumns`    | 21       | 3   |
| `_excelAutoFitColumns`        | 12       | 1   |
| `_excelUpdateHeaderProdCodes` | 1        | 1   |
| **suma zmierzona**            | **304**  | —   |
| **nieprzypisane**             | **~695** | —   |

**Wniosek (FACT):** dominujący koszt to `container.innerHTML = html` — build stringa + parse + reflow tabeli z ~204 komórkami nagłówka (~695 ms), oraz budowa wierszy body (217 ms). Memoizacja _stringa_ headera (F4#1) oszczędza tylko concat/`compCols` — ułamek. Realny zysk wymagałby **ponownego użycia węzłów DOM nagłówka** (swap per DN) — duża, ryzykowna zmiana → **nie teraz** (brak dowodu proporcji zysku; SLO i tak nieosiągalne).

**Pozostaje jako opcja w przyszłości** (gdy zyski potrzebne): F4#5 (szablon wiersza — 217 ms), F4#4 (`EXCEL_OVERSCAN` 20→6), oraz trwały nagłówek DOM. Kandydat tani: dedupe 3× wywołań `_excelApplyColWidths`/`_excelApplyStickyColumns` (~42 ms).

## D. F4#2 — wykonane (SSoT-reuse)

`excelHelpers.js:611-634`: skan O(all-wells) zastąpiony `_excelGetFilteredIndexes()[0]` (cache per tab+query). Fast-path **tylko przy pustym query** (wtedy filtered = studnie zakładki w kolejności `wells` → element 0 === pierwsze trafienie pętli); przy query — fallback skan (semantyka 1:1). Golden hashe bez zmian → potwierdzona neutralność.

## E. Bramki (po zmianach)

| Bramka                              | Wynik                                                                                                                                                         |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `node -c` (3 pliki)                 | ✅ 0                                                                                                                                                          |
| `test:golden`                       | ✅ OK — 6 zakładek, hashe bez zmian, sensitivity OK                                                                                                           |
| `test:parity`                       | ✅ OK — wszystkie PASS (OFF==ON)                                                                                                                              |
| `jest tests/studnie tests/frontend` | ✅ 222 suites / **2454** testy PASS (+4 nowe F2.5)                                                                                                            |
| `lint:frontend`                     | ✅ 0                                                                                                                                                          |
| `typecheck:frontend`                | ✅ 0                                                                                                                                                          |
| `format`                            | ✅ 0                                                                                                                                                          |
| `encoding:check`                    | ✅ ERROR 0 (3 WARN pre-existing, `requestLogger.ts`)                                                                                                          |
| `test:axe`                          | ⚠️ **ENV-BLOCKED** — login fail: brak `prisma/test-playwright.sqlite` (izolowana E2E DB nie zaseedowana lokalnie). Nie regresja (diff bez zmian markupu/auth) |

**Nowy test:** `tests/studnie/offerSaveDraftGuard.test.ts` (4 PASS) — draft jest/nie ma/brak modułu/brak usera.

## F. SLO — stan

| Metryka        | SLO    | @2000 po P0-C         | Status                     |
| -------------- | ------ | --------------------- | -------------------------- |
| openMs         | ≤800   | 677                   | ✅ PASS                    |
| ltMax          | ≤200   | ~1.1–2.4 s            | ❌ FAIL (potrzeba F4#5/#4) |
| tabMs net@2000 | ≤300   | ~1.17 s→po F4#2 mniej | ❌ FAIL (innerHTML parse)  |
| heap@open      | ≤18    | 11.4 MB               | ✅ PASS                    |
| retention      | stable | plateau               | ✅ PASS                    |

## G. Otwarte (nie-blokujące)

1. **F9:** podpiąć SLO `excelHeapProbe` do CI (nightly istnieje, advisory).
2. **F6.1:** `role="grid"`/`aria-rowcount` w `public/js/studnie`.
3. **F7.2:** 54 puste `catch{}` w `public/js/studnie`.
4. **Axe lokalnie:** zaseedować izolowaną E2E DB (`PLAYWRIGHT_DATABASE_URL`) by bramka działała poza CI.
5. **Q6:** prod snapshot dla `wellcount-stats.mjs` (wciąż HYPOTHESIS: projekt 3000).
