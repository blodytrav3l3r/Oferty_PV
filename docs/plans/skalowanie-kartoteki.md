# Plan: Skalowanie kartoteki ofert (10k+ ofert/zamówień)

## Cel

Przystosowanie strony `/kartoteka` do płynnej pracy przy 10 000+ ofert i zamówień poprzez:
- przeniesienie całego filtrowania na backend (jeden endpoint `GET /api/offers/search`)
- paginację kursorową (bez OFFSET, zwraca `nextCursor` + `hasMore`)
- pobieranie zamówień przez LEFT JOIN (nie subquery, nie osobny SELECT *)
- EXISTS / NOT EXISTS dla orderStatus zamiast HAVING
- UNION ALL z globalnym ORDER BY + LIMIT
- AbortController dla debounce (anulowanie starych requestów)
- cache w pamięci z unieważnianiem przy zapisie
- plan normalizacji clientName/investName z JSON do kolumn

## Fazy

1. **Unified Search API** — UNION ALL, cursor pagination, EXISTS dla orderStatus
2. **Backend filtry** — date, user, orderStatus w SQL (EXISTS/NOT EXISTS)
3. **Paginacja cursorowa** — tylko cursor, brak skip/OFFSET
4. **Zamówienia przez LEFT JOIN** — brak osobnego loadOrdersMap()
5. **Debounce + AbortController** — 300ms, anulowanie poprzedniego requesta
6. **Indeksy SQLite** — EXPLAIN QUERY PLAN do weryfikacji
7. **Cache z unieważnianiem** — LRU, czyszczenie przy CUD

---

## Faza 1 — Unified Search API (UNION ALL + cursor + EXISTS)

### 1.1 Nowy endpoint backend: GET /api/offers/search

**Nowy plik:** `src/routes/offers/search.ts`

```typescript
import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { buildRoleWhereCondition } from '../../utils/roleFilter';
import { requireAuth } from '../../middleware/auth';

const router = Router();

const SEARCH_LIMIT_MAX = 100;
const SEARCH_LIMIT_DEFAULT = 50;

router.get('/', requireAuth, async (req, res) => {
    const user = req.user;
    const roleSql = buildRoleWhereCondition(user);
    const params = parseSearchParams(req.query);
    const { q, type, dateFrom, dateTo, userId, orderStatus, cursor, cursorId, limit, sort, order } = params;

    // WHERE — wspólne dla obu tabel
    const whereParts = buildWhereParts({ q, dateFrom, dateTo, userId, roleSql, cursor, cursorId, sort, order });
    const whereSql = whereParts.length > 0
        ? Prisma.sql`WHERE ${Prisma.join(whereParts, ' AND ')}`
        : Prisma.empty;

    const sortCol = sort;
    const sortDir = order === 'asc' ? 'ASC' : 'DESC';

    // LEFT JOIN dla _orderCount (zawsze obecny, jedna grouped agregacja per tabela)
    // orderStatus wykorzystuje osobne EXISTS/NOT EXISTS — NIE łączymy LEFT JOIN z INNER JOIN

    // Obsługa orderStatus przez EXISTS / NOT EXISTS w WHERE (bezpieczniejsze niż NOT IN przy NULL)
    let orderStatusWhere = Prisma.empty;

    if (orderStatus === 'with_order') {
        orderStatusWhere = Prisma.sql`AND EXISTS (
            SELECT 1 FROM orders_rury_rel WHERE "offerId" = combined.id
            UNION
            SELECT 1 FROM orders_studnie_rel WHERE "offerStudnieId" = combined.id
        )`;
    } else if (orderStatus === 'without_order') {
        orderStatusWhere = Prisma.sql`AND NOT EXISTS (
            SELECT 1 FROM orders_rury_rel WHERE "offerId" = combined.id
            UNION
            SELECT 1 FROM orders_studnie_rel WHERE "offerStudnieId" = combined.id
        )`;
    }

    const limitVal = Math.min(limit, SEARCH_LIMIT_MAX);

    const sql = Prisma.sql`
        SELECT * FROM (
            SELECT
                id, "userId", "clientId", state, "createdAt", "updatedAt",
                "offer_number", data, history,
                'rury' AS "_type",
                "transportCost",
                COALESCE(o_rury.order_count, 0) AS "_orderCount"
            FROM offers_rel
            LEFT JOIN (
                SELECT "offerId", COUNT(*) as order_count
                FROM orders_rury_rel
                GROUP BY "offerId"
            ) o_rury ON o_rury."offerId" = offers_rel.id
            ${whereSql}

            UNION ALL

            SELECT
                id, "userId", "clientId", state, "createdAt", "updatedAt",
                "offer_number", data, history,
                'studnie' AS "_type",
                "transportCost",
                COALESCE(o_stud.order_count, 0) AS "_orderCount"
            FROM offers_studnie_rel
            LEFT JOIN (
                SELECT "offerStudnieId", COUNT(*) as order_count
                FROM orders_studnie_rel
                GROUP BY "offerStudnieId"
            ) o_stud ON o_stud."offerStudnieId" = offers_studnie_rel.id
            ${whereSql}
        ) AS combined
        ${orderStatusWhere}
        ${orderStatusJoin}
        ORDER BY ${Prisma.raw(sortCol)} ${Prisma.raw(sortDir)}, id ${Prisma.raw(sortDir)}
        LIMIT ${limitVal + 1}
    `;

    const rows = await prisma.$queryRaw(sql);

    // hasMore: pobraliśmy limit+1 wierszy
    const hasMore = rows.length > limitVal;
    const dataRows = hasMore ? rows.slice(0, limitVal) : rows;

    // nextCursor = ostatni element
    let nextCursor = null;
    let nextCursorId = null;
    if (hasMore && dataRows.length > 0) {
        const last = dataRows[dataRows.length - 1];
        nextCursor = last.createdAt;
        nextCursorId = last.id;
    }

    // COUNT tylko dla pierwszej strony (gdy brak kursora)
    let totalCount = null;
    if (!cursor) {
        const countSql = Prisma.sql`
            SELECT COUNT(*) as cnt FROM (
                SELECT id FROM offers_rel ${whereSql}
                UNION ALL
                SELECT id FROM offers_studnie_rel ${whereSql}
            )
        `;
        const countResult = await prisma.$queryRaw(countSql);
        totalCount = Number(countResult[0]?.cnt || 0);
    }

    const data = (dataRows || []).map(row => mapOfferRow(row));

    res.json({
        data,
        totalCount,
        hasMore,
        nextCursor,
        nextCursorId,
    });
});
```

### 1.2 Funkcje pomocnicze

**Nowy plik:** `src/utils/searchUtils.ts`

```typescript
function parseSearchParams(query) {
    return {
        q: typeof query.q === 'string' ? query.q.trim() : '',
        type: ['all', 'offer', 'studnia_oferta'].includes(query.type) ? query.type : 'all',
        dateFrom: typeof query.dateFrom === 'string' ? query.dateFrom : '',
        dateTo: typeof query.dateTo === 'string' ? query.dateTo : '',
        userId: typeof query.userId === 'string' ? query.userId : '',
        orderStatus: ['all', 'with_order', 'without_order'].includes(query.orderStatus)
            ? query.orderStatus : 'all',
        cursor: typeof query.cursor === 'string' ? query.cursor : '',
        cursorId: typeof query.cursorId === 'string' ? query.cursorId : '',
        limit: Math.min(100, Math.max(1, parseInt(query.limit) || 50)),
        sort: ['createdAt', 'offer_number'].includes(query.sort) ? query.sort : 'createdAt',
        order: query.order === 'asc' ? 'asc' : 'desc',
    };
}

function buildWhereParts({ q, dateFrom, dateTo, userId, roleSql, cursor, cursorId, sort, order }) {
    const parts = [];

    // Role-based filter
    if (roleSql) parts.push(roleSql);

    // Cursor-based pagination: WHERE (createdAt < cursor) OR (createdAt = cursor AND id < cursorId)
    if (cursor && cursorId) {
        const op = order === 'desc' ? '<' : '>';
        parts.push(Prisma.sql`(
            "createdAt" ${Prisma.raw(op)} ${cursor}
            OR ("createdAt" = ${cursor} AND id ${Prisma.raw(op)} ${cursorId})
        )`);
    }

    // Wyszukiwanie tekstowe — po offer_number i (docelowo) po clientName/investName
    if (q) {
        const escaped = q.replace(/'/g, "''");
        const searchParts = [
            Prisma.sql`"offer_number" LIKE ${'%' + escaped + '%'}`,
            Prisma.sql`"data" LIKE ${'%' + escaped + '%'}`,
        ];
        parts.push(Prisma.sql`(${Prisma.join(searchParts, ' OR ')})`);
    }

    // Filtrowanie po dacie
    if (dateFrom) {
        parts.push(Prisma.sql`"createdAt" >= ${dateFrom}`);
    }
    if (dateTo) {
        parts.push(Prisma.sql`"createdAt" <= ${dateTo + 'T23:59:59.999Z'}`);
    }

    // Filtrowanie po użytkowniku
    if (userId) {
        parts.push(Prisma.sql`"userId" = ${userId}`);
    }

    return parts;
}

// Mapowanie wiersza SQL na obiekt oferty (parsowanie JSON data/history)
function mapOfferRow(row) {
    const offer = { ...row };
    if (typeof offer.data === 'string') {
        try { offer.data = JSON.parse(offer.data); } catch { offer.data = {}; }
    }
    if (typeof offer.history === 'string') {
        try { offer.history = JSON.parse(offer.history); } catch { offer.history = []; }
    }
    // Rozwijanie pól z data na główny poziom (clientName, investName, itp.)
    if (offer.data && typeof offer.data === 'object') {
        offer.clientName = offer.data.clientName || '';
        offer.investName = offer.data.investName || '';
        offer.clientNip = offer.data.clientNip || '';
    }
    // type z _type
    offer.type = row._type === 'studnie' ? 'studnia_oferta' : 'offer';
    delete offer._type;

    return offer;
}
```

### 1.3 Rejestracja w app.ts

**Plik:** `src/app.ts`

```typescript
import searchRoutes from './routes/offers/search';
app.use('/api/offers/search', apiLimiter, searchRoutes);
```

> Endpoint przed `/:id`, aby `/search` nie zostało przechwycone jako ID.

### 1.4 Endpoint dla szczegółów zamówienia

**Plik:** `src/routes/offers/search.ts`

```typescript
router.get('/orders', requireAuth, async (req, res) => {
    const { id, type: offerType } = req.query;
    if (!id) return res.status(400).json({ error: 'Brak id oferty' });

    // Type przekazywany jawnie, nie zgadujemy po prefiksie ID
    // Walidacja: dopuszczamy tylko 'rury' lub 'studnie'
    if (offerType !== 'rury' && offerType !== 'studnie') {
        return res.status(400).json({ error: 'type musi byc rury lub studnie' });
    }
    const table = offerType === 'studnie' ? 'orders_studnie_rel' : 'orders_rury_rel';
    const idCol = offerType === 'studnie' ? 'offerStudnieId' : 'offerId';

    const rows = await prisma.$queryRaw(Prisma.sql`
        SELECT * FROM ${Prisma.raw(table)}
        WHERE ${Prisma.raw(idCol)} = ${id}
        ORDER BY "createdAt" DESC
        LIMIT 50
    `);

    res.json({ data: rows || [] });
});
```

### 1.5 Frontend: searchOffers()

**Plik:** `public/js/sales/pvSalesUi.js`

```javascript
class PVSalesUI {
    constructor() {
        this.allLocalOffers = [];
        this.ordersMap = new Map();
        this.currentFilter = 'all';
        this.currentTypeFilter = 'all';
        this.filters = { user: '', myOffers: false, date: { mode: 'none', preset: '', from: '', to: '' } };

        // Nowy stan paginacji
        this.searchResults = null;    // null | { items, totalCount, hasMore, nextCursor, nextCursorId }
        this.isLoading = false;

        // AbortController dla debounce
        this.abortController = null;
        this.searchDebounceTimer = null;

        this.autoRefreshInterval = null;
        this.init();
    }

    // ...

    buildSearchParams() {
        const input = document.getElementById('pv-local-search-input');
        const q = input ? input.value.trim() : '';

        let dateFrom = '';
        let dateTo = '';
        if (this.filters.date.mode === 'preset') {
            const resolved = resolveDatePreset(this.filters.date.preset);
            dateFrom = resolved.from;
            dateTo = resolved.to;
        } else if (this.filters.date.mode === 'range') {
            dateFrom = this.filters.date.from;
            dateTo = this.filters.date.to;
        }

        return {
            q,
            type: this.currentTypeFilter,
            dateFrom,
            dateTo,
            userId: this.filters.myOffers
                ? (sessionStorage.user ? JSON.parse(sessionStorage.user).id : '')
                : this.filters.user,
            orderStatus: this.currentFilter,
            limit: 50,
            sort: 'createdAt',
            order: 'desc',
        };
    }

    async searchOffers(params = {}) {
        // AbortController: anuluj poprzednie zapytanie
        if (this.abortController) {
            this.abortController.abort();
        }
        this.abortController = new AbortController();

        this.isLoading = true;
        this.showLoadingSpinner();

        const headers = authHeaders?.() || { 'Content-Type': 'application/json' };

        // nextCursor tylko jeśli ładujemy więcej (nie nowe wyszukiwanie)
        const isLoadMore = !!params.cursor;
        const qs = new URLSearchParams({
            q: params.q || '',
            type: params.type || 'all',
            dateFrom: params.dateFrom || '',
            dateTo: params.dateTo || '',
            userId: params.userId || '',
            orderStatus: params.orderStatus || 'all',
            limit: String(params.limit || 50),
            sort: params.sort || 'createdAt',
            order: params.order || 'desc',
            cursor: params.cursor || '',
            cursorId: params.cursorId || '',
            t: String(Date.now()),
        }).toString();

        try {
            const resp = await fetch('/api/offers/search?' + qs, {
                headers,
                signal: this.abortController.signal,
            });

            if (!resp.ok) throw new Error('HTTP ' + resp.status);
            const json = await resp.json();

            if (isLoadMore) {
                // Append do istniejących wyników
                this.searchResults.items = [...this.searchResults.items, ...(json.data || [])];
                this.searchResults.hasMore = json.hasMore;
                this.searchResults.nextCursor = json.nextCursor;
                this.searchResults.nextCursorId = json.nextCursorId;
            } else {
                // Nowe wyszukiwanie — zastąp wyniki
                this.searchResults = {
                    items: json.data || [],
                    totalCount: json.totalCount || 0,
                    hasMore: json.hasMore,
                    nextCursor: json.nextCursor,
                    nextCursorId: json.nextCursorId,
                };
            }

            this.renderResults();
            this.updateOfferCounter(this.searchResults.items.length, this.searchResults.totalCount);
        } catch (error) {
            if (error.name === 'AbortError') return; // oczekiwane — poprzedni request anulowany
            logger.error('pvSalesUi', 'Błąd wyszukiwania:', error);
            this.showError(error.message);
        } finally {
            this.isLoading = false;
        }
    }

    async loadMore() {
        if (this.isLoading || !this.searchResults?.hasMore) return;

        const params = this.buildSearchParams();
        params.cursor = this.searchResults.nextCursor;
        params.cursorId = this.searchResults.nextCursorId;
        params.limit = 50;

        await this.searchOffers(params);
    }

    renderResults() {
        const listDiv = document.getElementById('pv-local-offers-list');
        if (!listDiv) return;

        const items = this.searchResults?.items || [];

        if (items.length === 0) {
            listDiv.innerHTML = '<div class="empty-state">Brak ofert pasujacych do filtrow.</div>';
            return;
        }

        listDiv.innerHTML = this.renderOffersList(items, true);
        this.attachActionListeners(listDiv);
        lucide.createIcons({ root: listDiv });

        if (this.searchResults?.hasMore) {
            listDiv.insertAdjacentHTML('beforeend', this.renderLoadMore());
            document.getElementById('pv-load-more-btn')?.addEventListener('click',
                () => this.loadMore());
        }
    }

    renderLoadMore() {
        const shown = this.searchResults?.items?.length || 0;
        const total = this.searchResults?.totalCount;
        const label = total != null
            ? 'Pokaz wiecej (' + shown + ' z ' + total + ')'
            : 'Pokaz wiecej';
        return '<div class="load-more-container" style="text-align:center; padding:1rem;">' +
            '<button class="btn btn-sm btn-secondary" id="pv-load-more-btn">' +
            label +
            '</button></div>';
    }
}
```

---

## Faza 2 — Backend filtry (w SQL)

### 2.1 Filtry przeniesione do SQL

Wszystkie filtry są już w `buildWhereParts` z Fazy 1:
- `q` → LIKE na offer_number + data (docelowo osobne kolumny)
- `dateFrom`/`dateTo` → porównanie createdAt
- `userId` → równość userId
- `orderStatus` → EXISTS / NOT EXISTS w outer WHERE

### 2.2 Frontend: każdy filtr wywołuje searchOffers()

```javascript
// W initAdvancedFilterEvents():
document.getElementById('pv-user-filter')?.addEventListener('change', function () {
    ui.filters.user = this.value;
    ui.searchOffers(ui.buildSearchParams());
});

document.querySelectorAll('.pv-date-preset-btn').forEach(btn => {
    btn.addEventListener('click', function () {
        const range = this.dataset.dateRange;
        ui.filters.date.mode = 'preset';
        ui.filters.date.preset = range;
        const { from, to } = resolveDatePreset(range);
        const params = ui.buildSearchParams();
        params.dateFrom = from;
        params.dateTo = to;
        ui.searchOffers(params);
    });
});

document.getElementById('pv-clear-filters-btn')?.addEventListener('click', function () {
    ui.clearFilters();
    ui.searchOffers(ui.buildSearchParams());
});
```

---

## Faza 3 — Paginacja cursorowa (tylko cursor, brak OFFSET)

### 3.1 Czym różni się od OFFSET

```sql
-- OFFSET: SQLite czyta 9050 wierszy, odrzuca 9000
SELECT * FROM offers ORDER BY createdAt DESC LIMIT 50 OFFSET 9000

-- Cursor: SQLite czyta 50 wierszy (lub mniej)
SELECT * FROM offers
WHERE createdAt < '2024-01-15T10:00:00.000Z'
   OR (createdAt = '2024-01-15T10:00:00.000Z' AND id < 'abc-123')
ORDER BY createdAt DESC, id DESC
LIMIT 51  -- +1 dla hasMore
```

### 3.2 Backend

W `buildWhereParts` dodajemy warunek kursora (już zaimplementowany w Fazie 1).

**Ważne:** `ORDER BY` musi zawierać kolumnę sortowania + `id` jako tiebreaker, aby cursor był deterministyczny.

### 3.3 Backend: limit+1 dla hasMore

Zamiast osobnego COUNT na każdej stronie:
1. Pobieramy `limit + 1` wierszy
2. Jeśli jest `limit + 1` wierszy → `hasMore = true`, zwracamy pierwsze `limit` wierszy
3. Jeśli jest `<= limit` wierszy → `hasMore = false`

COUNT wykonujemy tylko przy braku kursora (pierwsza strona).

### 3.4 Frontend

```javascript
// W loadMore() — już zaimplementowane w Fazie 1
// Przekazujemy cursor i cursorId z ostatniego response'u
```

---

## Faza 4 — Zamówienia przez LEFT JOIN

### 4.1 Koniec z loadOrdersMap()

Obecnie:
```javascript
await this.loadOrdersMap();  // SELECT * z orders_rury_rel + orders_studnie_rel → 10k wierszy
```

Nowy flow:
```sql
-- LEFT JOIN z grouped orders_count w UNION ALL dla każdej oferty
SELECT o.*, COALESCE(ord.order_count, 0) as _orderCount
FROM offers_rel o
LEFT JOIN (SELECT "offerId", COUNT(*) as order_count FROM orders_rury_rel GROUP BY "offerId") ord
    ON ord."offerId" = o.id
```

### 4.2 Frontend: szczegóły zamówienia na żądanie

Kliknięcie w ofertę → `GET /api/offers/search/orders?id=...&type=rury|studnie`

Typ oferty (`rury`/`studnie`) jest dostępny w `searchResults.items[].type` (mapowany z `_type`).

### 4.3 Usunięcie loadOrdersMap()

**Plik:** `public/js/sales/pvSalesUi.js`

- Usuwamy wywołanie `this.loadOrdersMap()` z `init()` i `loadLocalOffers()`
- Usuwamy `loadOrdersMap()` — stary kod nie jest potrzebny
- `getOrderForOffer()` → używa `this.searchResults` zamiast `this.ordersMap`

---

## Faza 5 — Debounce + AbortController

### 5.1 Problem

Szybkie pisanie "abcd" → 4 requesty, 3 zbędne, race condition (wynik dla "a" nadpisuje wynik dla "abcd").

### 5.2 Rozwiązanie

```javascript
// W konstruktorze lub attachSearchListener:
this.searchDebounceTimer = null;
this.abortController = null;

const searchInput = document.getElementById('pv-local-search-input');
if (searchInput) {
    searchInput.addEventListener('input', () => {
        clearTimeout(this.searchDebounceTimer);
        this.searchDebounceTimer = setTimeout(() => {
            this.searchOffers(this.buildSearchParams());
        }, 300);
    });
}

// W searchOffers() — anulowanie poprzedniego:
async searchOffers(params) {
    if (this.abortController) {
        this.abortController.abort();  // anuluje poprzedni fetch
    }
    this.abortController = new AbortController();

    try {
        const resp = await fetch(url, {
            signal: this.abortController.signal,
            // ...
        });
    } catch (error) {
        if (error.name === 'AbortError') return;  // cicho, to oczekiwane
        // ...
    }
}
```

---

## Faza 6 — Indeksy SQLite + EXPLAIN QUERY PLAN

### 6.1 Indeksy w schema.prisma

```prisma
// Już istnieją:
@@index([userId])       // idx_offers_user
@@index([createdAt])    // idx_offers_created
@@index([state])        // idx_offers_state

// Dodać dla wyszukiwania:
@@index([offer_number]) // idx_offers_number

// Dla LEFT JOIN z orders:
// orders_rury_rel już ma @@index([offerId])
// orders_studnie_rel już ma @@index([offerStudnieId])
```

### 6.2 Weryfikacja EXPLAIN QUERY PLAN

Po dodaniu indeksów uruchomić na testowej bazie z 10k wierszy:

```sql
EXPLAIN QUERY PLAN
SELECT * FROM (
    SELECT id, "createdAt", "offer_number", 'rury' as "_type"
    FROM offers_rel
    WHERE "createdAt" >= '2024-01-01' AND "createdAt" <= '2024-12-31'
    UNION ALL
    SELECT id, "createdAt", "offer_number", 'studnie' as "_type"
    FROM offers_studnie_rel
    WHERE "createdAt" >= '2024-01-01' AND "createdAt" <= '2024-12-31'
) ORDER BY "createdAt" DESC LIMIT 51;
```

Oczekiwany wynik: `SEARCH TABLE offers_rel USING INDEX idx_offers_created (...)`

Jeśli widzimy `SCAN TABLE` → brakuje indeksu lub warunek WHERE nie wykorzystuje indeksu.

### 6.3 Normalizacja clientName/investName (plan migracji)

Docelowo przenieść pola z JSON do kolumn:

```prisma
model offers_rel {
    // ... istniejące kolumny
    clientName  String?
    investName  String?
    clientNip   String?

    @@index([clientName])
    @@index([investName])
}
```

Migracja danych:
```sql
UPDATE offers_rel SET
    clientName = json_extract(data, '$.clientName'),
    investName = json_extract(data, '$.investName');
```

> **Uwaga:** Indeks B-tree nie pomaga przy `LIKE '%tekst%'` (substring) — pomaga dopiero przy `LIKE 'tekst%'` (prefix). Zysk z normalizacji to nie indeks na LIKE, tylko uniknięcie skanowania zserializowanego JSON blob (który może zawierać dużo innych pól). Prawdziwe full-text search wymaga FTS5. Normalizacja to krok pośredni: upraszcza zapytania i przygotowuje grunt pod FTS.

**Kiedy robić:** Gdy `data LIKE '%q%'` staje się wąskim gardłem (mierzone w produkcji lub na danych testowych 50k+). Na start — YAGNI.

---

## Faza 7 — Cache z unieważnianiem

### 7.1 Implementacja backendu

**Plik:** `src/utils/searchCache.ts`

```typescript
class SearchCache {
    constructor(maxSize = 100, ttl = 30000) {
        this.cache = new Map();  // key → { data, timestamp }
        this.maxSize = maxSize;
        this.ttl = ttl;
    }

    _makeKey(userId, params) {
        return userId + '|' + JSON.stringify(params);
    }

    get(userId, params) {
        const key = this._makeKey(userId, params);
        const entry = this.cache.get(key);
        if (!entry) return null;
        if (Date.now() - entry.timestamp > this.ttl) {
            this.cache.delete(key);
            return null;
        }
        // LRU: przenieś na koniec (usuń i dodaj)
        this.cache.delete(key);
        this.cache.set(key, entry);
        return entry.data;
    }

    set(userId, params, data) {
        const key = this._makeKey(userId, params);
        // LRU evict
        if (this.cache.size >= this.maxSize) {
            const oldest = this.cache.keys().next().value;
            this.cache.delete(oldest);
        }
        this.cache.set(key, { data, timestamp: Date.now() });
    }

    // Unieważnianie — cały cache dla danego użytkownika
    invalidateUser(userId) {
        for (const key of this.cache.keys()) {
            if (key.startsWith(userId + '|')) {
                this.cache.delete(key);
            }
        }
    }

    // Unieważnianie — cały cache (po CUD)
    invalidateAll() {
        this.cache.clear();
    }
}

export const searchCache = new SearchCache(100, 30000);
```

### 7.2 Użycie w endpointach

```typescript
// GET /api/offers/search
import { searchCache } from '../../utils/searchCache';

router.get('/', requireAuth, async (req, res) => {
    const params = parseSearchParams(req.query);
    const user = req.user;

    // Sprawdź cache
    const cached = searchCache.get(user.id, params);
    if (cached) return res.json(cached);

    // ... wykonaj zapytanie ...

    const result = { data, totalCount, hasMore, nextCursor, nextCursorId };
    searchCache.set(user.id, params, result);
    res.json(result);
});
```

### 7.3 Unieważnianie cache przy zapisie

> **Uwaga:** `invalidateAll()` to bezpieczny kompromis na start. Przy wielu użytkownikach wyrzuca też cache niezwiązany ze zmianą. W przyszłości można dodać `invalidateUser()` lub precyzyjniejsze unieważnianie po konkretnym kluczu — na razie YAGNI.

W `src/routes/offers/ruryCrud.ts` (POST, PUT, DELETE):

```typescript
import { searchCache } from '../../utils/searchCache';

// Po udanym zapisie/usunięciu oferty:
searchCache.invalidateAll();
// lub dla konkretnego użytkownika:
searchCache.invalidateUser(req.user.id);
```

W `src/routes/offers/studnieCrud.ts` — analogicznie.

W `src/routes/orders/ruryOrders.ts` i `studnieOrders.ts` — analogicznie.

---

## Podsumowanie plików do modyfikacji

| Plik | Faza | Zmiana |
|------|------|--------|
| `src/routes/offers/search.ts` | 1,3,4,7 | **NOWY** — Unified Search API + cursor + LEFT JOIN + cache |
| `src/utils/searchUtils.ts` | 1,2 | **NOWY** — parseSearchParams, buildWhereParts, mapOfferRow |
| `src/utils/searchCache.ts` | 7 | **NOWY** — LRU cache z invalidateUser/invalidateAll |
| `src/app.ts` | 1 | Rejestracja `/api/offers/search` |
| `src/routes/offers/ruryCrud.ts` | 7 | Unieważnianie cache po CREATE/UPDATE/DELETE |
| `src/routes/offers/studnieCrud.ts` | 7 | j.w. |
| `src/routes/orders/ruryOrders.ts` | 7 | j.w. |
| `src/routes/orders/studnieOrders.ts` | 7 | j.w. |
| `public/js/sales/pvSalesUi.js` | 1,3,4,5,7 | searchOffers, loadMore, buildSearchParams, AbortController, debounce, usunięcie loadOrdersMap |
| `public/js/sales/kartotekaInit.js` | 2 | Filtry wywołują searchOffers zamiast client-side filter |
| `public/kartoteka.html` | 1 | Spinner, licznik, container na load more |
| `prisma/schema.prisma` | 6 | Indeks na `offer_number` |

## Największe ryzyka

| Ryzyko | Jak unikamy |
|--------|------------|
| Paginacja dwóch tabel osobno → niepoprawne sortowanie | UNION ALL z globalnym ORDER BY + LIMIT |
| LIMIT 500 na orders → brakujące zamówienia | LEFT JOIN z grouped COUNT — bez limitu, bez osobnego fetcha |
| OFFSET 9000 → wolne | Cursor: `WHERE createdAt < last`, O(limit) |
| orderStatus w JS → złe liczniki | EXISTS / NOT EXISTS w SQL |
| data LIKE → wolne przy 50k+ | Plan normalizacji clientName/investName do kolumn + indeks |
| Zbyt wiele requestów przy pisaniu | Debounce 300ms + AbortController |
| Race condition na wynikach | AbortController anuluje stary request |
| Cache zwraca nieaktualne dane | invalidateAll() przy każdym CREATE/UPDATE/DELETE |
| Brak indeksów | EXPLAIN QUERY PLAN po dodaniu indeksów, weryfikacja czy są używane |

## Szacowany czas

| Faza | Czas | Zależności |
|------|------|-----------|
| 1. Unified Search API (UNION ALL + cursor + EXISTS) | 5-7h | — |
| 2. Backend filtry | 1-2h | Faza 1 |
| 3. Paginacja cursorowa (tylko cursor) | 1h | Faza 1 |
| 4. Zamówienia przez LEFT JOIN | 1-2h | Faza 1 |
| 5. Debounce + AbortController | 0.5h | — |
| 6. Indeksy + EXPLAIN | 1h | — |
| 7. Cache z unieważnianiem | 1-2h | Faza 1 |
| **Razem** | **10.5-15.5h** | |
