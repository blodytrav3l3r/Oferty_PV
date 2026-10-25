-- Ręczna korekta etykiety wersji cennika (admin, jawna decyzja z ostrzeżeniem).
-- NULL = etykieta pochodna {P}v{seq}-{RRRRMMDD} z effectiveFrom.
-- Kolumna nie zmienia seq, effectiveFrom, cen ani pieczątek ofert.
ALTER TABLE "PricelistVersion" ADD COLUMN "labelOverride" TEXT;
