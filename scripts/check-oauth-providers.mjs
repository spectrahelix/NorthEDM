#!/usr/bin/env node
// Do the social sign-in buttons we draw actually work?
//
//   node scripts/check-oauth-providers.mjs [supabase-url]
//   npm run check:auth
//
// A provider is turned on by adding its credentials in the Supabase dashboard.
// app/components/SocialAuth.tsx only decides whether we DRAW the button. When
// those two disagree in the "button drawn, provider off" direction, tapping it
// drops the visitor on a raw JSON error page:
//
//   {"code":400,"error_code":"validation_failed",
//    "msg":"Unsupported provider: provider is not enabled"}
//
// That shipped once already, on the signup screen. Nothing else catches it:
// it is not a type error, the build stays green, and the button looks fine.
//
// Supabase answers the question directly — /auth/v1/authorize redirects (302)
// to a provider that is on, and 400s for one that is off. No key needed; this
// is the same unauthenticated endpoint the button itself hits.

import { readFileSync, existsSync } from "node:fs";

const SRC = "app/components/SocialAuth.tsx";

function supabaseUrl() {
  if (process.argv[2]) return process.argv[2];
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) return process.env.NEXT_PUBLIC_SUPABASE_URL;
  for (const f of [".env.local", ".env"]) {
    if (!existsSync(f)) continue;
    const m = readFileSync(f, "utf8").match(/^NEXT_PUBLIC_SUPABASE_URL=(.+)$/m);
    if (m) return m[1].trim().replace(/^["']|["']$/g, "");
  }
  return null;
}

const url = supabaseUrl();
if (!url) {
  console.log("NEXT_PUBLIC_SUPABASE_URL not set — skipping.");
  console.log("Pass it directly to check anyway:");
  console.log("  node scripts/check-oauth-providers.mjs https://<project-ref>.supabase.co");
  process.exit(0);
}

const src = readFileSync(SRC, "utf8");
const listed = [...(src.match(/const ENABLED: Provider\[\] = \[([^\]]*)\]/)?.[1] ?? "")
  .matchAll(/"([^"]+)"/g)].map((m) => m[1]);
const known = [...src.matchAll(/^\s*id: "([^"]+)"/gm)].map((m) => m[1]);

if (!known.length) {
  console.log(`✗ could not read the provider list out of ${SRC} — has it been restructured?`);
  process.exit(1);
}

// A redirect_to the project does not allow is rejected before the provider is
// even considered, so use the callback the buttons really use.
const probe = async (id) => {
  const target = `${url.replace(/\/$/, "")}/auth/v1/authorize?provider=${id}` +
    `&redirect_to=${encodeURIComponent("https://northedm.com/auth/callback")}`;
  try {
    const res = await fetch(target, { redirect: "manual" });
    return res.status === 302 || res.status === 303;
  } catch (e) {
    console.log(`   ! could not reach Supabase for "${id}": ${e.message}`);
    return null;
  }
};

console.log(`Checking ${known.length} providers against ${url}\n`);

let broken = 0;
let missing = 0;

for (const id of known) {
  const live = await probe(id);
  const drawn = listed.includes(id);
  if (live === null) process.exit(1);

  if (drawn && live) console.log(`   ✓ ${id.padEnd(9)} enabled, button shown`);
  else if (!drawn && !live) console.log(`   · ${id.padEnd(9)} not enabled, no button — fine`);
  else if (drawn && !live) {
    broken++;
    console.log(`   ✗ ${id.padEnd(9)} BUTTON SHOWN BUT PROVIDER IS OFF — this is a broken signup screen.`);
    console.log(`                 Add its credentials in Supabase, or drop "${id}" from ENABLED in ${SRC}.`);
  } else {
    missing++;
    console.log(`   ⚠ ${id.padEnd(9)} enabled in Supabase but no button is drawn.`);
    console.log(`                 Add "${id}" to ENABLED in ${SRC} to let people use it.`);
  }
}

if (broken) {
  console.log(`\n❌ ${broken} button${broken === 1 ? "" : "s"} would fail on tap.`);
  process.exit(1);
}
console.log(
  missing
    ? `\n⚠️  ${missing} provider${missing === 1 ? " is" : "s are"} paid for but unused — nothing is broken.`
    : "\n✅ every button we draw reaches a provider that is on"
);
