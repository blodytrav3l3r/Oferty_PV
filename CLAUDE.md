# WITROS Oferty PV — Konwencje projektowe

Model-agnostyczne reguły dla AI (opencode, Claude Code, Cursor, Windsurf, Cline, Roo Code).

---

## Stack

- **Backend**: TypeScript + Express + Prisma + SQLite; `server.ts`, `src/`, `scripts/`, `tests/`
- **Frontend**: Vanilla JS (bez frameworka), Vite dev server (`build:frontend`); moduły w `public/js/rury/` i `public/js/studnie/`
- **SPA**: `app.html` jako jedyne entry point; moduły (`studnie.html`, `rury.html`) jako iframe w `app.html`
- **Python**: `well_configurator_backend/` — osobny serwis (OR-Tools solver), NIE dotykaj z Node.js
- **Build**: TypeScript tylko `src/**`, `server.ts`, `scripts/**`, `tests/**` — `public/` wykluczone z tsc/eslint

## Architektura (ADR)

Kluczowe decyzje — szczegóły w `docs/adr/`:

| ADR     | Decyzja                         | Plik                                 |
| ------- | ------------------------------- | ------------------------------------ |
| ADR-001 | SQLite jako baza produkcyjna    | `docs/adr/ADR-001-sqlite.md`         |
| ADR-002 | Vanilla JS SPA (bez frameworka) | `docs/adr/ADR-002-vanilla-js.md`     |
| ADR-003 | Vite jako bundler frontendu     | `docs/adr/ADR-003-vite.md`           |
| ADR-004 | Express + Prisma backend        | `docs/adr/ADR-004-express-prisma.md` |
| ADR-005 | Graphify do inteligencji kodu   | `docs/adr/ADR-005-graphify.md`       |

---

## Core Conventions

### 1. Język

- Komentarze, dokumentacja, commity, CHANGELOG: **polski**
- Identyfikatory (`function fooBar`, `const MY_VAR`), klucze API: **angielski**

### 2. Wersja (SSoT)

- **`VERSION`** (root) — JEDYNE źródło prawdy
- `package.json` — mirror (musi być zgodny)
- `CHANGELOG.md` — historia, format Keep a Changelog
- Auto-bump z commita: `fix:` → patch, `feat:` → minor, `BREAKING:` → major
- Po bumpie zrestartuj backend (`npx ts-node-dev ./server.ts`)
- NIE taguj git-a ręcznie — robi to release flow

### 3. SPA — jedyne entry point

- `app.html` = entry point routera SPA
- Moduły to iframe wewnątrz `app.html`; router ukrywa `.header` iframe'a
- Bezpośredni URL modułu → redirect do `app.html#/<module>` (skrypt w każdym HTML)
- `<footer>` w modułach — usunięty. Wersja żyje w toolbarze `app.html`
- Po zmianach w SPA: sprawdź `router.js` + `spa.css`

### 4. Conventional Commits

- Typy: `feat|fix|refactor|chore|docs|perf|test|style`
- Scope: z `commitlint.config.js` (rury, studnie, offers, api, ui, auth, release, ...)
- Title: małą literą, max 72 znaki
- Body: wyjaśnienie co/dlaczego po polsku

### 5. Cache-busting

- CSS/JS linki z `?v=N` — bump przy zmianie pliku
- Express: `Cache-Control: no-store` dla HTML
- Browser: `Ctrl+Shift+R` po dużej zmianie CSS/JS

### 6. Code style

- single quotes, semicolons always, no tabs (Prettier)
- `public/js/` NIE jest sprawdzane przez tsc ani eslint — weryfikacja manualna + `node -c <file>`

### 7. Globals (frontend JS)

- Wszystkie helpery globalne (bez ES modules); dostępne przez `window.X` lub hoisting
- Wzorzec: na końcu pliku `window.foo = foo;`
- `lucide.createIcons({root: container})` po każdym `innerHTML = ...` z `data-lucide`

---

## Graphify (inteligencja kodu)

Projekt ma graf wiedzy w `graphify-out/` z god nodes, community structure i relacjami między plikami.

### Zanim szukasz w kodzie:

1. `graphify query "<pytanie>"` — zapytanie do grafu (scoped subgraph, mniejszy niż grep)
2. `graphify path "<A>" "<B>"` — relacje między plikami
3. `graphify explain "<koncept>"" — wyjaśnienie konceptu

### Zasady:

- Dirty graph files NIE są powodem do pominięcia graphify (normalne po hookach)
- `graphify-out/wiki/index.md` → używaj do broad navigation zamiast grep
- `graphify-out/GRAPH_REPORT.md` → tylko dla broad architecture review
- **Po zmianach kodu**: `graphify update .` (AST-only, bez kosztów API)

---

## Zasady ogólne

### Jakość kodu

- Czytelność > inteligencja: nazwy zmiennych/funkcji muszą jednoznacznie opisywać intencję
- YAGNI — zero zbędnej abstrakcji; nie dodawaj kodu "na zapas"
- Unikaj magicznych liczb i stringów — używaj stałych z opisową nazwą
- Nie kopiuj kodu bez refaktoryzacji: wydziel współną logikę do funkcji/modułów

### Niezawodność

- Testy są obowiązkowe: każda logika biznesowa → test jednostkowy; kluczowe przepływy → test integracyjny
- Zawsze analizuj przypadki brzegowe i błędne dane wejściowe — kod ma być odporny na nieprzewidywalne dane
- Błędy obsługuj jawnie (try/catch z konkretnym typem błędu), nigdy gołe `catch {}` ani silent fail
- Najpierw poprawność, potem wydajność — optymalizuj dopiero gdy faktycznie występuje problem

### Styl pracy

- Zanim napiszesz kod — zaplanuj strukturę i przepływ danych (z użyciem graphify)
- Każdy fragment kodu musi być gotowy do użycia w realnym systemie — kod produkcyjny, nie demo

---

## Znane błędy (z `docs/errors-known.md`)

| #   | Problem                              | Fix                                                |
| --- | ------------------------------------ | -------------------------------------------------- |
| 1   | Seed timeout SQLite (824 produkty)   | chunk 25/tx, `busy_timeout=30000`, sequential init |
| 2   | Concurrent IIFE race (SQLITE_BUSY)   | IIFE → funkcje, `await` sekwencyjnie               |
| 3   | XSS w innerHTML                      | Zawsze `escapeHtml(str)` przy interpolacji         |
| 4   | Kalkulator comma/dot                 | `value.replace(',', '.')` przed safeEval           |
| 5   | PEHD button duplikacja stylów        | Tylko CSS klasa `.pehd-btn`, NIE inline style      |
| 6   | `isLocked` TDZ                       | Hoist deklaracji przed użyciem                     |
| 7   | colspan 13→15 tryb porównania        | Dynamiczny colspan                                 |
| 8   | `toggleAllItemsForOrder` brak guard  | `if (checkbox)` przed toggle                       |
| 9   | N+1 queries (Prisma)                 | batch `findMany` + Map, NIE pętla z `findUnique`   |
| 10  | Null na DOM queries                  | `if (el) el.addEventListener(...)`                 |
| 11  | Audit log cleanup timeout            | chunk `deleteMany` + indeks na `createdAt`         |
| 12  | `ensureAdminExists` timeout          | Sequential init (products → admin → listen)        |
| 13  | CSP blokuje inline onclick           | Helmet: `scriptSrc: ["'self'", "'unsafe-inline'"]` |
| 14  | Spinner w input[type=number]         | `::-webkit-inner-spin-button { appearance: none }` |
| 15  | `sort()` mutacja oryginalnej tablicy | `[...array].sort(...)`                             |

---

## Rury — szczegóły implementacji

### Sortowanie (krok 3 + zakładka Oferta)

- Logika mirror w: `offerItems.js:578-635` (pełna tabela z subheaders) i `offerSummaryTab.js:111-153` (bez subheaders)
- Algorytm: `grouped[category][diamKey]` → sort kat wg `CATEGORIES.indexOf()` → sort średnic numerycznie → wewnątrz (cat,diam) Bosy-Bosy pierwsze, potem `lengthM` asc
- Fallback średnicy: `productId.split('-')[4]` jako int\*100 gdy `getProductDiameter` zwraca null
- `CATEGORIES` kolejność: Rury Betonowe → Żelbetowe KL.A → Żelbetowe KL.S → Duże Żelbetowe II → Rury Jajowe Betonowe → Rury Jajowe Żelbetowe → Akcesoria PEHD → Uszczelki → Zabezpieczenie transportu

### Tabele

- Krok 5: `updateRuryOrderSummary` kopiuje innerHTML z `#offer-items-body` do `#order-items-body`; edytowalna tylko w `orderEditMode`
- Dynamic colgroup: `buildRuryColgroup(extraCols)` — 13 lub 15 kolumn
- Krok 3: 13 kolumn (Lp, Nazwa, PEHD 3mm, PEHD 4mm, Długość, Ilość, Cena jedn, Rabat, Po rabacie, Transp/szt, Netto, Status, Usuń)
- Zakładka Oferta: 9-11 kolumn (checkbox, Lp, Produkt, Cena jedn, Rabat, Po rabacie, Transp/szt, Ilość, Razem netto, +Cena z oferty, +Różnica)
- Lp+Nazwa LEFT; reszta right; `.rury-col-num` dla tabular-nums
- Nagłówki kat/średnic: `text-align: left`

### CSS szczegóły

- `.rury-table tbody tr:not(.offer-cat-header):not(.offer-diam-header) td:first-child` — specificity fix
- `.pehd-btn`: `min-width:88px`, `padding:0.3rem 0.6rem`, `font-size:0.72rem`, `font-weight:600`
- Akcje PEHD i delete: zawsze widoczne (NIE ukrywaj nawet w locked offer)
- Spinner input: `appearance: none` + `-moz-appearance: textfield`

### AutoAdded

- Checkboxy: manual (unchecked, enabled, clickable, title "Zaznacz aby dodać do zamówienia")
- Backfill uid + ordered: `item.uid = 'rur_' + Date.now() + '_' + Math.random()...`

---

## Studnie — szczegóły implementacji

- Sortowanie tabeli oferty: tylko po DN numerycznie (`parseInt(a.well.dn) - parseInt(b.well.dn)`); `dn === 'styczna' ? Infinity`
- Brak category grouping (offerManager.js:402-407)
- Tryb zamówienia: `orderEditMode` + `originalSnapshot`; kolumny porównania "Cena z oferty", "Różnica"
- Layout: 3-kolumnowy grid (diagram | konfig | lista studni) z `clamp()` + `minmax(0, 1fr)`

---

## ML System (AI Pipeline dla studni)

System ML jest równoległy do istniejącego LearningEngine (pattern-based). NIE modyfikuje solvera JS.

### Architektura

| Komponent         | Plik                                  | Opis                                                                                 |
| ----------------- | ------------------------------------- | ------------------------------------------------------------------------------------ |
| Feature Extractor | `src/services/ml/FeatureExtractor.ts` | Ekstrakcja cech z telemetry do AiFeature (Prisma)                                    |
| Acceptance Model  | `src/services/ml/AcceptanceModel.ts`  | Logistic Regression w TS (sigmoid, gradient descent)                                 |
| Model Registry    | `src/services/ml/ModelRegistry.ts`    | CRUD dla AiModel + auto-rollback gdy AUC < 0.65                                      |
| Training Pipeline | `src/services/ml/TrainingPipeline.ts` | Cron co 15min: extract → normalize → train → validate → deploy                       |
| Reward Calculator | `src/services/ml/RewardCalculator.ts` | Reward signals per decyzja użytkownika                                               |
| Self Evaluation   | `src/services/ml/SelfEvaluation.ts`   | Daily cron A/B testing + auto-rollback                                               |
| Prediction API    | `src/routes/telemetryAiMl.ts`         | POST /api/telemetry/ai/predict (cache 15min), /reward, /ml-status, /train, /rollback |
| Dual-Ranking      | `public/js/studnie/mlDualRanking.js`  | Final = 0.6 × Technical + 0.4 × AI × 100; 5% exploration                             |
| Reward Hooks      | `public/js/studnie/mlRewardHooks.js`  | Hooki do wellActions (addWell, removeWell, ACCEPT, REJECT)                           |
| ML Dashboard      | `public/js/studnie/mlDashboard.js`    | 2 zakładki: "Learning Engine" (OR-Tools) + "AI Pipeline" (nowe ML)                   |

### Hierarchia modeli (fallback)

GLOBAL → Warehouse → WellType → DN → Client → Project (min 30 przykładów per poziom)

### Forgetting

Exponential decay λ=0.01 (~69 dni półtrwania). Auto-rollback gdy ROC-AUC < 0.65.

### Tabele Prisma (dodane w migracji 20260707000000)

- `AiFeature` — wektory cech per konfiguracja
- `AiModel` — wytrenowane modele (wagi, bias, metryki, normalizacja)
- `AiEvaluation` — metryki dzienne A/B
- `aiRewardLog` — logi nagród/kar per decyzja
- `users.totalReward` — kolumna sumarycznych nagród

---

## Workflow

### Przed zmianami

1. `graphify query "<co robię>"` — zrozum kontekst
2. Sprawdź `docs/errors-known.md` — czy znany bug pasuje

### W trakcie

3. Przestrzegaj ADR-ów (vanilla JS, SQLite, Express+Prisma)
4. frontend JS: dodaj `window.X = X` na końcu pliku
5. Po `innerHTML` = wywołaj `lucide.createIcons({root: container})`
6. Zabezpiecz DOM queries: `if (el) el.addEventListener(...)`
7. Wewnątrz `innerHTML`: zawsze `escapeHtml(str)` dla danych użytkownika

### Po zmianach

8. `graphify update .` — aktualizuj graf
9. Jeśli zmieniłeś CSS/HTML: podbij `?v=N` w link/script tag
10. `npm run typecheck` / `npm run typecheck:frontend` — walidacja
11. `npm run version:check` — spójność wersji (robi to post-commit hook)
12. Browser: `Ctrl+Shift+R` po dużej zmianie CSS

---

## Przydatne komendy

| Komenda                               | Co robi                                |
| ------------------------------------- | -------------------------------------- |
| `npm run dev:backend`                 | Uruchom backend (ts-node-dev)          |
| `npm run typecheck`                   | TypeScript backend check               |
| `npm run typecheck:frontend`          | TypeScript frontend check              |
| `npm run test:quick`                  | Smoke tests (Jest bez coverage)        |
| `npm run lint`                        | ESLint (tylko src/)                    |
| `npm run format`                      | Prettier                               |
| `npm run version:check`               | Sprawdź spójność VERSION/pkg/CHANGELOG |
| `npm run version:patch\|minor\|major` | Bump wersji                            |
| `graphify query "<q>"`                | Zapytaj graf wiedzy                    |
| `graphify path "<A>" "<B>"`           | Relacje między plikami                 |
| `graphify explain "<koncept>"`        | Wyjaśnij koncept                       |
| `graphify update .`                   | Aktualizuj graf po zmianach            |
