-- I-004: numer oferty unikalny globalnie per tabela (rury/studnie osobno).
-- SQLite dopuszcza wiele NULL w indeksie UNIQUE — NULL = brak numeru.
-- Historyczne '' (draft bez numeru) normalizujemy do NULL przed założeniem indeksu.
UPDATE "offers_rel" SET "offer_number" = NULL WHERE "offer_number" = '';
UPDATE "offers_studnie_rel" SET "offer_number" = NULL WHERE "offer_number" = '';

-- Zwykłe indeksy zastąpione indeksem unikalnym (ta sama selektywność).
DROP INDEX IF EXISTS "idx_offers_number";
DROP INDEX IF EXISTS "idx_offersstud_number";

CREATE UNIQUE INDEX "uq_offers_number" ON "offers_rel"("offer_number");
CREATE UNIQUE INDEX "uq_offersstud_number" ON "offers_studnie_rel"("offer_number");
