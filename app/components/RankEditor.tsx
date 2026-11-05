"use client";
import { useState } from "react";
import { MODERATOR_TAGS, MEMBER_TAGS, TAG_CONFIG } from "./roleColors";

// Merchant / Promoter tags on a profile (owner, 2026-11-05: tags, not ranks).
// Everyone sees the ones held; archons, wardens and site moderators who may
// edit this member get toggles, and an archon also gets the Moderator switch.
// /api/ranks enforces the rules; every other tag is set in /admin/users.
export function RankEditor({ userId, role, extraRanks, isMerchant = false, isPromoter = false, isModerator, canEdit, canSetModerator }: {
  userId: string; role: string; extraRanks: string[]; isMerchant?: boolean; isPromoter?: boolean; isModerator: boolean; canEdit: boolean; canSetModerator: boolean;
}) {
  const [held, setHeld] = useState<Record<string, boolean>>({
    merchant: isMerchant || extraRanks.includes("merchant"),
    promoter: isPromoter || extraRanks.includes("promoter"),
  });
  const [mod, setMod] = useState(isModerator);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const archon = role === "archon";
  if (!canEdit && !canSetModerator) return null; // the badges already show what they hold

  async function save(body: Record<string, unknown>, after: () => void) {
    setBusy(true); setMsg("");
    const r = await fetch("/api/ranks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId, ...body }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setMsg(j.error || "Couldn't save."); return; }
    after();
    setMsg(j.referral_code ? `Saved. Promoter code: ${j.referral_code}` : "Saved.");
  }

  return (
    <div className="mb-6 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
      <p className="font-dm-mono text-[11px] uppercase tracking-widest text-neutral-500">
        {archon ? "Archon — holds every ability" : "Tags"}{mod ? " · Moderator" : ""}
      </p>
      {!archon && canEdit && (
        <div className="mt-2 flex flex-wrap gap-2">
          {MEMBER_TAGS.filter((t) => MODERATOR_TAGS.includes(t.key)).map((t) => {
            const on = !!held[t.key];
            const c = TAG_CONFIG[t.tag];
            return (
              <button key={t.key} type="button" disabled={busy} title={t.help}
                onClick={() => save({ tag: t.key, value: !on }, () => setHeld((h) => ({ ...h, [t.key]: !on })))}
                className="rounded-full border px-3 py-1 text-xs font-semibold transition disabled:opacity-50"
                style={{ borderColor: on ? c.color : "rgba(255,255,255,0.12)", color: on ? c.color : "#777", background: on ? `${c.color}14` : "transparent" }}>
                {on ? "✓ " : "+ "}{c.glyph} {c.label}
              </button>
            );
          })}
        </div>
      )}
      {canSetModerator && (
        <button type="button" disabled={busy} onClick={() => save({ moderator: !mod }, () => setMod(!mod))}
          className="mt-3 rounded-lg border border-white/15 px-3 py-1 text-xs text-neutral-300 hover:bg-white/5 disabled:opacity-50">
          {mod ? "Remove Moderator" : "Make Moderator"} <span className="text-neutral-500">(can give Merchant and Promoter tags to non-admins)</span>
        </button>
      )}
      {msg && <p className="mt-2 text-xs text-neutral-400">{msg}</p>}
    </div>
  );
}
