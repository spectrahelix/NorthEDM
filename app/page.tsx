import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { SocialAuth } from "@/app/components/SocialAuth";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "NorthEDM — Unite the Northeast",
  description:
    "Appalachian festival culture, Northeast EDM community, mushroom foraging tours, and a vendor marketplace. Your regional home base.",
  openGraph: {
    title: "NorthEDM — Unite the Northeast",
    description:
      "Appalachian festival culture, Northeast EDM community, mushroom foraging tours, and vendor marketplace.",
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
  const [
    { data: { user } },
    { data },
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("vendors")
      .select("id, name, category, description, vendor_type, is_founder")
      .eq("status", "approved")
      .eq("is_public", true)
      .order("created_at", { ascending: false }),
  ]);

  const vendors = ((data ?? []) as Vendor[])
    .filter((v) => v.name !== "Homestead Life")
    .slice(0, 1);

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
            foraging, holistic goods, and a growing regional ecosystem.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:gap-4">
            <Link
              href={user ? "/forum" : "/signup"}
              className="flex items-center justify-center rounded-2xl bg-[#39FF14] px-6 py-4 text-base font-semibold text-black transition hover:opacity-90 active:scale-[0.98]"
            >
              {user ? "Go to Forum" : "Join the Community"}
            </Link>
            <Link
              href="/foraging"
              className="flex items-center justify-center rounded-2xl border border-white/15 px-6 py-4 text-base font-medium text-white transition hover:bg-white/5 active:scale-[0.98]"
            >
              Book a Foraging Tour
            </Link>
          </div>

          {/* Stat pills */}
          <div className="mt-10 flex flex-wrap gap-2">
            {[
              { label: "Festival Community", accent: "#39FF14" },
              { label: "Vendor Network",     accent: "#00D4FF" },
              { label: "Foraging Guides",    accent: "#CC00FF" },
              { label: "Website Creation",   accent: "#3AFFD4" },
              { label: "Security Auditing",  accent: "#FF5C3A" },
              { label: "FestDash Platform",  accent: "#FB923C" },
            ].map((s) => (
              <span
                key={s.label}
                className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-1.5 font-dm-mono text-xs uppercase tracking-widest"
                style={{ color: s.accent, borderColor: s.accent + "33" }}
              >
                {s.label}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Guest sign-in panel (hidden for logged-in users) ─── */}
      {!user && (
        <section className="mx-auto max-w-6xl px-6 pb-6">
          <div className="relative overflow-hidden rounded-[2rem] border border-[#39FF14]/20 bg-[#39FF14]/[0.03] p-8 sm:p-10">
            {/* Glow */}
            <div
              className="pointer-events-none absolute -top-16 left-1/2 h-48 w-96 -translate-x-1/2 opacity-20"
              style={{ background: "radial-gradient(ellipse, #39FF14 0%, transparent 70%)" }}
            />
            <div className="relative lg:flex lg:items-center lg:gap-12">
              {/* Left copy */}
              <div className="mb-8 lg:mb-0 lg:flex-1">
                <p className="font-dm-mono text-xs uppercase tracking-[0.3em] text-[#39FF14]">
                  Join NorthEDM
                </p>
                <h2 className="mt-3 font-bebas text-3xl tracking-wide sm:text-4xl">
                  Your festival community starts here
                </h2>
                <p className="mt-3 max-w-md text-sm leading-6 text-neutral-400">
                  Post to the forum, follow festivals, connect with vendors,
                  book foraging tours, and connect with the full NorthEDM
                  ecosystem. One account for everything.
                </p>
                <ul className="mt-5 space-y-2">
                  {[
                    "Forum, replies & community groups",
                    "Vendor marketplace & direct messaging",
                    "Festival tracker & carpool boards",
                  ].map((benefit) => (
                    <li key={benefit} className="flex items-center gap-2 text-sm text-neutral-300">
                      <span className="text-[#39FF14]">✦</span>
                      {benefit}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Right: auth buttons */}
              <div className="w-full lg:w-80 lg:shrink-0">
                <SocialAuth next="/feed" />
                <div className="my-4 flex items-center gap-3">
                  <div className="h-px flex-1 bg-white/10" />
                  <span className="font-dm-mono text-[10px] uppercase tracking-widest text-neutral-600">or</span>
                  <div className="h-px flex-1 bg-white/10" />
                </div>
                <Link
                  href="/signup"
                  className="flex w-full items-center justify-center rounded-xl border border-white/15 py-3 text-sm font-medium text-neutral-300 transition hover:bg-white/5 hover:text-white"
                >
                  Sign up with email
                </Link>
                <p className="mt-4 text-center font-dm-mono text-xs text-neutral-600">
                  Already a member?{" "}
                  <Link href="/login" className="text-[#3AFFD4] transition hover:opacity-80">
                    Log in
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </section>
      )}

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

      {/* ── Featured Partner: Kepner, Kepner & Corba ─────────── */}
      <section className="mx-auto max-w-6xl px-6 pb-14">
        <div className="relative overflow-hidden rounded-[2rem] border border-[#E8FF47]/20 bg-[#E8FF47]/[0.03] p-8 sm:p-10">
          <div
            className="pointer-events-none absolute right-0 top-0 h-72 w-72 opacity-10"
            style={{ background: "radial-gradient(circle, #E8FF47 0%, transparent 70%)" }}
          />

          {/* Header row */}
          <div className="relative flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="font-dm-mono text-xs uppercase tracking-[0.3em] text-[#E8FF47]">
                Featured Partner · Est. 1950
              </p>
              <h2 className="mt-2 font-bebas text-3xl tracking-wide sm:text-4xl">
                Kepner, Kepner &amp; Corba, P.C.
              </h2>
              <p className="mt-1 font-dm-mono text-xs uppercase tracking-widest text-neutral-500">
                Aggressive. Dedicated. Experienced.
              </p>
            </div>
            <a
              href="https://www.kkclaw.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 rounded-2xl bg-[#E8FF47] px-5 py-3 text-sm font-semibold text-black transition hover:opacity-90 active:scale-[0.98]"
            >
              Visit kkclaw.com →
            </a>
          </div>

          {/* Details row */}
          <div className="relative mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {/* Contact */}
            <div>
              <p className="mb-2 font-dm-mono text-[10px] uppercase tracking-widest text-neutral-600">
                Contact
              </p>
              <ul className="space-y-2 text-sm text-neutral-300">
                <li>
                  <a
                    href="https://maps.google.com/?q=123+West+Front+Street+Berwick+PA+18603"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-start gap-2 transition hover:text-[#E8FF47]"
                  >
                    <span className="mt-0.5 shrink-0">📍</span>
                    <span>123 West Front St<br />Berwick, PA 18603</span>
                  </a>
                </li>
                <li>
                  <a
                    href="tel:+15702317418"
                    className="flex items-center gap-2 transition hover:text-[#E8FF47]"
                  >
                    <span>📞</span>
                    <span>(570) 231-7418</span>
                  </a>
                </li>
                <li>
                  <a
                    href="https://www.kkclaw.com/contact-us/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 transition hover:text-[#E8FF47]"
                  >
                    <span>✉️</span>
                    <span>Send a Message</span>
                  </a>
                </li>
              </ul>
            </div>

            {/* Attorneys */}
            <div>
              <p className="mb-2 font-dm-mono text-[10px] uppercase tracking-widest text-neutral-600">
                Attorneys · 78 Yrs Combined
              </p>
              <ul className="space-y-2 text-sm text-neutral-300">
                {[
                  "Franklin E. Kepner, Jr.",
                  "Alice T. K. Corba",
                  "Franklin E. Kepner, III",
                ].map((name) => (
                  <li key={name} className="flex items-center gap-2">
                    <span className="text-[#E8FF47]/50">⚖️</span>
                    <a
                      href="https://www.kkclaw.com/attorneys/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="transition hover:text-[#E8FF47]"
                    >
                      {name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Practice Areas */}
            <div>
              <p className="mb-2 font-dm-mono text-[10px] uppercase tracking-widest text-neutral-600">
                Practice Areas
              </p>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { label: "Personal Injury",  href: "https://www.kkclaw.com/practice-areas/" },
                  { label: "Employment Law",   href: "https://www.kkclaw.com/practice-areas/employment-law/" },
                  { label: "Family Law",       href: "https://www.kkclaw.com/practice-areas/" },
                  { label: "Criminal Defense", href: "https://www.kkclaw.com/practice-areas/" },
                  { label: "Real Estate",      href: "https://www.kkclaw.com/practice-areas/" },
                  { label: "Civil Litigation", href: "https://www.kkclaw.com/practice-areas/" },
                  { label: "Probate & Estate", href: "https://www.kkclaw.com/practice-areas/" },
                ].map((area) => (
                  <a
                    key={area.label}
                    href={area.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-full border border-[#E8FF47]/15 bg-[#E8FF47]/5 px-3 py-1 font-dm-mono text-[11px] text-[#E8FF47]/70 transition hover:border-[#E8FF47]/40 hover:bg-[#E8FF47]/10 hover:text-[#E8FF47]"
                  >
                    {area.label}
                  </a>
                ))}
              </div>
            </div>
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

          {/* CJ's Foraging Tours — permanent founder vendor */}
          <Link
            href="/foraging"
            className="group flex flex-col rounded-3xl border border-[#FFB347]/30 bg-[#FFB347]/[0.04] p-6 transition hover:border-[#FFB347]/60 hover:bg-[#FFB347]/[0.07] active:scale-[0.99]"
          >
            <div className="mb-3 flex items-start justify-between gap-2">
              <h3 className="font-bebas text-xl leading-snug tracking-wide">
                CJ&apos;s Foraging Tours
              </h3>
              <span className="shrink-0 rounded-full bg-[#CC00FF]/15 px-2.5 py-0.5 font-dm-mono text-[10px] uppercase tracking-wide text-[#CC00FF]">
                Founder
              </span>
            </div>
            <p className="font-dm-mono text-xs uppercase tracking-widest text-neutral-600">
              Foraging &amp; Guided Tours
            </p>
            <p className="mt-3 flex-1 text-sm leading-6 text-neutral-400">
              Guided mushroom foraging experiences deep in the Appalachian
              woodlands. Learn to identify wild edibles, chanterelles, hen of
              the woods, and more with an experienced local guide.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <span className="rounded-full bg-[#FFB347]/10 px-3 py-1 font-dm-mono text-xs text-[#FFB347]">
                book a tour
              </span>
              <span className="rounded-full bg-[#CC00FF]/10 px-3 py-1 font-dm-mono text-xs text-[#CC00FF]">
                Founder
              </span>
            </div>
          </Link>

          {vendors.map((vendor) => (
            <Link
              key={vendor.id}
              href={`/marketplace/${vendor.id}`}
              className="group flex flex-col rounded-3xl border border-[#39FF14]/20 bg-[#39FF14]/[0.03] p-6 transition hover:border-[#39FF14]/40 hover:bg-[#39FF14]/[0.06] active:scale-[0.99]"
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
                <span className="rounded-full bg-[#39FF14]/10 px-3 py-1 font-dm-mono text-xs text-[#39FF14]">
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
