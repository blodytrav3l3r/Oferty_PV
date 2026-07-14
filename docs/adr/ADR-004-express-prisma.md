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
│   ├── auth.ts               # logowanie, rejestracja, wylogowanie
│   ├── users.ts              # zarządzanie użytkownikami
│   ├── clients.ts            # CRUD klientów
│   ├── productsV2.ts         # CRUD produktów (rury)
│   ├── productsStudnieV2.ts  # CRUD produktów (studnie)
│   ├── settings.ts           # ustawienia systemowe
│   ├── audit.ts              # logi audytowe
│   ├── telemetry.ts          # telemetria AI
│   ├── telemetryAi.ts        # endpointy AI (predykcje, rekomendacje)
│   ├── telemetryAiMl.ts      # pipeline ML (trenowanie, ewaluacja)
│   ├── telemetryAiDashboard.ts # dashboard telemetrii
│   ├── featureFlags.ts       # flagi funkcjonalne
│   ├── pvMarketplace.ts      # PV Marketplace
│   ├── precoPricingV2.ts     # cenniki Preco
│   ├── offers/               # oferty (rury i studnie)
│   │   ├── index.ts          # barrel export
│   │   ├── crud.ts           # CRUD (dispatcher)
│   │   ├── ruryCrud.ts       # HTTP handlers (rury)
│   │   ├── studnieCrud.ts    # HTTP handlers (studnie)
│   │   └── exports.ts        # eksport PDF/DOCX
│   └── orders/               # zamówienia
│       ├── index.ts          # barrel export
│       ├── ruryOrders.ts     # zamówienia rur
│       ├── studnieOrders.ts  # zamówienia studni
│       ├── numbering.ts      # numeracja zamówień
│       └── production.ts     # zamówienia produkcyjne
├── services/
│   ├── auditService.ts       # logowanie zmian w bazie
│   ├── pricelistService.ts   # zarządzanie cennikami
│   ├── pdfGenerator.ts       # generowanie PDF (Puppeteer)
│   ├── docx/                 # generatory DOCX (rury, studnie)
│   ├── telemetry/            # telemetria AI + learning engine
│   └── ml/                   # pipeline ML (konfigurator studni)
├── middleware/
│   ├── auth.ts               # requireAuth, requireAdmin
│   ├── security.ts           # nagłówki bezpieczeństwa, HTTPS redirect
│   ├── rateLimiter.ts        # rate limiting (starszy)
│   ├── rateLimiters.ts       # rate limiting (nowy)
│   ├── errorHandler.ts       # globalna obsługa błędów
│   └── requestLogger.ts      # logowanie żądań HTTP
├── validators/
│   ├── authSchema.ts         # schematy auth
│   ├── offerSchemas.ts       # schematy ofert
│   └── telemetrySchemas.ts   # schematy telemetrii
├── utils/
│   ├── logger.ts             # logger
│   ├── cronService.ts        # serwis cron
│   ├── ownership.ts          # filtrowanie własności
│   └── roleFilter.ts         # filtrowanie po roli
└── prismaClient.ts           # singleton Prisma Client
```

## Alternatywy odrzucone

| Alternatywa | Powód odrzucenia                                                                            |
| ----------- | ------------------------------------------------------------------------------------------- |
| NestJS      | Zbyt duży framework dla tak prostej aplikacji, dużo boilerplate'u (modules, decorators, DI) |
| Fastify     | Szybszy od Express, ale mniejszy ekosystem i brak kompatybilności z niektórymi middleware   |
| Koa         | Mniejsza społeczność, mniej ready-made middleware                                           |
| Drizzle ORM | Nowy ORM, mniej stabilny niż Prisma. Brak generowanych typów dla SQLite w wersji 0.x        |
