# TypeScript Coding Style (zaadaptowano pod S.O.K.)

> Zrodlo: ECC typescript/coding-style.md. Zgodne z AGENTS.md projektu (backend TypeScript
>
> - Express + Prisma + SQLite).

## Core Principles

### Strong Typing

- Kazda wartosc ma jawny typ (nigdy `any` bez powodu)
- Uzywaj `unknown` zamiast `any` dla nieznanych danych
- Type guards dla zawęzania typow z zewnetrznych danych

### Immutability

- Preferuj `readonly` w typach
- Nie mutuj oryginalnych tablic - zawsze kopia przed sort (baza bledow #15)

### Error Handling

- Nigdy nie polykaj bledow po cichu (silent fail)
- Error boundaries i konwersja bledow do domenowych na granicy serwisu
- Obsluga `PrismaClientKnownRequestError` na granicy serwisu (baza bledow #9, trapy Prisma)

## Style

- Prettier: pojedyncze cudzyslopy `'`, sredniki `;`, wciecia spacjami (bez tabulatorow)
- `npm run format` po kazdych zmianach (Spójność formatowania - Format SSoT)
- Nazwy: camelCase dla zmiennych/funkcji, PascalCase dla typow/interfejsow/klas,
  UPPER_SNAKE dla stalych

## File Organization

- Preferowane rozmiary (AGENTS.md, zalecenia): funkcje ~100-150 linii,
  klasy ~500-800 linii, pliki ~1000-1500 linii
- Nie dziel wylacznie ze wzgledu na linie - ocen spojnosc odpowiedzialnosci (SRP)

## Specific S.O.K. Patterns

- Backend: `src/`, `server.ts`, `scripts/`, `tests/`
- Kompilacja tsc tylko dla: `src/**`, `server.ts`, `scripts/**`, `tests/**`
- Frontend (public/js/) NIE jest kompilowany przez tsc - sprawdzany przez
  `typecheck:frontend` i `lint:frontend`
- Walidacja danych: `zod` v4 (w dependencies)
- DTO w odpowiedziach API - nigdy surowe encje Prisma

## Checklist

- [ ] Typy jawnie zdefiniowane (bez `any`)
- [ ] Kod zformatowany (`npm run format`)
- [ ] Typcheck przechodzi (`npm run typecheck`)
- [ ] Bledy obslugiwane jawnie
- [ ] `zod` do walidacji danych wejsciowych
