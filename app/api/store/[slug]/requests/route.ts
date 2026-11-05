import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { storeAdminClient } from "@/utils/store";
import { isSiteAdminUser } from "@/utils/coordinator";
import { shieldForm } from "@/utils/botSignals";
import { emailUser, notifyUserInApp } from "@/utils/notifyEmail";
import { notifyProductRequest } from "@/utils/alerts";
import { BRAND_STORE_SLUG } from "@/utils/brandShop";

/**
 * "Couldn't find what you were looking for? → request here" (owner,
 * 2026-11-05). A signed-in shopper asks this store for one of its items, or
 * for anything in their own words, and how many. Push guard: one request per
 * person per item, or per thing typed (unique indexes), plus the form shield. The store's operator is alerted (bell + email; for the
 * NorthEDM shop also the owner's phone) and handles them in Edit shop.
 *
 * GET            → { mine: productId[] } for the shopper, and for the
 *                  operator/admin { requests: [...] } (open ones first)
 * POST           → { productId, quantity, note } create
 * PATCH          → { id, status: "done" | "dismissed" } operator/admin
 */
async function context(slug: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const admin = storeAdminClient();
  const { data: store } = await admin.from("stores").select("id, slug, name, owner_user_id, active").eq("slug", slug).maybeSingle();
  const canManage = !!user && !!store && (store.owner_user_id === user.id || (await isSiteAdminUser(admin, user)));
  return { user, admin, store, canManage };
}

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { user, admin, store, canManage } = await context(slug);
  if (!store) return NextResponse.json({ error: "Store not found." }, { status: 404 });
  const mine = user
    ? ((await admin.from("product_requests").select("product_id").eq("store_id", store.id).eq("user_id", user.id)).data ?? []).map((r) => Number(r.product_id))
    : [];
  if (!canManage) return NextResponse.json({ mine, signedIn: !!user });
  const { data: rows } = await admin.from("product_requests")
    .select("id, product_id, item_text, user_id, quantity, note, status, created_at").eq("store_id", store.id)
    .order("created_at", { ascending: false }).limit(200);
  const productIds = [...new Set((rows ?? []).filter((r) => r.product_id != null).map((r) => Number(r.product_id)))];
  const userIds = [...new Set((rows ?? []).map((r) => r.user_id as string))];
  const [{ data: prods }, { data: profs }] = await Promise.all([
    productIds.length ? admin.from("products").select("id, name").in("id", productIds) : Promise.resolve({ data: [] as { id: number; name: string }[] }),
    userIds.length ? admin.from("user_profiles").select("id, username, display_name").in("id", userIds) : Promise.resolve({ data: [] as { id: string; username: string | null; display_name: string | null }[] }),
  ]);
  const pName = new Map((prods ?? []).map((p) => [Number(p.id), p.name as string]));
  const who = new Map((profs ?? []).map((p) => [p.id as string, (p.username || p.display_name || "member") as string]));
  // Only a public handle leaves here — never an email or address (shop owners aren't site admins).
  const requests = (rows ?? []).map((r) => ({
    id: r.id, product_id: r.product_id, item: r.product_id != null ? pName.get(Number(r.product_id)) ?? "Item" : `“${r.item_text}”`, quantity: r.quantity, note: r.note,
    status: r.status, created_at: r.created_at, user_id: r.user_id, who: who.get(r.user_id as string) ?? "member",
  })).sort((a, b) => (a.status === "open" ? 0 : 1) - (b.status === "open" ? 0 : 1));
  return NextResponse.json({ mine, signedIn: true, requests });
}

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const body = await req.json().catch(() => ({}));
  const { user, admin, store } = await context(slug);
  if (!store || !store.active) return NextResponse.json({ error: "Store not found." }, { status: 404 });
  if (!user) return NextResponse.json({ error: "Sign in to request an item." }, { status: 401 });
  const shield = await shieldForm(req, body, "product_request", { max: 10, windowMs: 60 * 60 * 1000 });
  if (shield.verdict !== "ok") return shield.response;

  const itemText = typeof body.itemText === "string" ? body.itemText.trim().replace(/\s+/g, " ").slice(0, 120) : "";
  const productId = body.productId == null || body.productId === "" ? null : Number(body.productId);
  const quantity = Math.floor(Number(body.quantity));
  const note = typeof body.note === "string" && body.note.trim() ? body.note.trim().slice(0, 300) : null;
  if (productId === null && itemText.length < 2) return NextResponse.json({ error: "Pick an item or tell us what you're after." }, { status: 400 });
  if (productId !== null && (!Number.isFinite(productId) || productId <= 0)) return NextResponse.json({ error: "Pick an item." }, { status: 400 });
  if (!Number.isFinite(quantity) || quantity < 1 || quantity > 10000) return NextResponse.json({ error: "Enter a quantity from 1 to 10,000." }, { status: 400 });
  // A picked item must belong to one of this store's approved vendors.
  let itemName = itemText;
  if (productId !== null) {
    const { data: p } = await admin.from("products").select("id, name, vendor_id").eq("id", productId).maybeSingle();
    const { data: member } = p ? await admin.from("store_vendors").select("vendor_id").eq("store_id", store.id).eq("vendor_id", p.vendor_id).eq("status", "approved").maybeSingle() : { data: null };
    if (!p || !member) return NextResponse.json({ error: "That item isn't sold here." }, { status: 400 });
    itemName = String(p.name);
  }

  const { error } = await admin.from("product_requests").insert({ store_id: store.id, product_id: productId, item_text: productId === null ? itemText : null, user_id: user.id, quantity, note });
  if (error) {
    if (/duplicate|unique/i.test(error.message)) return NextResponse.json({ error: "You've already requested this — the shop has it.", already: true }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  await shield.record();

  const { data: prof } = await admin.from("user_profiles").select("username, display_name").eq("id", user.id).maybeSingle();
  const who = (prof?.username || prof?.display_name || "A shopper") as string;
  const path = `/${store.slug}?edit=1`;
  const line = `${who} asked for ${quantity} × ${itemName}${note ? ` — "${note}"` : ""}.`;
  if (store.slug === BRAND_STORE_SLUG) {
    await notifyProductRequest({ item: itemName, quantity, note, who, path });
  } else {
    const ownerEmail = await admin.auth.admin.getUserById(store.owner_user_id as string).then((r) => r.data?.user?.email ?? null).catch(() => null);
    await Promise.allSettled([
      notifyUserInApp(admin, store.owner_user_id as string, "product_request", line, path),
      emailUser(ownerEmail, `Item request — ${quantity} × ${itemName}`, { heading: "Someone is looking for something in your shop", intro: line, cta: { label: "See requests", path } }),
    ]);
  }
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const body = await req.json().catch(() => ({}));
  const { admin, store, canManage } = await context(slug);
  if (!store) return NextResponse.json({ error: "Store not found." }, { status: 404 });
  if (!canManage) return NextResponse.json({ error: "Only this store's operator can do that." }, { status: 403 });
  const status = body.status === "done" || body.status === "dismissed" || body.status === "open" ? body.status : null;
  if (!status) return NextResponse.json({ error: "Bad status." }, { status: 400 });
  const { error } = await admin.from("product_requests").update({ status, handled_at: status === "open" ? null : new Date().toISOString() })
    .eq("id", String(body.id ?? "")).eq("store_id", store.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
