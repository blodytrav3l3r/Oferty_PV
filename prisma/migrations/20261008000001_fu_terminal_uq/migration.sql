-- Opieka nad ofertą (P5.1): enforcement terminalności na poziomie bazy.
-- Max 1 wpis terminalny (WON / LOST_* / ABANDONED) na ofertę; dowolnie wiele
-- OPEN. Application pre-check (szybki 409) zostaje, to jest rozstrzygnięcie
-- wyścigu dwóch równoległych POST (check-przed-tx przepuszcza oba).
-- Partial index: niewidzialny dla `prisma migrate diff` (silnik nie modeluje
-- WHERE w indeksach) — baseline.test.ts pozostaje zielony. IF NOT EXISTS dla
-- baz legacy po ręcznej aplikacji.
CREATE UNIQUE INDEX IF NOT EXISTS "uq_fu_terminal_per_offer"
ON "offer_follow_ups"("offerKind", "offerId")
WHERE "outcome" IN ('WON', 'LOST_COMPETITION', 'LOST_OTHER', 'ABANDONED');
