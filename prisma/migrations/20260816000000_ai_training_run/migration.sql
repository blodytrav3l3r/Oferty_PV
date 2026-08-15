-- CreateTable
CREATE TABLE "AiTrainingRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "startedAt" TEXT NOT NULL,
    "finishedAt" TEXT,
    "status" TEXT NOT NULL,
    "datasetSize" INTEGER NOT NULL,
    "trainSize" INTEGER NOT NULL,
    "validationSize" INTEGER NOT NULL,
    "testSize" INTEGER NOT NULL,
    "featureVersion" TEXT NOT NULL,
    "seed" INTEGER NOT NULL,
    "candidateModelVersion" TEXT,
    "comparedAgainstVersion" TEXT,
    "datasetStartAt" TEXT,
    "datasetEndAt" TEXT,
    "datasetFingerprint" TEXT,
    "metrics" TEXT,
    "baselineAccuracy" REAL,
    "positiveRate" REAL,
    "deployed" BOOLEAN NOT NULL,
    "deploymentReason" TEXT,
    "error" TEXT
);

-- AlterTable
ALTER TABLE "AiModel" ADD COLUMN "state" TEXT;
ALTER TABLE "AiModel" ADD COLUMN "seed" INTEGER;
ALTER TABLE "AiModel" ADD COLUMN "featureDistributions" TEXT;

-- CreateIndex
CREATE INDEX "idx_aitrainingrun_started" ON "AiTrainingRun"("startedAt");

-- CreateIndex
CREATE INDEX "idx_aitrainingrun_status" ON "AiTrainingRun"("status");

-- CreateIndex
CREATE INDEX "idx_aimodel_state" ON "AiModel"("state");