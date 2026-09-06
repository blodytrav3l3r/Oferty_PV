-- P1-A: klucze idempotencji POST (name = endpoint + user key).
-- Klucz per (userId, endpoint, key); PENDING + reclaim po 5 min (crash),
-- DONE z odpowiedzią do replay przez 24 h. TTL sprzątany leniwie przy claimie.
CREATE TABLE IF NOT EXISTS "idempotency_keys" (
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "responseStatus" INTEGER,
    "responseBody" TEXT,
    "createdAt" TEXT NOT NULL,
    "expiresAt" TEXT NOT NULL,
    PRIMARY KEY ("userId", "endpoint", "key")
);
CREATE INDEX IF NOT EXISTS "idx_idempotency_expires" ON "idempotency_keys"("expiresAt");
