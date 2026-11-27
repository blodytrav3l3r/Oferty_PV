CREATE TABLE "AiOperationalMetricBucket" (
    "processId" TEXT NOT NULL,
    "bucketDay" TIMESTAMPTZ(3) NOT NULL,
    "inferenceCount" INTEGER NOT NULL,
    "latencyHistogram" INTEGER[] NOT NULL,
    "predictionOutcomes" INTEGER[] NOT NULL,
    "rewardOutcomes" INTEGER[] NOT NULL,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AiOperationalMetricBucket_pkey" PRIMARY KEY ("processId", "bucketDay")
);

CREATE INDEX "idx_ai_operational_metrics_day"
    ON "AiOperationalMetricBucket"("bucketDay");
