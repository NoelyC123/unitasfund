-- Ensure we can upsert award intelligence safely.
CREATE UNIQUE INDEX IF NOT EXISTS idx_grants_awarded_source_funder_id_unique
  ON grants_awarded(source, funder_id);

