-- Etap 2: usunięcie tabel LIVE i `*_Default`.
--
-- Ceny żyją wyłącznie w wersjach cennika (PricelistVersion + PricelistItem*),
-- a „domyślne" pochodzą z data/seed_*.json. Tabele LIVE były tylko do odczytu
-- od etapu 1 i nic ich nie synchronizowało po publikacji wersji.
--
-- UWAGA: wykonanie na bazie wymaga backupu pliku DB i osobnego GO.
DROP TABLE IF EXISTS "ProductsRury";
DROP TABLE IF EXISTS "ProductsRuryDefault";
DROP TABLE IF EXISTS "ProductsStudnie";
DROP TABLE IF EXISTS "ProductsStudnieDefault";
DROP TABLE IF EXISTS "PrecoKonfig";
DROP TABLE IF EXISTS "PrecoKinety";
DROP TABLE IF EXISTS "PrecoZakresy";
DROP TABLE IF EXISTS "PrecoKonfigDefault";
DROP TABLE IF EXISTS "PrecoKinetyDefault";
DROP TABLE IF EXISTS "PrecoZakresyDefault";
