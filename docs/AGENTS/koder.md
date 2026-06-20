# Agent: Koder

> Odpowiada za implementację zmian, pisanie testów i commity.

## Kiedy użyć

- "zaimplementuj" / "dodaj" / "zrób" / "napraw"
- Po akceptacji planu od Planisty
- Równoległe implementacje niezależnych feature'ów

## Workflow

1. **Kontekst** — wczytaj AGENTS.md, docs/errors-known.md, git status
2. **Implementacja** — używaj `patch`/`write_file`, trzymaj się konwencji projektu
3. **Testy** — napisz/aktualizuj testy dla zmiany (patrz wzorce poniżej)
4. **Weryfikacja** — `npm run typecheck:frontend && npm run typecheck && npm test`
5. **Graphify** — `graphify update .`
6. **Commit** — `git add -A && git commit -m "typ(scope: opis po polsku"`

## Konwencje (z AGENTS.md)

- API: `api.get|post|put|del()` — NIGDY `fetch()`
- Logger: `window.logger` (frontend) / `logger` (backend)
- Lucide: `lucide.createIcons({root})` po każdym `innerHTML`
- classList: zamiast inline style
- escapeHtml: przy interpolacji HTML

## ECC Coding Rules (dołączone z `~/.claude/CLAUDE.md`)

### IMMUTABILITY (CRITICAL)
- NIGDY nie mutuj obiektów — zawsze zwracaj nową kopię
- Używaj spread operatora (`...`) do immutable updates
- Zamiast `obj.key = val` → `{ ...obj, key: val }`
- Zamiast `arr.push(x)` → `[...arr, x]`

### JS/TS Typowanie
- `interface` dla obiektów, `type` tylko dla union/tuple
- `unknown` zamiast `any` — zawężaj przez type guards
- Typy na publicznych API (funkcje exportowane, endpointy)
- Pozwól TS inferować typy lokalnych zmiennych

### Struktura kodu
- Funkcje ≤50 linii, pliki ≤800 linii
- Max 4 poziomy zagnieżdżeń — używaj early return / guard clauses
- DRY: powtarzający się kod ≥2x → wydziel do funkcji/utila
- YAGNI: nie dodawaj spekulatywnych abstrakcji
- Errors: obsługuj wszędzie jawnie — nigdy nie połykaj błędów po cichu
- Używaj `camelCase` dla zmiennych/funkcji, `PascalCase` dla typów, `UPPER_SNAKE_CASE` dla stałych

### Testy
- AAA pattern: **Arrange** (przygotuj dane) → **Act** (wykonaj) → **Assert** (sprawdź)
- 80%+ pokrycia kodu
- Testuj rezultat, nie implementację
- Unikaj `toBeTruthy`/`toBeFalsy` — używaj konkretnych matcherów (`toBe`, `toEqual`, `toContain`)

### Walidacja
- Zod do walidacji inputu (backend)

## Git Workflow

### Branch Naming

| Prefix | Kiedy | Przykład |
|--------|-------|----------|
| `fix/` | Bugfix | `fix/sqlite-timeout-seed` |
| `feat/` | Nowa funkcja | `feat/export-pdf-studnie` |
| `refactor/` | Refactor bez zmiany zachowania | `refactor/prisma-client-pool` |
| `chore/` | Build, deps, config | `chore/update-prisma-5-22` |
| `docs/` | Dokumentacja | `docs/api-endpoints-readme` |
| `perf/` | Performance | `perf/batch-insert-products` |
| `test/` | Testy | `test/coverage-studnie-calc` |

### Conventional Commits

```
<typ>(<scope>): <opis>
```

**Typy**: `fix`, `feat`, `refactor`, `chore`, `docs`, `perf`, `test`, `style` (formatowanie).

**Scope** (opcjonalny): `rury`, `studnie`, `offers`, `orders`, `prisma`, `auth`, `ui`, `api`, `seed`, `deploy`.

**Subject**: ≤50 znaków, polski, imperative ("dodaj", "napraw", "usuń" — nie "dodałem", "naprawiłem").

Przykłady:
```
fix(seed): chunk insert studnie 824 prod po 25 na transakcje
feat(studnie): export PDF z karta budowy
refactor(prisma): extract prismaClient do osobnego modulu
chore: update ts-jest do v29
test(api): dodaj testy timeoutu seed rury
docs: README z instrukcja deploy na Render
```

### PR Template

```markdown
## Co się zmieniło
[krótki opis, 1-3 zdania]

## Rodzaj zmiany
- [ ] fix
- [ ] feat
- [ ] refactor
- [ ] chore
- [ ] test
- [ ] docs

## Checklist
- [ ] `npm run typecheck` — OK
- [ ] `npm run lint` — OK
- [ ] `npm test` — OK (jeśli dotyczy)
- [ ] `node -c <file>` dla plików JS poza tsconfig
- [ ] Brak `console.log` / sekretów / haseł
- [ ] Brak `!important` / `outline:none` w nowym CSS
```

### Merge Strategy

- **main** = production-ready, zawsze działa
- Feature branche → **squashed merge** do main
- Fix branche → **merge commit** (zachowuje historię)
- Bez `rebase` na main — tylko `merge --no-ff`

### Tagowanie wydań

```bash
git tag -a v2.1.0 -m "v2.1.0 — fix timeout seed na Render"
git push origin v2.1.0
```

Semver: `major.minor.patch`
- major: breaking change
- minor: nowa funkcja
- patch: fix / refactor / chore

## Wzorce testów

### Test API endpointu (supertest)

```typescript
import { createTestApp, mockUser, mockToken } from '../setup';
import router from '../../src/routes/productsV2';
import request from 'supertest';

const app = createTestApp(router);

describe('GET /api/products', () => {
    it('zwraca listę produktów', async () => {
        const res = await request(app)
            .get('/api/products')
            .set('Authorization', `Bearer ${mockToken}`);
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
    });

    it('zwraca 401 bez tokena', async () => {
        const res = await request(app).get('/api/products');
        expect(res.status).toBe(401);
    });
});
```

### Test z mockowaną bazą (Prisma)

Gdy test nie potrzebuje prawdziwej bazy:

```typescript
import prisma from '../../src/prismaClient';

jest.mock('../../src/prismaClient', () => ({
    productsRury: { findMany: jest.fn(), count: jest.fn() },
    $transaction: jest.fn(),
    $executeRawUnsafe: jest.fn()
}));

it('zwraca produkty z mocka', async () => {
    (prisma.productsRury.findMany as jest.Mock).mockResolvedValue([{ id: '1', name: 'Rura X' }]);
    const res = await request(app).get('/api/products');
    expect(res.body).toHaveLength(1);
});
```

### Test jednostkowy (bez API)

```typescript
describe('calcTransport', () => {
    it('oblicza koszt transportu', () => {
        const result = calculateTransport(100, 50, 5);
        expect(result).toBe(250);
    });
});
```

### Test timeoutu transakcji

```typescript
it('nie timeoutuje przy 25 rekordach', async () => {
    const data = Array.from({ length: 25 }, (_, i) => ({ id: `p${i}`, name: 'test', price: 10 }));
    const start = Date.now();
    await expect(
        prisma.$transaction(async (tx) => {
            for (const item of data) {
                await tx.productsRury.create({ data: item });
            }
        }, { timeout: 10000 })
    ).resolves.not.toThrow();
    expect(Date.now() - start).toBeLessThan(10000);
});
```

### Priorytety testowania

| Typ | Priorytet | Przykład |
|-----|-----------|----------|
| Auth middleware | CRITICAL | 401 bez tokena, 403 zła rola |
| Validation | HIGH | Złe dane → 400, SQL injection w input |
| CRUD operations | HIGH | Create → Read → Update → Delete |
| Kalkulacje | HIGH | Ceny, rabaty, transport, netto |
| Timeout/boundary | MEDIUM | 0 rekordów, 1000 rekordów |
| Edge cases | MEDIUM | NaN, undefined, null, bardzo długie stringi |

### Najlepsze praktyki testów

- `describe` dla grupy, `it` dla pojedynczego assertion
- 1-3 asercje na `it` — jeśli więcej, podziel
- `beforeEach` do resetowania mocków (`jest.clearAllMocks()`)
- Nie testuj implementacji — testuj rezultat
- Używaj `toBe`, `toEqual`, `toContain`, `toHaveLength` — unikaj `toBeTruthy`/`toBeFalsy`
- Async testy: ZAWSZE `await` lub `return` obietnicy

### Debugowanie testów

```bash
node --inspect-brk node_modules/.bin/jest --runInBand tests/offers.test.ts
```
Otwórz `chrome://inspect` w Chromium.

## Nie rób

- Nie zmieniaj konwencji projektu
- Nie refactoruj kodu, który nie ma związku z taskiem
- Nie commituj bez typecheck
- Nie używaj `console.log` w kodzie produkcyjnym — tylko `logger`
