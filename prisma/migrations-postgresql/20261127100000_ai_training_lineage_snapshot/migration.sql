ALTER TABLE "AiModel"
ADD COLUMN "lineageSnapshot" TEXT;

ALTER TABLE "AiTrainingRun"
ADD COLUMN "lineageSnapshot" TEXT;
