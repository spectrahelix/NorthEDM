"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { AvatarBorder } from "@/app/components/AvatarBorder";
import {
  ITEMS, SLOTS, SLOT_LABELS, SLOT_COLOR, COLOR_OPTIONS, ITEM_BY_ID,
  avatarDataUri, normalizeConfig, type AvatarConfig, type Slot, type ColorSlot,
} from "@/app/avatar/catalog";

const GROUPS: { label: string; slots: Slot[] }[] = [
  { label: "Face", slots: ["face", "eyes", "brows", "nose", "mouth", "extras"] },
  { label: "Hair", slots: ["hair", "facial"] },
  { label: "Style", slots: ["hat", "glasses", "earrings", "neck", "top", "background"] },
];

export default function AvatarBuilderPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<AvatarConfig>(() => normalizeConfig(null));
  const [owned, setOwned] = useState<Set<string>>(new Set());
  const [balanceCents, setBalanceCents] = useState(0);
  const [border, setBorder] = useState("moss");
  const [slot, setSlot] = useState<Slot>("face");
  const [buying, setBuying] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/signup"); return; }
      setUserId(user.id);
      const [{ data: profile }, { data: items }, balRes] = await Promise.all([
        supabase.from("user_profiles").select("avatar_config, avatar_border").eq("id", user.id).maybeSingle(),
        supabase.from("user_avatar_items").select("item_id").eq("user_id", user.id),
        fetch("/api/store-credit").then((r) => (r.ok ? r.json() : { balanceCents: 0 })).catch(() => ({ balanceCents: 0 })),
      ]);
      setConfig(normalizeConfig(profile?.avatar_config));
      if (profile?.avatar_border) setBorder(profile.avatar_border);
      setOwned(new Set((items ?? []).map((r) => r.item_id as string)));
      setBalanceCents(balRes?.balanceCents ?? 0);
      setLoading(false);
    })();
  }, [supabase, router]);

  const ownsOrFree = (id: string) => (ITEM_BY_ID[id]?.priceCents ?? 0) === 0 || owned.has(id);
  const pick = (s: Slot, id: string) => { if (ownsOrFree(id)) setConfig((c) => ({ ...c, parts: { ...c.parts, [s]: id } })); };
  const pickColor = (k: ColorSlot, id: string) => setConfig((c) => ({ ...c, colors: { ...c.colors, [k]: id } }));

  async function buy(id: string) {
    setBuying(id); setError("");
    const res = await fetch("/api/avatar/purchase", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ itemId: id }) });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) setError(json.error ?? "Purchase failed.");
    else {
      setOwned((o) => new Set(o).add(id));
      if (typeof json.balanceCents === "number") setBalanceCents(json.balanceCents);
      setConfig((c) => ({ ...c, parts: { ...c.parts, [ITEM_BY_ID[id].slot]: id } }));
    }
    setBuying(null);
  }

  function randomize() {
    const parts = { ...config.parts };
    for (const s of SLOTS) {
      const pool = ITEMS.filter((i) => i.slot === s && ownsOrFree(i.id));
      parts[s] = pool[Math.floor(Math.random() * pool.length)].id;
    }
    const colors = { ...config.colors };
    for (const k of Object.keys(colors) as ColorSlot[]) { const opts = COLOR_OPTIONS[k]; colors[k] = opts[Math.floor(Math.random() * opts.length)].id; }
    setConfig({ v: 2, parts, colors });
  }

  async function save() {
    if (!userId) return;
    setSaving(true); setError("");
    const { error: upErr } = await supabase.from("user_profiles").upsert({ id: userId, avatar_config: config, avatar_url: avatarDataUri(config) });
    setSaving(false);
    if (upErr) { setError(upErr.message); return; }
    setSaved(true);
    setTimeout(() => router.push(`/profile/${userId}`), 900);
  }

  if (loading) return <main className="flex min-h-screen items-center justify-center font-dm-mono text-sm text-neutral-500">Loading…</main>;

  const items = ITEMS.filter((i) => i.slot === slot);
  const colorKey = SLOT_COLOR[slot];
  const preview = avatarDataUri(config);

  return (
    <main className="min-h-screen text-neutral-100">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="mb-1 font-dm-mono text-xs uppercase tracking-[0.3em] text-[#3AFFD4]">Profile</p>
            <h1 className="font-bebas text-4xl tracking-wide sm:text-5xl">Avatar Builder</h1>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2">
            <span className="font-dm-mono text-[11px] uppercase tracking-widest text-neutral-500">Store credit </span>
            <span className="font-bebas text-xl text-[#39FF14]">${(balanceCents / 100).toFixed(2)}</span>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-[280px_1fr]">
          {/* Preview — sticky on desktop, a compact bar on phones */}
          <div className="md:sticky md:top-24 md:self-start">
            <div className="flex items-center gap-4 rounded-3xl border border-white/10 bg-white/[0.03] p-4 md:flex-col md:p-6">
              <AvatarBorder border={border} size={120}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={preview} alt="Avatar preview" style={{ width: 120, height: 120 }} className="rounded-full" />
              </AvatarBorder>
              <div className="flex flex-1 flex-col gap-2 md:w-full">
                <button onClick={save} disabled={saving || saved} className="w-full rounded-xl bg-[#39FF14] px-4 py-2.5 text-sm font-semibold text-black transition hover:opacity-90 disabled:opacity-50">
                  {saved ? "Saved!" : saving ? "Saving…" : "Save avatar"}
                </button>
                <div className="flex gap-2">
                  <button onClick={randomize} className="flex-1 rounded-xl border border-white/10 px-3 py-2 text-xs text-neutral-300 transition hover:bg-white/5">🎲 Shuffle</button>
                  <button onClick={() => router.push("/profile/edit")} className="flex-1 rounded-xl border border-white/10 px-3 py-2 text-xs text-neutral-400 transition hover:text-white">Back</button>
                </div>
                {error && <p className="text-xs text-[#FF5C3A]">{error}</p>}
              </div>
            </div>
          </div>

          {/* Picker */}
          <div className="min-w-0">
            {GROUPS.map((g) => (
              <div key={g.label} className="mb-3">
                <p className="mb-1.5 font-dm-mono text-[10px] uppercase tracking-[0.25em] text-neutral-600">{g.label}</p>
                <div className="flex flex-wrap gap-1.5">
                  {g.slots.map((s) => (
                    <button key={s} onClick={() => setSlot(s)}
                      className={`rounded-full px-3 py-1.5 font-dm-mono text-[11px] uppercase tracking-widest transition ${slot === s ? "bg-[#3AFFD4]/15 text-[#3AFFD4] ring-1 ring-[#3AFFD4]/40" : "border border-white/10 text-neutral-400 hover:bg-white/5"}`}>
                      {SLOT_LABELS[s]}
                    </button>
                  ))}
                </div>
              </div>
            ))}

            {colorKey && (
              <div className="mb-4 mt-5">
                <p className="mb-2 font-dm-mono text-[11px] uppercase tracking-widest text-neutral-500">
                  {colorKey === "skin" ? "Skin tone" : colorKey === "eyes" ? "Eye colour" : colorKey === "hair" ? "Hair colour" : colorKey === "top" ? "Colour" : colorKey === "hat" ? "Colour" : "Lip colour"}
                </p>
                <div className="flex flex-wrap gap-2">
                  {COLOR_OPTIONS[colorKey].map((c) => {
                    const active = config.colors[colorKey] === c.id;
                    return (
                      <button key={c.id} title={c.name} onClick={() => pickColor(colorKey, c.id)}
                        className={`h-8 w-8 rounded-full border-2 transition ${active ? "border-[#3AFFD4] scale-110" : "border-white/15 hover:border-white/40"}`}
                        style={{ background: c.hex || "linear-gradient(135deg,#e8c4a0,#8a5235)" }} aria-label={c.name} />
                    );
                  })}
                </div>
              </div>
            )}

            <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5">
              {items.map((item) => {
                const selected = config.parts[slot] === item.id;
                const locked = item.priceCents > 0 && !owned.has(item.id);
                const thumb = avatarDataUri({ ...config, parts: { ...config.parts, [slot]: item.id } });
                return (
                  <div key={item.id} className={`rounded-2xl border p-2 transition ${selected ? "border-[#39FF14]/60 bg-[#39FF14]/[0.06]" : "border-white/10 bg-white/[0.02]"}`}>
                    <button onClick={() => pick(slot, item.id)} disabled={locked} className="block w-full" title={item.name}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={thumb} alt={item.name} className={`mx-auto aspect-square w-full rounded-xl ${locked ? "opacity-50" : ""}`} />
                    </button>
                    <p className="mt-1.5 truncate text-center text-[11px] text-neutral-300">{item.name}</p>
                    {item.priceCents > 0 && (
                      locked ? (
                        <button onClick={() => buy(item.id)} disabled={buying === item.id || balanceCents < item.priceCents}
                          className="mt-1 w-full rounded-lg bg-[#39FF14] px-1 py-1 text-[10px] font-semibold text-black disabled:cursor-not-allowed disabled:opacity-40"
                          title={balanceCents < item.priceCents ? "Not enough store credit" : undefined}>
                          {buying === item.id ? "…" : `Unlock $${(item.priceCents / 100).toFixed(2)}`}
                        </button>
                      ) : <p className="text-center font-dm-mono text-[9px] uppercase text-[#3AFFD4]">owned</p>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="mt-6 font-dm-mono text-[11px] text-neutral-600">Earn store credit by referring friends, then spend it on premium pieces.</p>
          </div>
        </div>
      </div>
    </main>
  );
}
