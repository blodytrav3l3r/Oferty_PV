# Web Testing (zaadaptowano pod S.O.K.)

> Zrodlo: ECC web/testing.md. Projekt: vanilla JS frontend sprawdzany przez
> `lint:frontend` i `typecheck:frontend`, regresje Playwright przez skrypty .cjs,
> logika frontend testowana przez testy vm (Jest).

## Test Types (S.O.K.)

### Lint + Typecheck frontend

```bash
npm run lint:frontend
npm run typecheck:frontend
```

### Syntax check

```bash
node -c public/js/<plik>.js
```

### Unit tests logiki frontend (Jest, vm)

- Logika Excel: `tests/studnie/excelDrilledRings.test.ts` i podobne
- Uwaga: testy vm nie laduja wszystkich modulow (np. `excelState.js`) - uzywaj guardow
  `typeof x === 'undefined' || !x` (baza bledow #29)

### E2E (Playwright, .cjs)

```bash
npm run test:alignment
npm run test:e2e-appname
```

- Wymagany backend na `localhost:3000`
- Skrypty w `tests/playwright/*.cjs`

## What to Test

- Logika biznesowa frontendu (kalkulacje, konwersje, sortowanie)
- Konwersje danych (np. krag/krag_ot - baza #20, #21)
- Parsowanie wejscia (przecinek/kropka - baza #4)
- Regresje znanych bledow (baza bledow w AGENTS.md)

## Anti-Patterns

- Testy VM bez guardow na niezaladowanych modulach (ReferenceError, baza #29)
- Testowanie tylko happy path - wazne regresje maja testy
- Brak testow dla znanych bledow historycznych
