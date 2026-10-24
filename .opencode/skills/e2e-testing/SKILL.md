---
name: e2e-testing
description: Playwright E2E testing patterns dla S.O.K. - testy uruchamiane przez node tests/playwright/*.cjs (backend na localhost:3000), wzorce stabilnych testow, unikanie flaky.
metadata:
    origin: ECC (zaadaptowano pod S.O.K.)
---

# E2E Testing Patterns (S.O.K.)

Wzorce budowania stabilnych, szybkich i utrzymywalnych testow E2E.

> S.O.K.: testy E2E to skrypty Playwright w `tests/playwright/*.cjs`, uruchamiane przez Node
> (np. `npm run test:alignment`). Wymagaja dzialajacego backendu na `http://localhost:3000`.
> Exit code: 0 = pass, 1 = fail.

## Test File Organization

```
tests/
`-- playwright/
    |-- appNameConsistency.cjs
    |-- excelEmptyRowAlignment.cjs
    `-- partialOrderRury.cjs
```

## Struktura testu (wzorzec z repo)

```js
const BASE = 'http://localhost:3000';

// Rozwiazanie Playwright: najpierw node_modules, potem npx cache
function resolvePlaywright() {
    // ... (wzor z excelEmptyRowAlignment.cjs)
}

// Regresja: weryfikuje okreslone zachowanie, zwraca exit code
async function main() {
    // Arrange - otworz strone
    // Act - interakcja
    // Assert - pomiar/porownanie
    // Exit code 0/1
}
```

## Stabilne testy - unikaj flaky

### Race conditions

```js
// ZLE: zaklada, ze element jest gotowy
await page.click('[data-testid="button"]');

// DOBRZE: auto-wait locator
await page.locator('[data-testid="button"]').click();
```

### Network timing

```js
// ZLE: dowolny timeout
await page.waitForTimeout(5000);

// DOBRZE: czekaj na okreslony warunek / odpowiedz API
await page.waitForResponse((resp) => resp.url().includes('/api/data'));
```

### Animacje / stabilnosc

```js
// ZLE: klik w trakcie animacji
await page.click('[data-testid="menu-item"]');

// DOBRZE: czekaj na stabilnosc
await page.locator('[data-testid="menu-item"]').waitFor({ state: 'visible' });
await page.locator('[data-testid="menu-item"]').click();
```

## Wymagane warunki uruchomienia

- Backend dziala na `localhost:3000` (dev: `npm run dev:backend`)
- Playwright dostepny w node_modules lub npx cache
- Testy regresyjne z parametrem `--spawn` moga budowac i uruchamiac serwer (np. `test:e2e-appname:spawn`)

## Report Template

```markdown
# E2E Test Report

**Status:** PASSING / FAILING

## Summary

- Total: X | Passed: Y | Failed: A

## Failed Tests

- test-name: opis błędu, zalecana poprawka
```
