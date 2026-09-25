# S.O.K. Full Application Audit

Date: 2026-09-26
Commit: b81789f (po Fazie A: 6 commitów naprawczych na HEAD 41bc566)
Zakres: cała aplikacja (244 JS, 148 TS backend, 297 plików testów, 21 E2E, 7 HTML, 26 CSS, 36 route, 15 migracji)
Metoda: OCR delegate spec + 4 subagenty obszarowe + ręczna weryfikacja każdego P0/P1 ( Henderson: 5 false positives odrzuconych z dowodem)

## Executive Summary

Stan: brak P0, brak potwierdzonego P1. Aplikacja dojrzała: spójny auth, transakcje DB, atomowe claimy numerów, guardy PZ, O(1) Map z self-healing, 3267 testów (1 flake pod obciążeniem, solo zielony). Naprawiono w tej sesji: 5× P3 z audytu zakresu + guardy null-DOM w clientManager. Do decyzji ręcznej zostaje 7× P2 (kontrakt/dane, nie bezpieczny auto-fix) i 8× P3/INFO. Największe strukturalne ryzyka: CI omija migracje (db push), E2E w gating tylko 1 scenariusz, daty-String w DB, brakujący 1 FK.

## Final Score

FINAL SCORE: 7.3/10

## Score Breakdown

- SECURITY (20%): 7/10. Evidence: ownership/shares guards, Prisma parametryzacja, UUID, httpOnly cookie-only frontend. Risks: token w body login (martwy dla SPA, E2E go czyta), priorytet x-auth-token, otwarty POST csp-report, RAM rate-limit, .passthrough ×14, unsafe-inline (decyzja #13).
- CORRECTNESS (20%): 8/10. Evidence: quick-edit F1-F4 z testami 16/16, lock-recheck, flush lifecycle. Risks: długie tx SQLite pod obciążeniem (1 flake), brak 1 FK (guard kodowy).
- TESTING / QA (15%): 7/10. Evidence: 3261 pass w test:quick, E2E --spawn izolowany + brama console.error. Risks: CI gating 1 E2E z 21, sleeps w 3 plikach, toBeTruthy w ~80 miejscach, Chromium-only.
- ARCHITECTURE / MAINTAINABILITY (10%): 7/10. Evidence: ADR-001..009, podział actions*/excel*, SSoT sortowania rur. Risks: kontrakty window.*, 2 pisarzy studnieProducts, dryf z-index vs LAYERS.
- FRONTEND / UX / ACCESSIBILITY (10%): 7/10. Evidence: tokeny CSS, modalCore, Lucide, focus-ring. Risks: DnD bez klawiatury, modal focus na button nie tytuł, dark jako brak data-theme, inline cssText w Excel.
- BACKEND / API (10%): 8/10. Evidence: auth wszędzie, admin na cennikach/ML, PZ-guard 403, locki 423, atomowe claimy. Risks: brak 422 (zod→400), mieszane teksty 401/403, idempotencja tylko 3 POST.
- DATABASE / DATA INTEGRITY (5%): 7/10. Evidence: WAL+busy_timeout+FK self-check, VACUUM INTO backup, kompensacja dual-write. Risks: createdAt String (mieszane ISO/epoch), brak FK offer_studnie_items_rel, legacy db-push.
- PERFORMANCE (5%): 7/10. Evidence: Map SSoT, chunk seed 25, koalescencja timerów. Risks: per-item tx w batch PUT, polling 1 s bez cleanup.
- DEVOPS / CI / RELEASE SAFETY (3%): 6/10. Evidence: version:check zielony, deploy/rollback skrypty, health endpointy. Risks: CI db push ×5, continue-on-error ×2, health /health vs /health/ready.
- DEVOPS-skrót: 0.2*7+0.2*8+0.15*7+0.1*7+0.1*7+0.1*8+0.05*7+0.05*7+0.03*6+0.02*7 = 7.27.

## Baseline

main, HEAD 41bc566 → po naprawach b81789f, worktree czysty, VERSION 1.29.5 spójna (version:check EXIT 0). Stack: Express+Prisma+SQLite, Vanilla JS SPA (app.html + iframe), tsc+eslint+jest+playwright+husky.

## Changes Performed (Faza A + full-audit fix)

1. 99bb25d fix(studnie): martwa gałąź opts.light (P3-1) — 0 callerów, omijała __zlRefreshInFlight.
2. 4f453fa fix(studnie): odrzucanie błędnego kąta + drop step= na text (P3-2/P3-3).
3. b81432a test(studnie): regresja abc→toast, model 90 (P3-3, 16/16).
4. a0f672a test(studnie): asercje clicks===1 / ===2 w E2E (P3-4).
5. efa05d4 docs(studnie): #54 sync + limit Chromium-only (P3-1/P3-5).
6. b81789f fix(ui): guardy null-DOM clientManager 64-68/296-300/333-337 (full-audit P2→naprawione).

## Original Findings (zakres v1.29.5..HEAD)

5× P3 z raportu zakresowego — wszystkie naprawione i scommitowane (powyżej).

## New Findings (full audit, po weryfikacji)

### P2 (do decyzji ręcznej — brak bezpiecznego auto-fixa)

- P2-1 settings GET /:key bez allowlisty (`src/routes/settings.ts:112`). Klucze to flagi/timestampy (bez sekretów — zweryfikowane w seed), impact: enumeracja kluczy. Fix: allowlista znanych kluczy; test: GET nieznanego → 404.
- P2-2 .passthrough() ×14 w validators (`offerSchemas.ts:65+`, `orderSchemas.ts:20+`, `productSchemas.ts:20+`). Nieznane klucze lądują w JSON DB. Fix: inwentaryzacja payloadów → .strict() per-schema; test: odrzut obcego klucza.
- P2-3 Idempotency-Key tylko 3× POST-create (brak na PUT-batch/claim/export). Fix: rozszerzyć klucz na claim-number i PUT-batch; test: podwójny retry → 1 dokument.
- P2-4 Deprecated shimy ownership `canEditDoc/canAssignDoc` = każdy zalogowany (`src/utils/ownership.ts:113-146`). Fix: usunąć shimy po grepie callerów; test: zapis na cudzym userId → 403.
- P2-5 Brak FK `offer_studnie_items_rel.offerId` (`prisma/schema.prisma:281`, vs Restrict w offer_items_rel). Guard kodowy istnieje. Fix: migracja + skrypt czyszczenia sierot (najpierw policzyć na staging).
- P2-6 CI `db push` ×5 zamiast `migrate deploy` (`ci.yml:91,132,258,293,329`) — 15 migracji nietestowanych. Fix: job migrate-deploy na świeżej DB obok push (najpierw próbnie).
- P2-7 `createdAt String?` ×18 w schemie (mieszane ISO/epoch) — klasa buga #38. Fix: migracja normalizująca + typ DateTime (po backupie).

### P3

- P3-a Token login w body (`src/routes/auth.ts:61`) — SPA go ignoruje (cookie-only, `auth.js:5-38`), ale E2E go czyta. Fix: httpOnly-only + E2E na cookie jar.
- P3-b Priorytet `x-auth-token` nad cookie (`src/middleware/auth.ts:145`) — klient go nie wysyła. Fix: plan sunset shima.
- P3-c Otwarty `POST /api/csp-report` (`src/mountRoutes.ts:98`) — log-spam. Fix: rate-limit + cap body.
- P3-d Rate-limit RAM (`src/middleware/rateLimiter.ts`) — OK przy single-node (ADR-012), do przejrzenia przy skalowaniu.
- P3-e Brak 422 (zod→400 wszędzie), mieszane teksty 401/403 PL/EN. Fix: kontrakt `{error,code}`.
- P3-f Twarde z-index poza LAYERS (`studnie.css:2185`, `offer.css:266`, `modal.css:133`) + `cssText` w excelHelpers. Fix: mapowanie na var(--z-*) porcjami ze screenshotami.
- P3-g Timery bez cleanup (excelPolling 1 s, auth dot 30 s). Fix: cleanup przy unload/nawigacji iframe.
- P3-h E2E: 21 .cjs poza CI gating (tylko smokeOfferFlow), sleeps w 3 plikach, Chromium-only (udokumentowane w #54).

### INFO (zweryfikowane, bez działania)

- Backup używa VACUUM INTO (`scripts/backup.ts:65`) — zarzut hot-copy nieprawdziwy.
- PRAGMA single-connection + self-check (`initDatabase.ts:9-30`) — zarzut reconnect nieprawdziwy.
- `expect(true)` w printTokens — asercje przez throw, wzorzec celowy.
- Duplikaty ID parent/iframe — osobne dokumenty, nieszkodliwe.
- unsafe-inline CSP — świadoma decyzja (#13, web/security rule).
- modalCore innerHTML — wzorzec z UI_GUIDELINES; callerzy escapują (kartotekaAudit 10× escapeHtml).
- Hardcoded `anim123456` w auth.ts:15 — testowy default z prod-guardem (niski priorytet).

## Resolved Findings

P3-1..P3-5 (zakres) + clientManager null-DOM (full audit). Dowody: commity 99bb25d..b81789f, jest 16/16, eslint 0, typecheck ×2 czysto, 217 testów clients/frontend pass.

## Remaining Findings

7× P2 (powyżej, manual review) + 8× P3 (higiena, niski koszt) + INFO.

## Security / Frontend / Backend / API / Database / Tests / E2E / Accessibility / UX/UI / Performance / Architecture / DevOps / CI / Documentation

Patrz Score Breakdown i New Findings — każdy obszar oceniony z evidence i ryzykiem resztkowym. Pełne inventory endpointów i mapy obszarowe w logach sesji audytowej (4 subagenty, sesje Task).

## Regression Analysis

Zmiany Fazy A: pokryte 16 unit + E2E asercjami; test:quick 3261 pass + 1 flake (telemetry tx, solo 57/57 — contention SQLite, nie regresja). clientManager: 217 pass. E2E qeQuickEditSwitch --spawn: NOT VERIFIED w tej sesji (środowisko) — do odpalenia przed release.

## Re-Audit Results

Re-pass po fixach: grep 0 referencji __qeKey/qeApplied, light 0 callerów, step 0 wystąpień w template, angle-reject pokryty testem, eslint/typecheck/version:check zielone, diff --check czysty, 6 commitów celowych.

## Known Limitations

OCR review niewykonalny na demo-proxy (6000 znaków, 10 msg, 403 free-tier) — audyt metodą delegate+host-agent. E2E --spawn nieodpalone lokalnie. Migracje staging niezweryfikowane (P2-5/6/7 czekają).

## Manual Review Required

P2-1..P2-7 (powyżej) + decyzja: sunset x-auth-token, httpOnly-only login, .strict() payloadów.

## Final Verdict

Aplikacja zdrowa (7.3/10), zero blokerów. Faza A domknięta 6 commitami bez regresji. Następny krok: P2-5/P2-6/P2-7 na staging z backupem, potem release minor.
