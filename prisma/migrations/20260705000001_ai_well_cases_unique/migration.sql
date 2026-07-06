-- =============================================================================
-- Migracja: ai_well_cases_unique
-- Dodanie unikalnego indeksu (dn, totalHeightMm, wellType, configHash)
-- aby zapobiec race condition w createOrUpdate() z P1-001.
-- =============================================================================

-- Deduplikacja przed dodaniem UNIQUE INDEX:
-- Jeśli istnieją duplikaty, zachowaj rekord z najwyższym acceptanceCount,
-- a w przypadku remisu — z najnowszym lastAcceptedAt.
DELETE FROM ai_well_cases
WHERE id IN (
    SELECT id FROM ai_well_cases a
    WHERE EXISTS (
        SELECT 1 FROM ai_well_cases b
        WHERE a.dn = b.dn
          AND a.totalHeightMm = b.totalHeightMm
          AND a.wellType = b.wellType
          AND a.configHash IS NOT NULL
          AND a.configHash = b.configHash
          AND a.id != b.id
          AND (
              b.acceptanceCount > a.acceptanceCount
              OR (b.acceptanceCount = a.acceptanceCount AND b.lastAcceptedAt > a.lastAcceptedAt)
              OR (b.acceptanceCount = a.acceptanceCount AND b.lastAcceptedAt = a.lastAcceptedAt AND b.id > a.id)
          )
    )
);

-- Dodanie unikalnego indeksu (częściowego: pomija NULL configHash)
CREATE UNIQUE INDEX IF NOT EXISTS "uniq_dn_height_type_hash"
ON "ai_well_cases"("dn", "totalHeightMm", "wellType", "configHash");
