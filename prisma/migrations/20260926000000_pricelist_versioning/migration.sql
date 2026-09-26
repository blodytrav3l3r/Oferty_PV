-- F2: Wersjonowanie cenników + effectiveFrom (Expand & Contract).
-- Ręcznie z `prisma migrate diff` (migrate dev żąda resetu lokalnej DB
-- z powodu driftu FTS/auto-heal — poza zakresem F2, dane lokalne zostają).
-- Czysto addytywna: 4× ADD COLUMN + 6× CREATE TABLE + indeksy.

-- AlterTable
ALTER TABLE "offers_rel" ADD COLUMN "pricelistVersionId" TEXT;

-- AlterTable
ALTER TABLE "offers_studnie_rel" ADD COLUMN "pricelistVersionId" TEXT;

-- AlterTable
ALTER TABLE "orders_rury_rel" ADD COLUMN "pricelistVersionId" TEXT;

-- AlterTable
ALTER TABLE "orders_studnie_rel" ADD COLUMN "pricelistVersionId" TEXT;

-- CreateTable
CREATE TABLE "PricelistVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "version" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "effectiveFrom" TEXT NOT NULL,
    "createdBy" TEXT,
    "note" TEXT,
    "sha256" TEXT NOT NULL,
    "createdAt" TEXT,
    "approvedBy" TEXT,
    "approvedAt" TEXT,
    "approvalStatus" TEXT
);

-- CreateTable
CREATE TABLE "PricelistItemRury" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "versionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "price" REAL NOT NULL,
    "transport" REAL,
    "weight" REAL,
    "area" REAL
);

-- CreateTable
CREATE TABLE "PricelistItemStudnie" (
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
    "malowanieZewnetrzne" REAL
);

-- CreateTable
CREATE TABLE "PricelistItemPrecoKonfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "versionId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "PricelistItemPrecoKinety" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "versionId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "dn" INTEGER NOT NULL,
    "wellDn" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "cena" REAL NOT NULL
);

-- CreateTable
CREATE TABLE "PricelistItemPrecoZakresy" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "versionId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "min" INTEGER NOT NULL,
    "max" INTEGER NOT NULL,
    "grupy" TEXT NOT NULL,
    "wellDn" INTEGER NOT NULL
);

-- CreateIndex
CREATE INDEX "PricelistVersion_type_status_effectiveFrom_idx" ON "PricelistVersion"("type", "status", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "PricelistVersion_type_seq_key" ON "PricelistVersion"("type", "seq");

-- CreateIndex
CREATE UNIQUE INDEX "PricelistVersion_type_version_key" ON "PricelistVersion"("type", "version");

-- CreateIndex
CREATE INDEX "PricelistItemRury_versionId_idx" ON "PricelistItemRury"("versionId");

-- CreateIndex
CREATE INDEX "PricelistItemStudnie_versionId_idx" ON "PricelistItemStudnie"("versionId");

-- CreateIndex
CREATE INDEX "PricelistItemPrecoKonfig_versionId_idx" ON "PricelistItemPrecoKonfig"("versionId");

-- CreateIndex
CREATE INDEX "PricelistItemPrecoKinety_versionId_idx" ON "PricelistItemPrecoKinety"("versionId");

-- CreateIndex
CREATE INDEX "PricelistItemPrecoZakresy_versionId_idx" ON "PricelistItemPrecoZakresy"("versionId");
