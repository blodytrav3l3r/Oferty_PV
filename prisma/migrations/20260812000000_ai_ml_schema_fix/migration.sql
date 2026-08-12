-- =============================================================================
-- Migracja naprawcza: AI/ML schema fix
-- Dodaje kolumny, które istnieją w schema.prisma, ale nie zostały dodane
-- przez wcześniejsze migracje (rozjazd schema <=> migracje). Kolumny te są
-- używane przez moduły ML (ModelRegistry, FeatureExtractor, TrainingPipeline)
-- i bez nich endpointy /api/telemetry/ai/* zwracają 500, a AI/ML Dashboard
-- pokazuje "Błąd serwera — nie udało się pobrać danych".
--
-- UWAGA: unikalność AiModel.version realizujemy JAWNYM nazwanym indeksem
-- "AiModel_version_key". Niedozwolone jest przebudowanie tabeli z constraintem
-- UNIQUE na kolumnie — SQLite tworzy wtedy autoindex (sqlite_autoindex_*),
-- którego Prisma nie identyfikuje z "AiModel_version_key" i zgłasza rozjazd,
-- a próba DROP INDEX takiego autoindexu kończy się błędem P3018
-- ("index associated with UNIQUE or PRIMARY KEY constraint cannot be dropped").
-- =============================================================================

-- AlterTable
ALTER TABLE "AiFeature" ADD COLUMN "dennicaHeight" REAL;
ALTER TABLE "AiFeature" ADD COLUMN "kinetaType" TEXT;

-- AlterTable
ALTER TABLE "AiModel" ADD COLUMN "featureVersion" TEXT;

-- AlterTable
ALTER TABLE "ai_telemetry_logs" ADD COLUMN "kineta" TEXT;

-- RedefineTable: nadanie unikalności AiModel.version przez jawny nazwany
-- indeks (zamiast autoindexa z constraintu). W SQLite nie można dropnąć
-- autoindexa UNIQUE, dlatego przebudowujemy tabelę.
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AiModel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "version" TEXT NOT NULL,
    "weights" TEXT NOT NULL,
    "bias" REAL NOT NULL,
    "metrics" TEXT NOT NULL,
    "features" TEXT NOT NULL,
    "featureMins" TEXT NOT NULL,
    "featureMaxs" TEXT NOT NULL,
    "trainingRows" INTEGER NOT NULL,
    "featureVersion" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TEXT NOT NULL
);
INSERT INTO "new_AiModel" ("active", "bias", "createdAt", "featureMaxs", "featureMins", "featureVersion", "features", "id", "metrics", "notes", "trainingRows", "version", "weights")
SELECT "active", "bias", "createdAt", "featureMaxs", "featureMins", "featureVersion", "features", "id", "metrics", "notes", "trainingRows", "version", "weights" FROM "AiModel";
DROP TABLE "AiModel";
ALTER TABLE "new_AiModel" RENAME TO "AiModel";
CREATE UNIQUE INDEX "AiModel_version_key" ON "AiModel"("version");
CREATE UNIQUE INDEX "idx_aimodel_one_active" ON "AiModel"("active") WHERE "active" = true;
CREATE INDEX "idx_aimodel_active" ON "AiModel"("active");
CREATE INDEX "idx_aimodel_created" ON "AiModel"("createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;