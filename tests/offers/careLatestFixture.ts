/*
 * tests/offers/careLatestFixture.ts
 * P1: DDL latest_followup + triggery dla fixture'ów :memory:.
 * Odczyt careService (kolejka/summary/notif) robi LEFT JOIN latest_followup —
 * bez tabeli fixture'y padają. Triggery utrzymują cache przy INSERTach
 * fixture'a; backfill kryje wiersze wstawione przed exec.
 */
import type { DatabaseSync } from 'node:sqlite';

export const LATEST_FOLLOWUP_TEST_DDL = `CREATE TABLE IF NOT EXISTS "latest_followup" ("offerKind" TEXT NOT NULL, "offerId" TEXT NOT NULL, "followupId" TEXT NOT NULL, "outcome" TEXT, "nextContactAt" TEXT, "contactedAt" TEXT, "createdAt" TEXT, "note" TEXT,
    CONSTRAINT "latest_followup_pkey" PRIMARY KEY ("offerKind", "offerId"));
DROP TRIGGER IF EXISTS "trg_fu_latest_ai";
CREATE TRIGGER "trg_fu_latest_ai" AFTER INSERT ON "offer_follow_ups" BEGIN
    DELETE FROM "latest_followup" WHERE "offerKind" = NEW."offerKind" AND "offerId" = NEW."offerId";
    INSERT INTO "latest_followup" ("offerKind", "offerId", "followupId", "outcome", "nextContactAt", "contactedAt", "createdAt", "note")
        SELECT "offerKind", "offerId", "id", "outcome", "nextContactAt", "contactedAt", "createdAt", "note" FROM "offer_follow_ups"
        WHERE "offerKind" = NEW."offerKind" AND "offerId" = NEW."offerId"
        ORDER BY "contactedAt" DESC, "createdAt" DESC, "id" DESC LIMIT 1;
END;
DROP TRIGGER IF EXISTS "trg_fu_latest_au";
CREATE TRIGGER "trg_fu_latest_au" AFTER UPDATE ON "offer_follow_ups" BEGIN
    DELETE FROM "latest_followup" WHERE ("offerKind" = NEW."offerKind" AND "offerId" = NEW."offerId") OR ("offerKind" = OLD."offerKind" AND "offerId" = OLD."offerId");
    INSERT INTO "latest_followup" ("offerKind", "offerId", "followupId", "outcome", "nextContactAt", "contactedAt", "createdAt", "note")
        SELECT "offerKind", "offerId", "id", "outcome", "nextContactAt", "contactedAt", "createdAt", "note" FROM "offer_follow_ups"
        WHERE "offerKind" = NEW."offerKind" AND "offerId" = NEW."offerId"
        ORDER BY "contactedAt" DESC, "createdAt" DESC, "id" DESC LIMIT 1;
    INSERT INTO "latest_followup" ("offerKind", "offerId", "followupId", "outcome", "nextContactAt", "contactedAt", "createdAt", "note")
        SELECT "offerKind", "offerId", "id", "outcome", "nextContactAt", "contactedAt", "createdAt", "note" FROM "offer_follow_ups"
        WHERE ("offerKind" = OLD."offerKind" AND "offerId" = OLD."offerId")
            AND (OLD."offerKind" <> NEW."offerKind" OR OLD."offerId" <> NEW."offerId")
        ORDER BY "contactedAt" DESC, "createdAt" DESC, "id" DESC LIMIT 1;
END;
DROP TRIGGER IF EXISTS "trg_fu_latest_ad";
CREATE TRIGGER "trg_fu_latest_ad" AFTER DELETE ON "offer_follow_ups" BEGIN
    DELETE FROM "latest_followup" WHERE "offerKind" = OLD."offerKind" AND "offerId" = OLD."offerId";
    INSERT INTO "latest_followup" ("offerKind", "offerId", "followupId", "outcome", "nextContactAt", "contactedAt", "createdAt", "note")
        SELECT "offerKind", "offerId", "id", "outcome", "nextContactAt", "contactedAt", "createdAt", "note" FROM "offer_follow_ups"
        WHERE "offerKind" = OLD."offerKind" AND "offerId" = OLD."offerId"
        ORDER BY "contactedAt" DESC, "createdAt" DESC, "id" DESC LIMIT 1;
END;
INSERT OR IGNORE INTO "latest_followup" ("offerKind", "offerId", "followupId", "outcome", "nextContactAt", "contactedAt", "createdAt", "note")
    SELECT "offerKind", "offerId", "id", "outcome", "nextContactAt", "contactedAt", "createdAt", "note" FROM (
        SELECT "offerKind", "offerId", "id", "outcome", "nextContactAt", "contactedAt", "createdAt", "note",
            ROW_NUMBER() OVER (PARTITION BY "offerKind", "offerId" ORDER BY "contactedAt" DESC, "createdAt" DESC, "id" DESC) AS "rn"
        FROM "offer_follow_ups"
    ) WHERE "rn" = 1;`;

/**
 * Full setup: dopina brakującą kolumnę `note` w offer_follow_ups
 * (starsze fixture'y jej nie mają, a triggery/backfill ją czytają),
 * potem DDL powyżej. Idempotentne.
 */
export function ensureLatestFollowupFixture(db: DatabaseSync): void {
    try {
        db.exec('ALTER TABLE offer_follow_ups ADD COLUMN note TEXT');
    } catch {
        // Kolumna już istnieje — nic do roboty.
    }
    db.exec(LATEST_FOLLOWUP_TEST_DDL);
}
