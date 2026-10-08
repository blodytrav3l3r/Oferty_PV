-- Opieka nad oferta (P0.2): historia kontaktow follow-up, append-only.
-- Jedna tabela dla rury+studnie (offerKind+offerId, walidacja istnienia oferty
-- i ownership w API — brak polimorficznego FK). Enumy Prisma = TEXT w SQLite.
-- Daty String ISO-8601 UTC (konwencja projektu). Bez backfillu (nowa tabela).
-- Wygenerowane przez `prisma migrate diff`, drift 0 weryfikuje baseline.test.ts.

-- CreateTable
CREATE TABLE "offer_follow_ups" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "offerKind" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TEXT,
    "contactedAt" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "durationMin" INTEGER,
    "note" TEXT,
    "nextContactAt" TEXT,
    "outcome" TEXT NOT NULL DEFAULT 'OPEN',
    "loseReason" TEXT,
    "competitor" TEXT,
    "competitorPrice" REAL
);

-- CreateIndex
CREATE INDEX "idx_followups_offer_contacted" ON "offer_follow_ups"("offerKind", "offerId", "contactedAt");

-- CreateIndex
CREATE INDEX "idx_followups_user_next" ON "offer_follow_ups"("createdByUserId", "nextContactAt");
