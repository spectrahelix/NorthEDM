import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { serviceClient } from "@/utils/coordinator";
import { BackBar } from "@/app/components/BackBar";
import { ProductThumb } from "@/app/components/ProductThumb";
import { Price, CurrencyPill } from "@/app/components/CurrencyContext";
import { VIEW_CURRENCIES } from "@/utils/viewerCurrency";
import { countryName, flagEmoji } from "@/utils/currencies";
import { accentOr } from "@/utils/accent";
import { IntlPaymentNote } from "@/app/components/IntlPaymentNote";
import { loadLocalRules, remitFeeIn } from "@/utils/localRules";
import { formatMoney } from "@/utils/money";
import { serviceClient as rulesClient } from "@/utils/coordinator";

type Vendor = { id: number; name: string | null; category: string | null; description: string | null; accent_color: string | null; currency: string | null; country: string | null };
type Product = { id: number; vendor_id: number; name: string | null; price: number | null; image_url: string | null };

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params;
  const name = countryName(code);
  return { title: `Shops from ${name}`, description: `Every shop from ${name} on the NorthEDM marketplace — see who's selling what.` };
}

/**
 * Every public shop from one country, with a few of its items each. Reached
 * from the "Check all shops from …" cards on /marketplace. Public data only:
 * the ordinary session's RLS hides suspended and non-public vendors.
 */
export default async function CountryShopsPage({ params }: { params: Promise<{ code: string }> }) {
  const { code: raw } = await params;
  const code = raw.toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) notFound();
  const supabase = await createClient();
  const { data } = await supabase
    .from("vendors")
    .select("id, name, category, description, accent_color, currency, country")
    .eq("status", "approved").eq("is_public", true).is("suspended_at", null).eq("country", code)
    .order("name");
  const vendors = (data ?? []) as Vendor[];
  if (!vendors.length) notFound();
  const ids = vendors.map((v) => v.id);
  const [{ data: prodRows }, { data: svRows }] = await Promise.all([
    supabase.from("products").select("id, vendor_id, name, price, image_url").in("vendor_id", ids).eq("is_public", true).eq("status", "published").order("created_at", { ascending: false }).limit(200),
    serviceClient().from("store_vendors").select("vendor_id, stores(slug, active, billing_status)").in("vendor_id", ids).eq("status", "approved"),
  ]);
  const products = (prodRows ?? []) as Product[];
  type SvRow = { vendor_id: number; stores: { slug: string; active: boolean; billing_status: string } | { slug: string; active: boolean; billing_status: string }[] | null };
  const storeFor = new Map<number, string>();
  for (const r of (svRows ?? []) as SvRow[]) {
    const live = (Array.isArray(r.stores) ? r.stores : r.stores ? [r.stores] : []).find((s) => s.active && s.billing_status === "active");
    if (live && !storeFor.has(r.vendor_id)) storeFor.set(r.vendor_id, live.slug);
  }
  const name = countryName(code);
  const rules = await loadLocalRules(rulesClient());
  const shopCurrency = String(vendors.find((v) => v.currency)?.currency ?? "USD");
  const remitLabel = rules.remitFeeUsdCents > 0
    ? `${formatMoney(rules.remitFeeUsdCents, "USD")}${shopCurrency !== "USD" ? ` (≈ ${formatMoney(await remitFeeIn(shopCurrency, rules.remitFeeUsdCents), shopCurrency)})` : ""}`
    : "";
  return (
    <main className="min-h-screen px-6 py-14 text-white">
      <div className="mx-auto max-w-6xl">
        <BackBar crumbs={[{ label: "Marketplace", href: "/marketplace" }]} fallback="/marketplace" />
        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-6xl leading-none" aria-hidden>{flagEmoji(code)}</p>
            <h1 className="mt-3 font-bebas text-5xl tracking-wide sm:text-6xl">Shops from {name}</h1>
            <p className="mt-2 max-w-2xl text-neutral-300">Welcome. These are the {vendors.length === 1 ? "shop" : `${vendors.length} shops`} from {name} on NorthEDM. Prices are in each shop&apos;s own currency, with an estimate in yours.</p>
          </div>
          <CurrencyPill options={VIEW_CURRENCIES} />
        </div>
        {/* Pinned: interim payment rules for these shops (utils/localRules.ts). */}
        {!rules.walletsEnabled && (
          <div className="mt-6 rounded-2xl border border-[#FFC93C]/30 bg-[#FFC93C]/[0.06] px-5 py-4 text-sm">
            <p className="font-dm-mono text-[11px] uppercase tracking-widest text-[#FFC93C]">📌 How to pay, for now</p>
            <p className="mt-1 text-neutral-200">
              Shops from {name} take <span className="font-semibold text-white">Visa, Mastercard, debit cards and Google Pay</span> only for now. Wave, QMoney and Afrimoney are paused.
              An international transfer fee{remitLabel ? ` of ${remitLabel}` : ""} is added to each order to send the shop its share.
            </p>
          </div>
        )}
        <div className="mt-4"><IntlPaymentNote /></div>
        <div className="mt-10 space-y-8">
          {vendors.map((v) => {
            const items = products.filter((p) => p.vendor_id === v.id).slice(0, 8);
            const accent = accentOr(v.accent_color);
            const href = storeFor.has(v.id) ? `/${storeFor.get(v.id)}` : `/marketplace/${v.id}`;
            return (
              <section key={v.id} className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={href} className="text-2xl font-semibold hover:underline" style={{ color: accent }}>{v.name ?? "Shop"}</Link>
                    {v.category && <p className="mt-0.5 font-dm-mono text-xs uppercase tracking-widest text-neutral-500">{v.category}</p>}
                    {v.description && <p className="mt-2 max-w-2xl text-sm text-neutral-300">{v.description}</p>}
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Link href={href} className="rounded-xl px-4 py-2 text-sm font-semibold text-black" style={{ background: accent }}>{storeFor.has(v.id) ? "Open store" : "View market"} →</Link>
                    <Link href={`/festdash/order?vendor=${v.id}`} className="rounded-xl border border-orange-400/40 px-4 py-2 text-sm text-orange-200 hover:bg-orange-500/10">Order on FestDash</Link>
                  </div>
                </div>
                {items.length > 0 ? (
                  <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {items.map((p) => (
                      <Link key={p.id} href={`/marketplace/${v.id}/item/${p.id}`} className="overflow-hidden rounded-2xl border border-white/10 bg-black/20 transition hover:bg-white/[0.05]">
                        <ProductThumb src={p.image_url} alt={p.name ?? ""} />
                        <div className="p-3">
                          <p className="line-clamp-2 text-sm font-semibold text-white">{p.name ?? "Item"}</p>
                          <Price cents={Math.round(Number(p.price ?? 0) * 100)} currency={v.currency ?? "USD"} className="mt-1 block font-bebas text-lg" style={{ color: accent }} />
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-neutral-500">New on NorthEDM — items coming soon.</p>
                )}
              </section>
            );
          })}
        </div>
      </div>
    </main>
  );
}
