import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { resolveMyVendor } from "@/utils/myVendor";

/**
 * Visit and sales COUNTS for the shop owner's own pages. Deliberately numbers
 * only: no visitor ids, accounts, emails, addresses or order lines leave this
 * route — a shop owner is not a site admin. Owner's rule, 2026-11-03.
 */
const DAYS = 30;
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const me = await resolveMyVendor(user.id);
  if (!me) return NextResponse.json({ error: "No shop linked to this account" }, { status: 403 });
  const { admin, vendorId } = me;
  const slug = me.store?.slug ?? null;
  const since = new Date(Date.now() - DAYS * 86400e3);
  const sinceIso = since.toISOString();

  // Pages that belong to this shop: its market page and items, its storefront (not the manage page).
  const prefixes = [`/marketplace/${vendorId}`];
  if (slug) prefixes.push(`/${slug}`);
  const or = prefixes.flatMap((p) => [`path.eq.${p}`, `path.like.${p}/%`]).join(",");
  const { data: views } = await admin.from("page_views").select("path, visitor_id, referrer, created_at").gte("created_at", sinceIso).eq("is_admin", false).or(or).limit(50000);
  const rows = (views ?? []).filter((v) => !slug || !String(v.path).startsWith(`/${slug}/manage`));

  const byDay = new Map<string, number>();
  for (let i = DAYS - 1; i >= 0; i--) byDay.set(new Date(Date.now() - i * 86400e3).toISOString().slice(0, 10), 0);
  const visitors30 = new Set<string>(); const visitors7 = new Set<string>();
  let views7 = 0;
  const week = Date.now() - 7 * 86400e3;
  const itemHits = new Map<number, number>(); const refHits = new Map<string, number>();
  for (const v of rows) {
    const day = String(v.created_at).slice(0, 10);
    if (byDay.has(day)) byDay.set(day, (byDay.get(day) ?? 0) + 1);
    const t = new Date(v.created_at).getTime();
    const vid = v.visitor_id ? String(v.visitor_id) : null;
    if (vid) visitors30.add(vid);
    if (t >= week) { views7++; if (vid) visitors7.add(vid); }
    const m = /\/item\/(\d+)/.exec(String(v.path));
    if (m) itemHits.set(Number(m[1]), (itemHits.get(Number(m[1])) ?? 0) + 1);
    if (v.referrer) {
      try { const h = new URL(String(v.referrer)).hostname.replace(/^www\./, ""); if (h && !h.endsWith("northedm.com")) refHits.set(h, (refHits.get(h) ?? 0) + 1); } catch {}
    }
  }
  const topIds = [...itemHits.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const { data: prods } = topIds.length ? await admin.from("products").select("id, name").in("id", topIds.map(([id]) => id)).eq("vendor_id", vendorId) : { data: [] };
  const names = new Map((prods ?? []).map((p) => [Number(p.id), p.name as string]));
  const top_items = topIds.filter(([id]) => names.has(id)).map(([id, n]) => ({ id, name: names.get(id), views: n }));
  const top_referrers = [...refHits.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([host, n]) => ({ host, views: n }));

  // Sales: counts and this shop's own revenue, nothing about who bought.
  const { data: fd } = await admin.from("festdash_orders").select("status, total_cents, currency, created_at").eq("vendor_id", vendorId).gte("created_at", sinceIso);
  const fdRows = fd ?? [];
  const delivered = fdRows.filter((o) => o.status === "delivered");
  const openFd = fdRows.filter((o) => ["pending", "accepted", "preparing", "in_transit", "awaiting_confirmation"].includes(String(o.status))).length;
  const { data: so } = await admin.from("store_orders").select("status, items, currency, created_at").gte("created_at", sinceIso).in("status", ["paid", "fulfilled", "authorized"]).contains("items", JSON.stringify([{ vendor_id: vendorId }]));
  let storeCents = 0; let storeOrders = 0;
  for (const o of so ?? []) {
    const mine = ((o.items ?? []) as { vendor_id: number; price_cents: number; qty: number }[]).filter((l) => Number(l.vendor_id) === vendorId);
    if (!mine.length) continue;
    storeOrders++; storeCents += mine.reduce((s, l) => s + Number(l.price_cents) * Number(l.qty), 0);
  }
  const currency = String((me.vendor as { currency?: string | null }).currency || "USD");
  return NextResponse.json({
    days: DAYS, counts_only: true,
    views: { last7: views7, last30: rows.length, visitors7: visitors7.size, visitors30: visitors30.size, by_day: [...byDay.entries()].map(([day, n]) => ({ day, views: n })) },
    top_items, top_referrers,
    sales: { currency, festdash: { delivered: delivered.length, open: openFd, revenue_cents: delivered.reduce((s, o) => s + Number(o.total_cents ?? 0), 0) }, store: { orders: storeOrders, revenue_cents: storeCents } },
  });
}
