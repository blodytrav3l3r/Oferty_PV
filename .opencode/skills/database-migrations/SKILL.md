---
name: database-migrations
description: Database migration best practices for schema changes, data migrations, rollbacks, and safe deploys. Zadaptowano pod S.O.K. (Prisma + SQLite, workflow db push / migrate deploy).
metadata:
    origin: ECC (zaadaptowano pod S.O.K. / SQLite)
---

# Database Migration Patterns

Bezpieczne, odwracalne zmiany schematu bazy w systemach produkcyjnych.

> S.O.K.: Prisma + SQLite. Sposob synchronizacji schematu zalezy od historii bazy:
>
> - **Baza utworzona przez `prisma db push`** (brak tabeli `_prisma_migrations`): `npx prisma db push --skip-generate --accept-data-loss`
> - **Baza z historia migracji**: `npx prisma migrate deploy`
> - Jak sprawdzic: `npx prisma migrate status`

## When to Activate

- Tworzenie lub modyfikacja tabel
- Dodawanie/usuwanie kolumn i indeksow
- Migracje danych (backfill, transformacja)
- Zmiany schematu na produkcji

## Core Principles

1. **Kazda zmiana to migracja** - nigdy nie modyfikuj bazy produkcyjnej recznie
2. **Migracje sa forward-only na produkcji** - rollback przez nowe forward migracje
3. **Migracje schematu i danych sa osobno** - nigdy nie mieszaj DDL i DML w jednej migracji
4. **Migracje sa niezmienne po wdrozeniu** - nigdy nie edytuj migracji, ktora juz wystartowala
5. **Zawsze backup przed migracja**: `npm run backup`

## Migration Safety Checklist

Przed zastosowaniem jakiejkolwiek migracji:

- [ ] Backup wykonany (`npm run backup`)
- [ ] Migracja ma UP/DOWN lub jest jawnie oznaczona jako nieodwracalna
- [ ] Nowe kolumny maja domyslne wartosci lub sa nullable (nigdy NOT NULL bez default)
- [ ] Backfill danych to osobna migracja od zmiany schematu
- [ ] Przetestowane na kopii danych produkcyjnych
- [ ] Plan rollbacku udokumentowany

## Prisma Workflow (S.O.K.)

```bash
# Utworzenie migracji ze zmian schematu (tylko lokalnie!)
npx prisma migrate dev --name add_column

# Zastosowanie oczekujacych migracji na produkcji
npx prisma migrate deploy

# Generowanie klienta po zmianie schematu
npx prisma generate

# Reset bazy (tylko dev! kasuje dane)
npx prisma migrate reset
```

### Custom SQL Migration

Dla operacji, ktorych Prisma nie wyraza (indeksy, backfill danych):

```bash
npx prisma migrate dev --create-only --name add_email_index
```

Edytuj SQL recznie w wygenerowanym pliku `migration.sql`.

## Breakące zmiany schematu - podejscie wielokrokowe

Dodanie `NOT NULL` do istniejacej kolumny lub rename kolumny w jednej migracji zablokuje tabele lub zgubi dane. Uzyj expand-and-contract:

```bash
# Krok 1: utworz migracje lokalnie, potem deploy
npx prisma migrate dev --name add_new_column   # lokalnie
npx prisma migrate deploy                       # staging / produkcja
```

```ts
// Krok 2: backfill danych (skrypt lub job, nie powloka)
await prisma.user.updateMany({ data: { newColumn: derivedValue } });
```

```bash
# Krok 3: migracja NOT NULL
npx prisma migrate dev --name make_new_column_required  # lokalnie
npx prisma migrate deploy                               # staging / produkcja
```

## Anti-Patterns

| Anti-pattern                            | Dlaczego zawodzi                    | Lepsze podejscie                     |
| --------------------------------------- | ----------------------------------- | ------------------------------------ |
| Reczny SQL na produkcji                 | Brak audytu, niepowtarzalne         | Zawsze pliki migracji                |
| Edycja wdrozonych migracji              | Drift miedzy srodowiskami           | Nowa migracja                        |
| NOT NULL bez default                    | Blokada tabeli, przepisanie wierszy | Nullable, backfill, potem constraint |
| Schema + dane w jednej migracji         | Trudny rollback, dlugie transakcje  | Osobne migracje                      |
| Kasowanie kolumny przed usunieciem kodu | Bledy aplikacji                     | Najpierw kod, potem kolumna          |

## Related Skills

- `prisma-patterns` - trapy Prisma (updateMany, $transaction, migracje)
