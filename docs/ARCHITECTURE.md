# Architektura — WITROS Oferty PV

**Wersja:** 1.8.0  
**Ostatnia aktualizacja:** 2026-07-20  
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
    - `offers/` — oferty: rury (`ruryCrud.ts`), studnie (`studnieCrud.ts`), dispatcher (`crud.ts`), eksport (`exports.ts`)
    - `orders/` — zamówienia, numeracja, produkcja
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
    - `pricelistService.ts` — zarządzanie cennikami
    - `pdfGenerator.ts` — generowanie PDF (Puppeteer)
    - `docx/` — generowanie dokumentów DOCX (rury i studnie)
        - `rury/` — builder, content, sections, tables, kartaBudowy
        - `studnie/` — builder, content, sections, tables, kartaBudowy
        - `helpers.ts`, `headerFooter.ts`, `constants.ts`, `colors.ts`, `index.ts`
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
    - `telemetrySchemas.ts` — schematy dla telemetrii AI

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

Po refaktoryzacji Phase 2 (podział dużych plików JS na mniejsze moduły):

| Katalog              | Liczba plików | Opis                                                                    |
| -------------------- | ------------- | ----------------------------------------------------------------------- |
| `public/js/rury/`    | 30            | Logika modułu rur (oferty, cenniki, zamówienia)                         |
| `public/js/studnie/` | ~112          | Logika modułu studni (konfigurator, oferty, cenniki, excel, zamówienia) |
| `public/js/sales/`   | 4             | Narzędzia sprzedaży (PVSalesUI, import/eksport)                         |

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

### Modele (17)

- **users** — użytkownicy systemu
- **sessions** — sesje logowania (token-based)
- **clients_rel** — baza klientów
- **productsRury** — produkty typu rura
- **productsStudnie** — produkty typu studnia
- **categoriesRury** / **categoriesStudnie** — kategorie produktów
- **offers_rel** — oferty rur
- **offers_studnie_rel** — oferty studni
- **orders_rury_rel** — zamówienia rur
- **orders_studnie_rel** — zamówienia studni
- **offer_items_rel** / **offer_studnie_items_rel** — pozycje ofert
- **audit_logs** — logi audytowe
- **settings** — ustawienia (klucz-wartość)
- **order_counters** / **order_counters_rury** — liczniki numeracji
- **production_orders_rel** / **production_order_counters** / **recycled_production_numbers** — produkcja
- **ai_telemetry_logs** — telemetria AI

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
│   ├── db.ts                        # Połączenie z bazą (legacy)
│   ├── prismaClient.ts              # Klient Prisma (singleton)
│   ├── helpers.ts                   # Funkcje pomocnicze
│   ├── swagger.ts                   # Konfiguracja Swagger
│   ├── middleware/
│   │   ├── auth.ts                  # Autoryzacja + sesje
│   │   ├── security.ts              # Nagłówki bezpieczeństwa
│   │   └── rateLimiter.ts           # Rate limiting
│   ├── routes/
│   │   ├── auth.ts                  # Endpointy auth
│   │   ├── users.ts                 # Zarządzanie użytkownikami
│   │   ├── productsV2.ts           # Produkty rury
│   │   ├── productsStudnieV2.ts    # Produkty studnie
│   │   ├── clients.ts              # Klienci
│   │   ├── offers/
│   │   │   ├── index.ts            # Router główny ofert
│   │   │   ├── crud.ts             # CRUD (dispatcher)
│   │   │   ├── ruryCrud.ts         # Oferty rur
│   │   │   ├── studnieCrud.ts      # Oferty studni
│   │   │   └── exports.ts          # Eksport PDF/DOCX
│   │   ├── orders/
│   │   │   ├── index.ts            # Router główny zamówień
│   │   │   ├── ruryOrders.ts       # Zamówienia rur
│   │   │   ├── studnieOrders.ts    # Zamówienia studni
│   │   │   ├── numbering.ts        # Numeracja zamówień
│   │   │   └── production.ts       # Zamówienia produkcyjne
│   │   ├── audit.ts                # Logi audytowe
│   │   ├── settings.ts             # Ustawienia
│   │   ├── telemetry.ts            # Telemetria AI
│   │   ├── precoPricingV2.ts       # Cenniki Preco
│   │   └── pvMarketplace.ts        # PV Marketplace
│   ├── services/
│   │   ├── auditService.ts         # Usługa audytu
│   │   └── pricelistService.ts     # Usługa cenników
│   ├── utils/
│   │   └── logger.ts               # Logger
│   ├── validators/
│   │   ├── authSchema.ts           # Walidacja auth
│   │   └── offerSchemas.ts         # Walidacja ofert
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
├── render.yaml                      # Render deploy
└── .env.example                     # Zmienne środowiskowe
```

---

## Deploy

### Docker

```bash
docker compose up --build
```

### Render.com

Blueprint z `render.yaml` — Persistent Disk dla SQLite.

### VPS

1. Zainstaluj Node.js >= 20
2. `npm install && npm run build`
3. Uruchom `node dist/server.js` (lub przez PM2)

Szczegóły: [DEPLOYMENT.md](DEPLOYMENT.md)

---

_Ostatnia aktualizacja: 2026-07-16_
