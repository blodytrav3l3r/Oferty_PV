-- Add wellCount for light list API (P0-D)
ALTER TABLE "offers_studnie_rel" ADD COLUMN "wellCount" INTEGER DEFAULT 0;
CREATE INDEX IF NOT EXISTS "idx_offersstud_wellcount" ON "offers_studnie_rel"("wellCount");
-- Backfill z data JSON (wells array length)
UPDATE "offers_studnie_rel" SET "wellCount" = CAST(json_array_length(CASE WHEN json_valid("data") THEN json_extract("data", '$.wells') ELSE '[]' END) AS INTEGER) WHERE "wellCount" = 0 OR "wellCount" IS NULL;
