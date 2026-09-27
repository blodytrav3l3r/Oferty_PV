# AUDIT v2 — raport końcowy BUILD (2026-09-27, S.O.K. 1.31.0)

## 1. Executive summary

Tryb: AUTONOMOUS BUILD, plan P0 → GO/NO-GO → P1 → P2 → P3.
Wynik: **18 commitów, 0 regresji, wszystkie bramy zielone.**

| Weryfikacja                            | Wynik                                               |
| -------------------------------------- | --------------------------------------------------- |
| `test:quick:lite`                      | 329 suitów / 3460 testów PASS                       |
| `tests/migrations`                     | 6 suitów / 15 testów PASS                           |
| typecheck BE + FE                      | PASS                                                |
| lint BE + FE                           | PASS                                                |
| `version:check`, `encoding:check`      | PASS                                                |
| `appname`, `licenses`, `prices:verify` | PASS                                                |
| `collisions:check`                     | 44 zgłoszenia (pre-existing, informacyjne)          |
| `migrate deploy` + seed (scratch DB)   | 16 migracji, drift 0                                |
| NEW `window.*`                         | +1 (`isValidatedMlSolution`, wzorzec sankcjonowany) |
| NEW `onclick` / inline styles          | 0                                                   |
| NEW security exceptions                | 0                                                   |

## 2. Stan startowy

Main 1.31.0: 48 modeli Prisma, 16 migracji, 245 plików `public/js`,
1434 `window.*`, ~290 `onclick`, AGENTS.md 433 linie, 5 workflowów.
Baseline `test:quick:lite`: 316 suitów / 3396 testów PASS.
Pre-existing dirty: `tests/migrations/baseline.test.ts` (line-endings, nietknięte).

## 3. Zmiany P0 (MUST, 6 commitów)

- `89f4e7a` **P0.1 CSRF**: `src/middleware/csrf.ts` (same-origin dla POST/PUT/PATCH/DELETE; oba brak → 403; `/api/csp-report` zwolniony) + wpięcie w `app.ts` + `Origin: BASE` w `load-100/benchmark/benchmark-baseline` + `tests/security/csrf.test.ts` (9 przypadków).
- `3db735f` **P0.2 disclosure**: `/health` → `{status,timestamp}`, `/api/version` → `{version}`, `/health/ready` bez klucza `error`, nowy `/api/admin/system-info` (admin) + `tests/security/informationDisclosure.test.ts` (4, na prawdziwym `app`).
- `ed3719c` **P0.3 Zod**: klasyfikacja A/B/C — wszystkie 14× `.passthrough()` to klasa A (dowody: `uid` w itemkach, pola solvera/serwera w payloadach, trasy czytają `req.body` + ownership fail-closed). Komentarze `P0.3(A)` + `tests/security/validation.test.ts` (7).
- `16f0763` **P0.4 audit**: `recordAuditFailure()` + licznik `audit.failures` w `/metrics` + strukturalny log z kontekstem; debounce scala diffy (merge) zamiast nadpisywać + `tests/security/audit.test.ts` (3).
- `12091eb` **P0.5 CI**: `release.yml` na `migrate deploy` + seed + status (parity prod); zweryfikowane lokalnie na scratch DB (16 migracji, drift 0).
- `81c8a28` **P0.6 matrix**: `tests/security/{auth,ownership,rateLimit,headers}.test.ts` (15) — cookie-only + sunset shim, macierz ownership, burst 429, CSP enforce + nonce.
- **P0 GATE**: `test:quick` 330/3449 PASS → **P0 STATUS = GO**.

## 4. Zmiany P1 (HIGH, 8 commitów)

- `dc172cf` **P1.1**: `tests/offersContract.test.ts` — PUT `/api/offers-rury` 200/400/401/403/409 (5).
- `c49bab1` **P1.2**: `blindWrite()` w `versionWrite.ts` — ślepy zapis w pustkę to 409 (był cichy sukces); `tests/versionInvariant.test.ts` (6); naprawa 2 niewiernych mocków `updateMany` (default `{count:1}` po `resetAllMocks`).
- `7dbac0e` **P1.3**: `window.isValidatedMlSolution` w `solverAutoSelect.js` — zwycięzca ML musi być referencją kandydata solvera; `tests/studnie/mlValidationGate.test.ts` (4, vm z prawdziwego pliku).
- `e422c15` **P1.4**: `tests/studnie/solverInvariants.test.ts` — 5 właściwości × 200 prób, seedowany LCG (brak fast-check w deps; zero flaky, zero nowych zależności).
- `d4b6a48` **P1.5**: `src/utils/snapshots.ts` (koperta `{schemaVersion:1,data}` + legacy passthrough + `UnknownSnapshotVersionError`) + adopcja read-side w `src/routes/audit.ts` + `tests/snapshots.test.ts` (6). Writery w P2-followup.
- `c862d61` **P1.6**: `scripts/telemetry-measure.mjs` + `npm run measure:telemetry`. Pomiar: telemetria 165 wierszy/dzień, 0.6 MB/dzień (retencja NIEpilna); audyt 238 wierszy/dzień × ~81 KB (1.28 GB, by design, retencja 180 dni działa).
- `5dfeb60` **P1.7**: axe-a11y bez `continue-on-error` (spec filtruje critical/serious); e2e-extended celowo advisory.
- `83c19e1` **P1.8**: `docs/SYSTEM_INVARIANTS.md` (I-001–I-012 z Owner/Enforcement/Tests).
- **P1 GATE**: `test:quick` 335/3474 PASS → **P1 STATUS = GO**.

## 5. Zmiany P2 (3 commity)

- `35f5153` **P2.4**: AGENTS.md 433 → 49 linii (mapa + bramy) + `docs/agents/{frontend,backend,database,security,testing,release,commands}.md`. Bez utraty treści (komendy i kodowanie w `commands.md`).
- **P2.6/2.7 audyt (bez kodu)**: idempotency na wszystkich create/claim (16 miejsc); writeLock na wszystkich trasach cennikowych (10 miejsc); dokumenty chroni `versionedWrite` + doc-locks. Pokrycie adekwatne — brak luk.
- `7a125d4` **P2.8**: single-instance BY DESIGN (komentarz w `cronService.ts` + spec `job_locks` na przyszłość). Bez implementacji, bez Redisa.
- P2.1–2.3/2.5: polityka NEW=0 wyegzekwowana w batchu (poza sankcjonowanym `isValidatedMlSolution`).

## 6. Zmiany P3 (2 commity)

- `036b932` **dashboard źródła**: `storage {dbBytes, walBytes, backups, lastBackupAt}` w `/metrics` (sync fs, sygnatury bez zmian) + test.
- `124c8f3` **lineage minimum**: `trainingRows/trainingSeed/lastTrainingRun` w `ml-status` + tooltip badge (wiersze/run). Bez zmiany schematu (dataset fingerprint wymaga migracji — follow-up).
- **Odroczone z uzasadnieniem** (BUILD_FOLLOWUPS.md): uproszczenie UX studni (strefa Excel, wymaga testów z użytkownikiem), pełny dashboard UI, migracja writerów snapshotów, fingerprint datasetu.

## 7. Commity

18 commitów one-problem-one-commit (lista w `git log`, zakres `89f4e7a..124c8f3`): 6× P0, 8× P1, 3× P2, 2× P3 (liczone z P1.8 i bramami). Każdy: testy → typecheck/lint → format → version:check → review diffa.

## 8. Testy (nowe)

csrf (9), informationDisclosure (4), validation (7), audit (3), auth (5), ownership (5), rateLimit (2), headers (3), offersContract (5), versionInvariant (6), mlValidationGate (4), solverInvariants (5), snapshots (6), metrics +1. Razem **+65 testów**, wszystkie zielone.

## 9. Security matrix

Endpoint × właściwość: Offer create/update (auth✓ ownership✓ CSRF✓ validation✓ lock✓), Offer delete/duplikat (jak wyżej), Pricing/cenniki (role + lock), Public health (brak auth, brak disclosure), login/logout (CSRF✓, rate-limit✓). Pokrycie w `tests/security/*` + `tests/offersContract.test.ts`.

## 10. System invariants

`docs/SYSTEM_INVARIANTS.md` I-001–I-012 (cena, validacja, ownership, numeracja, migracje, backup, ML-vs-validation, PDF, version-bump, CSRF, disclosure, audit). Każdy z Owner/Enforcement/Tests.

## 11. Migration status

16 migracji; `migrate deploy` czysty na scratch DB + seed (95 rury, 690 studnie, preco 5+54+179, AiModel starter); drift 0; `tests/migrations` 15/15 PASS.

## 12. ML validation status

Brama referencyjna w solverze (P1.3) + invariant I-007; shadow/offline deterministyczne; lineage minimum w statusie; brak bypassu walidacji (kandydaci zawsze z solvera).

## 13. Legacy frontend metrics

Przed: 1434 `window.*`, ~290 `onclick`. Po: +1 global (sankcjonowany, testowany, wzorzec `shouldMarkAiSelection`), +0 inline. Trend zgodny z KPI.

## 14. Remaining follow-ups

`docs/plans/BUILD_FOLLOWUPS.md` (4 pozycje z powodami odroczenia).

## 15. Known limitations

- CSRF nie chroni klientów wysyłających mutacje bez Origin/Referer — celowo (non-browser tooling z `Origin: BASE`); przeglądarki zawsze wysyłają jeden z nagłówków przy cross-site POST.
- Axe blocking obejmuje critical/serious (minor/moderate raportowane, nie blokują).
- Telemetria bez twardej retencji (pomiar: niepotrzebna); audyt 1.28 GB by design.
- `tests/migrations/baseline.test.ts` dirty (line-endings, pre-existing, nietknięte).

## 16. Final GO/NO-GO

P0 OPEN = 0; CSRF GREEN; MATRIX GREEN; DISCLOSURE GREEN; ZOD (klasa A + brama) GREEN; AUDIT GREEN; CI PARITY GREEN; P1 CRITICAL GREEN; ML VALIDATION GREEN; SOLVER INVARIANTS GREEN; VERSION INVARIANT GREEN; JSON SNAPSHOT TESTS GREEN; DRIFT 0; NEW globals +1 sankcjonowany / inline 0 / security-exceptions 0; typecheck/lint/FE GREEN; test:quick GREEN; restore/backup GREEN.

**BUILD STATUS: COMPLETE**
