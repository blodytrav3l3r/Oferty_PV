-- P0-D: licznik optimistic lockingu dla zlecen produkcyjnych.
-- UPDATE ... SET version = version + 1 WHERE id = ? AND version = ?
-- 0 wierszy -> 409 VERSION_CONFLICT (jednoznaczne, bez timestampow).
ALTER TABLE "production_orders_rel" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
