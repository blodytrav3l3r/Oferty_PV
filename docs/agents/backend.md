# S.O.K. — Agent: backend (TypeScript + Express + Prisma)

> Szczegółowy przewodnik domenowy. Root: `AGENTS.md` (mapa + bramy).

## Architektura

Warstwy: `routes` → `validators` → `services` → `Prisma` (+ `auth`, `ownership`, `rate limit`, `locks`, `audit`, `idempotency`, `Sentry`). Monolit celowy — bez mikroserwisów, GraphQL, event busa.

Decyzje (szczegóły w `docs/adr/`): ADR-001 SQLite produkcyjnie; ADR-002 Vanilla JS SPA; ADR-004 Express + Prisma; ADR-005 Express jedynym serwerem (Vite wycofany); ADR-006 HTTPS przez reverse proxy; ADR-007 ujednolicony cennik; ADR-008 modularyzacja frontendu; ADR-009 mapa produktów studni (`Map<string,Product>` + kontrakt `window.studnieProducts` + `__assertStudnieMapFresh`).

Inwarianty domenowe: `docs/SYSTEM_INVARIANTS.md` (I-001–I-012) — przeczytaj przed zmianą logiki biznesowej.

## Konwencje kodu

- Prettier: pojedyncze cudzysłowy, średniki, spacje (bez tabów). Po zmianach `npm run format`. Respektuj `.prettierrc`, nie nadpisuj ustawień.
- Typy jawne (bez `any` bez powodu; `unknown` + type guards dla danych z zewnątrz). Dane wejściowe waliduj przez `zod` v4 (fail fast).
- DRY (logika >2 razy → helper), SRP (pobieranie/walidacja/przetwarzanie/render osobno; biznes odseparowany od UI).
- Rozmiary (zalecenia): funkcje ~100–150 linii, klasy ~500–800, pliki ~1000–1500. Najpierw SRP, potem rozmiar; spójny kod > limity.
- Max 3 poziomy zagnieżdżenia (early return, guard clauses).
- Nazwy: funkcje czasownik+rzeczownik (`calculateTotalPrice`), zmienne rzeczownik (`productPrice`), boolean `is/has/can`, typy PascalCase, stałe UPPER_SNAKE.
- Immutability: nie mutuj wejść; przed `.sort()` zawsze kopia (`[...t].sort(...)`, błąd #15).
- Błędy jawnie na każdym poziomie; nigdy silent fail (użyj agenta silent-failure-hunter przy podejrzeniu). `PrismaClientKnownRequestError` obsługuj na granicy serwisu.
- Komentarze/identyfikatory: kod po angielsku; komentarze po polsku; bez łańcuchów myślowych w komentarzach.

## Bezpieczeństwo backend (skrót; pełnia w `security.md`)

- Brak sekretów w kodzie (`.env`); Zod na wejściu; Prisma (parametryzacja); rate limiting; komunikaty błędów bez wycieków (`/health` minimalne, diagnostyka tylko `/api/admin/system-info` dla admina).
- CSRF: mutacje wymagają same-origin (`src/middleware/csrf.ts`); cookie `HttpOnly + SameSite=Lax`.
- Ownership: `src/utils/ownership.ts` (fail-closed dla `null` u nie-admina); optimistic locking `src/utils/versionWrite.ts` (409); `writeLock` dla cenników; idempotency dla create/claim.

## Czego nie robić

- Bez React/PostgreSQL/mikroserwisów/Redis/BullMQ/Kafka/Pact/OpenTelemetry (decyzja architektoniczna, nie zaległość).
- Bez globalnego cleanup Excel; bez masowego przepisywania `window.*`/`onclick`.
- Bez zmiany kontraktów API, logiki cenowej i solvera bez testów inwariantów.
