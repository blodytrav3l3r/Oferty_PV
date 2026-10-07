-- Idle timeout sesji (1h bezczynnosci, absolute 7d): kolumna lastActivity.
-- Backfill dla istniejacych sesji = createdAt; nowe sesje stawiaja obie kolumny.
-- Bez nowego indeksu (celowo): sesji jest max 10 na usera, pelny skan tabeli
-- w leniwej czystce jest pomijalny, a schemat zostaje 1:1 z migracjami (drift 0).
ALTER TABLE "sessions" ADD COLUMN "lastActivity" BIGINT;
UPDATE "sessions" SET "lastActivity" = "createdAt" WHERE "lastActivity" IS NULL;
