"use client";

import { useState } from "react";

export function PayButtons({ token, hasDeposit, depositLabel, fullLabel }: {
  token: string;
  hasDeposit: boolean;
  depositLabel: string;
  fullLabel: string;
}) {
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  async function pay(mode: "deposit" | "full") {
    setBusy(mode); setError("");
    const res = await fetch(`/api/quote/${token}/pay`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok || !j.url) { setError(j.error || "Couldn't start checkout."); setBusy(""); return; }
    window.location.href = j.url;
  }

  return (
    <div className="mt-6 flex flex-col gap-3">
      {hasDeposit && (
        <button onClick={() => pay("deposit")} disabled={!!busy}
          className="w-full rounded-2xl bg-[#39FF14] px-6 py-3.5 text-sm font-semibold text-black transition hover:opacity-90 disabled:opacity-50">
          {busy === "deposit" ? "Starting secure checkout…" : depositLabel}
        </button>
      )}
      <button onClick={() => pay("full")} disabled={!!busy}
        className={`w-full rounded-2xl px-6 py-3.5 text-sm font-semibold transition disabled:opacity-50 ${hasDeposit ? "border border-white/15 text-white hover:bg-white/5" : "bg-[#39FF14] text-black hover:opacity-90"}`}>
        {busy === "full" ? "Starting secure checkout…" : fullLabel}
      </button>
      {error && <p className="text-sm text-[#FF5C3A]">{error}</p>}
      <p className="text-center font-dm-mono text-[11px] text-neutral-600">🔒 Secure payment via Stripe</p>
    </div>
  );
}
