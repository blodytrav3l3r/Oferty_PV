-- Twarda blokada edycji: 1 dokument = 1 uzytkownik (bez polskich znakow: ASCII-only).
-- TTL 180 s + heartbeat 60 s, wygasniecie leniwe przy acquire (bez crona).
-- Brak wiersza = brak blokady (stare sesje przepuszczane, chroni je 409).
CREATE TABLE IF NOT EXISTS "doc_locks" (
    "docType" TEXT NOT NULL,
    "docId" TEXT NOT NULL,
    "userId" TEXT,
    "userName" TEXT,
    "lockedAt" TEXT NOT NULL,
    "heartbeatAt" TEXT NOT NULL,
    PRIMARY KEY ("docType", "docId")
);
CREATE INDEX IF NOT EXISTS "idx_doclocks_user" ON "doc_locks"("userId");
CREATE INDEX IF NOT EXISTS "idx_doclocks_heartbeat" ON "doc_locks"("heartbeatAt");
