# S.O.K. — Inwarianty systemowe (SSoT)

> Co absolutnie nie może się zepsuć. Każdy inwariant ma właściciela
> (Owner), egzekucję (Enforcement) i testy (Tests). Zmiana inwariantu
> wymaga jawnej decyzji — nie "przy okazji" innego commita.

## I-001 — Cena utrwalonej oferty nie zmienia się niejawnie

- **Invariant:** zapis (`POST`/`PUT`) zmienia cenę tylko z danych żądania;
  odczyt, rendering, eksport i cennik nie mutują ceny dokumentu.
- **Owner:** backend (routes/offers).
- **Enforcement:** cena liczona z `items`/`wells` payloadu; snapshot w `data`
    - historia (max 5); FTS poza transakcją (warn-only).
- **Tests:** `tests/offers*.test.ts`, `tests/offersContract.test.ts`.

## I-002 — Konfiguracja studni po zapisie przechodzi walidację domenową

- **Invariant:** `recalculateWellErrors()` na każdym renderze oferty
  (`refreshAllWellErrors`); wiersze ERROR/WARNING oznaczone
  (klasy + kolumna "Błąd", treść przez `escapeHtml`).
- **Owner:** frontend studnie (solverValidation.js).
- **Enforcement:** `refreshAllWellErrors()` w `wellUI.js`, ofercie i Excelu;
  właściwości: `tests/studnie/solverInvariants.test.ts`.
- **Tests:** `tests/studnie/solverInvariants.test.ts`,
  `tests/studnie/excelDrilledRings.test.ts`.

## I-003 — Użytkownik nie mutuje cudzych zasobów

- **Invariant:** zapis wymaga `canWriteDoc` względem właściciela;
  legacy rekord bez właściciela (`null`) = fail-closed dla nie-admina;
  zmiana opiekuna wymaga praw do starego I nowego (`resolveAssignUserId`).
- **Owner:** backend (`src/utils/ownership.ts`).
- **Enforcement:** guardy w `ruryCrud.ts`, `studnieCrud.ts`, `*Orders.crud.ts`;
  PZ-guard frontend (`pzGuard.js`).
- **Tests:** `tests/security/ownership.test.ts`, `tests/ownershipE2e.test.ts`,
  `tests/clientsIdor.test.ts`, `tests/offersContract.test.ts` (403).

## I-004 — Numer oferty/zamówienia jest unikalny

- **Invariant:** claim numeru atomowy (bez read-then-write); retry z tym samym
  `Idempotency-Key` trafia w ten sam rekord (deterministyczne id).
- **Owner:** backend (numbering, idempotency).
- **Enforcement:** `claimIdempotencyKey` + `IDEMPOTENCY_KEY_REUSE` (409),
  `src/middleware/writeLock.ts` dla cenników.
- **Tests:** `tests/numberingGuard.test.ts`, `tests/idempotency.test.ts`.

## I-005 — Baza produkcyjna odtwarzalna z migracji

- **Invariant:** `migrate deploy` na pustej bazie + seed daje schemat
  bez driftu; release CI testuje ścieżkę migracyjną (nie `db push`).
- **Owner:** backend/CI.
- **Enforcement:** `drift-check` + `migrate-deploy-verify` (blokują),
  `release.yml` na `migrate deploy`; `npm run measure:telemetry` (monitor).
- **Tests:** `tests/migrations/*`, `tests/backupRetention.test.ts`.

## I-006 — Backup nadaje się do odtworzenia

- **Invariant:** backup przez `VACUUM INTO` + sidecar sha256; restore weryfikuje
  nagłówek, `integrity_check` i czyści WAL/SHM.
- **Owner:** backend (scripts/backup.ts, restore-db.js).
- **Enforcement:** `scripts/audit-integrity.mjs` (gate JSON),
  `tests/migrations/restoreRoundtrip.test.ts`.
- **Tests:** `tests/migrations/restoreRoundtrip.test.ts`,
  `tests/backupRetention.test.ts`.

## I-007 — ML nigdy nie omija walidacji deterministycznej

- **Invariant:** ML output must never become persisted configuration before
  domain validation succeeds. Wybór rankingu MUSI być jednym ze zwalidowanych
  kandydatów solvera (referencja); obcy obiekt odrzucany, zostaje wariant
  techniczny. Eksploracja losuje wyłącznie z top-puli (shadow/determinizm
  przy ML offline).
- **Owner:** frontend studnie (solverAutoSelect.js) + ML governance.
- **Enforcement:** `window.isValidatedMlSolution(candidates, winner)`
  w sekcji AI DUAL-RANKING; `recordAiRankDecision` tylko telemetria.
- **Tests:** `tests/studnie/mlValidationGate.test.ts`,
  `tests/studnie/aiSelection.test.ts`.

## I-008 — Wygenerowany PDF odpowiada snapshotowi oferty

- **Invariant:** eksport czyta utrwalony dokument (nie stan edytora);
  szablony w `public/templates/*.html` z cache-bust `?v=` z release.
- **Owner:** backend (pdfEngine) + frontend (offerPrintManager).
- **Enforcement:** eksport z `data` dokumentu; `scripts/check-pdf.mjs`,
  `npm run deploy:check:pdf`.
- **Tests:** `tests/exportCombined.test.ts`, E2E smoke.

## I-009 — Udany zapis zawsze bumpuje wersję (optimistic locking)

- **Invariant:** mutation_success ⇒ version_after > version_before.
  Predykat wersji w zapisie; ślepy zapis (bez `version`) w pustkę to jawny
  409, nigdy cichy sukces; frontend przenosi `version` (round-trip).
- **Owner:** backend (`src/utils/versionWrite.ts`).
- **Enforcement:** `versionedWrite`/`blindWrite` + `mapVersionConflict` (409
  `VERSION_CONFLICT`); `assertDocLockForWrite` (423) nie zastępuje 409.
- **Tests:** `tests/versionInvariant.test.ts`, `tests/offersContract.test.ts`
  (409), `tests/studnie/offerVersionRoundtrip.test.ts`.

## I-010 — Mutacje wymagają same-origin (CSRF)

- **Invariant:** POST/PUT/PATCH/DELETE z obcym lub brakującym Origin/Referer
  → 403. GET/HEAD/OPTIONS nietknięte; `/api/csp-report` zwolniony (bez stanu).
  Klienci nie-przeglądarkowi (benchmark/load) wysyłają `Origin: BASE`.
- **Owner:** backend (`src/middleware/csrf.ts`).
- **Enforcement:** globalny middleware przed `mountRoutes`; cookie
  `HttpOnly + SameSite=Lax` jako druga warstwa.
- **Tests:** `tests/security/csrf.test.ts` (matryca 9 przypadków).

## I-011 — Publiczne endpointy nie ujawniają diagnostyki

- **Invariant:** `/health` → `{status, timestamp}`; `/api/version` → `{version}`;
  `/health/ready` nigdy klucza `error` (503 generyczne); szczegóły
  (commit/branch/env/memory) tylko `/api/admin/system-info` (admin).
- **Owner:** backend (`src/app.ts`).
- **Enforcement:** selektywne odpowiedzi + `requireAuth`/`requireAdmin`.
- **Tests:** `tests/security/informationDisclosure.test.ts`,
  `tests/security/headers.test.ts`.

## I-012 — Błąd audytu nie niszczy operacji ani nie znika

- **Invariant:** audit failure ≠ business failure (void, bez throw), ale każdy
  błąd to strukturalny log z kontekstem + `audit.failures` w `/metrics`.
  Debounce scala diffy (merge kluczy), nie nadpisuje historii.
- **Owner:** backend (`src/services/auditService.ts`).
- **Enforcement:** `recordAuditFailure()` + kontekstowy `logger.error`.
- **Tests:** `tests/security/audit.test.ts`.
