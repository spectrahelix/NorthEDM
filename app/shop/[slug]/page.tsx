import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import AddToCart from "./AddToCart";

type P = {
  id: string; slug: string; name: string; description: string;
  price_cents: number; image_urls: string[]; category: string | null; inventory_count: number;
};

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("shop_products").select("name").eq("slug", slug).maybeSingle();
  return { title: data?.name ? `${data.name} — Shop` : "Shop" };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("shop_products").select("*").eq("slug", slug).eq("active", true).maybeSingle();
  if (!data) notFound();
  const p = data as P;
  const images = p.image_urls?.length ? p.image_urls : ["/northedm-logo.svg"];

  return (
    <main className="min-h-screen px-6 py-16 text-neutral-100">
      <div className="mx-auto max-w-5xl">
        <Link href="/shop" className="font-dm-mono text-xs text-neutral-500 hover:text-neutral-300">← Shop</Link>
        <div className="mt-6 grid gap-10 md:grid-cols-2">
          <div className="space-y-3">
            <div className="aspect-square overflow-hidden rounded-2xl border border-white/10 bg-neutral-900">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={images[0]} alt={p.name} className="h-full w-full object-cover" />
            </div>
            {images.length > 1 && (
              <div className="grid grid-cols-4 gap-2">
                {images.slice(1, 5).map((u) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={u} src={u} alt="" className="aspect-square w-full rounded-lg object-cover border border-white/10" />
                ))}
              </div>
            )}
          </div>
          <div>
            {p.category && <p className="font-dm-mono text-xs uppercase tracking-widest text-neutral-600">{p.category}</p>}
            <h1 className="mt-1 font-bebas text-4xl tracking-wide">{p.name}</h1>
            <p className="mt-3 font-bebas text-3xl text-[#39FF14]">${(p.price_cents / 100).toFixed(2)}</p>
            {p.description && <p className="mt-5 whitespace-pre-line text-sm leading-7 text-neutral-300">{p.description}</p>}
            <div className="mt-7">
              <AddToCart
                product={{ id: p.id, slug: p.slug, name: p.name, price_cents: p.price_cents, image: images[0] }}
                stock={p.inventory_count}
              />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
