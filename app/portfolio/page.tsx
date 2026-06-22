import Link from "next/link";

export const metadata = {
  title: "Portfolio",
  description: "Sites, programs, and partnerships built and grown by NorthEDM.",
};

// Sites & programs NorthEDM has built / operates.
const PROJECTS: {
  name: string; tag: string; blurb: string; href: string; external?: boolean; accent: string;
}[] = [
  {
    name: "CarlyIsFunny",
    tag: "Site · Comedy",
    blurb: "Full website + booking for stand-up comedian Carly Dreizen — designed and built by NorthEDM.",
    href: "https://carlyisfunny.com",
    external: true,
    accent: "#FF5C3A",
  },
  {
    name: "FestDash",
    tag: "Program · Festival delivery",
    blurb: "Order from festival vendors, prepay into escrow, and get it delivered to your campsite by a registered runner.",
    href: "/festdash",
    accent: "#FFB347",
  },
  {
    name: "NorthEDM Marketplace",
    tag: "Platform · Vendor network",
    blurb: "A regional marketplace and community hub connecting creators, suppliers, and vendors across the Northeast.",
    href: "/marketplace",
    accent: "#39FF14",
  },
];

// Companies, communities & people NorthEDM is building relationships with.
// Small listings — kept intentionally complete.
const PARTNERS: { name: string; note: string }[] = [
  { name: "CarlyIsFunny", note: "Comedy · client site" },
  { name: "Homestead Life", note: "Holistic goods · founder vendor" },
  { name: "CJ's Foraging Tours", note: "Guided foraging" },
  { name: "Kepner, Kepner & Corba, P.C.", note: "Legal · sponsor · Berwick & Stroudsburg, PA" },
  { name: "Frank's General Store", note: "Retail partner" },
];

export default function PortfolioPage() {
  return (
    <main className="min-h-screen px-6 py-16 text-neutral-100">
      <div className="mx-auto max-w-5xl">
        <p className="font-dm-mono text-xs uppercase tracking-[0.3em] text-[#00D4FF]">NorthEDM</p>
        <h1 className="mt-3 font-bebas text-5xl tracking-wide">Portfolio</h1>
        <p className="mt-4 max-w-2xl text-neutral-400">
          Sites and programs built by NorthEDM, plus the companies and communities
          we&apos;re building relationships with across the Northeast.
        </p>

        {/* Sites & Programs */}
        <h2 className="mt-12 mb-5 font-dm-mono text-xs uppercase tracking-widest text-neutral-500">
          Sites &amp; Programs
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PROJECTS.map((p) => {
            const inner = (
              <>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="font-dm-mono text-[10px] uppercase tracking-[0.25em]" style={{ color: p.accent }}>
                    {p.tag}
                  </p>
                  {p.external && <span className="font-dm-mono text-[10px] text-neutral-600">↗</span>}
                </div>
                <h3 className="font-bebas text-xl leading-snug tracking-wide">{p.name}</h3>
                <p className="mt-2 text-sm leading-6 text-neutral-400">{p.blurb}</p>
              </>
            );
            const cls =
              "group flex flex-col rounded-3xl border border-white/10 bg-white/[0.02] p-6 transition hover:border-white/20 hover:bg-white/[0.04]";
            return p.external ? (
              <a key={p.name} href={p.href} target="_blank" rel="noopener noreferrer" className={cls}>{inner}</a>
            ) : (
              <Link key={p.name} href={p.href} className={cls}>{inner}</Link>
            );
          })}
        </div>

        {/* Partners & Contributors */}
        <h2 className="mt-12 mb-5 font-dm-mono text-xs uppercase tracking-widest text-neutral-500">
          Partners &amp; Contributors
        </h2>
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] divide-y divide-white/5">
          {PARTNERS.map((c) => (
            <div key={c.name} className="flex items-center justify-between gap-4 px-5 py-3">
              <span className="text-sm text-neutral-200">{c.name}</span>
              <span className="shrink-0 font-dm-mono text-[11px] uppercase tracking-wide text-neutral-500">{c.note}</span>
            </div>
          ))}
        </div>

        <p className="mt-6 font-dm-mono text-[11px] text-neutral-600">
          Building relationships across the Northeast — more partners and projects added as they grow.
        </p>
      </div>
    </main>
  );
}
