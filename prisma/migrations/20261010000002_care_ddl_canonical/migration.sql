-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_care_sla_config" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'global',
    "firstContactH" INTEGER NOT NULL DEFAULT 24,
    "staleD" INTEGER NOT NULL DEFAULT 7,
    "escalationH" INTEGER NOT NULL DEFAULT 72,
    "updatedBy" TEXT,
    "updatedAt" TEXT
);
INSERT INTO "new_care_sla_config" ("escalationH", "firstContactH", "id", "staleD", "updatedAt", "updatedBy") SELECT "escalationH", "firstContactH", "id", "staleD", "updatedAt", "updatedBy" FROM "care_sla_config";
DROP TABLE "care_sla_config";
ALTER TABLE "new_care_sla_config" RENAME TO "care_sla_config";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
