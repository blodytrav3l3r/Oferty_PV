-- Opieka P2-fix: max 1 nieprzeczytane powiadomienie na (user, oferta, typ).
-- Sync check-then-insert ściga się przy równoległych pollingach — wyścig
-- rozstrzyga constraint (jak uq_fu_terminal_per_cycle), nie aplikacja.
-- Partial index, niewidzialny dla `prisma migrate diff` (precedens: cykle).
CREATE UNIQUE INDEX IF NOT EXISTS "uq_carenotif_unread_per_offer"
ON "care_notifications"("userId", "offerKind", "offerId", "type")
WHERE "readAt" IS NULL;
