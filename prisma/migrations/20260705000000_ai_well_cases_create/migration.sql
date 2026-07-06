-- =============================================================================
-- Migracja: ai_well_cases_create
-- Tabela ai_well_cases istnieje w schema.prisma i w developerskiej bazie (push),
-- ale brak jej w historii migracji - ta migracja tworzy ja dla świeżych checkoutów.
-- =============================================================================

CREATE TABLE IF NOT EXISTS "ai_well_cases" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dn" INTEGER NOT NULL,
    "totalHeightMm" INTEGER NOT NULL,
    "wellType" TEXT NOT NULL,
    "warehouse" TEXT,
    "producer" TEXT,
    "kinetType" TEXT,
    "inflowCount" INTEGER,
    "loadClass" TEXT,
    "manholeClass" TEXT,
    "coverType" TEXT,
    "componentSeq" TEXT NOT NULL,
    "diameterProfile" TEXT NOT NULL,
    "transitions" TEXT NOT NULL,
    "configHash" TEXT,
    "userId" TEXT,
    "configSource" TEXT,
    "acceptanceCount" INTEGER NOT NULL DEFAULT 1,
    "confidenceScore" REAL,
    "firstAcceptedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastAcceptedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isArchived" BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS "idx_well_cases_dn_type"
ON "ai_well_cases"("dn", "wellType");
CREATE INDEX IF NOT EXISTS "idx_well_cases_warehouse"
ON "ai_well_cases"("warehouse");
CREATE INDEX IF NOT EXISTS "idx_well_cases_dn_height"
ON "ai_well_cases"("dn", "totalHeightMm");
CREATE INDEX IF NOT EXISTS "idx_well_cases_acceptance"
ON "ai_well_cases"("acceptanceCount");
