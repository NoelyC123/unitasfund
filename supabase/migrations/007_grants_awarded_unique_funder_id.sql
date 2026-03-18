-- Support upsert onConflict: funder_id for award intelligence ingestion.
CREATE UNIQUE INDEX IF NOT EXISTS idx_grants_awarded_funder_id_unique
  ON grants_awarded(funder_id);

