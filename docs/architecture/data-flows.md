# S.O.K. — architektura i przepływy danych

- **Zweryfikowano:** 2026-11-06
- **HEAD:** `5ab15ac077d8eb94e66bcb08bac9d3c19d09f53f`
- **Zakres:** diagramy na poziomie warstw i potwierdzonych przepływów. Nie są specyfikacją payloadów ani zamiennikiem implementacji.
- **Legenda:** stan przepływu potwierdzony przez podane źródła; rozgałęzienia i szczegóły per feature należy czytać w kodzie.

## 1. Architektura ogólna

```mermaid
flowchart LR
    User[Użytkownik]
    Browser[Przeglądarka: app.html / Vanilla JS]
    Shell[SPA shell i iframe modułu]
    Express[Express: statyczne pliki / middleware / API]
    Route[Router i walidacja]
    Service[Usługi domenowe]
    Prisma[Prisma Client + adapter-pg]
    PG[(PostgreSQL 18)]

    User --> Browser
    Browser --> Shell
    Shell -->|same-origin HTTP| Express
    Express --> Route --> Service --> Prisma --> PG
    Express -->|public/| Browser
```

Źródła: [router SPA](../../public/js/spa/router.js), [Express app](../../src/app.ts), [montowanie tras](../../src/mountRoutes.ts), [Prisma client](../../src/prismaClient.ts), [schema](../../prisma/schema.prisma).

## 2. Zapis oferty

```mermaid
sequenceDiagram
    actor User as Użytkownik
    participant UI as Moduł Rury/Studnie
    participant API as Express API
    participant CRUD as Offer CRUD route
    participant DB as Prisma/PostgreSQL

    User->>UI: Zapisuje ofertę
    UI->>API: Żądanie API oferty
    API->>CRUD: Sesja, walidacja i reguły domenowe
    CRUD->>DB: Transakcja: dokument + pieczątka cennika + wersja
    DB-->>CRUD: Zapisany dokument
    CRUD-->>API: Wynik zapisu / błąd walidacji lub konfliktu
    API-->>UI: Odpowiedź HTTP
```

Dotyczy wyłącznie przebiegu zapisu potwierdzonego przez trasy CRUD: [Rury](../../src/routes/offers/ruryCrud.ts), [Studnie](../../src/routes/offers/studnieCrud.ts). Inwarianty: [snapshot ceny i wersjonowanie](../SYSTEM_INVARIANTS.md#L7-L14), [optimistic locking](../SYSTEM_INVARIANTS.md#L92-L100), [źródło cen](../SYSTEM_INVARIANTS.md#L161-L179). Konkretne kształty payloadów są w walidatorach i [API](../API.md).

## 3. Odczyt ofert w kartotece

```mermaid
sequenceDiagram
    actor User as Użytkownik
    participant UI as Kartoteka
    participant API as GET /api/offers/search
    participant Search as Search route/service
    participant DB as Prisma/PostgreSQL

    User->>UI: Ustawia filtry i wyszukuje
    UI->>API: Query parameters, cursor i limit
    API->>Search: Parsowanie / walidacja / search
    Search->>DB: Odczyt dopasowanej strony wyników
    DB-->>Search: Wyniki
    Search-->>API: Wyniki i metadane paginacji
    API-->>UI: Odpowiedź HTTP z wynikami
    UI-->>User: Render listy ofert
```

Źródła: [UI wyszukiwania kartoteki](../../public/js/kartoteka/kartotekaSearch.js), [search route](../../src/routes/offers/search.ts), [wyszukiwanie API](../API.md#L243-L255). Wartości sortowania, filtry i paginacja zależą od walidacji route.

## 4. Wybór i import aktywnych cenników

```mermaid
flowchart TD
    Bundle[data/pricelists/active-pricelists.json]
    Verify[Walidacja schematu, liczników i SHA-256]
    Migrate[Prisma migrate deploy]
    Seed[Seed systemowy]
    Import[Import zatwierdzonych wersji Rury, Studnie i PRECO]
    Prices[prices:verify]
    Ready[Uruchomienie aplikacji / readiness]

    Bundle --> Verify
    Migrate --> Seed --> Import
    Verify --> Import
    Import --> Prices --> Ready
```

Źródła kolejności instalacji: [pakiet cenników](../cutover/active-pricelists.md), [importer](../../scripts/import-active-pricelists.ts), [instalator Linux](../../install-linux-server.sh), [README](../../README.md). Pakiet świeżej instalacji zawiera jedną aktywną wersję każdego typu; nie odtwarza historycznych wersji, ofert ani klientów.

## 5. Synchronizacja draftu

```mermaid
sequenceDiagram
    participant UI as Frontend draftSync
    participant API as /api/drafts
    participant Service as draftService
    participant DB as Prisma/PostgreSQL

    UI->>API: GET własnego draftu
    API->>Service: Odczyt per user/kind/docId
    Service->>DB: Odczyt wersji i payloadu
    DB-->>Service: Draft + wersja
    Service-->>API: Draft
    API-->>UI: Draft + ETag
    UI->>API: PUT z If-Match
    API->>Service: Waliduj precondition i payload
    Service->>DB: Compare-and-swap wersji
    alt wersja nadal aktualna
        DB-->>Service: Zapis potwierdzony
        Service-->>API: Nowa wersja
        API-->>UI: Potwierdzenie + nowy ETag
    else wersja konfliktowa lub brak precondition
        Service-->>API: Konflikt lub brak precondition
        API-->>UI: 409 conflict lub 428 precondition required
    end
```

Źródła: [draft service](../../src/services/drafts/draftService.ts), [draft routes](../../src/routes/drafts.ts), [frontend](../../public/js/shared/draftSync.js), [inwariant I-013](../SYSTEM_INVARIANTS.md#L134-L158). W konfliktowym scenariuszu lokalny draft nie może być po cichu utracony.

## 6. Uwierzytelnienie i żądanie chronione

```mermaid
sequenceDiagram
    actor User as Użytkownik
    participant UI as Browser
    participant Auth as Express /api/auth
    participant API as Chroniony route

    User->>UI: Logowanie
    UI->>Auth: Login request
    Auth-->>UI: Sesyjne cookie authToken
    UI->>Auth: GET /api/auth/me
    Auth-->>UI: Potwierdzona sesja
    UI->>API: Same-origin żądanie API z cookie
    API->>API: AuthZ, walidacja i CSRF dla mutacji
```

Źródła: [frontend auth](../../public/js/shared/auth.js), [backend auth middleware](../../src/middleware/auth.ts), [CSRF](../../src/middleware/csrf.ts), [API registration](../../src/mountRoutes.ts). Szczegółowe role należą do konkretnego endpointu: [security](../SECURITY.md) i [macierz uprawnień](../security/permission-matrix.md).

## 7. Instalacja / wdrożenie i readiness

```mermaid
flowchart LR
    Release[Repo / obraz aplikacji]
    Env[Jawne sekrety i URL PostgreSQL]
    DB[PostgreSQL 18]
    Bootstrap[Migracje i role przez bootstrap/migrator]
    Price[Seed oraz import aktywnych cenników]
    App[Start Express]
    Health[GET /health/ready]

    Release --> Env
    Env --> DB
    DB --> Bootstrap --> Price --> App --> Health
```

Źródła: [Compose](../../docker-compose.yml), [Dockerfile](../../Dockerfile), [bootstrap migracji](../../scripts/docker-db-bootstrap.sh), [wdrożenie](../DEPLOYMENT.md), [instalacja Linux](../../install-linux-server.sh). **UNKNOWN:** istnienie workflow skryptu nie potwierdza czystej instalacji na docelowym Linux ani produkcyjnego cutoveru.
