# WITROS Oferty PV — Generator Ofert Handlowych

**Wersja:** 1.5.0

Aplikacja webowa do generowania ofert handlowych dla firmy WITROS (instalacje PV, studnie, rury). Backend API + frontend SPA w iframe'ach + zintegrowany pipeline ML.

## Tech Stack

| Warstwa   | Technologia                              |
| --------- | ---------------------------------------- |
| Backend   | TypeScript, Express.js, Prisma (SQLite)  |
| Frontend  | Vanilla JS (ES6), HTML5, CSS3            |
| Walidacja | Zod                                      |
| PDF       | Puppeteer                                |
| MS Word   | docxtemplater / docx                     |
| AI/ML     | Logistic Regression (TypeScript, własny) |
| Testy     | Jest + ts-jest + supertest               |
| Python    | FastAPI, OR-Tools CP-SAT, SQLAlchemy     |
| Ikonki    | Lucide (slim build, 76 ikon)             |
| Font      | Inter (self-hosted)                      |

## Uruchomienie

```bash
npm install
npx prisma generate
npx prisma migrate dev
npm run prisma:seed
npm run build
npm start
```

### Windows (batch)

| Skrypt        | Opis                             |
| ------------- | -------------------------------- |
| `start.bat`   | Serwer produkcyjny               |
| `dev.bat`     | Serwer deweloperski (hot-reload) |
| `install.bat` | Instalacja + przygotowanie bazy  |
| `build.bat`   | Budowa projektu                  |

## Skrypty NPM

| Komenda                  | Opis                                |
| ------------------------ | ----------------------------------- |
| `npm run dev`            | Dev server (backend + frontend)     |
| `npm run build`          | Kompilacja TypeScript               |
| `npm test`               | Testy (Jest)                        |
| `npm run test:quick`     | Testy dymne                         |
| `npm run typecheck`      | Sprawdź typy                        |
| `npm run lint`           | ESLint                              |
| `npm run format`         | Prettier format                     |
| `npm run prisma:studio`  | Prisma Studio (GUI bazy)            |
| `npm run prisma:migrate` | Migracje bazy danych                |
| `npm run validate`       | typecheck + lint + testy            |
| `npm start`              | Serwer produkcyjny                  |
| `npm run backup`         | Backup bazy danych                  |
| `npm run release`        | Utwórz release (wersja + changelog) |

## ML Pipeline (TypeScript)

Własna implementacja Logistic Regression w TypeScript:

- **Dual-ranking:** `Final = 0.6 × Technical + 0.4 × AI × 100` + 5% exploration
- **Trenowanie:** Cron co 15 minut
- **Samoocena:** Cron co 24h (ROC-AUC), auto-rollback gdy < 0.65
- **Forgetting:** Exponential decay λ=0.01
- **Pliki:** `src/services/ml/` (7 modułów)

## Architektura

- **iframe-based SPA** — `public/app.html` ładuje moduły jako iframe'y przez hash router
- Moduły: `studnie` (konfigurator studni), `rury` (oferty rur), `kartoteka` (archiwum), `zlecenia` (zamówienia produkcyjne)
- Routing: `window.location.hash` (#/rury, #/studnie, #/kartoteka)
- Osobny Python backend: `well_configurator_backend/` (FastAPI + OR-Tools)

## Design System — Liquid Glass

- Ciemny motyw: deep space black (`#0a0e1a`) + indygo akcent (`#6366f1`)
- Efekty glassmorphism: `backdrop-filter: blur()`, `rgba` tła
- Kolory semantyczne: success=green, danger=red, warn=amber
- Moduły mają własne akcenty: rury=indigo, studnie=green, kartoteka=amber, zlecenia=pink

## Python AI Backend

`well_configurator_backend/` — osobny serwis Python (port 8000):

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
- Modele: users, sessions, settings, offers, offer_items, clients, orders, production_orders, products, audit_logs, ai_telemetry_logs

## Licencja

Projekt wewnętrzny — WITROS. Szczegóły w [LICENSE](../LICENSE).
