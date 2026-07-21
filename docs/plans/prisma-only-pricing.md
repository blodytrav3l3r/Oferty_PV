# Master Plan — Prisma jako źródło prawdy dla cenników

**Projekt:** WITROS Oferty PV
**Cel:** migracja cenników z `settings`/JSON do Prisma + SQLite
**Zasada nadrzędna:** zero zmian funkcjonalnych dla użytkownika
**Status:** plan rekomendowany do implementacji

---

## 0. Cel architektoniczny

Po migracji:

```
                    ┌──────────────────────┐
                    │   Frontend / API     │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │    Prisma + SQLite   │
                    │  RUNTIME SOURCE OF   │
                    │       TRUTH          │
                    └──────────┬───────────┘
                               │
                  ┌────────────┴────────────┐
                  │                         │
                  ▼                         ▼
          Aktualny cennik            Default / Factory
          edytowany przez            snapshot do resetu
          użytkowników
```

JSON (`data/seed_*.json`) nie jest runtime source of truth. Służy wyłącznie do:
- inicjalizacji nowej bazy,
- odtworzenia danych fabrycznych,
- eksportu/importu,
- wersjonowania danych fabrycznych w Git.

`settings` — LEGACY / MIGRATION ONLY. Po zakończeniu migracji nie zawiera cenników.

---

## 1. Nienaruszalne zasady migracji

### 1. Zero zmian funkcjonalnych
Nie zmieniamy: endpointów publicznych, formatów odpowiedzi API, nazw pól JSON, zachowania frontendu, uprawnień, walidacji, sposobu edycji, resetowania cennika, kolejności produktów, semantyki danych.

### 2. Prisma jest źródłem prawdy runtime
```
API → Prisma → SQLite
```
Nie: `API → settings → JSON`

### 3. JSON nie jest bazą danych
Nie wolno w runtime: `app.ts → JSON → Prisma`. Po migracji nie ma automatycznego seedowania przy starcie.

### 4. Seed ≠ migracja
- `prisma db seed` → NOWA / PUSTA BAZA
- `migrate-settings-to-tables.ts` → ISTNIEJĄCA BAZA PRODUKCYJNA
Nigdy nie mieszamy tych dwóch procesów.

### 5. Nie usuwamy danych legacy przed walidacją
```
backup → migracja → porównanie → testy → potwierdzenie → dopiero usunięcie legacy
```

---

## 2. Zakres migracji

Migracji podlegają:
- Cenniki rur
- Cenniki studni
- PRECO
- Defaulty cenników

Potencjalnie usuwane klucze `settings`:
- `pricelist_rury`, `pricelist_rury_default`
- `pricelist_studnie`, `pricelist_studnie_default`
- `preco_pricing`, `preco_pricing_default`

---

## 3. Faza 0 — pełny audyt przed zmianami

**Nie wolno rozpocząć migracji bez zakończenia tej fazy.**

### 3.1. Pełny scan zależności

```bash
rg "pricelist_rury|pricelist_rury_default|pricelist_studnie|pricelist_studnie_default|preco_pricing|preco_pricing_default" .
rg "CategoriesRury|CategoriesStudnie" .
rg "pricelistService|initRuryProductsTable|initStudnieProductsTable" .
rg "toLegacy|fromLegacy" .
```

Wyniki sklasyfikować: `KEEP | MIGRATE | DELETE | TEST | UNKNOWN`

### 3.2. Audyt obejmuje

backend, frontend, routery, serwisy, seed, skrypty, testy, HTML, dokumentację, Prisma schema.

### 3.3. Wynik fazy

Plik: `docs/audits/pricing-dependencies.md` z tabelą:

| Element | Lokalizacja | Użycie | Decyzja |
|---|---|---|---|
| `pricelist_rury` | ... | runtime | MIGRATE |
| `pricelistService` | ... | wrapper | DELETE |
| `CategoriesRury` | ... | seed only | DELETE |

**Nie usuwamy niczego na podstawie założenia.**

### 3.4. Aktualny audyt (wykonany)

Wyniki pełnego skanu znajdują się poniżej — potwierdzają brak ukrytych zależności.

#### Klucze settings

| Klucz | Pliki | Decyzja |
|---|---|---|
| `pricelist_rury` | `productsV2.ts`, `migrate-to-tables.ts` | MIGRUJ → ProductsRury |
| `pricelist_rury_default` | `productsV2.ts` | MIGRUJ → ProductsRuryDefault |
| `pricelist_studnie` | `productsStudnieV2.ts`, `migrate-to-tables.ts` | MIGRUJ → ProductsStudnie |
| `pricelist_studnie_default` | `productsStudnieV2.ts` | MIGRUJ → ProductsStudnieDefault |
| `preco_pricing` | `precoPricingV2.ts`, `pricelistService.ts` | MIGRUJ → PrecoKonfig+Kinety+Zakresy |
| `preco_pricing_default` | `precoPricingV2.ts`, `pricelistService.ts` | MIGRUJ → Preco*Default |

#### CategoriesRury / CategoriesStudnie

| Lokalizacja | Użycie | Decyzja |
|---|---|---|
| `schema.prisma:424-451` | Definicja modeli + relacje FK | USUŃ |
| `seed.ts` | Seed kategorii | USUŃ (plik seed do nadpisania) |
| `migrate-to-tables.ts` | Upsert | USUŃ (plik do usunięcia) |
| `productsV2.ts` | Upsert w `initRuryProductsTable()` | USUŃ (funkcja do usunięcia) |
| `productsStudnieV2.ts` | Upsert w `initStudnieProductsTable()` | USUŃ (funkcja do usunięcia) |
| Frontend / inne | Brak | — |

**Wniosek:** Żadne runtime zależności poza seedem i inicjalizacją — bezpieczne do usunięcia.

#### pricelistService.ts

| Funkcja | Konsumenci | Decyzja |
|---|---|---|
| `readPricelist` | `productsV2.ts`, `productsStudnieV2.ts`, `precoPricingV2.ts` | ZASTĄP bezpośrednim Prisma |
| `writePricelist` | jw. | ZASTĄP |
| `syncSeedFile` | jw. | USUŃ |
| `syncSeedFilePatch` | jw. | USUŃ |
| `syncSeedFileDelete` | jw. | USUŃ |
| `ensureProductsSeeded` | `app.ts` (przez init*) | USUŃ |
| Testy | `tests/pricelistService.test.ts` (232 linie) | USUŃ cały plik |

#### init*ProductsTable

| Funkcja | Lokalizacja | Decyzja |
|---|---|---|
| `initRuryProductsTable` | `productsV2.ts:28-70`, `app.ts:177,235,255` | USUŃ |
| `initStudnieProductsTable` | `productsStudnieV2.ts:29-199`, `app.ts:178,235,265` | USUŃ |

#### Relacje FK

- `ProductsRury` → `CategoriesRury` (FK na `category`) — usuwane razem z Categories
- `ProductsStudnie` → `CategoriesStudnie` (FK na `category`) — usuwane razem z Categories
- **Żadne inne tabele nie referencjonują ProductsRury ani ProductsStudnie**
- `Preco*` — nie istnieją w obecnej schema, więc brak FK

**Wniosek:** `deleteMany()` + `createMany()` w transakcji jest bezpieczne.

---

## 4. Faza 1 — model Prisma

### Zmiany w `schema.prisma`

1. **Usuń** modele `CategoriesRury` (linie 424-441) i `CategoriesStudnie` (linie 445-451)
2. **Usuń** pole `category_rel` z `ProductsRury` i `ProductsStudnie` (FK do Categories)
3. **Zachowaj** `ProductsRury` i `ProductsStudnie` (bieżący cennik)
4. **Dodaj** `ProductsRuryDefault` — identyczna struktura jak `ProductsRury`
5. **Dodaj** `ProductsStudnieDefault` — IDENTYCZNA struktura pól jak `ProductsStudnie` (wszystkie 33 pola, pełna definicja, bez skrótów)
6. **Dodaj** `PrecoKonfig`, `PrecoKinety`, `PrecoZakresy`
7. **Dodaj** `PrecoKonfigDefault`, `PrecoKinetyDefault`, `PrecoZakresyDefault`

**Zasada:** Każdy model `Default` musi mieć pełną, dosłowną definicję pól — to wymusza ręczną synchronizację przy dodawaniu pól w przyszłości.

### Decyzja dotycząca typów cen

Obecny system używa `Float` dla cen. **Nie zmieniamy typów w ramach tej migracji** — zachowujemy `Float` dla kompatybilności. Konwersja `Float → Decimal` będzie osobnym zadaniem (tech debt).

```bash
npx prisma migrate dev --name prisma-only-pricing
npx prisma generate
```

---

## 5. Faza 2 — przygotowanie danych seed

### Cel

Wypełnienie `data/seed_rury.json` danymi z `settings.pricelist_rury` (obecnie plik jest pusty `[]`).

### Skrypt: `scripts/export-settings-to-seed.mjs`

```
1. Połącz z SQLite (przez Prisma lub better-sqlite3)
2. SELECT value FROM settings WHERE key = 'pricelist_rury'
3. Walidacja JSON
4. Sprawdź wymagane pola (id, name, category, price)
5. Wykryj duplikaty ID
6. Zapisz do data/seed_rury.json
7. Wygeneruj raport:
   Source records: N
   Exported records: N
   Duplicates: 0
   Missing fields: 0
   Checksum: XXXXX
```

**Opcjonalnie:** to samo dla `seed_studnie.json` (aktualizacja istniejącego pliku z produkcyjnymi danymi).

**Ważne:** Seed fabryczny (`seed_rury.json`) nie musi być aktualnym produkcyjnym cennikiem. Rozdzielamy FACTORY DEFAULT od CURRENT PRODUCTION STATE.

---

## 6. Faza 3 — implementacja `prisma/seed.ts`

`prisma/seed.ts` jest **jedynym** mechanizmem inicjalizacji nowej bazy.

### Logika seedowania

```
seed_rury.json
  → ProductsRury.createMany()
  → ProductsRuryDefault.createMany()

seed_studnie.json
  → ProductsStudnie.createMany() (z fromLegacy: boolean konwersja)
  → ProductsStudnieDefault.createMany()

seed_preco.json
  → PrecoKonfig, PrecoKinety, PrecoZakresy
  → Preco*Default
```

### Wymagania

- **Deterministyczny** — wielokrotne uruchomienie daje ten sam wynik
- **Idempotentny** — `deleteMany()` przed `createMany()` lub `skipDuplicates: true`
- **Bezpieczny** — nie tworzy duplikatów przy ponownym uruchomieniu

### Konwersja boolean (fromLegacy)

Dane w `seed_studnie.json` są w formacie legacy (0/1). Przed zapisem do Prisma:

```typescript
const normalized = studnieData.map((p) => ({
  ...p,
  magazynWL: p.magazynWL === 1 || p.magazynWL === true,
  magazynKLB: p.magazynKLB === 1 || p.magazynKLB === true,
  formaStandardowa: p.formaStandardowa === 1 || p.formaStandardowa === true,
  formaStandardowaKLB: p.formaStandardowaKLB === 1 || p.formaStandardowaKLB === true,
  active: p.active === 1 || p.active === true,
}));
```

---

## 7. Faza 4 — całkowite usunięcie seedowania z runtime

Z `app.ts` usunąć:

- Import `initRuryProductsTable`, `initStudnieProductsTable`
- Wywołania tych funkcji (linie 254-273)
- Eksport (linia 235)
- Nie dodawać `ensureTablesSeeded()` ani żadnego seedowania na starcie

Docelowo:
```
prisma db seed → inicjalizacja danych
app.ts         → uruchomienie aplikacji (bez sprawdzania count, bez seedowania)
```

---

## 8. Faza 5 — usunięcie `pricelistService.ts`

`pricelistService.ts` jest tylko wrapperem (`readPricelist`, `writePricelist`, `syncSeedFile*`) — **usuwamy go w całości**.

Routery będą operować bezpośrednio na Prisma.

**Pliki do usunięcia:**
- `src/services/pricelistService.ts`
- `tests/pricelistService.test.ts` (232 linie testów dla nieistniejącego serwisu)

Weryfikacja przed usunięciem:
```bash
rg "pricelistService" src/ --include "*.ts"  # → 0 wyników
```

---

## 9. Faza 6 — `productsV2.ts` (rury)

### Usuń
- Import z `pricelistService`
- `initRuryProductsTable()` (linie 28-70)
- `PricelistConfig` (linie 21-26)
- `syncSeedFile()`, `syncSeedFilePatch()`, `syncSeedFileDelete()` we wszystkich endpointach

### Endpointy

| Endpoint | Implementacja |
|---|---|
| `GET /` | `prisma.productsRury.findMany({ orderBy: [{category: 'asc'}, {id: 'asc'}] })` → `{ data }` |
| `GET /default` | `prisma.productsRuryDefault.findMany(...)` → `{ data }` |
| `PUT /` | transakcja: `deleteMany()` + `createMany()` na `productsRury` |
| `PATCH /:id` | `prisma.productsRury.update({ where: { id }, data: patch })` |
| `DELETE /:id` | `prisma.productsRury.delete({ where: { id } })` |

**Nie eksportuj** `initRuryProductsTable`.

---

## 10. Faza 7 — `productsStudnieV2.ts` (studnie)

### Usuń
- Import z `pricelistService`
- `initStudnieProductsTable()` (linie 29-199)
- `PricelistConfig` (linie 22-27)
- Import `type { ProductsStudnie }` (linia 17)

### Zachowaj
- `toLegacy()` — dla GET / GET /default
- Interfejs `StudnieProductLegacy`

### Dodaj
- `fromLegacy()` — konwersja przed zapisem do Prisma

```typescript
function fromLegacy(p: Record<string, unknown>): Record<string, unknown> {
  return {
    ...p,
    magazynWL: p.magazynWL === 1 || p.magazynWL === true,
    magazynKLB: p.magazynKLB === 1 || p.magazynKLB === true,
    formaStandardowa: p.formaStandardowa === 1 || p.formaStandardowa === true,
    formaStandardowaKLB: p.formaStandardowaKLB === 1 || p.formaStandardowaKLB === true,
    active: p.active === 1 || p.active === true,
  };
}
```

### Endpointy

| Endpoint | Implementacja |
|---|---|
| `GET /` | `prisma.productsStudnie.findMany()` → `.map(toLegacy)` |
| `GET /default` | `prisma.productsStudnieDefault.findMany()` → `.map(toLegacy)` |
| `PUT /` | `arr.map(fromLegacy)` → transakcja `deleteMany` + `createMany` |
| `PATCH /:id` | `prisma.productsStudnie.update()` → `.then(toLegacy)` |
| `DELETE /:id` | `prisma.productsStudnie.delete()` |

**Konwersje muszą być jawne** — nie wolno dopuścić do przypadkowego castowania `1/0` z legacy na Prisma boolean.

---

## 11. Faza 8 — `precoPricingV2.ts` (PRECO)

### Usuń
- Import `readPricelist`, `writePricelist`, `syncSeedFile` z pricelistService
- `fs`, `path` (niepotrzebne)
- IIFE seed (linie 24-52) — seed robi `prisma/seed.ts`
- `SETTINGS_KEY`, `SETTINGS_KEY_DEFAULT`

### Endpointy

| Endpoint | Implementacja |
|---|---|
| `GET /` | `prisma.precoKonfig.findMany()` + `precoKinety` + `precoZakresy` → format zagnieżdżony |
| `GET /default` | `prisma.preco*Default.findMany()` → format zagnieżdżony |
| `PUT /` | transakcja: delete wszystkich Preco* + createMany |
| `PATCH /` | transakcja: aktualizacja poszczególnych tabel |

**Kolejność delete:** najpierw `PrecoZakresy`, `PrecoKinety`, potem `PrecoKonfig` (brak FK, ale kolejność dla bezpieczeństwa).

**Funkcja `formatPrecoResponse()`** przekształca płaskie tabele Prisma z powrotem do zagnieżdżonego formatu oczekiwanego przez frontend (compatybilność wsteczna).

---

## 12. Faza 9 — bezpieczna migracja produkcyjna

### Skrypt: `scripts/migrate-settings-to-tables.ts`

**Migracja musi być: idempotentna, transakcyjna, bezpieczna przy ponownym uruchomieniu.**

```
1. Backup (opcjonalnie)
2. Odczyt legacy (settings.*)
3. Walidacja legacy (sprawdź JSON, wymagane pola)
4. Transakcja: deleteMany + createMany na docelowych tabelach
5. To samo dla *Default
6. Porównanie source vs target (liczba rekordów)
7. Raport
8. Jeśli mismatch → ROLLBACK / STOP
```

**Skrypt NIE robi:**
- Nie sprawdza `if (count === 0)` przed migracją
- Nie usuwa `settings` po migracji
- Nie nadpisuje danych produkcyjnych seedem

---

## 13. Faza 10 — walidacja migracji

Po migracji porównać dla każdego cennika:

- liczba rekordów
- ID, nazwa, cena, kategoria
- wartości boolean (0/1 → true/false)
- wartości opcjonalne
- kolejność (jeśli ma znaczenie)

Dla PRECO: konfiguracja, kinety, zakresy.

Wynik:
```
MIGRATION VALIDATION
Rury:      Legacy 153 / Prisma 153 / Mismatch 0
Studnie:   Legacy 427 / Prisma 427 / Mismatch 0
PRECO:     Config OK / Kinety OK / Zakresy OK
STATUS: PASS
```

Jeżeli `STATUS: FAIL` — migracja nie jest zakończona.

---

## 14. Faza 11 — usunięcie legacy (2-deploy)

### Deploy 1 — tylko migracja danych

```
1. backup bazy
2. migrate-settings-to-tables.ts (kopiuje dane z settings do Prisma)
3. walidacja
4. produkcja działa (settings + Prisma współistnieją)
```

### Deploy 2 — dopiero po weryfikacji

```
1. usuń klucze settings (pricelist_*, preco_*)
2. usuń dead code (pricelistService, stare skrypty)
3. testy
```

Daje to możliwość rollbacku na każdym etapie.

---

## 15. Faza 12 — usunięcie dead code

Dopiero po potwierdzeniu braku referencji:

| Plik | Akcja |
|---|---|
| `scripts/migrate-to-tables.ts` | **Usuń** |
| `src/services/pricelistService.ts` | **Usuń** |
| `tests/pricelistService.test.ts` | **Usuń** |
| `data/seed_rury_raw.json` | **Usuń** |
| `data/seed_studnie_raw.json` | **Usuń** |

**Zostaw:**
- `data/seed_rury.json` — źródło seed
- `data/seed_studnie.json` — źródło seed
- `data/seed_preco.json` — źródło seed
- `scripts/migrate-settings-to-tables.ts` — na wypadek odtworzenia
- `scripts/export-settings-to-seed.mjs` — na wypadek odtworzenia seed

---

## 16. Faza 13 — testy

### Obowiązkowe

| Test | Opis |
|---|---|
| API rury | GET /, PUT /, PATCH /:id, DELETE /:id, GET /default |
| API studnie | jw. + toLegacy / fromLegacy round-trip |
| API PRECO | GET /, PUT /, GET /default |
| Migracja | legacy → Prisma (dane identyczne) |
| Default | default → Prisma Default (dane identyczne) |
| Round-trip legacy | legacy → fromLegacy → Prisma → toLegacy → legacy |
| Bezpieczeństwo | nieautoryzowany dostęp, brak admina, invalid payload |

### Mocki w `tests/apiValidation.test.ts`

Zamień mock `settings` na mocki modeli Prisma: `productsRury`, `productsRuryDefault`, `productsStudnie`, `productsStudnieDefault`, `precoKonfig`, `precoKinety`, `precoZakresy`, `preco*Default`.

---

## 17. Faza 14 — `package.json`

```json
"prisma:seed": "ts-node prisma/seed.ts"
```

Usuń duplikat `"seed"` lub pozostaw jako alias:
```json
"seed": "npm run prisma:seed"
```

Jeden source of truth dla seeda.

---

## 18. Faza 15 — walidacja końcowa

```bash
npx prisma validate
npx prisma generate
npm run typecheck
npm run lint
npm run format
npm run test:quick
```

Testy ręczne:
```
GET /default → zwraca dane
edytuj produkt → zapisz → odśwież → dane zachowane
reset → przywrócenie default
studnie → legacy format zachowany
PRECO → zapis / odczyt zachowany
```

---

## 19. Docelowa architektura

```
                    ┌───────────────────────┐
                    │       Frontend        │
                    └───────────┬───────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │         API           │
                    └───────────┬───────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │    Prisma + SQLite    │
                    └───────────┬───────────┘
                                │
              ┌─────────────────┼─────────────────┐
              │                 │                 │
              ▼                 ▼                 ▼
          CURRENT            DEFAULT            PRECO
          tables             tables             tables
```

Seed:
```
JSON (seed_*.json) → prisma db seed → init nowej bazy
```

Migracja:
```
settings → migration script → Prisma → validation → settings removed
```

---

## 20. Finalne decyzje architektoniczne

| Temat | Decyzja |
|---|---|
| Runtime source of truth | **Prisma + SQLite** |
| JSON | **Seed / factory data / export** |
| `GET /default` | **Zachować** |
| Defaulty | **Osobne modele/tabele** (1:1 struktura) |
| `isDefault` na produktach | **Nie używać** |
| `pricelistService.ts` | **Usunąć** (jest tylko wrapperem) |
| `app.ts` seed | **Usunąć całkowicie** |
| `prisma/seed.ts` | **Jedyny mechanizm inicjalizacji nowej bazy** |
| `settings` | **Tylko migracja, potem usunięte** |
| Migracja produkcji | **Osobny skrypt `migrate-settings-to-tables.ts`** |
| Migracja + usunięcie legacy | **Dwa deploymenty** |
| Skrypt migracyjny | **Idempotentny + transakcyjny** |
| Walidacja | **Obowiązkowa przed usunięciem legacy** |
| `deleteMany + createMany` | **Bezpieczne** (brak FK z innych tabel) |
| `Float` dla cen | **Zachować** (osobny tech debt → Decimal) |
| Seedowanie przy starcie | **Zakazane** |
| Konwersje boolean | **Jawne `fromLegacy()` / `toLegacy()`** |

---

## 21. Podsumowanie plików

| Plik | Operacja |
|---|---|
| `prisma/schema.prisma` | **Modyfikacja** — usuń Categories*, dodaj *Default i Preco* (pełne struktury) |
| `prisma/seed.ts` | **Nadpisz** — nowa seed logika |
| `src/routes/productsV2.ts` | **Modyfikacja** — bezpośrednio Prisma, usuń init*/pricelistService |
| `src/routes/productsStudnieV2.ts` | **Modyfikacja** — jw. + fromLegacy() |
| `src/routes/precoPricingV2.ts` | **Modyfikacja** — Prisma zamiast settings |
| `src/app.ts` | **Modyfikacja** — usuń init*ProductsTable |
| `src/services/pricelistService.ts` | **Usuń** |
| `tests/pricelistService.test.ts` | **Usuń** |
| `tests/apiValidation.test.ts` | **Modyfikacja** — nowe mocki modeli Prisma |
| `scripts/migrate-to-tables.ts` | **Usuń** |
| `scripts/migrate-settings-to-tables.ts` | **Dodaj** — migracja danych z settings |
| `scripts/export-settings-to-seed.mjs` | **Dodaj** — eksport seed_rury.json |
| `data/seed_rury_raw.json` | **Usuń** |
| `data/seed_studnie_raw.json` | **Usuń** |
| `data/seed_rury.json` | **Modyfikacja** — wypełnij danymi (Faza 2) |
| `package.json` | **Modyfikacja** — jeden skrypt seed |
| `docs/audits/pricing-dependencies.md` | **Dodaj** — wynik audytu (Faza 0) |
