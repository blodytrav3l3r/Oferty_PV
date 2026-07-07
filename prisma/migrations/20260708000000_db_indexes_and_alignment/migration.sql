-- Migracja: db_indexes_and_alignment
-- Data: 2026-07-08
-- Opis: Dodanie brakujących indeksów na kluczowych kolumnach tabel ofert i zamówień.
--       Wyrównanie indeksu schema ↔ migracja init (audit_logs).
--
-- Kompatybilność: BACKWARD COMPATIBLE (tylko CREATE INDEX IF NOT EXISTS).
-- Ryzyko: niskie. Indeksy tworzone są w tle przez SQLite; wydłużają zapis,
--         ale poprawiają wydajność odczytu.

-- ─── audit_logs createdAt (wyrównanie schema ↔ migracja init) ───
CREATE INDEX IF NOT EXISTS "idx_audit_created_at" ON "audit_logs"("createdAt");

-- ─── offers_rel (oferty rur) ───
CREATE INDEX IF NOT EXISTS "idx_offers_rel_userId" ON "offers_rel"("userId");
CREATE INDEX IF NOT EXISTS "idx_offers_rel_clientId" ON "offers_rel"("clientId");
CREATE INDEX IF NOT EXISTS "idx_offers_rel_state" ON "offers_rel"("state");

-- ─── offers_studnie_rel (oferty studni) ───
CREATE INDEX IF NOT EXISTS "idx_offers_studnie_rel_userId" ON "offers_studnie_rel"("userId");
CREATE INDEX IF NOT EXISTS "idx_offers_studnie_rel_clientId" ON "offers_studnie_rel"("clientId");
CREATE INDEX IF NOT EXISTS "idx_offers_studnie_rel_state" ON "offers_studnie_rel"("state");

-- ─── offer_items_rel (pozycje ofert rur) ───
CREATE INDEX IF NOT EXISTS "idx_offer_items_rel_offerId" ON "offer_items_rel"("offerId");
CREATE INDEX IF NOT EXISTS "idx_offer_items_rel_productId" ON "offer_items_rel"("productId");

-- ─── offer_studnie_items_rel (pozycje ofert studni) ───
CREATE INDEX IF NOT EXISTS "idx_offer_studnie_items_rel_offerId" ON "offer_studnie_items_rel"("offerId");
CREATE INDEX IF NOT EXISTS "idx_offer_studnie_items_rel_productId" ON "offer_studnie_items_rel"("productId");

-- ─── orders_rury_rel (zamówienia rur) ───
CREATE INDEX IF NOT EXISTS "idx_orders_rury_rel_offerId" ON "orders_rury_rel"("offerId");
CREATE INDEX IF NOT EXISTS "idx_orders_rury_rel_userId" ON "orders_rury_rel"("userId");

-- ─── orders_studnie_rel (zamówienia studni) ───
CREATE INDEX IF NOT EXISTS "idx_orders_studnie_rel_offerId" ON "orders_studnie_rel"("offerStudnieId");
CREATE INDEX IF NOT EXISTS "idx_orders_studnie_rel_userId" ON "orders_studnie_rel"("userId");
