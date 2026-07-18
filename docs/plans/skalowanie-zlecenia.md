# Plan: Skalowanie kartoteki zleceń produkcyjnych (10k+)

## Cel

Przystosowanie strony `/zlecenia` do płynnej pracy przy 10 000+ zleceń produkcyjnych poprzez:

- przeniesienie filtrowania i wyszukiwania na backend (endpoint `GET /api/orders-studnie/production/search`)
- paginację kursorową (bez OFFSET, zwraca `nextCursor` + `hasMore`)
- LEFT JOIN z `users` i `orders_studnie_rel` w jednym zapytaniu (zamiast mapowania w JS)
- sortowanie w SQL (createdAt DESC)
- AbortController dla debounce (anulowanie starych requestów)
- cache w pamięci z unieważnianiem przy zapisie
- normalizacja pól wyszukiwania z `data` JSON do kolumn

## Stan obecny — problemy

| Komponent | Obecne zachowanie | Problem dla 10k+ |
|-----------|------------------|------------------|
| `GET /api/orders-studnie/production/registry` | Zwraca WSZYSTKIE wiersze, brak LIMIT | Payload kilkanaście MB, wolny network |
| Wyszukiwanie | Client-side: `ordersCache.filter()` na 10 polach | Iteracja po 10k obiektów przy każdym znaku |
| `ordersCache` (frontend) | Wszystkie rekordy w pamięci | ~10k obiektów JS w RAM |
| `renderTable()` | Buduje HTML dla wszystkich wierszy naraz | DOM z 10k+ `<tr>`, wolny rendering |
| Auto-odświeżanie | `loadOrders()` co 60s — pełny reload | Stały transfer pełnego payloadu |
| Indeksy DB | Brak na `production_orders_rel` (tylko PK) | Full table scan przy każdym zapytaniu |
| Pole `data` JSON | Wszystkie pola wyszukiwania w JSON blob | Nie da się filtrować DB-side bez skanowania |

## Fazy

1. **Unified Search API** — jeden endpoint, cursor pagination, LEFT JOIN, status + search w SQL
2. **Backend filtry** — status (draft/accepted), dateFrom/dateTo, userId, wyszukiwanie tekstowe
3. **Paginacja cursorowa** — tylko cursor, brak skip/OFFSET
4. **LEFT JOIN w SQL** — users (handler, creator), orders_studnie_rel (salesOrderNumber)
5. **Debounce + AbortController** — 300ms, anulowanie poprzedniego requesta
6. **Indeksy SQLite** — EXPLAIN QUERY PLAN do weryfikacji
7. **Cache z unieważnianiem** — LRU, czyszczenie przy CUD

---

## Faza 1 — Unified Search API (cursor + LEFT JOIN + status w SQL)

### 1.1 Nowy endpoint backend: GET /api/orders-studnie/production/search

**Nowy plik:** `src/routes/orders/productionSearch.ts`

```typescript
import { Router } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../../prismaClient';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import { buildRoleWhereCondition } from '../../utils/roleFilter';
import { parseSearchParams, mapProductionOrderRow } from '../../utils/productionSearchUtils';
import { searchCache } from '../../utils/searchCache';

const router = Router();

const SEARCH_LIMIT_MAX = 100;
const SEARCH_LIMIT_DEFAULT = 50;

router.get('/', requireAuth, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const user = authReq.user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const params = parseSearchParams(req.query);
    const { q, status, dateFrom, dateTo, userId, cursor, cursorId, limit, sort, order } = params;

    // Sprawdź cache
    const cacheKey = { ...params, userId: user.id };
    const cached = searchCache.get('production', cacheKey);
    if (cached) return res.json(cached);

    const roleSql = buildRoleWhereCondition(user);
    const sortCol = sort;
    const sortDir = order === 'asc' ? 'ASC' : 'DESC';
    const limitVal = Math.min(limit, SEARCH_LIMIT_MAX);

    // WHERE — wspólny dla tabeli głównej
    const whereParts: Prisma.Sql[] = [];

    // role-based filter
    if (roleSql !== Prisma.empty) {
        whereParts.push(roleSql);
    }

    // Cursor pagination
    if (cursor && cursorId) {
        const op = order === 'desc' ? '<' : '>';
        whereParts.push(
            Prisma.sql`(production_orders_rel."createdAt" ${Prisma.raw(op)} ${cursor}
                OR (production_orders_rel."createdAt" = ${cursor}
                    AND production_orders_rel.id ${Prisma.raw(op)} ${cursorId}))`
        );
    }

    // Status filter
    if (status === 'draft') {
        // NOT accepted — uwaga na NULL
        whereParts.push(Prisma.sql`(
            production_orders_rel.data IS NULL
            OR json_extract(production_orders_rel.data, '$.status') IS NOT 'accepted'
            OR json_extract(production_orders_rel.data, '$.status') IS NULL
        )`);
    } else if (status === 'accepted') {
        whereParts.push(
            Prisma.sql`json_extract(production_orders_rel.data, '$.status') = 'accepted'`
        );
    }

    // Date filter
    if (dateFrom) {
        whereParts.push(Prisma.sql`production_orders_rel."createdAt" >= ${dateFrom}`);
    }
    if (dateTo) {
        whereParts.push(Prisma.sql`production_orders_rel."createdAt" <= ${dateTo + 'T23:59:59.999Z'}`);
    }

    // User filter (handler / creator)
    if (userId) {
        whereParts.push(
            Prisma.sql`(production_orders_rel."userId" = ${userId}
                OR production_orders_rel."creatorId" = ${userId})`
        );
    }

    const whereSql =
        whereParts.length > 0
            ? Prisma.sql`WHERE ${Prisma.join(whereParts, ' AND ')}`
            : Prisma.empty;

    // Tekstowe wyszukiwanie — osobny WHERE dla LIKE na data JSON + kolumny
    // Ponieważ wszystko siedzi w JSON blob, używamy json_extract + LIKE
    // Docelowo po normalizacji będzie LIKE na kolumnach
    let searchWhere = Prisma.empty;
    if (q) {
        const escaped = q.replace(/'/g, "''");
        // Szukamy w polach zdata JSON oraz w zjoinowanych tabelach
        const searchParts: Prisma.Sql[] = [
            Prisma.sql`json_extract(production_orders_rel.data, '$.productionOrderNumber') LIKE ${'%' + escaped + '%'}`,
            Prisma.sql`json_extract(production_orders_rel.data, '$.wellName') LIKE ${'%' + escaped + '%'}`,
            Prisma.sql`json_extract(production_orders_rel.data, '$.projectName') LIKE ${'%' + escaped + '%'}`,
            Prisma.sql`json_extract(production_orders_rel.data, '$.obiekt') LIKE ${'%' + escaped + '%'}`,
            Prisma.sql`json_extract(production_orders_rel.data, '$.elementName') LIKE ${'%' + escaped + '%'}`,
            Prisma.sql`json_extract(production_orders_rel.data, '$.productName') LIKE ${'%' + escaped + '%'}`,
            Prisma.sql`json_extract(production_orders_rel.data, '$.snr') LIKE ${'%' + escaped + '%'}`,
            // Użytkownicy z LEFT JOIN
            Prisma.sql`u1."firstName" LIKE ${'%' + escaped + '%'}`,
            Prisma.sql`u1."lastName" LIKE ${'%' + escaped + '%'}`,
            Prisma.sql`u2."firstName" LIKE ${'%' + escaped + '%'}`,
            Prisma.sql`u2."lastName" LIKE ${'%' + escaped + '%'}`,
        ];
        searchWhere = Prisma.sql`AND (${Prisma.join(searchParts, ' OR ')})`;
    }

    const sql = Prisma.sql`
        SELECT production_orders_rel.id,
               production_orders_rel."userId",
               production_orders_rel."orderId",
               production_orders_rel."wellId",
               production_orders_rel."elementIndex",
               production_orders_rel.data,
               CASE WHEN production_orders_rel."createdAt" GLOB '[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'
                   THEN datetime(CAST(production_orders_rel."createdAt" AS INTEGER)/1000, 'unixepoch')
                   ELSE production_orders_rel."createdAt" END as "createdAt",
               CASE WHEN production_orders_rel."updatedAt" GLOB '[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'
                   THEN datetime(CAST(production_orders_rel."updatedAt" AS INTEGER)/1000, 'unixepoch')
                   ELSE production_orders_rel."updatedAt" END as "updatedAt",
               u1."firstName" as "handlerFirstName",
               u1."lastName" as "handlerLastName",
               u1.username as "handlerUsername",
               u2."firstName" as "creatorFirstName",
               u2."lastName" as "creatorLastName",
               u2.username as "creatorUsername",
               o.data as "orderData",
               o.id as "dbSalesOrderId"
        FROM production_orders_rel
        LEFT JOIN users u1 ON production_orders_rel."userId" = u1.id
        LEFT JOIN users u2 ON production_orders_rel."creatorId" = u2.id
        LEFT JOIN orders_studnie_rel o ON o.id = production_orders_rel."orderId"
        ${whereSql}
        ${searchWhere}
        ORDER BY production_orders_rel."createdAt" ${Prisma.raw(sortDir)},
                 production_orders_rel.id ${Prisma.raw(sortDir)}
        LIMIT ${limitVal + 1}
    `;

    const rows: Array<Record<string, unknown>> = await prisma.$queryRaw(sql);

    const hasMore = rows.length > limitVal;
    const dataRows = hasMore ? rows.slice(0, limitVal) : rows;

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
            SELECT COUNT(*) as cnt
            FROM production_orders_rel
            LEFT JOIN users u1 ON production_orders_rel."userId" = u1.id
            LEFT JOIN users u2 ON production_orders_rel."creatorId" = u2.id
            LEFT JOIN orders_studnie_rel o ON o.id = production_orders_rel."orderId"
            ${whereSql}
            ${searchWhere}
        `;
        const countResult: Array<{ cnt: number }> = await prisma.$queryRaw(countSql);
        totalCount = Number(countResult[0]?.cnt || 0);
    }

    const data = dataRows.map((row: Record<string, unknown>) => mapProductionOrderRow(row));

    const result = { data, totalCount, hasMore, nextCursor, nextCursorId };
    searchCache.set('production', cacheKey, result);
    res.json(result);
});

export default router;
```

### 1.2 Funkcje pomocnicze

**Nowy plik:** `src/utils/productionSearchUtils.ts`

```typescript
import { parseJsonField } from '../helpers';

export function parseSearchParams(query: Record<string, unknown>) {
    return {
        q: typeof query.q === 'string' ? query.q.trim() : '',
        status: ['all', 'draft', 'accepted'].includes(query.status as string)
            ? (query.status as string)
            : 'all',
        dateFrom: typeof query.dateFrom === 'string' ? query.dateFrom : '',
        dateTo: typeof query.dateTo === 'string' ? query.dateTo : '',
        userId: typeof query.userId === 'string' ? query.userId : '',
        cursor: typeof query.cursor === 'string' ? query.cursor : '',
        cursorId: typeof query.cursorId === 'string' ? query.cursorId : '',
        limit: Math.min(100, Math.max(1, parseInt(query.limit as string) || 50)),
        sort: ['createdAt', 'updatedAt'].includes(query.sort as string)
            ? (query.sort as string)
            : 'createdAt',
        order: query.order === 'asc' ? 'asc' : 'desc'
    };
}

export function mapProductionOrderRow(row: Record<string, unknown>) {
    const parsedData = parseJsonField<Record<string, unknown>>(row.data, {});

    const handlerName =
        row.handlerFirstName || row.handlerLastName
            ? `${row.handlerFirstName || ''} ${row.handlerLastName || ''}`.trim()
            : row.handlerUsername || '';

    const creatorName =
        row.creatorFirstName || row.creatorLastName
            ? `${row.creatorFirstName || ''} ${row.creatorLastName || ''}`.trim()
            : row.creatorUsername || '';

    const orderParsed = row.orderData
        ? parseJsonField<Record<string, unknown>>(row.orderData, {})
        : {};
    const dbSalesOrderNumber = (orderParsed.orderNumber || '') as string;

    return {
        id: row.id,
        type: 'production_order',
        userId: row.userId,
        orderId: row.orderId,
        wellId: row.wellId,
        elementIndex: row.elementIndex,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        handlerName: handlerName || undefined,
        creatorName: creatorName || undefined,
        ...parsedData,
        dbSalesOrderNumber: dbSalesOrderNumber || undefined,
        dbSalesOrderId: row.dbSalesOrderId || undefined
    };
}
```

### 1.3 Rejestracja w app.ts

**Plik:** `src/app.ts`

```typescript
import productionSearchRoutes from './routes/orders/productionSearch';
app.use('/api/orders-studnie/production/search', apiLimiter, productionSearchRoutes);
```

> Endpoint przed `/:id`, aby `/search` nie zostało przechwycone jako ID.

### 1.4 Frontend: AppZlecenia — nowe searchOffers() + paginacja

**Plik:** `public/js/spa/zlecenia.js`

Główne zmiany:
- `ordersCache` → zastąpione `searchResults` (obiekt z `{ items, totalCount, hasMore, nextCursor, nextCursorId }`)
- `loadOrders()` → wywołuje `searchOffers()` zamiast bezpośredniego fetcha
- Nowa metoda `searchOffers(params)` — fetch z AbortController + cache
- `loadMore()` — doładowanie kolejnej strony
- `getFilteredOrders()` → usunięte (filtrowanie po stronie serwera)
- `renderTable()` → renderuje tylko bieżącą stronę z `searchResults.items`
- `renderLoadMore()` — przycisk "Pokaż więcej"
- `setupSearch()` — debounce 300ms przed wywołaniem `searchOffers()`
- `renderStats()` — pobiera dane z `searchResults.totalCount` lub osobny endpoint

```javascript
// Nowy stan
let searchResults = null; // { items, totalCount, hasMore, nextCursor, nextCursorId }
let isLoading = false;
let abortController = null;
let searchDebounceTimer = null;

function buildSearchParams() {
    const input = document.getElementById('zlecenia-search-input');
    const q = input ? input.value.trim() : '';

    let dateFrom = '';
    let dateTo = '';
    // TODO: jeśli dodamy filtry dat w HTML
    // Date filter logic here

    return {
        q,
        status: activeFilter,
        dateFrom,
        dateTo,
        userId: '',
        limit: 50,
        sort: 'createdAt',
        order: 'desc'
    };
}

async function searchOffers(params = {}) {
    if (abortController) abortController.abort();
    abortController = new AbortController();

    isLoading = true;
    showLoadingSpinner();

    const headers = authHeaders?.() || { 'Content-Type': 'application/json' };
    const isLoadMore = !!params.cursor;

    const qs = new URLSearchParams({
        q: params.q || '',
        status: params.status || 'all',
        dateFrom: params.dateFrom || '',
        dateTo: params.dateTo || '',
        userId: params.userId || '',
        limit: String(params.limit || 50),
        sort: params.sort || 'createdAt',
        order: params.order || 'desc',
        cursor: params.cursor || '',
        cursorId: params.cursorId || '',
        t: String(Date.now())
    }).toString();

    try {
        const resp = await fetch('/api/orders-studnie/production/search?' + qs, {
            headers,
            signal: abortController.signal
        });
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        const json = await resp.json();

        if (isLoadMore) {
            searchResults.items = [...searchResults.items, ...(json.data || [])];
            searchResults.hasMore = json.hasMore;
            searchResults.nextCursor = json.nextCursor;
            searchResults.nextCursorId = json.nextCursorId;
        } else {
            searchResults = {
                items: json.data || [],
                totalCount: json.totalCount || 0,
                hasMore: json.hasMore,
                nextCursor: json.nextCursor,
                nextCursorId: json.nextCursorId
            };
        }

        renderStats();
        renderTable();
    } catch (error) {
        if (error.name === 'AbortError') return;
        logger.error('zlecenia', 'Błąd wyszukiwania:', error);
        showError(error.message);
    } finally {
        isLoading = false;
    }
}

function loadMore() {
    if (isLoading || !searchResults?.hasMore) return;
    const params = buildSearchParams();
    params.cursor = searchResults.nextCursor;
    params.cursorId = searchResults.nextCursorId;
    searchOffers(params);
}

function renderTable() {
    const tbody = document.getElementById('zlecenia-table-body');
    if (!tbody) return;

    const items = searchResults?.items || [];

    if (items.length === 0) {
        tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; padding:2.5rem; color:var(--text-muted); font-style:italic;">Brak zleceń spełniających kryteria.</td></tr>`;
        updateBatchBar();
        return;
    }

    // Render tylko bieżącą stronę
    const html = items.map(renderOrderRow).join('');

    // Dodaj wiersz "pokaż więcej" jeśli hasMore
    if (searchResults?.hasMore) {
        const shown = searchResults.items.length;
        const total = searchResults.totalCount;
        const label = total != null
            ? 'Pokaż więcej (' + shown + ' z ' + total + ')'
            : 'Pokaż więcej';
        html += '<tr><td colspan="10" style="text-align:center;padding:1rem;">' +
            '<button class="btn btn-sm btn-secondary" id="zlecenia-load-more-btn">' +
            label + '</button></td></tr>';
    }

    tbody.innerHTML = html;

    // Attach event dla load more
    document.getElementById('zlecenia-load-more-btn')
        ?.addEventListener('click', () => loadMore());

    updateBatchBar();
}
```

---

## Faza 2 — Backend filtry (w SQL)

### 2.1 Filtry przeniesione do SQL

Wszystkie filtry są już w `productionSearch.ts` z Fazy 1:

- **status** — `draft` / `accepted` przez `json_extract` na `data->>'$.status'`
- **dateFrom/dateTo** — porównanie `createdAt`
- **userId** — `userId` lub `creatorId` (oba)
- **q (search)** — LIKE na 11 polach (z JSON + z LEFT JOIN)
- **role-based** — przez `buildRoleWhereCondition`

### 2.2 Frontend: każdy filtr wywołuje searchOffers()

```javascript
function setFilter(filter) {
    activeFilter = filter;
    document.querySelectorAll('.zlecenia-filter-tab').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.filter === filter);
    });
    searchOffers(buildSearchParams());
}
```

---

## Faza 3 — Paginacja cursorowa (tylko cursor, brak OFFSET)

### 3.1 Backend: limit+1 dla hasMore

Ten sam wzorzec co w kartotece — pobieramy `limit + 1`, sprawdzamy `hasMore`.

### 3.2 Backend: WHERE cursor

```sql
WHERE ("createdAt" < '2024-01-15T10:00:00.000Z'
    OR ("createdAt" = '2024-01-15T10:00:00.000Z' AND id < 'abc-123'))
```

### 3.3 Frontend: loadMore()

Implementacja w Fazie 1 — przekazuje `cursor` i `cursorId` z ostatniego response'u.

---

## Faza 4 — LEFT JOIN w SQL (users + orders_studnie_rel)

### 4.1 Koniec z mapowaniem w JS

Obecnie handler/creator name są składane w `map()` po stronie JS. Nowa wersja robi to w SQL:

```sql
LEFT JOIN users u1 ON production_orders_rel."userId" = u1.id
LEFT JOIN users u2 ON production_orders_rel."creatorId" = u2.id
LEFT JOIN orders_studnie_rel o ON o.id = production_orders_rel."orderId"
```

### 4.2 Mapowanie w mapProductionOrderRow()

Pozostaje tylko składanie `handlerName` i `creatorName` z firstName + lastName, oraz wyciągnięcie `dbSalesOrderNumber` z orderData JSON. Żadnych dodatkowych zapytań.

---

## Faza 5 — Debounce + AbortController

### 5.1 Problem

Szybkie pisanie → wiele requestów, race condition.

### 5.2 Rozwiązanie

```javascript
function setupSearch() {
    const input = document.getElementById('zlecenia-search-input');
    if (input) {
        input.addEventListener('input', () => {
            clearTimeout(searchDebounceTimer);
            searchDebounceTimer = setTimeout(() => {
                searchOffers(buildSearchParams());
            }, 300);
        });
    }
}
```

AbortController w `searchOffers()` — anuluje poprzedni fetch przy nowym wywołaniu.

---

## Faza 6 — Indeksy SQLite + EXPLAIN QUERY PLAN

### 6.1 Indeksy w schema.prisma

```prisma
model production_orders_rel {
    id           String  @id
    userId       String?
    orderId      String?
    wellId       String?
    elementIndex Int?
    createdAt    String?
    updatedAt    String?
    data         String?
    creatorId    String? @default("")

    @@index([userId], map: "idx_prod_user")
    @@index([creatorId], map: "idx_prod_creator")
    @@index([createdAt], map: "idx_prod_created")
    @@index([orderId], map: "idx_prod_order")
}
```

### 6.2 Weryfikacja EXPLAIN QUERY PLAN

```sql
EXPLAIN QUERY PLAN
SELECT production_orders_rel.id, production_orders_rel."createdAt"
FROM production_orders_rel
LEFT JOIN users u1 ON production_orders_rel."userId" = u1.id
WHERE production_orders_rel."createdAt" >= '2024-01-01'
  AND production_orders_rel."createdAt" <= '2024-12-31'
ORDER BY production_orders_rel."createdAt" DESC
LIMIT 51;
```

Oczekiwany wynik: `SEARCH TABLE production_orders_rel USING INDEX idx_prod_created (...)`

### 6.3 Normalizacja kluczowych pól z JSON do kolumn (plan migracji)

`json_extract(data, '$.status')` i `data LIKE '%q%'` są kosztowne. Docelowo:

```prisma
model production_orders_rel {
    // ... istniejące kolumny
    status                 String?  // 'draft' | 'accepted'
    productionOrderNumber  String?
    wellName               String?
    projectName            String?
    elementName            String?
    snr                    String?

    @@index([status], map: "idx_prod_status")
    @@index([productionOrderNumber], map: "idx_prod_number")
    @@index([wellName], map: "idx_prod_wellname")
}
```

Migracja danych:

```sql
UPDATE production_orders_rel SET
    status = json_extract(data, '$.status'),
    productionOrderNumber = json_extract(data, '$.productionOrderNumber'),
    wellName = json_extract(data, '$.wellName'),
    projectName = json_extract(data, '$.projectName');
```

**Kiedy robić:** Gdy `json_extract`/`LIKE` na JSON staje się wąskim gardłem (mierzone EXPLAIN QUERY PLAN na danych testowych 10k+). Na start — YAGNI, używamy `json_extract` w SQL.

---

## Faza 7 — Cache z unieważnianiem

### 7.1 Użycie wspólnego SearchCache

**Plik:** `src/utils/searchCache.ts` (wspólny z kartoteką)

```typescript
// Ten sam cache co dla kartoteki, ale z namespace
searchCache.get('production', cacheKey);
searchCache.set('production', cacheKey, result);
```

### 7.2 Unieważnianie cache przy zapisie

W `src/routes/orders/production.ts` (POST, PUT, DELETE):

```typescript
import { searchCache } from '../../utils/searchCache';
searchCache.invalidateAll();
```

---

## Podsumowanie plików do modyfikacji

| Plik | Faza | Zmiana |
|------|------|--------|
| `src/routes/orders/productionSearch.ts` | 1,3,4,7 | **NOWY** — Search API + cursor + LEFT JOIN + cache |
| `src/utils/productionSearchUtils.ts` | 1,2 | **NOWY** — parseSearchParams, mapProductionOrderRow |
| `src/utils/searchCache.ts` | 7 | **WSPÓLNY** — LRU cache (już istnieje z planu kartoteki) |
| `src/app.ts` | 1 | Rejestracja `/api/orders-studnie/production/search` |
| `src/routes/orders/production.ts` | 7 | Unieważnianie cache po CREATE/UPDATE/DELETE |
| `public/js/spa/zlecenia.js` | 1,3,4,5,7 | searchOffers, loadMore, buildSearchParams, AbortController, debounce, renderTable z paginacją |
| `public/zlecenia.html` | 1 | Spinner, load more button container |
| `prisma/schema.prisma` | 6 | Indeksy na `production_orders_rel` |

## Zachowanie istniejących funkcji

| Funkcja | Działa dzięki |
|---------|--------------|
| Drukowanie pojedynczego zlecenia | `printSingleZlecenie()` szuka w `searchResults.items` po `id` |
| Drukowanie pojedynczej etykiety | j.w. |
| Drukowanie wsadowe zleceń | `selectedIds` jest zmapowane z widocznych checkboxów |
| Drukowanie wsadowe etykiet | j.w. |
| Usuwanie zlecenia | `deleteOrder()` — po usunięciu, cache na backendzie jest czyszczony, frontend odświeża |
| Edycja (przekierowanie do studni) | `editOrder()` — działa niezależnie od paginacji |
| Auto-odświeżanie | `searchOffers()` zamiast `loadOrders()` co 60s (tylko pierwsza strona) |
| Zaznaczanie wszystkie | `toggleSelectAll()` — działa na widocznych wierszach |

## Największe ryzyka

| Ryzyko | Jak unikamy |
|--------|-------------|
| `json_extract` w WHERE — wolne na 10k+ | Indeksy na kolumnach, docelowo normalizacja do kolumn |
| LIKE '%tekst%' — nie używa indeksu | FTS5 w przyszłości, na start akceptowalne dla <10k |
| Print wymaga pełnych danych PO | PO są w całości w `data` JSON — paginacja nie traci danych per-rekord |
| `selectedIds` obejmuje tylko widoczną stronę | Użytkownik może zaznaczać tylko widoczne wiersze — OK |
| offser z poza widocznego zakresu nie widać w `searchResults` | `printBatchZlecenia` szuka w `selectedIds` — jeśli element nie jest załadowany, nie będzie w zaznaczeniu |
| Cache zwraca nieaktualne dane | `invalidateAll()` przy każdym CREATE/UPDATE/DELETE |

## Szacowany czas

| Faza | Czas | Zależności |
|------|------|------------|
| 1. Unified Search API | 4-6h | — |
| 2. Backend filtry | 1-2h | Faza 1 |
| 3. Paginacja cursorowa | 1h | Faza 1 |
| 4. LEFT JOIN w SQL | 1h | Faza 1 |
| 5. Debounce + AbortController | 0.5h | — |
| 6. Indeksy + EXPLAIN | 1h | — |
| 7. Cache z unieważnianiem | 1h | Faza 1, wspólny searchCache |
| **Razem** | **9.5-12.5h** | |
