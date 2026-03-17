-- Migration 004: data quality columns

-- Opportunities: provenance tracking
ALTER TABLE opportunities
  ADD COLUMN IF NOT EXISTS last_checked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS data_provenance TEXT DEFAULT 'scraped',
  ADD COLUMN IF NOT EXISTS confidence_score INTEGER DEFAULT 50;

-- Opportunities: constraint on provenance
-- Valid values: 'scraped', 'enriched', '360giving', 'user-edited', 'inferred'

-- Scores: add scoring version for future calibration
ALTER TABLE scores
  ADD COLUMN IF NOT EXISTS scoring_version TEXT DEFAULT 'v1';

-- Pipeline: outcome feedback fields
ALTER TABLE pipeline
  ADD COLUMN IF NOT EXISTS actual_award_amount NUMERIC,
  ADD COLUMN IF NOT EXISTS bid_hours_estimate INTEGER,
  ADD COLUMN IF NOT EXISTS loss_reason TEXT,
  ADD COLUMN IF NOT EXISTS outcome_notes TEXT;

-- New table: opportunity issue reports (human-in-the-loop QA)
CREATE TABLE IF NOT EXISTS opportunity_issues (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  opportunity_id UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  issue_type TEXT NOT NULL DEFAULT 'incorrect_data',
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolved BOOLEAN DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_opportunity_issues_opportunity_id
  ON opportunity_issues(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_opportunity_issues_resolved
  ON opportunity_issues(resolved);

-- New table: ingestion run logs
CREATE TABLE IF NOT EXISTS ingestion_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  run_type TEXT NOT NULL, -- 'ingest', 'enrich', 'scraper'
  source_id TEXT,
  rows_processed INTEGER DEFAULT 0,
  rows_upserted INTEGER DEFAULT 0,
  rows_skipped INTEGER DEFAULT 0,
  rows_failed INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  success BOOLEAN DEFAULT true
);

