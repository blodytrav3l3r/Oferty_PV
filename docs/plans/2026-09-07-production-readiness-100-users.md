# Production Readiness — 1 serwer / ~100 użytkowników (PLAN v4, finalny)

> Status: PLAN. Nie implementować bez jawnego polecenia.
> Wejścia: pełny audyt aplikacji + recenzja 8,5/10 + plan v3 + recenzja 9,6/10.
> Wszystkie 13 uwag z recenzji v3 uwzględnione (sekcja „Mapowanie uwag").
> Ocena aplikacji dziś: ~6,0–6,5/10. Cel: twarde DoD → GO 100 user / 1 serwer z danych, nie z założenia.

## PRODUCTION INVARIANTS (twarde, na górze, obowiązują zawsze)

```text
1. Dokładnie 1 proces Node (zakaz PM2 cluster, replicas>1, rolling z 2 pisarzami).
2. SQLite WAL + busy_timeout.
3. Wszystkie zapisy krytyczne transakcyjne.
4. Unikalność krytyczna w DB constraints (ostatnia linia obrony).
5. Brak cichego overwrite (optimistic locking, 409).
6. FTS = dane pochodne, odtwarzalne, nigdy SSoT.
7. Restore testowane (nie zakładane), ze SHA-256 i smoke aplikacji.
8. Współbieżność PDF ograniczona (kolejka 1–2).
9. Brak GO bez testu współbieżności + kill/recovery + integrity-checker PASS.
```

## Kolejność (gate po każdym P0 — uwaga 13)

```text
P0-A invariants+UNIQUE → baseline → P0-B → TEST → P0-C → TEST → P0-D → TEST
→ P0-E → TEST → P0-F → TEST → P0-G → TEST → P0-H → TEST → P0-I jest równolegle z baseline
→ P1-A..F (każdy z testem) → P2 → FINAL benchmark (steady + burst) → GO
```

Zasada: żaden kolejny P0 nie startuje bez zielonego gate poprzedniego
(testy + `audit:integrity` PASS). Nie: „całe P0, potem testy".

Czego nie ruszać: router SPA, `headerUser.render`, tokeny CSS, `modalCore`,
`getSortedRuryItems`, virtual Excel ON, stack (bez PostgreSQL/Redis/workerów/mikroserwisów).

---

## P0-A Inwentaryzacja invariants + UNIQUE na regule biznesowej (uwagi 1, 11)

Pliki: `prisma/schema.prisma`, `prisma/migrations/`, `src/routes/orders/numbering.ts`,
`src/routes/orders/production.ts`, `tests/`.

1. Spisać invariants (wejście dla P0-H): unikalność numerów, brak sierot,
   brak orderu-bez-numeru, counter>=max, poprawne shares/ownership.
2. UNIQUE dokładnie na tym, co biznes uważa za unikalne (uwaga 1):
   numeracja roczna per `(userId, year)` — constraint na finalnym numerze
   produkcyjnym, np. `UNIQUE(userId, year, productionNumber)` (nie sam techniczny
   `seqNumber`, o ile finalny numer składany jest z `symbol/litera/seq/rok`).
   Decyzja w migracji + schema + testach, nie tylko w komentarzu.
3. Kod łapie P2002 → 409 + retry max 3 wyłącznie jako safety net (uwaga P0-1 z v3):
   normalny przepływ nigdy nie przechodzi przez P2002.

Testy: próba dubla finalnego numeru → 409; schemat zawiera constraint.
Rollback: migracja w dół + restore backupu.

Lekcja wdrożeniowa P0-A (2026-09-07, potwierdzone): silnik `prisma migrate deploy`
nie ustawia busy_timeout i głoduje przy pracującym serwerze (`database is locked`
przy każdym podejściu), mimo że zapis przez `node:sqlite` z `busy_timeout=30000`
przeszedł za 1. razem. Awaryjna ścieżka: SQL przez klienta z busy_timeout, potem
rejestr w `_prisma_migrations` z checksumą = SHA-256 hex pliku `migration.sql`
(zweryfikowane zgodnością na `20260902000001`). Przy okazji domknięto zaległą
`20260905000000_add_prod_well_index` (była w plikach, nie w tabeli) —
`migrate status` czysty. Wniosek: migracje wdrażać przy zatrzymanym Node albo
tym trybem awaryjnym; nigdy edytować pliku migracji po nałożeniu (baseline ma
dryf checksumy — nie ruszać).

## P0-B Numeracja atomowa — rezerwacja zakresu (uwaga 2)

Pliki: `src/routes/orders/numbering.ts:111-260`, `production.ts:416-444`.

Docelowo: `DB constraint ↑ transaction ↑ atomic claim ↑ business logic`
(odwrócenie dzisiejszego `business → RAM lock → DB`).

- Single: `BEGIN → najniższy recycled → delete warunkowy → utwórz order
z tym numerem → COMMIT` w jednej `$transaction`. B dostaje inny numer,
  nigdy 123 po A. `writeLock` zostaje co najwyżej throttlem.
- Bulk (uwaga 2): nie 100× `increment` ani pętla `cand++`, tylko:
  `recycled claims → remaining demand → atomic counter range reservation`
  (`A=[101..200]`, `B=[201..300]`), jedna tx na claim zakresu.
- Kill-test w 10/30/50/70/90%: brak numeru-bez-orderu, orderu-bez-numeru,
  znikniętego recycled, przesuniętego countera.

## P0-C Batch: Zod-przed, guardy-W-transakcji, zapis predykatem (uwaga 3)

Pliki: `studnieOrders.crud.ts:159-256`, `ruryOrders.crud.ts`, `production.ts:192-326`,
`offers/*Crud.ts`.

- Przed tx tylko syntaktyka: Zod, kształt, rozmiar, max batch (200 enforced).
- W tx: ownership/guard PZ + write. SQLite nie ma `SELECT FOR UPDATE`, więc
  guard nie może być `SELECT owner → SELECT PZ → DELETE` — warunek biznesowy
  musi być prawdziwy w momencie zapisu, np.
  `DELETE ... WHERE id=? AND ownerId=?`, `UPDATE ... WHERE id=? AND version=?`.
- Dlaczego brak `SELECT FOR UPDATE`: SQLite nie ma locków wierszowych, tylko
  poziomy bazy (`SHARED` → `RESERVED` → `EXCLUSIVE`); jeden pisarz blokuje całą
  bazę, więc parser nie zna składni `FOR UPDATE`. `BEGIN IMMEDIATE` daje co
  najwyżej RESERVED-lock bazy, nie trzyma wiersza między SELECT a DELETE.
  Stąd guard musi być predykatem w samym zapisie (0 wierszy = konflikt/brak
  uprawnień, atomowo), a kolejkę pisarzy kryje `busy_timeout` + WAL.
- FTS po COMMIT (patrz P0-E). Trucizna na poz. 137 → rollback całości, 0 zapisów.

## P0-D Optimistic locking jednym SQL (uwaga 4)

- Licznik `version INTEGER` (nie sam `updatedAt`-string o niegwarantowanej
  rozdzielczości): `UPDATE ... SET data=?, version=version+1
WHERE id=? AND version=?`. 0 wierszy → `409 {code:VERSION_CONFLICT,
serverVersion, serverUpdatedAt}` — bez zwracania całego payloadu MB
  (frontend dociąga GET). Jeden SQL eliminuje osobną klasę wyścigu.
- Skopiować do wszystkich edytowalnych CRUD (dziś tylko studnie-single
  `studnieOrders.crud.ts:186-210,321-350`).

## P0-E DELETE + FTS-po-tx + retry/reconciliation (uwaga 5)

- `TX: ownership → guard → delete biznes+shares → COMMIT; po TX: FTS-update`.
  Awaria wyszukiwarki nie blokuje kasowania dokumentu.
- FTS: `business DB = SSoT, FTS = derived, rebuild = recovery` + okresowa
  kontrola `FTS count/checksum/version → reconciliation` (P1 wystarczy).
- Ujednolicić 403/404 → 404 dla cudzego ID (koniec oracle).

## P0-F Restore + kill + wsteczna kompatybilność (uwaga 6)

- `backup → SHA-256 → store`; restore: `checksum → restore → integrity_check
→ migrate deploy → smoke aplikacji` (nie tylko DB: `.env`, sekrety, katalogi,
  certyfikaty). RPO/RTO do runbooka.
- Dodatkowy test (uwaga 6): restore starego backupu (np. v1.22) na nowszym
  kodzie (v1.23) → migracja → aplikacja działa.

## P0-G PDF kolejka (uwaga 7 — bez zmian, doprecyzowanie kodów)

`concurrency 1–2`, limit kolejki, timeout 30–60 s, `finally close`.
Kody: `429 queue-full / 504 generation-timeout / 500 chromium-failure`.
Metryki: `pdf_queue_depth/active/duration/failures`. Bez Redis/BullMQ.

## P0-H `npm run audit:integrity` — determinystyczny gate (uwaga 8)

Kontrole (m.in.): duble numerów, order-bez-właściciela, sieroty studnie/rury,
produkcja-bez-orderu, recycled-kolidujący, counter<max, błędne shares/ownership.
Wyjście machine-readable JSON + `exit 0 PASS / exit 1 FAIL` → gate w
`backup → migration → audit:integrity → start` i w CI/deploy. Uruchamiane też
po restore, migracji, load-teście i okresowo.

## P0-I Baseline PRZED P0 + pomiary po każdym kroku (uwaga 9)

Middleware: `duration + DB-duration + status + endpoint + requestId`;
P50/P95/P99 dla GET/PUT/batch/claim/PDF/search; `SQLITE_BUSY`, tx-duration,
loop-lag, RSS. Start: log JSON + `/metrics` (bez Prometheusa na początek).
Sekwencja: BEFORE → P0 → P1 → FINAL (widać np. czy tx podniosły P95 400 ms → 1,8 s).

---

## P1

- **P1-A Idempotencja (uwaga 12):** klucz `(userId, endpoint, key)` UNIQUE +
  `status, responseReference, requestHash, expiresAt` (TTL 24 h);
  `same-key + diff-payload → 409 IDEMPOTENCY_KEY_REUSE`; record idempotencji
  w tej samej transakcji co operacja biznesowa (`BEGIN → claim → op → COMMIT`).
- **P1-B FTS:** rebuild-job + integrity/reconciliation (jw.).
- **P1-C Bloby etapami (uwaga 11):** A) LIST-metadata / DETAIL-payload bez
  migracji → B) pomiar parse/RSS/GC/P95 → C) split `offer_data` tylko gdy pomiar każe.
- **P1-D Sesje:** kasowanie po zmianie hasła, limit/rotacja, token docelowo tylko cookie.
- **P1-E FK:** inwentaryzacja relacji + CASCADE/RESTRICT/SET NULL per relacja;
  zakaz masowego cascade.
- **P1-F Load-test:** workload 80/15/3/1/1 + scenariusze ciężkie + burst (uwaga 10).

## P2

Excel search-debounce, polling O(n)→dirty-flag, cache szablonów PDF/`version`,
fix leak `excelVirtual.js:956-957`, `escapeHtml` w bulk-progress, sync-FS→async,
mapowanie P2025→404/P2002→409.

---

## Benchmark: steady + burst (uwaga 10)

Baza: kopia prod (anonimizowana), 1 proces Node, WAL.
Steady 15 min workloadem 80/15/3/1/1 + burst: `09:00:00, 100 user →
50 GET + 20 search + 15 PUT + 5 production + 5 PDF + 5 batch` przez 5–10 s
(pokaże kolejkę SQLite, BUSY, loop-lag, PDF-queue, RAM).

## DoD (uwaga 14 — rozdzielone)

Integralność (zero tolerancji): duplicate = 0, lost-update = 0, partial-tx = 0,
orphan = 0, invalid-ownership = 0, kill-recovery 100%, restore+backup PASS,
integrity-checker PASS. Wydajność (tolerancja): P95 CRUD <500 ms, heavy <5 s,
loop-lag P95 <100 ms, 5xx <0,1%, BUSY <0,1%, PDF-OOM 0, load-test PASS,
1-proces enforced, `integrity_check` PASS.

---

## Docelowa architektura (po P0/P1)

```text
INTERNET → Caddy → 1× Node → Business API + PDF Queue (Chromium, conc. 1–2)
→ Prisma → SQLite WAL → Business tables (SSoT: constraints, unique, version,
transactions) + FTS (derived, rebuildable). Backup: VACUUM INTO → SHA256 → tested restore.
```

## Mapowanie 13 uwag recenzji v3

1. UNIQUE na finalnym numerze biznesowym — P0-A. 2. Rezerwacja zakresu bulk — P0-B.
2. Guardy predykatem, brak SELECT-FOR-UPDATE w SQLite — P0-C. 4. `version` jednym SQL — P0-D.
3. FTS retry/reconciliation (P1) — P0-E. 6. Restore starego backupu na nowym kodzie — P0-F.
4. Kody PDF 429/504/500 + metryki — P0-G. 8. Integrity JSON + exit-code jako gate — P0-H.
5. Baseline BEFORE/P0/P1/FINAL — P0-I. 10. Burst-test — Benchmark.
6. Bloby A→B→C bez migracji na zapas — P1-C. 12. Idempotencja atomowa + pola — P1-A.
7. Gate TEST po każdym P0 — Kolejność.
