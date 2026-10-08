-- Opieka nad oferta: cykle obslugi (reopen startuje nowy cykl).
-- Historia append-only zostaje; limit terminalnosci przeniesiony z calej
-- oferty (uq_fu_terminal_per_offer) na pojedynczy cykl
-- (uq_fu_terminal_per_cycle). Semantyka: max 1 wynik terminalny
-- (WON / LOST_* / ABANDONED) na cykl, dowolnie wiele OPEN.
-- Backfill: cycle = liczba wczesniejszych terminalnych wierszy tej oferty
-- w kolejnosci (contactedAt, createdAt, id). Dla baz zalozonych po starej
-- migracji (max 1 terminal na oferte) backfill daje 0/1 i nic nie zmienia.
ALTER TABLE "offer_follow_ups" ADD COLUMN "cycle" INTEGER NOT NULL DEFAULT 0;

UPDATE "offer_follow_ups" AS t SET "cycle" = (
  SELECT COUNT(*) FROM "offer_follow_ups" f
  WHERE f."offerKind" = t."offerKind"
    AND f."offerId" = t."offerId"
    AND f."outcome" IN ('WON', 'LOST_COMPETITION', 'LOST_OTHER', 'ABANDONED')
    AND (
      f."contactedAt" < t."contactedAt"
      OR (f."contactedAt" = t."contactedAt" AND COALESCE(f."createdAt", '') < COALESCE(t."createdAt", ''))
      OR (f."contactedAt" = t."contactedAt" AND COALESCE(f."createdAt", '') = COALESCE(t."createdAt", '') AND f."id" < t."id")
    )
);

DROP INDEX IF EXISTS "uq_fu_terminal_per_offer";

CREATE UNIQUE INDEX IF NOT EXISTS "uq_fu_terminal_per_cycle"
ON "offer_follow_ups"("offerKind", "offerId", "cycle")
WHERE "outcome" IN ('WON', 'LOST_COMPETITION', 'LOST_OTHER', 'ABANDONED');
