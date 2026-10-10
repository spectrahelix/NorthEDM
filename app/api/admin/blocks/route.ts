import { NextResponse } from "next/server";
import { adminGuard } from "@/utils/admin";

// Who is currently rate-limited, and the button that lets them back in.
//
// This exists because a real vendor applicant was locked out by our own
// throttle on 2026-10-10 — after retrying a bug of ours — and the only way to
// release him was hand-written SQL the owner could not run. A limit nobody can
// lift is a trap, not a safeguard.

// These must match the windows the routes themselves use.
const BUCKETS: Record<string, { label: string; what: string; max: number; windowMs: number }> = {
  "vendor-apply": {
    label: "Vendor application",
    what: "Applying to be a vendor at /vendors/apply",
    max: 5,
    windowMs: 10 * 60 * 1000,
  },
  signup: {
    label: "Account signup",
    what: "Creating an account at /signup",
    max: 3,
    windowMs: 60 * 60 * 1000,
  },
  "signin-help": {
    label: "Sign-in help",
    what: "Locked out, asking for help at /signin-help",
    max: 4,
    windowMs: 60 * 60 * 1000,
  },
};

export type BlockRow = {
  bucket: string;
  label: string;
  what: string;
  ip: string;
  attempts: number;
  max: number;
  lastAt: string;
  clearsAt: string;
  blocked: boolean;
  who: string | null;
};

export async function GET() {
  const g = await adminGuard();
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status });

  const longestWindow = Math.max(...Object.values(BUCKETS).map((b) => b.windowMs));
  const since = new Date(Date.now() - longestWindow).toISOString();

  const { data, error } = await g.admin
    .from("request_throttle")
    .select("bucket, ip, created_at")
    .gte("created_at", since)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // An IP address means nothing to a person. Sign-in help stores the address
  // people typed, so for that bucket we can say who it actually is.
  const { data: helpRows } = await g.admin
    .from("error_reports")
    .select("client_ip, contact_email")
    .eq("source", "signin-help")
    .gte("created_at", since);
  const emailByIp = new Map<string, string>();
  for (const r of helpRows ?? []) {
    if (r.client_ip && r.contact_email) {
      emailByIp.set(r.client_ip as string, r.contact_email as string);
    }
  }

  const groups = new Map<string, { bucket: string; ip: string; times: number[] }>();
  for (const row of data ?? []) {
    const bucket = row.bucket as string;
    const cfg = BUCKETS[bucket];
    if (!cfg) continue;
    const t = new Date(row.created_at as string).getTime();
    // Only count rows inside THIS bucket's own window.
    if (Date.now() - t > cfg.windowMs) continue;
    const key = `${bucket}|${row.ip}`;
    const grp = groups.get(key) ?? { bucket, ip: row.ip as string, times: [] };
    grp.times.push(t);
    groups.set(key, grp);
  }

  const rows: BlockRow[] = [...groups.values()].map((grp) => {
    const cfg = BUCKETS[grp.bucket];
    const last = Math.max(...grp.times);
    return {
      bucket: grp.bucket,
      label: cfg.label,
      what: cfg.what,
      ip: grp.ip,
      attempts: grp.times.length,
      max: cfg.max,
      lastAt: new Date(last).toISOString(),
      clearsAt: new Date(last + cfg.windowMs).toISOString(),
      blocked: grp.times.length >= cfg.max,
      who: emailByIp.get(grp.ip) ?? null,
    };
  });

  rows.sort((a, b) => Number(b.blocked) - Number(a.blocked) || b.lastAt.localeCompare(a.lastAt));
  return NextResponse.json({ rows });
}

export async function POST(req: Request) {
  const g = await adminGuard();
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status });

  const { bucket, ip } = (await req.json().catch(() => ({}))) as {
    bucket?: string;
    ip?: string;
  };
  if (!ip) return NextResponse.json({ error: "Missing ip." }, { status: 400 });

  // One person, one form. Scoped on purpose: there is no "clear everything"
  // button, so a mis-click cannot quietly switch the limits off site-wide.
  let q = g.admin.from("request_throttle").delete().eq("ip", ip);
  if (bucket) q = q.eq("bucket", bucket);
  const { error } = await q;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
