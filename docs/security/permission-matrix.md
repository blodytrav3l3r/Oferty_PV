# Macierz uprawnień — S.O.K. (zadanie D2)

Dokument, zero zmian kodu. SSoT reguł: `src/utils/ownership.ts`
(`canWriteDoc`, `resolveWriteUserId`, `resolveAssignUserId`, `canClaimNumber`,
`canReadDoc`, `canReadWithShare`, `canDeleteDoc`).
Stan po E1: zapis wymaga `canWriteDoc` (owner / pro-parent / admin);
PATCH zwraca 404 zamiast 403 (nie zdradza istnienia); lock force = admin.

> Opis mechanizmów (sesje, hasła, Helmet, XSS): `docs/SECURITY.md`.

Legenda kolumn:

- **route** — metoda + ścieżka kanoniczna (montowanie: `src/mountRoutes.ts`,
  `src/routes/offers/index.ts`, `src/routes/orders/index.ts`).
- **operation** — CREATE / UPDATE / ASSIGN / BULK / COPY / DELETE / RECYCLE /
  IMPORT / claim / READ.
- **required permission** — helper (SSoT `ownership.ts`) lub rola.
- **owner required** — TAK = wyłącznie właściciel (+ admin); PRO = owner lub
  pro-parent jego sub-usera (+ admin); NIE = każdy zalogowany.
- **userId source** — skąd brane docelowe userId: self / body / URL / —.
- **body userId allowed?** — TAK tylko gdy `resolveWriteUserId` /
  `resolveAssignUserId` pozwala (self / sub / admin); N/A gdy brak pola.
- **expected 200/401/403/404** — TAK = dany kod występuje w tej trasie
  (401 = brak/nieprawidłowy token przez `requireAuth` — TAK wszędzie).

## 1. Oferty rury (`/api/offers-rury`, plik `src/routes/offers/ruryCrud.ts`)

| route                             | operation | required permission                        | owner required | userId source | body userId allowed? | expected 200 | expected 401 | expected 403 | expected 404 |
| --------------------------------- | --------- | ------------------------------------------ | -------------- | ------------- | -------------------- | ------------ | ------------ | ------------ | ------------ |
| GET /                             | READ      | `requireAuth` + filtr roli (`offer`)       | PRO            | —             | N/A                  | TAK          | TAK          | NIE          | NIE          |
| POST / (nowy id)                  | CREATE    | `resolveWriteUserId` (self/sub/admin)      | PRO            | body/self     | TAK (self/sub/admin) | TAK          | TAK          | TAK          | NIE          |
| POST / (istniejący id)            | UPDATE    | `resolveAssignUserId` wzgl. STAREGO userId | PRO            | body          | TAK (gdy assign OK)  | TAK          | TAK          | TAK          | NIE          |
| POST / (istniejący id + inny uid) | ASSIGN    | `resolveAssignUserId` STARY + NOWY         | PRO            | body          | TAK (self/sub/admin) | TAK          | TAK          | TAK          | NIE          |
| POST / (`data[]`)                 | BULK      | per item jak CREATE/UPDATE powyżej         | PRO            | body          | TAK (jak wyżej)      | TAK          | TAK          | TAK          | NIE          |
| PUT / (nowy id)                   | CREATE    | `resolveWriteUserId`                       | PRO            | body/self     | TAK (self/sub/admin) | TAK          | TAK          | TAK          | NIE          |
| PUT / (istniejący id)             | UPDATE    | `resolveAssignUserId` wzgl. STAREGO userId | PRO            | body          | TAK (gdy assign OK)  | TAK          | TAK          | TAK          | NIE          |
| PUT / (istniejący id + inny uid)  | ASSIGN    | `resolveAssignUserId` STARY + NOWY         | PRO            | body          | TAK (self/sub/admin) | TAK          | TAK          | TAK          | NIE          |
| POST /:id/duplicate               | COPY      | `canReadDoc` (źródło) + kopia na self      | PRO            | self          | N/A (ignorowane)     | TAK          | TAK          | TAK          | TAK          |
| GET /:id                          | READ      | `canReadWithShare` (`offer`)               | PRO            | —             | N/A                  | TAK          | TAK          | TAK          | TAK          |
| DELETE /:id                       | DELETE    | owner-ścisły/admin (patrz uwaga D1)        | TAK            | —             | N/A                  | TAK          | TAK          | TAK          | TAK          |

## 2. Oferty studnie (`/api/offers-studnie`, plik `src/routes/offers/studnieCrud.ts`)

Ścieżki efektywne po prefiksie `/studnie` (`mountRoutes.ts:51-54`).

| route                  | operation | required permission                                 | owner required | userId source | body userId allowed? | expected 200 | expected 401 | expected 403 | expected 404        |
| ---------------------- | --------- | --------------------------------------------------- | -------------- | ------------- | -------------------- | ------------ | ------------ | ------------ | ------------------- |
| GET /                  | READ      | `requireAuth` + filtr roli (`offer_studnie`)        | PRO            | —             | N/A                  | TAK          | TAK          | NIE          | NIE                 |
| GET /:id               | READ      | `canReadWithShare` (`offer_studnie`)                | PRO            | —             | N/A                  | TAK          | TAK          | TAK          | TAK                 |
| POST / (nowy id)       | CREATE    | `resolveWriteUserId`                                | PRO            | body/self     | TAK (self/sub/admin) | TAK          | TAK          | TAK          | NIE                 |
| POST / (istniejący id) | UPDATE    | `resolveAssignUserId` + guard ordered-well (403)    | PRO            | body          | TAK (gdy assign OK)  | TAK          | TAK          | TAK          | NIE                 |
| POST / (inny uid)      | ASSIGN    | `resolveAssignUserId` STARY + NOWY                  | PRO            | body          | TAK (self/sub/admin) | TAK          | TAK          | TAK          | NIE                 |
| POST / (`data[]`)      | BULK      | per item jak CREATE/UPDATE + guard ordered-well     | PRO            | body          | TAK (jak wyżej)      | TAK          | TAK          | TAK          | NIE                 |
| PUT / (nowy id)        | CREATE    | `resolveWriteUserId`                                | PRO            | body/self     | TAK (self/sub/admin) | TAK          | TAK          | TAK          | NIE                 |
| PUT / (istniejący id)  | UPDATE    | `resolveAssignUserId` + guard ordered-well (403)    | PRO            | body          | TAK (gdy assign OK)  | TAK          | TAK          | TAK          | NIE                 |
| PUT / (inny uid)       | ASSIGN    | `resolveAssignUserId` STARY + NOWY                  | PRO            | body          | TAK (self/sub/admin) | TAK          | TAK          | TAK          | NIE                 |
| DELETE /:id            | DELETE    | owner-ścisły/admin + guard PZ/zamówienia (patrz D1) | TAK            | —             | N/A                  | TAK          | TAK          | TAK          | TAK                 |
| POST /:id/duplicate    | COPY      | BRAK trasy dla studni (tylko rury)                  | —              | —             | —                    | NIE          | NIE          | NIE          | TAK (404 z routera) |

## 3. Zamówienia rury (`/api/orders-rury`, plik `src/routes/orders/ruryOrders.crud.ts`)

| route                           | operation | required permission                                    | owner required | userId source | body userId allowed? | expected 200 | expected 401 | expected 403 | expected 404             |
| ------------------------------- | --------- | ------------------------------------------------------ | -------------- | ------------- | -------------------- | ------------ | ------------ | ------------ | ------------------------ |
| GET /                           | READ      | `requireAuth` + filtr roli (`order_rury`)              | PRO            | —             | N/A                  | TAK          | TAK          | NIE          | NIE                      |
| GET /:id                        | READ      | `canReadWithShare` (`order_rury`)                      | PRO            | —             | N/A                  | TAK          | TAK          | NIE          | TAK (404 zamiast 403)    |
| PUT / (nowy id)                 | CREATE    | `resolveWriteUserId`                                   | PRO            | body/self     | TAK (self/sub/admin) | TAK          | TAK          | TAK          | NIE                      |
| PUT / (istniejący id)           | UPDATE    | `resolveAssignUserId` wzgl. STAREGO userId             | PRO            | body          | TAK (gdy assign OK)  | TAK          | TAK          | TAK          | NIE                      |
| PUT / (inny uid)                | ASSIGN    | `resolveAssignUserId` STARY + NOWY                     | PRO            | body          | TAK (self/sub/admin) | TAK          | TAK          | TAK          | NIE                      |
| PUT / (`data[]`)                | BULK      | per item jak CREATE/UPDATE (jedna transakcja)          | PRO            | body          | TAK (jak wyżej)      | TAK          | TAK          | TAK          | NIE                      |
| PATCH /:id (bez userId)         | UPDATE    | `canWriteDoc` wzgl. właściciela                        | PRO            | —             | N/A                  | TAK          | TAK          | NIE          | TAK (404 gdy brak prawa) |
| PATCH /:id (`userId` w body)    | ASSIGN    | `canWriteDoc` NOWY userId                              | PRO            | body          | TAK (self/sub/admin) | TAK          | TAK          | TAK          | TAK                      |
| DELETE /:id                     | DELETE    | admin: raw delete; user: `deleteMany(self)` (patrz D2) | TAK*           | —             | N/A                  | TAK          | TAK          | NIE          | NIE (brak → `{ok:true}`) |
| POST /claim-rury-number/:userId | claim     | `canClaimNumber` (self/sub/admin)                      | PRO            | URL           | N/A                  | TAK          | TAK          | TAK          | TAK (user nie istnieje)  |

## 4. Zamówienia studnie (`/api/orders-studnie`, plik `src/routes/orders/studnieOrders.crud.ts`)

| route                        | operation | required permission                           | owner required | userId source | body userId allowed? | expected 200 | expected 401 | expected 403 | expected 404             |
| ---------------------------- | --------- | --------------------------------------------- | -------------- | ------------- | -------------------- | ------------ | ------------ | ------------ | ------------------------ |
| GET /                        | READ      | `requireAuth` + filtr roli (`order_studnie`)  | PRO            | —             | N/A                  | TAK          | TAK          | NIE          | NIE                      |
| GET /:id                     | READ      | `canReadWithShare` (`order_studnie`)          | PRO            | —             | N/A                  | TAK          | TAK          | NIE          | TAK (404 zamiast 403)    |
| PUT / (nowy id)              | CREATE    | `resolveWriteUserId`                          | PRO            | body/self     | TAK (self/sub/admin) | TAK          | TAK          | TAK          | NIE                      |
| PUT / (istniejący id)        | UPDATE    | `resolveAssignUserId` wzgl. STAREGO userId    | PRO            | body          | TAK (gdy assign OK)  | TAK          | TAK          | TAK          | NIE                      |
| PUT / (inny uid)             | ASSIGN    | `resolveAssignUserId` STARY + NOWY            | PRO            | body          | TAK (self/sub/admin) | TAK          | TAK          | TAK          | NIE                      |
| PUT / (`data[]`)             | BULK      | per item jak CREATE/UPDATE (jedna transakcja) | PRO            | body          | TAK (jak wyżej)      | TAK          | TAK          | TAK          | NIE                      |
| PATCH /:id (bez userId)      | UPDATE    | `canWriteDoc` wzgl. właściciela               | PRO            | —             | N/A                  | TAK          | TAK          | NIE          | TAK (404 gdy brak prawa) |
| PATCH /:id (`userId` w body) | ASSIGN    | `canWriteDoc` NOWY userId                     | PRO            | body          | TAK (self/sub/admin) | TAK          | TAK          | TAK          | TAK                      |
| DELETE /:id                  | DELETE    | `canDeleteDoc` + guard PZ (403)               | PRO            | —             | N/A                  | TAK          | TAK          | TAK          | NIE (brak → `{ok:true}`) |

## 5. Numeracja (`/api/orders-studnie`, plik `src/routes/orders/numbering.ts`)

| route                                  | operation | required permission                | owner required | userId source | body userId allowed? | expected 200 | expected 401 | expected 403 | expected 404            |
| -------------------------------------- | --------- | ---------------------------------- | -------------- | ------------- | -------------------- | ------------ | ------------ | ------------ | ----------------------- |
| GET /recycled                          | READ      | `requireAuth`, tylko własne (self) | TAK            | self          | N/A                  | TAK          | TAK          | NIE          | NIE                     |
| GET /next-number/:userId               | claim     | `canClaimNumber` (podgląd)         | PRO            | URL           | N/A                  | TAK          | TAK          | TAK          | TAK (user nie istnieje) |
| POST /claim-number/:userId             | claim     | `canClaimNumber`                   | PRO            | URL           | N/A                  | TAK          | TAK          | TAK          | TAK (user nie istnieje) |
| POST /claim-production-number/:userId  | claim     | `canClaimNumber`                   | PRO            | URL           | N/A                  | TAK          | TAK          | TAK          | TAK (user nie istnieje) |
| POST /claim-production-numbers/:userId | claim     | `canClaimNumber` + `count` 1–200   | PRO            | URL           | N/A (`count` w body) | TAK          | TAK          | TAK          | TAK (user nie istnieje) |

## 6. Zlecenia produkcyjne (`/api/orders-studnie/production`, plik `src/routes/orders/production.ts`)

| route                  | operation | required permission                                        | owner required | userId source | body userId allowed? | expected 200 | expected 401 | expected 403 | expected 404             |
| ---------------------- | --------- | ---------------------------------------------------------- | -------------- | ------------- | -------------------- | ------------ | ------------ | ------------ | ------------------------ |
| GET /                  | READ      | `requireAuth` + filtr roli (bez shares)                    | PRO            | —             | N/A                  | TAK          | TAK          | NIE          | NIE                      |
| GET /index             | READ      | `requireAuth` + filtr roli (bez shares)                    | PRO            | —             | N/A                  | TAK          | TAK          | NIE          | NIE                      |
| GET /:id               | READ      | `canReadDoc` (bez shares — PZ poza `SHARE_DOCUMENT_TYPES`) | PRO            | —             | N/A                  | TAK          | TAK          | NIE          | TAK (404 zamiast 403)    |
| POST / (nowy id)       | CREATE    | `resolveWriteUserId`                                       | PRO            | body/self     | TAK (self/sub/admin) | TAK          | TAK          | TAK          | NIE                      |
| POST / (istniejący id) | UPDATE    | `resolveAssignUserId`                                      | PRO            | body          | TAK (gdy assign OK)  | TAK          | TAK          | TAK          | NIE                      |
| PUT / (nowy id)        | CREATE    | `resolveWriteUserId` (w transakcji)                        | PRO            | body/self     | TAK (self/sub/admin) | TAK          | TAK          | TAK          | NIE                      |
| PUT / (istniejący id)  | UPDATE    | `resolveAssignUserId` (w transakcji)                       | PRO            | body          | TAK (gdy assign OK)  | TAK          | TAK          | TAK          | NIE                      |
| PUT / (`data[]`)       | BULK      | per item jak CREATE/UPDATE, all-or-nothing                 | PRO            | body          | TAK (jak wyżej)      | TAK          | TAK          | TAK          | NIE                      |
| DELETE /:id            | DELETE    | `canDeleteDoc` + `accepted` → 403                          | PRO            | —             | N/A                  | TAK          | TAK          | TAK          | NIE (brak → `{ok:true}`) |
| POST /batch-delete     | BULK      | `canDeleteDoc` per item; `accepted` → skipped              | PRO            | body (`ids`)  | N/A                  | TAK          | TAK          | TAK          | NIE                      |
| POST /recycle-numbers  | RECYCLE   | `canClaimNumber` (wzgl. `userId` z body)                   | PRO            | body          | N/A (`seqNumbers`)   | TAK          | TAK          | TAK          | NIE                      |

## 7. Blokady (`/api/locks`, plik `src/routes/locks.ts`)

| route                | operation | required permission                     | owner required | userId source | body userId allowed? | expected 200 | expected 401 | expected 403                | expected 404                |
| -------------------- | --------- | --------------------------------------- | -------------- | ------------- | -------------------- | ------------ | ------------ | --------------------------- | --------------------------- |
| POST /acquire        | UPDATE    | `requireAuth`, holder = self (patrz U1) | NIE            | self          | N/A                  | TAK          | TAK          | NIE (423 przy cudzym locku) | NIE                         |
| POST /heartbeat      | UPDATE    | `requireAuth`, tylko holder (423 obcy)  | NIE            | self          | N/A                  | TAK          | TAK          | NIE (423)                   | NIE                         |
| POST /release        | UPDATE    | `requireAuth`, holder/wygasły           | NIE            | self          | N/A                  | TAK          | TAK          | NIE                         | NIE                         |
| POST /force          | UPDATE    | `requireAdmin` (lock force = admin)     | NIE (admin)    | self          | N/A                  | TAK          | TAK          | TAK                         | NIE                         |
| GET /:docType/:docId | READ      | `requireAuth` (status, holder)          | NIE            | —             | N/A                  | TAK          | TAK          | NIE                         | NIE (400 przy złym docType) |

## 8. Udostępnienia (`/api/shares`, plik `src/routes/shares.ts`)

| route        | operation | required permission                                     | owner required | userId source                   | body userId allowed?               | expected 200 | expected 401 | expected 403 | expected 404                |
| ------------ | --------- | ------------------------------------------------------- | -------------- | ------------------------------- | ---------------------------------- | ------------ | ------------ | ------------ | --------------------------- |
| GET /        | READ      | read-access (owner/pro-parent/admin/lub odbiorca share) | PRO            | query (`documentId`)            | N/A                                | TAK          | TAK          | TAK          | TAK (dokument nie istnieje) |
| POST /       | ASSIGN    | `canWriteDoc` wzgl. właściciela dokumentu               | PRO            | body (`documentId` + `userIds`) | N/A (lista odbiorców, nie opiekun) | TAK          | TAK          | TAK          | TAK (dokument nie istnieje) |
| POST /revoke | ASSIGN    | owner-equivalent (owner/pro-parent/admin)               | PRO            | body                            | N/A                                | TAK          | TAK          | TAK          | TAK (dokument nie istnieje) |
| DELETE /:id  | DELETE    | owner-equivalent lub self-revoke lub admin              | PRO*           | —                               | N/A                                | TAK          | TAK          | TAK          | TAK (share nie istnieje)    |

## 9. Import (brak dedykowanego endpointu backendu)

Import XLSX/JSON jest wyłącznie frontendowy (`public/js/import-export/`,
bramka: flaga `feature_import_export_enabled` w `settings`). Import zapisuje
przez te same trasy batch co powyżej, więc dziedziczy ich uprawnienia:

| route (docelowa)                               | operation | required permission | owner required | userId source | body userId allowed? | expected 200 | expected 401 | expected 403 | expected 404 |
| ---------------------------------------------- | --------- | ------------------- | -------------- | ------------- | -------------------- | ------------ | ------------ | ------------ | ------------ |
| POST/PUT `/api/offers-rury` (import rur)       | IMPORT    | jak BULK w §1       | PRO            | body/self     | TAK (self/sub/admin) | TAK          | TAK          | TAK          | NIE          |
| POST/PUT `/api/offers-studnie` (import studni) | IMPORT    | jak BULK w §2       | PRO            | body/self     | TAK (self/sub/admin) | TAK          | TAK          | TAK          | NIE          |

## Uwagi (rozjazdy kod vs SSoT)

- **D1 — DELETE ofert wymaga właściciela ścisłego, nie pro-parenta.**
  `src/routes/offers/crud.ts:159,229` i `studnieCrud.ts:1061` porównują
  `offer.userId !== authReq.user?.id` (z wyjątkiem admina) — pro-parent
  dostaje 403 mimo że `canDeleteDoc` (= `canWriteDoc`) by go przepuścił.
  Rozjazd udokumentowany, nie zgadywany.
- **D2 — DELETE zamówień rur nie zwraca 403 dla pro-parenta.**
  `ruryOrders.crud.ts:392-399`: nie-admin kasuje przez
  `deleteMany({ id, userId: self })` bez wcześniejszego `canDeleteDoc` —
  pro-parent dostaje 200 przy zero usuniętych wierszy (cichy no-op).
  W przeciwieństwie do `studnieOrders.crud.ts:510` (`canDeleteDoc` → 403).
- **D3 — GET pojedynczy: oferty 403, zamówienia/PZ 404.**
  `offers/crud.ts:31-32,71-72` i `studnieCrud.ts:442` zwracają 403 przy braku
  prawa odczytu (zdradzają istnienie); `ruryOrders.crud.ts:255`,
  `studnieOrders.crud.ts:341`, `production.ts:704` zwracają 404.
- **D4 — PZ poza shares.** `SHARE_DOCUMENT_TYPES` (`ownership.ts:149-154`)
  nie zawiera `production_order` — GET /:id PZ używa `canReadDoc` bez shares.
- **D5 — duplikacja tylko dla rur.** Brak `duplicate` w `studnieCrud.ts`;
  brak COPY dla zamówień i PZ (tylko `POST /api/offers-rury/:id/duplicate`).

## UNVERIFIED

- **U1 — `POST /api/locks/acquire` nie sprawdza prawa do dokumentu.**
  W `src/utils/docLocks.ts` brak wywołania `canReadDoc`/`canWriteDoc` —
  wygląda na to, że każdy zalogowany może założyć lock na dowolny `docId`,
  ale pełnego audytu przepływu (czy frontend zakłada lock tylko po GET 200)
  nie wykonano. Nie zgadywać: traktować jako NIEZWERYFIKOWANE.
- **U2 — `GET /api/locks/:docType/:docId` nie sprawdza prawa do dokumentu.**
  Zwraca holdera locka każdemu zalogowanemu; czy to zdradza istnienie
  dokumentu — NIEZWERYFIKOWANE (status locka, nie dokumentu).
- **U3 — kody 401 w tabeli.** `requireAuth` zwraca 401 przy braku tokenu
  (`tests/authMiddleware.test.ts`), ale per-trasa nikt nie testuje 401 —
  kolumna 401 = TAK wynika z middleware, nie z testu trasy.
- **U4 — `GET /recycled` (numbering.ts:85-108)** filtruje po
  `authReq.user?.id` bez parametru — brak wiersza dla cudzych numerów jest
  strukturalny, nie testowany. Oznaczone jako NIEZWERYFIKOWANE w sensie testu.
- **U5 — eksporty PDF/DOCX** (`offers/exports.ts`, `orders/*.export.ts`)
  mają własne kontrole inline (`isOwner`/`isProParent`/admin, 404) — poza
  zakresem macierzy D2 (operacje dokumentów, nie eksport plików).

## Powiązanie z testami

| wiersze macierzy                           | plik testu                                                           | co pokrywa (nazwy `describe`/`it`)                                                                                                                                               |
| ------------------------------------------ | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| §1 POST/PUT CREATE/UPDATE/ASSIGN (rury)    | `tests/offers/ruryCrud.test.ts`                                      | `Rury Offers CRUD — warstwa zapisu`: blokuje edycję/utworzenie dla cudzego userId, blokuje zmianę opiekuna, blokuje batch z cudzą ofertą (P0.1)                                  |
| §1 POST/PUT CREATE/UPDATE (rury, route)    | `tests/ownershipWrite.test.ts`                                       | `P0.1 macierz uprawnień zapisu (unit)`: `canWriteDoc`, `resolveWriteUserId`, `resolveAssignUserId`; `P0.1 PUT /api/offers/rury (route)`: 403 nadpisanie/przejęcie cudzej oferty  |
| §1 COPY (`POST /:id/duplicate`)            | `tests/offers/ruryCrud.test.ts`                                      | `POST /:id/duplicate`: 404 brak źródła, 403 cudze źródło                                                                                                                         |
| §1 COPY (atomowość)                        | `tests/offers/ruryDuplicateAtomic.test.ts`                           | `POST /:id/duplicate — atomowość`: rollback w tx, happy path KOPIA                                                                                                               |
| §1 COPY + §1/§2 GET/DELETE (E2E)           | `tests/ownershipE2e.test.ts`                                         | `Ownership E2E`: GET 403/200, CREATE 403/200 (user/pro/admin), DELETE, duplicate 200/403/404                                                                                     |
| §1/§2 GET/DELETE, BULK, PZ-guardy          | `tests/offers.crud.test.ts`                                          | `Offers CRUD Routes`: GET 403/404, PUT bulk T5.1/T5.5 (P0.1), DELETE rury P1-E (żywe zamówienia → 403), DELETE studni PZ/zamówienia → 403 (obie gałęzie: `studnieCrud` i `crud`) |
| §2 POST/PUT CREATE/UPDATE/ASSIGN (studnie) | `tests/offers/studnieCrud.test.ts`                                   | `Studnie Offers CRUD — autoryzacja (IDOR)`: blokuje edycję/utworzenie dla cudzego userId, pro→sub przepuszczony, blokada zmiany opiekuna                                         |
| §3 claim (`claim-rury-number`)             | `tests/orders/ruryOrders.crud.test.ts`                               | `POST /claim-rury-number/:userId`: 403 cudzy user, 404 brak usera, atomowy increment (A-04)                                                                                      |
| §3 PUT/PATCH/GET (rury orders)             | `tests/orders/ruryOrders.crud.test.ts`                               | `Rury Orders CRUD`: PUT create/update/403/409, PATCH status/opiekun/404-obcy/409, GET 200/404, DELETE admin/self/brak→ok                                                         |
| §3 PATCH ASSIGN (gate opiekuna)            | `tests/security-regression.test.ts`                                  | `T5.6`: `ruryOrders.crud.ts` gateuje zmianę opiekuna przez `resolveAssignUserId`/`canWriteDoc`                                                                                   |
| §4 PUT/PATCH/GET/DELETE (studnie orders)   | UNVERIFIED (brak pliku CRUD dla studnie orders)                      | `tests/orders/studnieSingleSave.test.ts` pokrywa tylko single-save + concurrency, nie 403/404                                                                                    |
| §5 claim/preview/bulk (numbering)          | `tests/numberingGuard.test.ts`                                       | `P0.2 numbering guard`: 403 claim/podgląd/production-number/bulk cudzego usera, 200 self                                                                                         |
| §5 bulk-claim + §6 PUT/BULK + RECYCLE      | `tests/orders/productionBulkClaim.test.ts`                           | `POST /claim-production-numbers/:userId`, `PUT /production` atomowy, version counter, `POST /production/recycle-numbers`                                                         |
| §6 POST/PUT/GET/DELETE/batch-delete (PZ)   | `tests/orders/productionOrders.test.ts`                              | `Production Orders (PZ) routes`: POST create/400/403/P1-A, PUT batch 403, GET /:id 200/404, batch-delete 400/403/skipped, DELETE draft/accepted-403/cudzy-403                    |
| §6 guardy PZ (helper)                      | `tests/productionOrderGuard.test.ts`                                 | `productionOrderGuard`: `countProductionOrdersForOrder`, `hasProductionOrdersForOffer`                                                                                           |
| §7 acquire/heartbeat/release/force/status  | `tests/locks.test.ts`                                                | `Twarda blokada edycji`: acquire 200/423, re-entrancy, heartbeat 200/423, release, force admin/403, 400 docType, `assertDocLockForWrite`, status 429                             |
| §7 force = admin (middleware)              | `tests/security-regression.test.ts` + `tests/authMiddleware.test.ts` | `T5.2 requireAdmin` (403 user/niezalogowany); `requireAdmin` 403/200                                                                                                             |
| §8 shares CRUD                             | `tests/shares.test.ts`                                               | `shares helpers` (`hasShare`, `getSharedIdsForUser`) + `roleFilter with shares` — tylko helpery, brak testu tras POST/DELETE `/api/shares` (UNVERIFIED na poziomie HTTP)         |
| §8 read-via-share (oferty)                 | `tests/offers.crud.test.ts` + `tests/ownershipE2e.test.ts`           | pośrednio przez filtry roli i GET 200 dla uprawnionych                                                                                                                           |
| 401 globalnie                              | `tests/authMiddleware.test.ts`                                       | `requireAuth` 401, `requireAdmin` 403 (U3: per-trasa 401 nietestowane)                                                                                                           |
| IDOR list/search                           | `tests/offerSearchOrdersIdor.test.ts`, `tests/clientsIdor.test.ts`   | filtry roli w listach (poza ścisłym zakresem D2)                                                                                                                                 |
