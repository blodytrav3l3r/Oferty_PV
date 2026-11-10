-- Osoba oznaczona w katalogu jako pomijana nie wczytuje się domyślnie do oferty.
ALTER TABLE "client_contacts_rel" ADD COLUMN "excluded" BOOLEAN NOT NULL DEFAULT false;
