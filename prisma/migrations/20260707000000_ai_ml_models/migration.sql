-- =============================================================================
-- Migracja: ai_ml_models
-- Dodanie tabel AiFeature (Feature Store), AiModel (Model Registry), AiEvaluation
-- (Samoocena). Caly system dziala na surowych danych telemetry istniejacych
-- w bazie - nie modyfikuje solvera JS, a jedynie uczy sie na jego decyzjach.
-- =============================================================================

-- ─── AiFeature: wektor cech per konfiguracja ───
CREATE TABLE IF NOT EXISTS "AiFeature" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "telemetryId" TEXT,
    "dn" INTEGER NOT NULL,
    "heightMm" INTEGER NOT NULL,
    "warehouse" TEXT NOT NULL,
    "wellType" TEXT NOT NULL,
    "hasReduction" BOOLEAN NOT NULL DEFAULT false,
    "hasPsiaBuda" BOOLEAN NOT NULL DEFAULT false,
    "hasStyczna" BOOLEAN NOT NULL DEFAULT false,
    "ringCount" INTEGER NOT NULL DEFAULT 0,
    "bottomType" TEXT NOT NULL,
    "topType" TEXT NOT NULL,
    "connectionCount" INTEGER NOT NULL DEFAULT 0,
    "transitionsAboveDennica" INTEGER NOT NULL DEFAULT 0,
    "totalPrice" REAL NOT NULL DEFAULT 0,
    "totalWeight" REAL NOT NULL DEFAULT 0,
    "ringVariety" REAL NOT NULL DEFAULT 0,
    "season" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "reward" REAL NOT NULL DEFAULT 0,
    "decisionMs" INTEGER,
    "createdAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_aifeatures_key" ON "AiFeature"("dn", "warehouse", "wellType");
CREATE INDEX IF NOT EXISTS "idx_aifeatures_label" ON "AiFeature"("label");
CREATE INDEX IF NOT EXISTS "idx_aifeatures_created" ON "AiFeature"("createdAt");

-- ─── AiModel: wytrenowany model (Model Registry) ───
CREATE TABLE IF NOT EXISTS "AiModel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "version" TEXT NOT NULL UNIQUE,
    "weights" TEXT NOT NULL,
    "bias" REAL NOT NULL,
    "metrics" TEXT NOT NULL,
    "features" TEXT NOT NULL,
    "featureMins" TEXT NOT NULL,
    "featureMaxs" TEXT NOT NULL,
    "trainingRows" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_aimodel_active" ON "AiModel"("active");
CREATE INDEX IF NOT EXISTS "idx_aimodel_created" ON "AiModel"("createdAt");

-- TYLKO JEDEN MODEL MOZE BYC AKTYWNY (unique partial index - emulateowany triggerem)
CREATE UNIQUE INDEX IF NOT EXISTS "idx_aimodel_one_active" ON "AiModel"("active") WHERE "active" = true;

-- ─── AiEvaluation: metryki dzienne (A/B testing, rollback) ───
CREATE TABLE IF NOT EXISTS "AiEvaluation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "modelVersion" TEXT NOT NULL,
    "acceptance" REAL NOT NULL DEFAULT 0,
    "decisionMsAvg" REAL NOT NULL DEFAULT 0,
    "rewardsAvg" REAL NOT NULL DEFAULT 0,
    "totalDecisions" INTEGER NOT NULL DEFAULT 0,
    "triggeredAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_aieval_model" ON "AiEvaluation"("modelVersion");
CREATE INDEX IF NOT EXISTS "idx_aieval_triggered" ON "AiEvaluation"("triggeredAt");

-- =============================================================================
-- FAZA 6: Reward Log
-- =============================================================================
CREATE TABLE IF NOT EXISTS "aiRewardLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "wellId" TEXT NOT NULL DEFAULT '',
    "dn" INTEGER NOT NULL DEFAULT 0,
    "action" TEXT NOT NULL DEFAULT 'ACCEPT',
    "reward" REAL NOT NULL DEFAULT 0,
    "scoreBefore" REAL,
    "scoreAfter" REAL,
    "wasAiRanked" INTEGER NOT NULL DEFAULT 0,
    "configSnapshot" TEXT,
    "createdAt" TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "idx_reward_user" ON "aiRewardLog"("userId");
CREATE INDEX IF NOT EXISTS "idx_reward_action" ON "aiRewardLog"("action");
CREATE INDEX IF NOT EXISTS "idx_reward_created" ON "aiRewardLog"("createdAt");

ALTER TABLE users ADD COLUMN "totalReward" REAL DEFAULT 0;
