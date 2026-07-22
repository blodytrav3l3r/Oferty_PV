# Architektura — WITROS Oferty PV

**Wersja:** 1.9.0  
**Ostatnia aktualizacja:** 2026-07-22  
**Stack:** Express + Prisma + SQLite + VanillaJS SPA + Vite + ML Pipeline

---

## Przegląd architektury

Aplikacja WITROS Oferty PV to pojedyncza aplikacja webowa (monolit) złożona z:

- **Backend API** — Express.js (TypeScript) obsługujący logikę biznesową i dane
- **Frontend SPA** — Vanilla JavaScript z osobnymi widokami HTML (bez frameworka)
- **Baza danych** — SQLite przez Prisma ORM
- **Serwer deweloperski** — Vite dla frontendu (tylko w dev)

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

| Technologia | Wersja | Rola                            |
| ----------- | ------ | ------------------------------- |
| Node.js     | >= 20  | Środowisko uruchomieniowe       |
| TypeScript  | ~6.0   | Język programowania             |
| Express.js  | ~4.21  | Framework webowy                |
| Prisma      | ~6.0   | ORM (Object-Relational Mapping) |
| Zod         | ~4.3   | Walidacja danych wejściowych    |
| bcryptjs    | ~3.0   | Haszowanie haseł                |
| Helmet      | ~8.1   | Nagłówki bezpieczeństwa HTTP    |
| Sentry      | ~10.59 | Monitoring błędów               |
| docx        | ~9.6   | Generowanie dokumentów DOCX     |
| Puppeteer   | ~24.40 | Generowanie PDF                 |
| ts-node-dev | ~2.0   | Hot-reload w dev                |
| Jest        | ~30.0  | Framework testowy               |
| Swagger     | 6.x    | Dokumentacja API                |

### Warstwy

1. **Middleware** (`src/middleware/`)
    - `auth.ts` — autoryzacja (session token, HttpOnly cookie, rola admin/user)
    - `security.ts` — nagłówki bezpieczeństwa, HTTPS redirect
    - `rateLimiter.ts` / `rateLimiters.ts` — limitowanie żądań per IP (in-memory)
    - `errorHandler.ts` — globalna obsługa błędów
    - `requestLogger.ts` — logowanie żądań HTTP

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
    - `pvMarketplace.ts` — integracja PV Marketplace
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
    - `cronService.ts` — serwis cron (setInterval)
    - `fts5Sync.ts` — synchronizacja FTS5 dla wyszukiwarki
    - `logger.ts` — logger aplikacji
    - `ownership.ts` — weryfikacja własności zasobów
    - `productionSearchUtils.ts` — narzędzia wyszukiwania produkcji
    - `roleFilter.ts` — filtrowanie po roli użytkownika
    - `searchCache.ts` — cache wyszukiwania
    - `searchUtils.ts` — narzędzia wyszukiwania

### Konfiguracja

| Plik                     | Opis                                                              |
| ------------------------ | ----------------------------------------------------------------- |
| `server.ts`              | Główny plik aplikacji — inicjalizacja Express, middleware, routes |
| `tsconfig.json`          | Konfiguracja TypeScript dla backendu                              |
| `tsconfig.frontend.json` | Konfiguracja TypeScript dla frontendu                             |
| `vite.config.js`         | Konfiguracja Vite                                                 |
| `jest.config.ts`         | Konfiguracja Jest                                                 |

---

## Frontend — szczegóły

### Stack

| Technologia             | Rola                               |
| ----------------------- | ---------------------------------- |
| Vanilla JavaScript      | Logika frontendu (brak frameworka) |
| HTML                    | Widoki (6 plików .html)            |
| CSS                     | Style (w public/css/)              |
| IndexedDB (opcjonalnie) | Pamięć lokalna dla trybu offline   |
| Vite (dev only)         | Serwer deweloperski, HMR           |

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

| Katalog              | Liczba plików | Opis                                                                    |
| -------------------- | ------------- | ----------------------------------------------------------------------- |
| `public/js/rury/`    | 30            | Logika modułu rur (oferty, cenniki, zamówienia)                         |
| `public/js/studnie/` | 90            | Logika modułu studni (konfigurator, oferty, cenniki, excel, zamówienia) |
| `public/js/sales/`   | 9             | Narzędzia sprzedaży (kartoteka, import/eksport)                         |

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

| Plik                              | Linie | Opis                                                |
| --------------------------------- | ----- | --------------------------------------------------- |
| `public/css/style.css`            | 3762  | Główny arkusz stylów                                |
| `public/css/style.base.css`       | 1525  | Zmienne + base (wyodrębnione, niepodłączone)        |
| `public/css/style.cards.css`      | 537   | Karty ofert + compact (wyodrębnione, niepodłączone) |
| `public/css/style.responsive.css` | 1509  | Responsive + wizard (wyodrębnione, niepodłączone)   |
| `public/css/style.utilities.css`  | 191   | Utility classes (wyodrębnione, niepodłączone)       |
| `public/css/inter.css`            | —     | Font Inter                                          |
| `public/css/printModal.css`       | —     | Style wydruku                                       |

> Wszystkie 6 plików HTML (`app.html`, `index.html`, `rury.html`, `studnie.html`, `kartoteka.html`, `zlecenia.html`) ładują 4 części zamiast jednego `style.css`. Plik `style.css` (3762 linie) jest zachowany, ale nie jest już ładowany.

---

## Baza danych

### Provider: SQLite

- Lokalna baza plikowa (`data/app_database.sqlite`)
- Backup przez `VACUUM INTO` (WAL-safe snapshot)
- Prisma ORM zarządza schematem i migracjami

### Modele (28)

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
- **AiEvaluation** — dzienne metryki ewaluacji ML
- **aiRewardLog** — logi nagród ML

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
├── vite.config.js                   # Vite config
├── jest.config.ts                   # Jest config
├── commitlint.config.js             # Conventional commits
│
├── src/                             # Backend
│   ├── app.ts                      # Konfiguracja Express
│   ├── server.ts                   # Główny plik startowy
│   ├── prismaClient.ts             # Klient Prisma (singleton)
│   ├── logger.ts                   # Logger
│   ├── session.ts                  # Zarządzanie sesjami
│   ├── middleware/
│   │   ├── auth.ts                 # Autoryzacja + sesje
│   │   ├── security.ts             # Nagłówki bezpieczeństwa
│   │   ├── rateLimiter.ts          # Rate limiting
│   │   ├── rateLimiters.ts         # Konfiguracja limiterów
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
│   │   ├── telemetry.ts            # Telemetria AI
│   │   ├── telemetryAi.ts          # Endpointy AI
│   │   ├── telemetryAiMl.ts        # Pipeline ML
│   │   ├── telemetryAiDashboard.ts # Dashboard AI
│   │   ├── featureFlags.ts         # Feature flags
│   │   ├── precoPricingV2.ts       # Cenniki Preco
│   │   └── pvMarketplace.ts        # PV Marketplace
│   ├── services/
│   │   ├── auditService.ts         # Usługa audytu
│   │   ├── pdfGenerator.ts         # Generowanie PDF
│   │   ├── docx/                   # Generowanie DOCX
│   │   ├── pdf/                    # Karty budowy PDF
│   │   ├── telemetry/              # Telemetria AI
│   │   └── ml/                     # Pipeline ML
│   ├── utils/
│   │   ├── cronService.ts          # Serwis cron
│   │   ├── fts5Sync.ts             # Synchronizacja FTS5
│   │   ├── logger.ts               # Logger
│   │   ├── ownership.ts            # Weryfikacja własności
│   │   ├── productionSearchUtils.ts# Narzędzia wyszukiwania
│   │   ├── roleFilter.ts           # Filtr roli
│   │   ├── searchCache.ts          # Cache wyszukiwania
│   │   └── searchUtils.ts          # Narzędzia wyszukiwania
│   ├── validators/
│   │   ├── authSchema.ts           # Walidacja auth
│   │   ├── offerSchemas.ts         # Walidacja ofert
│   │   ├── orderSchemas.ts         # Walidacja zamówień
│   │   ├── productSchemas.ts       # Walidacja produktów
│   │   └── telemetrySchemas.ts     # Walidacja telemetrii
│   └── types/                      # Typy TypeScript
│
├── public/                          # Frontend
│   ├── index.html                   # Dashboard
│   ├── app.html                     # Główna aplikacja
│   ├── rury.html                    # Oferty rur
│   ├── studnie.html                 # Oferty studni
│   ├── kartoteka.html               # Kartoteka klientów
│   ├── zlecenia.html                # Zamówienia
│   ├── favicon.ico                  # Ikona
│   ├── js/                          # Skrypty JS
│   ├── css/                         # Style CSS
│   ├── images/                      # Obrazy
│   └── templates/                   # Szablony
│
├── prisma/                          # Prisma
│   ├── schema.prisma                # Definicja schematu
│   ├── seed.ts                      # Seed danych
│   └── migrations/                  # Migracje
│
├── data/                            # Baza danych
│   ├── app_database.sqlite          # Główna baza
│   ├── backups/                     # Kopie zapasowe
│   ├── seed_rury.json               # Seed produktów (rury)
│   ├── seed_studnie.json            # Seed produktów (studnie)
│   └── seed_preco.json              # Seed cenników Preco
│
├── scripts/                         # Skrypty narzędziowe
│   ├── backup.ts                    # Backup bazy (VACUUM INTO)
│   ├── backup-db.js                 # Backup bazy (alternatywny)
│   ├── restore-db.js                # Restore bazy z backupu
│   ├── checkDb.ts                   # Sprawdzenie bazy
│   ├── check-db.js                  # Sprawdzenie bazy (JS)
│   ├── cleanup.ts                   # Czyszczenie
│   ├── createDocxTemplate.ts        # Szablon DOCX
│   ├── downloadFonts.js             # Pobieranie fontów
│   ├── extract.js                   # Ekstrakcja danych
│   ├── migrateEmojis.js             # Migracja emoji
│   ├── migrate-to-tables.ts         # Migracja do tabel
│   ├── screenshot.js                # Zrzut ekranu
│   ├── docker-entrypoint.sh         # Entrypoint Docker
│   ├── install-backup-cron.ps1      # Cron backup (Windows)
│   ├── auto-bump.mjs                # Auto-bump wersji
│   ├── bump-version.mjs             # Podbicie wersji
│   ├── check-version.mjs            # Sprawdzenie wersji
│   ├── normalize-seed-studnie.mjs   # Normalizacja seed studni
│   ├── skill-cli.mjs                # CLI dla skilli
│   ├── version-updater.mjs          # Aktualizator wersji
│   ├── wait-and-start.mjs           # Opóźniony start
│   ├── fix-css-encoding.js          # Naprawa kodowania CSS
│   ├── encoding-integrity.js        # Spójność kodowania
│   └── excel-validator.py           # Walidacja Excel
│
├── tests/                           # Testy (32 pliki)
│   ├── auth.test.ts
│   ├── offers.crud.test.ts
│   ├── products.test.ts
│   ├── pricelistService.test.ts
│   └── ...
│
├── docs/                            # Dokumentacja
│   ├── CHANGELOG.md
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

1. Zainstaluj Node.js >= 20
2. `npm install && npm run build`
3. Uruchom `node dist/server.js` (lub przez PM2)

Szczegóły: [DEPLOYMENT.md](DEPLOYMENT.md)

---

_Ostatnia aktualizacja: 2026-07-16_
