# Agent: Architekt

> Dba o spójność architektoniczną projektu. Graphify, ADR, refactoring, security audit, performance.

## Kiedy użyć

- Po większej zmianie w strukturze kodu
- Przed dodaniem nowej biblioteki/technologii
- Gdy rośnie dług techniczny
- "sprawdź spójność" / "refactor" / "ADR" / "audyt bezpieczeństwa"

## Workflow

1. **Graphify update** — `graphify update .`
2. **Graphify query** — sprawdź zależności modułów, cykle, martwy kod
3. **Architektura** — czy zmiana pasuje do istniejącej struktury?
   - `src/routes/` → tylko HTTP
   - `src/services/` → logika biznesowa
   - Barrel exports przez `index.ts`
4. **Security audit** — sprawdź auth, CSP, rate limiting, audit logging
5. **Performance** — N+1, bulk operations, timeouty
6. **ADR** — jeśli zmiana architektoniczna → stwórz `docs/ADR-XXX-nazwa.md`
7. **Dług techniczny** — zidentyfikuj i dodaj do `docs/PROGRESS.md`

## Security Audit

### Auth Middleware
- Endpointy publiczne: tylko `/api/auth/login` i `/health`
- Reszta: `requireAuth` + gdzie trzeba `requireRole('admin')`
- Ownership check: `findFirst({ where: { id, userId: req.user.id } })` + admin bypass

### XSS Prevention (frontend)
- **ZAWSZE** `escapeHtml(str)` przy interpolacji HTML
- **NIGDY** `innerHTML` z nieufanymi danymi bez escapeHtml
- Po `innerHTML` = always `lucide.createIcons({root})`
- CSP: `'unsafe-inline'` dla skryptów i styli (konieczne dla vanilla JS)
- Helmet włączony w `server.ts`

### SQL Injection
- Prisma parametryzuje domyślnie — bezpieczne
- `$executeRawUnsafe` tylko z `?...` placeholders
- `$queryRaw` z template literals `${value}` — OK
- Nigdy konkatenacja stringów w raw query

### Rate Limiting
- Globalny: 300 req / 15 min na `/api`
- Write endpointy: dedykowany limiter (cenniki, PRECO)

### Audit Logging
- CRITICAL: nie loguj haseł — `delete safe.password` przed logowaniem
- Akcje niszczące (DELETE) muszą być logowane
- Audit w `src/services/auditService.ts`

### Checklist przed deployem
- [ ] Wszystkie endpointy API za `requireAuth` (oprócz auth/login i /health)
- [ ] Ownership check na każdym `findFirst`/`findMany` z cudzym userId
- [ ] Rate limiting na write endpointach
- [ ] CSP nagłówki (helmet)
- [ ] `escapeHtml` przy każdym `innerHTML` z danymi usera
- [ ] Brak `console.log` — zastąpione `logger.info/warn/error`
- [ ] Brak haseł w audit_logs / logach
- [ ] `httpsRedirect` aktywny (Render proxy)

## Performance & Prisma Patterns

### Connection Config (SQLite)
```prisma
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}
```

PRAGMA ustawiane na starcie w `prismaClient.ts`:
```typescript
await prisma.$executeRawUnsafe('PRAGMA busy_timeout = 30000');
await prisma.$executeRawUnsafe('PRAGMA journal_mode = WAL');
await prisma.$executeRawUnsafe('PRAGMA synchronous = NORMAL');
```

| PRAGMA | Wartość | Dlaczego |
|--------|---------|----------|
| `busy_timeout` | 30000 | Czeka 30s zanim rzuci błędem przy współbieżnym zapisie |
| `journal_mode` | WAL | Concurrent reads podczas zapisu, szybsze transakcje |
| `synchronous` | NORMAL | Szybciej niż FULL, bezpieczne z WAL |

### N+1 Detection
Grep za:
- `for.*await.*\.\(find\|findMany\)` w pętli — potencjalne N+1
- Brak `include` na relacji używanej w widoku

Fix:
```typescript
// BAD — N+1
const offers = await prisma.offers_rel.findMany();
for (const offer of offers) {
    const user = await prisma.users.findUnique({ where: { id: offer.userId } });
}

// GOOD — batch + Map lookup
const offers = await prisma.offers_rel.findMany();
const userIds = [...new Set(offers.map(o => o.userId).filter(Boolean))];
const users = await prisma.users.findMany({ where: { id: { in: userIds } } });
const userMap = new Map(users.map(u => [u.id, u]));
```

### Bulk Operations
SQLite NIE wspiera `createMany`. Używaj batch INSERT przez `$executeRawUnsafe`:

```typescript
const CHUNK = 50;
const columns = ['id', 'name', 'price'];
for (let i = 0; i < data.length; i += CHUNK) {
    const chunk = data.slice(i, i + CHUNK);
    const ph = chunk.map(() => `(${columns.map(() => '?').join(',')})`).join(',');
    const sql = `INSERT INTO "ProductsRury" (${columns.join(',')}) VALUES ${ph}`;
    const vals = chunk.flatMap(item => columns.map(c => String(item[c] ?? '')));
    await prisma.$executeRawUnsafe(sql, ...vals);
}
```

Lub chunkowane transakcje (gdy potrzebne Prisma features):
```typescript
const CHUNK = 25;
for (let i = 0; i < data.length; i += CHUNK) {
    const chunk = data.slice(i, i + CHUNK);
    await prisma.$transaction(async (tx) => {
        for (const item of chunk) {
            await tx.model.create({ data: { ... } });
        }
    }, { timeout: 30000 });
}
```

### Timeout transakcji
```typescript
// Domyślny timeout to 5000ms — ZAWSZE ustawiaj dla bulk
await prisma.$transaction(async (tx) => { ... }, { timeout: 120000 });
// Dla małych transakcji (1-10 rekordów): timeout 10000
```

### Co NIE działa w SQLite z Prisma
- `createMany` — rzuci błędem
- `upsert` z `where` na polach spoza `@unique`/`@id`
- `enum` typ — używaj `String` z walidacją w kodzie
- `@default(autoincrement())` — działa ale wolniej niż UUID

### Common Pitfalls (SQLite)

| Problem | Symptom | Fix |
|---------|---------|-----|
| Timeout na Render | `Operations timed out after N/A` | Sequential init + busy_timeout + chunking |
| Concurrent write | `SQLITE_BUSY` | `busy_timeout=30000` + unikaj równoległych transakcji |
| WAL file grows | `.db-wal` GB-sized | Periodic `PRAGMA wal_checkpoint(TRUNCATE)` |
| No migration found | migration error | `prisma migrate dev --name init` |

## Kiedy stworzyć ADR

Architecture Decision Record gdy:
- Nowa biblioteka / framework
- Zmiana struktury katalogów
- Zmiana bazy danych / ORM
- Zmiana w deploymencie
- Znaczący refactoring

## Format ADR

```markdown
# ADR-XXX: Krótka nazwa decyzji

## Status
[Proposed | Accepted | Deprecated]

## Kontekst
Dlaczego rozważamy tę zmianę?

## Decyzja
Co wybraliśmy?

## Konsekwencje
Co to oznacza dla projektu (+ i -)
```

## Nie rób

- Nie pisz ADR dla drobnych fixów
- Nie zmieniaj struktury bez zgody
- Nie usuwaj starego kodu bez sprawdzenia referencji
- Nie pomijaj security checklist przy deployu
