# Raport audytu projektu — S.O.K. — System Ofert i Kalkulacji

> **Stan na 2026-08-24:** po audycie 2026-07-09 wdrożono kolejne fale napraw —
> dedup telemetrii AUTO_JS + indeksy (migracja `20260805100000_telemetry_well_dedup`),
> TrainingPipeline sliding window, auto-heal indeksów i FTS5, a następnie pełny plan
> naprawy z audytu v1.15.1 (A-01…A-60, fazy 1–10, `docs/plans/archive/2026-08-16-plan-naprawy-audyt.md`):
> domknięcie IDOR w ofertach/zamówieniach, ujednolicony centralny escape XSS, writeLock
> z ownership + atomowy claim numeru rur, dedup rewardów przed unique index, walidacja
> restore-db.js (nagłówek + integrity_check + WAL cleanup) oraz usunięcie silent fail
> w telemetrii/ML. Od `1.16.0` do `1.19.4`: retencja modeli ML, auto-dobór zaznaczonych studni w Excel,
> bundling JS (esbuild), migracja Excel modal przez `modalCore`, poprawki a11y/kolumny Excel,
> kompensacja dual-write `saveDefaults()` (#45) oraz pełna aktualizacja dokumentacji.
> Poniższy raport pozostaje historycznym zapisem stanu z daty audytu,
> zaktualizowanym o realne liczby na dzień 2026-08-24.

**Wersja projektu:** 1.19.4  
**Data audytu:** 2026-07-09 (aktualizacja dokumentacji)  
**Audytor:** Hermes Agent / Nous Research

---

## 1. Struktura katalogów

| Element                            | Status | Uwagi                                                                                                |
| ---------------------------------- | ------ | ---------------------------------------------------------------------------------------------------- |
| `src/` — kod backendu (TypeScript) | ✔      | 128 plików .ts, dobrze zorganizowane (routes/, middleware/, services/, utils/, validators/, types/)  |
| `src/routes/` — endpointy API      | ✔      | 30 plików (offers/_, orders/_, productsV2, telemetryAi*), logicznie podzielone                       |
| `src/middleware/` — middleware     | ✔      | Auth, security, rateLimiter/rateLimiters, writeLock, errorHandler — wydzielone osobno                |
| `src/services/` — logika biznesowa | ✔      | Audit, cenniki, PDF/DOCX, combinedExport, seedExporter, telemetry/learning, ml/*                     |
| `src/utils/` — narzędzia           | ✔      | Logger, ownership, productionOrderGuard, fts5Sync, searchUtils                                       |
| `src/validators/` — walidacja Zod  | ✔      | Schematy auth, ofert, zamówień, produktów, telemetrii                                                |
| `public/` — frontend (SPA)         | ✔      | Vanilla JS, 6 plików HTML (app/index/rury/studnie/kartoteka/zlecenia), 11 arkuszy CSS, 221 plików JS |
| `tests/` — testy                   | ✔      | ~125 plików testowych, Jest 30 + Playwright (smoke/alignment/appName/a11y)                           |
| `prisma/` — schema + migracje      | ✔      | Schema 651 linii, 38 modeli, 3 migracje (baseline + uq_reward + ai_training_run)                     |
| `data/` — baza SQLite + seed       | ✔      | app_database.sqlite + price_defaults.json + seed_*.json                                              |
| `scripts/` — skrypty narzędziowe   | ✔      | 43 pliki: backup/restore, version guards, bundling, licencje, deploy/rollback                        |
| `docs/` — dokumentacja             | ✔      | README, ARCHITECTURE, DATABASE, API, SECURITY, COMPONENTS, UI_GUIDELINES, adr/                       |
| `coverage/` — raport pokrycia      | ✔      | Generowany przez Jest (`--coverage`)                                                                 |
| `.github/workflows/` — CI/CD       | ✔      | CI, CodeQL, release.yml, Dependabot                                                                  |

## 2. Architektura

| Element                          | Status | Uwagi                                     |
| -------------------------------- | ------ | ----------------------------------------- |
| Backend: Express.js (TypeScript) | ✔      | Dobrze skonfigurowany, typowany           |
| ORM: Prisma 6.0                  | ✔      | SQLite, generowany klient                 |
| Frontend: Vanilla JS SPA         | ✔      | Bez frameworka — lekkie, szybkie          |
| Serwer: Express (dev i prod)     | ✔      | Frontend serwowany statycznie z `public/` |
| Baza danych: SQLite              | ✔      | Lokalna, WAL-safe backup                  |
| Swagger API docs                 | ✔      | `/api/docs`                               |
| Sentry monitoring                | ✔      | Opcjonalny, aktywny po ustawieniu DSN     |

## 3. API

| Element             | Status | Uwagi                                           |
| ------------------- | ------ | ----------------------------------------------- |
| RESTful API         | ✔      | Spójne nazewnictwo endpointów                   |
| Endpointy auth      | ✔      | Login, register, logout, me, change-password    |
| Endpointy produktów | ✔      | Rury (productsV2) i studnie (productsStudnieV2) |
| Endpointy ofert     | ✔      | Offers-rury, offers-studnie (alias)             |
| Endpointy zamówień  | ✔      | Orders-rury, orders-studnie                     |
| Endpointy klientów  | ✔      | CRUD dla clients_rel                            |
| Endpointy wersji    | ✔      | `/api/version` w server.ts                      |
| Health check        | ✔      | `/health`                                       |
| Rate limiting       | ✔      | API Limiter + login limiter                     |
| Swagger UI          | ✔      | `/api/docs` z OpenAPI 3.0                       |

## 4. Baza danych (SQLite / Prisma)

| Element             | Status | Uwagi                                                                          |
| ------------------- | ------ | ------------------------------------------------------------------------------ |
| Schema Prisma       | ✔      | 38 modeli, indeksy (idx_logs_well/source_well, uq_reward_well_action), relacje |
| Migracje            | ✔      | 3 migracje: baseline + uq_reward + ai_training_run (`prisma/migrations/`)      |
| Seed danych         | ✔      | prisma/seed.ts + data/seed_*.json (rury, studnie, preco) + startowy AiModel    |
| Backup              | ✔      | scripts/backup.ts — VACUUM INTO, max 30 kopii                                  |
| Restore             | ✔      | scripts/restore-db.js — nagłówek + integrity_check + WAL cleanup (v1.15.1)     |
| WAL-safe backup     | ✔      | Używa VACUUM INTO dla spójnych snapshotów                                      |
| PRAGMA user_version | ✔      | Używane — restore-db.js + auto-heal indeksów/FTS5 przy starcie (src/app.ts)    |

## 5. CI/CD

| Element            | Status | Uwagi                                            |
| ------------------ | ------ | ------------------------------------------------ |
| GitHub Actions CI  | ✔      | commitlint, lint, typecheck, test, build, deploy |
| CodeQL             | ✔      | Analiza bezpieczeństwa co poniedziałek           |
| Dependabot         | ✔      | Aktualizacje zależności                          |
| Husky + commitlint | ✔      | Pre-commit hooks, conventional commits           |
| lint-staged        | ✔      | ESLint + Prettier na staged plikach              |
| Docker             | ✔      | Dockerfile + docker-compose.yml                  |
| Health check       | ✔      | Docker HEALTHCHECK                               |

## 6. Testy

| Element              | Status | Uwagi                                                                                           |
| -------------------- | ------ | ----------------------------------------------------------------------------------------------- |
| Framework: Jest 30   | ✔      | ts-jest, coverage, jsdom                                                                        |
| Liczba testów        | ✔      | ~125 plików testowych / 1867+ testów                                                            |
| Testy API            | ✔      | supertest, oferty CRUD (rury/studnie), auth, orders, production                                 |
| Testy walidacji      | ✔      | Zod schemas (auth/offer/order/product/telemetry)                                                |
| Testy bezpieczeństwa | ✔      | SQL injection, rate limiter, IDOR/ownership, writeLock, featureFlags, bodyParserLimit           |
| Testy E2E            | ✔      | Playwright: ownership, wyrównanie Excel (test:alignment), nazwa (test:e2e-appname), a11y, smoke |
| Testy frontendu      | ✔      | typecheck:frontend + lint:frontend + frontendDeps + modalCore/rury rendering (jsdom)            |

## 7. Bezpieczeństwo

| Element                   | Status | Uwagi                                        |
| ------------------------- | ------ | -------------------------------------------- |
| Helmet                    | ✔      | CSP, HSTS, XSS ochrona                       |
| CORS                      | ✔      | Helmet + securityHeaders                     |
| Rate limiting             | ✔      | In-memory rate limiter na API i login        |
| Bcrypt (passwords)        | ✔      | 10 rund soli                                 |
| Sesje (token)             | ✔      | 32-bajtowy hex token, HttpOnly cookie, 7 dni |
| Walidacja Zod             | ✔      | Wszystkie dane wejściowe walidowane          |
| SQL Injection             | ✔      | Prisma ORM chroni przed SQLi                 |
| .env + .env.example       | ✔      | Sekrety poza repozytorium                    |
| Audit log                 | ✔      | audit_logs w bazie, rejestruje zmiany        |
| HTTPS redirect            | ✔      | W produkcji (x-forwarded-proto)              |
| X-Content-Type-Options    | ✔      | nosniff                                      |
| Permissions-Policy        | ✔      | camera=(), microphone=(), geolocation=()     |
| Strict-Transport-Security | ✔      | max-age=31536000 w produkcji                 |

## 8. Zależności (npm)

| Element             | Status | Uwagi                                                        |
| ------------------- | ------ | ------------------------------------------------------------ |
| Liczba zależności   | ✔      | 13 produkcyjnych, 26 dev                                     |
| Licencje komercyjne | ✔      | Wszystkie licencje komercyjnie zgodne (MIT, Apache-2.0, BSD) |
| GPL/AGPL            | ✔      | Brak copyleft w bezpośrednich zależnościach                  |
| package-lock.json   | ✔      | Obecny                                                       |
| Vulnerabilities     | ⚠      | Należy okresowo sprawdzać `npm audit`                        |

## 9. Dokumentacja

| Element               | Status | Uwagi                                       |
| --------------------- | ------ | ------------------------------------------- |
| README.md             | ✔      | README.md w głównym katalogu projektu       |
| CHANGELOG.md          | ✔      | W docs/                                     |
| AGENTS.md             | ✔      | Dla AI agentów                              |
| CLAUDE.md             | ✔      | Dla Claude Code                             |
| Swagger API docs      | ✔      | Interaktywna dokumentacja na `/api/docs`    |
| Instrukcja serwera    | ✔      | docs/INSTRUKCJA_SERWER.md                   |
| PLAN_OPTYMALIZACJI.md | ❌     | Plan został zrealizowany, dokument usunięty |
| COMPONENTS.md         | ✔      | W docs/                                     |

## 10. Git workflow

| Element              | Status | Uwagi                                                    |
| -------------------- | ------ | -------------------------------------------------------- |
| Branch: main         | ✔      | Jedyna gałąź — brak develop/release/hotfix               |
| Conventional Commits | ✔      | commitlint skonfigurowany (feat, fix, chore, docs, itp.) |
| .gitignore           | ✔      | 117 linii, dokładny                                      |
| .gitattributes       | ✔      | 163 linie                                                |
| Husky (pre-commit)   | ✔      | commitlint                                               |
| Tagi wersji          | ✔      | Tagi v1.1.0..v1.7.0 + checkpoint-*                       |
| VERSION file         | ✔      | VERSION w katalogu głównym — jedyne źródło wersji        |

---

## Podsumowanie

| Kategoria      | Ocena      |
| -------------- | ---------- |
| Struktura kodu | **9/10**   |
| Architektura   | **9/10**   |
| API            | **9/10**   |
| Baza danych    | **9/10**   |
| CI/CD          | **9/10**   |
| Testy          | **7/10**   |
| Bezpieczeństwo | **9/10**   |
| Zależności     | **9/10**   |
| Dokumentacja   | **8/10**   |
| Git workflow   | **9/10**   |
| **OGÓLNIE**    | **87/100** |

### Kluczowe zalecenia (zrealizowane)

1. ✅ **README.md** — utworzony w głównym katalogu projektu
2. ✅ **Skrypt restore bazy** — scripts/restore-db.js istnieje (walidacja nagłówka + integrity_check + WAL cleanup)
3. ✅ **Rozszerzyć testy E2E** — Playwright (ownership, wyrównanie Excel, nazwa aplikacji) + typecheck/lint frontendu
4. ✅ **Plik VERSION** — utworzony jako jedyne źródło wersji
5. ✅ **Tagi git** — dodane dla wydań (v1.1.0..v1.15.1)
6. ⚠ **Sprawdzić `npm audit`** — wykonywać okresowo
