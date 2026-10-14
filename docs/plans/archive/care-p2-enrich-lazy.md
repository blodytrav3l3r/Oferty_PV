# CARE P2.2 — leniwe wzbogacanie strony (deferred enrich)

Decyzja z pomiaru (nie opinii): sort to ~3 ms, enrich JSON ~60 ms ze 105 ms
data query na 20k. R1 (bucket-split) i indeksy pokrywające ODRZUCONE pomiarem:

- `ORDER BY` pełnego zbioru: 105 ms → 102 ms bez sortu (LIMIT zostaje).
- `data=NULL`: 105 ms → 44 ms. Wniosek: cel to enrich, nie sort.
- P0.4 odrzucił enrich przy 14% (wtedy dominował sort okna); po P1 (sort
  okna zniknął) enrich to 57% — okoliczności inne, wracamy.

## Projekt

Faza 1 (strona): skan + JOINy + `ORDER BY` + `LIMIT 51`, tylko skalary:
`offerKind/offerId/outcome/next/last/born/done/snoozed/careUpdatedAt/bucketWeight`.
Bez `users`, bez `json_extract`. Cursor i kolejność bez zmian.

Faza 2 (wzbogacanie 51 wierszy): 1 SELECT z pełnymi kolumnami
(number/client/clientNumber/owner/author/value/phone/invest/address/contact/email/note)
po parach `(kind,id)` (split per kind, `IN`), merge w JS po kluczu
zachowujący kolejność strony. Brak wierszy → brak fazy 2.

Kontrakt: DTO, cursor `[w,n,k,i]`, `totalCount`, scope, dedup, pauza —
bez zmian. `buildCareQueueView` nietknięte (pracuje na wierszach).

## Wynik (2026-10-14, 20k, scope=all)

`queue_data` 226 ms → 41 ms (5.5×), panel ~140 ms → ~100 ms.
R1 (bucket-split) i indeksy pokrywające ODRZUCONE pomiarem: sort to ~3 ms,
pełny skan+enrich ~100 ms — cel był enrich, nie sort.
Równoważność: istniejące suity (order/cursor/dedup/value) zielone bez zmian

- dump P1 (20k IDENTYCZNY) + test `buildCareEnrichQuery([],[])===null`.
  Uwaga: pomiary mają rozrzut do ~2× pod obciążeniem maszyny (pełne suity
  równolegle) — liczby to mediany 3–5 powtórzeń na spokojnym hoście.
  Ekstrapolacja 1M: panel ~7 s → ~2.5 s. Ocena przy 1M: 6/10.

## Weryfikacja

- `followUpQueueSql.test.ts` (order/cursor/dedup) + `followUpQueueValue.test.ts`
  (wartość z bloba — ćwiczy fazę 2) muszą przejść bez zmian.
- Nowy test: faza 2 zwraca te same pola co stara pojedyncza (porównanie
  na fixture z brakami: null clientNumber, totalPrice 0, brak users).
- Bench 20k: cel data ~105 ms → ~50 ms. NO-GO przy rozjeździe pól.
- Rollback: revert commita (1 plik serwisu + testy).
