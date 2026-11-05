"use client";
import { useState } from "react";
import { ROLE_CONFIG, type ForumRole } from "./roleColors";
import { EXTRA_RANKS } from "@/utils/ranks";

// Extra ranks on a profile (utils/ranks.ts). Everyone sees them as chips;
// archons, wardens and site moderators who may edit this member get toggles,
// and an archon also gets the Moderator switch. /api/ranks enforces the rules.
const LABEL: Record<string, { label: string; color: string }> = {
  ...Object.fromEntries(Object.entries(ROLE_CONFIG).map(([k, v]) => [k, { label: v.label, color: v.color }])),
  promoter: { label: "Promoter", color: "#FFD23F" },
};

export function RankEditor({ userId, role, extraRanks, isModerator, canEdit, canSetModerator }: {
  userId: string; role: string; extraRanks: string[]; isModerator: boolean; canEdit: boolean; canSetModerator: boolean;
}) {
  const [extras, setExtras] = useState<string[]>(extraRanks);
  const [mod, setMod] = useState(isModerator);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const archon = role === "archon";
  const shown = archon ? [] : extras.filter((r) => r !== role);
  if (!canEdit && !shown.length && !mod && !archon) return null;

  async function save(body: Record<string, unknown>, after: () => void) {
    setBusy(true); setMsg("");
    const r = await fetch("/api/ranks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId, ...body }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setMsg(j.error || "Couldn't save."); return; }
    after();
    setMsg(j.referral_code ? `Saved. Promoter code: ${j.referral_code}` : "Saved.");
  }
  function toggle(rank: string) {
    const next = extras.includes(rank) ? extras.filter((x) => x !== rank) : [...extras, rank];
    save({ extraRanks: next }, () => setExtras(next));
  }

  return (
    <div className="mb-6 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
      <p className="font-dm-mono text-[11px] uppercase tracking-widest text-neutral-500">
        {archon ? "Archon — holds every rank's abilities" : "Also holds"}{mod ? " · Moderator" : ""}
      </p>
      {!archon && (
        <div className="mt-2 flex flex-wrap gap-2">
          {(canEdit ? (EXTRA_RANKS as readonly string[]).filter((r) => r !== role) : shown).map((r) => {
            const on = extras.includes(r);
            const c = LABEL[r] ?? { label: r, color: "#A8A8A8" };
            return canEdit ? (
              <button key={r} type="button" disabled={busy} onClick={() => toggle(r)}
                className="rounded-full border px-3 py-1 text-xs font-semibold transition disabled:opacity-50"
                style={{ borderColor: on ? c.color : "rgba(255,255,255,0.12)", color: on ? c.color : "#777", background: on ? `${c.color}14` : "transparent" }}>
                {on ? "✓ " : "+ "}{c.label}
              </button>
            ) : (
              <span key={r} className="rounded-full border px-3 py-1 text-xs font-semibold" style={{ borderColor: c.color, color: c.color }}>{c.label}</span>
            );
          })}
        </div>
      )}
      {canSetModerator && (
        <button type="button" disabled={busy} onClick={() => save({ moderator: !mod }, () => setMod(!mod))}
          className="mt-3 rounded-lg border border-white/15 px-3 py-1 text-xs text-neutral-300 hover:bg-white/5 disabled:opacity-50">
          {mod ? "Remove Moderator" : "Make Moderator"} <span className="text-neutral-500">(can add Wanderer, Merchant, Promoter to non-admins)</span>
        </button>
      )}
      {msg && <p className="mt-2 text-xs text-neutral-400">{msg}</p>}
    </div>
  );
}
