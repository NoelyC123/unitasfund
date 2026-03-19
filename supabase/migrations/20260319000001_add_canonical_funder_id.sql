ALTER TABLE grants_awarded
  ADD COLUMN IF NOT EXISTS canonical_funder_id TEXT,
  ADD COLUMN IF NOT EXISTS funder_name_canonical TEXT;

CREATE INDEX IF NOT EXISTS idx_grants_awarded_canonical_funder_id
  ON grants_awarded (canonical_funder_id);

CREATE INDEX IF NOT EXISTS idx_grants_awarded_funder_name
  ON grants_awarded (funder_name);

ALTER TABLE opportunities
  ADD COLUMN IF NOT EXISTS canonical_funder_id TEXT,
  ADD COLUMN IF NOT EXISTS funder_name_canonical TEXT;

CREATE INDEX IF NOT EXISTS idx_opportunities_canonical_funder_id
  ON opportunities (canonical_funder_id);

COMMENT ON COLUMN grants_awarded.canonical_funder_id IS 'Canonical ID from FindThatCharity reconcile API (e.g. GB-CHC-1234567)';
COMMENT ON COLUMN grants_awarded.funder_name_canonical IS 'Clean display name from FindThatCharity';
COMMENT ON COLUMN opportunities.canonical_funder_id IS 'Canonical ID from FindThatCharity reconcile API';
COMMENT ON COLUMN opportunities.funder_name_canonical IS 'Clean display name from FindThatCharity';
