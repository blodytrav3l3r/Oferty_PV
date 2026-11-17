-- Globalna pula numerów zamówień: jedna sekwencja per moduł (ZS/ZK) i rok.
CREATE TABLE "order_global_counters" (
    "year" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "lastNumber" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "order_global_counters_pkey" PRIMARY KEY ("year", "kind")
);

-- Seed: kontynuuj za najwyższym numerem już nadanym (dane + stare liczniki per user),
-- żeby nowa pula nie wygenerowała duplikatu istniejącego numeru.
WITH number_values AS (
    SELECT substring("data" from '"orderNumber"\s*:\s*"([^"]+)"') AS number
    FROM "orders_studnie_rel"
    WHERE "data" IS NOT NULL
    UNION ALL
    SELECT substring("data" from '"orderNumber"\s*:\s*"([^"]+)"')
    FROM "orders_rury_rel"
    WHERE "data" IS NOT NULL
), parsed_numbers AS (
    SELECT
        CASE WHEN (regexp_match(number, '^([^/]+/)?(ZS|ZR|ZK)/([0-9]+)/([0-9]{4})$'))[2] = 'ZS'
            THEN 'ZS' ELSE 'ZK' END AS kind,
        ((regexp_match(number, '^([^/]+/)?(ZS|ZR|ZK)/([0-9]+)/([0-9]{4})$'))[4])::INTEGER AS year,
        CASE WHEN length(ltrim((regexp_match(number, '^([^/]+/)?(ZS|ZR|ZK)/([0-9]+)/([0-9]{4})$'))[3], '0')) > 10
            THEN 2147483647
            ELSE COALESCE(NULLIF(ltrim((regexp_match(number, '^([^/]+/)?(ZS|ZR|ZK)/([0-9]+)/([0-9]{4})$'))[3], '0'), ''), '0')::INTEGER END AS seq
    FROM number_values
    WHERE number ~ '^([^/]+/)?(ZS|ZR|ZK)/([0-9]+)/([0-9]{4})$'
), sequence_heads AS (
    SELECT kind, year, MAX(seq) AS last_number
    FROM parsed_numbers
    GROUP BY kind, year
    UNION ALL
    SELECT 'ZS', "year", MAX(COALESCE("lastNumber", 0)) FROM "order_counters" GROUP BY "year"
    UNION ALL
    SELECT 'ZK', "year", MAX(COALESCE("lastNumber", 0)) FROM "order_counters_rury" GROUP BY "year"
)
INSERT INTO "order_global_counters" ("year", "kind", "lastNumber")
SELECT year, kind, MAX(last_number)
FROM sequence_heads
GROUP BY year, kind;
