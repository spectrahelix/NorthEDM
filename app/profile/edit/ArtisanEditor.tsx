"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import type { UserProfile, ArtisanWork, Social } from "@/utils/supabase/user-profiles";

const CRAFTS = [
  "Visual Art",
  "Music",
  "Crafts",
  "DIY / Maker",
  "Photography",
  "Jewelry",
  "Woodwork",
  "Textiles / Fashion",
  "Digital Art",
  "Culinary",
  "Other",
];

const GOLD = "#FFC93C";

export function ArtisanEditor({ userId, profile }: { userId: string; profile: UserProfile }) {
  const supabase = createClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [stageName, setStageName] = useState(profile.stage_name || "");
  const [craft, setCraft] = useState(profile.artisan_craft || "");
  const [statement, setStatement] = useState(profile.artisan_statement || "");
  const [socials, setSocials] = useState<Social[]>(
    Array.isArray(profile.socials) ? profile.socials : []
  );
  const [status, setStatus] = useState(profile.artisan_status || "none");
  const isVerified = !!profile.is_artisan;

  const [works, setWorks] = useState<ArtisanWork[]>([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  // New-work form
  const [newKind, setNewKind] = useState<"image" | "embed" | "link">("image");
  const [newUrl, setNewUrl] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    supabase
      .from("artisan_works")
      .select("*")
      .eq("user_id", userId)
      .order("sort", { ascending: true })
      .order("created_at", { ascending: false })
      .then(({ data }) => setWorks((data ?? []) as ArtisanWork[]));
  }, [supabase, userId]);

  function updateSocial(i: number, field: keyof Social, value: string) {
    setSocials((s) => s.map((row, idx) => (idx === i ? { ...row, [field]: value } : row)));
  }

  async function saveDetails(apply: boolean) {
    setSaving(true);
    setErr("");
    setMsg("");
    const cleanSocials = socials
      .map((s) => ({ label: s.label.trim(), url: s.url.trim() }))
      .filter((s) => s.url);
    // If applying, move status to pending (unless already verified).
    const nextStatus = isVerified ? "approved" : apply ? "pending" : status;
    const { error } = await supabase
      .from("user_profiles")
      .update({
        stage_name: stageName.trim() || null,
        artisan_craft: craft || null,
        artisan_statement: statement.trim() || null,
        socials: cleanSocials,
        artisan_status: nextStatus,
      })
      .eq("id", userId);
    setSaving(false);
    if (error) {
      setErr(error.message);
      return;
    }
    setStatus(nextStatus);
    setMsg(apply ? "Application submitted — pending review." : "Saved.");
    setTimeout(() => setMsg(""), 3000);
  }

  async function addImageWork(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      setErr("Image must be under 8MB.");
      return;
    }
    setUploading(true);
    setErr("");
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("artisan-works")
      .upload(path, file, { contentType: file.type || "image/jpeg", upsert: false });
    if (upErr) {
      setErr(`Upload failed: ${upErr.message}`);
      setUploading(false);
      return;
    }
    const { data: pub } = supabase.storage.from("artisan-works").getPublicUrl(path);
    const { data, error } = await supabase
      .from("artisan_works")
      .insert({
        user_id: userId,
        kind: "image",
        image_url: pub.publicUrl,
        title: newTitle.trim() || null,
        sort: works.length,
      })
      .select()
      .single();
    setUploading(false);
    if (error) {
      setErr(error.message);
      return;
    }
    setWorks((w) => [...w, data as ArtisanWork]);
    setNewTitle("");
    if (fileRef.current) fileRef.current.value = "";
  }

  async function addUrlWork() {
    if (!newUrl.trim()) return;
    setErr("");
    const { data, error } = await supabase
      .from("artisan_works")
      .insert({
        user_id: userId,
        kind: newKind,
        url: newUrl.trim(),
        title: newTitle.trim() || null,
        sort: works.length,
      })
      .select()
      .single();
    if (error) {
      setErr(error.message);
      return;
    }
    setWorks((w) => [...w, data as ArtisanWork]);
    setNewUrl("");
    setNewTitle("");
  }

  async function deleteWork(id: number) {
    setWorks((w) => w.filter((x) => x.id !== id));
    await supabase.from("artisan_works").delete().eq("id", id);
  }

  return (
    <section
      id="artisan"
      className="mt-10 scroll-mt-24 rounded-2xl border p-6"
      style={{ borderColor: `${GOLD}33`, background: `${GOLD}08` }}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="font-dm-mono text-xs uppercase tracking-[0.3em]" style={{ color: GOLD }}>
          ◈ Artisan Profile
        </p>
        {isVerified ? (
          <span className="rounded-full px-3 py-1 font-dm-mono text-[10px] uppercase tracking-widest" style={{ color: GOLD, background: `${GOLD}14`, border: `1px solid ${GOLD}55` }}>
            Verified ✓
          </span>
        ) : status === "pending" ? (
          <span className="rounded-full border border-white/15 px-3 py-1 font-dm-mono text-[10px] uppercase tracking-widest text-neutral-400">
            Pending review
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-sm text-neutral-400">
        Are you a maker — visual art, music, crafts, DIY? Fill this out and apply to get the
        verified Artisan tag and a spot in the Artisans directory.
      </p>

      {/* Stage name + craft */}
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block font-dm-mono text-xs uppercase tracking-widest text-neutral-500">
            Stage / Artist Name
          </label>
          <input
            value={stageName}
            onChange={(e) => setStageName(e.target.value)}
            maxLength={60}
            placeholder="How you're known as a maker"
            className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-neutral-100 placeholder:text-neutral-600 focus:outline-none"
            style={{ borderColor: `${GOLD}22` }}
          />
        </div>
        <div>
          <label className="mb-1.5 block font-dm-mono text-xs uppercase tracking-widest text-neutral-500">
            Craft
          </label>
          <select
            value={craft}
            onChange={(e) => setCraft(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-[#0c0c0e] px-4 py-3 text-sm text-neutral-100 focus:outline-none"
            style={{ borderColor: `${GOLD}22` }}
          >
            <option value="">Select a craft…</option>
            {CRAFTS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Statement */}
      <div className="mt-4">
        <label className="mb-1.5 block font-dm-mono text-xs uppercase tracking-widest text-neutral-500">
          About your craft
          <span className="ml-2 normal-case tracking-normal text-neutral-700">{statement.length}/1500</span>
        </label>
        <textarea
          value={statement}
          onChange={(e) => setStatement(e.target.value.slice(0, 1500))}
          rows={5}
          placeholder="Your story, your medium, what you make, where people can find or commission you…"
          className="w-full resize-none rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-neutral-100 placeholder:text-neutral-600 focus:outline-none"
          style={{ borderColor: `${GOLD}22` }}
        />
      </div>

      {/* Socials */}
      <div className="mt-4">
        <label className="mb-1.5 block font-dm-mono text-xs uppercase tracking-widest text-neutral-500">
          Links (Instagram, Etsy, Bandcamp, shop…)
        </label>
        <div className="space-y-2">
          {socials.map((s, i) => (
            <div key={i} className="flex gap-2">
              <input
                value={s.label}
                onChange={(e) => updateSocial(i, "label", e.target.value)}
                placeholder="Label"
                className="w-1/3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-600 focus:outline-none"
              />
              <input
                value={s.url}
                onChange={(e) => updateSocial(i, "url", e.target.value)}
                placeholder="https://…"
                className="flex-1 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-600 focus:outline-none"
              />
              <button
                onClick={() => setSocials((arr) => arr.filter((_, idx) => idx !== i))}
                className="rounded-xl border border-white/10 px-3 text-neutral-500 transition hover:text-[#FF5C3A]"
              >
                ✕
              </button>
            </div>
          ))}
          {socials.length < 8 && (
            <button
              onClick={() => setSocials((arr) => [...arr, { label: "", url: "" }])}
              className="rounded-xl border border-dashed border-white/15 px-3 py-2 text-sm text-neutral-400 transition hover:text-white"
            >
              + Add link
            </button>
          )}
        </div>
      </div>

      {/* Works manager */}
      <div className="mt-6 border-t border-white/10 pt-5">
        <p className="font-dm-mono text-xs uppercase tracking-widest text-neutral-500">
          Portfolio · preview your work
        </p>

        {works.length > 0 && (
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {works.map((w) => (
              <div key={w.id} className="group relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
                {w.kind === "image" && w.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={w.image_url} alt={w.title || ""} className="aspect-square w-full object-cover" />
                ) : (
                  <div className="flex aspect-square w-full flex-col items-center justify-center gap-1 p-3 text-center">
                    <span className="text-2xl">{w.kind === "embed" ? "▶" : "🔗"}</span>
                    <span className="break-all font-dm-mono text-[10px] text-neutral-500">
                      {w.title || w.url}
                    </span>
                  </div>
                )}
                <button
                  onClick={() => deleteWork(w.id)}
                  className="absolute right-1.5 top-1.5 rounded-full bg-black/70 px-2 py-0.5 text-xs text-white opacity-0 transition group-hover:opacity-100"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add work */}
        <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.02] p-4">
          <div className="mb-3 flex gap-2">
            {(["image", "embed", "link"] as const).map((k) => (
              <button
                key={k}
                onClick={() => setNewKind(k)}
                className={`rounded-full border px-3 py-1 text-xs capitalize transition ${
                  newKind === k
                    ? "border-[#FFC93C] bg-[#FFC93C]/10 text-white"
                    : "border-white/10 text-neutral-400 hover:bg-white/5"
                }`}
              >
                {k === "embed" ? "Music/Video" : k}
              </button>
            ))}
          </div>

          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            maxLength={80}
            placeholder="Title (optional)"
            className="mb-2 w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-600 focus:outline-none"
          />

          {newKind === "image" ? (
            <>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={addImageWork} />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="rounded-xl border border-white/10 px-4 py-2 text-sm text-neutral-300 transition hover:bg-white/5 disabled:opacity-50"
              >
                {uploading ? "Uploading…" : "Upload image"}
              </button>
            </>
          ) : (
            <div className="flex gap-2">
              <input
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                placeholder={newKind === "embed" ? "YouTube / SoundCloud / Spotify / Vimeo URL" : "https://…"}
                className="flex-1 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-600 focus:outline-none"
              />
              <button
                onClick={addUrlWork}
                className="rounded-xl bg-[#FFC93C] px-4 py-2 text-sm font-semibold text-black transition hover:opacity-90"
              >
                Add
              </button>
            </div>
          )}
        </div>
      </div>

      {err && <p className="mt-4 text-sm text-[#FF5C3A]">{err}</p>}
      {msg && <p className="mt-4 text-sm" style={{ color: GOLD }}>{msg}</p>}

      <div className="mt-5 flex flex-wrap justify-end gap-3">
        <button
          onClick={() => saveDetails(false)}
          disabled={saving}
          className="rounded-xl border border-white/10 px-5 py-2.5 text-sm text-neutral-300 transition hover:bg-white/5 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save Artisan Info"}
        </button>
        {!isVerified && status !== "pending" && (
          <button
            onClick={() => saveDetails(true)}
            disabled={saving || !stageName.trim() || !craft}
            className="rounded-xl px-6 py-2.5 text-sm font-semibold text-black transition hover:opacity-90 disabled:opacity-40"
            style={{ background: GOLD }}
            title={!stageName.trim() || !craft ? "Add a stage name and craft first" : ""}
          >
            Apply for Verification
          </button>
        )}
      </div>
    </section>
  );
}
