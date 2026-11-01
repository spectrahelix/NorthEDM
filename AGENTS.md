<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Don't guess. Verify, or say you haven't.

The expensive failures here did not come from hard bugs. They came from
confident claims nobody had checked.

## The rule

**A claim about the live site is only as good as the check behind it, and the
check must be able to fail.**

Before saying something works, ask: *what would I have seen if it were broken?*
If the answer is "the same thing", the check proved nothing — don't report it.

Checks that proved nothing on this site:

- Waiting for `/events` to return 200 after a deploy. It returned 200 on the
  old build too.
- Reporting a cron endpoint as `200` from an earlier run when it was `401`.
- Reading a file to confirm a fix while checked out on a stale local `main`,
  where every file still held its pre-fix contents.

A check that *can* fail: an empty POST to `/api/vendors` with a spoofed Chrome
user-agent returns `400 Missing required fields` on the old code and a silent
success on the new. Different answers, so the result means something.

## Pushed, merged, deployed, verified are four different things

Only the last is "done" or "fixed". Bot defenses once sat unmerged on a branch,
reported as shipped, while **seven more crawler submissions arrived**. Pushing
is not deploying.

If you have not watched production behave differently from before the change,
say so plainly rather than implying you have.

## Look for it before you write it

`/api/vendors` already had a honeypot, a timing trap and a rate limit when a
second copy of all three was written into `utils/botSignals.ts`. Two copies of
`WeatherStrip`, and `/crowdwave/forum` shadowing `/forum`, cost real money the
same way.

Grep for the *behaviour*, not just the filename, before adding a helper — and
when a second copy is the right call, delete the first in the same change.

## One sample is not a pattern

A crawler was reported as "a real person locked out" on the strength of one
submission with a plausible-looking journey. Three more, plus the page-view
traversal, said the opposite. Check the population before naming a cause.

Likewise, don't name a root cause you haven't tested end to end. Missing
SPF/DKIM was blamed for signups failing; a single real email sent through the
live route proved delivery was fine and the real fault was elsewhere.

## Branch hygiene after a squash merge

PRs are squash-merged, and force-push is not available in these sessions. Right
after a PR merges, run `git fetch origin main && git merge origin/main` on the
working branch **before starting new work** — at that moment both sides hold
identical content, so the merge is clean and the branch descends from `main`.
Skip it and the next PR shows conflicts in every file the squash touched; the
resolution is then "keep ours" once `git diff origin/main <pre-work tip>` is
proven empty, but that is a detour you don't need.

## Know which commit you're reading

`git checkout main` can land on a stale local branch. Confirm
`git log --oneline -1` matches `origin/main` before treating what you read as
current.

## When you don't know, say so

"I don't know yet — here is the check that would tell us." That costs one
message. A wrong guess costs a deploy cycle, plus the credibility of the next
report.

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

## Forms, photos and colours — use the shared pieces

Built for the first real vendor and now the standard for anything new:

- **Photo uploads:** `accept={ACCEPT_WEB_IMAGES}` and `await toWebImage(file)`
  from `utils/webImage.ts` before uploading. iPhones send HEIC, which only Safari
  can display. `npm run check` fails on a raw `accept="image/*"`.
- **Long forms** (anything a person fills in for more than a minute, especially
  with a photo picker): `useUnsavedDraft` from `utils/useUnsavedDraft.ts` restores
  the draft if a phone reloads the tab. The service worker already refuses to
  reload any page where someone has typed — don't add another reload path.
- **Owner-picked colours:** only from `ACCENT_CHOICES` in `utils/accent.ts`, shown
  with `AccentPicker`. Each was measured readable as text *and* behind black
  button text; a free colour input let owners make their own prices unreadable.

## Shop identity — theme + font per store

Each store has a **theme** (background, accent) and a **font** (names,
headings, prices). The owner picks both WITH the vendor when setting their
site up, in **/admin/stores**; vendors don't choose freely. Themes live in
`utils/storeThemes.ts` (built from the vendor's own logo palette and offered as
templates — Frank's four and Travis's four are there); fonts in `utils/storeFonts.ts` (curated,
free-licence, one weight) and are loaded in `app/fonts/shopFonts.ts`.

- **Operators choose their theme** on `/<slug>/manage` from the templates the
  owner ticked for their store in /admin/stores (`stores.theme_options`), or
  the standard NorthEDM backdrop. They also get **Store theme** and **Store
  font** pills (Custom/Standard → `allow_custom_theme` / `allow_custom_font`).
  The font itself is still set by the owner. Admins can also preview and save
  a look right on the store page (admin-only panel).
- **Logo:** `stores.logo_url`, shown at the top of the storefront (and as a
  faint watermark on themes with `watermark: true`). Operators/admins upload it
  on `/<slug>/manage` (`/api/store/<slug>/logo`, converted with
  `toWebImage(file, { keepTransparency: true })` so see-through logos stay
  see-through). Frank's and Travis's are served from `public/stores/`.
- Theme previews for the owner are rendered with the real page code against a
  mocked backend and measured for text contrast on the actual pixels — mock-up
  drawings drifted from what the code produced.
- A shop's **own pages** (`/<slug>`, `/marketplace/<id>`, item pages) show its
  theme and font. The main **/marketplace** keeps the NorthEDM look; only each
  shop's name uses its font there.
- Two switches can turn a shop font off: the **operator's** ("Show my custom
  font" on `/<slug>/manage`, `stores.allow_custom_font`) and the **visitor's**
  ("Shop fonts" pill, `ne_shop_fonts` cookie, remembered per device). Either off
  → standard font. Themes are unaffected by both.
- Descriptions and small print always stay in the standard font.
- Adding a theme: contrast-check its accent like `utils/accent.ts` (>= 4.5:1 as
  text on the theme's darkest area and behind black button text).
- `next/font` options must be written as literals in each call — a shared
  options object type-checks but fails the build.

## "Lights out" / "Lights on" — the owner's switch words

The owner's words for hiding a vendor who hasn't paid, and restoring them once
they do. Nothing is ever deleted either way. ("Draft view" / "public view" mean
the same thing — the owner tried those on 2026-10-18 and chose lights out/on.)

- **"Lights out <name>"** — hide the vendor AND their store from the public.
- **"Lights on <name>"** — restore both, exactly as before.
- Add **"store only"** (e.g. "lights out Frank, store only") to change just
  the store page and leave the marketplace listing as it is.

**Lights out** (hide from the public, keep everything):
1. `vendors.suspended_at = now()`, `suspended_reason = 'Pre-launch: hidden until
   invoice is paid'` (or the reason given). Same as **Vendors → Suspend** in
   /admin. Leave `is_public`, `vendor_type` and everything else untouched —
   that is what makes "lights on" restore them exactly. Skip for "store only".
2. Their store (`stores`, found via `store_vendors`): `active = false`
   (draft). Make sure `owner_user_id` is the vendor's own account so they can
   still set it up at `/<slug>/manage`.
3. Keep `user_profiles.vendor_id` + `is_marketplace` on their account so they
   can keep building inventory at `/vendor/dashboard`.

**Lights on** (back exactly as before):
1. Clear `suspended_at` and `suspended_reason` — **Vendors → Restore public
   view** in /admin. Skip for "store only".
2. Their store: `active = true`, `billing_status = 'active'` — **Embedded
   Stores → Publish** in /admin.

**Verify, don't assume.** Logged out, after lights out: `/marketplace/<id>`,
`/marketplace/<id>/item/<itemId>` and `/<store slug>` return 404; the vendor is
absent from `/`, `/marketplace`, `/feed`, `/festdash`, `/api/search?q=<name>` and
`/api/festdash/vendors`; `/api/festdash/menu/<id>` is empty. Then read the
database directly with the publishable key (`<project>/rest/v1/<table>?select=*`
with `apikey` + `Authorization: Bearer` headers) for `vendors`, `products`,
`product_images`, `stores`, `store_vendors`, `festdash_vendors`, `vendor_shows`:
all must come back empty for that vendor. Repeat as a signed-in regular customer
(Splunk) — `festdash_vendors` isn't readable logged out at all, so a logged-out
probe of it proves nothing. After lights on, the same checks show them. Compare
against a vendor that is still public, so a broken page can't pass.

**Hand-written vendor cards** (typed into a page, not read from the database)
don't obey suspension on their own — Frank's featured cards on `/` and
`/marketplace` stayed up after lights out on 2026-10-18. Every such card
(Frank, Homestead Life, CarlyIsFunny on `/`, `/marketplace`, `/feed`) is now
gated with `publicVendorIds([...])` / `vendorIsPublic(id)` from
`utils/vendorVisibility.ts`. Add any new one the same way.

**`/portfolio` is exempt.** It is the owner's credits list for NorthEDM's own
work, not a storefront; the vendor names on it (Frank's General Store included)
stay up through lights out. Owner's decision, 2026-10-21 — don't "fix" it.

**Pages are not the security boundary — RLS is.** On 2026-10-21 every page
404'd correctly while `festdash_vendors`, `store_vendors` and `vendor_shows`
were readable in full through the REST API with the publishable key (ids, join
dates, the operator's user id, `stripe_account_id`). Side tables now follow the
vendors table's own RLS (`exists (select 1 from public.vendors v where v.id =
vendor_id)`), and `festdash_vendors` grants anon/authenticated only
`id, vendor_id, is_active, joined_at` (a column-level REVOKE alone does nothing
while a table-wide SELECT grant exists — verified). Any new table that names a
vendor gets the same treatment. Money paths enforce it too: `/api/festdash/orders`
re-prices every line from `products` and refuses a vendor that isn't approved,
listed, unsuspended and active on FestDash; store checkout refuses a suspended
vendor's items.

Suspension is enforced in RLS (`vendor_is_suspended()`), but anything read
with the service role skips RLS and must filter `suspended_at` itself — the
`/festdash` vendor list once leaked a hidden vendor this way.

**Private columns are grant-protected (2026-11-01 audit).** Two tables hide
columns from `anon` and `authenticated` at the database level, so a
`select("*")` on them fails with "permission denied" for every ordinary
session (admins' sessions included) and the page renders empty:

- `user_profiles`: `full_name, phone, address_line1/2, city, region,
  postal_code, pending_email, email_change_*`. Read `PROFILE_COLUMNS` from
  `utils/supabase/user-profiles.ts`; the owner gets their own private fields
  from the `my_private_profile()` RPC (jsonb).
- `vendors`: `email` (personal), `first_name`, `last_name`. Read
  `VENDOR_PUBLIC_COLUMNS` from `utils/vendorColumns.ts`; the vendor and admins
  get the private three from `vendor_private_contact(p_vendor_id)`. The
  public contact address is `business_email`. The old `vendors_public` view
  still selects `email` and is unusable — it was already unused.

The service role reads everything. `npm run check` (section 5) fails on a
`select("*")` against either table unless the receiver is a service-role
client. Direct inserts into `vendors` are closed too: applications arrive only
through `/api/vendors`, which writes with the service role after its bot
checks.

**FestDash orders are written only by the server.** Ordinary sessions can no
longer insert or update `festdash_orders`; `/api/festdash/orders` prices every
line and `/api/festdash/orders/[id]` runs the state machine, the delivery code
and the Stripe capture, all with the service role. The one end-user write left
is the assigned runner's `driver_lat/lng/location_updated_at`. The runner pool
API never returns the customer's phone (the delivery code is its last four
digits), email, or payment fields.

**Runners need activation.** Anyone can register at `/festdash/driver`, but
they land `is_active = false` and see a "waiting" screen. The owner gets an
in-app / push / email alert and switches them on under **Runners** in
`/admin/festdash`. The `protect_runner_activation` trigger ignores `is_active`
on every non-service-role write, so a direct API call can't self-activate.
An active runner sees every open order's campsite details — treat it as a
decision about a person, not a default.

**Permissions-Policy must keep `geolocation=(self)`.** An empty allowlist
(`geolocation=()`) disables location for our own pages too; that is why the
runner's live ping never worked before 2026-11-01.

**Post-sign-in redirects go through `safeNext()`** (`utils/safeRedirect.ts`):
only a same-site path is accepted as a `next` value.

**Dependencies:** `npm audit` runs at session start. Next.js must stay at
16.4.1 or newer (two remote-code-execution advisories cover every 16.x up to
16.4.0). Moderate findings left in `eslint`/`@capacitor/cli` are lint tooling,
not runtime.

**Mapbox:** the one map component is `app/components/festdash/LiveMap.tsx`
(track page, runner console, campsite pin picker). It renders only when
`NEXT_PUBLIC_MAPBOX_TOKEN` is set — a *public* token, URL-restricted in the
Mapbox dashboard to the site's domains — and every caller falls back to text
without it.

## Gambia / coordinator model ("purse keeper") — stage one, 2026-11-01

A regional **coordinator** (Gee, The Gambia) signs up local shops, collects
their flat monthly fee and customers' payments **locally**, keeps his cut,
pays the shops, and sends the owner's share by Remitly. **No money moves
through the site; it records what moved and who confirmed it.** Full design in
[`docs/FESTDASH.md`](docs/FESTDASH.md#gambia--coordinator-model).

- A shop is "in the model" when `vendors.coordinator_user_id` is set (owner
  does this in **/admin/festdash/coordinators**, with `currency` = `GMD` and
  the shop's WhatsApp). Such a shop is listed on FestDash **only while a
  `vendor_subscriptions` period is current** (both `/api/festdash/vendors` and
  the `/festdash` page apply this), and its checkout offers **Wave / QMoney /
  Afrimoney / cash on delivery** instead of Stripe. Never a card.
- Wallet order → `status = awaiting_confirmation`, `payment_to` snapshots the
  purse keeper's wallet number, the customer submits their transaction ref
  (`/api/festdash/orders/[id]/payment-ref`), the coordinator confirms in
  **/festdash/purse** (`…/confirm-payment`) → `pending`, `payment_status =
  paid_mobile`. Cash → straight to `pending`, `payment_status = cod`, settled
  (`paid_cash`) when the delivery code is entered. Both book a `sale` row in
  `coordinator_ledger` with the split; the booking is idempotent per order.
- **Splits are settings, not code**: `coordinator_program_settings` (sale
  shop 80 / owner 10 / coordinator 10; fee $30 of which coordinator 10%).
  Change them in the admin page, never by editing percentages in a route.
- The coordinator's book: `coordinator_ledger` (`sale` | `subscription` |
  `remittance`). Sales are in the shop's currency; fees in USD; a remittance
  is whatever the coordinator sent, and the **owner confirms the USD that
  landed** in /admin/festdash/coordinators. "Owed" = owner share − sent.
- `is_coordinator` and all wallet numbers are written only by API routes
  (service role). `festdash_promoters` has no end-user UPDATE policy, so a
  promoter cannot make themselves a coordinator.
- Stage two (not built): a Wave Business API or Gambian aggregator webhook
  auto-confirms wallet payments. It needs a Gambian business account only the
  coordinator can open; it changes nothing in the data model.
- **Shop owners self-onboard at `/festdash/shop-setup`** (the QR on Gee's
  flyer). One application creates the pending vendor with its payout wallets
  (`vendors.payout_wallets`, private), WhatsApp, area, the coordinator code
  that links it to its purse keeper, and `terms_accepted_at`. **Approving it in
  /admin/vendors also enrols it on FestDash** (`enrollCoordinatorShop`); it
  goes live when the coordinator logs the first fee. The page is state-aware:
  account → application → coordinator/fee → add items.
- **Signup carries `?next=`** end to end (signup page → `/api/auth/signup` →
  confirm link → `finalizeAuthedUser(supabase, next)`), so a QR visitor lands
  back on the walkthrough after verifying. New users without a `next` still
  start at `/profile/edit?welcome=1`.
- **Emailed links are built only from our own origin** (`safeOrigin()` in
  `utils/safeRedirect.ts`). The three auth routes used to take `origin` from
  the request body, which let a forged request send someone an official email
  pointing elsewhere.
- **Payment timing notes** live in `utils/paymentNotes.ts` and are deliberately
  hedged ("usually", provider-set). Don't state a provider's SLA we haven't
  measured.
- **Runner pool now carries `payment_method`**: a cash order shows the runner
  "collect D… at handover". Keep that in any pool-column edit.
- **Every `festdash_orders` write is the service role** except the runner's
  GPS columns. The 2026-11-01 lockdown closed end-user inserts, and the order
  route's insert was still on the customer's session — it broke under the
  lockdown and was caught before any live order hit it. Don't add a write on
  the user client; `npm run check` doesn't catch this one, the scan in the
  audit notes does.

Currently lights out (update this list when it changes):
- **The Obsidian Cloak** — vendor 22, store `theobsidiancloak`, Travis
  (tzaminski@gmail.com). Since 2026-10-10.
- **Find It @ Franks General Store** — vendor 5, store `franks`. Was Featured;
  restores as Featured. Since 2026-10-18. Run by **Kody**
  (shieldskody7@gmail.com, the linked account and store operator) and
  **Frank**, who has no account yet. Owner's decision: **both are operators**.
  When Frank signs up, ADD him — set his `user_profiles.vendor_id = 5` and
  `is_marketplace = true` — and do NOT use the admin "Link to account" button,
  which moves the vendor to one account and removes Kody. Stores support one
  `owner_user_id` today, so making Frank a store operator too needs co-operator
  support added first; ask the owner before building it.

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
