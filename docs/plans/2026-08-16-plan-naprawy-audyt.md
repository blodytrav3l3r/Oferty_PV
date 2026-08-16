# Plan naprawy S.O.K. v1.15.1 — na podstawie audytu (A-01…A-60)

> Zatwierdzony 2026-08-16. Implementacja falami; każda zmiana ma kryterium akceptacji i rollback.

## 1. Cel i zakres

Kompletna naprawa potwierdzonych problemów P0–P2 z audytu. Bez zmian API/UX/uprawnień/ADR.
Każda faza osobno wdrażana i weryfikowana.

## 2. Wymagania twarde

- typecheck, typecheck:frontend, lint, lint:frontend, build — PASS
- wszystkie testy (obecnie 116 suites / 1809 testów) — PASS + nowe
- coverage nie spada poniżej: lines >= 65%, branches >= 64%, functions >= 61%
- `npm run version:check` PASS przed każdym commitem; format przez `npm run format`
- commity Conventional Commits (helper `node scripts/commit.mjs`)
- P0/P1 na koniec = 0

## 3. Decyzje do zachowania (do-not-change)

| Decyzja                               | Powód                    |
| ------------------------------------- | ------------------------ |
| Modele X/XDefault                     | Celowy snapshot cenników |
| CSP 'unsafe-inline'                   | ADR + inline onclick     |
| Token w localStorage                  | Świadoma decyzja         |
| WAL, synchronous=NORMAL, busy_timeout | ADR-001/DB               |
| connection_limit=1                    | SQLite singleton         |
| Sliding window 2000 (auth)            | Ochrona rate-limit       |
| report-uri CSP                        | Monitorowanie            |

## 4. AUDIT CORRECTIONS

1. **A-03** — listy `GET /` orders MAJĄ `buildRoleWhereCondition` (ruryOrders.crud.ts:31, studnieOrders.crud.ts:35). Podatny jest **tylko** `GET /orders` w `offers/search.ts:168-206` — gołe `WHERE offerId = ?`.
2. **A-23 (rozszerzenie)** — `ruryOrders.crud.ts:204` GET /:id ma własną logikę ignorującą subUsers (regresja: pro nie widzi zamówienia sub-usera). Studnie/production używają `canWriteDoc` (za szerokie dla odczytu). Wszystkie -> `canReadDoc`.
3. **A-50** — eksporty **ofert** poprawne (`canReadDoc`). Niepoprawne eksporty **zamówień**: `ruryOrders.export.ts:89,116` i `studnieOrders.export.ts:92,119` używają `canWriteDoc`.

## 5. Zmiany do wykonania

### Faza 0 — Baseline (bez zmian)

Snapshot: `npm run validate`, `version:check`, backup DB.

### Faza 1 — IDOR / autoryzacja (P0)

- Z1.1 `A-01` studnieCrud upsert: `canWriteDoc` przed upsertem (wzorzec ruryCrud.ts:124).
- Z1.2 `A-02` clients upsert: `DO UPDATE ... WHERE userId = target`.
- Z1.3 `A-03` search GET /orders: `buildRoleWhereCondition` przez AND.
- Z1.4 `A-23` GET /:id -> `canReadDoc` (studnieOrders, ruryOrders, production).
- Z1.5 `A-50` eksporty zamówień -> `canReadDoc`.

### Faza 2 — Stored XSS / output encoding (P0)

- Z2.1 `A-09` centralny `public/js/shared/escape.js` + przebudowa duplikatów.
- Z2.2 `A-06` offerSavedList; Z2.3 `A-07` orderKartaBudowy; Z2.4 `A-08` pricelistUi; Z2.5 `A-10` excel/transition.
- Z2.6 XSS regression suite (payloady).

### Faza 3 — Concurrency (P0/P1)

- Z3.1 `A-04` atomowy claim numeru rur (wzorzec numbering.ts:86-90).
- Z3.2 `A-05` writeLock: per-key + ownership + timeout race.

### Faza 4 — Migracja DB + restore (P0/P1)

- Z4.1 `A-11` dedup przed unique index rewardów.
- Z4.2 `A-12` restore-db: walidacja nagłówka + integrity_check + cleanup WAL.

### Faza 5 — Error handling (P1)

- Z5.1 `A-22` silent fail GET studnie order (500 z logiem).
- Z5.2 `A-13` orderHelpers; Z5.3 `A-14` TrainingPipeline guard; Z5.4 `A-15` FeatureExtractor updateMany; Z5.5 `A-16` ModelRegistry JSON validate; Z5.6 `A-18` telemetry cursor.

### Faza 6 — ML/AI (P1)

- Z6.1 `A-19` RewardCalculator: unikalnosc zdarzeniowa + brak silent fail.
- Z6.2 `A-25`/`A-39` telemetry integrity.

### Faza 7 — Pozostale P1

- Z7.1 `A-17` featureFlags requireAdmin; Z7.2 pozostale P1.

### Faza 8 — P2

Porzadki, DRY, komunikaty.

### Faza 9 — Ujednolicenie CRUD rury/studnie (P2)

Tylko po fazach 1-8.

### Faza 10 — Koncowy audyt + regresja

Pełne `npm run validate`, E2E, security-reviewer, P0/P1 = 0.

## 6. Zależnosci

```
Z1.1-Z1.5 (IDOR) -> Z3.x -> Faza 9
Z2.1 (shared escape) -> Z2.2-Z2.5 -> Z2.6 (XSS regression)
Z4.1 (migracja reward) -> Z6.1 (RewardCalculator)
Z5.x po Fazie 1
```

## 7-12. Plany szczegolowe

Patrz sekcje planu w tresci rozmowy (migracje, security, concurrency, ML/AI, testy, rollback).

## 13. Kryteria akceptacji

- [ ] P0/P1 zamkniete i pokryte testami
- [ ] typecheck, lint, build, format PASS
- [ ] test:quick PASS (116+ suites)
- [ ] coverage >= 65/64/61
- [ ] E2E Playwright PASS
- [ ] version:check, encoding:check PASS
- [ ] security-reviewer: brak CRITICAL/HIGH

## 14. Executive summary

10 faz, 3 korekty audytu, 8 zmian P0 security, ~12 P1, bez zmian ADR.

## 15. FINAL CHECK

1. `npm run validate` PASS?
2. `npm run version:check` PASS?
3. `npm run encoding:check` PASS?
4. Wszystkie testy PASS?
5. coverage >= 65/64/61?
6. P0/P1 maja testy?
7. XSS regression suite PASS?
8. IDOR E2E PASS?
9. writeLock race PASS (bez flaky)?
10. Migracje na swiezej i legacy bazie PASS?
11. E2E Playwright PASS?
12. security-reviewer brak CRITICAL/HIGH?
