# Profesjonalizacja S.O.K. 1.33.0 — plan (audyt + etapy E0–E9)

> Stan: plan v2 (po recenzji 8.5/10), nie wykonano. Źródło prawdy: `main` — przed startem
> zweryfikować HEAD/status/diff (E0). Zero zgadywania.
> Zasady: zero regresji, małe paczki commitów, bramy AGENTS.md.
> Wizja 1.33.0: wersja ustanawiająca kontrakty `INPUT → VALIDATE → NORMALIZE → LOGIC → PERSIST → AUDIT → OUTPUT`.

## A. Fakty z audytu (potwierdzone w kodzie)

### P0 (ceny / dane)

- Rabat bez clamp: `mult = 1 - discountPct / 100` bez finite/clamp → >100% ujemna cena, NaN total.
  Dowód: `public/js/studnie/actionsWellPricing.js:122,257,530,640`; zapis `actionsWellDiscounts.js:25,51-52`
  (`parseFloat || 0`); BE studni passthrough bez max (rury mają `.max(100)`:
  `src/validators/offerSchemas.ts:62` vs `:89-154`).
- `POST /ai/predict/batch` przyjmuje NaN/±Inf: `z.array(z.number())` bez `.finite()`.
  Dowód: `src/routes/telemetryAiMl.ts:42-44,79-84`; score bez isFinite → truje ranking/cache.
- Solver entry bez isFinite na rzędnych: NaN przechodzi guard `< 500`.
  Dowód: `public/js/studnie/solverAutoSelect.js:89-100` (live `solverValidation.js:24,29` ma guardy, solver nie).

### P1 (integralność / UX)

- `document_shares` bez FK; delete usera czyści tylko sessions/prefs/users.
  Dowód: `prisma/schema.prisma:766-781`, `src/routes/users.ts:178-183` → sieroty, martwe EXISTS w `roleFilter.ts:69`.
- `offer_studnie_items_rel.offerId` bez FK + zero writerów w src; `PricelistItem*.versionId` bez FK (tylko kodowa tx `:1436`).
- `logAudit` poza tx + fire-and-forget bez await (`offers/crud.ts:173,251`, `production.ts:767,1066`)
  → phantom audit po rollbacku; `shares.ts:250-259` revoke nieatomowe.
- AVR `Date.now() - t0 > 100 return` nondeterministyczny pod load; explore `Math.random` bez śladu AI
  (`mlDualRanking.js:918,924` + `solverAutoSelect.js:1445-1447`); goldeny odpinają AI, więc tego nie łapią.
- Destrukcja bez confirm: `removeWellComponent / clearWellConfig / qty <= 0` bez `appConfirm`
  (`actionsCrud.js:244,335,361-384`); brak double-submit guarda w `wellNotesModal.js:130-156`
  (wzorzec `isSavingOffer` istnieje obok).

### P2 (typowanie / konfig)

- `as any` w src 8× maskujące brak modelu
  (`ownership.ts:141,155`, `crud.ts:201,277`, `studnieCrud.ts:1205`, `rury/studnieOrders.crud.ts`, `production.ts:257`).
- ID `Date.now() + Math.random` 3× (`auditService.ts:50-52`, `clients.ts:102-103`, `studnieCrud.ts:951`) vs `randomUUID` gdzie indziej.
- `offer_number` tylko index (brak unique); `UNIQUE(userId, productionNumber)` przepuszcza NULL (SQLite);
  daty/właściciele jako nullable String bez FK.
- CI: twarde gaty (`drift-check`, `migrate-deploy-verify`, `version-check`, `load-quick`) tylko
  `if: push → main`, nie na PR (`.github/workflows/ci.yml:160,309,426,444,470,505`);
  `validate` bez `version:check`; coverage tylko `src/**/*.ts`, `public/js` niemierzalne (guard behawioralny);
  CSP Report-Only + `unsafe-inline` w Helmet (`security.ts:74-90`, `app.ts:217-218`) — celowy legacy
  (~290 onclick), nie ruszać bez codemodu.

## B. Etapy (małe commity, E0–E9)

- E0 — resume / baseline verification (read-only, bez zmian zachowania): HEAD, `git status/diff`,
  AGENTS.md, CI, lista migracji Prisma, fingerprint datasetu. Checkpoint przed E1.
- E1 — regression baseline: `validate`, `typecheck`, `lint`, `test:quick`, `prisma validate`,
  ceny, goldeny solvera + nowy golden wykrywający niedeterminizm między uruchomieniami
  (nie tylko „ten sam wynik raz”). E1 nie modyfikuje zachowania prod.
- E2 — P0 pricing + numeric safety. Kanon: `discountPct ∈ [0, 100]`.
  Wejście użytkownika: reject (422 / błąd formularza), nie cichy clamp `min/max`.
  Kalkulator defensywny: dodatkowy guard. Persistencja: nigdy spoza kontraktu.
  Test matrix: `0, 50, 100, 100.000001, -0.000001, NaN, ±Inf, null, undefined, "50", "NaN", "Infinity"`,
  osobno brak rabatu / 0 / 100 (0 ≠ brak wartości).
  AI pipeline: `request → Zod.finite → normalizacja → model → score → ranking → cache → response`,
  NaN/Inf nie wchodzi ani nie wychodzi; test: invalid → 422 + brak zapisu cache + brak zmiany rankingu.
- E3 — P1 DB integrity (decyzje przed migracjami): najpierw semantyka lifecycle
  `User → DocumentShare` (usuń / anonimizuj / blokuj?) i `PricelistItem.versionId` — bez z góry założonego CASCADE.
  `offer_studnie_items_rel`: checkpoint A–E (martwa / legacy / SQL poza src / migracje / przyszłość),
  potem FK / cleanup / zostaw. `logAudit`: inventory wszystkich wywołań, podział
  biznesowy (atomowy z tx) / techniczny / security trail — nie przenosić mechanicznie.
- E4 — P1 determinizm + UX safety: AVR stała liczba iteracji zamiast wall-clock (seedowany RNG
  tylko gdy losowanie konieczne, seed w logu); confirm destrukcji + double-submit guard.
- E5 — API / walidacja / identyfikatory: `PUT /pricelist-versions/:id` Zod jak clone-draft
  (celowo: `pricelist-versions`), allowlista `GET /audit/:entityType`, UUID w 3 miejscach,
  `offer_number` UNIQUE warunkowo: najpierw `GROUP BY … HAVING COUNT > 1` + NULL/puste/whitespace/case/formaty,
  bez auto-naprawy duplikatów w migracji.
- E5.5 — Security & contract gate (bez nowych funkcji): auth/authz zmienianych endpointów, IDOR `:id`,
  ownership, response leakage, audit permissions, rate-limit + cache-poisoning `POST /ai/predict/batch`
  (testy kontraktowe i autoryzacyjne, nie tylko matematyka), brak 500 na danych granicznych,
  headers bez zmiany CSP, brak wycieku przez nowe FK/migracje.
- E6 — CI hardening: minimalny PR gate (`validate`, `typecheck`, `lint`, `test:quick`, `prisma validate`,
  `prices:verify`), np. commit `ci: enforce validation on pull requests`; ciężkie
  (`drift-check`, `migrate-deploy-verify`, `load-quick`) po analizie czasu.
- E7 — typing celowany: usuń tylko `as any` maskujące błąd modelu (granice bibliotek/legacy zostają).
- E8 — UX consistency (poza 1.33.0 albo tylko dotknięte ekrany): toast, modal lifecycle
  (`closeModal` usuwa vs chowa — skutki w stanie UI), inline style, required, empty/error, dark/light, a11y.
- E9 — weryfikacja końcowa: pełne `validate`, migracje, porównanie goldenów, `git diff`, production readiness.

## B2. Invarianty before/after (kontrakt per fix P0/P1)

- Ceny: `0 ≤ discountPct ≤ 100`; persist odrzuca spoza.
- AI: wszystkie wejścia i score finite; invalid → 422, zero cache/rankingu.
- Solver: nieprawidłowa rzędna → reject, brak NaN w dół pipeline.
- Audit: sukces mutacji ↔ audit biznesowy; rollback → brak commitowanego audytu biznesowego.
- Delete user: zero osieroconych rekordów zależnych wg ustalonej semantyki.
- ID: format UUID + unikalność.

## B3. Targetowane testy FE (krytyczne biznesowo, nie pełny coverage)

discount, solver input, destructive actions, double submit, AVR determinizm — behawioralne vm/jsdom
na `public/js`, bez migracji frameworka ani pełnego instrumentowania coverage.

## C. Bramy per paczka

`version:check` → `validate` (typecheck BE+FE, lint BE+FE, test:quick, prices:verify) → `format` →
commit `node scripts/commit.mjs "typ(scope): opis"` (małe paczki, polskie znaki). Zero destrukcyjnego gita.
Znany problem: hook pre-commit pada na `eslint --fix` (brak pluginu `@typescript-eslint` w lint-staged) —
obejście tylko `git -c core.hooksPath=/dev/null commit`, nie pomijać `validate`.

## D. Czego nie ruszam bez GO

CSP enforce (łamie ~290 onclick), normalizacja JSON-snapshotów, Redis/distributed limiter,
zmiana semantyki solvera/ML, `offer_number` unique jeśli prod ma duble, `CHECK(json_valid)`.

Produkcja: backup przed migracjami, `migrate deploy` (nie `db push`), I-001/I-003/I-004 nienaruszone.
