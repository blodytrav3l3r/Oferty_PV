# WITROS Oferty PV — Generator Ofert Handlowych

**Wersja:** 1.7.0

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
| Ikonki    | Lucide (slim build, 76 ikon)             |
| Font      | Inter (self-hosted)                      |

## Uruchomienie — nowa instalacja

```bash
npm install
npx prisma generate
npx prisma migrate dev
npm run prisma:seed   # ← pomiń jeśli przenosisz bazę
npm run build
npm start
```

### Uruchomienie — z istniejącą bazą cenników

Jeśli przenosisz bazę z innego urządzenia, zamiast seedowania przywróć backup:

```bash
npm install
npx prisma generate
npx prisma migrate dev
npm run build
# Przywróć bazę z backupu:
npm run backup:restore -- data/backups/backup_*.sqlite
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
| `npm run backup:restore` | Przywróć bazę z backupu             |
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
- ~~Python backend usunięty~~ — logika Konus+ przeniesiona do JS solvera

## Design System — Liquid Glass

- Ciemny motyw: deep space black (`#0a0e1a`) + indygo akcent (`#6366f1`)
- Efekty glassmorphism: `backdrop-filter: blur()`, `rgba` tła
- Kolory semantyczne: success=green, danger=red, warn=amber
- Moduły mają własne akcenty: rury=indigo, studnie=green, kartoteka=amber, zlecenia=pink

## Baza danych

- SQLite przez Prisma ORM
- Schema: `prisma/schema.prisma`
- Baza: `data/app_database.sqlite`
- Modele: users, sessions, settings, offers, offer_items, clients, orders, production_orders, products, audit_logs, ai_telemetry_logs

### Przenoszenie bazy między urządzeniami

1. Na starym urządzeniu: `npm run backup`
2. Skopiuj plik `data/backups/backup_*.sqlite` na nowe urządzenie
3. Na nowym urządzeniu: `npm run backup:restore -- data/backups/backup_*.sqlite`

Baza SQLite to pojedynczy plik — backup i przywracanie to kopiowanie jednego pliku.

## Licencja

Projekt wewnętrzny — WITROS. Szczegóły w [LICENSE](../LICENSE).
