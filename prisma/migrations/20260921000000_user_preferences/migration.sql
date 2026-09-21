-- Preferencje uzytkownika (motyw light/dark i przyszle) — klucz per user (ASCII-only).
-- Backend jest zrodlem prawdy, localStorage na froncie to tylko cache.
CREATE TABLE IF NOT EXISTS "user_preferences" (
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT,
    PRIMARY KEY ("userId", "key")
);
CREATE INDEX IF NOT EXISTS "idx_userprefs_user" ON "user_preferences"("userId");
