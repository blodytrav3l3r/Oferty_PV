-- Zachowuje dokładną stawkę PEHD używaną do przeliczania wersji cennika studni.
ALTER TABLE "PricelistVersion"
    ADD COLUMN "pehdPricePerM2" DECIMAL(18, 2);
