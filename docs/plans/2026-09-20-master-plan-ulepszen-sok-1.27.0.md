# Master Plan ulepszeń — S.O.K. v1.27.0

**Wersja:** 1.27.0 (HEAD `58c1bfe`, tag `v1.27.0`, 2026-09-20)
**Status:** PLAN WYKONAWCZY (zweryfikowany w kodzie, bez wdrożenia)
**Zakres:** 237 plików JS frontend (~71,5k linii), 145 plików backend TS, 140 handlerów API, 250 testów, 151 md
**Zasady:** mały diff, zero zmian funkcjonalnych bez uzasadnienia, 1 problem = 1 commit, każdy krok testowalny i odwracalny
**Rewizja R1 (2026-09-20):** uwagi review (ocena 9,2/10) — E2→E2a-d, E4→E4a-d, klucz limitera IP+login, pomiar przed zmianą TELEMETRY_WRITE, E7 na koniec, E1 reference-check, MASTER DONE gate, kontrola wizualna przed push

---

## 1. Executive Summary

Projekt stabilny produkcyjnie. Audyt wejściowy potwierdzony w ~60%: realne są push 12 commitów, porządek w `docs/plans/`, luki walidacji w 10 endpointach, 6 miejsc silent-fail do ologowania, mikro-poprawki XSS-atrybutów. Niepotwierdzone jako problemy do działania: masowa konsolidacja globali (duplikaty zamierzone), rozbiórka większości gigantów (5 z 8 → NIE DZIELIĆ), projekt migracji inline styles, rozbudowa WriteLock.

Najwyższy zwrot: wysyłka 12 gotowych commitów, archiwizacja 20 planów, ~15 jednolinijkowych logów, 10 schematów zod, poprawki atrybutów XSS przy dotyku. Wszystko bez zmian architektury i UI.

Krytyczne znalezisko spoza audytu: token sesji w body JSON (`auth.ts:60-61`) niweczy httpOnly — pokryte decyzją `e2-auth-decision.md` (wariant A, READY, zero kodu). Plan nie duplikuje E2, tylko linkuje. Toru E2-auth (X1–X4) nie realizować równolegle z E4 — utrudniłoby atrybucję zmian w autoryzacji.

---

## 2. Stan obecny (fakty zweryfikowane)

| Fakt                     | Wartość                                                                                                                                                                |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Branch / HEAD / upstream | `main` / `58c1bfe` / `origin/main`                                                                                                                                     |
| Ahead / behind           | 12 / 0, worktree czysty                                                                                                                                                |
| 12 niepushowanych        | 8× `chore(deps)`, `docs` errors-known mapa, 2× `test`, `fix(studnie)` escape id, `feat(ui)` import-export, `fix(offers)` xlsx lazy-load — małe, spójne, gotowe do push |
| Wersje                   | `version:check` EXIT 0 — VERSION, package.json, lock, CHANGELOG, bat, docs, `?v=` — wszystko 1.27.0                                                                    |
| Walidacja API            | 76 mutujących: 44 zod (58%: 30 `validateData` + 14 `safeParse`), 9 ręczna (12%), 23 bez body N/A (30%) — NIE 11% z audytu                                              |
| XSS                      | brak otwartego XSS; odchylenia tylko w atrybutach (`title`, `data-id`, `aria-label`, single-layer `escJs` w onclick)                                                   |
| Silent fail              | większość OK-FALLBACK / DEGRADED / EXPECTED; LOG-NEEDED: 6 miejsc w 4 klasach zachowania (stąd split E2a-d)                                                            |
| Globalne                 | redefinicje = zamierzony stan współdzielony; realne kolizje: 2 (`renderWellsList` dispatcher+legacy, `showSection`/`toggleCard` per-moduł)                             |
| Giganty >1000 linii      | 8 plików; do podziału: 3 mikro-splity; 5 → NIE DZIELIĆ                                                                                                                 |
| Inline style             | 1116 w JS + 689 w HTML + 443 `el.style.*`; tokeny/klasy 1:1 istnieją dla ~połowy wzorców                                                                               |
| Excel                    | 25 plików, undo 50 wpisów / 12 MB / 1 MB na wpis, gate N>100; 25 testów excel; 5 ryzyk zmapowanych                                                                     |
| SQLite                   | 1 połączenie, WAL + NORMAL + 30 s, claim atomowy `UPDATE+N`; lock per-moduł w procesie                                                                                 |
| Plany                    | 33 aktywne rzekomo → realnie: ACTIVE 1, READY 3, BLOCKED 2, OBSOLETE 1, COMPLETED 5, do archiwum 20                                                                    |
| Referencje do planów     | żywe odwołania w kodzie/skryptach/CI (szczegóły E1) — `git mv` wymaga reference-check                                                                                  |

---

## 3. Korekta audytu (10 punktów)

| #   | Punkt                | Werdykt                    | Uzasadnienie                                                                                  |
| --- | -------------------- | -------------------------- | --------------------------------------------------------------------------------------------- |
| 1   | Push + version check | POTWIERDZONE               | ahead 12 istnieje, worktree czysty; metadata wersji w 100% spójne — push bez akcji wersyjnych |
| 2   | docs/plans           | CZĘŚCIOWO                  | nie "33 aktywne" — 20 do archiwum, 6 zostaje (1 ACTIVE + 3 READY + 2 BLOCKED), 1 OBSOLETE     |
| 3   | XSS sweep            | CZĘŚCIOWO                  | brak otwartego XSS; REAL(niski) tylko atrybuty — fix przy dotyku, nie projekt                 |
| 4   | validateData         | CZĘŚCIOWO                  | coverage 58% nie 11%; realna luka: 10 endpointów M (PZ, exporty, flagi, numbering)            |
| 5   | Silent fail          | CZĘŚCIOWO                  | 5. punkt audytu to ~40 sprawdzonych miejsc; do roboty 6 miejsc w 4 klasach → split E2a-d      |
| 6   | Global collisions    | NIE WYMAGA DZIAŁANIA       | konsolidacja grozi regresją; tylko konwencja guarda dla nowych globali                        |
| 7   | Giganty              | CZĘŚCIOWO                  | 3 mikro-splity move-intact na SAMYM KOŃCU (po E8); 5 plików NIE DZIELIĆ (uzasadnienia w §12)  |
| 8   | Inline styles        | NIE WYMAGA DZIAŁANIA       | brak projektu; tylko mapowania 1:1 przy dotyku, bez nowej skali spacing                       |
| 9   | Excel                | POTWIERDZONE               | freeze + hardening + warn przy odrzucie undo; lista BEZPIECZNE / NIE ROBIĆ w §13              |
| 10  | SQLite/WriteLock     | NIE WYMAGA DZIAŁANIA (kod) | tylko ADR + warn przy 429 + audyt `finally`; zakaz multi-process w ADR                        |

---

## 4. Problemy dodatkowe (tylko realne, z kodem)

| ID  | Plik:linia                                                                  | Problem                                            | Wpływ                                                                                                                                                                                                                  |
| --- | --------------------------------------------------------------------------- | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| X1  | `src/routes/auth.ts:60-61`                                                  | token sesji w body JSON + cookie (dual transport)  | XSS kradnie sesję mimo httpOnly — KRYTYCZNE, pokrywa `e2-auth-decision.md` wariant A (nie duplikować, nie robić równolegle z E4)                                                                                       |
| X2  | `src/middleware/auth.ts:145`, `auth.ts:161`                                 | fallback `X-Auth-Token`                            | poszerza powierzchnię; do usunięcia w wariancie A                                                                                                                                                                      |
| X3  | `src/middleware/auth.ts:85-97`                                              | brak sliding/rotacji, TTL 7d pełne                 | kradziony token ważny 7 dni                                                                                                                                                                                            |
| X4  | `src/routes/auth.ts:57`                                                     | brak tokenu CSRF (tylko SameSite=lax)              | mutujące endpointy bez nonce — do decyzji E2                                                                                                                                                                           |
| X5  | `src/routes/clients.ts:15-29`                                               | GET zwraca całe `clients_rel` każdemu zalogowanemu | dane osobowe bez filtra własności (RODO) — P1, filtr `canReadDoc`, osobny revertowalny commit (E4a)                                                                                                                    |
| X6  | `src/middleware/rateLimiter.ts:39`                                          | limiter tylko per-IP                               | NAT + rozproszony brute-force loginu — klucz: IP + znormalizowany login (NIE user ID, nieznane przed auth); testy: ten sam IP + różne konta, różne IP + to samo konto, brak loginu, malformed, normalizacja case (E4b) |
| X7  | `src/middleware/rateLimiters.ts:30-34`                                      | `TELEMETRY_WRITE` 1200/min                         | wartość docelowa BEZ dowodu — najpierw pomiar peak usage → headroom → dopiero zmiana (E4b)                                                                                                                             |
| X8  | `src/mountRoutes.ts:63-64,66,78-80,85`                                      | products/offers-rury/telemetry bez `apiLimiter`    | GET cenników poza globalnym limitem (E4b)                                                                                                                                                                              |
| X9  | `src/routes/auth.ts:159`                                                    | logout bez auth i limitera                         | oracle + logout-CSRF (E4c)                                                                                                                                                                                             |
| X10 | `scripts/init-env.mjs:62`                                                   | hasło admina w `console.log`                       | sekret w logach/CI (E4d)                                                                                                                                                                                               |
| X11 | `shared/auth.js:178,182`, `aiStatusIndicator.js:148`, `mlDualRanking.js:67` | `setInterval` bez clear                            | wieczny polling, pile-up w SPA/iframe (E8)                                                                                                                                                                             |
| X12 | `tests/playwright/*.cjs` (~40× `waitForTimeout`)                            | twarde sleepy 300–2500 ms                          | flaky E2E — per-wait przyczyna → właściwy warunek (E8, NIE mechaniczny replace)                                                                                                                                        |

X1–X4 należą do toru E2-auth (decyzja READY) — ten plan ich nie wdraża, tylko odnotowuje zależność.

---

## 5. Priorytety

| ID    | Problem                                                                                                                                       | Korzyść                                                  | Ryzyko             | Diff                | Zależności              | Priorytet |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | ------------------ | ------------------- | ----------------------- | --------- |
| P0-1  | Push 12 commitów (po validate + kontrola wizualna)                                                                                            | usuwa ryzyko utraty, odblokowuje CI                      | minimalne          | 0                   | validate zielony        | P0        |
| P1-1  | Archiwizacja 20 planów (`git mv` + reference-check)                                                                                           | porządek SSoT, koniec "33 aktywnych"                     | minimalne          | 20×mv               | E1 guard                | P1        |
| P1-2a | E2a: backend silent-fail (`studnieCrud:451`)                                                                                                  | widoczność korrupt-data                                  | minimalne          | 1 linia             | brak                    | P1        |
| P1-2b | E2b: ownership/falgi (`ownership`, `featureFlags`)                                                                                            | widoczność padów DB przy fail-closed                     | minimalne          | 3 linie             | brak                    | P1        |
| P1-2c | E2c: frontend telemetry (`aiDashboardMl`, `appStudnie`)                                                                                       | widoczność cichych faili UI                              | minimalne          | ~18 linii           | brak                    | P1        |
| P1-2d | E2d: `window.api` kontrakt (mapa callerów → warn-only)                                                                                        | decyzja bez zgadywania; throw DOPIERO po kontrakcie      | minimalne          | docs + warn         | mapa callerów rury/*    | P1        |
| P1-3  | E4a: filtr własności `GET /clients` (X5)                                                                                                      | RODO, IDOR                                               | niskie             | 1 guard             | `canReadDoc` istnieje   | P1        |
| P1-4  | E4b: limitery (X6 klucz IP+login, X8 mounty; X7 pomiar→zmiana)                                                                                | brute-force, DoS-hygiena                                 | niskie             | małe                | pomiar peaku X7         | P1        |
| P1-5  | E4c: logout guard + limiter (X9)                                                                                                              | CSRF-oracle                                              | niskie             | 2 linie             | brak                    | P1        |
| P1-6  | E4d: sekret z logów (X10)                                                                                                                     | sekret w CI                                              | minimalne          | 1 linia             | brak                    | P1        |
| P1-7  | zod dla 10 endpointów M (§9, observe→egzekucja)                                                                                               | zamyka masowe kasowanie PZ, poisoning audytu, IDOR-probe | średnie (kontrakt) | ~10 schematów       | testy starych payloadów | P1        |
| P2-1  | Excel: warn przy odrzucie undo + testy lifecycle                                                                                              | koniec cichego braku Ctrl+Z                              | niskie             | ~30 linii + testy   | §13                     | P2        |
| P2-2  | ADR single-node SQLite + warn 429 + audyt `finally`                                                                                           | jawny kontrakt, diagnozowalność                          | minimalne          | docs + 5 linii      | brak                    | P2        |
| P2-3  | `setInterval` cleanup (X11), Playwright per-wait fix (X12)                                                                                    | memory, flaky                                            | niskie             | małe                | brak                    | P2        |
| P2-4  | Mikro-splity NA KOŃCU: `excelColumnResize`, `excelUndo`, `orderBulkModel`                                                                     | mniejsze pliki bez zmiany semantyki                      | średnie            | 3 pliki move-intact | E5 testy zielone        | P2        |
| P3-1  | XSS-atrybuty (§8) + inline style 1:1 (§12)                                                                                                    | higiena                                                  | minimalne          | przy dotyku         | brak                    | P3        |
| P3-2  | Konwencja `if(!window.X)` dla nowych globali                                                                                                  | brak nowych kolizji                                      | minimalne          | docs                | brak                    | P3        |
| DEFER | Konsolidacja `showToast`×43, `showSection` merge, ESM/bundler, store zamiast globali, unifikacja undo, migracja DS, Redis lock, zmiana PRAGMA | —                                                        | wysokie            | duży                | —                       | DEFER     |

---

## 6. Roadmapa (kolejność)

```text
E0  PUSH
 ↓
E1  DOCS (z reference-check)
 ↓
E2a BACKEND SILENT-FAIL → E2b OWNERSHIP/FLAGI → E2c FRONTEND TELEMETRY → E2d API-KONTRAKT
 ↓
E4a CLIENTS OWNERSHIP
 ↓
E4b LIMITERY (X6/X8 + pomiar X7) → E4c LOGOUT → E4d SECRET
 ↓
E3  ZOD — endpoint po endpointcie (observe → egzekucja)
 ↓
E5  EXCEL hardening
 ↓
E6  SQLITE ADR
 ↓
E8  TIMERY + PLAYWRIGHT (per-wait)
 ↓
E7  MICRO-SPLITS (na końcu)
 ↓
P3  tylko przy dotyku
 ↓
MASTER DONE gate (bez auto-bump wersji)
```

Każdy etap: testy przed → zmiana → testy po → kryterium → rollback (`git revert` 1 commita) → commit. Security (E4a-d) osobno revertowalne — nie łączyć w jeden commit.

---

## 7. Szczegółowe plany implementacyjne

### E0 — Push 12 commitów

- Cel: wysyłka gotowej pracy, zero utraty.
- Zakres: brak zmian kodu. Kontrole przed: `npm run version:check` (PASS 2026-09-20), `npm run validate`, `git status` czysty + wizualna kontrola zakresu:
  `git diff origin/main...HEAD --stat` oraz `git log --oneline origin/main..HEAD`.
- Testy: brak nowych; regresja: CI pre-push (typecheck×2 + test:quick).
- Kryterium: `rev-list origin/main...HEAD` = 0/0.
- Rollback: nie dotyczy (push-forward; awaryjnie `git revert` na main).
- Commit: brak (commity istnieją).

### E1 — Porządek docs/plans (z reference-check)

- Cel: 1 ACTIVE + 3 READY + 2 BLOCKED zostają, reszta do archive, zero broken references.
- Krok 0 (guard, obowiązkowy): `grep -rn "docs/plans/<plik>" --include="*.{js,ts,mjs,cjs,yml,md}" .` (poza `docs/plans/`). Zweryfikowane żywe referencje 2026-09-20:
    - `scripts/load-100.mjs:11` → `e3-perf.md`; `scripts/synth-harness.mjs:3` → `2026-09-12-synth-harness.md`; `scripts/check-appname.cjs:8` → `2026-08-09-spojna-korekta-nazwy-aplikacji.md` (archiwalny, komentarz — zostawić);
    - `scripts/benchmark-autoselect.mjs:43`, `tests/playwright/excelOpenPerf.cjs:26`, `excelDomGolden.cjs:24` piszą JSON do `docs/plans/` — JSON-ów nie przenosić;
    - komentarze w kodzie: `excelVirtual.js:29` → `2026-09-02-excel-arrow-virtual-nav.md`, `draftStore.js:2`/`draftAutosave.js:2` → `e2-draft-review.md`, `trainingGate.test.ts:3` → `2026-09-11-ml-training-gate.md`;
    - `.github/workflows/load-nightly.yml:4` → `e5-decision.md`.
- Reguła: plan z żywą referencją w skrypcie/workflow → ZOSTAJE albo move + aktualizacja referencji w tym samym commicie; referencja w komentarzu → move dozwolony, komentarz aktualizować tylko gdy plik dotykany (P3).
- Konkretnie: `e3-perf.md` i `e5-decision.md` ZOSTAJĄ w root (referencje `load-100.mjs` i `load-nightly.yml`) mimo statusu COMPLETED — zamiast `git mv` dopisać nagłówek `Status: COMPLETED, referencja aktywna`. `2026-09-12-synth-harness.md` i `2026-09-11-ml-training-gate.md`: move + aktualizacja komentarza w skrypcie/teście w tym samym commicie.
- Zostają: `2026-09-16-e2-e5-roadmap.md` (ACTIVE), `2026-08-27-studnie-uwagi-per-well.md`, `draft-offline-diff-robustness.md`, `e2-auth-decision.md` (READY), `auth-shim-followup.md`, `d1-production-drill.md` (BLOCKED), `e3-perf.md`, `e5-decision.md` (COMPLETED z aktywną referencją).
- Archiwum (`git mv`): pozostałe ARCHIVE/COMPLETED/OBSOLETE (docelowo ~18 plików).
- Krok N: `encoding:check` + re-check referencji po move.
- Commit: `docs(docs): archiwizacja zamknietych planow z reference-check`.

### E2a — Backend silent-fail krytyczny

- `studnieCrud.ts:451` → `logger.warn` (korrupt `offer.data` = cicha cena 0). Bez zmiany fallbacku.
- Commit: `fix(offers): logowanie korrupt offer.data`.

### E2b — Ownership / feature flags

- `ownership.ts:173-175,187-189` + `featureFlags.ts:25-27` → `logger.warn` (fail-closed zostaje, dodany głos).
- Commit: `fix(api): logowanie cichych fallbackow ownership i flag`.

### E2c — Frontend telemetry

- `aiDashboardMl.js` 15× `.catch(()=>{})` + `aiDashboardCore.js` 3× + `appStudnie.js:206` → toast/`console.warn`/komentarz. Klasa UI/TELEMETRY, bez zmiany UX.
- Commit: `fix(ui): widoczne bledy dashboardu ml`.

### E2d — `window.api` kontrakt (decyzja, nie throw)

- Fakt zweryfikowany: `rury/dataService.js:7-60` — `api.get/put/post/patch/del` zwracają `null` zarówno przy HTTP-error, jak i błędzie sieci. Konsumenty w `rury/*` (pricelistUi, offerCrud, offerExports).
- Krok 1: mapa callerów `api.*` w `rury/` (kto rozróżnia `null` = brak danych vs błąd?).
- Krok 2: warn-only (`console.warn` w catch + status w return? NIE — bez zmiany sygnatury w tym kroku).
- `throw` DOPIERO po ustaleniu kontraktu z callerami — osobna decyzja, osobny commit.
- Commit: `fix(rury): diagnoza kontraktu window.api`.

### E3 — zod M→Z (10 endpointów, observe-first)

- Kolejność: `production batch-delete` → `recycle-numbers` → `print-count*` → `exportCombined` → `featureFlags import-export/audit` → `numbering claim-production-numbers` → `duplicate/:id` + `shares/:id` format → `studnie strict` (po okresie observe).
- Każdy: schemat zod + test starego payloadu `safeParse` (import XLSX per-moduł, legacy `userId=null`, epoch-ms vs ISO, luźne `data[]`).
- Commity: 1 endpoint = 1 commit `fix(api): ...`.

### E4a — Clients ownership (osobny revert)

- `clients.ts` guard `canReadDoc` na GET (X5). Test: nie-właściciel → 403, admin → 200.
- Commit: `fix(security): filtr wlasnosci clients`.

### E4b — Limitery (osobny revert)

- X8: `apiLimiter` na mountach products/offers-rury/telemetry.
- X6: klucz limitera loginu = `IP + znormalizowany login` (lowercase + trim; NIE user ID — nieznane przed auth). Testy: ten sam IP + różne konta (osobne buckety), różne IP + to samo konto (osobne buckety), brak loginu, malformed login, normalizacja case.
- X7: POMIAR przed zmianą — peak `TELEMETRY_WRITE` z logów/metryk → headroom (proponowany ×2 peaku) → dopiero zmiana limitu. Bez dowodu NIE zmieniać 1200.
- Commity: `fix(security): ...` per zmiana (limiter-login, mounty, telemetry-limit po pomiarze).

### E4c — Logout (osobny revert)

- `auth.ts:159` → `requireAuth` + limiter (X9).
- Commit: `fix(security): guard logout`.

### E4d — Sekret (osobny revert)

- `init-env.mjs:62` → bez hasła w `console.log` (maska / flaga verbose) (X10).
- Commit: `fix(security): haslo poza logami`.

### E5 — Excel hardening (bez splitów)

- Warn gdy gate N>100 / cap 1 MB odrzuca snapshot (koniec cichego braku Ctrl+Z); testy lifecycle (open-snapshot, `_excelClosing` race, polling/quiet-depth, focus-restore, eviction); dokumentacja kontraktu kolejności ładowania + monkey-patch virtuala.
- Commity: `test(studnie): ...`, `fix(studnie): ...`.

### E6 — ADR single-node

- `docs/adr/ADR-012-single-node-sqlite.md`: 1 proces, `connection_limit=1`, WAL+NORMAL+30 s, lock = anty-TOCTOU w procesie, cross-proces chroni SQLite, zakaz multi-process na jednym pliku; warn+metryka przy 429; audyt `acquireLock`→`finally release` (do sprawdzenia ścieżka dedup telemetrii).
- Commit: `docs(docs): adr single-node sqlite`.

### E8 — Timery i flaky (przed splitami)

- X11: `clearInterval`/guard SPA dla 3 plików (odmontowanie iframe, zmiana zakładki).
- X12: per-wait analiza — każdy `waitForTimeout` → określona przyczyna (debounce / polling / animacja / backend / kolejka / zapis / stabilizacja) → właściwy warunek (`locator.waitFor`, `waitForResponse`, `waitForFunction`). Zakaz mechanicznego `waitForTimeout(N)` → `locator.waitFor()`.
- Commity: `fix(ui): cleanup timerow`, `test(test): stabilizacja playwright per-wait`.

### E7 — Mikro-splity NA KOŃCU (move-intact, 3 pliki)

- Dopiero po zielonych testach E5. `excelColumnResize.js` (`_excelInitColumnResize`, ~98 linii, już `ponytail:` TODO) + `excelUndo.js` (10 funkcji undo z `excelTableManager.js`) + `orderBulkModel.js` (9 czystych `_bulk*` z `orderBulk.js`). Kolejności: state→undo→manager; model→bulk. Bez zmiany semantyki. Powód kolejności: zero korzyści bezpieczeństwa/użytkownika, ryzyko import/order/global-scope.
- NIE DZIELIĆ: `excelCopyPaste` (jedna domena schowka; split dopiero gdyby rósł: semantic/fill), `draftAutosave` (jeden lifecycle + self-heal ghost-draft), `solverAutoSelect` (jeden pipeline + memo; `shouldMarkAiSelection` już czysta), `orderCrud` (serializacja 409), `aiDashboardMl` (stateless fetch/render), `excelVirtual` (invariant logicalRow; tylko delete bloku perf ~80 linii).
- Commity: `refactor(studnie): ...` per split + `test:alignment` po każdym.

---

## 8. Plan XSS (istotne sinki)

SSoT: `shared/escapeHtml.js:8,14,23` (`escapeHtml` tekst, `escapeHtmlAttr` atrybuty, `escapeJsStr` stringi JS). Reguła: tekst→`escapeHtml`, atrybut→`escapeHtmlAttr`, JS-string→`escapeJsStr`+Attr, selektor z id→`CSS.escape`/`getElementById`.

| Plik:linia                                                                   | Sink                             | Źródło           | Ryzyko            | Ochrona                | Zmiana                                               | Test             |
| ---------------------------------------------------------------------------- | -------------------------------- | ---------------- | ----------------- | ---------------------- | ---------------------------------------------------- | ---------------- |
| `aiDashboardCore.js:83,86`                                                   | `title="…"` w `statCard`         | AI/DB            | REAL niski        | `escapeHtml` (bez `"`) | → `escapeHtmlAttr`                                   | unit: `"` w desc |
| `zleceniaRender.js:75,82`                                                    | `title="…"`                      | DB+daty          | REAL niski        | `escHtml`              | → `escapeHtmlAttr`                                   | unit             |
| `zleceniaRender.js:272-277`                                                  | `data-id`, `aria-label`, `value` | DB/user          | REAL niski        | `escJs` solo           | → `escapeHtmlAttr`                                   | unit             |
| `zleceniaRender.js:96`                                                       | selektor z id                    | DB id            | REAL niski        | `escJs`                | → `CSS.escape`                                       | unit             |
| `zleceniaRender.js:244-266`                                                  | `onclick` single-layer `escJs`   | DB UUID          | wzorzec/FALSE-POS | brak warstwy Attr      | → `escapeHtmlAttr` przy dotyku                       | E2E click        |
| `shared/dashboard.js:275-276`                                                | `onclick` z id                   | DB UUID          | FALSE-POS         | `escapeJsStr`          | bez zmian (UUID)                                     | brak             |
| `excelColumnVisibility.js:257`                                               | `outerHTML` + onclick            | stałe słownikowe | FALSE-POS         | escape                 | bez zmian                                            | brak             |
| `kartotekaAudit.js:285,289`, `spa/zlecenia.js:289`, `kartotekaSearch.js:254` | `insertAdjacentHTML`             | DB/API           | DO WERYFIKACJI    | poza scopem            | osobny audyt wejść `_renderEntry`/`renderOffersList` | E2E              |
| `document.write`                                                             | —                                | —                | SAFE              | 0 trafień              | brak                                                 | brak             |

Brak otwartego XSS. Poprawki P3 przy dotyku plików.

---

## 9. Plan walidacji API

SSoT: `src/validators/authSchema.ts:60` (`validateData` → 400 + details). Coverage: 58% zod, 12% manual, 30% N/A.

| Endpoint                                                   | Schema docelowa                                                                        | Ryzyko                         | Test                     |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------ | ------------------------ |
| POST `production/batch-delete` (`production.ts:575`)       | `z.array(z.string().uuid()).max(200)`                                                  | chunk-frontend obchodzony dziś | unit: 201 ids → 400      |
| POST `production/recycle-numbers` (`:668`)                 | `userId/seqNumbers/year` strict, bez fallbacku                                         | zatrucie puli dziś             | unit: śmieć w year → 400 |
| POST `print-count-batch`, `:id/print-count` (`:810/:851`)  | `ids` strict + `kind` enum                                                             | spam inkrementacji             | unit                     |
| POST `export-combined/{pdf,docx}` (`:60/:90`)              | kształt ID (allow-list, bez wymogu UUID — legacy ID)                                   | IDOR-probe 404/400             | unit + E2E export        |
| PUT `feature-flags/import-export` (`:30`)                  | `{enabled: boolean}` strict zamiast koercji                                            | ciche wyłączenie dziś          | unit: `"true"` → 400     |
| POST `feature-flags/audit` (`:98`)                         | `details` limit rozmiaru/kształtu                                                      | audit poisoning (A-17)         | unit: oversize → 400     |
| POST `claim-production-numbers` (`numbering.ts:226`)       | `count` int + ignore-unknown                                                           | nad-rezerwacja                 | unit                     |
| POST `offers-rury/:id/duplicate`, DELETE `shares/:id`      | format `:id`                                                                           | enumeracja oracle              | unit                     |
| PUT `orders-studnie/` strict (`studnieOrders.crud.ts:145`) | po observe (`observeStudnieOrderDto` już loguje)                                       | runtime-klucze w blobie        | parity starych payloadów |
| Wyjątki (nie walidować ściśle)                             | `version`/`baseUpdatedAt`/`Idempotency-Key`, odczyt historyczny, import XLSX per-moduł | fala 400 / utrata zapisu       | observe-first            |

---

## 10. Plan silent-fail

| Plik:linia                                                                                                   | Klasa                          | Rekomendacja                                             | Etap |
| ------------------------------------------------------------------------------------------------------------ | ------------------------------ | -------------------------------------------------------- | ---- |
| `studnieCrud.ts:451`                                                                                         | LOG-NEEDED                     | `logger.warn` — korrupt `offer.data` = cicha cena 0      | E2a  |
| `featureFlags.ts:25-27`                                                                                      | LOG-NEEDED                     | `logger.warn` — pad DB = ciche flagi                     | E2b  |
| `ownership.ts:173-175,187-189`                                                                               | LOG-NEEDED                     | `logger.warn` — fail-closed OK, dodać głos               | E2b  |
| `aiDashboardMl.js` 15× catch + `aiDashboardCore` 3×                                                          | LOG-NEEDED                     | toast/`console.warn` (klasa UI/TELEMETRY)                | E2c  |
| `appStudnie.js:206`                                                                                          | LOG-NEEDED                     | zweryfikować kontekst, dodać log/komentarz               | E2c  |
| `rury/dataService.js` (`window.api`, 5×)                                                                     | KONTRAKT                       | mapa callerów → warn-only; `throw` dopiero po kontrakcie | E2d  |
| `initDatabase`, `app.ts` init, `auditService`, `ModelRegistry`, `telemetryService`, `searchUtils`, `auth.ts` | OK/DEGRADED/EXPECTED/TELEMETRY | bez zmian (wzorce poprawne)                              | —    |
| `logAudit` bez `await`                                                                                       | TELEMETRY zamierzone           | opcjonalny prefix `void`                                 | —    |

---

## 11. Plan globali (istotne)

| Symbol                                 | Liczba | SSoT                                          | Plan                                                  |
| -------------------------------------- | ------ | --------------------------------------------- | ----------------------------------------------------- |
| `showToast`                            | 43     | brak jednego — ostatnie ładowanie wygrywa     | DEFER; nowe: guard `if(!window.X)`                    |
| `studnieProducts`                      | 13     | setter `studnie/globals.js:31` + Map kontrakt | tylko przez setter; bez zmian                         |
| `renderWellsList`                      | 12     | dispatcher + legacy                           | nie scalać bez mapy callerów                          |
| `updateSummary`                        | 12     | per-moduł                                     | nie scalać                                            |
| `showSection`/`toggleCard`             | 3/3    | per-moduł semantyki (inne DOM)                | NIE SCALAĆ; docelowo rename `showSectionStudnie/Rury` |
| helpery `escapeHtml/debounce/safeEval` | 1 def  | `shared/`                                     | wzorzec działa                                        |

`check-global-collisions.mjs` słusznie tylko raportuje. Działanie: konwencja guarda + prefixy modułowe.

---

## 12. Plan refaktorów

Splits NA KOŃCU (E7, move-intact): `excelColumnResize.js`, `excelUndo.js` (10 funkcji, uwaga `_EXCEL_UNDO_LIMIT=20`, flaga `_excelPasteInProgress` #29, `__excelBulkDepth`), `orderBulkModel.js` (9 czystych `_bulk*`, flaga `pzGuard.isPzStableIdEnabled`). NIE DZIELIĆ: copyPaste, draftAutosave, solver, orderCrud, aiDashboardMl, excelVirtual (uzasadnienia §7/E7). Inline style: tylko mapowania 1:1 przy dotyku (`hidden`, `text-center`, `w-100`/`flex-1`, badge/status, ellipsis, ikony 12/14/16/20); NIE: spacing (brak skali), karty/modale, stany/animacje, zIndex (tylko `LAYERS`).

---

## 13. Plan Excel

Zamrozić features; dozwolone: bugfix + testy + mikro-splity z §12. 5 ryzyk: kolejność ładowania + monkey-patch virtuala; ciche dziury undo (gate N>100, cap 1 MB); flagi reentrancy (#29); podwójny SSoT widoku (vis↔TD, #47); open-mutacja + `structuredClone` koszt. BEZPIECZNE: czyste funkcje + testy, jawne `window.*`, warn odrzutu undo, deduplikacja gałęzi bulk-add, ADR kontraktu. NIE ROBIĆ: ESM/bundler, łączenie/dzielenie 26 plików, store, unifikacja 5 typów undo, kasowanie guardów `typeof`, fork virtuala, zmiana open-snapshot/dirty.

---

## 14. Plan dokumentacji

E1 (§7) + ADR-012 single-node (§7/E6). Brak nowych markerów wersji poza obsługiwanymi przez `auto-docs-version.mjs`. Nowych frameworków: zero.

---

## 15. Plan testów (przed/po każdym etapie)

- Static: `node -c` (JS), `typecheck` + `typecheck:frontend`, `encoding:check`, `collisions:check`, `appname:check`.
- Unit: istniejące `tests/studnie/excel*.test.ts` (25), `globalsMapStale`, `encodingMojibake`; dodać: zod stare-payloady (E3), undo-gate warn (E5), limiter-login matrix X6 (E4b: IP×konto, brak/malformed loginu, normalizacja case).
- Integration: PZ batch-delete/recycle/print-count, exporty pdf/docx, flagi, numbering, clients-ownership.
- E2E: `excelVirtualParity`, `excelEmptyRowAlignment`, `appNameConsistency`, smoke offer flow; po E7 pełny `test:alignment`.
- Security: XSS-atrybuty (cudzysłowy w danych), 400 vs 404 oracle, 403 ownership, brute-force login.
- Regression: solver, autosave ghost-draft, PDF/DOCX, PZ-blokady, offers/orders 409, import XLSX 12 kolumn.

---

## 16. Kolejność commitów

1. (E0) push istniejących 12 — bez nowego commita (po kontroli wizualnej).
2. `docs(docs): archiwizacja zamknietych planow z reference-check` (E1).
3. `fix(offers): logowanie korrupt offer.data` (E2a).
4. `fix(api): logowanie cichych fallbackow ownership i flag` (E2b).
5. `fix(ui): widoczne bledy dashboardu ml` (E2c).
6. `fix(rury): diagnoza kontraktu window.api` (E2d).
7. `fix(security): filtr wlasnosci clients` (E4a).
8. `fix(security): limiter loginu ip+login` + `fix(security): apiLimiter na mountach` + pomiar TELEMETRY_WRITE (E4b; zmiana limitu dopiero po pomiarze).
9. `fix(security): guard logout` (E4c).
10. `fix(security): haslo poza logami` (E4d).
11. `fix(api): zod ...` ×8 endpointów, osobne commity (E3).
12. `test(studnie): lifecycle excel` + `fix(studnie): warn odrzutu undo` (E5).
13. `docs(docs): adr single-node sqlite` (E6).
14. `fix(ui): cleanup timerow` + `test(test): stabilizacja playwright per-wait` (E8).
15. `refactor(studnie): excelColumnResize` → `excelUndo` → `orderBulkModel` + `test:alignment` po każdym (E7).
16. MASTER DONE gate — bez auto-bump wersji (patrz §18).

---

## 17. Nie robić (DEFER)

Konsolidacja `showToast`×43; merge `showSection`; ESM/bundler; store zamiast globali; unifikacja 5 typów undo; masowa migracja inline styles / nowy DS; rozbiórka copyPaste/solver/draftAutosave/orderCrud/aiDashboardMl/excelVirtual; Redis/distributed lock; zmiana PRAGMA i liczby połączeń; przepisywanie claimów na lock; zmiany API/UI bez konieczności; duplikacja toru E2-auth (X1–X4 realizuje wariant A); zmiana `TELEMETRY_WRITE` bez pomiaru; mechaniczny replace `waitForTimeout`; `throw` w `window.api` bez kontraktu callerów; rozszerzanie zakresu o kolejne "ulepszenia" — siłą planu jest mówienie NIE.

---

## 18. Final recommendation

- **Pierwszy krok:** E0 — `validate` + kontrola wizualna (`diff --stat`, `log`), potem push 12 commitów.
- **Drugi krok:** E1 (z reference-check) → E2a → E2b → E2c → E2d. Małe commity, natychmiastowy porządek i widoczność.
- **Trzeci krok:** E4a (clients, najwyższy zwrot RODO) → E4b/c/d → E3 od `production/batch-delete` (observe → egzekucja).
- **Odłożyć:** E7 na sam koniec (po E8), X1–X4 (tor E2 wariant A — nie równolegle z E4), P3 przy dotyku.
- **Nie robić:** §17 w całości.

### MASTER DONE gate (warunek zamknięcia całości)

```text
git status clean
origin/main == HEAD
npm run validate PASS (typecheck + typecheck:frontend + lint + lint:frontend + test:quick)
encoding:check PASS
collisions:check PASS
appname:check PASS
test:alignment PASS
brak nowych known failures
brak niezacommitowanych zmian
docs/plans status zgodny z SSoT (ACTIVE/READY/BLOCKED per §2)
```

Dopiero wtedy kolejna wersja — **bez automatycznego bumpowania**, jeśli zmiany tego nie wymagają (logi/docs/testy ≠ release).

Plan gotowy do realizacji etapami, po jednym commicie, z kontrolą regresji z §15.

---

## 19. Odstępstwa wykonawcze (R2, 2026-09-20)

Weryfikacja w trakcie wdrożenia zmieniła 6 decyzji — zgodnie z regułą "fakty > plan":

1. **E4a NIE WYKONANE** — `clients.ts:14,78` dokumentują celowy Wariant A (wspólna baza klientów). Filtr własności = zmiana funkcjonalna, odrzucona.
2. **E4c NIE WYKONANE** — logout bez `requireAuth` jest potrzebny do czyszczenia nieaktualnego cookie; mount ma już `apiLimiter`, SameSite=lax neutralizuje logout-CSRF, frontend ignoruje status. Zysk żaden, ryzyko regresji realne.
3. **E4d NIE WYKONANE** — wydruk hasła w `init-env.mjs:62` to jedyny kanał pierwszego hasła (brak użycia w CI). Usunięcie złamałoby świeżą instalację.
4. **TELEMETRY_WRITE bez zmian** — limit 1200 udokumentowany w kodzie (`rateLimiters.ts:25-29`: 15 studni × 4 endpointy, historia głodzenia `/offers`). Pomiar peaku jako follow-up, nie blokada.
5. **E3a: ID zleceń to opaque stringi** (`pz-1`, `prodorder_...`), nie UUID — schematy `min(1).max(256)` zamiast `uuid()`. UUID tylko dla `:id` ofert/udostępnień (E3c).
6. **E7: split resize cofnięty** — `scripts/excel-validator.py` (hook pre-commit, F2) wymaga `_excelSaveColWidths` i `headRows[1]` w `excelTableManager.js`. Blok resize przywrócony bajt-identycznie; przeszły `excelUndo.js` i `orderBulkModel.js`.
7. **E8-regresja naprawiona** — `window.addEventListener` guard dla sandboxów vm (`mlDualRanking.js`, `auth.js`, `aiStatusIndicator.js`); wykryta przez `mlDualRanking.test.ts`, nie przez review.
