# Plan poprawy po audycie struktury (2026-10-25)

**Status:** PLAN — brak wdrożenia. HEAD: `02eee97`, branch `main`, tree czysty.
**Wejście:** audyt struktury z 2026-10-25 (read-only) + weryfikacja 5 subagentów
(refactor-cleaner, code-reviewer, architect, planner, explore).

## 1. Korekty audytu (dowody wymusiły zmianę planu)

| Pozycja z audytu                               | Weryfikacja                                                                                                                                                                                                     | Werdykt                                                                    |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| P1: rozbicie `runJsAutoSelection` (1213 linii) | `docs/plans/archive/solver-stop-confirm.md`: STOP, 9 domknięć, ~22 chwytane locale, warunek re-review „≤8" niespełniony; 141 testów zielonych; nagłówek `solverAutoSelect.js:5-6` explicite „nie dziel na siłę" | **ODRZUCONE** (pełne i wąskie)                                             |
| P2: ekstrakcja helperów z `excelCopyPaste.js`  | `AGENTS.md` „Excel to protected zone"; `.husky/pre-commit` uruchamia `python scripts/excel-validator.py` (27 checków po nazwach plików); 44 pliki testów Excel                                                  | **ODRZUCONE**                                                              |
| P3: grupowanie `public/js/studnie` (150 flat)  | 150 tagów w `studnie.html` (191 `<script>`), 206 plików w `tests/`+`scripts/` z literalną ścieżką `public/js/`; 0 importów ESM w module; kolejność skryptów = kontrakt ADR-008/014                              | **ODRZUCONE**                                                              |
| P3: konsolidacja baseline JSON                 | 21 plików w `docs/plans/`; konsumenci: `ci.yml:320-321`, `excel-throttle-nightly.yml:98` (glob), 7 plików harnessów                                                                                             | **ODRZUCONE** (zostaje)                                                    |
| P2: `docs/baseline/*.json`                     | 2 pliki, **0 konsumentów** w `src/tests/scripts/.github`                                                                                                                                                        | **ZROBIĆ** (usunięcie)                                                     |
| P1: liczby SSoT w README+AGENTS                | liczby rozjechane w **6 plikach**: `README.md`, `AGENTS.md`, `CLAUDE.md:16`, `docs/ARCHITECTURE.md:312,523`, `docs/AUDIT.md:51`, `docs/agents/frontend.md:16`; 3 różne wartości `window.*` (1277/1748/1771)     | **ZROBIĆ, zakres szerszy**                                                 |
| P2: `src/types/index.ts` + aliasy              | 0 konsumentów (barrel), aliasy tylko w definicji `tsconfig.frontend.json:17-21`                                                                                                                                 | **ZROBIĆ** (housekeeping)                                                  |
| P2: `carePanel.test.ts` 2915 linii             | 2914 linii (Get-Content), 53 `test(`, helper `load`/`okJson` samowystarczalny                                                                                                                                   | **ZROBIĆ**                                                                 |
| P3: `telemetryAiMl.ts`                         | 1219 linii (< próg 1500), 24 route'y, 28× `prisma.` (dług warstwy, nie rozmiaru)                                                                                                                                | **ODŁOŻYĆ**; przy dotknięciu wyciągnąć logikę nagród do `src/services/ml/` |
| —                                              | `public/rury.html:229` ładuje `js/studnie/partialLoader.js` (jedyny wyciek cross-module)                                                                                                                        | **ZROBIĆ przy okazji**, nie jako osobny etap                               |

Wniosek: **struktura katalogów zostaje bez zmian.** Plan obejmuje prawdę dokumentacji,
martwy kod, testy i 2 sieroty — bez przenoszenia plików produkcyjnych.

## 2. Przypięte komendy liczące (jedyne źródło liczb w docs)

```bash
node -e "const fs=require('fs'),p=require('path');const w=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?w(p.join(d,e.name)):[p.join(d,e.name)]);const {execFileSync}=require('child_process');const g=execFileSync('git',['grep','-o','-E','window\\\\.[A-Za-z_\$][A-Za-z0-9_\$]*\\\\s*=[^=]','--','public/js'],{encoding:'utf8'});console.log({js:w('public/js').filter(f=>f.endsWith('.js')).length,studnie:fs.readdirSync('public/js/studnie').filter(f=>f.endsWith('.js')).length,win:g.trim().split('\\n').length,adr:fs.readdirSync('docs/adr').length,scripts:w('scripts').length,tests:execFileSync('git',['ls-files'],{encoding:'utf8'}).split(/\\r?\\n/).filter(f=>/^tests\\/.*\\.(test|spec)\\.ts$/.test(f)).length})"
```

Wynik na `02eee97`: `{ js: 260, studnie: 150, win: 1278, adr: 16, scripts: 85, tests: 546 }`.

Uwaga: liczba linii zależy od metody (`Get-Content` vs split po `\n`), dlatego w docs
podajemy licznik plików, nie linii.

## 3. Etapy

| Etap   | Zakres                                                                                                                                                                 | Pliki                                                                                                     | Bramy                                                                                      | Ryzyko                           | Akceptacja                                                                         | STOP                                           | Wycofanie               |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | -------------------------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------- | ----------------------- |
| **A0** | Ten plan + adnotacja w ledgerze: `public/cenniki.html` usunięty w `95b64e6`, wpis E-122 historyczny (nie kasować dowodu)                                               | 2 `.md`                                                                                                   | `version:check` → `format` → `commit.mjs "docs(audit): plan poprawy po audycie struktury"` | niskie                           | plan w repo, ledger z adnotacją                                                    | —                                              | `git revert`            |
| **A1** | Liczby SSoT w 6 plikach wg komendy z §2                                                                                                                                | `README.md`, `AGENTS.md`, `CLAUDE.md`, `docs/ARCHITECTURE.md`, `docs/AUDIT.md`, `docs/agents/frontend.md` | `version:check` → `format` → `validate`                                                    | niskie (docs)                    | `git grep -nE "221                                                                 | 256                                            | 1771                    | 1748"` = 0 w kontekście liczników; każda liczba z §2 | liczba nieodtwarzalna komendą → nie wpisywać | `git revert` |
| **A2** | Usunięcie `src/types/index.ts` + 3 aliasów z `tsconfig.frontend.json`                                                                                                  | 2 pliki                                                                                                   | `typecheck` → `typecheck:frontend` → `test:quick` → `validate`                             | niskie                           | `tsc` exit 0; `git grep "@shared/\|@studnie/\|@rury/" -- public/js` = 0            | import z `types` → przywrócić barrel           | `git revert`            |
| **A3** | Podział `tests/frontend/carePanel.test.ts` (2914): helper `tests/frontend/helpers/carePanelHarness.ts` + 4 suity (`Panel`, `Api`, `View`, `Queue`); zero zmian asercji | 6 plików testów                                                                                           | `npx jest --testPathPatterns=carePanel --no-coverage` → `test:quick` → `validate`          | średnie (przenoszenie 53 testów) | **53 `test(` przed = 53 po**; 5 suit PASS                                          | zmiana treści asercji lub licznik ≠53 → cofnąć | `git revert` (1 commit) |
| **A4** | Usunięcie 2 sierot `docs/baseline/wellActions-baseline.json`, `wellManager-baseline.json` + wpis w `docs/ARCHITECTURE.md:267`                                          | 3 pliki                                                                                                   | `git grep "docs/baseline"` = 0 → `format` → `validate`                                     | niskie                           | 0 konsumentów potwierdzone przed `git rm`                                          | pojawi się konsument → STOP                    | `git revert`            |
| **A5** | (opcjonalnie) `public/rury.html:229`: `partialLoader.js` → `public/js/shared/`                                                                                         | 2 pliki                                                                                                   | `test:spa-guard` → `test:quick` → `validate`                                               | niskie                           | `git grep "studnie/partialLoader"` = 0; kolejność skryptów w `rury.html` bez zmian | ładuje się przed zależnościami → cofnąć        | `git revert`            |
| **A6** | Domknięcie: re-pomiar liczb po A2/A3/A5, checkpoint CLAIM/EVIDENCE/TESTS                                                                                               | plan                                                                                                      | `validate` → `format:check`                                                                | niskie                           | `validate` EXIT 0, `git status` czysty, **0 pushy**                                | FAIL → diagnose, nie `checkout --`             | —                       |

Zależności: A0 → A1 → (A2, A3 równolegle) → A4 → A5 → A6. A6 zawsze ostatni
(jedyne miejsce re-pomiaru liczb po zmianach).

## 4. Paczki GO

| Paczka | Etapy                         | Tryb                                 |
| ------ | ----------------------------- | ------------------------------------ |
| G1     | A0                            | 🟢 docs, bez pytania                 |
| G2     | A1                            | 🟢 docs, bez pytania                 |
| G3     | A2 + A4                       | 🟡 jedno GO (kod + usunięcie plików) |
| G4     | A3                            | 🟡 jedno GO (test-only)              |
| G5     | A5 + A6                       | 🟡/🟢 — A5 kod, A6 domknięcie        |
| 🔴     | `git push` po dowolnej paczce | zawsze osobna zgoda                  |

## 5. Czego nie robić (z dowodem)

1. **Split solvera** — `docs/plans/archive/solver-stop-confirm.md` (STOP), 9 domknięć
   i ~22 locale; testy pinują tekst źródła (`avrDeterminism.test.ts:192`).
2. **Refaktor `excelCopyPaste.js`** — protected zone + `excel-validator.py` w pre-commit.
3. **Grupowanie `public/js/studnie`** — 397 punktów dotknięcia, 0 zysku runtime.
4. **Konsolidacja baseline JSON** — 9 konsumentów (7 harnessów + 2 workflow).
5. **Podział `telemetryAiMl.ts`** — 1219 linii < 1500; problemem jest 28× `prisma.` w routes.
6. **Nowy ADR** — ADR-004/005/008/014 już wiążą; wystarczą 2 punkty w `docs/agents/`.

## 6. Ryzyka przekrojowe

- Testy ładują pliki po ścieżce (`vm.runInContext`, listy w kolejności) — 206 plików.
- `collisions:check` bez zapasu (45/45) — każdy nowy `window.X =` = FAIL.
- `version:check` obejmuje też commity docs; `?v=` w HTML zmienia tylko `auto-cache-bust.mjs`.
- Pre-commit: `python scripts/excel-validator.py` + lint-staged + encoding.
- `bundle-scripts.mjs` concatuje skrypty w kolejności DOM — cicha zmiana bundla.

## 7. Definition of done

- `npm run validate` EXIT 0, `git status` czysty, brak pusha.
- Liczby w 6 plikach odtwarzalne komendą z §2.
- `carePanel`: 5 suit, 53 testy (bez zmian liczby).
- Zero nowych `window.*`; `collisions:check` = 45.
- Świadomie nie zrobione: solver, Excel, grupowanie `studnie`, baseline JSON — z wpisem wyżej.

Szacunek: 4–6 sesji, 5–6 commitów, 0 pushy.
