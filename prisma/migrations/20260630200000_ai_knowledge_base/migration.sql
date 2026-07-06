-- =============================================================================
-- Migracja: ai_knowledge_base
-- Dodanie tabel dla bazy wiedzy i rekomendacji AI.
-- W pełni pasywne — solver pozostaje niezmieniony.
-- =============================================================================

CREATE TABLE IF NOT EXISTS "ai_knowledge_base" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patternType" TEXT NOT NULL,
    "patternKey" TEXT NOT NULL,
    "dn" TEXT,
    "context" TEXT,
    "description" TEXT,
    "recommendation" TEXT,
    "hitCount" INTEGER NOT NULL DEFAULT 0,
    "confidence" REAL NOT NULL DEFAULT 0.0,
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "rejectionCount" INTEGER NOT NULL DEFAULT 0,
    "firstDetectedAt" TEXT,
    "lastHitAt" TEXT,
    "lastUpdatedAt" TEXT,
    "changeHistory" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "schemaVersion" TEXT,
    "generatedBy" TEXT
);

CREATE TABLE IF NOT EXISTS "ai_recommendations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patternType" TEXT NOT NULL,
    "patternKey" TEXT NOT NULL,
    "dn" TEXT,
    "wellId" TEXT,
    "score" REAL NOT NULL DEFAULT 0.0,
    "confidence" REAL NOT NULL DEFAULT 0.0,
    "payload" TEXT,
    "wasApplied" BOOLEAN NOT NULL DEFAULT false,
    "wasAccepted" BOOLEAN NOT NULL DEFAULT false,
    "wasRejected" BOOLEAN NOT NULL DEFAULT false,
    "generatedAt" TEXT,
    "decidedAt" TEXT,
    "decidedBy" TEXT
);

-- Indeksy
CREATE INDEX IF NOT EXISTS "idx_kb_pattern_type" ON "ai_knowledge_base"("patternType");
CREATE INDEX IF NOT EXISTS "idx_kb_dn" ON "ai_knowledge_base"("dn");
CREATE INDEX IF NOT EXISTS "idx_kb_pattern_key" ON "ai_knowledge_base"("patternKey");
CREATE INDEX IF NOT EXISTS "idx_kb_status" ON "ai_knowledge_base"("status");
CREATE INDEX IF NOT EXISTS "idx_kb_confidence" ON "ai_knowledge_base"("confidence");

CREATE INDEX IF NOT EXISTS "idx_recs_type" ON "ai_recommendations"("patternType");
CREATE INDEX IF NOT EXISTS "idx_recs_well" ON "ai_recommendations"("wellId");
CREATE INDEX IF NOT EXISTS "idx_recs_applied" ON "ai_recommendations"("wasApplied");
