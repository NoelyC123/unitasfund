-- UnitasFund initial schema
-- Migration: 001_initial_schema
-- Tables: organisations, opportunities, scores, profiles, user_organisations, subscriptions, pipeline, grants_awarded

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
CREATE TYPE org_type AS ENUM ('vcse', 'sme', 'cic', 'other');
CREATE TYPE subscription_plan AS ENUM ('free', 'starter', 'pro', 'team', 'adviser');
CREATE TYPE subscription_status AS ENUM ('active', 'cancelled', 'past_due');
CREATE TYPE pipeline_status AS ENUM ('interested', 'applying', 'submitted', 'won', 'lost');
CREATE TYPE user_org_role AS ENUM ('owner', 'member', 'viewer');
CREATE TYPE profile_role AS ENUM ('user', 'adviser');

-- ---------------------------------------------------------------------------
-- organisations
-- ---------------------------------------------------------------------------
CREATE TABLE organisations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  org_type org_type NOT NULL DEFAULT 'other',
  location_region TEXT,
  postcode TEXT,
  address_region TEXT,
  annual_income_band TEXT,
  sectors JSONB DEFAULT '[]',
  funding_goals TEXT,
  size_band TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_organisations_slug ON organisations(slug);
CREATE INDEX idx_organisations_created_by ON organisations(created_by);
CREATE INDEX idx_organisations_updated_at ON organisations(updated_at);

-- ---------------------------------------------------------------------------
-- opportunities
-- ---------------------------------------------------------------------------
CREATE TABLE opportunities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_id TEXT NOT NULL,
  external_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  url TEXT,
  funder_name TEXT,
  funder_id TEXT,
  amount_min NUMERIC,
  amount_max NUMERIC,
  amount_text TEXT,
  deadline DATE,
  eligibility_summary TEXT,
  location_filters JSONB DEFAULT '{}',
  sector_filters JSONB DEFAULT '{}',
  income_bands JSONB DEFAULT '{}',
  raw JSONB DEFAULT '{}',
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_active BOOLEAN NOT NULL DEFAULT true
);

CREATE UNIQUE INDEX idx_opportunities_source_external ON opportunities(source_id, external_id);
CREATE INDEX idx_opportunities_deadline ON opportunities(deadline);
CREATE INDEX idx_opportunities_is_active ON opportunities(is_active);
CREATE INDEX idx_opportunities_last_updated_at ON opportunities(last_updated_at);

-- ---------------------------------------------------------------------------
-- profiles (extends auth.users)
-- ---------------------------------------------------------------------------
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  role profile_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- user_organisations (links users to organisations)
-- ---------------------------------------------------------------------------
CREATE TABLE user_organisations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  role user_org_role NOT NULL DEFAULT 'member',
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, organisation_id)
);

CREATE INDEX idx_user_organisations_user_id ON user_organisations(user_id);
CREATE INDEX idx_user_organisations_organisation_id ON user_organisations(organisation_id);

-- ---------------------------------------------------------------------------
-- scores (fit + EV per organisation, opportunity)
-- ---------------------------------------------------------------------------
CREATE TABLE scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  opportunity_id UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  fit_score NUMERIC NOT NULL,
  fit_breakdown JSONB DEFAULT '{}',
  ev NUMERIC,
  win_probability NUMERIC,
  bid_cost_estimate NUMERIC,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(organisation_id, opportunity_id)
);

CREATE INDEX idx_scores_organisation_id ON scores(organisation_id);
CREATE INDEX idx_scores_opportunity_id ON scores(opportunity_id);
CREATE INDEX idx_scores_computed_at ON scores(computed_at);
CREATE INDEX idx_scores_fit_score_desc ON scores(fit_score DESC);
CREATE INDEX idx_scores_ev_desc ON scores(ev DESC NULLS LAST);

-- ---------------------------------------------------------------------------
-- subscriptions
-- ---------------------------------------------------------------------------
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  plan subscription_plan NOT NULL DEFAULT 'free',
  status subscription_status NOT NULL DEFAULT 'active',
  current_period_start DATE,
  current_period_end DATE,
  stripe_subscription_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT subscriptions_org_or_user CHECK (
    (organisation_id IS NOT NULL AND user_id IS NULL) OR
    (organisation_id IS NULL AND user_id IS NOT NULL)
  )
);

CREATE INDEX idx_subscriptions_organisation_id ON subscriptions(organisation_id);
CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);

-- ---------------------------------------------------------------------------
-- pipeline (CRM: org + opportunity + status)
-- ---------------------------------------------------------------------------
CREATE TABLE pipeline (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  opportunity_id UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  status pipeline_status NOT NULL DEFAULT 'interested',
  assigned_to_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(organisation_id, opportunity_id)
);

CREATE INDEX idx_pipeline_organisation_id ON pipeline(organisation_id);
CREATE INDEX idx_pipeline_opportunity_id ON pipeline(opportunity_id);
CREATE INDEX idx_pipeline_status ON pipeline(status);

-- ---------------------------------------------------------------------------
-- grants_awarded (360Giving / award intelligence)
-- ---------------------------------------------------------------------------
CREATE TABLE grants_awarded (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  opportunity_id UUID REFERENCES opportunities(id) ON DELETE SET NULL,
  funder_id TEXT,
  funder_name TEXT,
  recipient_name TEXT,
  recipient_region TEXT,
  amount_awarded NUMERIC,
  award_date DATE,
  source TEXT,
  raw JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_grants_awarded_opportunity_id ON grants_awarded(opportunity_id);
CREATE INDEX idx_grants_awarded_funder_id ON grants_awarded(funder_id);
CREATE INDEX idx_grants_awarded_recipient_region ON grants_awarded(recipient_region);
CREATE INDEX idx_grants_awarded_award_date ON grants_awarded(award_date);

-- ---------------------------------------------------------------------------
-- updated_at trigger helper
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers (PostgreSQL: use EXECUTE PROCEDURE for trigger)
CREATE TRIGGER organisations_updated_at
  BEFORE UPDATE ON organisations FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
CREATE TRIGGER subscriptions_updated_at
  BEFORE UPDATE ON subscriptions FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
CREATE TRIGGER pipeline_updated_at
  BEFORE UPDATE ON pipeline FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

-- ---------------------------------------------------------------------------
-- Create profile on signup (Supabase Auth hook)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: create profile when new user signs up (runs in Supabase with migration user)
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- When an organisation is created with created_by set, add that user as owner
CREATE OR REPLACE FUNCTION public.handle_new_organisation()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.created_by IS NOT NULL THEN
    INSERT INTO public.user_organisations (user_id, organisation_id, role, is_default)
    VALUES (NEW.created_by, NEW.id, 'owner', true);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_organisation_created
  AFTER INSERT ON organisations FOR EACH ROW EXECUTE PROCEDURE public.handle_new_organisation();

-- ---------------------------------------------------------------------------
-- RLS: enable on all tables
-- ---------------------------------------------------------------------------
ALTER TABLE organisations ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_organisations ENABLE ROW LEVEL SECURITY;
ALTER TABLE scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE grants_awarded ENABLE ROW LEVEL SECURITY;

-- Helper: user can access org if they have a user_organisations row
CREATE OR REPLACE FUNCTION user_has_org_access(org_id UUID, required_role user_org_role DEFAULT 'viewer')
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_organisations
    WHERE user_id = auth.uid() AND organisation_id = org_id
    AND (
      (required_role = 'viewer') OR
      (required_role = 'member' AND role IN ('owner', 'member', 'viewer')) OR
      (required_role = 'owner' AND role = 'owner')
    )
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- organisations: users can read/insert/update/delete only orgs they belong to
CREATE POLICY organisations_select ON organisations
  FOR SELECT USING (user_has_org_access(id));
CREATE POLICY organisations_insert ON organisations
  FOR INSERT WITH CHECK (auth.uid() = created_by OR created_by IS NULL);
CREATE POLICY organisations_update ON organisations
  FOR UPDATE USING (user_has_org_access(id, 'member'));
CREATE POLICY organisations_delete ON organisations
  FOR DELETE USING (user_has_org_access(id, 'owner'));

-- opportunities: authenticated users can read (ingest uses service role)
CREATE POLICY opportunities_select ON opportunities
  FOR SELECT TO authenticated USING (true);
CREATE POLICY opportunities_insert ON opportunities
  FOR INSERT TO service_role;
CREATE POLICY opportunities_update ON opportunities
  FOR UPDATE TO service_role;

-- profiles: users can read/update own profile
CREATE POLICY profiles_select ON profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY profiles_insert ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY profiles_update ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- user_organisations: users can read their own links; owners can manage
CREATE POLICY user_organisations_select ON user_organisations
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY user_organisations_insert ON user_organisations
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY user_organisations_update ON user_organisations
  FOR UPDATE USING (
    auth.uid() = user_id OR user_has_org_access(organisation_id, 'owner')
  );
CREATE POLICY user_organisations_delete ON user_organisations
  FOR DELETE USING (
    auth.uid() = user_id OR user_has_org_access(organisation_id, 'owner')
  );

-- scores: users can read scores for orgs they belong to (insert/update via service role or backend)
CREATE POLICY scores_select ON scores
  FOR SELECT USING (user_has_org_access(organisation_id));
CREATE POLICY scores_insert ON scores FOR INSERT TO service_role;
CREATE POLICY scores_update ON scores FOR UPDATE TO service_role;
CREATE POLICY scores_delete ON scores FOR DELETE TO service_role;

-- subscriptions: org members can read their org's subscription
CREATE POLICY subscriptions_select ON subscriptions
  FOR SELECT USING (
    (organisation_id IS NOT NULL AND user_has_org_access(organisation_id)) OR
    (user_id = auth.uid())
  );
CREATE POLICY subscriptions_insert ON subscriptions FOR INSERT TO service_role;
CREATE POLICY subscriptions_update ON subscriptions FOR UPDATE TO service_role;

-- pipeline: org members can read/write
CREATE POLICY pipeline_select ON pipeline
  FOR SELECT USING (user_has_org_access(organisation_id));
CREATE POLICY pipeline_insert ON pipeline
  FOR INSERT WITH CHECK (user_has_org_access(organisation_id));
CREATE POLICY pipeline_update ON pipeline
  FOR UPDATE USING (user_has_org_access(organisation_id));
CREATE POLICY pipeline_delete ON pipeline
  FOR DELETE USING (user_has_org_access(organisation_id));

-- grants_awarded: authenticated read (enrichment data)
CREATE POLICY grants_awarded_select ON grants_awarded
  FOR SELECT TO authenticated USING (true);
CREATE POLICY grants_awarded_insert ON grants_awarded FOR INSERT TO service_role;
