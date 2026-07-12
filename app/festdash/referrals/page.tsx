"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { BackBar } from "@/app/components/BackBar";
import { createClient } from "@/utils/supabase/client";

type Code = {
  id: string;
  code: string;
  redeemed_by: string | null;
  redeemed_at: string | null;
  created_at: string;
};

export default function ReferralsPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [eligible, setEligible] = useState(false);
  const [issuerKind, setIssuerKind] = useState<"vendor" | "promoter" | null>(null);
  const [codes, setCodes] = useState<Code[]>([]);
  const [balanceCents, setBalanceCents] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [origin, setOrigin] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const refresh = useCallback(async (userId: string) => {
    const [{ data: codeRows }, { data: bal }] = await Promise.all([
      supabase.from("referral_codes").select("id, code, redeemed_by, redeemed_at, created_at")
        .eq("issuer_id", userId).order("created_at", { ascending: false }),
      supabase.from("store_credit_balances").select("balance_cents").eq("user_id", userId).maybeSingle(),
    ]);
    setCodes((codeRows as Code[]) ?? []);
    setBalanceCents(bal?.balance_cents ?? 0);
  }, [supabase]);

  useEffect(() => {
    setOrigin(window.location.origin);
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const [{ data: profile }, { data: promoter }] = await Promise.all([
        supabase.from("profiles").select("vendor_id").eq("id", user.id).maybeSingle(),
        supabase.from("festdash_promoters").select("is_active").eq("user_id", user.id).maybeSingle(),
      ]);
      const kind = profile?.vendor_id ? "vendor" : promoter?.is_active ? "promoter" : null;
      setIssuerKind(kind);
      setEligible(!!kind);

      if (kind) await refresh(user.id);
      setLoading(false);
    })();
  }, [supabase, refresh]);

  async function generate() {
    setGenerating(true);
    setError("");
    const res = await fetch("/api/referrals/generate", { method: "POST" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json.error ?? "Couldn't generate a code.");
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) await refresh(user.id);
    }
    setGenerating(false);
  }

  function copy(c: Code) {
    const link = `${origin}/signup?ref=${c.code}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopiedId(c.id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  }

  if (loading) {
    return <main className="flex min-h-screen items-center justify-center text-neutral-500">Loading…</main>;
  }

  if (!eligible) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <div className="max-w-md text-center">
          <div className="mb-4 text-5xl">🎟️</div>
          <h1 className="mb-3 font-bebas text-4xl tracking-wide text-white">Referral codes</h1>
          <p className="mb-6 text-neutral-400">
            Referral codes are for FestDash vendors and approved promoters. Apply to join,
            then come back to start earning store credit.
          </p>
          <Link href="/festdash/promoter-signup"
            className="rounded-2xl bg-orange-500 px-6 py-3 font-semibold text-white transition hover:bg-orange-400">
            Apply to Promote
          </Link>
        </div>
      </main>
    );
  }

  const unused = codes.filter((c) => !c.redeemed_by);
  const redeemedCount = codes.length - unused.length;

  return (
    <main className="min-h-screen px-6 py-16">
      <div className="mx-auto max-w-2xl">
        <BackBar crumbs={[{ label: "FestDash", href: "/festdash" }]} fallback="/festdash" />
        <div className="mb-2 font-dm-mono text-xs uppercase tracking-widest text-orange-400">
          {issuerKind === "vendor" ? "Vendor" : "Promoter"} · Referrals
        </div>
        <h1 className="mb-8 font-bebas text-5xl tracking-wide text-white">Referral Codes</h1>

        {/* Stats */}
        <div className="mb-8 grid grid-cols-3 gap-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <p className="font-dm-mono text-xs uppercase tracking-widest text-neutral-500">Store Credit</p>
            <p className="mt-1 font-bebas text-3xl text-[#39FF14]">${(balanceCents / 100).toFixed(2)}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <p className="font-dm-mono text-xs uppercase tracking-widest text-neutral-500">Redeemed</p>
            <p className="mt-1 font-bebas text-3xl text-white">{redeemedCount}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <p className="font-dm-mono text-xs uppercase tracking-widest text-neutral-500">Unused</p>
            <p className="mt-1 font-bebas text-3xl text-white">{unused.length}</p>
          </div>
        </div>

        {/* Generate */}
        <div className="mb-8 rounded-2xl border border-white/10 bg-white/5 p-5">
          <p className="mb-2 font-dm-mono text-xs uppercase tracking-widest text-neutral-500">
            Pull a new code
          </p>
          <p className="mb-4 text-sm text-neutral-400">
            Each code works once. Hand it to a new person — when they sign up and confirm their
            email, you both get <span className="text-[#39FF14]">$1.00 store credit</span>.
          </p>
          <button
            onClick={generate}
            disabled={generating}
            className="rounded-xl bg-orange-500 px-6 py-3 font-semibold text-white transition hover:bg-orange-400 disabled:opacity-50"
          >
            {generating ? "Generating…" : "Generate a code"}
          </button>
          {error && <p className="mt-3 text-sm text-[#FF5C3A]">{error}</p>}
        </div>

        {/* Codes list */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <p className="mb-3 font-dm-mono text-xs uppercase tracking-widest text-neutral-500">
            Your codes
          </p>
          {codes.length === 0 ? (
            <p className="text-sm text-neutral-600">No codes yet. Generate your first one above.</p>
          ) : (
            <div className="divide-y divide-white/5">
              {codes.map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-3 py-3">
                  <div>
                    <span className="font-dm-mono text-lg tracking-wider text-white">{c.code}</span>
                    {c.redeemed_by ? (
                      <span className="ml-3 font-dm-mono text-[11px] text-neutral-500">redeemed ✓</span>
                    ) : (
                      <span className="ml-3 font-dm-mono text-[11px] text-[#39FF14]">unused</span>
                    )}
                  </div>
                  {!c.redeemed_by && (
                    <button
                      onClick={() => copy(c)}
                      className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-neutral-300 transition hover:bg-white/10"
                    >
                      {copiedId === c.id ? "Copied link ✓" : "Copy link"}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
