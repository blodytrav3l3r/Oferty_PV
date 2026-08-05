-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_logs_well" ON "ai_telemetry_logs"("wellId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_logs_source_well" ON "ai_telemetry_logs"("solverSource", "wellId");
