-- L2: serwerowy draft roboczy (cross-device).
-- Nowa tabela, zero zmian w istniejących: brak ryzyka dla danych ofert/zamówień.
-- Klucz złożony (userId, kind, docId) — draft jest zawsze per-user, więc cudzy
-- wiersz jest nieosiągalny już na poziomie zapytania (nie tylko guardu).
-- `version` to CAS DRAFTU (nie dokumentu); `baseVersion` = wersja dokumentu,
-- na której draft powstał.
CREATE TABLE IF NOT EXISTS "drafts" (
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "docId" TEXT NOT NULL,
    "baseVersion" INTEGER,
    "payload" TEXT NOT NULL,
    "bytes" INTEGER NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TEXT NOT NULL,
    "expiresAt" TEXT NOT NULL,

    PRIMARY KEY ("userId", "kind", "docId")
);

-- Sweep TTL w housekeepingu (expiresAt < now).
CREATE INDEX IF NOT EXISTS "idx_drafts_expires" ON "drafts"("expiresAt");
