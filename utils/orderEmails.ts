import type { SupabaseClient } from "@supabase/supabase-js";
import { emailUser, userEmailById, notifyUserInApp } from "@/utils/notifyEmail";
import { docPath, loadOrderDoc, type DocKind } from "@/utils/orderDocs";
import { formatMoney } from "@/utils/money";

const OWNER_EMAIL = process.env.OWNER_ALERT_EMAIL || "cjblue27@gmail.com";

/**
 * The two emails every paid order gets, whichever shop it came from:
 *   buyer  → receipt (what they paid, where it ships, estimated arrival, link)
 *   seller → pack sheet (invoice + shipping label links, what to box)
 * Shop orders' seller is the owner; a store order's seller is the operator
 * (and the owner is copied so nothing ships unseen).
 */
export async function sendOrderEmails(admin: SupabaseClient, kind: DocKind, id: string): Promise<void> {
  const doc = await loadOrderDoc(admin, kind, id);
  if (!doc) return;
  const money = (c: number) => formatMoney(c, doc.currency);
  const itemsText = doc.lines.map((l) => `${l.qty}× ${l.name}`).join(", ");
  const shipTo = [doc.buyer.name, doc.buyer.line1, doc.buyer.city, doc.buyer.region, doc.buyer.postal_code, doc.buyer.country].filter(Boolean).join(", ");
  const rows: [string, string][] = [
    ["Order", doc.number], ["Items", itemsText], ["Subtotal", money(doc.subtotal_cents)],
    ...(doc.discount_cents ? [["Discount", `−${money(doc.discount_cents)}`] as [string, string]] : []),
    ...(doc.shipping_cents || doc.shipping.service ? [["Shipping", `${money(doc.shipping_cents)}${doc.shipping.service ? ` · ${doc.shipping.service}` : ""}`] as [string, string]] : []),
    ["Total", money(doc.total_cents)], ["Payment", doc.payment],
    ...(shipTo ? [["Ships to", shipTo] as [string, string]] : []),
    ...(doc.shipping.eta ? [["Estimated delivery", `${doc.shipping.eta} after it ships`] as [string, string]] : []),
  ];
  const seller = doc.seller.name || "the shop";
  await emailUser(doc.buyer.email, `Receipt · ${doc.number} · ${seller}`, {
    heading: "Thanks — your order is paid",
    intro: `${seller} has your order and will pack it for shipping. Keep this receipt; the link below is yours to print any time.`,
    rows, cta: { label: "View receipt", path: docPath(kind, id, "receipt") },
    outro: doc.international ? "International orders can take longer through customs. Import duties or taxes charged at the border are paid by the recipient." : "You'll get a tracking number once it ships.",
  });

  const packRows: [string, string][] = [
    ["Order", doc.number], ["Pack", itemsText], ["Ship to", shipTo || "see order"],
    ["Service", doc.shipping.service ?? "—"], ["Package weight", doc.shipping.weight_g ? `${doc.shipping.weight_g} g` : "—"], ["Customer paid for shipping", money(doc.shipping_cents)],
  ];
  const packIntro = `Print the label and invoice, box ${itemsText}, and buy ${doc.shipping.service ?? "postage"} at the counter or online. ${doc.international ? "This one is international — the label includes the customs declaration; keep a copy of the invoice inside the box." : ""}`;
  const base = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");
  const links = `Label: ${base}${docPath(kind, id, "label")}\nInvoice: ${base}${docPath(kind, id, "invoice")}\nReceipt: ${base}${docPath(kind, id, "receipt")}`;
  const sellerParts = { heading: `Pack & ship · ${doc.number}`, intro: packIntro, rows: packRows, cta: { label: "Print shipping label", path: docPath(kind, id, "label") }, outro: links };
  if (kind === "shop") {
    await emailUser(OWNER_EMAIL, `📦 Pack & ship · ${doc.number} · ${money(doc.total_cents)}`, sellerParts);
    return;
  }
  // Store: operator gets the pack sheet (+ in-app), owner is copied.
  const { data: st } = await admin.from("stores").select("owner_user_id, slug").eq("id", (await admin.from("store_orders").select("store_id").eq("id", id).maybeSingle()).data?.store_id).maybeSingle();
  const opEmail = await userEmailById(admin, st?.owner_user_id);
  await Promise.allSettled([
    emailUser(opEmail, `📦 Pack & ship · ${doc.number} · ${money(doc.total_cents)}`, sellerParts),
    notifyUserInApp(admin, st?.owner_user_id, "store_order", `Order ${doc.number} paid — ${itemsText}. Print the label from your store's manage page.`, st?.slug ? `/${st.slug}/manage` : "/"),
    opEmail !== OWNER_EMAIL ? emailUser(OWNER_EMAIL, `Store order · ${doc.number} · ${seller}`, { ...sellerParts, intro: `${seller} sold ${itemsText}. Their pack sheet went to ${opEmail ?? "the operator"}.` }) : Promise.resolve(),
  ]);
}
