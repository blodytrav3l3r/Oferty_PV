# Development Workflow (zaadaptowano pod S.O.K.)

> Zrodlo: ECC common/development-workflow.md. Zgodne z AGENTS.md projektu - AGENTS.md jest
> jedynym zrodlem prawdy dla konwencji i limitow.

## Core Principle

- Rozumiej istniejacy kod przed pisaniem nowego
- Stosuj zasade DRY, SRP, KISS
- Nigdy nie uzywaj placeholderow (// ... reszta kodu bez zmian) - kazda modyfikacja musi
  dostarczac kompletny, gotowy do uruchomienia kod

## Development Phases

### Phase 1: Analiza

- Przeczytaj istotne pliki i zrozum ich role
- Zidentyfikuj istniejace wzorce i helpery do reuse
- Sprawdz dokumentacje modulow (docs/adr, AGENTS.md)

### Phase 2: Planowanie

- Sformuluj krotki logiczny plan dzialania (Chain of Thought)
- Okresl, ktore pliki beda zmieniane
- Ustal, jak zweryfikowac (komendy testow)

### Phase 3: Implementacja

- Implementuj zgodnie z zasadami clean code
- Waliduj input, obsluguj bledy jawnie
- Uzywaj `escapeHtml` dla interpolacji do innerHTML
- Po dynamicznym wstrzyknieciu HTML z ikonami Lucide: `lucide.createIcons({root: container})`

### Phase 4: Weryfikacja

- Syntax check: `node -c <plik.js>` dla plikow w `public/js/`
- `npm run typecheck` (backend) / `npm run typecheck:frontend`
- `npm run lint` / `npm run lint:frontend`
- `npm run test:quick` lub `npm test`
- `npm run format` (ZAWSZE po zmianie frontendu)
- `npm run version:check` (przed commitem)

### Phase 5: Commit

- `node scripts/commit.mjs "typ(scope): opis"`
- Konwencja: typ + scope z listy commitlint, <=72 znaki

## Common Mistakes to Avoid

- Pisanie kodu bez zrozumienia istniejacych wzorcow
- Duplikowanie logiki (DRY violation)
- Silent fail - polykanie bledow bez logowania
- Brak walidacji danych wejsciowych
- Interpolacja bez `escapeHtml` (XSS)
- Nadmierne zagniezdzanie (>3 poziomy)
- Placeholdery zamiast pelnej implementacji

## Specific Project Patterns

- Frontend (public/js/) nie jest kompilowany przez TS, ale jest sprawdzany przez
  `typecheck:frontend` i `lint:frontend` oraz `node -c`
- Globalne helpery rejestrowane przez `window.nazwa = funkcja;`
- Moduly osadzane w iframe w app.html (SPA); router ukrywa naglowki osadzonych stron
- Kod w public/js/rury/ i public/js/studnie/ - sortowanie oferty zawsze przez
  `getSortedRuryItems` (jedyne zrodlo prawdy)
