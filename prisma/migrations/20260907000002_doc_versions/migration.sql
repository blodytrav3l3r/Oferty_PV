-- P0-D2: licznik optimistic lockingu dla zamowien i ofert.
-- UPDATE ... SET version = version + 1 WHERE id = ? AND version = ?
-- 0 wierszy -> 409 VERSION_CONFLICT (jednoznaczne, bez timestampow).
ALTER TABLE "orders_studnie_rel" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "orders_rury_rel" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "offers_rel" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "offers_studnie_rel" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
