-- P0-A: finalny numer produkcyjny jako kolumna + UNIQUE(userId, productionNumber).
-- Wczesniej numer zyl wylacznie w JSON data ($.productionOrderNumber) — bez
-- obrony DB przed dublami. NULL-e nie koliduja w SQLite UNIQUE (sa rozne).
ALTER TABLE "production_orders_rel" ADD COLUMN "productionNumber" TEXT;

-- Backfill z istniejacych blobow JSON.
UPDATE "production_orders_rel"
SET "productionNumber" = json_extract("data", '$.productionOrderNumber')
WHERE "productionNumber" IS NULL
  AND json_extract("data", '$.productionOrderNumber') IS NOT NULL;

-- Ostatnia linia obrony: ten sam uzytkownik nie zapisze dwoch zlecen
-- z tym samym finalnym numerem. P2002 -> 409 (serwer) + retry safety net.
CREATE UNIQUE INDEX IF NOT EXISTS "uq_prod_user_number"
    ON "production_orders_rel"("userId", "productionNumber");
