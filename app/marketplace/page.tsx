import Link from "next/link";
import { createClient } from "@/utils/supabase/server";

type Vendor = {
  id: number;
  name: string | null;
  category: string | null;
  description: string | null;
  vendor_type: string | null;
  is_founder: boolean | null;
};

const categories = [
  {
    title: "Mushrooms",
    description:
      "Foraged, culinary, dried, powdered, and specialty mushroom offerings.",
  },
  {
    title: "Holistic Goods",
    description:
      "Nature-rooted wellness goods, body products, and handcrafted items.",
  },
  {
    title: "Art & Crafts",
    description:
      "Creative work, handmade art, trinkets, festival expression, and decor.",
  },
  {
    title: "Festival Gear",
    description:
      "Useful and expressive gear for music, travel, events, and lifestyle.",
  },
  {
    title: "Animal & Homestead",
    description:
      "Feeders, isopods, colony-related offerings, and practical small-scale goods.",
  },
  {
    title: "Workshops & Experiences",
    description:
      "Foraging tours, educational sessions, skill-sharing, and immersive experiences.",
  },
];

export default async function MarketplacePage() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("vendors")
    .select("id, name, category, description, vendor_type, is_founder")
    .eq("status", "approved")
    .eq("is_public", true)
    .order("created_at", { ascending: false });

  const vendors = (data ?? []) as Vendor[];

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      <section className="border-b border-white/10">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <p className="mb-4 text-sm uppercase tracking-[0.3em] text-green-300">
            Marketplace
          </p>

          <h1 className="max-w-4xl text-5xl font-semibold leading-tight md:text-7xl">
            A growing ecosystem of goods, culture, and local value.
          </h1>

          <p className="mt-6 max-w-3xl text-lg leading-8 text-neutral-300">
            NorthEDM Marketplace is a hub for vendors, creators, suppliers, and
            founder-led offerings across the Northeast.
          </p>

          <div className="mt-8 flex flex-wrap gap-4">
            <Link
              href="/vendors/apply"
              className="rounded-2xl bg-green-400 px-6 py-3 font-medium text-black transition hover:scale-[1.02]"
            >
              Apply as a Vendor
            </Link>

            <Link
              href="/requests"
              className="rounded-2xl border border-white/15 px-6 py-3 font-medium text-white transition hover:bg-white/5"
            >
              Submit a Request
            </Link>
          </div>
        </div>
      </section>

      {vendors.length > 0 ? (
        <section className="mx-auto max-w-6xl px-6 py-16">
          <div className="mb-8">
            <p className="text-sm uppercase tracking-[0.3em] text-green-300">
              Vendors
            </p>
            <h2 className="mt-3 text-3xl font-semibold">
              Active vendors in the NorthEDM ecosystem
            </h2>
          </div>

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {vendors.map((vendor) => (
              <Link
                key={vendor.id}
                href={`/marketplace/${vendor.id}`}
                className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 transition hover:bg-white/[0.05]"
              >
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-2xl font-semibold">
                    {vendor.name || "Unnamed Vendor"}
                  </h3>

                  {vendor.vendor_type === "featured" ? (
                    <span className="rounded-full bg-purple-500/20 px-3 py-1 text-xs text-purple-300">
                      Featured
                    </span>
                  ) : null}
                </div>

                <p className="mt-3 text-sm text-neutral-400">
                  {vendor.category || "uncategorized"}
                </p>

                <p className="mt-4 text-neutral-300">
                  {vendor.description || "No description available."}
                </p>

                <div className="mt-5 flex flex-wrap gap-2 text-sm">
                  <span className="rounded-full bg-white/10 px-3 py-1">
                    {vendor.vendor_type || "listed"}
                  </span>
                  {vendor.is_founder ? (
                    <span className="rounded-full bg-green-500/20 px-3 py-1 text-green-300">
                      Founder Vendor
                    </span>
                  ) : null}
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="mb-8">
          <p className="text-sm uppercase tracking-[0.3em] text-neutral-400">
            Categories
          </p>
          <h2 className="mt-3 text-3xl font-semibold">Marketplace lanes</h2>
          <p className="mt-3 max-w-2xl text-neutral-300">
            These categories define the structure of the platform as we expand
            vendor intake and product visibility.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {categories.map((category) => (
            <div
              key={category.title}
              className="rounded-3xl border border-white/10 bg-white/[0.03] p-6"
            >
              <h3 className="text-2xl font-semibold">{category.title}</h3>
              <p className="mt-3 leading-7 text-neutral-300">
                {category.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-16">
        <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-8">
          <p className="text-sm uppercase tracking-[0.3em] text-green-300">
            Vendor Network
          </p>
          <h2 className="mt-3 text-3xl font-semibold">
            Public vendors, private suppliers, and featured partners
          </h2>
          <p className="mt-4 max-w-3xl leading-8 text-neutral-300">
            NorthEDM supports multiple vendor paths: private supplier
            relationships, public marketplace listings, and featured vendor
            placement for standout contributors.
          </p>

          <div className="mt-8 flex flex-wrap gap-4">
            <Link
              href="/vendors/apply"
              className="rounded-2xl bg-green-400 px-6 py-3 font-medium text-black transition hover:scale-[1.02]"
            >
              Become a Vendor
            </Link>

            <Link
              href="/admin"
              className="rounded-2xl border border-white/15 px-6 py-3 font-medium text-white transition hover:bg-white/5"
            >
              Admin Hub
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
