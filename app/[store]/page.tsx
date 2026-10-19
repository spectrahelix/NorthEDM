import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/utils/supabase/server";
import { storeAdminClient, viewerCanPreviewStore, viewerIsSiteAdmin } from "@/utils/store";
import { cookies } from "next/headers";
import { AdminLookPill } from "@/app/components/AdminLookPill";
import { lookPreviewCookie, isShopFont } from "@/utils/storeFonts";
import { isStoreTheme } from "@/utils/storeThemes";
import { BackBar } from "@/app/components/BackBar";
import { StoreCart, type StoreProduct } from "./StoreCart";
import { brandFor, viewerWantsShopFonts } from "@/utils/shopBrand";
import { ShopFontToggle } from "@/app/components/ShopFontToggle";

export const dynamic = "force-dynamic";

type Store = { id: string; slug: string; name: string; tagline: string | null; accent_color: string };
type Vendor = { id: number; name: string | null; category: string | null; description: string | null };
type Product = { id: number; vendor_id: number; name: string | null; category: string | null; price: number | null; image_url: string | null };

export async function generateMetadata({ params }: { params: Promise<{ store: string }> }): Promise<Metadata> {
  const { store } = await params;
  const supabase = await createClient();
  // Only a LIVE store gets real metadata. A draft must never leak its name into a
  // link preview or a search result, so it stays generic and noindex.
  const { data } = await supabase.from("stores").select("name, tagline").eq("slug", store).eq("active", true).maybeSingle();
  if (!data) return { title: "Store", robots: { index: false, follow: false } };
  return { title: data.name, description: data.tagline || `${data.name} on NorthEDM` };
}

export default async function StorefrontPage({ params }: { params: Promise<{ store: string }> }) {
  const { store: slug } = await params;
  const supabase = await createClient();

  // Look the store up regardless of `active`, then decide who may see it. A DRAFT
  // store renders only for a NorthEDM admin or its own operator, so a half-built
  // storefront can be worked on in place without the public ever reaching it —
  // everyone else gets the same 404 as a store that doesn't exist.
  const admin = storeAdminClient();
  const { data: storeData } = await admin
    .from("stores").select("id, slug, name, tagline, accent_color, active, owner_user_id, billing_status, theme, font, allow_custom_font, allow_custom_theme, logo_url").eq("slug", slug).maybeSingle();
  if (!storeData) notFound();

  const isDraft = !storeData.active;
  if (isDraft && !(await viewerCanPreviewStore(storeData.owner_user_id as string))) notFound();
  const store = storeData as unknown as Store;

  const { data: members } = await supabase
    .from("store_vendors").select("vendor_id").eq("store_id", store.id).eq("status", "approved");
  const vendorIds = (members ?? []).map((m) => m.vendor_id as number);

  const [{ data: vendorsData }, { data: productsData }] = await Promise.all([
    vendorIds.length
      ? supabase.from("vendors").select("id, name, category, description").in("id", vendorIds).eq("status", "approved").eq("is_public", true)
      : Promise.resolve({ data: [] as Vendor[] }),
    vendorIds.length
      ? supabase.from("products").select("id, vendor_id, name, category, price, image_url").in("vendor_id", vendorIds).eq("is_public", true).eq("status", "published").gt("inventory_count", 0).order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as Product[] }),
  ]);
  const vendors = (vendorsData ?? []) as Vendor[];
  const products = (productsData ?? []) as Product[];
  const vendorName = new Map(vendors.map((v) => [v.id, v.name]));
  // The shop's identity on its own page: theme background + display font,
  // unless the operator or this visitor has switched custom fonts off.
  const [viewerFonts, isAdmin] = await Promise.all([viewerWantsShopFonts(), viewerIsSiteAdmin()]);
  const saved = storeData as unknown as { theme: string; font: string | null; allow_custom_font: boolean; allow_custom_theme: boolean; accent_color: string };
  // A NorthEDM admin can preview other looks live (AdminLookPill); the preview
  // cookie is ignored for everyone else, so it never changes what they see.
  let look = { theme: saved.theme, font: saved.font };
  if (isAdmin) {
    const raw = (await cookies()).get(lookPreviewCookie(slug))?.value;
    if (raw) {
      const [t, f] = decodeURIComponent(raw).split("|");
      look = { theme: isStoreTheme(t) ? t : saved.theme, font: f ? (isShopFont(f) ? f : saved.font) : null };
    }
  }
  // While an admin is previewing, show the previewed theme even if the
  // operator has their theme switched to Standard.
  const previewing = look.theme !== saved.theme || look.font !== saved.font;
  const brand = brandFor({ ...saved, ...look, ...(previewing ? { allow_custom_theme: true, allow_custom_font: true } : {}) }, viewerFonts);
  const accent = brand.accent;
  const display = brand.font ? { fontFamily: brand.font } : undefined;

  // A store takes money only when it's public AND its operator is paid up. Draft or
  // unpaid → browse-only, with the reason shown rather than a dead button.
  const billing = (storeData as { billing_status?: string }).billing_status ?? "unpaid";
  const canOrder = !isDraft && billing === "active";
  const closedReason = isDraft
    ? "This store is still a draft — ordering opens when it's published."
    : billing === "unpaid"
      ? "This store isn't open for orders yet."
      : billing === "past_due" || billing === "canceled"
        ? "This store has paused ordering. Browsing is still available."
        : undefined;
  const cartProducts: StoreProduct[] = products.map((p) => ({
    id: p.id,
    name: p.name ?? "Item",
    price_cents: Math.round(Number(p.price ?? 0) * 100),
    vendor_name: vendorName.get(p.vendor_id) ?? null,
    image_url: p.image_url,
    href: `/marketplace/${p.vendor_id}/item/${p.id}`,
  }));

  return (
    <main className="relative min-h-screen overflow-x-clip text-neutral-100" style={{ background: brand.theme.background }}>
      {/* A faint watermark of the shop's logo, drifting behind its products. */}
      {brand.theme.watermark && (storeData as { logo_url?: string | null }).logo_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img aria-hidden src={(storeData as { logo_url: string }).logo_url} alt=""
          className="pointer-events-none absolute -right-24 top-[520px] w-[520px] max-w-none select-none opacity-[0.07]" />
      )}
      {isDraft && (
        <div className="sticky top-0 z-40 border-b border-[#FFC93C]/30 bg-[#FFC93C]/[0.12] px-6 py-3 backdrop-blur">
          <p className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <span className="font-dm-mono text-xs uppercase tracking-widest text-[#FFC93C]">● Draft — not public</span>
            <span className="text-neutral-300">
              Only you and this store&apos;s operator can see this page. The public gets a 404.
            </span>
            <Link href="/admin/stores" className="font-dm-mono text-xs text-[#FFC93C] underline hover:opacity-80">
              Publish it →
            </Link>
          </p>
        </div>
      )}
      <section className="relative overflow-hidden border-b border-white/10">
        <div className="pointer-events-none absolute inset-0"
          style={brand.theme.hero ? { background: brand.theme.hero } : { background: `radial-gradient(ellipse at top, ${accent}55, transparent 60%)`, opacity: brand.theme.key === "northedm" ? 0.2 : 0.12 }} />
        <div className="relative mx-auto max-w-6xl px-6 py-16">
          <BackBar crumbs={[{ label: "Marketplace", href: "/marketplace" }]} fallback="/marketplace" />
          {/* The shop's own logo, front and centre of its storefront. */}
          {(storeData as { logo_url?: string | null }).logo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={(storeData as { logo_url: string }).logo_url} alt={`${store.name} logo`}
              className="mb-6 mt-2 h-40 w-40 rounded-3xl object-contain drop-shadow-[0_12px_28px_rgba(0,0,0,0.6)] md:h-48 md:w-48" />
          )}
          <p className="font-dm-mono text-xs uppercase tracking-[0.3em]" style={{ color: accent }}>on NorthEDM</p>
          <h1 className={`mt-3 break-words leading-none tracking-wide ${display ? "text-5xl md:text-7xl" : "font-bebas text-7xl md:text-8xl"}`} style={display}>{store.name}</h1>
          {store.tagline && <p className="mt-4 max-w-xl text-neutral-300">{store.tagline}</p>}
          <p className="mt-4 font-dm-mono text-xs text-neutral-500">
            {vendors.length} vendor{vendors.length === 1 ? "" : "s"} · {products.length} product{products.length === 1 ? "" : "s"}
          </p>
          {brand.hasFont && <ShopFontToggle enabled={viewerFonts} className="mt-5" />}
          {isAdmin && (
            <div>
              <AdminLookPill slug={store.slug} savedTheme={saved.theme} savedFont={saved.font} theme={look.theme} font={look.font} />
            </div>
          )}
        </div>
      </section>
      {brand.theme.band === "awning" && <div aria-hidden className="store-awning" />}
      {brand.theme.band === "spectrum" && <div aria-hidden className="store-spectrum" />}

      <div className="mx-auto max-w-6xl px-6 py-12">
        {vendors.length > 0 && (
          <>
            <h2 className={`mb-4 text-3xl tracking-wide ${display ? "" : "font-bebas"}`} style={display}>Vendors</h2>
            <div className="mb-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {vendors.map((v) => (
                <Link key={v.id} href={`/marketplace/${v.id}`}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition hover:bg-white/[0.06]"
                  style={{ borderColor: `${accent}22` }}>
                  <p className={`text-2xl tracking-wide ${display ? "" : "font-bebas"}`} style={display}>{v.name}</p>
                  <p className="mt-1 font-dm-mono text-xs uppercase tracking-widest text-neutral-500">{v.category || "vendor"}</p>
                  {v.description && <p className="mt-2 line-clamp-2 text-sm text-neutral-400">{v.description}</p>}
                </Link>
              ))}
            </div>
          </>
        )}

        <h2 className={`mb-4 text-3xl tracking-wide ${display ? "" : "font-bebas"}`} style={display}>Products</h2>
        {products.length === 0 ? (
          <p className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 text-center text-neutral-500">
            No products in this store yet.
          </p>
        ) : (
          <StoreCart
            slug={store.slug}
            products={cartProducts}
            accent={accent}
            displayFont={brand.font}
            cardBg={brand.theme.card}
            canOrder={canOrder}
            closedReason={closedReason}
          />
        )}
      </div>
    </main>
  );
}
