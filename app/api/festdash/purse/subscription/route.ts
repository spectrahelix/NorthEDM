import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { serviceClient, coordinatorFor, loadSplitSettings } from "@/utils/coordinator";
import { isLocalMethod, splitSubscription } from "@/utils/gambiaPay";
import { emailUser, notifyUserInApp, userEmailById } from "@/utils/notifyEmail";

// POST — the coordinator logs a monthly fee they collected from one of their
// shops. Opens (or extends) the shop's paid period and books the fee split.
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = serviceClient();
  const me = await coordinatorFor(admin, user.id);
  if (!me) return NextResponse.json({ error: "Not a coordinator." }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const vendorId = Number(body.vendorId);
  const months = Math.min(Math.max(Math.floor(Number(body.months) || 1), 1), 12);
  const method = isLocalMethod(body.method) ? body.method : "cash";
  const collectedAmount = Number(body.collectedAmount);
  const collectedCurrency = typeof body.collectedCurrency === "string" ? body.collectedCurrency.toUpperCase().slice(0, 3) : null;
  const reference = typeof body.reference === "string" ? body.reference.trim().slice(0, 64) || null : null;
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 200) || null : null;
  if (!vendorId) return NextResponse.json({ error: "Pick a shop." }, { status: 400 });

  const { data: vendor } = await admin.from("vendors").select("id, coordinator_user_id").eq("id", vendorId).maybeSingle();
  if (!vendor || vendor.coordinator_user_id !== user.id) {
    return NextResponse.json({ error: "That shop isn't one of yours." }, { status: 403 });
  }

  // The new period starts the day after the current paid-through date, or
  // today if the shop has lapsed / is new. Months are calendar months.
  const today = new Date().toISOString().slice(0, 10);
  const { data: last } = await admin.from("vendor_subscriptions").select("period_end").eq("vendor_id", vendorId).order("period_end", { ascending: false }).limit(1).maybeSingle();
  const startFrom = last && last.period_end >= today ? addDays(last.period_end, 1) : today;
  const start = typeof body.periodStart === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.periodStart) ? body.periodStart : startFrom;
  const end = addDays(addMonths(start, months), -1);

  const settings = await loadSplitSettings(admin);
  const feeCents = settings.subscription_fee_cents * months;
  const split = splitSubscription(feeCents, settings);

  const { data: sub, error } = await admin.from("vendor_subscriptions").insert({
    vendor_id: vendorId, coordinator_user_id: user.id, period_start: start, period_end: end,
    fee_cents: feeCents, collected_amount: Number.isFinite(collectedAmount) ? collectedAmount : null,
    collected_currency: collectedCurrency, method, reference, note,
  }).select("id, period_start, period_end, fee_cents").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await admin.from("coordinator_ledger").insert({
    kind: "subscription", coordinator_user_id: user.id, vendor_id: vendorId, subscription_id: sub.id,
    currency: "USD", gross_cents: feeCents, shop_cents: 0, owner_cents: split.owner, coordinator_cents: split.coordinator,
    method, reference, note: note ?? `${months} month${months === 1 ? "" : "s"} · ${start} → ${end}`, created_by: user.id,
  });

  // Tell the shop. The first fee (or one after a lapse) is the moment they go
  // live; a fee logged while still current just extends the paid-through date.
  // Best-effort: the fee is booked either way.
  const wasLive = !!last && last.period_end >= today;
  const { data: shop } = await admin.from("vendors").select("id, name, email, business_email, user_id").eq("id", vendorId).maybeSingle();
  if (shop) {
    const to = shop.email || shop.business_email || (await userEmailById(admin, shop.user_id));
    const by = me.display_name ?? "Your coordinator";
    const shopName = shop.name ?? "Your shop";
    await Promise.allSettled([
      emailUser(to, wasLive ? `Listing fee received — on FestDash through ${end}` : `${shopName} is live on FestDash`, {
        heading: wasLive ? "Fee received" : `${shopName} is live`,
        intro: wasLive
          ? `${by} logged your listing fee. Your shop stays on FestDash through ${end}.`
          : `${by} logged your first listing fee. Your shop is now on FestDash and customers in your area can order, through ${end}.`,
        rows: [["Paid through", end], ["Logged by", by]],
        cta: { label: wasLive ? "Open your dashboard" : "Add your items", path: "/vendor/dashboard" },
      }),
      notifyUserInApp(admin, shop.user_id, "shop_fee_logged",
        wasLive ? `Listing fee received — on FestDash through ${end}.` : `You're live on FestDash through ${end}. Add your items.`, "/vendor/dashboard"),
    ]);
  }

  return NextResponse.json({ subscription: sub });
}

function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10);
}
function addMonths(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`); d.setUTCMonth(d.getUTCMonth() + n); return d.toISOString().slice(0, 10);
}
