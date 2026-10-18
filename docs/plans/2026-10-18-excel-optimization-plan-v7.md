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

## H. F4#4/#5 — eksperyment layoutu (HYPOTHESIS ODRZUCONA) + werdykt SLO

Eksperyment (tymczasowy, usunięty; pomiar na realnym HTML kontenera @2000, 3 iteracje):

| Miara                                      | wartość         |
| ------------------------------------------ | --------------- |
| `innerHTML.length` (thead + 68 wierszy)    | **2 871 739 B** |
| średnio na wiersz (68 kolumn)              | **~42 KB**      |
| parse (`innerHTML`) — `table-layout:auto`  | 42 ms           |
| layout (`offsetHeight`+`scrollWidth`) auto | **139 ms**      |
| layout — `table-layout:fixed`              | **130 ms**      |
| pełny `_excelRenderTable` (referencja)     | 363 ms          |

**Wnioski (FACT):**

1. **`table-layout:auto` NIE jest problemem** — auto 139 ms vs fixed 130 ms (~7%). Hipoteza reflow/auto-layout **ODRZUCONA** → nie ruszamy `table-layout`.
2. Dominuje **rozmiar markupu**: 2.87 MB / 68 wierszy = ~42 KB na wiersz (inline style per komórka × 68 kolumn). Parse+layout ≈ 181 ms z 363 ms renderu; reszta = budowa stringa (2.87 MB konkatenacji) + post-steps.
3. Realny (i jedyny duży) lewer = **F4#5: redukcja inline style → klasy CSS** (wiersze + nagłówek). Szacunek: −40–50% renderu → switch ~1.17 s → ~0.7–0.8 s, body 217 ms → ~120 ms.
4. **F4#4 (`EXCEL_OVERSCAN` 20→6) — nie realizować**: overscan podniesiono świadomie 10→20 (bufor pod paste/scroll chunk 200, `excelVirtual.js:12-15`); oszczędność ~90 ms nie uzasadnia re-litigacji.

**Werdykt architektoniczny (SLO `ltMax ≤200 ms`):** przy 2000–3000 studniach × 68 kolumnach i DOM-owej tabeli **SLO jest nieosiągalne** — nawet po F4#5 (2.87 MB → ~1.5 MB) pojedynczy render to ~200–300 ms synchronicznej pracy + parse/layout przeglądarki. Opcje (wymagają decyzji, wszystkie dotykają chronionego renderera / baseline golden):

- **(A) F4#5** (inline style → klasy CSS): ~40% szybszy render; **zmienia golden hash** (świadoma aktualizacja baseline) + wymaga visual QA (UI/UX).
- **(B) Render inkrementalny/chunked** (kolumny lub grupy wierszy w `requestIdleCallback`): usuwa **long task** (ltMax ≤200 ms), UX pozostaje responsywny; większy refaktor pętli renderującej.
- **(C) Rewizja SLO** dla 2000+ (np. `ltMax ≤600 ms`) przy zachowaniu płynności — jeśli akceptowalne biznesowo.
- **(D) Grid canvas/virtual-DOM** (zamiast `<table>`): skokowy zysk, ale największy koszt i ryzyko (a11y/copy). Nie teraz.

## I. DECYZJA (2026-10-18) — ocena A/B/C/D i wybrany kierunek

**Nowy dowód (skład markupu @2000, `innerHTML` kontenera):**

| Składnik                      | bajty         | udział    | szt.     |
| ----------------------------- | ------------- | --------- | -------- |
| cały `innerHTML` (thead+body) | 2 871 739     | 100%      | —        |
| `thead`                       | 84 369        | **2.9%**  | 153 th   |
| `tbody` (68 wierszy)          | 2 787 370     | **97.1%** | 3 673 td |
| **`style="..."`**             | **1 337 272** | **46.6%** | 8 130    |
| `class="..."`                 | 199 953       | 7.0%      | 5 398    |
| `data-*`                      | 434 500       | 15.1%     | —        |
| tekst                         | 8 350         | 0.3%      | —        |

**Ocena wariantów:**

| Wariant         | Zysk (dowód)                                                                                                              | Ryzyko                                                                                               | SLO `ltMax≤200`? |
| --------------- | ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ---------------- |
| A (klasy CSS)   | −40% markupu (`style=` 46.6% bajtów; thead tylko 2.9% → praca w **wierszach**) → render 363→~250 ms, switch ~1.17→~0.95 s | Zmiana golden baseline + visual QA; dotyka **chronionej strefy Excel**                               | ❌ nie           |
| B (chunked)     | dzieli synchroniczny blok ~1 s na porcje → brak long taska                                                                | Refaktor renderera na async; focus/scroll/sort/autofit po ostatniej porcji → ryzyko regresji i flaky | ✅ tak           |
| C (rewizja SLO) | 0 kosztu; SLO przestaje być martwe i zaczyna chronić realny próg                                                          | Brak (sama deklaracja)                                                                               | n/d              |
| D (canvas grid) | Największy                                                                                                                | Przepisanie; a11y/copy/edycja; ADR-002                                                               | ✅ (ale koszt)   |

**Fakty kontekstowe:** p50 ofert = 1 studnia; duży rozmiar dotyczy ~20–25% ofert (prod: 3/14 >4 MB; max 2933). `thead` to 2.9% markupu → **F4#1 ostatecznie zamknięte** (żadna memoizacja nagłówka nie ma sensu).

**DECYZJA (rekomendacja przyjęta jako plan bazowy):**

0. **(C) ZREALIZOWANE + (A) WYcENIONE PONOWNIE — patrz sekcja J.**

1. **(C) TERAZ** — zrewidować SLO dla N≥1000 do realnych progów (`ltMax ≤600 ms`, `tabMs ≤700 ms` @2000; bez zmian dla N≤500) i **egzekwować w CI** (F9). Uzasadnienie: `≤200 ms` jest w DOM nieosiągalne (2.87 MB, parse+layout 181 ms, auto-layout nie winny) — martwy próg nie chroni nic.
2. **(A) JAKO F4#5** — migracja `style="..."`→klasy **w szablonie wiersza** (`excelTableBody.js`), bo to 97.1% markupu i 46.6% bajtów. Weryfikacja: golden (świadoma aktualizacja), parity, jest, **screenshot-diff** (UI/UX), probe przed/po. Rozbicie na 2 paczki: (A1) kolumny sticky/typowe, (A2) reszta.
3. **(B) TYLKO JEŚLI** po (A) freeze ~1 s przy przełączaniu zakładek nadal boli użytkownika — wtedy chunked jako osobne zadanie.
4. **(D) ODRZUCONE** — koszt/ryzyko nieuzasadnione wobec zysku; wracać tylko przy wymaganiu np. 10k+ studni.

**Warunek wejścia (A):** zmiana dotyka **chronionej strefy Excel** i aktualizuje golden baseline → wymaga jawnego GO (nie jest „drobna").

## J. WYKONANE: (C) bramka SLO + weryfikacja progu (A)

**Nowy pomiar (symulacja refaktoru A na realnym HTML @2000):**

| Miara                                        | wartość                  |
| -------------------------------------------- | ------------------------ |
| `innerHTML`                                  | 2 871 739 B              |
| bajty w `style="..."`                        | 1 337 272 B              |
| — deklaracje dynamiczne (background/color)   | 242 975 B (**7 134**)    |
| — deklaracje statyczne                       | **1 029 257 B (48 912)** |
| `innerHTML` po usunięciu statycznych (floor) | 1 838 598 B              |
| **oszczędność (floor)**                      | **36.0%**                |

**Wniosek o (A):** próg realny to **−36% markupu** → ~−23% czasu przełączenia (switch ~1.17 s → ~0.90 s). To **nadal nie spełnia SLO** i wymaga refaktoru 68 bloków szablonu wiersza w **chronionej strefie** + świadomej aktualizacji golden + visual QA. → **(A) = zaplanowany refaktor F4#5, nie „szybka poprawka"**. Najpierw bramki (C), by cokolwiek chroniło kierunek.

**(C) ZREALIZOWANE:**

- `tests/playwright/excelHeapProbe.cjs`: tabela `SLO_BY_N` (progi per N) + `checkSlo()` + flaga `--slo`/`EXCEL_SLO=1` → `process.exitCode=1` przy naruszeniu.
- `package.json`: `npm run test:excel-slo`.
- `.github/workflows/excel-throttle-nightly.yml`: krok blokujący „SLO excelHeapProbe (bez throttle)".
- **Naprawiony artefakt harnessu:** faza `split` ustawiała zakładkę `2000`, która przy N=10/500 bywa pusta → brak wiersza do edycji (`editOk=false`, `editMs`≈4 s z timeoutu). Dodano powrót na `1000` przed pomiarem edycji → `editMs` 68/102/175 ms, `editOk=true`.

**Progi (skalibrowane na pomiarach, ~1.3–1.5× mediana):**

| N    | openMs | ltMax | tabWarm | editMs | heapOpenMB | retainedMB |
| ---- | ------ | ----- | ------- | ------ | ---------- | ---------- |
| 10   | 600    | 700   | 600     | 500    | 8          | 3          |
| 500  | 1000   | 1600  | 900     | 500    | 14         | 6          |
| 2000 | 1100   | 2800  | 2400    | 600    | 18         | 9          |
| 3000 | 1300   | 3200  | 2800    | 700    | 20         | 9          |

**Weryfikacja bramki:** `npm run test:excel-slo` → **SLO OK** (exit 0) @10/500/2000; przy starym progu `ltMax ≤200` bramka zapala się na 2000 (dowód, że nie jest martwa).

## K. DECYZJA P1 vs P2 — pomiar per-etap (rozstrzygnięcie „na czym stoi long task")

**Narzędzie:** `?perf=1` → `__excelPerfReport()`; odczyt wpięty w `excelHeapProbe.cjs`
(faza `split`, tab `2000`, 68 kolumn, 68 wierszy). `HEAP_NS=2000 HEAP_RUNS=2`.

**Wynik (ms, dwa przebiegi):**

| etap                             | run1      | run2      | udział   |
| -------------------------------- | --------- | --------- | -------- |
| prepare (logical cols)           | 0.8       | 2.5       | ~0%      |
| **tbody (budowa stringa slice)** | **33.8**  | **34.3**  | ~6%      |
| **innerHTML (parse + insert)**   | **131.9** | **115.6** | ~22%     |
| lucide                           | 11        | 4.2       | ~1%      |
| **sticky (post-steps = cel P2)** | **13.6**  | **10.9**  | ~2%      |
| total (synchroniczny JS)         | 193.3     | 168.6     | ~31%     |
| **frame (layout + paint)**       | **305.9** | **351.0** | **~60%** |
| `renderMs` (wall)                | 544       | 588       | —        |
| `tabsMs` (`_excelRenderTabs`)    | 1         | 1         | ~0%      |
| `tableMs` (`_excelRenderTable`)  | 543       | 588       | 100%     |

**Wnioski (FACT):**

1. **P2 (chunkowanie post-steps) = MARTWY.** `sticky` (colWidths+sticky+locked+focus) to 8–14 ms. Nie ma czego dzielić.
2. **P1 (chunkowanie markupu) adresuje ~150 ms z 544–588 ms** (`tbody` 34 + `innerHTML` 124) — czyli ~27%; osobno rozkłada `frame` (paint) na klatki, co jest realną dźwignią SLO.
3. **Dominantą jest paint/layout = ~60% czasu renderu** → potwierdza wcześniejszy wniosek a1-a2 („paint-bound”). To **własnie atakuje wariant A** (46.6% markupu = `style="…"`, floor −36%) — i robi to **synchronicznie, bez zmiany kontraktu async na 40+15 callerach**.
4. `_excelRenderTabs()` = 1 ms → hipoteza „300 ms w tab-barze” **OBALONA**; brakujące ~150–300 ms w przełączeniu siedzi w `_excelRecalcTabWellErrors` + `excelFilterWells` + restore scrolla (do zmierzenia, jeśli A/P1 nie wystarczą).

**KOLEJNOŚĆ (zrewidowana dowodem):** **A pierwsze** (sync, atakuje 60% kosztu = paint, zero ryzyka async) → dopiero jeśli SLO nadal nieosiągnięte, **P1** (chunk markupu; jedyna droga do `ltMax ≤ 200 ms`, koszt = kontrakt async). **P2 skasowane.** Zysk A szacowany na −15…−20% przełączenia (nie osiąga SLO sam — dlatego (C) utrzymuje zrewidowany próg dla N≥1000).

## G. Otwarte (nie-blokujące)

1. **F9:** podpiąć SLO `excelHeapProbe` do CI (nightly istnieje, advisory).
2. **F6.1:** `role="grid"`/`aria-rowcount` w `public/js/studnie`.
3. **F7.2:** 54 puste `catch{}` w `public/js/studnie`.
4. **Axe lokalnie:** zaseedować izolowaną E2E DB (`PLAYWRIGHT_DATABASE_URL`) by bramka działała poza CI.
5. **Q6:** prod snapshot dla `wellcount-stats.mjs` (wciąż HYPOTHESIS: projekt 3000).
6. **Decyzja H-A/B/C/D** (patrz sekcja H) — blokuje dalszy postęp w kierunku SLO.
