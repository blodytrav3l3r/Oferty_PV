---
name: prisma-patterns
description: Prisma ORM patterns for TypeScript backends - schema design, query optimization, transactions, pagination, and critical traps like updateMany returning count not records, $transaction timeouts, migrate dev resetting the DB, and @updatedAt skipped on bulk writes.
metadata:
    origin: ECC (zaadaptowano pod S.O.K. / SQLite)
---

# Prisma Patterns

Production patterns and non-obvious traps for Prisma ORM in TypeScript backends.

> S.O.K.: uzywamy Prisma + **SQLite**. Sprawdz wersje przed zastosowaniem wzorcow:
>
> ```bash
> npx prisma --version
> ```
>
> Wazne roznice zaleznie od wersji Prisma:
>
> - `relationJoins` moze ladowac relacje przez JOIN zamiast osobnych zapytan - porownaj oba podejscia na duzych relacjach 1:N
> - `omit` i `prisma.$extends` (Client Extensions) zostaly dodane w nowszych wersjach
> - CLI (`migrate dev`, `migrate deploy`, `generate`) sa niezmienne

## When to Activate

- Projektowanie lub modyfikacja schematu Prisma (modele, relacje)
- Pisanie zapytan, transakcji lub logiki paginacji
- Uzycie `updateMany`, `deleteMany` lub innych operacji zbiorczych
- Planowanie lub wykonywanie migracji
- Soft delete lub filtrowanie po kluczach obcych

## SQLite-specific (S.O.K.)

- Ustaw `busy_timeout` w connection stringu (seed duzych pakietow): `file:./dev.db?connection_timeout=30000` - chroni przed `SQLITE_BUSY` przy rownoleglych zapisach (baza bledow #1, #2).
- Nie uzywaj `?schema=public` ani parametrow serwerless - SQLite lokalne.
- `$transaction` na SQLite jest sekwencyjne - nie rozwiazuje race condition, tylko atomicznosc.
- Stosuj sekwencyjne `await` zamiast rownoleglych zapisow w jednym procesie.

## Core Concepts

### ID Strategy

| Strategia                   | Uzyj gdy                                           | Unikaj gdy                                         |
| --------------------------- | -------------------------------------------------- | -------------------------------------------------- |
| `@default(cuid())`          | Domyślny wybor - URL-safe, sortowalne, bez kolizji | Potrzebne sekwencyjne ID dla systemow zewnetrznych |
| `@default(autoincrement())` | Tabele wewnetrzne (join, audit)                    | Publiczne ID (zdradza liczbe rekordow)             |

### Schema Defaults

```prisma
model User {
  id        String    @id @default(cuid())
  email     String    @unique  // @unique juz tworzy indeks
  name      String
  role      Role      @default(USER)
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  deletedAt DateTime?

  @@index([createdAt])
}
```

- Dodaj `@@index` na kazdym kluczu obcym i kolumnie uzytej w `WHERE` lub `ORDER BY`.
- `updatedAt @updatedAt` ustawiane automatycznie TYLKO na `update` i `upsert` (patrz anti-pattern nizej).

### `include` vs `select`

|           | `include`                                  | `select`               |
| --------- | ------------------------------------------ | ---------------------- |
| Zwraca    | Wszystkie pola skalarne + wskazane relacje | Tylko wskazane pola    |
| Uzyj gdy  | Potrzebujesz wiekszosci pol plus relacje   | Hot paths, duze tabele |
| Wydajnosc | Mozliwe over-fetch na szerokich tabelach   | Minimalny payload      |

Nigdy nie zwracaj surowych encji Prisma z API - mapuj do DTO (kontrola eksponowanych pol, brak wyciekow `passwordHash` itd.).

### Transaction Form Selection

| Sytuacja                                 | Uzyj                       |
| ---------------------------------------- | -------------------------- |
| Niezalezne operacje, bez zaleznosci      | Forma tablicowa            |
| Pozniejszy krok zalezy od wczesniejszego | Forma interaktywna         |
| Zewnetrzne wywolania (email, HTTP)       | Poza transakcja calkowicie |

```ts
// Forma interaktywna - uzywaj TYLKO tx, nigdy zewnetrznego prisma
const post = await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({ where: { id } });
    if (user.role !== 'ADMIN') throw new Error('Forbidden');
    return tx.post.create({ data: { title, authorId: user.id } });
});
```

### PrismaClient Singleton

Kazda instancja `PrismaClient` otwiera wlasne polaczenia. Inicjalizuj raz, cache przez `globalThis` (chroni przed duplikatami przy hot reload / ts-node-dev):

```ts
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
export const prisma = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
```

### N+1 Problem

Ladowanie relacji w petli = jedno zapytanie na wiersz.

```ts
// ZLE: N+1 - jedno dodatkowe zapytanie na uzytkownika
const users = await prisma.user.findMany();
for (const user of users) {
    const posts = await prisma.post.findMany({ where: { authorId: user.id } });
}

// DOBRZE: jedno zapytanie
const users = await prisma.user.findMany({ include: { posts: true } });
```

## Anti-Patterns

### `updateMany` zwraca count, nie rekordy

```ts
// ZLE: wynik to { count: 2 } - users[0] jest undefined
const users = await prisma.user.updateMany({ where: { role: 'GUEST' }, data: { role: 'USER' } });

// DOBRZE: najpierw pobierz ID, potem update, potem tylko dotkniete wiersze
const targets = await prisma.user.findMany({ where: { role: 'GUEST' }, select: { id: true } });
const ids = targets.map((u) => u.id);
await prisma.user.updateMany({ where: { id: { in: ids } }, data: { role: 'USER' } });
const updated = await prisma.user.findMany({ where: { id: { in: ids } } });
```

To samo dotyczy `deleteMany` - zwraca `{ count: n }`, nigdy usunietych rekordow.

### `$transaction` interaktywna ma 5-sekundowy timeout

```ts
// ZLE: zewnetrzne wywolanie w transakcji przekracza domyslne 5s
await prisma.$transaction(async (tx) => {
  const user = await tx.user.findUniqueOrThrow({ where: { id } });
  await sendWelcomeEmail(user.email); // zewnetrzne - BLAD "Transaction already closed"
});

// DOBRZE: zewnetrzne wywolania poza transakcja
const user = await prisma.user.findUniqueOrThrow({ where: { id } });
await sendWelcomeEmail(user.email);

// Podnos timeout TYLKO gdy bulk naprawde tego wymaga
await prisma.$transaction(async (tx) => { ... }, { timeout: 30_000 });
```

### `migrate dev` moze zresetowac baze

`migrate dev` wykrywa drift schematu i moze zaproponowac reset, kasujac WSZYSTKIE dane.

```bash
# NIGDY na wspolnej bazie dev, staging ani produkcji
npx prisma migrate dev --name add_column

# Bezpieczne wszedzie poza lokalnym solo dev
npx prisma migrate deploy
```

> S.O.K. uzywa `prisma db push` na bazach bez historii migracji (brak `_prisma_migrations`) - patrz CONTRIBUTING.md. Na takich bazach `migrate deploy` NIE zadziala.

### Ręczna edycja pliku migracji psuje przyszle deploye

Prisma robi checksum kazdego pliku migracji. Edycja po zastosowaniu powoduje `P3006 checksum mismatch`. Tworz nowa migracje.

### `@updatedAt` nie dziala na `updateMany`

`@updatedAt` ustawiane jest tylko na `update` i `upsert`. Bulk zostawia stara wartosc.

```ts
// DOBRZE: ustaw recznie w operacji zbiorczej
await prisma.post.updateMany({
    where: { authorId },
    data: { published: true, updatedAt: new Date() }
});
```

### `deleteMany` bez `where` kasuje wszystkie wiersze

```ts
// ZLE: cicho czyści cala tabele
await prisma.post.deleteMany();

// DOBRZE
await prisma.post.deleteMany({ where: { authorId: userId } });
```

### Error Handling

```ts
import { Prisma } from '@prisma/client';

try {
    await prisma.user.create({ data: { email } });
} catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
        if (e.code === 'P2002') throw new ConflictError('Email already exists');
        if (e.code === 'P2025') throw new NotFoundError('Record not found');
        if (e.code === 'P2003') throw new BadRequestError('Referenced record does not exist');
    }
    throw e;
}
```

Catch na granicy serwisu i tlumacz na bledy domenowe. Nigdy nie eksponuj surowych komunikatow Prisma w API.

## Best Practices

| Regula                                                               | Powod                                           |
| -------------------------------------------------------------------- | ----------------------------------------------- |
| `migrate deploy` / `db push` w deployu, `migrate dev` tylko lokalnie | `migrate dev` moze zresetowac baze przy drifcie |
| Mapuj encje do DTO odpowiedzi                                        | Zapobiega wyciekowi wewnetrznych pol            |
| Lap `PrismaClientKnownRequestError` na granicy serwisu               | Tlumacz na bledy domenowe                       |
| Zawsze podawaj `where` na `deleteMany`                               | Zapobiega przypadkowemu wyczyszczeniu tabeli    |
| Ustaw `updatedAt: new Date()` recznie w `updateMany`                 | `@updatedAt` pomija bulk                        |

## Related Skills

- `database-migrations` - planowanie migracji dla produkcji
