-- FK Restrict PricelistItem* -> PricelistVersion (wzorzec 20260907000004_fk_items_offer).
-- PricelistItemRury/Studnie/PrecoKonfig/PrecoKinety/PrecoZakresy.versionId -> PricelistVersion.id.
-- Kod kasuje pozycje w tx przed wersja (deleteVersionItems); FK wylapuje obejscia. Bez CASCADE.
-- Sonda sierot pre-migracja: 0 we wszystkich 5 tabelach (285+2070+5+54+179 wierszy, 7 wersji).
-- Recznie z `prisma migrate diff` (migrate dev zada resetu lokalnej DB z powodu
-- driftu FTS/auto-heal — poza zakresem, dane lokalne zostaja). Wzorzec F1/F2.
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PricelistItemPrecoKinety" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "versionId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "dn" INTEGER NOT NULL,
    "wellDn" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "cena" REAL NOT NULL,
    CONSTRAINT "PricelistItemPrecoKinety_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "PricelistVersion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_PricelistItemPrecoKinety" ("cena", "dn", "height", "id", "order", "versionId", "wellDn") SELECT "cena", "dn", "height", "id", "order", "versionId", "wellDn" FROM "PricelistItemPrecoKinety";
DROP TABLE "PricelistItemPrecoKinety";
ALTER TABLE "new_PricelistItemPrecoKinety" RENAME TO "PricelistItemPrecoKinety";
CREATE INDEX "PricelistItemPrecoKinety_versionId_idx" ON "PricelistItemPrecoKinety"("versionId");
CREATE TABLE "new_PricelistItemPrecoKonfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "versionId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    CONSTRAINT "PricelistItemPrecoKonfig_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "PricelistVersion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_PricelistItemPrecoKonfig" ("id", "key", "value", "versionId") SELECT "id", "key", "value", "versionId" FROM "PricelistItemPrecoKonfig";
DROP TABLE "PricelistItemPrecoKonfig";
ALTER TABLE "new_PricelistItemPrecoKonfig" RENAME TO "PricelistItemPrecoKonfig";
CREATE INDEX "PricelistItemPrecoKonfig_versionId_idx" ON "PricelistItemPrecoKonfig"("versionId");
CREATE TABLE "new_PricelistItemPrecoZakresy" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "versionId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "min" INTEGER NOT NULL,
    "max" INTEGER NOT NULL,
    "grupy" TEXT NOT NULL,
    "wellDn" INTEGER NOT NULL,
    CONSTRAINT "PricelistItemPrecoZakresy_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "PricelistVersion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_PricelistItemPrecoZakresy" ("grupy", "id", "label", "max", "min", "order", "versionId", "wellDn") SELECT "grupy", "id", "label", "max", "min", "order", "versionId", "wellDn" FROM "PricelistItemPrecoZakresy";
DROP TABLE "PricelistItemPrecoZakresy";
ALTER TABLE "new_PricelistItemPrecoZakresy" RENAME TO "PricelistItemPrecoZakresy";
CREATE INDEX "PricelistItemPrecoZakresy_versionId_idx" ON "PricelistItemPrecoZakresy"("versionId");
CREATE TABLE "new_PricelistItemRury" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "versionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "price" REAL NOT NULL,
    "transport" REAL,
    "weight" REAL,
    "area" REAL,
    CONSTRAINT "PricelistItemRury_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "PricelistVersion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_PricelistItemRury" ("area", "category", "id", "name", "price", "transport", "versionId", "weight") SELECT "area", "category", "id", "name", "price", "transport", "versionId", "weight" FROM "PricelistItemRury";
DROP TABLE "PricelistItemRury";
ALTER TABLE "new_PricelistItemRury" RENAME TO "PricelistItemRury";
CREATE INDEX "PricelistItemRury_versionId_idx" ON "PricelistItemRury"("versionId");
CREATE TABLE "new_PricelistItemStudnie" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "versionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "componentType" TEXT NOT NULL,
    "dn" TEXT,
    "height" INTEGER,
    "weight" REAL,
    "price" REAL NOT NULL DEFAULT 0,
    "area" REAL,
    "areaExt" REAL,
    "transport" REAL,
    "magazynWL" BOOLEAN NOT NULL DEFAULT false,
    "magazynKLB" BOOLEAN NOT NULL DEFAULT false,
    "formaStandardowa" BOOLEAN NOT NULL DEFAULT false,
    "formaStandardowaKLB" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "zapasDol" INTEGER,
    "zapasGora" INTEGER,
    "zapasDolMin" INTEGER,
    "zapasGoraMin" INTEGER,
    "spocznikH" TEXT,
    "hMin1" INTEGER,
    "hMax1" INTEGER,
    "cena1" REAL,
    "hMin2" INTEGER,
    "hMax2" INTEGER,
    "cena2" REAL,
    "hMin3" INTEGER,
    "hMax3" INTEGER,
    "cena3" REAL,
    "doplataPEHD" REAL,
    "doplataZelbet" REAL,
    "doplataDrabNierdzewna" REAL,
    "malowanieWewnetrzne" REAL,
    "malowanieZewnetrzne" REAL,
    CONSTRAINT "PricelistItemStudnie_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "PricelistVersion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_PricelistItemStudnie" ("active", "area", "areaExt", "category", "cena1", "cena2", "cena3", "componentType", "dn", "doplataDrabNierdzewna", "doplataPEHD", "doplataZelbet", "formaStandardowa", "formaStandardowaKLB", "hMax1", "hMax2", "hMax3", "hMin1", "hMin2", "hMin3", "height", "id", "magazynKLB", "magazynWL", "malowanieWewnetrzne", "malowanieZewnetrzne", "name", "price", "spocznikH", "transport", "versionId", "weight", "zapasDol", "zapasDolMin", "zapasGora", "zapasGoraMin") SELECT "active", "area", "areaExt", "category", "cena1", "cena2", "cena3", "componentType", "dn", "doplataDrabNierdzewna", "doplataPEHD", "doplataZelbet", "formaStandardowa", "formaStandardowaKLB", "hMax1", "hMax2", "hMax3", "hMin1", "hMin2", "hMin3", "height", "id", "magazynKLB", "magazynWL", "malowanieWewnetrzne", "malowanieZewnetrzne", "name", "price", "spocznikH", "transport", "versionId", "weight", "zapasDol", "zapasDolMin", "zapasGora", "zapasGoraMin" FROM "PricelistItemStudnie";
DROP TABLE "PricelistItemStudnie";
ALTER TABLE "new_PricelistItemStudnie" RENAME TO "PricelistItemStudnie";
CREATE INDEX "PricelistItemStudnie_versionId_idx" ON "PricelistItemStudnie"("versionId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
