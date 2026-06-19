"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";

type Code = {
  id: string;
  code: string;
  percent_off: number;
  max_redemptions: number | null;
  times_redeemed: number;
  active: boolean;
  created_at: string;
};

export default function CommissionCodesPage() {
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [isVendor, setIsVendor] = useState(false);
  const [codes, setCodes] = useState<Code[]>([]);
  const [percent, setPercent] = useState("10");
  const [maxRedemptions, setMaxRedemptions] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [origin, setOrigin] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function loadCodes() {
    const res = await fetch("/api/festdash/promo-codes");
    const j = await res.json().catch(() => ({}));
    setCodes(j.codes ?? []);
  }

  useEffect(() => {
    setOrigin(window.location.origin);
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const { data: profile } = await supabase
        .from("profiles").select("vendor_id").eq("id", user.id).maybeSingle();
      if (profile?.vendor_id) {
        setIsVendor(true);
        await loadCodes();
      }
      setLoading(false);
    })();
  }, [supabase]);

  async function create() {
    setCreating(true);
    setError("");
    const res = await fetch("/api/festdash/promo-codes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        percentOff: Number(percent),
        maxRedemptions: maxRedemptions.trim() === "" ? null : Number(maxRedemptions),
      }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) setError(j.error ?? "Couldn't create code.");
    else { setMaxRedemptions(""); await loadCodes(); }
    setCreating(false);
  }

  function copy(c: Code) {
    navigator.clipboard.writeText(c.code).then(() => {
      setCopiedId(c.id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  }

  if (loading) {
    return <main className="flex min-h-screen items-center justify-center font-dm-mono text-sm text-neutral-500">Loading…</main>;
  }

  if (!isVendor) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <div className="max-w-md text-center">
          <div className="mb-4 text-5xl">🏷️</div>
          <h1 className="mb-3 font-bebas text-4xl tracking-wide text-white">Vendors only</h1>
          <p className="mb-6 text-neutral-400">
            Commission codes are for FestDash vendors. Apply to join the network to start
            offering discounts on your menu.
          </p>
          <Link href="/festdash/vendor-signup" className="rounded-2xl bg-orange-500 px-6 py-3 font-semibold text-white transition hover:bg-orange-400">
            Apply to FestDash
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-6 py-16 text-neutral-100">
      <div className="mx-auto max-w-2xl">
        <div className="mb-2 font-dm-mono text-xs uppercase tracking-widest text-orange-400">Vendor</div>
        <h1 className="mb-3 font-bebas text-5xl tracking-wide">Commission Codes</h1>
        <p className="mb-8 max-w-xl text-sm text-neutral-400">
          Share a code with your customers. At checkout they get the percentage off your
          items — and that same amount is your commission to NorthEDM. (You absorb both the
          discount and the commission.)
        </p>

        {/* Create */}
        <div className="mb-8 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <p className="mb-4 font-dm-mono text-xs uppercase tracking-widest text-neutral-500">New code</p>
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="mb-1.5 block font-dm-mono text-[11px] uppercase tracking-widest text-neutral-500">% off</label>
              <input
                type="number" min={1} max={100} value={percent}
                onChange={(e) => setPercent(e.target.value)}
                className="w-24 rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-neutral-100 outline-none focus:border-orange-500/50"
              />
            </div>
            <div>
              <label className="mb-1.5 block font-dm-mono text-[11px] uppercase tracking-widest text-neutral-500">Max uses (blank = ∞)</label>
              <input
                type="number" min={1} value={maxRedemptions}
                onChange={(e) => setMaxRedemptions(e.target.value)}
                placeholder="unlimited"
                className="w-36 rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-neutral-100 placeholder:text-neutral-600 outline-none focus:border-orange-500/50"
              />
            </div>
            <button
              onClick={create}
              disabled={creating}
              className="rounded-xl bg-orange-500 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-400 disabled:opacity-50"
            >
              {creating ? "Creating…" : "Create code"}
            </button>
          </div>
          {error && <p className="mt-3 text-sm text-[#FF5C3A]">{error}</p>}
        </div>

        {/* List */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <p className="mb-3 font-dm-mono text-xs uppercase tracking-widest text-neutral-500">Your codes</p>
          {codes.length === 0 ? (
            <p className="text-sm text-neutral-600">No codes yet — create one above.</p>
          ) : (
            <div className="divide-y divide-white/5">
              {codes.map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-3 py-3">
                  <div>
                    <span className="font-dm-mono text-lg tracking-wider text-white">{c.code}</span>
                    <span className="ml-3 text-sm text-[#39FF14]">{c.percent_off}% off</span>
                    <div className="mt-0.5 font-dm-mono text-[11px] text-neutral-500">
                      used {c.times_redeemed}{c.max_redemptions != null ? ` / ${c.max_redemptions}` : ""}
                      {!c.active && " · inactive"}
                    </div>
                  </div>
                  <button
                    onClick={() => copy(c)}
                    className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-neutral-300 transition hover:bg-white/10"
                  >
                    {copiedId === c.id ? "Copied ✓" : "Copy"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <p className="mt-4 font-dm-mono text-[11px] text-neutral-600">
          Origin: {origin || "—"} · Codes apply to your FestDash menu at checkout.
        </p>
      </div>
    </main>
  );
}
