import { NextResponse } from "next/server";
import { serviceClient } from "@/utils/coordinator";
import { loadShippingSettings, quoteShipping } from "@/utils/shipping";

// POST { kind: "shop" | "store", items: [{ id, qty }], country } → shipping options
// for the cart, priced from the products' weights. Public: no prices are trusted
// from the client, only ids and quantities.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const kind = body.kind === "store" ? "store" : "shop";
  const country = String(body.country || "US").toUpperCase().slice(0, 2);
  const items: { id: string | number; qty: number }[] = Array.isArray(body.items) ? body.items.slice(0, 50) : [];
  if (!items.length) return NextResponse.json({ error: "Cart is empty." }, { status: 400 });
  const admin = serviceClient();
  const table = kind === "shop" ? "shop_products" : "products";
  const { data: prods } = await admin.from(table).select("id, weight_g").in("id", items.map((i) => i.id));
  const w = new Map((prods ?? []).map((p) => [String(p.id), p.weight_g as number | null]));
  const settings = await loadShippingSettings(admin);
  const q = quoteShipping({ items: items.map((i) => ({ weight_g: w.get(String(i.id)) ?? null, qty: Math.max(1, Number(i.qty) || 1) })), country, rates: settings.rates, handlingCents: settings.handling_cents });
  return NextResponse.json({ ...q, country, estimate: true });
}
