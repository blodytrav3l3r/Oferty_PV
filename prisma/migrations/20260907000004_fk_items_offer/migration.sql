-- P1-E: siatka FK offer_items_rel.offerId -> offers_rel.id (RESTRICT).
-- Kod kasuje pozycje w tx przed ofertą; FK wyłapuje obejścia. Bez CASCADE.
-- Fail-fast: wiszące offerId na produkcji zatrzyma migrację z błędem FK
-- (do wyczyszczenia przed wdrożeniem, patrz npm run audit:integrity).
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_offer_items_rel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "offerId" TEXT,
    "productId" TEXT,
    "quantity" REAL,
    "discount" REAL,
    "price" REAL,
    CONSTRAINT "offer_items_rel_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "offers_rel" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_offer_items_rel" ("discount", "id", "offerId", "price", "productId", "quantity") SELECT "discount", "id", "offerId", "price", "productId", "quantity" FROM "offer_items_rel";
DROP TABLE "offer_items_rel";
ALTER TABLE "new_offer_items_rel" RENAME TO "offer_items_rel";
CREATE INDEX "idx_offitems_offer" ON "offer_items_rel"("offerId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
