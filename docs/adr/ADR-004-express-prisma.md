# ADR-004: Express + Prisma jako backend

**Status:** Zaakceptowany  
**Data:** 2026-06-20  
**Autor:** Hermes Agent  

## Kontekst

Backend aplikacji potrzebuje REST API do zarządzania ofertami, produktami, klientami 
i użytkownikami. Wymagany ORM dla SQLite i prostota utrzymania.

## Decyzja

**Express.js (TypeScript)** jako framework HTTP + **Prisma** jako ORM dla SQLite.

## Uzasadnienie

1. **Express.js** — najpopularniejszy framework Node, stabilny, dobrze udokumentowany.
2. **TypeScript** — type safety dla backendu, spójność typów z Prisma (generowane typy dla modeli).
3. **Prisma ORM** — typowane zapytania, migracje, seedowanie. Generator klienta tworzy pełne typy TS.
4. **Zod walidacja** — `validateData(schema)` dla POST/PUT, prosta integracja z Prisma.
5. **Znanana struktura** — `src/routes/` (HTTP tylko) → `src/services/` (biznes) → `src/middleware/` (auth/rate-limit).

## Konsekwencje

- **Singleton Prisma Client** — jeden `prismaClient.ts` dla całej aplikacji, importowany wszędzie.
- **SQLite busy_timeout** — `PRAGMA busy_timeout = 30000` w prismaClient.ts dla operacji współbieżnych.
- **Rate limiting** — per-route limiter dla wszystkich tras.
- **Helmet CSP** — `'unsafe-inline'` dozwolone dla legacy inline event handlerów.
- **Logger** — `src/utils/logger.ts` zamiast `console.log`.

## Architektura

```
src/
├── routes/
│   ├── offers/
│   │   ├── index.ts          # barrel export
│   │   └── offerRouter.ts    # HTTP handlers
│   ├── products/
│   ├── clients/
│   └── index.ts              # agregacja wszystkich routerów
├── services/
│   ├── pricelistService.ts
│   ├── auditService.ts
│   └── docx/                 # generatory DOCX
├── middleware/
│   ├── auth.ts               # requireAuth, requireAdmin, buildRoleWhereClause
│   └── rateLimiter.ts
├── validators/
│   └── *.ts                  # schematy Zod
├── utils/
│   ├── logger.ts
│   └── format.ts
└── prismaClient.ts           # singleton
```

## Alternatywy odrzucone

| Alternatywa | Powód odrzucenia |
|------------|------------------|
| NestJS | Zbyt duży framework dla tak prostej aplikacji, dużo boilerplate'u (modules, decorators, DI) |
| Fastify | Szybszy od Express, ale mniejszy ekosystem i brak kompatybilności z niektórymi middleware |
| Koa | Mniejsza społeczność, mniej ready-made middleware |
| Drizzle ORM | Nowy ORM, mniej stabilny niż Prisma. Brak generowanych typów dla SQLite w wersji 0.x |
