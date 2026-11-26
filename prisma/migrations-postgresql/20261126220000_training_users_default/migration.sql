-- Preserve the current population on upgrades and mark it for administrator review.
WITH inserted AS (
    INSERT INTO "settings" ("key", "value")
    SELECT
        'ai_training_user_ids',
        COALESCE((SELECT json_agg("id" ORDER BY "id")::text FROM "users"), '[]')
    ON CONFLICT ("key") DO NOTHING
    RETURNING "key"
)
INSERT INTO "settings" ("key", "value")
SELECT 'ai_training_user_ids_migrated', '1'
FROM inserted
WHERE EXISTS (SELECT 1 FROM "users")
ON CONFLICT ("key") DO NOTHING;
