-- Jeden DRAFT na typ cennika (rury / studnie / preco).
-- Prisma nie modeluje indeksów częściowych, więc reguła żyje wyłącznie tutaj.
-- Wcześniej API pozwalało utworzyć dowolną liczbę szkiców, a zapis siatki
-- trafiał do "najnowszego" z nich (createdAt DESC, bez tie-breakera).
CREATE UNIQUE INDEX IF NOT EXISTS "ux_pricelist_version_one_draft"
ON "PricelistVersion"("type")
WHERE "status" = 'DRAFT';

-- Jeśli w bazie są już duplikaty, powyższy CREATE kończy się błędem UNIQUE
-- i migracja przerywa się jawnie (bez kasowania danych). FK z tabel pozycji
-- jest RESTRICT, więc automatyczne sprzątanie skasowałoby historię wersji.
-- Naprawa ręczna: scal duplikaty (usuń nadmiarowy szkic po sprawdzeniu
-- PricelistItem*), potem ponów `prisma migrate deploy`.
