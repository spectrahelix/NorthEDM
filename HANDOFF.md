# NorthEDM — Complete Session Handoff
**Date:** 2026-06-14  
**Repo:** spectrahelix/northedm  
**Live site:** https://north-edm.vercel.app  
**Working branch:** `claude/website-coding-luwy25` (currently merged into main; develop new features here)

---

## Who You Are Working With

CJ (cjblue27@gmail.com) — owner of NorthEDM, a Next.js 16 platform for Northeast EDM/festival culture. The site includes: community forum, vendor marketplace, festival dashboard, mushroom foraging section, group chats, direct messaging, and a mushroom-wave homepage.

CJ prefers you operate autonomously. When CJ is tired or says "take the wheel," proceed without asking for confirmation on implementation choices. Commit and push all changes.

---

## Tech Stack

- **Framework:** Next.js 16 App Router (NOT the Next.js you know — read node_modules/next/dist/docs/ before any Next.js-specific code)
- **Database:** Supabase (project: `bacyusmyzyawcrdpnvrt`)
- **Styling:** Tailwind CSS 4 (NOT v3 — syntax differs)
- **Email:** Resend SDK v6.12.4 (API key set, domain verification pending — see below)
- **Deploy:** Vercel (auto-deploys from main branch pushes)
- **Auth:** Supabase Auth with SSR (`@supabase/ssr`)
- **Fonts:** Bebas Neue (headings), DM Mono (labels/code), system sans (body)

---

## Brand Colors

| Name       | Hex        | Usage                          |
|------------|------------|-------------------------------|
| Neon Green | `#39FF14`  | Primary CTA buttons, active tabs |
| Teal       | `#3AFFD4`  | Accent, links, highlights      |
| Coral      | `#FF5C3A`  | Errors, warnings, Vendors nav  |
| Purple     | `#CC00FF`  | Forum nav pill                 |
| Cyan       | `#00D4FF`  | Feed nav pill                  |
| Orange     | `#FB923C`  | FestDash nav pill              |

**Do NOT use `#E8FF47` (yellow) anywhere** — it was audited out. Use `#39FF14` for active states and `#3AFFD4` for secondary accents.

---

## .env.local (NEVER COMMIT — gitignored)

The file at `/home/user/NorthEDM/.env.local` contains exactly these keys:

```
NEXT_PUBLIC_SUPABASE_URL=https://bacyusmyzyawcrdpnvrt.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<see .env.local>
SUPABASE_SERVICE_ROLE_KEY=<see .env.local>

RESEND_API_KEY=<see .env.local>
VERCEL_TOKEN=<see .env.local — vcp_ prefix, may need classic PAT>
SUPABASE_ACCESS_TOKEN=<see .env.local>
```

**SECURITY RULE:** Credentials MUST NEVER be committed to git. RESEND_API_KEY, VERCEL_TOKEN, SUPABASE_ACCESS_TOKEN, and SUPABASE_SERVICE_ROLE_KEY are all sensitive.

---

## Network Sandbox Limitations

This session's environment has egress restrictions. Known blocked hosts:
- `api.vercel.com` — Vercel CLI cannot deploy; use `git push origin main` instead (Vercel auto-deploys)
- `api.supabase.com` — Supabase CLI cannot run migrations; use the Supabase dashboard SQL editor to paste migrations

What DOES work:
- GitHub MCP tools (`mcp__github__*`) — push, PR, branch ops
- Supabase DB via service role key (all CRUD, RLS, etc.)
- `supabase.co` project URL — direct DB queries work fine

**If you want open network access:** Create a new environment at code.claude.com with `api.supabase.com` and `api.vercel.com` added to the egress allowlist. Then paste the tokens above.

---

## Network Test (run this to check if restrictions still apply)

```bash
curl -s -o /dev/null -w "%{http_code}" https://api.vercel.com/v1/user -H "Authorization: Bearer $(grep VERCEL_TOKEN .env.local | cut -d= -f2)"
```
- `200` = open network, Vercel CLI will work
- `000` or connection refused = sandbox blocked

---

## What Was Built (All Merged to Main)

### 1. Display Name System
- Users can set a custom display name (default is email prefix at signup)
- **`app/profile/edit/page.tsx`** — `save()` inserts old name to `display_name_history` before upsert if name changed
- **`app/profile/[id]/page.tsx`** — fetches name history (limit 5), shows "Previously known as" pills with dim monospace styling
- **Migration NOT yet run** → see Pending Tasks

### 2. Direct Messages
- **`app/messages/page.tsx`** — inbox/outbox tabs, realtime updates, compose modal, mark-read on expand
- **`app/messages/components/ComposeModal.tsx`** — user search by display name, subject + body fields
- Send Message button appears on other users' profiles; redirects to `/messages?to={userId}`
- Tab active color: `#39FF14`

### 3. Global Search (Cmd/Ctrl+K)
- **`app/components/GlobalSearch.tsx`** — modal overlay, debounced, grouped results
- **`app/api/search/route.ts`** — queries vendors, festivals, products for all; forum threads only for logged-in users
- Forum results gated: unauthenticated users see "Sign in to search the forum" message
- Integrated in NavBar (desktop + mobile)

### 4. Email Confirmation via Resend
- **`app/api/auth/signup/route.ts`** — server-side signup using Supabase admin `generateLink()`, sends branded HTML email via Resend
- **`app/api/auth/resend-confirmation/route.ts`** — resend uses `magiclink` type (no password needed)
- From address: `NorthEDM <no-reply@northedm.com>`
- **Domain NOT yet verified** → see Pending Tasks

### 5. OAuth Fix (Google Sign-In → Profile)
- **`app/auth/callback/route.ts`** — detects new OAuth users by checking if `user_profiles` row exists
- New users: seeds display_name from Google metadata, seeds username from email prefix, redirects to `/profile/edit`
- Returning users: redirects to `next` param or `/feed`

### 6. Signup Page
- **`app/signup/page.tsx`** — removed direct Supabase client call; now POSTs to `/api/auth/signup`
- Join Community button on homepage: routes to `/signup` for guests, `/forum` for logged-in users

### 7. NavBar
- **`app/components/NavBar.tsx`** — color pill per nav item, GlobalSearch integrated
- Links with pill colors: Home(#aaa), Forum(#CC00FF), Feed(#00D4FF), CrowdWave(#3AFFD4), Marketplace(#39FF14), Vendors(#FF5C3A), Foraging(#FFB347), FestDash(#FB923C)

### 8. Color / UI Audit
- Replaced all `#E8FF47` yellow with `#39FF14` or `#3AFFD4` sitewide
- Wave field (canvas) visible on all pages — all `<main>` backgrounds stripped to transparent
- Forum thread cards: z-index layering pattern (Link at z-[1], HeartButton/avatar at z-[2]) so entire card is clickable
- Home page vendor cards: removed `backdrop-blur-sm`, matched founder card transparent tint (`border-[#39FF14]/20 bg-[#39FF14]/[0.03]`)
- Wook World hidden from public nav/surfaces

### 9. Autonomous Session Config
- **`.claude/settings.json`** — `defaultMode: acceptEdits`, `allow: ["Bash(*)", ...]` for full auto-run
- **`.claude/hooks/session-start.sh`** — runs npm install, checks for VERCEL_TOKEN and SUPABASE_ACCESS_TOKEN

---

## PENDING TASKS (must be done manually or in open-network session)

### CRITICAL: Run Supabase Migration
The `display_name_history` table doesn't exist in production yet. The feature code is deployed but will 500 on name changes until this runs.

Go to: **Supabase Dashboard → SQL Editor** → paste and run:

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

Migration file is also at: `supabase/migrations/20260613000000_display_name_history.sql`

### IMPORTANT: Verify Resend Domain
Email sends from `no-reply@northedm.com`. Until the domain is verified in Resend, emails will fail silently (the API call returns an error but signup still works — users just won't get the email).

Go to: **resend.com/domains** → Add `northedm.com` → Add the DNS records it provides to your DNS registrar.

Resend API key: already set in `.env.local` as `RESEND_API_KEY`

Temporary workaround while domain is unverified: emails are logged server-side as a fallback (user gets no email but account is created).

### OPTIONAL: Fix Vercel CLI Token
The `VERCEL_TOKEN` in .env.local uses `vcp_` prefix (Connect Provider token) which is rejected by both the CLI and the API. To get a working token:
- Go to vercel.com/account/tokens → Create → select "Full Account" scope → copy the token (starts with `ver_` or similar)
- Update `.env.local` with the new token

This is only needed if you want `vercel` CLI commands. Vercel auto-deploys from `git push origin main` so this is optional.

---

## Key Architecture Rules

### Next.js 16 App Router Gotchas
- Server components CANNOT have `onClick` handlers — causes runtime crash
- For clickable cards with interactive sub-elements: use z-index layering
  ```tsx
  // Correct pattern for clickable card + nested interactive element
  <div className="relative">
    <Link href="..." className="absolute inset-0 z-[1]" />
    <div className="...card content...">
      <HeartButton className="relative z-[2]" />  {/* above the link */}
    </div>
  </div>
  ```
- `params` and `searchParams` are Promises in Next.js 16 — must `await` them

### Supabase SSR
- Server components: `createClient()` from `@/utils/supabase/server` (uses cookies)
- Client components: `createClient()` from `@/utils/supabase/client` (browser)
- Admin operations (service role): `createAdminClient()` from `@/utils/supabase/admin`

### Wave Field
- Canvas is `position: fixed; z-index: 0` — sits behind everything
- Pages MUST have transparent backgrounds to show the wave through
- Never add `bg-neutral-950` or `bg-black` to `<main>` elements

### Tailwind CSS 4
- Does NOT use `tailwind.config.js` class extension the same way as v3
- Custom values inline: `bg-[#39FF14]`, `text-[#3AFFD4]`

---

## File Map (Key Files)

```
app/
  page.tsx                          # Home page with vendor cards, wave field, guest panel
  layout.tsx                        # Root layout with NavBar + WaveField
  components/
    NavBar.tsx                      # Color-pill nav with GlobalSearch
    GlobalSearch.tsx                # Cmd+K search modal
    WaveField.tsx                   # Canvas wave background
    AvatarBorder.tsx                # Avatar border styles
    RankBadge.tsx                   # User role badge
  forum/
    page.tsx                        # Forum listing (z-index card pattern)
    [id]/page.tsx                   # Thread detail
  profile/
    [id]/page.tsx                   # Public profile with name history
    edit/page.tsx                   # Edit profile (saves name history)
  messages/
    page.tsx                        # Inbox/outbox
    components/ComposeModal.tsx     # Compose new message
  auth/
    callback/route.ts               # OAuth + email confirmation handler
  api/
    auth/
      signup/route.ts               # Server-side signup with Resend email
      resend-confirmation/route.ts  # Resend confirmation email
    search/route.ts                 # Global search API (auth-gated forum)
utils/
  supabase/
    client.ts                       # Browser Supabase client
    server.ts                       # Server Supabase client
    admin.ts                        # Service role admin client
    user-profiles.ts                # getUserProfile() helper
supabase/
  migrations/
    20260613000000_display_name_history.sql   # PENDING — not yet run
.claude/
  settings.json                     # Autonomous permissions config
  hooks/session-start.sh            # npm install + token checks on session start
```

---

## Vendor Pricing (for reference — `NorthEDM_Vendor_Pricing_Report.md`)

Recommended tiers based on market analysis:
- **Seedling** — $29/mo (basic listing, 1 product, no marketplace boost)
- **Grower** — $59/mo (unlimited products, featured placement, analytics)
- **Founder** — $89/mo (everything + CrowdWave integration, priority support, badge)

Current founder vendor: Frank's General Store

---

## How to Deploy

```bash
# All pushes to main auto-deploy via Vercel
git add <files>
git commit -m "description"
git push origin main

# Or push feature branch first, then merge
git push origin claude/website-coding-luwy25
# Then merge to main via GitHub
```

---

## Quick Diagnostics

```bash
# Check if build passes
cd /home/user/NorthEDM && npm run build

# Check env vars are loaded
grep -c "=" .env.local  # should be 7

# Test Supabase DB connection (safe — uses anon key)
curl -s "https://bacyusmyzyawcrdpnvrt.supabase.co/rest/v1/user_profiles?limit=1" \
  -H "apikey: $(grep NEXT_PUBLIC_SUPABASE_ANON_KEY .env.local | cut -d= -f2)"

# Test network restrictions
curl -s -o /dev/null -w "%{http_code}" https://api.vercel.com/v1/user \
  -H "Authorization: Bearer $(grep VERCEL_TOKEN .env.local | cut -d= -f2)"
```
