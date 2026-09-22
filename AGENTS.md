<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Before you ship an edit: `npm run check`

Runs [`scripts/check-wiring.mjs`](scripts/check-wiring.mjs). It catches the one
failure shape that has cost this site the most, and that **nothing else catches**
— not TypeScript, not the build, not lint:

> an edit lands in code that isn't the live path, and nothing says so.

Real examples it exists for: `/promote` POSTed to `/api/promote`, which did not
exist (a missing App Router route returns **200 with the HTML shell**, not a 404,
so the form hung forever and every promoter application was discarded for
months); two byte-identical copies of `WeatherStrip`; `/crowdwave/forum` as a
stale copy of `/forum` with no content moderation; `profiles` and `user_profiles`
both live with ~20 paths reading the empty one.

It checks three things: every `fetch("/api/…")` resolves to a real route,
no two components share a filename, and nothing references a retired table.
It reads files only — no network, no database. The weekly audit runs it too.

## Social sign-in: `npm run check:auth`

A provider is turned on by adding its credentials in **Supabase → Authentication
→ Sign In / Providers**. `ENABLED` in [`app/components/SocialAuth.tsx`](app/components/SocialAuth.tsx)
only decides whether we *draw* the button. Draw one for a provider that is off
and tapping it dumps the visitor on a raw JSON error page — which shipped once,
on the signup screen.

`npm run check:auth` asks the live project which providers actually answer and
fails when the two disagree. Run it after editing that list **and** after
enabling anything in the dashboard. Unlike `npm run check` it does make one
network call per provider, so it is a separate command; it skips quietly when
`NEXT_PUBLIC_SUPABASE_URL` isn't set.

⚠️ **Apple is not free** — Sign in with Apple needs the Apple Developer Program
($99/year), and on the web flow Apple forces you to regenerate the client secret
**every 6 months** or the button starts failing. Don't enable it without a
calendar reminder.

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

Four sources, scoped to **75mi** around Nescopeck PA (100mi reached Philadelphia,
whose ticketed volume swamped NEPA entirely — 33 of 45 finds came from the
80–100mi band while Scranton and Wilkes-Barre returned nothing):
1. **Curated seeds** — auto-approved. Ones marked `annual: true` roll themselves
   forward a year once they finish, landing in the review queue as a *dated
   estimate* rather than going live unverified.
2. **Ticketmaster Discovery** — needs `TICKETMASTER_API_KEY`.
3. **SeatGeek Platform API** — needs `SEATGEEK_CLIENT_ID` (free, no secret used).
4. **Venue calendars** ([`utils/venueFeeds.ts`](utils/venueFeeds.ts)) — no key needed.

Sources 2 and 3 only index events sold through a box office, so they will never
find a 200-cap room or a farm stage. **They are also near-useless for EDM** — a
coverage check of Philadelphia's dedicated EDM rooms found *zero* of them in the
Ticketmaster sweep, because those clubs sell through Dice. Treat Ticketmaster as
a secondary source for big regional shows, not the backbone.

Source 4 is what actually covers this scene: a **curated** watchlist read three
ways —
- `kind: "events-calendar"` (default) — WordPress's *The Events Calendar* REST API
- `kind: "jsonld"` — schema.org `Event`/`MusicEvent` markup on a page
- `kind: "dice"` — a `dice.fm/venue/<slug>` page, for clubs that publish nothing
  of their own (most EDM rooms)

**Before adding a venue, run `node scripts/probe-venue-feed.mjs <site-url>`** — it
tries every reader and prints a ready-to-paste `VENUE_FEEDS` entry. If the venue's
own site is unreadable, find it on Dice with
`node scripts/probe-venue-feed.mjs --find "<venue name>"`. A venue that fails all
three can't be automated; use the manual add form on `/admin/events`. Check the
site's `robots.txt` before adding it.

⚠️ **Dice is read from `__NEXT_DATA__`**, Next.js's internal SSR payload — not a
documented API like the other two. It can change or vanish with any Dice deploy,
so the reader fails soft and logs loudly; a silent zero there means "check whether
Dice changed", not "no events". Prefer a venue's own JSON-LD when it has some.

The watchlist is curated, **not distance-filtered** — that's deliberate. A venue
worth covering goes in regardless of how tight the automated geo radius is set
(The Ave Live in Philadelphia is there for exactly this reason).

**Genre gate.** Individual shows from sources 2 and 3 must match `EDM_JAM_GENRES`
in `utils/localEvents.ts` — matched against the API's own genre classifications,
never the title. Multi-day events skip the gate (that's the festival this site
exists for). Curated seeds and the venue watchlist are hand-picked and never
gated. The gate is a **taste setting**: widen or narrow that one regex. Dropped
counts surface as `off-genre` in the `/admin/events` refresh readout, so a gate
that's too tight shows up as a number rather than a quiet empty page.

⚠️ Do **not** re-add a name-based festival exemption. It was tried and is worse
than useless: promoters put "festival" on anything, and the live queue contained
single-day listings called "The Nu-Metal Values Tribute Festival" and "Smoke on
the Mountain - Wellness Festival" that a name test waved past the gate.

⚠️ **Timezones:** JSON-LD `startDate` often arrives as a UTC instant. A club show
stamped `01:30:00Z` happens the *previous* evening in Eastern, so slicing the
first ten characters lists every late show a day late. `localDate()` handles
this; don't bypass it.

Discovery is otherwise optional but the page **goes stale without it** — that is
exactly how `/events` reached zero live events in Aug 2026. `/admin/events` shows
which sources are actually live, so check there before assuming any are running.

Garbage collection runs on the same pass: finished events and un-reviewed pending
events past their date flip to `status = 'archived'` — kept as the standing venue
record on `/events`, gone from the public list. Junk listings (parking passes,
hotel bundles, meet-and-greets) are filtered before they reach review.

**Identity is `dedup_key`**, computed by `dedupKey()`. Never hand-write one in SQL:
a non-canonical key inserts a duplicate instead of matching the existing row. A
unique index on `(name, city, start_date)` now backstops this.
