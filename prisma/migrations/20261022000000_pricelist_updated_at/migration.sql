-- Adnotacja "ostatnia zmiana" wersji cennika.
-- Czysto addytywna kolumna (bez zmiany istniejących danych poza backfillem).
ALTER TABLE "PricelistVersion" ADD COLUMN "updatedAt" TEXT;

-- Backfill: brak historii edycji, więc bierzemy najbliższy znany znacznik czasu.
UPDATE "PricelistVersion"
SET "updatedAt" = COALESCE("approvedAt", "createdAt");
