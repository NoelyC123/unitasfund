-- Add fields needed for GtR award intelligence ingestion
ALTER TABLE grants_awarded
  ADD COLUMN IF NOT EXISTS external_id TEXT,
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS sector TEXT,
  ADD COLUMN IF NOT EXISTS region TEXT;

-- Backfill for existing rows (best-effort)
UPDATE grants_awarded
SET external_id = COALESCE(external_id, funder_id)
WHERE external_id IS NULL;

-- Ensure external_id present for future upserts
ALTER TABLE grants_awarded
  ALTER COLUMN external_id SET NOT NULL;

-- Upsert key
CREATE UNIQUE INDEX IF NOT EXISTS idx_grants_awarded_source_external
  ON grants_awarded(source, external_id);

