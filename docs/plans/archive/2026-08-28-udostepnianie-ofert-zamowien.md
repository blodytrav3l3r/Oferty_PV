# Udostępnianie ofert i zamówień między użytkownikami

**Data:** 2026-08-28
**Status:** Plan — gotowy do wdrożenia (po final gate 3 zasad)
**Wzorzec:** `docs/plans/2026-08-26-git-safety-audit.md`
**Ocena planu:** 8,8/10 → **9,5/10 po 3 doprecyzowaniach** (final gate)
**Decyzja:** 🟢 prawie gotowy — nie rozbudowywać, domknąć 3 zasady i start F1

---

## 0. Final gate — 3 zasady domykające F1 (MUST)

> Dopisane po review 2026-08-28. Bez tych 3 zasad F1 wymagałby zmiany architektury.

### Zasada 1 — Limit 50: aktywne share na dokument, atomowo

> **Limit 50 oznacza maksymalnie 50 aktywnych share na jeden dokument.** Operacja `POST /api/shares` przekraczająca limit jest **atomowo odrzucana HTTP 400 bez częściowego zapisu** (0 nowych share). Nie mylić z limitem `userIds.length` w pojedynczym requeście.

```
current = SELECT COUNT(*) WHERE documentType=:t AND documentId=:id  // np. 48
requestedNew = dedup(userIds) MINUS alreadyShared  // np. 5
if current + requestedNew > 50 → 400 { error: "Limit 50 udostępnień na dokument przekroczony (48/50, próba +5)" }
else → transakcja createMany
```

Walidacja Zod: `userIds: 1..50`, dodatkowo guard `current + new > 50`.

### Zasada 2 — Polimorficzne ID: documentType + documentId

> **Każde filtrowanie share MUSI uwzględniać parę `documentType + documentId`.** Samo `documentId` nie jest globalnie unikalne (prefiksy `offer_*`/`order_*` pomagają, ale nie gwarantują rozłączności między typami).

Lista ofert rury: `WHERE documentType='offer' AND documentId IN (...) AND sharedWithUserId=me`
Lista ofert studni: `WHERE documentType='offer_studnie' AND ...`
Zamówienia: analogicznie `order_rury` / `order_studnie`. Nigdy `WHERE documentId IN (wszystkie sharedIds)`.

Dla `GET /search` (UNION rury+studnie): `roleSql` rozszerzyć o `OR EXISTS (SELECT 1 FROM document_shares WHERE sharedWithUserId=:me AND documentType=:type AND documentId=table.id)`.

### Zasada 3 — Uprawnienia UI: isSharedWithMe to informacja, nie autoryzacja

> **`isSharedWithMe` jest informacją o źródle dostępu, nie źródłem autoryzacji.** Przyciski Edytuj/Usuń/Udostępnij/duplicate muszą wynikać z backendowego `canWriteDoc`/`ownerId`/`admin`, nie z badge. Szczególnie dla admina: `isSharedWithMe=true` ≠ read-only — admin nadal ma pełne prawa.

FE: `canEdit = isOwner || isAdmin || isProParent` (z API: `userId`, `permissions.canWrite`), `canShare = canEdit`, `canDelete = canEdit && !hasPZ`. Badge `isSharedWithMe` / `isSharedByMe` to tylko UI.

---

## 1. Executive summary

Jedna unifikowana tabela `document_shares` + rozszerzenie `canReadDoc`/`buildRoleWhere*` + 3 endpointy REST + reużywalny `shareModal.js` (`modalCore.js` + `LAYERS.GENERIC_MODAL_*`). Odbiorca widzi udostępniony dokument **read-only** (przegląd/druk/export, bez edycji/usuwania, duplikacja jako własna kopia dozwolona). Właściciel (`userId`) niezmieniony. Zakres F1: 4 typy — `offer` (`offers_rel`), `offer_studnie` (`offers_studnie_rel`), `order_rury` (`orders_rury_rel`), `order_studnie` (`orders_studnie_rel`). `production_orders_rel` i `clients_rel` poza F1. Wariant **A** (user: własne + udostępnione mu), wariant B odrzucony.

---

## 2. Stan obecny (file:line)

| Obszar         | Plik:linia                                                                                                                              | Co robi                                                                   |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Ownership      | `src/utils/ownership.ts:7` `canReadDoc`                                                                                                 | `admin \|\| owner \|\| pro-parent` → true; legacy `null→false` (#40)      |
|                | `src/utils/ownership.ts:25` `canWriteDoc`                                                                                               | zapis tylko owner/pro-parent/admin                                        |
|                | `src/utils/ownership.ts:43` `resolveWriteUserId`                                                                                        | effectiveUserId dla creates                                               |
| Role filter    | `src/utils/roleFilter.ts:12` `buildRoleWhereClause`                                                                                     | Prisma where: admin=undefined, pro=`in [self+subUsers]`, user=`userId=id` |
|                | `src/utils/roleFilter.ts:32` `buildRoleWhereCondition`                                                                                  | raw `Prisma.Sql` WHERE dla `$queryRaw`                                    |
| Auth           | `src/middleware/auth.ts:99` `requireAuth`                                                                                               | `x-auth-token`/cookie → 401                                               |
|                | `src/middleware/auth.ts:127` `requireAdmin`                                                                                             | 403 jeśli nie admin                                                       |
| Oferty rury    | `src/routes/offers/ruryCrud.ts:22` `GET /`                                                                                              | `findMany({where: roleClause})`                                           |
| Oferty studnie | `src/routes/offers/studnieCrud.ts:249` `GET /studnie`                                                                                   | `SELECT ... ${whereCondition}` raw                                        |
| Search         | `src/routes/offers/search.ts:20` `GET /search`                                                                                          | UNION ALL rury+studnie + `roleSql`, cache TTL 30s                         |
| Single         | `src/routes/offers/crud.ts:16` `GET /:id`                                                                                               | dispatch + `canReadDoc`                                                   |
|                | `src/routes/offers/studnieCrud.ts:345` `GET /studnie/:id`                                                                               | bug: `role!==admin && userId!==id` (ignoruje pro) — naprawić w F1         |
| Delete         | `src/routes/offers/crud.ts:140` + `studnieCrud.ts:700`                                                                                  | `hasProductionOrdersForOffer` →403                                        |
| Zamówienia     | `src/routes/orders/ruryOrders.crud.ts:19` `GET /`                                                                                       | `roleCondition` + `ids IN`                                                |
|                | `src/routes/orders/studnieOrders.crud.ts:23` `GET /`                                                                                    | jw. raw                                                                   |
|                | `src/routes/orders/studnieOrders.crud.ts:257` `DELETE /:id`                                                                             | guard `countProductionOrdersForOrder`                                     |
| Users          | `src/routes/users.ts:15` `GET /api/users`                                                                                               | admin only                                                                |
|                | `src/routes/users.ts:174` `GET /for-assignment`                                                                                         | admin=wszyscy, non-admin=`[self+subUsers]` — dziś SSoT selectów           |
| FTS            | `src/utils/fts5Sync.ts:16`                                                                                                              | `offers_search_fts`                                                       |
| PZ guard       | `src/utils/productionOrderGuard.ts:13/27`                                                                                               | blokada delete gdy PZ                                                     |
| Prisma         | `prisma/schema.prisma:290` `offers_rel`, `315` `offers_studnie_rel`, `358` `orders_studnie_rel`, `371` `orders_rury_rel`, `723` `users` | `userId String?`                                                          |
| Karta          | `public/js/kartoteka/kartotekaHelpers.js:259` `buildOfferCardHtml`                                                                      | render karty, akcje `351-375` — injection #1                              |
|                | `public/js/kartoteka/kartotekaActions.js:227`                                                                                           | delegacja click                                                           |
|                | `public/js/rury/offerCrudHelpers.js:94`                                                                                                 | lista rury — injection #2                                                 |
|                | `public/js/studnie/offerSavedList.js:104`                                                                                               | lista studnie — injection #3                                              |
| Modal          | `public/js/shared/modalCore.js:88` `showModal`                                                                                          | `.modal-overlay.js-modal-overlay`+`.modal`, Esc/overlay, trapFocus        |
| Z-index        | `public/js/studnie/layers.js:5` `LAYERS`                                                                                                | `GENERIC_MODAL_BACKDROP 2000/CONTENT 2010`                                |
| UI             | `docs/UI_GUIDELINES.md`                                                                                                                 | tokeny `var(--*)`, modale tylko `modalCore.js`                            |

**Weryfikacja „wszyscy widzą wszystko”:** fałsz dziś — `buildRoleWhereClause:12-24` + `canReadDoc:7` ograniczają `user` do własnych. Tylko `admin` widzi wszystko. Wariant B (otwórz wszystko) odrzucony — to sharing ma rozszerzać, nie zastępować.

---

## 3. Wymagania → decyzje (ADR mini)

| #   | Wymaganie        | Decyzja                                                  | Uzasadnienie                               | Ocena                       |
| --- | ---------------- | -------------------------------------------------------- | ------------------------------------------ | --------------------------- |
| 1   | Zakres typów     | F1: 4 typy. `production_orders_rel` i `clients_rel` NIE  | Scope creep, PZ chronione, klienci wspólni | —                           |
| 2   | Poziom           | Cały dokument; share oferty NIE auto-udostępnia zamówień | Minimalny model, brak kaskady              | —                           |
| 3   | Prawa            | `read` only + duplikacja jako własna kopia               | Brak konfliktów edycji/PZ/historii         | **10/10**                   |
| 4   | Transitive share | Odbiorca NIE może udostępniać dalej (tylko owner/admin)  | Anty-eskalacja                             | —                           |
| 5   | Wariant          | **A** (własne + udostępnione), B odrzucony               | B = breaking change prywatności            | —                           |
| 6   | Tabela           | Unifikowana `document_shares`                            | 1 migracja vs 4, DRY                       | —                           |
| 7   | Storage          | Osobna tabela, nie `settings` JSON                       | Indexowalność                              | —                           |
| 8   | TTL              | Brak w F1                                                | YAGNI                                      | **10/10**                   |
| 9   | Powiadomienia    | Toast + badge, bez push/email/inbox/WS                   | Minimalizm F1                              | **10/10**                   |
| 10  | Limit            | 50/dokument — **aktywne**, atomowo (Zasada 1)            | Ochrona przed bulk                         | **8/10 → 10/10 po doprec.** |

**Uwaga ownerId denormalizacja:** `document_shares.ownerId` to snapshot `document.userId` w chwili share (audyt). Jeśli dokument zmieni właściciela (mechanizm istnieje via `userId` w body — tylko admin/pro-parent), share może mieć `ownerId != document.userId`. Źródłem prawdy zawsze `document.userId`. `ownerId` w share nie służy do autoryzacji, tylko do audytu. Przy zmianie właściciela nie migrować shares — pozostawić, autoryzacja i tak idzie po `document.userId`.

---

## 4. Model danych + migracja

```prisma
model document_shares {
  id               String @id
  documentType     String // 'offer' | 'offer_studnie' | 'order_rury' | 'order_studnie'
  documentId       String
  ownerId          String
  sharedWithUserId String
  permission       String @default("read")
  createdAt        String // ISO
  createdBy        String

  @@unique([documentType, documentId, sharedWithUserId])
  @@index([sharedWithUserId])
  @@index([documentId])
  @@index([documentType, documentId])
  @@index([ownerId])
}
```

Bez FK (polimorficzne) — walidacja aplikacyjna + czyszczenie `deleteMany({where:{documentId, documentType}})` w 4 handlerach `DELETE /:id`.

Migracja:

```bash
npx prisma migrate dev --name add_document_shares
# legacy db push:
npx prisma db push --skip-generate --accept-data-loss
npx prisma generate
```

---

## 5. API (Express)

### Nowe endpointy

| Metoda   | Ścieżka                               | Guard                               | Body/Query                                         | Opis                                                                                       |
| -------- | ------------------------------------- | ----------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `GET`    | `/api/users/shareable`                | `requireAuth`, `apiLimiter`         | —                                                  | `{id,username,firstName,lastName,role,symbol}` wszystkich oprócz `self`, bez haseł         |
| `GET`    | `/api/shares?documentType&documentId` | `requireAuth`                       | query enum+id                                      | `shares: [{id,sharedWithUserId,user}]` + `canShare` (czy caller może share)                |
| `POST`   | `/api/shares`                         | `requireAuth + WRITE_LIMITER + zod` | `{documentType,documentId,userIds: string[1..50]}` | Upsert (dedup), guard limit 50 atomowo, `canWriteDoc` na dokumencie, audit, 200 `{shares}` |
| `DELETE` | `/api/shares/:id`                     | `requireAuth + WRITE_LIMITER`       | —                                                  | Owner doc lub admin lub `sharedWithUserId==self` (self-revoke)                             |
| `POST`   | `/api/shares/revoke`                  | batch revoke                        | `{documentType,documentId,userIds}`                | alternatywa batch                                                                          |

Zod: `shareCreateSchema = z.object({documentType: z.enum(['offer','offer_studnie','order_rury','order_studnie']), documentId: z.string().min(1), userIds: z.array(z.string()).min(1).max(50)})`

### Zmiany istniejących

- `src/utils/ownership.ts` — helper `async hasShare(userId, documentType, documentId): boolean` + `getSharedIds(userId, documentType): string[]` (1 query). Użyty w `GET /:id`: `canReadDoc || await hasShare(...)`.
- `src/utils/roleFilter.ts` — listy `GET /` używają pre-fetch `sharedIds = await getSharedIds(me, type)` i `OR: [roleClause, {id:{in: sharedIds}}]` (Prisma) lub `WHERE (userId ... OR id IN (...))` (raw). Filtrowane **per documentType** (Zasada 2).
- `src/routes/offers/ruryCrud.ts:22`, `studnieCrud.ts:249`, `orders/*:19` — wstrzyknąć sharedIds.
- `src/routes/offers/search.ts:20` — `roleSql` → `OR EXISTS (SELECT 1 FROM document_shares WHERE sharedWithUserId=:me AND documentType=:type AND documentId=table.id)`.
- `src/routes/offers/crud.ts:29/69`, `studnieCrud.ts:345` (naprawić bug pro), `orders/...` `GET :id` — `canReadDoc || hasShare`.
- `exports.ts` — `GET /:id/export-*` też przez `canReadDoc || hasShare`.
- `src/routes/users.ts:15` — bez zmian; nowy `GET /api/users/shareable` obok `for-assignment`.
- `searchCache` — invalidate przy POST/DELETE shares.

Diagram share: `FE click Udostępnij → GET /api/users/shareable → grid kafli → select N → POST /api/shares → BE canWriteDoc → limit check → upsert → audit → 200 → toast "Udostępniono N użytkownikom" → refresh Kartoteki (badge)`.

---

## 6. Frontend

### Nowe pliki

- `public/js/shared/shareService.js` — `getShareableUsers()`, `getShares(type,id)`, `createShares(type,id,userIds)`, `revokeShare(id)`, `revokeByUsers(type,id,userIds)`. Via `StorageService.getHeaders()`/`fetchJson.js`. `window.shareService`.
- `public/js/shared/shareModal.js` — `window.shareModal.open(documentType, documentId)` / `close()`. `showModal({id:'share-modal', titleId:'share-title', html})`, grid kafelków 2-3 kol, search debounce, multi-select (checkbox na kafelku), licznik `Wybrano: N`, `Udostępnij` (disabled gdy 0) / `Cofnij zaznaczenie` / `Anuluj`. Stany loading/empty/error. `lucide.createIcons({root:overlay})`, `escapeHtml/Attr/JsStr`, tokeny `var(--*)`, `LAYERS.GENERIC_MODAL_*`.

CSS: `style.utilities.css` — `.share-grid {grid: repeat(auto-fill,minmax(180px,1fr))}`, `.share-tile {border:1px solid rgba(var(--slate-400-rgb),0.15); border-radius:var(--radius-sm); padding:0.75rem; cursor:pointer}` + `.selected {border-color:var(--accent); background:rgba(var(--accent-rgb),0.08)}`.

### Integracja (3 wstrzyknięcia)

| Miejsce   | Plik:linia                                 | Przycisk                                                                                                                                                                 | Delegacja                                                                                           |
| --------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| Kartoteka | `kartotekaHelpers.js:351` `action-buttons` | `<button class="action-btn secondary text-btn btn-share" data-id data-type title="Udostępnij" aria-label="Udostępnij"><i data-lucide="share-2"></i> Udostępnij</button>` | `kartotekaActions.js:227` `if(btn.classList.contains('btn-share')) window.shareModal.open(type,id)` |
| Rury      | `rury/offerCrudHelpers.js:94-121`          | `data-action="shareOffer"`                                                                                                                                               | `closest[data-action]`                                                                              |
| Studnie   | `studnie/offerSavedList.js:104`            | `data-action="shareOfferStudnie"`                                                                                                                                        | jw.                                                                                                 |

Toolbar szczegółów oferty/zamówienia — obok Drukuj/Historia.

**Odznaki:** `buildOfferCardHtml` → `isSharedByMe` → `<span class="badge badge-info"><i data-lucide="share-2"></i> Udostępnione</span>`, `isSharedWithMe` → `<span class="badge badge-ok"><i data-lucide="users"></i> Udostępnione mi</span>` (dane z API: `OfferMapped.isSharedWithMe`). Filtr Kartoteki: `Wszystkie / Moje / Udostępnione mi / Udostępnione przeze mnie` — FE po fladze lub `?sharedWithMe=1` BE.

---

## 7. Uprawnienia — macierz

| Aktor \ Dokument  | owner=self                                  | sharedWithMe                                                          | cudzy bez share         | admin                   |
| ----------------- | ------------------------------------------- | --------------------------------------------------------------------- | ----------------------- | ----------------------- |
| `user` właściciel | read+write+share+delete, badge Udostępnione | —                                                                     | 403 / niewidoczny       | —                       |
| `user` odbiorca   | —                                           | read (przegląd/druk/export/duplikuj jako swój), NIE edit/delete/share | 403                     | —                       |
| `pro`             | jak user + widzi subUsers                   | jak user                                                              | widzi subUsers + shared | —                       |
| `admin`           | wszystko + share dowolnego                  | wszystko (isSharedWithMe ≠ read-only)                                 | wszystko                | read+write+share+delete |

`GET /` listy: `admin: where=undefined`, `pro/user: where=(own OR sharedWithMe per type)`.
`GET /:id`: `canReadDoc || hasShare` (Zasada 2: z `documentType`).
`POST /shares`: `canWriteDoc(doc) || admin`.
`DELETE /shares/:id`: owner doc lub admin lub self-revoke.

**Ważne (Zasada 3):** FE `canEdit/canShare/canDelete` z backendu (`permissions.canWrite`), nie z badge. Admin z `isSharedWithMe=true` nadal edytuje.

| Operacja         | Owner | Odbiorca | Admin |
| ---------------- | ----: | -------: | ----: |
| utworzenie share |    ✅ |       ❌ |    ✅ |
| revoke           |    ✅ |       ❌ |    ✅ |
| self-revoke      |     — |       ✅ |    ✅ |

Odbiorca NIE może share dalej cudzego.

---

## 8. Bezpieczeństwo / XSS / audit / rate limit

- XSS: `escapeHtml` nazwy kafelków, `escapeHtmlAttr` `data-id/type`, `escapeJsStr` dla atrybutów; brak `innerHTML` bez escape (#3, #24, #39).
- SQLi: tylko `Prisma.sql`/`Prisma.join`, brak ` $queryRawUnsafe`.
- Auth: wszystkie share `requireAuth`, mutacje `WRITE_LIMITER`, listy `apiLimiter`.
- Audit: `logAudit('document_share', documentId, userId, 'create/revoke', {sharedWithUserIds, documentType})`.
- FTS: udostępnione MUSZĄ być w `GET /search` odbiorcy (rozszerzony `roleSql` per type).
- AI: exclude z `AiFeature`.
- PZ guard: bez zmian — odbiorca i tak nie ma `canWriteDoc`.

---

## 9. Plan faz

| Faza | Zakres                                      | Pliki                                                                                                                                                              | DONE                                                                           |
| ---- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| F0   | Przygotowanie                               | —                                                                                                                                                                  | Plan zaakceptowany, `npm run validate` zielone                                 |
| F1   | DB + BE shares                              | `schema.prisma`, `migrations/*`, `src/routes/shares.ts`, `src/app.ts` mount, `src/utils/ownership.ts`, `src/validators/offerSchemas.ts`, `src/utils/roleFilter.ts` | generate OK, `GET/POST/DELETE /api/shares` 200/403/400, `tests/shares.test.ts` |
| F2   | `shareable` + `shareService` + `shareModal` | `src/routes/users.ts` nowy endpoint, `public/js/shared/shareService.js`, `shareModal.js`, `style.utilities.css`                                                    | `node -c` OK, modal kafle + lucide                                             |
| F3   | Kartoteka                                   | `kartotekaHelpers.js:351`, `kartotekaActions.js:227`, `kartotekaSearch.js` badge+filtr, `offers/search.ts` sharedSql                                               | Przycisk, share, filtr "Udostępnione mi", search znajduje shared               |
| F4   | Rury/Studnie + Zamówienia                   | `rury/offerCrudHelpers.js`, `studnie/offerSavedList.js`, `orders/*crud.ts`, `spa/zlecenia*.js`                                                                     | Zamówienia share, odznaki zleceń                                               |
| F5   | Testy + docs                                | `tests/ownership.test.ts`, `tests/shares.test.ts`, `docs/API.md`, `CHANGELOG`                                                                                      | `validate` + `version:check` + `encoding:check` 0                              |

Szacunek: F1 1d, F2 1d, F3 1d, F4 0.5d, F5 0.5d ≈ 4 dni.

Bug-fix w F1: `studnieCrud.ts:355` `role!==admin && userId!==id` → `!canReadDoc(...)` (spójnie z `crud.ts:29`).

---

## 10. Ryzyka i mitigacje

| Ryzyko                               | Skutek           | Mitigacja                                                      |
| ------------------------------------ | ---------------- | -------------------------------------------------------------- |
| N+1 `hasShare` per oferta            | O(N) queries     | Pre-fetch `sharedIds` 1 query przed listą, `WHERE id IN`       |
| Race duplikat                        | unique violation | `@@unique` + `createMany(skipDuplicates)` / upsert             |
| Sieroty po `DELETE /:id`             | wyciek           | `deleteMany({where:{documentType,documentId}})` w 4 handlerach |
| `studnieCrud:355` bug pro            | niekonsekwencja  | naprawić na `canReadDoc`                                       |
| FTS bez shared                       | niewidoczne      | `roleSql` per type z `EXISTS` share                            |
| Self-share                           | bezsens          | `userIds != self` →400                                         |
| Limit 50                             | przekroczenie    | Zasada 1 — atomowo 400                                         |
| Legacy `userId=null`                 | share nie działa | guard 400 — tylko `userId != null`                             |
| `ownerId` vs `document.userId` drift | niespójność      | Źródło prawdy `document.userId`, `ownerId` tylko audyt         |

---

## 11. Kryteria akceptacji (Given/When/Then)

- **AC1:** Given owner A `offer_rury_1`, When A `POST /shares {userIds:[B]}`, Then B `GET /:id` 200 `isSharedWithMe:true`, `GET /` widzi, `PUT` B →403.
- **AC2:** Given B shared, When B self-revoke lub A revoke, Then B `GET /:id` 403.
- **AC3:** Given C non-owner, When C `POST /shares` na cudzej, Then 403.
- **AC4:** Given admin, When `GET /shareable` → wszyscy, `POST /shares` na dowolnej →200; `isSharedWithMe` nie odbiera adminowi write.
- **AC5:** Given Kartoteka B, When lista, Then badge "Udostępnione mi", filtr "Udostępnione mi" pokazuje, "Moje" nie.
- **AC6:** Given `DELETE /:id` oferty, When owner usuwa, Then `document_shares` dla `documentId` =0.
- **AC7:** XSS: `firstName="<script>"` → escapowane.
- **AC8:** A11y: `role=dialog aria-modal`, `aria-label` na btn-share, focus trap, Esc zamyka.
- **AC9:** Limit: 48 shared + POST 5 nowych →400, 0 nowych (atomowo).
- **AC10:** Polimorfizm: `offer` shares nie wyciekają do listy `order_rury`.

---

## 12. Komendy weryfikacji

```bash
npx prisma generate
npx prisma migrate dev --name add_document_shares
npm run typecheck
npm run typecheck:frontend
npm run lint
npm run lint:frontend
npm run test:quick
npm run test -- tests/shares.test.ts tests/ownership.test.ts
node -c public/js/shared/shareModal.js
node -c public/js/shared/shareService.js
npm run format:check
npm run encoding:check
npm run version:check
npm run validate
```

---

## Dodatek — ocena 5 decyzji (review 2026-08-28)

| Decyzja                               |            Ocena | Uwaga review                                                      |
| ------------------------------------- | ---------------: | ----------------------------------------------------------------- |
| Read vs Copy (read-only + duplikacja) |        **10/10** | Najlepsza dla F1 — brak konfliktów edycji/PZ                      |
| Admin „Udostępnione mi”               |         **9/10** | OK, warunek: FE nie może używać badge jako autoryzacji (Zasada 3) |
| TTL brak                              |        **10/10** | YAGNI — bez cron/czyszczenia                                      |
| Powiadomienia toast+badge             |        **10/10** | Bez inbox/WS/mail w F1                                            |
| Limit 50                              | **8/10 → 10/10** | Po doprecyzowaniu Zasada 1 (atomowo)                              |

**Wniosek review:** nie rozbudowywać planu, po 3 zasadach zamknąć planowanie i start F1.

---

## Historia

- 2026-08-28 — wersja 1.0 (8,8/10, 5 decyzji, 4 typy, wariant A)
- 2026-08-28 — wersja 1.1 — final gate: Zasada 1 (limit atomowo), Zasada 2 (polimorficzne ID), Zasada 3 (UI ≠ auth), uwaga ownerId drift, AC9/AC10

> Po wdrożeniu: `git mv docs/plans/2026-08-28-udostepnianie-ofert-zamowien.md docs/plans/archive/2026-08-28-udostepnianie-ofert-zamowien.md`
