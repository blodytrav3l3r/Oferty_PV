# Audyt v2 — plan BUILD P0–P3 (S.O.K. 1.31.0, 2026-09-27)

Status: BUILD MODE — GO. Kolejność: P0 → GO/NO-GO → P1 → P2 → P3.
Zasada: jeden problem = jeden commit. Minimal diff, zero regresji.

## 0. Stan faktyczny (zweryfikowany 5 agentami)

Wersja 1.31.0. Prisma 48 modeli (nie 38). `public/js` 245 plików (studnie 150, rury 31, shared 31, excel* 28). AGENTS.md 433 linie (nie 579). Migracje 16. Workflowi 5 (ci, codeql, load-nightly, p03-docker-data, release). `onclick` ~290 (235 JS + 55 HTML). `window.*` 1434 zapisy w 215 plikach.

Oceny agentów: security 6/10, ML/solver 6/10, backend 7/10, DB/CI 8/10. Całość: **8.35/10** (audyt v2 mówił 8.9 — zawyżone). Jakość planu: 9.5/10.

Sprostowania względem audytu v2: restore test istnieje (`tests/migrations/restoreRoundtrip.test.ts`, `tests/backupRetention.test.ts`), ML lineage istnieje (`AiModel/AiTrainingRun/AiEvaluation`, `ModelRegistry`), `x-auth-token` już usunięty (`src/middleware/auth.ts:145-146` tylko cookie), CI to dual-track (`db push` w jobach + `drift-check ci.yml:441-463` + `migrate-deploy-verify:465-498`), solver to system ~2.3k linii (`solverAutoSelect.js:1559` + `solverValidation.js:572`), nie sam `wellSolver.js:16`.

## 1. P0 MUST

### P0.1 CSRF Origin check (10/10)

Fakt: cookie `authToken` HttpOnly SameSite=Lax (`src/routes/auth.ts:53-58`), zero walidacji `Origin/Referer` w `src/`, `POST /logout:159` na cookie. CSP `unsafe-inline` w `src/app.ts:192-193` (nonce tylko Report-Only `src/middleware/security.ts:74-90`).

Kontrakt:

1. Origin istnieje → musi dokładnie odpowiadać trusted origin.
2. Origin brak + Referer istnieje → Referer z trusted origin.
3. Oba brak → 403 dla mutacji.
4. GET/HEAD/OPTIONS → middleware nie ingeruje.

Implementacja: nowy `src/middleware/csrf.ts` + wpięcie w `src/app.ts` przed routes. Bez Double-Submit, bez Redis, bez nowej tabeli.

Testy `tests/security/csrf.test.ts`: same-origin Origin → 2xx; wrong Origin → 403; brak Origin + valid Referer → 2xx; brak Origin + wrong Referer → 403; brak obu → 403; Origin + wrong Referer → 403; login/logout działają; GET/OPTIONS untouched.

### P0.2 Health/version sanitization (8/10)

Fakt: `/health:100-108` ujawnia memory/uptime/version, `/api/version:81-83` commit/branch/env (`src/version.ts:41-49`), `/health/ready:142` slice błędu DB.

Fix: public tylko `{ok:true}` / `{status:ready}`. Reszta za `requireAdmin` (np. `/api/admin/system-info`). Nigdy `err.message` z Prisma/SQLite na public.

Testy `tests/security/informationDisclosure.test.ts`.

### P0.3 Zod `.passthrough()` → `.strict()` (10/10)

Fakt: 14x `.passthrough()` (`src/validators/offerSchemas.ts:65,77,108,124,139,152`, `orderSchemas.ts:20`). Najpierw klasyfikacja A/B/C (A = legalne dodatkowe pola → świadomy passthrough; B = zbędne → strict; C = podejrzane → strict + test regresyjny), potem zmiana. Bez global replace.

### P0.4 Audit error visibility (8/10)

Fakt: `src/services/auditService.ts:83-86` swallow błędów, `:116-121` debounce nadpisuje historię.

Fix: audit failure nie blokuje operacji biznesowej, ale trafia do strukturalnego logu + metryki. Bez cichego gubienia.

### P0.5 CI migration parity (9/10)

Fakt: prod jedzie `migrate deploy`, `release.yml:42` testuje na `db push`.

Fix: JOB A `db push` (schema compat/legacy) + JOB B `migrate deploy` (prod path). Zostawić drift-check i migrate-deploy-verify.

### P0.6 Security regression matrix (9/10)

Jawny kontrakt pokrycia, nie tylko pliki. `tests/security/{csrf,auth,ownership,rateLimit,headers,validation,informationDisclosure}.test.ts`. Macierz: Offer create/update/delete, Pricing, Public health × Auth/Ownership/CSRF/Validation/Lock/RateLimit/Disclosure.

### DoD całego P0

P0 open = 0; CSRF GREEN; matrix GREEN; typecheck + typecheck:frontend GREEN; lint + lint:frontend GREEN; test:quick GREEN; version:check GREEN; migration drift 0; restore/migration tests GREEN; NEW GLOBALS = 0; NEW INLINE = 0; NEW SECURITY EXCEPTIONS = 0.

## 2. P1 HIGH

- P1.1 API contract tests supertest (10/10). Bez Pact. Macierz 201/400/401/403/409 + ownership + unexpected field 400.
- P1.2 `clientVersion=null` → gwarantowany bump N+1 (9/10). Luka w `src/utils/versionWrite.ts:39` (`ruryCrud.ts:360`, `studnieOrders.crud.ts:295`). Invariant: mutation_success ⇒ version_after > version_before.
- P1.3 ML validation przed zapisem (9/10, najważniejszy ML). `mlDualRanking.js` (Math.random epsilon-greedy:918,924) dziś tylko score'uje; walidacja w callerze za późno. Docelowo: candidate → domain validation (`recalculateWellErrors`) → valid? persist : reject. Invariant I-00x do SYSTEM_INVARIANTS.md.
- P1.4 fast-check invariants solvera (9/10). `fast-check` w deps, zero `fc.assert`. quantity>=0, height>=min, DN compat, required elements, solver(A)≠solver(B) przy istotnej różnicy.
- P1.5 JSON `schemaVersion` (9/10). ~20+ pól `String? // JSON` (`schema.prisma:46,49-53,81-83,674-684`, `offers_rel.data:302`). Helper `serializeSnapshot/deserializeSnapshot` → `{schemaVersion,data}`. Bez normalizacji całości.
- P1.6 Telemetry lifecycle (8/10). `ai_telemetry_logs` ~61 kolumn, `createdAt String?`. Najpierw pomiar rows/day + avg size, potem hot 90/180d → archive → agregaty daily/weekly. Retencja `runHousekeeping` dziś tylko `AiTrainingRun`.
- P1.7 Axe/E2E blocking selektywnie (7/10). Critical blocking, extended advisory/nightly. Dziś axe + e2e-extended `continue-on-error`.
- P1.8 `docs/SYSTEM_INVARIANTS.md` (9/10). I-001 cena oferty, I-002 konfiguracja valid, I-003 ownership, I-004 numeracja unique, I-005 migracje reproducible, I-006 backup restorable, I-007 ML nie omija validation, I-008 PDF = snapshot. Format: Invariant/Owner/Enforcement/Tests.

## 3. P2 STRUCTURAL

- Zero nowych `window.*` (dziś 1434), zero nowych `onclick` (dziś ~290), zero inline styles. KPI spadku per release (np. 1434 → 1380 → 1250), nie zero absolutne.
- ESM dla nowych modułów, legacy przez compat API. Excel = protected zone (one problem → one diff → E2E).
- AGENTS 433 → ~180-220 root (core + mapa + gates) + `docs/agents/{frontend,backend,database,security,testing,release}.md`.
- CSP fazowo: nowe `addEventListener`, stare zostają, enforce na końcu.
- Idempotency coverage audit (dziś tylko POST-create/claim `ruryCrud.ts:141`, `numbering.ts:169`; `src/utils/idempotency.ts:76`) — tylko create/numbering/side-effect, nie wszystko.
- WriteLock coverage audit (dziś in-memory 30s, tylko 4 trasy cenników `src/middleware/writeLock.ts:5`) — tylko read→calculate→write.
- `job_locks` SQLite (`jobName/owner/startedAt/expiresAt` + lease) tylko gdy multi-instance w planie. Dziś `running:Set` wystarcza.

## 4. P3 PRODUCT

- Operational dashboard dopiero na wiarygodnych metrykach: DB/WAL/backup, p50/p95/p99, lock wait/PDF/solver/ML, offers/conflicts, model/drift.
- UX studnie: Parametry → Auto → Weryfikacja → Cena → Oferta, reszta w Zaawansowane. Najpierw studnie, potem rury. Test na realnym użytkowniku.
- ML lineage UI: Model/Solver/Rules/Features/Dataset hash/Run/Confidence z istniejącego backendu. Rozdział `technical/commercial/user_preference`.

## 5. Czego nie robić

Redis, BullMQ/Kafka, Pact, OpenTelemetry, PostgreSQL, React, mikroserwisy, pełna normalizacja JSON, cleanup Excel, ręczne `?v=`/tagi.

## 6. Kolejność BUILD

P0.1 → test → commit; P0.2 → test → commit; P0.3; P0.4; P0.5 (CI); P0.6 (CI); GO/NO-GO; P1; P2; P3.

KPI bramkowe: NEW GLOBALS = 0, NEW INLINE = 0, NEW SECURITY EXCEPTIONS = 0, UNVALIDATED ML = 0, MIGRATION DRIFT = 0, UNTESTED CRITICAL = 0.
