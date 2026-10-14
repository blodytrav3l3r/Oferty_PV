-- P1 opieka: materializacja latest follow-up (additive, bez resetu).
-- Cache reguły latest (contactedAt DESC, createdAt DESC, id DESC — ta sama
-- co CTE w careService.ts) — triggery na offer_follow_ups + backfill.
-- Rerun bezpieczny: IF NOT EXISTS / DROP+CREATE triggerów / OR IGNORE.
-- Triggery niewidzialne dla `prisma migrate diff` (jak partial UQ).
CREATE TABLE IF NOT EXISTS "latest_followup" (
    "offerKind" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "followupId" TEXT NOT NULL,
    "outcome" TEXT,
    "nextContactAt" TEXT,
    "contactedAt" TEXT,
    "createdAt" TEXT,
    "note" TEXT,
    CONSTRAINT "latest_followup_pkey" PRIMARY KEY ("offerKind", "offerId")
);
-- Recompute top-1 per klucz: poprawne dla INSERT/UPDATE/DELETE,
-- w tym DELETE-latest (promocja next) i UPDATE klucza (OLD+NEW).
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
-- Sieroty po DELETE oferty (brak FK): cache nie rośnie w nieskończoność.
DROP TRIGGER IF EXISTS "trg_offers_latest_ad";
CREATE TRIGGER "trg_offers_latest_ad" AFTER DELETE ON "offers_rel" BEGIN
    DELETE FROM "latest_followup" WHERE "offerKind" = 'rury' AND "offerId" = OLD."id";
END;
DROP TRIGGER IF EXISTS "trg_offersstud_latest_ad";
CREATE TRIGGER "trg_offersstud_latest_ad" AFTER DELETE ON "offers_studnie_rel" BEGIN
    DELETE FROM "latest_followup" WHERE "offerKind" = 'studnie' AND "offerId" = OLD."id";
END;
-- Backfill: top-1 per grupa regułą latest (ROW_NUMBER, nie MAX —
-- późniejszy zapis z wcześniejszą datą + tie id DESC). OR IGNORE = rerun.
INSERT OR IGNORE INTO "latest_followup" ("offerKind", "offerId", "followupId", "outcome", "nextContactAt", "contactedAt", "createdAt", "note")
    SELECT "offerKind", "offerId", "id", "outcome", "nextContactAt", "contactedAt", "createdAt", "note" FROM (
        SELECT "offerKind", "offerId", "id", "outcome", "nextContactAt", "contactedAt", "createdAt", "note",
            ROW_NUMBER() OVER (PARTITION BY "offerKind", "offerId" ORDER BY "contactedAt" DESC, "createdAt" DESC, "id" DESC) AS "rn"
        FROM "offer_follow_ups"
    ) WHERE "rn" = 1;
