-- S2a: PricelistVersion ma dwa statusy zapisane (DRAFT, APPROVED).
-- SCHEDULED/ACTIVE/ARCHIVED są wyliczane z effectiveFrom, nigdy zapisane.
--
-- WAŻNE: `prisma migrate deploy` nie owija pliku SQLite w transakcję.
-- Jawny BEGIN/COMMIT jest jedyną gwarancją all-or-nothing; guardy muszą
-- wykonać się PRZED UPDATE. Przy błędzie Prisma zostawia failed migration
-- (P3009) — recovery: `prisma migrate resolve --rolled-back`.

BEGIN;

-- 1. Nieznany status = brak mapowania; przerwij przed jakimkolwiek zapisem.
CREATE TEMP TABLE "_guard_pricelist_unknown_status" (
    "guard_pricelist_unknown_status" INTEGER CHECK ("guard_pricelist_unknown_status" = 1)
);
INSERT INTO "_guard_pricelist_unknown_status" ("guard_pricelist_unknown_status")
SELECT CASE
    WHEN EXISTS (
        SELECT 1 FROM "PricelistVersion"
        WHERE "status" NOT IN (
            'DRAFT',
            'BACKDATE_REQUESTED',
            'ACTIVE',
            'SCHEDULED',
            'ARCHIVED',
            'BACKDATE',
            'APPROVED'
        )
    ) THEN 0
    ELSE 1
END;
DROP TABLE "_guard_pricelist_unknown_status";

-- 2. effectiveFrom jest osią czasu (porównania stringowe) — musi być UTC ISO.
CREATE TEMP TABLE "_guard_pricelist_invalid_effectiveFrom" (
    "guard_pricelist_invalid_effectiveFrom" INTEGER
        CHECK ("guard_pricelist_invalid_effectiveFrom" = 1)
);
INSERT INTO "_guard_pricelist_invalid_effectiveFrom" ("guard_pricelist_invalid_effectiveFrom")
SELECT CASE
    WHEN EXISTS (
        SELECT 1 FROM "PricelistVersion"
        WHERE "effectiveFrom" NOT GLOB
            '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9]*Z'
    ) THEN 0
    ELSE 1
END;
DROP TABLE "_guard_pricelist_invalid_effectiveFrom";

-- 3. Kolizja po mapowaniu: partial unique dopuszcza wiele DRAFTów, ale tylko
--    jedną APPROVED na (type, effectiveFrom). Przerwij zamiast zgubić historię.
CREATE TEMP TABLE "_guard_pricelist_duplicate_approved_date" (
    "guard_pricelist_duplicate_approved_date" INTEGER
        CHECK ("guard_pricelist_duplicate_approved_date" = 1)
);
INSERT INTO "_guard_pricelist_duplicate_approved_date" ("guard_pricelist_duplicate_approved_date")
SELECT CASE
    WHEN EXISTS (
        SELECT 1 FROM "PricelistVersion"
        WHERE "status" IN ('ACTIVE', 'SCHEDULED', 'ARCHIVED', 'BACKDATE', 'APPROVED')
        GROUP BY "type", "effectiveFrom"
        HAVING COUNT(*) > 1
    ) THEN 0
    ELSE 1
END;
DROP TABLE "_guard_pricelist_duplicate_approved_date";

-- 4. Mapowanie danych (bez utraty wierszy i bez zmiany effectiveFrom).
UPDATE "PricelistVersion"
SET "status" = 'APPROVED'
WHERE "status" IN ('ACTIVE', 'SCHEDULED', 'ARCHIVED', 'BACKDATE');

UPDATE "PricelistVersion"
SET "status" = 'DRAFT'
WHERE "status" = 'BACKDATE_REQUESTED';

-- 5. Partial unique: tylko APPROVED zajmuje oś czasu. DRAFTy mogą dzielić datę.
CREATE UNIQUE INDEX IF NOT EXISTS "uq_pricelist_version_approved"
    ON "PricelistVersion" ("type", "effectiveFrom")
    WHERE "status" = 'APPROVED';

COMMIT;
