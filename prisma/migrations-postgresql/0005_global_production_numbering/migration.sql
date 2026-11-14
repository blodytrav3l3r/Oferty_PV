CREATE TABLE "production_global_order_counters" (
    "year" INTEGER NOT NULL,
    "lastNumber" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "production_global_order_counters_pkey" PRIMARY KEY ("year")
);

CREATE TABLE "recycled_production_numbers_global" (
    "userId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "seqNumber" INTEGER NOT NULL,
    CONSTRAINT "recycled_production_numbers_global_pkey" PRIMARY KEY ("year", "seqNumber")
);

CREATE INDEX "idx_recycled_prod_global_owner"
    ON "recycled_production_numbers_global" ("userId", "year", "seqNumber");

CREATE TABLE "production_global_number_claims" (
    "userId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "seqNumber" INTEGER NOT NULL,
    CONSTRAINT "production_global_number_claims_pkey" PRIMARY KEY ("year", "seqNumber")
);

CREATE INDEX "idx_prod_global_claim_owner"
    ON "production_global_number_claims" ("userId", "year", "seqNumber");

INSERT INTO "settings" ("key", "value")
SELECT 'production_order_start_number', GREATEST(COALESCE(MAX("productionOrderStartNumber"), 1), 1)::TEXT
FROM "users"
ON CONFLICT ("key") DO NOTHING;

WITH number_values AS (
    SELECT "productionNumber" AS number FROM "production_orders_rel" WHERE "productionNumber" IS NOT NULL
    UNION ALL
    SELECT substring("data" from '"productionOrderNumber"\s*:\s*"([^"]+)"') AS number
    FROM "production_orders_rel"
    WHERE "data" IS NOT NULL
), parsed_numbers AS (
    SELECT
        CASE WHEN number ~ '^[^/]+/[^/]+/[0-9]+/[0-9]{2}$'
            THEN 2000 + split_part(number, '/', 4)::INTEGER
            ELSE 2000 + split_part(number, '/', 3)::INTEGER END AS year,
        CASE WHEN number ~ '^[^/]+/[^/]+/[0-9]+/[0-9]{2}$'
            THEN CASE WHEN length(ltrim(split_part(number, '/', 3), '0')) > 10
                THEN 2147483648::NUMERIC
                ELSE COALESCE(NULLIF(ltrim(split_part(number, '/', 3), '0'), ''), '0')::NUMERIC END
            ELSE CASE WHEN length(ltrim(split_part(number, '/', 2), '0')) > 10
                THEN 2147483648::NUMERIC
                ELSE COALESCE(NULLIF(ltrim(split_part(number, '/', 2), '0'), ''), '0')::NUMERIC END
        END AS seq
    FROM number_values
    WHERE number ~ '^[^/]+/[^/]+/[0-9]+/[0-9]{2}$'
       OR number ~ '^[^/]+/[0-9]+/[0-9]{2}$'
), sequence_heads AS (
    SELECT year, MAX(seq) AS last_number
    FROM parsed_numbers
    WHERE seq BETWEEN 0 AND 2147483647
    GROUP BY year
    UNION ALL
    SELECT "year", MAX("lastNumber") FROM "production_order_counters" GROUP BY "year"
    UNION ALL
    SELECT "year", MAX("seqNumber") FROM "recycled_production_numbers" GROUP BY "year"
)
INSERT INTO "production_global_order_counters" ("year", "lastNumber")
SELECT year, MAX(last_number)
FROM sequence_heads
GROUP BY year
ON CONFLICT ("year") DO UPDATE
SET "lastNumber" = GREATEST("production_global_order_counters"."lastNumber", EXCLUDED."lastNumber");

WITH number_values AS (
    SELECT "id", "userId", "productionNumber" AS number
    FROM "production_orders_rel"
    WHERE "productionNumber" IS NOT NULL
    UNION ALL
    SELECT "id", "userId",
           substring("data" from '"productionOrderNumber"\s*:\s*"([^"]+)"') AS number
    FROM "production_orders_rel"
    WHERE "data" IS NOT NULL
), current_numbers AS (
    SELECT "id", "userId",
           2000 + split_part(number, '/', 3)::INTEGER AS year,
           CASE WHEN length(ltrim(split_part(number, '/', 2), '0')) > 10
               THEN 2147483648::NUMERIC
               ELSE COALESCE(NULLIF(ltrim(split_part(number, '/', 2), '0'), ''), '0')::NUMERIC END AS seq
    FROM number_values
    WHERE "userId" IS NOT NULL
      AND number ~ '^[^/]+/[0-9]+/[0-9]{2}$'
), distinct_claims AS (
    SELECT DISTINCT ON (year, seq) "userId", year, seq
    FROM current_numbers
    WHERE seq BETWEEN 1 AND 2147483647
    ORDER BY year, seq, "userId", "id"
)
INSERT INTO "production_global_number_claims" ("userId", "year", "seqNumber")
SELECT "userId", year, seq FROM distinct_claims
ON CONFLICT ("year", "seqNumber") DO NOTHING;

WITH number_values AS (
    SELECT "productionNumber" AS number FROM "production_orders_rel" WHERE "productionNumber" IS NOT NULL
    UNION ALL
    SELECT substring("data" from '"productionOrderNumber"\s*:\s*"([^"]+)"') AS number
    FROM "production_orders_rel"
    WHERE "data" IS NOT NULL
), parsed_active AS (
    SELECT
        CASE WHEN number ~ '^[^/]+/[^/]+/[0-9]+/[0-9]{2}$'
            THEN 2000 + split_part(number, '/', 4)::INTEGER
            ELSE 2000 + split_part(number, '/', 3)::INTEGER END AS year,
        CASE WHEN number ~ '^[^/]+/[^/]+/[0-9]+/[0-9]{2}$'
            THEN CASE WHEN length(ltrim(split_part(number, '/', 3), '0')) > 10
                THEN 2147483648::NUMERIC
                ELSE COALESCE(NULLIF(ltrim(split_part(number, '/', 3), '0'), ''), '0')::NUMERIC END
            ELSE CASE WHEN length(ltrim(split_part(number, '/', 2), '0')) > 10
                THEN 2147483648::NUMERIC
                ELSE COALESCE(NULLIF(ltrim(split_part(number, '/', 2), '0'), ''), '0')::NUMERIC END
        END AS seq
    FROM number_values
    WHERE number ~ '^[^/]+/[^/]+/[0-9]+/[0-9]{2}$'
       OR number ~ '^[^/]+/[0-9]+/[0-9]{2}$'
), available_recycled AS (
    SELECT old."userId", old."year", old."seqNumber"
    FROM "recycled_production_numbers" AS old
    WHERE NOT EXISTS (
        SELECT 1 FROM parsed_active AS active
        WHERE active.year = old."year" AND active.seq = old."seqNumber"
    )
)
INSERT INTO "recycled_production_numbers_global" ("userId", "year", "seqNumber")
SELECT DISTINCT ON ("year", "seqNumber") "userId", "year", "seqNumber"
FROM available_recycled
ORDER BY "year", "seqNumber", "userId";

CREATE UNIQUE INDEX "uq_prod_global_number_year_sequence"
    ON "production_orders_rel" (
        split_part("productionNumber", '/', 3),
        COALESCE(NULLIF(ltrim(split_part("productionNumber", '/', 2), '0'), ''), '0')
    )
    WHERE "productionNumber" ~ '^[^/]+/[0-9]+/[0-9]{2}$';
