# Audyt atomowości batch-PUT (read-only, bez implementacji)

**Status:** CLOSED. §6.1 duplicate rur zaimplementowane (`129b2fa`, test rollbacku); §6.2 claim-number zweryfikowane read-only (wszystkie ścieżki przez atomowy claim, bez zmian). PATCH/writeLock/version-bump — osobne decyzje.
**Cel:** żaden nieudany request nie zostawia częściowo zapisanej operacji.
**Metoda:** 2 niezależne audyty explorer + weryfikacja P0 w kodzie + mapa `$transaction`.

## 1. Objęte i czyste (jedna transakcja, validate-first, testy istnieją)

Batch PUT zamówień (`studnieOrders.crud.ts:130`, `ruryOrders.crud.ts:118`, `production.ts:179`), ofert (`studnieCrud.ts:480/807`, `ruryCrud.ts:115/432`), cenników (`precoPricingV2.ts:171`, `productsV2.ts:36`, `productsStudnieV2.ts:249`, `priceOverrides.ts:11`): wszędzie middleware `validateData` przed handlerem, cała praca w jednym `$transaction` (opcje `hotTx.ts:7`), guardy 403/409 w tx = rollback całości. Post-commit poza atomowością wyłącznie: `syncFts5` (warn-only, dryf łata cron `ftsConsistencyCheck`), `searchCache.invalidate`, `logAudit` fire-and-forget (gubiony audyt, nie dane). Pokrycie: `partialOrders`, `productionBulkClaim`, `productionNumberUnique`, `ownership*`, `idempotency`, `priceOverrideService` (rollback pliku+DB).

## 2. P0 — `POST /:id/duplicate` rur bez transakcji (`ruryCrud.ts:640-727)

Trzy sekwencyjne awaity: `offers_rel.create` (673) → `syncFts5` (691) → `offer_items_rel.createMany` (700). Pad między 673 a 700 = nagłówek-sierota (draft bez pozycji), 500 po częściowym zapisie. Jedyna dziura partial-write w zakresie. Brak testu „pad createMany po create".
Proponowany fix (NIE teraz): nagłówek + pozycje do jednego `$transaction`; `syncFts5` zostaje post-commit warn-only (wzorzec z reszty pliku).

## 3. P1 — do oceny, niekoniecznie do kodu

- **PATCH single bez tx** (studnie `435-468`, rury `318-344`): read→merge→write; predykat wersji tylko gdy klient przysłał `version`, inaczej ślepy last-writer-wins; `assertDocLock` na globalnym prisma, nie tx. Niski blast radius (1 rekord), ale gubione aktualizacje przy równoległych PATCH-ach.
- **GET peek numerów** (`orders/numbering.ts:129-133`): ten sam numer przy race; produkcyjnie chroni atomowy `claim-number` (upsert increment) — peek służy tylko do podglądu. Zweryfikować, czy wszystkie ścieżki tworzenia używają claim (wywołania `ruryOrders.crud.ts:102`, `production.ts:207,257`).
- **`writeLock` tylko in-process** (osobna instancja na moduł cenników; oferty go nie używają — mają `docLocks` w DB). Przy wielu instancjach serwera lock cenników nie serializuje. Dla ~100 użytkowników / 1 instancji: akceptowane, odnotowane.
- **`versionedWrite` ślepy bump przy `clientVersion=null`** (starzy klienci): zapis bez sprawdzenia + gubiony wpis history. Decyzja projektowa (backward compat), nie bug.

## 4. Fałszywe alarmy (wyjaśnione, bez działań)

- Brak guarda PZ w DELETE rur (`ruryOrders.crud.ts:360`) — poprawne: PZ nie istnieją dla rur (AGENTS.md).
- `logAudit` poza tx — gubiony wpis audytu przy crashu, dane biznesowe bezpieczne.
- Prefetch `findMany` poza tx + `versionedWrite` w tx — aktualny Hurt Locker: predykat wersji, nie snapshot.

## 5. Wydajność przy dużych zamówieniach

Jedna interaktywna tx na batch to właściwy wzorzec dla SQLite (HOT_TX_OPTS); chunki 25–500 już stosowane w seed/audycie. Duplicate po fixie: 2 operacje w 1 tx — taniej niż dziś (3 roundtripy).

## 6. Proponowany minimalny zakres implementacji (gdy będzie GO)

1. `POST /:id/duplicate` do `$transaction` + test „pad createMany po create → rollback, brak sieroty".
2. Ewentualnie: asercja, że wszystkie ścieżki tworzenia zamówień wołają claim (nie peek).
   Nic więcej. PATCH-tx, writeLock multi-instance, version-bump — osobne decyzje, nie ten zakres.
