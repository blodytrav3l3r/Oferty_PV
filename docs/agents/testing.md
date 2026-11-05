# S.O.K. — Agent: testy i walidacja

> Szczegółowy przewodnik domenowy. Root: `AGENTS.md` (mapa + bramy).

## Kierunek bazy i status migracji

PostgreSQL 18 jest jedynym docelowym backendem testowym i produkcyjnym. Provider Prisma, CI i Compose są przełączane na PostgreSQL, ale w kodzie runtime, aktywnych narzędziach i testach pozostają jeszcze nieprzepisane zależności SQLite; pełne uruchomienie aplikacji na PostgreSQL 18 nie zostało potwierdzone. Nie dodawaj obsługi SQLite. Jednorazowy read-only eksporter aktywnych cenników ze starej bazy może mieć test fixture; SQLite nie może być providerem testów aplikacji ani zależnością runtime. Przed uznaniem migracji za zakończoną wszystkie testy kontraktowe, integracyjne, migracyjne, security i E2E korzystające z DB muszą działać na izolowanym PostgreSQL 18.

## Poziomy i izolacja

- Jest: unit tests dla czystej logiki i mockowanych granic; integracja/route/SQL na jednorazowej bazie PostgreSQL. Każdy worker/run ma osobną bazę lub schemat i cleanup; zakaz współdzielenia bazy deweloperskiej/produkcyjnej.
- Testy migracji tworzą pusty PostgreSQL, wykonują `migrate deploy`, sprawdzają drift i idempotentny ponowny deploy. Żadna migracja SQL nie jest zweryfikowana przez sam mock ani przez dawną bazę SQLite.
- Playwright uruchamia własny serwer z `PLAYWRIGHT_DATABASE_URL` skierowanym na izolowany PostgreSQL. Nie używa defaultowego portu/dev-servera ani bazy produkcyjnej. Dane dostępu są przekazywane przez sekret/env; nie zapisuj ich w pliku testowym.
- W CI uruchamiaj PostgreSQL jako odizolowaną usługę testową z readiness probe i losowym targetem dla joba. Brak połączenia oznacza jawny fail, nie fallback do innego providera.

## Kontrakty jakości

- Inwarianty > snapshoty: własności domenowe (solver: `tests/studnie/solverInvariants.test.ts` — seedowany LCG, zero flaky; kontrakty `tests/frontend/solverContracts|solverAutoSelect|solverDrilledRings.test.ts` — prawdziwe pliki w vm), ML (`mlValidationGate.test.ts`), wersje (`versionInvariant.test.ts`) i API 200/400/401/403/409.
- Pokryj semantykę PostgreSQL: typy Decimal/timestamp/JSON, null ordering, collations, JSON queries, FTS parity, transakcje, CAS/concurrency, idempotency, unikalne numery, ownership i constraints.
- Eksport/import testuje zawartość i kształt pliku/API dla CSV/XLSX/PDF/DOCX, nie sam status HTTP. Przepływy ofert Rury/Studnie muszą obejmować zapis, wyszukiwanie, aktualizację, draft, zamówienie i eksport.
- Macierz security: `tests/security/{csrf,auth,ownership,rateLimit,headers,validation,informationDisclosure,audit}.test.ts` — sprawdzaj właściwość, nie tylko coverage.
- Coverage gate: `node scripts/coverage-check.mjs --fail` w CI (aktualne progi 65/64/61 — zmień wyłącznie z uzasadnieniem i zgodnie z regułami projektu).
- Zakaz obchodzenia: `.only`/`.skip`, `continue-on-error` dla krytycznych, osłabiania asercji lub wyłączania lint/typecheck. Jeśli dotychczasowy test koliduje z adapterem, przenieś właściwość do PostgreSQL integracji i zachowaj jej asercje.
- `jest` przypięty na `30.4.2` (exact): `jest@30.5.2` koliduje z `@types/jest@30.0.0` i sypie `TS2345 ... not assignable to type 'never'` w mockach. Bump dopiero razem z `@types/jest`.

## Bramy

- `npm run validate`: version:check, typecheck BE+FE, lint BE+FE, appname, licenses, test:quick, collisions, ratchet, prices:verify.
- Pre-push (`.husky/pre-push`, 4 grupy równoległe): `version:check` + `encoding:check` + `appname:check`; `lint` + `lint:frontend`; `typecheck` + `typecheck:frontend`; `jest` lite + `tests/pricelistChunk.test.ts --runInBand` + `test:git-safety`. W trakcie migracji bramy muszą zostać przepisane, nie pominięte.
- DoD paczki: P0 open = 0; CSRF/matrix GREEN; typecheck/lint GREEN; `test:quick` GREEN; `version:check` GREEN; migration drift 0; testy DB na PostgreSQL; NEW globals/inline/security-exceptions = 0.

## Playwright — baza i konto testowe

Aktywne scenariusze Playwright są przenoszone na własny serwer i izolowany schemat PostgreSQL przekazany przez `PLAYWRIGHT_DATABASE_URL`. Do zakończenia tej konwersji nie zakładaj, że wszystkie harnessy korzystają z PG ani że E2E zostały wykonane na serwerze PostgreSQL. Nie używaj `prisma db push`, ścieżek `file:`, plików SQLite ani produkcyjnych danych. Brak PostgreSQL oznacza test nieuruchomiony, a nie zaliczony.
