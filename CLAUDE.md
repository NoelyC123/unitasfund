# UnitasFund — Project Context for AI Assistants

## What UnitasFund is

UnitasFund is a **UK funding intelligence platform** (Funding Intelligence OS), not just a database. It helps organisations discover, score, and track funding opportunities with explainable fit and expected value (EV).

**Target users:** VCSEs (voluntary, community, social enterprise), SMEs, consultants, CVS (Council for Voluntary Service) organisations.

## Tech stack

- **Frontend:** Next.js 14+ (App Router), React, TypeScript, Tailwind CSS
- **Auth & database:** Supabase (Postgres, Auth, optional Realtime)
- **API:** Next.js API routes under `app/api/` (thin layer over Supabase)
- **Scoring:** Pure TypeScript in `lib/scoring/` — fit score + EV; no DB inside scoring
- **Ingest:** Scripts in `scripts/ingest/` (pull from UnitasConnect scraper output or 360Giving)
- **Hosting:** Vercel (web + API); Supabase hosted

## Project layout (single Next.js app)

- **`app/`** — Next.js App Router: `(auth)/`, `(dashboard)/`, `api/`
- **`components/`** — React UI components
- **`lib/db/`** — Supabase client, types, helpers
- **`lib/scoring/`** — Fit scoring and EV calculation (pure logic)
- **`supabase/migrations/`** — Postgres migrations
- **`scripts/ingest/`** — Ingest scripts (scraper output, 360Giving sync)

## Core domain

- **Organisations** — The “client” (VCSE, SME, CIC). Profile used for fit scoring (region, sectors, income band, funding goals).
- **Opportunities** — Funding opportunities from scrapers / 360Giving. Stored with eligibility, amounts, deadlines, etc.
- **Scores** — Per (organisation, opportunity): fit score (0–100), fit breakdown (location, sector, income, deadline), EV, win probability, bid cost estimate.
- **Pipeline** — Track status per org/opportunity: interested, applying, submitted, won, lost.

## Key conventions

- Use **British English** in copy and comments where it matters (e.g. “organisation”, “colour” in UI strings).
- **Auth:** Supabase Auth (JWT); RLS for row-level security. Service role only in API/scripts when needed.
- **Scoring:** Implemented as pure functions; no database calls inside `lib/scoring/`. Breakdown is explainable (e.g. `fit_breakdown: { location: 1, sector: 0.8, income: 1, deadline: 0.9 }`).
- **API:** REST under `app/api/`; auth via Supabase session. Ingest endpoints (e.g. `/api/ingest/opportunities`) are for internal/cron use.

## Reference

- Full architecture (schema, API list, scoring logic, MVP phases): see `docs/` or the UnitasConnect repo doc **UNITASFUND_ARCHITECTURE_PLAN.md**.
- Do not build Adviser mode, billing, or public API in the initial skeleton; follow the plan’s MVP scope.
