-- Indexes for 10k pagination/search (P1-1/P1-5)
CREATE INDEX IF NOT EXISTS "idx_offersstud_updated" ON "offers_studnie_rel"("updatedAt");
CREATE INDEX IF NOT EXISTS "idx_offersstud_user_created_id" ON "offers_studnie_rel"("userId", "createdAt", "id");
CREATE INDEX IF NOT EXISTS "idx_offersstud_user_updated_id" ON "offers_studnie_rel"("userId", "updatedAt", "id");
CREATE INDEX IF NOT EXISTS "idx_offers_updated" ON "offers_rel"("updatedAt");
CREATE INDEX IF NOT EXISTS "idx_offers_user_created_id" ON "offers_rel"("userId", "createdAt", "id");
CREATE INDEX IF NOT EXISTS "idx_offers_user_updated_id" ON "offers_rel"("userId", "updatedAt", "id");
CREATE INDEX IF NOT EXISTS "idx_prod_updated" ON "production_orders_rel"("updatedAt");
CREATE INDEX IF NOT EXISTS "idx_prod_user_created_id" ON "production_orders_rel"("userId", "createdAt", "id");
CREATE INDEX IF NOT EXISTS "idx_prod_user_updated_id" ON "production_orders_rel"("userId", "updatedAt", "id");
