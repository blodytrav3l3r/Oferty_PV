-- R3: znacznik edycji follow-up w miejscu do ETag panelu (markery a/b slepe na PUT).
-- Kolumna updatedAt (TEXT ISO-8601 UTC, konwencja projektu) + backfill
-- COALESCE(createdAt, contactedAt). Bez indeksu - mala tabela.
ALTER TABLE "offer_follow_ups" ADD COLUMN "updatedAt" TEXT;
UPDATE "offer_follow_ups" SET "updatedAt" = COALESCE("createdAt", "contactedAt") WHERE "updatedAt" IS NULL;
