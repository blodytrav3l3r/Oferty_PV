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

### 5. Dowód automatyczny dla każdej zmiany

Dla każdego endpointu musi istnieć dowód automatyczny, że odpowiedź API przed i po migracji jest semantycznie identyczna (API contract snapshot test). Dla każdej migrowanej tabeli — dowód, że dane źródłowe i docelowe są identyczne po canonicalizacji (SHA-256 checksum + deep diff).

### 6. Nie usuwamy danych legacy przed walidacją

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

| Element            | Lokalizacja | Użycie    | Decyzja |
| ------------------ | ----------- | --------- | ------- |
| `pricelist_rury`   | ...         | runtime   | MIGRATE |
| `pricelistService` | ...         | wrapper   | DELETE  |
| `CategoriesRury`   | ...         | seed only | DELETE  |

**Nie usuwamy niczego na podstawie założenia.**

### 3.4. Aktualny audyt (wykonany)

Wyniki pełnego skanu znajdują się poniżej — potwierdzają brak ukrytych zależności.

#### Klucze settings

| Klucz                       | Pliki                                          | Decyzja                             |
| --------------------------- | ---------------------------------------------- | ----------------------------------- |
| `pricelist_rury`            | `productsV2.ts`, `migrate-to-tables.ts`        | MIGRUJ → ProductsRury               |
| `pricelist_rury_default`    | `productsV2.ts`                                | MIGRUJ → ProductsRuryDefault        |
| `pricelist_studnie`         | `productsStudnieV2.ts`, `migrate-to-tables.ts` | MIGRUJ → ProductsStudnie            |
| `pricelist_studnie_default` | `productsStudnieV2.ts`                         | MIGRUJ → ProductsStudnieDefault     |
| `preco_pricing`             | `precoPricingV2.ts`, `pricelistService.ts`     | MIGRUJ → PrecoKonfig+Kinety+Zakresy |
| `preco_pricing_default`     | `precoPricingV2.ts`, `pricelistService.ts`     | MIGRUJ → Preco*Default              |

#### CategoriesRury / CategoriesStudnie

| Lokalizacja             | Użycie                                | Decyzja                        |
| ----------------------- | ------------------------------------- | ------------------------------ |
| `schema.prisma:424-451` | Definicja modeli + relacje FK         | USUŃ                           |
| `seed.ts`               | Seed kategorii                        | USUŃ (plik seed do nadpisania) |
| `migrate-to-tables.ts`  | Upsert                                | USUŃ (plik do usunięcia)       |
| `productsV2.ts`         | Upsert w `initRuryProductsTable()`    | USUŃ (funkcja do usunięcia)    |
| `productsStudnieV2.ts`  | Upsert w `initStudnieProductsTable()` | USUŃ (funkcja do usunięcia)    |
| Frontend / inne         | Brak                                  | —                              |

**Wniosek:** Żadne runtime zależności poza seedem i inicjalizacją — bezpieczne do usunięcia.

#### pricelistService.ts

| Funkcja                | Konsumenci                                                   | Decyzja                    |
| ---------------------- | ------------------------------------------------------------ | -------------------------- |
| `readPricelist`        | `productsV2.ts`, `productsStudnieV2.ts`, `precoPricingV2.ts` | ZASTĄP bezpośrednim Prisma |
| `writePricelist`       | jw.                                                          | ZASTĄP                     |
| `syncSeedFile`         | jw.                                                          | USUŃ                       |
| `syncSeedFilePatch`    | jw.                                                          | USUŃ                       |
| `syncSeedFileDelete`   | jw.                                                          | USUŃ                       |
| `ensureProductsSeeded` | `app.ts` (przez init*)                                       | USUŃ                       |
| Testy                  | `tests/pricelistService.test.ts` (232 linie)                 | USUŃ cały plik             |

#### init*ProductsTable

| Funkcja                    | Lokalizacja                                         | Decyzja |
| -------------------------- | --------------------------------------------------- | ------- |
| `initRuryProductsTable`    | `productsV2.ts:28-70`, `app.ts:177,235,255`         | USUŃ    |
| `initStudnieProductsTable` | `productsStudnieV2.ts:29-199`, `app.ts:178,235,265` | USUŃ    |

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

### CURRENT ↔ DEFAULT — strukturalny test zgodności

```typescript
test('ProductsRury i ProductsRuryDefault mają identyczne pola', () => {
    const currentFields = getPrismaModelFields('productsRury');
    const defaultFields = getPrismaModelFields('productsRuryDefault');

    // Porównaj zbiory nazw pól (pomijając nazwę tabeli)
    expect(currentFields).toEqual(defaultFields);
});

test('ProductsStudnie i ProductsStudnieDefault mają identyczne pola', () => {
    const currentFields = getPrismaModelFields('productsStudnie');
    const defaultFields = getPrismaModelFields('productsStudnieDefault');
    expect(currentFields).toEqual(defaultFields);
});

test('Preco* i Preco*Default mają identyczne pola', () => {
    // Dla każdej pary (Konfig, Kinety, Zakresy)
    expect(getPrismaModelFields('precoKonfig')).toEqual(getPrismaModelFields('precoKonfigDefault'));
    expect(getPrismaModelFields('precoKinety')).toEqual(getPrismaModelFields('precoKinetyDefault'));
    expect(getPrismaModelFields('precoZakresy')).toEqual(
        getPrismaModelFields('precoZakresyDefault')
    );
});
```

> **SOP:** Każda zmiana schematu modelu CURRENT wymaga odpowiadającej zmiany modelu DEFAULT w tym samym migration PR. Test strukturalny jest obowiązkowym gatem CI.

### Reset — kontrakt

Reset cennika działa wyłącznie na tabelach:

```
POST /reset/:type
  type = 'rury' | 'studnie' | 'preco'

1. Wyczyść CURRENT (DELETE)
2. Skopiuj DEFAULT → CURRENT (INSERT ... SELECT lub createMany)
3. Zwróć nowy stan CURRENT
```

**Reset NIGDY nie korzysta z:**

- `settings` JSON (to już legacy)
- plików seed (`seed_*.json`)
- zewnętrznych źródeł danych

**Reset używa WYŁĄCZNIE:**

- `ProductsRuryDefault` → `ProductsRury`
- `ProductsStudnieDefault` → `ProductsStudnie`
- `Preco*Default` → `Preco*`

**Implementacja (koncepcyjna):**

```typescript
async function resetPricelist(type: 'rury' | 'studnie' | 'preco') {
    await prisma.$transaction(async (tx) => {
        if (type === 'rury') {
            await tx.productsRury.deleteMany();
            const defaults = await tx.productsRuryDefault.findMany();
            await tx.productsRury.createMany({ data: defaults });
        }
        // analogicznie dla studnie, preco
    });
}
```

> **Zasada:** DEFAULT jest zawsze stabilnym snapshotem fabrycznym. Reset przywraca ten snapshot do CURRENT. Jeśli użytkownik chce zresetować DEFAULT do fabrycznego — robi to przez `prisma db seed --force`.

### Decyzja dotycząca typów cen

Obecny system używa `Float` dla cen. **Nie zmieniamy typów w ramach tej migracji** — zachowujemy `Float` dla kompatybilności.

#### Float — obecne zachowanie

- API zwraca ceny jako number: `{ "priceNet": 123.45 }` (nie string)
- `0.1 + 0.2 !== 0.3` — Float ma niedokładność, ale to **już istniejący problem** w obecnym systemie
- Migracja nie zmienia serializacji — to samo Prisma `Float` → ten sam JS number w odpowiedzi
- **Nie ma ryzyka zmiany API** przez Float → Decimal w tej migracji

#### Tech debt: Float → Decimal (przyszłość)

```text
Future task:
- Zmiana Prisma: Float → Decimal(10, 2)
- API może zwracać string zamiast number (zależne od serializacji Decimal przez Prisma)
- Wymaga testów kontraktowych API przed i po
- Nie robić razem z migracją architektury
```

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
- **Bezpieczny** — **nigdy nie nadpisuje istniejącej bazy** bez jawnej zgody

### Safety guard

```typescript
async function main() {
    // Sprawdź, czy którakolwiek tabela docelowa zawiera dane
    const [rury, studnie, preco] = await Promise.all([
        prisma.productsRury.count(),
        prisma.productsStudnie.count(),
        prisma.precoKonfig.count()
    ]);

    if (rury > 0 || studnie > 0 || preco > 0) {
        if (!process.argv.includes('--force')) {
            console.error(
                'SEED BEZPIECZEŃSTWO: Baza zawiera dane (%d rury, %d studnie, %d preco).',
                rury,
                studnie,
                preco
            );
            console.error('Uruchom z --force aby nadpisać: npx prisma db seed -- --force');
            process.exit(1);
        }
        console.warn('UWAGA: --force wykryty. Istniejące dane zostaną nadpisane!');
    }

    // ... właściwy seed
}
```

> **Zasada:** `prisma db seed` (bez `--force`) jest bezpieczne na produkcyjnej bazie — failuje z jasnym komunikatem, jeśli baza ma już dane.

### Konwersja boolean (fromLegacy)

Dane w `seed_studnie.json` są w formacie legacy (0/1). Przed zapisem do Prisma:

```typescript
const normalized = studnieData.map((p) => ({
    ...p,
    magazynWL: p.magazynWL === 1 || p.magazynWL === true,
    magazynKLB: p.magazynKLB === 1 || p.magazynKLB === true,
    formaStandardowa: p.formaStandardowa === 1 || p.formaStandardowa === true,
    formaStandardowaKLB: p.formaStandardowaKLB === 1 || p.formaStandardowaKLB === true,
    active: p.active === 1 || p.active === true
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

| Endpoint       | Implementacja                                                                              |
| -------------- | ------------------------------------------------------------------------------------------ |
| `GET /`        | `prisma.productsRury.findMany({ orderBy: [{category: 'asc'}, {id: 'asc'}] })` → `{ data }` |
| `GET /default` | `prisma.productsRuryDefault.findMany(...)` → `{ data }`                                    |
| `PUT /`        | transakcja: `deleteMany()` + `createMany()` na `productsRury`                              |
| `PATCH /:id`   | `prisma.productsRury.update({ where: { id }, data: patch })`                               |
| `DELETE /:id`  | `prisma.productsRury.delete({ where: { id } })`                                            |

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
function fromLegacy(p: StudnieProductLegacy): Prisma.ProductsStudnieCreateInput {
    return {
        id: p.id,
        name: p.name,
        category: p.category,
        wymiar: p.wymiar,
        dn: p.dn,
        diameter: p.diameter,
        height: p.height,
        weight: p.weight,
        priceNet: p.priceNet,
        stdPrice: p.stdPrice,
        stc: p.stc,
        // ... wszystkie pozostałe pola jawnie wymienione
        magazynWL: p.magazynWL === 1 || p.magazynWL === true,
        magazynKLB: p.magazynKLB === 1 || p.magazynKLB === true,
        formaStandardowa: p.formaStandardowa === 1 || p.formaStandardowa === true,
        formaStandardowaKLB: p.formaStandardowaKLB === 1 || p.formaStandardowaKLB === true,
        active: p.active === 1 || p.active === true
    };
}
```

> **Zasada:** `fromLegacy()` używa jawnego whitelistu pól, NIGDY `...p`. Zapobiega to przypadkowemu przedostaniu się legacy-only pól do Prisma.

### `fromLegacyPatch()` — dla PATCH

PATCH przyjmuje częściowy payload w formacie legacy i konwertuje tylko przesłane pola:

```typescript
function fromLegacyPatch(patch: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    const booleanFields = [
        'magazynWL',
        'magazynKLB',
        'formaStandardowa',
        'formaStandardowaKLB',
        'active'
    ];

    for (const [key, value] of Object.entries(patch)) {
        if (booleanFields.includes(key)) {
            result[key] = value === 1 || value === true;
        } else {
            result[key] = value;
        }
    }
    return result;
}
```

### Endpoint PATCH

```typescript
router.patch('/:id', adminAuth, async (req, res) => {
    const patch = fromLegacyPatch(req.body);
    const updated = await prisma.productsStudnie.update({
        where: { id: req.params.id },
        data: patch
    });
    res.json({ data: toLegacy(updated) });
});
```

> **Uwaga:** Dotyczy zarówno studni, jak i PRECO — frontend może wysyłać legacy format (0/1) nawet po migracji.

### Endpointy

| Endpoint       | Implementacja                                                  |
| -------------- | -------------------------------------------------------------- |
| `GET /`        | `prisma.productsStudnie.findMany()` → `.map(toLegacy)`         |
| `GET /default` | `prisma.productsStudnieDefault.findMany()` → `.map(toLegacy)`  |
| `PUT /`        | `arr.map(fromLegacy)` → transakcja `deleteMany` + `createMany` |
| `PATCH /:id`   | `prisma.productsStudnie.update()` → `.then(toLegacy)`          |
| `DELETE /:id`  | `prisma.productsStudnie.delete()`                              |

**Konwersje muszą być jawne** — nie wolno dopuścić do przypadkowego castowania `1/0` z legacy na Prisma boolean.

---

## 11. Faza 8 — `precoPricingV2.ts` (PRECO)

### Usuń

- Import `readPricelist`, `writePricelist`, `syncSeedFile` z pricelistService
- `fs`, `path` (niepotrzebne)
- IIFE seed (linie 24-52) — seed robi `prisma/seed.ts`
- `SETTINGS_KEY`, `SETTINGS_KEY_DEFAULT`

### Endpointy

| Endpoint       | Implementacja                                                                          |
| -------------- | -------------------------------------------------------------------------------------- |
| `GET /`        | `prisma.precoKonfig.findMany()` + `precoKinety` + `precoZakresy` → format zagnieżdżony |
| `GET /default` | `prisma.preco*Default.findMany()` → format zagnieżdżony                                |
| `PUT /`        | transakcja: delete wszystkich Preco* + createMany                                      |
| `PATCH /`      | transakcja: aktualizacja poszczególnych tabel                                          |

**Kolejność delete:** najpierw `PrecoZakresy`, `PrecoKinety`, potem `PrecoKonfig` (brak FK, ale kolejność dla bezpieczeństwa).

**Funkcja `formatPrecoResponse()`** przekształca płaskie tabele Prisma z powrotem do zagnieżdżonego formatu oczekiwanego przez frontend (compatybilność wsteczna).

### PRECO round-trip test — krytyczny

PRECO jest najbardziej ryzykowną częścią migracji. Wymagany obowiązkowy test przed Deploy 2:

```typescript
test('PRECO round-trip: legacy → Prisma → formatPrecoResponse → deep equal', () => {
    // 1. Weź fixture legacy PRECO (z settings.preco_pricing)
    const legacyFixture = loadFixture('preco_legacy.json');

    // 2. Zapisz do tabel Prisma przez fromLegacy (lub bezpośrednio)
    // 3. Odczytaj przez formatPrecoResponse()
    const result = formatPrecoResponse(prismaData);

    // 4. Porównaj deep equality z legacyFixture
    //    (z canonical sort kluczy dla pominięcia kolejności)
    expect(canonicalize(result)).toEqual(canonicalize(legacyFixture));
});
```

Test musi sprawdzać:

- kolejność `kinety` (ma znaczenie dla UX)
- kolejność zakresów
- `null` vs brak klucza
- typy liczb (Float)
- zagnieżdżone JSON-y wewnątrz pól
- duplikaty (jeśli występują w legacy)

---

## 12. Faza 9 — bezpieczna migracja produkcyjna

### Skrypt: `scripts/migrate-settings-to-tables.ts`

**Migracja musi być: idempotentna, transakcyjna, bezpieczna przy ponownym uruchomieniu.**

```
1. Backup (opcjonalnie lub wymagany --backup)
2. Odczyt legacy (settings.*)
3. Walidacja legacy (sprawdź JSON, wymagane pola)
4. Obliczenie SHA-256 legacy (canonical sort + stringify + hash)
5. Transakcja: deleteMany + createMany na docelowych tabelach
6. Obliczenie SHA-256 Prisma (canonical sort + stringify + hash)
7. Porównanie source vs target:
   - count = count
   - SHA-256(legacy) === SHA-256(prisma)
8. Jeśli mismatch → automatyczny ROLLBACK transakcji
9. Raport: PASS / FAIL z checksumami
```

**Skrypt NIE robi:**

- Nie sprawdza `if (count === 0)` przed migracją
- Nie usuwa `settings` po migracji
- Nie nadpisuje danych produkcyjnych seedem

### Ochrona przed równoległym zapisem

System jest projektowany jako **jednoadministracyjny** (ryzyko równoczesnego zapisu dwóch adminów jest niskie).

Na poziomie aplikacji stosujemy:

1. **Transakcyjność** — każdy PUT / reset działa w `$transaction`
2. **Sanity check** — po `createMany` weryfikacja count przed COMMIT
3. **Aplikacyjna blokada** (opcjonalnie) — zmienna `isWriting` blokująca drugi równoczesny zapis

```typescript
let writeLock = false;

router.put('/', adminAuth, async (req, res) => {
    if (writeLock) {
        return res.status(409).json({ error: 'Inny zapis w toku. Spróbuj ponownie.' });
    }
    writeLock = true;
    try {
        await prisma.$transaction(async (tx) => {
            /* ... */
        });
    } finally {
        writeLock = false;
    }
});
```

> **Uwaga:** W systemie produkcyjnym z wieloma adminami rozważyć `updatedAt` + optimistic locking lub per-tabelę blokadę. Na obecnym etapie aplikacyjna flaga `writeLock` jest wystarczająca.

### Schemat blokowy migracji

```
┌────────────────────────────┐
│   START migracji           │
└────────┬───────────────────┘
         ▼
┌────────────────────────────┐
│   Backup SQLite            │ ← --backup
└────────┬───────────────────┘
         ▼
┌────────────────────────────┐
│   Odczyt settings.*        │
│   Walidacja JSON           │
│   Wymagane pola OK?        │
└────────┬───────────────────┘
    FAIL │         │ OK
         ▼         ▼
     ┌───────────────────────┐
     │ STOP z błędem         │
     └───────────────────────┘
                   │ OK
                   ▼
         ┌───────────────────┐
         │ SHA-256(source)   │ ← canonical sort + hash
         └────────┬──────────┘
                  ▼
         ┌───────────────────┐
         │ BEGIN TX          │
         │ deleteMany()      │
         │ createMany()      │
         │ SHA-256(target)   │
         │ compare           │
         └────────┬──────────┘
    MISMATCH │         │ MATCH
             ▼         ▼
     ┌───────────┐ ┌──────────┐
     │ ROLLBACK  │ │ COMMIT   │
     │ STOP FAIL │ │ PASS ✓   │
     └───────────┘ └──────────┘
```

---

## 13. Faza 10 — walidacja migracji (deep equality + checksum)

### Wymagana: canonicalizacja + SHA-256 checksum

Porównanie liczby rekordów **nie wystarczy** (możliwa permutacja lub podmiana wartości). Każda migracja musi przejść walidację **deep equality**:

```
SOURCE (legacy/settings)
   ↓
JSON.parse / canonical sort
   ↓
SHA-256(source_checksum)
   ↓
deep compare field-by-field
   ↓
TARGET (Prisma)
   ↓
canonical export + sort
   ↓
SHA-256(target_checksum)
```

### Walidator koncepcyjny

```typescript
async function validateMigration() {
    const results: ValidationResult[] = [];

    for (const table of ['rury', 'studnie', 'preco']) {
        const source = await readLegacy(table);
        const target = await readPrisma(table);
        const sourceNorm = canonicalSort(source);
        const targetNorm = canonicalSort(target);
        const sourceHash = sha256(JSON.stringify(sourceNorm));
        const targetHash = sha256(JSON.stringify(targetNorm));
        const mismatches = deepDiff(sourceNorm, targetNorm);
        results.push({
            table,
            sourceCount: source.length,
            targetCount: target.length,
            sourceHash,
            targetHash,
            match: sourceHash === targetHash,
            mismatches: mismatches.length,
            mismatchDetails: mismatches
        });
    }
    return results;
}
```

### Wynik

```
╔══════════════════════════════════════════════════════╗
║           MIGRATION VALIDATION REPORT               ║
╠══════════════════════════════════════════════════════╣
║ Rury:    153=153 | SHA256: abc123... == abc123...   ║
║ Studnie: 427=427 | SHA256: def456... == def456...   ║
║ PRECO:   Config | SHA256: ghi789... == ghi789...    ║
║          Kinety | SHA256: jkl012... == jkl012...    ║
║          Zakresy| SHA256: mno345... == mno345...    ║
╠══════════════════════════════════════════════════════╣
║ FIELD MISMATCHES: 0                                 ║
║ STATUS: PASS                                        ║
╚══════════════════════════════════════════════════════╝
```

Jeżeli `STATUS: FAIL` — migracja nie jest zakończona, wymagany rollback.

### Gate przed Deploy 2

Przed usunięciem `settings` (Deploy 2) wykonaj:

```bash
npm run migration:validate
```

Ten skrypt jest **gate'em** — jeśli nie przejdzie, Deploy 2 jest blokowany.

---

## 14. Faza 11 — usunięcie legacy (2-deploy)

### Deploy 1 — tylko migracja danych

```
1. backup bazy (npm run backup lub z poziomu skryptu z --backup)
2. migrate-settings-to-tables.ts (kopiuje dane z settings do Prisma)
3. walidacja deep equality + checksum
4. produkcja działa (settings + Prisma współistnieją)
```

### Deploy 2 — dopiero po weryfikacji

```
WARUNEK: npm run migration:validate → PASS

1. pełny backup SQLite (kopia pliku .sqlite)
2. usuń klucze settings (pricelist_*, preco_*)
3. usuń dead code (pricelistService, stare skrypty)
4. testy
```

### Rollback — trzy scenariusze

#### 1. Rollback aplikacji (kod)

Jeśli nowy kod ma buga, rollback do starego kodu:

| Scenariusz                                           | Czy działa?                                                                                                                                    |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Stary kod + nowa baza (Prisma ma dane, settings też) | **TAK** — Prisma jest read-only dla starego kodu? **NIE**, stary kod czyta `settings`, które są w Deploy 1 jeszcze obecne. W Deploy 2 już nie. |
| Deploy 1 → rollback kodu                             | **TAK** — settings nieusunięte, stary kod działa                                                                                               |
| Deploy 2 → rollback kodu                             | **NIE** — stary kod wymaga `settings`, które zostały usunięte                                                                                  |

#### 2. Rollback danych (backup SQLite)

```bash
# Przed Deploy 2:
cp data/app.sqlite data/app.sqlite.before_deploy2

# W razie problemu:
npm run backup:restore -- data/app.sqlite.before_deploy2
```

#### 3. Reverse migration (Prisma → settings) — narzędzie recovery

Skrypt awaryjny `scripts/reverse-migration-to-settings.mjs`:

```
1. Odczytaj CURRENT z Prisma
2. Serializuj do formatu legacy (JSON)
3. Zapisz do settings (UPSERT)
4. Zweryfikuj: settings.value === JSON.stringify(prismaData)
```

Ten skrypt jest **narzędziem awaryjnym**, nie normalnym runtime. Pozwala cofnąć migrację nawet po Deploy 2, jeśli okaże się to konieczne.

### Drzewo decyzyjne rollbacku

```
PROBLEM PO DEPLOY 1?
  → wycofaj kod (settings + Prisma współistnieją)
  → dane bezpieczne

PROBLEM PO DEPLOY 2?
  → czy backup SQLite przed Deploy 2? TAK → restore
  → NIE → reverse migration (Prisma → settings)
  → NIE → ostatnia deska: odtwórz z backupu .sqlite
```

---

## 15. Faza 12 — usunięcie dead code

Dopiero po potwierdzeniu braku referencji:

| Plik                                                       | Akcja    | Uzasadnienie                                     |
| ---------------------------------------------------------- | -------- | ------------------------------------------------ |
| `scripts/migrate-to-tables.ts` **(STARY, bez `settings`)** | **Usuń** | Zastąpiony przez `migrate-settings-to-tables.ts` |
| `src/services/pricelistService.ts`                         | **Usuń** | Zastąpiony bezpośrednim Prisma w routerach       |
| `tests/pricelistService.test.ts`                           | **Usuń** | Testy usuniętego serwisu                         |
| `data/seed_rury_raw.json`                                  | **Usuń** | Zastąpiony przez `seed_rury.json`                |
| `data/seed_studnie_raw.json`                               | **Usuń** | Zastąpiony przez `seed_studnie.json`             |

**Zostaw (narzędzia recovery):**

- `data/seed_rury.json` — źródło seed
- `data/seed_studnie.json` — źródło seed
- `data/seed_preco.json` — źródło seed
- `scripts/migrate-settings-to-tables.ts` **(NOWY, z `settings`)** — narzędzie migracyjne / recovery / reverse migration
- `scripts/reverse-migration-to-settings.mjs` — awaryjne cofnięcie migracji (Prisma → settings)
- `scripts/migration-validate.mjs` — walidacja SHA-256 checksum + deep diff
- `scripts/export-settings-to-seed.mjs` — narzędzie eksportu seed

> **Uwaga:** `scripts/migrate-settings-to-tables.ts` (NOWY) i `scripts/migrate-to-tables.ts` (STARY) to dwa różne pliki. Stary jest usuwany, nowy pozostaje jako narzędzie awaryjne.

---

## 16. Faza 13 — testy

### Obowiązkowe

| Test              | Opis                                                 |
| ----------------- | ---------------------------------------------------- |
| API rury          | GET /, PUT /, PATCH /:id, DELETE /:id, GET /default  |
| API studnie       | jw. + toLegacy / fromLegacy round-trip               |
| API PRECO         | GET /, PUT /, GET /default + round-trip deep equal   |
| Migracja          | legacy → Prisma (deep equality + SHA-256 checksum)   |
| Default           | default → Prisma Default (dane identyczne)           |
| Round-trip legacy | legacy → fromLegacy → Prisma → toLegacy → legacy     |
| Bezpieczeństwo    | nieautoryzowany dostęp, brak admina, invalid payload |

### API contract snapshot tests

Najważniejszy test dla zasady **zero zmian funkcjonalnych**:

```typescript
describe('API contract: old vs new response', () => {
    // Dla każdego endpointu:
    // 1. Odpowiedź z legacy implementacji (przed migracją) → zapisana jako fixture
    // 2. Odpowiedź z nowej implementacji (po migracji)
    // 3. deepEqual — muszą być identyczne

    const endpoints = [
        'GET /api/v2/products',
        'GET /api/v2/products/default',
        'GET /api/v2/studnie',
        'GET /api/v2/studnie/default',
        'GET /api/v2/preco',
        'GET /api/v2/preco/default'
    ];

    test.each(endpoints)('%s — response shape unchanged', async (endpoint) => {
        const oldResponse = await loadFixture(endpoint.replace(/[\/\s]/g, '_') + '.json');
        const newResponse = await request(app).get(endpoint);
        expect(canonicalize(newResponse.body)).toEqual(canonicalize(oldResponse));
    });
});
```

**Proces:**

1. Przed migracją: wywołaj każdy endpoint na działającym systemie → zapisz odpowiedź jako fixture JSON
2. Po migracji: test porównuje każdą odpowiedź z fixtureem
3. Jeśli fixture się zmienił (świadomie) — aktualizuj go przez `--updateSnapshot`

> **Gate:** Żaden endpoint nie może zmienić kształtu odpowiedzi. Test contractowy jest obowiązkowym gatem przed Deploy 2.

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

| Temat                       | Decyzja                                                                            |
| --------------------------- | ---------------------------------------------------------------------------------- |
| Runtime source of truth     | **Prisma + SQLite**                                                                |
| JSON                        | **Seed / factory data / export**                                                   |
| `GET /default`              | **Zachować**                                                                       |
| Defaulty                    | **Osobne modele/tabele** (1:1 struktura)                                           |
| `isDefault` na produktach   | **Nie używać**                                                                     |
| `pricelistService.ts`       | **Usunąć** (jest tylko wrapperem)                                                  |
| `app.ts` seed               | **Usunąć całkowicie**                                                              |
| `prisma/seed.ts`            | **Jedyny mechanizm inicjalizacji nowej bazy**                                      |
| `settings`                  | **Tylko migracja, potem usunięte**                                                 |
| Migracja produkcji          | **Osobny skrypt `migrate-settings-to-tables.ts`**                                  |
| Migracja + usunięcie legacy | **Dwa deploymenty**                                                                |
| Skrypt migracyjny           | **Idempotentny + transakcyjny**                                                    |
| Walidacja                   | **Obowiązkowa przed usunięciem legacy**                                            |
| `deleteMany + createMany`   | **Bezpieczne w transakcji** — wymagany sanity check przed COMMIT                   |
| Walidacja migracji          | **SHA-256 checksum + deep diff** (nie tylko count)                                 |
| Seed safety                 | **Fail na istniejącej bazie** — wymagany `--force` do nadpisania                   |
| `fromLegacy()`              | **Jawny whitelist pól** — NIGDY `...p`                                             |
| `fromLegacyPatch()`         | **Osobna funkcja** dla PATCH z konwersją boolean                                   |
| Reset → DEFAULT → CURRENT   | **Tylko tabele DEFAULT** — nie seed, nie settings                                  |
| Rollback Deploy 2           | **Backup SQLite przed Deploy 2 + reverse migration script**                        |
| API contract testy          | **Snapshot fixtures** — gate przed Deploy 2                                        |
| CURRENT ↔ DEFAULT           | **Strukturalny test zgodności pól** — SOP dla przyszłych zmian                     |
| Równoległy zapis            | **Aplikacyjna flaga `writeLock`** — rozszerzyć do optimistic locking w przyszłości |
| Float dla cen               | **Zachować** (osobny tech debt → Decimal)                                          |
| Seedowanie przy starcie     | **Zakazane**                                                                       |
| Konwersje boolean           | **Jawne `fromLegacy()` / `toLegacy()`**                                            |

---

## 21. Podsumowanie plików

| Plik                                        | Operacja                                                                      |
| ------------------------------------------- | ----------------------------------------------------------------------------- |
| `prisma/schema.prisma`                      | **Modyfikacja** — usuń Categories*, dodaj _Default i Preco_ (pełne struktury) |
| `prisma/seed.ts`                            | **Nadpisz** — nowa seed logika                                                |
| `src/routes/productsV2.ts`                  | **Modyfikacja** — bezpośrednio Prisma, usuń init*/pricelistService            |
| `src/routes/productsStudnieV2.ts`           | **Modyfikacja** — jw. + fromLegacy()                                          |
| `src/routes/precoPricingV2.ts`              | **Modyfikacja** — Prisma zamiast settings                                     |
| `src/app.ts`                                | **Modyfikacja** — usuń init*ProductsTable                                     |
| `src/services/pricelistService.ts`          | **Usuń**                                                                      |
| `tests/pricelistService.test.ts`            | **Usuń**                                                                      |
| `tests/apiValidation.test.ts`               | **Modyfikacja** — nowe mocki modeli Prisma                                    |
| `scripts/migrate-to-tables.ts`              | **Usuń**                                                                      |
| `scripts/migrate-settings-to-tables.ts`     | **Dodaj** — migracja danych z settings (z deep equality walidacją)            |
| `scripts/reverse-migration-to-settings.mjs` | **Dodaj** — awaryjny reverse migration (Prisma → settings)                    |
| `scripts/export-settings-to-seed.mjs`       | **Dodaj** — eksport seed_rury.json                                            |
| `scripts/migration-validate.mjs`            | **Dodaj** — narzędzie walidacji (SHA-256 checksum + deep diff)                |
| `data/seed_rury_raw.json`                   | **Usuń**                                                                      |
| `data/seed_studnie_raw.json`                | **Usuń**                                                                      |
| `data/seed_rury.json`                       | **Modyfikacja** — wypełnij danymi (Faza 2)                                    |
| `package.json`                              | **Modyfikacja** — jeden skrypt seed                                           |
| `docs/audits/pricing-dependencies.md`       | **Dodaj** — wynik audytu (Faza 0)                                             |
