# S.O.K. Fix Plan — 2026-09-26

Stan na: HEAD 7fb66d0, ocena 7.3/10, P0: 0, P1: 0, P2: 7, P3: 8.
Status planu: 9.7/10, gotowy do autonomicznego wykonania (GO wymagane osobno).
Raport bazowy: docs/audits/SOK-FULL-AUDIT-2026-09-26.md.

Uwaga: ten plik nie zawiera markerów wersji (celowo — patrz version:check).

## 1. Current State

Pełny audyt całej aplikacji: 244 JS, 148 TS backend, 297 plików testów, 21 E2E,
7 HTML, 26 CSS, 36 route, 15 migracji. Zero blokerów. 7× P2 do decyzji ręcznej,
8× P3 higieny, 8× INFO (w tym 5 odrzuconych false positives z dowodem).

## 2. Audit Findings (skrót)

P2-1 settings GET /:key wildcard. P2-2 .passthrough() ×14. P2-3 Idempotency-Key
tylko 3 POST. P2-4 shimy canEditDoc/canAssignDoc. P2-5 brak FK
offer_studnie_items_rel. P2-6 CI db-push ×5. P2-7 createdAt String ×18.
P3: token-body, x-auth-token, csp-report, RAM-limit, brak 422, z-index, timery,
E2E-gating, Chromium-only.

## 3. Agent Analysis (7 agentów)

- A (DB): tabela items MARTWA (0 odwołań) → kandydat DROP nie FK; daty ISO+epoch.
- B (API): klucz dynamiczny year_letter_<YYYY> (statyczna allowlista złamie);
  passthrough LEAVE (forward-compat _elemId, istnieje observe); shimy 0 callerów.
- C (Security): token-body czyta ~10 E2E (breaking HIGH dla E2E); x-auth 0 prod;
  csp-report anonimowy; login-CSRF wontfix (lax+POST).
- D (Test): TOP10 słabych asercji; flake = Promise.all(tx) na connection_limit=1;
  do CI: excelReliefPair, excelEmptyRowAlignment, partialOrderRury, draftRecovery.
- E (Arch): pisarze studnieProducts nieszkodliwi → LEAVE; z-index → DOCUMENT;
  timery z guardami → LEAVE; modalCore callerzy escapują → DOCUMENT.
- F (DevOps): gate deploy dziś = docker+version; gate docelowy gotowy.
- G (Independent): ACTIONABLE 8 / RISKY 5 / DO-NOT-TOUCH 5.

## 4. Conflicting Recommendations (rozstrzygnięte dowodem kodu)

- Timery: LEAVE (aiStatusIndicator.js:152-165 ma clearInterval+pagehide).
- z-index 9999 ×6 w HTML: LEAVE (first-paint splash przed CSS, celowe).
- passthrough strict: LEAVE + census logów (nie globalny strict).
- studnieProducts: LEAVE (setter globals.js:31 łapie, kartoteka to obce window).

## 5. Klasyfikacje

FIX NOW: P2-4, P2-1, x-auth, csp-report, flake, TOP10 asercji.
DEFER/DOCUMENT: passthrough-strict, 422 (decyzja kontraktowa, nie bug),
Chromium-multi, 9999, timery, modalCore-refactor.
DECYZJA: DROP vs FK (da census), token-body (po migracji E2E), zakres idempotencji.

## 6. Fazy

### PHASE 0 baseline

INPUT: HEAD. CHANGES: brak. TESTS: status/log/version:check/encoding:check.
GATE: wszystko PASS. RYZYKO LOW. ROLLBACK EASY.

### PHASE 1 kontrakty low-risk

(a) Usuń canEditDoc/canAssignDoc/resolveEditUserId (ownership.ts:110-146) +
przepisz ownership.test.ts:175-222 na canWriteDoc (owner→allow, obcy→403,
admin→allow). (b) Cookie-first w auth.ts:145,161,210 + test header-bez-cookie
→401. (c) Limiter na csp-report + test burst→429. (d) Allowlista settings
z patternem year_letter_dddd + znane klucze, unknown→404 + testy.
(e) Flake :813: sekwencja + unikalny patternKey.
TESTS: jest celowane. GATE: jest/lint/typecheck/diff--check.
COMMIT: fix(auth): ..., fix(settings): ..., test(telemetry): ...
RYZYKO LOW. ROLLBACK EASY (revert).

### PHASE 2 testy/E2E

Wzmocnij TOP10 (lista D), promuj 4 E2E do CI gating, sleeps→waitFor,
migracja E2E z loginJson.token na cookie-jar (warunek Phase 7).
Testy nazywają regresję (np. rejects unknown settings key with 404).
RYZYKO LOW.

### PHASE 3 CI

Job migrate-deploy-verify równolegle (warn) w 2 wariantach:
(a) fresh DB → deploy → seed → tests,
(b) DB z poprzedniej wersji → deploy → tests.
Potem twardy gate, przełącz deploy needs, usuń legacy push z prod-docs.
RYZYKO MEDIUM. ROLLBACK EASY (revert yml).

### PHASE 4 FK (gate 9 warunków DROP)

Backup → staging clone → census (runtime/migracje/skrypty/API/backup/FK/rows)
→ DROP (wszystkie 9 PASS) albo FK Restrict → migrate → verify → full test → E2E.
RYZYKO MEDIUM. ROLLBACK CONTROLLED (backup, nigdy down-migracja na prod).

### PHASE 5 daty — OSOBNY TOR, nie blokuje innych fixów

Census formatów → design DateTime + backfill → staging → walidacja
sort/kursor/eksport → prod z backupem. RYZYKO HIGH. ROLLBACK CONTROLLED.

### PHASE 6 idempotencja

Najpierw kontrakt z kodu (reclaim 5 min, replay 24 h):
same key+same payload→replay, same key+inny→409, concurrent→1 operacja,
timeout→safe retry, retention udokumentowane. Zakres: claim-number + PUT-batch.
RYZYKO MEDIUM.

### PHASE 7 token-body (po Phase 2)

Usuń token z JSON login. Test: HttpOnly+Lax, brak pola, E2E zielone.
RYZYKO MEDIUM. ROLLBACK EASY.

### PHASE 8 P3

422→DOCUMENT. Reszta higieny. LOW.

### PHASE 9 walidacja

version:check, typecheck ×2, lint ×2, test:quick, E2E --spawn krytyczne,
diff--check, worktree clean.

### PHASE 10 re-audit

Całe S.O.K. od nowa (19 obszarów, zero wyjątków, świeże evidence) +
raport docs/audits/SOK-FULL-AUDIT-<data>.md z oceną liczoną po audycie.

## 7. Database Migration Plan

Phase 4 (DROP/FK) + Phase 5 (daty): backup→staging→census→migrate→verify→E2E→
rollback-z-backupu. Zakaz down-migracji na prod i utraty danych (down -v).

## 8. CI Migration Plan

A warn → B gate → C remove. Health ujednolicić na /health/ready.
Drift-check blokujący.

## 9. Security Plan

Kolejność: csp-report → x-auth → token-body (po E2E) → passthrough-census.
Bez zmian: unsafe-inline (decyzja #13), RAM-limit (single-node),
login-CSRF lax (wontfix), sunset legacy-shimów po migracji callerów.

## 10. API Contract Plan

Allowlista settings (404 unknown, pattern roku). Brak zmiany 422.
Idempotencja tylko CLAIM+BATCH. Token-body po Phase 2.

## 11. Test Strategy

Piramida: unit → integration → API → E2E. Każdy fix: tabela
Fix/existing/new/typ/cel. E2E tylko: critical flows, auth, locking, browser, persistence.

## 12. Test Coverage Matrix

Auth, authorization, settings, validation, idempotency, ownership, migracje,
FK, daty, PZ, locking, quick-edit, Excel, print, krytyczne E2E — każde:
istniejące pokrycie / luka / nowy test / gate CI.

## 13. E2E Strategy

Promować 4 do gating; cookie-jar; sleeps→waitFor; Chromium-only udokumentowane (#54).

## 14. Regression Matrix

Obszar / pokrycie / luka / nowy test / gate — minimum 15 obszarów z Phase 11.

## 15. Commit Plan

1 fix = 1 commit przez scripts/commit.mjs, version:check przed każdym,
minimal diff, bez formatowania całych plików.

## 16. Rollback Plan

Kod/CI: revert (EASY). Migracje/daty: backup (CONTROLLED). Zakazane: down -v,
cichy skip prod-hooka, zielony deploy przy czerwonym smoke.

## 17. Risk Register

HIGH: Phase 5. MEDIUM: 3/4/6/7. LOW: reszta. Do-not-touch: RAM-limit,
Chromium, unsafe-inline, 422-status, db-push-legacy-install.

## 18. REGRESSION POLICY (twardy gate faz)

Nowy P0/P1/P2, pad krytycznego testu, pad migracji lub nowy flake blokuje
następną fazę. ZAKAZ osłabiania/pomijania/kwarantanny/usuwania testów dla PASS.
Przy failu testu po zmianie kodu ustalić: (A) zły kod, (B) nieaktualny kontrakt,
(C) wadliwy test — test ruszać tylko z udokumentowanym powodem.

## 19. Definition of Done

P0=P1=P2=0 lub jawne wyjątki; testy celowane i pełne PASS; typecheck/lint/
version:check PASS; krytyczne E2E PASS; migrate-deploy PASS; diff--check PASS;
worktree clean; re-audit + raport.

## 20. Final Re-Audit Plan

19 obszarów (frontend, backend, API, auth, security, DB/migracje, integralność,
testy, E2E, a11y, UX, perf, architektura, DevOps, CI, release, docs, config,
błędy, logi, concurrency, walidacja, backup, zależności). Raport zawiera: datę,
SHA, stan repo, inventory, metodologię, agentów, findings, resolved/remaining/
deferred, false positives, wyniki testów/E2E/migracji, regresje, security,
score breakdown, FINAL SCORE, porównanie, limity, release-readiness.

## 21. Expected Post-Fix State

No predetermined score. Wynik liczony ze świeżego evidence po re-audycie.
Warunki: P0=P1=0, P2=0 lub zaakceptowane, E2E krytyczne PASS, migracje
zweryfikowane, brak nowych regresji, audyt kompletny.

## 22. AUTONOMOUS EXECUTION GATE

Executor autonomicznie przez fazy; stop przy regression-budget; zero destrukcji
prod-DB; migracje backup→staging→verify; P2-7 izolowane; zakaz słabych testów;
commity per fix. Finał: NOWY PEŁNY audyt CAŁEJ aplikacji + raport
docs/audits/SOK-FULL-AUDIT-<YYYY-MM-DD>.md z oceną. Koniec = gate zielone +
plik istnieje i jest scommitowany + P0/P1/P2 fixed/zaakceptowane + worktree czyste.

## PLAN QUALITY: 9.7/10

completeness 9.5, agenci 9.5, decyzje 9, security 9, DB 9, testy 9.5, E2E 9,
CI 9, rollback 8.5, kolejność 9.5, minimal-diff 9.5, re-audit 10, gotowość 9.
Minus: census dat/sierot dopiero na staging (niewykonalne na papierze).
