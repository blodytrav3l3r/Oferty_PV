# Plan usprawnień po audycie 8,5/10 — P1/P2/P3 (TYLKO PLAN, bez implementacji)

**Data:** 2026-09-29
**HEAD zweryfikowany:** `dce990c` (`style(studnie): format offerdiscountspopup pod ci`), worktree clean, `VERSION` = `package.json` = `1.33.0`
**Status:** PLAN — nie wykonywać kodu bez Batch GO na paczkę; push/restart/migracje tylko za osobnym GO (kontrakt autonomii).
**Zakres audytu:** read-only `origin/main`, hipotezy audytora zweryfikowane niżej (FACT vs HYPOTHESIS).

## Evidence ledger (zweryfikowane 2026-09-29)

| ID    | Twierdzenie audytu                                                                                           | Dowód                                                                                                   | Status                                                 |
| ----- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| E-001 | HEAD = dce990c, historia = małe checkpointy                                                                  | `git log --oneline -5`, `git status --short` clean                                                      | VERIFIED                                               |
| E-002 | CSP = Report-Only + `unsafe-inline` (script-src-attr, style-src), nonce infra istnieje                       | `src/middleware/security.ts:65-91`                                                                      | VERIFIED                                               |
| E-003 | Istnieje etapowy plan CSP (CSP-A DONE)                                                                       | `docs/plans/csp-hardening.md:1-40` (17 inline script, 40 onclick, 25 style=)                            | VERIFIED                                               |
| E-004 | Rate limiter = `Map` in-memory, single-instance                                                              | `src/middleware/rateLimiter.ts:29`, `src/middleware/rateLimiters.ts`                                    | VERIFIED                                               |
| E-005 | Audit warn-only = celowy inwariant I-012, nie bug                                                            | `src/services/auditService.ts:101`, `docs/SYSTEM_INVARIANTS.md:121-128`, `tests/security/audit.test.ts` | VERIFIED                                               |
| E-006 | Frontend ~221 plików / ~1434 window wg docs; dziś 248 plików JS, 3129 trafień `window.`, 40 `onclick` w HTML | `Get-ChildItem public/js`, `Select-String window\.`, `onclick`                                          | VERIFIED (liczby dryfują — SSoT do policzenia w P1-5A) |
| E-007 | Migracje: 18 katalogów w `prisma/migrations`; README mówi o 3 (?)                                            | `ls prisma/migrations` = 18; dokładny fragment README do potwierdzenia w P1-5B                          | HYPOTHESIS                                             |
| E-008 | CI ostatnio SUCCESS (lint/typecheck/jest/docker/E2E/a11y/migracje/load/flaky)                                | twierdzenie audytu z GitHub Actions, lokalnie niezweryfikowane                                          | UNVERIFIED                                             |

## Zasady twarde (nie do ruszenia w tym planie bez jawnej decyzji)

- Inwarianty `docs/SYSTEM_INVARIANTS.md` (I-001–I-012) obowiązują; zmiana I-012 (audit guarantee) tylko za jawną decyzją compliance.
- `solver = authoritative, AI = recommendation` — AI nie staje się source of truth dla decyzji konstrukcyjnych.
- Zakazane kierunki: React/Vue/Angular, PostgreSQL, mikroserwisy, Redis „na zapas", pełna normalizacja JSON, masowy rewrite legacy.
- Legacy surface: NEW `window.*` / inline `onclick` / inline `<script>` = 0 (test `cspInventory`).
- Bramy przed każdym commitem: `npm run version:check` → `npm run validate` → `npm run format` → commit tylko przez `node scripts/commit.mjs "typ(scope): opis"`.
- Plany w `docs/plans/`; zakończone `git mv` do `docs/plans/archive/`.

## P1 — batch 1: CSP enforce (najwyższy priorytet, kontynuacja istniejącego planu)

Nie tworzyć nowego planu CSP — kontynuować `docs/plans/csp-hardening.md`:

- **CSP-B:** `onclick` → `addEventListener` moduł po module (najpierw `zlecenia`/`kartoteka`, po 10), inline boot → ESM z nonce. Każdy moduł = test regresji + `node -c`.
- **CSP-C:** nonce na wszystkich first-party scripts; `xlsxLoader.js` (dynamiczny `createElement('script')`, CDN) → bundling lokalny albo hash; `eval`/`new Function` (11 trafień w 7 plikach wg `csp-hardening.md`) → NAJPIERW klasyfikacja 1:1, dopiero potem rozwiązanie:
    | Klasa                                                                  | Działanie                                            |
    | ---------------------------------------------------------------------- | ---------------------------------------------------- |
    | rzeczywisty dynamiczny JS                                              | usunąć / przebudować                                 |
    | parser danych                                                          | zastąpić parserem (JSON/itp.), nie evaluatorem       |
    | kalkulacja / formuła                                                   | ograniczony evaluator (tylko tu rozważyć `safeEval`) |
    | legacy kompatybilność                                                  | izolować + test                                      |
    | test/dev tooling                                                       | wyłączyć z production path                           |
    | Zakaz: wspólne `safeEval` jako automatyczna łata konserwująca problem. |
- **CSP-D (gate):** `0 niezamierzonych violations` dla obsługiwanych ścieżek smoke + extended E2E, z jawnie zatwierdzonym allowlistem wyjątków przejściowych (nie bezwarunkowe „0”). Zakres gate: Chromium + drugi silnik jeśli wspierany; smoke + extended; inventory wszystkich źródeł skryptów; test bez `unsafe-inline`; test `script-src-attr` bez wyjątków; test dynamicznego `xlsxLoader`; test produkcyjnego nagłówka HTTP (nie tylko konfiguracji middleware).
- **CSP-E:** dopiero po CSP-D: usunięcie `unsafe-inline` z enforce, 1 commit, rollback = revert.
- **Dowód zakończenia:** nagłówek enforce w prod, 0 niezamierzonych violations (allowlist wyjątków jawnie zatwierdzony), `version:check` + `validate` zielone.

## P1 — batch 2: security mutation + ownership matrix (read-only najpierw)

- Krok 1 (read-only): wygenerować macierz `endpoint × {anonymous, userA, userB, admin} × {read, create, update, delete, export, share, lock, pricing, ML, telemetry}` z `src/routes/` + `src/middleware/` (bez zmian kodu). Dla każdej komórki sprawdzać: `success / 401 / 403 / 404 / validation error / rate limit` oraz czy odpowiedź nie ujawnia: istnienia obcego `id`, ownership, nazwy zasobu, statusu obiektu, danych z nested relation (baza: `tests/security/informationDisclosure.test.ts`; reguła 404-vs-403 jawnie w macierzy).
- Krok 2: fuzz/mutacja ownership — obejścia przez `id`/`UUID`/nested relation/query param/body/alternate route (audyt P2-04). Najpierw testy FAIL na obecnych lukach (RED), potem minimalny fix (GREEN).
- Wejście: `tests/security/{csrf,auth,ownership,rateLimit,headers,validation,informationDisclosure}.test.ts` już istnieją — rozszerzyć, nie duplikować.
- **Dowód:** nowa macierz w `docs/plans/` + testy regresji P0/P1 + brak regresji `test:quick`.

## P1 — batch 3: kontrakt API OpenAPI ↔ implementacja

- Krok 1: zinwentaryzować rozjazd `docs/API.md` + `/api/docs.json` ↔ `src/routes/` + walidatory Zod (error contract, finite guards, 404).
- Krok 2: dodać automatyczną weryfikację kontraktu w CI (schemat odpowiedzi, kody błędów); Swagger istnieje — brakuje egzekucji.
- Hierarchia źródła prawdy (ustalić raz przed egzekucją CI, inaczej CI zakonserwuje drift): `business invariant → implementation + Zod → contract tests → OpenAPI/docs` (albo świadome `schema-first`, ale jedna wybrana i zapisana).
- **Dowód:** CI fail przy rozjeździe kontraktu; `docs/API.md` przykłady `"version"`/`"dbVersion"` zgodne z `VERSION` (via `version:check`).

## P1 — batch 4: audit guarantee matrix (decyzja, nie kod)

- Dla każdej operacji określić: `audit required? / transactional? / failure blocks?` — dziś I-012 mówi: failure ≠ business failure + `audit.failures` w `/metrics` + strukturalny log.
- Jeśli audyt ma pozostać `best effort` → tylko dopisać macierz do docs, bez zmian kodu.
- Jeśli ma być `guaranteed` dla operacji compliance (np. pricing, zamówienia) → osobna decyzja + zmiana inwariantu I-012 + testy atomowości (`tests/security/auditAtomicity.test.ts` jako baza).
- **Zakaz:** cichej zmiany I-012 przy okazji innego batcha.

## P1 — batch 5A: mapa coupling frontendu (read-only, przed CSP-B)

- Mapa `global → moduł → konsument → event` dla `public/js` (dziś 248 plików / 3129 `window.` / 40 `onclick` — policzyć SSoT jednym skryptem, nie ręcznie).
- Wskazać 20% globali za 80% coupling; zero refaktoru w tym batchu — tylko mapa + kolejka CSP-B.
- **Dowód:** `docs/plans/frontend-dependency-map.md` + skrypt liczenia SSoT.

## P1 — batch 5B: docs-drift (niezależnie, nie blokuje CSP)

- Zweryfikować E-007 (liczba migracji w README vs `prisma/migrations` = 18) + listę migracji w ARCHITECTURE; propozycja generowania tych fragmentów (skrypt, nie ręczne liczenie).
- **Dowód:** skrypt SSoT + poprawione fragmenty docs.

## P2 (po P1): observability celowana, nie „pełne tracing”

- Structured logging: `requestId, userId, route, duration, status, errorCode` (małymi krokami, bez OpenTelemetry). `requestId`/correlation propagowany do logów audytu i kluczowych błędów biznesowych, żeby prześledzić `request → business op → DB tx → audit → solver → error` bez distributed tracing.
- Business metrics: `offer_created/exported, price_changed, solver_failed/timeout, ml_prediction/accept/reject` (rozszerzyć `src/utils/metrics.ts` + `opsDashboard`).
- SQLite observability: `busy`, lock wait, transaction duration, write latency.
- Rate limiter: NIE wprowadzać Redisa; dodać dokumentację limitu single-instance + test multi-process jako znane ograniczenie (HA dopiero z decyzją o Postgres).

## P3 (przyszłość, warunkowe)

- Stopniowa eliminacja `window.*` w rytmie CSP-B (moduł po module, z mapą z P1-5A).
- Feature boundaries frontendu (event-driven, bez zmiany frameworka).
- PostgreSQL TYLKO gdy realna potrzeba: multi-instance / concurrency / centralny rate limit — nie „dla profesjonalizmu".
- Simplification audit toolingu (audyt P maintainability 7,9): inwentaryzacja skryptów vs wartość, bez masowego usuwania w tym planie.

## Kolejność egzekucji (proponowana)

1. P1-batch 5A (mapa) — read-only, odblokowuje CSP-B. Równolegle niezależnie: P1-batch 5B (docs-drift, nie blokuje CSP).
2. P1-batch 1 (CSP B→E) — największy skok 8,5 → 9.
3. P1-batch 2 (ownership matrix) + P1-batch 3 (kontrakt API) — równolegle testowo, fixy osobno.
4. P1-batch 4 (audit matrix) — decyzja compliance przed kodem.
5. P2 observability — po domknięciu P1.
6. P3 — tylko za osobnym GO.

## Execution gate (każdy Batch GO, bez wyjątków)

```text
PRECHECK → READ-ONLY INVENTORY → MINIMAL CHANGE → TARGETED TESTS
→ FULL REGRESSION → DIFF REVIEW → VERSION/CHECK GATES → CHECKPOINT COMMIT → STOP
```

Raport po batchu:

```text
BATCH: P1.x / STATUS: SUCCESS / BLOCKED
FACTS: / CHANGED: / TESTS: / CI: / DIFF: / COMMIT: / RISKS: / NEXT:
```

## GO / stop

- GO na ten PLAN = ta wiadomość użytkownika (plan zapisany, nic nie wykonane).
- GO na kod = jeden Batch GO na paczkę (P1-1, P1-2, …) — brak GO na kod w tym pliku.
- Osobne GO wymagane na: push, restart/migracje/seed, prod DB, destrukcyjny git.
- STOP przerywa paczkę natychmiast.
