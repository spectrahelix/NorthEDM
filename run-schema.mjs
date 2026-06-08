/**
 * Runs supabase/forum-build-schema.sql against the Supabase project.
 * Requires SUPABASE_ACCESS_TOKEN to be set (a personal access token from
 * https://supabase.com/dashboard/account/tokens).
 *
 * Usage:  node run-schema.mjs
 */
import { readFileSync } from "fs";
import { execSync } from "child_process";

const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const REF   = "bacyusmyzyawcrdpnvrt";
const FILE  = new URL("./supabase/forum-build-schema.sql", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

if (!TOKEN) {
  console.error("❌  SUPABASE_ACCESS_TOKEN not set.");
  console.error("    Run: export SUPABASE_ACCESS_TOKEN=sbp_...");
  process.exit(1);
}

const sql = readFileSync(FILE, "utf8");
console.log(`📄  Loaded schema (${sql.length} bytes)`);

// ── Strategy 1: Supabase Management API ────────────────────────────────────
async function tryManagementApi() {
  console.log("🔄  Trying Supabase Management API …");

  const url = `https://api.supabase.com/v1/projects/${REF}/database/query`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
      apikey: TOKEN,
    },
    body: JSON.stringify({ query: sql }),
  });

  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }

  if (res.ok) {
    console.log("✅  Management API succeeded.");
    return true;
  }

  console.warn(`⚠️   Management API returned ${res.status}:`);
  console.warn(typeof body === "string" ? body : JSON.stringify(body, null, 2));
  return false;
}

// ── Strategy 2: supabase CLI ────────────────────────────────────────────────
function tryCliExecute() {
  console.log("🔄  Trying supabase CLI (npx supabase db execute) …");
  try {
    const out = execSync(
      `npx supabase db execute --project-ref ${REF} --file "${FILE}"`,
      { env: { ...process.env }, encoding: "utf8", stdio: "pipe" }
    );
    console.log("✅  CLI succeeded.");
    console.log(out);
    return true;
  } catch (e) {
    console.warn("⚠️   CLI failed:");
    console.warn(e.stderr || e.message);
    return false;
  }
}

// ── Run ─────────────────────────────────────────────────────────────────────
const ok = (await tryManagementApi()) || tryCliExecute();

if (!ok) {
  console.error("\n❌  Both strategies failed.");
  console.error("    Paste supabase/forum-build-schema.sql manually in:");
  console.error("    https://supabase.com/dashboard/project/bacyusmyzyawcrdpnvrt/sql/new");
  process.exit(1);
}
