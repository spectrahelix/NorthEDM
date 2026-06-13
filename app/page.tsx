import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "NorthEDM — Unite the Northeast",
  description:
    "Appalachian festival culture, Northeast EDM community, mushroom foraging tours, vendor marketplace, and Wook World. Your regional home base.",
  openGraph: {
    title: "NorthEDM — Unite the Northeast",
    description:
      "Appalachian festival culture, Northeast EDM community, mushroom foraging tours, vendor marketplace, and Wook World.",
    url: "https://northedm.com",
  },
};

type Vendor = {
  id: number;
  name: string | null;
  category: string | null;
  description: string | null;
  vendor_type: string | null;
  is_founder: boolean | null;
};

const FEATURES = [
  {
    icon: "🎶",
    title: "Music + Events",
    body: "A regional hub for festival culture, local artists, promotion, and community energy across the Northeast.",
    href: "/feed",
    cta: "See the Feed",
  },
  {
    icon: "🍄",
    title: "Marketplace + Vendors",
    body: "A vendor platform for mushrooms, art, holistic goods, services, and festival culture across the region.",
    href: "/marketplace",
    cta: "Browse Marketplace",
  },
  {
    icon: "🌿",
    title: "Foraging + Culture",
    body: "Guided mushroom foraging tours, culinary fungi, educational experiences, and Appalachian woodland knowledge.",
    href: "/foraging",
    cta: "Book a Tour",
  },
];

export default async function HomePage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("vendors")
    .select("id, name, category, description, vendor_type, is_founder")
    .eq("status", "approved")
    .eq("is_public", true)
    .order("created_at", { ascending: false });

  const vendors = ((data ?? []) as Vendor[]).slice(0, 2);

  return (
    <main className="min-h-screen text-neutral-100">

      {/* ── Hero ──────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        {/* Brand color radial glows */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at 60% 0%, rgba(57,255,20,0.06) 0%, transparent 60%), radial-gradient(ellipse at 10% 80%, rgba(0,212,255,0.04) 0%, transparent 50%)",
          }}
        />
        <div className="relative mx-auto max-w-6xl px-6 py-14 sm:py-20">
          <p className="mb-3 font-dm-mono text-xs uppercase tracking-[0.3em] text-[#39FF14]">
            NorthEDM
          </p>
          <h1 className="font-bebas text-[clamp(3rem,12vw,6rem)] leading-none tracking-wide">
            Unite the<br className="sm:hidden" /> Northeast
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-neutral-300 sm:text-lg">
            Appalachian-rooted festival culture, vendor community, mushroom
            foraging, holistic goods, and the future home of Wook World.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:gap-4">
            <Link
              href="/forum"
              className="flex items-center justify-center rounded-2xl bg-[#39FF14] px-6 py-4 text-base font-semibold text-black transition hover:opacity-90 active:scale-[0.98]"
            >
              Join the Community
            </Link>
            <Link
              href="/foraging"
              className="flex items-center justify-center rounded-2xl border border-white/15 px-6 py-4 text-base font-medium text-white transition hover:bg-white/5 active:scale-[0.98]"
            >
              Book a Foraging Tour
            </Link>
          </div>

          {/* Stat pills */}
          <div className="mt-10 flex flex-wrap gap-3">
            {[
              { label: "Festival Community", accent: "#39FF14" },
              { label: "Vendor Network",     accent: "#00D4FF" },
              { label: "Foraging Guides",    accent: "#CC00FF" },
            ].map((s) => (
              <span
                key={s.label}
                className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-1.5 font-dm-mono text-xs uppercase tracking-widest"
                style={{ color: s.accent }}
              >
                {s.label}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Feature cards ─────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 py-14">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <Link
              key={f.href}
              href={f.href}
              className="group flex flex-col rounded-3xl border border-white/[0.08] bg-white/[0.02] p-6 backdrop-blur-sm transition hover:border-white/20 hover:bg-white/[0.05] active:scale-[0.99]"
            >
              <span className="mb-3 text-3xl">{f.icon}</span>
              <h2 className="font-bebas text-2xl tracking-wide">{f.title}</h2>
              <p className="mt-2 flex-1 text-sm leading-6 text-neutral-400">{f.body}</p>
              <p className="mt-5 font-dm-mono text-xs uppercase tracking-widest text-[#3AFFD4] transition group-hover:text-white">
                {f.cta} →
              </p>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Community / Forum CTA ─────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 pb-14">
        <div className="relative overflow-hidden rounded-[2rem] border border-[#3AFFD4]/20 bg-[#3AFFD4]/[0.04] p-8 sm:p-10">
          <div
            className="pointer-events-none absolute right-0 top-0 h-64 w-64 opacity-20"
            style={{
              background: "radial-gradient(circle, #3AFFD4 0%, transparent 70%)",
            }}
          />
          <p className="font-dm-mono text-xs uppercase tracking-[0.3em] text-[#3AFFD4]">
            CrowdWave Community
          </p>
          <h2 className="mt-3 font-bebas text-3xl tracking-wide sm:text-4xl">
            Connect with your people
          </h2>
          <p className="mt-3 max-w-lg text-sm leading-6 text-neutral-300 sm:text-base">
            The NorthEDM forum is where the community lives — lineups, carpool
            rides, foraging reports, vendor talk, and everything in between.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/forum"
              className="flex items-center justify-center rounded-2xl bg-[#3AFFD4] px-6 py-3.5 text-sm font-semibold text-black transition hover:opacity-90 active:scale-[0.98]"
            >
              Browse the Forum
            </Link>
            <Link
              href="/crowdwave"
              className="flex items-center justify-center rounded-2xl border border-white/15 px-6 py-3.5 text-sm font-medium text-white transition hover:bg-white/5 active:scale-[0.98]"
            >
              CrowdWave Hub
            </Link>
          </div>
        </div>
      </section>

      {/* ── Featured Vendors ──────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 pb-14">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <p className="font-dm-mono text-xs uppercase tracking-[0.3em] text-[#39FF14]">
              Featured Vendors
            </p>
            <h2 className="mt-1 font-bebas text-3xl tracking-wide">
              The NorthEDM ecosystem
            </h2>
          </div>
          <Link
            href="/marketplace"
            className="shrink-0 font-dm-mono text-xs uppercase tracking-widest text-neutral-500 transition hover:text-neutral-300"
          >
            View all →
          </Link>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* Homestead Life — permanent founder vendor */}
          <a
            href="https://homestead-life.com"
            target="_blank"
            rel="noopener noreferrer"
            className="group flex flex-col rounded-3xl border border-[#3AFFD4]/30 bg-[#3AFFD4]/[0.04] p-6 transition hover:border-[#3AFFD4]/60 hover:bg-[#3AFFD4]/[0.07] active:scale-[0.99]"
          >
            <div className="mb-3 flex items-start justify-between gap-2">
              <h3 className="font-bebas text-xl leading-snug tracking-wide">
                Homestead Life
              </h3>
              <span className="shrink-0 rounded-full bg-[#CC00FF]/15 px-2.5 py-0.5 font-dm-mono text-[10px] uppercase tracking-wide text-[#CC00FF]">
                Founder
              </span>
            </div>
            <p className="font-dm-mono text-xs uppercase tracking-widest text-neutral-600">
              Holistic Goods
            </p>
            <p className="mt-3 flex-1 text-sm leading-6 text-neutral-400">
              All-natural handmade products from a family farm in Millville, PA.
              Healing balms, essential oils, and nature-rooted wellness goods
              crafted with therapeutic-grade ingredients.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <span className="rounded-full bg-[#3AFFD4]/10 px-3 py-1 font-dm-mono text-xs text-[#3AFFD4]">
                featured
              </span>
              <span className="rounded-full bg-[#CC00FF]/10 px-3 py-1 font-dm-mono text-xs text-[#CC00FF]">
                Founder
              </span>
            </div>
          </a>

          {vendors.map((vendor) => (
            <Link
              key={vendor.id}
              href={`/marketplace/${vendor.id}`}
              className="group flex flex-col rounded-3xl border border-white/[0.08] bg-white/[0.02] p-6 backdrop-blur-sm transition hover:border-white/20 hover:bg-white/[0.05] active:scale-[0.99]"
            >
              <div className="mb-3 flex items-start justify-between gap-2">
                <h3 className="font-bebas text-xl leading-snug tracking-wide">
                  {vendor.name || "Unnamed Vendor"}
                </h3>
                {vendor.vendor_type === "featured" && (
                  <span className="shrink-0 rounded-full bg-purple-500/20 px-2.5 py-0.5 font-dm-mono text-[10px] uppercase tracking-wide text-purple-300">
                    Featured
                  </span>
                )}
              </div>
              <p className="font-dm-mono text-xs uppercase tracking-widest text-neutral-600">
                {vendor.category || "uncategorized"}
              </p>
              <p className="mt-3 flex-1 text-sm leading-6 text-neutral-400">
                {vendor.description || "No description available."}
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <span className="rounded-full bg-white/10 px-3 py-1 font-dm-mono text-xs text-neutral-400">
                  {vendor.vendor_type || "listed"}
                </span>
                {vendor.is_founder && (
                  <span className="rounded-full bg-[#CC00FF]/10 px-3 py-1 font-dm-mono text-xs text-[#CC00FF]">
                    Founder
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Wook World ────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 pb-16">
        <div className="relative overflow-hidden rounded-[2rem] border border-purple-400/20 bg-purple-400/[0.04] p-8 sm:p-10">
          <div
            className="pointer-events-none absolute left-1/2 top-0 h-48 w-96 -translate-x-1/2 opacity-15"
            style={{
              background: "radial-gradient(ellipse, #a855f7 0%, transparent 70%)",
            }}
          />
          <p className="font-dm-mono text-xs uppercase tracking-[0.3em] text-purple-400">
            Wook World
          </p>
          <h2 className="mt-3 font-bebas text-3xl tracking-wide sm:text-4xl">
            A digital festival universe is coming.
          </h2>
          <p className="mt-3 max-w-lg text-sm leading-6 text-neutral-300 sm:text-base">
            Collectibles, quests, rewards, and identity built around the
            culture you already live.
          </p>
          <div className="mt-6">
            <Link
              href="/wook-world"
              className="inline-flex items-center justify-center rounded-2xl bg-purple-400 px-6 py-3.5 text-sm font-semibold text-black transition hover:opacity-90 active:scale-[0.98]"
            >
              Enter Wook World
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────── */}
      <footer className="border-t border-white/10">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="font-bebas text-lg tracking-wide">NorthEDM</p>
              <p className="mt-1 font-dm-mono text-[10px] uppercase tracking-[0.3em] text-neutral-600">
                Unite the Northeast
              </p>
            </div>
            <div>
              <p className="mb-3 font-dm-mono text-[10px] uppercase tracking-widest text-neutral-600">
                Community
              </p>
              <ul className="space-y-2 text-sm text-neutral-400">
                <li><Link href="/forum" className="hover:text-white">Forum</Link></li>
                <li><Link href="/crowdwave" className="hover:text-white">CrowdWave</Link></li>
                <li><Link href="/feed" className="hover:text-white">Feed</Link></li>
              </ul>
            </div>
            <div>
              <p className="mb-3 font-dm-mono text-[10px] uppercase tracking-widest text-neutral-600">
                Platform
              </p>
              <ul className="space-y-2 text-sm text-neutral-400">
                <li><Link href="/marketplace" className="hover:text-white">Marketplace</Link></li>
                <li><Link href="/vendors" className="hover:text-white">Vendors</Link></li>
                <li><Link href="/foraging" className="hover:text-white">Foraging</Link></li>
              </ul>
            </div>
            <div>
              <p className="mb-3 font-dm-mono text-[10px] uppercase tracking-widest text-neutral-600">
                Account
              </p>
              <ul className="space-y-2 text-sm text-neutral-400">
                <li><Link href="/signup" className="hover:text-white">Create Account</Link></li>
                <li><Link href="/login" className="hover:text-white">Log In</Link></li>
                <li><Link href="/wook-world" className="hover:text-white">Wook World</Link></li>
              </ul>
            </div>
          </div>
          <p className="mt-10 font-dm-mono text-[10px] text-neutral-700">
            © {new Date().getFullYear()} NorthEDM. All rights reserved.
          </p>
        </div>
      </footer>
    </main>
  );
}
