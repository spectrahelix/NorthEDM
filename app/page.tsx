import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Vendor = {
  id: number;
  name: string | null;
  category: string | null;
  description: string | null;
  vendor_type: string | null;
  is_founder: boolean | null;
};

export default async function HomePage() {
  const { data } = await supabase
    .from("vendors")
    .select("id, name, category, description, vendor_type, is_founder")
    .eq("status", "approved")
    .eq("is_public", true)
    .order("created_at", { ascending: false });

  const vendors = ((data ?? []) as Vendor[]).slice(0, 3);

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      <section className="border-b border-white/10">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <p className="mb-4 text-sm uppercase tracking-[0.3em] text-green-300">
            NorthEDM
          </p>

          <h1 className="max-w-4xl text-5xl font-semibold leading-tight md:text-7xl">
            Unite the Northeast
          </h1>

          <p className="mt-6 max-w-2xl text-lg leading-8 text-neutral-300">
            Appalachian-rooted festival culture, vendor community, music
            promotion, mushroom foraging, holistic goods, and the future home of
            Wook World.
          </p>

          <div className="mt-8 flex flex-wrap gap-4">
            <Link
              href="/foraging"
              className="rounded-2xl bg-green-400 px-6 py-3 font-medium text-black transition hover:scale-[1.02]"
            >
              Book a Foraging Tour
            </Link>

            <Link
              href="/marketplace"
              className="rounded-2xl border border-white/15 px-6 py-3 font-medium text-white transition hover:bg-white/5"
            >
              Explore Marketplace
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-6 md:grid-cols-3">
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
            <h2 className="text-2xl font-semibold">Music + Events</h2>
            <p className="mt-3 text-neutral-300">
              A regional hub for festival culture, local artists, promotion,
              and community energy across the Northeast.
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
            <h2 className="text-2xl font-semibold">Marketplace + Vendors</h2>
            <p className="mt-3 text-neutral-300">
              A vendor platform for mushrooms, art, holistic goods, services,
              and festival culture across the region.
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
            <h2 className="text-2xl font-semibold">Foraging + Culture</h2>
            <p className="mt-3 text-neutral-300">
              Guided mushroom foraging tours, culinary fungi, educational
              experiences, and Appalachian woodland knowledge.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-16">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-green-300">
              Featured Vendors
            </p>
            <h2 className="mt-2 text-3xl font-semibold">
              Public vendors in the NorthEDM ecosystem
            </h2>
          </div>

          <Link href="/marketplace" className="text-sm text-neutral-300 hover:text-white">
            View all
          </Link>
        </div>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {vendors.length > 0 ? (
            vendors.map((vendor) => (
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
            ))
          ) : (
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 text-neutral-400">
              No featured vendors yet.
            </div>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-16">
        <div className="rounded-[2rem] border border-purple-400/20 bg-purple-400/5 p-8">
          <p className="text-sm uppercase tracking-[0.3em] text-purple-300">
            Wook World
          </p>
          <h2 className="mt-3 text-3xl font-semibold">
            A digital festival universe is coming.
          </h2>
          <p className="mt-4 max-w-2xl text-neutral-300">
            Wook World will extend NorthEDM into a collectible-driven experience
            built around quests, identity, rewards, and festival culture.
          </p>

          <div className="mt-6">
            <Link
              href="/wook-world"
              className="rounded-2xl bg-purple-400 px-6 py-3 font-medium text-black transition hover:opacity-90"
            >
              Enter Wook World
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}