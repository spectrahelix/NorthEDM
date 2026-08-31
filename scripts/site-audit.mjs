#!/usr/bin/env node
// NorthEDM weekly site audit — mechanical health, security, feature, and config
// checks. Runs in CI (see .github/workflows/weekly-audit.yml) and locally:
//
//   node scripts/site-audit.mjs
//
// It writes docs/SITE_AUDIT.md (the living report) and prints a Markdown summary
// between <<<AUDIT_SUMMARY>>> markers on stdout, which the workflow lifts into a
// GitHub issue so the owner is notified. Zero dependencies — Node built-ins only.

import { execSync } from "node:child_process";
import { readdirSync, readFileSync, writeFileSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const APP = join(ROOT, "app");

function sh(cmd, opts = {}) {
  try {
    return { ok: true, out: execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...opts }) };
  } catch (e) {
    return { ok: false, out: (e.stdout || "") + (e.stderr || ""), code: e.status };
  }
}

function walk(dir, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, acc);
    else acc.push(p);
  }
  return acc;
}

// ── 1. Feature / route inventory ────────────────────────────────────────────
// Every page.tsx → a user-facing route; every route.ts → an API endpoint.
function routeFromFile(file, kind) {
  let rel = relative(APP, file).replace(/\\/g, "/");
  rel = rel.replace(/\/(page|route)\.tsx?$/, "");
  // Strip Next.js route groups "(group)".
  rel = rel.split("/").filter((seg) => !/^\(.*\)$/.test(seg)).join("/");
  const path = "/" + rel;
  return path === "/" && kind === "api" ? "/" : path === "" ? "/" : path;
}

const files = walk(APP);
const pages = files.filter((f) => /\/page\.tsx?$/.test(f)).map((f) => routeFromFile(f, "page")).sort();
const apis = files.filter((f) => /\/route\.tsx?$/.test(f)).map((f) => routeFromFile(f, "api")).sort();
const dynamicPages = pages.filter((p) => p.includes("[")).length;

// ── 2. Security — npm audit + dependency count ──────────────────────────────
let vulns = { info: 0, low: 0, moderate: 0, high: 0, critical: 0, total: 0 };
let topAdvisories = [];
{
  const r = sh("npm audit --json", { maxBuffer: 32 * 1024 * 1024 });
  try {
    const j = JSON.parse(r.out);
    if (j.metadata?.vulnerabilities) {
      vulns = { ...vulns, ...j.metadata.vulnerabilities };
      vulns.total = j.metadata.vulnerabilities.total ?? 0;
    }
    const advs = j.vulnerabilities || {};
    topAdvisories = Object.values(advs)
      .filter((a) => a.severity === "high" || a.severity === "critical")
      .map((a) => `${a.name} (${a.severity})`)
      .slice(0, 20);
  } catch { /* npm audit returns non-zero + json; if parse fails, leave zeros */ }
}

// ── 3. Correctness — typecheck ──────────────────────────────────────────────
const tsc = sh("npx tsc --noEmit -p tsconfig.json", { maxBuffer: 32 * 1024 * 1024 });
const tscErrors = (tsc.out.match(/error TS\d+/g) || []).length;

// ── 4. Config — env-var checklist ───────────────────────────────────────────
const envRefs = [
  ...new Set(
    sh(`grep -rhoE "process\\.env\\.[A-Z0-9_]+" app utils 2>/dev/null || true`).out
      .split("\n").map((l) => l.replace("process.env.", "").trim()).filter(Boolean)
  ),
].sort();
const envRows = envRefs.map((k) => {
  const present = process.env[k] !== undefined && process.env[k] !== "";
  return { k, present, pub: k.startsWith("NEXT_PUBLIC_") };
});
const envMissing = envRows.filter((r) => !r.present).map((r) => r.k);
const auditingInCI = !!process.env.CI;

// ── 5. Migrations + TODO backlog ────────────────────────────────────────────
const migDir = join(ROOT, "supabase", "migrations");
const migrations = existsSync(migDir) ? readdirSync(migDir).filter((f) => f.endsWith(".sql")).sort() : [];
const latestMigration = migrations.at(-1) || "(none)";
const todoCount = (sh(`grep -rInE "\\b(TODO|FIXME)\\b" app utils 2>/dev/null || true`).out.split("\n").filter(Boolean)).length;

// ── 6. Growth & backlog (optional — needs Supabase service key) ──────────────
// Reads through a locked-down SECURITY DEFINER RPC (audit_growth_stats) that
// only service_role may call. Absent secrets → this section is simply omitted.
let growth = null;
{
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && key) {
    try {
      const res = await fetch(`${url}/rest/v1/rpc/audit_growth_stats`, {
        method: "POST",
        headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: "{}",
      });
      if (res.ok) growth = await res.json();
      else console.error(`[site-audit] growth RPC HTTP ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
    } catch (e) {
      console.error("[site-audit] growth fetch failed:", e.message);
    }
  }
}

// ── Assemble ────────────────────────────────────────────────────────────────
const now = new Date();
const stamp = now.toISOString().slice(0, 16).replace("T", " ") + " UTC";
const daysSince = (iso) => (iso ? Math.floor((now - new Date(iso)) / 86400000) : null);
const flags = [];
if (vulns.critical > 0) flags.push(`🔴 ${vulns.critical} critical vulnerabilit${vulns.critical === 1 ? "y" : "ies"}`);
if (vulns.high > 0) flags.push(`🟠 ${vulns.high} high vulnerabilit${vulns.high === 1 ? "y" : "ies"}`);
if (tscErrors > 0) flags.push(`🔴 ${tscErrors} TypeScript error${tscErrors === 1 ? "" : "s"} (build likely broken)`);
if (growth && growth.reports_open > 0) flags.push(`🟡 ${growth.reports_open} open bug/feedback report${growth.reports_open === 1 ? "" : "s"}`);
if (growth && growth.new_30d === 0) flags.push(`⚪ no new signups in 30 days`);
if (todoCount > 0) flags.push(`⚪ ${todoCount} TODO/FIXME markers`);
const health = flags.length === 0 ? "🟢 All clear" : flags.join(" · ");

const growthRows = growth
  ? `| Users | **${growth.total_users}** total · ${growth.new_7d} new (7d) · ${growth.new_30d} new (30d) |
| Latest signup | ${growth.latest_signup ? `${growth.latest_signup.slice(0, 10)} (${daysSince(growth.latest_signup)}d ago)` : "—"} |
| Open bug/feedback reports | ${growth.reports_open}${growth.reports_total ? ` of ${growth.reports_total} total` : ""} |\n`
  : "";

const envTable = envRows
  .map((r) => `| \`${r.k}\` | ${r.pub ? "public" : "server"} | ${auditingInCI ? (r.present ? "✅ set" : "❌ missing") : "—"} |`)
  .join("\n");

const summary = `## 🔍 NorthEDM Site Audit — ${stamp}

**Health:** ${health}

| Area | Result |
| :-- | :-- |
| Features (pages) | **${pages.length}** routes (${dynamicPages} dynamic) |
| API endpoints | **${apis.length}** |
${growthRows}| Security (npm audit) | ${vulns.critical} critical · ${vulns.high} high · ${vulns.moderate} moderate · ${vulns.low} low |
| TypeScript | ${tscErrors === 0 ? "✅ clean" : `❌ ${tscErrors} errors`} |
| Migrations | ${migrations.length} (latest: \`${latestMigration}\`) |
| Env vars referenced | ${envRefs.length} |
| TODO/FIXME | ${todoCount} |
${topAdvisories.length ? `\n**High/critical advisories:** ${topAdvisories.join(", ")}` : ""}
${auditingInCI && envMissing.length ? `\n<sub>FYI (not a problem): ${envMissing.length} env vars aren't set in CI — expected, CI has no Vercel secrets. Full list in docs/SITE_AUDIT.md.</sub>` : ""}${auditingInCI && !growth ? `\n_Growth stats unavailable — set \`NEXT_PUBLIC_SUPABASE_URL\` + \`SUPABASE_SERVICE_ROLE_KEY\` as Actions secrets to include them._` : ""}`;

const doc = `# NorthEDM — Site Audit

_Living report. Regenerated weekly by \`.github/workflows/weekly-audit.yml\` and on demand with \`node scripts/site-audit.mjs\`. The weekly run also opens a dated GitHub issue labeled \`weekly-audit\` so nothing has to be checked by hand._

**Last run:** ${stamp}
**Health:** ${health}

${summary.split("\n").slice(4).join("\n")}

---

## Feature inventory (${pages.length} pages)

${pages.map((p) => `- \`${p}\``).join("\n")}

## API endpoints (${apis.length})

${apis.map((p) => `- \`${p}\``).join("\n")}

## Environment variables (${envRefs.length} referenced)

| Variable | Scope | CI status |
| :-- | :-- | :-- |
${envTable}

_CI status is blank when run locally. Missing server secrets in CI is normal — what matters is they're set in **Vercel** (Production) and, for the audit's own growth stats, as **GitHub Actions secrets**._

## How to read this

- **Features** — every page/route that exists. If something you expect is missing, it wasn't shipped or was removed.
- **Security** — \`npm audit\`. Criticals/highs are worth a look; \`npm audit fix\` handles most.
- **TypeScript** — a non-zero count means the production build is probably broken.
- **Env vars** — anything the code reads. A missing one in Vercel silently disables that feature (e.g. no \`BREVO_API_KEY\` → no owner emails).

## Deeper, judgment-based audits

Basic growth (users, recent signups, open reports) is included automatically when
the Supabase Actions secrets are set. For the deeper read — RLS-policy gaps, dead
notification paths, funnel analysis, and which features are actually *working*
(not just present) — run the Claude playbook: **\`/site-audit\`** in a Claude Code
session.
`;

writeFileSync(join(ROOT, "docs", "SITE_AUDIT.md"), doc);
process.stdout.write(`\n<<<AUDIT_SUMMARY>>>\n${summary}\n<<<AUDIT_SUMMARY>>>\n`);
console.error(`[site-audit] wrote docs/SITE_AUDIT.md — ${health}`);
