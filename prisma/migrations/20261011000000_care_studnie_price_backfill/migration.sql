-- Backfill kolumny totalPrice ofert studni: zapis bez top-level totalPrice
-- (kształt FE: totalBrutto/totalNetto) lądował na 0, a kolejka opieki brała
-- kolumnę jako pierwszą (0,00 PLN mimo żywego totalBrutto w blobie).
-- Idempotentny: tylko wiersze 0/NULL z dodatnim totalBrutto w blobie.
UPDATE "offers_studnie_rel"
SET "totalPrice" = CAST(json_extract("data", '$.totalBrutto') AS REAL)
WHERE ("totalPrice" IS NULL OR "totalPrice" = 0)
  AND CAST(json_extract("data", '$.totalBrutto') AS REAL) > 0;
