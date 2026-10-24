# Baza danych — S.O.K. — System Ofert i Kalkulacji

**Silnik:** SQLite  
**ORM:** Prisma 6.0  
**Plik bazy:** `data/app_database.sqlite`  
**Liczba modeli:** 56 (3 enumy)  
**Migracje:** 36 (`prisma/migrations/`, stan 2026-10-24)

---

## 1. Schema Prisma

Pełna definicja schematu znajduje się w pliku `prisma/schema.prisma`. Poniżej opis wszystkich modeli.

### Datasource

```prisma
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

generator client {
  provider      = "prisma-client-js"
  output        = "../generated/prisma"
  binaryTargets = ["native", "debian-openssl-3.0.x"]
}
```

Zmienna środowiskowa `DATABASE_URL` wskazuje na plik bazy SQLite (np. `file:../data/app_database.sqlite`).

---

### 2. Modele danych — warstwa rdzenna

#### `users` — Użytkownicy

| Kolumna                    | Typ            | Opis                                                        |
| -------------------------- | -------------- | ----------------------------------------------------------- |
| id                         | String @id     | Unikalny identyfikator (np. `usr_admin`, `user_1234567890`) |
| username                   | String @unique | Nazwa użytkownika (login)                                   |
| password                   | String         | Hash hasła (bcrypt, 10 rund)                                |
| role                       | String         | Rola: `admin`, `pro` lub `user`                             |
| firstName                  | String?        | Imię                                                        |
| lastName                   | String?        | Nazwisko                                                    |
| phone                      | String?        | Telefon                                                     |
| email                      | String?        | Email                                                       |
| symbol                     | String?        | Symbol / inicjały                                           |
| subUsers                   | String?        | JSON lista podużytkowników                                  |
| createdAt                  | String?        | Data utworzenia (ISO)                                       |
| orderStartNumber           | Int?           | Początkowy numer oferty (@default(1))                       |
| productionOrderStartNumber | Int?           | Początkowy numer zamówienia produkcyjnego (@default(1))     |
| totalReward                | Float?         | Suma nagród ML (@default(0))                                |

Indeks: `idx_users_role` na kolumnie `role`.

#### `sessions` — Sesje logowania

| Kolumna      | Typ        | Opis                                  |
| ------------ | ---------- | ------------------------------------- |
| token        | String @id | Token sesji (64 znaki hex)            |
| userId       | String     | ID użytkownika                        |
| createdAt    | BigInt     | Timestamp utworzenia (ms)             |
| lastActivity | BigInt?    | Ostatnia aktywność (ms); idle timeout |

Sesja ma dwa limity: idle 1 h bezczynności (`SESSION_IDLE_TIMEOUT_MS`, liczony z
`lastActivity`) oraz absolutny max 7 dni od `createdAt` (`SESSION_ABSOLUTE_MAX_MS`).
Migracja `20261007000000_session_idle`.

#### `clients_rel` — Klienci

| Kolumna      | Typ        | Opis                         |
| ------------ | ---------- | ---------------------------- |
| id           | String @id | Unikalny identyfikator       |
| userId       | String?    | ID użytkownika (właściciel)  |
| name         | String?    | Nazwa klienta                |
| nip          | String?    | NIP                          |
| address      | String?    | Adres                        |
| email        | String?    | Email                        |
| phone        | String?    | Telefon                      |
| contact      | String?    | Osoba kontaktowa             |
| clientNumber | String?    | Numer klienta (@default("")) |
| createdAt    | String?    | Data utworzenia              |
| updatedAt    | String?    | Data aktualizacji            |

Indeks: `idx_clients_user` na kolumnie `userId`.

#### `client_contacts_rel` — Osoby kontaktowe klienta

| Kolumna         | Typ        | Opis                             |
| --------------- | ---------- | -------------------------------- |
| id              | String @id | Unikalny identyfikator           |
| clientId        | String     | ID klienta (indeks)              |
| name            | String     | Imię i nazwisko                  |
| phone           | String?    | Telefon                          |
| email           | String?    | Email                            |
| position        | String?    | Stanowisko (@default(""))        |
| isPrimary       | Int        | Główny kontakt 0/1 (@default(0)) |
| createdByUserId | String?    | Kto dodał                        |
| createdAt       | String?    | Data utworzenia                  |
| updatedAt       | String?    | Data aktualizacji                |

Indeks: `idx_client_contacts_client` na `clientId`. Migracja `20261009000001_client_contacts`.

#### `offers_rel` — Oferty (rury)

| Kolumna            | Typ        | Opis                                              |
| ------------------ | ---------- | ------------------------------------------------- |
| id                 | String @id | Unikalny identyfikator                            |
| userId             | String?    | ID użytkownika (właściciel)                       |
| clientId           | String?    | ID klienta                                        |
| state              | String?    | Status oferty (np. `draft`, `sent`, `accepted`)   |
| createdAt          | String?    | Data utworzenia                                   |
| updatedAt          | String?    | Data aktualizacji                                 |
| transportCost      | Float?     | Koszt transportu                                  |
| offer_number       | String?    | Numer oferty                                      |
| data               | String?    | JSON z danymi oferty                              |
| history            | String?    | JSON z historią zmian (@default("[]"))            |
| clientName         | String?    | Nazwa klienta (denormalizacja)                    |
| investName         | String?    | Nazwa inwestycji (denormalizacja)                 |
| clientNip          | String?    | NIP klienta                                       |
| clientNumber       | String?    | Numer klienta (@default(""))                      |
| version            | Int        | Licznik optimistic lockingu (@default(1), 409)    |
| pricelistVersionId | String?    | Wersja cennika użyta w ofercie (null = legacy v1) |

Relacja: `items offer_items_rel[]` (back-relacja, `onDelete: Restrict`).

Indeksy: `idx_offers_user`, `idx_offers_created`, `idx_offers_updated`, `idx_offers_state`, `idx_offers_clientname`, `idx_offers_investname`, `idx_offers_user_created_id`, `idx_offers_user_updated_id`, `idx_offers_pricelistversion`. Unikalny: `uq_offers_number` na `offer_number` (nie zwykły indeks).

#### `offers_studnie_rel` — Oferty (studnie)

| Kolumna            | Typ        | Opis                                           |
| ------------------ | ---------- | ---------------------------------------------- |
| id                 | String @id | Unikalny identyfikator                         |
| userId             | String?    | ID użytkownika                                 |
| clientId           | String?    | ID klienta                                     |
| state              | String?    | Status                                         |
| createdAt          | String?    | Data utworzenia                                |
| updatedAt          | String?    | Data aktualizacji                              |
| transportCost      | Float?     | Koszt transportu                               |
| offer_number       | String?    | Numer oferty                                   |
| data               | String?    | JSON z danymi oferty                           |
| history            | String?    | Historia zmian (@default("[]"))                |
| clientName         | String?    | Nazwa klienta (denormalizacja)                 |
| investName         | String?    | Nazwa inwestycji (denormalizacja)              |
| clientNip          | String?    | NIP klienta                                    |
| clientNumber       | String?    | Numer klienta (@default(""))                   |
| wellCount          | Int?       | Licznik studni (@default(0))                   |
| totalPrice         | Float?     | Cena całkowita (@default(0))                   |
| version            | Int        | Licznik optimistic lockingu (@default(1), 409) |
| pricelistVersionId | String?    | Wersja cennika (null = legacy v1)              |

Indeksy: `idx_offersstud_user/created/updated/state/clientname/investname/wellcount/totalprice/user_created_id/user_updated_id/pricelistversion`. Unikalny: `uq_offersstud_number` na `offer_number`.

#### `offer_items_rel` — Pozycje oferty (rury)

| Kolumna   | Typ        | Opis                   |
| --------- | ---------- | ---------------------- |
| id        | String @id | Unikalny identyfikator |
| offerId   | String?    | ID oferty              |
| productId | String?    | ID produktu            |
| quantity  | Float?     | Ilość                  |
| discount  | Float?     | Rabat                  |
| price     | Float?     | Cena jednostkowa       |

Relacja zwrotna do `offers_rel` (`onDelete: Restrict`). Indeks: `idx_offitems_offer` na `offerId`.

#### `offer_studnie_items_rel` — Pozycje oferty (studnie)

| Kolumna        | Typ        | Opis                   |
| -------------- | ---------- | ---------------------- |
| id             | String @id | Unikalny identyfikator |
| offerId        | String?    | ID oferty              |
| productId      | String?    | ID produktu            |
| quantity       | Float?     | Ilość                  |
| discount       | Float?     | Rabat                  |
| price          | Float?     | Cena                   |
| dodatkowe_info | String?    | Dodatkowe informacje   |

Indeks: `idx_offstitems_offer` na `offerId`.

#### `orders_rury_rel` — Zamówienia (rury)

| Kolumna            | Typ        | Opis                                      |
| ------------------ | ---------- | ----------------------------------------- |
| id                 | String @id | Unikalny identyfikator                    |
| userId             | String?    | ID użytkownika                            |
| offerId            | String?    | ID powiązanej oferty                      |
| createdAt          | String?    | Data utworzenia                           |
| status             | String?    | Status zamówienia                         |
| data               | String?    | JSON z danymi zamówienia                  |
| version            | Int        | Licznik optimistic lockingu (@default(1)) |
| pricelistVersionId | String?    | Wersja cennika (null = legacy v1)         |

Indeksy: `idx_ordrury_user` na `userId`, `idx_ordrury_offer` na `offerId`, `idx_ordrury_pricelistversion` na `pricelistVersionId`.

#### `orders_studnie_rel` — Zamówienia (studnie)

| Kolumna            | Typ        | Opis                                      |
| ------------------ | ---------- | ----------------------------------------- |
| id                 | String @id | Unikalny identyfikator                    |
| userId             | String?    | ID użytkownika                            |
| offerStudnieId     | String?    | ID powiązanej oferty studni               |
| createdAt          | String?    | Data utworzenia                           |
| status             | String?    | Status                                    |
| data               | String?    | JSON z danymi                             |
| version            | Int        | Licznik optimistic lockingu (@default(1)) |
| pricelistVersionId | String?    | Wersja cennika (null = legacy v1)         |

Indeksy: `idx_ordstud_user` na `userId`, `idx_ordstud_offer` na `offerStudnieId`, `idx_ordstud_pricelistversion` na `pricelistVersionId`.

---

### Modele opieki (care)

#### `offer_follow_ups` — Historia kontaktów (append-only)

| Kolumna         | Typ        | Opis                                                                 |
| --------------- | ---------- | -------------------------------------------------------------------- |
| id              | String @id | Unikalny identyfikator                                               |
| offerKind       | String     | `rury` / `studnie` (brak FK polimorficznego)                         |
| offerId         | String     | ID oferty                                                            |
| cycle           | Int        | Cykl obsługi; reopen po wyniku terminalnym = cykl nr+1 (@default(0)) |
| createdByUserId | String     | Kto odnotował kontakt                                                |
| createdAt       | String?    | Data utworzenia                                                      |
| updatedAt       | String?    | Znacznik edycji wpisu w miejscu (PUT, surowy SQL)                    |
| contactedAt     | String     | Data kontaktu (wymagana)                                             |
| channel         | Enum       | Kanał kontaktu (`OfferFollowUpChannel`)                              |
| result          | Enum       | Rezultat (`OfferFollowUpResult`)                                     |
| durationMin     | Int?       | Czas trwania (min)                                                   |
| note            | String?    | Notatka                                                              |
| nextContactAt   | String?    | Planowany następny kontakt                                           |
| outcome         | Enum       | Status rozliczenia (`OfferFollowUpOutcome`, @default(OPEN))          |
| loseReason      | String?    | Powód utraty                                                         |
| competitor      | String?    | Konkurent                                                            |
| competitorPrice | Float?     | Cena konkurenta                                                      |

Append-only: edycja notatki przez PUT nie rusza `contactedAt`/`createdAt`.
Reguła latest: `contactedAt DESC, createdAt DESC, id DESC`. Indeksy:
`idx_followups_offer_contacted` na `(offerKind, offerId, contactedAt)`,
`idx_followups_user_next` na `(createdByUserId, nextContactAt)`.
Max 1 wynik terminalny na `(offerKind, offerId, cycle)` — partial index
z migracji SQL (niewidzialny dla `prisma migrate diff`).

#### `latest_followup` — Ostatni kontakt (materializacja P1)

| Kolumna       | Typ     | Opis                                       |
| ------------- | ------- | ------------------------------------------ |
| offerKind     | String  | `rury` / `studnie` (część PK)              |
| offerId       | String  | ID oferty (część PK)                       |
| followupId    | String  | ID wiersza źródłowego z `offer_follow_ups` |
| outcome       | String? | Kopia rozliczenia                          |
| nextContactAt | String? | Kopia terminu                              |
| contactedAt   | String? | Kopia daty kontaktu                        |
| createdAt     | String? | Kopia daty utworzenia                      |
| note          | String? | Kopia notatki                              |

Klucz główny: `(offerKind, offerId)`. Utrzymanie: triggery
`trg_fu_latest_ai/au/ad` na `offer_follow_ups` (INSERT/UPDATE/DELETE
przeliczają wiersz wg reguły latest) + backfill w migracji
`20261014000000_care_latest_followup`. Heal przy starcie:
`ensureLatestFollowup()` w `src/initDatabase.ts`. Odczyt tylko przez
`careService` (kolejka/summary/notif); `followUpStats` i `searchUtils`
liczą latest po staremu (osobny kontrakt).

#### `care_states` — Stan pilnowania oferty

| Kolumna      | Typ     | Opis                                                      |
| ------------ | ------- | --------------------------------------------------------- |
| offerKind    | String  | `rury` / `studnie` (część PK)                             |
| offerId      | String  | ID oferty (część PK)                                      |
| snoozedUntil | String? | ISO-8601 UTC; null = aktywne pilnowanie                   |
| doneAt       | String? | ISO-8601 UTC; null = nieukończone (snooze/done rozłączne) |
| updatedBy    | String? | Kto zmienił                                               |
| updatedAt    | String  | Data zmiany (wymagana)                                    |

Klucz główny: `(offerKind, offerId)`. Snooze/done to stan, nie zdarzenie
(osobno od `offer_follow_ups`). Każda zmiana = wiersz w `audit_logs`
(`entityType care_state`). Indeksy: `idx_care_snooze` na `snoozedUntil`,
`idx_care_done` na `doneAt`.

#### `care_sla_config` / `care_sla_scopes` — Progi SLA

| Kolumna       | Typ        | Opis                                                |
| ------------- | ---------- | --------------------------------------------------- |
| id            | String @id | `care_sla_config`: zawsze `global` (@default)       |
| scopeType     | String     | `care_sla_scopes`: `team` / `user` (część PK)       |
| scopeId       | String     | ID zakresu (część PK)                               |
| firstContactH | Int        | Godziny na pierwszy kontakt (@default(24) w global) |
| staleD        | Int        | Dni do przeterminowania (@default(7) w global)      |
| escalationH   | Int        | Godziny do eskalacji (@default(72) w global)        |
| updatedBy     | String?    | Kto zmienił                                         |
| updatedAt     | String?    | Data zmiany                                         |

`care_sla_config` = 1 wiersz globalny (edycja tylko admin).
`care_sla_scopes` = nadpisania per zespół/user (PK `(scopeType, scopeId)`,
indeks `idx_caresla_scope`); brak wiersza = fallback do globalnych.

#### `care_notifications` — Powiadomienia in-app (pochodna stanu)

| Kolumna   | Typ        | Opis                                         |
| --------- | ---------- | -------------------------------------------- |
| id        | String @id | Identyfikator                                |
| userId    | String     | Adresat                                      |
| offerKind | String     | `rury` / `studnie`                           |
| offerId   | String     | ID oferty                                    |
| type      | String     | `SLA_BREACH` / `ESCALATION` / `CALLBACK_DUE` |
| readAt    | String?    | Data odczytu (null = nieprzeczytane)         |
| createdAt | String     | Data utworzenia (wymagana)                   |

Bounded inbox (retencja leniwa w syncu, brak workera): przeczytane starsze
niż 90 dni usuwane, skrzynka max 500 wierszy. Max 1 nieprzeczytane na
`(userId, offerKind, offerId, type)` — partial unique index z migracji SQL
(niewidzialny dla `prisma migrate diff`). Indeksy: `idx_carenotif_user_read`
na `(userId, readAt, createdAt)`, `idx_carenotif_offer` na `(offerKind, offerId)`.

Uwaga (throttle, nie w DB): znacznik ostatniego udanego syncu (okno 60 s =
polling FE) trzymany jest w pamięci procesu (`careService.ts`) — restart
gubi znacznik = pełny sync (bezpieczne); fail nie stempluje; podgląd repa
omija throttle.

---

### 3. Modele danych — produkty i cenniki

#### `ProductsRury` — Produkty (rury)

| Kolumna   | Typ        | Opis                   |
| --------- | ---------- | ---------------------- |
| id        | String @id | Unikalny identyfikator |
| name      | String     | Nazwa produktu         |
| category  | String     | Kategoria              |
| price     | Float      | Cena                   |
| transport | Float?     | Koszt transportu       |
| weight    | Float?     | Waga                   |
| area      | Float?     | Powierzchnia           |

#### `ProductsRuryDefault` — Domyślne produkty rury (wzorzec resetu)

Identyczna struktura jak `ProductsRury`. Używana do resetowania cennika do wartości domyślnych.

#### `ProductsStudnie` — Produkty (studnie)

Rozbudowany model z polami specyficznymi dla studni:

| Kolumna       | Typ        | Opis                                      |
| ------------- | ---------- | ----------------------------------------- |
| id            | String @id | Identyfikator                             |
| name          | String     | Nazwa                                     |
| category      | String     | Kategoria                                 |
| componentType | String     | Typ komponentu                            |
| dn            | String?    | Średnica nominalna                        |
| height        | Int?       | Wysokość                                  |
| weight        | Float?     | Waga                                      |
| price         | Float      | Cena domyślna                             |
| area          | Float?     | Powierzchnia                              |
| areaExt       | Float?     | Powierzchnia zewnętrzna                   |
| transport     | Float?     | Koszt transportu                          |
| magazynWL     | Boolean    | W magazynie WL                            |
| magazynKLB    | Boolean    | W magazynie KLB                           |
| active        | Boolean    | Czy aktywny                               |
| ...           | ...        | Dodatkowe pola dla przejść, kinet, dopłat |

#### `ProductsStudnieDefault` — Domyślne produkty studnie (wzorzec resetu)

Identyczna struktura jak `ProductsStudnie`. Używana do resetowania cen do wartości domyślnych.

#### `PrecoKonfig` / `PrecoKonfigDefault` — Konfiguracja Preco

| Kolumna | Typ        | Opis               |
| ------- | ---------- | ------------------ |
| id      | String @id | Identyfikator      |
| key     | String     | Klucz konfiguracji |
| value   | String     | Wartość            |

Wzorzec domyślny w `PrecoKonfigDefault`.

#### `PrecoKinety` / `PrecoKinetyDefault` — Kinety Preco

| Kolumna | Typ        | Opis               |
| ------- | ---------- | ------------------ |
| id      | String @id | Identyfikator      |
| order   | Int        | Kolejność          |
| dn      | Int        | Średnica nominalna |
| wellDn  | Int        | DN studni          |
| height  | Int        | Wysokość           |
| cena    | Float      | Cena               |

Wzorzec domyślny w `PrecoKinetyDefault`.

#### `PrecoZakresy` / `PrecoZakresyDefault` — Zakresy Preco

| Kolumna | Typ        | Opis             |
| ------- | ---------- | ---------------- |
| id      | String @id | Identyfikator    |
| order   | Int        | Kolejność        |
| label   | String     | Etykieta zakresu |
| min     | Int        | Dolna granica    |
| max     | Int        | Górna granica    |
| grupy   | String     | Grupy (JSON)     |
| wellDn  | Int        | DN studni        |

Wzorzec domyślny w `PrecoZakresyDefault` (te same wymagane typy).

#### Rodzina `PricelistVersion` + `PricelistItem*` — wersjonowanie cenników (F1)

Snapshot cennika publikowany jako niezmienna wersja. Tabele wprowadzone migracją
`20260926000000_pricelist_versioning` (FK siatki: `20260929000000_fk_pricelist_version`).

| Model                       | Zawartość                                                                                                                         |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `PricelistVersion`          | Nagłówek wersji: `type`, `seq`, `version`, `status`, `effectiveFrom`, `sha256`, `createdBy`, `approvedBy/approvedAt`, `updatedAt` |
| `PricelistItemRury`         | Pozycje cennika rur (`name`, `category`, `price`, `transport`, `weight`, `area`)                                                  |
| `PricelistItemStudnie`      | Pozycje cennika studni (pełny zestaw pól produktu, w tym dopłaty i przejścia)                                                     |
| `PricelistItemPrecoKonfig`  | Pary `key`/`value` konfiguracji PRECO                                                                                             |
| `PricelistItemPrecoKinety`  | Kinety PRECO (`dn`, `wellDn`, `height`, `cena`)                                                                                   |
| `PricelistItemPrecoZakresy` | Zakresy PRECO (`label`, `min`, `max`, `grupy`, `wellDn`)                                                                          |

`PricelistVersion` ma unikalne `(type, seq)` i `(type, version)` oraz indeks
`(type, status, effectiveFrom)`. Pozycje wskazują wersję przez `versionId`
(`onDelete: Restrict` — kod kasuje pozycje w transakcji przed wersją).
`PricelistVersion.approvalStatus` jest oznaczone `@deprecated` (pole zostaje tylko
do rebuild tabeli) — stan publikacji trzyma `status` + `approvedBy/approvedAt`.

Oferty i zamówienia wskazują użyty snapshot przez `pricelistVersionId`
(`offers_rel`, `offers_studnie_rel`, `orders_rury_rel`, `orders_studnie_rel`;
`null` = rekord legacy sprzed wersjonowania).

---

### 4. Modele danych — zamówienia i produkcja

#### `order_counters` — Liczniki numeracji ofert

| Kolumna    | Typ    | Opis                |
| ---------- | ------ | ------------------- |
| userId     | String | ID użytkownika      |
| year       | Int    | Rok                 |
| lastNumber | Int?   | Ostatni użyty numer |

Kompozytowy klucz główny: `(userId, year)`.

#### `order_counters_rury` — Liczniki numeracji zamówień rur

Identyczna struktura jak `order_counters`. Niezależne liczniki dla zamówień rur.

#### `production_orders_rel` — Zamówienia produkcyjne

| Kolumna          | Typ        | Opis                                          |
| ---------------- | ---------- | --------------------------------------------- |
| id               | String @id | Identyfikator                                 |
| userId           | String?    | ID użytkownika                                |
| orderId          | String?    | ID zamówienia                                 |
| wellId           | String?    | ID studni                                     |
| elementIndex     | Int?       | Indeks elementu                               |
| elementKey       | String?    | Stabilny klucz elementu                       |
| createdAt        | String?    | Data utworzenia                               |
| updatedAt        | String?    | Data aktualizacji                             |
| data             | String?    | JSON z danymi                                 |
| creatorId        | String?    | ID twórcy (@default(""))                      |
| productionNumber | String?    | Finalny numer produkcyjny (kolumna, nie JSON) |
| version          | Int        | Licznik optimistic lockingu (@default(1))     |

Unique: `uq_prod_user_number` na `(userId, productionNumber)`. Indeksy: `idx_prod_user/creator/created/updated/order/well/well_elem/user_created_id/user_updated_id`.

#### `production_order_counters` — Liczniki zamówień produkcyjnych

| Kolumna    | Typ    | Opis           |
| ---------- | ------ | -------------- |
| userId     | String | ID użytkownika |
| year       | Int    | Rok            |
| lastNumber | Int?   | Ostatni numer  |

#### `recycled_production_numbers` — Recykling numerów produkcyjnych

| Kolumna   | Typ    | Opis              |
| --------- | ------ | ----------------- |
| userId    | String | ID użytkownika    |
| year      | Int    | Rok               |
| seqNumber | Int    | Numer sekwencyjny |

---

### 5. Modele danych — audyt i konfiguracja

#### `audit_logs` — Logi audytowe

| Kolumna    | Typ        | Opis                                     |
| ---------- | ---------- | ---------------------------------------- |
| id         | String @id | Identyfikator                            |
| entityType | String     | Typ encji (np. `offer`, `client`)        |
| entityId   | String     | ID encji                                 |
| userId     | String?    | ID użytkownika                           |
| action     | String     | Akcja (np. `CREATE`, `UPDATE`, `DELETE`) |
| oldData    | String?    | JSON — dane przed zmianą                 |
| newData    | String?    | JSON — dane po zmianie                   |
| createdAt  | String?    | Data zdarzenia                           |

Indeksy: `idx_audit_entity` na `(entityType, entityId)` oraz `idx_audit_created_at` na `createdAt`.

#### `settings` — Ustawienia

| Kolumna | Typ        | Opis             |
| ------- | ---------- | ---------------- |
| key     | String @id | Klucz ustawienia |
| value   | String?    | Wartość          |

#### `user_preferences` — Preferencje użytkownika (klucz/wartość)

| Kolumna | Typ     | Opis                         |
| ------- | ------- | ---------------------------- |
| userId  | String  | ID użytkownika (część PK)    |
| key     | String  | Klucz preferencji (część PK) |
| value   | String? | Wartość (JSON lub string)    |

Klucz główny: `(userId, key)`. Indeks `idx_userprefs_user`. Migracja
`20260921000000_user_preferences`.

---

### 6. Modele danych — AI/ML i telemetria

#### `ai_telemetry_logs` — Logi telemetrii AI

| Kolumna              | Typ        | Opis                                                  |
| -------------------- | ---------- | ----------------------------------------------------- |
| id                   | String @id | Identyfikator                                         |
| userId               | String?    | ID użytkownika                                        |
| original_auto_config | String?    | Automatyczna konfiguracja                             |
| final_user_config    | String?    | Ostateczna konfiguracja                               |
| override_reason      | String?    | Powód nadpisania                                      |
| createdAt            | String?    | Data zdarzenia                                        |
| offerId              | String?    | ID oferty                                             |
| wellId               | String?    | ID studni (indeks `idx_logs_well`)                    |
| clientId             | String?    | ID klienta                                            |
| projectId            | String?    | ID projektu                                           |
| warehouse            | String?    | Magazyn                                               |
| dn                   | String?    | Średnica nominalna                                    |
| rzDna                | Float?     | Rzędna dna                                            |
| rzWlazu              | Float?     | Rzędna włazu                                          |
| wellHeight           | Float?     | Wysokość studni                                       |
| wellType             | String?    | Typ studni                                            |
| terminationType      | String?    | Typ zakończenia                                       |
| reductionType        | String?    | Typ redukcji                                          |
| zwiencenieType       | String?    | Typ zwieńczenia                                       |
| dennicaType          | String?    | Typ dennicy                                           |
| dennicaHeight        | Float?     | Wysokość dennicy (mm)                                 |
| kineta               | String?    | Kineta (`preco`/`precotop`/`unolith`/`beton`/`brak`)  |
| ringCount            | Int?       | Liczba kręgów                                         |
| ringHeights          | String?    | JSON array wysokości kręgów                           |
| appliedReductions    | String?    | JSON array redukcji                                   |
| appliedKonus         | String?    | JSON array korków                                     |
| appliedHatches       | String?    | JSON array włazów                                     |
| appliedSeals         | String?    | JSON array uszczelek                                  |
| allComponentIds      | String?    | Posortowana lista ID komponentów (klucz dedup)        |
| solverSource         | String?    | Źródło konfiguracji (`AUTO_JS`/`MANUAL`/`AI_SUGGEST`) |
| solverVersion        | String?    | Wersja solvera                                        |
| rulesVersion         | String?    | Wersja reguł                                          |
| aiVersion            | String?    | Wersja AI                                             |
| computationMs        | Int?       | Czas obliczeń solvera                                 |
| iterationCount       | Int?       | Liczba iteracji                                       |
| checkedVariants      | Int?       | Liczba sprawdzonych wariantów                         |
| rankingScore         | Float?     | Wynik rankingu                                        |
| selectionReason      | String?    | Powód wyboru                                          |
| wasAutoGenerated     | Boolean    | Czy wygenerowano automatycznie (@default(false))      |
| wasAccepted          | Boolean    | Czy zaakceptowano (@default(false))                   |
| wasRejected          | Boolean    | Czy odrzucono (@default(false))                       |
| wasModified          | Boolean    | Czy zmodyfikowano (@default(false))                   |
| modificationCount    | Int?       | Liczba modyfikacji (@default(0))                      |
| confidenceScore      | Float?     | Poziom ufności AI (0-1)                               |
| learningWeight       | Float?     | Waga learningowa                                      |
| trainingEligible     | Boolean    | Czy kwalifikuje się do treningu (@default(true))      |
| feedbackProcessed    | Boolean    | Czy feedback przetworzony (@default(false))           |
| configVersion        | Int?       | Wersja konfiguracji (@default(1))                     |
| parentConfigId       | String?    | ID konfiguracji rodzica                               |
| reviewStatus         | String?    | `active`/`archived`/`shadowed` (@default("active"))   |
| featureSnapshot      | String?    | Kanoniczny snapshot cech (klucz dedup)                |
| labelSnapshot        | String?    | JSON: wynik / decyzja (labels)                        |
| predictionSnapshot   | String?    | JSON: przewidywania AI (puste gdy brak AI)            |
| rewardValue          | Float?     | Wartość nagrody                                       |
| successRate          | Float?     | Skuteczność                                           |
| usageCount           | Int?       | Liczba użyć (@default(1))                             |
| lastUsedAt           | String?    | Ostatnie użycie                                       |
| lastAcceptedAt       | String?    | Ostatnia akceptacja                                   |
| lastRejectedAt       | String?    | Ostatnie odrzucenie                                   |
| manualOverrideFlag   | Boolean    | Ręczne nadpisanie (@default(false))                   |
| extraMeta            | String?    | JSON: dodatkowe pola                                  |

Indeksy: `idx_logs_wasmodified`, `idx_logs_createdat`, `idx_logs_dn`, `idx_logs_well`,
`idx_logs_source_well`, `idx_logs_modified_created`.

Dedyplikacja: rekordy `AUTO_JS` z identycznym kanonicznym `featureSnapshot` + `allComponentIds` dla tej samej studni aktualizują istniejący rekord (indeksy `idx_logs_well`, `idx_logs_source_well`).

Frontend mapuje wewnętrzny `configSource` (`AUTO_AI` → `AI_SUGGEST`, `AUTO`/`AUTO_JS` → `AUTO_JS`, `MANUAL`/`MANUAL_SWAP` → `MANUAL`) przez `telemetryBridge.normalizeSolverSource()`. Kolumna `ai_telemetry_logs.solverSource` przechowuje `AUTO_JS`/`MANUAL` (komentarz w schemacie), a `AI_SUGGEST` występuje w `ai_config_history.source`.

#### `ai_telemetry_events` — Zdarzenia telemetrii AI

| Kolumna        | Typ        | Opis                                                              |
| -------------- | ---------- | ----------------------------------------------------------------- |
| id             | String @id | Identyfikator                                                     |
| telemetryId    | String?    | FK logiczny -> ai_telemetry_logs.id                               |
| eventType      | String     | Typ (`auto_run`/`user_change`/`accept`/`reject`/`save_offer`/...) |
| userId         | String?    | ID użytkownika                                                    |
| wellId         | String?    | ID studni                                                         |
| componentId    | String?    | ID komponentu                                                     |
| previousValue  | String?    | Wartość przed zmianą                                              |
| newValue       | String?    | Wartość po zmianie                                                |
| changeReason   | String?    | Powód zmiany                                                      |
| msSinceConfig  | Int?       | Czas od konfiguracji (ms)                                         |
| orderInSession | Int?       | Kolejność w sesji                                                 |
| sequenceNo     | Int?       | Numer sekwencyjny (@default(0))                                   |
| createdAt      | String?    | Data zdarzenia                                                    |

Indeksy: `idx_events_telemetry/well/type/user/createdat`.

Używany do pollingu zdarzeń użytkownika (akceptacje, odrzucenia, modyfikacje).

#### `ai_config_history` — Historia wersji konfiguracji

| Kolumna         | Typ        | Opis                                     |
| --------------- | ---------- | ---------------------------------------- |
| id              | String @id | Identyfikator                            |
| wellId          | String?    | ID studni                                |
| configVersion   | Int        | Wersja konfiguracji                      |
| parentId        | String?    | ID konfiguracji rodzica                  |
| configJson      | String?    | JSON konfiguracji studni                 |
| source          | String?    | Źródło (`AUTO_JS`/`MANUAL`/`AI_SUGGEST`) |
| triggeredBy     | String?    | Kto wywołał (userId)                     |
| diffFromParent  | String?    | JSON lista zmian elementów               |
| isCurrent       | Boolean    | Czy bieżąca (@default(true))             |
| rankingScore    | Float?     | Wynik rankingu                           |
| selectionReason | String?    | Powód wyboru                             |
| createdAt       | String?    | Data utworzenia                          |

Indeksy: `idx_history_well`, `idx_history_well_current`.

#### `ai_telemetry_versions` — Wersje solvera, reguł i AI

| Kolumna       | Typ        | Opis                                   |
| ------------- | ---------- | -------------------------------------- |
| id            | String @id | Identyfikator                          |
| componentType | String     | Typ: `solver`/`rules`/`ai`/`embedding` |
| version       | String     | Numer wersji                           |
| description   | String?    | Opis                                   |
| schemaVersion | String?    | Wersja schematu                        |
| isActive      | Boolean    | Czy aktywna (@default(true))           |
| appliedFrom   | String?    | Od kiedy stosowana                     |
| createdAt     | String?    | Data rejestracji                       |

Indeks: `idx_versions_active`.

#### `ai_knowledge_base` — Baza wiedzy AI

| Kolumna         | Typ        | Opis                         |
| --------------- | ---------- | ---------------------------- |
| id              | String @id | Identyfikator                |
| patternType     | String     | Typ wzorca                   |
| patternKey      | String     | Klucz wzorca                 |
| dn              | String?    | Średnica nominalna           |
| context         | String?    | Kontekst                     |
| description     | String?    | Opis                         |
| recommendation  | String?    | Rekomendacja                 |
| hitCount        | Int        | Liczba trafień (@default(0)) |
| confidence      | Float      | Ufność (@default(0.0))       |
| successCount    | Int        | Sukcesy (@default(0))        |
| rejectionCount  | Int        | Odrzucenia (@default(0))     |
| firstDetectedAt | String?    | Pierwsze wykrycie            |
| lastHitAt       | String?    | Ostatnie trafienie           |
| lastUpdatedAt   | String?    | Ostatnia aktualizacja        |
| changeHistory   | String?    | Historia zmian               |
| status          | String     | Status (@default("active"))  |
| schemaVersion   | String?    | Wersja schematu              |
| generatedBy     | String?    | Kto wygenerował              |

Indeksy: `idx_kb_pattern_type/dn/pattern_key/status/confidence`.

#### `ai_recommendations` — Rekomendacje AI

| Kolumna     | Typ        | Opis                              |
| ----------- | ---------- | --------------------------------- |
| id          | String @id | Identyfikator                     |
| patternType | String     | Typ wzorca                        |
| patternKey  | String     | Klucz wzorca                      |
| dn          | String?    | Średnica nominalna                |
| wellId      | String?    | ID studni                         |
| score       | Float      | Wynik (@default(0.0))             |
| confidence  | Float      | Ufność (@default(0.0))            |
| payload     | String?    | JSON ładunek                      |
| wasApplied  | Boolean    | Czy zastosowano (@default(false)) |
| wasAccepted | Boolean    | Czy zaakceptowano                 |
| wasRejected | Boolean    | Czy odrzucono                     |
| generatedAt | String?    | Data wygenerowania                |
| decidedAt   | String?    | Data decyzji                      |
| decidedBy   | String?    | Kto zdecydował                    |

Indeksy: `idx_recs_type/well/applied`.

#### `ai_transition_snapshots` — Przejścia szczelne

| Kolumna  | Typ        | Opis                       |
| -------- | ---------- | -------------------------- |
| id       | String @id | Identyfikator              |
| configId | String?    | ID konfiguracji            |
| ...      | ...        | Cechy geometryczne przejść |

Wydzielone od zwykłych komponentów ze względu na specyfikę danych.

#### `AiFeature` — Feature Store ML

| Kolumna                 | Typ        | Opis                                          |
| ----------------------- | ---------- | --------------------------------------------- |
| id                      | String @id | Identyfikator                                 |
| telemetryId             | String?    | FK logiczny -> ai_telemetry_logs.id           |
| dn                      | Int        | Średnica nominalna                            |
| heightMm                | Int        | Wysokość studni (mm)                          |
| warehouse               | String     | KLB / WL                                      |
| wellType                | String     | standard / psia_buda / styczna / styczna_1200 |
| hasReduction            | Boolean    | Czy redukcja (@default(false))                |
| hasPsiaBuda             | Boolean    | Czy psia buda (@default(false))               |
| hasStyczna              | Boolean    | Czy styczna (@default(false))                 |
| ringCount               | Int        | Liczba kręgów (@default(0))                   |
| bottomType              | String     | Typ dennicy                                   |
| topType                 | String     | Typ zakończenia                               |
| kinetaType              | String?    | `preco`/`unolith`/`standard`/`brak` (v6)      |
| dennicaHeight           | Float?     | Wysokość dennicy (mm) (v6)                    |
| connectionCount         | Int        | Liczba połączeń (@default(0))                 |
| transitionsAboveDennica | Int        | Przejścia powyżej dennicy (@default(0))       |
| totalPrice              | Float      | Cena całkowita (@default(0))                  |
| totalWeight             | Float      | Waga całkowita (@default(0))                  |
| ringVariety             | Float      | Entropia Shannona kręgów [0-1] (@default(0))  |
| season                  | String     | winter / spring / summer / autumn             |
| label                   | String     | ACCEPTED / REJECTED / MODIFIED / NO_FEEDBACK  |
| reward                  | Float      | Nagroda -1.0..+1.0 (@default(0))              |
| decisionMs              | Int?       | Czas decyzji użytkownika                      |
| createdAt               | String     | Data utworzenia                               |

Indeksy: `idx_aifeatures_key/label/created`.

#### `AiModel` — Model Registry ML

| Kolumna              | Typ            | Opis                                                                        |
| -------------------- | -------------- | --------------------------------------------------------------------------- |
| id                   | String @id     | Identyfikator                                                               |
| version              | String @unique | Wersja modelu (np. v1.2.0-20260707)                                         |
| weights              | String         | JSON wagi modelu (float[])                                                  |
| bias                 | Float          | Bias                                                                        |
| metrics              | String         | JSON metryki (accuracy, precision, recall, f1, roc_auc, trainSize, valSize) |
| features             | String         | JSON nazwy cech (kolejność)                                                 |
| featureMins          | String         | JSON min wartości do normalizacji                                           |
| featureMaxs          | String         | JSON max wartości do normalizacji                                           |
| trainingRows         | Int            | Liczba rekordów użytych do treningu                                         |
| featureVersion       | String?        | Wersja cech ML (np. `v5`, `v6`) — null dla starych                          |
| state                | String?        | Cykl życia: CANDIDATE/APPROVED/PRODUCTION/REJECTED/ROLLED_BACK              |
| seed                 | Int?           | Seed treningu (metadata/audyt)                                              |
| featureDistributions | String?        | JSON baseline driftu z TRAIN                                                |
| active               | Boolean        | Czy model aktywny (@default(false))                                         |
| notes                | String?        | Notatki                                                                     |
| createdAt            | String         | Data utworzenia                                                             |

Indeksy: `idx_aimodel_active/state/created`.

#### `AiEvaluation` — Dzienne metryki ewaluacji

| Kolumna        | Typ        | Opis                           |
| -------------- | ---------- | ------------------------------ |
| id             | String @id | Identyfikator                  |
| modelVersion   | String     | Wersja modelu                  |
| acceptance     | Float      | Acceptance rate (@default(0))  |
| decisionMsAvg  | Float      | Śr. czas decyzji (@default(0)) |
| rewardsAvg     | Float      | Śr. nagroda (@default(0))      |
| totalDecisions | Int        | Liczba decyzji (@default(0))   |
| triggeredAt    | String     | Data wywołania                 |

Indeksy: `idx_aieval_model`, `idx_aieval_triggered`.

#### `aiRewardLog` — Logi nagród ML

| Kolumna        | Typ        | Opis                             |
| -------------- | ---------- | -------------------------------- |
| id             | String @id | Identyfikator                    |
| userId         | String     | ID użytkownika (wymagane)        |
| wellId         | String     | ID studni (wymagane)             |
| dn             | Int        | Średnica nominalna (wymagana)    |
| action         | String     | ACCEPT/REJECT/MODIFY/ADJUST/SWAP |
| reward         | Float      | Wartość nagrody (wymagana)       |
| scoreBefore    | Float?     | Wynik przed decyzją              |
| scoreAfter     | Float?     | Wynik po decyzji                 |
| wasAiRanked    | Boolean    | Czy ranking AI (@default(false)) |
| configSnapshot | String?    | Snapshot konfiguracji            |
| createdAt      | String     | Data utworzenia (wymagana)       |

Indeksy: `idx_reward_user/action/created`. Unique index `@@unique([wellId, action])` — dedup rewardów (migracja `20260815000001_uq_reward_well_action`).

#### `AiTrainingRun` — Audyt uruchomień treningu ML

| Kolumna                | Typ        | Opis                                                                                   |
| ---------------------- | ---------- | -------------------------------------------------------------------------------------- |
| id                     | String @id | Identyfikator                                                                          |
| startedAt              | String     | Start (wymagany)                                                                       |
| finishedAt             | String?    | Koniec                                                                                 |
| status                 | String     | RUNNING/SUCCESS/SKIPPED/FAILED_NUMERICAL/FAILED_VALIDATION/FAILED_TIMEOUT/FAILED_ERROR |
| datasetSize            | Int        | Rozmiar datasetu                                                                       |
| trainSize              | Int        | Rozmiar train                                                                          |
| validationSize         | Int        | Rozmiar walidacji                                                                      |
| testSize               | Int        | Rozmiar testu                                                                          |
| featureVersion         | String     | Wersja cech                                                                            |
| seed                   | Int        | Seed                                                                                   |
| candidateModelVersion  | String?    | Model kandydujący                                                                      |
| comparedAgainstVersion | String?    | Model PRODUCTION do porównania                                                         |
| datasetStartAt         | String?    | Pierwszy rekord datasetu                                                               |
| datasetEndAt           | String?    | Ostatni rekord datasetu                                                                |
| datasetFingerprint     | String?    | SHA-256 datasetu                                                                       |
| metrics                | String?    | JSON metryk (val + test)                                                               |
| baselineAccuracy       | Float?     | Accuracy klasyfikatora majority-class                                                  |
| positiveRate           | Float?     | Częstotliwość klasy pozytywnej                                                         |
| deployed               | Boolean    | Czy wdrożono                                                                           |
| deploymentReason       | String?    | Powód wdrożenia                                                                        |
| error                  | String?    | Komunikat błędu (gdy FAILED_*)                                                         |

Indeksy: `idx_aitrainingrun_started/status`. Tabela wprowadzona w migracji `20260816000000_ai_training_run` — kręgosłup audytu pipeline ML. Model nie ma kolumny `createdAt` — czas startu to `startedAt`.

#### `document_shares` — Udostępnianie dokumentów

| Kolumna          | Typ        | Opis                                                       |
| ---------------- | ---------- | ---------------------------------------------------------- |
| id               | String @id | Identyfikator                                              |
| documentType     | String     | Typ (`offer`/`offer_studnie`/`order_rury`/`order_studnie`) |
| documentId       | String     | ID dokumentu                                               |
| ownerId          | String     | ID właściciela                                             |
| sharedWithUserId | String     | ID użytkownika docelowego                                  |
| permission       | String     | Uprawnienie (@default("read"))                             |
| createdAt        | String     | Data utworzenia                                            |
| createdBy        | String     | Kto udostępnił                                             |

Unique: `uq_share_doc_user` na `(documentType, documentId, sharedWithUserId)`. Indeksy: `idx_shares_sharedwith/docid/doctype_docid/owner`. Tabela z migracji `20260828000000_add_document_shares`.

#### `idempotency_keys` — Klucze idempotentności API

| Kolumna        | Typ     | Opis                         |
| -------------- | ------- | ---------------------------- |
| userId         | String  | ID użytkownika (część PK)    |
| endpoint       | String  | Endpoint (część PK)          |
| key            | String  | Klucz (część PK)             |
| requestHash    | String  | Hash żądania                 |
| status         | String  | Status (@default("PENDING")) |
| responseStatus | Int?    | Status odpowiedzi            |
| responseBody   | String? | Treść odpowiedzi             |
| createdAt      | String  | Data utworzenia              |
| expiresAt      | String  | Data wygaśnięcia             |

Klucz główny: `(userId, endpoint, key)`. Indeks: `idx_idempotency_expires`. Tabela z migracji `20260907000003_idempotency_keys`.

#### `doc_locks` — Twarda blokada edycji dokumentów

| Kolumna     | Typ     | Opis                                                                 |
| ----------- | ------- | -------------------------------------------------------------------- |
| docType     | String  | Typ (`offer`/`offer_studnie`/`order_rury`/`order_studnie`, część PK) |
| docId       | String  | ID dokumentu (część PK)                                              |
| userId      | String? | ID użytkownika trzymającego blokadę                                  |
| userName    | String? | Nazwa do wyświetlenia w modalu 423                                   |
| lockedAt    | String  | Data przejęcia blokady                                               |
| heartbeatAt | String  | Data ostatniego heartbeatu (TTL 180 s)                               |

Klucz główny: `(docType, docId)`. Indeksy: `idx_doclocks_user`, `idx_doclocks_heartbeat`. Tabela z migracji `20260908000000_doc_locks`. Semantyka: brak wiersza = brak blokady (zapis przepuszczony, chroni optimistic locking 409); świeża cudza blokada = 423 przy zapisie.

---

## 3. Migracje

Migracje Prisma znajdują się w katalogu `prisma/migrations/`.

### Lista migracji (36)

Projekt przeszedł z `prisma db push` na pełne migracje — cała historia schematu została
skonsolidowana w migracji baseline `20260815000000_baseline` (pełny schemat: oferty,
zamówienia, produkty, cenniki, telemetria AI/ML). Migracja baseline zawiera także indeksy
na `ai_telemetry_logs` (`idx_logs_well`, `idx_logs_source_well`) pod deduplikację telemetrii.

| Migracja                                     | Opis                                                                                     |
| -------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `20260815000000_baseline`                    | Baseline pełnego schematu (konwersja z `db push` na migracje) + indeksy dedup telemetrii |
| `20260815000001_uq_reward_well_action`       | Dedup rewardów przed unique index `(wellId, action)` na `aiRewardLog`                    |
| `20260816000000_ai_training_run`             | Tabela `AiTrainingRun` (kręgosłup audytu treningów ML)                                   |
| `20260828000000_add_document_shares`         | Tabela `document_shares` (udostępnianie dokumentów między użytkownikami)                 |
| `20260831000000_add_wellcount`               | Licznik studni (`wellCount`)                                                             |
| `20260902000000_add_totalprice`              | Cena całkowita (`totalPrice`)                                                            |
| `20260902000001_add_performance_indexes`     | Indeksy wydajnościowe                                                                    |
| `20260905000000_add_prod_well_index`         | Indeks `(wellId, elementIndex)` zamówień produkcyjnych                                   |
| `20260907000000_prod_number_unique`          | Unique `(userId, productionNumber)` zamówień produkcyjnych                               |
| `20260907000001_prod_version`                | Kolumna `version` (optimistic locking)                                                   |
| `20260907000002_doc_versions`                | Kolumny `version` ofert i zamówień                                                       |
| `20260907000003_idempotency_keys`            | Tabela `idempotency_keys`                                                                |
| `20260907000004_fk_items_offer`              | FK `offer_items_rel.offerId` -> `offers_rel` (Restrict)                                  |
| `20260908000000_doc_locks`                   | Tabela `doc_locks` (twarda blokada edycji 1 dokument = 1 użytkownik)                     |
| `20260921000000_user_preferences`            | Tabela `user_preferences` (preferencje per user, klucz/wartość)                          |
| `20260926000000_pricelist_versioning`        | Wersjonowanie cenników: `PricelistVersion` + tabele pozycji                              |
| `20260929000000_fk_pricelist_version`        | FK pozycji cennika -> wersja (`onDelete: Restrict`)                                      |
| `20260930000000_p7_ai_transfer`              | Tabela `AiTransfer` (eksport/import pakietów modeli)                                     |
| `20261007000000_session_idle`                | `sessions.lastActivity` + backfill (idle timeout 1 h)                                    |
| `20261008000000_offer_follow_ups`            | Tabela `offer_follow_ups` (historia kontaktów, append-only)                              |
| `20261008000001_fu_terminal_uq`              | Partial unique: max 1 wynik terminalny na `(offerKind, offerId, cycle)`                  |
| `20261009000000_fu_cycles`                   | Kolumna `cycle` + reguła reopen po wyniku terminalnym                                    |
| `20261009000001_client_contacts`             | Tabela `client_contacts_rel` (osoby kontaktowe klienta)                                  |
| `20261010000000_care_p1_states_sla`          | Tabele `care_states` + `care_sla_config`                                                 |
| `20261010000001_care_p2_notifications`       | Tabela `care_notifications`                                                              |
| `20261010000002_care_ddl_canonical`          | Kanoniczne DDL tabel care (defaulty global SLA)                                          |
| `20261010000003_care_notif_uq`               | Partial unique: max 1 nieprzeczytane powiadomienie na klucz                              |
| `20261010000004_care_sla_scopes`             | Tabela `care_sla_scopes` (nadpisania SLA per zespół/user)                                |
| `20261011000000_care_studnie_price_backfill` | Backfill `totalPrice` ofert studni z `data.totalBrutto`                                  |
| `20261012000000_care_followups_updatedAt`    | `offer_follow_ups.updatedAt` + backfill (ETag panelu)                                    |
| `20261014000000_care_latest_followup`        | Tabela `latest_followup` + triggery INSERT/UPDATE/DELETE                                 |
| `20261019000000_offer_number_unique`         | `uq_offers_number` / `uq_offersstud_number` (I-004), `''` -> NULL                        |
| `20261021000000_pricelist_approved`          | `approvedBy` / `approvedAt` wersji cennika                                               |
| `20261021130000_pricelist_version_idx`       | Indeksy `*_pricelistversion` w 4 tabelach ofert/zamówień                                 |
| `20261022000000_pricelist_updated_at`        | `PricelistVersion.updatedAt` + backfill                                                  |
| `20261023000000_pricelist_one_draft`         | Partial unique: max 1 `DRAFT` na typ cennika                                             |

### Komendy

| Komenda                   | Opis                                                          |
| ------------------------- | ------------------------------------------------------------- |
| `npm run prisma:generate` | Generuj klienta Prisma                                        |
| `npm run prisma:migrate`  | Utwórz nową migrację (dev)                                    |
| `npm run prisma:deploy`   | Zastosuj migracje w produkcji                                 |
| `npm run prisma:status`   | Status migracji                                               |
| `npm run prisma:seed`     | Zasiej dane początkowe                                        |
| `npm run prisma:reset`    | Reset bazy (utrata danych!)                                   |
| `npm run backup`          | Backup bazy (VACUUM INTO)                                     |
| `npm run restore <plik>`  | Przywróć bazę z backupu (`node scripts/restore-db.js <plik>`) |

### Seed

Dane początkowe są ładowane przez `prisma/seed.ts`:

```bash
npm run prisma:seed
```

Pliki źródłowe seed:

- `data/seed_rury.json` — produkty rury
- `data/seed_studnie.json` — produkty studnie
- `data/seed_preco.json` — cenniki Preco

Pliki seed można zregenerować z aktualnych danych produkcyjnych skryptem
`scripts/export-settings-to-seed.mjs` — czyta cenniki bezpośrednio z tabel
`ProductsRury`, `ProductsStudnie` oraz `PrecoKonfig`/`PrecoKinety` (a nie z tabeli
`settings`) i zapisuje do `data/seed_*.json` (JSON z wcięciem 4 spacje, końcówka
linii `\n`). Użycie: `node scripts/export-settings-to-seed.mjs [--dry-run]`
(`--dry-run` pokazuje raport bez zapisu plików).

Przy starcie serwera (`server.ts`) produkty **nie są** automatycznie seedowane.

Seed zapisuje dane w **jednej transakcji** `prisma.$transaction(...)` z użyciem
`createMany` (per tabela: `ProductsRury`, `ProductsStudnie`, `PrecoKonfig`,
`PrecoKinety`, `PrecoZakresy` oraz ich warianty `*Default`), a następnie tworzy
startowy model ML (`AiModel`). Jeśli baza zawiera już dane produktów, seed
przerywa działanie — chyba że uruchomisz go z flagą `--force`.

Seed uruchamia łańcuch `scripts/ensure-db.bat` → `scripts/check-db.js`
(który zwraca kod 2, gdy tabele produktów są puste) → `prisma/seed.ts`.
Ręcznie wywołasz go przez `npm run prisma:seed`, a w Dockerze seed jest
uruchamiany po `prisma migrate deploy` (na pustej bazie).

---

## 4. Backup

Backup bazy SQLite realizowany jest przez skrypt `scripts/backup.ts`.

### Działanie

1. Skrypt używa komendy SQL `VACUUM INTO` do utworzenia spójnego snapshotu bazy
2. **WAL-safe** — działa bezpiecznie nawet podczas zapisu do bazy przez aplikację
3. Plik backupu zapisywany do `data/backups/backup_YYYY-MM-DD_TIMESTAMP.sqlite`
4. Automatyczne usuwanie starych kopii — zachowywana jest max **1** najnowsza kopia
   (`MAX_BACKUPS` w `scripts/backup.ts`; zmiana retencji = świadoma decyzja operacyjna)

### Uruchomienie

```bash
npm run backup
```

### Automatyzacja (Windows)

```bash
npm run backup:install-cron    # Instaluje zadanie w Harmonogramie zadań Windows
npm run backup:uninstall-cron  # Usuwa zadanie
```

---

## 5. Restore

### Przywrócenie z backupu (zalecane)

```bash
npm run restore -- data/backups/backup_2026-06-30_*.sqlite
```

Skrypt weryfikuje poprawność pliku backupu przed nadpisaniem bazy:

1. **Nagłówek SQLite** — sprawdza magiczny nagłówek pliku bazy (`SQLite format 3`)
2. **`PRAGMA integrity_check`** — pełna weryfikacja integralności pliku backupu
3. **Wersja bazy** — `PRAGMA user_version` przed nadpisaniem
4. **Cleanup WAL** — usuwa pozostałości `-wal`/`-shm` po przywróceniu

Niepoprawny backup jest odrzucany (bez nadpisywania działającej bazy).

### Guardy restore i regresja

Guardy (`isSqliteFile`/`verifyChecksum`/`integrityCheck`) są importowalne
(guard `require.main`) i pokryte regresją `tests/restoreGuards.test.ts` —
brak pliku, podmieniony bajt i brak sidecara mają zdefiniowane zachowanie
(exit 1 / exit 1 / WARN + kontynuacja).
Cel testowy: `RESTORE_DB_PATH=<plik> node scripts/restore-db.js <backup> --yes`.

### Synchronizacja schematu przy restore

Po skopiowaniu pliku `npm run restore` automatycznie wykonuje
`npx prisma migrate deploy`, co synchronizuje schemat bazy z aktualnym stanem
migracji — tworzy m.in. indeksy deduplikacji telemetrii AI
(`idx_logs_well`, `idx_logs_source_well`) oraz nowe kolumny/tabele.
**Ręczne kopiowanie pliku backupu NIE synchronizuje schematu** (dla pełnej
spójności użyj `migrate deploy`; przy starcie serwera indeksy telemetrii AI
i tak są uzupełniane automatycznie przez auto-heal w `src/app.ts`).

### Drill E2E (P1.3, 2026-09-30)

Backup 1,36 GB + SHA-256 + integrity OK; restore na czysty cel +
`migrate deploy` (36 migracji, none pending); 14/14 tabel identyczne;
smoke aplikacji OK. RPO = interwał crona hosta; RTO = ręczny restore (minuty).

Stan bazy (backup, wersja, rozmiar) można sprawdzić przez `GET /health`.

### Ręczne przywrócenie

```bash
# Zatrzymaj serwer
cp data/backups/backup_2026-06-30_*.sqlite data/app_database.sqlite
# Uruchom serwer
```

### Przenoszenie bazy na nowe urządzenie

1. Na starym urządzeniu: `npm run backup`
2. Skopiuj plik `data/backups/backup_*.sqlite` na nowe urządzenie
3. Na nowym urządzeniu (po standardowej instalacji, bez seedowania):
    ```bash
    npm run restore -- data/backups/backup_*.sqlite
    ```
4. Jeśli schemat różni się między wersjami:
    ```bash
    npx prisma migrate deploy
    ```
    (legacy: `npx prisma db push --skip-generate`)

---

## 6. Wersjonowanie bazy

Baza używa `PRAGMA user_version` do wersjonowania schematu (zaimplementowane w `scripts/restore-db.js`).

---

## 7. Backup — szczegóły techniczne

```typescript
// scripts/backup.ts — kluczowa funkcja
const targetPath = backupPath.replace(/\\/g, '/');
await prisma.$executeRawUnsafe(`VACUUM INTO '${targetPath}'`);
// ... sprawdzenie rozmiaru, czyszczenie starych kopii
```

### Zalety VACUUM INTO

- Spójny snapshot niezależnie od aktywnych połączeń
- Działa podczas zapisu do bazy (WAL-safe)
- Tworzy nowy plik, nie modyfikuje oryginalnej bazy
- Kompresuje bazę (usuwa fragmentację)

---

_Ostatnia aktualizacja: 2026-09-09_
