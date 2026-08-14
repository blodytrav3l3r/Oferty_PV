-- AlterTable: unikalny indeks na (wellId, action) w aiRewardLog
-- Blokada duplikatów reward per studnia+akcja (TOCTOU fix, baza błędów ML)
-- IF NOT EXISTS: baseline 20260815000000 zawiera już ten indeks (test A3 kopiuje
-- tylko baseline) — na świeżej instalacji ta migracja jest no-op.
CREATE UNIQUE INDEX IF NOT EXISTS "uq_reward_well_action" ON "aiRewardLog"("wellId", "action");