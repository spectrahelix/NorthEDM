"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { BackBar } from "@/app/components/BackBar";
import { PayoutsCard } from "@/app/components/PayoutsCard";
import { BridgeIntake } from "@/app/components/festdash/BridgeIntake";
import { AccentPicker } from "@/app/components/AccentPicker";
import { formatMoney } from "@/utils/money";
import { VendorEditForm } from "@/app/marketplace/[id]/components/VendorEditForm";
import { CoordinatorBook } from "@/app/components/festdash/CoordinatorBook";

/**
 * My Shop — the one admin page every marketplace vendor gets: profile, shop
 * links, inventory, orders, payouts and visit/sales metrics. Metrics are
 * counts only (see /api/vendor/metrics); shop owners never see who visited.
 */
type Me = {
  vendor: { id: number; name: string; category: string | null; description: string | null; contact: string | null; business_email: string | null; website: string | null; phone: string | null; show_phone: boolean | null; accent_color: string | null; is_public: boolean; status: string; suspended_at: string | null; currency: string | null };
  store: { slug: string; name: string; active: boolean; billing_status: string; is_operator: boolean } | null;
  festdash: boolean; products: { total: number; live: number };
};
type Metrics = {
  days: number; views: { last7: number; last30: number; visitors7: number; visitors30: number; by_day: { day: string; views: number }[] };
  top_items: { id: number; name: string; views: number }[]; top_referrers: { host: string; views: number }[];
  sales: { currency: string; festdash: { delivered: number; open: number; revenue_cents: number }; store: { orders: number; revenue_cents: number } };
};

export default function MyShopPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [me, setMe] = useState<Me | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [state, setState] = useState<"loading" | "none" | "ok">("loading");
  const [accent, setAccent] = useState<string>("#3AFFD4");
  const [accentMsg, setAccentMsg] = useState("");

  useEffect(() => {
    (async () => {
      const r = await fetch("/api/vendor/me");
      if (r.status === 401) { router.push("/login?next=/vendor"); return; }
      if (!r.ok) { setState("none"); return; }
      const j = (await r.json()) as Me;
      setMe(j); setAccent(j.vendor.accent_color || "#3AFFD4"); setState("ok");
      fetch("/api/vendor/metrics").then((m) => (m.ok ? m.json() : null)).then((m) => m && setMetrics(m)).catch(() => {});
    })();
  }, [router]);

  async function saveAccent(hex: string) {
    setAccent(hex); setAccentMsg("");
    if (!me) return;
    const { data, error } = await supabase.from("vendors").update({ accent_color: hex }).eq("id", me.vendor.id).select("id");
    setAccentMsg(error ? error.message : data?.length ? "Saved." : "Not saved — no permission.");
  }

  if (state === "loading") return <main className="flex min-h-screen items-center justify-center font-dm-mono text-sm text-neutral-500">Loading your shop…</main>;
  if (state === "none" || !me) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6 text-neutral-100">
        <div className="max-w-md text-center">
          <h1 className="font-bebas text-4xl tracking-wide">No shop on this account yet</h1>
          <p className="mt-3 text-sm text-neutral-400">Apply for a NorthEDM Marketplace and this page becomes your shop&apos;s admin: profile, items, orders, payouts and visit counts.</p>
          <Link href="/vendors/apply" className="mt-6 inline-block rounded-xl bg-[#3AFFD4] px-5 py-2.5 text-sm font-semibold text-black">Apply for a Marketplace →</Link>
        </div>
      </main>
    );
  }
  const v = me.vendor;
  const hidden = !!v.suspended_at || !v.is_public || v.status !== "approved";
  const storeHref = me.store ? `/${me.store.slug}` : null;
  const money = (c: number) => formatMoney(c, metrics?.sales.currency ?? v.currency ?? "USD");
  const maxDay = Math.max(1, ...(metrics?.views.by_day.map((d) => d.views) ?? [1]));

  return (
    <main className="min-h-screen px-6 py-14 text-neutral-100">
      <div className="mx-auto max-w-4xl">
        <BackBar crumbs={[{ label: "Marketplace", href: "/marketplace" }]} fallback="/marketplace" />
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-dm-mono text-xs uppercase tracking-[0.3em]" style={{ color: accent }}>My Shop · admin</p>
            <h1 className="mt-2 font-bebas text-5xl tracking-wide">{v.name}</h1>
            <p className="mt-1 text-sm text-neutral-500">
              {hidden ? "Not visible to the public yet" : "Live on the marketplace"} · {me.products.live} of {me.products.total} item{me.products.total === 1 ? "" : "s"} published
              {me.store ? ` · store ${me.store.active && me.store.billing_status === "active" ? "open" : "draft"}` : ""}{me.festdash ? " · on FestDash" : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/vendor/dashboard" className="rounded-xl px-4 py-2 text-sm font-semibold text-black" style={{ background: accent }}>{me.products.total === 0 ? "Add items" : "Inventory"} →</Link>
            <Link href={`/marketplace/${v.id}`} className="rounded-xl border border-white/15 px-4 py-2 text-sm text-neutral-200 hover:bg-white/5">Market page →</Link>
            {storeHref && <Link href={storeHref} className="rounded-xl border border-white/15 px-4 py-2 text-sm text-neutral-200 hover:bg-white/5">Storefront →</Link>}
          </div>
        </div>

        {/* Metrics */}
        <section className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-dm-mono text-xs uppercase tracking-widest text-neutral-500">Visitors · last {metrics?.days ?? 30} days</p>
            <p className="text-[11px] text-neutral-600">Counts only. Who visited is never shown.</p>
          </div>
          {!metrics ? <p className="mt-3 text-sm text-neutral-500">Loading…</p> : (
            <>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[["Views · 7 days", metrics.views.last7], ["Views · 30 days", metrics.views.last30], ["Visitors · 7 days", metrics.views.visitors7], ["Visitors · 30 days", metrics.views.visitors30]].map(([l, n]) => (
                  <div key={String(l)} className="rounded-xl border border-white/10 bg-black/20 p-3"><p className="font-dm-mono text-[10px] uppercase tracking-widest text-neutral-500">{l}</p><p className="mt-1 font-bebas text-3xl" style={{ color: accent }}>{n}</p></div>
                ))}
              </div>
              <div className="mt-4 flex h-16 items-end gap-[2px]" aria-label="Views per day">
                {metrics.views.by_day.map((d) => (
                  <div key={d.day} title={`${d.day}: ${d.views}`} className="flex-1 rounded-t-sm bg-white/15" style={{ height: `${Math.max(2, (d.views / maxDay) * 100)}%`, background: d.views ? accent : undefined, opacity: d.views ? 0.85 : 1 }} />
                ))}
              </div>
              <div className="mt-5 grid gap-4 sm:grid-cols-3">
                <div>
                  <p className="font-dm-mono text-[10px] uppercase tracking-widest text-neutral-500">Most viewed items</p>
                  {metrics.top_items.length === 0 ? <p className="mt-1 text-sm text-neutral-600">No item views yet.</p> : metrics.top_items.map((i) => (
                    <div key={i.id} className="mt-1 flex justify-between text-sm"><Link href={`/marketplace/${v.id}/item/${i.id}`} className="truncate text-neutral-200 hover:underline">{i.name}</Link><span className="ml-3 font-dm-mono text-neutral-400">{i.views}</span></div>
                  ))}
                </div>
                <div>
                  <p className="font-dm-mono text-[10px] uppercase tracking-widest text-neutral-500">Where visitors came from</p>
                  {metrics.top_referrers.length === 0 ? <p className="mt-1 text-sm text-neutral-600">Direct and in-site only so far.</p> : metrics.top_referrers.map((r) => (
                    <div key={r.host} className="mt-1 flex justify-between text-sm"><span className="truncate text-neutral-200">{r.host}</span><span className="ml-3 font-dm-mono text-neutral-400">{r.views}</span></div>
                  ))}
                </div>
                <div>
                  <p className="font-dm-mono text-[10px] uppercase tracking-widest text-neutral-500">Sales · last {metrics.days} days</p>
                  {me.festdash && <p className="mt-1 text-sm text-neutral-200">FestDash: {metrics.sales.festdash.delivered} delivered · {metrics.sales.festdash.open} open · <span style={{ color: accent }}>{money(metrics.sales.festdash.revenue_cents)}</span></p>}
                  <p className="mt-1 text-sm text-neutral-200">Store: {metrics.sales.store.orders} order{metrics.sales.store.orders === 1 ? "" : "s"} · <span style={{ color: accent }}>{money(metrics.sales.store.revenue_cents)}</span></p>
                  <p className="mt-1 text-[11px] text-neutral-600">Your items only, before fees.</p>
                </div>
              </div>
            </>
          )}
        </section>

        {/* Shop controls */}
        <section className="mt-4 grid gap-3 sm:grid-cols-2">
          <Card title="Inventory" body={`${me.products.total} item${me.products.total === 1 ? "" : "s"}, ${me.products.live} published. Add photos, prices, stock and specifications.`} href="/vendor/dashboard" cta={me.products.total === 0 ? "Add your first item" : "Manage items"} accent={accent} />
          {me.store ? (
            <Card title={`Store · /${me.store.slug}`} body={me.store.is_operator ? `Your storefront is ${me.store.active && me.store.billing_status === "active" ? "open" : "in draft"}. Theme, logo, orders, hand-overs and billing live on the manage page.` : `You sell in ${me.store.name}. Its operator manages the storefront.`} href={me.store.is_operator ? `/${me.store.slug}/manage` : `/${me.store.slug}`} cta={me.store.is_operator ? "Manage store" : "Open store"} accent={accent} />
          ) : (
            <Card title="Store" body="No storefront yet. A store gives you your own page at northedm.com/your-name with checkout. Ask the owner to set one up, or buy the bundle on FestDash." href="/festdash/vendor-dashboard" cta="See plans" accent={accent} />
          )}
          {me.festdash && <Card title="FestDash orders" body="Live orders, pickups and deliveries, your listing fee and runner hand-overs." href="/festdash/vendor-dashboard" cta="Open FestDash dashboard" accent={accent} />}
          <Card title="Market page" body="Your public listing on the marketplace: name, category, description, contact and website. Edit it below or on the page itself." href={`/marketplace/${v.id}`} cta="View market page" accent={accent} />
        </section>

        {/* Profile */}
        <section className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <p className="font-dm-mono text-xs uppercase tracking-widest text-neutral-500">Shop profile</p>
          <p className="mt-1 text-sm text-neutral-400">What customers read about you. Your personal details stay on your account profile, not here.</p>
          <div className="mt-3">
            <VendorEditForm vendorId={v.id} initial={{ name: v.name ?? "", description: v.description ?? "", category: v.category ?? "", contact: v.contact ?? "", email: v.business_email ?? "", website: v.website ?? "", phone: v.phone ?? "", showPhone: v.show_phone ?? false }} />
          </div>
          <div className="mt-5">
            <p className="font-dm-mono text-[10px] uppercase tracking-widest text-neutral-500">Accent colour</p>
            <p className="mb-2 text-xs text-neutral-500">Used for your name and prices on your market page.</p>
            <AccentPicker value={accent} onChange={saveAccent} />
            {accentMsg && <p className="mt-1 text-xs text-neutral-400">{accentMsg}</p>}
          </div>
        </section>

        {/* Payouts: Stripe for US shops; the Gambian payment bridge for every other currency */}
        <div className="mt-4"><PayoutsCard returnTo="/vendor" /></div>
        {(v.currency ?? "USD") !== "USD" && <div className="mt-4"><CoordinatorBook /></div>}
        {(v.currency ?? "USD") !== "USD" && <div className="mt-4"><BridgeIntake scope="shop" /></div>}
      </div>
    </main>
  );
}

function Card({ title, body, href, cta, accent }: { title: string; body: string; href: string; cta: string; accent: string }) {
  return (
    <div className="flex flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <p className="font-semibold text-white">{title}</p>
      <p className="mt-1 flex-1 text-sm text-neutral-400">{body}</p>
      <Link href={href} className="mt-3 inline-block self-start rounded-xl border px-4 py-2 text-sm font-medium transition hover:bg-white/5" style={{ borderColor: `${accent}66`, color: accent }}>{cta} →</Link>
    </div>
  );
}
