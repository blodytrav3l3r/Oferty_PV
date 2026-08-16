-- AlterTable: unikalny indeks na (wellId, action) w aiRewardLog
-- Blokada duplikatów reward per studnia+akcja (TOCTOU fix, baza błędów ML)
-- IF NOT EXISTS: baseline 20260815000000 zawiera już ten indeks (test A3 kopiuje
-- tylko baseline) — na świeżej instalacji ta migracja jest no-op.
-- Dedup (A-11): na bazach legacy z duplikatami (wellId, action) usuń starsze
-- wpisy, zachowując najnowszy — inaczej CREATE UNIQUE INDEX rzuciłby błędem.
DELETE FROM "aiRewardLog"
WHERE id NOT IN (
    SELECT MAX(id)
    FROM "aiRewardLog"
    GROUP BY "wellId", "action"
);
CREATE UNIQUE INDEX IF NOT EXISTS "uq_reward_well_action" ON "aiRewardLog"("wellId", "action");