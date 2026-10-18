import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/utils/supabase/server";
import { BackBar } from "@/app/components/BackBar";
import { ProductGallery } from "@/app/components/ProductGallery";
import { accentOr } from "@/utils/accent";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string; itemId: string }> };

// Read through the visitor's own session, so the products RLS decides what is
// visible: a draft, hidden or suspended vendor's item is a 404 to the public
// but still previewable by its vendor and by NorthEDM admins.
async function load(id: string, itemId: string) {
  const supabase = await createClient();
  const { data: product } = await supabase
    .from("products")
    .select("id, vendor_id, name, category, description, price, inventory_count, image_url, status, is_public")
    .eq("id", Number(itemId)).eq("vendor_id", Number(id)).maybeSingle();
  if (!product) return null;
  const [{ data: gallery }, { data: vendor }] = await Promise.all([
    supabase.from("product_images").select("url").eq("product_id", product.id).order("position").order("id"),
    supabase.from("vendors").select("id, name, accent_color").eq("id", product.vendor_id).maybeSingle(),
  ]);
  const images = (gallery ?? []).map((g) => g.url as string);
  if (images.length === 0 && product.image_url) images.push(product.image_url as string);
  return { product, images, vendor };
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id, itemId } = await params;
  const d = await load(id, itemId);
  if (!d) return { title: "Item", robots: { index: false, follow: false } };
  const live = d.product.is_public && d.product.status === "published";
  return {
    title: d.product.name as string,
    description: (d.product.description as string) || undefined,
    openGraph: d.images[0] ? { images: [d.images[0]] } : undefined,
    robots: live ? undefined : { index: false, follow: false },
  };
}

export default async function ItemPage({ params }: Params) {
  const { id, itemId } = await params;
  const d = await load(id, itemId);
  if (!d) notFound();
  const { product: p, images, vendor } = d;
  const accent = accentOr(vendor?.accent_color as string | null);
  const live = p.is_public && p.status === "published";
  const vendorName = (vendor?.name as string) || "Vendor";

  return (
    <main className="min-h-screen px-6 py-12 text-white">
      <div className="mx-auto max-w-5xl">
        <BackBar crumbs={[{ label: "Marketplace", href: "/marketplace" }, { label: vendorName, href: `/marketplace/${p.vendor_id}` }]} fallback={`/marketplace/${p.vendor_id}`} />
        {!live && (
          <p className="mt-4 rounded-xl border border-[#FFC93C]/30 bg-[#FFC93C]/[0.08] px-4 py-2 text-sm text-[#FFC93C]">
            Preview — this item isn&apos;t public yet. Only you and NorthEDM can see this page.
          </p>
        )}
        <div className="mt-6 grid gap-8 md:grid-cols-2">
          <ProductGallery images={images} alt={p.name as string} />
          <div>
            {p.category && <p className="font-dm-mono text-xs uppercase tracking-[0.25em]" style={{ color: accent }}>{p.category as string}</p>}
            <h1 className="mt-2 font-bebas text-5xl leading-none tracking-wide">{p.name as string}</h1>
            <p className="mt-4 font-bebas text-4xl" style={{ color: accent }}>${Number(p.price ?? 0).toFixed(2)}</p>
            <p className="mt-1 font-dm-mono text-xs text-neutral-500">
              {Number(p.inventory_count ?? 0) > 0 ? `${p.inventory_count} in stock` : "Out of stock"}
            </p>
            {p.description && <p className="mt-6 whitespace-pre-line leading-7 text-neutral-300">{p.description as string}</p>}
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
