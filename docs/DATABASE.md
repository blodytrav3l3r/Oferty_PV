# Baza danych — WITROS Oferty PV

**Silnik:** SQLite  
**ORM:** Prisma 6.0  
**Plik bazy:** `data/app_database.sqlite`

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

### 2. Modele danych

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

| Kolumna   | Typ        | Opis                        |
| --------- | ---------- | --------------------------- |
| id        | String @id | Unikalny identyfikator      |
| userId    | String?    | ID użytkownika (właściciel) |
| name      | String?    | Nazwa klienta               |
| nip       | String?    | NIP                         |
| address   | String?    | Adres                       |
| email     | String?    | Email                       |
| phone     | String?    | Telefon                     |
| contact   | String?    | Osoba kontaktowa            |
| createdAt | String?    | Data utworzenia             |
| updatedAt | String?    | Data aktualizacji           |

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

#### `productsRury` — Produkty (rury)

| Kolumna   | Typ        | Opis                                  |
| --------- | ---------- | ------------------------------------- |
| id        | String @id | Unikalny identyfikator                |
| name      | String     | Nazwa produktu                        |
| category  | String     | Kategoria (relacja do CategoriesRury) |
| price     | Float      | Cena                                  |
| transport | Float?     | Koszt transportu                      |
| weight    | Float?     | Waga                                  |
| area      | Float?     | Powierzchnia                          |

#### `productsStudnie` — Produkty (studnie)

Rozbudowany model z wieloma polami specyficznymi dla studni:

| Kolumna       | Typ        | Opis                                      |
| ------------- | ---------- | ----------------------------------------- |
| id            | String @id | Identyfikator                             |
| name          | String     | Nazwa                                     |
| category      | String     | Kategoria (relacja do CategoriesStudnie)  |
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

#### `categoriesRury` / `categoriesStudnie` — Kategorie

| Kolumna       | Typ        | Opis                           |
| ------------- | ---------- | ------------------------------ |
| name          | String @id | Nazwa kategorii                |
| order         | Int        | Kolejność wyświetlania         |
| componentType | String?    | Typ komponentu (tylko studnie) |

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

#### `order_counters` / `order_counters_rury` — Liczniki numeracji

| Kolumna    | Typ    | Opis                |
| ---------- | ------ | ------------------- |
| userId     | String | ID użytkownika      |
| year       | Int    | Rok                 |
| lastNumber | Int?   | Ostatni użyty numer |

Kompozytowy klucz główny: `(userId, year)`.

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

#### `ai_telemetry_logs` — Telemetria AI

| Kolumna              | Typ        | Opis                      |
| -------------------- | ---------- | ------------------------- |
| id                   | String @id | Identyfikator             |
| userId               | String?    | ID użytkownika            |
| original_auto_config | String?    | Automatyczna konfiguracja |
| final_user_config    | String?    | Ostateczna konfiguracja   |
| override_reason      | String?    | Powód nadpisania          |
| createdAt            | String?    | Data zdarzenia            |

---

## 3. Migracje

Migracje Prisma znajdują się w katalogu `prisma/migrations/`.

### Komendy

| Komenda                  | Opis                          |
| ------------------------ | ----------------------------- |
| `npm run prisma:migrate` | Utwórz nową migrację (dev)    |
| `npm run prisma:deploy`  | Zastosuj migracje w produkcji |
| `npm run prisma:status`  | Status migracji               |
| `npm run prisma:reset`   | Reset bazy (utrata danych!)   |

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

Aby odtworzyć bazę z backupu:

```bash
# Zatrzymaj serwer
# Skopiuj plik backupu do data/app_database.sqlite
cp data/backups/backup_2026-06-30_1234567890.sqlite data/app_database.sqlite
# Uruchom serwer
```

> **TODO:** Dedykowany skrypt `scripts/restore-db.js`.

---

## 6. Wersjonowanie bazy

Obecnie baza nie używa `PRAGMA user_version` do wersjonowania schematu. Zalecane jest dodanie:

```sql
PRAGMA user_version = 100; -- wersja 1.0.0
```

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
