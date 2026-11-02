"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { BackBar } from "@/app/components/BackBar";
import { formatMoney } from "@/utils/money";
import { PaymentTimingNote } from "@/app/components/festdash/PaymentTimingNote";
import { PaymentPaths } from "@/app/components/festdash/PaymentPaths";
import { Honeypot, useFormShield } from "@/app/components/FormShield";

// The shop owner's walkthrough for a coordinator region (The Gambia). One page
// takes someone from a QR code to a live shop: account → application →
// coordinator confirms + first fee → add items. State comes from
// /api/festdash/shop-setup so the page always shows the right step.

type Wallets = { wave: string | null; qmoney: string | null; afrimoney: string | null; preferred: string | null };
type Vendor = {
  id: number; name: string | null; category: string | null; area: string | null; status: string | null;
  is_public: boolean | null; suspended_at: string | null; coordinator_user_id: string | null; coordinator_code: string | null;
  whatsapp_number: string | null; payout_wallets: Wallets | null; enrolled: boolean; fee_current: boolean;
  paid_through: string | null; store_slug: string | null; live: boolean;
};
type State = {
  user: { email: string | null; verified: boolean } | null;
  vendor: Vendor | null;
  coordinator: { display_name: string | null; region: string | null; whatsapp_number: string | null } | null;
  settings: { sale_owner_bps: number; sale_coordinator_bps: number; subscription_fee_cents: number; subscription_coordinator_bps: number };
  refCoordinator: { display_name: string | null; region: string | null } | null;
};

const CATEGORIES = ["Food & drink", "Groceries & household", "Clothing & fabric", "Crafts & art", "Phones & electronics", "Beauty & wellness", "Services", "Other"];
const SETUP_PATH = "/festdash/shop-setup";
const input = "w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white placeholder-neutral-600 focus:border-orange-500/50 focus:outline-none";
const label = "mb-1.5 block font-dm-mono text-xs uppercase tracking-widest text-neutral-500";
const card = "rounded-2xl border border-white/8 bg-white/3 p-5";

function Chip({ kind, children }: { kind: "done" | "now" | "later"; children: React.ReactNode }) {
  const cls = kind === "done" ? "bg-green-500/20 text-green-400" : kind === "now" ? "bg-orange-500/20 text-orange-400" : "bg-white/5 text-neutral-500";
  return <span className={`rounded-full px-2 py-0.5 font-dm-mono text-[10px] uppercase tracking-widest ${cls}`}>{children}</span>;
}

export default function ShopSetupPage() {
  const [state, setState] = useState<State | null>(null);
  const { shield, honeypot } = useFormShield();
  const [ref, setRef] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [form, setForm] = useState({
    shopName: "", category: CATEGORIES[0], description: "", area: "", whatsapp: "",
    wave: "", qmoney: "", afrimoney: "", preferred: "wave", coordinatorCode: "", agree: false,
  });
  const [wallets, setWallets] = useState({ wave: "", qmoney: "", afrimoney: "", preferred: "wave", whatsapp: "", area: "" });
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    let on = true;
    (async () => {
      const r = new URLSearchParams(window.location.search).get("ref")?.trim().toUpperCase() ?? "";
      const qs = r ? `?ref=${encodeURIComponent(r)}` : "";
      const res = await fetch("/api/festdash/shop-setup" + qs);
      const j = (await res.json()) as State;
      if (!on) return;
      setRef(r);
      if (r) setForm((f) => ({ ...f, coordinatorCode: f.coordinatorCode || r }));
      if (j.vendor) {
        const w = j.vendor.payout_wallets;
        setWallets({ wave: w?.wave ?? "", qmoney: w?.qmoney ?? "", afrimoney: w?.afrimoney ?? "", preferred: w?.preferred ?? "wave", whatsapp: j.vendor.whatsapp_number ?? "", area: j.vendor.area ?? "" });
      }
      setState(j);
    })();
    return () => { on = false; };
  }, [reloadKey]);

  const reload = () => setReloadKey((k) => k + 1);
  function flash(t: string) { setMsg(t); setTimeout(() => setMsg(""), 4000); }

  async function submitApplication(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!form.agree) { setError("Please tick the box to accept the fee and the split."); return; }
    setBusy("apply");
    const res = await fetch("/api/festdash/shop-setup", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        shopName: form.shopName, category: form.category, description: form.description, area: form.area, whatsapp: form.whatsapp,
        wallets: { wave: form.wave, qmoney: form.qmoney, afrimoney: form.afrimoney, preferred: form.preferred },
        coordinatorCode: form.coordinatorCode, agree: form.agree, ...shield(),
      }),
    });
    const j = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) { setError(j.error ?? "Couldn't send your application."); return; }
    flash("Application sent. Your coordinator and NorthEDM have been told.");
    reload();
  }

  async function saveWallets() {
    setBusy("wallets");
    const res = await fetch("/api/festdash/shop-setup", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wallets: { wave: wallets.wave, qmoney: wallets.qmoney, afrimoney: wallets.afrimoney, preferred: wallets.preferred }, whatsapp: wallets.whatsapp, area: wallets.area }),
    });
    const j = await res.json().catch(() => ({}));
    setBusy(null);
    flash(res.ok ? "Saved." : j.error ?? "Couldn't save.");
    if (res.ok) reload();
  }

  async function resendVerification() {
    if (!state?.user?.email) return;
    setBusy("resend");
    await fetch("/api/auth/resend-confirmation", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: state.user.email, origin: window.location.origin }) });
    setBusy(null);
    flash("Verification email sent — check your inbox and spam folder.");
  }

  if (!state) {
    return <main className="flex min-h-screen items-center justify-center"><span className="h-2 w-2 animate-pulse rounded-full bg-orange-400" /></main>;
  }

  const s = state.settings;
  const shopPct = 100 - (s.sale_owner_bps + s.sale_coordinator_bps) / 100;
  const signedIn = !!state.user;
  const verified = !!state.user?.verified;
  const v = state.vendor;
  const step = !signedIn ? 1 : !v ? 2 : v.live ? 4 : 3;
  const returnTo = `${SETUP_PATH}${ref ? `?ref=${encodeURIComponent(ref)}` : ""}`;
  const coordName = state.coordinator?.display_name ?? state.refCoordinator?.display_name ?? null;

  return (
    <main className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <BackBar crumbs={[{ label: "FestDash", href: "/festdash" }]} fallback="/festdash" />

        {/* Pitch */}
        <div>
          <p className="font-dm-mono text-xs uppercase tracking-widest text-orange-400">FestDash · The Gambia</p>
          <h1 className="mt-1 font-bebas text-5xl tracking-wide text-white">Sell to your whole town. <span className="text-orange-400">Delivered.</span></h1>
          <p className="mt-3 text-neutral-400">
            Put your shop&apos;s goods online, let people nearby order on the website or WhatsApp, and a runner brings it to them.
            You keep <span className="font-semibold text-white">{shopPct}%</span> of every sale. Your coordinator{coordName ? ` (${coordName})` : ""} handles the money locally.
          </p>
        </div>
        {msg && <p className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-neutral-200">{msg}</p>}

        {/* Costs */}
        <div className={card}>
          <p className={label}>What it costs · what you earn</p>
          <div className="grid gap-3 sm:grid-cols-3 text-sm">
            <div className="rounded-xl bg-white/5 p-3"><p className="font-dm-mono text-[10px] uppercase tracking-widest text-neutral-500">Listing fee</p><p className="mt-1 text-white"><span className="font-semibold">{formatMoney(s.subscription_fee_cents, "USD")}</span> a month, paid in dalasi to your coordinator</p></div>
            <div className="rounded-xl bg-white/5 p-3"><p className="font-dm-mono text-[10px] uppercase tracking-widest text-neutral-500">Each sale</p><p className="mt-1 text-white">You keep <span className="font-semibold">{shopPct}%</span> · coordinator {s.sale_coordinator_bps / 100}% · NorthEDM {s.sale_owner_bps / 100}%</p></div>
            <div className="rounded-xl bg-white/5 p-3"><p className="font-dm-mono text-[10px] uppercase tracking-widest text-neutral-500">Customers pay by</p><p className="mt-1 text-white">Wave · QMoney · Afrimoney · card</p></div>
          </div>
          <PaymentTimingNote all className="mt-4" />
        </div>
        <PaymentPaths audience="shop" className="mt-4" />

        {/* Step 1 — account */}
        <div className={card}>
          <div className="mb-2 flex items-center justify-between"><p className="font-semibold text-white">1 · Create your account</p><Chip kind={signedIn ? "done" : "now"}>{signedIn ? "Done" : "Start here"}</Chip></div>
          {!signedIn ? (
            <>
              <p className="mb-4 text-sm text-neutral-400">Free. Use your email or a Google account. You&apos;ll come straight back here afterwards.</p>
              <div className="flex flex-wrap gap-3">
                <Link href={`/signup?next=${encodeURIComponent(returnTo)}`} className="rounded-2xl bg-orange-500 px-6 py-3 font-semibold text-white hover:bg-orange-400">Create your free account</Link>
                <Link href={`/login?next=${encodeURIComponent(returnTo)}`} className="rounded-2xl border border-white/10 px-6 py-3 font-semibold text-neutral-300 hover:bg-white/5">I already have one</Link>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-neutral-300">Signed in as <span className="text-white">{state.user?.email}</span>.</p>
              {!verified && (
                <div className="mt-3 rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-3 text-sm text-yellow-300">
                  Please verify your email first — tap the link we sent you. Can&apos;t find it?{" "}
                  <button onClick={resendVerification} disabled={busy === "resend"} className="underline underline-offset-2 hover:text-white disabled:opacity-50">Send it again</button>.
                </div>
              )}
            </>
          )}
        </div>

        {/* Step 2 — shop application */}
        <div className={card}>
          <div className="mb-2 flex items-center justify-between"><p className="font-semibold text-white">2 · Tell us about your shop</p><Chip kind={v ? "done" : step === 2 ? "now" : "later"}>{v ? "Sent" : step === 2 ? "Now" : "Next"}</Chip></div>
          {v ? (
            <p className="text-sm text-neutral-300">✓ <span className="text-white">{v.name}</span> · {v.category}{v.area ? ` · ${v.area}` : ""}</p>
          ) : !signedIn ? (
            <p className="text-sm text-neutral-500">Takes two minutes once you&apos;re signed in.</p>
          ) : (
            <form onSubmit={submitApplication} className={`space-y-4 ${verified ? "" : "pointer-events-none opacity-50"}`}>
<Honeypot {...honeypot} />
              <div><span className={label}>Shop name *</span><input className={input} value={form.shopName} onChange={(e) => setForm({ ...form, shopName: e.target.value })} placeholder="e.g. Fatou's Fabrics" required /></div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div><span className={label}>What you sell *</span>
                  <select className={input} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></div>
                <div><span className={label}>Your area / town *</span><input className={input} value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} placeholder="e.g. Serrekunda" required /></div>
              </div>
              <div><span className={label}>Describe your shop *</span><textarea className={input} rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What people come to you for, opening hours, anything a customer should know." required /></div>
              <div><span className={label}>WhatsApp number *</span><input className={input} value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} placeholder="+220 …" required /><p className="mt-1 text-xs text-neutral-600">Customers can send orders here too.</p></div>

              <div className="rounded-xl border border-white/10 p-4">
                <p className={label}>Where do you want to be paid? (your wallet)</p>
                <p className="mb-3 text-xs text-neutral-500">Your coordinator sends your {shopPct}% here. Give at least one, or leave all blank to be paid in cash.</p>
                <div className="grid gap-3 sm:grid-cols-3">
                  {(["wave", "qmoney", "afrimoney"] as const).map((k) => (
                    <div key={k}><span className={label}>{k === "wave" ? "Wave" : k === "qmoney" ? "QMoney" : "Afrimoney"} number</span><input className={input} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} placeholder="+220 …" /></div>
                  ))}
                </div>
                <div className="mt-3"><span className={label}>Preferred</span>
                  <select className={input} value={form.preferred} onChange={(e) => setForm({ ...form, preferred: e.target.value })}><option value="wave">Wave</option><option value="qmoney">QMoney</option><option value="afrimoney">Afrimoney</option></select></div>
              </div>

              <div><span className={label}>Coordinator code (optional)</span><input className={input} value={form.coordinatorCode} onChange={(e) => setForm({ ...form, coordinatorCode: e.target.value.toUpperCase() })} placeholder="From the person who signed you up" />
                {state.refCoordinator && <p className="mt-1 text-xs text-green-400">✓ Signed up by {state.refCoordinator.display_name}</p>}</div>

              <label className="flex items-start gap-3 rounded-xl border border-orange-500/20 bg-orange-950/10 p-4 text-sm text-neutral-300">
                <input type="checkbox" className="mt-1 h-4 w-4 accent-orange-500" checked={form.agree} onChange={(e) => setForm({ ...form, agree: e.target.checked })} />
                <span>I understand the listing fee of {formatMoney(s.subscription_fee_cents, "USD")} a month (paid in dalasi to my coordinator), that I keep {shopPct}% of each sale with {s.sale_coordinator_bps / 100}% to my coordinator and {s.sale_owner_bps / 100}% to NorthEDM, and that transfer times depend on each payment app, not on FestDash.</span>
              </label>
              {error && <p className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</p>}
              <button type="submit" disabled={busy === "apply"} className="w-full rounded-2xl bg-orange-500 py-3 font-semibold text-white hover:bg-orange-400 disabled:opacity-50">{busy === "apply" ? "Sending…" : "Send my application"}</button>
            </form>
          )}
        </div>

        {/* Step 3 — coordinator + fee */}
        <div className={card}>
          <div className="mb-2 flex items-center justify-between"><p className="font-semibold text-white">3 · Your coordinator confirms you</p><Chip kind={v?.live ? "done" : step === 3 ? "now" : "later"}>{v?.live ? "Done" : step === 3 ? "In progress" : "Later"}</Chip></div>
          {!v ? (
            <p className="text-sm text-neutral-500">After you apply, NorthEDM approves your shop and your coordinator collects the first month&apos;s fee. Then you&apos;re on.</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              <li className={v.status === "approved" ? "text-green-400" : "text-neutral-300"}>{v.status === "approved" ? "✓ Approved by NorthEDM" : "⏳ Waiting for NorthEDM to approve your shop"}</li>
              <li className={v.coordinator_user_id ? "text-green-400" : "text-yellow-300"}>
                {v.coordinator_user_id
                  ? <>✓ Coordinator: {state.coordinator?.display_name ?? "assigned"}{state.coordinator?.whatsapp_number ? <> · <a className="underline underline-offset-2" href={`https://wa.me/${state.coordinator.whatsapp_number.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer">WhatsApp them</a></> : null}</>
                  : "⚠ No coordinator linked yet — tell NorthEDM who signed you up."}
              </li>
              <li className={v.fee_current ? "text-green-400" : "text-neutral-300"}>{v.fee_current ? `✓ Listing fee paid through ${v.paid_through}` : "⏳ First month's fee — your coordinator collects it and switches your shop on"}</li>
              <li className={v.enrolled ? "text-green-400" : "text-neutral-300"}>{v.enrolled ? "✓ Enrolled on FestDash" : "⏳ FestDash enrolment happens at approval"}</li>
            </ul>
          )}
        </div>

        {/* Step 4 — go live */}
        <div className={card}>
          <div className="mb-2 flex items-center justify-between"><p className="font-semibold text-white">4 · Add your items and sell</p><Chip kind={v?.live ? "now" : "later"}>{v?.live ? "You're live" : "Later"}</Chip></div>
          {v?.status === "approved" ? (
            <div className="flex flex-wrap gap-3">
              <Link href="/vendor/dashboard" className="rounded-2xl bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-400">Add items (prices in dalasi) →</Link>
              <Link href="/festdash/vendor-dashboard" className="rounded-2xl border border-white/10 px-5 py-2.5 text-sm font-semibold text-neutral-300 hover:bg-white/5">Your orders</Link>
              <Link href={v.store_slug ? `/${v.store_slug}` : `/marketplace/${v.id}`} className="rounded-2xl border border-white/10 px-5 py-2.5 text-sm font-semibold text-neutral-300 hover:bg-white/5">Your shop page</Link>
            </div>
          ) : (
            <p className="text-sm text-neutral-500">Once approved you add items with a photo and a price in dalasi. Customers order and pay your coordinator&apos;s wallet; once the payment is confirmed, a runner delivers. You hand over with a 4-digit code.</p>
          )}
        </div>

        {/* Wallet / contact editing */}
        {v && (
          <div className={card}>
            <p className={label}>Your wallet &amp; contact</p>
            <div className="grid gap-3 sm:grid-cols-3">
              {(["wave", "qmoney", "afrimoney"] as const).map((k) => (
                <div key={k}><span className={label}>{k === "wave" ? "Wave" : k === "qmoney" ? "QMoney" : "Afrimoney"}</span><input className={input} value={wallets[k]} onChange={(e) => setWallets({ ...wallets, [k]: e.target.value })} placeholder="+220 …" /></div>
              ))}
              <div><span className={label}>Preferred</span><select className={input} value={wallets.preferred} onChange={(e) => setWallets({ ...wallets, preferred: e.target.value })}><option value="wave">Wave</option><option value="qmoney">QMoney</option><option value="afrimoney">Afrimoney</option></select></div>
              <div><span className={label}>WhatsApp</span><input className={input} value={wallets.whatsapp} onChange={(e) => setWallets({ ...wallets, whatsapp: e.target.value })} /></div>
              <div><span className={label}>Area</span><input className={input} value={wallets.area} onChange={(e) => setWallets({ ...wallets, area: e.target.value })} /></div>
            </div>
            <button onClick={saveWallets} disabled={busy === "wallets"} className="mt-3 rounded-xl border border-white/10 px-4 py-2 text-sm text-neutral-200 hover:bg-white/5 disabled:opacity-50">{busy === "wallets" ? "Saving…" : "Save"}</button>
            <p className="mt-3 text-xs text-neutral-600">Your coordinator pays your share to the preferred wallet. {PAYMENT_DISCLAIMER_SHORT}</p>
          </div>
        )}
      </div>
    </main>
  );
}

const PAYMENT_DISCLAIMER_SHORT = "Transfer times are set by each app, not by FestDash.";
