import Link from "next/link";
import { createClient } from "@/utils/supabase/server";

export const metadata = {
  title: "Shop",
  description: "Official NorthEDM gear and goods.",
};

type P = {
  id: string; slug: string; name: string; price_cents: number;
  image_urls: string[]; category: string | null; inventory_count: number;
};

export default async function ShopPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("shop_products")
    .select("id, slug, name, price_cents, image_urls, category, inventory_count")
    .eq("active", true)
    .order("created_at", { ascending: false });
  const products = (data ?? []) as P[];

  return (
    <main className="min-h-screen px-6 py-16 text-neutral-100">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <p className="font-dm-mono text-xs uppercase tracking-[0.3em] text-[#39FF14]">NorthEDM</p>
            <h1 className="mt-1 font-bebas text-5xl tracking-wide">Shop</h1>
          </div>
          <Link href="/shop/cart" className="shrink-0 rounded-xl border border-white/10 px-4 py-2 font-dm-mono text-xs uppercase tracking-widest text-neutral-300 transition hover:bg-white/5">
            Cart →
          </Link>
        </div>

        {products.length === 0 ? (
          <p className="text-neutral-500">No products yet — check back soon.</p>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((p) => {
              const out = p.inventory_count <= 0;
              return (
                <Link key={p.id} href={`/shop/${p.slug}`}
                  className="group flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] transition hover:border-white/20 hover:bg-white/[0.04]">
                  <div className="aspect-square w-full overflow-hidden bg-neutral-900">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.image_urls?.[0] || "/northedm-logo.svg"} alt={p.name}
                      className={`h-full w-full object-cover transition group-hover:scale-[1.03] ${out ? "opacity-50" : ""}`} />
                  </div>
                  <div className="flex flex-1 flex-col p-4">
                    {p.category && <p className="font-dm-mono text-[10px] uppercase tracking-widest text-neutral-600">{p.category}</p>}
                    <h3 className="mt-0.5 font-semibold text-white">{p.name}</h3>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="font-bebas text-2xl text-[#39FF14]">${(p.price_cents / 100).toFixed(2)}</span>
                      {out && <span className="font-dm-mono text-[10px] uppercase tracking-wide text-[#FF5C3A]">Sold out</span>}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
