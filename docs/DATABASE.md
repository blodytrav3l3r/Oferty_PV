# Baza danych — WITROS Oferty PV

**Silnik:** SQLite  
**ORM:** Prisma 6.0  
**Plik bazy:** `data/app_database.sqlite`  
**Liczba modeli:** 37

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
| role                       | String         | Rola: `admin` lub `user`                                    |
| firstName                  | String?        | Imię                                                        |
| lastName                   | String?        | Nazwisko                                                    |
| phone                      | String?        | Telefon                                                     |
| email                      | String?        | Email                                                       |
| symbol                     | String?        | Symbol / inicjały                                           |
| subUsers                   | String?        | JSON lista podużytkowników                                  |
| createdAt                  | String?        | Data utworzenia (ISO)                                       |
| orderStartNumber           | Int?           | Początkowy numer oferty                                     |
| productionOrderStartNumber | Int?           | Początkowy numer zamówienia produkcyjnego                   |

#### `sessions` — Sesje logowania

| Kolumna   | Typ        | Opis                       |
| --------- | ---------- | -------------------------- |
| token     | String @id | Token sesji (64 znaki hex) |
| userId    | String     | ID użytkownika             |
| createdAt | BigInt     | Timestamp utworzenia (ms)  |

Sesja wygasa po 7 dniach (`SESSION_MAX_AGE_MS`).

#### `clients_rel` — Klienci

| Kolumna      | Typ        | Opis                        |
| ------------ | ---------- | --------------------------- |
| id           | String @id | Unikalny identyfikator      |
| userId       | String?    | ID użytkownika (właściciel) |
| name         | String?    | Nazwa klienta               |
| nip          | String?    | NIP                         |
| address      | String?    | Adres                       |
| email        | String?    | Email                       |
| phone        | String?    | Telefon                     |
| contact      | String?    | Osoba kontaktowa            |
| clientNumber | String?    | Numer klienta               |
| createdAt    | String?    | Data utworzenia             |
| updatedAt    | String?    | Data aktualizacji           |

Indeks: `idx_clients_user` na kolumnie `userId`.

#### `offers_rel` — Oferty (rury)

| Kolumna       | Typ        | Opis                                            |
| ------------- | ---------- | ----------------------------------------------- |
| id            | String @id | Unikalny identyfikator                          |
| userId        | String?    | ID użytkownika (właściciel)                     |
| clientId      | String?    | ID klienta                                      |
| state         | String?    | Status oferty (np. `draft`, `sent`, `accepted`) |
| createdAt     | String?    | Data utworzenia                                 |
| updatedAt     | String?    | Data aktualizacji                               |
| transportCost | Float?     | Koszt transportu                                |
| offer_number  | String     | Numer oferty                                    |
| data          | String?    | JSON z danymi oferty                            |
| history       | String?    | JSON z historią zmian (`[]`)                    |

#### `offers_studnie_rel` — Oferty (studnie)

Identyczna struktura jak `offers_rel`, ale dedykowana dla ofert studni.

| Kolumna       | Typ        | Opis                   |
| ------------- | ---------- | ---------------------- |
| id            | String @id | Unikalny identyfikator |
| userId        | String?    | ID użytkownika         |
| clientId      | String?    | ID klienta             |
| state         | String?    | Status                 |
| createdAt     | String?    | Data utworzenia        |
| updatedAt     | String?    | Data aktualizacji      |
| transportCost | Float?     | Koszt transportu       |
| offer_number  | String     | Numer oferty           |
| data          | String?    | JSON z danymi oferty   |
| history       | String?    | Historia zmian         |

#### `offer_items_rel` — Pozycje oferty (rury)

| Kolumna   | Typ        | Opis                   |
| --------- | ---------- | ---------------------- |
| id        | String @id | Unikalny identyfikator |
| offerId   | String?    | ID oferty              |
| productId | String?    | ID produktu            |
| quantity  | Float?     | Ilość                  |
| discount  | Float?     | Rabat                  |
| price     | Float?     | Cena jednostkowa       |

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

#### `orders_rury_rel` — Zamówienia (rury)

| Kolumna   | Typ        | Opis                     |
| --------- | ---------- | ------------------------ |
| id        | String @id | Unikalny identyfikator   |
| userId    | String?    | ID użytkownika           |
| offerId   | String?    | ID powiązanej oferty     |
| createdAt | String?    | Data utworzenia          |
| status    | String?    | Status zamówienia        |
| data      | String?    | JSON z danymi zamówienia |

#### `orders_studnie_rel` — Zamówienia (studnie)

| Kolumna        | Typ        | Opis                        |
| -------------- | ---------- | --------------------------- |
| id             | String @id | Unikalny identyfikator      |
| userId         | String?    | ID użytkownika              |
| offerStudnieId | String?    | ID powiązanej oferty studni |
| createdAt      | String?    | Data utworzenia             |
| status         | String?    | Status                      |
| data           | String?    | JSON z danymi               |

---

### 3. Modele danych — produkty i cenniki

#### `productsRury` — Produkty (rury)

| Kolumna   | Typ        | Opis                   |
| --------- | ---------- | ---------------------- |
| id        | String @id | Unikalny identyfikator |
| name      | String     | Nazwa produktu         |
| category  | String     | Kategoria              |
| price     | Float      | Cena                   |
| transport | Float?     | Koszt transportu       |
| weight    | Float?     | Waga                   |
| area      | Float?     | Powierzchnia           |

#### `productsRuryDefault` — Domyślne produkty rury (wzorzec resetu)

Identyczna struktura jak `productsRury`. Używana do resetowania cennika do wartości domyślnych.

#### `productsStudnie` — Produkty (studnie)

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

#### `productsStudnieDefault` — Domyślne produkty studnie (wzorzec resetu)

Identyczna struktura jak `productsStudnie`. Używana do resetowania cen do wartości domyślnych.

#### `PrecoKonfig` / `PrecoKonfigDefault` — Konfiguracja Preco

| Kolumna | Typ        | Opis                   |
| ------- | ---------- | ---------------------- |
| id      | String @id | Identyfikator          |
| ...     | ...        | Parametry konfiguracji |

Wzorzec domyślny w `PrecoKonfigDefault`.

#### `PrecoKinety` / `PrecoKinetyDefault` — Kinety Preco

| Kolumna | Typ        | Opis             |
| ------- | ---------- | ---------------- |
| id      | String @id | Identyfikator    |
| ...     | ...        | Parametry kinety |

Wzorzec domyślny w `PrecoKinetyDefault`.

#### `PrecoZakresy` / `PrecoZakresyDefault` — Zakresy Preco

| Kolumna | Typ        | Opis              |
| ------- | ---------- | ----------------- |
| id      | String @id | Identyfikator     |
| ...     | ...        | Zakresy dla Preco |

Wzorzec domyślny w `PrecoZakresyDefault`.

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

| Kolumna      | Typ        | Opis              |
| ------------ | ---------- | ----------------- |
| id           | String @id | Identyfikator     |
| userId       | String?    | ID użytkownika    |
| orderId      | String?    | ID zamówienia     |
| wellId       | String?    | ID studni         |
| elementIndex | Int?       | Indeks elementu   |
| createdAt    | String?    | Data utworzenia   |
| updatedAt    | String?    | Data aktualizacji |
| data         | String?    | JSON z danymi     |
| creatorId    | String?    | ID twórcy         |

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

Indeks: `idx_audit_entity` na `(entityType, entityId)`.

#### `settings` — Ustawienia

| Kolumna | Typ        | Opis             |
| ------- | ---------- | ---------------- |
| key     | String @id | Klucz ustawienia |
| value   | String?    | Wartość          |

---

### 6. Modele danych — AI/ML i telemetria

#### `ai_telemetry_logs` — Logi telemetrii AI

| Kolumna              | Typ        | Opis                      |
| -------------------- | ---------- | ------------------------- |
| id                   | String @id | Identyfikator             |
| userId               | String?    | ID użytkownika            |
| original_auto_config | String?    | Automatyczna konfiguracja |
| final_user_config    | String?    | Ostateczna konfiguracja   |
| override_reason      | String?    | Powód nadpisania          |
| createdAt            | String?    | Data zdarzenia            |

#### `ai_telemetry_events` — Zdarzenia telemetrii AI

| Kolumna    | Typ        | Opis                                 |
| ---------- | ---------- | ------------------------------------ |
| id         | String @id | Identyfikator                        |
| userId     | String?    | ID użytkownika                       |
| eventType  | String?    | Typ zdarzenia                        |
| eventData  | String?    | JSON z danymi zdarzenia              |
| createdAt  | String?    | Data zdarzenia                       |
| snapshotId | String?    | Powiązanie z snapshotem konfiguracji |

Używany do pollingu zdarzeń użytkownika (akceptacje, odrzucenia, modyfikacje).

#### `ai_config_history` — Historia wersji konfiguracji

| Kolumna         | Typ        | Opis                              |
| --------------- | ---------- | --------------------------------- |
| id              | String @id | Identyfikator                     |
| configSnapshot  | String?    | JSON snapshot konfiguracji studni |
| solverVersionId | String?    | Wersja solvera                    |
| ruleVersionId   | String?    | Wersja reguł                      |
| aiVersionId     | String?    | Wersja AI                         |
| createdAt       | String?    | Data utworzenia                   |

#### `ai_telemetry_versions` — Wersje solvera, reguł i AI

| Kolumna     | Typ        | Opis                      |
| ----------- | ---------- | ------------------------- |
| id          | String @id | Identyfikator             |
| versionType | String?    | Typ: `solver`/`rule`/`ai` |
| version     | String?    | Numer wersji              |
| createdAt   | String?    | Data rejestracji          |

#### `ai_knowledge_base` — Baza wiedzy AI

| Kolumna    | Typ        | Opis                 |
| ---------- | ---------- | -------------------- |
| id         | String @id | Identyfikator        |
| pattern    | String?    | Wzorzec konfiguracji |
| confidence | Float?     | Poziom ufności (0-1) |
| metadata   | String?    | JSON metadane        |
| createdAt  | String?    | Data utworzenia      |
| updatedAt  | String?    | Data aktualizacji    |

#### `ai_recommendations` — Rekomendacje AI

| Kolumna        | Typ        | Opis              |
| -------------- | ---------- | ----------------- |
| id             | String @id | Identyfikator     |
| userId         | String?    | ID użytkownika    |
| configHash     | String?    | Hash konfiguracji |
| recommendation | String?    | JSON rekomendacja |
| wasApplied     | Boolean?   | Czy zastosowano   |
| createdAt      | String?    | Data utworzenia   |

#### `ai_transition_snapshots` — Przejścia szczelne

| Kolumna  | Typ        | Opis                       |
| -------- | ---------- | -------------------------- |
| id       | String @id | Identyfikator              |
| configId | String?    | ID konfiguracji            |
| ...      | ...        | Cechy geometryczne przejść |

Wydzielone od zwykłych komponentów ze względu na specyfikę danych.

#### `AiFeature` — Feature Store ML

| Kolumna   | Typ        | Opis                      |
| --------- | ---------- | ------------------------- |
| id        | String @id | Identyfikator             |
| features  | String?    | JSON wektor cech          |
| label     | Float?     | Etykieta (akceptacja 0/1) |
| createdAt | String?    | Data utworzenia           |

#### `AiModel` — Model Registry ML

| Kolumna   | Typ        | Opis                          |
| --------- | ---------- | ----------------------------- |
| id        | String @id | Identyfikator                 |
| modelData | String?    | JSON wagi modelu              |
| version   | String?    | Wersja modelu                 |
| metrics   | String?    | JSON metryki (accuracy, loss) |
| createdAt | String?    | Data utworzenia               |
| active    | Boolean?   | Czy model aktywny             |

#### `AiEvaluation` — Dzienne metryki ewaluacji

| Kolumna      | Typ        | Opis          |
| ------------ | ---------- | ------------- |
| id           | String @id | Identyfikator |
| date         | String?    | Data          |
| accuracy     | Float?     | Dokładność    |
| precision    | Float?     | Precyzja      |
| recall       | Float?     | Czułość       |
| f1Score      | Float?     | F1-score      |
| modelVersion | String?    | Wersja modelu |

#### `aiRewardLog` — Logi nagród ML

| Kolumna   | Typ        | Opis            |
| --------- | ---------- | --------------- |
| id        | String @id | Identyfikator   |
| userId    | String?    | ID użytkownika  |
| reward    | Float?     | Wartość nagrody |
| reason    | String?    | Powód nagrody   |
| createdAt | String?    | Data utworzenia |

---

## 3. Migracje

Migracje Prisma znajdują się w katalogu `prisma/migrations/`.

### Lista migracji (10)

| Migracja                                        | Opis                         |
| ----------------------------------------------- | ---------------------------- |
| `20260611000000_init`                           | Inicjalna migracja           |
| `20260611000001_add_product_tables`             | Tabele produktów             |
| `20260611170224_add_dn_studni_to_preco_zakresy` | DN studni w Preco zakresy    |
| `20260630190000_telemetry_ai_prep`              | Przygotowanie telemetrii AI  |
| `20260630200000_ai_knowledge_base`              | Baza wiedzy AI               |
| `20260705000000_ai_well_cases_create`           | Przypadki studni AI          |
| `20260705000000_feature_import_export`          | Feature flag import/eksport  |
| `20260705000001_ai_well_cases_unique`           | Unique key dla przypadków AI |
| `20260707000000_ai_ml_models`                   | Modele ML                    |
| `20260719000000_ai_unique_pattern_key`          | Unique pattern key           |

### Komendy

| Komenda                   | Opis                          |
| ------------------------- | ----------------------------- |
| `npm run prisma:generate` | Generuj klienta Prisma        |
| `npm run prisma:migrate`  | Utwórz nową migrację (dev)    |
| `npm run prisma:deploy`   | Zastosuj migracje w produkcji |
| `npm run prisma:status`   | Status migracji               |
| `npm run prisma:seed`     | Zasiej dane początkowe        |
| `npm run prisma:reset`    | Reset bazy (utrata danych!)   |
| `npm run backup`          | Backup bazy (VACUUM INTO)     |
| `npm run backup:restore`  | Przywróć bazę z backupu       |

### Seed

Dane początkowe są ładowane przez `prisma/seed.ts`:

```bash
npm run prisma:seed
```

Pliki źródłowe seed:

- `data/seed_rury.json` — produkty rury
- `data/seed_studnie.json` — produkty studnie
- `data/seed_preco.json` — cenniki Preco

Przy starcie serwera (`server.ts`) produkty są automatycznie seedowane, jeśli tabela jest pusta (funkcje `initRuryProductsTable()` i `initStudnieProductsTable()`).

---

## 4. Backup

Backup bazy SQLite realizowany jest przez skrypt `scripts/backup.ts`.

### Działanie

1. Skrypt używa komendy SQL `VACUUM INTO` do utworzenia spójnego snapshotu bazy
2. **WAL-safe** — działa bezpiecznie nawet podczas zapisu do bazy przez aplikację
3. Plik backupu zapisywany do `data/backups/backup_YYYY-MM-DD_TIMESTAMP.sqlite`
4. Automatyczne usuwanie starych kopii — zachowywane jest max **30** najnowszych backupów

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
npm run backup:restore -- data/backups/backup_2026-06-30_*.sqlite
```

Skrypt weryfikuje wersję bazy (`PRAGMA user_version`) przed nadpisaniem.

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
    npm run backup:restore -- data/backups/backup_*.sqlite
    ```
4. Jeśli schemat różni się między wersjami:
    ```bash
    npx prisma db push --skip-generate
    ```

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

_Ostatnia aktualizacja: 2026-06-30_
