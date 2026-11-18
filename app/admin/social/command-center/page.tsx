"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Account = { id: string; platform: string; label: string | null; url: string; active: boolean };
type Post = {
  id: string; title: string; caption: string; image_url: string | null; account_ids: string[];
  status: string; notes: string; planned_for: string | null; created_at: string;
};
type Editor = { id: string | null; title: string; caption: string; image_url: string; notes: string; planned_for: string; account_ids: string[] };
const empty = (): Editor => ({ id: null, title: "", caption: "", image_url: "", notes: "", planned_for: "", account_ids: [] });
const timeInput = (iso: string | null) => {
  if (!iso) return "";
  const dt = new Date(iso);
  return new Date(dt.getTime() - dt.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

export default function SocialCommandCenter() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [editor, setEditor] = useState<Editor>(empty);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [filter, setFilter] = useState("all");
  const [denied, setDenied] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/social/queue", { cache: "no-store" });
    if (response.status === 401 || response.status === 403) { setDenied(true); setLoading(false); return; }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) { setMessage(data.error || "Unable to load posts."); setLoading(false); return; }
    setPosts(data.posts || []);
    setAccounts(data.accounts || []);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function request(payload: Record<string, unknown>) {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/admin/social/queue", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Request failed.");
      await load();
      return true;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Something went wrong.");
      return false;
    } finally { setBusy(false); }
  }

  async function save() {
    const ok = await request({
      action: editor.id ? "edit" : "create", ...(editor.id ? { id: editor.id } : {}),
      ...editor, planned_for: editor.planned_for ? new Date(editor.planned_for).toISOString() : null,
    });
    if (ok) { setEditor(empty()); setMessage("Draft saved. Review and approve it before handoff."); }
  }

  function edit(post: Post) {
    setEditor({
      id: post.id, title: post.title, caption: post.caption, image_url: post.image_url || "",
      notes: post.notes, planned_for: timeInput(post.planned_for), account_ids: post.account_ids || [],
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const accountMap = useMemo(() => new Map(accounts.map(a => [a.id, a])), [accounts]);
  const visible = posts.filter(p => filter === "all" || p.status === filter);
  const stats = [
    ["Drafts", posts.filter(p => p.status === "draft").length, "#00D4FF"],
    ["Approved", posts.filter(p => p.status === "approved").length, "#39FF14"],
    ["Scheduled", posts.filter(p => p.status === "scheduled").length, "#E8FF47"],
    ["Published (confirmed)", posts.filter(p => p.status === "published").length, "#CC00FF"],
  ] as const;

  function musePrompt(post: Post) {
    const targets = post.account_ids.map(id => accountMap.get(id)).filter((a): a is Account => !!a)
      .map(a => a.platform + (a.label ? " " + a.label : "") + " (" + a.url + ")").join("\n");
    return `NorthEDM social media handoff. Please prepare this approved post for publication only on the selected accounts below. Confirm every target account and request approval before publishing. Do not invent publication success.\n\nTITLE: ${post.title || "Untitled"}\nCAPTION:\n${post.caption}\n\nIMAGE: ${post.image_url || "None supplied"}\nTARGET ACCOUNTS:\n${targets}\nSCHEDULE: ${post.planned_for ? new Date(post.planned_for).toLocaleString() : "No scheduled time"}\nNOTES: ${post.notes || "None"}\n\nAfter publishing, report success or failure separately for each account.`;
  }

  if (loading) return <main className="admin-surface min-h-screen p-12 text-neutral-300">Loading Social Command Center…</main>;
  if (denied) return <main className="admin-surface min-h-screen p-12 text-neutral-300">Administrator access required.</main>;

  return <main className="admin-surface min-h-screen px-4 py-14 text-neutral-100 sm:px-8">
    <div className="mx-auto max-w-6xl">
      <Link href="/admin/social" className="font-dm-mono text-xs text-neutral-400 hover:text-[#3AFFD4]">← Social &amp; broadcasts</Link>
      <p className="mt-6 font-dm-mono text-xs uppercase tracking-[0.3em] text-[#CC00FF]">NorthEDM · Admin</p>
      <h1 className="mt-2 font-bebas text-5xl tracking-wide">Social Command Center</h1>
      <p className="mt-2 max-w-3xl text-sm text-neutral-400">Plan once, choose your channels, approve the post and hand it off to Muse. This queue stores drafts and schedule intentions; Muse publishing is not yet automatically connected.</p>

      <div className="mt-7 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map(([label, count, color]) => <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="font-dm-mono text-[11px] uppercase text-neutral-400">{label}</p>
          <p className="mt-1 font-bebas text-4xl" style={{ color }}>{count}</p>
        </div>)}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <section className="rounded-2xl border border-[#CC00FF]/25 bg-white/[0.03] p-5">
          <h2 className="font-bebas text-2xl tracking-wide">{editor.id ? "Edit draft" : "Compose a post"}</h2>
          <label className="mt-4 block text-xs text-neutral-400">Internal title
            <input className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 p-3 text-sm text-white" value={editor.title} onChange={e => setEditor(s => ({ ...s, title: e.target.value }))} maxLength={150} placeholder="Festival announcement" />
          </label>
          <label className="mt-4 block text-xs text-neutral-400">Post caption
            <textarea className="mt-1 min-h-36 w-full resize-y rounded-xl border border-white/10 bg-black/30 p-3 text-sm text-white" value={editor.caption} maxLength={5000} onChange={e => setEditor(s => ({ ...s, caption: e.target.value }))} placeholder="Unite the Northeast…"/>
          </label>
          <label className="mt-4 block text-xs text-neutral-400">Image URL (optional)
            <input className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 p-3 text-sm text-white" value={editor.image_url} onChange={e => setEditor(s => ({ ...s, image_url: e.target.value }))} placeholder="https://…" />
          </label>
          <label className="mt-4 block text-xs text-neutral-400">Planned date/time (optional, local time)
            <input type="datetime-local" className="mt-1 block w-full rounded-xl border border-white/10 bg-black/30 p-3 text-sm text-white" value={editor.planned_for} onChange={e => setEditor(s => ({ ...s, planned_for: e.target.value }))}/>
          </label>
          <label className="mt-4 block text-xs text-neutral-400">Instructions for Muse
            <textarea className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 p-3 text-sm text-white" value={editor.notes} maxLength={2000} rows={2} onChange={e => setEditor(s => ({ ...s, notes: e.target.value }))} placeholder="Brand voice, hashtags, goals…"/>
          </label>
          <h3 className="mt-5 font-dm-mono text-xs uppercase tracking-widest text-neutral-400">Select target accounts</h3>
          {accounts.length ? <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {accounts.map(a => <label key={a.id} className="flex items-center gap-2 rounded-lg border border-white/10 p-2 text-sm">
              <input type="checkbox" checked={editor.account_ids.includes(a.id)} onChange={e => setEditor(s => ({ ...s, account_ids: e.target.checked ? [...s.account_ids, a.id] : s.account_ids.filter(id => id !== a.id) }))}/>
              <span className="truncate">{a.platform} · {a.label || a.url}</span>
            </label>)}
          </div> : <p className="mt-2 text-sm text-[#E8FF47]">No social accounts listed. Add your accounts on the <Link href="/admin/social" className="underline">Social admin page</Link> first. Listing an account is not an authenticated publishing connection.</p>}
          <div className="mt-5 flex flex-wrap gap-3">
            <button type="button" disabled={busy || !editor.caption.trim()} onClick={() => void save()} className="rounded-xl bg-[#CC00FF] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40">{busy ? "Saving…" : editor.id ? "Save revisions as draft" : "Save draft"}</button>
            {editor.id && <button type="button" onClick={() => setEditor(empty())} className="rounded-xl border border-white/20 px-5 py-2.5 text-sm">Cancel editing</button>}
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
          <h2 className="font-bebas text-2xl tracking-wide">Publishing workflow</h2>
          <div className="mt-4 space-y-4 text-sm text-neutral-300">
            <p><strong className="text-[#00D4FF]">01 · Draft</strong> — Write your post and choose destinations.</p>
            <p><strong className="text-[#39FF14]">02 · Approve</strong> — Explicitly approve the content. Scheduled posts stay in the queue until you hand them off.</p>
            <p><strong className="text-[#E8FF47]">03 · Muse handoff</strong> — Copy the generated instruction into Muse, then confirm publishing within Muse.</p>
            <p><strong className="text-[#CC00FF]">04 · Confirm</strong> — Mark the post as published or failed after checking each destination.</p>
          </div>
          <div className="mt-6 rounded-xl border border-[#E8FF47]/20 bg-[#E8FF47]/5 p-4 text-xs text-neutral-300">
            <strong className="text-[#E8FF47]">Connection status: manual handoff</strong>
            <p className="mt-1">No Muse credentials are stored here. No platform is automatically posted to by this feature. Existing direct broadcast functionality remains available separately.</p>
          </div>
          <Link href="/admin/social" className="mt-5 inline-block text-sm text-[#3AFFD4] underline">Manage public social accounts and existing broadcasts</Link>
        </section>
      </div>

      <section className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-bebas text-3xl tracking-wide">Content queue</h2>
          <select className="rounded-xl border border-white/10 bg-[#18151d] p-2 text-sm text-white" value={filter} onChange={e => setFilter(e.target.value)}>
            {["all","draft","approved","scheduled","handoff","published","failed","archived"].map(s => <option key={s} value={s}>{s === "all" ? "All statuses" : s}</option>)}
          </select>
        </div>
        <div className="mt-4 space-y-3">
          {visible.length === 0 && <div className="rounded-2xl border border-white/10 p-6 text-sm text-neutral-500">No posts in this view yet.</div>}
          {visible.map(post => <article key={post.id} className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-lg font-semibold">{post.title || "Untitled post"}</h3>
              <span className="rounded-full border border-[#CC00FF]/30 px-3 py-1 font-dm-mono text-[11px] uppercase text-[#D88AFF]">{post.status}</span>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm text-neutral-300">{post.caption}</p>
            <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-neutral-500">
              {post.account_ids.map(id => <span key={id} className="rounded-lg bg-white/5 px-2 py-1">{accountMap.get(id)?.platform || "Unknown account"} · {accountMap.get(id)?.label || "target"}</span>)}
              {post.planned_for && <span className="rounded-lg bg-white/5 px-2 py-1">Planned: {new Date(post.planned_for).toLocaleString()}</span>}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {["draft","approved","scheduled"].includes(post.status) && <button type="button" disabled={busy} onClick={() => edit(post)} className="rounded-lg border border-white/15 px-3 py-2 text-xs">Edit</button>}
              {post.status === "draft" && <button type="button" disabled={busy} onClick={() => void request({ action: "status", id: post.id, status: post.planned_for ? "scheduled" : "approved" })} className="rounded-lg bg-[#39FF14]/15 px-3 py-2 text-xs text-[#39FF14]">Approve{post.planned_for ? " & schedule" : ""}</button>}
              {["approved","scheduled"].includes(post.status) && <button type="button" disabled={busy} onClick={() => void request({ action: "status", id: post.id, status: "draft" })} className="rounded-lg border border-white/15 px-3 py-2 text-xs">Return to draft</button>}
              {["approved","scheduled","failed"].includes(post.status) && <button type="button" disabled={busy} onClick={async () => {
                if (post.status === "scheduled" && post.planned_for && new Date(post.planned_for).getTime() > Date.now() &&
                  !window.confirm("This post is scheduled for a future date. Hand off early?")) return;
                const ok = await request({ action: "status", id: post.id, status: "handoff" });
                if (ok) { await navigator.clipboard.writeText(musePrompt(post)); setMessage("Muse handoff copied to clipboard. Paste it into Muse; this does not publish automatically."); }
              }} className="rounded-lg bg-[#CC00FF] px-3 py-2 text-xs font-semibold text-white">Copy for Muse &amp; hand off</button>}
              {post.status === "handoff" && <>
                <button type="button" disabled={busy} onClick={() => void navigator.clipboard.writeText(musePrompt(post)).then(() => setMessage("Muse instructions copied."))} className="rounded-lg border border-white/15 px-3 py-2 text-xs">Copy Muse prompt again</button>
                <button type="button" disabled={busy} onClick={() => void request({ action: "status", id: post.id, status: "published" })} className="rounded-lg bg-[#39FF14]/15 px-3 py-2 text-xs text-[#39FF14]">Confirm published externally</button>
                <button type="button" disabled={busy} onClick={() => void request({ action: "status", id: post.id, status: "failed" })} className="rounded-lg bg-red-500/15 px-3 py-2 text-xs text-red-300">Mark failed</button>
              </>}
              {["draft","approved","scheduled","published","failed"].includes(post.status) && <button type="button" disabled={busy} onClick={() => void request({ action: "status", id: post.id, status: "archived" })} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-neutral-500">Archive</button>}
              {post.status === "archived" && <button type="button" disabled={busy} onClick={() => void request({ action: "status", id: post.id, status: "draft" })} className="rounded-lg border border-white/10 px-3 py-2 text-xs">Restore draft</button>}
            </div>
          </article>)}
        </div>
      </section>
      {message && <div role="status" className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-xl rounded-xl border border-white/20 bg-[#211827] px-4 py-3 text-sm text-white shadow-xl">{message} <button type="button" className="ml-3 underline" onClick={() => setMessage("")}>Dismiss</button></div>}
    </div>
  </main>;
}
