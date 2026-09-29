# E3 checkpoint — P1 integralność (decyzje + kod, zero migracji)

## Decyzje (FACT z kodu)

- `offer_studnie_items_rel`: MARTWA (A+D) — 0 odwołań w src/public, CREATE tylko w baseline,
  read-only licznik w `audit-integrity.mjs`. Zostawić; DROP osobną migracją poza zakresem.
- `document_shares` lifecycle: dokumenty BLOKUJ (istniejące 403), shares USUŃ w tx delete-usera
  (uprawnienie, nie historia). Fix w `users.ts:178-196` (OR po 3 kolumnach).
- `PricelistItem*.versionId`: kodowy guard kompletny (delete w tx pod lockiem + re-check);
  FK RESTRICT jako rekomendacja migracyjna, nie wykonana.
- `clients` sync: NULL-uj `clientId` w obu tabelach ofert w tx przed delete (snapshot denormalizowany zostaje).

## Fixy

- `logAudit(entityType,…,oldData, db=prisma)`: parametr tx, błąd nigdy nie rzuca (warn-only).
  Biznesowe w tx: `offers/crud.ts` (2), `production.ts` PUT-batch/single/delete; security-trail revoke
  w tx (`shares.ts` 2×). Poza scopem (follow-up): POST production, rury/studnie crud, orders crud,
  `studnieCrud.ts:1178`.
- Revoke shares atomowe (delete+audit+odczyt w tx). Create post-commit + await (brak phantom).

## Bramy (FACT)

- Nowe: `auditAtomicity` 5/5 (rollback→brak audytu, revoke atomowe), shares 4/4, users+clientsIdor 20/20,
  pricelist+auditIntegrity 18/18.
- `test:quick:lite`: 367 suit / 3913 PASS, 5 skip. `typecheck`, `lint`, `version:check` — GREEN.

## Decyzja bramki

E3: SUCCESS. STOP — E4 (AVR iteracje, confirm destrukcji, popup-rabat, UUID, offer_number) wymaga GO.
