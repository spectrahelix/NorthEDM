# NorthEDM — Full Autonomous Handoff
**Last updated:** 2026-06-14  
**Repo:** spectrahelix/northedm (branch: `claude/website-coding-luwy25`)  
**Live site:** https://north-edm.vercel.app  
**Owner:** CJ — cjblue27@gmail.com

---

## FIRST: Verify Autonomy (run these in order)

### Step 1 — Check env vars are loaded
```bash
grep -c "=" /home/user/NorthEDM/.env.local
```
Expected: `7` (if less, env file is missing — see "Env Vars" section below)

### Step 2 — Check network allowlist
```bash
curl -s -o /dev/null -w "%{http_code}" \
  "https://bacyusmyzyawcrdpnvrt.supabase.co/rest/v1/user_profiles?limit=1" \
  -H "apikey: $(grep NEXT_PUBLIC_SUPABASE_ANON_KEY /home/user/NorthEDM/.env.local | cut -d= -f2)"
```
- `200` = network open, full DB access ✅ — proceed to Step 3
- `403` with "Host not in allowlist" = **network still blocked** → stop and fix (see "Network Setup" below)

### Step 3 — Verify pending migration hasn't run yet
```bash
psql "$(grep DATABASE_URL /home/user/NorthEDM/.env.local | cut -d= -f2 || echo 'NOT_SET')" \
  -c "SELECT to_regclass('public.display_name_history');" 2>/dev/null || \
curl -s "https://bacyusmyzyawcrdpnvrt.supabase.co/rest/v1/display_name_history?limit=0" \
  -H "apikey: $(grep NEXT_PUBLIC_SUPABASE_ANON_KEY /home/user/NorthEDM/.env.local | cut -d= -f2)" \
  -H "Authorization: Bearer $(grep SUPABASE_SERVICE_ROLE_KEY /home/user/NorthEDM/.env.local | cut -d= -f2)" \
  -w "\nHTTP:%{http_code}" | tail -1
```
- `HTTP:200` = table exists, migration already done ✅
- `HTTP:404` or `42P01` = **table missing — run the migration** (see "Pending Tasks" below)

### Step 4 — Verify build is clean
```bash
cd /home/user/NorthEDM && npm run build 2>&1 | tail -5
```
Expected: no errors, build succeeds.

---

## Network Setup (required for full autonomy)

The session environment has a network egress allowlist. Until these hosts are added, I cannot run migrations or use the Supabase/Vercel CLIs.

**Go to:** https://code.claude.com → this project's environment → **Network / Egress Allowlist**

**Add these hosts:**
```
*.supabase.co
api.supabase.com
api.vercel.com
```

**Then start a fresh session.** The allowlist takes effect on new sessions only.

Once the network is open:
- I can run `psql` directly against Supabase (psql is installed at `/usr/bin/psql`)
- I can use `supabase` CLI with `SUPABASE_ACCESS_TOKEN`
- I can use `vercel` CLI with `VERCEL_TOKEN` (if a valid non-`vcp_` token is set)

---

## Env Vars — .env.local

File lives at `/home/user/NorthEDM/.env.local` — **never commit this file.**

Required keys (ask CJ for values if file is missing):
```
NEXT_PUBLIC_SUPABASE_URL=https://bacyusmyzyawcrdpnvrt.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<get from Supabase dashboard → Settings → API>
SUPABASE_SERVICE_ROLE_KEY=<get from Supabase dashboard → Settings → API>
RESEND_API_KEY=<see .env.local>
VERCEL_TOKEN=<needs classic PAT — vcp_ prefix tokens are rejected; get from vercel.com/account/tokens>
SUPABASE_ACCESS_TOKEN=<see .env.local>
```

**Note on VERCEL_TOKEN:** The `vcp_` format is a Connect Provider token and is rejected by the Vercel CLI and API. To get a working token: vercel.com/account/tokens → Create → Full Account scope. The token should start with `ver_` or be a plain alphanumeric string.

---

## Pending Tasks (not yet done)

### 1. Run display_name_history migration (CRITICAL)
Profile name changes will 500 in production until this table exists.

If network is open, run via psql:
```bash
psql "$DATABASE_URL" < /home/user/NorthEDM/supabase/migrations/20260613000000_display_name_history.sql
```

If network is still blocked, paste the SQL manually in Supabase dashboard → SQL Editor:
```sql
create table if not exists public.display_name_history (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null,
  changed_at timestamptz not null default now()
);
create index if not exists display_name_history_user_id_idx
  on public.display_name_history(user_id, changed_at desc);
alter table public.display_name_history enable row level security;
create policy "Name history is public read"
  on public.display_name_history for select using (true);
create policy "Users insert own name history"
  on public.display_name_history for insert
  with check (auth.uid() = user_id);
```

### 2. Verify Resend domain (IMPORTANT)
Confirmation emails are built and deployed but will silently fail until `northedm.com` is verified.

Go to: **resend.com/domains** → Add `northedm.com` → add the DNS TXT/MX/DKIM records to your domain registrar.

Resend API key: `re_DuxXebgM_EW77YXhKBAXhBP74CQc9yjvE`
From address the code uses: `NorthEDM <no-reply@northedm.com>`

### 3. Fix VERCEL_TOKEN
Current token uses `vcp_` prefix which is rejected. Get a classic PAT from vercel.com/account/tokens and update `.env.local`. Needed only for CLI deploys — Vercel auto-deploys from `git push origin main` regardless.

---

## How to Deploy

Vercel auto-deploys when main is pushed. All code changes should follow this flow:

```bash
# Make changes on feature branch
git checkout claude/website-coding-luwy25
# ... edit files ...
git add <specific files>
git commit -m "descriptive message"
git push -u origin claude/website-coding-luwy25

# Merge to main to trigger Vercel deploy
git checkout main
git merge claude/website-coding-luwy25
git push origin main
```

---

## Who CJ Is / How to Work With Him

- CJ wants fully autonomous operation. When he says "take the wheel" or "just do it," proceed without asking for confirmation.
- Commit and push all changes — don't leave things as untracked files.
- He cares about the vibe: dark, festivalcore, mushroom aesthetic. Brand is North EDM / Northeast festival community.
- If CJ is tired or vague, make a reasonable implementation decision and tell him what you did after.

---

## Tech Stack

| Layer | Tech | Notes |
|-------|------|-------|
| Framework | Next.js 16 App Router | **Read node_modules/next/dist/docs/ before writing Next.js code** — breaking changes from prior versions |
| Database | Supabase (project `bacyusmyzyawcrdpnvrt`) | Postgres + auth + storage + realtime |
| Styling | Tailwind CSS 4 | NOT v3 — different config and some syntax differs |
| Email | Resend SDK v6.12.4 | Transactional email; domain verification pending |
| Deploy | Vercel | Auto-deploys from main |
| Auth | Supabase Auth + `@supabase/ssr` | SSR cookies pattern |
| Fonts | Bebas Neue, DM Mono | Bebas = headings, DM Mono = labels/code |

---

## Brand Colors

| Name | Hex | Usage |
|------|-----|-------|
| Neon Green | `#39FF14` | Primary CTA buttons, active tab indicators |
| Teal | `#3AFFD4` | Accent, links, nav pills |
| Coral | `#FF5C3A` | Errors, warnings, Vendors nav |
| Purple | `#CC00FF` | Forum nav pill |
| Cyan | `#00D4FF` | Feed nav pill |
| Orange | `#FB923C` | FestDash nav pill |
| Amber | `#FFB347` | Foraging nav pill |

**Never use `#E8FF47` (yellow)** — audited out sitewide.

---

## Architecture Rules

### Next.js 16 Server Components
- Server components **cannot** have `onClick`, `useState`, etc.
- For clickable cards with nested interactive elements, use z-index layering:
  ```tsx
  <div className="relative">
    <Link href="..." className="absolute inset-0 z-[1]" />
    <div className="...content...">
      <HeartButton className="relative z-[2]" />  {/* sits above the link layer */}
    </div>
  </div>
  ```
- `params` and `searchParams` in page components are **Promises** — must `await` them

### Supabase Client Pattern
```ts
// Server components / route handlers
import { createClient } from "@/utils/supabase/server";
const supabase = await createClient();

// Client components
import { createClient } from "@/utils/supabase/client";
const supabase = createClient();

// Admin / service role (API routes only)
import { createClient } from "@supabase/supabase-js";
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
```

### Wave Field Background
- Canvas is `position: fixed; z-index: 0` — behind everything
- **Never** add `bg-neutral-950` or solid `bg-black` to `<main>` elements — it covers the wave
- All page backgrounds should be transparent

### Row Level Security
- Every new table needs RLS enabled + explicit policies
- Admin routes that need to bypass RLS must use the service role key, not the anon client

---

## What's Been Built (all on main, all live)

### Core Platform
- **Forum** — threads, replies, hearts, categories, z-index clickable cards
- **Direct Messages** — inbox/outbox, realtime updates, compose modal, mark-read
- **User Profiles** — avatar upload, bio, home city, avatar border styles, rank badge
- **Display Name History** — tracks previous names, shown on profile (⚠ table not yet created in DB)
- **Global Search** — Cmd/Ctrl+K modal, auth-gated forum results, nav-colored result groups
- **Feed** — activity stream

### Auth
- **Email signup** → `/api/auth/signup` → Supabase admin `generateLink()` → Resend branded email
- **Resend confirmation** → `/api/auth/resend-confirmation` (uses `magiclink` type, no password needed)
- **OAuth (Google)** → `/auth/callback` detects new users, seeds profile, redirects to `/profile/edit`
- **Password reset** → forgot-password / reset-password pages

### Commerce / Marketplace
- **Marketplace** — product listings, vendor cards
- **Vendors** — vendor pages, My Shop dashboard
- **FestDash** — festival delivery network
  - Customer order wizard + order history
  - Vendor enrollment + dashboard + new order alerts
  - Driver view
  - Admin panel (service role RLS bypass)

### Festival
- **FestDash** (see above)
- **Elements 2026 festival page** — real lineup, real dates

### Navigation
- Color-pill nav: Home(#aaa) / Forum(#CC00FF) / Feed(#00D4FF) / CrowdWave(#3AFFD4) / Marketplace(#39FF14) / Vendors(#FF5C3A) / Foraging(#FFB347) / FestDash(#FB923C)
- Mobile hamburger menu
- GlobalSearch integrated in both desktop and mobile nav

### Home Page
- WaveField mushroom animation visible through transparent sections
- Guest sign-in panel
- "Join Community" → `/signup` for guests, `/forum` for logged-in users
- Vendor cards transparent tint: `border-[#39FF14]/20 bg-[#39FF14]/[0.03]`

### Session Autonomy
- `.claude/settings.json` — `defaultMode: acceptEdits`, all tools allowed
- `.claude/hooks/session-start.sh` — auto npm install, token status check

---

## File Map

```
app/
  page.tsx                              # Home (wave, vendor cards, guest panel)
  layout.tsx                            # Root layout — NavBar + WaveField
  components/
    NavBar.tsx                          # Color-pill nav with GlobalSearch
    GlobalSearch.tsx                    # Cmd+K search modal
    WaveField.tsx                       # Canvas mushroom wave background
    AvatarBorder.tsx                    # Avatar border variants
    RankBadge.tsx                       # User role badge
    SocialAuth.tsx                      # OAuth buttons (Google etc)
  forum/
    page.tsx                            # Thread listing (z-index card pattern)
    [id]/page.tsx                       # Thread detail + replies + hearts
  profile/
    [id]/page.tsx                       # Public profile + name history pills
    edit/page.tsx                       # Edit profile (saves old name to history)
  messages/
    page.tsx                            # Inbox / outbox
    components/ComposeModal.tsx         # New message composer
  auth/
    callback/route.ts                   # OAuth + email confirmation; seeds new users
  api/
    auth/
      signup/route.ts                   # Server signup → generateLink → Resend email
      resend-confirmation/route.ts      # Resend confirmation (magiclink type)
    search/route.ts                     # Global search (forum gated to auth users)
    festdash/
      admin/vendors/route.ts            # Admin vendor list (service role)
      admin/applications/route.ts       # Admin app list (service role)
      admin/applications/[id]/route.ts  # Approve/reject application
    admin/
      create-user/route.ts              # Admin user creation
    vendor/route.ts
    vendors/route.ts
  festdash/
    page.tsx                            # FestDash landing
    order/page.tsx                      # Customer order wizard
    orders/page.tsx                     # Customer order history
    vendor/page.tsx                     # Vendor dashboard
    driver/page.tsx                     # Driver view
    admin/festdash/page.tsx             # Admin panel
  marketplace/page.tsx
  vendors/
    page.tsx                            # Vendor directory
    [id]/page.tsx                       # Vendor detail
  foraging/page.tsx
  feed/page.tsx
  crowdwave/page.tsx
utils/
  supabase/
    client.ts                           # Browser Supabase client
    server.ts                           # Server Supabase client (cookies)
    user-profiles.ts                    # getUserProfile() helper
supabase/
  migrations/
    20260609000000_enable_rls_invoices.sql      # ✅ applied
    20260612000000_festdash_schema.sql           # ✅ applied
    20260613000000_display_name_history.sql      # ⚠ NOT YET APPLIED
.claude/
  settings.json                         # Autonomous permissions
  hooks/session-start.sh                # npm install + token checks
HANDOFF.md                              # This file
```

---

## Supabase DB Tables (known)

| Table | Purpose |
|-------|---------|
| `user_profiles` | id, display_name, bio, home_city, avatar_url, avatar_border, role, created_at |
| `profiles` | username (unique), user_id — separate from user_profiles |
| `threads` | Forum threads |
| `replies` | Thread replies |
| `direct_messages` | DMs between users |
| `display_name_history` | ⚠ migration not run yet |
| `vendors` | Vendor listings |
| `products` | Marketplace products |
| `festival_events` | Festival listings |
| `group_members` | Community groups |
| `festdash_vendor_applications` | FestDash enrollment |
| `festdash_vendors` | Approved FestDash vendors |
| `festdash_orders` | Customer orders |
| `festdash_order_items` | Order line items |
| `invoices` | Invoices (RLS enabled) |

---

## Vendor Pricing (context for future vendor onboarding conversations)

Recommended tiers (from market analysis done 2026-06-14):

| Tier | Price | Includes |
|------|-------|---------|
| Seedling | $29/mo | Basic listing, 1 product, standard placement |
| Grower | $59/mo | Unlimited products, featured placement, analytics |
| Founder | $89/mo | Everything + CrowdWave integration, priority support, Founder badge |

Current founder vendor: **Frank's General Store**, **Homestead Life**

---

## Quick Reference Commands

```bash
# Run dev server
cd /home/user/NorthEDM && npm run dev

# Build check
npm run build 2>&1 | tail -10

# Push to deploy (Vercel auto-deploys from main)
git push origin main

# Run a specific migration (when network is open)
psql "$DATABASE_URL" < supabase/migrations/<file>.sql

# Check all env keys are present
grep -c "=" .env.local   # expect 7

# Test Supabase DB connectivity (when network is open)
curl -s "https://bacyusmyzyawcrdpnvrt.supabase.co/rest/v1/user_profiles?limit=1" \
  -H "apikey: $(grep NEXT_PUBLIC_SUPABASE_ANON_KEY .env.local | cut -d= -f2)" \
  -w "\nHTTP:%{http_code}" | tail -2
```
