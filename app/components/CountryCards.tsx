import Link from "next/link";
import { countryName, flagEmoji } from "@/utils/currencies";

/**
 * "Check all shops from <country>" cards on /marketplace — one per country
 * that has at least one public shop outside the US. New countries appear on
 * their own as soon as a shop from there is approved (vendors.country).
 */
export function CountryCards({ countries }: { countries: { code: string; shops: number }[] }) {
  if (!countries.length) return null;
  return (
    <section className="mx-auto max-w-6xl px-6 pt-16">
      <p className="text-sm uppercase tracking-[0.3em] text-orange-300">Shops around the world</p>
      <h2 className="mt-3 text-3xl font-semibold">Welcome — shop by country</h2>
      <p className="mt-2 max-w-2xl text-neutral-400">NorthEDM is a home for makers and sellers wherever they are. Visit every shop from a country in one place and see who&apos;s selling what.</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {countries.map((c) => (
          <Link key={c.code} href={`/marketplace/country/${c.code.toLowerCase()}`}
            className="group flex items-center gap-4 rounded-3xl border border-orange-400/25 bg-gradient-to-br from-orange-500/10 to-transparent p-5 transition hover:border-orange-400/60 hover:from-orange-500/20">
            <span className="text-5xl leading-none" aria-hidden>{flagEmoji(c.code)}</span>
            <span className="min-w-0">
              <span className="block text-lg font-semibold text-white group-hover:text-orange-200">Check all shops from {countryName(c.code)}</span>
              <span className="mt-0.5 block font-dm-mono text-xs uppercase tracking-widest text-neutral-500">{c.shops} shop{c.shops === 1 ? "" : "s"} · see who&apos;s selling what →</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
