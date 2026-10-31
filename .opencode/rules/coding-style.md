# Coding Style (zaadaptowano pod S.O.K.)

> Zrodlo: ECC common/coding-style.md + typescript/coding-style.md + common/agents.md.
> Limity rozmiaru zgodne z AGENTS.md projektu (funkcje ~100-150 linii, pliki ~1000-1500,
> zagniezdzenie max 3). To, co w AGENTS.md, jest nadrzedne.

## Immutability (CRITICAL)

Zawsze tworz nowe obiekty, nigdy nie mutuj istniejacych:

```
WRONG:  modify(original, field, value) -> zmienia oryginal in-place
CORRECT: update(original, field, value) -> zwraca nowa kopie ze zmiana
```

Rationale: niezmiennosc zapobiega ukrytym efektom ubocznym, ulatwia debugowanie.
W typach preferuj `readonly`. Przed sortowaniem zawsze kopia: `[...tablica].sort(...)`
(baza bledow #15).

## Core Principles

### KISS (Keep It Simple)

- Preferuj najprostsze rozwiazanie, ktore dziala
- Unikaj przedwczesnej optymalizacji
- Optymalizuj pod czytelnosc, nie spryt

### DRY (Don't Repeat Yourself)

- Wydzielaj powtarzana logike do wspolnych funkcji/utility
- Logika wystepujaca wiecej niz 2 razy -> osobna funkcja/modul/klasa
- Nie duplikuj logiki sortowania, renderowania itd. - korzystaj z istniejacych helperow (np. `getSortedRuryItems`)

### YAGNI (You Aren't Gonna Need It)

- Nie buduj funkcji ani abstrakcji, zanim nie sa potrzebne
- Unikaj spekulacyjnej generycznosci

### Strong Typing

- Kazda wartosc ma jawny typ (nigdy `any` bez powodu)
- Uzywaj `unknown` zamiast `any` dla nieznanych danych
- Type guards dla zawężania typow z zewnetrznych danych

## Error Handling

- Obsluguj bledy jawnie na kazdym poziomie
- Przyjazne komunikaty w kodzie UI
- Szczegolowy kontekst bledu na serwerze
- NIGDY nie polykaj bledow po cichu (silent fail - patrz agent silent-failure-hunter)
- Error boundaries i konwersja bledow do domenowych na granicy serwisu
- Obsluga `PrismaClientKnownRequestError` na granicy serwisu (baza bledow #9, trapy Prisma)

## Input Validation

- Waliduj wszystkie dane wejsciowe przed przetworzeniem
- Uzywaj walidacji schematowej (projekt ma `zod` v4)
- Fail fast z jasnym komunikatem
- Nigdy nie ufaj zewnetrznym danym (API, input, pliki)
- W atrybutach HTML uzywaj `escapeHtmlAttr`/`escapeJsStr`, w tresci `escapeHtml` (baza bledow #39)

## Naming Conventions

- Funkcje: czasownik + rzeczownik (np. `createUser`, `calculateTotalPrice`)
- Zmienne: rzeczownik opisujacy dane (np. `userList`, `productPrice`)
- Boolean: przedrostek `is`, `has`, `can`, `should`
- Interfejsy/typy/komponenty: PascalCase
- Stale: UPPER_SNAKE_CASE
- Identyfikatory w kodzie po angielsku; komentarze, commity, CHANGELOG po polsku

## File Organization

- MANY SMALL FILES > FEW LARGE FILES
- Preferowane rozmiary (AGENTS.md, zalecenia nie sztywne):
    - Funkcje: ~100-150 linii
    - Klasy: ~500-800 linii
    - Pliki: ~1000-1500 linii
- Nie dziel wylacznie ze wzgledu na liczbe linii - najpierw ocen spojnosc odpowiedzialnosci (SRP)
- Spojny, czytelny kod > sztuczne trzymanie limitow

## Specific S.O.K. Patterns

- Backend: `src/`, `server.ts`, `scripts/`, `tests/`
- Kompilacja tsc tylko dla: `src/**`, `server.ts`, `scripts/**`, `tests/**`
- Frontend (public/js/) NIE jest kompilowany przez tsc - sprawdzany przez
  `typecheck:frontend` i `lint:frontend`
- Walidacja danych: `zod` v4 (w dependencies)
- DTO w odpowiedziach API - nigdy surowe encje Prisma
- Prettier: pojedyncze cudzyslopy `'`, sredniki `;`, wciecia spacjami (bez tabulatorow)

## Code Smells to Avoid

### Deep Nesting

Maksymalnie **3 poziomy** zagniezdzenia. Uzywaj early return, guard clauses, wydzielania blokow.

### Magic Numbers

Uzywaj nazwanych stalych dla progow, timeoutow, limitow.

### Long Functions

Dziel duze funkcje na skupione czesci z jasna odpowiedzialnoscia.

## Workflow Rules

1. **Zakaz placeholderow**: NIGDY nie skracaj kodu komentarzami typu
   `// ... reszta kodu bez zmian` lub `/* TODO: reszta logiki */`. Kazda modyfikacja
   dostarcza kompletny, gotowy do uruchomienia kod.
2. **Sekwencyjne dzialanie**: nie uruchamiaj rownoleglych zapisow do bazy (SQLITE_BUSY,
   baza bledow #2).
3. **Przyznanie sie do bledow**: rzeczowo przyznaj sie do bledu i napraw go bez
   przesadnych przeprosin.
4. **Weryfikacja po edycji**: `typecheck` (BE) / `node -c` (JS), potem `npm run format`.

## Code Quality Checklist

- [ ] Kod czytelny i dobrze nazwany
- [ ] Funkcje w rozmiarze ~100-150 linii
- [ ] Pliki w rozmiarze ~1000-1500 linii
- [ ] Maksymalnie 3 poziomy zagniezdzenia
- [ ] Poprawna obsluga bledow
- [ ] Brak twardo zakodowanych wartosci (stale lub config)
- [ ] Wzorce immutability
- [ ] `escapeHtml` przy interpolacji do innerHTML
- [ ] Typy jawnie zdefiniowane (bez `any`)
- [ ] `zod` do walidacji danych wejsciowych
