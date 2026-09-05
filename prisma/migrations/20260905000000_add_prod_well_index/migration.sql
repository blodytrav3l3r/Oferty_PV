-- Lekkie indeksy pod GET /production/index i filtry wellId (Faza 1 PZ, 2026-09-05)
CREATE INDEX IF NOT EXISTS "idx_prod_well" ON "production_orders_rel"("wellId");
CREATE INDEX IF NOT EXISTS "idx_prod_well_elem" ON "production_orders_rel"("wellId", "elementIndex");
