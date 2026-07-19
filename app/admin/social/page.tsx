"use client";

import { useEffect, useState } from "react";

type Account = { id: string; platform: string; label: string | null; url: string; active: boolean };
type Connector = { key: string; label: string; configured: boolean; note: string };
type Result = { platform: string; ok: boolean; detail: string };
type Post = { id: string; text: string; image_url: string | null; results: Result[]; created_at: string };

export default function AdminSocialPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [forbidden, setForbidden] = useState(false);
  const [loading, setLoading] = useState(true);

  const [text, setText] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [sending, setSending] = useState(false);
  const [results, setResults] = useState<Result[] | null>(null);
  const [msg, setMsg] = useState("");

  const [platform, setPlatform] = useState("instagram");
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");

  async function load() {
    const res = await fetch("/api/admin/social");
    if (res.status === 401 || res.status === 403) { setForbidden(true); setLoading(false); return; }
    const j = await res.json().catch(() => ({}));
    setAccounts(j.accounts ?? []);
    setConnectors(j.connectors ?? []);
    setPosts(j.posts ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function broadcast() {
    if (!text.trim()) { setMsg("Write something first."); return; }
    setSending(true); setMsg(""); setResults(null);
    const res = await fetch("/api/social/broadcast", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ text, imageUrl: imageUrl || undefined }),
    });
    const j = await res.json().catch(() => ({}));
    setSending(false);
    if (!res.ok) { setMsg(j.error || "Broadcast failed."); return; }
    setResults(j.results ?? []);
    setText(""); setImageUrl("");
    load();
  }

  async function accountAction(body: Record<string, unknown>) {
    await fetch("/api/admin/social", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    load();
  }

  const anyConfigured = connectors.some((c) => c.configured);

  if (loading) return <main className="flex min-h-screen items-center justify-center admin-surface"><p className="font-dm-mono text-sm text-neutral-500">Loading…</p></main>;
  if (forbidden) return <main className="flex min-h-screen items-center justify-center admin-surface text-neutral-400">Forbidden.</main>;

  return (
    <main className="min-h-screen px-6 py-16 text-neutral-100 admin-surface">
      <div className="mx-auto max-w-3xl">
        <p className="font-dm-mono text-sm uppercase tracking-[0.3em] text-[#CC00FF]">Admin · Social</p>
        <h1 className="mt-3 font-bebas text-5xl tracking-wide">Post &amp; Presence</h1>
        <p className="mt-2 max-w-2xl text-sm text-neutral-500">
          Write once, broadcast to every connected channel, and manage the accounts shown on your{" "}
          <a href="/social" target="_blank" rel="noopener noreferrer" className="text-[#3AFFD4] hover:underline">/social</a> hub.
        </p>

        {/* Composer */}
        <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
          <p className="mb-3 font-dm-mono text-xs uppercase tracking-widest text-neutral-500">Broadcast a post</p>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} placeholder="What's happening? This goes out to every connected channel…"
            className="w-full resize-none rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-[#CC00FF]/40 focus:outline-none" />
          <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="Image URL (optional)"
            className="mt-3 w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-neutral-100 placeholder:text-neutral-600 focus:outline-none" />

          {/* Where it goes */}
          <div className="mt-3 flex flex-wrap gap-2">
            {connectors.map((c) => (
              <span key={c.key} title={c.configured ? "Connected" : c.note}
                className={`rounded-full px-3 py-1 font-dm-mono text-[11px] ${c.configured ? "bg-[#39FF14]/15 text-[#39FF14]" : "bg-white/5 text-neutral-600"}`}>
                {c.configured ? "● " : "○ "}{c.label}
              </span>
            ))}
          </div>
          {!anyConfigured && (
            <p className="mt-3 rounded-xl border border-[#E8FF47]/20 bg-[#E8FF47]/[0.05] px-4 py-3 text-xs text-[#E8FF47]">
              No channels connected yet. Add a connector token in your Vercel env (Buffer for Instagram/FB/X/TikTok;
              Discord / Telegram / Mastodon post directly). Until then you can still copy your post below.
            </p>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button onClick={broadcast} disabled={sending || !anyConfigured}
              className="rounded-xl bg-[#CC00FF] px-6 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50">
              {sending ? "Broadcasting…" : "Broadcast to all"}
            </button>
            <button onClick={() => { navigator.clipboard.writeText(text); setMsg("Copied — paste it into Buffer or any app."); }}
              disabled={!text.trim()}
              className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-neutral-300 transition hover:bg-white/5 disabled:opacity-50">
              Copy text
            </button>
            <a href="https://publish.buffer.com" target="_blank" rel="noopener noreferrer" className="font-dm-mono text-xs text-[#3AFFD4] hover:underline">Open Buffer ↗</a>
            {msg && <span className="font-dm-mono text-xs text-neutral-400">{msg}</span>}
          </div>

          {results && (
            <div className="mt-4 space-y-1.5">
              {results.length === 0 ? <p className="text-sm text-neutral-500">No channels responded.</p> :
                results.map((r, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2 text-sm">
                    <span className="text-neutral-200">{r.ok ? "✅" : "⚠️"} {r.platform}</span>
                    <span className="font-dm-mono text-xs text-neutral-500">{r.detail}</span>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* Accounts on /social */}
        <h2 className="mt-10 mb-3 font-dm-mono text-xs uppercase tracking-widest text-neutral-500">Accounts on /social</h2>
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
          <div className="grid gap-2 sm:grid-cols-[8rem_1fr_1fr_auto]">
            <input value={platform} onChange={(e) => setPlatform(e.target.value)} placeholder="platform"
              className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm focus:outline-none" />
            <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="@handle (optional)"
              className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm focus:outline-none" />
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…"
              className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm focus:outline-none" />
            <button onClick={() => { if (url.trim()) { accountAction({ action: "add", platform, label, url }); setUrl(""); setLabel(""); } }}
              className="rounded-xl bg-[#39FF14] px-4 py-2 text-sm font-semibold text-black transition hover:opacity-90">Add</button>
          </div>
          <p className="mt-2 font-dm-mono text-[11px] text-neutral-600">Platforms: instagram, tiktok, youtube, facebook, x, discord, telegram, twitch, spotify, soundcloud, bluesky, mastodon, website…</p>

          <div className="mt-4 space-y-2">
            {accounts.length === 0 ? <p className="text-sm text-neutral-500">No accounts yet.</p> :
              accounts.map((a) => (
                <div key={a.id} className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/[0.02] px-3 py-2">
                  <span className="w-24 shrink-0 font-dm-mono text-xs uppercase tracking-widest text-neutral-400">{a.platform}</span>
                  <span className="min-w-0 flex-1 truncate text-sm text-neutral-300">{a.label ? `${a.label} · ` : ""}{a.url}</span>
                  <button onClick={() => accountAction({ action: "toggle", id: a.id, active: !a.active })}
                    className={`rounded-lg px-2.5 py-1 font-dm-mono text-[11px] ${a.active ? "bg-[#39FF14]/15 text-[#39FF14]" : "bg-white/5 text-neutral-500"}`}>
                    {a.active ? "shown" : "hidden"}
                  </button>
                  <button onClick={() => accountAction({ action: "delete", id: a.id })}
                    className="rounded-lg bg-[#FF5C3A]/10 px-2.5 py-1 font-dm-mono text-[11px] text-[#FF5C3A]">del</button>
                </div>
              ))}
          </div>
        </div>

        {/* Recent broadcasts */}
        {posts.length > 0 && (
          <>
            <h2 className="mt-10 mb-3 font-dm-mono text-xs uppercase tracking-widest text-neutral-500">Recent broadcasts</h2>
            <div className="space-y-2">
              {posts.map((p) => (
                <div key={p.id} className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
                  <p className="text-sm text-neutral-200">{p.text}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="font-dm-mono text-[11px] text-neutral-600">{new Date(p.created_at).toLocaleString()}</span>
                    {(p.results ?? []).map((r, i) => (
                      <span key={i} className={`font-dm-mono text-[11px] ${r.ok ? "text-[#39FF14]" : "text-[#FF5C3A]"}`}>{r.ok ? "✅" : "⚠️"} {r.platform}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
