import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/utils/supabase/server";
import { BackBar } from "@/app/components/BackBar";
import { ProductGallery } from "@/app/components/ProductGallery";
import { accentOr } from "@/utils/accent";
import { brandsForVendors, viewerWantsShopFonts } from "@/utils/shopBrand";
import { ShopFontToggle } from "@/app/components/ShopFontToggle";
import { SpecsTable } from "@/app/components/SpecsTable";
import { ShipEstimate } from "@/app/components/ShipEstimate";
import { Price, CurrencyPill } from "@/app/components/CurrencyContext";
import { VIEW_CURRENCIES } from "@/utils/viewerCurrency";
import { VARIANT_COLUMNS, baseName, groupKeyOf } from "@/utils/productVariants";
import { formatMoney } from "@/utils/money";
import { hasStock, stockLabel } from "@/utils/stock";
import { serviceClient } from "@/utils/coordinator";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string; itemId: string }> };

// Read through the visitor's own session, so the products RLS decides what is
// visible: a draft, hidden or suspended vendor's item is a 404 to the public
// but still previewable by its vendor and by NorthEDM admins.
async function load(id: string, itemId: string) {
  const supabase = await createClient();
  const { data: product } = await supabase
    .from("products")
    .select(`id, vendor_id, name, category, description, price, inventory_count, image_url, status, is_public, weight_g, length_cm, width_cm, height_cm, origin_country, specs, ${VARIANT_COLUMNS}`)
    .eq("id", Number(itemId)).eq("vendor_id", Number(id)).maybeSingle();
  if (!product) return null;
  // Size options: every size of this item the visitor may see (RLS decides),
  // listed ones only, plus the one being viewed.
  const key = groupKeyOf(product as { id: number; name: string | null; variant_of: number | null });
  const [{ data: gallery }, { data: vendor }, { data: sibs }] = await Promise.all([
    supabase.from("product_images").select("url").eq("product_id", product.id).order("position").order("id"),
    supabase.from("vendors").select("id, name, accent_color, user_id, currency").eq("id", product.vendor_id).maybeSingle(),
    // Every size of the item (owner, 2026-11-05): off-sale sizes are listed as
    // "Out of stock". Service role, display fields only, this item's group only.
    serviceClient().from("products").select("id, name, price, inventory_count, status, is_public, variant_label")
      .eq("vendor_id", product.vendor_id).or(`id.eq.${key},variant_of.eq.${key}`),
  ]);
  const sizes = ((sibs ?? []) as { id: number; name: string | null; price: number | null; inventory_count: number | null; status: string | null; is_public: boolean | null; variant_label: string | null }[])
    .filter((o) => o.id === product.id || !!o.variant_label)
    .sort((a, b) => Number(a.price ?? 0) - Number(b.price ?? 0) || a.id - b.id);
  const images = (gallery ?? []).map((g) => g.url as string);
  if (images.length === 0 && product.image_url) images.push(product.image_url as string);
  // A size with no photo of its own shows the item's photo.
  if (images.length === 0 && key !== product.id) {
    const { data: leadImgs } = await supabase.from("product_images").select("url").eq("product_id", key).order("position").order("id");
    images.push(...(leadImgs ?? []).map((g) => g.url as string));
  }
  return { product, images, vendor, sizes };
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id, itemId } = await params;
  const d = await load(id, itemId);
  if (!d) return { title: "Item", robots: { index: false, follow: false } };
  const live = d.product.is_public && d.product.status === "published";
  return {
    title: baseName(d.product as { id: number; name: string | null; variant_label: string | null }),
    description: (d.product.description as string) || undefined,
    openGraph: d.images[0] ? { images: [d.images[0]] } : undefined,
    robots: live ? undefined : { index: false, follow: false },
  };
}

export default async function ItemPage({ params }: Params) {
  const { id, itemId } = await params;
  const d = await load(id, itemId);
  if (!d) notFound();
  const { product: p, images, vendor, sizes } = d;
  const sized = sizes.length > 1;
  const title = sized ? baseName(p as { id: number; name: string | null; variant_label: string | null }) : (p.name as string);
  const [brand, viewerFonts] = await Promise.all([
    brandsForVendors([{ id: p.vendor_id as number, user_id: vendor?.user_id as string | null, accent_color: vendor?.accent_color as string | null }]).then((m) => m.get(p.vendor_id as number)!),
    viewerWantsShopFonts(),
  ]);
  const accent = brand.theme.accent ?? accentOr(vendor?.accent_color as string | null);
  const display = brand.font ? { fontFamily: brand.font } : undefined;
  const live = p.is_public && p.status === "published";
  const vendorName = (vendor?.name as string) || "Vendor";

  const vendorCurrency = String((vendor as { currency?: string | null } | null)?.currency || "USD");
  return (
    <main className="min-h-screen px-6 py-12 text-white" style={{ background: brand.theme.background }}>
      <div className="mx-auto max-w-5xl">
        <BackBar crumbs={[{ label: "Marketplace", href: "/marketplace" }, { label: vendorName, href: `/marketplace/${p.vendor_id}` }]} fallback={`/marketplace/${p.vendor_id}`} />
        {!live && (
          <p className="mt-4 rounded-xl border border-[#FFC93C]/30 bg-[#FFC93C]/[0.08] px-4 py-2 text-sm text-[#FFC93C]">
            Preview — this item isn&apos;t public yet. Only you and NorthEDM can see this page.
          </p>
        )}
        <div className="mt-6 grid gap-8 md:grid-cols-2">
          <ProductGallery images={images} alt={title} />
          <div>
            {p.category && <p className="font-dm-mono text-xs uppercase tracking-[0.25em]" style={{ color: accent }}>{p.category as string}</p>}
            <h1 className={`mt-2 break-words leading-none tracking-wide ${display ? "text-4xl" : "font-bebas text-5xl"}`} style={display}>{title}</h1>
            {sized && (
              <div className="mt-4 grid max-w-md gap-2" style={{ gridTemplateColumns: `repeat(${sizes.length === 4 ? 2 : Math.min(sizes.length, 4)}, minmax(0, 1fr))` }} role="radiogroup" aria-label="Size">
                {sizes.map((o) => {
                  const on = o.id === p.id;
                  const onSale = o.status === "published" && !!o.is_public;
                  const out = !onSale || !hasStock(o);
                  // An off-sale size has no page a visitor can open: shown, not linked.
                  if (!onSale && !on) {
                    return (
                      <div key={o.id} role="radio" aria-checked={false} aria-disabled
                        className="rounded-xl border border-[#FF3B3B]/40 bg-[#E11D2E]/10 px-2 py-2 text-center leading-tight">
                        <span className="block text-sm font-semibold text-neutral-400 line-through">{o.variant_label ?? o.name}</span>
                        <span className="block font-dm-mono text-xs font-semibold text-[#FF6B6B]">Out of stock</span>
                      </div>
                    );
                  }
                  return (
                    <Link key={o.id} href={`/marketplace/${p.vendor_id}/item/${o.id}`} replace scroll={false} role="radio" aria-checked={on}
                      className={`rounded-xl border px-2 py-2 text-center leading-tight transition ${on ? "" : out ? "border-[#FF3B3B]/40" : "border-white/15 hover:bg-white/5"}`}
                      style={on ? { borderColor: accent, background: `${accent}26` } : undefined}>
                      <span className={`block text-sm font-semibold ${out ? "text-neutral-400 line-through" : "text-white"}`}>{o.variant_label ?? o.name}</span>
                      <span className={`block font-dm-mono text-xs ${out ? "font-semibold text-[#FF6B6B]" : "text-neutral-300"}`}>{out ? "Out of stock" : formatMoney(Math.round(Number(o.price ?? 0) * 100), vendorCurrency)}</span>
                    </Link>
                  );
                })}
              </div>
            )}
            <Price cents={Math.round(Number(p.price ?? 0) * 100)} currency={vendorCurrency} className={`mt-4 block text-4xl ${display ? "" : "font-bebas"}`} style={{ color: accent, ...display }} />
            <p className="mt-1 font-dm-mono text-xs text-neutral-500">
              {stockLabel(p as { inventory_count: number | null })}
            </p>
            {p.description && <p className="mt-6 whitespace-pre-line leading-7 text-neutral-300">{p.description as string}</p>}
            <SpecsTable className="mt-6" product={p as unknown as Parameters<typeof SpecsTable>[0]["product"]} />
            {/* Shops that post parcels from the US (not the Gambian hand-over shops) show a shipping estimate. */}
            {vendorCurrency === "USD" && <ShipEstimate productId={p.id as number} accent={accent} />}
            <div className="mt-6 flex flex-wrap gap-2">{brand.hasFont && <ShopFontToggle enabled={viewerFonts} />}<CurrencyPill options={VIEW_CURRENCIES} /></div>
            <br />
            <Link href={`/marketplace/${p.vendor_id}`}
              className="mt-8 inline-block rounded-xl border border-white/15 px-5 py-2.5 text-sm text-neutral-200 transition hover:bg-white/5">
              More from {vendorName} →
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
