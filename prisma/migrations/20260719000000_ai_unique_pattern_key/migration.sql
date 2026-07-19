-- Unikalny indeks na patternKey w ai_knowledge_base (race condition fix)
CREATE UNIQUE INDEX IF NOT EXISTS "idx_kb_pattern_key_unique" ON "ai_knowledge_base"("patternKey");
