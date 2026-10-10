-- P1 opieka: stan pilnowania + konfiguracja SLA (additive, bez resetu).
-- IF NOT EXISTS: bezpieczne na bazach z driftem (FTS) i legacy db push.
CREATE TABLE IF NOT EXISTS "care_states" (
    "offerKind" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "snoozedUntil" TEXT,
    "doneAt" TEXT,
    "updatedBy" TEXT,
    "updatedAt" TEXT NOT NULL,
    CONSTRAINT "care_states_pkey" PRIMARY KEY ("offerKind", "offerId")
);
CREATE INDEX IF NOT EXISTS "idx_care_snooze" ON "care_states"("snoozedUntil");
CREATE INDEX IF NOT EXISTS "idx_care_done" ON "care_states"("doneAt");
CREATE TABLE IF NOT EXISTS "care_sla_config" (
    "id" TEXT NOT NULL,
    "firstContactH" INTEGER NOT NULL DEFAULT 24,
    "staleD" INTEGER NOT NULL DEFAULT 7,
    "escalationH" INTEGER NOT NULL DEFAULT 72,
    "updatedBy" TEXT,
    "updatedAt" TEXT,
    CONSTRAINT "care_sla_config_pkey" PRIMARY KEY ("id")
);
