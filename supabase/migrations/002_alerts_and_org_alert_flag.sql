-- Migration: 002_alerts_and_org_alert_flag
-- Adds alert tracking + opt-in flag for organisations

-- Organisations: allow users to enable/disable alerts
ALTER TABLE organisations
  ADD COLUMN IF NOT EXISTS user_alerts_enabled BOOLEAN NOT NULL DEFAULT false;

-- Alerts table: track which alerts have been sent
CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  opportunity_id UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alerts_org_id ON alerts(org_id);
CREATE INDEX IF NOT EXISTS idx_alerts_opportunity_id ON alerts(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_alerts_sent_at ON alerts(sent_at);
