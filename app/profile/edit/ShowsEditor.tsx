"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { currentShow, type VendorShow } from "@/utils/supabase/user-profiles";

const GOLD = "#00D4FF";

// Normalize a date string to YYYY-MM-DD (accepts YYYY-MM-DD or M/D/YYYY).
function normDate(s: string): string | null {
  const t = s.trim();
  if (!t) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  const d = new Date(t);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

export function ShowsEditor({ userId, initialHideShows }: { userId: string; initialHideShows: boolean }) {
  const supabase = createClient();
  const [shows, setShows] = useState<VendorShow[]>([]);
  const [hide, setHide] = useState(initialHideShows);
  const [form, setForm] = useState({ festival_name: "", location: "", start_date: "", end_date: "" });
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase
      .from("vendor_shows")
      .select("*")
      .eq("user_id", userId)
      .order("start_date", { ascending: true })
      .then(({ data }) => setShows((data ?? []) as VendorShow[]));
  }, [supabase, userId]);

  async function addShow() {
    setErr(""); setMsg("");
    if (!form.festival_name.trim()) { setErr("Festival/event name is required."); return; }
    const { data, error } = await supabase.from("vendor_shows").insert({
      user_id: userId,
      festival_name: form.festival_name.trim(),
      location: form.location.trim() || null,
      start_date: normDate(form.start_date),
      end_date: normDate(form.end_date),
    }).select().single();
    if (error) { setErr(error.message); return; }
    setShows((s) => [...s, data as VendorShow].sort((a, b) => ((a.start_date || "9") < (b.start_date || "9") ? -1 : 1)));
    setForm({ festival_name: "", location: "", start_date: "", end_date: "" });
  }

  async function del(id: number) {
    setShows((s) => s.filter((x) => x.id !== id));
    await supabase.from("vendor_shows").delete().eq("id", id);
  }

  async function importCsv(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr(""); setMsg("");
    const text = await file.text();
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length && /festival|event|name/i.test(lines[0]) && /location|date/i.test(lines[0])) lines.shift();
    const rows: { user_id: string; festival_name: string; location: string | null; start_date: string | null; end_date: string | null }[] = [];
    let skipped = 0;
    for (const line of lines) {
      const cols = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
      const festival = cols[0];
      if (!festival) { skipped++; continue; }
      rows.push({
        user_id: userId,
        festival_name: festival.slice(0, 160),
        location: (cols[1] || "").slice(0, 200) || null,
        start_date: normDate(cols[2] || ""),
        end_date: normDate(cols[3] || ""),
      });
    }
    if (fileRef.current) fileRef.current.value = "";
    if (rows.length === 0) { setErr("No valid rows found. Use: Festival, Location, Start date, End date."); return; }
    const { data, error } = await supabase.from("vendor_shows").insert(rows).select();
    if (error) { setErr(error.message); return; }
    setShows((s) => [...s, ...((data ?? []) as VendorShow[])].sort((a, b) => ((a.start_date || "9") < (b.start_date || "9") ? -1 : 1)));
    setMsg(`Added ${data?.length ?? 0} show${(data?.length ?? 0) === 1 ? "" : "s"}${skipped ? `, skipped ${skipped}` : ""}.`);
  }

  async function toggleHide() {
    const next = !hide;
    setHide(next);
    await supabase.from("user_profiles").update({ hide_shows: next }).eq("id", userId);
  }

  const cur = currentShow(shows);

  return (
    <section className="rounded-2xl border p-5" style={{ borderColor: `${GOLD}33`, background: `${GOLD}08` }}>
      <p className="font-dm-mono text-xs uppercase tracking-[0.2em]" style={{ color: GOLD }}>▣ Upcoming Shows</p>
      <p className="mt-1 mb-4 text-xs text-neutral-500">
        Where you&apos;ll be set up. Your current/next show shows on your marketplace &amp; FestDash
        listings so customers can find you.
        {cur && (
          <span className="ml-1 text-neutral-300">
            {cur.live ? "🟢 Live now" : "Next"}: <b>{cur.show.festival_name}</b>
            {cur.show.location ? ` — ${cur.show.location}` : ""}.
          </span>
        )}
      </p>

      {/* Existing shows */}
      {shows.length > 0 && (
        <div className="mb-4 space-y-2">
          {shows.map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2">
              <div className="min-w-0 text-sm">
                <span className="font-semibold text-neutral-100">{s.festival_name}</span>
                {s.location && <span className="text-neutral-500"> · {s.location}</span>}
                {(s.start_date || s.end_date) && (
                  <span className="ml-1 font-dm-mono text-xs text-neutral-600">
                    {s.start_date || "?"}{s.end_date && s.end_date !== s.start_date ? `→${s.end_date}` : ""}
                  </span>
                )}
              </div>
              <button onClick={() => del(s.id)} className="font-dm-mono text-[10px] uppercase tracking-widest text-neutral-600 hover:text-[#FF5C3A]">Remove</button>
            </div>
          ))}
        </div>
      )}

      {/* Add form */}
      <div className="grid gap-2 sm:grid-cols-2">
        <input value={form.festival_name} onChange={(e) => setForm({ ...form, festival_name: e.target.value })} placeholder="Festival / event *"
          className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-600 focus:outline-none" />
        <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Location (e.g. Scranton, PA)"
          className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-600 focus:outline-none" />
        <input value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} placeholder="Start (YYYY-MM-DD)"
          className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-600 focus:outline-none" />
        <input value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} placeholder="End (YYYY-MM-DD)"
          className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-600 focus:outline-none" />
      </div>

      {err && <p className="mt-2 text-sm text-[#FF5C3A]">{err}</p>}
      {msg && <p className="mt-2 text-sm" style={{ color: GOLD }}>{msg}</p>}

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="button" onClick={addShow}
          className="rounded-xl px-5 py-2 text-sm font-semibold text-black transition hover:opacity-90" style={{ background: GOLD }}>
          + Add show
        </button>
        <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={importCsv} />
        <button type="button" onClick={() => fileRef.current?.click()}
          className="rounded-xl border border-white/10 px-4 py-2 text-sm text-neutral-300 transition hover:bg-white/5">
          Upload CSV
        </button>
        <span className="font-dm-mono text-[10px] text-neutral-600">CSV: Festival, Location, Start, End</span>
      </div>

      <label className="mt-4 flex items-center gap-2 text-sm text-neutral-300">
        <input type="checkbox" checked={hide} onChange={toggleHide} />
        Toggle to HIDE your upcoming shows from your listings.
      </label>
    </section>
  );
}
