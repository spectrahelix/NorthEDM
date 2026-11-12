import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/server";
import { BRAND_SHOP_VENDOR_ID } from "@/utils/brandShop";
import { baseName } from "@/utils/productVariants";
import { MessagesInbox } from "./components/MessagesInbox";
import type { MessageDraft } from "./components/ComposeModal";

type Search = { to?: string | string[]; product?: string | string[]; shopItem?: string | string[] };
type Item = { vendorId: number; name: string; path: string };
const UUID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

async function loadItem(db: SupabaseClient, productId: number | null, shopItem: string | null): Promise<Item | null> {
  if (productId !== null) {
    const { data: product } = await db.from("products")
      .select("id, vendor_id, name, variant_label").eq("id", productId)
      .eq("is_public", true).eq("status", "published").maybeSingle();
    if (!product?.vendor_id) return null;
    const name = baseName(product) || "Item";
    return {
      vendorId: product.vendor_id,
      name: product.variant_label ? `${name} (${product.variant_label})` : name,
      path: `/marketplace/${product.vendor_id}/item/${product.id}`,
    };
  }
  if (!shopItem) return null;
  const { data: item } = await db.from("shop_products").select("slug, name")
    .eq("id", shopItem).eq("active", true).maybeSingle();
  if (!item || !/^[a-z0-9][a-z0-9-]*$/.test(item.slug)) return null;
  return { vendorId: BRAND_SHOP_VENDOR_ID, name: item.name, path: `/shop/${item.slug}` };
}

async function itemDraft(db: SupabaseClient, productId: number | null, shopItem: string | null) {
  const item = await loadItem(db, productId, shopItem);
  if (!item) return null;
  const { data: seller } = await db.from("vendors").select("user_id")
    .eq("id", item.vendorId).eq("status", "approved").eq("is_public", true)
    .is("suspended_at", null).maybeSingle();
  if (!seller?.user_id) return null;
  return {
    recipientId: seller.user_id as string,
    subject: `Question about ${item.name.replace(/\s+/g, " ").trim()}`.slice(0, 100),
    item: { name: item.name, path: item.path },
  } satisfies MessageDraft;
}

async function blockedMembers(db: SupabaseClient, userId: string) {
  const { data: blocks } = await db.from("message_blocks").select("blocked_id")
    .eq("blocker_id", userId).order("created_at", { ascending: false });
  if (!blocks?.length) return [];
  const ids = blocks.map(block => block.blocked_id as string);
  const { data: profiles } = await db.from("user_profiles").select("id, display_name").in("id", ids);
  const names = new Map(profiles?.map(profile => [profile.id as string, profile.display_name as string]));
  return ids.map(id => ({ id, display_name: names.get(id) ?? "Member" }));
}

export default async function MessagesPage({ searchParams }: { searchParams: Promise<Search> }) {
  const query = await searchParams;
  const to = typeof query.to === "string" && UUID.test(query.to) ? query.to : null;
  const id = typeof query.product === "string" && /^[1-9]\d*$/.test(query.product) ? Number(query.product) : NaN;
  const productId = Number.isSafeInteger(id) ? id : null;
  const shopItem = typeof query.shopItem === "string" && UUID.test(query.shopItem) ? query.shopItem : null;
  const hasItem = query.product !== undefined || query.shopItem !== undefined;

  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) {
    const next = new URLSearchParams();
    if (productId !== null) next.set("product", String(productId));
    else if (shopItem) next.set("shopItem", shopItem);
    else if (to) next.set("to", to);
    const path = next.size ? `/messages?${next}` : "/messages";
    redirect(`/login?next=${encodeURIComponent(path)}`);
  }

  const [blocked, draft] = await Promise.all([
    blockedMembers(db, user.id),
    hasItem ? itemDraft(db, productId, shopItem) : Promise.resolve(to ? { recipientId: to } : null),
  ]);
  const ownItem = hasItem && draft?.recipientId === user.id;
  const contactNotice = ownItem ? "This is your listing."
    : hasItem && !draft ? "This item or its seller is unavailable for messaging." : undefined;
  return <MessagesInbox userId={user.id} initialDraft={ownItem ? null : draft} initialBlocked={blocked} contactNotice={contactNotice} />;
}
