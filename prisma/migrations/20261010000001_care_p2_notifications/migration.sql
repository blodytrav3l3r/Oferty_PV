-- P2 opieka: centrum powiadomień (additive, bez resetu).
-- IF NOT EXISTS: bezpieczne na bazach z driftem i legacy db push.
CREATE TABLE IF NOT EXISTS "care_notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "offerKind" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "readAt" TEXT,
    "createdAt" TEXT NOT NULL,
    CONSTRAINT "care_notifications_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "idx_carenotif_user_read" ON "care_notifications"("userId", "readAt", "createdAt");
CREATE INDEX IF NOT EXISTS "idx_carenotif_offer" ON "care_notifications"("offerKind", "offerId");
