-- Add AI eligibility assessment fields to scores.
ALTER TABLE scores
  ADD COLUMN IF NOT EXISTS eligibility_certainty TEXT DEFAULT NULL;

ALTER TABLE scores
  ADD COLUMN IF NOT EXISTS eligibility_reasoning TEXT DEFAULT NULL;

