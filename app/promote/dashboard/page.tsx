"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import { BackBar } from "@/app/components/BackBar";
import { createClient } from "@/utils/supabase/client";

type LedgerEntry = {
  id: string;
  amount_cents: number;
  reason: string;
  created_at: string;
};

const REASON_LABEL: Record<string, string> = {
  referral_bonus: "Referral reward",
  referral_signup: "Welcome credit",
  order_redeem: "Used on order",
  promoter_hoodie: "Hoodie earning",
  adjustment: "Adjustment",
};

type Hoodie = { id: string; code: string; label: string | null; percent_off: number; active: boolean; scans: number; redemptions: number; earned_cents: number };
type HoodieTotals = { hoodies: number; scans: number; redemptions: number; earned_cents: number };

export default function PromoterDashboard() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [isPromoter, setIsPromoter] = useState(false);
  const [referralCount, setReferralCount] = useState(0);
  const [balanceCents, setBalanceCents] = useState(0);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [hoodies, setHoodies] = useState<Hoodie[]>([]);
  const [hoodieTotals, setHoodieTotals] = useState<HoodieTotals | null>(null);
  const [payout, setPayout] = useState<{ connected: boolean; onboarded: boolean } | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [myCode, setMyCode] = useState<string | null>(null);
  const [myLink, setMyLink] = useState<string>("");
  const [myQr, setMyQr] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  async function connectPayouts() {
    setConnecting(true);
    const r = await fetch("/api/festdash/promoter/stripe/connect", { method: "POST" });
    const j = await r.json().catch(() => ({}));
    if (j.url) window.location.href = j.url;
    else setConnecting(false);
  }

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data: promoter } = await supabase
        .from("festdash_promoters")
        .select("is_active, referral_code")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!promoter) { setLoading(false); return; }
      setIsPromoter(true);

      // Permanent, reusable code + its QR — the one they post/print/share.
      if (promoter.referral_code) {
        const link = `${window.location.origin}/signup?ref=${promoter.referral_code}`;
        setMyCode(promoter.referral_code as string);
        setMyLink(link);
        try {
          setMyQr(await QRCode.toDataURL(link, {
            width: 320, margin: 1, errorCorrectionLevel: "H",
            color: { dark: "#000000", light: "#ffffff" },
          }));
        } catch { /* QR is a nicety — never block the dashboard */ }
      }

      const [{ count }, { data: bal }, { data: led }] = await Promise.all([
        supabase.from("referrals").select("id", { count: "exact", head: true }).eq("referrer_id", user.id),
        supabase.from("store_credit_balances").select("balance_cents").eq("user_id", user.id).maybeSingle(),
        supabase.from("store_credit_ledger").select("id, amount_cents, reason, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(15),
      ]);

      setReferralCount(count ?? 0);
      setBalanceCents(bal?.balance_cents ?? 0);
      setLedger(led ?? []);

      // Promoter hoodies (Promoter Hoodie line).
      try {
        const hr = await fetch("/api/festdash/promoter/hoodies");
        const hj = await hr.json();
        setHoodies(hj.hoodies ?? []);
        setHoodieTotals(hj.totals ?? null);
      } catch { /* ignore */ }

      // Cash payout onboarding status.
      try {
        const pr = await fetch("/api/festdash/promoter/stripe/status");
        setPayout(await pr.json());
      } catch { /* ignore */ }

      setLoading(false);
    })();
  }, [supabase]);

  if (loading) {
    return <main className="flex min-h-screen items-center justify-center text-neutral-500">Loading…</main>;
  }

  if (!isPromoter) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <div className="max-w-md text-center">
          <div className="mb-4 text-5xl">📣</div>
          <h1 className="mb-3 font-bebas text-4xl tracking-wide text-white">Not a promoter yet</h1>
          <p className="mb-6 text-neutral-400">
            Apply to the NorthEDM Promoter Program to get your referral link and
            start earning store credit.
          </p>
          <Link
            href="/promote"
            className="rounded-2xl bg-orange-500 px-6 py-3 font-semibold text-white transition hover:bg-orange-400"
          >
            Apply to Promote
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-6 py-16">
      <div className="mx-auto max-w-2xl">
        <BackBar fallback="/" />
        <div className="mb-2 font-dm-mono text-xs uppercase tracking-widest text-orange-400">
          NorthEDM Promoter
        </div>
        <h1 className="mb-8 font-bebas text-5xl tracking-wide text-white">Your Dashboard</h1>

        {/* Stats */}
        <div className="mb-8 grid grid-cols-2 gap-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <p className="font-dm-mono text-xs uppercase tracking-widest text-neutral-500">Store Credit</p>
            <p className="mt-1 font-bebas text-4xl text-[#39FF14]">${(balanceCents / 100).toFixed(2)}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <p className="font-dm-mono text-xs uppercase tracking-widest text-neutral-500">People Referred</p>
            <p className="mt-1 font-bebas text-4xl text-white">{referralCount}</p>
          </div>
        </div>

        {/* Cash payouts */}
        <div className="mb-8 rounded-2xl border border-[#39FF14]/20 bg-[#39FF14]/[0.04] p-5">
          <p className="mb-2 font-dm-mono text-xs uppercase tracking-widest text-[#39FF14]">💵 Cash payouts</p>
          {payout?.onboarded ? (
            <p className="text-sm text-neutral-300">
              ✅ Connected — commissions you earn (e.g. referring a website client) pay out to your
              bank automatically.
            </p>
          ) : (
            <>
              <p className="mb-4 text-sm text-neutral-400">
                Connect a payout account to receive <span className="text-[#39FF14]">real cash</span>{" "}
                commissions when someone you refer pays for a NorthEDM product or service.
              </p>
              <button
                onClick={connectPayouts}
                disabled={connecting}
                className="inline-flex rounded-xl bg-[#39FF14] px-5 py-3 text-sm font-semibold text-black transition hover:opacity-90 disabled:opacity-50"
              >
                {connecting ? "Opening…" : payout?.connected ? "Finish payout setup →" : "Set up cash payouts →"}
              </button>
            </>
          )}
        </div>

        {/* Your permanent code + QR — the one you post, print, and wear. */}
        {myCode && (
          <div className="mb-8 rounded-2xl border border-[#E8FF47]/25 bg-[#E8FF47]/[0.05] p-5">
            <p className="mb-2 font-dm-mono text-xs uppercase tracking-widest text-[#E8FF47]">
              ✦ Your promoter code
            </p>
            <div className="flex flex-wrap items-center gap-5">
              {myQr && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={myQr} alt={`QR for ${myCode}`} className="h-28 w-28 shrink-0 rounded-xl bg-white p-1.5" />
              )}
              <div className="min-w-0 flex-1">
                <p className="font-dm-mono text-2xl tracking-[0.2em] text-white">{myCode}</p>
                <p className="mt-1 text-sm text-neutral-400">
                  Reusable — share it as much as you like. Anyone who uses it saves
                  <span className="text-white"> 10%</span>, and you earn
                  <span className="text-[#39FF14]"> 10% back</span> on what they pay.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(myLink).then(() => {
                        setCopiedLink(true);
                        setTimeout(() => setCopiedLink(false), 2000);
                      });
                    }}
                    className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-neutral-300 transition hover:bg-white/10"
                  >
                    {copiedLink ? "Copied link ✓" : "Copy my link"}
                  </button>
                  {myQr && (
                    <a
                      href={myQr}
                      download={`northedm-promoter-${myCode}.png`}
                      className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-neutral-300 transition hover:bg-white/10"
                    >
                      Download QR
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Referral codes */}
        <div className="mb-8 rounded-2xl border border-white/10 bg-white/5 p-5">
          <p className="mb-2 font-dm-mono text-xs uppercase tracking-widest text-neutral-500">
            Referral codes
          </p>
          <p className="mb-4 text-sm text-neutral-400">
            Pull a fresh single-use code for each new person you refer. When they sign up and
            confirm their email, you both get <span className="text-[#39FF14]">$1.00 store credit</span>.
          </p>
          <Link
            href="/promote/codes"
            className="inline-flex rounded-xl bg-orange-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-orange-400"
          >
            Generate &amp; manage codes →
          </Link>
        </div>

        {/* My Hoodies (Promoter Hoodie line) */}
        {hoodieTotals && hoodieTotals.hoodies > 0 && (
          <div className="mb-8 rounded-2xl border border-[#CC00FF]/20 bg-[#CC00FF]/[0.04] p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="font-dm-mono text-xs uppercase tracking-widest text-[#CC00FF]">👕 My Promoter Hoodies</p>
              <p className="font-dm-mono text-xs text-neutral-400">
                {hoodieTotals.scans} scans · {hoodieTotals.redemptions} orders · earned{" "}
                <span className="text-[#39FF14]">${(hoodieTotals.earned_cents / 100).toFixed(2)}</span>
              </p>
            </div>
            <p className="mb-4 text-sm text-neutral-400">
              Each hoodie&apos;s QR gives a shopper a discount — and credits you the same amount they
              save. Wear it, share it, earn.
            </p>
            <div className="space-y-2">
              {hoodies.map((h) => (
                <div key={h.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/8 bg-white/[0.02] px-4 py-2.5">
                  <div className="min-w-0">
                    <p className="font-dm-mono text-sm text-white">{h.code}{h.label ? <span className="ml-2 text-neutral-600">· {h.label}</span> : null}</p>
                    <p className="font-dm-mono text-[11px] text-neutral-500">{h.percent_off}% off · {h.scans} scans · {h.redemptions} orders</p>
                  </div>
                  <span className="shrink-0 font-dm-mono text-sm text-[#39FF14]">${(h.earned_cents / 100).toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Ledger */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <p className="mb-3 font-dm-mono text-xs uppercase tracking-widest text-neutral-500">
            Credit activity
          </p>
          {ledger.length === 0 ? (
            <p className="text-sm text-neutral-600">No activity yet. Share your link to start earning.</p>
          ) : (
            <div className="divide-y divide-white/5">
              {ledger.map((e) => (
                <div key={e.id} className="flex items-center justify-between py-2.5 text-sm">
                  <span className="text-neutral-300">{REASON_LABEL[e.reason] ?? e.reason}</span>
                  <span className={e.amount_cents >= 0 ? "text-[#39FF14]" : "text-neutral-400"}>
                    {e.amount_cents >= 0 ? "+" : "−"}${Math.abs(e.amount_cents / 100).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
