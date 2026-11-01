import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { requireVerifiedUser } from "@/utils/authGate";
import { serviceClient, loadSplitSettings } from "@/utils/coordinator";
import { notifyNewApplication } from "@/utils/alerts";

// The shop owner's self-service path for a coordinator region. One
// application creates the vendor record, links it to its coordinator by code,
// records payout wallets and the accepted terms, and alerts the owner. The
// owner's Approve in /admin/vendors then grants access AND enrols the shop on
// FestDash in one click (see /api/vendors/update).

const DEFAULT_REGION = "gambia";
const DEFAULT_CURRENCY = "GMD";
const WALLET_KEYS = ["wave", "qmoney", "afrimoney"] as const;

type Wallets = { wave: string | null; qmoney: string | null; afrimoney: string | null; preferred: string | null };

function cleanWallets(raw: unknown): Wallets {
  const w = (raw ?? {}) as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === "string" ? v.trim().slice(0, 40) || null : null);
  const out: Wallets = { wave: num(w.wave), qmoney: num(w.qmoney), afrimoney: num(w.afrimoney), preferred: null };
  const pref = typeof w.preferred === "string" ? w.preferred : null;
  out.preferred = pref && (WALLET_KEYS as readonly string[]).includes(pref) && out[pref as keyof Wallets] ? pref : WALLET_KEYS.find((k) => out[k]) ?? null;
  return out;
}

async function resolveCoordinator(admin: ReturnType<typeof serviceClient>, code: string) {
  const { data } = await admin
    .from("festdash_promoters")
    .select("user_id, display_name, region, referral_code")
    .ilike("referral_code", code)
    .eq("is_coordinator", true)
    .eq("is_active", true)
    .maybeSingle();
  return data;
}

async function myVendor(admin: ReturnType<typeof serviceClient>, userId: string) {
  // The approved link lives on the profile; a pending application only has
  // vendors.user_id. Check both so the walkthrough shows the right step.
  const { data: prof } = await admin.from("user_profiles").select("vendor_id").eq("id", userId).maybeSingle();
  const cols = "id, name, category, description, area, status, is_public, suspended_at, user_id, coordinator_user_id, coordinator_code, region, currency, whatsapp_number, payout_wallets, terms_accepted_at, created_at";
  if (prof?.vendor_id) {
    const { data } = await admin.from("vendors").select(cols).eq("id", prof.vendor_id).maybeSingle();
    if (data) return data;
  }
  const { data } = await admin.from("vendors").select(cols).eq("user_id", userId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  return data;
}

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const admin = serviceClient();
  const ref = new URL(req.url).searchParams.get("ref")?.trim() ?? "";
  const settings = await loadSplitSettings(admin);
  const refCoordinator = ref ? await resolveCoordinator(admin, ref) : null;

  if (!user) {
    return NextResponse.json({ user: null, vendor: null, settings, refCoordinator: refCoordinator ? { display_name: refCoordinator.display_name, region: refCoordinator.region } : null });
  }

  const vendor = await myVendor(admin, user.id);
  let coordinator: { display_name: string | null; region: string | null; whatsapp_number: string | null } | null = null;
  let feeCurrent = false, paidThrough: string | null = null, enrolled = false, storeSlug: string | null = null;
  if (vendor) {
    const today = new Date().toISOString().slice(0, 10);
    const [{ data: c }, { data: sub }, { data: fd }, { data: store }] = await Promise.all([
      vendor.coordinator_user_id
        ? admin.from("festdash_promoters").select("display_name, region, whatsapp_number").eq("user_id", vendor.coordinator_user_id).maybeSingle()
        : Promise.resolve({ data: null }),
      admin.from("vendor_subscriptions").select("period_end").eq("vendor_id", vendor.id).order("period_end", { ascending: false }).limit(1).maybeSingle(),
      admin.from("festdash_vendors").select("is_active").eq("vendor_id", vendor.id).maybeSingle(),
      admin.from("store_vendors").select("stores(slug, active)").eq("vendor_id", vendor.id).limit(1).maybeSingle(),
    ]);
    coordinator = c ?? null;
    paidThrough = sub?.period_end ?? null;
    feeCurrent = !!sub && sub.period_end >= today;
    enrolled = !!fd?.is_active;
    const s = (store as { stores?: { slug?: string } | { slug?: string }[] } | null)?.stores;
    storeSlug = Array.isArray(s) ? s[0]?.slug ?? null : s?.slug ?? null;
  }

  return NextResponse.json({
    user: { email: user.email ?? null, verified: !!user.email_confirmed_at },
    vendor: vendor ? { ...vendor, enrolled, fee_current: feeCurrent, paid_through: paidThrough, store_slug: storeSlug, live: vendor.status === "approved" && !!vendor.is_public && !vendor.suspended_at && enrolled && feeCurrent } : null,
    coordinator,
    settings,
    refCoordinator: refCoordinator ? { display_name: refCoordinator.display_name, region: refCoordinator.region } : null,
  });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const gate = await requireVerifiedUser(supabase);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = serviceClient();
  const existing = await myVendor(admin, user.id);
  if (existing) return NextResponse.json({ error: "You already have a shop on file.", vendorId: existing.id }, { status: 409 });

  const body = await req.json().catch(() => ({}));
  const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const name = str(body.shopName, 80);
  const category = str(body.category, 40);
  const description = str(body.description, 1200);
  const area = str(body.area, 80);
  const whatsapp = str(body.whatsapp, 40);
  const code = str(body.coordinatorCode, 40);
  const wallets = cleanWallets(body.wallets);
  if (!name || !category || !description || !area || !whatsapp) {
    return NextResponse.json({ error: "Shop name, what you sell, a description, your area and a WhatsApp number are all needed." }, { status: 400 });
  }
  if (body.agree !== true) return NextResponse.json({ error: "Please tick the box to accept the fee and the split." }, { status: 400 });

  let coordinator: Awaited<ReturnType<typeof resolveCoordinator>> = null;
  if (code) {
    coordinator = await resolveCoordinator(admin, code);
    if (!coordinator) return NextResponse.json({ error: "That coordinator code isn't recognised. Check it with the person who signed you up, or leave it blank." }, { status: 400 });
  }

  const { data: vendor, error } = await admin.from("vendors").insert({
    name, category, description, area,
    email: user.email ?? null,
    business_email: user.email ?? null,
    user_id: user.id,
    whatsapp_number: whatsapp,
    payout_wallets: wallets,
    coordinator_user_id: coordinator?.user_id ?? null,
    coordinator_code: coordinator?.referral_code ?? null,
    region: coordinator?.region ?? DEFAULT_REGION,
    currency: DEFAULT_CURRENCY,
    terms_accepted_at: new Date().toISOString(),
    is_public: false,
    wants_public: true,
    status: "pending",
    vendor_type: "listed",
    is_founder: false,
    show_phone: false,
  }).select("id, name, status").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await notifyNewApplication({
    kind: "vendor",
    name,
    email: user.email ?? "",
    detail: `Shop setup (${coordinator?.region ?? DEFAULT_REGION}) · ${category} · ${area} · WhatsApp ${whatsapp}` +
      (coordinator ? ` · coordinator: ${coordinator.display_name ?? coordinator.user_id}` : " · no coordinator code given") +
      ` · payout: ${wallets.preferred ?? "cash only"}. Approve in /admin/vendors — approval also enrols them on FestDash.`,
  });

  return NextResponse.json({ vendor });
}

// PATCH — the shop owner edits their payout wallets / WhatsApp / area.
export async function PATCH(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = serviceClient();
  const vendor = await myVendor(admin, user.id);
  if (!vendor || vendor.user_id !== user.id) return NextResponse.json({ error: "No shop on file for this account." }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const patch: Record<string, unknown> = {};
  if (body.wallets !== undefined) patch.payout_wallets = cleanWallets(body.wallets);
  if (typeof body.whatsapp === "string") patch.whatsapp_number = body.whatsapp.trim().slice(0, 40) || null;
  if (typeof body.area === "string") patch.area = body.area.trim().slice(0, 80) || null;
  if (!Object.keys(patch).length) return NextResponse.json({ error: "Nothing to change." }, { status: 400 });

  const { data, error } = await admin.from("vendors").update(patch).eq("id", vendor.id).select("id, whatsapp_number, area, payout_wallets").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ vendor: data });
}
