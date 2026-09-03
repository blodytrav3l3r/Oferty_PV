# API — dokumentacja endpointów

**Wersja:** 1.23.0  
**Ostatnia aktualizacja:** 2026-08-24  
**Dokumentacja Swagger/OpenAPI:** `/api/docs` (po uruchomieniu serwera) — źródło autorytatywne

> **Uwaga:** Pełna, zawsze aktualna dokumentacja API dostępna jest przez Swagger pod `/api/docs`.
> Poniższy opis może nie obejmować wszystkich endpointów — priorytetowo traktuj Swagger.

---

## Endpointy publiczne

### `GET /health`

Sprawdzenie statusu serwera. Używany przez Docker HEALTHCHECK i Render health check.

**Odpowiedź:**

```json
{
  "status": "ok",
  "timestamp": "2026-06-30T12:00:00.000Z",
  "uptime": 123.45,
  "memory": { ... },
  "version": "1.23.0"
}
```

### `GET /api/version`

Informacje o wersji aplikacji.

**Odpowiedź:**

```json
{
    "version": "1.23.0",
    "commitHash": "389dd6e",
    "branch": "main",
    "buildDate": "2026-08-09T00:00:00.000Z",
    "environment": "development",
    "dbVersion": "1.23.0"
}
```

---

## Autoryzacja (`/api/auth`)

Wszystkie endpointy auth (oprócz login) wymagają autoryzacji przez nagłówek `x-auth-token` lub ciasteczko `authToken`.

### `POST /api/auth/login`

Logowanie użytkownika. Zwraca token sesji i dane użytkownika.

**Body:**

```json
{
    "username": "admin",
    "password": "********"
}
```

**Odpowiedź (200):**

```json
{
    "token": "a1b2c3d4...",
    "user": {
        "id": "usr_admin",
        "username": "admin",
        "role": "admin",
        "firstName": "System",
        "lastName": "Admin",
        "phone": null,
        "email": null,
        "symbol": null,
        "subUsers": []
    }
}
```

**Rate limit:** 15 prób na 15 minut (LOGIN_LIMITER).

### `POST /api/auth/register`

Rejestracja nowego użytkownika (tylko administrator).

### `POST /api/auth/logout`

Wylogowanie — usunięcie sesji i wyczyszczenie ciasteczka.

### `GET /api/auth/me`

Pobranie danych aktualnie zalogowanego użytkownika.

### `POST /api/auth/change-password`

Zmiana hasła przez zalogowanego użytkownika.

---

## Użytkownicy (`/api/users`)

Wymaga autoryzacji.

| Metoda | Ścieżka          | Opis                          |
| ------ | ---------------- | ----------------------------- |
| GET    | `/api/users`     | Lista użytkowników            |
| GET    | `/api/users/:id` | Szczegóły użytkownika         |
| PUT    | `/api/users/:id` | Aktualizacja użytkownika      |
| DELETE | `/api/users/:id` | Usunięcie użytkownika (admin) |

### `GET /api/users-for-assignment`

Lista użytkowników do przypisania (wewnętrzny alias).

---

## Udostępnianie dokumentów (`/api/shares`)

Wymaga autoryzacji. Typy dokumentów: `offer`, `offer_studnie`, `order_rury`, `order_studnie`.

| Metoda | Ścieżka              | Opis                                                                     |
| ------ | -------------------- | ------------------------------------------------------------------------ |
| GET    | `/api/shares`        | Lista udostępnień dokumentu (`documentType` + `documentId` w query)      |
| POST   | `/api/shares`        | Udostępnij dokument (limit 50 odbiorców, `WRITE_LIMITER`)                |
| POST   | `/api/shares/revoke` | Cofnij udostępnienia wsadowo (`documentType` + `documentId` + `userIds`) |
| DELETE | `/api/shares/:id`    | Cofnij pojedyncze udostępnienie (`WRITE_LIMITER`)                        |

---

## Produkty — Rury (`/api/products`)

Wymaga autoryzacji.

| Metoda | Ścieżka                   | Opis                             |
| ------ | ------------------------- | -------------------------------- |
| GET    | `/api/products`           | Lista wszystkich produktów (rur) |
| GET    | `/api/products/:id`       | Szczegóły produktu               |
| POST   | `/api/products`           | Dodanie produktu                 |
| PUT    | `/api/products/:id`       | Aktualizacja produktu            |
| DELETE | `/api/products/:id`       | Usunięcie produktu               |
| PUT    | `/api/products/pricelist` | Aktualizacja całego cennika rur  |

Produkty są ładowane przez `prisma/seed.ts` z pliku `data/seed_rury.json`. Seed nie jest uruchamiany automatycznie przy starcie serwera — wykonuje go `scripts/ensure-db.bat` → `scripts/check-db.js` → `prisma/seed.ts` (ręcznie: `npm run prisma:seed`).

---

## Produkty — Studnie (`/api/products-studnie`)

Wymaga autoryzacji.

| Metoda | Ścieżka                           | Opis                                |
| ------ | --------------------------------- | ----------------------------------- |
| GET    | `/api/products-studnie`           | Lista wszystkich produktów (studni) |
| GET    | `/api/products-studnie/:id`       | Szczegóły produktu                  |
| POST   | `/api/products-studnie`           | Dodanie produktu                    |
| PUT    | `/api/products-studnie/:id`       | Aktualizacja produktu               |
| DELETE | `/api/products-studnie/:id`       | Usunięcie produktu                  |
| PUT    | `/api/products-studnie/pricelist` | Aktualizacja całego cennika studni  |

Produkty są ładowane przez `prisma/seed.ts` z pliku `data/seed_studnie.json` (nie automatycznie przy starcie serwera).

---

## Oferty — Rury (`/api/offers-rury`)

Wymaga autoryzacji.

| Metoda | Ścieżka                            | Opis                        |
| ------ | ---------------------------------- | --------------------------- |
| GET    | `/api/offers-rury`                 | Lista ofert rur             |
| GET    | `/api/offers-rury/:id`             | Szczegóły oferty            |
| POST   | `/api/offers-rury`                 | Utworzenie nowej oferty rur |
| PUT    | `/api/offers-rury/:id`             | Aktualizacja oferty         |
| DELETE | `/api/offers-rury/:id`             | Usunięcie oferty            |
| GET    | `/api/offers-rury/search?q=`       | Wyszukiwanie ofert          |
| GET    | `/api/offers-rury/:id/export-pdf`  | Eksport oferty do PDF       |
| GET    | `/api/offers-rury/:id/export-docx` | Eksport oferty do DOCX      |

---

## Oferty — Studnie (`/api/offers-studnie`)

Wymaga autoryzacji. Alias do `/api/offers-rury/studnie`.

| Metoda | Ścieżka                               | Opis                           |
| ------ | ------------------------------------- | ------------------------------ |
| GET    | `/api/offers-studnie`                 | Lista ofert studni             |
| GET    | `/api/offers-studnie/:id`             | Szczegóły oferty studni        |
| POST   | `/api/offers-studnie`                 | Utworzenie nowej oferty studni |
| PUT    | `/api/offers-studnie/:id`             | Aktualizacja oferty studni     |
| DELETE | `/api/offers-studnie/:id`             | Usunięcie oferty studni        |
| GET    | `/api/offers-studnie/:id/export-pdf`  | Eksport do PDF                 |
| GET    | `/api/offers-studnie/:id/export-docx` | Eksport do DOCX                |

---

## Zamówienia — Rury (`/api/orders-rury`)

Wymaga autoryzacji.

| Metoda | Ścieżka                                      | Opis                          |
| ------ | -------------------------------------------- | ----------------------------- |
| GET    | `/api/orders-rury`                           | Lista zamówień rur            |
| GET    | `/api/orders-rury/:id`                       | Szczegóły zamówienia          |
| POST   | `/api/orders-rury`                           | Utworzenie zamówienia         |
| PUT    | `/api/orders-rury/:id`                       | Aktualizacja zamówienia       |
| PATCH  | `/api/orders-rury/:id`                       | Częściowa aktualizacja        |
| DELETE | `/api/orders-rury/:id`                       | Anulowanie zamówienia         |
| POST   | `/api/orders-rury/claim-rury-number/:userId` | Przypisanie numeru zamówienia |
| GET    | `/api/orders-rury/:id/export-pdf`            | Eksport zamówienia do PDF     |
| GET    | `/api/orders-rury/:id/export-docx`           | Eksport zamówienia do DOCX    |
| GET    | `/api/orders-rury/:id/export-karta-pdf`      | Eksport karty budowy do PDF   |
| GET    | `/api/orders-rury/:id/export-karta-docx`     | Eksport karty budowy do DOCX  |

## Zamówienia — Studnie (`/api/orders-studnie`)

Wymaga autoryzacji.

| Metoda | Ścieżka                                     | Opis                               |
| ------ | ------------------------------------------- | ---------------------------------- |
| GET    | `/api/orders-studnie`                       | Lista zamówień studni              |
| GET    | `/api/orders-studnie/:id`                   | Szczegóły zamówienia               |
| PUT    | `/api/orders-studnie`                       | Utworzenie/aktualizacja zamówienia |
| PATCH  | `/api/orders-studnie/:id`                   | Częściowa aktualizacja             |
| DELETE | `/api/orders-studnie/:id`                   | Anulowanie zamówienia              |
| GET    | `/api/orders-studnie/:id/export-pdf`        | Eksport zamówienia do PDF          |
| GET    | `/api/orders-studnie/:id/export-docx`       | Eksport zamówienia do DOCX         |
| GET    | `/api/orders-studnie/:id/export-karta-pdf`  | Eksport karty budowy do PDF        |
| GET    | `/api/orders-studnie/:id/export-karta-docx` | Eksport karty budowy do DOCX       |

## Zlecenia produkcyjne (`/api/orders-studnie/production`)

Wymaga autoryzacji.

| Metoda | Ścieżka                                       | Opis                                        |
| ------ | --------------------------------------------- | ------------------------------------------- |
| GET    | `/api/orders-studnie/production`              | Lista zleceń produkcyjnych (PZ)             |
| POST   | `/api/orders-studnie/production`              | Utworzenie zlecenia produkcyjnego           |
| PUT    | `/api/orders-studnie/production`              | Aktualizacja zlecenia produkcyjnego         |
| GET    | `/api/orders-studnie/production/:id`          | Szczegóły zlecenia                          |
| DELETE | `/api/orders-studnie/production/:id`          | Usunięcie zlecenia (writeProductionLimiter) |
| POST   | `/api/orders-studnie/production/batch-delete` | Masowe usunięcie (chunkowane po 200 ids)    |

## Wyszukiwanie produkcji (`/api/orders-studnie/production/search`)

Wymaga autoryzacji. Wyszukiwanie z kursorem (infinite scroll), paginacja po znormalizowanym `createdAt`.

| Metoda | Ścieżka                                 | Opis                   |
| ------ | --------------------------------------- | ---------------------- |
| GET    | `/api/orders-studnie/production/search` | Wyszukiwanie zleceń PZ |

## Numeracja (`/api/orders-studnie`)

Wymaga autoryzacji. Montowana przed trasami `/:id` (barrel `orders/index.ts`).

| Metoda | Ścieżka                                               | Opis                         |
| ------ | ----------------------------------------------------- | ---------------------------- |
| GET    | `/api/orders-studnie/next-number/:userId`             | Następny numer zamówienia    |
| POST   | `/api/orders-studnie/claim-number/:userId`            | Rezerwacja numeru zamówienia |
| POST   | `/api/orders-studnie/claim-production-number/:userId` | Rezerwacja numeru PZ         |
| GET    | `/api/orders-studnie/recycled`                        | Recykling numerów            |

## Klienci (`/api/clients`)

Wymaga autoryzacji.

| Metoda | Ścieżka              | Opis                                          |
| ------ | -------------------- | --------------------------------------------- |
| GET    | `/api/clients`       | Lista klientów (dla zalogowanego użytkownika) |
| GET    | `/api/clients/:id`   | Szczegóły klienta                             |
| POST   | `/api/clients`       | Dodanie klienta                               |
| PUT    | `/api/clients/:id`   | Aktualizacja klienta                          |
| DELETE | `/api/clients/:id`   | Usunięcie klienta                             |
| POST   | `/api/clients/batch` | Dodanie wielu klientów naraz (batch)          |

---

## Audyt (`/api/audit`)

Wymaga autoryzacji (administrator).

| Metoda | Ścieżka                            | Opis                        |
| ------ | ---------------------------------- | --------------------------- |
| GET    | `/api/audit`                       | Lista logów audytowych      |
| GET    | `/api/audit/:entityType/:entityId` | Logi dla konkretnego zasobu |

---

## Ustawienia (`/api/settings`)

Wymaga autoryzacji (administrator).

| Metoda | Ścieżka              | Opis                            |
| ------ | -------------------- | ------------------------------- |
| GET    | `/api/settings`      | Pobranie wszystkich ustawień    |
| GET    | `/api/settings/:key` | Pobranie konkretnego ustawienia |
| PUT    | `/api/settings/:key` | Aktualizacja ustawienia         |

---

## Preco Pricing (`/api/preco-pricing`)

Wymaga autoryzacji.

| Metoda | Ścieżka                      | Opis                              |
| ------ | ---------------------------- | --------------------------------- |
| GET    | `/api/preco-pricing`         | Pobranie cennika Preco            |
| PUT    | `/api/preco-pricing`         | Aktualizacja cennika Preco        |
| PATCH  | `/api/preco-pricing`         | Częściowa aktualizacja            |
| GET    | `/api/preco-pricing/default` | Pobranie domyślnego cennika Preco |

## Domyślne cenniki (`/api/price-overrides`)

Wymaga autoryzacji (administrator). Zapisuje bieżący stan wszystkich cenników (rury, studnie, PRECO) jako nowe domyślne (`*_Default`) oraz do pliku `data/price_defaults.json` (transfer między komputerami).

| Metoda | Ścieżka                              | Opis                                   |
| ------ | ------------------------------------ | -------------------------------------- |
| POST   | `/api/price-overrides/save-defaults` | Zapis bieżących cenników jako domyślne |

## Łączny eksport (`/api/export-combined`)

Wymaga autoryzacji. Łączy oferty rur i studni w jeden dokument.

| Metoda | Ścieżka                     | Opis                             |
| ------ | --------------------------- | -------------------------------- |
| POST   | `/api/export-combined/pdf`  | Eksport do PDF (EXPORT_LIMITER)  |
| POST   | `/api/export-combined/docx` | Eksport do DOCX (EXPORT_LIMITER) |

---

## Telemetria AI (`/api/telemetry/ai`)

Wymaga autoryzacji. Telemetria jest **pasywna** — solver JS pozostaje źródłem prawdy **reguł** doboru komponentów studni. AI (dual-ranking) może wybrać innego kandydata spośród kandydatów solvera — wtedy `solverSource: 'AI_SUGGEST'`.

| Metoda | Ścieżka                             | Opis                                                    |
| ------ | ----------------------------------- | ------------------------------------------------------- |
| POST   | `/api/telemetry/ai/config`          | Zapis pełnej konfiguracji studni z kontekstem           |
| POST   | `/api/telemetry/ai/event`           | Pojedyncze zdarzenie (user_change, accept, itp.)        |
| POST   | `/api/telemetry/ai/version`         | Rejestracja nowej wersji solvera/reguł/AI               |
| POST   | `/api/telemetry/ai/acceptance-full` | Rozszerzony acceptance (oferta + akceptacja + snapshot) |

### `POST /api/telemetry/ai/config` — deduplikacja AUTO_JS

Konfiguracje pochodzące ze źródła `AUTO_JS` są **deduplikowane**: jeżeli dla tej samej studni najnowszy rekord AUTO_JS ma identyczny kanoniczny `featureSnapshot` oraz ten sam zbiór `allComponentIds`, **nie powstaje nowy rekord** — aktualizowany jest istniejący (zwiększenie `usageCount`, odświeżenie `lastUsedAt`, opcjonalnie aktualizacja `offerId`/`clientId`/`projectId`/`warehouse`). Porównanie jest deterministyczne (stabilna kolejność kluczy JSON, posortowana lista komponentów). Źródła `MANUAL`/`AI_SUGGEST` zawsze tworzą nowe rekordy (sygnały decyzji użytkownika).

Odpowiedź (200):

```json
{
    "success": true,
    "telemetryId": "uuid-rekordu",
    "configHistoryId": "uuid-historii (gdy wellId znany)",
    "transitionsCreated": 3
}
```

W przypadku duplikatu AUTO_JS: `telemetryId` = id istniejącego rekordu, `configHistoryId` = `undefined`, `transitionsCreated` = `0`.

## Dashboard AI — Learning Engine / Knowledge Base (`/api/telemetry/ai`)

Wymaga autoryzacji (administrator).

| Metoda | Ścieżka                                | Opis                                                   |
| ------ | -------------------------------------- | ------------------------------------------------------ |
| POST   | `/api/telemetry/ai/learning/run`       | Wymuszenie pełnego cyklu uczenia (analiza historyczna) |
| GET    | `/api/telemetry/ai/knowledge/patterns` | Lista wzorców w bazie wiedzy per DN                    |
| GET    | `/api/telemetry/ai/knowledge/stats`    | Statystyki bazy wiedzy                                 |

### `GET /api/telemetry/ai/knowledge/patterns`

Parametry: `?dn=all_dn` (domyślnie) oraz `?minConfidence=0.3` (domyślnie).

Pola odpowiedzi (oprócz listy `items`):

| Pole              | Opis                                                      |
| ----------------- | --------------------------------------------------------- |
| `telemetryCount`  | Całkowita liczba rekordów telemetry (`ai_telemetry_logs`) |
| `patternsTotal`   | Całkowita liczba wzorców w bazie wiedzy (wszystkie DN)    |
| `patternsOtherDn` | Wzorce dla innych średnic (różnica względem `all_dn`)     |
| `lastRunAt`       | Czas ostatniego cyklu Learning Engine (ISO) lub `null`    |

## ML Pipeline (`/api/telemetry/ai`)

Wymaga autoryzacji.

| Metoda | Ścieżka                                 | Opis                                                 |
| ------ | --------------------------------------- | ---------------------------------------------------- |
| POST   | `/api/telemetry/ai/predict/batch`       | Predykcja batch dla kandydujących konfiguracji       |
| POST   | `/api/telemetry/ai/reward`              | Zapis nagrody (reward) za akcję                      |
| GET    | `/api/telemetry/ai/settings`            | Poziom wpływu AI (`wells_ai_influence`)              |
| POST   | `/api/telemetry/ai/settings`            | Ustawienie wpływu AI 0–100 (admin)                   |
| GET    | `/api/telemetry/ai/ml-status`           | Status pipeline ML (model, trening, cache, retencja) |
| GET    | `/api/telemetry/ai/health`              | Health ML + metryki jakości danych                   |
| GET    | `/api/telemetry/ai/models`              | Lista modeli                                         |
| DELETE | `/api/telemetry/ai/models/:id`          | Usunięcie modelu (admin)                             |
| POST   | `/api/telemetry/ai/models/:id/activate` | Aktywacja modelu (admin)                             |
| POST   | `/api/telemetry/ai/train`               | Wymuszenie trenowania modelu (admin)                 |
| GET    | `/api/telemetry/ai/feature-schema`      | Wersja i nazwy cech ML                               |
| POST   | `/api/telemetry/ai/rollback`            | Rollback do poprzedniego modelu (admin)              |

## Feature Flags (`/api/feature-flags`)

Wymaga autoryzacji (administrator).

| Metoda | Ścieżka                   | Opis                      |
| ------ | ------------------------- | ------------------------- |
| GET    | `/api/feature-flags`      | Lista flag funkcjonalnych |
| PUT    | `/api/feature-flags/:key` | Aktualizacja flagi        |

---

## Rate Limiting

| Limiter                  | Okno   | Max prób | Endpointy                                                                              |
| ------------------------ | ------ | -------- | -------------------------------------------------------------------------------------- |
| LOGIN_LIMITER            | 15 min | 15       | `/api/auth/login`                                                                      |
| API_LIMITER              | 15 min | 300      | Wszystkie endpointy `/api/*`                                                           |
| WRITE_LIMITER            | 15 min | 60       | Zapis danych (POST/PUT/DELETE)                                                         |
| PRICELIST_WRITE_LIMITER  | 1 godz | 30       | Aktualizacja cenników (`/api/products*`, `/api/preco-pricing`, `/api/price-overrides`) |
| EXPORT_LIMITER           | 15 min | 20       | Eksport PDF/DOCX (`/api/export-combined/*`, `/:id/export-*`)                           |
| WRITE_PRODUCTION_LIMITER | 1 min  | 30       | Zlecenia produkcyjne (`DELETE /api/orders-studnie/production/:id`)                     |

---

## Uwagi

- Wszystkie endpointy (oprócz `/health` i `/api/auth/login`) zwracają `401` przy braku autoryzacji.
- Token autoryzacyjny można przekazać przez nagłówek `x-auth-token` lub ciasteczko `authToken`.
- W produkcji ciasteczko `authToken` ma flagę `Secure` (wymaga HTTPS).
- Pełną dokumentację OpenAPI ze schematami i przykładami znajdziesz pod `/api/docs`.
