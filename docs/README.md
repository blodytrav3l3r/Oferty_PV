# WITROS Oferty PV — Generator Ofert Handlowych

Aplikacja webowa do generowania ofert handlowych dla firmy WITROS (instalacje PV, studnie, rury). Backend API + frontend SPA w iframe'ach.

## Tech Stack

| Warstwa   | Technologia                             |
| --------- | --------------------------------------- |
| Backend   | TypeScript, Express.js, Prisma (SQLite) |
| Frontend  | Vanilla JS (ES6), HTML5, CSS3           |
| Walidacja | Zod                                     |
| PDF       | Puppeteer                               |
| MS Word   | docxtemplater / docx                    |
| Testy     | Jest + ts-jest + supertest              |
| Python    | FastAPI, OR-Tools CP-SAT, SQLAlchemy    |
| Ikonki    | Lucide (slim build, 76 ikon)            |
| Font      | Inter (self-hosted)                     |

## Uruchomienie

```bash
npm install
npx prisma generate
npm run dev             # Dev server (hot reload)
```

### Windows (batch)

```bash
start_all.bat           # Node.js + Python AI Backend
```

## Skrypty NPM

| Komenda                  | Opis                                 |
| ------------------------ | ------------------------------------ |
| `npm run dev`            | Dev server (ts-node-dev, hot reload) |
| `npm run build`          | Kompilacja TypeScript                |
| `npm test`               | Testy z coverage                     |
| `npm run lint`           | ESLint                               |
| `npm run format`         | Prettier format                      |
| `npm run prisma:studio`  | Prisma Studio (GUI bazy)             |
| `npm run prisma:migrate` | Migracje bazy danych                 |
| `npm run graphify:watch` | Graphify watch (graf wiedzy)         |
| `npm start`              | Serwer produkcyjny                   |
| `npm run backup`         | Backup bazy danych                   |

## Architektura

- **iframe-based SPA** — `public/app.html` ładuje moduły jako iframe'y poprzez hash router (`public/js/spa/router.js`)
- Moduły: `studnie` (well configurator), `rury` (pipe offers), `kartoteka` (archive), `zlecenia` (production orders)
- Routing przez `window.location.hash` (#/rury, #/studnie, #/kartoteka)
- Stan zarządzany przez singleton `AppState` (moduł rury) i globalne zmienne (moduł studnie)
- Osobny Python backend: `well_configurator_backend/` (FastAPI + OR-Tools)

## Struktura katalogów

```
├── server.ts                  # Entry point Express
├── src/                       # Backend TypeScript
│   ├── routes/                # Express routes
│   │   ├── auth.ts            # Logowanie, sesje
│   │   ├── clients.ts         # Klienci
│   │   ├── offers/            # CRUD ofert (rury + studnie)
│   │   ├── orders/            # Zamówienia, zlecenia
│   │   ├── audit.ts           # Logi audytowe
│   │   ├── products*.ts       # Produkty (rury, studnie)
│   │   ├── pvMarketplace.ts  # Rynek PV
│   │   ├── settings.ts        # Ustawienia systemu
│   │   └── telemetry.ts       # Telemetria AI
│   ├── services/              # Logika biznesowa
│   │   ├── pdfGenerator.ts    # Generowanie PDF (Puppeteer)
│   │   ├── docx/              # Generowanie MS Word
│   │   └── auditService.ts    # Service audytu
│   ├── middleware/             # Auth, security
│   ├── validators/            # Zod schemas
│   └── types/                 # TypeScript types
├── public/                    # Frontend (static)
│   ├── *.html                 # Pages (app shell, modules)
│   ├── css/
│   │   ├── style.css          # Główny plik ~2160 linii
│   │   ├── studnie.css        # Moduł studnie ~1440 linii
│   │   ├── index.css          # Landing page
│   │   ├── spa.css            # SPA transitions
│   │   └── zlecenia.css       # Zlecenia
│   ├── js/
│   │   ├── shared/            # auth, ui, icons, clientManager, dashboard
│   │   ├── studnie/           # ~20 plików (wellManager, solver, ruleEngine, itp.)
│   │   ├── rury/              # offerExports
│   │   ├── sales/             # PV marketplace, kartoteka
│   │   └── spa/               # Router
│   ├── images/                # Assets (letterhead, logo, ikony)
│   ├── templates/             # Szablony do druku
│   └── data/                  # JSON z produktami
├── prisma/                    # Prisma schema + migracje
├── tests/                     # Jest testy (~15 plików)
│   ├── studnie/               # Testy modułu studnie
│   ├── offers.crud.test.ts
│   ├── apiValidation.test.ts
│   └── ...
├── well_configurator_backend/ # Python AI Backend
│   ├── api/                   # FastAPI endpoints
│   ├── optimizer/             # OR-Tools CP-SAT
│   ├── rule_engine/           # Reguły biznesowe
│   ├── ml/                    # ML ranking
│   ├── validator/             # Walidacja konfiguracji
│   └── tests/                 # Pytest
├── vendor/                    # Offline dependencies
│   ├── node_modules.tar.gz    # Node.js (gitignored, duży)
│   └── python_wheels/         # Python wheels (gitignored)
├── scripts/                   # Narzędzia (archiwum)
├── .kilo/                     # Konfiguracja Kilo agenta
└── ECC/                       # ECC plugin (submodule)
```

## Testowanie

Framework: Jest + supertest. Testy w katalogu `tests/`.

```bash
npm test                       # Wszystkie testy
npm run test:watch             # Watch mode
```

## Design System — Liquid Glass

- Ciemny motyw: deep space black (`#0a0e1a`) + indygo akcent (`#6366f1`)
- Efekty glassmorphism: `backdrop-filter: blur()`, `rgba` tła
- Kolory semantyczne: success=green, danger=red, warn=amber
- Moduły mają własne akcenty: rury=indigo, studnie=green, kartoteka=amber, zlecenia=pink

## Python AI Backend

`well_configurator_backend/` — osobny serwis Python:

- Konfiguracja studni z optymalizacją OR-Tools CP-SAT
- Reguły biznesowe: formy standardowe, redukcje, zapasy
- ML ranking (LightGBM scaffold)
- API: FastAPI na porcie 8000

```bash
cd well_configurator_backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python run.py
```

## Baza danych

- SQLite przez Prisma ORM
- Schema: `prisma/schema.prisma`
- Baza: `data/app_database.sqlite`

Główne modele: users, sessions, settings, offers, offer_items, clients, orders, production_orders, products, audit_logs, ai_telemetry_logs.

## Dostępne narzędzia

- **ECC** — 60 agentów, 232 skille, 75+ komend
- **Graphify** — graf wiedzy o kodzie (`graphify-out/`)
- **Playwright** — testy E2E (jeśli skonfigurowane)

## Licencja

Projekt wewnętrzny — WITROS.
