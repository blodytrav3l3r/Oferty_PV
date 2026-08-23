# Architektura — S.O.K. — System Ofert i Kalkulacji

**Wersja:** 1.19.2  
**Ostatnia aktualizacja:** 2026-08-23  
**Stack:** Express + Prisma + SQLite + VanillaJS SPA + ML Pipeline

---

## Przegląd architektury

Aplikacja S.O.K. — System Ofert i Kalkulacji to pojedyncza aplikacja webowa (monolit) złożona z:

- **Backend API** — Express.js (TypeScript) obsługujący logikę biznesową i dane
- **Frontend SPA** — Vanilla JavaScript z osobnymi widokami HTML (bez frameworka)
- **Baza danych** — SQLite przez Prisma ORM
- **Serwer** — Express jako jedyny serwer (dev i prod), serwuje API i `public/`

```
┌──────────────────────────────────────────────────────┐
│                   Klient (przeglądarka)                │
│  ┌──────────────────────────────────────────────────┐ │
│  │          SPA — Vanilla JS                        │ │
│  │  index.html  │  rury.html  │  studnie.html        │ │
│  │  app.html    │  kartoteka.html │ zlecenia.html    │ │
│  └───────────────┬──────────────────────────────────┘ │
└──────────────────┼───────────────────────────────────┘
                   │  HTTP (JSON)
                   ▼
┌──────────────────────────────────────────────────────┐
│           Express.js Backend (TypeScript)             │
│  ┌──────────────────────────────────────────────────┐ │
│  │  Middleware:  Helmet │ Auth │ RateLimiter │ CORS │ │
│  ├──────────────────────────────────────────────────┤ │
│  │  Routes:  /api/auth  │  /api/products  │  ...    │ │
│  ├──────────────────────────────────────────────────┤ │
│  │  Services:  Audit │ Pricelist │ PDF/DOCX │ Exports│ │
│  ├──────────────────────────────────────────────────┤ │
│  │  Validators:  Zod schemas                        │ │
│  └──────────────────────────────────────────────────┘ │
└──────────────────────┬───────────────────────────────┘
                       │  Prisma ORM
                       ▼
┌──────────────────────────────────────────────────────┐
│              SQLite Database                          │
│  ┌──────────────────────────────────────────────────┐ │
│  │  Tables: offers_rel │ offers_studnie_rel │ users  │ │
│  │  products_rury │ products_studnie │ clients      │ │
│  │  orders_rury_rel │ orders_studnie_rel │ sessions │ │
│  └──────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────┘
```

---

## Diagram przepływu danych

```
┌──────────┐     ┌─────────────┐     ┌──────────┐     ┌─────────────┐
│Użytkownik│────▶│  Wprowadza  │────▶│ API      │────▶│  Walidacja  │
│          │     │  dane       │     │ Express  │     │  (Zod)      │
└──────────┘     └─────────────┘     └──────────┘     └──────┬──────┘
                                                              │
                                                              ▼
┌──────────┐     ┌─────────────┐     ┌──────────┐     ┌─────────────┐
│Generacja │◀────│  Serwis     │◀────│  Prisma   │◀────│  Logika     │
│PDF/DOCX  │     │  biznesowy  │     │  ORM      │     │  biznesowa  │
└──────────┘     └─────────────┘     └──────────┘     └─────────────┘
                                                │
                                                ▼
                                        ┌─────────────┐
                                        │  SQLite      │
                                        │  (baza plik) │
                                        └─────────────┘
```

---

## Backend — szczegóły

### Stack

| Technologia | Wersja   | Rola                            |
| ----------- | -------- | ------------------------------- |
| Node.js     | >= 22.13 | Środowisko uruchomieniowe       |
| TypeScript  | ~6.0     | Język programowania             |
| Express.js  | ~4.22    | Framework webowy                |
| Prisma      | ~6.0     | ORM (Object-Relational Mapping) |
| Zod         | ~4.3     | Walidacja danych wejściowych    |
| bcryptjs    | ~3.0     | Haszowanie haseł                |
| Helmet      | ~8.1     | Nagłówki bezpieczeństwa HTTP    |
| Sentry      | ~10.59   | Monitoring błędów               |
| docx        | ~9.6     | Generowanie dokumentów DOCX     |
| Puppeteer   | ~24.43   | Generowanie PDF                 |
| ts-node-dev | ~2.0     | Hot-reload w dev                |
| Jest        | ~30.0    | Framework testowy               |
| Swagger     | 6.x      | Dokumentacja API                |

### Warstwy

1. **Middleware** (`src/middleware/`)
    - `auth.ts` — autoryzacja (session token, HttpOnly cookie, rola admin/user)
    - `security.ts` — nagłówki bezpieczeństwa, HTTPS redirect
    - `rateLimiter.ts` / `rateLimiters.ts` — limitowanie żądań per IP (in-memory)
    - `errorHandler.ts` — globalna obsługa błędów
    - `requestLogger.ts` — logowanie żądań HTTP
    - `writeLock.ts` — modułowy lock zapisu (`createModuleLock()` → `{ acquireLock, runWithLock }`, per-klucz, timeout 30 s, mutual exclusion) — DRY dla tras zapisu cenników

2. **Routes** (`src/routes/`)
    - `auth.ts` — logowanie, rejestracja, wylogowanie, zmiana hasła
    - `users.ts` — zarządzanie użytkownikami
    - `productsV2.ts` — CRUD produktów (rury)
    - `productsStudnieV2.ts` — CRUD produktów (studnie)
    - `offers/` — oferty: rury (`ruryCrud.ts`), studnie (`studnieCrud.ts`), dispatcher (`crud.ts`), eksport (`exports.ts`), wyszukiwanie (`search.ts`)
    - `orders/` — zamówienia, numeracja, produkcja, wyszukiwanie produkcji
        - `index.ts`, `numbering.ts`, `production.ts`, `productionSearch.ts`
        - `ruryOrders.ts`, `ruryOrders.crud.ts`, `ruryOrders.export.ts`
        - `studnieOrders.ts`, `studnieOrders.crud.ts`, `studnieOrders.export.ts`
    - `clients.ts` — CRUD klientów
    - `audit.ts` — logi audytowe
    - `settings.ts` — ustawienia systemowe
    - `telemetry.ts` — telemetria AI
    - `telemetryAi.ts` — endpointy AI (predykcje, rekomendacje)
    - `telemetryAiMl.ts` — pipeline ML (trenowanie, ewaluacja)
    - `telemetryAiDashboard.ts` — dashboard telemetrii
    - `featureFlags.ts` — zarządzanie flagami funkcjonalnymi
    - `exportCombined.ts` — łączny eksport (PDF/DOCX)
    - `priceOverrides.ts` — nadpisania cen
    - `precoPricingV2.ts` — cenniki Preco

3. **Services** (`src/services/`)
    - `auditService.ts` — logowanie zmian w bazie
    - `pdfGenerator.ts` — generowanie PDF (Puppeteer)
    - `docx/` — generowanie dokumentów DOCX (rury i studnie)
        - `rury/` — builder, content, sections, tables, kartaBudowy
        - `studnie/` — builder, content, sections, tables, kartaBudowy
        - `helpers.ts`, `headerFooter.ts`, `constants.ts`, `colors.ts`, `index.ts`
    - `pdf/` — generowanie kart budowy i dokumentów PDF
        - `pdfEngine.ts`, `kartaBudowy.ts`, `offerUsers.ts`, `ruryHtml.ts`, `studnieHtml.ts`
        - `context.ts`, `helpers.ts`, `types.ts`
    - `telemetry/` — telemetria AI i learning engine
        - `telemetryService.ts`, `telemetryTypes.ts`
        - `learning/` — silnik uczący: LearningEngine, KnowledgeBase, RecommendationEngine, RankingEngine, PreferenceEngine, PatternDetector, FeedbackProcessor, ConfidenceCalculator
    - `ml/` — pipeline ML dla konfiguratora studni
        - `TrainingPipeline.ts`, `FeatureExtractor.ts`, `AcceptanceModel.ts`
        - `ModelRegistry.ts`, `SelfEvaluation.ts`, `RewardCalculator.ts`
        - `parseFeatureSnapshot.ts`, `trainingConfig.ts`, `index.ts`

4. **Validators** (`src/validators/`)
    - `authSchema.ts` — schematy dla auth (login, register, changePassword)
    - `offerSchemas.ts` — schematy dla ofert i klientów
    - `orderSchemas.ts` — schematy dla zamówień
    - `productSchemas.ts` — schematy dla produktów
    - `telemetrySchemas.ts` — schematy dla telemetrii AI

5. **Utils** (`src/utils/`)
    - `brandHtml.ts` — brandowanie nagłówka w generowanych dokumentach
    - `cronService.ts` — serwis cron (setInterval)
    - `dbQueryCounter.ts` — licznik zapytań DB (diagnostyka N+1)
    - `fts5Sync.ts` — synchronizacja FTS5 dla wyszukiwarki (auto-tworzenie tabeli wirtualnej + backfill przy starcie, nie tylko przebudowa przy braku kolumn)
    - `logger.ts` — logger aplikacji
    - `ownership.ts` — weryfikacja własności zasobów (`canReadDoc`/`canWriteDoc`; legacy rekord bez właściciela = brak prawa zapisu dla nie-admina)
    - `paths.ts` — ścieżki plików i katalogów
    - `productionSearchUtils.ts` — narzędzia wyszukiwania produkcji
    - `productionOrderGuard.ts` — guard PZ (blokada usuwania ofert/zamówień/elementów z przypisanymi zleceniami produkcyjnymi)
    - `roleFilter.ts` — filtrowanie po roli użytkownika
    - `searchCache.ts` — cache wyszukiwania
    - `searchUtils.ts` — narzędzia wyszukiwania

6. **Constants / wersja**
    - `constants/appMeta.ts` — `APP_NAME` z env (domyślnie `S.O.K.`) — SSoT nazwy aplikacji
    - `version.ts` — `getVersion()` czyta `VERSION` (root) — SSoT numeru wersji

### Telemetria AI i ML — kluczowe mechanizmy

- **Dual-ranking AI** (`public/js/studnie/mlDualRanking.js`): `rankCandidates` może zmienić
  zwycięzcę spośród kandydatów solvera, gdy AI realnie je oceniło (co najmniej jeden
  `aiScore >= 0`) i `aiInfluencePct > 0` — studnia dostaje `configSource: 'AUTO_AI'`
  (`solverAutoSelect.js`), przy awarii AI fallback do rankingu technicznego.
- **Mapowanie AUTO_AI → AI_SUGGEST**: `telemetryBridge.normalizeSolverSource()` mapuje
  wewnętrzny `configSource` (`AUTO_AI`, `AUTO`, `MANUAL_SWAP`, ...) do backendowego enum
  `solverSource` (`AUTO_JS`/`MANUAL`/`AI_SUGGEST`) — `AUTO_AI` → `AI_SUGGEST`.
- **Deduplikacja telemetrii AUTO_JS** (`src/services/telemetry/telemetryService.ts`):
  `recordConfig` dla źródła `AUTO_JS` porównuje kanoniczny `featureSnapshot` (rekurencyjny
  deterministyczny serializator `_canonicalize`) + posortowaną listę `allComponentIds`
  (`_dedupKey`). Identyczna konfiguracja nie tworzy nowego rekordu — robi `update`
  `lastUsedAt`/`usageCount`/`offerId`/`clientId`/`projectId`/`warehouse` na ostatnim
  rekordzie AUTO_JS studni (zapytanie `_findLatestAutoJs`). Duplikaty zawyżały
  hitCount/confidence wzorców i mnożyły próbki treningowe ML. `MANUAL`/`AI_SUGGEST`
  zawsze są zapisywane (sygnały decyzji użytkownika).
- **Deduplikacja po stronie frontendu**: `public/js/studnie/telemetryBridge.js` — sesyjny
  `autoJsDedupMap` (wellId → hash) z `wellContentFingerprint` (treść studni) +
  `pricingFingerprint` (cena/waga — totalPrice jest cechą treningową ML) + `shouldSendAutoJs`;
  `public/js/studnie/offerSave.js` — przy zapisie istniejącej oferty wysyła tylko zmienione
  studnie (`_filterChangedWells` + `_wellSnapshot` + `_wellPricingStats`).
- **Indeksy dedup telemetrii**: migracja `20260805100000_telemetry_well_dedup` + definicje
  w `prisma/schema.prisma` (`idx_logs_well`, `idx_logs_source_well`). Auto-heal przy starcie
  serwera (`src/app.ts`): `CREATE INDEX IF NOT EXISTS` dla obu indeksów obok
  `idx_audit_created_at` — instalacje bez historii migracji (`db push`) nie tworzą nowych indeksów.
- **Auto-heal FTS5** (`src/utils/fts5Sync.ts`): `ensureFts5Schema` tworzy tabelę wirtualną
  FTS5 (`createFts5Table`) + robi `backfillFts5` także wtedy, gdy tabeli brak (świeża baza),
  nie tylko gdy brakuje kolumn (przebudowa + backfill).
- **TrainingPipeline** (`src/services/ml/TrainingPipeline.ts`): sliding window treningowy
  (`orderBy createdAt desc` + `take TRAINING_BATCH_SIZE` + `reverse()`), znacznik
  `lastTrainedAt` (zamiast `lastFeatureCount`), bramka nowych danych
  `newCount = count(createdAt > lastTrainedAt)`.
- **Paradygmat uczenia** (`src/services/ml/SelfEvaluation.ts`, `RewardCalculator.ts`):
  feedback-based learning — model uczy się z decyzji użytkownika (accept/reject/modify)
  i samooceny AUC; nie jest to reinforcement learning (brak state/action/policy/update rule).
- **Retencja rejestru modeli ML** (`src/services/ml/ModelRegistry.ts` — `pruneOldModels`):
  po każdym `saveModel` oraz przy starcie serwera rejestr `AiModel` jest przycinany do
  polityki `ML_CONFIG.retention` (`src/services/ml/trainingConfig.ts`, domyślnie
  `keepLast: 10`, `keepBest: 3`). Zawsze zostają: wszystkie modele aktywne, top-`keepBest`
  wg `rocAUC` oraz ostatnie `keepLast` wg `createdAt` (oba zbiory liczone tylko dla bieżącej
  `FEATURE_VERSION`); reszta jest usuwana `deleteMany` partiami po 500 z guardem
  `active: false`. Metoda nigdy nie rzuca (błąd logowany, start serwera nie jest blokowany).
  Limit widoczny w dashboardzie: `GET /api/telemetry/ai/ml-status` → `retention`
  (statCard "Liczba modeli" pokazuje `modelCount / (keepLast+keepBest)`).
- **LearningEngine** (`src/services/telemetry/learning/LearningEngine.ts`): `getStatus` jest
  async i czyta `lastRunAt` z bazy (`settings.learning_last_run` przez `loadLastRun`), aby
  przetrwać restart serwera. Usunięte martwe pola feedback/ranker. `KnowledgeBase`
  ma `countPatterns()` (licznik aktywnych wzorców), usunięto `archivePattern`.
- **Diagnostyka „brak wzorców”**: `src/routes/telemetryAiDashboard.ts` — endpoint
  `/ai/knowledge/patterns` zwraca `telemetryCount`, `patternsTotal`, `patternsOtherDn`,
  `lastRunAt`, `minConfidence`; `public/js/admin/aiDashboard.js` renderuje komunikat
  diagnostyczny `patternsEmptyHtml` (brak danych / brak cyklu / inne DN / niski próg).

### Konfiguracja

| Plik                     | Opis                                                              |
| ------------------------ | ----------------------------------------------------------------- |
| `server.ts`              | Główny plik aplikacji — inicjalizacja Express, middleware, routes |
| `tsconfig.json`          | Konfiguracja TypeScript dla backendu                              |
| `tsconfig.frontend.json` | Konfiguracja TypeScript dla frontendu                             |
| `jest.config.ts`         | Konfiguracja Jest                                                 |

---

## Frontend — szczegóły

Modularyzacja frontendu opisana jest w [ADR-008](adr/ADR-008-frontend-modularyzacja.md):
monolityczne pliki JS rozbito na małe moduły delegujące (np. `wellActions.js` → `actions*.js`,
`excelTableManager.js` → `excel*.js`), router SPA działa w `public/js/spa/router.js`
(adresy `app.html#/<moduł>`), nagłówek i logo współdzielone przez `public/js/shared/headerUser.js`
oraz `public/images/logo-sok.svg`.

### Stack

| Technologia             | Rola                               |
| ----------------------- | ---------------------------------- |
| Vanilla JavaScript      | Logika frontendu (brak frameworka) |
| HTML                    | Widoki (6 plików .html)            |
| CSS                     | Style (w public/css/)              |
| IndexedDB (opcjonalnie) | Pamięć lokalna dla trybu offline   |

### Widoki

| Plik             | Opis                        |
| ---------------- | --------------------------- |
| `index.html`     | Strona główna / dashboard   |
| `app.html`       | Główna aplikacja SPA        |
| `rury.html`      | Zarządzanie ofertami rur    |
| `studnie.html`   | Zarządzanie ofertami studni |
| `kartoteka.html` | Kartoteka klientów          |
| `zlecenia.html`  | Widok zamówień              |

### Frontend — struktura JS

| Katalog                    | Liczba plików | Opis                                                                     |
| -------------------------- | ------------- | ------------------------------------------------------------------------ |
| `public/js/rury/`          | 31            | Logika modułu rur (oferty, cenniki, zamówienia)                          |
| `public/js/studnie/`       | 137           | Logika modułu studni (konfigurator, oferty, cenniki, excel, zamówienia)  |
| `public/js/shared/`        | 22            | Wspólne helpery (auth, ui, headerUser, toast, modalCore, StorageService) |
| `public/js/kartoteka/`     | 8             | Kartoteka ofert i zamówień (kartotekaActions, kartotekaUi, ...)          |
| `public/js/import-export/` | 11            | Import/eksport XLSX + JSON 1:1 (toolbar.js + rury/studnie/shared)        |
| `public/js/spa/`           | 4             | Router SPA (router.js, navGuard)                                         |
| `public/js/admin/`         | 4             | Panel admina (AI dashboard)                                              |

Główne pliki rdzeniowe w `public/js/studnie/` po podziale:

- `wellActions.js` (52 linie) → deleguje do 12 modułów `actions*.js`
- `wellManager.js` (277 linii) → deleguje do `actionsWellPainting.js`
- `wellPopups.js` (322 linie) → deleguje do `popups*.js`
- `wellTransitions.js` (643 linie) → deleguje do `wellTransitions*.js`
- `pricelistManager.js` (241 linii) → deleguje do 9 modułów `pricelist*.js`
- `offerRendering.js` (54 linie) → deleguje do 11 modułów `offer*.js`
- `orderZlecenia.js` (7 linii) → deleguje do 5 modułów `orderZlecenia*.js`
- `excelTableManager.js` (335 linii) → deleguje do 19 modułów `excel*.js`

### Frontend — struktura CSS

| Plik                              | Rola                                                                 |
| --------------------------------- | -------------------------------------------------------------------- |
| `public/css/style.base.css`       | **Tokeny `:root` + base layout + komponenty wspólne** (SSoT tokenów) |
| `public/css/style.cards.css`      | Karty ofert + status-badge                                           |
| `public/css/style.responsive.css` | Responsive + modale + toasty + wizard                                |
| `public/css/style.utilities.css`  | Utility classes (zastępują inline style)                             |
| `public/css/inter.css`            | Font Inter (importowany przez `style.base.css`)                      |
| `public/css/print.css`            | Style wydruku                                                        |
| `public/css/printModal.css`       | Style podglądu wydruku (UPM)                                         |
| `public/css/index.css`            | Style Pulpitu (dashboard)                                            |
| `public/css/rury.css`             | Style modułu rur                                                     |
| `public/css/studnie.css`          | Style modułu studni (kreator, diagram, Excel)                        |
| `public/css/zlecenia.css`         | Style zleceń produkcyjnych                                           |
| `public/css/spa.css`              | Style shella SPA (`app.html`)                                        |

> Wszystkie wejściówki (`app.html`, `index.html`, `rury.html`, `studnie.html`, `kartoteka.html`, `zlecenia.html`) ładują wspólne arkusze: `style.base.css` → `style.cards.css` → `style.responsive.css` → `style.utilities.css` (kolejność ma znaczenie dla kaskady) + arkusz modułowy (`index.css`/`rury.css`/`studnie.css`/`zlecenia.css`/`spa.css`). Legacy `public/css/style.css` **nie istnieje** — został usunięty (tokenizacja, 2026-08-03). Pełne wytyczne: `docs/UI_GUIDELINES.md`.

---

## Baza danych

### Provider: SQLite

- Lokalna baza plikowa (`data/app_database.sqlite`)
- Backup przez `VACUUM INTO` (WAL-safe snapshot)
- Prisma ORM zarządza schematem i migracjami

### Modele (38)

- **users** — użytkownicy systemu
- **sessions** — sesje logowania (token-based)
- **clients_rel** — baza klientów
- **productsRury** / **productsRuryDefault** — produkty rury + wzorzec resetu
- **productsStudnie** / **productsStudnieDefault** — produkty studnie + wzorzec resetu
- **offers_rel** — oferty rur
- **offers_studnie_rel** — oferty studni
- **orders_rury_rel** — zamówienia rur
- **orders_studnie_rel** — zamówienia studni
- **offer_items_rel** / **offer_studnie_items_rel** — pozycje ofert
- **audit_logs** — logi audytowe
- **settings** — ustawienia (klucz-wartość)
- **order_counters** / **order_counters_rury** — liczniki numeracji
- **production_orders_rel** / **production_order_counters** / **recycled_production_numbers** — produkcja
- **PrecoKonfig** / **PrecoKonfigDefault** — konfiguracja Preco
- **PrecoKinety** / **PrecoKinetyDefault** — kinety Preco
- **PrecoZakresy** / **PrecoZakresyDefault** — zakresy Preco
- **ai_telemetry_logs** / **ai_telemetry_events** — telemetria AI (logi + zdarzenia)
- **ai_config_history** — historia wersji konfiguracji
- **ai_telemetry_versions** — wersje solvera/reguł/AI
- **ai_knowledge_base** — baza wiedzy AI (wzorce i rekomendacje)
- **ai_recommendations** — rekomendacje AI
- **ai_transition_snapshots** — przejścia szczelne (cechy geometryczne)
- **AiFeature** — feature store ML (wektory cech)
- **AiModel** — model registry ML (wagi modeli)
- **AiTrainingRun** — audyt uruchomień treningu ML (kręgosłup audytu, od `20260816000000_ai_training_run`)
- **AiEvaluation** — dzienne metryki ewaluacji ML
- **aiRewardLog** — logi nagród ML (unique `(wellId, action)` — dedup rewardów)

- **Indeksy telemetrii**: `idx_logs_well` (wellId) i `idx_logs_source_well` (solverSource, wellId) na
  `ai_telemetry_logs` — migracja `20260805100000_telemetry_well_dedup`, idempotentnie odtwarzane
  przy starcie serwera (`CREATE INDEX IF NOT EXISTS` w `src/app.ts`).

Szczegóły: [DATABASE.md](DATABASE.md)

---

## Bezpieczeństwo

- **Helmet** — zabezpiecza nagłówki HTTP (CSP, HSTS, XSS)
- **Auth** — session token (32-bajtowy hex, HttpOnly cookie, 7 dni ważności)
- **Rate limiting** — ograniczenie liczby żądań per IP (in-memory)
- **Bcrypt** — haszowanie haseł (10 rund)
- **Zod** — walidacja wszystkich danych wejściowych
- **HTTPS redirect** — w produkcji
- **Sentry** — monitoring błędów (opcjonalny)

Szczegóły: [SECURITY.md](SECURITY.md)

---

## Struktura katalogów (szczegółowa)

```
Oferty_PV/
├── server.ts                        # Główny plik aplikacji
├── package.json                     # Zależności i skrypty
├── tsconfig.json                    # TypeScript backend
├── jest.config.ts                   # Jest config
├── commitlint.config.js             # Conventional commits
│
├── src/                             # Backend
│   ├── app.ts                      # Konfiguracja Express (auto-heal indeksów + FTS5 przy starcie)
│   ├── prismaClient.ts             # Klient Prisma (singleton)
│   ├── helpers.ts                  # Pomocnicze funkcje
│   ├── version.ts                  # Wersja aplikacji
│   ├── swagger.ts                  # Konfiguracja Swagger/OpenAPI
│   ├── db.ts                       # Re-eksporty db (kompatybilność)
│   ├── config/                     # Konfiguracja
│   │   └── mlConstants.ts          # Stałe ML
│   ├── middleware/
│   │   ├── auth.ts                 # Autoryzacja + sesje
│   │   ├── security.ts             # Nagłówki bezpieczeństwa
│   │   ├── rateLimiter.ts          # Rate limiting
│   │   ├── rateLimiters.ts         # Konfiguracja limiterów (API/LOGIN/WRITE/PRICELIST/EXPORT)
│   │   ├── writeLock.ts            # Modułowy lock zapisu (createModuleLock, per-klucz, 30 s)
│   │   ├── errorHandler.ts         # Globalna obsługa błędów
│   │   └── requestLogger.ts        # Logowanie żądań HTTP
│   ├── routes/
│   │   ├── auth.ts                 # Endpointy auth
│   │   ├── users.ts                # Zarządzanie użytkownikami
│   │   ├── productsV2.ts           # Produkty rury
│   │   ├── productsStudnieV2.ts    # Produkty studnie
│   │   ├── clients.ts              # Klienci
│   │   ├── offers/
│   │   │   ├── index.ts            # Router główny ofert
│   │   │   ├── crud.ts             # CRUD (dispatcher)
│   │   │   ├── ruryCrud.ts         # Oferty rur
│   │   │   ├── studnieCrud.ts      # Oferty studni
│   │   │   ├── exports.ts          # Eksport PDF/DOCX
│   │   │   └── search.ts           # Wyszukiwanie ofert
│   │   ├── orders/
│   │   │   ├── index.ts            # Router główny zamówień
│   │   │   ├── ruryOrders.ts       # Zamówienia rur
│   │   │   ├── ruryOrders.crud.ts  # CRUD zamówień rur
│   │   │   ├── ruryOrders.export.ts# Eksport zamówień rur
│   │   │   ├── studnieOrders.ts    # Zamówienia studni
│   │   │   ├── studnieOrders.crud.ts# CRUD zamówień studni
│   │   │   ├── studnieOrders.export.ts# Eksport zamówień studni
│   │   │   ├── numbering.ts        # Numeracja zamówień
│   │   │   ├── production.ts       # Zamówienia produkcyjne
│   │   │   └── productionSearch.ts # Wyszukiwanie produkcji
│   │   ├── audit.ts                # Logi audytowe
│   │   ├── settings.ts             # Ustawienia
│   │   ├── exportCombined.ts       # Łączny eksport PDF/DOCX
│   │   ├── telemetry.ts            # Telemetria AI
│   │   ├── telemetryAi.ts          # Endpointy AI
│   │   ├── telemetryAiMl.ts        # Pipeline ML
│   │   ├── telemetryAiDashboard.ts # Dashboard AI
│   │   ├── featureFlags.ts         # Feature flags
│   │   ├── precoPricingV2.ts       # Cenniki Preco
│   │   └── priceOverrides.ts       # Nadpisania cen
│   ├── services/
│   │   ├── auditService.ts         # Usługa audytu
│   │   ├── combinedExport.ts       # Łączny eksport (PDF/DOCX)
│   │   ├── pdfGenerator.ts         # Generowanie PDF (legacy wrapper)
│   │   ├── priceOverrideService.ts # Nadpisania cen + saveDefaults
│   │   ├── seedExporter.ts         # Eksport cenników do seed JSON
│   │   ├── docx/                   # Generowanie DOCX (rury/studnie + helpers)
│   │   ├── pdf/                    # Karty budowy PDF (pdfEngine, kartaBudowy, ruryHtml, studnieHtml)
│   │   ├── telemetry/              # Telemetria AI (telemetryService + learning/*)
│   │   └── ml/                     # Pipeline ML (TrainingPipeline, FeatureExtractor, AcceptanceModel, ModelRegistry)
│   ├── utils/
│   │   ├── cronService.ts          # Serwis cron
│   │   ├── fts5Sync.ts             # Synchronizacja FTS5
│   │   ├── logger.ts               # Logger
│   │   ├── ownership.ts            # Weryfikacja własności (canReadDoc/canWriteDoc)
│   │   ├── productionOrderGuard.ts # Guard PZ (blokada usuwania z przypisanymi zleceniami)
│   │   ├── productionSearchUtils.ts# Narzędzia wyszukiwania produkcji
│   │   ├── roleFilter.ts           # Filtr roli
│   │   ├── searchCache.ts          # Cache wyszukiwania
│   │   └── searchUtils.ts          # Narzędzia wyszukiwania (FTS5 + cache)
│   ├── validators/
│   │   ├── authSchema.ts           # Walidacja auth
│   │   ├── offerSchemas.ts         # Walidacja ofert
│   │   ├── orderSchemas.ts         # Walidacja zamówień
│   │   ├── productSchemas.ts       # Walidacja produktów
│   │   └── telemetrySchemas.ts     # Walidacja telemetrii
│   └── types/                      # Typy TypeScript
│
├── public/                          # Frontend (Vanilla JS, 221 plików)
│   ├── index.html                   # Dashboard (Pulpit)
│   ├── app.html                     # Shell SPA (router hash #/moduł, osadza iframe)
│   ├── rury.html                    # Moduł rur (iframe)
│   ├── studnie.html                 # Moduł studni (iframe, Excel modal)
│   ├── kartoteka.html               # Kartoteka ofert i zamówień
│   ├── zlecenia.html                # Zlecenia produkcyjne (PZ)
│   ├── favicon.ico                  # Ikona
│   ├── js/                          # Skrypty JS (221 plików)
│   ├── css/                         # 11 arkuszy (style.base/cards/responsive/utilities + index/rury/studnie/zlecenia/spa/inter/printModal)
│   ├── images/                      # logo-sok.svg, letterhead-*.png, b-mark.png, ce-mark.png
│   ├── partials/                    # Partiale HTML (header, rury/*, studnie/*) — partialLoader
│   └── templates/                   # 5 szablonów: ofertaRury/Studnie, kartaBudowy, zlecenie, etykieta
│
├── prisma/                          # Prisma (38 modeli, 3 migracje)
│   ├── schema.prisma                # Definicja schematu (651 linii)
│   ├── seed.ts                      # Seed danych (ProductsRury/Studnie + Preco + AiModel)
│   └── migrations/                  # 20260815000000_baseline + 20260815000001_uq_reward + 20260816000000_ai_training_run
│
├── data/                            # Baza danych
│   ├── app_database.sqlite          # Główna baza (SQLite)
│   ├── price_defaults.json          # Snapshot domyślnych cenników (transfer między instalacjami)
│   ├── backups/                     # Kopie zapasowe (VACUUM INTO)
│   ├── seed_rury.json               # Seed produktów (rury)
│   ├── seed_studnie.json            # Seed produktów (studnie)
│   └── seed_preco.json              # Seed cenników Preco
│
├── scripts/                         # Skrypty narzędziowe (43 pliki)
│   ├── backup.ts                    # Backup bazy (VACUUM INTO, max 30 kopii)
│   ├── restore-db.js                # Restore z walidacją (header + integrity_check + WAL cleanup)
│   ├── check-db.js                  # Weryfikacja schematu przy starcie (ensure-db.bat)
│   ├── check-version.mjs            # Spójność wersji (VERSION ↔ package.json ↔ CHANGELOG ↔ *.bat ↔ HTML ?v= ↔ docs)
│   ├── check-appname.cjs            # Nazwa aplikacji (pre-push, APP_NAME SSoT)
│   ├── check-global-collisions.mjs  # Kolizje globali window.*
│   ├── auto-cache-bust.mjs          # Cache-bust ?v= w HTML przy release
│   ├── auto-docs-version.mjs        # Wersje w README/docs przy release
│   ├── auto-bat-version.mjs         # Wersje w *.bat przy release
│   ├── bump-version.mjs             # Podbicie wersji (patch/minor/major)
│   ├── bundle-scripts.mjs           # Bundling JS studnie/rury (esbuild)
│   ├── minify-css.mjs               # Minifikacja CSS (prestart)
│   ├── copy-prisma-client.mjs       # Kopiowanie generated/prisma → dist/generated
│   ├── encoding-integrity.js        # Kodowanie UTF-8 + mojibake (staged/pre-push/CI)
│   ├── skill-cli.mjs                # CLI skilli (build-cost, stats, capabilities)
│   ├── export-settings-to-seed.mjs  # Eksport cenników z tabel DB do data/seed_*.json
│   ├── cleanup-legacy-settings.cjs  # Usunięcie legacy kluczy cennikowych z settings
│   ├── prices-export.ts             # Zapis domyślnych cenników do price_defaults.json (CLI)
│   ├── prices-import.ts             # Restore cenników z price_defaults.json (CLI, walidacja + diff)
│   ├── deploy.mjs / rollback.mjs    # Deploy/rollback produkcji (backup + migracje + smoke check)
│   ├── generate-licenses.mjs        # Generowanie THIRD-PARTY-NOTICES.md
│   ├── benchmark.mjs                # Benchmark
│   └── excel-validator.py           # Walidacja Excel (pre-commit, wymaga Python 3.10+)
│
├── tests/                           # Testy (Jest + Playwright)
│   ├── auth.test.ts
│   ├── offers.crud.test.ts
│   ├── products.test.ts
│   ├── sales/                       # Testy kartoteki (filtry, batch, search)
│   ├── ml/                          # Testy pipeline'u ML
│   ├── studnie/                     # Testy modułu studni (w tym Excel)
│   ├── playwright/                  # Testy Playwright (regresyjne)
│   └── ...
│
├── docs/                            # Dokumentacja
│   ├── ARCHITECTURE.md              # Ten dokument
│   ├── DELETION_LOG.md              # Log usuniętego kodu
│   ├── INSTRUKCJA_SERWER.md
│   └── ...
│
├── .github/workflows/               # CI/CD
│   ├── ci.yml                       # Główny pipeline
│   ├── codeql.yml                   # CodeQL Security
│   └── release.yml                  # Release automation
│
├── Dockerfile                       # Obraz Docker
├── docker-compose.yml               # Docker Compose
└── .env.example                     # Zmienne środowiskowe
```

---

## Deploy

### Docker

```bash
docker compose up --build
```

### VPS

1. Zainstaluj Node.js >= 22.13
2. `npm ci && npm run build`
3. Uruchom `node dist/server.js` (lub przez PM2)

Szczegóły: [DEPLOYMENT.md](DEPLOYMENT.md)

---

_Ostatnia aktualizacja: 2026-08-23_
