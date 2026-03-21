See also: PROJECT_STATUS.md for current development phase, priorities, competitors, and business context.
See also: PROJECT_STATUS.md for current development phase, priorities, competitors, and business context.

# UnitasFund — Project Context for AI Assistants

## What it is

UnitasFund is a **UK funding intelligence platform**. It helps VCSEs, SMEs, CICs, and CVS organisations discover, score, and track funding opportunities with explainable fit scores and expected value (EV).

## Tech stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router), React 19, TypeScript 5, Tailwind CSS 4 |
| Auth & DB | Supabase (Postgres, Auth, RLS) |
| Payments | Stripe (subscriptions; 5 tiers: Free → Adviser) |
| Email | Resend (transactional + alert emails via `scripts/alerts/send-alerts.ts`) |
| AI | Anthropic SDK — Claude Haiku for eligibility assessment (`lib/scoring/eligibility-ai.ts`) |
| Hosting | Vercel (web, API routes, Cron) |
| Tests | Vitest 2 |

## Key paths

```
app/
  (auth)/           Login, signup, password reset (public)
  (dashboard)/      Protected: dashboard, opportunity/[id], pipeline, profile, settings, onboarding
  (marketing)/      Pricing, privacy, terms
  api/
    cron/daily-ingest/   Vercel Cron trigger (guarded by CRON_SECRET)
    stripe/              checkout, portal, subscription
    webhooks/stripe/     Webhook handler
    pipeline/            GET/POST/PATCH/DELETE pipeline items
    organisations/       Create org
    alerts/subscribe/    Alert subscription
    profile/, settings/  User/org profile CRUD

lib/
  db/
    browser.ts      Client-side Supabase (anon key)
    server.ts       Server-side SSR client (cookies)
    client.ts       Env var getters
  scoring/          Pure TypeScript scoring engine (no DB calls)
    types.ts        OrgProfile, Opportunity, FitScore, EVScore, ScoreResult
    index.ts        scoreOpportunity() — main export
    fit.ts          Fit score (0–100), 4 components × 25 pts
    ev.ts           Expected value: win_probability × award_value − bid_cost
    eligibility-ai.ts  Claude Haiku eligibility assessment
  stripe/
    plans.ts        Plan definitions + feature limits
    gate.ts         Feature gating helpers
    subscription.ts Subscription status helpers

scripts/
  ingest/
    ingest-opportunities.ts   From UnitasConnect scraper JSON
    ingest-360giving.ts       360Giving API sync
    scrape-gtr.ts             UKRI Gateway to Research
    enrich-opportunities.ts   Enrichment pipeline
    normalise-funders.ts      Canonical funder names
  alerts/
    send-alerts.ts            Weekly digest + deadline + change alerts

supabase/migrations/          Numbered SQL migrations (001–007 + date-prefixed)
components/                   BetaBanner, CookieBanner, FadeIn
```

## Scoring engine (`lib/scoring/`)

Pure functions — **never** make DB calls inside `lib/scoring/`.

### Fit score (`fit.ts`)

Four components, each 0–25 (total 0–100):

| Component | Logic |
|-----------|-------|
| **Location** | Region match: org region vs `location_filters`; Cumbria/North West heuristics |
| **Sector** | Keyword overlap; inferred from title/description if `sector_filters` empty |
| **Income band** | Org band vs `income_bands` or inferred from amount range |
| **Deadline** | Weeks remaining: ≥3 weeks = full score; past deadline = 0 |

Key modifiers:
- **Regional bonus 1.2×** — Cumbria/North West/Lancaster targeted opportunities
- **Research penalty 0.6×** — VCSE/CIC applying to UKRI-style grants
- **Sector mismatch penalty 0.4×** — Farming/defence/nuclear/clinical without matching sector
- **GOV.UK private/individual penalty 0.5×**
- **Unknown baseline 50** — No filters and no inferred signal → neutral 50

### EV calculation (`ev.ts`)

```
award_value   = midpoint(amount_min, amount_max) | default 5,000 | cap 500,000
win_prob      = fit_score / 100
bid_cost      = £200 (<10k) | £500 (10k–50k) | £1,200 (50k–250k) | £2,500 (250k+)
ev            = win_prob × award_value
ev_net        = ev − bid_cost
```

If `amount_text` contains "million" or "budget", returns all zeros (info page, not a direct grant).

### AI eligibility (`eligibility-ai.ts`)

Calls Claude Haiku (`claude-haiku-4-5-20251001`). Returns:
- `certainty`: `strong_match | likely_eligible | check_eligibility | unlikely_match`
- `reasoning`: plain-English string
- Falls back to `check_eligibility` if `ANTHROPIC_API_KEY` is missing or call fails.

## Database (Supabase/Postgres)

Key tables: `organisations`, `opportunities`, `scores`, `pipeline`, `subscriptions`, `profiles`, `user_organisations`, `grants_awarded`.

Enums: `org_type` (vcse/sme/cic/other), `subscription_plan` (free/starter/pro/team/adviser), `pipeline_status` (interested/applying/submitted/won/lost).

RLS is enforced everywhere. Use the **service role** (`SUPABASE_SERVICE_ROLE_KEY`) only in API routes and ingest scripts.

## Subscription tiers

| Plan | Price | Pipeline | Orgs | Alerts | Exports |
|------|-------|----------|------|--------|---------|
| Free | £0 | 5 items | 1 | — | — |
| Starter | £35/mo | Unlimited | 1 | Weekly | — |
| Pro | £89/mo | Unlimited | 1 | All | CSV/PDF |
| Team | £199/mo | Unlimited | 5 | All | CSV/PDF |
| Adviser | £399/mo | Unlimited | Unlimited | All | Full + API |

## Environment variables

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_STARTER_PRICE_ID=
STRIPE_PRO_PRICE_ID=
STRIPE_TEAM_PRICE_ID=
STRIPE_ADVISER_PRICE_ID=

# Anthropic (optional — graceful fallback if missing)
ANTHROPIC_API_KEY=

# Cron protection
CRON_SECRET=
```

## Deployment workflow

1. Push to `master` → Vercel auto-deploys
2. Supabase migrations: `supabase db push` or apply SQL files in `supabase/migrations/` in order
3. Ingest scripts run via Vercel Cron (`/api/cron/daily-ingest`) or locally:
   - `npm run ingest` — UnitasConnect scraper
   - `npm run ingest:360` — 360Giving
   - `npm run ingest:gtr` — UKRI GTR
   - `npm run alerts` — Send alert emails

## Conventions

- **British English** in all UI copy and comments (`organisation`, `colour`, etc.)
- **Pure scoring** — No DB calls inside `lib/scoring/`; scores are deterministic
- **Explainable fit** — `match_reasons` is an array of plain-English strings shown in the UI
- **Auth** — Supabase JWT + RLS; service role only where explicitly needed
- **API** — REST under `app/api/`; all routes require Supabase session except webhooks

## Data quality — critical rules

- **Never invent data** — All opportunity fields come from source or are NULL
- **Funder names** — Must match exactly what appears on the funder's own website
- **Deadlines** — ISO date or NULL; never store "Rolling" as a date
- **Amounts** — Only store if explicitly stated; never estimate or infer
- **Scraper output** — Filter nav/error pages at source, not at ingest
- **Outreach emails** — Never guess org names, emails, or contact names; confirm from source
