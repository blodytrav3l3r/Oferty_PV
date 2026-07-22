# Unified Pricing System — Plan usunięcia reliktów

## Cel

Usunięcie zdublowanego systemu przechowywania cenników (tabele Prisma + JSON w `settings`)
na rzecz jednolitego systemu przez `pricelistService.ts` (JSON w `settings`).

## Obecny stan

```
settings (JSON)  ← pricelistService.ts  ← routery API  → frontend
       ↓
tabele Prisma    ← init*ProductsTable()  ← app.ts (synch na starcie)
       ↓
seed.ts / migrate-to-tables.ts
```

## Stan docelowy

```
settings (JSON)  ← pricelistService.ts  ← routery API  → frontend
```

---

## Krok 1 — Przepisać `src/routes/productsV2.ts`

**Plik:** `src/routes/productsV2.ts`

Router rur jest prosty — zwraca produkty z polami: `id, name, category, price, transport, weight, area`.

**Zmiany:**

1. Usuń import `prisma` — nie będzie używany.
2. Usuń funkcję `initRuryProductsTable()` (przenosi się do `app.ts` jako inline).
3. Usuń `PricelistConfig` lokalne — będzie współdzielone.
4. Przepisz endpointy:

| Endpoint       | Przed                                                  | Po                                                                           |
| -------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------- |
| `GET /`        | `prisma.productsRury.findMany()`                       | `readPricelist(config.keyCurrent)`                                           |
| `GET /default` | fallback do `prisma.productsRury.findMany()`           | `readPricelist(config.keyDefault)` (bez fallbacku — settings zawsze ma dane) |
| `PUT /`        | transakcja Prisma na `productsRury` + `categoriesRury` | `writePricelist(config.keyCurrent, arr)` + `syncSeedFile()`                  |
| `PATCH /:id`   | `prisma.productsRury.update()`                         | read → modify in memory → `writePricelist()` + `syncSeedFilePatch()`         |
| `DELETE /:id`  | `prisma.productsRury.delete()`                         | read → filter → `writePricelist()` + `syncSeedFileDelete()`                  |

5. **Zachowaj** format odpowiedzi: `res.json({ data: products })` — frontend czeka na `response.data`.

**Kod docelowy:**

```typescript
import express from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { logger } from '../utils/logger';
import { validateData } from '../validators/authSchema';
import { PRICELIST_WRITE_LIMITER } from '../middleware/rateLimiters';
import { pricelistDataSchema, productPatchSchema } from '../validators/offerSchemas';
import {
    ensureProductsSeeded,
    readPricelist,
    writePricelist,
    syncSeedFile,
    syncSeedFilePatch,
    syncSeedFileDelete,
    PricelistConfig
} from '../services/pricelistService';

const router = express.Router();
const writeLimiter = PRICELIST_WRITE_LIMITER;

const config: PricelistConfig = {
    keyCurrent: 'pricelist_rury',
    keyDefault: 'pricelist_rury_default',
    seedPath: 'data/seed_rury.json',
    label: 'rury'
};

const ALLOWED_FIELDS = ['name', 'category', 'price', 'transport', 'weight', 'area'] as const;

// GET /
router.get('/', requireAuth, async (_req, res) => {
    try {
        const data = await readPricelist(config.keyCurrent);
        res.json({ data });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        logger.error('ProductsV2', 'GET error', message);
        res.status(500).json({ error: message });
    }
});

// PUT /
router.put(
    '/',
    requireAuth,
    requireAdmin,
    writeLimiter,
    validateData(pricelistDataSchema),
    async (req, res) => {
        try {
            const arr: Record<string, unknown>[] = req.body.data;
            await writePricelist(config.keyCurrent, arr);
            res.json({ ok: true, count: arr.length });
            syncSeedFile(config.seedPath, arr);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            logger.error('ProductsV2', 'PUT error', message);
            res.status(500).json({ error: message });
        }
    }
);

// PATCH /:id
router.patch(
    '/:id',
    requireAuth,
    requireAdmin,
    writeLimiter,
    validateData(productPatchSchema),
    async (req, res) => {
        try {
            const { id } = req.params;
            const patch: Record<string, unknown> = {};
            for (const key of ALLOWED_FIELDS) {
                if (req.body[key] !== undefined) {
                    patch[key] = req.body[key];
                }
            }
            if (Object.keys(patch).length === 0) {
                res.status(400).json({ error: 'Brak pól do aktualizacji' });
                return;
            }

            const products = await readPricelist(config.keyCurrent);
            const idx = products.findIndex((p) => p.id === id);
            if (idx === -1) {
                res.status(404).json({ error: 'Produkt nie znaleziony' });
                return;
            }
            products[idx] = { ...products[idx], ...patch };
            await writePricelist(config.keyCurrent, products);
            res.json({ ok: true, data: products[idx] });

            syncSeedFilePatch(config.seedPath, id, patch);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            logger.error('ProductsV2', 'PATCH error', message);
            res.status(500).json({ error: message });
        }
    }
);

// DELETE /:id
router.delete('/:id', requireAuth, requireAdmin, writeLimiter, async (req, res) => {
    try {
        const { id } = req.params;
        const products = await readPricelist(config.keyCurrent);
        const filtered = products.filter((p) => p.id !== id);
        if (filtered.length === products.length) {
            res.status(404).json({ error: 'Produkt nie znaleziony' });
            return;
        }
        await writePricelist(config.keyCurrent, filtered);
        res.json({ ok: true });

        syncSeedFileDelete(config.seedPath, id);
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        logger.error('ProductsV2', 'DELETE error', message);
        res.status(500).json({ error: message });
    }
});

// GET /default
router.get('/default', requireAuth, async (_req, res) => {
    try {
        const data = await readPricelist(config.keyDefault);
        res.json({ data });
    } catch {
        res.json({ data: [] });
    }
});

export default router;
```

---

## Krok 2 — Przepisać `src/routes/productsStudnieV2.ts`

**Plik:** `src/routes/productsStudnieV2.ts`

Router studni jest bardziej złożony — ma 33 pola produktu, funkcję `toLegacy()` i interfejsy typów.

**Zmiany:**

1. Usuń import `prisma` oraz `type { ProductsStudnie }` — nie będą używane.
2. Usuń funkcję `initStudnieProductsTable()` — przenosi się do `app.ts` jako inline.
3. Usuń `toLegacy()` i `StudnieProductRaw` / `StudnieProductLegacy` — dane w `settings` są już w formacie legacy (zapisywane przez `syncSeedFile()` z tego samego routera).
4. Przepisz endpointy analogicznie do kroku 1 — wszystkie operacje przez `readPricelist()` / `writePricelist()`.

**Uwaga:** `toLegacy()` konwertował z formatu Prisma (boolean, number) na format legacy (0/1, string). Ponieważ dane w `settings` są już w formacie legacy (zapisywane jako JSON prosto z frontendu), transformacja nie jest potrzebna. Jeśli jednak istnieje ryzyko, że w settings są dane w formacie Prisma (z okresu przejściowego), trzeba zachować `toLegacy()` dla GET.

**Zalecenie:** Zachowaj `toLegacy()` dla bezpieczeństwa, ale zastosuj go do danych z `readPricelist()` zamiast z Prisma. To gwarantuje, że frontend dostanie dokładnie ten sam format co obecnie.

**Kod docelowy:**

```typescript
import express from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { logger } from '../utils/logger';
import { validateData } from '../validators/authSchema';
import { PRICELIST_WRITE_LIMITER } from '../middleware/rateLimiters';
import { pricelistDataSchema, productStudniePatchSchema } from '../validators/offerSchemas';
import {
    ensureProductsSeeded,
    readPricelist,
    writePricelist,
    syncSeedFile,
    syncSeedFilePatch,
    syncSeedFileDelete,
    PricelistConfig
} from '../services/pricelistService';

const router = express.Router();
const writeLimiter = PRICELIST_WRITE_LIMITER;

const config: PricelistConfig = {
    keyCurrent: 'pricelist_studnie',
    keyDefault: 'pricelist_studnie_default',
    seedPath: 'data/seed_studnie.json',
    label: 'studnie'
};

const ALLOWED_FIELDS = [
    'name',
    'category',
    'componentType',
    'dn',
    'height',
    'weight',
    'price',
    'area',
    'areaExt',
    'transport',
    'magazynWL',
    'magazynKLB',
    'formaStandardowa',
    'formaStandardowaKLB',
    'active',
    'zapasDol',
    'zapasGora',
    'zapasDolMin',
    'zapasGoraMin',
    'spocznikH',
    'hMin1',
    'hMax1',
    'cena1',
    'hMin2',
    'hMax2',
    'cena2',
    'hMin3',
    'hMax3',
    'cena3',
    'doplataPEHD',
    'doplataZelbet',
    'doplataDrabNierdzewna',
    'malowanieWewnetrzne',
    'malowanieZewnetrzne'
] as const;

// Zachowaj toLegacy dla kompatybilności — dane w settings mogą być w formacie Prisma
interface StudnieProductLegacy {
    id: string;
    name: string;
    category: string;
    componentType: string;
    dn: number | string | null;
    height: number | null;
    weight: number | null;
    price: number;
    area: number | null;
    areaExt: number | null;
    transport: number | null;
    magazynWL: number;
    magazynKLB: number;
    formaStandardowa: number;
    formaStandardowaKLB: number;
    active: number;
    zapasDol: number | null;
    zapasGora: number | null;
    zapasDolMin: number | null;
    zapasGoraMin: number | null;
    spocznikH: string | null;
    hMin1: number | null;
    hMax1: number | null;
    cena1: number | null;
    hMin2: number | null;
    hMax2: number | null;
    cena2: number | null;
    hMin3: number | null;
    hMax3: number | null;
    cena3: number | null;
    doplataPEHD: number | null;
    doplataZelbet: number | null;
    doplataDrabNierdzewna: number | null;
    malowanieWewnetrzne: number | null;
    malowanieZewnetrzne: number | null;
}

function toLegacy(p: Record<string, unknown>): StudnieProductLegacy {
    const dnVal: number | string | null =
        p.dn != null ? (isNaN(Number(p.dn)) ? String(p.dn) : Number(p.dn)) : null;
    return {
        id: String(p.id),
        name: String(p.name ?? ''),
        category: String(p.category ?? ''),
        componentType: String(p.componentType ?? ''),
        dn: dnVal,
        height: p.height != null ? Number(p.height) : null,
        weight: p.weight != null ? Number(p.weight) : null,
        price: Number(p.price ?? 0),
        area: p.area != null ? Number(p.area) : null,
        areaExt: p.areaExt != null ? Number(p.areaExt) : null,
        transport: p.transport != null ? Number(p.transport) : null,
        magazynWL: p.magazynWL === true || p.magazynWL === 1 ? 1 : 0,
        magazynKLB: p.magazynKLB === true || p.magazynKLB === 1 ? 1 : 0,
        formaStandardowa: p.formaStandardowa === true || p.formaStandardowa === 1 ? 1 : 0,
        formaStandardowaKLB: p.formaStandardowaKLB === true || p.formaStandardowaKLB === 1 ? 1 : 0,
        active: p.active === true || p.active === 1 ? 1 : 0,
        zapasDol: p.zapasDol != null ? Number(p.zapasDol) : null,
        zapasGora: p.zapasGora != null ? Number(p.zapasGora) : null,
        zapasDolMin: p.zapasDolMin != null ? Number(p.zapasDolMin) : null,
        zapasGoraMin: p.zapasGoraMin != null ? Number(p.zapasGoraMin) : null,
        spocznikH: p.spocznikH != null ? String(p.spocznikH) : null,
        hMin1: p.hMin1 != null ? Number(p.hMin1) : null,
        hMax1: p.hMax1 != null ? Number(p.hMax1) : null,
        cena1: p.cena1 != null ? Number(p.cena1) : null,
        hMin2: p.hMin2 != null ? Number(p.hMin2) : null,
        hMax2: p.hMax2 != null ? Number(p.hMax2) : null,
        cena2: p.cena2 != null ? Number(p.cena2) : null,
        hMin3: p.hMin3 != null ? Number(p.hMin3) : null,
        hMax3: p.hMax3 != null ? Number(p.hMax3) : null,
        cena3: p.cena3 != null ? Number(p.cena3) : null,
        doplataPEHD: p.doplataPEHD != null ? Number(p.doplataPEHD) : null,
        doplataZelbet: p.doplataZelbet != null ? Number(p.doplataZelbet) : null,
        doplataDrabNierdzewna:
            p.doplataDrabNierdzewna != null ? Number(p.doplataDrabNierdzewna) : null,
        malowanieWewnetrzne: p.malowanieWewnetrzne != null ? Number(p.malowanieWewnetrzne) : null,
        malowanieZewnetrzne: p.malowanieZewnetrzne != null ? Number(p.malowanieZewnetrzne) : null
    };
}

// GET /
router.get('/', requireAuth, async (_req, res) => {
    try {
        const products = await readPricelist(config.keyCurrent);
        res.json({ data: products.map(toLegacy) });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        logger.error('ProductsStudnieV2', 'GET error', message);
        res.status(500).json({ error: message });
    }
});

// PUT /
router.put(
    '/',
    requireAuth,
    requireAdmin,
    writeLimiter,
    validateData(pricelistDataSchema),
    async (req, res) => {
        try {
            const arr: Record<string, unknown>[] = req.body.data;
            await writePricelist(config.keyCurrent, arr);
            res.json({ ok: true, count: arr.length });
            syncSeedFile(config.seedPath, arr);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            logger.error('ProductsStudnieV2', 'PUT error', message);
            res.status(500).json({ error: message });
        }
    }
);

// PATCH /:id
router.patch(
    '/:id',
    requireAuth,
    requireAdmin,
    writeLimiter,
    validateData(productStudniePatchSchema),
    async (req, res) => {
        try {
            const { id } = req.params;
            const patch: Record<string, unknown> = {};
            for (const key of ALLOWED_FIELDS) {
                if (req.body[key] !== undefined) {
                    patch[key] = req.body[key];
                }
            }
            if (Object.keys(patch).length === 0) {
                res.status(400).json({ error: 'Brak pól do aktualizacji' });
                return;
            }

            const products = await readPricelist(config.keyCurrent);
            const idx = products.findIndex((p) => p.id === id);
            if (idx === -1) {
                res.status(404).json({ error: 'Produkt nie znaleziony' });
                return;
            }
            products[idx] = { ...products[idx], ...patch };
            await writePricelist(config.keyCurrent, products);
            res.json({ ok: true, data: toLegacy(products[idx]) });

            syncSeedFilePatch(config.seedPath, id, patch);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            logger.error('ProductsStudnieV2', 'PATCH error', message);
            res.status(500).json({ error: message });
        }
    }
);

// DELETE /:id
router.delete('/:id', requireAuth, requireAdmin, writeLimiter, async (req, res) => {
    try {
        const { id } = req.params;
        const products = await readPricelist(config.keyCurrent);
        const filtered = products.filter((p) => p.id !== id);
        if (filtered.length === products.length) {
            res.status(404).json({ error: 'Produkt nie znaleziony' });
            return;
        }
        await writePricelist(config.keyCurrent, filtered);
        res.json({ ok: true });
        syncSeedFileDelete(config.seedPath, id);
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        logger.error('ProductsStudnieV2', 'DELETE error', message);
        res.status(500).json({ error: message });
    }
});

// GET /default
router.get('/default', requireAuth, async (_req, res) => {
    try {
        const data = await readPricelist(config.keyDefault);
        res.json({ data });
    } catch {
        res.json({ data: [] });
    }
});

export default router;
```

**Uwaga:** Nie eksportujemy już `initStudnieProductsTable()` — seedowanie obsługuje `app.ts` przez `ensureProductsSeeded()`.

---

## Krok 3 — Zaktualizować `src/app.ts`

**Plik:** `src/app.ts`

**Zmiany:**

1. Zmień import w linii 177:
    - Przed: `import productRoutes, { initRuryProductsTable } from './routes/productsV2';`
    - Po: `import productRoutes from './routes/productsV2';`

2. Zmień import w linii 178:
    - Przed: `import productStudnieRoutes, { initStudnieProductsTable } from './routes/productsStudnieV2';`
    - Po: `import productStudnieRoutes from './routes/productsStudnieV2';`

3. Usuń eksport w linii 235:
    - Przed: `export { initRuryProductsTable, initStudnieProductsTable };`
    - Po: (usunąć całą linię)

4. Zastąp blok inicjalizacji (linie 253-273):

```typescript
// Seed cenników z plików seed do settings (jeśli brak)
const { ensureProductsSeeded } = await import('./services/pricelistService');
await ensureProductsSeeded({
    keyCurrent: 'pricelist_rury',
    keyDefault: 'pricelist_rury_default',
    seedPath: 'data/seed_rury.json',
    label: 'rury'
});
await ensureProductsSeeded({
    keyCurrent: 'pricelist_studnie',
    keyDefault: 'pricelist_studnie_default',
    seedPath: 'data/seed_studnie.json',
    label: 'studnie'
});
```

Lub prościej — zaimportuj `ensureProductsSeeded` i `PricelistConfig` na górze pliku i użyj lokalnych konfiguracji.

---

## Krok 4 — Usunąć modele z `prisma/schema.prisma`

**Plik:** `prisma/schema.prisma`

Usuń linie 422-497 (modele `CategoriesRury`, `ProductsRury`, `CategoriesStudnie`, `ProductsStudnie` wraz z komentarzami).

**Po usunięciu** wykonaj:

```bash
npx prisma migrate dev --name remove-products-tables
```

To wygeneruje migrację SQL z `DROP TABLE` dla tych 4 tabel.

---

## Krok 5 — Wyrzucić niepotrzebne skrypty i pliki

**Usuń pliki:**

| Plik                           | Powód                                                                                        |
| ------------------------------ | -------------------------------------------------------------------------------------------- |
| `prisma/seed.ts`               | Seedował do tabel Prisma — nie istnieją. Seedowanie robi `pricelistService.ts` → `settings`. |
| `scripts/migrate-to-tables.ts` | Jednorazowa migracja — już wykonana na produkcji.                                            |
| `data/seed_rury_raw.json`      | Surowy plik źródłowy — nieużywany przez kod.                                                 |
| `data/seed_studnie_raw.json`   | Surowy plik źródłowy — nieużywany przez kod.                                                 |

**Zostaw:**

- `data/seed_rury.json` — puste `[]` ale wymagane przez `config.seedPath` w routerze.
- `data/seed_studnie.json` — faktyczne dane, wymagane przez `config.seedPath`.

---

## Krok 6 — Zaktualizować `tests/apiValidation.test.ts`

**Plik:** `tests/apiValidation.test.ts`

1. Usuń mocki dla `productsRury` i `categoriesRury` w obiekcie prisma (linie 55-56, 63-64).
2. Dodaj mock dla `settings` z `findUnique` zwracającym `null` (bo produkty nie będą już seedowane z Prisma).
3. Alternatywnie: zamockuj `pricelistService` zamiast prisma — ale to wymaga większych zmian. Prościej: uzupełnij mock prisma o `settings`.

---

## Krok 7 — Zaktualizować `package.json`

**Plik:** `package.json`

Usuń skrypty:

- `"prisma:seed": "ts-node prisma/seed.ts"` (linia 29)

Skrypt `"seed": "ts-node prisma/seed.ts"` (linia 122, jeśli istnieje) również do usunięcia.

---

## Krok 8 — Końcowa walidacja

```bash
npx prisma generate          # Regeneracja klienta Prisma po zmianach schema
npm run typecheck             # TypeScript — brak błędów
npm run lint                  # ESLint — brak błędów
npm run format                # Prettier
npm run test:quick            # Testy przechodzą
```

---

## Podsumowanie plików

| Plik                                   | Operacja                                                |
| -------------------------------------- | ------------------------------------------------------- |
| `src/routes/productsV2.ts`             | **Modyfikacja** — przepisanie na pricelistService       |
| `src/routes/productsStudnieV2.ts`      | **Modyfikacja** — przepisanie na pricelistService       |
| `src/app.ts`                           | **Modyfikacja** — uproszczenie importów i inicjalizacji |
| `prisma/schema.prisma`                 | **Modyfikacja** — usunięcie 4 modeli (linie 422-497)    |
| `tests/apiValidation.test.ts`          | **Modyfikacja** — aktualizacja mocków                   |
| `package.json`                         | **Modyfikacja** — usunięcie starych skryptów seed       |
| `prisma/seed.ts`                       | **Usunięcie**                                           |
| `scripts/migrate-to-tables.ts`         | **Usunięcie**                                           |
| `data/seed_rury_raw.json`              | **Usunięcie**                                           |
| `data/seed_studnie_raw.json`           | **Usunięcie**                                           |
| `docs/plans/unified-pricing-system.md` | **Ten plik** — dokumentacja planu                       |
