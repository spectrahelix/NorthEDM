<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Project features

## FestDash — festival delivery network
Full spec, current state, data model, state machine, and phased build plan live
in [`docs/FESTDASH.md`](docs/FESTDASH.md). In short: festival-goers order from a
vendor set up at their festival, prepay into **escrow**, and a registered
**driver** delivers to their campsite guided by landmark directions + a **live
GPS ping**; delivery is confirmed by a **4-digit code (last 4 of the customer's
phone)**, after which escrowed funds release to the vendor's payout account.
Recommended integrations: **Stripe Connect** (escrow + vendor payouts — note
GoDaddy/Square don't fit this) and **Mapbox** (live map). Read the doc before
working on FestDash.

## Weekly site audit — automated, don't rebuild it
A GitHub Action (`.github/workflows/weekly-audit.yml`) runs **every Monday** and
on demand (Actions → Weekly Site Audit → Run workflow). It runs
`scripts/site-audit.mjs`, commits the refreshed [`docs/SITE_AUDIT.md`](docs/SITE_AUDIT.md),
and opens a dated GitHub issue labeled `weekly-audit`. **Report-only — it never
changes code or deploys.**

Covers: feature/route inventory, `npm audit`, TypeScript, migrations, env-var
checklist, and growth stats (users, recent signups, open bug reports) read via the
`audit_growth_stats()` RPC — a `SECURITY DEFINER` function only `service_role` may
call, using the `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` **Actions
secrets**.

For a deeper, judgment-based pass (RLS gaps, dead notification paths,
working-vs-merely-present features) run the **`/site-audit`** Claude command
(`.claude/commands/site-audit.md`).

## Promoter program & commissions
Lives at **`/promote`** (site-wide, not FestDash — old `/festdash/*` promoter URLs
redirect). Model and legal posture are in [`docs/WALLET.md`](docs/WALLET.md):
a promoter's permanent code gives the customer **10% off** and pays the promoter
**10% of list in cash**, so NorthEDM nets 80%. Commissions are **passed straight
through Stripe Connect** to the promoter's connected account — NorthEDM never holds
their money (this is deliberate: holding it would raise money-transmitter concerns).
There is **no user-funded wallet top-up** for the same reason. Read the doc before
touching commissions or payouts.

## Local events pipeline — automated, don't hand-edit rows
`/events` is filled by a nightly Vercel cron (`/api/cron/local-events`, 08:00 UTC)
running `runLocalEventsIngest()` in [`utils/localEvents.ts`](utils/localEvents.ts).
Review and approve at **`/admin/events`**.

Three sources, geo-scoped ~100mi around Nescopeck PA:
1. **Curated seeds** — auto-approved. Ones marked `annual: true` roll themselves
   forward a year once they finish, landing in the review queue as a *dated
   estimate* rather than going live unverified.
2. **Ticketmaster Discovery** — needs `TICKETMASTER_API_KEY`.
3. **SeatGeek Platform API** — needs `SEATGEEK_CLIENT_ID` (free, no secret used).

Discovery is optional but the page **goes stale without it** — that is exactly how
`/events` reached zero live events in Aug 2026. `/admin/events` shows which keys
are actually set, so check there before assuming discovery is running.

Garbage collection runs on the same pass: finished events and un-reviewed pending
events past their date flip to `status = 'archived'` — kept as the standing venue
record on `/events`, gone from the public list. Junk listings (parking passes,
hotel bundles, meet-and-greets) are filtered before they reach review.

**Identity is `dedup_key`**, computed by `dedupKey()`. Never hand-write one in SQL:
a non-canonical key inserts a duplicate instead of matching the existing row. A
unique index on `(name, city, start_date)` now backstops this.
