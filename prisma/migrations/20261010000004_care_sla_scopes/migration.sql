-- P4 opieka: progi SLA per zespół / per user z fallbackiem do globalnych (ADR-016).
-- Addytywne, IF NOT EXISTS: bezpieczne na bazach z driftem i legacy db push.
CREATE TABLE IF NOT EXISTS "care_sla_scopes" (
    "scopeType" TEXT NOT NULL,
    "scopeId" TEXT NOT NULL,
    "firstContactH" INTEGER NOT NULL,
    "staleD" INTEGER NOT NULL,
    "escalationH" INTEGER NOT NULL,
    "updatedBy" TEXT,
    "updatedAt" TEXT,
    CONSTRAINT "care_sla_scopes_pkey" PRIMARY KEY ("scopeType", "scopeId")
);
CREATE INDEX IF NOT EXISTS "idx_caresla_scope" ON "care_sla_scopes"("scopeType", "scopeId");
