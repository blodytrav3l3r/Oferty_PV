-- Invariants that Prisma's schema language cannot express as partial indexes.
-- PostgreSQL baseline starts empty, so no legacy rows require destructive deduplication.
CREATE UNIQUE INDEX "uq_pricelist_version_approved"
    ON "PricelistVersion" ("type", "effectiveFrom")
    WHERE "status" = 'APPROVED';

CREATE UNIQUE INDEX "ux_pricelist_version_one_draft"
    ON "PricelistVersion" ("type")
    WHERE "status" = 'DRAFT';
