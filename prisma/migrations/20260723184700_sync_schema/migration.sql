-- DropIndex
DROP INDEX "idx_kb_pattern_key_unique";

-- DropIndex
DROP INDEX "uniq_dn_height_type_hash";

-- DropIndex
DROP INDEX "idx_well_cases_acceptance";

-- DropIndex
DROP INDEX "idx_well_cases_dn_height";

-- DropIndex
DROP INDEX "idx_well_cases_warehouse";

-- DropIndex
DROP INDEX "idx_well_cases_dn_type";

-- AlterTable
ALTER TABLE "clients_rel" ADD COLUMN "clientNumber" TEXT DEFAULT '';

-- AlterTable
ALTER TABLE "offers_rel" ADD COLUMN "clientName" TEXT;
ALTER TABLE "offers_rel" ADD COLUMN "clientNip" TEXT;
ALTER TABLE "offers_rel" ADD COLUMN "investName" TEXT;

-- AlterTable
ALTER TABLE "offers_studnie_rel" ADD COLUMN "clientName" TEXT;
ALTER TABLE "offers_studnie_rel" ADD COLUMN "clientNip" TEXT;
ALTER TABLE "offers_studnie_rel" ADD COLUMN "investName" TEXT;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "CategoriesRury";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "CategoriesStudnie";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "ai_well_cases";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "ProductsRuryDefault" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "price" REAL NOT NULL,
    "transport" REAL,
    "weight" REAL,
    "area" REAL
);

-- CreateTable
CREATE TABLE "ProductsStudnieDefault" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "malowanieZewnetrzne" REAL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ProductsRury" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "price" REAL NOT NULL,
    "transport" REAL,
    "weight" REAL,
    "area" REAL
);
INSERT INTO "new_ProductsRury" ("area", "category", "id", "name", "price", "transport", "weight") SELECT "area", "category", "id", "name", "price", "transport", "weight" FROM "ProductsRury";
DROP TABLE "ProductsRury";
ALTER TABLE "new_ProductsRury" RENAME TO "ProductsRury";
CREATE TABLE "new_ProductsStudnie" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "malowanieZewnetrzne" REAL
);
INSERT INTO "new_ProductsStudnie" ("active", "area", "areaExt", "category", "cena1", "cena2", "cena3", "componentType", "dn", "doplataDrabNierdzewna", "doplataPEHD", "doplataZelbet", "formaStandardowa", "formaStandardowaKLB", "hMax1", "hMax2", "hMax3", "hMin1", "hMin2", "hMin3", "height", "id", "magazynKLB", "magazynWL", "malowanieWewnetrzne", "malowanieZewnetrzne", "name", "price", "spocznikH", "transport", "weight", "zapasDol", "zapasDolMin", "zapasGora", "zapasGoraMin") SELECT "active", "area", "areaExt", "category", "cena1", "cena2", "cena3", "componentType", "dn", "doplataDrabNierdzewna", "doplataPEHD", "doplataZelbet", "formaStandardowa", "formaStandardowaKLB", "hMax1", "hMax2", "hMax3", "hMin1", "hMin2", "hMin3", "height", "id", "magazynKLB", "magazynWL", "malowanieWewnetrzne", "malowanieZewnetrzne", "name", "price", "spocznikH", "transport", "weight", "zapasDol", "zapasDolMin", "zapasGora", "zapasGoraMin" FROM "ProductsStudnie";
DROP TABLE "ProductsStudnie";
ALTER TABLE "new_ProductsStudnie" RENAME TO "ProductsStudnie";
CREATE TABLE "new_aiRewardLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "wellId" TEXT NOT NULL,
    "dn" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "reward" REAL NOT NULL,
    "scoreBefore" REAL,
    "scoreAfter" REAL,
    "wasAiRanked" BOOLEAN NOT NULL DEFAULT false,
    "configSnapshot" TEXT,
    "createdAt" TEXT NOT NULL
);
INSERT INTO "new_aiRewardLog" ("action", "configSnapshot", "createdAt", "dn", "id", "reward", "scoreAfter", "scoreBefore", "userId", "wasAiRanked", "wellId") SELECT "action", "configSnapshot", "createdAt", "dn", "id", "reward", "scoreAfter", "scoreBefore", "userId", "wasAiRanked", "wellId" FROM "aiRewardLog";
DROP TABLE "aiRewardLog";
ALTER TABLE "new_aiRewardLog" RENAME TO "aiRewardLog";
CREATE INDEX "idx_reward_user" ON "aiRewardLog"("userId");
CREATE INDEX "idx_reward_action" ON "aiRewardLog"("action");
CREATE INDEX "idx_reward_created" ON "aiRewardLog"("createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "idx_logs_wasmodified" ON "ai_telemetry_logs"("wasModified");

-- CreateIndex
CREATE INDEX "idx_logs_createdat" ON "ai_telemetry_logs"("createdAt");

-- CreateIndex
CREATE INDEX "idx_logs_dn" ON "ai_telemetry_logs"("dn");

-- CreateIndex
CREATE INDEX "idx_logs_modified_created" ON "ai_telemetry_logs"("wasModified", "createdAt");

-- CreateIndex
CREATE INDEX "idx_audit_created_at" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "idx_offitems_offer" ON "offer_items_rel"("offerId");

-- CreateIndex
CREATE INDEX "idx_offstitems_offer" ON "offer_studnie_items_rel"("offerId");

-- CreateIndex
CREATE INDEX "idx_offers_user" ON "offers_rel"("userId");

-- CreateIndex
CREATE INDEX "idx_offers_created" ON "offers_rel"("createdAt");

-- CreateIndex
CREATE INDEX "idx_offers_state" ON "offers_rel"("state");

-- CreateIndex
CREATE INDEX "idx_offers_number" ON "offers_rel"("offer_number");

-- CreateIndex
CREATE INDEX "idx_offers_clientname" ON "offers_rel"("clientName");

-- CreateIndex
CREATE INDEX "idx_offers_investname" ON "offers_rel"("investName");

-- CreateIndex
CREATE INDEX "idx_offersstud_user" ON "offers_studnie_rel"("userId");

-- CreateIndex
CREATE INDEX "idx_offersstud_created" ON "offers_studnie_rel"("createdAt");

-- CreateIndex
CREATE INDEX "idx_offersstud_state" ON "offers_studnie_rel"("state");

-- CreateIndex
CREATE INDEX "idx_offersstud_number" ON "offers_studnie_rel"("offer_number");

-- CreateIndex
CREATE INDEX "idx_offersstud_clientname" ON "offers_studnie_rel"("clientName");

-- CreateIndex
CREATE INDEX "idx_offersstud_investname" ON "offers_studnie_rel"("investName");

-- CreateIndex
CREATE INDEX "idx_ordrury_user" ON "orders_rury_rel"("userId");

-- CreateIndex
CREATE INDEX "idx_ordrury_offer" ON "orders_rury_rel"("offerId");

-- CreateIndex
CREATE INDEX "idx_ordstud_user" ON "orders_studnie_rel"("userId");

-- CreateIndex
CREATE INDEX "idx_ordstud_offer" ON "orders_studnie_rel"("offerStudnieId");

-- CreateIndex
CREATE INDEX "idx_prod_user" ON "production_orders_rel"("userId");

-- CreateIndex
CREATE INDEX "idx_prod_creator" ON "production_orders_rel"("creatorId");

-- CreateIndex
CREATE INDEX "idx_prod_created" ON "production_orders_rel"("createdAt");

-- CreateIndex
CREATE INDEX "idx_prod_order" ON "production_orders_rel"("orderId");

-- CreateIndex
CREATE INDEX "idx_users_role" ON "users"("role");

-- AiModel already has UNIQUE constraint on "version" via column definition

