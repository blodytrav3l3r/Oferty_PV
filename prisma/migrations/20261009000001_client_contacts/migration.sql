-- Katalog osob do kontaktu klienta (Paczka 2): wiele kontaktow per klient.
-- Bez FK (konwencja projektu) — delete klienta kasuje kontakty kodowo
-- w tej samej tx (PUT /api/clients). Backfill legacy (clients_rel.contact /
-- phone / email -> 1 wiersz isPrimary=1) robi warstwa aplikacji
-- (ensureClientContactsTable w initDatabase.ts): id = crypto.randomUUID,
-- SQLite nie ma generatora UUID, a heal pokrywa tez bazy legacy db push.
CREATE TABLE IF NOT EXISTS "client_contacts_rel" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "clientId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "phone" TEXT,
  "email" TEXT,
  "position" TEXT DEFAULT '',
  "isPrimary" INTEGER NOT NULL DEFAULT 0,
  "createdByUserId" TEXT,
  "createdAt" TEXT,
  "updatedAt" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_client_contacts_client" ON "client_contacts_rel"("clientId");
