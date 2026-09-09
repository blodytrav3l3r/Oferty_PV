# Etap 0 — Git Safety Audit (read-only)

**Data:** 2026-08-26
**Branch:** `main` @ `584aede`
**Zakres:** destrukcyjne operacje Git wg `docs/development/GIT_SAFETY.md` Tier A/B
**Metoda:** `grep` całego repo, `package.json` scripts, `.husky/*`, `scripts/*`, `*.bat`, `child_process` scan
**Wynik:** **0 aktywnych instrukcji destrukcyjnych na dirty worktree** — wszystkie trafienia to archiwalne plany + specyfikacja SSoT + read-only skrypty. Brak automatycznych ścieżek bypass poza agentem.

---

## Executive summary

- **12× `git checkout --`**, **11× `git restore`**, **6× `git reset --hard`**, **0× `git clean -f*` poza specyfikacją** — wszystkie w `docs/plans/archive/*` (historyczne) i `docs/development/GIT_SAFETY.md` (tabela Tier A jako dokumentacja, nie instrukcja wykonania).
- **Brak** aktywnego `git checkout -- / restore / reset --hard / clean` w kodzie wykonywalnym (`src/*`, `server.ts`, `scripts/*.mjs` produkcyjnych) na dirty.
- **2 skrypty automatyzujące Git:** `scripts/deploy.mjs` + `scripts/rollback.mjs` → `git checkout <tag>` (Tier A, CRITICAL) ale z `checkCleanTree()` (`git status --porcelain` → throw jeśli dirty) — **safe**.
- **Największe ryzyko реальные:** **agent** (model AI) wykonujący `git checkout -- / restore` by „naprawić” `typecheck` FAIL — dokładnie błąd z `wellTransitions.js:221` (`TS2339 blur` na `Element`). To Tier A HIGH bez guarda. Żaden `.husky` hook tego nie blokuje (Git nie ma `pre-checkout`/`pre-restore`).
- **False positives:** `restore-db.js` (DB, nie Git), `select()`/restore focus (Excel), `git rev-parse HEAD` (read-only).

**Blast radius ostatniego błędu:** 11 plików / 802 ins (CSS + JS wyglądu) utracone przez `git checkout -- public/css/* public/js/studnie/wellTransitions.js` na dirty. Odzysk tylko przez dangling `42afa2f` (`git fsck`). Brak L1 safety snapshot.

---

## 1. Inventory — wszystkie trafienia (plik:linia | komenda | kontekst)

| #   | Plik:linia                                         | Komenda / wzorzec                                                     | Kontekst                         | Tier wg GIT_SAFETY   | Utrata dirty?                 | Kategoria      | Etap migracji      |
| --- | -------------------------------------------------- | --------------------------------------------------------------------- | -------------------------------- | -------------------- | ----------------------------- | -------------- | ------------------ |
| 1   | `docs/plans/archive/podzial-studnie-html.md:302`   | `git checkout -- public/studnie.html` — przywraca oryginał            | Krok rollbacku planu podziału    | **HIGH** (Tier A)    | Tak                           | archiwalne     | **8**              |
| 2   | `podzial-studnie-html.md:321`                      | `git checkout -- public/studnie.html`                                 | powtórzenie                      | HIGH                 | Tak                           | archiwalne     | 8                  |
| 3   | `docs/plans/archive/PLAN_NAPRAWY_v3.md:33`         | `git restore .` # nowoczesny zamiennik `git checkout --`              | Procedura obowiązkowa → Rollback | **HIGH**             | Tak                           | archiwalne     | 8                  |
| 4   | `PLAN_NAPRAWY_v3.md:35`                            | `git reset --hard HEAD`                                               | twardy reset                     | **CRITICAL**         | Tak                           | archiwalne     | 8                  |
| 5   | `PLAN_NAPRAWY_v3.md:419`                           | `git restore . && git reset --hard HEAD`                              | Rollback batcha (Krok 8)         | **CRITICAL**         | Tak                           | archiwalne     | 8                  |
| 6   | `PLAN_NAPRAWY_v3.md:558`                           | `` `git checkout -- .` / `git restore .` / `git reset --hard HEAD` `` | Tabela porównania                | HIGH+CRITICAL        | Tak (dokumentacyjna)          | archiwalne     | 8                  |
| 7   | `PLAN_KROK8_VAR_LET.md:139`                        | `` `git restore public/js/studnie/excelAddDialog.js` ``               | Rollback kroku                   | HIGH                 | Tak                           | archiwalne     | 8                  |
| 8   | `PLAN_KROK8_VAR_LET.md:148`                        | `` `git restore public/js/studnie/excelTableManager.js` ``            | Rollback                         | HIGH                 | Tak                           | archiwalne     | 8                  |
| 9   | `PLAN_KROK8_VAR_LET.md:203`                        | `` `git restore public/js/studnie/excelTable*.js` ``                  | Rollback                         | HIGH                 | Tak                           | archiwalne     | 8                  |
| 10  | `PLAN_KROK8_VAR_LET.md:451`                        | `git restore <ścieżka>`                                               | instrukcja                       | HIGH                 | Tak                           | archiwalne     | 8                  |
| 11  | `PLAN_KROK8_VAR_LET.md:458`                        | `git checkout -- <ścieżki>`                                           | instrukcja                       | HIGH                 | Tak                           | archiwalne     | 8                  |
| 12  | `PLAN_KROK8_VAR_LET.md:460`                        | `git restore .`                                                       | instrukcja                       | HIGH                 | Tak                           | archiwalne     | 8                  |
| 13  | `PLAN_KROK8_VAR_LET.md:468`                        | `git reset --hard HEAD~1`                                             | cofnięcie commitu                | **HISTORY-CRITICAL** | Tak (jeśli dirty)             | archiwalne     | 8                  |
| 14  | `master-plan-refaktoryzacji.md:773`                | `` `git checkout -- public/partials/studnie/<partial>.html` ``        | Wycofaj zmiany partiala          | HIGH                 | Tak                           | archiwalne     | 8                  |
| 15  | `master-plan-refaktoryzacji.md:889`                | `git checkout -- public/studnie.html`                                 | przywraca HTML                   | HIGH                 | Tak                           | archiwalne     | 8                  |
| 16  | `master-plan-refaktoryzacji.md:890`                | `git checkout -- public/js/studnie/`                                  | przywraca JS                     | HIGH                 | Tak                           | archiwalne     | 8                  |
| 17  | `master-plan-refaktoryzacji.md:891`                | `git checkout -- public/css/`                                         | przywraca CSS                    | HIGH                 | Tak                           | archiwalne     | 8                  |
| 18  | `master-plan-refaktoryzacji.md:892`                | `git checkout -- src/validators/`                                     | przywraca backend                | HIGH                 | Tak                           | archiwalne     | 8                  |
| 19  | `import-export-removal-guide.md:77`                | `git checkout -- server.ts public/kartoteka.html ...`                 | Wycofanie modułu import-export   | HIGH                 | Tak                           | archiwalne     | 8                  |
| 20  | `2026-08-09-spojna-korekta-nazwy-aplikacji.md:491` | `git reset --hard <sha>`                                              | przed pushem                     | HISTORY-CRITICAL     | Tak                           | archiwalne     | 8                  |
| 21  | `docs/development/GIT_SAFETY.md:33-37`             | tabela Tier A/B `checkout -- / restore / reset --hard / clean`        | **SSoT specyfikacja**            | HIGH/CRITICAL        | **Nie** (opis, nie wykonanie) | aktywne — SSoT | **—** (nie ruszać) |
| 22  | `docs/development/GIT_SAFETY.md:108,212`           | `git restore direct / spawn git` w opisie bypassu                     | wyjaśnienie braku enforcement    | —                    | —                             | doc            | —                  |

**Brak trafień w:** `src/**`, `server.ts`, `.opencode/rules/**`, `AGENTS.md`, `CONTRIBUTING.md` (0× destrukcyjnych instrukcji). `AGENTS.md` nie zawiera `checkout --`.

---

## 2. Aktywne ścieżki ryzyka

| Ścieżka                                                                                        | Poziom       | Czy może wykonać destrukcję na dirty?                                                           | Guard                                                                                                         |
| ---------------------------------------------------------------------------------------------- | ------------ | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| **Agent AI** (`bash` tool `git checkout -- / restore / reset --hard / clean`)                  | **CRITICAL** | **Tak — dokładnie scenariusz 2026-08-26** (`typecheck FAIL → checkout --`)                      | Brak — Git nie ma `pre-checkout`, Husky nie blokuje. Wymaga wrappera w PATH (Etap 4).                         |
| **Użytkownik w PowerShell/Git Bash** ręcznie                                                   | CRITICAL     | Tak, jeśli skopiuje z `archive/*.md`                                                            | Brak safe CLI — Etap 4                                                                                        |
| `scripts/deploy.mjs:32` `execSync(step.cmd)` → `git checkout <tag>` (via `deploy-core.cjs:48`) | CRITICAL     | **Nie — `checkCleanTree()` rzuca jeśli `status --porcelain` dirty**                             | Safe — blokada przed deploy                                                                                   |
| `scripts/rollback.mjs:32` `git checkout <previousTag>`                                         | CRITICAL     | **Częściowo — `checkCleanTree()` tylko loguje WARN i kontynuuje** (rollback ma przywrócić stan) | **GAP:** `rollback` na dirty loguje, ale nie robi snapshotu przed `checkout` — Etap 4 powinien dodać snapshot |
| `src/version.ts:31-32` `execSync('git rev-parse HEAD')`                                        | —            | Nie — read-only                                                                                 | —                                                                                                             |
| `scripts/check-db.js:98,111` `execSync('git ...')` / `bump-version.mjs:68` `git diff --stat`   | —            | Nie — read-only/diff                                                                            | —                                                                                                             |
| `scripts/commit.mjs:104` `execFileSync('git','commit',…)`                                      | —            | Nie — commit, nie deselection worktree                                                          | —                                                                                                             |
| `.husky/pre-push` (8 linii)                                                                    | —            | Nie — waliduje `version:check`, `encoding:check`, `typecheck`, `test:quick:lite`                | Safe                                                                                                          |
| `package.json` scripts (`deploy`, `rollback`, `version:check`, `encoding:check`)               | —            | `deploy`/`rollback` jw., reszta read-only                                                       | —                                                                                                             |
| `*.bat` wrappers (`deploy.bat → deploy.mjs`, `rollback.bat → rollback.mjs`)                    | CRITICAL     | Tak, ale deleguje do `mjs` z checkiem                                                           | jak wyżej                                                                                                     |

**Wniosek:** jedyna **aktywna automatyczna** ścieżka destrukcyjna to `deploy`/`rollback` z `git checkout <tag>` — `deploy` już chroniony, `rollback` wymaga wzmocnienia snapshotem.

---

## 3. Archiwalne wzorce do migracji w Etapie 8

Wszystkie 19 trafień z `docs/plans/archive/*` + `import-export-removal-guide.md`.

**Obecny wzorzec (błędny, kopiowalny):**

```bash
git restore .
git checkout -- <path>
git reset --hard HEAD
```

**Docelowy wzorzec (5-krok, wg GIT_SAFETY §15):**

```bash
git status --short
# jeśli dirty →
git stash push -m "guard backup <op> <ts>" # lub safety snapshot
# verify sukces (git stash list / snapshot verify)
# dopiero:
git restore .   # / checkout -- / reset --hard / clean
# nigdy do naprawy typecheck/lint/test
```

- header `> DEPRECATED — sprzeczne z docs/development/GIT_SAFETY.md, wymaga snapshot→verify→authorize` + anti-pattern `FAIL → restore → PASS`.

**Mapa:**

| Plik                                           | Linie                               | Zmiana w Etapie 8                            |
| ---------------------------------------------- | ----------------------------------- | -------------------------------------------- |
| `PLAN_NAPRAWY_v3.md`                           | 28-36 (Rollback), 419, 558 (tabela) | zamień 3 bloki na 5-krok + `DEPRECATED`      |
| `master-plan-refaktoryzacji.md`                | 773, 889-892                        | to samo                                      |
| `podzial-studnie-html.md`                      | 302, 321                            | to samo                                      |
| `PLAN_KROK8_VAR_LET.md`                        | 139,148,203,451,458,460,468         | to samo                                      |
| `import-export-removal-guide.md`               | 77                                  | to samo                                      |
| `2026-08-09-spojna-korekta-nazwy-aplikacji.md` | 491                                 | `reset --hard <sha>` → 5-krok + `DEPRECATED` |

Nie ruszać w Etapie 0–7.

---

## 4. Automatyczne / bypass paths (ukryte)

| Bypass                                                                                       | Czy istnieje                                                                                                   | Ryzyko                         | Uwaga                                    |
| -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------ | ---------------------------------------- |
| `child_process.exec/spawn('git checkout -- ...')` w `src/**` / `scripts/*.mjs` produkcyjnych | **Nie** (grep 52× — tylko `rev-parse`, `status --porcelain`, `diff`, `commit`, `deploy-core` `checkout <tag>`) | Niska                          | `deploy`/`rollback` jw.                  |
| `execSync` w testach (`tests/migrations/*.test.ts` `execFileSync('git …')`)                  | Tak, ale testowe repo tymczasowe (`helpers.ts` tworzy `tmp`), nie prod worktree                                | Brak                           | —                                        |
| PowerShell `scripts/install-backup-cron.ps1` / `package.json` `backup:install-cron`          | Tak, ale `powershell -File` bez `git` destrukcyjnego                                                           | Brak                           | —                                        |
| `*.bat` (`deploy.bat`, `rollback.bat`, `install.bat`, `start.bat`, `build.bat`)              | `deploy.bat`/`rollback.bat` delegują do `mjs` z `checkCleanTree()`                                             | **Deploy safe, rollback WARN** | Etap 4: dodać snapshot do `rollback.mjs` |
| `npm scripts`                                                                                | `deploy`/`rollback` jw., reszta `typecheck/lint/test` read-only                                                | —                              | —                                        |
| `Makefile` / wrappery Git                                                                    | Brak                                                                                                           | —                              | —                                        |
| CI (`.github/workflows`)                                                                     | Nie skanowano plików workflow w tym audycie — **GAP**                                                          | ?                              | Etap 0 uzupełnić `grep` w `.github/**`   |
| Opencode agents                                                                              | `bash` tool — **główny bypass** (alias nie blokuje, brak `pre-checkout` hooka)                                 | **CRITICAL**                   | Etap 4: wrapper w PATH                   |

**Kluczowe rozróżnienie:**

- **Komenda w dokumentacji** (19× archive) ≠ **może wykonać automatycznie** (tylko `deploy`/`rollback` + agent `bash`).
- Obecnie **żaden** `archive` plan nie jest wykonywany automatycznie — to instrukcje kopiowalne dla człowieka/agenta.

---

## 5. False positives (odfiltrowane)

| Wzorzec                | Przykład                                                                                                    | Dlaczego false positive                                                                            |
| ---------------------- | ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `restore` (DB)         | `scripts/restore-db.js`, `npm run restore`, `docs/DEPLOY_UPDATE.md` `git checkout <tag>` vs `restore-db.js` | DB restore, nie `git restore`                                                                      |
| `checkout` tag         | `scripts/deploy-core.cjs:48` `git checkout ${tag}` vs `checkout -- <path>`                                  | `checkout <tag>` — przełącza branch, nie `checkout --` na dirty path; `deploy` ma `checkCleanTree` |
| `select()`             | `AGENTS.md:314` `restoreEl.select()`                                                                        | `select()` na input, nie `git restore`                                                             |
| `reset` (nie `--hard`) | `docs/development/GIT_SAFETY.md:43` `git reset` (soft)                                                      | Tier B, nie Tier A worktree destructive                                                            |
| `clean` w komentarzu   | `GIT_SAFETY.md:36-37` tabela                                                                                | specyfikacja, nie wykonanie                                                                        |

---

## 6. Mapa migracji Etap 8

```
Etap 8 (dopiero po wdrożeniu guarda):
├── docs/plans/archive/PLAN_NAPRAWY_v3.md               → 3 bloki (L28-36, L419, L558)
├── docs/plans/archive/master-plan-refaktoryzacji.md    → 5 bloków (L773, 889-892)
├── docs/plans/archive/podzial-studnie-html.md          → 2 bloki (302,321)
├── docs/plans/archive/PLAN_KROK8_VAR_LET.md            → 7 bloków (139,148,203,451,458,460,468)
├── docs/plans/archive/import-export-removal-guide.md   → 1 blok (77)
├── docs/plans/archive/2026-08-09-spojna-korekta-*.md    → 1 blok (491)
└── AGENTS.md + .opencode/rules/common/git-workflow.md  → Etap 5 (nie Etap 8): 4 reguły + anti-pattern

Całość: zamiana na 5-krok snapshot→verify→authorize, header DEPRECATED, tabela HIGH/CRITICAL.
Zero zmian w Etapie 0–7.
```

---

## 7. Gaps / findings wymagające decyzji

| #   | Finding                                                                                                      | Rekomendacja                                                                                                                 | Decyzja needed                                                |
| --- | ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| G1  | `scripts/rollback.mjs:35-43` `checkCleanTree()` na dirty tylko `log WARN`, nie snapshot+block                | Etap 4: `rollback` ma robić safety snapshot przed `checkout <previousTag>` jak Tier A CRITICAL, nawet jeśli „przywraca stan” | Tak — czy rollback ma być CRITICAL z obowiązkowym snapshotem? |
| G2  | **Bypass `git checkout -- -- <path>` vs `git checkout -- <path>`** — różne składnie                          | Guard musi parsować obie (grep wykrył tylko ` --` + `--`)                                                                    | Tak — czy guard normalizuje wszystkie warianty? (tak)         |
| G3  | **`git clean -fd/-fdx` nie występuje w repo poza specyfikacją** — brak testu realnego                        | Etap 6: dodać test `clean -fdx` na fake repo z `ignored` file                                                                | Tak                                                           |
| G4  | **CI `.github/**` nie przeskanowany** w tym audycie (workflows mogą mieć `actions/checkout` z `clean: true`) | Uzupełnić audyt Etapu 0 o `grep` w `.github/workflows/**`                                                                    | Tak — rozszerzyć audyt?                                       |
| G5  | **`git restore --staged`** (index) nie wykryty grepem — Tier A                                               | Dodać do Tier A w `GIT_SAFETY.md` i do guard parsowania `restore --staged`                                                   | Tak                                                           |
| G6  | **AGENTS.md obecny nie ma zakazu `FAIL → restore`**                                                          | Etap 5: dodać diagnostyczną regułę `typecheck FAIL nigdy nie naprawiaj restore`                                              | Zatwierdzone                                                  |
| G7  | **Automatyczny `prisma migrate reset` (`package.json: prisma:reset`)** — destrukcja DB, nie Git              | Poza scope Git Safety, ale powiązane z utratą pracy (DB) — odnotować jako finding                                            | Nie naprawiać w tym planie                                    |

**Bezpośrednio związany z utratą dirty worktree (poza Git Safety scope):** `npm run prisma:reset` (`migrate reset` — drop DB) może usunąć dane dev, ale to Tier DB, nie Git — odnotowane jako G7, bez naprawy w Etapach 0–8.

---

## 8. Podsumowanie Etapu 0

- **Audyt zakończony, zero zmian w repo** — raport read-only.
- **Aktywne ryzyko:** agent + `rollback` WARN + brak guarda na `checkout --/restore/clean/reset --hard`.
- **Archiwalne 19 instrukcji** — mapa migracji gotowa na Etap 8.
- **Next:** **Etap 1 SSoT już wykonany** (`584aede`), **Etap 2 kontrakt** `Operation/WorktreeState/Snapshot/...` — zgodnie z planem zamkniętym 0–8.
