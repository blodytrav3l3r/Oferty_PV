-- CreateTable
CREATE TABLE "CategoriesRury" (
    "name" TEXT NOT NULL PRIMARY KEY,
    "order" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "ProductsRury" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "price" REAL NOT NULL,
    "transport" REAL,
    "weight" REAL,
    "area" REAL,
    CONSTRAINT "ProductsRury_category_fkey" FOREIGN KEY ("category") REFERENCES "CategoriesRury" ("name") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CategoriesStudnie" (
    "name" TEXT NOT NULL PRIMARY KEY,
    "componentType" TEXT,
    "order" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "ProductsStudnie" (
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
    "malowanieZewnetrzne" REAL,
    CONSTRAINT "ProductsStudnie_category_fkey" FOREIGN KEY ("category") REFERENCES "CategoriesStudnie" ("name") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PrecoKonfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "PrecoKinety" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "order" INTEGER NOT NULL,
    "dn" INTEGER NOT NULL,
    "wellDn" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "cena" REAL NOT NULL
);

-- CreateTable
CREATE TABLE "PrecoZakresy" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "order" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "min" INTEGER NOT NULL,
    "max" INTEGER NOT NULL,
    "grupy" TEXT NOT NULL,
    "wellDn" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "PrecoKonfigDefault" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "PrecoKinetyDefault" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "order" INTEGER NOT NULL,
    "dn" INTEGER NOT NULL,
    "wellDn" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "cena" REAL NOT NULL
);

-- CreateTable
CREATE TABLE "PrecoZakresyDefault" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "order" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "min" INTEGER NOT NULL,
    "max" INTEGER NOT NULL,
    "grupy" TEXT NOT NULL,
    "wellDn" INTEGER NOT NULL
);

