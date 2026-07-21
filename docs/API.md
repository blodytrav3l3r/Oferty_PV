# API — dokumentacja endpointów

**Wersja:** 1.9.0  
**Dokumentacja Swagger/OpenAPI:** `/api/docs` (po uruchomieniu serwera)

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
  "version": "v24.14.1"
}
```

### `GET /api/version`

Informacje o wersji aplikacji.

**Odpowiedź:**

```json
{
    "version": "1.9.0",
    "name": "WITROS Oferty",
    "node": "v24.14.1"
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

Produkty są automatycznie seedowane z pliku `data/seed_rury.json` przy starcie serwera, jeśli tabela jest pusta.

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

Produkty są automatycznie seedowane z pliku `data/seed_studnie.json`.

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
| GET    | `/api/offers-rury/:id/export-pdf`  | Eksport oferty do PDF       |
| GET    | `/api/offers-rury/:id/export-docx` | Eksport oferty do DOCX      |
| PUT    | `/api/offers-rury/dispatch`        | Wysyłka (dispatch) ofert    |

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

| Metoda | Ścieżka                        | Opis                                  |
| ------ | ------------------------------ | ------------------------------------- |
| GET    | `/api/orders-rury`             | Lista zamówień rur                    |
| GET    | `/api/orders-rury/:id`         | Szczegóły zamówienia                  |
| POST   | `/api/orders-rury`             | Utworzenie zamówienia                 |
| PUT    | `/api/orders-rury/:id`         | Aktualizacja zamówienia               |
| DELETE | `/api/orders-rury/:id`         | Anulowanie zamówienia                 |
| GET    | `/api/orders-rury/next-number` | Pobranie następnego numeru zamówienia |

---

## Zamówienia — Studnie (`/api/orders-studnie`)

Wymaga autoryzacji.

| Metoda | Ścieżka                           | Opis                                  |
| ------ | --------------------------------- | ------------------------------------- |
| GET    | `/api/orders-studnie`             | Lista zamówień studni                 |
| GET    | `/api/orders-studnie/:id`         | Szczegóły zamówienia                  |
| POST   | `/api/orders-studnie`             | Utworzenie zamówienia                 |
| PUT    | `/api/orders-studnie/:id`         | Aktualizacja zamówienia               |
| DELETE | `/api/orders-studnie/:id`         | Anulowanie zamówienia                 |
| GET    | `/api/orders-studnie/next-number` | Pobranie następnego numeru zamówienia |

---

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

## PV Marketplace (`/api/pv-marketplace`)

Wymaga autoryzacji.

| Metoda | Ścieżka               | Opis                       |
| ------ | --------------------- | -------------------------- |
| GET    | `/api/pv-marketplace` | Lista danych z marketplace |
| POST   | `/api/pv-marketplace` | Dodanie danych marketplace |

---

## Preco Pricing (`/api/preco-pricing`)

Wymaga autoryzacji.

| Metoda | Ścieżka              | Opis                       |
| ------ | -------------------- | -------------------------- |
| GET    | `/api/preco-pricing` | Pobranie cennika Preco     |
| PUT    | `/api/preco-pricing` | Aktualizacja cennika Preco |

---

## Telemetria (`/api/telemetry`)

| Metoda | Ścieżka          | Opis                                   |
| ------ | ---------------- | -------------------------------------- |
| POST   | `/api/telemetry` | Zapisanie zdarzenia telemetrycznego AI |
| GET    | `/api/telemetry` | Pobranie logów telemetrii              |

## AI / Predykcje (`/api/telemetry-ai`)

Wymaga autoryzacji.

| Metoda | Ścieżka                       | Opis                              |
| ------ | ----------------------------- | --------------------------------- |
| GET    | `/api/telemetry-ai/recommend` | Rekomendacje konfiguracji studni  |
| GET    | `/api/telemetry-ai/ranking`   | Ranking rekomendacji              |
| POST   | `/api/telemetry-ai/feedback`  | Przekazanie feedbacku użytkownika |

## ML Pipeline (`/api/telemetry-ai-ml`)

Wymaga autoryzacji (administrator).

| Metoda | Ścieżka                         | Opis                                  |
| ------ | ------------------------------- | ------------------------------------- |
| POST   | `/api/telemetry-ai-ml/train`    | Ręczne uruchomienie trenowania modelu |
| GET    | `/api/telemetry-ai-ml/status`   | Status modeli ML                      |
| GET    | `/api/telemetry-ai-ml/evaluate` | Ewaluacja modelu                      |

## Dashboard telemetrii (`/api/telemetry-ai-dashboard`)

Wymaga autoryzacji (administrator).

| Metoda | Ścieżka                                | Opis                  |
| ------ | -------------------------------------- | --------------------- |
| GET    | `/api/telemetry-ai-dashboard/stats`    | Statystyki telemetrii |
| GET    | `/api/telemetry-ai-dashboard/patterns` | Wykryte wzorce        |
| GET    | `/api/telemetry-ai-dashboard/accuracy` | Dokładność predykcji  |

## Feature Flags (`/api/feature-flags`)

Wymaga autoryzacji (administrator).

| Metoda | Ścieżka                   | Opis                      |
| ------ | ------------------------- | ------------------------- |
| GET    | `/api/feature-flags`      | Lista flag funkcjonalnych |
| PUT    | `/api/feature-flags/:key` | Aktualizacja flagi        |

---

## Rate Limiting

| Limiter                 | Okno   | Max prób | Endpointy                      |
| ----------------------- | ------ | -------- | ------------------------------ |
| LOGIN_LIMITER           | 15 min | 15       | `/api/auth/login`              |
| API_LIMITER             | 15 min | 300      | Wszystkie endpointy `/api/*`   |
| WRITE_LIMITER           | 15 min | 60       | Zapis danych (POST/PUT/DELETE) |
| PRICELIST_WRITE_LIMITER | 1 godz | 30       | Aktualizacja cenników          |

---

## Uwagi

- Wszystkie endpointy (oprócz `/health` i `/api/auth/login`) zwracają `401` przy braku autoryzacji.
- Token autoryzacyjny można przekazać przez nagłówek `x-auth-token` lub ciasteczko `authToken`.
- W produkcji ciasteczko `authToken` ma flagę `Secure` (wymaga HTTPS).
- Pełną dokumentację OpenAPI ze schematami i przykładami znajdziesz pod `/api/docs`.
