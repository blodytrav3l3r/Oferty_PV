# Coding Style (zaadaptowano pod S.O.K.)

> Zrodlo: ECC common/coding-style.md. Limity rozmiaru zgodne z AGENTS.md projektu
> (funkcje ~100-150 linii, pliki ~1000-1500, zagniezdzenie max 3). To, co w AGENTS.md,
> jest nadrzedne.

## Immutability (CRITICAL)

Zawsze tworz nowe obiekty, nigdy nie mutuj istniejacych:

```
WRONG:  modify(original, field, value) -> zmienia oryginal in-place
CORRECT: update(original, field, value) -> zwraca nowa kopie ze zmiana
```

Rationale: niezmiennosc zapobiega ukrytym efektom ubocznym, ulatwia debugowanie.

> Powiazane: baza bledow #15 - przed sortowaniem zawsze kopia: `[...tablica].sort(...)`.

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

## File Organization

- MANY SMALL FILES > FEW LARGE FILES
- Preferowane rozmiary (AGENTS.md, zalecenia nie sztywne):
    - Funkcje: ~100-150 linii
    - Klasy: ~500-800 linii
    - Pliki: ~1000-1500 linii
- Nie dziel wylacznie ze wzgledu na liczbe linii - najpierw ocen spojnosc odpowiedzialnosci (SRP)
- Spojny, czytelny kod > sztuczne trzymanie limitow

## Error Handling

- Obsluguj bledy jawnie na kazdym poziomie
- Przyjazne komunikaty w kodzie UI
- Szczegolowy kontekst bledu na serwerze
- NIGDY nie polykaj bledow po cichu (silent fail - patrz agent silent-failure-hunter)

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

## Code Smells to Avoid

### Deep Nesting

Maksymalnie **3 poziomy** zagniezdzenia. Uzywaj early return, guard clauses, wydzielania blokow.

### Magic Numbers

Uzywaj nazwanych stalych dla progow, timeoutow, limitow.

### Long Functions

Dziel duze funkcje na skupione czesci z jasna odpowiedzialnoscia.

## Code Quality Checklist

- [ ] Kod czytelny i dobrze nazwany
- [ ] Funkcje w rozmiarze ~100-150 linii
- [ ] Pliki w rozmiarze ~1000-1500 linii
- [ ] Maksymalnie 3 poziomy zagniezdzenia
- [ ] Poprawna obsluga bledow
- [ ] Brak twardo zakodowanych wartosci (stale lub config)
- [ ] Wzorce immutability
- [ ] `escapeHtml` przy interpolacji do innerHTML
