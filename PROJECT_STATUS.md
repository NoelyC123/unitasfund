# UnitasFund + UnitasConnect — Project Status

> **Last updated:** 21 March 2026
> **Owner:** Noel Collins, UnitasConnect Ltd
> **This file lives in both repos. Update it when milestones are hit.**

---

## What is this?

UnitasFund is a UK funding intelligence SaaS that matches charities, VCSEs, and SMEs to grant opportunities using AI-powered scoring, expected value calculations, and historical funder intelligence. UnitasConnect is the consulting arm: grant writing, bid writing, strategic planning.

Together they form an integrated funding operating system with no direct UK equivalent.

---

## Current state (21 March 2026)

### Platform (unitasfund repo)
- **Live at:** unitasfund.vercel.app
- **Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS 4, Supabase Postgres + Auth + RLS (West EU Ireland), Vercel, Stripe, Resend, Anthropic API
- **Scoring engine:** Pure TypeScript, zero DB calls. Fit score (4 components × 0–25 = 0–100), EV calculation (win_probability × award_value − bid_cost, capped £500k), match_reasons array
- **AI features:** Claude Haiku eligibility certainty badges (Strong Match / Likely Eligible / Check Eligibility / Unlikely Match)
- **Pipeline CRM:** Interested → Applying → Submitted → Won → Lost
- **Billing:** Stripe live — Free, Starter £29/mo, Pro £79/mo, Team £199/mo, Adviser £149/mo
- **Automation:** Vercel Cron daily ingest at 06:00, Resend email alerts (weekly digest)
- **Awarded grants:** 66,772 from UKRI GtR (33,919) + 360Giving API (32,853)
- **Paying users:** Zero. Pre-revenue. Beta onboarding is the immediate priority.

### Scraper engine (unitasconnect-engine repo)
- **Sources:** 19 active (FTS, UKRI, NLCF, GOV.UK Find Funding, Grants Online, Cumbria Growth Hub, Lancaster CVS, Cumbria Community Foundation, Charity Excellence, 360Giving, Lancashire Community Foundation, Arts Council England, Sport England, Tudor Trust, Garfield Weston, Lloyds Bank Foundation, Esmée Fairbairn, Paul Hamlyn, Henry Smith)
- **Output:** ~225 opportunities per run, 95 active after filtering
- **Architecture:** Python 3, threaded execution, per-source isolation, 90s wall-clock timeouts, 30s request timeouts
- **Local path:** ~/Documents/UnitasConnect-Engine-Root/unitasconnect
- **Output path:** scraper/output/ (timestamped JSON + CSV)

### Website (unitasconnect repo)
- **Live at:** unitasconnect.com
- **Stack:** Next.js, Vercel
- **Content:** Blog, services, contact form, Calendly booking

---

## Current development phase

**Phase 2: Trust** — ensuring top-ranked matches are credible and data is trustworthy.

### What was just completed (Week 0 — 15–21 March 2026)
- Stripe billing integration (all 5 tiers)
- AI eligibility certainty badges (Claude Haiku)
- 360Giving attribution and expanded to 40+ major UK funders
- False positive scoring fixes (AI override, sector penalties)
- Production reliability audit (8 trust fixes)
- Google Analytics tracking
- Beta banner with email contact
- Scraper expanded from 16 to 19 sources (Tudor Trust, Garfield Weston, Lloyds Bank Foundation, Esmée Fairbairn, Paul Hamlyn, Henry Smith added)
- CLAUDE.md files created for both repos

### What's next (Weeks 1–4)
1. **360Giving Datastore bulk load** — target 500,000+ grants in grants_awarded table. Contact data-support@threesixtygiving.org for Postgres credentials.
2. **New scraper sources** — Comic Relief, Children in Need, Joseph Rowntree Foundation, National Heritage Lottery Fund, Wellcome Trust
3. **GOV.UK Find a Grant** — switch from HTML scraping to official JSON API
4. **Licence classification** — classify all scraper sources by licence type, add OGL attribution where required
5. **FindThatCharity reconciliation** — resolve funder name mismatches to canonical identifiers
6. **Beta user onboarding** — 5–10 users from CVS outreach, 15-minute setup calls
7. **Weekly plan generator** — "Your week in funding" dashboard widget + Monday email digest

### What's next (Weeks 4–8)
- Decision Card UI (fit + eligibility + effort + EV + recommendation)
- ROI calculator page
- "Hours saved" tracking
- Weekly check-in calls with every beta user
- Convert pilot users to Starter (£29/mo) with founding price lock

---

## Key competitors
| Competitor | Threat level | Notes |
|---|---|---|
| **GrantRadar** | Watch closely | Embryonic, basic matching, free beta |
| **Plinth** | Medium | 60+ funders, 1,500+ charities, funder-side tool |
| **Instrumentl** | Low (US) | $55M raised but US-focused |
| **Idox GrantFinder** | Low tech / high data | £1k–5k/yr, 8,500+ opps, no AI |
| **DSC Funds Online** | Low | Legacy, no innovation |

**Our differentiator:** EV decisioning engine. The only UK platform combining AI eligibility + EV scoring + 360Giving intelligence + pipeline CRM + integrated consulting at £29/mo.

---

## Key dates
- **CIoF Fundraising Convention:** 4–5 June 2026 (submit to supplier directory)
- **G-Cloud 15 deadline:** Framework awards September 2026

---

## Repository structure
| Repo | Stack | Key paths |
|---|---|---|
| NoelyC123/unitasfund | Next.js, TypeScript | app/, lib/scoring/, scripts/ingest/, supabase/migrations/ |
| NoelyC123/unitasconnect-engine | Python 3 | scraper/sources/, scraper/config.py, scraper/main.py |
| NoelyC123/unitasconnect | Next.js | app/, components/, lib/posts.ts (blog) |

## Deployment
- **UnitasFund:** git push origin master → Vercel auto-deploys
- **UnitasConnect website:** same pattern
- **Scraper engine:** runs locally, outputs to scraper/output/
- **Ingest:** npm run ingest (local) or Vercel Cron at 06:00 daily

---

## Conventions
- Scoring functions must remain pure TypeScript (no DB calls)
- All schema changes via Supabase migrations
- New scraper sources follow the pattern in existing source files
- Never break the threading/timeout model in the scraper
- Scraper output format must remain compatible with the ingest pipeline
- 360Giving data is CC BY 4.0 — attribution required
- OGL sources require attribution statement
- The List (CC BY-NC) is a legal trap for commercial SaaS — do not use

---

> **When to update this file:** After adding new scraper sources, hitting revenue milestones, changing pricing, completing a development phase, or any decision that changes what's described above. Copy the updated file to both repos.
