# Wersjonowanie cenników + effectiveFrom — plan v3.1 (GO)

**Status:** READY FOR EXECUTION · **Ocena:** 9,6/10
**Zakres:** rury + studnie + PRECO · harmonogram SCHEDULED→ACTIVE · freeze ofert
**Strategia:** Expand & Contract (stare LIVE + *_Default + price_defaults.json działa do Contract)

## 0. Decyzje zamrożone

- `seq` = źródło prawdy (int per type), `version` = labelka pochodna (np. `v{seq}`), nigdy input użytkownika.
- Lifecycle rozdzielony: zwykły `DRAFT → SCHEDULED → ACTIVE → ARCHIVED` oraz historyczny `DRAFT → BACKDATE_REQUESTED → BACKDATE → ARCHIVED`.
- Status = lifecycle techniczny, `effectiveFrom` = historia biznesowa — niezależne osie.
- Approval (`approvedBy/approvedAt/approvalStatus`) tylko placeholder nullable — 4-oczy to F5.
- Contract osobnym GO po: F1→F2→F3→rekonstrukcja historyczna PASS→audit/review.

## 1. Schema Prisma (migracja `xxxx_pricelist_versioning`)

- `PricelistVersion { id, type, seq Int, version String, status, effectiveFrom String (UTC ISO), createdBy?, note?, sha256, createdAt, approvedBy?, approvedAt?, approvalStatus? }`
- `PricelistItemRury / PricelistItemStudnie / PricelistItemPrecoKonfig|Kinety|Zakresy` — kopie wierszy per wersja + `versionId` FK.
- `Offer.pricelistVersionId?` / `Order.pricelistVersionId?` — nullable, null = legacy v1.
- `@@unique([type, seq])`, `@@unique([type, version])`, `@@index([type, status, effectiveFrom])`, `@@index([versionId])` na itemach.
- Immutability: ACTIVE/ARCHIVED/BACKDATE niemutowalne treściowo; PATCH/PUT tylko DRAFT/SCHEDULED/BACKDATE_REQUESTED.
- Czas: wyłącznie UTC `toISOString()` (jak guard `pricelist_defaults_updated_at`).

## 2. Service `src/services/pricelistVersionService.ts` (obok starego)

- `createDraft(type, rows, { note, effectiveFrom })` — zod (`priceDefaultsSchemas` + `.nonnegative()`), SHA `sha256Canonical`, `seq = MAX(seq,type)+1` w tx, `status = effectiveFrom > maxEffectiveFrom ? SCHEDULED : BACKDATE_REQUESTED`, insert przez `chunkedCreateMany/25` (`prismaBatch.ts`).
- `updateDraft(id, rows)` — tylko statusy edytowalne; replace w tx + nowe SHA.
- `activate(id)` — tylko SCHEDULED + `effectiveFrom <= now`; jedna tx: stare ACTIVE→ARCHIVED + nowa ACTIVE + `settings.upsert` + `audit_logs ACTIVATE`; `effectiveFrom` w istniejącym okresie → `409 PERIOD_OVERLAP` (wskazanie na backdate).
- `applyBackdate(id)` — osobny endpoint, nota ≥ 10 znaków, kolizja `(type, effectiveFrom)` → `409 EFFECTIVE_COLLISION`; tx + `audit_logs BACKDATE {przed/po}`; brak auto-aktywacji cronem.
- `resolveActive(type, at)` — kandydaci `status IN (ACTIVE, BACKDATE) + effectiveFrom <= at`, sort `effectiveFrom DESC, seq DESC`, LIMIT 1.
- **Invariant twardy:** `resolveActive(type, at)` deterministyczne — dokładnie 1 wersja albo null dla każdego `at`, również po BACKDATE.
- Lock per-type (`Map<type, lock>`, wzorzec `writeLock.ts`), nie globalny.

## 3. API `src/routes/pricelistVersions.ts` (admin + lock + limiter)

- `GET /api/pricelist-versions?type=` lista; `POST /:type/drafts`; `PUT /:id` (tylko edytowalne); `POST /:id/activate`; `POST /:id/backdate`; `GET /:id/diff` (reuse `diffById`); `GET /:id/export` (format XLSX jak `pricelistImportExport.js`).
- Stare odczyty (`productsV2`, `productsStudnieV2`, `precoPricingV2.formatPrecoResponse`) — źródło na `resolveActive()` bez zmiany sygnatury JSON.

## 4. Cron (reuse)

- `cronService.ts` ma `running:Set` — dodać tylko `schedule('pricelistDue', 5min, activateDue)` + wywołanie przy starcie (`init`). Tylko SCHEDULED; BACKDATE nigdy auto.

## 5. Oferty freeze

- `POST /offers` zapisuje `pricelistVersionId = resolveActive().id`; snapshot cen w JSON bez zmian; legacy null = v1.0.0 backfill; badge UI `cennik vX` + tooltip `effectiveFrom`.

## 6. UI (reuse, bez nowego managera)

- Modal: brak pola wersji (read-only `next seq → label`), `effectiveFrom datetime-local → UTC`, ostrzeżenie + ścieżka BACKDATE (nota) przy dacie w przeszłość.
- Tabela wersji: `label | seq | status (osobny badge BACKDATE) | effectiveFrom UTC+local | autor | nota | Diff | Aktywuj/Zastosuj wstecz | Eksport`. Import XLSX → DRAFT + Diff przed aktywacją.

## 7. Migracja Expand → Contract

1. Deploy: nowe tabele + service + cron (stare nietknięte).
2. Backfill `seq:1 v1.0.0 ACTIVE effectiveFrom=now` z LIVE (`chunkedCreateMany`); `verifySnapshot` PASS.
3. Przełącz odczyty na `resolveActive()`; dymny: oferta v1 → draft v2 → activate → nowa v2, stara bez zmian.
4. Gate: rekonstrukcja historyczna PASS → audit/review → CONTRACT GO → usunięcie `*_Default + restoreDefaultsFromJson (app.ts:356) + price_defaults.json`. Transfer maszyn starym JSON do końca F3.

## 8. Testy (DoD)

- F1: draft (seq auto, version nie z inputu); 2× concurrent `createDraft` (Promise.all + bariera) → unikalne seq, brak partial/orphan/duplikatów, retry PASS; mutacja ACTIVE → 403; ujemna cena → 422; chunking > 25 wierszy.
- F2: happy path DRAFT→SCHEDULED→ACTIVE; activate w przeszłość → 409; BACKDATE z notą + audit, nota < 10 → 400; overlapping v1 09-01 / v2 10-01 / v3 09-15 → `resolveActive(09-10)=v1, (09-20)=v3 po backdate, (10-10)=v2`; macierz `at` bez dubli; cron + startup recovery; UTC local→ISO-Z.
- F3: oferta zapisuje `versionId` + snapshot; zmiana ACTIVE nie rusza historii (co do grosza); odtworzenie ceny historycznej; diff przed publikacją; E2E freeze.
- Contract: `tests/pricelistLegacyGuard.test.ts` fail-closed — użycie `price_defaults|_Default|restoreDefaultsFromJson` poza allowlistą = FAIL.

## 9. Ryzyka (skrót)

R1 zły XLSX → Diff + draft izoluje LIVE. R2 race → seq w tx + unique + retry. R3 SQLITE_BUSY → chunking 25 + tx. R4 timezone → UTC-only. R5 mutacja wstecz → immutability + 403. R6 legacy → Contract po cyklu + guard. R7 PRECO merge → 3 tabele + walidacja RANGE_TYPES. R8 legacy null → v1 backfill. R9 cron-restart → activateDue przy starcie.

## 10. Etapy

F1 schema+service (1d) → F2 API+cron+backfill (1d) → F3 UI+freeze (1d) → Contract 0,5d osobne GO. Poza zakresem F1–F3: 4-eyes, PDF, margin simulator, auto-czyszczenie legacy.
