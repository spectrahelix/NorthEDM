"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
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
  adjustment: "Adjustment",
};

export default function PromoterDashboard() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [isPromoter, setIsPromoter] = useState(false);
  const [referralCount, setReferralCount] = useState(0);
  const [balanceCents, setBalanceCents] = useState(0);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data: promoter } = await supabase
        .from("festdash_promoters")
        .select("is_active")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!promoter) { setLoading(false); return; }
      setIsPromoter(true);

      const [{ count }, { data: bal }, { data: led }] = await Promise.all([
        supabase.from("referrals").select("id", { count: "exact", head: true }).eq("referrer_id", user.id),
        supabase.from("store_credit_balances").select("balance_cents").eq("user_id", user.id).maybeSingle(),
        supabase.from("store_credit_ledger").select("id, amount_cents, reason, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(15),
      ]);

      setReferralCount(count ?? 0);
      setBalanceCents(bal?.balance_cents ?? 0);
      setLedger(led ?? []);
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
            Apply to the FestDash Promoter Program to get your referral link and
            start earning store credit.
          </p>
          <Link
            href="/festdash/promoter-signup"
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
        <div className="mb-2 font-dm-mono text-xs uppercase tracking-widest text-orange-400">
          FestDash Promoter
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
            href="/festdash/referrals"
            className="inline-flex rounded-xl bg-orange-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-orange-400"
          >
            Generate &amp; manage codes →
          </Link>
        </div>

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
