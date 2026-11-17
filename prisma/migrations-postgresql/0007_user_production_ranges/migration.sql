-- Zakres numerów zleceń produkcyjnych per użytkownik (opiekun zamówienia).
-- Stały co roku: zmienia się tylko litera roku. NULL = brak zakresu (claim zablokowany).
ALTER TABLE "users" ADD COLUMN "productionRangeFrom" INTEGER;
ALTER TABLE "users" ADD COLUMN "productionRangeTo" INTEGER;

ALTER TABLE "users" ADD CONSTRAINT "users_production_range_check"
    CHECK (
        "productionRangeFrom" IS NULL
        OR "productionRangeTo" IS NULL
        OR ("productionRangeFrom" >= 1 AND "productionRangeFrom" <= "productionRangeTo")
    );

-- Seed dla istniejących kont: ciągły blok 1..N unikalny per użytkownik, żeby żaden
-- opiekun nie został bez zakresu po wdrożeniu. Nowe konta dostają zakres z formularza.
WITH ordered AS (
    SELECT "id", ROW_NUMBER() OVER (ORDER BY "id")::INTEGER AS position
    FROM "users"
)
UPDATE "users" AS u
SET "productionRangeFrom" = (ordered.position - 1) * 1000 + 1,
    "productionRangeTo" = ordered.position * 1000
FROM ordered
WHERE u."id" = ordered."id";
