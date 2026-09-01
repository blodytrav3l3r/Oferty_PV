-- Add totalPrice for light list API (E)
ALTER TABLE "offers_studnie_rel" ADD COLUMN "totalPrice" REAL DEFAULT 0;
CREATE INDEX IF NOT EXISTS "idx_offersstud_totalprice" ON "offers_studnie_rel"("totalPrice");
-- Backfill from data JSON (totalPrice or totalBrutto)
UPDATE "offers_studnie_rel" SET "totalPrice" = CAST(COALESCE(json_extract("data", '$.totalPrice'), json_extract("data", '$.totalBrutto'), 0) AS REAL) WHERE "totalPrice" = 0 OR "totalPrice" IS NULL;

