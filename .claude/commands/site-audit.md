---
description: Deep, judgment-based audit of the NorthEDM site (features, security, health, growth) — reads live Supabase data, updates docs/SITE_AUDIT.md, reports findings.
---

Run a thorough audit of the NorthEDM site and report what you find. This is the
deep version of the weekly mechanical audit (`scripts/site-audit.mjs`); do the
mechanical checks **and** the judgment calls the script can't.

## 1. Mechanical baseline
Run `node scripts/site-audit.mjs` and read its summary — features, npm audit,
TypeScript, migrations, env-var references. This refreshes `docs/SITE_AUDIT.md`.

## 2. Feature inventory — present vs actually working
Cross-check the route list against reality. For each major feature area (FestDash,
marketplace, shop, embedded stores, promoter hoodies, feedback/bug reports,
social, events, foraging), confirm the page renders and its API route exists and
isn't obviously broken. Flag anything that is present in code but likely dead
(no data, missing env, orphaned route).

## 3. Security & correctness
- npm audit criticals/highs — name them and say whether `npm audit fix` is safe
  or would need a major bump. **Report only; do not apply unless asked.**
- RLS: for each Supabase table, is RLS enabled and are there policies? A table with
  RLS on and **zero policies** silently blocks all access — call those out.
  (Use the Supabase connector: `list_tables`, and query `pg_policies`.)
- Any admin/API route missing an auth check.

## 4. Config & growth (needs the Supabase connector)
- `select count(*) from auth.users`, plus signups in the last 7/30 days and the
  most recent signup — is growth moving or stalled?
- Backlog: rows in `error_reports` by status (unaddressed bug/feedback reports).
- Pending migrations not yet applied.
- Env presence: confirm the high-impact ones are set in Vercel — `BREVO_API_KEY`
  (owner emails), `NTFY_TOPIC` (push), `STRIPE_*`, `NEXT_PUBLIC_SUPABASE_*`.
  You cannot read Vercel env directly — infer from behavior and list what to verify.

## 5. Report
Write findings **most-important-first**, each as: what it is, why it matters, and
the smallest safe fix. Update the "Health" line and a dated "Findings" section in
`docs/SITE_AUDIT.md`. This command is **report-only** — do not change code, open
PRs, or deploy unless the user explicitly asks. End with a one-line health verdict.
