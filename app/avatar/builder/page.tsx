"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { AvatarBorder } from "@/app/components/AvatarBorder";
import {
  ITEMS, SLOTS, SLOT_LABELS, DEFAULT_CONFIG, ITEM_BY_ID,
  avatarDataUri, normalizeConfig, type Slot,
} from "@/app/avatar/catalog";

export default function AvatarBuilderPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<Record<Slot, string>>(DEFAULT_CONFIG);
  const [owned, setOwned] = useState<Set<string>>(new Set());
  const [balanceCents, setBalanceCents] = useState(0);
  const [border, setBorder] = useState("moss");
  const [activeSlot, setActiveSlot] = useState<Slot>("hat");
  const [buying, setBuying] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      setUserId(user.id);

      const [{ data: profile }, { data: items }, balRes] = await Promise.all([
        supabase.from("user_profiles").select("avatar_config, avatar_border").eq("id", user.id).maybeSingle(),
        supabase.from("user_avatar_items").select("item_id").eq("user_id", user.id),
        fetch("/api/store-credit").then((r) => (r.ok ? r.json() : { balanceCents: 0 })).catch(() => ({ balanceCents: 0 })),
      ]);

      if (profile?.avatar_config) setConfig(normalizeConfig(profile.avatar_config));
      if (profile?.avatar_border) setBorder(profile.avatar_border);
      setOwned(new Set((items ?? []).map((r) => r.item_id as string)));
      setBalanceCents(balRes?.balanceCents ?? 0);
      setLoading(false);
    })();
  }, [supabase, router]);

  const ownsOrFree = (id: string) =>
    (ITEM_BY_ID[id]?.priceCents ?? 0) === 0 || owned.has(id);

  function select(slot: Slot, id: string) {
    if (!ownsOrFree(id)) return;
    setConfig((c) => ({ ...c, [slot]: id }));
  }

  async function buy(id: string) {
    setBuying(id);
    setError("");
    const res = await fetch("/api/avatar/purchase", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId: id }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json.error ?? "Purchase failed.");
    } else {
      setOwned((o) => new Set(o).add(id));
      if (typeof json.balanceCents === "number") setBalanceCents(json.balanceCents);
      const slot = ITEM_BY_ID[id].slot;
      setConfig((c) => ({ ...c, [slot]: id }));
    }
    setBuying(null);
  }

  async function save() {
    if (!userId) return;
    setSaving(true);
    setError("");
    const { error: upErr } = await supabase
      .from("user_profiles")
      .upsert({ id: userId, avatar_config: config, avatar_url: avatarDataUri(config) });
    setSaving(false);
    if (upErr) { setError(upErr.message); return; }
    setSaved(true);
    setTimeout(() => router.push(`/profile/${userId}`), 900);
  }

  if (loading) {
    return <main className="flex min-h-screen items-center justify-center font-dm-mono text-sm text-neutral-500">Loading…</main>;
  }

  const slotItems = ITEMS.filter((i) => i.slot === activeSlot);

  return (
    <main className="min-h-screen text-neutral-100">
      <div className="mx-auto max-w-4xl px-6 py-12">
        <p className="mb-2 font-dm-mono text-sm uppercase tracking-[0.3em] text-[#3AFFD4]">Profile</p>
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <h1 className="font-bebas text-5xl tracking-wide">Avatar Builder</h1>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2">
            <span className="font-dm-mono text-xs uppercase tracking-widest text-neutral-500">Store credit </span>
            <span className="font-bebas text-2xl text-[#39FF14]">${(balanceCents / 100).toFixed(2)}</span>
          </div>
        </div>

        <div className="grid gap-8 md:grid-cols-[260px_1fr]">
          {/* Preview */}
          <div className="flex flex-col items-center">
            <div className="sticky top-24 flex flex-col items-center gap-4">
              <AvatarBorder border={border} size={200}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={avatarDataUri(config)} alt="Avatar preview" style={{ width: 200, height: 200 }} className="rounded-full" />
              </AvatarBorder>
              <button
                onClick={save}
                disabled={saving || saved}
                className="w-full rounded-xl bg-[#39FF14] px-6 py-3 text-sm font-semibold text-black transition hover:opacity-90 disabled:opacity-50"
              >
                {saved ? "Saved! Redirecting…" : saving ? "Saving…" : "Save Avatar"}
              </button>
              <button
                onClick={() => router.push("/profile/edit")}
                className="w-full rounded-xl border border-white/10 px-6 py-2.5 text-sm text-neutral-400 transition hover:text-white"
              >
                Back to Profile
              </button>
              {error && <p className="text-center text-sm text-[#FF5C3A]">{error}</p>}
            </div>
          </div>

          {/* Picker */}
          <div>
            <div className="mb-5 flex flex-wrap gap-2">
              {SLOTS.map((slot) => (
                <button
                  key={slot}
                  onClick={() => setActiveSlot(slot)}
                  className={`rounded-full px-4 py-1.5 font-dm-mono text-xs uppercase tracking-widest transition ${
                    activeSlot === slot
                      ? "bg-[#3AFFD4]/15 text-[#3AFFD4] ring-1 ring-[#3AFFD4]/40"
                      : "border border-white/10 text-neutral-400 hover:bg-white/5"
                  }`}
                >
                  {SLOT_LABELS[slot]}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {slotItems.map((item) => {
                const selected = config[item.slot] === item.id;
                const locked = item.priceCents > 0 && !owned.has(item.id);
                const previewCfg = { ...config, [item.slot]: item.id };
                return (
                  <div
                    key={item.id}
                    className={`rounded-2xl border p-3 transition ${
                      selected ? "border-[#39FF14]/50 bg-[#39FF14]/[0.06]" : "border-white/10 bg-white/[0.02]"
                    }`}
                  >
                    <button
                      onClick={() => select(item.slot, item.id)}
                      disabled={locked}
                      className="block w-full"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={avatarDataUri(previewCfg)}
                        alt={item.name}
                        className={`mx-auto rounded-full ${locked ? "opacity-50" : ""}`}
                        style={{ width: 88, height: 88 }}
                      />
                    </button>
                    <div className="mt-2 flex items-center justify-between gap-1">
                      <span className="truncate text-sm text-neutral-300">{item.name}</span>
                      {item.priceCents === 0 ? (
                        <span className="font-dm-mono text-[10px] uppercase text-neutral-600">free</span>
                      ) : owned.has(item.id) ? (
                        <span className="font-dm-mono text-[10px] uppercase text-[#3AFFD4]">owned</span>
                      ) : null}
                    </div>
                    {locked && (
                      <button
                        onClick={() => buy(item.id)}
                        disabled={buying === item.id || balanceCents < item.priceCents}
                        className="mt-2 w-full rounded-lg bg-[#39FF14] px-2 py-1.5 text-xs font-semibold text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                        title={balanceCents < item.priceCents ? "Not enough store credit" : undefined}
                      >
                        {buying === item.id ? "…" : `Unlock · $${(item.priceCents / 100).toFixed(2)}`}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <p className="mt-6 font-dm-mono text-[11px] text-neutral-600">
              Earn store credit by referring friends, then spend it here on premium parts.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
