# Raport audytu projektu — WITROS Oferty PV

**Wersja projektu:** 2.0.0  
**Data audytu:** 2026-06-30  
**Audytor:** Hermes Agent / Nous Research

---

## 1. Struktura katalogów

| Element                            | Status | Uwagi                                                                                              |
| ---------------------------------- | ------ | -------------------------------------------------------------------------------------------------- |
| `src/` — kod backendu (TypeScript) | ✔      | 58 plików .ts, dobrze zorganizowane (routes/, middleware/, services/, utils/, validators/, types/) |
| `src/routes/` — endpointy API      | ✔      | 20 plików, logicznie podzielone na oferty, zamówienia, produkty, auth                              |
| `src/middleware/` — middleware     | ✔      | Auth, security, rate limiter — wydzielone osobno                                                   |
| `src/services/` — logika biznesowa | ✔      | Obsługa audytu, cenników, PDF                                                                      |
| `src/utils/` — narzędzia           | ✔      | Logger itp.                                                                                        |
| `src/validators/` — walidacja Zod  | ✔      | Schematy auth i ofert                                                                              |
| `public/` — frontend (SPA)         | ✔      | Vanilla JS, 6 plików HTML, osobne js/css                                                           |
| `tests/` — testy                   | ✔      | 32 pliki testowe, pokrycie ~60%                                                                    |
| `prisma/` — schema + migracje      | ✔      | Schema 272 linie, migracje w podkatalogu                                                           |
| `data/` — baza SQLite + seed       | ✔      | app_database.sqlite + pliki seed JSON                                                              |
| `scripts/` — skrypty narzędziowe   | ✔      | Backup, restore, migracja, deploy                                                                  |
| `docs/` — dokumentacja             | ⚠      | Istniejące pliki CHANGELOG.md, PLAN_OPTYMALIZACJI.md itp., ale brak README.md w głównym katalogu   |
| `coverage/` — raport pokrycia      | ✔      | Generowany przez Jest                                                                              |
| `.github/workflows/` — CI/CD       | ✔      | CI, CodeQL, Dependabot                                                                             |

## 2. Architektura

| Element                          | Status | Uwagi                                         |
| -------------------------------- | ------ | --------------------------------------------- |
| Backend: Express.js (TypeScript) | ✔      | Dobrze skonfigurowany, typowany               |
| ORM: Prisma 6.0                  | ✔      | SQLite, generowany klient                     |
| Frontend: Vanilla JS SPA         | ✔      | Bez frameworka — lekkie, szybkie              |
| Bundler: Vite 8.0 (dev)          | ✔      | Tylko w dev, w produkcji serwowane statycznie |
| Baza danych: SQLite              | ✔      | Lokalna, WAL-safe backup                      |
| Swagger API docs                 | ✔      | `/api/docs`                                   |
| Sentry monitoring                | ✔      | Opcjonalny, aktywny po ustawieniu DSN         |

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

| Element             | Status | Uwagi                                              |
| ------------------- | ------ | -------------------------------------------------- |
| Schema Prisma       | ✔      | 17 modeli, indeksy, relacje                        |
| Migracje            | ✔      | prisma/migrations/ istnieje                        |
| Seed danych         | ✔      | prisma/seed.ts + pliki JSON (rury, studnie, preco) |
| Backup              | ✔      | scripts/backup.ts — VACUUM INTO, max 30 kopii      |
| Restore             | ⚠      | Brak dedykowanego skryptu restore w scripts/       |
| WAL-safe backup     | ✔      | Używa VACUUM INTO dla spójnych snapshotów          |
| PRAGMA user_version | ⚠      | Nie użyte do wersjonowania schematu                |

## 5. CI/CD

| Element            | Status | Uwagi                                            |
| ------------------ | ------ | ------------------------------------------------ |
| GitHub Actions CI  | ✔      | commitlint, lint, typecheck, test, build, deploy |
| CodeQL             | ✔      | Analiza bezpieczeństwa co poniedziałek           |
| Dependabot         | ✔      | Aktualizacje zależności                          |
| Husky + commitlint | ✔      | Pre-commit hooks, conventional commits           |
| lint-staged        | ✔      | ESLint + Prettier na staged plikach              |
| Docker             | ✔      | Dockerfile + docker-compose.yml                  |
| Render deploy      | ✔      | render.yaml z Persistent Disk                    |
| Health check       | ✔      | Docker HEALTHCHECK + Render healthCheckPath      |

## 6. Testy

| Element              | Status | Uwagi                                                  |
| -------------------- | ------ | ------------------------------------------------------ |
| Framework: Jest 30   | ✔      | ts-jest, coverage                                      |
| Liczba testów        | ✔      | 32 pliki testowe                                       |
| Testy API            | ✔      | supertest, oferty CRUD, auth                           |
| Testy walidacji      | ✔      | Zod schemas testowane                                  |
| Testy bezpieczeństwa | ✔      | SQL injection, rate limiter                            |
| Testy E2E            | ⚠      | Tylko testy ownershipE2e, brak pełnego E2E             |
| Testy frontendu      | ❌     | Brak — frontend to Vanilla JS bez frameworka testowego |

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

| Element               | Status | Uwagi                                    |
| --------------------- | ------ | ---------------------------------------- |
| README.md             | ❌     | Brak w głównym katalogu (tylko w docs/)  |
| CHANGELOG.md          | ✔      | W docs/                                  |
| AGENTS.md             | ✔      | Dla AI agentów                           |
| CLAUDE.md             | ✔      | Dla Claude Code                          |
| Swagger API docs      | ✔      | Interaktywna dokumentacja na `/api/docs` |
| Instrukcja serwera    | ✔      | docs/INSTRUKCJA_SERWER.md                |
| PLAN_OPTYMALIZACJI.md | ✔      | W docs/                                  |
| COMPONENTS.md         | ✔      | W docs/                                  |

## 10. Git workflow

| Element              | Status | Uwagi                                                    |
| -------------------- | ------ | -------------------------------------------------------- |
| Branch: main         | ✔      | Produkcja                                                |
| Conventional Commits | ✔      | commitlint skonfigurowany (feat, fix, chore, docs, itp.) |
| .gitignore           | ✔      | 117 linii, dokładny                                      |
| .gitattributes       | ✔      | 163 linie                                                |
| Husky (pre-commit)   | ✔      | commitlint                                               |
| Tagi wersji          | ⚠      | Brak tagów git — wersja 2.0.0 w package.json             |
| VERSION file         | ❌     | Brak — wersja tylko w package.json                       |

---

## Podsumowanie

| Kategoria      | Ocena      |
| -------------- | ---------- |
| Struktura kodu | **9/10**   |
| Architektura   | **9/10**   |
| API            | **9/10**   |
| Baza danych    | **8/10**   |
| CI/CD          | **9/10**   |
| Testy          | **7/10**   |
| Bezpieczeństwo | **9/10**   |
| Zależności     | **9/10**   |
| Dokumentacja   | **5/10**   |
| Git workflow   | **7/10**   |
| **OGÓLNIE**    | **81/100** |

### Kluczowe zalecenia

1. **Utworzyć README.md** w głównym katalogu projektu
2. **Dodać skrypt restore bazy** (scripts/restore-db.js)
3. **Rozszerzyć testy E2E** i dodać testy frontendu
4. **Dodać plik VERSION** jako jedyne źródło wersji
5. **Dodać tagi git** dla wydań
6. **Sprawdzić `npm audit`** pod kątem podatności
