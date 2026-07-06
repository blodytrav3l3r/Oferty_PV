# Plan modernizacji Oferty_PV

## Założenia
- 0 zmian w logice biznesowej
- 0 usuwania funkcjonalności
- Każda zmiana dokumentowana

---

## Etap 1 — Audyt projektu (AUDIT.md)
Przegląd: architektura, API, baza, CI/CD, testy, bezpieczeństwo, zależności, dokumentacja, Git.
Wynik: raport ✔/⚠/❌.

---

## Etap 2 — Single Source of Truth wersji
- `VERSION` plik (root, `1.0.0`)
- `src/version.ts` — czyta VERSION, exportuje `{ version, commitHash, branch, buildDate }`
- `package.json` → `"version": "1.0.0"` (ręcznie, potem auto)
- `src/swagger.ts` → import z `src/version.ts`

---

## Etap 3 — Endpoint /api/version
`GET /api/version` → `{ version, commitHash, branch, buildDate, environment, dbVersion }`
- commitHash/branch z `child_process.execSync` w `src/version.ts` (przy starcie serwera)
- buildDate = timestamp startu serwera
- dbVersion = `PRAGMA user_version` z SQLite

---

## Etap 4 — Git Flow (.github/GIT_FLOW.md)
Standard:
- `main` — produkcyjna, chroniona (tylko PR + CI pass)
- `develop` — robocza
- `feature/*` — nowe funkcje
- `fix/*` — bugfixy
- `hotfix/*` — pilne fixy na main
- `release/*` — przygotowanie wydania

---

## Etap 5 — CHANGELOG.md
Generowany z Conventional Commits.
Kategorie: Added, Changed, Fixed, Removed, Security, Performance, Refactor.
Początkowo: przepisanie ostatnich zmian ręcznie.
Docelowo: `standard-version`.

---

## Etap 6 — GitHub Releases (.github/workflows/release.yml)
Trigger: push tag v\*
Tworzy Release z opisem z CHANGELOG.

---

## Etap 7 — Auto-wersjonowanie (standard-version)
`npm run release:patch` → bump + changelog + tag + commit
`npm run release:minor` → jw.
`npm run release:major` → jw. (BREAKING CHANGE)

---

## Etap 8 — Widoczność wersji w UI
- Stopka w `studnie.html` i `rury.html`: `<span id="app-version"></span>`
- `public/js/versionDisplay.js` — fetch `/api/version` → wstrzykuje wersję do `#app-version`
- Swagger: już ma wersję (zmiana źródła na `src/version.ts`)

---

## Etap 9 — Dokumentacja (12 plików)
| Plik | Opis |
|------|------|
| `README.md` | rozbudowa: instalacja, komendy, wersja, screenshot |
| `CONTRIBUTING.md` | PR, commit format, code review |
| `ROADMAP.md` | plan rozwoju |
| `ARCHITECTURE.md` | struktura, diagram, decyzje |
| `API.md` | lista endpointów |
| `DATABASE.md` | schema Prisma, migracje, backup/restore |
| `DEPLOYMENT.md` | docker, Render, VPS, env vars |
| `SECURITY.md` | auth, helmet, CORS, .env |
| `VERSIONING.md` | semver w projekcie |
| `RELEASE_PROCESS.md` | krok po kroku: branch → tag → release |
| `BACKUP_RESTORE.md` | backup bazy, odtwarzanie |
| `AUDIT.md` | raport z Etapu 1 |

---

## Etap 10 — TECH_STACK.md (licencje)
- `npx license-checker --json` → lista wszystkich zależności
- Dla każdej: nazwa, licencja, komercyjne użycie, attribution, link
- Sprawdzenie czy nie ma GPL/AGPL copyleft
- Raport zgodności komercyjnej ✔/❌

---

## Etap 11 — Clean Code
- `src/app.ts` — setup Express (wcześniej w server.ts)
- `src/server.ts` — tylko listen + process.on
- `src/middleware/errorHandler.ts` — global error middleware
- `src/utils/logger.ts` — ujednolicenie (Sentry + console)
- Przejrzeć SOLID/DRY/KISS w głównych modułach

---

## Etap 12 — CI/CD pipeline
`.github/workflows/ci.yml`:
- lint, typecheck, test, build
- testy nie blokują pre-push (CI i tak je złapie)
- Docker build + push do GHCR (GitHub Container Registry)

`.github/workflows/release.yml`:
- trigger: push tag v\*
- standard-version --dry-run weryfikacja
- GitHub Release
- deploy na produkcję

---

## Etap 13 — Baza danych SQLite
- Prisma migrations już robią wersjonowanie schematu
- Dodać `PRAGMA user_version = 10000` (1.0.0 → 10000)
- `/api/version` → `dbVersion` z `PRAGMA user_version`
- `scripts/backup-db.js` — backup bazy
- `scripts/restore-db.js` — restore bazy (ostrożnie)

---

## Etap 14 — Health/Monitoring
- `GET /health` → `{ status, uptime, db, version, timestamp }`
- `GET /api/status` → szczegółowy status
- Middleware: `src/middleware/requestLogger.ts` — logowanie requestów

---

## Etap 15 — Raport końcowy (RAPORT_MODERNIZACJI.md)
Lista zmian, plików, ryzyk, zgodność licencyjna, ocena 0–100%, rekomendacje.

---

## 🔧 Poprawki pre-existing testów (6 suite'ów)

### 1. `pricelistService.test.ts` — mock `upsert` zamiast `update`/`create`
**Root cause**: implementacja `writePricelist` → `upsertSetting` → `prisma.settings.upsert()`, ale test mockuje `update` i `create`.
**Fix**: dodać `upsert` do mocka prismaClient, zamienić assercje z `update`/`create` na `upsert`.

### 2. `i18n/comments.test.ts` — angielskie komentarze w style.css
**Root cause**: style.css ma sekcje `/* Navigation */`, `/* Button & pill utility classes */`, `/* Hover effect classes */`.
**Fix**: dodać `'Navigation'`, `'Button'`, `'Hover'` do `ALLOWED_WORDS['public/css/style.css']` (to standardowe terminy CSS, akceptowalne w tech context).

### 3. `printDispatch.test.ts` — regex nie obsługuje `*` w JSDoc
**Root cause**: regex `\/\*\*[^*/]*\*\/` nie dopuszcza `*` wewnątrz JSDoc. Kod ma `/** @type {function(...[*]=): void} */` — `[*]` zawiera `*`.
**Fix**: zmienić `[^*/]*` na `[\s\S]*?` w regexie.

### 4. `ruryOrderExport.test.ts` — brak mocka `findUnique` dla karta endpointów
**Root cause**: testy karta (linie 208-219) nie ustawiają `findUnique` mock → `undefined` → 404.
**Fix**: dodać `(prisma.orders_rury_rel.findUnique as jest.Mock).mockResolvedValue(mockOrder)` przed requestem.

### 5. `studnieOrderExport.test.ts` — j.w.
**Root cause**: to samo co #4 dla studni.
**Fix**: dodać `(prisma.orders_studnie_rel.findUnique as jest.Mock).mockResolvedValue(mockOrder)`.

### 6. `studnieOrderAsOffer.test.ts` — brak `canReadDoc` w mocku ownership
**Root cause**: mock `jest.mock('../src/utils/ownership')` exportuje tylko `canWriteDoc`. Karta endpoint woła `canReadDoc(req.user, order.userId)` → undefined → throw → 500.
**Fix**: dodać `canReadDoc: jest.fn().mockReturnValue(true)` do mocka.

---

## ✅ Rozszerzenie commitlint scope-enum

**Obecne**: `rury, studnie, offers, orders, prisma, auth, ui, api, seed, deploy`

**Nowe scopes** (dodane):
| Scope | Uzasadnienie |
|-------|-------------|
| `clients` | router dla klientów istnieje |
| `audit` | router audytu istnieje |
| `settings` | router ustawień istnieje |
| `preco` | router cennika PRECO istnieje |
| `telemetry` | router telemetrii istnieje |
| `deps` | aktualizacje zależności (dependabot) |
| `docs` | dokumentacja |
| `ci` | CI/CD |
| `config` | konfiguracja (tsconfig, eslint itd.) |
| `test` | zmiany testów |
| `docker` | Dockerfile / compose |
| `security` | poprawki bezpieczeństwa |
| `chore` | maintenance / porządki |
| `release` | commity release'owe |

---

## Ryzyka i decyzje

1. ✅ **Testy pre-existing** — naprawione w ramach planu (powyżej)
2. ✅ **SQLite 48 MB** — zostaje w repo, OK (poniżej limitu 100 MB)
3. ⚠ **commitlint scope-enum** — rozszerzone (powyżej)
4. ⚠ **SQLite backup w `data/backups/`** — backup 8 MB idzie na GitHub. Można dodać do .gitignore jeśli przeszkadza.
5. ⚠ **well_configurator_backend** — nie w repo, nie w CI. Osobna decyzja biznesowa.

---

## Szacowany czas: ~2-3h (30+ plików)
