# S.O.K. — Agent: testy i walidacja

> Szczegółowy przewodnik domenowy. Root: `AGENTS.md` (mapa + bramy).

## Poziomy

- Jest (unit + supertest kontraktów), Playwright (E2E przez `node tests/playwright/*.cjs`, backend na localhost:3000), Axe (critical/serious blocking w CI; extended E2E advisory).
- Wzorce: testy routerów na izolowanych aplikacjach express z mockami prismy (jak `tests/offersContract.test.ts`); testy plików przeglądarkowych w vm z prawdziwego pliku (jak `tests/studnie/aiSelection.test.ts`); guard `typeof x === 'undefined' || !x` gdy vm nie ładuje modułu stanu.
- Inwarianty > snapshoty: właściwości domenowe (solver: `tests/studnie/solverInvariants.test.ts` — seedowany LCG, zero flaky), brama ML (`mlValidationGate.test.ts`), wersje (`versionInvariant.test.ts`), kontrakty API 200/400/401/403/409.
- Macierz security: `tests/security/{csrf,auth,ownership,rateLimit,headers,validation,informationDisclosure,audit}.test.ts` — każdy plik to realna właściwość, nie statystyka.
- Zakaz obchodzenia: `.only`/`.skip`, `continue-on-error` dla krytycznych, osłabianie asercji, wyłączanie lint/typecheck.

## Bramy

- `npm run validate`: typecheck BE+FE, lint BE+FE, appname, licenses, test:quick, collisions, prices:verify.
- Pre-push: `version:check` + `encoding:check` + typechecki + `test:quick`.
- DoD paczki: P0 open = 0; CSRF/matrix GREEN; typecheck/lint GREEN; `test:quick` GREEN; `version:check` GREEN; migration drift 0; NEW globals/inline/security-exceptions = 0.
