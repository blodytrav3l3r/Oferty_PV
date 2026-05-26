# WITROS Oferty PV — Instrukcje dla agenta

## O Projekcie

Aplikacja webowa do generowania ofert handlowych dla firmy WITROS (instalacje PV, studnie, rury). Backend API + frontend SPA w iframe'ach. Polski język UI.

## Tech Stack

| Warstwa | Technologia |
|---------|-------------|
| Backend | TypeScript, Express.js, Prisma (SQLite) |
| Frontend | Vanilla JS (ES6), HTML5, CSS3 |
| Walidacja | Zod |
| PDF | Puppeteer |
| MS Word | docxtemplater / docx |
| Testy | Jest + ts-jest + supertest |
| Ikonki | Lucide (slim build, 76 ikon) |
| Font | Inter (self-hosted) |

## Architektura

- **iframe-based SPA** — `public/app.html` ładuje moduły jako iframe'y poprzez hash router (`public/js/spa/router.js`)
- Moduły: `studnie` (well configurator), `rury` (pipe offers), `kartoteka` (archive), `zlecenia` (production orders)
- Każda podstrona (`studnie.html`, `rury.html`, itd.) może działać samodzielnie
- Routing przez `window.location.hash` (#/rury, #/studnie, #/kartoteka)
- Stan zarządzany przez singleton `AppState` (moduł rury) i globalne zmienne (moduł studnie)

## Design System — Liquid Glass

- **CSS Custom Properties** w `:root` (`public/css/style.css` linie 3-24)
- Ciemny motyw z deep space black (`#0a0e1a`) i indygo akcentem (`#6366f1`)
- Kolory semantyczne: success=green, danger=red, warn=amber
- Moduły mają własne akcenty: rury=indigo, studnie=green, kartoteka=amber, zlecenia=pink
- Efekty glassmorphism: `backdrop-filter: blur()`, `rgba` tła, subtelne border-y

## Struktura katalogów

```
├── server.ts              # Entry point
├── src/                   # Backend TypeScript
│   ├── routes/            # Express routes
│   ├── services/          # Business logic, PDF generation
│   ├── middleware/        # Auth, security
│   ├── validators/        # Zod schemas
│   └── types/             # TypeScript types
├── public/                # Frontend (static)
│   ├── *.html             # Pages (app shell, modules)
│   ├── css/               # Stylesheets
│   │   ├── style.css      # Główny plik (~2160 linii)
│   │   ├── studnie.css    # Moduł studnie (~1440 linii)
│   │   ├── index.css      # Landing page (~760 linii)
│   │   └── spa.css        # SPA transitions
│   └── js/                # JavaScript
│       ├── shared/        # Wspólne (auth, ui, icons, appState, storage)
│       ├── studnie/       # Moduł studnie (~15 plików)
│       ├── rury/          # Moduł rury (~6 plików)
│       └── spa/           # Router
├── prisma/                # Prisma schema + migrations
├── tests/                 # Jest tests
├── templates/             # HTML templates for print
├── scripts/               # Utility scripts
├── graphify-out/          # Graphify knowledge graph
└── ECC/                   # ECC plugin (agents, skills, commands)
```

## Konwencje kodowania

### CSS
- **Używaj zmiennych CSS** (`var(--xxx)`) zamiast hardcodowanych hex/rgba
- Główne zmienne kolorów: `--bg-primary`, `--bg-secondary`, `--bg-card`, `--bg-glass`, `--border-glass`, `--text-primary`, `--text-secondary`, `--text-muted`, `--accent`, `--accent-hover`, `--success`, `--danger`, `--warn`
- Klasy stanu: `.active`, `.hidden`, `.visible`, `.disabled`
- Sekcje CSS oddzielaj komentarzami: `/* ── Nazwa ── */`
- Nie używaj !important jeśli można tego uniknąć
- Nie twórz nowych klas BEM — używaj istniejącej konwencji płaskiego nazewnictwa

### JavaScript
- **Nie używaj inline styli z hex/rgba** — zamiast tego dodawaj/usuwaj klasy CSS
- Używaj `classList.add`/`classList.remove` zamiast `element.style.color = '...'`
- Wzorzec modułu: IIFE (`(function() { ... })()`) lub zwykły skrypt globalny
- async/await dla operacji asynchronicznych
- Template literals dla dynamicznego HTML
- Zdarzenia na dokument (delegacja) zamiast na pojedynczych elementach

### TypeScript (backend)
- Strict mode, noUnusedLocals, noUnusedParameters
- Zod do walidacji wejść
- async/await we wszystkich handlerach
- try-catch w każdym async handlerze
- Konwencja nazw: camelCase dla zmiennych/funkcji, PascalCase dla klas/type'ów

## Nazewnictwo plików i folderów

| Typ | Konwencja | Przykład |
|-----|-----------|----------|
| JS/TS pliki | `camelCase` | `wellManager.ts`, `pvMarketplace.ts` |
| CSS pliki | `lowercase` | `style.css`, `studnie.css` |
| HTML pliki | `lowercase` | `index.html`, `kartaBudowy.html` |
| Katalogi | `lowercase` | `src/routes/`, `public/js/sales/` |
| Testy | `*.test.ts`, nazwa bazowa camelCase | `pvMarketplace.test.ts` |
| Python | `snake_case` (PEP8) | `rule_engine/` |

- Te same reguły dotyczą plików w katalogach `public/`, `src/`, `tests/`, `scripts/`
- Nie używaj myślników, kropek (poza `.test.ts`) ani podkreśleń w nazwach JS/TS/HTML/CSS
- Nazwy w języku angielskim, z wyjątkiem dziedzinowych pojęć branżowych (studnie, rury, zlecenia)

## Uruchamianie

| Komenda | Opis |
|---------|------|
| `npm run dev` | Dev server (ts-node-dev, hot reload) |
| `npm run build` | Kompilacja TypeScript |
| `npm test` | Testy z coverage |
| `npm run lint` | ESLint |
| `npm run format` | Prettier format |
| `npm run prisma:studio` | Prisma Studio (GUI bazy) |
| `npm run prisma:migrate` | Migracje bazy danych |
| `npm run graphify:watch` | Graphify watch (graf wiedzy) |
| `start_all.bat` | Uruchomienie wszystkich serwisów (Windows) |

## Testowanie

- Framework: Jest + supertest
- Testy w katalogu `tests/`
- Coverage wymagany: brak oficjalnego progu, ale staraj się utrzymywać

## Git Workflow

### Konwencje commitów
- `fix:` — bug fix (np. `fix: poprawa walidacji dat w ofertach studni`)
- `feat:` — nowa funkcjonalność (np. `feat: dodanie karty budowy do wydruku`)
- `chore:` — narzędzia, config, refactor (np. `chore: aktualizacja .gitignore`)
- `docs:` — zmiany w dokumentacji
- `test:` — nowe testy lub poprawa istniejących
- `style:` — formatowanie, brak zmian w logice
- Komentarze pisane po polsku
- Długość: max 72 znaków w tytule, opis w commit body jeśli potrzeba

### Gałęzie
- `main` — stabilna, produkcyjna
- Nazwy gałęzi: `kebab-case` (np. `fix-date-validation`, `add-karta-budowy`)
- PR do `main` po zakończeniu pracy nad gałęzią

### .gitignore — czego NIE wysyłać na GitHub
- `node_modules/`, `.kilo/worktrees/`, `vendor/node_modules.tar.gz`, `vendor/python_wheels/`
- `well_configurator_backend/venv/`, `__pycache__/`, `*.pyc`
- `graphify-out/` — auto-generowany cache (odtwarzany z kodu)
- `ECC/` — embedded repo (tylko gitlink, nie zawartość)
- `*.db`, `*.sqlite`, `.env`, `dist/`, `build/`, `coverage/`

### Przed pushem
- Uruchom `npm test` i `npm run lint`
- Upewnij się, że `graphify-out/` nie jest przypadkowo stage'owane (gitignorowane)
- Nie pushuj dużych plików binarnych (>50 MB) — GitHub odrzuci >100 MB

## Baza danych

- SQLite przez Prisma ORM
- Schema: `prisma/schema.prisma`
- Baza: `data/app_database.sqlite (SQLite, ok. 10 MB)` (odczyt/zapis)
- Migracje: `prisma/migrations/`

## Bieżące zadania do optymalizacji

1. CSS: wyciągnąć powtarzalne hardcodowane kolory (`#1e1e4a`, `#1e2530`, `#0d1520` itp.) do zmiennych CSS
2. CSS: usunąć duplikacje (scrollbary, keyframes, reset)
3. JS: zastąpić inline style (`element.style.color = '#...'`) klasami CSS
4. JS: zredukować ~557 hex + 446 rgba w plikach JS

## Dostępne narzędzia

- **ECC** (`ECC/`) — 60 agentów (planner, code-reviewer, typescript-reviewer, itp.), 232 skille, 75+ komend
- **Graphify** (`graphify-out/`) — graf wiedzy o kodzie, używaj `graphify query "..."` przed grepem
- **Playwright** — testy E2E (jeśli skonfigurowane)
