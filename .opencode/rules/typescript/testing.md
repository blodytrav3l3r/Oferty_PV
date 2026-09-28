# TypeScript Testing (zaadaptowano pod S.O.K.)

> Zrodlo: ECC typescript/testing.md. Zgodne z AGENTS.md projektu - backend testowany przez
> Jest, kluczowe regresje jako testy (baza bledow w AGENTS.md).

## Testing Scope

- Unit/integration tests backendu (Jest): `npm run test:quick` / `npm test`
- Kluczowe regresje dokumentowane w AGENTS.md (baza bledow) z testem regresyjnym
  (np. `tests/studnie/excelDrilledRings.test.ts`, `tests/encodingMojibake.test.ts`)

## When to Write Tests

- Nowa logika biznesowa: walidacja, kalkulacje, przetwarzanie danych
- Fixy istotnych bledow (regresje)
- Endpointy API (shape odpowiedzi, walidacja, kody bledow)

## Patterns

### Service / Logic Tests

```ts
// test obslugi bledow domenowych, kalkulacji, walidacji
describe('kalkulacja ceny', () => {
    it('oblicza cene z narzutem', () => {
        expect(calc(100, 0.2)).toBe(120);
    });
});
```

### API Tests

- Weryfikuj shape odpowiedzi: `{ ok: true }` / `{ data: ... }` (wzor z repo)
- Testuj walidacje inputa (400/422 przy zlych danych)
- Testuj autoryzacje (401/403)

## Anti-Patterns

- Testy ktore cos "mocno sprawdzaja" ale nic nie potwierdzaja (bez assert lub z weak assert)
- Snapshot tests na duzych obiektach (wysoka kruchosci)
- Testowanie implementation details zamiast zachowania

## Verification

```bash
npm run test:quick   # szybkie testy dymne
npm test             # pelne z pokryciem
npm run validate     # typecheck + lint + appname + testy dymne
```
