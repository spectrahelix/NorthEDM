"use client";

import { useState } from "react";

function money(cents: number) {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function PayButtons({ token, hasDeposit, depositLabel, fullLabel, canApplyCode }: {
  token: string;
  hasDeposit: boolean;
  depositLabel: string;
  fullLabel: string;
  canApplyCode?: boolean;
}) {
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [code, setCode] = useState("");
  const [checking, setChecking] = useState(false);
  const [applied, setApplied] = useState<{ code: string; discountCents: number; newTotalCents: number; promoterName: string | null } | null>(null);
  const [codeError, setCodeError] = useState("");

  async function applyCode() {
    const c = code.trim();
    if (!c) return;
    setChecking(true); setCodeError("");
    const res = await fetch("/api/promote/validate-code", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: c, token }),
    });
    const j = await res.json().catch(() => ({}));
    setChecking(false);
    if (!res.ok || !j.ok) { setCodeError(j.error || "That code isn't valid."); setApplied(null); return; }
    setApplied({ code: j.code, discountCents: j.discountCents, newTotalCents: j.newTotalCents, promoterName: j.promoterName ?? null });
  }

  async function pay(mode: "deposit" | "full") {
    setBusy(mode); setError("");
    const res = await fetch(`/api/quote/${token}/pay`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode, code: applied?.code ?? "" }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok || !j.url) { setError(j.error || "Couldn't start checkout."); setBusy(""); return; }
    window.location.href = j.url;
  }

  return (
    <div className="mt-6 flex flex-col gap-3">
      {canApplyCode && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
          {applied ? (
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[#39FF14]">
                  ✅ Code {applied.code} applied — you save {money(applied.discountCents)}
                </p>
                <p className="mt-0.5 font-dm-mono text-[11px] text-neutral-500">
                  New total {money(applied.newTotalCents)}
                  {applied.promoterName ? ` · supporting ${applied.promoterName}` : ""}
                </p>
              </div>
              <button
                onClick={() => { setApplied(null); setCode(""); }}
                className="shrink-0 font-dm-mono text-[11px] text-neutral-500 hover:text-white"
              >
                remove
              </button>
            </div>
          ) : (
            <>
              <label htmlFor="promo" className="mb-2 block font-dm-mono text-[11px] uppercase tracking-widest text-neutral-400">
                Have a promoter code?
              </label>
              <div className="flex gap-2">
                <input
                  id="promo"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => { if (e.key === "Enter") applyCode(); }}
                  placeholder="e.g. K7M2QPX"
                  className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 font-dm-mono text-sm tracking-wider text-white placeholder:text-neutral-600 focus:border-[#39FF14]/40 focus:outline-none"
                />
                <button
                  onClick={applyCode}
                  disabled={checking || !code.trim()}
                  className="shrink-0 rounded-xl border border-white/15 px-4 py-2 text-sm text-neutral-200 transition hover:bg-white/5 disabled:opacity-50"
                >
                  {checking ? "Checking…" : "Apply"}
                </button>
              </div>
              <p className="mt-2 font-dm-mono text-[10px] text-neutral-600">
                Save 10% — and the promoter who referred you earns a commission.
              </p>
              {codeError && <p className="mt-2 text-sm text-[#FF5C3A]">{codeError}</p>}
            </>
          )}
        </div>
      )}

      {hasDeposit && (
        <button onClick={() => pay("deposit")} disabled={!!busy}
          className="w-full rounded-2xl bg-[#39FF14] px-6 py-3.5 text-sm font-semibold text-black transition hover:opacity-90 disabled:opacity-50">
          {busy === "deposit" ? "Starting secure checkout…" : depositLabel}
        </button>
      )}
      <button onClick={() => pay("full")} disabled={!!busy}
        className={`w-full rounded-2xl px-6 py-3.5 text-sm font-semibold transition disabled:opacity-50 ${hasDeposit ? "border border-white/15 text-white hover:bg-white/5" : "bg-[#39FF14] text-black hover:opacity-90"}`}>
        {busy === "full"
          ? "Starting secure checkout…"
          : applied ? `Pay in full — ${money(applied.newTotalCents)}` : fullLabel}
      </button>
      {error && <p className="text-sm text-[#FF5C3A]">{error}</p>}
      <p className="text-center font-dm-mono text-[11px] text-neutral-600">🔒 Secure payment via Stripe</p>
    </div>
  );
}
