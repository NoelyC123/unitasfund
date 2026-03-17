-- Migration 003: pipeline notes
-- NOTE: `pipeline.notes` already exists in `001_initial_schema.sql` in this repo.
-- No-op migration kept for environments where it may be missing.

ALTER TABLE pipeline ADD COLUMN IF NOT EXISTS notes TEXT;

