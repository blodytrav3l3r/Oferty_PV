# Duże zamówienia studni — DTO allowlist + slim snapshot + single-order save

**Wersja:** 1.2 (2026-09-05) — P0 + P1 WYKONANE. P1 HIGH następny. P2 tylko na podstawie pomiarów.
**Status:** GO do P0. GO do P1/P1 HIGH po DoD P0. P2 tylko na podstawie pomiarów.
**Kontekst:** `HTTP 413` przy zapisie zamówień z ~3000 studni. Hotfix (strip + 50 MB) działa, ale docelowo: allowlist DTO, snapshot bez duplikacji, zapis pojedynczego zamówienia.
**Zasada:** `DOM/runtime ≠ dane transportowe ≠ snapshot ≠ dane historyczne`. Limit 50 MB zostaje jako safety cap, nie mechanizm.

## Diagnoza

1. `finalizeOrderFromOffer` (`orderCrud.js:186-230`): `structuredClone(wells)` + `originalSnapshot.wells = structuredClone(...)` = 2× pełne dane w jednym obiekcie.
2. `saveOrdersDataStudnie` (`orderHelpers.js:22-41`): wysyła całą tablicę `ordersStudnie` przy każdej zmianie = payload skaluje się z liczbą zamówień × liczbą studni.
3. `stripWellRuntimeFields` (`offerSave.js:9-24`): denylist 5 kluczy — działa, ale każdy nowy cache przejdzie do API.
4. `studnieOrdersBatchSchema` (`.passthrough()`, `studnieOrders.crud.ts:85`): brak kontraktu rozmiaru po stronie serwera.

## Audyt `originalSnapshot` (2026-09-05, read-only)

| Konsument                                 | Odczyt                                                                       | Restore?                |
| ----------------------------------------- | ---------------------------------------------------------------------------- | ----------------------- |
| `orderHelpers.js:274 getOrderChanges`     | `snap.wells[]` → `calcWellStats()`, `wellDiscounts`, `transportKm/Rate/Mode` | Nie — diff cen          |
| `offerSummaryTable.js:45,94`              | `snap.wells[]` → `calcWellStats()` + rabaty + transport („Cena z oferty")    | Nie — odczyt do tabeli  |
| `actionsWellPricing.js:26-38`             | tylko `snap.wellDiscounts`                                                   | Nie                     |
| `kartotekaHelpers.js:431-524`             | delegacja do `getOrderChanges()` + `originalTotalNetto`                      | Nie — badge „zmieniono" |
| `src/` backend                            | zero odczytów                                                                | —                       |
| Rury (`offerSummaryTab`, `orderEditMode`) | własny kształt `{items}`                                                     | Nie dotyczy             |

**Wniosek:** snapshot = read-only reference price. Brak ścieżki `snapshot → order.wells`. Slim snapshot uzasadniony. Rury poza zakresem P1.

## P0 — DTO allowlist + telemetry + Zod + benchmark

### P0.1 DTO allowlist (główna zmiana)

- Nowy `public/js/studnie/orderDto.js`: `toWellOrderDTO(well)`, `toWellConfigItemDTO(item)`.
- Poziom studni (tylko biznesowe): `id, name, dn, rzednaDna, rzednaWlazu, magazyn, psiaBuda, stycznaNadbudowa1200, zakonczenie, redukcjaDN1000, redukcjaTargetDN, wkladka*, kineta, dennicaMaterial, configSource, przejscia[]` (przejścia też jako DTO).
- Poziom pozycji: `productId, quantity, frozenPrice, frozenPriceBase, frozenName, _elemId` (PZ!), `disablePehd/disablePreco` jeśli istnieją.
- `stripWellRuntimeFields` zostaje jako defense-in-depth wewnątrz buildera.
- Podmiana: `orderCrud.js` ~186 (wells), ~216 (snapshot), ~260/~399/~825 (`wellsExport` — audyt i unifikacja na DTO).
- Test: `tests/studnie/orderDto.test.ts` — allowlist, `_elemId`/`frozen` zachowane, runtime odcięte.

### P0.2 Telemetry rozmiaru (`saveOrdersDataStudnie`)

Pola: `payload_bytes, wells_count, snapshot_bytes, orders_count, payload_before_dto_bytes, payload_after_dto_bytes`. Warn throttled (once-per-session + sampling), nie per request.

### P0.3 Zod — observe → strict

Etap 1: `studnieWellDtoSchema` w trybie observe (log unknown keys, semantyka bez zmian). Etap 2: `.strict()` → `400 unknown field` (głośna regresja, nie ciche strip).

### P0.4 Benchmark 3k studni — DoD P0

```
before DTO: …MB | after DTO: …MB | reduction: …%
JSON.stringify time: …ms | request size: …MB
unknown DTO keys: 0 | runtime fields leaked: 0
```

Weryfikacja: `typecheck`, `typecheck:frontend`, `test:quick:lite`, `format`, `version:check`.

## P0 — WYKONANE 2026-09-05 (benchmark 3k, `scripts/benchmark-order-dto.cjs`)

```
wells: 3000
before DTO (wells): 13.77 MB | after DTO (wells): 4.76 MB | reduction: 65.5%
DTO build time: 141 ms
before payload (wells+snapshot+export): 41.32 MB
after payload (wells+snapshot+export): 14.27 MB
payload reduction: 65.5%
JSON.stringify time (after): 51 ms
unknown DTO keys: 0 | runtime fields leaked: 0
```

Wniosek: DTO daje 65,5%, ale payload nadal 14,27 MB przez potrojenie
wells+snapshot+wellsExport — to motywacja P1 (slim snapshot) i P1 HIGH
(single-order save). Pliki: `public/js/studnie/orderDto.js`,
`tests/studnie/orderDto.test.ts` (6/6), `tests/studnie/orderDtoObserve.test.ts` (3/3).

## P1 — WYKONANE 2026-09-05 (benchmark 3k)

```
legacy snapshot (full wells): 13.77 MB → slim snapshot: 246.9 KB
snapshot reduction: 98.2%
payload po P1 (wells+slim+export): 9.76 MB (było 14.27 MB)
```

- `configHash` = FNV-1a ze stabilnej serializacji kanonicznego wejścia cenowego
  (sortowane klucze + sortowane pozycje; drag nie zmienia hasha).
- Slim budowany ze statystyk reuse z pętli `wellsExport` — zero dodatkowych
  `calcWellStats`; konsumenci (`getOrderChanges`, `offerSummaryTable`) czytają
  gotowe `price/weight`.
- DoD P1: ten sam config → ten sam hash; zmiana cenowa → inny hash;
  runtime → ten sam hash; legacy `{wells}`/`Array` nadal odczytywane;
  legacy vs slim → identyczny `getOrderChanges` (`tests/studnie/orderDtoSlim.test.ts`, 5/5).
- Dopisane pola DTO po audycie konsumentów: `klasaNosnosci_*`, `redukcjaKinety`,
  `agresja*`, `klasaBetonu`, `powlokaName*`, `usytuowanie`, `numer`, `stycznaVariant`
  (+ mirror w `orderSchemas.ts` dla Zod-observe).

## P1 — slim snapshot (po DoD P0)

- Snapshot per studnia: `{ id, price, weight, configHash }` + `wellDiscounts` + `transportKm/Rate/Mode`.
- `configHash` = deterministyczny hash **kanonicznego DTO** (stable serialization; niezależny od kolejności kluczy i runtime).
- `getOrderChanges` i `offerSummaryTable.js:48` przechodzą na gotowe `price/weight` (znika `calcWellStats` na 2×N — zysk CPU + MB).
- Back-compat: `getOrderChanges` już zna `Array | {wells}` — dodać kształt `{slimWells}` (legacy nadal odczytywane).
- DoD P1: ten sam config → ten sam hash; zmiana pola cenowego → inny hash; zmiana runtime → ten sam hash; legacy snapshot odczytywany.

## P1 HIGH — single-order save

- `PUT /api/orders-studnie/:id` zamiast wysyłki całego `ordersStudnie` przy edycji jednego zamówienia.
- Ponowny benchmark po P1+P1 HIGH.

## P2 — tylko jeśli pomiary wymuszą

Chunking (`POST /:id/wells` w paczkach ~500) lub server-side snapshot (`snapshotId`). Nie wdrażać z góry.
