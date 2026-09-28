# Testing Standards (zaadaptowano pod S.O.K.)

> Zrodlo: ECC common/testing.md. Zgodne z AGENTS.md projektu - projekt NIE wymaga
> twardego progu 80% ani TDD. Standard: `npm run test:quick`, `npm test`, `validate`.
> Regresje Playwright przez `test:alignment` / `test:e2e-appname`.

## Testing Philosophy

- Testy sa zrodlem prawdy o poprawnosci kodu
- Pisz testy dla: logiki biznesowej, walidacji, przetwarzania danych, kalkulacji
- Nie testuj implementation details - testuj publiczne API i zachowanie
- Projekt dopuszcza testy bez sztywnego wymogu pokrycia (brak progu 80%)

## Test Types (S.O.K.)

### Unit Tests (Jest)

```bash
npm run test:quick      # szybkie testy dymne (bez pokrycia)
npm test                # pelne testy z pokryciem
```

- Testy regresyjne istotnych bledow: `tests/studnie/excelDrilledRings.test.ts`,
  `tests/encodingMojibake.test.ts`
- VM-based testy frontend logic (excel) nie laduja wszystkich modulow - uzywaj
  guardow typu `typeof x === 'undefined' || !x`

### E2E Tests (Playwright, skrypty .cjs)

```bash
npm run test:alignment      # regresja - wyrownanie kolumn w pustym wierszu Excel
npm run test:e2e-appname    # spójność nazw aplikacji
```

- Pliki: `tests/playwright/*.cjs`
- Wymagany backend na `localhost:3000`

## Test Naming

`describe/test` z opisem zachowania, nie implementacji:

```
describe('kalkulacja ceny', () => {
  test('oblicza cene z narzutem', () => { ... });
});
```

## Coverage Requirements

- Projekt NIE wymaga twardego progu pokrycia (typowe: 80%)
- Wymagane sa testy dla nowej logiki biznesowej (dla przetwarzania danych,
  walidacji, kalkulacji ofert)
- Kluczowe regresje dokumentowane w AGENTS.md (baza bledow) z testem regresyjnym

## Regression Proof (Source of Truth Protocol)

- Dla naprawianego bledu, gdy mozliwe: test na starym kodzie (FAIL/RED = ten
  problem) → minimalna zmiana → test ponownie (PASS/GREEN).
- Zakaz testu zielonego od poczatku jako „dowodu naprawy”.
- PASS potwierdza tylko pokryte zachowanie. P0/P1/security: test regresyjny +
  kontrakt + sciezka + konsumenci + brak regresji. Weak assertion, test omijajacy
  sciezke i test na samym mocku to nie pelny dowod.

## Pre-Commit Testing

Przed commitem:

```bash
npm run validate   # typecheck + lint + appname + testy dymne
```

Pre-push dodatkowo uruchamia full typecheck, encoding:check, version:check, test:quick.

## Anti-Patterns

- Testowanie tylko happy path
- Zbyt specyficzne assercje (implementation coupling)
- Ignorowanie testow regresyjnych
- Brak testow dla istotnych bledow historycznych (baza bledow w AGENTS.md)
