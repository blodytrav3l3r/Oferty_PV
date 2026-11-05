-- Maintain the care queue's latest-follow-up projection transactionally.
CREATE OR REPLACE FUNCTION sok_refresh_latest_followup(p_offer_kind TEXT, p_offer_id TEXT)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO "latest_followup" (
        "offerKind", "offerId", "followupId", "outcome", "nextContactAt",
        "contactedAt", "createdAt", "note"
    )
    SELECT "offerKind", "offerId", "id", "outcome", "nextContactAt",
           "contactedAt", "createdAt", "note"
    FROM "offer_follow_ups"
    WHERE "offerKind" = p_offer_kind AND "offerId" = p_offer_id
    ORDER BY "contactedAt" DESC NULLS LAST,
             "createdAt" DESC NULLS LAST,
             "id" DESC
    LIMIT 1
    ON CONFLICT ("offerKind", "offerId") DO UPDATE SET
        "followupId" = EXCLUDED."followupId",
        "outcome" = EXCLUDED."outcome",
        "nextContactAt" = EXCLUDED."nextContactAt",
        "contactedAt" = EXCLUDED."contactedAt",
        "createdAt" = EXCLUDED."createdAt",
        "note" = EXCLUDED."note"
    WHERE EXCLUDED."followupId" = "latest_followup"."followupId"
       OR (COALESCE(EXCLUDED."contactedAt", ''), COALESCE(EXCLUDED."createdAt", ''), EXCLUDED."followupId")
          > (COALESCE("latest_followup"."contactedAt", ''), COALESCE("latest_followup"."createdAt", ''), "latest_followup"."followupId");
END;
$$;

CREATE OR REPLACE FUNCTION sok_sync_latest_followup()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP IN ('UPDATE', 'DELETE') THEN
        DELETE FROM "latest_followup"
        WHERE "offerKind" = OLD."offerKind"
          AND "offerId" = OLD."offerId"
          AND "followupId" = OLD."id";
        PERFORM sok_refresh_latest_followup(OLD."offerKind", OLD."offerId");
    END IF;
    IF TG_OP IN ('INSERT', 'UPDATE') THEN
        PERFORM sok_refresh_latest_followup(NEW."offerKind", NEW."offerId");
    END IF;
    RETURN NULL;
END;
$$;

CREATE TRIGGER "trg_fu_latest_sync"
AFTER INSERT OR UPDATE OR DELETE ON "offer_follow_ups"
FOR EACH ROW EXECUTE FUNCTION sok_sync_latest_followup();

CREATE OR REPLACE FUNCTION sok_remove_latest_followup_for_offer()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    DELETE FROM "latest_followup"
    WHERE "offerKind" = TG_ARGV[0] AND "offerId" = OLD."id";
    RETURN NULL;
END;
$$;

CREATE TRIGGER "trg_offers_latest_delete"
AFTER DELETE ON "offers_rel"
FOR EACH ROW EXECUTE FUNCTION sok_remove_latest_followup_for_offer('rury');

CREATE TRIGGER "trg_offers_studnie_latest_delete"
AFTER DELETE ON "offers_studnie_rel"
FOR EACH ROW EXECUTE FUNCTION sok_remove_latest_followup_for_offer('studnie');
