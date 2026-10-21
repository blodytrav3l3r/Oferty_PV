-- S4/F2: indeksy na pieczątce wersji cennika w 4 tabelach ofert/zamówień.
-- Plain TEXT bez FK (świadoma decyzja) — tylko przyspiesza countUsage i filtry.
-- Idempotentne: bezpieczne także po ręcznym utworzeniu indeksu.

CREATE INDEX IF NOT EXISTS "idx_offers_pricelistversion" ON "offers_rel"("pricelistVersionId");
CREATE INDEX IF NOT EXISTS "idx_offersstud_pricelistversion" ON "offers_studnie_rel"("pricelistVersionId");
CREATE INDEX IF NOT EXISTS "idx_ordstud_pricelistversion" ON "orders_studnie_rel"("pricelistVersionId");
CREATE INDEX IF NOT EXISTS "idx_ordrury_pricelistversion" ON "orders_rury_rel"("pricelistVersionId");
