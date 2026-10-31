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
- **Dopiska (kontrakt L0/L2, baza #58):** L0 odświeża wiersz sync (auto-komórki, kręgi, relief, status) bez czekania; L2 (`_excelDebouncedRefresh` 800 ms / maxWait 1200 ms) liczy TYLKO kolejkę błędów + kolory — panele pomija, bo L1 już je policzył. Paste finalizuje błędy PRZED re-renderem (`_excelFinalizePasteAffected` → `recalculateWellErrors` → `_excelRenderTable`), więc tabela nigdy nie czyta starego `configStatus`.

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

- **Invariant:** POST/PUT/PATCH/DELETE z obcym Origin/Referer → 403;
  mutacja z cookie, ale bez obu nagłówków → 403 (anomalia). Brak obu
  nagłówków BEZ ciasteczek → dozwolone (klient nie-przeglądarkowy bez sesji:
  login, skrypty, E2E; brak ambient authority = brak CSRF). GET/HEAD/OPTIONS
  nietknięte; `/api/csp-report` zwolniony (bez stanu).
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

## I-013 — Draft nie może być nadpisany po cichu

- **Invariant:** zapis, autosave, synchronizacja ani odzyskiwanie draftu nie mogą
  bez jawnej decyzji użytkownika doprowadzić do cichej utraty lub zastąpienia
  nowszej wersji dokumentu. Konflikt wersji wykryty i jawnie obsłużony; nieudany
  zapis nie jest przedstawiany jako udany; lokalna kopia draftu zostaje
  zabezpieczona do rozstrzygnięcia konfliktu; automatyczne ponowienie zapisu nie
  omija kontroli wersji (żadnego przyjęcia nowszej rewizji bez weryfikacji);
  odtwarzanie draftu nie nadpisuje automatycznie aktualnego dokumentu.
- **Owner:** frontend (`public/js/shared/draftStore.js`,
  `public/js/shared/draftAutosave.js`, `public/js/shared/draftSync.js`) +
  backend (`src/services/drafts/draftService.ts`, `src/routes/drafts.ts`).
- **Enforcement:** CAS `If-Match` + `updateMany` z predykatem wersji (count 0 →
  409 `DRAFT_CONFLICT`; brak nagłówka → 428 `DRAFT_PRECONDITION_REQUIRED`);
  `_draftSaveState` (błąd/`blocked-storage` nigdy jako `ok`); modal 3 wyborów przy
  konflikcie + kopia `docId-konflikt-<ts>`; flush `keepalive` jawnie pomija
  payload > 64 KB (`skipped_keepalive`); odzysk serwerowy tylko po decyzji
  użytkownika.
- **Tests:** `tests/drafts/casConcurrency.test.ts`,
  `tests/drafts/draftsRoutes.test.ts`, `tests/frontend/draftSaveState.test.ts`,
  `tests/frontend/draftSync.test.ts`, `tests/frontend/draftSyncWiring.test.ts`.

## I-014 — Cena oferty pochodzi wyłącznie z wersji cennika

- **Invariant:** oferta jest wyceniana i zapisywana wyłącznie z wersji cennika
  (ACTIVE). Brak wersji to brak zapisu, nigdy cichy spadek do tabel LIVE ani
  pieczątka `null`. Tabele LIVE nie istnieją (etap 2: usunięte); błąd odczytu
  cennika nie jest maskowany jako brak wersji. Wyjątek: istniejąca oferta
  zachowuje własną pieczątkę i snapshot cen, więc jej edycja nie wymaga nowej
  ACTIVE.
- **Owner:** backend (`src/services/pricelist/usage.ts`,
  `src/routes/productsV2.ts`, `src/routes/productsStudnieV2.ts`,
  `src/routes/precoPricingV2.ts`, `src/routes/offers/ruryCrud.ts`,
  `src/routes/offers/studnieCrud.ts`).
- **Enforcement:** `?source=active` bez ACTIVE → `409 NO_ACTIVE_VERSION`;
  nowa oferta bez ACTIVE → `409 NO_ACTIVE_VERSION`; błąd odczytu →
  `503 PRICELIST_UNAVAILABLE`; zapis cennika tylko przez lifecycle wersji
  (szkic/wersja); `?source=live` → `422 INVALID_SOURCE`.
- **Tests:** `tests/pricelistActiveSource.test.ts`,
  `tests/offersPricelistStamp.test.ts`, `tests/productsV2.test.ts`,
  `tests/frontend/pricelistActiveSource.test.ts`.
