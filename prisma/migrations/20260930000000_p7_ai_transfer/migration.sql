-- P7 AI/ML Transfer Center: historia eksportów/importów (.sokml) + idempotencja.
-- Recznie z `prisma migrate diff` (migrate dev zada resetu lokalnej DB z powodu
-- driftu FTS — poza zakresem, dane lokalne zostaja). Dev DB sync przez `db push`.
-- CreateTable
CREATE TABLE "AiTransfer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "transferId" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "packageFingerprint" TEXT NOT NULL,
    "manifestFingerprint" TEXT,
    "modelVersion" TEXT,
    "modelFingerprint" TEXT,
    "datasetFingerprint" TEXT,
    "sourceSokVersion" TEXT NOT NULL,
    "targetSokVersion" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "result" TEXT,
    "userId" TEXT,
    "createdAt" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "AiTransfer_transferId_key" ON "AiTransfer"("transferId");

-- CreateIndex
CREATE INDEX "idx_aitransfer_packagefp" ON "AiTransfer"("packageFingerprint");

-- CreateIndex
CREATE INDEX "idx_aitransfer_created" ON "AiTransfer"("createdAt");
