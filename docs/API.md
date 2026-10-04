# API — dokumentacja endpointów

**Wersja:** 1.37.2  
**Ostatnia aktualizacja:** 2026-10-03  
**Dokumentacja Swagger/OpenAPI:** `/api/docs` (po uruchomieniu serwera) — źródło autorytatywne (surowy JSON: `GET /api/docs.json`)

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
  "version": "1.37.2"
}
```

### `GET /api/version`

Informacje o wersji aplikacji.

### `GET /health/live`

Liveness — czy proces Express odpowiada (publiczny). Odpowiedź: `{status: "ok", timestamp}`.

### `GET /health/ready`

Readiness — czy baza gotowa (publiczny, `SELECT 1`). Odpowiedź `200 {status: "ready", db: "ok"}` lub `503 {status: "not_ready", db: "error"}`.

### `GET /health/pdf`

Stan generowania PDF / Chromium (publiczny, minimalny — I-011). Tryb lekki nie launchuje przeglądarki. Odpowiedź `200 {status: "ok"}` lub `503 {status: "degraded"}` — bez diagnostyki (klasyczny objaw degraded: cache Puppeteera w `/root/.cache` niewidoczny dla `USER node`; szczegóły w logach serwera i `/api/admin/system-info` dla admina).

Z `?smoke=1` (wyłącznie sesja admina: 401 anon, 403 non-admin) renderuje jedną stronę testową end-to-end: `200 {status, smoke: {ok: true, bytes}}` lub generyczne `503 {status: "degraded", smoke: {ok: false}}` bez szczegółów błędu. Deploy dockerowy weryfikuje ten endpoint automatycznie (`npm run deploy:check:pdf`; smoke loguje się jako admin, bez hasła w env jest SKIPPED).

### `GET /metrics`

Metryki in-process (tylko admin) — P50/P95 per endpoint, DB, loop-lag, PDF.

### `POST /api/csp-report`

Publiczny endpoint raportów CSP (`Content-Type: application/csp-report`, odpowiedź `204`, log warn przycięty do 2000 znaków).

**Odpowiedź:**

```json
{
    "version": "1.37.2",
    "commitHash": "389dd6e",
    "branch": "main",
    "buildDate": "2026-08-09T00:00:00.000Z",
    "environment": "development",
    "dbVersion": "1.37.2"
}
```

---

## Autoryzacja (`/api/auth`)

Wszystkie endpointy auth (oprócz login) wymagają autoryzacji przez ciasteczko `authToken` (HttpOnly, jedyny mechanizm). Nagłówek `x-auth-token` jest wygaszony (sunset) — serwer go ignoruje; wywołania API muszą wysyłać cookie (`credentials: include`).

### `POST /api/auth/login`

Logowanie użytkownika. Zwraca wyłącznie dane użytkownika; sesja trafia do cookie `authToken` (HttpOnly, `SameSite=Lax`).

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

**Rate limit:** 10 prób na minutę (LOGIN_LIMITER).

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

| Metoda | Ścieżka                     | Auth  | Opis                                                               |
| ------ | --------------------------- | ----- | ------------------------------------------------------------------ |
| GET    | `/api/users`                | admin | Lista użytkowników                                                 |
| PUT    | `/api/users/:id`            | admin | Aktualizacja użytkownika (zmiana roli/hasła unieważnia jego sesje) |
| DELETE | `/api/users/:id`            | admin | Usunięcie użytkownika (blokada 403 gdy ma dokumenty)               |
| GET    | `/api/users/shareable`      | auth  | Użytkownicy do udostępniania (bez siebie)                          |
| GET    | `/api/users/for-assignment` | auth  | Użytkownicy do przypisania                                         |
| GET    | `/api/users/me/preferences` | auth  | Własne preferencje (`{preferences}`)                               |
| PUT    | `/api/users/me/preferences` | auth  | Zapis własnej preferencji (`{key: "theme", value}`)                |

### `GET /api/users-for-assignment`

Lista użytkowników do przypisania (wewnętrzny alias na `/api/users/for-assignment`).

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

## Blokady edycji (`/api/locks`)

Wymaga autoryzacji. Twarda blokada 1 dokument = 1 użytkownik (TTL 180 s, heartbeat 60 s).
Typy dokumentów: `offer`, `offer_studnie`, `order_rury`, `order_studnie`.
Świeża cudza blokada przy zapisie = `423 DOC_LOCKED` + `holder`; brak wiersza = brak blokady.

| Metoda | Ścieżka                      | Opis                                                            |
| ------ | ---------------------------- | --------------------------------------------------------------- |
| POST   | `/api/locks/acquire`         | Przejmij/odśwież blokadę (`docType` + `docId`, `WRITE_LIMITER`) |
| POST   | `/api/locks/heartbeat`       | Odśwież własną blokadę (`WRITE_LIMITER`)                        |
| POST   | `/api/locks/release`         | Zwolnij własną/wygasłą blokadę (`WRITE_LIMITER`)                |
| POST   | `/api/locks/force`           | Wymuś przejęcie (tylko admin, `WRITE_LIMITER`)                  |
| GET    | `/api/locks/:docType/:docId` | Status blokady (`locked` + `lock` albo `locked: false`)         |

---

## Produkty — Rury (`/api/products`)

| Metoda | Ścieżka                     | Auth  | Opis                                           |
| ------ | --------------------------- | ----- | ---------------------------------------------- |
| GET    | `/api/products`             | auth  | Lista wszystkich produktów (rur)               |
| PUT    | `/api/products`             | admin | Hurtowy zapis cennika (usuń wszystko + utwórz) |
| PATCH  | `/api/products/:id`         | admin | Edycja jednego produktu                        |
| DELETE | `/api/products/:id`         | admin | Usunięcie produktu                             |
| GET    | `/api/products/export.xlsx` | auth  | Eksport XLSX (`?source=live\|default`)         |
| GET    | `/api/products/default`     | auth  | Domyślny cennik rur                            |

Produkty są ładowane przez `prisma/seed.ts` z pliku `data/seed_rury.json`. Seed nie jest uruchamiany automatycznie przy starcie serwera — wykonuje go `scripts/ensure-db.bat` → `scripts/check-db.js` → `prisma/seed.ts` (ręcznie: `npm run prisma:seed`).

---

## Produkty — Studnie (`/api/products-studnie`)

| Metoda | Ścieżka                             | Auth  | Opis                                           |
| ------ | ----------------------------------- | ----- | ---------------------------------------------- |
| GET    | `/api/products-studnie`             | auth  | Lista wszystkich produktów (studni)            |
| PUT    | `/api/products-studnie`             | admin | Hurtowy zapis cennika (usuń wszystko + utwórz) |
| PATCH  | `/api/products-studnie/:id`         | admin | Edycja jednego produktu                        |
| DELETE | `/api/products-studnie/:id`         | admin | Usunięcie produktu                             |
| GET    | `/api/products-studnie/export.xlsx` | auth  | Eksport XLSX + PRECO (`?source=live\|default`) |
| GET    | `/api/products-studnie/default`     | auth  | Domyślny cennik studni                         |

Produkty są ładowane przez `prisma/seed.ts` z pliku `data/seed_studnie.json` (nie automatycznie przy starcie serwera).

---

## Wyszukiwanie ofert (`/api/offers/search`)

Wymaga autoryzacji. Wyszukiwanie łączne (UNION rury + studnie) z kursorem (`nextCursor`/`nextCursorId`, limit max 100).

| Metoda | Ścieżka                                            | Opis                              |
| ------ | -------------------------------------------------- | --------------------------------- |
| GET    | `/api/offers/search?q=&dateFrom=&dateTo=&...`      | Wyszukiwanie ofert (rury+studnie) |
| GET    | `/api/offers/search/orders?id=&type=rury\|studnie` | Wyszukiwanie zamówień (max 50)    |

`dateFrom`/`dateTo` muszą być w formacie ISO — nieprawidłowe wartości są odrzucane (zapytanie wykonuje się bez filtra dat).

---

## Oferty — Rury (`/api/offers-rury`)

Wymaga autoryzacji.

| Metoda | Ścieżka                            | Opis                         |
| ------ | ---------------------------------- | ---------------------------- |
| GET    | `/api/offers-rury`                 | Lista ofert rur              |
| GET    | `/api/offers-rury/:id`             | Szczegóły oferty             |
| POST   | `/api/offers-rury`                 | Utworzenie nowej oferty rur  |
| PUT    | `/api/offers-rury`                 | Aktualizacja oferty (całość) |
| DELETE | `/api/offers-rury/:id`             | Usunięcie oferty             |
| POST   | `/api/offers-rury/:id/duplicate`   | Duplikowanie oferty          |
| GET    | `/api/offers-rury/:id/export-pdf`  | Eksport oferty do PDF        |
| GET    | `/api/offers-rury/:id/export-docx` | Eksport oferty do DOCX       |

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

| Metoda | Ścieżka                                      | Opis                               |
| ------ | -------------------------------------------- | ---------------------------------- |
| GET    | `/api/orders-rury`                           | Lista zamówień rur                 |
| GET    | `/api/orders-rury/:id`                       | Szczegóły zamówienia               |
| PUT    | `/api/orders-rury`                           | Utworzenie/aktualizacja zamówienia |
| PATCH  | `/api/orders-rury/:id`                       | Częściowa aktualizacja             |
| DELETE | `/api/orders-rury/:id`                       | Anulowanie zamówienia              |
| POST   | `/api/orders-rury/claim-rury-number/:userId` | Przypisanie numeru zamówienia      |
| GET    | `/api/orders-rury/:id/export-pdf`            | Eksport zamówienia do PDF          |
| GET    | `/api/orders-rury/:id/export-docx`           | Eksport zamówienia do DOCX         |
| GET    | `/api/orders-rury/:id/export-karta-pdf`      | Eksport karty budowy do PDF        |
| GET    | `/api/orders-rury/:id/export-karta-docx`     | Eksport karty budowy do DOCX       |

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

| Metoda | Ścieżka                                            | Opis                                     |
| ------ | -------------------------------------------------- | ---------------------------------------- |
| GET    | `/api/orders-studnie/production`                   | Lista zleceń produkcyjnych (PZ)          |
| POST   | `/api/orders-studnie/production`                   | Utworzenie zlecenia produkcyjnego        |
| PUT    | `/api/orders-studnie/production`                   | Aktualizacja zlecenia produkcyjnego      |
| GET    | `/api/orders-studnie/production/index`             | Indeks zleceń                            |
| GET    | `/api/orders-studnie/production/:id`               | Szczegóły zlecenia                       |
| DELETE | `/api/orders-studnie/production/:id`               | Usunięcie zlecenia                       |
| POST   | `/api/orders-studnie/production/batch-delete`      | Masowe usunięcie (chunkowane po 200 ids) |
| POST   | `/api/orders-studnie/production/recycle-numbers`   | Zwrot numerów do puli                    |
| POST   | `/api/orders-studnie/production/print-count-batch` | Hurtowe liczniki wydruków                |
| POST   | `/api/orders-studnie/production/:id/print-count`   | Inkrementacja licznika wydruków          |

## Wyszukiwanie produkcji (`/api/orders-studnie/production/search`)

Wymaga autoryzacji. Wyszukiwanie z kursorem (infinite scroll), paginacja po znormalizowanym `createdAt`.

| Metoda | Ścieżka                                 | Opis                   |
| ------ | --------------------------------------- | ---------------------- |
| GET    | `/api/orders-studnie/production/search` | Wyszukiwanie zleceń PZ |

## Numeracja (`/api/orders-studnie`)

Wymaga autoryzacji. Montowana przed trasami `/:id` (barrel `orders/index.ts`).

| Metoda | Ścieżka                                                | Opis                                                                                  |
| ------ | ------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| GET    | `/api/orders-studnie/next-number/:userId`              | Następny numer zamówienia                                                             |
| POST   | `/api/orders-studnie/claim-number/:userId`             | Rezerwacja numeru zamówienia                                                          |
| POST   | `/api/orders-studnie/claim-production-number/:userId`  | Rezerwacja numeru PZ                                                                  |
| POST   | `/api/orders-studnie/claim-production-numbers/:userId` | Hurtowa rezerwacja numerów PZ (`{count: 1..200}`, max 200, format `SYM/LIT/NNNNN/RR`) |
| GET    | `/api/orders-studnie/recycled`                         | Recykling numerów                                                                     |

## Klienci (`/api/clients`)

Wymaga autoryzacji.

| Metoda | Ścieżka        | Opis                                                                                                         |
| ------ | -------------- | ------------------------------------------------------------------------------------------------------------ |
| GET    | `/api/clients` | Lista klientów (wspólna baza, wszyscy widzą wszystkich)                                                      |
| PUT    | `/api/clients` | Synchronizacja klientów (`{data: [...]}`, upsert; pusta tablica = czyszczenie tylko dla admina, inaczej 403) |

---

## Audyt (`/api/audit`)

Wymaga autoryzacji (bez wymogu administratora).

| Metoda | Ścieżka                                           | Opis                                                            |
| ------ | ------------------------------------------------- | --------------------------------------------------------------- |
| GET    | `/api/audit/:entityType/:entityId`                | Logi dla konkretnego zasobu                                     |
| GET    | `/api/audit/rebuild/:entityType/:entityId/:logId` | Rekonstrukcja stanu zasobu na moment wpisu (404 gdy brak wpisu) |

---

## Ustawienia (`/api/settings`)

| Metoda | Ścieżka                       | Auth  | Opis                                                     |
| ------ | ----------------------------- | ----- | -------------------------------------------------------- |
| GET    | `/api/settings/year-letter`   | auth  | Litera roku (`{letter, year}`, klucz `year_letter_YYYY`) |
| PUT    | `/api/settings/year-letter`   | admin | Ustawienie litery roku (uppercase, `{ok, letter, year}`) |
| GET    | `/api/settings/magazyn-codes` | auth  | Kody magazynów                                           |
| PUT    | `/api/settings/magazyn-codes` | admin | Ustawienie kodów magazynów                               |
| GET    | `/api/settings/:key`          | auth  | Pobranie konkretnego ustawienia (allowlista kluczy)      |

---

## Preco Pricing (`/api/preco-pricing`)

| Metoda | Ścieżka                          | Auth  | Opis                                                                |
| ------ | -------------------------------- | ----- | ------------------------------------------------------------------- |
| GET    | `/api/preco-pricing`             | auth  | Pobranie cennika Preco                                              |
| PUT    | `/api/preco-pricing`             | admin | Pełny zapis struktury PRECO (niepoprawne liczby → 400, brak zapisu) |
| PATCH  | `/api/preco-pricing`             | admin | Częściowa aktualizacja (scalenie z live, ta sama walidacja)         |
| GET    | `/api/preco-pricing/default`     | auth  | Pobranie domyślnego cennika Preco                                   |
| GET    | `/api/preco-pricing/export.xlsx` | auth  | Eksport XLSX (`?source=live\|default`)                              |

## Wersje cenników (`/api/pricelist-versions`)

Wymaga autoryzacji (administrator, oprócz etykiet).

| Metoda | Ścieżka                                   | Auth  | Opis                                      |
| ------ | ----------------------------------------- | ----- | ----------------------------------------- |
| GET    | `/api/pricelist-versions`                 | admin | Lista wersji                              |
| GET    | `/api/pricelist-versions/labels`          | auth  | Etykiety wersji                           |
| POST   | `/api/pricelist-versions/:type/drafts`    | admin | Nowy szkic wersji (`201` przy utworzeniu) |
| PUT    | `/api/pricelist-versions/:id`             | admin | Edycja wersji                             |
| DELETE | `/api/pricelist-versions/:id`             | admin | Usunięcie wersji                          |
| POST   | `/api/pricelist-versions/:id/activate`    | admin | Aktywacja wersji                          |
| POST   | `/api/pricelist-versions/:id/backdate`    | admin | Aktywacja wsteczna                        |
| POST   | `/api/pricelist-versions/:id/clone-draft` | admin | Klonowanie szkicu                         |
| POST   | `/api/pricelist-versions/activate-due`    | admin | Aktywacja zaplanowanych                   |
| GET    | `/api/pricelist-versions/:id/diff`        | admin | Różnice wersji                            |
| GET    | `/api/pricelist-versions/:id/export`      | admin | Eksport zamrożonej wersji                 |

## Domyślne cenniki (`/api/price-overrides`)

Wymaga autoryzacji (administrator). Zapisuje bieżący stan wszystkich cenników (rury, studnie, PRECO) jako nowe domyślne (`*_Default`) oraz do pliku `data/price_defaults.json` (transfer między komputerami).

| Metoda | Ścieżka                              | Opis                                   |
| ------ | ------------------------------------ | -------------------------------------- |
| POST   | `/api/price-overrides/save-defaults` | Zapis bieżących cenników jako domyślne |

## Eksport XLSX cenników

Wymaga autoryzacji. Jeden kształt pliku dla warstw LIVE / VERSION / DEFAULT
(arkusze i kolumny 1:1; plik studni zawiera też arkusze PRECO).

| Metoda | Ścieżka                                                  | Opis                                                                   |
| ------ | -------------------------------------------------------- | ---------------------------------------------------------------------- |
| GET    | `/api/products/export.xlsx?source=live\|default`         | Cennik rur (`Cennik_Rury_Export.xlsx`)                                 |
| GET    | `/api/products-studnie/export.xlsx?source=live\|default` | Cennik studni + PRECO (`Cennik_Studni_Export.xlsx`)                    |
| GET    | `/api/preco-pricing/export.xlsx?source=live\|default`    | Samo PRECO (`Cennik_Preco_Export.xlsx`)                                |
| GET    | `/api/pricelist-versions/:id/export` (administrator)     | Zamrożona wersja (`Cennik_{Rury,Studnie,Preco}_{version}_Export.xlsx`) |

`source=default` zwraca cennik domyślny (bazowy pod Reset) — w UI dostępny
wyłącznie przez dopisanie parametru do URL; przyciski eksportują `live`.

## Łączny eksport (`/api/export-combined`)

Wymaga autoryzacji. Łączy oferty rur i studni w jeden dokument.

| Metoda | Ścieżka                     | Opis                             |
| ------ | --------------------------- | -------------------------------- |
| POST   | `/api/export-combined/pdf`  | Eksport do PDF (EXPORT_LIMITER)  |
| POST   | `/api/export-combined/docx` | Eksport do DOCX (EXPORT_LIMITER) |

---

## Telemetria (`/api/telemetry`)

Wymaga autoryzacji.

| Metoda | Ścieżka                   | Opis                         |
| ------ | ------------------------- | ---------------------------- |
| POST   | `/api/telemetry/override` | Nadpisanie ręczne telemetrii |
| GET    | `/api/telemetry/logs`     | Logi telemetry               |

## Telemetria AI (`/api/telemetry/ai`)

Wymaga autoryzacji. Telemetria jest **pasywna** — solver JS pozostaje źródłem prawdy **reguł** doboru komponentów studni. AI (dual-ranking) może wybrać innego kandydata spośród kandydatów solvera — wtedy `solverSource: 'AI_SUGGEST'`.

| Metoda | Ścieżka                             | Opis                                                                                           |
| ------ | ----------------------------------- | ---------------------------------------------------------------------------------------------- |
| POST   | `/api/telemetry/ai/config`          | Zapis pełnej konfiguracji studni z kontekstem                                                  |
| POST   | `/api/telemetry/ai/event`           | Pojedyncze zdarzenie (user_change, accept, itp.)                                               |
| POST   | `/api/telemetry/ai/version`         | Rejestracja nowej wersji solvera/reguł/AI                                                      |
| POST   | `/api/telemetry/ai/acceptance-full` | Rozszerzony acceptance (oferta + akceptacja + snapshot; idempotentny — powtórka nie duplikuje) |

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

| Metoda | Ścieżka                                 | Auth  | Opis                                                 |
| ------ | --------------------------------------- | ----- | ---------------------------------------------------- |
| POST   | `/api/telemetry/ai/predict/batch`       | auth  | Predykcja batch dla kandydujących konfiguracji       |
| POST   | `/api/telemetry/ai/reward`              | auth  | Zapis nagrody (reward) za akcję                      |
| POST   | `/api/telemetry/ai/reward-batch`        | auth  | Hurtowy zapis nagród                                 |
| GET    | `/api/telemetry/ai/settings`            | auth  | Poziom wpływu AI (`wells_ai_influence`)              |
| POST   | `/api/telemetry/ai/settings`            | admin | Ustawienie wpływu AI 0–100                           |
| GET    | `/api/telemetry/ai/ml-status`           | auth  | Status pipeline ML (model, trening, cache, retencja) |
| GET    | `/api/telemetry/ai/health`              | admin | Health ML + metryki jakości danych                   |
| GET    | `/api/telemetry/ai/well-selections`     | admin | Wybory studni AI                                     |
| GET    | `/api/telemetry/ai/models`              | admin | Lista modeli                                         |
| GET    | `/api/telemetry/ai/models/:id`          | admin | Szczegóły modelu                                     |
| DELETE | `/api/telemetry/ai/models/:id`          | admin | Usunięcie modelu                                     |
| POST   | `/api/telemetry/ai/models/:id/activate` | admin | Aktywacja modelu                                     |
| POST   | `/api/telemetry/ai/models/:id/promote`  | admin | Promocja modelu                                      |
| POST   | `/api/telemetry/ai/models/:id/approve`  | admin | Zatwierdzenie modelu                                 |
| POST   | `/api/telemetry/ai/train`               | admin | Wymuszenie trenowania modelu                         |
| GET    | `/api/telemetry/ai/feature-schema`      | auth  | Wersja i nazwy cech ML                               |
| GET    | `/api/telemetry/ai/feature-importance`  | admin | Ważność cech                                         |
| GET    | `/api/telemetry/ai/drift`               | admin | Detekcja dryfu                                       |
| GET    | `/api/telemetry/ai/training-users`      | admin | Użytkownicy treningowi                               |
| PUT    | `/api/telemetry/ai/training-users`      | admin | Ustawienie użytkowników treningowych                 |
| GET    | `/api/telemetry/ai/training/runs`       | admin | Historia uruchomień treningu                         |
| GET    | `/api/telemetry/ai/training/runs/:id`   | admin | Szczegóły uruchomienia treningu                      |
| GET    | `/api/telemetry/ai/predictions/stats`   | admin | Statystyki predykcji                                 |
| POST   | `/api/telemetry/ai/rollback`            | admin | Rollback do poprzedniego modelu                      |

## Transfer Center P7 (`/api/telemetry/ai/transfer`)

Wymaga `requireAuth` + `requireAdmin` + `requireAiMlEnabled` (AI OFF → `503 {error: "disabled"}`).
Upload binarny przez `express.raw` (`application/octet-stream`, limit `SOKML_LIMITS`).
Przepływ: export → dry-run (binding `dryRunId` + `userId`, TTL) → import (zawsze `CANDIDATE`).

| Metoda | Ścieżka                                              | Opis                                                                                                                                  |
| ------ | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/api/telemetry/ai/transfer/preview-export?modelId=` | Podgląd zawartości pakietu (co opuszcza komputer)                                                                                     |
| POST   | `/api/telemetry/ai/transfer/export`                  | Generowanie `.sokml` (`{modelId, dataset?, knowledge?, telemetry?}`; złe body → `400 INVALID_BODY`)                                   |
| POST   | `/api/telemetry/ai/transfer/dry-run`                 | Analiza pakietu bez zapisu (`{dryRunId, status, checks, preview}`)                                                                    |
| POST   | `/api/telemetry/ai/transfer/import?dryRunId=`        | Import ze świeżego dry-run (`DRY_RUN_USER_MISMATCH` → 403, `DRY_RUN_PACKAGE_MISMATCH` → 409, duplikat wersji → 409 `MODEL_DUPLICATE`) |
| GET    | `/api/telemetry/ai/transfer/history`                 | Historia transferów (`{data}`, max 100, malejąco)                                                                                     |
| GET    | `/api/telemetry/ai/transfer/:transferId`             | Detal transferu (404 gdy brak)                                                                                                        |

Sonda CSP dashboardu Operacje czyta `Content-Security-Policy` z `/api/telemetry/ai/ml-status`
(za Helmet). `/api/version` i `/api/admin/system-info` są przed Helmet i nie niosą CSP.

## Feature Flags (`/api/feature-flags`)

| Metoda | Ścieżka                            | Auth  | Opis                                                                                        |
| ------ | ---------------------------------- | ----- | ------------------------------------------------------------------------------------------- |
| GET    | `/api/feature-flags`               | auth  | Lista flag (`ai_ml_enabled` fail-closed: błąd DB → `503 FLAGS_UNAVAILABLE`, nigdy jawne ON) |
| PUT    | `/api/feature-flags/import-export` | admin | Włączenie/wyłączenie import-eksport (`{enabled}`, audyt)                                    |
| PUT    | `/api/feature-flags/ai-ml`         | admin | Włączenie/wyłączenie AI/ML (`{enabled: boolean}`, 400 gdy nie-boolean)                      |
| POST   | `/api/feature-flags/audit`         | admin | Ręczny wpis audytu (`entityType`, `entityId`, `action`, 400 bez pól)                        |

---

## Rate Limiting

Odpowiedź po przekroczeniu: `429` + nagłówek `Retry-After`.

| Limiter                 | Okno   | Max prób | Endpointy                                                               |
| ----------------------- | ------ | -------- | ----------------------------------------------------------------------- |
| LOGIN_LIMITER           | 1 min  | 10       | `/api/auth/login` (kubełek per IP + login)                              |
| API_LIMITER             | 15 min | 300      | Większość endpointów `/api/*` (zapis ofert/zamówień ma własne limitery) |
| WRITE_LIMITER           | 1 min  | 60       | Zapis danych (POST/PUT/DELETE, w tym zlecenia produkcyjne)              |
| PRICELIST_WRITE_LIMITER | 1 min  | 30       | Cenniki rury (`PUT /api/products`)                                      |
| PRECO_PRICING_LIMITER   | 1 min  | 20       | Cennik PRECO (`PUT/PATCH /api/preco-pricing`)                           |
| EXPORT_LIMITER          | 1 min  | 20       | Eksport PDF/DOCX (`/api/export-combined/*`, `/:id/export-*`)            |
| TELEMETRY_WRITE_LIMITER | 1 min  | 1200     | Zapis telemetrii (`POST /api/telemetry/ai/config                        | event | version | acceptance-full | predict/batch | reward*`) |
| READ_LIMITER            | 1 min  | 600      | Odczyty telemetrii (dashboard, wiedza, modele, treningi — polling)      |
| CHANGE_PASSWORD_LIMITER | 15 min | 5        | `/api/auth/change-password` oraz `/api/auth/register` (admin)           |
| ADMIN_USERS_LIMITER     | 1 min  | 30       | `/api/users/*` (admin)                                                  |

---

## Statusy HTTP

| Status | Znaczenie w API                                                                            |
| ------ | ------------------------------------------------------------------------------------------ |
| 200    | Sukces (GET/PUT/PATCH/DELETE zwracają JSON, eksporty — plik)                               |
| 201    | Utworzono wersję cennika (`POST /api/pricelist-versions/:type/drafts`, aktywacje)          |
| 204    | Raport CSP przyjęty (`POST /api/csp-report`, bez body)                                     |
| 400    | Błąd walidacji (Zod przez `validateData`, zły format, invalid numeric input — patrz niżej) |
| 401    | Brak/nieprawidłowa sesja (brak cookie `authToken`, wygasła lub unieważniona)               |
| 403    | Brak uprawnień (rola, ownership, full-wipe klientów dla nie-admina, revoke share)          |
| 404    | Brak zasobu (404 zamiast 403 także przy odmowie dostępu do eksportu — anti-oracle)         |
| 409    | Konflikt (zajęty login, `VERSION_CONFLICT` przy ślepym zapisie, duplikat transferu)        |
| 422    | Błąd semantyczny: nieznany typ wersji, `NON_FINITE_SCORE` w AI batch                       |
| 429    | Rate limit (`Retry-After`); także zapis w toku (lock)                                      |
| 500    | Wewnętrzny błąd serwera (generyczny, bez wycieku szczegółów)                               |
| 503    | Niedostępne: DB niegotowa (`/health/ready`), Chromium (`/health/pdf`), AI OFF, flagi       |

---

## Walidacja liczb (finite numbers)

Pola cenowe, ilości i wymiary nie przyjmują cichych zer. Endpointy `PUT /api/products`, `PUT /api/products-studnie` oraz `PUT/PATCH /api/preco-pricing` odrzucają wartości `null`, `undefined`, pusty string, stringi nienumeryczne, `NaN`, `Infinity`, `-Infinity` oraz liczby ujemne — odpowiedzią jest **HTTP 400 i brak jakiegokolwiek zapisu do DB**. Poprawne liczby oraz numeryczne stringi (np. `"13"`) przechodzą (200). Schematy Zod dla ofert i snapshotów wymagają dodatkowo `.finite()` na polach cen/wymiarów (nie-skończone wartości odrzucane na wejściu).

---

## Administracja (`/api/admin`)

Wymaga autoryzacji (administrator). FTS to dane pochodne — status i rebuild wyłącznie dla admina.

| Metoda | Ścieżka                  | Opis                                                                                    |
| ------ | ------------------------ | --------------------------------------------------------------------------------------- |
| GET    | `/api/admin/fts-status`  | Szybka kontrola spójności FTS (tylko odczyty)                                           |
| POST   | `/api/admin/fts-rebuild` | Pełna przebudowa FTS z tabel biznesowych (tylko na żądanie, `{ok, rows, lastProgress}`) |

---

## Uwagi

- Wszystkie endpointy (oprócz publicznych: `/health*`, `/api/auth/login`, `/api/version`, `/api/docs*`, `/api/csp-report`) zwracają `401` przy braku autoryzacji.
- Token: wyłącznie ciasteczko `authToken` (HttpOnly); nagłówek `x-auth-token` jest ignorowany.
- W produkcji ciasteczko `authToken` ma flagę `Secure` (wymaga HTTPS).
- Zmiana roli/hasła użytkownika przez admina (`PUT /api/users/:id`) natychmiast unieważnia jego sesje (stara cookie → `401`).
- Pełną dokumentację OpenAPI ze schematami i przykładami znajdziesz pod `/api/docs`.
