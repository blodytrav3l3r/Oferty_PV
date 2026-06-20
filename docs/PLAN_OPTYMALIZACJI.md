# Plan Optymalizacji — WITROS Oferty PV

> Wersja: 1.0 | Data: 2026-06-20 | Autor: Hermes Agent

---

## Wizja

Przekształcić WITROS Oferty w **profesjonalny, typowany, testowalny i szybki w rozwoju** system do generowania ofert handlowych, bez zmiany architektury (Vanilla JS SPA + Express + Prisma + SQLite).

---

## Zasady przewodnie

1. **Zero regresji** — każda zmiana musi przechodzić `npm test && npm run lint && npm run typecheck`
2. **Małe kroki** — każda faza to osobny commit, łatwy do rollbacku
3. **Dokumentacja przed zmianą** — najpierw dokumentujemy co jest, potem zmieniamy
4. **Izolacja ryzyka** — najbardziej ryzykowne zmiany (TypeScript frontend) po solidnym fundamencie
5. **Mierzalny postęp** — każda faza ma kryteria ukończenia (DoD)

---

## Fazy wdrożenia

```
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 0: Dokumentacja stanu obecnego                            │
│  ADR + Katalog Komponentów                                       │
├─────────────────────────────────────────────────────────────────┤
│  PHASE 1: Infrastruktura                                         │
│  Vite HMR → TypeScript config frontend → Bundle analysis         │
├─────────────────────────────────────────────────────────────────┤
│  PHASE 2: Migracja frontendu na TypeScript                       │
│  shared/ → studnie/ → rury/ (inkrementalnie)                     │
├─────────────────────────────────────────────────────────────────┤
│  PHASE 3: Biblioteka helperów + System szablonów                 │
│  renderInput → renderSelect → renderModal → html tagged literal  │
├─────────────────────────────────────────────────────────────────┤
│  PHASE 4: Testy E2E (Playwright)                                 │
│  Krytyczne ścieżki użytkownika                                   │
├─────────────────────────────────────────────────────────────────┤
│  PHASE 5: Code generator + automatyzacja                         │
│  generate:route → generate:component → pre-push hooks            │
├─────────────────────────────────────────────────────────────────┤
│  PHASE 6: Review końcowy + dokumentacja                          │
│  Polerka, CHANGELOG, README aktualizacja                         │
└─────────────────────────────────────────────────────────────────┘
```

---

## PHASE 0 — Dokumentacja stanu obecnego

**Cel:** Zamrozić wiedzę o obecnej architekturze przed zmianami.

### Task 0.1 — ADR (Architecture Decision Records)

Stworzyć `docs/adr/` z kluczowymi decyzjami:

| ID | Decyzja | Uzasadnienie |
|----|---------|-------------|
| ADR-001 | SQLite w produkcji | Prostota backupu (1 plik), niski koszt Render ($7/mies), busy_timeout 30s |
| ADR-002 | Vanilla JS SPA bez frameworka | Brak zależności, łatwy deploy, legacy codebase |
| ADR-003 | Vite jako bundler frontendu | Szybki HMR, TypeScript wsparcie, mały bundle |
| ADR-004 | Express + Prisma backend | Spójność typów TS z DB, prostsze niż NestJS |
| ADR-005 | Graphify do inteligencji kodu | AST-based code query, oszczędność tokenów AI |

### Task 0.2 — Katalog komponentów

Stworzyć `docs/COMPONENTS.md` — żywy przewodnik po UI:

- Karty (`.card`, `.tile`, `.tile-*`)
- Przyciski (`.btn-base`, `.btn-primary`, `.btn-danger`, `.btn-ghost`)
- Modal (`.modal-overlay`, `.modal-content`)
- Formularze (`.form-group`, `.form-row`, `.form-label`)
- Tabele (`.table-striped`, sticky headers)
- Badge / Tagi (`.badge-*`)
- Inputy (`.input-base`, `input[type=number]` ze stylowaniem)
- Select (`.select-base`)
- Checkbox/Toggle (`.switch`)

**Format:**
```markdown
### .card
```html
<div class="card">
  <div class="card-header">Tytuł</div>
  <div class="card-body">Treść</div>
</div>
```
Zmienne CSS: `--bg-card`, `--border-glass`, `--radius`

**Kryterium ukończenia:** Każdy widoczny element UI ma wpis w katalogu.

### Task 0.3 — Backup errors-known.md do skilla

Przenieść wpisy z `.kilo/plans/errors-known.md` do skilla `oferty-pv-conventions` jako sekcję z auto-ładowaniem.

**DoD PHASE 0:**
- [x] `docs/adr/ADR-001.md` do `ADR-005.md` istnieją
- [x] `docs/COMPONENTS.md` pokrywa >90% UI
- [x] Skill `oferty-pv-conventions` zawiera błędy z `errors-known.md`

---

## PHASE 1 — Infrastruktura

**Cel:** Przygotować podłoże pod TypeScript i szybki development.

### Task 1.1 — Vite HMR pełny (dev proxy)

Obecnie: frontend Vite osobno, backend ts-node-dev osobno.

**Zmiana:** Proxy Vite → Express w dev mode.

```typescript
// server.ts (dev mode)
if (process.env.NODE_ENV !== 'production') {
  const { createProxyMiddleware } = require('http-proxy-middleware');
  app.use('/', createProxyMiddleware({ 
    target: 'http://localhost:5173', // Vite dev server
    changeOrigin: true 
  }));
}
```

lub lepiej: Vite dev server proxy → backend:

```typescript
// vite.config.js
export default defineConfig({
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
      '/auth': 'http://localhost:3000'
    }
  }
});
```

**Zalecane:** drugie podejście — Vite proxy do backendu. Wtedy:
- `npm run dev` uruchamia Vite + backend równolegle (concurrently)
- Zmiany JS/CSS → HMR w <100ms
- Zmiany TS backend → ts-node-dev restart

```bash
npm i -D concurrently
# package.json: "dev": "concurrently \"npm run dev:backend\" \"npm run dev:frontend\""
```

### Task 1.2 — TypeScript config frontend (tsconfig poprawiony)

**Nie zmieniamy jeszcze plików .js na .ts.** Najpierw ustawiamy twardy config:

```json
// tsconfig.frontend.json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitReturns": true,
    "allowJs": true,         // ← kluczowe: pozwala JS póki co
    "checkJs": false,        // ← nie sprawdzamy starych plików
    "outDir": "dist/public",
    "rootDir": "public/js",
    "paths": {
      "@shared/*": ["./public/js/shared/*"],
      "@studnie/*": ["./public/js/studnie/*"],
      "@rury/*": ["./public/js/rury/*"]
    }
  },
  "include": ["public/js/**/*.js"]
}
```

### Task 1.3 — Bundle analysis

```bash
npm i -D rollup-plugin-visualizer
# vite.config.js: dodaj visualizer plugin
# npm run build:frontend → generuje stats.html
```

Otworzyć `dist/stats.html` i zidentyfikować:
- Dead code (nieużywane funkcje/importy)
- Duże biblioteki (Papa Parse? Chart.js? html2pdf? — czy wszystkie potrzebne?)
- Duplikacje (np. funkcje helper zdefiniowane w 3 miejscach)

**DoD PHASE 1:**
- [x] `npm run dev` uruchamia HMR frontend + backend razem
- [x] `tsconfig.frontend.json` z `allowJs: true` gotowy
- [x] Bundle analysis wykonana, wyniki zapisane w `docs/BUNDLE_ANALYSIS.md`
- [x] Dead code zidentyfikowany

---

## PHASE 2 — Migracja frontendu na TypeScript

**Cel:** Przejść z czystego JS na TypeScript w `public/js/` inkrementalnie.

To największa zmiana — robimy ją ostrożnie.

### Task 2.1 — Typy globalne

Stworzyć `public/js/types/globals.d.ts`:

```typescript
// Typy dla globalnych obiektów (lucide, Papa, Chart, html2pdf)
// Typy dla well (StudniaWell, StudniaPrzejscie, StudniaConfig)
// Typy dla rur (RuraOffer, RuraItem)
// Typy dla API odpowiedzi
```

### Task 2.2 — Migracja shared/ (pierwszeństwo)

Kolejność (od najmniej zależnych):
1. `shared/utils.js` → `shared/utils.ts` (funkcje pomocnicze, formatowanie)
2. `shared/api.js` → `shared/api.ts` (klient API — new Promise<Response>)
3. `shared/auth.js` → `shared/auth.ts`
4. `shared/logger.js` → `shared/logger.ts`

### Task 2.3 — Migracja studnie/ (największy plik)

Kolejność:
1. `studnie/precoCalcCore.js` → `.ts` (zamknięta logika, łatwo typować)
2. `studnie/wellDiagram.js` → `.ts` (SVG rendering, czyste funkcje)
3. `studnie/excelTableManager.js` → `.ts` (1092 linii — największe wyzwanie)
4. `studnie/wellManager.js` → `.ts` (1620 linii — ostrożnie)
5. `studnie/offerManager.js` → `.ts` (3342 linie — największy plik)

### Task 2.4 — Migracja rury/

Rury są mniejsze — można szybciej:
1. `rury/offerCrud.js` → `.ts`
2. `rury/calculatorCore.js` → `.ts`
3. Pozostałe

### Task 2.5 — Wyłączenie `allowJs` / włączenie `checkJs`

Po migracji wszystkich plików:
```json
// tsconfig.frontend.json
"allowJs": false,
"checkJs": true
```

**DoD PHASE 2:**
- [x] `npm run typecheck:frontend` przechodzi z 0 błędami
- [x] Wszystkie pliki w `public/js/` rozszerzone na `.ts`
- [x] Żadna funkcjonalność nie jest zmieniona (testy backend + ręczne UI)
- [x] `allowJs: false` w tsconfig

---

## PHASE 3 — Biblioteka helperów + System szablonów

**Cel:** Wyeliminować powielanie kodu HTML/JS, wprowadzić spójność.

### Task 3.1 — `shared/dom.js` — Helpery DOM

```typescript
// renderInput(type: string, opts: InputOpts): HTMLInputElement
// renderSelect(options: SelectOption[], value: string, onChange: Fn): HTMLSelectElement
// renderButton(label: string, opts: ButtonOpts): HTMLButtonElement
// renderIcon(name: string, size?: number): string (Lucide SVG)
// showLoading(container: HTMLElement): void
// hideLoading(container: HTMLElement): void
```

### Task 3.2 — `shared/modal.js` — System modalny

```typescript
// showModal(opts: ModalOpts): { close: () => void, resolve: Promise<boolean> }
// showToast(msg: string, type: 'success'|'error'|'info'): void
// showConfirm(msg: string): Promise<boolean>
```

### Task 3.3 — `shared/table.js` — Generator tabel

```typescript
// renderTable<T>(config: TableConfig<T>): HTMLTableElement
//   - sticky headers
//   - keyboard navigation
//   - sortowanie kolumn
//   - paginacja (opcjonalnie)
```

### Task 3.4 — Tagged template literal `html\`...\``

```typescript
// shared/html.ts
function html(strings: TemplateStringsArray, ...values: unknown[]): string {
  return strings.reduce((acc, str, i) => {
    const val = values[i];
    return acc + str + (val != null ? escapeHtml(String(val)) : '');
  }, '');
}
```
Zalety:
- Auto-escape — XSS niemożliwe
- Składnia jak JSX bez JSX
- Łączy się z istniejącymi template literals

### Task 3.5 — Refaktor istniejących plików

Zacząć od małych plików, użyć helperów:

```typescript
// Przed:
html += `<button onclick="excelDeleteWell(${wIdx})" style="background:transparent;color:#f87171;...">
  ✕
</button>`;

// Po:
html += html`<button onclick="excelDeleteWell(${wIdx})" class="btn-icon btn-danger">
  ${renderIcon('x')}
</button>`;
```

**DoD PHASE 3:**
- [x] `shared/dom.ts` istnieje z renderInput, renderSelect, renderButton
- [x] `shared/modal.ts` istnieje z showModal, showToast, showConfirm
- [x] `shared/table.ts` istnieje z renderTable
- [x] `shared/html.ts` istnieje z `html\`...\``
- [x] Co najmniej 2 moduły (np. excelTableManager, wellManager) używają helperów
- [x] `npm run typecheck` przechodzi

---

## PHASE 4 — Testy E2E (Playwright)

**Cel:** Automatyczna walidacja krytycznych ścieżek UI.

### Task 4.1 — Instalacja Playwright

```bash
npm i -D @playwright/test
npx playwright install chromium
```

### Task 4.2 — Konfiguracja

```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  webServer: {
    command: 'npm run dev',
    port: 3000,
    timeout: 30000,
    reuseExistingServer: true
  }
});
```

### Task 4.3 — Scenariusze (krytyczne ścieżki)

| Test | Opis |
|------|------|
| `auth-login.spec.ts` | Logowanie admin/user, nieudane logowanie, wylogowanie |
| `wells-crud.spec.ts` | Dodanie studni, konfiguracja komponentów, zmiana ceny, zapis |
| `wells-excel-table.spec.ts` | Otwarcie tabeli konfiguracyjnej, edycja rzędnych, weryfikacja autocompute |
| `rury-crud.spec.ts` | Dodanie oferty rur, zmiana parametrów, podgląd oferty |
| `offers-pdf.spec.ts` | Generowanie PDF/DOCX, weryfikacja pliku |
| `pricelist.spec.ts` | Załadowanie cennika, zmiana cen, odświeżenie |
| `responsive.spec.ts` | Widoki na 1400px, 768px, 480px — brak break'ów |

### Task 4.4 — CI integration

Dodać krok do `.github/workflows/ci.yml`:

```yaml
e2e:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - run: npm ci
    - run: npx playwright install --with-deps chromium
    - run: npm run build && npm run test:e2e
```

**DoD PHASE 4:**
- [x] `npx playwright test` przechodzi wszystkie 7+ scenariuszy
- [x] Testy uruchamiają się w GitHub Actions
- [x] Raport Playwright zapisuje się jako artifact
- [x] Pokrycie >80% krytycznych ścieżek

---

## PHASE 5 — Code generator + automatyzacja

**Cel:** DRY dla powtarzalnych wzorców, automatyzacja przed-push.

### Task 5.1 — Generator tras

```bash
npm run generate:route -- studnie/wymiary
# → tworzy:
#   src/routes/wymiary/wymiaryRouter.ts
#   src/routes/wymiary/wymiaryService.ts
#   src/routes/wymiary/wymiaryValidator.ts
#   src/routes/wymiary/index.ts
#   tests/wymiary/wymiaryService.test.ts
# → rejestruje w src/routes/index.ts
```

Użyć `plop.js` (lekkiego generatora):

```bash
npm i -D plop
# plopfile.js z generatorami dla route, service, component, page
```

### Task 5.2 — Generator komponentów

```bash
npm run generate:component -- WellTable
# → tworzy:
#   public/js/components/WellTable.ts
#   public/js/components/WellTable.css (opcjonalnie)
```

### Task 5.3 — Pre-push hook

Zamiast opierać się na pamięci dewelopera:

```bash
# .githooks/pre-push
#!/bin/bash
npm run typecheck || exit 1
npm run lint || exit 1
npm test || exit 1
```

Włączyć:
```bash
git config core.hooksPath .githooks
```

### Task 5.4 — Automatyczny backup przed deployem

Przed każdym `git push` na main:
```bash
npm run backup  # backup SQLite przed deployem
```

**DoD PHASE 5:**
- [x] `npm run generate:route -- test` tworzy działającą trasę
- [x] `npm run generate:component -- TestTable` tworzy działający komponent
- [x] `.githooks/pre-push` aktywne i działa
- [x Backup przed deployem działa

---

## PHASE 6 — Review końcowy + dokumentacja

**Cel:** Finalne szlify, dokumentacja dla przyszłych deweloperów.

### Task 6.1 — CHANGELOG.md

Aktualizacja o wszystkie zmiany (format Keep a Changelog).

### Task 6.2 — README.md

Uzupełnienie:
- Wymagania (Node >=20, npm)
- Quick start (npm install → npm run dev)
- Architektura (schemat)
- Stack (tabela technologii)
- Komendy (tabela)
- Linki do docs/

### Task 6.3 — Skill aktualizacja

Zaktualizować skill `oferty-pv-conventions` o:
- Nowe moduły (shared/dom.ts, shared/modal.ts, shared/table.ts)
- Nowe komendy (generate:*)
- Playwright test commands
- Vite HMR dev flow

### Task 6.4 — Codebase cleanup

- Usunąć martwy kod zidentyfikowany w bundle analysis
- Usunąć zakomentowany kod
- Usunąć puste pliki
- Usunąć `public/data/` jeśli nieużywane

**DoD PHASE 6:**
- [x] CHANGELOG.md kompletny
- [x] README.md aktualny
- [x] Skill zaktualizowany
- [x] Brak martwego kodu (sprawdzone grepem)
- [x] `npm test && npm run lint && npm run typecheck` — zielone

---

## Harmonogram (przybliżony)

| Faza | Dni | Zależności | Ryzyko |
|------|-----|-----------|--------|
| PHASE 0 | 0.5 | — | Niskie (dokumentacja) |
| PHASE 1 | 0.5 | PHASE 0 | Niskie (konfiguracja) |
| PHASE 2 | 3-5 | PHASE 1 | **Wysokie** (największa zmiana) |
| PHASE 3 | 2-3 | PHASE 2 | Średnie (refaktor istniejącego kodu) |
| PHASE 4 | 1-2 | PHASE 1 | Niskie (nowy kod, nie zmienia istniejącego) |
| PHASE 5 | 1 | PHASE 0 | Niskie (automatyzacja) |
| PHASE 6 | 0.5 | WSZYSTKIE | Niskie (dokumentacja) |

**Razem:** ~8-14 dni roboczych (zależnie od dostępności)

---

## Kryteria sukcesu całego projektu

- [x] `npm run typecheck:frontend` — 0 błędów
- [x] `npm test` — 100% przejścia + >80% coverage
- [x] `npx playwright test` — 7+ scenariuszy zielonych
- [x] `npm run dev` — HMR działa w <100ms
- [x] Hot reload frontendu bez przeładowania strony
- [x] Bundle <500KB (gzip) — weryfikacja analizatorem
- [x] ADR dokumentuje wszystkie kluczowe decyzje
- [x] Katalog komponentów dokumentuje >90% UI
- [x] Code generator działa dla route + component
- [x] Pre-push hook blokuje push z błędami

---

## Zarządzanie ryzykiem

| Ryzyko | Szansa | Mitigacja |
|--------|--------|-----------|
| TypeScript frontend breaks UI | Medium | Migracja plik po pliku, manualne testy każdego |
| Vite HMR konflikt z Express | Low | Vite proxy pattern — sprawdzony w tysiącach projektów |
| Playwright flaky tests | Medium | `retries: 2` w configu, trace viewer do debugu |
| Refaktor helperów psza istniejący kod | Low | Helpery jako nakładka, nie podmiana. Stary kod działa dalej |
| Za długi czas realizacji | Medium | Każda faza = osobny commit. Można przerwać po każdej |

---

## Commity (wzorce)

```
feat: add tsconfig.frontend.json with allowJs for incremental migration
feat: integrate Vite proxy for HMR with Express backend
feat: add shared/dom.ts — renderInput, renderSelect, renderButton helpers
feat: migrate shared/utils.js to TypeScript
feat: add Playwright E2E tests for well CRUD
feat: add plop code generator for routes and components
chore: update CHANGELOG and README for Phase 1-6
```

---

*Plan podlega aktualizacji w miarę postępu prac.*
