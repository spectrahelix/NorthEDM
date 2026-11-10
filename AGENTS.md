<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

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

## Pull requests open automatically (owner's standing instruction, 2026-11-03)

When work is committed and pushed to the session's branch, **open a pull
request against `main` right away** — don't wait to be asked. This overrides
any default of "only open a PR when the user asks". One PR per branch: if one
is already open for it, push to it instead of opening another.

**Merging is automatic too** (owner's standing instruction, 2026-11-03,
given in conversation): once the PR's checks are green on its current head
(Vercel deployment Ready, any other CI passing) and it is mergeable, squash-
merge it without asking. Never merge a red or conflicted PR — fix it first.
After every merge: sync the branch (`git fetch origin main && git merge
origin/main`, see below) and **verify production** with a check that could
fail, as described above (pushed ≠ merged ≠ deployed ≠ verified). Report
what was merged and what was verified live. The owner can turn this off by
saying so; then go back to waiting for "merge".

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
- **Studio product photos (2026-11-04):** the square cropper every item photo
  goes through (`ImageCropper`) has **✨ Studio**: tap the item and it's cut out
  of the photo, hand and floor included, and set on a backdrop
  (`PhotoStudio`). It runs Segment Anything (SlimSAM) on the owner's own device
  through transformers.js, loaded from jsDelivr only when Studio opens, with the
  model kept in browser cache. The version is pinned in
  `utils/productStudio/segment.ts` and must match `package.json`. One
  implementation in `utils/productStudio/` serves the site and the agent skill
  `.claude/skills/product-photo` (`scripts/product-photo.mjs`, agent
  `product-photographer`). Backdrops come only from `BACKDROPS`. Fix cut-out
  quality there, not in a one-off script.
- **Sizes of one item (2026-11-05):** "one picture per mushroom, with weight
  buttons". Each size is its own `products` row, with its own price, stock,
  shipping weight and receipt name, so checkout, stock and shipping are
  unchanged. Sizes are grouped by `variant_of` (the lead row's id) with
  `variant_label` as the button text ("3.5 g", "1 oz", "30 ml").
  `groupVariants()` in `utils/productVariants.ts` makes one card per item on
  the store page (size buttons showing weight + price, which drive the price
  and Add), the vendor page ("from" price) and the owner's "Not on sale yet"
  section. The item page shows a size button per sibling. Add a new size as a
  new row pointing at the lead; never as a separate card.
- **Stock is optional (2026-11-05, owner):** `products.inventory_count` NULL
  means **no limit** — the item lists and sells by its sizes with no count; a
  number is limited stock, counted down on paid orders and never below 0.
  `utils/stock.ts` is the one rule: `hasStock()` (checkout, FestDash order),
  `IN_STOCK_FILTER` (store page, FestDash menu), `stockFromInput()` (blank box →
  NULL, both product APIs), `adjustedCount()` (unlimited stays unlimited).
  The editor and the inventory form leave the stock box blank by default.
- **Off-sale sizes still show (2026-11-05, owner):** the store page lists every
  size of every item of its visible vendors. A size that isn't on sale (or a
  limited stock at 0) is shown struck through with "Out of stock" and can't be
  added; an item with no size on sale gets a red corner-to-corner **OUT OF
  STOCK** banner over its photo and isn't linked (its page isn't public). The
  item page lists off-sale sibling sizes the same way. Off-sale rows are read
  with the service role, display fields only (name, size, photo, price).
- **Item requests (2026-11-05, owner):** one button at the **top and bottom**
  of every store — "Couldn't find what you were looking for? → request here.
  I may be able to get it!" — not a box per card (the owner tried that and
  found it too much). It opens a pop-up (`ItemRequestButton` in
  `app/[store]/ItemRequest.tsx`): pick one of the shop's items/sizes or type
  anything, how many, a note. `/api/store/<slug>/requests`, table
  `product_requests` (`product_id` or `item_text`), service role only. Push
  guard: one request per person per item, or per thing typed (unique indexes;
  a repeat is 409), plus `shieldForm` (10/h). The operator gets a bell + email
  (the NorthEDM shop also alerts the owner's phone via `notifyProductRequest`),
  the **Edit shop** button shows "· N item requests", and Edit shop lists them
  (`ItemRequestsPanel`, Done / Dismiss / Message). Only the requester's
  username leaves the server — never an email.
- **"Join us Online" (2026-11-05, owner):** `JoinUsOnline` shows "Join us
  Online for quick responses and updates!" with NorthEDM's Facebook and
  Instagram buttons on forms, pop-ups and confirmation screens (item request,
  bug report, feedback, signup, sign-in help, promote, marketplace + vendor
  apply, shop setup, store pages). The links live only in `utils/socials.ts`;
  a blank one hides its button and both blank hide the block. Never guess an
  address — fill in what the owner gives.
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
client.

⚠️ **Every new column on `vendors` or `user_profiles` is invisible to
ordinary sessions until you `grant select (col) ... to anon, authenticated`.**
Column-level grants mean a new column has no grant at all, and any query that
names it fails with "permission denied" — the FestDash vendor list went empty
site-wide for an hour on 2026-11-03 after `pickup_location` shipped without
one. Put the grant in the same migration as the column (private columns
excepted), and probe the live REST API with the publishable key afterwards. Direct inserts into `vendors` are closed too: applications arrive only
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

**Admin account editor (2026-11-02).** /admin/users → Edit is the one place
to see and change an account: login facts (confirmed, provider, last sign-in),
email change, display name + username, the **private personal details from
signup** (full name, phone, address — read via `/api/admin/user-details`,
written via `/api/admin/edit-user`, both service role), public profile, rank
and every tag. Ranks are `drifter, wanderer, merchant, promoter, warden,
archon` in both dropdowns. The **Promoter** tag goes through
`utils/promoters.ts` (`grantPromoter` / `revokePromoter`): it creates the
promoter row and referral code, the same path as approving an application, so
a tag never exists without a code behind it.

**Ranks: one primary + extra ranks (2026-11-04).** `user_profiles.role` is the
primary rank (badge, and admin power for warden/archon); `extra_ranks text[]`
holds more non-admin ranks (`wanderer | merchant | promoter`, DB check) whose
abilities the person also has. One implementation, `utils/ranks.ts`:
`hasRank()` (archon holds every rank), `canSell()` (seller tags, Merchant rank,
archon, warden — used by `canManageInventory`, the inventory dashboard and the
/marketplace CTA), `canEditRanks()`. Archons and wardens edit anyone's extra
ranks (a warden not an archon's); **site moderators** (`is_site_moderator`,
set only by an archon) edit non-admins' but never their own. UI: `RankEditor`
on every profile page; API `/api/ranks` (service role — `protect_role_flags`
discards both columns on every ordinary write, verified 2026-11-04). Giving
the Promoter rank also creates the promoter row + code (`grantPromoter`).
The owner's archon account (cjblue) runs vendor 37 **"NorthEDM" — the main
brand shop** (owner's decision, 2026-11-05; public, featured). It sells
through its own embedded store **`/northedm`** (store slug `northedm`, vendor
37 its only member, platform/operator fee 0). `/shop` redirects everyone
there (`utils/brandShop.ts`), except a shop owner, whose /shop is still their
own store. Items go in on /vendor/dashboard like any shop. Its sales are
NorthEDM's own money: `settleStoreOrder` makes no vendor payouts for it.
**Discounts at the brand shop** (owner, 2026-11-05; `brandDiscount()` in
`utils/brandShop.ts`), one code box on /northedm only:
- a promoter's code → `brand_code_discount_bps` (5%) off the items, and that
  promoter earns `brand_code_commission_bps` (5%) of the discounted items as a
  `store_order` commission — **booked only if their payout account
  (`festdash_promoters.stripe_account_id`) is connected when the order is
  paid**, then paid by the commissions cron;
- **an active promoter buying for themselves always gets the 5%**, no code,
  no commission;
- a **discount coupon** (`discount_codes`) **stacks** on the promoter 5%
  (percent coupons on the items after the 5%); it is spent at settlement
  (`redeemCode`). A coupon a promoter minted attributes them.
Stripe Checkout takes one coupon, so the stacked total goes as one USD
amount-off coupon (Adaptive Pricing is off for discounted orders). Both rates
are on /admin/festdash/coordinators. The transfer fee never applies here: it
is only for shops outside the US. The older `shop_products` storefront (/admin/shop, /shop/[slug], cart)
held no products and is no longer reached from /shop; its code is left in
place (store credit is spent through its checkout) until the owner decides
whether to retire it.

**Ranks vs tags (owner, 2026-11-05).** A **rank** is where someone stands —
one each: Drifter (new), Wanderer (regular), Warden (moderator), Archon (admin)
(`SITE_RANKS` / `RANK_INFO` in `utils/ranks.ts`). Everything someone is
approved *for* is a **tag**, any number of them: Merchant, Promoter, FestDash,
Vendor, Driver, Artisan, Forager, Founder (`MEMBER_TAGS` in
`app/components/roleColors.ts`). Merchant and Promoter used to be ranks; on
2026-11-05 everyone holding them moved to Wanderer with the same abilities as
tags. **`setMemberTag()` in `utils/memberTags.ts` is the only way a tag is
given or taken** (`/api/admin/user-tags`, `/api/ranks`, promoter approval,
admin create-user): Merchant = `is_marketplace` + "merchant" in `extra_ranks`
(what `canSell()` reads — lets them build a shop, never makes it public);
Promoter = `grantPromoter`/`revokePromoter` + "promoter" in `extra_ranks`.
Rank routes accept only the four ranks; a warden can't make or change an
archon. The public **Verified** badge is no longer shown. "Verified" now means what
the site enforces — a confirmed email (`public.is_verified()`) — and only
admins see it: /admin/users shows "✔ Email verified" or, if not, **Resend
verification email** (the same `/api/auth/resend-confirmation` the signup
screen uses). **Public shop** in
/admin/users is a separate switch on the person's vendor: Vendors → Suspend /
Restore (`/api/vendors/update`, `suspended_at`, i.e. lights out/on). It never
touches products, sizes, prices or what's on sale; a shop never approved or
listed is set up in /admin/vendors first. ⚠️ `protect_role_flags` keeps every
tag column unless the writer is the service role — a SQL migration that sets
them must `set_config('request.jwt.claim.role', 'service_role', true)` first,
or the update silently does nothing (it did, once, on 2026-11-05).

**Usernames.** One rule, `utils/username.ts` (`USERNAME_RE`, reserved names,
`usernameProblem()`); don't paste the regex again. `user_profiles.username_chosen_at`
marks that the person picked or kept their name: the email signup form stamps
it (the username box is **optional** since 2026-11-05 — left blank, the signup
API uses the email prefix via `suggestUsername()`, adding digits if it's taken
or reserved, and the form says so under the box), Google sign-ins (email-prefix username from `finalizeAuthedUser`) and
admin-created accounts don't, and the layout shows `UsernamePrompt` once to any
signed-in profile without the stamp (`/api/profile/username` checks and saves;
"Later" hides it for the browser session). Existing accounts were backfilled as
chosen on 2026-11-02 so nobody was prompted retroactively.

**Every form is shielded (2026-11-02).** `shieldForm(req, body, bucket)` in
`utils/botSignals.ts` is the one server check (honeypot `company_website`,
`elapsedMs` under 2.5s, Chromium-without-`sec-ch-ua`, per-IP success throttle);
`useFormShield()` + `<Honeypot/>` in `app/components/FormShield.tsx` is the
client half. Applied to promote, marketplace apply, feedback, runner
registration, shop-setup, foraging booking, service requests and bug reports
on top of the verified-account gate; `/api/vendors`, signup and signin-help
keep their earlier inline versions. Call `shield.record()` only after the
write succeeded. New form → both halves, nothing hand-rolled.

**Promoter commissions paid outside Stripe.** A promoter Stripe Connect and
PayPal can't pay (The Gambia) is settled by the owner by Remitly; **Paid by
Remitly** on /admin/promoter-payouts marks the row `paid` with
`payout_method = 'manual'` and the note. No money moves.

**Dependencies:** `npm audit` runs at session start. Next.js must stay at
16.4.1 or newer (two remote-code-execution advisories cover every 16.x up to
16.4.0). Moderate findings left in `eslint`/`@capacitor/cli` are lint tooling,
not runtime.

**Mapbox:** the one map component is `app/components/festdash/LiveMap.tsx`
(track page, runner console, campsite pin picker). It renders only when
`NEXT_PUBLIC_MAPBOX_TOKEN` is set — a *public* token, URL-restricted in the
Mapbox dashboard to the site's domains (verified 2026-11-06: styles and
walking directions answer for www.northedm.com, directions are refused from
other sites) — and every caller falls back to text without it.
**Map upgrade (owner, 2026-11-06):** looks **Satellite** (default),
**Outdoors** (trails, woods, contours) and **Dark**, switched on the map and
remembered per device (`ne_map_style`); a **walking route** from Mapbox
walking directions, re-asked only when an end moves 25 m or a minute passes,
replaced by a dashed straight line + distance + compass direction when there's
no path or the path is a big detour (festival fields rarely have mapped
footpaths); the camera stops following once someone pans/zooms by hand
(**Re-centre** brings it back). **Customer live location is opt-in**:
`CustomerLiveShare` on the track page → `/api/festdash/orders/[id]/customer-location`
→ table `festdash_customer_live` (service role only, never on the order row,
because the shop can read order rows); only the runner assigned to an
in-transit order can read it, positions older than 10 minutes aren't
returned, and it's deleted when sharing stops or the order is delivered /
declined. The runner console polls it every 15 s and routes to the customer
instead of the campsite pin. `useWakeLock` (`utils/useWakeLock.ts`) keeps
the screen on while a runner has a delivery in transit or a customer is
sharing — browsers stop location when the screen locks.

## Gambia / coordinator model ("purse keeper") — stage one, 2026-11-01

> ### ⛔ OWNER'S TO-DO — FIRST STEP: GET A PASSPORT (2026-11-05)
> The owner does not have a passport yet. **Nothing on the Gambian business
> route can start without it**: registering NorthEDM LLC in The Gambia as a
> foreign company, the Ecobank account (owner = sole signatory), and the
> Waychit / Modem Pay merchant account all need the owner's passport
> (notarised → US State Dept authentication → Gambian embassy legalisation).
> Order once the passport exists: (1) Gambian law firm as local agent +
> registered office, NorthEDM LLC filed as a foreign company (form CO38);
> (2) company TIN at GRA; (3) Ecobank account, owner sole signatory; (4)
> Waychit and/or Modem Pay in the company's name, keys and login the
> owner's. Gee is **not** part of this route (owner's decision, 2026-11-05):
> he only receives payouts to his own wallet. Don't propose a route that puts
> the company, the account or the keys in Gee's name.
>
> **Until then — card / Google Pay only for every Gambian shop**
> (`utils/localRules.ts`, owner's decision 2026-11-05). Wave / QMoney /
> Afrimoney and Waychit are off (`coordinator_program_settings.local_wallets_enabled`
> = false; both checkouts refuse them, and the order page and store cart hide
> them and pre-select card). Every card order from a wallet-rail shop adds a
> **transfer fee** — `remit_fee_bps`, **3% of the order** (owner, 2026-11-05;
> items after any code + runner fee + service fee; rounded up to a whole
> dalasi) — stored as `remit_fee_cents` on `festdash_orders` / `store_orders`,
> shown as "Transfer fee" on its own line and its own Stripe line item, and
> kept by the owner outside the split (`recordSaleSplit` treats it like the
> service fee). `transferFeeCents()` is the one formula. The
> Gambia country hub (/marketplace/country/GM) pins these rules; the small
> `IntlPaymentNote` (owner's wording) sits on /festdash, the FestDash order
> page, store carts, signup, shop-setup and the pass page.

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
  Afrimoney** instead of Stripe. Never a card, and since 2026-11-02 no cash on
  delivery either: an order reaches the shop only after its payment is confirmed.
- Wallet order → `status = awaiting_confirmation`, `payment_to` snapshots the
  purse keeper's wallet number, the customer submits their transaction ref
  (`/api/festdash/orders/[id]/payment-ref`), the coordinator confirms in
  **/festdash/purse** (`…/confirm-payment`) → `pending`, `payment_status =
  paid_mobile`. Cash → straight to `pending`, `payment_status = cod`, settled
  (`paid_cash`) when the delivery code is entered. Both book a `sale` row in
  `coordinator_ledger` with the split; the booking is idempotent per order.
- **Splits are settings, not code**: `coordinator_program_settings`. Since
  2026-11-03 (owner's rule): **every shop keeps 90% of a store, marketplace
  or FestDash PICKUP sale, referred or not; a FestDash order a runner delivers
  takes `delivery_extra_bps` (1000) more, so the shop keeps 80% of those** —
  the network pays for delivery (the runner fee itself stays a customer-paid
  add-on, outside the split). `sale_owner_bps` (1000) is the platform's base share; the promoter /
  coordinator who signed the shop up gets `sale_coordinator_bps` (500) of the
  sale **out of that share**, NorthEDM the rest; with no promoter NorthEDM
  keeps all of it. `splitSale()` / `platformShareBps()` in `utils/gambiaPay.ts`
  are the one implementation; the admin page refuses a promoter part larger
  than the platform share. Fee: $30 of which coordinator 10%. Change numbers in
  the admin page, never by editing percentages in a route. The platform share
  is the **Stripe application fee on US card orders** (10%, vendor keeps 90%);
  the promoter's part is booked as a `festdash_order` commission at delivery
  and paid through Stripe Connect by the commissions cron. The rail is `isLocalRail()` in
  `utils/gambiaPay.ts`: coordinator **and** non-USD currency → wallets/cash and
  the fee gate; a USD vendor with a coordinator stays on card checkout.
- The coordinator's book: `coordinator_ledger` (`sale` | `subscription` |
  `remittance`). Sales are in the shop's currency; fees in USD; a remittance
  is whatever the coordinator sent, and the **owner confirms the USD that
  landed** in /admin/festdash/coordinators. "Owed" = owner share − sent.
- `is_coordinator` and all wallet numbers are written only by API routes
  (service role). `festdash_promoters` has no end-user UPDATE policy, so a
  promoter cannot make themselves a coordinator.
- **Stage two — the Gambian payment bridge (owner's decision, 2026-11-03;
  not built yet).** Gambian wallets (Wave, QMoney, Afrimoney) are domestic and
  can never pay a US account, so the owner's share must first settle into a
  Gambian bank account through a licensed aggregator, then be wired out.
  **Provider preference: Waychit first, Modem Pay second** — both advertise
  one API for Wave + QMoney + Afrimoney + cards with a hosted payment page and
  a signed webhook; use whichever opens a merchant account first in that
  order, and confirm fees, settlement time and KYC documents in writing before
  building (Waychit says it has NO sandbox: test payments move real money).
  Prerequisites, in order: (1) a registered Gambian business + GRA TIN —
  preferably a company the owner controls with Gee as local representative,
  so settlement lands with the owner, not with Gee; (2) a Gambian business
  bank account that can send outbound USD transfers (ask the bank what papers
  it needs — the site's invoice documents serve); (3) the aggregator merchant
  account; (4) a Gambian lawyer's confirmation that a merchant behind a
  licensed aggregator needs no payment-provider licence of its own. Build
  then: checkout sends the buyer to the aggregator's payment page instead of
  showing a wallet number, the webhook replaces the coordinator's manual
  confirm, shop + coordinator shares are paid out locally from the settled
  funds, the owner's share stays in the Gambian account for the bank wire.
  The ledger's data model does not change. The final wire out of the country
  is a bank operation, not an API — it stays manual. **The aggregator's fee
  is passed to the customer** (owner's decision, 2026-11-04): Waychit charges
  3% on Wave / QMoney / Afrimoney / bank payments (4.8% on cards — cards stay
  on Stripe, so only the 3% applies), deducted before settlement. Checkout
  adds it to the customer's total as a separate "payment processing" line,
  so the shop's 90% (80% delivered) and the platform share are computed on
  the items exactly as today and arrive whole. Make the rate a setting in
  `coordinator_program_settings`, not a constant. Ask Waychit in writing
  whether its merchant agreement allows passing the fee on before going live. **Intake is built
  (2026-11-03):** the coordinator enters business, bank and provider details
  in the **Payment bridge** card on /festdash/purse (`BridgeIntake`,
  `/api/festdash/purse/bridge`), saves as they go and presses *Submit to
  NorthEDM* (owner alerted); the owner reviews them under **Payment bridge
  intake** on /admin/festdash/coordinators (`BridgeReview`,
  `/api/festdash/admin/bridge`) and sets draft → submitted → verified → live.
  **Every shop gets the same intake** (owner's instruction, 2026-11-03): a
  non-USD shop sees the card on /vendor (My Shop) and on step 4 of
  /festdash/shop-setup once approved (`/api/vendor/bridge`, one row per
  `vendor_id`); a coordinator's own row has `vendor_id` null. Both go through
  `saveBridge()` in `utils/bridge.ts`. The owner's panel labels each row
  "(shop)" or "(coordinator)". US shops use Stripe Connect instead.
  Table `coordinator_bridge`: no end-user grant at all, service role only;
  API keys, webhook secret, account number and TIN leave the server masked
  to their last four characters. Status *live* is a label until the provider
  integration is written.
- **Waychit into NorthEDM's OWN merchant account — built, SWITCHED OFF
  (2026-11-04).** Owner's decision: one Waychit merchant account that the owner
  controls takes Wave / QMoney / Afrimoney, and NorthEDM pays shops,
  coordinators and runners from it (Waychit Payouts). `utils/waychit.ts` (API
  client, `Waychit-Signature` check: HMAC-SHA256 hex of `${t}.${rawBody}`,
  5-minute window), `utils/waychitFee.ts` (client-safe gross-up so the 3%
  arrives whole, whole dalasi), `utils/waychitOrders.ts` (confirm → split
  booked `collected_by = 'owner'` → one `waychit_payouts` row per recipient;
  runner's at delivery; a succeeded payout books a `payout` ledger row so
  Settle net is unchanged; a declined paid order stops its payouts and the
  owner refunds from Waychit — no refund API). Checkout option `waychit` on
  the FestDash order page and wallet-rail store carts, GMD only;
  `/api/waychit/webhook` (re-reads the request at Waychit before marking
  paid; events stored once in `waychit_events`); `/api/waychit/status`;
  owner panel `WaychitPanel` on /admin/festdash/coordinators (switch, fee,
  payouts with Send — nothing is sent automatically). **Live only when
  `WAYCHIT_API_KEY` + `WAYCHIT_WEBHOOK_SECRET` are in Vercel AND
  `coordinator_program_settings.waychit_enabled` is on.** Waychit pays out only
  inside The Gambia (wallets / Gambian banks) — it can't reach Stripe or a US
  account; the owner's share leaves by bank wire from the Gambian settlement
  account. Waychit requires a business registered in The Gambia (merchant
  agreement §8.1). No sandbox: the first test is a small real order.
- **Wallet-theft guards (2026-11-04).** A coordinator's wallet receives the
  money, so the site can't stop him keeping it — it makes it visible within a
  day and gives customers and shops a line to the owner (`utils/walletWatch.ts`):
  a rejected payment that had a customer reference alerts the owner at once
  (both confirm-payment routes); one unconfirmed 24h after the reference
  (`payment_ref_at`) alerts once from the daily subscription-reminders cron
  (`payment_escalated_at`); the customer gets **I paid but it wasn't
  confirmed** (`WalletDispute` → `/api/wallet-dispute`) on the FestDash track
  page and on a store order's document page (emailed to them when the order
  is placed); the owner's **Wallet watch** panel on
  /admin/festdash/coordinators lists all of them until **Resolved**
  (`payment_watch_resolved_at`). Shops see every sale their coordinator
  collected for them with their share, plus stalled payments, on My Shop
  (`CoordinatorBook`, `/api/vendor/coordinator-book`) and can **Tell
  NorthEDM**. The real fix is still the payment bridge.
- **Gee's two-day grace (owner's instruction, 2026-11-03).** Gee keeps 100% of
  his own shop's sales for two days — through **2026-11-05** — while his Wave
  number is the only rail. The ledger still books the normal 90/5/5 on those
  sales; the owner's 5% on sales dated up to and including 2026-11-05 is
  **waived** and must be deducted when the first "Settle net" is done. From
  2026-11-06 the split applies in full and the bridge above is the priority.
- **Shop owners self-onboard at `/festdash/shop-setup`** (the QR on Gee's
  flyer). One application creates the pending vendor with its payout wallets
  (`vendors.payout_wallets`, private), WhatsApp, area, the coordinator code
  that links it to its purse keeper, and `terms_accepted_at`. **Approving it in
  /admin/vendors also enrols it on FestDash** (`enrollCoordinatorShop`); it
  goes live when the coordinator logs the first fee. The page is state-aware:
  account → application → coordinator/fee → add items.
- **Nobody waits in silence (2026-11-02).** Application alerts to the owner
  carry the whole application (`utils/vendorApplication.ts`) and link to the
  right admin card; **Email me this application** on /admin/vendors re-sends
  one. Approve → applicant email with the next step (coordinator shops: fee +
  the coordinator's wallets) and an email + in-app alert to the coordinator;
  fee logged → "you're live" email to the shop; `/api/cron/subscription-reminders`
  (daily, also the **Run fee reminders now** button) reminds shop + coordinator
  a week before a period ends, on its last day and once after it lapses, stamped
  on `vendor_subscriptions`. Assigning a coordinator to an already-approved
  vendor enrols it (`enrollCoordinatorShop` in `utils/coordinator.ts`). Shop
  and coordinator messages go through `utils/notifyEmail.ts`; owner alerts stay
  in `utils/alerts.ts`.
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
- **Runner fee + promoter attribution (2026-11-02).** Every order carries a
  **runner fee** the customer picks at checkout (10% of items minimum, 15/20/25/
  custom; `minRunnerFeeCents`), on top of the items; all of it goes to the
  runner. Card rail: collected inside the Stripe application fee and transferred
  to the runner's Connect account at the delivery code (`utils/runnerPay.ts`;
  runners set payouts up on /festdash/driver; the commissions cron sweeps fees
  owed to runners who connected later). Wallet rail: `runner_cents` on the
  ledger `sale` row, paid by the coordinator. The 90/10 split is on the items only.
  **Any active promoter's code** now attaches a promoter to a shop (shop-setup
  walkthrough and /vendors/apply → `vendors.coordinator_user_id/_code`); that
  promoter earns the coordinator share of each sale. A shop referred by the
  owner's own code pays 10% less on the listing fee.
- **Monthly subscriptions by card (2026-11-02)** — `utils/billing.ts`. US
  FestDash vendors pay a monthly **FestDash listing** and embedded stores a
  monthly **store subscription**, both `subscription_fee_cents` ($30) via Stripe
  Checkout subscriptions; the webhook mirrors them into `stripe_subscriptions`
  and flips `stores.billing_status`. A card-rail vendor is listed/orderable only
  while the listing is active (`festdashListingActive`, used by the vendor list,
  the FestDash page and the order route); wallet-rail shops keep paying their
  coordinator. A referral code takes `referral_fee_discount_bps` (10%) off and
  the referring promoter is booked `subscription_coordinator_bps` (10%) of each
  payment as a `vendor_listing` commission (not when the promoter is an archon).
  Cards: `BillingCard` on /festdash/vendor-dashboard and /<slug>/manage.
  Stripe endpoint must send `invoice.paid`, `customer.subscription.updated`,
  `customer.subscription.deleted` in addition to the order events.
- **Store fees and store sales for promoters (2026-11-02).** Promoters earn the
  coordinator share on embedded-store sales too (`store_order` commission booked
  in the webhook's store_order branch, voided on refund). A coordinator can log
  a **store fee** as well as a listing fee in /festdash/purse
  (`vendor_subscriptions.kind` = `store`); it sets the shop's stores
  `billing_status = active`, and the daily reminders job sets `past_due` once
  the period lapses. Every listing-period reader filters `kind = 'festdash'`.
  **Bundle + discount codes (2026-11-03).** `SubscriptionKind` adds `bundle`
  (`coordinator_program_settings.bundle_fee_cents`, $45: FestDash listing +
  store, "buy one get one half off"); one Stripe subscription that counts as an
  active listing (`festdashListingActive` reads festdash|bundle) AND flips the
  store on. A FestDash vendor buying the bundle without a store gets a draft
  one (`utils/ownStore.ts`). Codes at checkout — `utils/discountCodes.ts`:
  a promoter's referral code (10% every month, attributes them) or a
  `discount_codes` row (% or $; `max_redemptions = 1` is one-time = first
  invoice only, spent on `checkout.session.completed`; null = every month).
  Applied as a Stripe coupon (`once`/`forever`) on the list price so the
  invoice shows it. `quote()` precedence: typed code → `vendors.signup_code`
  (the code on the application) → referring promoter. Owner makes codes in
  **/admin/codes** (Discounts & Vouchers: a pool of one-time 20/25/30/50%
  vouchers, **Send voucher** assigns one to a member — emailed, in-app, and
  shown on their profile via `VouchersCard` / `/api/vouchers/mine` — and the
  billing card offers their vouchers as one-tap chips; a used voucher drops
  out of every view because `times_redeemed` reached `max_redemptions`); promoters mint ONE-TIME codes in /promote/codes
  (`/api/promote/mint`, capped by `mint_max_percent_off` /
  `mint_max_amount_off_cents`), which attribute the shop to them like a
  referral. Applications (/vendors/apply, shop-setup, /promote) accept either
  kind; a promoter application records `invite_code` / `invited_by` and the
  admin card shows who minted it. Wallet rail: the purse logs a `bundle` fee
  as a festdash period plus a store period. Approval email lists the three
  plans (the "invoice"); nothing is charged until the shop picks one.
  **Pickup orders (2026-11-03).** `festdash_orders.fulfillment` =
  `delivery` | `pickup`. A pickup order has no campsite, no runner and no
  runner fee; `campground_zone` reads "Pick up at the shop", the runner pool
  skips it, and `in_transit` means "ready for pickup" (labels only — the
  state machine is unchanged, and the 4-digit code is given at the counter).
  The shop sets `vendors.pickup_location` and `vendors.fulfillment_modes`
  (`both` | `pickup` | `delivery`) on /festdash/shop-setup; the order page
  offers Deliver / Pick up only when both are allowed and the order route
  refuses a mode the shop doesn't offer. Gee's shop is pickup-only for now.
  **Business-safe routing (2026-11-03).** Every shop, wallet-rail included,
  can pay its fee by card (`/api/billing/*` no longer refuses the local rail;
  `activeSubscription` / `paidLocalVendorIds` count a Stripe listing or
  bundle as a current period; the reminders job skips card payers). Paying
  the coordinator in dalasi stays as the fallback. The coordinators admin
  page shows a **Settle net** line per coordinator and currency: what you owe
  them (owner-collected card sales + held commissions) minus what they owe
  you (wallet sales/fees), so money crosses the border once, in the direction
  that works (US → Gambia).
  **A promoter's own shop (2026-11-03)** is a shop that promoter referred:
  10% off the fee automatically and they keep the promoter share of its sales
  and fee payments. **Subscription fees: promoter keeps 10% of the amount
  actually paid ($3 on $30); NorthEDM receives 90% ($27), before provider
  costs** (owner clarified 2026-11-10). `selfReferral()` in
  `utils/coordinator.ts`; applications set it as `coordinator_user_id` when no
  other code is given, `quote()` and the purse fee fall back to it. Gee's shop
  is the first case.
  **Store payouts (2026-11-03)** — `utils/storePayouts.ts`. A paid USD store
  order pays each selling vendor their lines minus the platform share
  (`platformShareBps`, 20%) minus the store's `operator_fee_bps` (member
  vendors only) by Stripe transfer drawn on the order's charge; operator fees
  go to the operator's vendor. Rows in `store_payouts` (`owed` → `paid` →
  `reversed`); no Connect account yet → `owed`, swept by the commissions cron
  (`payPendingStorePayouts`); refund/dispute reverses transfers. The Connect
  account is `vendors.stripe_account_id` (mirrored to `festdash_vendors`),
  set up from `PayoutsCard` on /vendor/dashboard and /<slug>/manage or the
  FestDash dashboard — one setup covers both. `canManageInventory` now admits
  `is_festdash_vendor`: a FestDash shop adds items on /vendor/dashboard.
  **Card on a Gambian shop (2026-11-03).** A wallet-rail shop also takes any
  card, on FestDash and in its store, charged in the shop's currency to
  NorthEDM's Stripe with no destination transfer (Stripe can't reach a Gambian
  shop or runner). At delivery (FestDash) or on the paid webhook (store) the
  90/10 split plus the runner fee is booked on `coordinator_ledger` with
  `collected_by = 'owner'`: the owner owes shop + coordinator + runner shares
  to the coordinator, who disburses locally. The owner records each Remitly
  payment with **Sent by Remitly** in /admin/festdash/coordinators (`kind =
  'payout'`); the page shows both directions. `payRunnerFee` and the Connect
  commission are skipped for these orders. Store sale rows use
  `store_order_id`, never `order_id` (which is a FestDash FK).
  **Held cards on Gambian stores (2026-11-03).** A card order on a wallet-rail
  store is authorised, not charged (`capture_method: manual`, session
  `hold=1`): the webhook marks it `authorized`, reserves stock and books
  nothing. The operator's **Handed over** on /<slug>/manage
  (`/api/store/orders/[id]/fulfill`) captures the card, marks it `paid` and
  runs `settleStoreOrder()` (`utils/storeSettle.ts`, the one place store
  money is finalised — the webhook uses it too for US stores captured at
  purchase). **Cancel** releases the hold and restores stock; the commissions
  cron releases holds untouched for six days; a hold cancelled at Stripe
  comes back through `payment_intent.canceled`. US stores are unchanged.
  **Store checkout follows the shop's rail** (`utils/storeRail.ts`): a store
  whose operator is a wallet-rail vendor sells for Wave / QMoney / Afrimoney in
  the shop's currency, paid to the coordinator; the order waits in
  `awaiting_confirmation` (`/api/store/orders/[id]/payment-ref` for the
  customer's reference, `…/confirm-payment` for the coordinator, who sees it in
  /festdash/purse next to FestDash orders). Confirming marks it paid, takes
  stock down and books the 90/10 sale split. Card stores are unchanged.
- **Shipping, specs and order documents (2026-11-03)** — one process for every
  parcel shop (NorthEDM's shop and US vendor stores). `utils/shipping.ts`:
  destination → zone (us / na / eu / wafrica incl. GM, SN / world), services
  priced base + per-kg from the products' `weight_g` (300 g assumed when blank,
  +10% and 60 g packaging) with an ETA string; the table is a **reference
  estimate modelled on USPS retail**, overridable in **/admin/shipping**
  (`shipping_settings.rates`, plus `ship_from` and a handling fee). The cart's
  `ShipTo` picker calls `/api/shipping/quote`; **flat-rate services**
  (Priority Mail Flat Rate Envelope / Small Box domestic, International Flat
  Rate Envelope abroad — `per_kg_cents: 0`, `max_kg` as the "fits" limit) and
  **one-tap item weights** for the owner's goods (`WEIGHT_PRESETS`: dried
  3.5 / 7 / 14 / 28 g bagged, 30 ml glass-dropper tincture) were added
  2026-11-05, plus `ShipEstimate` on marketplace item pages of US shops
  (same quote, any country, before anything is in a cart); both checkouts re-quote
  server-side and charge it as a Stripe `shipping_options` line, so the Stripe
  receipt matches ours; `allowed_countries` is the chosen country. Store
  shipping is paid in full to the operator (`payStoreOrder`). Wallet-rail
  (Gambian) stores hand over locally: no shipping line. **Documents**:
  `/orders/<shop|store>/<id>/<invoice|receipt|label>` render from one
  `OrderDoc` (`utils/orderDocs.ts`); the label is 4×6 with a CN22 customs
  block when the destination differs from the ship-from country. Access: HMAC
  `?t=` token (in the emails), buyer, operator or admin. `sendOrderEmails`
  (`utils/orderEmails.ts`) sends the buyer a receipt and the seller a pack
  sheet when money is final (shop webhook, store webhook, held-card
  handover). **Specs**: `products`/`shop_products` carry `weight_g`, dims,
  `hs_code`, `origin_country`, `specs` jsonb (`utils/specs.ts`, `SpecsEditor`
  on the vendor dashboard and /admin/shop, `SpecsTable` on item pages).
  Postage is bought at the counter; the site never buys labels.
- **My Shop hub (2026-11-03)** — `/vendor` is every marketplace vendor's own
  admin page (the nav's "My Shop"): profile (`VendorEditForm`, accent), links
  to inventory (`/vendor/dashboard`), storefront/manage, FestDash orders,
  payouts, and **metrics**. `/api/vendor/me` resolves the caller's vendor
  (profile link or `vendors.user_id`) and store; `/api/vendor/metrics` returns
  **counts only** — views/visitors per day for the shop's own pages
  (`page_views`, admins excluded), most-viewed items, referrer hosts, order
  counts and the shop's own revenue. Never add visitor ids, accounts, emails,
  addresses or order lines to it: a shop owner is not a site admin (owner's
  rule). The old `/vendor` was a second copy of the inventory dashboard; it is
  gone.
- **Currencies (2026-11-03).** A shop's `vendors.country` (picked on shop
  setup) sets `vendors.currency` (`utils/currencies.ts`); every price of that
  shop is stored and charged in it. Buyers never need to hold it: a card is
  charged in the shop's currency and the buyer's bank converts. Two helpers on
  top, neither of which changes what is charged: (1) **display** — `Price`
  from `app/components/CurrencyContext.tsx` shows "≈" in the visitor's
  currency (cookie `ne_currency`, else Vercel's country header, picked with
  the "Show prices ≈ in" pill) using `/api/fx` (open.er-api.com, cached 1h,
  fallback constants); (2) **Stripe Adaptive Pricing** — `adaptive_pricing:
  { enabled: true }` on every Checkout session except held-card (manual
  capture) Gambian store orders and FestDash holds, so a foreign buyer may
  choose their own currency at Stripe and **Stripe adds its 2–4% conversion
  charge to the buyer's total; we still receive the shop's currency**. The
  `ConversionNote` beside each checkout says exactly that (owner's decision:
  the buyer carries the conversion fee). Prices in USD at Stripe are
  eligible; GMD sessions are presented as GMD.
- **Shop by country (2026-11-04).** /marketplace shows a "Check all shops
  from <country>" card (`CountryCards`) for every country outside the US with
  at least one public, unsuspended shop (`vendors.country`); each opens
  `/marketplace/country/<iso2>` listing those shops with their items, prices
  in the shop's currency with ≈ in the visitor's. New countries appear on
  their own — the owner wants people from everywhere to feel welcome.
- **Service fee + FestDash passes (2026-11-04)** — `utils/festdashPass.ts`.
  Every FestDash order (pickup or delivery, every rail) carries a customer
  **service fee**: `service_fee_bps` (5%) of the items after any code, at least
  `service_fee_min_cents` ($1) on USD orders, stored as
  `festdash_orders.service_fee_cents` and included in `total_cents`. It is
  NorthEDM's in full and sits **outside the shop's split**, like the runner
  fee: every split/commission base is `total − runner fee − service fee`
  (`recordSaleSplit` adds it to `owner_cents`; the card application fee adds
  it whole). A customer with a running **FestDash pass** pays none. Passes
  (2-day, weekend, 7-day, monthly — `coordinator_program_settings.festdash_passes`,
  prices in /admin/festdash/coordinators) are one-time USD card payments
  bought on `/festdash/pass` (`/api/festdash/pass`, Stripe `kind =
  festdash_pass`), switched on by the webhook (`activatePass`, stacks after a
  running pass) in `festdash_member_passes` (service-role writes; users read
  their own). The runner fee is never waived.
- **No store credit on FestDash orders** (2026-11-02): it is NorthEDM's own
  liability and the vendor would never be paid for the credit-covered part. The
  order route ignores `useCredit`; the order page doesn't offer it. Credit stays
  spendable on NorthEDM's shop and avatar items.
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

## Apps and Tools — Astrology and Hebrew Numerology Calculator (2026-11-03)
`/apps-and-tools` (menu entry **Apps and Tools**; tools listed in
`app/apps-and-tools/tools.ts`) and `/apps-and-tools/astrology-hebrew-numerology`.
Spec: `.claude/skills/hebrew-birth-chart/reference/spec.md`. All calculation
lives in `utils/numerology/` — one copy, shared with the agent skill:
- **Hebrew calendar is computed offline** (`hebrewCalendar.ts`); no Hebcal call
  at runtime. Sunset/time zones in `birthTiming.ts` (Astronomy Engine sunset,
  `@photostructure/tz-lookup`, DST gap → refused, fold → both kept).
- **Astrology = Astronomy Engine (MIT)**, not Swiss Ephemeris (AGPL or CHF 700
  licence). Tropical, Whole Sign. Unknown time → no Ascendant/houses/aspects.
- **Same-value words** come from Strong's Hebrew Dictionary (Open Scriptures,
  CC BY-SA) in `utils/numerology/data/strongs-hebrew.json` — server-only, never
  import `lexicon.ts` from a client component. Rebuild with
  `scripts/build-hebrew-lexicon.mjs`.
- Curated associations (`associations.ts`) are few and each has a source. A
  number with nothing verified gets an explicit "No additional sourced
  association verified" row — don't invent one.
- **`npm run test:astro-hebrew`** (add `-- --live` to re-ask Hebcal for ~2,160
  days and NASA JPL Horizons for 40 planet positions). Run it after any edit in
  `utils/numerology/`.
- Place search: `/api/apps-tools/astrology-hebrew/resolve-place` → OSM
  Nominatim (usage policy: ≤1 req/s, identify the app, credit OSM; throttled
  via `request_throttle`). PDF = the browser's print-to-PDF of the same report
  element (no server PDF worker). Nothing is stored; saved reports (spec §12)
  are not built yet.
- `utils/numerology/*.ts` import each other with `.ts` extensions
  (`allowImportingTsExtensions`) so Node can run them directly for tests and
  the skill. Keep them erasable TypeScript (no enums/namespaces).
- **Legal posture** (owner informed 2026-11-03, not legal advice): free tool,
  reflective wording. Pennsylvania 18 Pa.C.S. § 7104 makes predicting the
  future *for gain* "by the movements of the heavenly bodies" a misdemeanor —
  don't charge for readings/predictions without a lawyer's OK.
- A friend's book calculator may be added **only with his written permission**;
  methods go in `.claude/skills/hebrew-birth-chart/reference/book-notes.md`.

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

## CrowdWave hub (`/crowdwave`) — live data only (2026-11-03)
Festivals and shows come from `local_events` (the events cron + /admin/events):
festivals = `source` seed/manual or `featured`; annual seeds rolled forward and
still **pending** are listed by name under "Returning Next Season" with no
dates until approved. Trending vendors (`utils/trendingVendors.ts`, also used
by `/feed`) = 30 days of completed sales (delivered FestDash + paid/fulfilled
store orders) plus distinct visitors to the shop's pages (admins and the shop's
own people excluded); score = visitors + 10 × sales, listed once a vendor has a
sale or 3+ visitors, public vendors only. Shown as "🔥 Hot topic" — never the
numbers (owner's call). Weather
for all 20 PA state forests (`utils/paStateForests.ts`, `ForestWeather`) is
Open-Meteo, cached 1h. The old `festival_vendors` / `festival_events` seed rows
are not read by these pages any more.
